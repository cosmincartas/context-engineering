import assert from "node:assert/strict";
import { access, chmod, cp, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { mock } from "node:test";

import fsPromises from "node:fs/promises";

import { validateToolArguments } from "@earendil-works/pi-ai";
import { initTheme } from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";

initTheme("dark", false);

async function loadModule(url = new URL("./index.ts", import.meta.url)): Promise<any> {
  try {
    return await import(url.href);
  } catch (error) {
    assert.fail(`Unable to load the subagent extension: ${String(error)}`);
  }
}

async function loadExtension(url = new URL("./index.ts", import.meta.url)): Promise<(pi: any) => void> {
  return (await loadModule(url)).default;
}

function harness() {
  let sessionStart: ((event: unknown, ctx: any) => Promise<void>) | undefined;
  let sessionShutdown: ((event: unknown, ctx: any) => Promise<void>) | undefined;
  const tools: any[] = [];
  const notifications: Array<{ message: string; level: string }> = [];
  const uiState: any = { footerFactory: undefined, editorFactory: undefined, custom: undefined };
  const theme: any = {
    fg: (_color: string, text: string) => text,
    bg: (_color: string, text: string) => text,
    bold: (text: string) => text,
    italic: (text: string) => text,
    strikethrough: (text: string) => text,
  };
  const tui: any = {
    requestRender() {},
    setFocus(value: any) { uiState.focused = value; },
    terminal: { rows: 24, columns: 80 },
  };
  const footerData = {
    getGitBranch: () => null,
    getExtensionStatuses: () => new Map(),
    getAvailableProviderCount: () => 1,
    onBranchChange: () => () => {},
  };
  const ui = {
    notify(message: string, level: string) {
      notifications.push({ message, level });
    },
    getEditorComponent: () => uiState.editorFactory,
    setEditorComponent(factory: any) {
      uiState.editorFactory = factory;
      if (factory) uiState.editor = factory(tui, theme, {});
    },
    setFooter(factory: any) {
      uiState.footerFactory = factory;
      uiState.footer = factory ? factory(tui, theme, footerData) : undefined;
    },
    custom(factory: any) {
      uiState.custom = factory;
      return new Promise(() => {});
    },
  };
  const pi = {
    on(event: string, handler: any) {
      if (event === "session_start") sessionStart = handler;
      else if (event === "session_shutdown") sessionShutdown = handler;
      else assert.fail(`unexpected event ${event}`);
    },
    registerTool(tool: any) {
      tools.push(tool);
    },
  };
  const context = (mode: "tui" | "rpc" | "json" | "print") => ({
    mode,
    hasUI: mode === "tui",
    cwd: process.cwd(),
    model: { provider: "openai-codex", id: "parent" },
    thinkingLevel: "medium",
    modelRegistry: { getAvailable: () => [] },
    sessionManager: { getEntries: () => [], getCwd: () => process.cwd(), getSessionName: () => undefined },
    getContextUsage: () => undefined,
    ui,
  });
  return {
    pi,
    tools,
    notifications,
    uiState,
    context,
    async start(mode: "tui" | "rpc" | "json" | "print") {
      assert.ok(sessionStart, "session_start handler was not registered");
      await sessionStart({}, context(mode));
    },
    async shutdown() {
      assert.ok(sessionShutdown, "session_shutdown handler was not registered");
      await sessionShutdown({}, context("tui"));
    },
  };
}

test("registers the tool only after a TUI session starts", async () => {
  const subagentExtension = await loadExtension();

  for (const mode of ["rpc", "json", "print"] as const) {
    const testHarness = harness();
    subagentExtension(testHarness.pi);
    await testHarness.start(mode);
    assert.equal(testHarness.tools.length, 0, `${mode} registered the subagent tool`);
  }

  const tuiHarness = harness();
  subagentExtension(tuiHarness.pi);
  assert.equal(tuiHarness.tools.length, 0);
  try {
    await tuiHarness.start("tui");
    assert.equal(tuiHarness.tools.length, 1);
  } finally {
    await tuiHarness.shutdown();
  }
});

test("requires a non-empty tasks array", async () => {
  const subagentExtension = await loadExtension();
  const testHarness = harness();
  subagentExtension(testHarness.pi);
  try {
    await testHarness.start("tui");
    const [tool] = testHarness.tools;

    assert.deepEqual(tool.parameters.required, ["tasks"]);
    assert.equal(tool.parameters.properties.tasks.minItems, 1);
    assert.equal(tool.parameters.additionalProperties, false);
    assert.throws(
      () => validateToolArguments(tool, {
        type: "toolCall", id: "empty", name: "subagent", arguments: { tasks: [] },
      }),
      /tasks/i,
    );
  } finally {
    await testHarness.shutdown();
  }
});

test("accepts malformed task items for runtime classification", async () => {
  const subagentExtension = await loadExtension();
  const testHarness = harness();
  subagentExtension(testHarness.pi);
  try {
    await testHarness.start("tui");
    const [tool] = testHarness.tools;
    assert.doesNotThrow(() => validateToolArguments(tool, {
      type: "toolCall", id: "malformed", name: "subagent", arguments: { tasks: [null] },
    }));
  } finally {
    await testHarness.shutdown();
  }
});

test("registers the parallel batch contract", async () => {
  const subagentExtension = await loadExtension();
  const testHarness = harness();
  subagentExtension(testHarness.pi);
  try {
    await testHarness.start("tui");
    const [tool] = testHarness.tools;

    assert.equal(tool.name, "subagent");
    assert.equal(tool.label, "Subagent");
    assert.match(tool.description, /tasks|parallel/i);
    assert.equal(tool.executionMode, "parallel");
    assert.equal(tool.parameters.additionalProperties, false);
    assert.deepEqual(tool.parameters.required, ["tasks"]);
    assert.equal(tool.parameters.properties.tasks.type, "array");
    assert.equal(tool.parameters.properties.tasks.minItems, 1);
    assert.deepEqual(Object.keys(tool.parameters.properties), ["tasks"]);
    for (const text of [
      "scout", "Read-only codebase reconnaissance.",
      "worker", "Implement and verify requested coding tasks.",
      "oracle", "Read-only technical analysis and decision support.",
      "reviewer", "Read-only review of code changes.",
    ]) {
      assert.match(tool.description, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    }

    assert.throws(
      () => validateToolArguments(tool, {
        type: "toolCall", id: "empty", name: "subagent", arguments: { tasks: [] },
      }),
      /tasks/i,
    );
    assert.throws(
      () => validateToolArguments(tool, {
        type: "toolCall", id: "old", name: "subagent", arguments: { agent: "scout", title: "inspect", task: "inspect" },
      }),
      /tasks/i,
    );
    assert.doesNotThrow(() => validateToolArguments(tool, {
      type: "toolCall", id: "malformed", name: "subagent", arguments: { tasks: [null] },
    }));

    const result = await tool.execute(
      "call",
      { tasks: [{ agent: "missing", title: "inspect", task: "inspect" }] },
      undefined,
      undefined,
      testHarness.context("tui"),
    );
    assert.equal(result.details.outcomes[0].status, "failed");
    assert.match(result.content[0].text, /Unknown agent: missing/);
  } finally {
    await testHarness.shutdown();
  }
});

test("runs four children concurrently and cleans their session root at shutdown", { timeout: 10_000 }, async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pi-subagent-lifecycle-"));
  const executable = path.join(directory, "pi");
  const marker = path.join(directory, "started");
  const sessionMarker = path.join(directory, "sessions");
  const release = path.join(directory, "release");
  const previousPath = process.env.PATH;
  const previousMarker = process.env.PI_SUBAGENT_LIFECYCLE_MARKER;
  const previousSessionMarker = process.env.PI_SUBAGENT_LIFECYCLE_SESSIONS;
  const previousRelease = process.env.PI_SUBAGENT_LIFECYCLE_RELEASE;
  await writeFile(
    executable,
    `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const marker = process.env.PI_SUBAGENT_LIFECYCLE_MARKER;
const sessionMarker = process.env.PI_SUBAGENT_LIFECYCLE_SESSIONS;
const release = process.env.PI_SUBAGENT_LIFECYCLE_RELEASE;
const argv = process.argv.slice(2);
const sessionDirectory = argv[argv.indexOf("--session-dir") + 1];
const sessionId = "lifecycle-" + process.pid;
fs.mkdirSync(sessionDirectory, { recursive: true });
const sessionFile = path.join(sessionDirectory, "2026_" + sessionId + ".jsonl");
fs.writeFileSync(sessionFile, JSON.stringify({ type: "session", version: 3, id: sessionId, timestamp: new Date().toISOString(), cwd: process.cwd() }) + "\\n");
fs.appendFileSync(marker, process.pid + "\\n");
fs.appendFileSync(sessionMarker, sessionDirectory + "\\n");
function emit(value) { process.stdout.write(JSON.stringify(value) + "\\n"); }
const usage = { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
const message = { role: "assistant", content: [{ type: "text", text: "lifecycle child" }], api: "openai-responses", provider: "fake", model: "fake", usage, stopReason: "stop", timestamp: Date.now() };
const timer = setInterval(() => {
  if (fs.existsSync(release)) {
    clearInterval(timer);
    emit({ type: "message_end", message });
    process.exit(0);
  }
}, 10);
`,
  );
  await chmod(executable, 0o755);
  process.env.PATH = `${directory}${path.delimiter}${previousPath ?? ""}`;
  process.env.PI_SUBAGENT_LIFECYCLE_MARKER = marker;
  process.env.PI_SUBAGENT_LIFECYCLE_SESSIONS = sessionMarker;
  process.env.PI_SUBAGENT_LIFECYCLE_RELEASE = release;

  const subagentExtension = await loadExtension();
  const testHarness = harness();
  subagentExtension(testHarness.pi);

  let pending: Promise<any> | undefined;
  try {
    await testHarness.start("tui");
    const [tool] = testHarness.tools;
    assert.equal(tool.executionMode, "parallel");
    pending = tool.execute(
      "batch-call",
      {
        tasks: Array.from({ length: 4 }, (_, index) => ({
          agent: "scout", title: `Child ${index}`, task: "block until released",
        })),
      },
      undefined,
      undefined,
      testHarness.context("tui"),
    );
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        if ((await readFile(marker, "utf8")).trim().split("\n").filter(Boolean).length >= 4) break;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const activeText = testHarness.uiState.footer.render(120).join("\n");
    for (let index = 0; index < 4; index++) assert.match(activeText, new RegExp(`Child ${index}`));
    await writeFile(release, "release");
    await pending;
    const finishedText = testHarness.uiState.footer.render(120).join("\n");
    assert.match(finishedText, /orchestrator/);
    for (let index = 0; index < 4; index++) assert.doesNotMatch(finishedText, new RegExp(`Child ${index}`));
    const sessionDirectories = (await readFile(sessionMarker, "utf8")).trim().split("\n").filter(Boolean);
    assert.equal(sessionDirectories.length, 4);
    await testHarness.shutdown();
    for (const sessionDirectory of sessionDirectories) await assert.rejects(access(sessionDirectory));
  } finally {
    await writeFile(release, "release").catch(() => {});
    await pending?.catch(() => {});
    await testHarness.shutdown().catch(() => {});
    process.env.PATH = previousPath;
    if (previousMarker === undefined) delete process.env.PI_SUBAGENT_LIFECYCLE_MARKER;
    else process.env.PI_SUBAGENT_LIFECYCLE_MARKER = previousMarker;
    if (previousSessionMarker === undefined) delete process.env.PI_SUBAGENT_LIFECYCLE_SESSIONS;
    else process.env.PI_SUBAGENT_LIFECYCLE_SESSIONS = previousSessionMarker;
    if (previousRelease === undefined) delete process.env.PI_SUBAGENT_LIFECYCLE_RELEASE;
    else process.env.PI_SUBAGENT_LIFECYCLE_RELEASE = previousRelease;
    await rm(directory, { recursive: true, force: true });
  }
});

test("waits for an unresponsive active child before disposing and deleting its session root", { timeout: 10_000 }, async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pi-subagent-shutdown-"));
  const executable = path.join(directory, "pi");
  const marker = path.join(directory, "started");
  const sessionMarker = path.join(directory, "session");
  const promptMarker = path.join(directory, "prompt");
  const grandchildMarker = path.join(directory, "grandchild");
  const previousPath = process.env.PATH;
  const previousMarker = process.env.PI_SUBAGENT_SHUTDOWN_MARKER;
  const previousSessionMarker = process.env.PI_SUBAGENT_SHUTDOWN_SESSION;
  const previousPromptMarker = process.env.PI_SUBAGENT_SHUTDOWN_PROMPT;
  const previousGrandchildMarker = process.env.PI_SUBAGENT_SHUTDOWN_GRANDCHILD;
  await writeFile(
    executable,
    `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const marker = process.env.PI_SUBAGENT_SHUTDOWN_MARKER;
const sessionMarker = process.env.PI_SUBAGENT_SHUTDOWN_SESSION;
const promptMarker = process.env.PI_SUBAGENT_SHUTDOWN_PROMPT;
const argv = process.argv.slice(2);
const sessionDirectory = argv[argv.indexOf("--session-dir") + 1];
const promptPath = argv[argv.indexOf("--append-system-prompt") + 1];
const sessionId = "shutdown-" + process.pid;
fs.mkdirSync(sessionDirectory, { recursive: true });
fs.writeFileSync(path.join(sessionDirectory, "2026_" + sessionId + ".jsonl"), JSON.stringify({ type: "session", version: 3, id: sessionId, timestamp: new Date().toISOString(), cwd: process.cwd() }) + "\\n");
fs.writeFileSync(marker, String(process.pid));
fs.writeFileSync(sessionMarker, sessionDirectory);
fs.writeFileSync(promptMarker, promptPath);
const grandchild = require("node:child_process").spawn(
  process.execPath,
  ["-e", "require('node:fs').writeFileSync(process.env.PI_SUBAGENT_SHUTDOWN_GRANDCHILD, String(process.pid)); setInterval(() => {}, 1000)"],
  { detached: true, stdio: ["ignore", "inherit", "inherit"] },
);
grandchild.unref();
process.on("SIGTERM", () => {});
setInterval(() => {}, 1000);
`,
  );
  await chmod(executable, 0o755);
  process.env.PATH = `${directory}${path.delimiter}${previousPath ?? ""}`;
  process.env.PI_SUBAGENT_SHUTDOWN_MARKER = marker;
  process.env.PI_SUBAGENT_SHUTDOWN_SESSION = sessionMarker;
  process.env.PI_SUBAGENT_SHUTDOWN_PROMPT = promptMarker;
  process.env.PI_SUBAGENT_SHUTDOWN_GRANDCHILD = grandchildMarker;

  const controller = new AbortController();
  let pending: Promise<any> | undefined;
  let pid: number | undefined;
  let grandchildPid: number | undefined;
  let testHarness: ReturnType<typeof harness> | undefined;
  try {
    const subagentExtension = await loadExtension();
    testHarness = harness();
    subagentExtension(testHarness.pi);
    await testHarness.start("tui");
    const [tool] = testHarness.tools;
    pending = tool.execute(
      "shutdown-call",
      { tasks: [{ agent: "scout", title: "shutdown child", task: "remain active" }] },
      controller.signal,
      undefined,
      testHarness.context("tui"),
    );

    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        pid = Number(await readFile(marker, "utf8"));
        grandchildPid = Number(await readFile(grandchildMarker, "utf8"));
        if (pid && grandchildPid && (await readFile(sessionMarker, "utf8"))) break;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.ok(pid);
    assert.ok(grandchildPid);
    const sessionDirectory = await readFile(sessionMarker, "utf8");
    const promptPath = await readFile(promptMarker, "utf8");

    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        Promise.all([testHarness.shutdown(), pending!.catch(() => {})]),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error("shutdown cleanup did not settle")), 7_000);
        }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
    assert.throws(() => process.kill(pid!, 0));
    assert.doesNotThrow(() => process.kill(grandchildPid!, 0));
    assert.ok(pending);
    await assert.rejects(pending);
    await assert.rejects(access(sessionDirectory));
    await assert.rejects(access(promptPath));
    await testHarness.shutdown();
  } finally {
    controller.abort();
    if (pid) {
      try { process.kill(pid, "SIGKILL"); } catch {}
    }
    if (grandchildPid) {
      try { process.kill(grandchildPid, "SIGKILL"); } catch {}
    }
    await testHarness?.shutdown().catch(() => {});
    await pending?.catch(() => {});
    process.env.PATH = previousPath;
    if (previousMarker === undefined) delete process.env.PI_SUBAGENT_SHUTDOWN_MARKER;
    else process.env.PI_SUBAGENT_SHUTDOWN_MARKER = previousMarker;
    if (previousSessionMarker === undefined) delete process.env.PI_SUBAGENT_SHUTDOWN_SESSION;
    else process.env.PI_SUBAGENT_SHUTDOWN_SESSION = previousSessionMarker;
    if (previousPromptMarker === undefined) delete process.env.PI_SUBAGENT_SHUTDOWN_PROMPT;
    else process.env.PI_SUBAGENT_SHUTDOWN_PROMPT = previousPromptMarker;
    if (previousGrandchildMarker === undefined) delete process.env.PI_SUBAGENT_SHUTDOWN_GRANDCHILD;
    else process.env.PI_SUBAGENT_SHUTDOWN_GRANDCHILD = previousGrandchildMarker;
    await rm(directory, { recursive: true, force: true });
  }
});

test("notifies once when session root cleanup fails", async () => {
  const subagentExtension = await loadExtension();
  const testHarness = harness();
  subagentExtension(testHarness.pi);
  let cleanupRoot: string | undefined;
  let remove: any;
  try {
    await testHarness.start("tui");
    remove = mock.method(fsPromises as any, "rm", async (target: string) => {
      cleanupRoot = target;
      throw new Error("root cleanup unavailable");
    });
    await testHarness.shutdown();
    assert.equal(testHarness.notifications.length, 1);
    assert.equal(testHarness.notifications[0].level, "error");
    assert.match(testHarness.notifications[0].message, /root cleanup unavailable/i);
  } finally {
    remove?.mock.restore();
    await testHarness.shutdown().catch(() => {});
    if (cleanupRoot) await fsPromises.rm(cleanupRoot, { recursive: true, force: true });
  }
});

test("notifies once and registers nothing when session root setup fails", async () => {
  const remove = mock.method(fsPromises as any, "mkdtemp", async () => {
    throw new Error("session root unavailable");
  });
  let testHarness: ReturnType<typeof harness> | undefined;
  try {
    const subagentExtension = await loadExtension();
    testHarness = harness();
    subagentExtension(testHarness.pi);
    await testHarness.start("tui");
    assert.equal(testHarness.tools.length, 0);
    assert.equal(testHarness.notifications.length, 1);
    assert.match(testHarness.notifications[0].message, /session root unavailable/i);
  } finally {
    remove.mock.restore();
    await testHarness?.shutdown().catch(() => {});
  }
});

test("shutdown cleanup is idempotent", async () => {
  const subagentExtension = await loadExtension();
  const testHarness = harness();
  subagentExtension(testHarness.pi);
  await testHarness.start("tui");
  await testHarness.shutdown();
  await testHarness.shutdown();
  assert.equal(testHarness.notifications.length, 0);
});

test("notifies the TUI and registers nothing when the bundled catalog fails", async () => {
  await loadExtension();
  const directory = await mkdtemp(path.join(os.tmpdir(), "pi-subagent-extension-"));
  try {
    for (const file of ["index.ts", "agents.ts", "runtime.ts", "ui.ts", "package.json"]) {
      await cp(new URL(file, import.meta.url), path.join(directory, file));
    }
    await symlink(new URL("./node_modules/", import.meta.url), path.join(directory, "node_modules"));
    const agentsDirectory = path.join(directory, "agents");
    await cp(new URL("./agents/", import.meta.url), agentsDirectory, { recursive: true });
    await rm(path.join(agentsDirectory, "reviewer.md"));

    const subagentExtension = await loadExtension(new URL(`file://${path.join(directory, "index.ts")}`));
    const testHarness = harness();
    subagentExtension(testHarness.pi);
    try {
      await testHarness.start("tui");

      assert.equal(testHarness.tools.length, 0);
      assert.equal(testHarness.notifications.length, 1);
      assert.equal(testHarness.notifications[0].level, "error");
      assert.match(testHarness.notifications[0].message, /reviewer\.md/i);
    } finally {
      await testHarness.shutdown();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

const plainTheme = {
  fg: (_color: string, text: string) => text,
  bg: (_color: string, text: string) => text,
  bold: (text: string) => text,
  italic: (text: string) => text,
  strikethrough: (text: string) => text,
};

function assistantMessage(content: any[], stopReason = "stop"): any {
  return {
    role: "assistant",
    content,
    api: "openai-responses",
    provider: "fake",
    model: "fake",
    usage: {
      input: 0,
      output: 1,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 1,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason,
    timestamp: Date.now(),
  };
}

function renderFixture(state: string): any {
  return {
    content: [{ type: "text", text: "# Final heading\n\nFinal **answer**." }],
    details: {
      outcomes: [{
        index: 0,
        status: state,
        run: {
          agent: "scout",
          title: "Inspect API",
          task: "Inspect a deliberately long task description that must wrap on narrow terminals.",
          state,
          startedAt: 1,
          endedAt: state === "running" ? undefined : 2,
          model: "openai-codex/gpt-5.6-luna",
          thinkingLevel: "medium",
          attempts: [{
            number: 1,
            state: state === "retrying" ? "failed" : state,
            activity: ["Fallback: mapped model unavailable; using parent model."],
            messages: [],
            stderr: "provider diagnostic output",
            exitCode: 1,
            error: "provider failed",
          }],
        },
      }],
    },
  };
}

test("renders every state with text and no color dependency", async () => {
  const renderSubagentResult = (await loadModule()).renderSubagentResult;
  assert.equal(typeof renderSubagentResult, "function");

  for (const state of ["running", "retrying", "succeeded", "failed", "cancelled"]) {
    const text = renderSubagentResult(
      renderFixture(state),
      { expanded: false, isPartial: state === "running" },
      plainTheme,
    ).render(80).join("\n");
    assert.match(text, /Subagents/i);
    assert.match(text, new RegExp(state, "i"));
  }
});

test("collapsed batches show only their summary", async () => {
  const renderSubagentResult = (await loadModule()).renderSubagentResult;
  const fixture = renderFixture("running");
  fixture.details.outcomes[0].run.attempts[0].activity = ["partial text", "tool read started"];

  const text = renderSubagentResult(
    fixture,
    { expanded: false, isPartial: true },
    plainTheme,
  ).render(120).join("\n");

  assert.match(text, /Subagents/);
  assert.match(text, /running/);
  assert.doesNotMatch(text, /partial text|tool read started|deliberately long task|Inspect API/);
});

test("renderer keeps an unsafe batch title on one safe line", async () => {
  const renderSubagentResult = (await loadModule()).renderSubagentResult;
  const fixture = renderFixture("running");
  fixture.details.outcomes[0].run.title = "\u001b[31m\n Inspect\tAPI \u001b[0m";
  const text = renderSubagentResult(
    fixture,
    { expanded: true, isPartial: true },
    plainTheme,
  ).render(120).join("\n");

  assert.match(text, /Inspect API/);
  assert.doesNotMatch(text, /\u001b/);
});

test("expands task, attempts, warnings, tool calls, Markdown output, and diagnostics", async () => {
  const renderSubagentResult = (await loadModule()).renderSubagentResult;
  const fixture = renderFixture("succeeded");
  fixture.details.outcomes[0].run.attempts = [
    fixture.details.outcomes[0].run.attempts[0],
    {
      number: 2,
      state: "succeeded",
      activity: ["Retrying after attempt 1 failed.", "tool read completed"],
      messages: [
        assistantMessage([
          { type: "toolCall", id: "tool-1", name: "read", arguments: { path: "src/index.ts" } },
          { type: "text", text: "# Final heading\n\nFinal **answer**." },
        ]),
      ],
      stderr: "",
      exitCode: 0,
    },
  ];

  const text = renderSubagentResult(
    fixture,
    { expanded: true, isPartial: false },
    plainTheme,
  ).render(100).join("\n");

  for (const expected of [
    "Inspect a deliberately long task description",
    "Attempt 1",
    "failed",
    "Attempt 2",
    "succeeded",
    "Fallback: mapped model unavailable",
    "read",
    "src/index.ts",
    "Final heading",
    "Final answer.",
    "Exit code: 1",
    "provider diagnostic output",
    "provider failed",
  ]) {
    assert.match(text, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
  assert.doesNotMatch(text, /^# Final heading/m);
});

function batchRenderFixture(): any {
  return {
    content: [{ type: "text", text: "batch fallback" }],
    details: {
      outcomes: [
        {
          index: 0,
          status: "succeeded",
          run: {
            agent: "scout",
            title: "First task",
            task: "inspect first",
            state: "succeeded",
            startedAt: 1,
            endedAt: 2,
            attempts: [{ number: 1, state: "succeeded", activity: [], messages: [assistantMessage([{ type: "text", text: "first output" }])], stderr: "", exitCode: 0 }],
          },
        },
        { index: 1, status: "malformed", reason: "Task has an invalid shape." },
        { index: 2, status: "over-limit", reason: "Task exceeds the batch limit." },
      ],
    },
  };
}

test("renders every batch outcome in compact and expanded forms", async () => {
  const renderSubagentResult = (await loadModule()).renderSubagentResult;
  const fixture = batchRenderFixture();
  const collapsed = renderSubagentResult(
    fixture,
    { expanded: false, isPartial: false },
    plainTheme,
  ).render(120).join("\\n");
  assert.match(collapsed, /3|succeeded|malformed|over-limit/i);
  assert.doesNotMatch(collapsed, /first output|invalid shape/);

  const expanded = renderSubagentResult(
    fixture,
    { expanded: true, isPartial: false },
    plainTheme,
  ).render(120).join("\\n");
  for (const expected of ["First task", "first output", "malformed", "invalid shape", "over-limit", "batch limit"]) {
    assert.match(expanded, new RegExp(expected.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&"), "i"));
  }
  assert.ok(expanded.indexOf("First task") < expanded.indexOf("invalid shape"));
  assert.ok(expanded.indexOf("invalid shape") < expanded.indexOf("batch limit"));
  for (const width of [20, 32]) {
    const lines = renderSubagentResult(fixture, { expanded: true, isPartial: false }, plainTheme).render(width);
    assert.ok(lines.every((line: string) => visibleWidth(line) <= width));
  }
});

test("falls back to model content for invalid batch details", async () => {
  const renderSubagentResult = (await loadModule()).renderSubagentResult;
  const fixture = batchRenderFixture();
  fixture.details.outcomes[0].status = "not-a-state";
  fixture.details.outcomes[0].run.state = "not-a-state";
  const text = renderSubagentResult(
    fixture,
    { expanded: false, isPartial: false },
    plainTheme,
  ).render(80).join("\n");
  assert.match(text, /batch fallback/);
  assert.doesNotMatch(text, /not-a-state/);

  fixture.details.outcomes = [];
  const empty = renderSubagentResult(
    fixture,
    { expanded: false, isPartial: false },
    plainTheme,
  ).render(80).join("\n");
  assert.match(empty, /batch fallback/);
});

test("wraps expanded and collapsed cards to narrow terminal widths", async () => {
  const renderSubagentResult = (await loadModule()).renderSubagentResult;
  const fixture = renderFixture("failed");

  for (const expanded of [false, true]) {
    for (const width of [20, 32]) {
      const lines = renderSubagentResult(
        fixture,
        { expanded, isPartial: false },
        plainTheme,
      ).render(width);
      assert.ok(lines.length > 0);
      for (const line of lines) {
        assert.ok(visibleWidth(line) <= width, `${visibleWidth(line)} > ${width}: ${line}`);
      }
    }
  }

  const fallback = renderSubagentResult(
    { content: [{ type: "text", text: "fallback content that wraps" }] },
    { expanded: false, isPartial: false },
    plainTheme,
  ).render(12);
  assert.match(fallback.join("\n"), /fallback/);
  assert.ok(fallback.every((line: string) => visibleWidth(line) <= 12));
});
