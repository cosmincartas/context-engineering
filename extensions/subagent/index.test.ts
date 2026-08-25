import assert from "node:assert/strict";
import { cp, mkdtemp, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

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
  const tools: any[] = [];
  const notifications: Array<{ message: string; level: string }> = [];
  const pi = {
    on(event: string, handler: typeof sessionStart) {
      assert.equal(event, "session_start");
      sessionStart = handler;
    },
    registerTool(tool: any) {
      tools.push(tool);
    },
  };
  const context = (mode: "tui" | "rpc" | "json" | "print") => ({
    mode,
    cwd: process.cwd(),
    model: { provider: "openai-codex", id: "parent" },
    thinkingLevel: "medium",
    modelRegistry: { getAvailable: () => [] },
    ui: {
      notify(message: string, level: string) {
        notifications.push({ message, level });
      },
    },
  });
  return {
    pi,
    tools,
    notifications,
    context,
    async start(mode: "tui" | "rpc" | "json" | "print") {
      assert.ok(sessionStart, "session_start handler was not registered");
      await sessionStart({}, context(mode));
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
  await tuiHarness.start("tui");
  assert.equal(tuiHarness.tools.length, 1);
});

test("registers closed sequential metadata for every bundled agent", async () => {
  const subagentExtension = await loadExtension();
  const testHarness = harness();
  subagentExtension(testHarness.pi);
  await testHarness.start("tui");
  const [tool] = testHarness.tools;

  assert.equal(tool.name, "subagent");
  assert.equal(tool.label, "Subagent");
  assert.equal(tool.executionMode, "sequential");
  assert.equal(tool.parameters.additionalProperties, false);
  assert.deepEqual(tool.parameters.required, ["agent", "task"]);
  assert.equal(tool.parameters.properties.agent.minLength, 1);
  assert.equal(tool.parameters.properties.task.minLength, 1);
  for (const text of [
    "scout", "Read-only codebase reconnaissance.",
    "worker", "Implement and verify requested coding tasks.",
    "oracle", "Read-only technical analysis and decision support.",
    "reviewer", "Read-only review of code changes.",
  ]) {
    assert.match(tool.description, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }

  const result = await tool.execute(
    "call",
    { agent: "missing", task: "inspect" },
    undefined,
    undefined,
    testHarness.context("tui"),
  );
  assert.match(result.content[0].text, /Unknown agent: missing/);
});

test("notifies the TUI and registers nothing when the bundled catalog fails", async () => {
  await loadExtension();
  const directory = await mkdtemp(path.join(os.tmpdir(), "pi-subagent-extension-"));
  try {
    for (const file of ["index.ts", "agents.ts", "runtime.ts", "package.json"]) {
      await cp(new URL(file, import.meta.url), path.join(directory, file));
    }
    await symlink(new URL("./node_modules/", import.meta.url), path.join(directory, "node_modules"));
    const agentsDirectory = path.join(directory, "agents");
    await cp(new URL("./agents/", import.meta.url), agentsDirectory, { recursive: true });
    await rm(path.join(agentsDirectory, "reviewer.md"));

    const subagentExtension = await loadExtension(new URL(`file://${path.join(directory, "index.ts")}`));
    const testHarness = harness();
    subagentExtension(testHarness.pi);
    await testHarness.start("tui");

    assert.equal(testHarness.tools.length, 0);
    assert.equal(testHarness.notifications.length, 1);
    assert.equal(testHarness.notifications[0].level, "error");
    assert.match(testHarness.notifications[0].message, /reviewer\.md/i);
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
      agent: "scout",
      task: "Inspect a deliberately long task description that must wrap on narrow terminals.",
      state,
      model: "openai-codex/gpt-5.6-luna",
      thinkingLevel: "medium",
      attempts: [
        {
          number: 1,
          state: state === "retrying" ? "failed" : state,
          activity: ["Fallback: mapped model unavailable; using parent model."],
          messages: [],
          stderr: "provider diagnostic output",
          exitCode: 1,
          error: "provider failed",
        },
      ],
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
    assert.match(text, /scout/i);
    assert.match(text, new RegExp(state, "i"));
  }
});

test("collapses activity to the newest ten items", async () => {
  const renderSubagentResult = (await loadModule()).renderSubagentResult;
  const fixture = renderFixture("running");
  fixture.details.attempts[0].activity = Array.from(
    { length: 12 },
    (_, index) => `activity-${index + 1}`,
  );

  const text = renderSubagentResult(
    fixture,
    { expanded: false, isPartial: true },
    plainTheme,
  ).render(120).join("\n");

  assert.equal(text.match(/activity-\d+/g)?.length, 10);
  assert.doesNotMatch(text, /activity-1(?:\D|$)|activity-2(?:\D|$)/);
  assert.match(text, /activity-3/);
  assert.match(text, /activity-12/);
});

test("expands task, attempts, warnings, tool calls, Markdown output, and diagnostics", async () => {
  const renderSubagentResult = (await loadModule()).renderSubagentResult;
  const fixture = renderFixture("succeeded");
  fixture.details.attempts = [
    fixture.details.attempts[0],
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
