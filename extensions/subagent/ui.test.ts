import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { access, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import fsPromises from "node:fs/promises";

import { initTheme } from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";

import {
  AgentFooter,
  ChildSessionView,
  SubagentRegistry,
  createAgentNavigationEditor,
  isCursorOnLastVisualLine,
  installSubagentUI,
  readChildSession,
} from "./ui.ts";

function monitored(runId: string, state = "running"): any {
  return {
    runId,
    run: {
      agent: "scout",
      title: `Title ${runId}`,
      task: "inspect",
      state,
      startedAt: 1,
      attempts: [],
    },
    sessions: [],
  };
}

test("tracks active runs in spawn order and supports four children", () => {
  const registry = new SubagentRegistry();
  for (const runId of ["one", "two", "three", "four"]) registry.add(monitored(runId));

  assert.deepEqual(registry.list().map((run) => run.runId), ["one", "two", "three", "four"]);
  registry.update(monitored("two", "succeeded"));
  assert.equal(registry.get("two")?.run.state, "succeeded");
  registry.remove("two");
  assert.deepEqual(registry.list().map((run) => run.runId), ["one", "three", "four"]);
  registry.clear();
  assert.deepEqual(registry.list(), []);
});

test("notifies once for each accepted mutation and publishes copies", () => {
  const registry = new SubagentRegistry();
  let changes = 0;
  registry.subscribe(() => changes++);
  registry.add(monitored("one"));
  registry.update(monitored("one", "failed"));
  registry.remove("one");
  registry.clear();
  assert.equal(changes, 3);

  registry.add(monitored("one"));
  const published = registry.get("one")!;
  (published.run as any).title = "changed";
  assert.equal(registry.get("one")?.run.title, "Title one");
});

test("rejects duplicate additions and changes to unknown runs", () => {
  const registry = new SubagentRegistry();
  registry.add(monitored("one"));
  assert.throws(() => registry.add(monitored("one")), /duplicate/i);
  assert.throws(() => registry.update(monitored("missing")), /unknown/i);
  assert.throws(() => registry.remove("missing"), /unknown/i);
});

initTheme("dark", false);

const plainTheme: any = {
  fg: (_color: string, text: string) => text,
  bg: (_color: string, text: string) => text,
  bold: (text: string) => text,
  italic: (text: string) => text,
  strikethrough: (text: string) => text,
};

const ansiTheme: any = {
  ...plainTheme,
  fg: (_color: string, text: string) => `\x1b[31m${text}\x1b[39m`,
};

function footerContext(): any {
  return {
    cwd: "/tmp/project",
    model: { provider: "fake", id: "parent" },
    thinkingLevel: "medium",
    sessionManager: { getEntries: () => [], getCwd: () => "/tmp/project", getSessionName: () => undefined },
    getContextUsage: () => ({ tokens: 20, contextWindow: 100, percent: 20 }),
  };
}

function footerData(): any {
  return {
    getGitBranch: () => "main",
    getExtensionStatuses: () => new Map(),
    getAvailableProviderCount: () => 1,
    onBranchChange: () => () => {},
  };
}

function footerDataWithStatuses(statuses: readonly string[]): any {
  return {
    ...footerData(),
    getExtensionStatuses: () => new Map(statuses.map((status, index) => [`status-${index}`, status])),
  };
}

function footerTui(): any {
  return {
    requestRender() {},
    setFocus(value: any) { this.focused = value; },
    terminal: { rows: 24, columns: 80 },
  };
}

function child(runId: string, state = "running"): any {
  const value = monitored(runId, state);
  value.run.title = `Child ${runId}`;
  value.run.attempts = [{
    number: 1,
    state,
    activity: [],
    messages: [],
    usage: { inputTokens: 12, outputTokens: 7, contextTokens: 40 },
    stderr: "",
    exitCode: state === "running" ? null : 0,
  }];
  return value;
}

test("renders standard footer rows before at most three subagents with title and usage", () => {
  const registry = new SubagentRegistry();
  for (const runId of ["one", "two", "three", "four"]) {
    const run = child(runId);
    run.run.startedAt = Date.now();
    registry.add(run);
  }
  const footer = new AgentFooter(
    footerTui(),
    ansiTheme,
    footerDataWithStatuses(["MCP Servers: context7", "ponytail: full"]),
    registry,
    footerContext(),
  );

  const initial = footer.render(120);
  assert.match(initial[0], /^\x1b\[31m\/tmp\/project \(main\)/);
  assert.match(initial[1], /20\.0%\/100/);
  assert.match(initial[1], /\(fake\) parent • medium/);
  assert.match(initial[2], /MCP Servers: context7.*ponytail: full/);
  assert.match(initial[3], /○ subagent 1.*Child one.*↑12.*↓7.*ctx 40/);
  assert.match(initial[4], /○ subagent 2.*Child two.*↑12.*↓7.*ctx 40/);
  assert.match(initial[5], /○ subagent 3.*Child three.*↑12.*↓7.*ctx 40/);
  assert.doesNotMatch(initial.join("\n"), /orchestrator|Child four|#1|›/);
  assert.ok(initial.some((line) => line.includes("\x1b[31m")));

  for (const width of [1, 20, 32, 120]) {
    for (const line of footer.render(width)) assert.ok(visibleWidth(line) <= width, `${line} > ${width}`);
  }
  footer.dispose();
});

test("keeps subagent usage visible when a task title is too long", () => {
  const registry = new SubagentRegistry();
  const run = child("long-title");
  run.run.title = "Inspect a deliberately long task title that cannot fit";
  run.run.startedAt = Date.now();
  registry.add(run);
  const footer = new AgentFooter(footerTui(), plainTheme, footerData(), registry, footerContext());

  const row = footer.render(40).find((line) => /subagent 1/.test(line))!;
  assert.match(row, /○ subagent 1.*↑12.*↓7.*ctx 40/);
  assert.ok(visibleWidth(row) <= 40);
  footer.dispose();
});

test("scrolls vertically through four children with bounded Up/Down and ignores Left/Right", () => {
  const registry = new SubagentRegistry();
  for (const runId of ["one", "two", "three", "four"]) registry.add(child(runId));
  const footer = new AgentFooter(footerTui(), plainTheme, footerData(), registry, footerContext());

  const down = "\x1b[B";
  const up = "\x1b[A";
  for (let index = 0; index < 4; index++) footer.handleInput(down);
  const atEnd = footer.render(120);
  assert.match(atEnd.join("\n"), /○ subagent 4.*Child four/);
  assert.doesNotMatch(atEnd.join("\n"), /Child one|›/);
  assert.ok(atEnd.filter((line) => /subagent/.test(line)).every((line) => line.startsWith("○ subagent ")));
  assert.equal(atEnd.filter((line) => /subagent/.test(line)).length, 3);

  const endSelection = atEnd.find((line) => /Child four/.test(line));
  footer.handleInput("\x1b[D");
  footer.handleInput("\x1b[C");
  assert.equal(footer.render(120).find((line) => /Child four/.test(line)), endSelection);
  footer.handleInput(down);
  assert.equal(footer.render(120).find((line) => /Child four/.test(line)), endSelection);

  footer.handleInput(up);
  const afterUp = footer.render(120).join("\n");
  assert.match(afterUp, /Child three/);
  assert.doesNotMatch(afterUp, /Child one/);
  for (let index = 0; index < 3; index++) footer.handleInput(up);
  const atStart = footer.render(120).join("\n");
  assert.match(atStart, /subagent 1.*Child one/);
  assert.doesNotMatch(atStart, /Child four/);
  footer.handleInput(up);
  footer.handleInput("\x1b[D");
  footer.handleInput("\x1b[C");
  assert.equal(footer.render(120).join("\n"), atStart);

  footer.dispose();
});

test("keeps the fallback child selected after removing the selected and preceding children", () => {
  const registry = new SubagentRegistry();
  for (const runId of ["one", "two", "three", "four"]) registry.add(child(runId));
  const footer = new AgentFooter(footerTui(), plainTheme, footerData(), registry, footerContext());
  footer.focus();

  footer.handleInput("\x1b[B");
  assert.match(footer.render(120).find((line) => /^◉ subagent/.test(line))!, /Child two/);

  registry.remove("two");
  assert.match(footer.render(120).find((line) => /^◉ subagent/.test(line))!, /Child three/);
  registry.remove("one");
  assert.match(footer.render(120).find((line) => /^◉ subagent/.test(line))!, /Child three/);

  footer.dispose();
});

test("marks the focused selected row without changing its state", () => {
  const registry = new SubagentRegistry();
  registry.add(child("one"));
  const footer = new AgentFooter(footerTui(), plainTheme, footerData(), registry, footerContext());

  footer.handleInput("\x1b[B");
  const unfocused = footer.render(80).find((line) => /Child one/.test(line))!;
  footer.focus();
  const focused = footer.render(80).find((line) => /Child one/.test(line))!;

  assert.notEqual(focused, unfocused);
  assert.match(unfocused, /^○ subagent 1/);
  assert.match(focused, /^◉ subagent 1/);

  footer.blur();
  const blurred = footer.render(80).find((line) => /Child one/.test(line))!;
  assert.match(blurred, /^○ subagent 1/);
  assert.doesNotMatch(blurred, /◉|›/);
  footer.dispose();
});

test("returns read-only navigation actions", () => {
  const registry = new SubagentRegistry();
  for (const runId of ["one", "two", "three", "four"]) registry.add(child(runId));
  const footer = new AgentFooter(footerTui(), plainTheme, footerData(), registry, footerContext());
  assert.deepEqual(footer.handleInput("\r"), { type: "openOrchestrator" });
  for (let index = 0; index < 4; index++) footer.handleInput("\x1b[B");
  assert.equal(footer.handleInput("\r").type, "openChild");
  assert.equal(footer.handleInput("\x1b").type, "focusEditor");
  footer.dispose();
});

test("sanitizes legacy child titles before rendering footer rows", () => {
  const registry = new SubagentRegistry();
  const run = child("unsafe");
  run.run.title = "\u001b[31mInspect\n\tAPI\u001b[0m";
  registry.add(run);
  const footer = new AgentFooter(footerTui(), plainTheme, footerData(), registry, footerContext());
  const lines = footer.render(120);
  assert.match(lines.join("\n"), /Inspect API/);
  assert.ok(lines.every((line) => !line.includes("\u001b") && !line.includes("\n")));
  footer.dispose();
});

test("labels every visible child with its subagent number", () => {
  const registry = new SubagentRegistry();
  registry.add(child("one"));
  registry.add(child("two"));
  const footer = new AgentFooter(footerTui(), plainTheme, footerData(), registry, footerContext());

  const text = footer.render(120).join("\n");
  assert.match(text, /subagent 1.*Child one/);
  assert.match(text, /subagent 2.*Child two/);
  footer.dispose();
});

test("keeps project, statistics, model, and sorted extension statuses on dedicated rows", () => {
  const registry = new SubagentRegistry();
  const data = {
    ...footerData(),
    getExtensionStatuses: () => new Map([["z-status", "alpha"], ["a-status", "omega"]]),
  };
  const footer = new AgentFooter(footerTui(), plainTheme, data, registry, footerContext());
  const lines = footer.render(120);
  assert.equal(lines[0], "/tmp/project (main)");
  assert.match(lines[1], /^20\.0%\/100\s+\(fake\) parent • medium$/);
  assert.equal(lines[2], "omega alpha");
  footer.dispose();
});

test("keeps the branch visible when the project path is too long", () => {
  const registry = new SubagentRegistry();
  const context = {
    ...footerContext(),
    cwd: "/tmp/a/very/long/project/path",
    sessionManager: {
      ...footerContext().sessionManager,
      getCwd: () => "/tmp/a/very/long/project/path",
    },
  };
  const footer = new AgentFooter(footerTui(), plainTheme, footerData(), registry, context);

  assert.match(footer.render(16)[0], /\(main\)$/);
  assert.match(footer.render(4)[0], /main/);
  footer.dispose();
});

test("shows parent process usage in the statistics row", () => {
  const context = {
    ...footerContext(),
    sessionManager: {
      getEntries: () => [{
        type: "message",
        message: {
          role: "assistant",
          usage: { input: 12, output: 7, cacheRead: 30, cacheWrite: 4 },
        },
      }],
      getCwd: () => "/tmp/project",
      getSessionName: () => undefined,
    },
  };
  const registry = new SubagentRegistry();
  const footer = new AgentFooter(footerTui(), plainTheme, footerData(), registry, context);
  const lines = footer.render(120);
  assert.match(lines[1], /↑12.*↓7.*R30.*W4.*CH65\.2%/);
  footer.dispose();
});

function baseEditor(options: { line?: number; col?: number; autocomplete?: boolean; cursor?: boolean } = {}): any {
  const calls: string[] = [];
  let focused: any;
  const tui = { setFocus(value: any) { focused = value; }, requestRender() {} };
  const base = {
    tui,
    focused: options.cursor ?? true,
    actionHandlers: new Map([["app.clear", () => calls.push("clear")]]),
    onEscape: () => calls.push("escape"),
    onCtrlD: () => calls.push("ctrl-d"),
    onPasteImage: () => calls.push("paste-image"),
    onExtensionShortcut: () => false,
    getLines: () => ["prompt", "last line"],
    getCursor: () => ({ line: options.line ?? 1, col: options.col ?? 4 }),
    getPaddingX: () => 0,
    isShowingAutocomplete: () => options.autocomplete ?? false,
    render: () => ["editor"],
    handleInput(data: string) { calls.push(data); },
    invalidate() {},
    getText: () => "prompt",
    setText() {},
  };
  (base as any).calls = calls;
  (base as any).getFocused = () => focused;
  return base;
}

test("moves focus to the footer only at the final visual line", () => {
  const registry = new SubagentRegistry();
  registry.add(child("one"));
  const footerTuiInstance = footerTui();
  const footer = new AgentFooter(footerTuiInstance, plainTheme, footerData(), registry, footerContext());
  const base = baseEditor();
  const actions: any[] = [];
  const editor = createAgentNavigationEditor(base, footer, registry, (action) => actions.push(action));
  editor.render(20);
  editor.handleInput("\x1b[B");
  assert.equal(footer.isFocused(), true);
  assert.equal(footerTuiInstance.focused, undefined);
  assert.deepEqual(base.calls, []);

  footer.handleInput("\x1b");
  assert.equal(footer.isFocused(), false);
  assert.equal(actions.at(-1).type, "focusEditor");
  assert.equal(footerTuiInstance.focused, editor);
  footer.dispose();
});

test("returns printable input to the editor after footer focus", () => {
  const registry = new SubagentRegistry();
  registry.add(child("one"));
  const footer = new AgentFooter(footerTui(), plainTheme, footerData(), registry, footerContext());
  const base = baseEditor();
  const editor = createAgentNavigationEditor(base, footer, registry, () => {});

  footer.focus();
  editor.handleInput("a");

  assert.equal(footer.isFocused(), false);
  assert.deepEqual(base.calls, ["a"]);
  footer.dispose();
});

test("preserves autocomplete, unknown-editor, and base keybinding behavior", () => {
  const registry = new SubagentRegistry();
  registry.add(child("one"));
  const footer = new AgentFooter(footerTui(), plainTheme, footerData(), registry, footerContext());
  const autocomplete = baseEditor({ autocomplete: true });
  const wrappedAutocomplete = createAgentNavigationEditor(autocomplete, footer, registry, () => {});
  wrappedAutocomplete.render(20);
  wrappedAutocomplete.handleInput("\x1b[B");
  assert.deepEqual(autocomplete.calls, ["\x1b[B"]);

  const unknown = { ...baseEditor(), getLines: undefined, getCursor: undefined, getPaddingX: undefined };
  const wrappedUnknown = createAgentNavigationEditor(unknown, footer, registry, () => {});
  wrappedUnknown.render(20);
  wrappedUnknown.handleInput("\x1b[B");
  assert.deepEqual(unknown.calls, ["\x1b[B"]);
  assert.equal((wrappedUnknown as any).actionHandlers, unknown.actionHandlers);
  assert.equal((wrappedUnknown as any).onEscape, unknown.onEscape);

  const shortcutBase = baseEditor();
  const shortcutEditor = createAgentNavigationEditor(shortcutBase, footer, registry, () => {});
  shortcutEditor.render(20);
  shortcutEditor.handleInput("\x1b[B");
  shortcutEditor.handleInput("\x03");
  assert.deepEqual(shortcutBase.calls, ["\x03"]);
  footer.dispose();
});

test("forwards editor submission state and action handlers through the decorator", () => {
  const registry = new SubagentRegistry();
  const footer = new AgentFooter(footerTui(), plainTheme, footerData(), registry, footerContext());
  const base: any = baseEditor();
  base.disableSubmit = true;
  base.onAction = (action: string, handler: () => void) => base.actionHandlers.set(action, handler);
  const wrapped: any = createAgentNavigationEditor(base, footer, registry, () => {});

  assert.equal(wrapped.disableSubmit, true);
  wrapped.disableSubmit = false;
  assert.equal(base.disableSubmit, false);
  const handlers = new Map([["app.exit", () => {}]]);
  wrapped.actionHandlers = handlers;
  assert.equal(base.actionHandlers, handlers);
  wrapped.onAction("app.exit", () => {});
  assert.equal(base.actionHandlers.has("app.exit"), true);
  const escape = () => {};
  delete base.onEscape;
  wrapped.onEscape = escape;
  assert.equal(base.onEscape, escape);
  wrapped.focused = false;
  assert.equal(base.focused, false);
  footer.dispose();
});

test("retains focus state for an editor that is not itself Focusable", () => {
  const registry = new SubagentRegistry();
  const footer = new AgentFooter(footerTui(), plainTheme, footerData(), registry, footerContext());
  const base: any = baseEditor();
  delete base.focused;
  const wrapped = createAgentNavigationEditor(base, footer, registry, () => {});

  wrapped.focused = true;
  assert.equal(wrapped.focused, true);
  wrapped.focused = false;
  assert.equal(wrapped.focused, false);
  footer.dispose();
});

test("returns focus through the footer TUI without requiring a private editor field", () => {
  const registry = new SubagentRegistry();
  const tui = footerTui();
  const footer = new AgentFooter(tui, plainTheme, footerData(), registry, footerContext());
  const base: any = baseEditor();
  delete base.tui;
  const editor = createAgentNavigationEditor(base, footer, registry, () => {});

  footer.focus();
  footer.handleInput("\x1b");
  assert.equal(tui.focused, editor);
  footer.dispose();
});

test("detects the cursor's last visual line without cursor methods fallback", () => {
  const final = baseEditor();
  assert.equal(isCursorOnLastVisualLine(final, 20), true);
  assert.equal(isCursorOnLastVisualLine(baseEditor({ line: 0 }), 20), false);
  assert.equal(isCursorOnLastVisualLine(baseEditor({ col: 0 }), 20), true);
  assert.equal(isCursorOnLastVisualLine({ getLines: () => ["x"] } as any, 20), false);
});

async function sessionFile(runId: string, messages: readonly any[]): Promise<{ directory: string; file: string }> {
  const directory = await mkdtemp("/tmp/pi-child-view-");
  const sessionId = `session-${runId}`;
  const file = `${directory}/2026_${sessionId}.jsonl`;
  const header = { type: "session", version: 3, id: sessionId, timestamp: new Date().toISOString(), cwd: "/tmp/project" };
  let parentId: string | null = null;
  const entries = [JSON.stringify(header)];
  messages.forEach((message, index) => {
    const id = `entry-${index}`;
    entries.push(JSON.stringify({ type: "message", id, parentId, timestamp: new Date().toISOString(), message }));
    parentId = id;
  });
  await writeFile(file, entries.join("\n") + "\n");
  return { directory, file };
}

function userMessage(text: string): any {
  return { role: "user", content: text, timestamp: 1 };
}

function assistantMessage(text: string): any {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    api: "openai-responses",
    provider: "fake",
    model: "fake",
    usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
    stopReason: "stop",
    timestamp: 2,
  };
}

function toolResultMessage(toolCallId: string, text: string, timestamp: number): any {
  return {
    role: "toolResult",
    toolCallId,
    toolName: "custom-tool",
    content: [{ type: "text", text }],
    isError: false,
    timestamp,
  };
}

function toolCallMessage(toolCallId: string, args: Record<string, unknown>): any {
  return {
    ...assistantMessage(""),
    content: [{ type: "toolCall", id: toolCallId, name: "custom-tool", arguments: args }],
    timestamp: 3,
  };
}

test("renders completed messages, current deltas, and retry attempts read-only", async () => {
  const messages = [userMessage("inspect"), assistantMessage("completed answer")];
  const session = await sessionFile("view", messages);
  const registry = new SubagentRegistry();
  const run = child("view");
  run.run.attempts[0].messages = messages;
  run.sessions = [{ attempt: 1, directory: session.directory, file: session.file, partialText: "live answer", partialThinking: "live thinking" }];
  registry.add(run);
  const footer = new AgentFooter(footerTui(), plainTheme, footerData(), registry, footerContext());
  const exits: any[] = [];
  const view = new ChildSessionView(footerTui(), plainTheme, footer, registry, run, (exit) => exits.push(exit));
  await view.refresh();
  const text = view.render(80).join("\n");
  assert.match(text, /inspect/);
  assert.match(text, /completed answer/);
  assert.match(text, /live answer/);
  assert.match(text, /live thinking/);
  assert.equal((view as any).onSubmit, undefined);
  view.handleInput("\x1b");
  assert.deepEqual(exits, [{ type: "orchestrator" }]);
  view.dispose();
  footer.dispose();
  await rm(session.directory, { recursive: true, force: true });
});

test("prefers the authoritative runtime message over stale persisted content", async () => {
  const persisted = assistantMessage("persisted content");
  const session = await sessionFile("authoritative", [persisted]);
  const authoritative = { ...persisted, content: [{ type: "text", text: "authoritative content" }] };
  const registry = new SubagentRegistry();
  const run = child("authoritative");
  run.run.attempts[0].messages = [authoritative];
  run.sessions = [{ attempt: 1, directory: session.directory, file: session.file, partialText: "", partialThinking: "" }];
  registry.add(run);
  const footer = new AgentFooter(footerTui(), plainTheme, footerData(), registry, footerContext());
  const view = new ChildSessionView(footerTui(), plainTheme, footer, registry, run, () => {});
  await view.refresh();
  const text = view.render(80).join("\n");
  assert.match(text, /authoritative content/);
  assert.doesNotMatch(text, /persisted content/);
  view.dispose();
  footer.dispose();
  await rm(session.directory, { recursive: true, force: true });
});

test("renders pending tool arguments and updates the same call with its result", () => {
  const call = toolCallMessage("call-1", { path: "target.txt" });
  const pendingRun = child("tool-transcript");
  pendingRun.run.attempts[0].messages = [call];
  const registry = new SubagentRegistry();
  registry.add(pendingRun);
  const footer = new AgentFooter(footerTui(), plainTheme, footerData(), registry, footerContext());
  const view = new ChildSessionView(footerTui(), plainTheme, footer, registry, pendingRun, () => {});

  const pendingText = view.render(120).join("\n");
  assert.match(pendingText, /target\.txt/);
  assert.doesNotMatch(pendingText, /tool output/);

  const completedRun = {
    ...pendingRun,
    run: {
      ...pendingRun.run,
      state: "succeeded",
      endedAt: 4,
      attempts: [{ ...pendingRun.run.attempts[0], state: "succeeded", messages: [call, toolResultMessage("call-1", "tool output", 5)] }],
    },
  };
  view.setRun(completedRun);
  const completedText = view.render(120).join("\n");
  assert.match(completedText, /target\.txt/);
  assert.match(completedText, /tool output/);

  view.dispose();
  footer.dispose();
});

test("finalizes unmatched tool calls on failed attempts with their diagnostic", () => {
  const registry = new SubagentRegistry();
  const run = child("failed-tool", "failed");
  run.run.attempts[0].messages = [toolCallMessage("failed-call", { path: "missing.txt" })];
  run.run.attempts[0].error = "provider stopped before the tool result";
  registry.add(run);
  const footer = new AgentFooter(footerTui(), plainTheme, footerData(), registry, footerContext());
  const view = new ChildSessionView(footerTui(), plainTheme, footer, registry, run, () => {});

  const text = view.render(120).join("\n");
  assert.match(text, /provider stopped before the tool result/);

  view.dispose();
  footer.dispose();
});

test("finalizes unmatched tool calls on cancelled attempts with the terminal state", () => {
  const registry = new SubagentRegistry();
  const run = child("cancelled-tool", "cancelled");
  run.run.attempts[0].messages = [toolCallMessage("cancelled-call", { path: "cancelled.txt" })];
  run.run.attempts[0].exitCode = null;
  registry.add(run);
  const footer = new AgentFooter(footerTui(), plainTheme, footerData(), registry, footerContext());
  const view = new ChildSessionView(footerTui(), plainTheme, footer, registry, run, () => {});

  const text = view.render(120).join("\n");
  assert.match(text, /Attempt 1 cancelled/);

  view.dispose();
  footer.dispose();
});

test("matches same-millisecond messages by occurrence and tool call identity", async () => {
  const persistedFirst = { ...assistantMessage("persisted first"), timestamp: 100 };
  const persistedSecond = { ...assistantMessage("persisted second"), timestamp: 100 };
  const persistedResult = toolResultMessage("call-1", "persisted result", 100);
  const session = await sessionFile("same-millisecond", [persistedFirst, persistedSecond, persistedResult]);
  const liveFirst = { ...assistantMessage("live first"), timestamp: 100 };
  const liveSecond = { ...assistantMessage("live second"), timestamp: 100 };
  const liveResult = toolResultMessage("call-1", "live result", 101);
  const registry = new SubagentRegistry();
  const run = child("same-millisecond");
  run.run.attempts[0].messages = [liveFirst, liveSecond, liveResult];
  run.sessions = [{ attempt: 1, directory: session.directory, file: session.file, partialText: "", partialThinking: "" }];
  registry.add(run);
  const footer = new AgentFooter(footerTui(), plainTheme, footerData(), registry, footerContext());
  const view = new ChildSessionView(footerTui(), plainTheme, footer, registry, run, () => {});
  await view.refresh();

  const text = view.render(120).join("\n");
  assert.match(text, /live first/);
  assert.match(text, /live second/);
  assert.match(text, /live result/);
  assert.doesNotMatch(text, /persisted first|persisted second|persisted result/);

  view.dispose();
  footer.dispose();
  await rm(session.directory, { recursive: true, force: true });
});

test("separates retry attempts and appends deltas only to the current attempt", () => {
  const registry = new SubagentRegistry();
  const run = child("retry");
  run.run.state = "retrying";
  run.run.attempts = [
    { ...run.run.attempts[0], state: "failed", messages: [assistantMessage("first attempt")], usage: { inputTokens: 3, outputTokens: 2, contextTokens: 5 } },
    { ...run.run.attempts[0], number: 2, state: "running", messages: [assistantMessage("second attempt")], usage: { inputTokens: 4, outputTokens: 3, contextTokens: 6 } },
  ];
  run.sessions = [
    { attempt: 1, directory: "/tmp/attempt-one", partialText: "stale first delta", partialThinking: "" },
    { attempt: 2, directory: "/tmp/attempt-two", partialText: "current delta", partialThinking: "" },
  ];
  registry.add(run);
  const tui: any = { requestRender() {}, setFocus() {}, terminal: { rows: 24, columns: 80 } };
  const footer = new AgentFooter(tui, plainTheme, footerData(), registry, footerContext());
  const view = new ChildSessionView(tui, plainTheme, footer, registry, run, () => {});
  const text = view.render(120).join("\n");
  assert.match(text, /first attempt/);
  assert.match(text, /attempt 2/i);
  assert.match(text, /current delta/);
  assert.doesNotMatch(text, /stale first delta/);
  view.dispose();
  footer.dispose();
});

test("keeps the final frame while switching children, scrolling, and handling read errors", async () => {
  const session = await sessionFile("switch", [assistantMessage("final answer")]);
  const registry = new SubagentRegistry();
  const first = child("switch", "succeeded");
  first.run.endedAt = 2_000;
  first.run.attempts[0].messages = [assistantMessage("final answer")];
  first.sessions = [{ attempt: 1, directory: session.directory, file: session.file, partialText: "", partialThinking: "" }];
  const second = child("other");
  registry.add(first);
  registry.add(second);
  const tui: any = { requestRender() {}, setFocus(value: any) { focused = value; }, terminal: { rows: 6, columns: 80 } };
  let focused: any;
  const footer = new AgentFooter(tui, plainTheme, footerData(), registry, footerContext());
  const exits: any[] = [];
  const view = new ChildSessionView(tui, plainTheme, footer, registry, first, (exit) => exits.push(exit));
  await view.refresh();
  const frame = view.render(80).join("\n");
  await rm(session.file);
  await view.refresh();
  assert.match(view.render(80).join("\n"), /final answer/);
  view.handleFooterAction({ type: "openChild", run: second });
  assert.match(view.render(80).join("\n"), /Child other/);
  for (let index = 0; index < 20 && !footer.isFocused(); index++) view.handleInput("\x1b[B");
  assert.equal(footer.isFocused(), true);
  view.handleFooterAction({ type: "openOrchestrator" });
  assert.deepEqual(exits, [{ type: "orchestrator" }]);
  assert.match(frame, /final answer/);
  view.dispose();
  footer.dispose();
  await rm(session.directory, { recursive: true, force: true });
});

test("clears logical footer focus when a child view is disposed", () => {
  const registry = new SubagentRegistry();
  const run = child("dispose");
  registry.add(run);
  const footer = new AgentFooter(footerTui(), plainTheme, footerData(), registry, footerContext());
  const tui: any = { requestRender() {}, setFocus() {}, terminal: { rows: 24, columns: 80 } };
  const view = new ChildSessionView(tui, plainTheme, footer, registry, run, () => {});
  footer.focus();
  view.dispose();
  assert.equal(footer.isFocused(), false);
  footer.dispose();
});

test("retains the last rendered child frame when a later session read fails", async () => {
  const registry = new SubagentRegistry();
  const running = child("frame");
  running.sessions = [{ attempt: 1, directory: "/tmp/frame", file: "/tmp/frame/missing.jsonl", partialText: "live frame", partialThinking: "" }];
  registry.add(running);
  const footer = new AgentFooter(footerTui(), plainTheme, footerData(), registry, footerContext());
  const tui: any = { requestRender() {}, setFocus() {}, terminal: { rows: 24, columns: 80 } };
  const view = new ChildSessionView(tui, plainTheme, footer, registry, running, () => {});
  assert.match(view.render(80).join("\n"), /live frame/);

  const finished = {
    ...running,
    run: {
      ...running.run,
      state: "succeeded",
      attempts: [{ ...running.run.attempts[0], state: "succeeded" }],
      endedAt: 2,
    },
    sessions: [{ ...running.sessions[0], partialText: "", partialThinking: "" }],
  };
  view.setRun(finished);
  await view.refresh();
  assert.match(view.render(80).join("\n"), /live frame/);
  view.dispose();
  footer.dispose();
});

test("uses runtime messages instead of an old frame when session reading fails", async () => {
  const registry = new SubagentRegistry();
  const running = child("message-after-error");
  running.sessions = [{ attempt: 1, directory: "/tmp/message-after-error", file: "/tmp/message-after-error/missing.jsonl", partialText: "stale live", partialThinking: "" }];
  registry.add(running);
  const footer = new AgentFooter(footerTui(), plainTheme, footerData(), registry, footerContext());
  const tui: any = { requestRender() {}, setFocus() {}, terminal: { rows: 24, columns: 80 } };
  const view = new ChildSessionView(tui, plainTheme, footer, registry, running, () => {});
  assert.match(view.render(80).join("\n"), /stale live/);

  const finished = {
    ...running,
    run: {
      ...running.run,
      state: "succeeded",
      attempts: [{ ...running.run.attempts[0], state: "succeeded", messages: [assistantMessage("authoritative")] }],
      endedAt: 2,
    },
    sessions: [{ ...running.sessions[0], partialText: "", partialThinking: "" }],
  };
  view.setRun(finished);
  await view.refresh();
  const text = view.render(80).join("\n");
  assert.match(text, /authoritative/);
  assert.doesNotMatch(text, /stale live/);
  view.dispose();
  footer.dispose();
});

test("renders a changed viewport after scrolling a long child transcript", () => {
  const registry = new SubagentRegistry();
  const run = child("scroll");
  run.run.attempts[0].messages = Array.from({ length: 8 }, (_, index) => assistantMessage(`line-${index}`));
  registry.add(run);
  const tui: any = { requestRender() {}, setFocus() {}, terminal: { rows: 6, columns: 80 } };
  const footer = new AgentFooter(tui, plainTheme, footerData(), registry, footerContext());
  const view = new ChildSessionView(tui, plainTheme, footer, registry, run, () => {});
  const bottom = view.render(80).join("\n");
  view.handleInput("\x1b[A");
  const above = view.render(80).join("\n");
  assert.notEqual(above, bottom);
  view.dispose();
  footer.dispose();
});

test("reserves the rendered footer and header before scrolling narrow child transcripts", () => {
  for (const statuses of [[], ["status one"], ["status one", "status two", "status three", "status four", "status five"]]) {
    for (const width of [20, 32]) {
      const registry = new SubagentRegistry();
      const run = child(`viewport-${statuses.length}-${width}`);
      run.run.attempts[0].messages = Array.from({ length: 12 }, (_, index) =>
        assistantMessage(index === 11 ? "final message" : `message-${index}`),
      );
      registry.add(run);
      const tui: any = { requestRender() {}, setFocus() {}, terminal: { rows: 10, columns: width } };
      const footer = new AgentFooter(tui, plainTheme, footerDataWithStatuses(statuses), registry, footerContext());
      const view = new ChildSessionView(tui, plainTheme, footer, registry, run, () => {});

      const initial = view.render(width);
      const footerHeight = footer.render(width).length;
      const headerHeight = (view as any).header.render(width).length;
      assert.equal(
        (view as any).scroll.viewportHeight,
        Math.max(1, tui.terminal.rows - footerHeight - headerHeight),
      );
      assert.match(initial.join("\n"), /final message/);

      for (let index = 0; index < 20; index++) view.handleInput("\x1b[A");
      for (let index = 0; index < 20 && !footer.isFocused(); index++) view.handleInput("\x1b[B");
      assert.match(view.render(width).join("\n"), /final message/);

      view.dispose();
      footer.dispose();
    }
  }
});

test("advances running and retrying telemetry while active", () => {
  mock.timers.enable({ apis: ["Date", "setInterval"], now: 0 });
  try {
    let renders = 0;
    const tui: any = { requestRender() { renders++; }, terminal: { rows: 24, columns: 80 } };
    const registry = new SubagentRegistry();
    const run = child("timer");
    run.run.startedAt = 0;
    registry.add(run);
    const footer = new AgentFooter(tui, plainTheme, footerData(), registry, footerContext());
    footer.handleInput("\x1b[B");
    assert.match(footer.render(120).join("\n"), /0s/);
    const before = renders;
    mock.timers.tick(999);
    assert.equal(renders, before);
    mock.timers.tick(1);
    assert.equal(renders, before + 1);
    assert.match(footer.render(120).join("\n"), /1s/);

    registry.update({ ...run, run: { ...run.run, state: "retrying" } });
    const afterRetry = renders;
    mock.timers.tick(999);
    assert.equal(renders, afterRetry);
    mock.timers.tick(1);
    assert.equal(renders, afterRetry + 1);
    assert.match(footer.render(120).join("\n"), /2s/);

    footer.focus();
    footer.dispose();
    assert.equal(footer.isFocused(), false);
    const afterDispose = renders;
    mock.timers.tick(1_000);
    assert.equal(renders, afterDispose);
  } finally {
    mock.timers.reset();
  }
});

function integrationContext(): any {
  const state: any = { previousFactory: () => baseEditor(), footerFactory: undefined, editorFactory: undefined, component: undefined, done: undefined, customCalls: 0 };
  const tui = { requestRender() {}, setFocus(value: any) { state.focused = value; }, terminal: { rows: 24, columns: 80 } };
  state.tui = tui;
  state.ui = {
    getEditorComponent: () => state.previousFactory,
    setEditorComponent(factory: any) {
      state.editorFactory = factory;
      state.editor = factory ? factory(tui, plainTheme, {}) : undefined;
    },
    setFooter(factory: any) {
      state.footerFactory = factory;
      state.footer = factory ? factory(tui, plainTheme, footerData()) : undefined;
    },
    custom(factory: any) {
      state.customCalls++;
      return new Promise((resolve: any, reject: any) => {
        try {
          state.component = factory(tui, plainTheme, {}, (result: any) => {
            state.done = undefined;
            resolve(result);
          });
        } catch (error) {
          reject(error);
        }
      });
    },
    notify() {},
  };
  state.ctx = { ...footerContext(), mode: "tui", ui: state.ui };
  return state;
}

test("installs one footer and wraps the configured editor, then restores both", () => {
  const state = integrationContext();
  const handle = installSubagentUI(state.ctx);
  assert.equal(typeof state.footerFactory, "function");
  assert.equal(typeof state.editorFactory, "function");
  const wrapped = state.editorFactory(state.tui, plainTheme, {});
  assert.notEqual(wrapped, state.previousFactory());
  const run = child("wired");
  handle.onMonitorEvent({ type: "started", run });
  assert.deepEqual(handle.registry.list().map((value) => value.runId), ["wired"]);
  handle.onMonitorEvent({ type: "finished", run: { ...run, run: { ...run.run, state: "succeeded", endedAt: 2 } } });
  assert.deepEqual(handle.registry.list(), []);
  handle.dispose();
  assert.equal(state.editorFactory, state.previousFactory);
  assert.equal(state.footerFactory, undefined);
});

test("opens a child view and closes it through the orchestrator action", async () => {
  const state = integrationContext();
  const handle = installSubagentUI(state.ctx);
  const run = child("open");
  handle.onMonitorEvent({ type: "started", run });
  const pending = handle.openChild(run);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(state.customCalls, 1);
  assert.ok(state.component instanceof ChildSessionView);
  (state.component as ChildSessionView).handleFooterAction({ type: "openOrchestrator" });
  await pending;
  handle.dispose();
});

test("uses the session cwd for pending and result-only tool components", async () => {
  const state = integrationContext();
  const sessionCwd = `${process.cwd()}-session`;
  assert.notEqual(sessionCwd, process.cwd());
  state.ctx.cwd = sessionCwd;
  const handle = installSubagentUI(state.ctx);
  const run = child("cwd");
  run.run.attempts[0].messages = [
    toolCallMessage("pending-call", { path: "relative.txt" }),
    toolResultMessage("result-only-call", "result" , 4),
  ];
  handle.onMonitorEvent({ type: "started", run });
  const pending = handle.openChild(run);
  try {
    await new Promise((resolve) => setImmediate(resolve));
    assert.ok(state.component instanceof ChildSessionView);
    const tools = (state.component as any).transcript.children.filter(
      (component: any) => component.constructor.name === "ToolExecutionComponent",
    );
    assert.equal(tools.length, 2);
    assert.ok(tools.every((component: any) => component.cwd === sessionCwd));
    (state.component as ChildSessionView).handleFooterAction({ type: "openOrchestrator" });
    await pending;
  } finally {
    handle.dispose();
  }
});

test("restores the UI when editor installation fails", () => {
  const state = integrationContext();
  const previousFactory = state.previousFactory;
  state.previousFactory = () => {
    throw new Error("editor unavailable");
  };
  assert.throws(() => installSubagentUI(state.ctx), /editor unavailable/);
  assert.equal(state.footerFactory, undefined);
  assert.equal(state.editorFactory, state.previousFactory);
  state.previousFactory = previousFactory;
});

test("attempts every UI cleanup even when editor restoration fails", () => {
  const state = integrationContext();
  const handle = installSubagentUI(state.ctx);
  const setEditorComponent = state.ui.setEditorComponent;
  state.ui.setEditorComponent = (factory: any) => {
    if (factory === state.previousFactory) throw new Error("editor restore unavailable");
    setEditorComponent(factory);
  };

  assert.throws(() => handle.dispose(), /editor restore unavailable/);
  assert.equal(state.footerFactory, undefined);
});

test("closes an active custom view during UI disposal", async () => {
  const state = integrationContext();
  const handle = installSubagentUI(state.ctx);
  const run = child("dispose-view");
  handle.onMonitorEvent({ type: "started", run });
  const pending = handle.openChild(run);
  await new Promise((resolve) => setImmediate(resolve));
  handle.dispose();
  await pending;
  assert.equal(state.footerFactory, undefined);
});

test("keeps an open child view on its final snapshot after navigation removal", async () => {
  const state = integrationContext();
  const handle = installSubagentUI(state.ctx);
  const run = child("finished");
  handle.onMonitorEvent({ type: "started", run });
  const pending = handle.openChild(run);
  await new Promise((resolve) => setImmediate(resolve));
  const finished = { ...run, run: { ...run.run, state: "succeeded", endedAt: 2 } };
  handle.onMonitorEvent({ type: "finished", run: finished });
  assert.match(state.component.render(80).join("\n"), /succeeded/);
  assert.deepEqual(handle.registry.list(), []);
  state.component.handleFooterAction({ type: "openOrchestrator" });
  await pending;
  handle.dispose();
});

test("reads completed v3 child messages and ignores malformed trailing JSONL", async () => {
  const directory = await mkdtemp("/tmp/pi-child-session-");
  const file = `${directory}/2026_session-1.jsonl`;
  const header = { type: "session", version: 3, id: "session-1", timestamp: new Date().toISOString(), cwd: "/tmp/project" };
  const user = userMessage("inspect");
  const assistant = assistantMessage("done");
  const lines = [
    header,
    { type: "message", id: "one", parentId: null, timestamp: new Date().toISOString(), message: user },
    { type: "message", id: "two", parentId: "one", timestamp: new Date().toISOString(), message: assistant },
  ].map((value) => JSON.stringify(value)).join("\n") + "\n{trailing";
  await writeFile(file, lines);
  try {
    const messages = await readChildSession({ attempt: 1, directory, file, partialText: "", partialThinking: "" });
    assert.deepEqual(messages.map((message: any) => message.role), ["user", "assistant"]);
    assert.equal((messages[1] as any).content[0].text, "done");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("returns no messages before discovery and propagates later session read errors", async () => {
  assert.deepEqual(await readChildSession({ attempt: 1, directory: "/tmp/missing", partialText: "", partialThinking: "" }), []);
  await assert.rejects(
    readChildSession({ attempt: 1, directory: "/tmp/missing", file: "/tmp/missing/session.jsonl", partialText: "", partialThinking: "" }),
  );
});

test("returns no messages for a zero-byte pending session without opening it", async () => {
  const directory = await mkdtemp("/tmp/pi-child-session-empty-");
  const file = `${directory}/2026_session-empty.jsonl`;
  await writeFile(file, "");
  try {
    assert.deepEqual(await readChildSession({ attempt: 1, directory, file, partialText: "", partialThinking: "" }), []);
    assert.equal((await stat(file)).size, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("does not recreate a removed session root during a pending read", async () => {
  const directory = await mkdtemp("/tmp/pi-child-session-race-");
  const file = `${directory}/2026_session-race.jsonl`;
  const header = {
    type: "session",
    version: 3,
    id: "session-race",
    timestamp: new Date().toISOString(),
    cwd: "/tmp/project",
  };
  const message = {
    type: "message",
    id: "one",
    parentId: null,
    timestamp: new Date().toISOString(),
    message: userMessage("inspect"),
  };
  await writeFile(file, [header, message].map((value) => JSON.stringify(value)).join("\n") + "\n");
  const originalStat = fsPromises.stat.bind(fsPromises);
  const statMock = mock.method(fsPromises as any, "stat", async (filePath: string) => {
    const metadata = await originalStat(filePath);
    await rm(directory, { recursive: true, force: true });
    return metadata;
  });
  try {
    assert.deepEqual(await readChildSession({ attempt: 1, directory, file, partialText: "", partialThinking: "" }), []);
    await assert.rejects(access(directory));
  } finally {
    statMock.mock.restore();
    await rm(directory, { recursive: true, force: true });
  }
});
