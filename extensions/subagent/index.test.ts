import assert from "node:assert/strict";
import { access, chmod, cp, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
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

const defaultParentTools = ["read", "bash", "edit", "write", "grep", "find", "ls"];

function harness(
  parentToolNames: readonly string[] = defaultParentTools,
  activeToolNames = parentToolNames,
  sessionDirectory = process.env.PI_SUBAGENT_DELEGATION_SESSION_DIRECTORY,
) {
  let sessionStart: ((event: unknown, ctx: any) => Promise<void>) | undefined;
  let sessionShutdown: ((event: unknown, ctx: any) => Promise<void>) | undefined;
  const tools: any[] = [];
  const commands = new Map<string, any>();
  let thinkingLevel = "medium";
  let thinkingCalls = 0;
  const notifications: Array<{ message: string; level: string }> = [];
  const messages: Array<{ message: any; options: any }> = [];
  const messageRenderers = new Map<string, any>();
  let sendMessageError: Error | undefined;
  const uiState: any = { footerFactory: undefined, editorFactory: undefined, custom: undefined, customCalls: [] };
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
    custom(factory: any, options: any) {
      uiState.custom = factory;
      uiState.customCalls.push({ factory, options });
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
    registerCommand(name: string, command: any) {
      commands.set(name, command);
    },
    registerMessageRenderer(type: string, renderer: any) {
      messageRenderers.set(type, renderer);
    },
    sendMessage(message: any, options: any) {
      if (sendMessageError) throw sendMessageError;
      messages.push({ message, options });
    },
    getAllTools() {
      return parentToolNames.map((name) => ({ name }));
    },
    getActiveTools() {
      return [...activeToolNames];
    },
    getThinkingLevel() {
      thinkingCalls++;
      return thinkingLevel;
    },
  };
  const context = (mode: "tui" | "rpc" | "json" | "print") => ({
    mode,
    hasUI: mode === "tui",
    cwd: process.cwd(),
    model: { provider: "openai-codex", id: "parent" },
    thinkingLevel: "medium",
    modelRegistry: { getAvailable: () => [] },
    sessionManager: { getEntries: () => [], getLeafId: () => null, getCwd: () => process.cwd(), getSessionDir: () => sessionDirectory, getSessionName: () => undefined },
    getContextUsage: () => undefined,
    ui,
  });
  return {
    pi,
    tools,
    commands,
    notifications,
    messages,
    messageRenderers,
    failSendMessage(error: Error) { sendMessageError = error; },
    uiState,
    context,
    thinking: {
      get calls() { return thinkingCalls; },
      set level(value: string) { thinkingLevel = value; },
    },
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

/**
 * Background dispatch reads the profile settings from disk before it starts the
 * batch, so a fixed one-tick wait races that read. Poll for the condition.
 */
async function waitFor(condition: () => boolean | Promise<boolean>, description: string): Promise<void> {
  for (let attempt = 0; attempt < 500; attempt++) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for ${description}`);
}

test("registers the tool only after a TUI session starts", async () => {
  const subagentExtension = await loadExtension();

  for (const mode of ["rpc", "json", "print"] as const) {
    const testHarness = harness();
    subagentExtension(testHarness.pi);
    await testHarness.start(mode);
    assert.equal(testHarness.tools.length, 0, `${mode} registered the subagent tool`);
    assert.equal(testHarness.commands.size, 0, `${mode} registered the configuration command`);
  }

  const tuiHarness = harness();
  subagentExtension(tuiHarness.pi);
  assert.equal(tuiHarness.tools.length, 0);
  try {
    await tuiHarness.start("tui");
    assert.equal(tuiHarness.tools.length, 1);
    assert.ok(tuiHarness.commands.has("subagent-config"));
  } finally {
    await tuiHarness.shutdown();
  }
});

test("registers Scout only for provenance-verified specialist JSON children", async () => {
  const previousRole = process.env.PI_SUBAGENT_DELEGATION_ROLE;
  const previousDirectory = process.env.PI_SUBAGENT_DELEGATION_SESSION_DIRECTORY;
  process.env.PI_SUBAGENT_DELEGATION_SESSION_DIRECTORY = "/tmp/pi-subagent-specialist";
  try {
    for (const role of ["worker", "oracle", "reviewer"]) {
      process.env.PI_SUBAGENT_DELEGATION_ROLE = role;
      const testHarness = harness(["read"], ["read"]);
      (await loadExtension())(testHarness.pi);
      try {
        await testHarness.start("json");
        assert.equal(testHarness.tools.length, 1, role);
        const [tool] = testHarness.tools;
        assert.equal(tool.name, "Scout");
        assert.equal(tool.executionMode, "parallel");
        assert.deepEqual(tool.parameters.required, ["tasks"]);
        assert.throws(() => validateToolArguments(tool, {
          type: "toolCall", id: "extra", name: "Scout", arguments: { tasks: [], role: "scout" },
        }));
      } finally {
        await testHarness.shutdown();
      }
    }

    for (const [role, directory] of [["scout", "/tmp/pi-subagent-specialist"], ["worker", "/tmp/other-session"]]) {
      process.env.PI_SUBAGENT_DELEGATION_ROLE = role;
      const testHarness = harness(["read", "Scout"], ["read", "Scout"], directory);
      (await loadExtension())(testHarness.pi);
      await testHarness.start("json");
      assert.equal(testHarness.tools.length, 0, `${role} must not gain Scout from active tools`);
    }
  } finally {
    if (previousRole === undefined) delete process.env.PI_SUBAGENT_DELEGATION_ROLE;
    else process.env.PI_SUBAGENT_DELEGATION_ROLE = previousRole;
    if (previousDirectory === undefined) delete process.env.PI_SUBAGENT_DELEGATION_SESSION_DIRECTORY;
    else process.env.PI_SUBAGENT_DELEGATION_SESSION_DIRECTORY = previousDirectory;
  }
});

test("does not register nested Scout on Windows but retains root Agent", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(process, "platform");
  Object.defineProperty(process, "platform", { value: "win32", configurable: true });
  const previousRole = process.env.PI_SUBAGENT_DELEGATION_ROLE;
  const previousDirectory = process.env.PI_SUBAGENT_DELEGATION_SESSION_DIRECTORY;
  process.env.PI_SUBAGENT_DELEGATION_ROLE = "worker";
  process.env.PI_SUBAGENT_DELEGATION_SESSION_DIRECTORY = "/tmp/pi-subagent-specialist";
  try {
    const nested = harness(["read"], ["read"]);
    (await loadExtension())(nested.pi);
    await nested.start("json");
    assert.equal(nested.tools.length, 0, "Windows fails closed for nested Scout registration");

    const root = harness();
    (await loadExtension())(root.pi);
    await root.start("tui");
    assert.equal(root.tools[0]?.name, "Agent");
    await root.shutdown();
  } finally {
    if (descriptor) Object.defineProperty(process, "platform", descriptor);
    if (previousRole === undefined) delete process.env.PI_SUBAGENT_DELEGATION_ROLE;
    else process.env.PI_SUBAGENT_DELEGATION_ROLE = previousRole;
    if (previousDirectory === undefined) delete process.env.PI_SUBAGENT_DELEGATION_SESSION_DIRECTORY;
    else process.env.PI_SUBAGENT_DELEGATION_SESSION_DIRECTORY = previousDirectory;
  }
});

test("Scout validates ordered requests and reserves four slots across overlapping calls", { timeout: 10_000 }, async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pi-subagent-scout-tool-"));
  const marker = path.join(directory, "started");
  const release = path.join(directory, "release");
  const profileDirectory = await mkdtemp(path.join(os.tmpdir(), "pi-subagent-scout-profile-"));
  const previousPath = process.env.PATH;
  const previousProfileDirectory = process.env.PI_CODING_AGENT_DIR;
  await writeFile(path.join(directory, "pi"), `#!/usr/bin/env node
const fs = require("node:fs");
const dir = process.argv[process.argv.indexOf("--session-dir") + 1];
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(dir + "/child.jsonl", "");
fs.appendFileSync(${JSON.stringify(marker)}, "started\\n");
const timer = setInterval(() => {
  if (!fs.existsSync(${JSON.stringify(release)})) return;
  clearInterval(timer);
  process.stdout.write(JSON.stringify({ type: "session", id: "child" }) + "\\n");
  process.stdout.write(JSON.stringify({ type: "message_end", message: { role: "assistant", content: [{ type: "text", text: "local evidence" }], stopReason: "stop" } }) + "\\n");
}, 5);
`);
  await chmod(path.join(directory, "pi"), 0o755);
  process.env.PATH = `${directory}${path.delimiter}${previousPath ?? ""}`;
  process.env.PI_CODING_AGENT_DIR = profileDirectory;
  const previousRole = process.env.PI_SUBAGENT_DELEGATION_ROLE;
  const previousSessionDirectory = process.env.PI_SUBAGENT_DELEGATION_SESSION_DIRECTORY;
  process.env.PI_SUBAGENT_DELEGATION_ROLE = "worker";
  process.env.PI_SUBAGENT_DELEGATION_SESSION_DIRECTORY = "/tmp/pi-subagent-scout-tool";
  const testHarness = harness(["read", "Scout"], ["read", "Scout"]);
  (await loadExtension())(testHarness.pi);
  try {
    await testHarness.start("json");
    const [tool] = testHarness.tools;
    const scoutContext = testHarness.context("json");
    scoutContext.modelRegistry = { getAvailable: () => [{ provider: "openai-codex", id: "gpt-5.6-luna", reasoning: true }] } as any;
    const first = tool.execute("first", { tasks: [
      { title: "one", task: "read local one" },
      { title: "two", task: "read local two" },
    ] }, undefined, undefined, scoutContext);
    const second = tool.execute("second", { tasks: [
      { title: "three", task: "read local three" },
      { title: "four", task: "read local four" },
      { title: "five", task: "read local five" },
    ] }, undefined, undefined, scoutContext);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await writeFile(release, "release");
    const [firstResult, completedSecond] = await Promise.all([first, second]);
    assert.deepEqual(firstResult.details.outcomes.map((outcome: any) => outcome.status), ["succeeded", "succeeded"]);
    assert.match(firstResult.content[0].text, /one.*succeeded[\s\S]*local evidence/i);
    assert.deepEqual(completedSecond.details.outcomes.map((outcome: any) => outcome.status), ["succeeded", "succeeded", "over-limit"]);
    const web = await tool.execute("web", { tasks: [
      null,
      { title: "bad", task: "" },
      { title: "role", task: "local", role: "scout" },
      { title: "web docs", task: "search the web for the API" },
    ] }, undefined, undefined, scoutContext);
    assert.deepEqual(web.details.outcomes.map((outcome: any) => outcome.status), ["malformed", "malformed", "malformed", "over-limit"]);
  } finally {
    await writeFile(release, "release").catch(() => {});
    await testHarness.shutdown().catch(() => {});
    process.env.PATH = previousPath;
    if (previousRole === undefined) delete process.env.PI_SUBAGENT_DELEGATION_ROLE;
    else process.env.PI_SUBAGENT_DELEGATION_ROLE = previousRole;
    if (previousSessionDirectory === undefined) delete process.env.PI_SUBAGENT_DELEGATION_SESSION_DIRECTORY;
    else process.env.PI_SUBAGENT_DELEGATION_SESSION_DIRECTORY = previousSessionDirectory;
    if (previousProfileDirectory === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previousProfileDirectory;
    await rm(directory, { recursive: true, force: true });
    await rm(profileDirectory, { recursive: true, force: true });
  }
});

test("runs root Agent through a specialist Scout and cleans its cancelled Scout process", { timeout: 15_000 }, async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pi-subagent-e2e-scout-"));
  const executable = path.join(directory, "pi");
  const records = path.join(directory, "records.jsonl");
  const scoutPidPath = path.join(directory, "scout.pid");
  const previousPath = process.env.PATH;
  const previousRecords = process.env.PI_SUBAGENT_E2E_RECORDS;
  const previousScoutPid = process.env.PI_SUBAGENT_E2E_SCOUT_PID;
  const previousExtension = process.env.PI_SUBAGENT_E2E_EXTENSION;
  await writeFile(executable, `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const record = (value) => fs.appendFileSync(process.env.PI_SUBAGENT_E2E_RECORDS, JSON.stringify(value) + "\\n");
const emit = (value) => process.stdout.write(JSON.stringify(value) + "\\n");
const argv = process.argv.slice(2);
record({ role: process.env.PI_SUBAGENT_DELEGATION_ROLE, argv, pid: process.pid });
if (process.env.PI_SUBAGENT_DELEGATION_ROLE === "scout") {
  fs.writeFileSync(process.env.PI_SUBAGENT_E2E_SCOUT_PID, String(process.pid));
  if (argv.includes("cancel")) setInterval(() => {}, 1_000);
  else setTimeout(() => {
    emit({ type: "session", id: "scout-" + process.pid });
    if (argv.includes("search unavailable web")) {
      process.stderr.write("web access unavailable\\n");
      process.exitCode = 1;
    } else emit({ type: "message_end", message: { role: "assistant", content: [{ type: "text", text: argv.includes("search web") ? "Web research unavailable: codex-research is unavailable." : "local source: docs/local.md:1" }], usage: { input: 3, output: 2, totalTokens: 5 }, stopReason: "stop" } });
  }, 20);
} else {
const sessionDirectory = argv[argv.indexOf("--session-dir") + 1];
fs.mkdirSync(sessionDirectory, { recursive: true });
fs.writeFileSync(path.join(sessionDirectory, "specialist-" + process.pid + ".jsonl"), "");
emit({ type: "session", id: "specialist-" + process.pid });
const cancelled = argv.at(-1).includes("cancel");
const tasks = cancelled ? [{ title: "cancelled evidence", task: "cancel" }] : [
  { title: "local evidence", task: "read docs/local.md" },
  { title: "web evidence", task: "search web documentation" },
  null,
  { title: "failed web", task: "search unavailable web" },
  { title: "fourth", task: "fourth request" },
  { title: "extra", task: "fifth request" },
];
(async () => {
  let onStart, onShutdown, scoutTool;
  const context = {
    mode: "json", hasUI: false, cwd: process.cwd(), model: { provider: "openai-codex", id: "parent" }, thinkingLevel: "medium",
    modelRegistry: { getAvailable: () => [] },
    sessionManager: { getSessionDir: () => sessionDirectory }, ui: { notify() {} },
  };
  const extension = await import(process.env.PI_SUBAGENT_E2E_EXTENSION);
  extension.default({
    on(event, handler) { if (event === "session_start") onStart = handler; else if (event === "session_shutdown") onShutdown = handler; },
    registerTool(tool) { scoutTool = tool; }, getAllTools() { return []; }, getActiveTools() { return []; }, getThinkingLevel() { return "medium"; },
  });
  await onStart({}, context);
  if (!scoutTool) throw new Error("specialist did not register Scout");
  emit({ type: "tool_execution_start", toolName: "Scout", toolCallId: "nested", args: { tasks } });
  const result = await scoutTool.execute("nested", { tasks }, undefined, (partialResult) =>
    emit({ type: "tool_execution_update", toolName: "Scout", toolCallId: "nested", partialResult }), context);
  emit({ type: "tool_execution_end", toolName: "Scout", toolCallId: "nested", result });
  await onShutdown({}, context);
  emit({ type: "message_end", message: { role: "assistant", content: [{ type: "text", text: "specialist conclusion" }], usage: { input: 11, output: 7, totalTokens: 18 }, stopReason: "stop" } });
})().catch((error) => { process.stderr.write(String(error.stack || error)); process.exitCode = 1; });
}
`);
  await chmod(executable, 0o755);
  await writeFile(records, "");
  process.env.PATH = `${directory}${path.delimiter}${previousPath ?? ""}`;
  process.env.PI_SUBAGENT_E2E_RECORDS = records;
  process.env.PI_SUBAGENT_E2E_SCOUT_PID = scoutPidPath;
  process.env.PI_SUBAGENT_E2E_EXTENSION = new URL("./index.ts", import.meta.url).href;

  const testHarness = harness();
  (await loadExtension())(testHarness.pi);
  try {
    await testHarness.start("tui");
    const [agent] = testHarness.tools;
    const updates: any[] = [];
    const pending = agent.execute(
      "root",
      { tasks: [{ agent: "worker", title: "specialist", task: "research and decide" }] },
      undefined,
      (update: any) => updates.push(update),
      testHarness.context("tui"),
    );
    const result = await pending;
    assert.deepEqual(result.details.outcomes.map((outcome: any) => outcome.status), ["succeeded"]);
    assert.match(result.content[0].text, /^1\. specialist — succeeded\n[\s\S]*Usage: own ↑11 ↓7 ctx 18 \| Scouts ↑9 ↓6 ctx 15\nspecialist conclusion$/);
    const scouts = result.details.outcomes[0].run.attempts[0].scouts[0];
    assert.deepEqual(scouts.outcomes.map((outcome: any) => outcome.status), ["succeeded", "succeeded", "malformed", "failed", "succeeded", "over-limit"]);
    assert.match(JSON.stringify(scouts.outcomes), /docs\/local\.md:1/);
    assert.match(JSON.stringify(scouts.outcomes), /Web research unavailable|web access unavailable/);
    assert.ok(updates.some((update) => update.details.outcomes[0]?.run.attempts[0]?.scouts[0]?.outcomes[0]?.status === "running"));
    assert.deepEqual(result.details.outcomes[0].run.attempts[0].usage, { inputTokens: 11, outputTokens: 7, contextTokens: 18 });
    assert.deepEqual(scouts.outcomes[0].run.attempts[0].usage, { inputTokens: 3, outputTokens: 2, contextTokens: 5 });

    const controller = new AbortController();
    const cancelled = agent.execute(
      "root-cancel",
      { tasks: [{ agent: "worker", title: "cancel specialist", task: "cancel nested Scout" }] },
      controller.signal,
      undefined,
      testHarness.context("tui"),
    );
    await rm(scoutPidPath, { force: true });
    await waitFor(async () => Number(await readFile(scoutPidPath, "utf8").catch(() => "0")) > 0, "nested Scout to start");
    const scoutPid = Number(await readFile(scoutPidPath, "utf8"));
    controller.abort(new Error("cancel specialist"));
    await assert.rejects(cancelled);
    assert.throws(() => process.kill(scoutPid, 0), "Scout descendant stopped before session cleanup");

    const spawned = (await readFile(records, "utf8")).trim().split("\n").map((line) => JSON.parse(line));
    const specialist = spawned.find((entry: any) => entry.role === "worker");
    const scout = spawned.find((entry: any) => entry.role === "scout" && entry.argv.some((argument: string) => argument.includes("codex-research")));
    assert.ok(specialist?.argv[specialist.argv.indexOf("--tools") + 1]?.split(",").includes("Scout"), "specialist received its approved Scout delegation tool");
    assert.equal(scout?.argv[scout.argv.indexOf("--tools") + 1], "read,grep,find,ls,codex-research");
    assert.equal(testHarness.messages.length, 0);
  } finally {
    await testHarness.shutdown().catch(() => {});
    process.env.PATH = previousPath;
    if (previousRecords === undefined) delete process.env.PI_SUBAGENT_E2E_RECORDS;
    else process.env.PI_SUBAGENT_E2E_RECORDS = previousRecords;
    if (previousScoutPid === undefined) delete process.env.PI_SUBAGENT_E2E_SCOUT_PID;
    else process.env.PI_SUBAGENT_E2E_SCOUT_PID = previousScoutPid;
    if (previousExtension === undefined) delete process.env.PI_SUBAGENT_E2E_EXTENSION;
    else process.env.PI_SUBAGENT_E2E_EXTENSION = previousExtension;
    await rm(directory, { recursive: true, force: true });
  }
});

test("dispatch snapshots fallback reasoning from the host API once", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pi-subagent-thinking-fallback-"));
  const profileDirectory = await mkdtemp(path.join(os.tmpdir(), "pi-subagent-thinking-profile-"));
  const previousPath = process.env.PATH;
  const previousProfileDirectory = process.env.PI_CODING_AGENT_DIR;
  await writeFile(path.join(directory, "pi"), `#!/usr/bin/env node
const fs = require("node:fs");
const dir = process.argv[process.argv.indexOf("--session-dir") + 1];
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(dir + "/child.jsonl", "");
process.stdout.write(JSON.stringify({ type: "session", id: "child" }) + "\\n");
process.stdout.write(JSON.stringify({ type: "message_end", message: { role: "assistant", content: [{ type: "text", text: "ok" }], stopReason: "stop" } }) + "\\n");
`);
  await chmod(path.join(directory, "pi"), 0o755);
  process.env.PATH = `${directory}${path.delimiter}${previousPath ?? ""}`;
  process.env.PI_CODING_AGENT_DIR = profileDirectory;
  try {
    const testHarness = harness();
    (await loadExtension())(testHarness.pi);
    await testHarness.start("tui");
    const context = testHarness.context("tui");
    delete (context as any).thinkingLevel;
    context.modelRegistry = { getAvailable: () => [] };
    const result = await testHarness.tools[0].execute("fallback", { tasks: [{ agent: "scout", title: "fallback", task: "test" }] }, undefined, undefined, context);
    testHarness.thinking.level = "high";
    const run = result.details.outcomes[0].run;
    assert.equal(result.details.outcomes[0].status, "succeeded");
    assert.equal(testHarness.thinking.calls, 1);
    assert.equal(run.thinkingLevel, "medium");
    const explicitContext = testHarness.context("tui");
    explicitContext.thinkingLevel = "high";
    explicitContext.modelRegistry = { getAvailable: () => [] };
    const explicit = await testHarness.tools[0].execute("explicit", { tasks: [{ agent: "scout", title: "explicit", task: "test" }] }, undefined, undefined, explicitContext);
    assert.equal(explicit.details.outcomes[0].run.thinkingLevel, "high");
    assert.equal(testHarness.thinking.calls, 1);
    await testHarness.shutdown();
  } finally {
    process.env.PATH = previousPath;
    if (previousProfileDirectory === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previousProfileDirectory;
    await rm(directory, { recursive: true, force: true });
    await rm(profileDirectory, { recursive: true, force: true });
  }
});

test("opens fresh global configuration with the current model catalog", async () => {
  const profileDirectory = await mkdtemp(path.join(os.tmpdir(), "pi-subagent-config-command-"));
  const previousProfileDirectory = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = profileDirectory;
  try {
    const first = harness();
    (await loadExtension())(first.pi);
    await first.start("tui");
    const command = first.commands.get("subagent-config");
    assert.ok(command);
    await command.handler("unexpected", first.context("tui"));
    assert.deepEqual(first.notifications, [{ message: "Usage: /subagent-config", level: "error" }]);
    assert.equal(first.uiState.customCalls.length, 0);

    let firstCatalogReads = 0;
    const firstContext = first.context("tui");
    firstContext.modelRegistry = { getAvailable: () => { firstCatalogReads++; return [{ provider: "custom", id: "first", reasoning: true }]; } } as any;
    const parent = { model: firstContext.model, thinkingLevel: firstContext.thinkingLevel };
    void command.handler("", firstContext);
    for (let attempt = 0; attempt < 20 && first.uiState.customCalls.length === 0; attempt++) await new Promise((resolve) => setImmediate(resolve));
    assert.equal(firstCatalogReads, 1);
    assert.equal(first.uiState.customCalls.length, 1);
    assert.deepEqual(first.uiState.customCalls[0].options, { overlay: true, overlayOptions: { anchor: "center", width: "70%", maxHeight: "80%", minWidth: 40 } });
    const firstModal = first.uiState.customCalls[0].factory({ requestRender() {}, terminal: { rows: 24, columns: 80 } }, { fg: (_: string, text: string) => text }, {}, () => {});
    assert.match(firstModal.render(100).join("\n"), /scout|worker|oracle|reviewer/i);
    assert.deepEqual({ model: firstContext.model, thinkingLevel: firstContext.thinkingLevel }, parent);
    assert.equal(first.tools.length, 1);
    await first.shutdown();

    await writeFile(path.join(profileDirectory, "subagent-config.json"), JSON.stringify({ version: 1, agents: { scout: { provider: "custom", model: "second", thinkingLevel: "high" } } }));
    const second = harness();
    (await loadExtension())(second.pi);
    await second.start("tui");
    const secondContext = second.context("tui");
    let secondCatalogReads = 0;
    secondContext.modelRegistry = { getAvailable: () => { secondCatalogReads++; return [{ provider: "custom", id: "second", reasoning: true }]; } } as any;
    void second.commands.get("subagent-config").handler("", secondContext);
    for (let attempt = 0; attempt < 20 && second.uiState.customCalls.length === 0; attempt++) await new Promise((resolve) => setImmediate(resolve));
    assert.equal(secondCatalogReads, 1);
    const secondModal = second.uiState.customCalls[0].factory({ requestRender() {}, terminal: { rows: 24, columns: 80 } }, { fg: (_: string, text: string) => text }, {}, () => {});
    assert.match(secondModal.render(100).join("\n"), /│ > Scout\s+│\s+Model: custom\/second[\s\S]*Source: saved/);
    assert.equal(second.tools.length, 1);
    await second.shutdown();
  } finally {
    if (previousProfileDirectory === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previousProfileDirectory;
    await rm(profileDirectory, { recursive: true, force: true });
  }
});

test("resolves bundled search tools independently from parent availability", { timeout: 10_000 }, async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pi-subagent-tool-resolution-"));
  const recordPath = path.join(directory, "records.jsonl");
  const executable = path.join(directory, "pi");
  const previousPath = process.env.PATH;
  const previousRecordPath = process.env.PI_SUBAGENT_TOOL_RECORD;
  await writeFile(recordPath, "");
  await writeFile(
    executable,
    `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const argv = process.argv.slice(2);
const sessionDirectory = argv[argv.indexOf("--session-dir") + 1];
const sessionId = "resolution-" + process.pid;
fs.mkdirSync(sessionDirectory, { recursive: true });
fs.writeFileSync(path.join(sessionDirectory, sessionId + ".jsonl"), "");
fs.appendFileSync(process.env.PI_SUBAGENT_TOOL_RECORD, JSON.stringify(argv) + "\\n");
process.stdout.write(JSON.stringify({ type: "session", id: sessionId }) + "\\n");
process.stdout.write(JSON.stringify({ type: "message_end", message: { role: "assistant", content: [{ type: "text", text: "ok" }], stopReason: "stop" } }) + "\\n");
`,
  );
  await chmod(executable, 0o755);
  process.env.PATH = `${directory}${path.delimiter}${previousPath ?? ""}`;
  process.env.PI_SUBAGENT_TOOL_RECORD = recordPath;

  const baseTools: Record<string, string[]> = {
    scout: ["read", "grep", "find", "ls", "codex-research"],
    worker: ["read", "bash", "edit", "write", "grep", "find", "ls", "Scout"],
    oracle: ["read", "grep", "find", "ls", "Scout"],
    reviewer: ["read", "bash", "grep", "find", "ls", "Scout"],
  };
  const cases = [
    { parent: ["fffind", "ffgrep", "parent-only"], find: "fffind", grep: "ffgrep" },
    { parent: ["fffind", "parent-only"], find: "fffind", grep: "grep" },
    { parent: ["ffgrep", "parent-only"], find: "find", grep: "ffgrep" },
    { parent: ["parent-only"], find: "find", grep: "grep" },
  ];

  try {
    for (const [index, resolution] of cases.entries()) {
      const testHarness = harness(resolution.parent);
      const subagentExtension = await loadExtension();
      subagentExtension(testHarness.pi);
      try {
        await testHarness.start("tui");
        const [tool] = testHarness.tools;
        const result = await tool.execute(
          `resolution-${index}`,
          {
            tasks: Object.keys(baseTools).map((agent) => ({
              agent,
              title: `${agent} resolution`,
              task: "record the child tool allowlist",
            })),
          },
          undefined,
          undefined,
          testHarness.context("tui"),
        );
        assert.deepEqual(result.details.outcomes.map((outcome: any) => outcome.status), [
          "succeeded", "succeeded", "succeeded", "succeeded",
        ]);
        assert.equal(testHarness.messages.length, 0);

        const records = (await readFile(recordPath, "utf8"))
          .trim()
          .split("\n")
          .filter(Boolean)
          .slice(index * 4)
          .map((line) => JSON.parse(line));
        assert.equal(records.length, 4);
        for (const [agent, tools] of Object.entries(baseTools)) {
          const record = records.find((argv: string[]) => argv[argv.indexOf("--name") + 1] === `${agent} resolution`);
          assert.ok(record, `missing child record for ${agent}`);
          const actual = record[record.indexOf("--tools") + 1].split(",");
          assert.deepEqual(
            actual,
            tools.map((tool) => tool === "find" ? resolution.find : tool === "grep" ? resolution.grep : tool),
            agent,
          );
        }
      } finally {
        await testHarness.shutdown();
      }
    }
  } finally {
    process.env.PATH = previousPath;
    if (previousRecordPath === undefined) delete process.env.PI_SUBAGENT_TOOL_RECORD;
    else process.env.PI_SUBAGENT_TOOL_RECORD = previousRecordPath;
    await rm(directory, { recursive: true, force: true });
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
        type: "toolCall", id: "empty", name: "Agent", arguments: { tasks: [] },
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
      type: "toolCall", id: "malformed", name: "Agent", arguments: { tasks: [null] },
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

    assert.equal(tool.name, "Agent");
    assert.equal(tool.label, "Agent");
    assert.match(tool.description, /wait.*every accepted child|final outcomes/i);
    assert.match(tool.description, /inspect every returned outcome before continuing/i);
    assert.doesNotMatch(tool.description, /subagent-result|returns immediately/i);
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
        type: "toolCall", id: "empty", name: "Agent", arguments: { tasks: [] },
      }),
      /tasks/i,
    );
    assert.throws(
      () => validateToolArguments(tool, {
        type: "toolCall", id: "old", name: "Agent", arguments: { agent: "scout", title: "inspect", task: "inspect" },
      }),
      /tasks/i,
    );
    assert.doesNotThrow(() => validateToolArguments(tool, {
      type: "toolCall", id: "malformed", name: "Agent", arguments: { tasks: [null] },
    }));

    const result = await tool.execute(
      "call",
      { tasks: [{ agent: "missing", title: "inspect", task: "inspect" }] },
      undefined,
      undefined,
      testHarness.context("tui"),
    );
    assert.equal(result.details.outcomes[0].status, "failed");
    assert.equal(result.details.outcomes[0].run.state, "failed");
    assert.equal(testHarness.messages.length, 0);
    assert.match(result.content[0].text, /Unknown agent: missing/);
  } finally {
    await testHarness.shutdown();
  }
});

test("public Agent dispatch freezes corrupt settings for a retry and reloads repaired overrides", { timeout: 10_000 }, async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pi-subagent-settings-dispatch-"));
  const profileDirectory = await mkdtemp(path.join(os.tmpdir(), "pi-subagent-profile-"));
  const executable = path.join(directory, "pi");
  const recordsDirectory = path.join(directory, "records");
  const release = path.join(directory, "release");
  const statePath = path.join(profileDirectory, "subagent-config.json");
  const previousPath = process.env.PATH;
  const previousProfileDirectory = process.env.PI_CODING_AGENT_DIR;
  const previousRecordsDirectory = process.env.PI_SUBAGENT_SETTINGS_RECORDS;
  const previousRelease = process.env.PI_SUBAGENT_SETTINGS_RELEASE;
  await fsPromises.mkdir(recordsDirectory);
  await writeFile(
    executable,
    `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const argv = process.argv.slice(2);
const records = process.env.PI_SUBAGENT_SETTINGS_RECORDS;
const attempt = fs.readdirSync(records).length + 1;
fs.writeFileSync(path.join(records, String(attempt)), JSON.stringify({ argv, attempt }));
const sessionDirectory = argv[argv.indexOf("--session-dir") + 1];
const sessionId = "settings-" + process.pid;
fs.mkdirSync(sessionDirectory, { recursive: true });
fs.writeFileSync(path.join(sessionDirectory, sessionId + ".jsonl"), "");
function finish() {
  process.stdout.write(JSON.stringify({ type: "session", id: sessionId }) + "\\n");
  process.stdout.write(JSON.stringify({ type: "message_end", message: { role: "assistant", content: [{ type: "text", text: "ok" }], stopReason: "stop" } }) + "\\n");
}
if (attempt === 1) process.exit(1);
if (attempt === 2) setInterval(() => { if (fs.existsSync(process.env.PI_SUBAGENT_SETTINGS_RELEASE)) { finish(); process.exit(0); } }, 10);
else finish();
`,
  );
  await chmod(executable, 0o755);
  process.env.PATH = `${directory}${path.delimiter}${previousPath ?? ""}`;
  process.env.PI_CODING_AGENT_DIR = profileDirectory;
  process.env.PI_SUBAGENT_SETTINGS_RECORDS = recordsDirectory;
  process.env.PI_SUBAGENT_SETTINGS_RELEASE = release;

  const records = async () => Promise.all((await readdir(recordsDirectory)).map(async (file) => JSON.parse(await readFile(path.join(recordsDirectory, file), "utf8"))));
  const waitForRecords = async (count: number) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      if ((await records()).length >= count) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`Expected ${count} child attempts`);
  };
  try {
    await writeFile(statePath, "{ corrupt");
    const subagentExtension = await loadExtension();
    const testHarness = harness();
    subagentExtension(testHarness.pi);
    await testHarness.start("tui");
    const toolContext = testHarness.context("tui");
    toolContext.modelRegistry = { getAvailable: () => [
      { provider: "openai-codex", id: "gpt-5.6-luna", reasoning: true },
      { provider: "test", id: "override-model", reasoning: true },
    ] } as any;
    const [tool] = testHarness.tools;
    const pending = tool.execute("corrupt", { tasks: [{ agent: "scout", title: "corrupt", task: "retry" }] }, undefined, undefined, toolContext);
    await waitForRecords(2);
    await writeFile(statePath, JSON.stringify({ version: 1, agents: { scout: { provider: "test", model: "override-model", thinkingLevel: "high" } } }));
    await writeFile(release, "release");
    const current = await pending;
    assert.equal(current.details.outcomes[0].status, "succeeded");
    const currentRun = current.details.outcomes[0].run;
    assert.equal(currentRun.model, "openai-codex/gpt-5.6-luna");
    assert.equal(currentRun.thinkingLevel, "medium");
    assert.match(currentRun.warnings[0], /Failed to read profile settings/i);
    assert.ok((await records()).slice(0, 2).every((record) => record.argv[5] === "openai-codex/gpt-5.6-luna"));

    const repaired = await tool.execute("repaired", { tasks: [{ agent: "scout", title: "repaired", task: "reload" }] }, undefined, undefined, toolContext);
    const laterRun = repaired.details.outcomes[0].run;
    assert.equal(laterRun.model, "test/override-model");
    assert.equal(laterRun.thinkingLevel, "high");
    assert.deepEqual(laterRun.warnings, []);
    await testHarness.shutdown();
  } finally {
    process.env.PATH = previousPath;
    if (previousProfileDirectory === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previousProfileDirectory;
    if (previousRecordsDirectory === undefined) delete process.env.PI_SUBAGENT_SETTINGS_RECORDS;
    else process.env.PI_SUBAGENT_SETTINGS_RECORDS = previousRecordsDirectory;
    if (previousRelease === undefined) delete process.env.PI_SUBAGENT_SETTINGS_RELEASE;
    else process.env.PI_SUBAGENT_SETTINGS_RELEASE = previousRelease;
    await rm(directory, { recursive: true, force: true });
    await rm(profileDirectory, { recursive: true, force: true });
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
    const controller = new AbortController();
    let settled = false;
    const pending = tool.execute(
      "batch-call",
      {
        tasks: Array.from({ length: 4 }, (_, index) => ({
          agent: "scout", title: `Child ${index}`, task: "block until released",
        })),
      },
      controller.signal,
      undefined,
      testHarness.context("tui"),
    );
    void pending.then(() => { settled = true; }, () => { settled = true; });
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        if ((await readFile(marker, "utf8")).trim().split("\n").filter(Boolean).length >= 4) break;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(settled, false);
    assert.equal(testHarness.messages.length, 0);
    const activeText = testHarness.uiState.footer.render(120).join("\n");
    for (let index = 0; index < 3; index++) assert.match(activeText, new RegExp(`Child ${index}`));
    assert.doesNotMatch(activeText, /Child 3/);
    for (let index = 0; index < 4; index++) testHarness.uiState.footer.handleInput("\x1b[B");
    const scrolledText = testHarness.uiState.footer.render(120).join("\n");
    assert.match(scrolledText, /Child 3/);
    assert.doesNotMatch(scrolledText, /Child 0/);
    await writeFile(release, "release");
    const result = await pending;
    assert.deepEqual(result.details.outcomes.map((outcome: any) => outcome.status), [
      "succeeded", "succeeded", "succeeded", "succeeded",
    ]);
    assert.equal(testHarness.messages.length, 0);
    const finishedText = testHarness.uiState.footer.render(120).join("\n");
    assert.match(finishedText, /\(openai-codex\) parent • medium/);
    assert.doesNotMatch(finishedText, /orchestrator|^subagent /m);
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
        testHarness.shutdown(),
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
    assert.equal(testHarness.commands.size, 0);
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
    for (const file of ["index.ts", "package.json"]) {
      await cp(new URL(file, import.meta.url), path.join(directory, file));
    }
    for (const module of ["runtime", "ui", "state"]) {
      await cp(new URL(`./${module}/`, import.meta.url), path.join(directory, module), {
        recursive: true,
      });
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
      assert.equal(testHarness.commands.size, 0);
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
          warnings: ["Fallback: mapped model unavailable; using parent model."],
          attempts: [{
            number: 1,
            state: state === "retrying" ? "failed" : state,
            activity: [],
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

test("expanded runs retain own and Scout usage totals", async () => {
  const renderSubagentResult = (await loadModule()).renderSubagentResult;
  const fixture = renderFixture("succeeded");
  fixture.details.outcomes[0].run.attempts[0].usage = { inputTokens: 11, outputTokens: 7, contextTokens: 18 };
  fixture.details.outcomes[0].run.attempts[0].scouts = [{
    toolCallId: "scout-1",
    partial: true,
    outcomes: [{ index: 0, status: "succeeded", run: {
      agent: "scout", title: "evidence", task: "inspect", state: "succeeded", startedAt: 1, endedAt: 2, warnings: [],
      attempts: [{ number: 1, state: "succeeded", activity: [], messages: [], usage: { inputTokens: 3, outputTokens: 2, contextTokens: 5 }, scouts: [], stderr: "", exitCode: 0 }],
    } }],
  }];

  const text = renderSubagentResult(fixture, { expanded: true, isPartial: false }, plainTheme).render(120).join("\n");
  assert.match(text, /Usage: own ↑11 ↓7 ctx 18 \| Scouts \(partial\) ↑3 ↓2 ctx 5/);
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

test("expands historical run details without warnings and falls back for malformed warnings", async () => {
  const renderSubagentResult = (await loadModule()).renderSubagentResult;
  const fixture = renderFixture("succeeded");
  delete fixture.details.outcomes[0].run.warnings;

  const text = renderSubagentResult(
    fixture,
    { expanded: true, isPartial: false },
    plainTheme,
  ).render(120).join("\n");

  assert.match(text, /Inspect a deliberately long task description/);
  assert.match(text, /Attempt 1/);

  for (const warnings of ["not-an-array", ["valid warning", 1]]) {
    const malformed = renderFixture("succeeded");
    malformed.details.outcomes[0].run.warnings = warnings;
    const fallback = renderSubagentResult(malformed, { expanded: true, isPartial: false }, plainTheme).render(120).join("\n");
    assert.match(fallback, /Final \*\*answer\*\*/);
    assert.doesNotMatch(fallback, /Subagents/);
  }
});

test("renders every warning before a pre-spawn model failure", async () => {
  const renderSubagentResult = (await loadModule()).renderSubagentResult;
  const fixture = renderFixture("failed");
  const run = fixture.details.outcomes[0].run;
  run.attempts = [];
  run.warnings = [
    "Failed to read profile settings: invalid JSON",
    "Fallback unavailable: configured model missing/model is unavailable and the parent model or reasoning level is unavailable.",
  ];
  run.error = run.warnings[1];

  const text = renderSubagentResult(
    fixture,
    { expanded: true, isPartial: false },
    plainTheme,
  ).render(160).join("\n");

  for (const warning of run.warnings) {
    assert.equal(text.split(`Warning: ${warning}`).length - 1, 1);
  }
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
            warnings: [],
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
