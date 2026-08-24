import assert from "node:assert/strict";
import { access, chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { mock } from "node:test";

import { loadBundledAgents } from "./agents.ts";
import { executeSubagent } from "./runtime.ts";

const bundledAgents = await loadBundledAgents(new URL("./agents/", import.meta.url));
const originalPath = process.env.PATH;
let fakePiDirectory: string;
let recordPath: string;

await testSetup();

test.after(async () => {
  process.env.PATH = originalPath;
  await rm(fakePiDirectory, { recursive: true, force: true });
});

test("returns an identified unknown-agent failure without starting a child", async () => {
  const before = await records();
  const result = await executeSubagent(
    "missing",
    "inspect the project",
    bundledAgents,
    makeContext(),
    undefined,
  );

  assert.equal(result.details.state, "failed");
  assert.match(textContent(result), /Unknown agent: missing/);
  for (const name of ["scout", "worker", "oracle", "reviewer"]) {
    assert.match(textContent(result), new RegExp(name));
  }
  assert.equal(result.details.attempts.length, 0);
  assert.deepEqual(await records(), before);
});

test("passes the mapped model, thinking level, tools, cwd, prompt, and literal task", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "pi-subagent-cwd-"));
  const task = "print $HOME && do not split this argument";
  const result = await executeSubagent("worker", task, bundledAgents, makeContext(cwd), undefined);
  const [record] = await records();

  assert.equal(result.details.state, "succeeded");
  assert.equal(record.cwd, cwd);
  assert.equal(record.argv.at(-1), task);
  assert.deepEqual(record.argv.slice(0, 9), [
    "--mode",
    "json",
    "-p",
    "--no-session",
    "--no-skills",
    "--model",
    "openai-codex/gpt-5.6-luna",
    "--thinking",
    "max",
  ]);
  assert.equal(record.argv[9], "--tools");
  assert.equal(record.argv[10], "read,bash,edit,write,grep,find,ls");
  assert.equal(record.argv[11], "--append-system-prompt");
  assert.match(record.argv[12], /pi-subagent-/);
  assert.equal(record.prompt, bundledAgents[1].systemPrompt);
  assert.equal(result.details.attempts[0].messages.at(-1).role, "assistant");

  await rm(cwd, { recursive: true, force: true });
});

test("falls back to the parent model and thinking level when the mapped model is unavailable", async () => {
  const result = await executeSubagent(
    "scout",
    "check the fallback",
    bundledAgents,
    makeContext(undefined, {
      available: [],
      model: { provider: "openai-codex", id: "parent-model" },
      thinkingLevel: "high",
    }),
    undefined,
  );
  const record = (await records()).at(-1)!;

  assert.equal(result.details.model, "openai-codex/parent-model");
  assert.equal(result.details.thinkingLevel, "high");
  assert.equal(record.argv[6], "openai-codex/parent-model");
  assert.equal(record.argv[8], "high");
  assert.match(result.details.attempts[0].activity[0], /unavailable/i);
});

test("uses a distinct child process for each delegated call", async () => {
  await executeSubagent("oracle", "first call", bundledAgents, makeContext(), undefined);
  await executeSubagent("oracle", "second call", bundledAgents, makeContext(), undefined);
  const recent = await records();

  assert.notEqual(recent.at(-1).pid, recent.at(-2).pid);
});

test("streams text and tool events and keeps message_end messages authoritative", async () => {
  const updates: any[] = [];
  const result = await withScenario("stream", () =>
    executeSubagent("scout", "stream details", bundledAgents, makeContext(), undefined, (update) => {
      updates.push(update);
    }),
  );

  assert.equal(result.details.state, "succeeded");
  assert.equal(result.content[0].text, "authoritative final output");
  assert.ok(updates.some((update) => update.details.attempts[0].activity.some((item: string) => item.includes("partial text"))));
  assert.ok(updates.some((update) => update.details.attempts[0].activity.some((item: string) => item.includes("read"))));
  assert.deepEqual(
    result.details.attempts[0].messages.map((message: any) => message.content?.[0]?.text),
    ["intermediate message", "authoritative final output"],
  );
});

test("preserves stderr and malformed protocol diagnostics", async () => {
  const result = await withScenario("malformed", () =>
    executeSubagent("scout", "fail with diagnostics", bundledAgents, makeContext(), undefined),
  );

  assert.equal(result.details.state, "failed");
  assert.match(result.details.attempts[0].stderr, /provider diagnostics/);
  assert.match(result.details.attempts[0].error ?? "", /malformed JSON/i);
  assert.match(result.content[0].text, /provider diagnostics/);
});

test("bounds oversized Unicode final output to 50 KiB", async () => {
  const result = await withScenario("oversized", () =>
    executeSubagent("scout", "return a large answer", bundledAgents, makeContext(), undefined),
  );
  const text = result.content[0].text;

  assert.ok(Buffer.byteLength(text, "utf8") <= 50 * 1024);
  assert.match(text, /truncated/i);
  const preserved = result.details.attempts[0].messages[0].content[0].text;
  assert.equal(Array.from(preserved).length, 30_000, `preserved bytes=${Buffer.byteLength(preserved, "utf8")} chars=${preserved.length}`);
});

test("retries a startup failure once and returns the successful second attempt", async () => {
  const before = (await records()).length;
  const result = await withScenario("retry-startup", () =>
    executeSubagent("worker", "retry startup", bundledAgents, makeContext(), undefined),
  );
  const recent = (await records()).slice(before);

  assert.equal(recent.length, 2);
  assert.deepEqual(result.details.attempts.map((attempt: any) => attempt.state), ["failed", "succeeded"]);
  assert.equal(result.details.state, "succeeded");
  assert.equal(result.content[0].text, "child output");
});

test("retries a provider failure once and preserves its diagnostic", async () => {
  const result = await withScenario("retry-provider", () =>
    executeSubagent("oracle", "retry provider", bundledAgents, makeContext(), undefined),
  );

  assert.equal(result.details.attempts.length, 2);
  assert.match(result.details.attempts[0].error, /provider unavailable/);
  assert.equal(result.details.attempts[1].state, "succeeded");
});

test("retries malformed protocol once", async () => {
  const result = await withScenario("retry-malformed", () =>
    executeSubagent("scout", "retry malformed protocol", bundledAgents, makeContext(), undefined),
  );

  assert.equal(result.details.attempts.length, 2);
  assert.match(result.details.attempts[0].error, /malformed JSON/i);
  assert.equal(result.details.attempts[1].state, "succeeded");
});

test("retries an abnormal child close once", async () => {
  const result = await withScenario("retry-abnormal", () =>
    executeSubagent("scout", "retry abnormal close", bundledAgents, makeContext(), undefined),
  );

  assert.equal(result.details.attempts.length, 2);
  assert.equal(result.details.attempts[0].state, "failed");
  assert.equal(result.details.attempts[1].state, "succeeded");
});

test("returns one bounded aggregate failure after two failed attempts", async () => {
  const result = await withScenario("fail-twice", () =>
    executeSubagent("reviewer", "fail twice", bundledAgents, makeContext(), undefined),
  );

  assert.equal(result.details.state, "failed");
  assert.equal(result.details.attempts.length, 2);
  assert.match(result.content[0].text, /Attempt 1/);
  assert.match(result.content[0].text, /Attempt 2/);
  assert.match(result.content[0].text, /failure attempt 1/);
  assert.match(result.content[0].text, /failure attempt 2/);
  assert.ok(Buffer.byteLength(result.content[0].text, "utf8") <= 50 * 1024);
});

test("removes the temporary prompt after success and failure", async () => {
  const before = (await records()).length;
  await withScenario("cleanup-success", () =>
    executeSubagent("scout", "cleanup success", bundledAgents, makeContext(), undefined),
  );
  const successRecord = (await records()).slice(before, before + 1)[0];
  assert.equal(await pathExists(successRecord.argv[12]), false);
  assert.equal(await pathExists(path.dirname(successRecord.argv[12])), false);

  const failureBefore = (await records()).length;
  await withScenario("fail-twice", () =>
    executeSubagent("scout", "cleanup failure path", bundledAgents, makeContext(), undefined),
  );
  const failureRecords = (await records()).slice(failureBefore);
  assert.equal(failureRecords.length, 2);
  for (const record of failureRecords) assert.equal(await pathExists(record.argv[12]), false);
});

test("rethrows the original cancellation reason and cleans up a responsive child", async () => {
  const controller = new AbortController();
  const reason = { code: "cancelled" };
  const before = (await records()).length;
  const pending = withScenario("cancel", () =>
    executeSubagent("scout", "cancel this", bundledAgents, makeContext(), controller.signal),
  );
  const record = await waitForScenarioRecord("cancel", before);
  controller.abort(reason);

  await assert.rejects(pending, (error) => error === reason);
  assert.equal(await pathExists(record.argv[12]), false);
  const finalRecord = (await records()).at(-1);
  assert.ok(finalRecord.signals?.includes("SIGTERM"));
});

test("force-terminates an unresponsive child after the cancellation grace period", { timeout: 8_000 }, async () => {
  const controller = new AbortController();
  const reason = new Error("forced cancellation");
  const before = (await records()).length;
  const pending = withScenario("hang", () =>
    executeSubagent("scout", "cancel a hung child", bundledAgents, makeContext(), controller.signal),
  );
  const record = await waitForScenarioRecord("hang", before);
  controller.abort(reason);

  await assert.rejects(pending, (error) => error === reason);
  assert.equal(await pathExists(record.argv[12]), false);
  assert.throws(() => process.kill(record.pid, 0));
});

test("reports temporary prompt cleanup failure instead of success", async () => {
  const remove = mock.method(fsPromises as any, "rm", async () => {
    throw new Error("cleanup unavailable");
  });
  try {
    const result = await withScenario("cleanup-failure", () =>
      executeSubagent("scout", "cleanup failure", bundledAgents, makeContext(), undefined),
    );
    assert.equal(result.details.state, "failed");
    assert.match(result.content[0].text, /cleanup unavailable/i);
  } finally {
    remove.mock.restore();
  }
});

async function withScenario<T>(scenario: string, callback: () => Promise<T>): Promise<T> {
  const previous = process.env.PI_SUBAGENT_SCENARIO;
  process.env.PI_SUBAGENT_SCENARIO = scenario;
  try {
    return await callback();
  } finally {
    if (previous === undefined) delete process.env.PI_SUBAGENT_SCENARIO;
    else process.env.PI_SUBAGENT_SCENARIO = previous;
  }
}

function makeContext(
  cwd = process.cwd(),
  overrides: {
    available?: readonly string[];
    model?: { provider: string; id: string };
    thinkingLevel?: string;
  } = {},
): any {
  const model = overrides.model ?? { provider: "openai-codex", id: "parent" };
  const available = overrides.available ?? ["openai-codex/gpt-5.6-luna", "openai-codex/gpt-5.6-sol"];
  return {
    cwd,
    model,
    thinkingLevel: overrides.thinkingLevel ?? "medium",
    modelRegistry: {
      getAvailable: () => available.map((name) => {
        const [provider, id] = name.split("/", 2);
        return { provider, id };
      }),
    },
  };
}

function textContent(result: any): string {
  return result.content.map((item: any) => item.type === "text" ? item.text : "").join("\n");
}

async function records(): Promise<any[]> {
  try {
    return JSON.parse(await readFile(recordPath, "utf8"));
  } catch {
    return [];
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function waitForScenarioRecord(scenario: string, before: number): Promise<any> {
  for (let attempt = 0; attempt < 100; attempt++) {
    const record = (await records()).slice(before).find((candidate) => candidate.scenario === scenario);
    if (record) return record;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`No child record for ${scenario}`);
}

async function testSetup(): Promise<void> {
  fakePiDirectory = await mkdtemp(path.join(os.tmpdir(), "pi-subagent-fake-pi-"));
  recordPath = path.join(fakePiDirectory, "records.json");
  await writeFile(recordPath, "[]");
  const executable = path.join(fakePiDirectory, "pi");
  await writeFile(
    executable,
    `#!/usr/bin/env node
const fs = require("node:fs");
const recordPath = process.env.PI_SUBAGENT_RECORD;
const records = JSON.parse(fs.readFileSync(recordPath, "utf8"));
const argv = process.argv.slice(2);
const scenario = process.env.PI_SUBAGENT_SCENARIO;
const attemptNumber = records.filter((record) => record.scenario === scenario).length + 1;
records.push({ scenario, argv, cwd: process.cwd(), pid: process.pid, attemptNumber, prompt: fs.readFileSync(argv[12], "utf8") });
fs.writeFileSync(recordPath, JSON.stringify(records));
const usage = { input: 0, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 1, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
function assistant(text, stopReason = "stop", errorMessage) {
  return { role: "assistant", content: [{ type: "text", text }], api: "openai-responses", provider: "fake", model: "fake", usage, stopReason, ...(errorMessage ? { errorMessage } : {}), timestamp: Date.now() };
}
function emit(value, newline = true) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  const data = Buffer.from(text, "utf8");
  for (let index = 0; index < data.length; index += 7) process.stdout.write(data.subarray(index, index + 7));
  if (newline) process.stdout.write("\\n");
}
function recordSignal(signal) {
  const current = JSON.parse(fs.readFileSync(recordPath, "utf8"));
  const record = current.filter((item) => item.pid === process.pid).at(-1);
  record.signals = (record.signals || "") + signal;
  fs.writeFileSync(recordPath, JSON.stringify(current));
}
if (scenario === "cancel") {
  process.on("SIGTERM", () => { recordSignal("SIGTERM"); process.exit(143); });
  setInterval(() => {}, 1000);
} else if (scenario === "hang") {
  process.on("SIGTERM", () => { recordSignal("SIGTERM"); });
  setInterval(() => {}, 1000);
} else if ((scenario === "retry-startup" && attemptNumber === 1) || scenario === "fail-twice") {
  process.stderr.write("failure attempt " + attemptNumber + "\\n");
  process.exitCode = 1;
} else if (scenario === "retry-provider" && attemptNumber === 1) {
  emit({ type: "message_end", message: assistant("provider failed", "error", "provider unavailable") });
} else if (scenario === "retry-malformed" && attemptNumber === 1) {
  emit("{not valid json");
} else if (scenario === "retry-abnormal" && attemptNumber === 1) {
  process.kill(process.pid, "SIGTERM");
} else if (scenario === "stream") {
  emit({ type: "message_update", usage, assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: "partial text" } });
  emit({ type: "tool_execution_start", toolCallId: "tool-1", toolName: "read", args: { path: "src/index.ts" } });
  emit({ type: "tool_execution_end", toolCallId: "tool-1", toolName: "read", result: { content: [] }, isError: false });
  emit({ type: "message_end", message: assistant("intermediate message") });
  emit({ type: "message_end", message: assistant("authoritative final output") }, false);
} else if (scenario === "malformed") {
  emit("{not valid json");
  process.stderr.write("provider diagnostics\\n");
  process.exitCode = 1;
} else if (scenario === "oversized") {
  emit({ type: "message_end", message: assistant("🙂".repeat(30000)) });
} else {
  emit({ type: "message_end", message: assistant("child output") });
}
`,
  );
  await chmod(executable, 0o755);
  process.env.PATH = `${fakePiDirectory}${path.delimiter}${originalPath ?? ""}`;
  process.env.PI_SUBAGENT_RECORD = recordPath;
}
