import assert from "node:assert/strict";
import { initTheme, type Theme } from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";
import test from "node:test";

import { TaskStore, type Task } from "../state/index.ts";
import { handleWriteFailure, renderTaskWidget, TaskWidget } from "./index.ts";

const plainTheme = {
  fg(_color: string, text: string) {
    return text;
  },
  bold(text: string) {
    return text;
  },
} as Theme;

const tasks: readonly Task[] = [
  { id: "1", text: "Completed task", status: "completed" },
  { id: "2", text: "Active task", status: "active" },
  { id: "3", text: "Another active task", status: "active" },
  { id: "4", text: "Pending task", status: "pending" },
];

test("static task widget shows every status, identifier, text, summary, and unsaved marker", () => {
  const lines = renderTaskWidget(tasks, true, false, 0, plainTheme, 100);
  const output = lines.join("\n");

  assert.equal(lines[0], "● 4 tasks (1 completed, 2 active, 1 pending) [unsaved]");
  assert.match(output, /  ✓ #1 Completed task/);
  assert.match(output, /  ▪ #2 Active task/);
  assert.match(output, /  ▪ #3 Another active task/);
  assert.match(output, /  ▫ #4 Pending task/);

  const savedLines = renderTaskWidget(tasks, false, false, 0, plainTheme, 100);
  assert.equal(savedLines[0].includes("[unsaved]"), false);
});

test("static task widget renders multiline text with aligned continuation lines and safe tabs", () => {
  const lines = renderTaskWidget(
    [{ id: "7", text: "Role:\n\tWorker", status: "pending" }],
    false,
    false,
    0,
    plainTheme,
    100,
  );

  assert.deepEqual(lines.slice(1), ["  ▫ #7 Role:", "         Worker"]);
});

test("static task widget truncates every line to the supplied width", () => {
  const lines = renderTaskWidget(
    [{ id: "12", text: "A very long task that must be truncated", status: "pending" }],
    true,
    false,
    0,
    plainTheme,
    12,
  );

  assert.ok(lines.length > 0);
  assert.ok(lines.every((line) => visibleWidth(line) <= 12));
});

test("write failure choice prompts only in TUI and treats dismissal as cancellation", async () => {
  const calls: string[] = [];
  let selectedTitle = "";
  let selectedChoices: readonly string[] = [];
  const context = {
    mode: "tui",
    ui: {
      notify(message: string, level: string) {
        calls.push(`${level}:${message}`);
      },
      async select(title: string, choices: readonly string[]) {
        selectedTitle = title;
        selectedChoices = choices;
        calls.push("select");
        return "Continue in memory";
      },
    },
  } as any;

  assert.equal(await handleWriteFailure(context, "Failed to save tasks: disk full"), "continue");
  assert.deepEqual(calls, ["error:Failed to save tasks: disk full", "select"]);
  assert.equal(selectedTitle, "Task write failed");
  assert.deepEqual(selectedChoices, ["Continue in memory", "Cancel"]);

  context.ui.select = async () => {
    calls.push("select");
    return "Cancel";
  };
  calls.length = 0;
  assert.equal(await handleWriteFailure(context, "Failed to save tasks: read-only"), "cancel");
  assert.deepEqual(calls, [
    "error:Failed to save tasks: read-only",
    "select",
    "warning:Cancelled in-memory task changes; stored tasks may return when the session resumes.",
  ]);

  context.ui.select = async () => {
    calls.push("select");
    return undefined;
  };
  calls.length = 0;
  assert.equal(await handleWriteFailure(context, "Failed to save tasks: unavailable"), "cancel");
  assert.deepEqual(calls, [
    "error:Failed to save tasks: unavailable",
    "select",
    "warning:Cancelled in-memory task changes; stored tasks may return when the session resumes.",
  ]);
});

test("write failure choice retains memory without prompting outside TUI", async () => {
  for (const mode of ["rpc", "json", "print"] as const) {
    const calls: string[] = [];
    const context = {
      mode,
      ui: {
        notify() {
          calls.push("notify");
        },
        async select() {
          calls.push("select");
          return "Cancel";
        },
      },
    } as any;

    assert.equal(await handleWriteFailure(context, "Failed to save tasks: unavailable"), "continue");
    assert.deepEqual(calls, [], mode);
  }
});

test("task widget lifecycle refreshes, animates one active task, stops, and disposes cleanly", async () => {
  initTheme("dark");
  const store = await TaskStore.load("/workspace/example");
  await store.create("Active task");
  await store.update("1", { status: "active" });

  let registeredFactory: ((tui: { requestRender(): void }, theme: Theme) => {
    render(width: number): string[];
    invalidate(): void;
    dispose?(): void;
  }) | undefined;
  let widgetCalls = 0;
  let renderRequests = 0;
  const ui = {
    setWidget(_key: string, content: unknown) {
      widgetCalls += 1;
      if (typeof content === "function") registeredFactory = content as typeof registeredFactory;
    },
  } as any;

  const widget = new TaskWidget(ui, store);
  assert.equal(widgetCalls, 1);
  assert.ok(registeredFactory);
  const component = registeredFactory!({ requestRender: () => { renderRequests += 1; } }, plainTheme);

  widget.refresh();
  assert.match(component.render(100).join("\n"), /▪ #1 Active task/);
  const beforeAnimation = renderRequests;

  widget.setAgentRunning(true);
  assert.match(component.render(100).join("\n"), /⠋ #1 Active task/);
  await new Promise((resolve) => setTimeout(resolve, 180));
  assert.ok(renderRequests > beforeAnimation);

  widget.setAgentRunning(false);
  assert.match(component.render(100).join("\n"), /▪ #1 Active task/);
  const afterStop = renderRequests;
  await new Promise((resolve) => setTimeout(resolve, 180));
  assert.equal(renderRequests, afterStop);

  await store.update("1", { status: "completed" });
  widget.refresh();
  widget.setAgentRunning(true);
  const beforeCompletedWait = renderRequests;
  await new Promise((resolve) => setTimeout(resolve, 180));
  assert.equal(renderRequests, beforeCompletedWait);
  assert.match(component.render(100).join("\n"), /✓ #1 Active task/);

  widget.dispose();
  assert.equal(widgetCalls, 2);
  await new Promise((resolve) => setTimeout(resolve, 180));
  assert.equal(renderRequests, beforeCompletedWait);
});
