import assert from "node:assert/strict";
import { access, chmod, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { mock } from "node:test";

import { loadBundledAgents } from "../agents/index.ts";
import { executeSubagent as executeRuntime, executeSubagentBatch, MAX_RESULT_BYTES } from "./index.ts";

const bundledAgents = await loadBundledAgents(new URL("../agents/", import.meta.url));

function outputText(result: { content: readonly { type: string; text?: string }[] }): string {
  const part = result.content[0];
  if (part?.type !== "text" || part.text === undefined) {
    throw new Error(`expected text output, received ${part?.type ?? "nothing"}`);
  }
  return part.text;
}

test("normalizes titles to one safe non-blank line", async () => {
  const { normalizeTitle } = await import("./index.ts");

  assert.equal(normalizeTitle("  inspect\n\t API  " ), "inspect API");
  assert.equal(normalizeTitle("line\u2028break\u2029here"), "line break here");
  assert.equal(normalizeTitle("line\u0085break"), "line break");
  assert.equal(normalizeTitle("ansi\u001b[31m title\u001b[0m"), "ansi title");
  assert.equal(normalizeTitle("safe\u001bP1;hidden\u001b\\ title"), "safe title");
  assert.throws(() => normalizeTitle("\u001b[31m\u001b[0m"), /title.*blank/i);
  assert.throws(() => normalizeTitle("\u001b[?25l"), /title.*blank/i);
  assert.throws(() => normalizeTitle(" \u0000\u001b\t "), /title.*blank/i);
  assert.throws(() => normalizeTitle("\u200b\u200c\u200d\u2060"), /title.*blank/i);
  assert.throws(() => normalizeTitle("\u202a\u202e\u202c\u2066"), /title.*blank/i);
  assert.equal(normalizeTitle("safe\u200b\u202e title\u2069"), "safe title");
});

test("rejects a non-string title before emitting a run", async () => {
  const sessionRoot = await mkdtemp(path.join(os.tmpdir(), "pi-subagent-invalid-title-"));
  const events: any[] = [];
  try {
    await assert.rejects(
      executeRuntime(
        "run-invalid-title",
        { agent: "scout", title: null as any, task: "inspect" },
        bundledAgents,
        makeContext(),
        sessionRoot,
        undefined,
        { onMonitorEvent: (event) => events.push(event) },
      ),
      /title.*string/i,
    );
    assert.deepEqual(events, []);
  } finally {
    await rm(sessionRoot, { recursive: true, force: true });
  }
});

const originalPath = process.env.PATH;
let fakePiDirectory: string;
let recordPath: string;
let testSessionRoot: string;

await testSetup();

function executeSubagent(
  agent: string,
  task: string,
  catalog: typeof bundledAgents,
  ctx: any,
  signal: AbortSignal | undefined,
  onUpdate?: (result: any) => void,
  onMonitorEvent: (event: any) => void = () => {},
): Promise<any> {
  return executeRuntime(
    `test-${agent}-${Date.now()}-${Math.random()}`,
    { agent, title: `${agent} test`, task },
    catalog,
    ctx,
    testSessionRoot,
    signal,
    { onToolUpdate: onUpdate, onMonitorEvent },
  );
}

test.after(async () => {
  process.env.PATH = originalPath;
  await rm(fakePiDirectory, { recursive: true, force: true });
  await rm(testSessionRoot, { recursive: true, force: true });
});

test("batch classification returns one ordered outcome for every submitted item", async () => {
  const sessionRoot = await mkdtemp(path.join(os.tmpdir(), "pi-subagent-batch-classification-"));
  const tasks: any[] = Array.from({ length: 8 }, (_, index) => ({
    agent: "scout",
    title: `task ${index}`,
    task: `inspect ${index}`,
  }));
  tasks[3].extra = "reject";
  tasks.push(new Proxy({}, {
    get() {
      throw new Error("over-limit item was read");
    },
    ownKeys() {
      throw new Error("over-limit item was inspected");
    },
  }));

  try {
    const result = await withScenario("batch-classification", () => executeSubagentBatch(
      "batch-classification",
      { tasks },
      bundledAgents,
      makeContext(),
      sessionRoot,
      undefined,
      { onMonitorEvent: () => {} },
    ));

    assert.deepEqual(result.details.outcomes.map((outcome: any) => [outcome.index, outcome.status]), [
      [0, "succeeded"],
      [1, "succeeded"],
      [2, "succeeded"],
      [3, "malformed"],
      [4, "succeeded"],
      [5, "succeeded"],
      [6, "succeeded"],
      [7, "succeeded"],
      [8, "over-limit"],
    ]);
    const batchRecords = (await records()).filter((record) => record.scenario === "batch-classification");
    assert.ok(batchRecords.every((record) => record.argv.at(-1) !== "inspect 3" && record.argv.at(-1) !== "inspect 8"));
    assert.doesNotMatch(JSON.stringify(result.details.outcomes[3]), /reject/);
    assert.doesNotMatch(JSON.stringify(result.details.outcomes[8]), /ignored|read/);
  } finally {
    await rm(sessionRoot, { recursive: true, force: true });
  }
});

test("batch classification rejects non-enumerable and symbol extra fields", async () => {
  const sessionRoot = await mkdtemp(path.join(os.tmpdir(), "pi-subagent-batch-shape-"));
  const hidden: any = { agent: "scout", title: "hidden", task: "reject hidden" };
  Object.defineProperty(hidden, "extra", { value: true });
  const symbol = Symbol("extra");
  const symbolic: any = { agent: "scout", title: "symbolic", task: "reject symbolic" };
  symbolic[symbol] = true;
  const throwing = new Proxy({ agent: "scout", title: "throwing", task: "reject getter" }, {
    get() {
      throw new Error("malformed getter");
    },
  });
  try {
    const result = await executeSubagentBatch(
      "batch-shape",
      { tasks: [hidden, symbolic, throwing] },
      bundledAgents,
      makeContext(),
      sessionRoot,
      undefined,
      { onMonitorEvent: () => {} },
    );
    assert.deepEqual(result.details.outcomes.map((outcome: any) => outcome.status), ["malformed", "malformed", "malformed"]);
  } finally {
    await rm(sessionRoot, { recursive: true, force: true });
  }
});

test("batch classification records sparse task positions as malformed", async () => {
  const sessionRoot = await mkdtemp(path.join(os.tmpdir(), "pi-subagent-batch-sparse-"));
  const tasks: any[] = [];
  tasks[0] = { agent: "scout", title: "first", task: "first" };
  tasks[2] = { agent: "scout", title: "third", task: "third" };
  try {
    const result = await executeSubagentBatch(
      "batch-sparse",
      { tasks },
      bundledAgents,
      makeContext(),
      sessionRoot,
      undefined,
      { onMonitorEvent: () => {} },
    );
    assert.deepEqual(result.details.outcomes.map((outcome: any) => outcome.status), ["succeeded", "malformed", "succeeded"]);
  } finally {
    await rm(sessionRoot, { recursive: true, force: true });
  }
});

test("batch concurrency starts every queued task at once", { timeout: 10_000 }, async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pi-subagent-batch-concurrency-"));
  const marker = path.join(directory, "started");
  const release = path.join(directory, "release");
  const previousMarker = process.env.PI_SUBAGENT_BATCH_MARKER;
  const previousRelease = process.env.PI_SUBAGENT_BATCH_RELEASE;
  process.env.PI_SUBAGENT_BATCH_MARKER = marker;
  process.env.PI_SUBAGENT_BATCH_RELEASE = release;
  const tasks = Array.from({ length: 9 }, (_, index) => ({
    agent: "scout",
    title: `concurrent ${index}`,
    task: `block ${index}`,
  }));
  let pending: Promise<any> | undefined;
  try {
    pending = withScenario("batch-concurrency", () => executeSubagentBatch(
      "batch-concurrency",
      { tasks },
      bundledAgents,
      makeContext(),
      testSessionRoot,
      undefined,
      { onMonitorEvent: () => {} },
    ));
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        if ((await readFile(marker, "utf8")).trim().split("\n").filter(Boolean).length >= 8) break;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal((await readFile(marker, "utf8")).trim().split("\n").filter(Boolean).length, 8);
    await writeFile(release, "release");
    const result = await pending;
    assert.deepEqual(result.details.outcomes.map((outcome: any) => outcome.status), [
      "succeeded", "succeeded", "succeeded", "succeeded",
      "succeeded", "succeeded", "succeeded", "succeeded",
      "over-limit",
    ]);
    assert.equal((await readFile(marker, "utf8")).trim().split("\n").filter(Boolean).length, 8);
  } finally {
    await writeFile(release, "release").catch(() => {});
    await pending?.catch(() => {});
    if (previousMarker === undefined) delete process.env.PI_SUBAGENT_BATCH_MARKER;
    else process.env.PI_SUBAGENT_BATCH_MARKER = previousMarker;
    if (previousRelease === undefined) delete process.env.PI_SUBAGENT_BATCH_RELEASE;
    else process.env.PI_SUBAGENT_BATCH_RELEASE = previousRelease;
    await rm(directory, { recursive: true, force: true });
  }
});

test("batch failure isolation preserves ordered sibling outcomes", async () => {
  const sessionRoot = await mkdtemp(path.join(os.tmpdir(), "pi-subagent-batch-failure-"));
  const throwingAgent: any = { ...bundledAgents[0], name: "throwing" };
  Object.defineProperty(throwingAgent, "model", {
    get() {
      throw new Error("catalog entry failed");
    },
  });
  const catalog: any = [...bundledAgents, throwingAgent];
  try {
    const result = await executeSubagentBatch(
      "batch-failure",
      {
        tasks: [
          { agent: "scout", title: "works", task: "succeed" },
          { agent: "missing", title: "unknown", task: "fail normally" },
          { agent: "throwing", title: "throws", task: "fail unexpectedly" },
        ],
      },
      catalog,
      makeContext(),
      sessionRoot,
      undefined,
      { onMonitorEvent: () => {} },
    );

    assert.deepEqual(result.details.outcomes.map((outcome: any) => [outcome.index, outcome.status]), [
      [0, "succeeded"],
      [1, "failed"],
      [2, "failed"],
    ]);
    const [, unknownAgent, thrown] = result.details.outcomes as any[];
    assert.equal(unknownAgent.run.attempts.length, 0);
    assert.match(unknownAgent.run.error, /Unknown agent: missing/);
    assert.equal(thrown.run.attempts.length, 0);
    assert.match(thrown.run.error, /catalog entry failed/);
  } finally {
    await rm(sessionRoot, { recursive: true, force: true });
  }
});

test("batch cancellation settles active workers before the original abort rejection", { timeout: 10_000 }, async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pi-subagent-batch-cancel-"));
  const marker = path.join(directory, "started");
  const previousMarker = process.env.PI_SUBAGENT_BATCH_MARKER;
  process.env.PI_SUBAGENT_BATCH_MARKER = marker;
  const controller = new AbortController();
  const reason = { code: "batch-cancelled" };
  const tasks = Array.from({ length: 5 }, (_, index) => ({
    agent: "scout",
    title: `cancel ${index}`,
    task: `block ${index}`,
  }));
  let pending: Promise<any> | undefined;
  try {
    pending = withScenario("batch-cancel", () => executeSubagentBatch(
      "batch-cancel",
      { tasks },
      bundledAgents,
      makeContext(),
      testSessionRoot,
      controller.signal,
      { onMonitorEvent: () => {} },
    ));
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        if ((await readFile(marker, "utf8")).trim().split("\n").filter(Boolean).length >= 5) break;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal((await readFile(marker, "utf8")).trim().split("\n").filter(Boolean).length, 5);
    controller.abort(reason);
    await assert.rejects(pending, (error) => error === reason);
    assert.equal((await readFile(marker, "utf8")).trim().split("\n").filter(Boolean).length, 5);
    for (const record of (await records()).filter((value) => value.scenario === "batch-cancel")) {
      assert.match(record.signals ?? "", /SIGTERM/);
      assert.throws(() => process.kill(record.pid, 0));
    }
  } finally {
    for (const record of (await records()).filter((value) => value.scenario === "batch-cancel")) {
      try { process.kill(record.pid, "SIGKILL"); } catch {}
    }
    await pending?.catch(() => {});
    if (previousMarker === undefined) delete process.env.PI_SUBAGENT_BATCH_MARKER;
    else process.env.PI_SUBAGENT_BATCH_MARKER = previousMarker;
    await rm(directory, { recursive: true, force: true });
  }
});

test("batch live updates stay input-ordered and forward child monitor ids", async () => {
  const sessionRoot = await mkdtemp(path.join(os.tmpdir(), "pi-subagent-batch-live-"));
  const updates: any[] = [];
  const monitorEvents: any[] = [];
  try {
    const result = await withScenario("stream", () => executeSubagentBatch(
      "batch-live",
      {
        tasks: [
          { agent: "scout", title: "first", task: "stream first" },
          { agent: "scout", title: "second", task: "stream second" },
        ],
      },
      bundledAgents,
      makeContext(),
      sessionRoot,
      undefined,
      {
        onToolUpdate: (update) => updates.push(update),
        onMonitorEvent: (event) => monitorEvents.push(event),
      },
    ));

    assert.deepEqual(result.details.outcomes.map((outcome: any) => outcome.index), [0, 1]);
    assert.ok(updates.length > 0);
    for (const update of updates) {
      assert.deepEqual(update.details.outcomes.map((outcome: any) => outcome.index), [0, 1]);
    }
    assert.deepEqual(
      [...new Set(monitorEvents.map((event) => event.run.runId))].sort(),
      ["batch-live:0", "batch-live:1"],
    );
    const first = updates[0].details;
    (first.outcomes as any[]).push({ index: 99, status: "malformed", reason: "changed" });
    assert.deepEqual(updates.at(-1).details.outcomes.map((outcome: any) => outcome.index), [0, 1]);
  } finally {
    await rm(sessionRoot, { recursive: true, force: true });
  }
});

test("batch output limit applies one UTF-8 limit while retaining complete child details", async () => {
  const sessionRoot = await mkdtemp(path.join(os.tmpdir(), "pi-subagent-batch-output-"));
  try {
    const result = await withScenario("oversized", () => executeSubagentBatch(
      "batch-output",
      {
        tasks: [
          { agent: "scout", title: "large first", task: "return first" },
          { agent: "scout", title: "large second", task: "return second" },
        ],
      },
      bundledAgents,
      makeContext(),
      sessionRoot,
      undefined,
      { onMonitorEvent: () => {} },
    ));

    assert.ok(Buffer.byteLength(outputText(result), "utf8") <= MAX_RESULT_BYTES);
    assert.match(outputText(result), /truncated/i);
    for (const outcome of result.details.outcomes as any[]) {
      assert.equal(outcome.run.attempts[0].messages[0].content[0].text, "🙂".repeat(30_000));
    }
  } finally {
    await rm(sessionRoot, { recursive: true, force: true });
  }
});

test("batch failure output retains attempt diagnostics", async () => {
  const sessionRoot = await mkdtemp(path.join(os.tmpdir(), "pi-subagent-batch-failure-output-"));
  try {
    const result = await withScenario("batch-fail-twice", () => executeSubagentBatch(
      "batch-failure-output",
      { tasks: [{ agent: "reviewer", title: "failure", task: "fail twice" }] },
      bundledAgents,
      makeContext(),
      sessionRoot,
      undefined,
      { onMonitorEvent: () => {} },
    ));
    assert.match(outputText(result), /Attempt 1/);
    assert.match(outputText(result), /Attempt 2/);
    assert.match(outputText(result), /failure attempt 1/);
    assert.match(outputText(result), /failure attempt 2/);
  } finally {
    await rm(sessionRoot, { recursive: true, force: true });
  }
});

test("publishes lifecycle snapshots with cumulative telemetry and immutable state", async () => {
  const sessionRoot = await mkdtemp(path.join(os.tmpdir(), "pi-subagent-sessions-"));
  const events: any[] = [];
  const updates: any[] = [];
  try {
    const result = await withScenario("telemetry", () =>
      executeRuntime(
        "run-telemetry",
        { agent: "scout", title: "  telemetry\nrun  ", task: "collect telemetry" },
        bundledAgents,
        makeContext(),
        sessionRoot,
        undefined,
        {
          onToolUpdate: (update) => updates.push(update),
          onMonitorEvent: (event) => events.push(event),
        },
      ),
    );

    assert.equal(events[0].type, "started");
    assert.equal(events.at(-1).type, "finished");
    assert.ok(events.some((event) => event.type === "updated"));
    assert.equal(result.details.title, "telemetry run");
    assert.ok(result.details.endedAt !== undefined);
    assert.ok(result.details.startedAt <= result.details.endedAt!);
    assert.deepEqual(result.details.attempts[0].usage, {
      inputTokens: 12,
      outputTokens: 7,
      contextTokens: 40,
    });
    assert.equal(updates.length, events.length);

    const started = events[0].run;
    (started.run.attempts as any[]).push({ number: 2 });
    (started.sessions as any[]).push({ attempt: 2 });
    assert.equal(events.at(-1).run.run.attempts[0].usage.inputTokens, 12);
    assert.equal(events.at(-1).run.sessions.length, 1);
  } finally {
    await rm(sessionRoot, { recursive: true, force: true });
  }
});

test("keeps context stable across zero streaming usage and uses total tokens", async () => {
  const sessionRoot = await mkdtemp(path.join(os.tmpdir(), "pi-subagent-context-stability-"));
  const contexts: number[] = [];
  try {
    const result = await withScenario("context-stability", () =>
      executeRuntime(
        "run-context-stability",
        { agent: "scout", title: "context stability", task: "use a tool" },
        bundledAgents,
        makeContext(),
        sessionRoot,
        undefined,
        {
          onMonitorEvent: (event) => {
            const usage = event.run.run.attempts[0]?.usage;
            if (usage?.inputTokens) contexts.push(usage.contextTokens);
          },
        },
      ),
    );

    assert.deepEqual(contexts, contexts.map(() => 110));
    assert.equal(result.details.attempts[0].usage.contextTokens, 110);
  } finally {
    await rm(sessionRoot, { recursive: true, force: true });
  }
});

test("totals input and output tokens across retry attempts", async () => {
  const sessionRoot = await mkdtemp(path.join(os.tmpdir(), "pi-subagent-telemetry-retry-"));
  try {
    const result = await withScenario("telemetry-retry", () =>
      executeRuntime(
        "run-telemetry-retry",
        { agent: "scout", title: "retry telemetry", task: "collect retry usage" },
        bundledAgents,
        makeContext(),
        sessionRoot,
        undefined,
        { onMonitorEvent: () => {} },
      ),
    );
    assert.deepEqual(result.details.attempts.map((attempt) => attempt.usage), [
      { inputTokens: 11, outputTokens: 3, contextTokens: 31 },
      { inputTokens: 22, outputTokens: 5, contextTokens: 62 },
    ]);
  } finally {
    await rm(sessionRoot, { recursive: true, force: true });
  }
});

test("carries the latest context usage into a retry before its first usage event", async () => {
  const sessionRoot = await mkdtemp(path.join(os.tmpdir(), "pi-subagent-telemetry-retry-context-"));
  try {
    const result = await withScenario("telemetry-retry-no-usage", () =>
      executeRuntime(
        "run-telemetry-retry-no-usage",
        { agent: "scout", title: "retry context", task: "preserve retry context" },
        bundledAgents,
        makeContext(),
        sessionRoot,
        undefined,
        { onMonitorEvent: () => {} },
      ),
    );
    assert.deepEqual(result.details.attempts.map((attempt) => attempt.usage), [
      { inputTokens: 17, outputTokens: 4, contextTokens: 47 },
      { inputTokens: 0, outputTokens: 0, contextTokens: 47 },
    ]);
  } finally {
    await rm(sessionRoot, { recursive: true, force: true });
  }
});

test("publishes a session path when the child creates its file after startup", async () => {
  const sessionRoot = await mkdtemp(path.join(os.tmpdir(), "pi-subagent-late-session-"));
  const events: any[] = [];
  try {
    await withScenario("late-session", () =>
      executeRuntime(
        "run-late-session",
        { agent: "scout", title: "late session", task: "inspect a late session" },
        bundledAgents,
        makeContext(),
        sessionRoot,
        undefined,
        { onMonitorEvent: (event) => events.push(event) },
      ),
    );
    assert.ok(events.some((event) => event.type === "updated" && event.run.sessions[0]?.file?.endsWith(".jsonl")));
  } finally {
    await rm(sessionRoot, { recursive: true, force: true });
  }
});

test("passes normalized names and publishes one session per attempt", async () => {
  const sessionRoot = await mkdtemp(path.join(os.tmpdir(), "pi-subagent-session-test-"));
  const events: any[] = [];
  try {
    const result = await withScenario("retry-provider-sessions", () =>
      executeRuntime(
        "run-sessions",
        { agent: "scout", title: "  session\nname ", task: "inspect sessions" },
        bundledAgents,
        makeContext(),
        sessionRoot,
        undefined,
        { onMonitorEvent: (event) => events.push(event) },
      ),
    );

    const attemptRecords = (await records()).filter((record) => record.scenario === "retry-provider-sessions");
    assert.equal(result.details.attempts.length, 2);
    assert.equal(attemptRecords.length, 2);
    assert.equal(attemptRecords[0].argv[attemptRecords[0].argv.indexOf("--name") + 1], "session name");
    assert.equal(attemptRecords[0].argv.includes("--no-session"), false);
    assert.notEqual(
      attemptRecords[0].argv[attemptRecords[0].argv.indexOf("--session-dir") + 1],
      attemptRecords[1].argv[attemptRecords[1].argv.indexOf("--session-dir") + 1],
    );
    assert.ok(events.at(-1).run.sessions.every((session: any) => session.file?.endsWith(".jsonl")));
  } finally {
    await rm(sessionRoot, { recursive: true, force: true });
  }
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
  const record = (await records()).at(-1)!;

  assert.equal(result.details.state, "succeeded");
  assert.equal(record.cwd, cwd);
  assert.equal(record.argv.at(-1), task);
  assert.deepEqual(record.argv.slice(0, 8), [
    "--mode",
    "json",
    "-p",
    "--no-skills",
    "--model",
    "openai-codex/gpt-5.6-luna",
    "--thinking",
    "max",
  ]);
  assert.equal(record.argv[8], "--tools");
  assert.equal(record.argv[9], "read,bash,edit,write,grep,find,ls,mcp,mcpScript,web_search,web_fetch");
  assert.equal(record.argv[10], "--append-system-prompt");
  assert.match(promptPath(record), /pi-subagent-/);
  assert.equal(record.argv[12], "--session-dir");
  assert.equal(record.argv[14], "--name");
  assert.equal(record.argv[15], "worker test");
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
  assert.equal(record.argv[5], "openai-codex/parent-model");
  assert.equal(record.argv[7], "high");
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
  const monitorEvents: any[] = [];
  const result = await withScenario("stream", () =>
    executeSubagent("scout", "stream details", bundledAgents, makeContext(), undefined, (update) => {
      updates.push(update);
    }, (event) => monitorEvents.push(event)),
  );

  assert.equal(result.details.state, "succeeded");
  assert.equal(result.content[0].text, "authoritative final output");
  assert.ok(monitorEvents.some((event) => event.run.sessions.some((session: any) => session.partialText.includes("partial text"))));
  assert.ok(updates.some((update) => update.details.attempts.some((attempt: any) => attempt.activity.some((item: string) => item.includes("read")))));
  assert.deepEqual(
    result.details.attempts[0].messages.map((message: any) => message.content?.[0]?.text),
    ["intermediate message", "authoritative final output"],
  );
});

test("coalesces streaming deltas and still publishes the last streamed state", async () => {
  const events: any[] = [];
  const result = await withScenario("burst", () => executeRuntime(
    "run-burst",
    { agent: "scout", title: "burst", task: "stream a burst" },
    bundledAgents,
    makeContext(),
    testSessionRoot,
    undefined,
    { onMonitorEvent: (event) => events.push(event) },
  ));

  assert.equal(result.details.state, "succeeded");
  assert.ok(events.length < 20, `expected coalesced snapshots, published ${events.length}`);
  assert.ok(events.some((event) =>
    event.run.sessions.some((session: any) => session.partialText.includes("chunk 199"))
  ));
});

test("reuses completed messages across snapshots and sends one run to both callbacks", async () => {
  const events: any[] = [];
  const updates: any[] = [];
  await withScenario("stream", () => executeRuntime(
    "run-snapshot-sharing",
    { agent: "scout", title: "snapshot sharing", task: "stream snapshots" },
    bundledAgents,
    makeContext(),
    testSessionRoot,
    undefined,
    {
      onToolUpdate: (update) => updates.push(update),
      onMonitorEvent: (event) => events.push(event),
    },
  ));

  assert.equal(updates.length, events.length);
  for (const [index, event] of events.entries()) {
    assert.equal(updates[index].details, event.run.run);
  }
  const messageArrays = events
    .map((event) => event.run.run.attempts[0]?.messages)
    .filter((messages): messages is any[] => messages?.length > 0);
  assert.ok(messageArrays.length >= 2);
  assert.equal(messageArrays[0].length, 1);
  assert.equal(messageArrays.at(-1)!.length, 2);
  assert.equal(messageArrays[0][0], messageArrays.at(-1)![0]);
  assert.equal(messageArrays[0].length, 1);
});

test("protects completed messages from callback mutation", async () => {
  let sawMessages = false;
  let textMutationBlocked = false;
  let arrayMutationBlocked = false;
  const result = await withScenario("stream", () => executeRuntime(
    "run-message-immutability",
    { agent: "scout", title: "message immutability", task: "protect messages" },
    bundledAgents,
    makeContext(),
    testSessionRoot,
    undefined,
    {
      onMonitorEvent: (event) => {
        const messages = event.run.run.attempts[0]?.messages;
        if (sawMessages || !messages || messages.length !== 1) return;
        sawMessages = true;
        try {
          ((messages[0] as any).content[0] as any).text = "corrupted";
        } catch {
          textMutationBlocked = true;
        }
        try {
          (messages as any[]).push(messages[0]);
        } catch {
          arrayMutationBlocked = true;
        }
      },
    },
  ));

  assert.equal(sawMessages, true);
  assert.equal(textMutationBlocked, true);
  assert.equal(arrayMutationBlocked, true);
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
  assert.match(outputText(result), /provider diagnostics/);
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

test("keeps a run that recovered from a transient provider error", async () => {
  const result = await withScenario("recovered-provider-error", () =>
    executeSubagent("scout", "recover from a dropped stream", bundledAgents, makeContext(), undefined),
  );

  assert.equal(result.details.attempts.length, 1);
  assert.equal(result.details.state, "succeeded");
  assert.equal(result.details.attempts[0].state, "succeeded");
  assert.equal(result.details.attempts[0].exitCode, 0);
  assert.equal(result.details.attempts[0].error, undefined);
  assert.match(outputText(result), /recovered final output/);
});

test("fails a run whose last provider state is an error even after an earlier recovery", async () => {
  const result = await withScenario("recovered-then-failed", () =>
    executeSubagent("scout", "recover then fail", bundledAgents, makeContext(), undefined),
  );

  assert.equal(result.details.attempts.length, 2);
  assert.match(result.details.attempts[0].error, /second drop/);
  assert.doesNotMatch(result.details.attempts[0].error, /first drop/);
  assert.equal(result.details.attempts[1].state, "succeeded");
});

test("records a recovered provider error as attempt activity", async () => {
  const result = await withScenario("recovered-provider-error", () =>
    executeSubagent("scout", "recover from a dropped stream", bundledAgents, makeContext(), undefined),
  );

  assert.equal(result.details.state, "succeeded");
  assert.ok(
    result.details.attempts[0].activity.some((item: string) => /WebSocket closed 1006/.test(item)),
    `expected a provider-error breadcrumb, got ${JSON.stringify(result.details.attempts[0].activity)}`,
  );
});

test("keeps a run that recovered from a streaming provider error", async () => {
  const result = await withScenario("stream-error-recovered", () =>
    executeSubagent("scout", "recover from a stream error", bundledAgents, makeContext(), undefined),
  );

  assert.equal(result.details.attempts.length, 1);
  assert.equal(result.details.state, "succeeded");
  assert.equal(result.details.attempts[0].error, undefined);
  assert.match(outputText(result), /recovered after stream error/);
});

test("fails a run whose streaming error is never followed by a completed message", async () => {
  const result = await withScenario("stream-error-terminal", () =>
    executeSubagent("scout", "terminal stream error", bundledAgents, makeContext(), undefined),
  );

  assert.equal(result.details.attempts.length, 2);
  assert.equal(result.details.attempts[0].state, "failed");
  assert.equal(result.details.attempts[0].exitCode, 0);
  assert.match(result.details.attempts[0].error, /stream died for good/);
  assert.equal(result.details.attempts[1].state, "succeeded");
});

test("does not retry a mutating agent that already started work", async () => {
  const result = await withScenario("retry-provider-worker", () =>
    executeSubagent("worker", "edit files then fail", bundledAgents, makeContext(), undefined),
  );

  assert.equal(result.details.attempts.length, 1);
  assert.equal(result.details.state, "failed");
  assert.match(result.details.attempts[0].error, /provider unavailable/);
  assert.ok(
    result.details.attempts[0].activity.some((item: string) => /not retried/i.test(item)),
    `expected a suppressed-retry note, got ${JSON.stringify(result.details.attempts[0].activity)}`,
  );
});

test("still retries a mutating agent that failed before producing any message", async () => {
  const result = await withScenario("retry-startup-worker", () =>
    executeSubagent("worker", "fail at startup", bundledAgents, makeContext(), undefined),
  );

  assert.equal(result.details.attempts.length, 2);
  assert.equal(result.details.attempts[1].state, "succeeded");
  assert.equal(result.details.state, "succeeded");
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
  assert.match(outputText(result), /Attempt 1/);
  assert.match(outputText(result), /Attempt 2/);
  assert.match(outputText(result), /failure attempt 1/);
  assert.match(outputText(result), /failure attempt 2/);
  assert.ok(Buffer.byteLength(result.content[0].text, "utf8") <= 50 * 1024);
});

test("removes the temporary prompt after success and failure", async () => {
  const before = (await records()).length;
  await withScenario("cleanup-success", () =>
    executeSubagent("scout", "cleanup success", bundledAgents, makeContext(), undefined),
  );
  const successRecord = (await records()).slice(before, before + 1)[0];
  assert.equal(await pathExists(promptPath(successRecord)), false);
  assert.equal(await pathExists(path.dirname(promptPath(successRecord))), false);

  const failureBefore = (await records()).length;
  await withScenario("fail-twice", () =>
    executeSubagent("scout", "cleanup failure path", bundledAgents, makeContext(), undefined),
  );
  const failureRecords = (await records()).slice(failureBefore);
  assert.equal(failureRecords.length, 2);
  for (const record of failureRecords) assert.equal(await pathExists(promptPath(record)), false);
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
  assert.equal(await pathExists(promptPath(record)), false);
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
  assert.equal(await pathExists(promptPath(record)), false);
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
    assert.match(outputText(result), /cleanup unavailable/i);
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
    const prefix = `${path.basename(recordPath)}.`;
    const files = (await readdir(path.dirname(recordPath)))
      .filter((file) => file.startsWith(prefix));
    const values = await Promise.all(files.map(async (file) => JSON.parse(
      await readFile(path.join(path.dirname(recordPath), file), "utf8"),
    )));
    return values.sort((a, b) => (a.createdAt - b.createdAt) || (a.pid - b.pid));
  } catch {
    return [];
  }
}

function promptPath(record: any): string {
  const index = record.argv.indexOf("--append-system-prompt");
  return record.argv[index + 1];
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
  testSessionRoot = await mkdtemp(path.join(os.tmpdir(), "pi-subagent-sessions-"));
  recordPath = path.join(fakePiDirectory, "records.json");
  await writeFile(recordPath, "[]");
  const executable = path.join(fakePiDirectory, "pi");
  await writeFile(
    executable,
    `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const recordPath = process.env.PI_SUBAGENT_RECORD;
const recordDirectory = path.dirname(recordPath);
const recordPrefix = path.basename(recordPath) + ".";
function readRecords() {
  return fs.readdirSync(recordDirectory)
    .filter((file) => file.startsWith(recordPrefix))
    .map((file) => JSON.parse(fs.readFileSync(path.join(recordDirectory, file), "utf8")));
}
const argv = process.argv.slice(2);
const scenario = process.env.PI_SUBAGENT_SCENARIO;
const records = readRecords();
const attemptNumber = records.filter((record) => record.scenario === scenario).length + 1;
const promptIndex = argv.indexOf("--append-system-prompt");
const sessionDirectory = argv[argv.indexOf("--session-dir") + 1];
const sessionId = "session-" + process.pid + "-" + attemptNumber;
const sessionFile = path.join(sessionDirectory, "2026_" + sessionId + ".jsonl");
fs.mkdirSync(sessionDirectory, { recursive: true });
fs.writeFileSync(sessionFile, JSON.stringify({ type: "session", version: 3, id: sessionId, timestamp: new Date().toISOString(), cwd: process.cwd() }) + "\\n");
const recordFile = path.join(recordDirectory, path.basename(recordPath) + "." + process.pid);
const record = { scenario, argv, cwd: process.cwd(), pid: process.pid, attemptNumber, createdAt: Date.now(), sessionFile, prompt: fs.readFileSync(argv[promptIndex + 1], "utf8") };
fs.writeFileSync(recordFile, JSON.stringify(record));
const usage = scenario === "telemetry"
  ? { input: 12, output: 7, cacheRead: 3, cacheWrite: 1, contextTokens: 40, totalTokens: 23, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }
  : scenario === "context-stability"
    ? { input: 100, output: 10, cacheRead: 0, cacheWrite: 0, totalTokens: 110, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }
  : scenario === "telemetry-retry"
    ? { input: attemptNumber === 1 ? 11 : 22, output: attemptNumber === 1 ? 3 : 5, cacheRead: 0, cacheWrite: 0, contextTokens: attemptNumber === 1 ? 31 : 62, totalTokens: attemptNumber === 1 ? 14 : 27, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }
    : scenario === "telemetry-retry-no-usage"
      ? { input: attemptNumber === 1 ? 17 : 0, output: attemptNumber === 1 ? 4 : 0, cacheRead: 0, cacheWrite: 0, contextTokens: 47, totalTokens: attemptNumber === 1 ? 21 : 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }
      : { input: 0, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 1, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
let entryNumber = 0;
let parentId = null;
function persistMessage(message) {
  const id = "entry-" + (++entryNumber);
  fs.appendFileSync(sessionFile, JSON.stringify({ type: "message", id, parentId, timestamp: new Date().toISOString(), message }) + "\\n");
  parentId = id;
}
function assistant(text, stopReason = "stop", errorMessage) {
  const message = { role: "assistant", content: [{ type: "text", text }], api: "openai-responses", provider: "fake", model: "fake", usage, stopReason, ...(errorMessage ? { errorMessage } : {}), timestamp: Date.now() };
  persistMessage(message);
  return message;
}
function emit(value, newline = true) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  const data = Buffer.from(text, "utf8");
  for (let index = 0; index < data.length; index += 7) process.stdout.write(data.subarray(index, index + 7));
  if (newline) process.stdout.write("\\n");
}
function recordSignal(signal) {
  const record = JSON.parse(fs.readFileSync(recordFile, "utf8"));
  record.signals = (record.signals || "") + signal;
  fs.writeFileSync(recordFile, JSON.stringify(record));
}
const sessionHeader = { type: "session", version: 3, id: sessionId, timestamp: new Date().toISOString(), cwd: process.cwd() };
if (scenario === "late-session") fs.rmSync(sessionFile);
emit(sessionHeader);
if (scenario === "late-session") {
  setTimeout(() => {
    fs.writeFileSync(sessionFile, JSON.stringify(sessionHeader) + "\\n");
    emit({ type: "message_update", usage, assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: "late live text" } });
    setTimeout(() => emit({ type: "message_end", message: assistant("late output") }), 20);
  }, 20);
} else if (scenario === "cancel") {
  process.on("SIGTERM", () => { recordSignal("SIGTERM"); process.exit(143); });
  setInterval(() => {}, 1000);
} else if (scenario === "batch-concurrency") {
  const marker = process.env.PI_SUBAGENT_BATCH_MARKER;
  const release = process.env.PI_SUBAGENT_BATCH_RELEASE;
  fs.appendFileSync(marker, process.pid + "\\n");
  const timer = setInterval(() => {
    if (!fs.existsSync(release)) return;
    clearInterval(timer);
    emit({ type: "message_end", message: assistant("batch output") });
    process.exit(0);
  }, 10);
} else if (scenario === "batch-cancel") {
  const marker = process.env.PI_SUBAGENT_BATCH_MARKER;
  fs.appendFileSync(marker, process.pid + "\\n");
  process.on("SIGTERM", () => {
    recordSignal("SIGTERM");
    if (attemptNumber === 1) process.exit(143);
    setTimeout(() => process.exit(143), 200);
  });
  setInterval(() => {}, 1000);
} else if (scenario === "hang") {
  process.on("SIGTERM", () => { recordSignal("SIGTERM"); });
  setInterval(() => {}, 1000);
} else if (((scenario === "retry-startup" || scenario === "retry-startup-worker") && attemptNumber === 1) || scenario === "fail-twice" || scenario === "batch-fail-twice") {
  process.stderr.write("failure attempt " + attemptNumber + "\\n");
  process.exitCode = 1;
} else if (scenario === "telemetry-retry-no-usage" && attemptNumber === 1) {
  emit({ type: "message_update", usage, assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: "latest context" } });
  process.exitCode = 1;
} else if (scenario === "telemetry-retry-no-usage") {
  process.stderr.write("retry attempt without usage\\n");
  process.exitCode = 1;
} else if (scenario === "recovered-provider-error") {
  emit({ type: "message_end", message: assistant("stream dropped", "error", "WebSocket closed 1006 Connection ended") });
  emit({ type: "message_end", message: assistant("recovered final output") });
} else if (scenario === "recovered-then-failed" && attemptNumber === 1) {
  emit({ type: "message_end", message: assistant("stream dropped", "error", "first drop") });
  emit({ type: "message_end", message: assistant("recovered for a while") });
  emit({ type: "message_end", message: assistant("stream dropped again", "error", "second drop") });
} else if (scenario === "stream-error-recovered") {
  emit({ type: "message_update", usage, assistantMessageEvent: { type: "error", reason: "error", error: { errorMessage: "stream dropped mid-flight" } } });
  emit({ type: "message_end", message: assistant("recovered after stream error") });
} else if (scenario === "stream-error-terminal" && attemptNumber === 1) {
  emit({ type: "message_update", usage, assistantMessageEvent: { type: "error", reason: "error", error: { errorMessage: "stream died for good" } } });
} else if ((scenario === "telemetry-retry" || (typeof scenario === "string" && scenario.startsWith("retry-provider"))) && attemptNumber === 1) {
  emit({ type: "message_end", message: assistant("provider failed", "error", "provider unavailable") });
} else if (scenario === "retry-malformed" && attemptNumber === 1) {
  emit("{not valid json");
} else if (scenario === "retry-abnormal" && attemptNumber === 1) {
  process.kill(process.pid, "SIGTERM");
} else if (scenario === "context-stability") {
  emit({ type: "message_end", message: assistant("tool call", "toolUse") });
  emit({ type: "message_update", usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0 }, assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: "final" } });
  emit({ type: "message_end", message: assistant("final output") });
} else if (scenario === "telemetry") {
  emit({ type: "message_update", usage: { ...usage, input: 4, output: 2, contextTokens: 18 }, assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: "first delta" } });
  emit({ type: "message_update", usage, assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: "second delta" } });
  emit({ type: "message_end", message: assistant("child output") });
} else if (scenario === "stream") {
  emit({ type: "message_update", usage, assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: "partial text" } });
  emit({ type: "tool_execution_start", toolCallId: "tool-1", toolName: "read", args: { path: "src/index.ts" } });
  emit({ type: "tool_execution_end", toolCallId: "tool-1", toolName: "read", result: { content: [] }, isError: false });
  emit({ type: "message_end", message: assistant("intermediate message") });
  emit({ type: "message_end", message: assistant("authoritative final output") }, false);
} else if (scenario === "burst") {
  for (let index = 0; index < 200; index++) {
    emit({ type: "message_update", usage, assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: "chunk " + index + " " } });
  }
  emit({ type: "message_end", message: assistant("burst output") }, false);
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
