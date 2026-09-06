import assert from "node:assert/strict";
import { initTheme, type Theme } from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";
import test from "node:test";

import { TaskStore, type Task } from "../state/index.ts";
import {
  handleWriteFailure,
  renderTaskListResult,
  renderTaskResult,
  renderTaskWidget,
  showTaskList,
  TaskWidget,
} from "./index.ts";

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

async function taskStore(initialTasks: readonly Task[]): Promise<TaskStore> {
  const store = await TaskStore.load("/workspace/task-list-modal");
  for (const task of initialTasks) {
    await store.create(task.text);
    if (task.status !== "pending") await store.update(task.id, { status: task.status });
  }
  return store;
}

test("static task widget limits rows and reports hidden tasks without changing its summary", () => {
  const lines = renderTaskWidget(tasks, true, false, 0, plainTheme, 100);
  const output = lines.join("\n");

  assert.equal(lines[0], "● 4 tasks (1 completed, 2 active, 1 pending) [unsaved]");
  assert.match(output, /  ✓ #1 Completed task/);
  assert.match(output, /  ▪ #2 Active task/);
  assert.match(output, /  ▪ #3 Another active task/);
  assert.doesNotMatch(output, /  ▫ #4 Pending task/);
  assert.equal(lines.at(-1), "  1 more, run /tasks to see all");

  const savedLines = renderTaskWidget(tasks, false, false, 0, plainTheme, 100);
  assert.equal(savedLines[0].includes("[unsaved]"), false);
  assert.deepEqual(renderTaskWidget([], false, false, 0, plainTheme, 100), ["● 0 tasks (0 completed, 0 active, 0 pending)"]);
  assert.equal(renderTaskWidget(tasks.slice(0, 3), false, false, 0, plainTheme, 100).length, 4);
  const six = renderTaskWidget([...tasks, ...tasks.slice(0, 2)], false, false, 0, plainTheme, 100).join("\n");
  assert.match(six, /3 more/);
});

test("static task widget renders only the first line of multiline text with safe tabs", () => {
  const lines = renderTaskWidget(
    [{ id: "7", text: "Role:\tWorker\nDetails here", status: "pending" }],
    false,
    false,
    0,
    plainTheme,
    100,
  );

  assert.deepEqual(lines.slice(1), ["  ▫ #7 Role:  Worker…"]);
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

test("task list modal is bordered, width-safe, and scrolls within a short overlay", async () => {
  const overflowTasks = [...tasks, ...Array.from({ length: 16 }, (_, index) => ({
    id: String(index + 5), text: `Task ${index + 5}`, status: "pending" as const,
  }))];
  let component: { render(width: number): string[]; handleInput(data: string): void } | undefined;
  let doneCalls = 0;
  let renderRequests = 0;
  let options: unknown;
  const store = await taskStore(overflowTasks);
  await showTaskList({
    ui: {
      custom: async (factory: Function, customOptions: unknown) => {
        options = customOptions;
        component = factory({ terminal: { rows: 10 }, requestRender() { renderRequests += 1; } }, plainTheme, {}, () => { doneCalls += 1; });
      },
    },
  } as any, store);

  const render = () => component!.render(40);
  let lines = render();
  let output = lines.join("\n");
  assert.equal(lines.length, 8); // 80% of ten rows
  assert.ok(component!.render(12).every((line) => visibleWidth(line) <= 12));
  assert.ok(lines.every((line) => visibleWidth(line) <= 40));
  assert.match(output, /─/);
  assert.ok(lines.slice(1, -1).every((line) => line.startsWith("│ ") && line.endsWith(" │")));
  assert.match(lines[0]!, /^╭─+ Tasks ─+╮$/);
  assert.match(lines.at(-1)!, /^╰─+╯$/);
  assert.match(output, /Tasks/);
  assert.match(output, /esc/);
  assert.match(output, /close/);
  assert.match(output, /#1/);
  assert.match(output, /#2/);
  assert.match(output, /#3/);
  assert.doesNotMatch(output, /#4/);
  assert.ok(output.indexOf("#1") < output.indexOf("#2"));
  assert.match(lines.at(-1)!, /─/);

  component!.handleInput("\u001b[B");
  output = render().join("\n");
  assert.match(output, /#4/);
  component!.handleInput("\u001b[A");
  output = render().join("\n");
  assert.match(output, /#1/);
  assert.doesNotMatch(output, /#4/);
  component!.handleInput("\u001b[6~");
  output = render().join("\n");
  assert.match(output, /#7/);
  assert.doesNotMatch(output, /#1/);
  component!.handleInput("\u001b[5~");
  output = render().join("\n");
  assert.match(output, /#1/);
  assert.doesNotMatch(output, /#7/);
  for (const taskId of ["5", "8", "12", "16", "17", "20"]) {
    component!.handleInput("\u001b[6~");
    lines = render();
    assert.match(lines.join("\n"), new RegExp(`#${taskId}`));
  }
  assert.match(lines.at(-1)!, /─/);
  assert.ok(renderRequests >= 10);
  component!.handleInput("\u001b");
  assert.equal(doneCalls, 1);
  assert.deepEqual(options, {
    overlay: true,
    overlayOptions: { anchor: "center", width: "70%", maxHeight: "80%", minWidth: 40 },
  });
});

test("task list modal reserves a row for scrolling below its fixed chrome height", async () => {
  const overflowTasks = [...tasks, ...Array.from({ length: 16 }, (_, index) => ({
    id: String(index + 5), text: `Task ${index + 5}`, status: "pending" as const,
  }))];
  let component: { render(width: number): string[]; handleInput(data: string): void } | undefined;
  const store = await taskStore(overflowTasks);
  await showTaskList({
    ui: {
      custom: async (factory: Function) => {
        component = factory({ terminal: { rows: 6 }, requestRender() {} }, plainTheme, {}, () => undefined);
      },
    },
  } as any, store);

  let lines = component!.render(40);
  assert.equal(lines.length, 4); // 80% of six rows
  assert.match(lines.join("\n"), /20 tasks/);
  assert.match(lines.join("\n"), /#1/);
  assert.match(lines.join("\n"), /Tasks/);
  assert.doesNotMatch(lines.join("\n"), /esc close/);
  assert.match(lines[0]!, /─/);
  assert.match(lines.at(-1)!, /─/);
  for (let index = 0; index < 20; index += 1) component!.handleInput("\u001b[B");
  lines = component!.render(40);
  assert.match(lines.join("\n"), /#20/);
});

test("task list modal shows the zero-task summary", async () => {
  let rendered: string[] = [];
  const store = await taskStore([]);
  await showTaskList({
    ui: {
      custom: async (factory: Function) => {
        rendered = factory({ requestRender() {} }, plainTheme, {}, () => undefined).render(100);
      },
    },
  } as any, store);
  assert.match(rendered.join("\n"), /0 tasks \(0 completed, 0 active, 0 pending\)/);
});

test("task list modal animates active tasks and stops with live status changes or close", async () => {
  const store = await taskStore([{ id: "1", text: "Task", status: "pending" }]);
  let component: { render(width: number): string[]; handleInput(data: string): void; dispose?(): void } | undefined;
  let renderRequests = 0;
  const shown = showTaskList({
    ui: {
      custom: async (factory: Function) => new Promise<void>((resolve) => {
        component = factory({ requestRender() { renderRequests += 1; } }, plainTheme, {}, resolve);
      }),
    },
  } as any, store);

  await Promise.resolve();
  assert.match(component!.render(100).join("\n"), /▫ #1 Task/);
  await store.update("1", { status: "active" });
  assert.match(component!.render(100).join("\n"), /⠋ #1 Task/);
  const afterActive = renderRequests;
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.ok(renderRequests > afterActive);
  assert.doesNotMatch(component!.render(100).join("\n"), /⠋ #1 Task/);

  await store.update("1", { status: "completed" });
  assert.match(component!.render(100).join("\n"), /✓ #1 Task/);
  const afterCompleted = renderRequests;
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(renderRequests, afterCompleted);

  await store.update("1", { status: "active" });
  component!.handleInput("\u001b");
  await shown;
  const afterClose = renderRequests;
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(renderRequests, afterClose);
});

test("task list modal host disposal stops active animation and unsubscribes", async () => {
  const store = await taskStore([{ id: "1", text: "Task", status: "active" }]);
  let component: { render(width: number): string[]; dispose?(): void } | undefined;
  let finishCustom: (() => void) | undefined;
  let renderRequests = 0;
  const shown = showTaskList({
    ui: {
      custom: async (factory: Function) => new Promise<void>((resolve) => {
        component = factory({ requestRender() { renderRequests += 1; } }, plainTheme, {}, () => undefined);
        finishCustom = resolve;
      }),
    },
  } as any, store);

  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.ok(renderRequests > 0);
  const dispose = component!.dispose;
  assert.ok(dispose);
  dispose();
  const afterDispose = renderRequests;
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(renderRequests, afterDispose);
  await store.update("1", { text: "Ignored after host disposal" });
  assert.equal(renderRequests, afterDispose);

  finishCustom!();
  await shown;
});

test("task list modal follows store changes and unsubscribes on close", async () => {
  const store = await taskStore([...tasks, ...Array.from({ length: 16 }, (_, index) => ({
    id: String(index + 5), text: `Task ${index + 5}`, status: "pending" as const,
  }))]);
  let component: { render(width: number): string[]; handleInput(data: string): void } | undefined;
  let renderRequests = 0;
  const shown = showTaskList({
    ui: {
      custom: async (factory: Function) => new Promise<void>((resolve) => {
        component = factory({ terminal: { rows: 6 }, requestRender() { renderRequests += 1; } }, plainTheme, {}, resolve);
      }),
    },
  } as any, store);

  await Promise.resolve();
  component!.render(40);
  for (let index = 0; index < 20; index += 1) component!.handleInput("\u001b[B");
  assert.match(component!.render(40).join("\n"), /#20/);
  await store.update("20", { text: "Last task", status: "completed" });
  assert.match(component!.render(40).join("\n"), /✓ #20 Last task/);
  store.cancelFailedWrite();
  assert.match(component!.render(40).join("\n"), /0 tasks/);
  assert.ok(renderRequests > 0);

  component!.handleInput("\u001b");
  await shown;
  const afterClose = renderRequests;
  await store.create("Ignored after close");
  assert.equal(renderRequests, afterClose);
  await new Promise((resolve) => setTimeout(resolve, 1_100));
  assert.equal(renderRequests, afterClose);
});

test("single-task tool results render one line per task", () => {
  const result = (task: Task) => ({
    content: [{ type: "text" as const, text: JSON.stringify(task) }],
    details: task,
  });

  const completed = renderTaskResult(result(tasks[0]), { expanded: false, isPartial: false }, plainTheme).render(100).map((line) => line.trimEnd());
  assert.deepEqual(completed, ["✓ #1 Completed task"]);

  const expanded = renderTaskResult(result(tasks[3]), { expanded: true, isPartial: false }, plainTheme).render(100).map((line) => line.trimEnd());
  assert.deepEqual(expanded, ["▫ #4 Pending task"]);

  const multiline = renderTaskResult(
    result({ id: "7", text: "Role:\n\tWorker", status: "active" }),
    { expanded: true, isPartial: false },
    plainTheme,
  ).render(100).map((line) => line.trimEnd());
  assert.deepEqual(multiline, ["▪ #7 Role:…"]);
});

test("task result rendering falls back to model content for invalid details", () => {
  const lines = renderTaskResult(
    { content: [{ type: "text", text: "raw fallback" }], details: { id: 3 } as any },
    { expanded: false, isPartial: false },
    plainTheme,
  ).render(100).map((line) => line.trimEnd());
  assert.deepEqual(lines, ["raw fallback"]);
});

test("task list results collapse to a summary and expand to one line per task", () => {
  const result = {
    content: [{ type: "text" as const, text: JSON.stringify(tasks) }],
    details: tasks,
  };

  const collapsed = renderTaskListResult(result, { expanded: false, isPartial: false }, plainTheme).render(100).map((line) => line.trimEnd());
  assert.deepEqual(collapsed, ["4 tasks (1 completed, 2 active, 1 pending)"]);

  const expanded = renderTaskListResult(result, { expanded: true, isPartial: false }, plainTheme).render(100).map((line) => line.trimEnd());
  assert.deepEqual(expanded, [
    "4 tasks (1 completed, 2 active, 1 pending)",
    "  ✓ #1 Completed task",
    "  ▪ #2 Active task",
    "  ▪ #3 Another active task",
    "  ▫ #4 Pending task",
  ]);

  const empty = renderTaskListResult(
    { content: [{ type: "text" as const, text: "[]" }], details: [] },
    { expanded: true, isPartial: false },
    plainTheme,
  ).render(100).map((line) => line.trimEnd());
  assert.deepEqual(empty, ["0 tasks (0 completed, 0 active, 0 pending)"]);

  const invalid = renderTaskListResult(
    { content: [{ type: "text" as const, text: "list fallback" }], details: [{ id: 1 }] as any },
    { expanded: true, isPartial: false },
    plainTheme,
  ).render(100).map((line) => line.trimEnd());
  assert.deepEqual(invalid, ["list fallback"]);
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
