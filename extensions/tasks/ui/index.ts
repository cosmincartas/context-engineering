import {
  type AgentToolResult,
  type ExtensionCommandContext,
  type ExtensionContext,
  type Theme,
  type ToolRenderResultOptions,
} from "@earendil-works/pi-coding-agent";
import {
  matchesKey,
  ScrollView,
  Text,
  truncateToWidth,
  visibleWidth,
  type Component,
} from "@earendil-works/pi-tui";

import { TaskStore, type Task, type TaskStatus } from "../state/index.ts";

const WIDGET_KEY = "tasks";
const ACTIVE_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;
const ACTIVE_FRAME_INTERVAL_MS = 80; // matches pi-tui Loader default
const WRITE_FAILURE_CHOICES = ["Continue in memory", "Cancel"] as const;

type WidgetTheme = Pick<Theme, "fg" | "bold">;

export async function handleWriteFailure(
  ctx: ExtensionContext,
  error: string,
): Promise<"continue" | "cancel"> {
  if (ctx.mode !== "tui") return "continue";

  ctx.ui.notify(error, "error");
  const choice = await ctx.ui.select("Task write failed", [...WRITE_FAILURE_CHOICES]);
  if (choice === WRITE_FAILURE_CHOICES[0]) return "continue";

  ctx.ui.notify(
    "Cancelled in-memory task changes; stored tasks may return when the session resumes.",
    "warning",
  );
  return "cancel";
}

function isTask(value: unknown): value is Task {
  if (value === null || typeof value !== "object") return false;
  const task = value as Record<string, unknown>;
  return typeof task.id === "string" &&
    typeof task.text === "string" &&
    (task.status === "pending" || task.status === "active" || task.status === "completed");
}

function taskLine(task: Task, theme: WidgetTheme, activeGlyph = "▪"): string {
  const glyph =
    task.status === "completed" ? theme.fg("success", "✓") :
    task.status === "active" ? theme.fg("accent", activeGlyph) :
    theme.fg("muted", "▫");
  const [firstLine, ...rest] = task.text.split("\n");
  return `${glyph} #${task.id} ${firstLine!.replaceAll("\t", "  ")}${rest.length > 0 ? "…" : ""}`;
}

function taskSummary(tasks: readonly Task[]): string {
  const counts: Record<TaskStatus, number> = { pending: 0, active: 0, completed: 0 };
  for (const task of tasks) counts[task.status] += 1;
  return `${tasks.length} task${tasks.length === 1 ? "" : "s"} (${counts.completed} completed, ${counts.active} active, ${counts.pending} pending)`;
}

function fallbackText(result: AgentToolResult<unknown>): Component {
  const text = result.content
    .filter((item): item is { type: "text"; text: string } => item.type === "text")
    .map((item) => item.text)
    .join("\n");
  return new Text(text || "(no output)", 0, 0);
}

export function renderTaskResult(
  result: AgentToolResult<Task>,
  _options: ToolRenderResultOptions,
  theme: Theme,
): Component {
  if (!isTask(result.details)) return fallbackText(result);
  return new Text(taskLine(result.details, theme), 0, 0);
}

export function renderTaskListResult(
  result: AgentToolResult<readonly Task[]>,
  options: ToolRenderResultOptions,
  theme: Theme,
): Component {
  const details: unknown = result.details;
  if (!Array.isArray(details) || !details.every(isTask)) return fallbackText(result);
  const tasks: readonly Task[] = details;

  const summary = taskSummary(tasks);
  if (!options.expanded || tasks.length === 0) return new Text(summary, 0, 0);
  return new Text(
    [summary, ...tasks.map((task) => `  ${taskLine(task, theme)}`)].join("\n"),
    0,
    0,
  );
}

export function renderTaskWidget(
  tasks: readonly Task[],
  unsaved: boolean,
  agentRunning: boolean,
  frame: number,
  theme: WidgetTheme,
  width: number,
): string[] {
  const renderWidth = Math.max(1, Math.floor(width));
  const counts: Record<TaskStatus, number> = { pending: 0, active: 0, completed: 0 };
  for (const task of tasks) counts[task.status] += 1;

  const summary = `● ${tasks.length} task${tasks.length === 1 ? "" : "s"} (${counts.completed} completed, ${counts.active} active, ${counts.pending} pending)${unsaved ? " [unsaved]" : ""}`;
  const lines = [theme.fg("accent", theme.bold(summary))];

  for (const task of tasks.slice(0, 3)) {
    let glyph: string;
    let color: "success" | "accent" | "muted";
    if (task.status === "completed") {
      glyph = "✓";
      color = "success";
    } else if (task.status === "active") {
      glyph = agentRunning
        ? ACTIVE_FRAMES[((frame % ACTIVE_FRAMES.length) + ACTIVE_FRAMES.length) % ACTIVE_FRAMES.length]!
        : "▪";
      color = "accent";
    } else {
      glyph = "▫";
      color = "muted";
    }

    const [firstLine, ...rest] = task.text.split("\n");
    lines.push(
      `  ${theme.fg(color, glyph)} #${task.id} ${firstLine!.replaceAll("\t", "  ")}${rest.length > 0 ? "…" : ""}`,
    );
  }

  if (tasks.length > 3) lines.push(theme.fg("muted", `  ${tasks.length - 3} more, run /tasks to see all`));

  return lines.map((line) =>
    visibleWidth(line) <= renderWidth ? line : truncateToWidth(line, renderWidth, "", false),
  );
}

export async function showTaskList(
  ctx: Pick<ExtensionCommandContext, "ui">,
  store: TaskStore,
): Promise<void> {
  store.list(); // Preserve load errors before opening the modal.
  let unsubscribe: (() => void) | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let frame = 0;
  let closed = false;
  const close = () => {
    closed = true;
    unsubscribe?.();
    unsubscribe = undefined;
    if (timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
  };
  try {
    await ctx.ui.custom((tui, theme, _keybindings, done) => {
      const list: Component = {
        render: (width) => {
          const renderWidth = Math.max(1, Math.floor(width));
          const tasks = store.list();
          return [taskSummary(tasks), ...tasks.map((task) => taskLine(task, theme, ACTIVE_FRAMES[frame]!))].map((line) =>
            visibleWidth(line) <= renderWidth ? line : truncateToWidth(line, renderWidth, "", false),
          );
        },
        invalidate: () => undefined,
      };
      const scroll = new ScrollView(list, { overscroll: "contain" });
      const syncTimer = () => {
        const active = store.list().some((task) => task.status === "active");
        if (!closed && active && timer === undefined) {
          frame = 0;
          timer = setInterval(() => {
            if (closed || !store.list().some((task) => task.status === "active")) {
              if (timer !== undefined) clearInterval(timer);
              timer = undefined;
              return;
            }
            frame = (frame + 1) % ACTIVE_FRAMES.length;
            tui.requestRender();
          }, ACTIVE_FRAME_INTERVAL_MS);
        } else if ((!active || closed) && timer !== undefined) {
          clearInterval(timer);
          timer = undefined;
          frame = 0;
        }
      };
      unsubscribe = store.subscribe(() => {
        if (closed) return;
        syncTimer();
        list.invalidate();
        tui.requestRender();
      });
      syncTimer();
      return {
      render: (width) => {
        const renderWidth = Math.max(4, Math.floor(width));
        const contentWidth = renderWidth - 4;
        const border = (text: string) => theme.fg("accent", text);
        const frame = (line: string) => `${border("│")} ${truncateToWidth(line, contentWidth, "", true)} ${border("│")}`;
        const title = truncateToWidth(` ${theme.bold("Tasks")} `, renderWidth - 2);
        const left = "─".repeat(Math.floor((renderWidth - 2 - visibleWidth(title)) / 2));
        const right = "─".repeat(renderWidth - 2 - visibleWidth(title) - left.length);
        const tasks = store.list();
        const lines = list.render(contentWidth);
        const maxHeight = tui.terminal?.rows === undefined ? Number.MAX_SAFE_INTEGER : Math.max(3, Math.floor(tui.terminal.rows * 0.8));
        const top = [`${border(`╭${left}`)}${title}${border(`${right}╮`)}`];
        const bottom = [border(`╰${"─".repeat(renderWidth - 2)}╯`)];
        let footerLines = new Text(tasks.length === 0 ? "esc close" : "↑↓ scroll  page up/down scroll  esc close", 0, 0).render(contentWidth);
        const minimumViewportHeight = tasks.length > 0 ? 2 : 1;
        if (top.length + footerLines.length + bottom.length + minimumViewportHeight > maxHeight) footerLines = [];
        const viewportHeight = Math.min(lines.length, Math.max(1, maxHeight - top.length - footerLines.length - bottom.length));
        scroll.updateLayout(lines.length, viewportHeight, () => tui.requestRender());
        return [
          ...top,
          ...lines.slice(scroll.scrollTop, scroll.scrollTop + viewportHeight).map(frame),
          ...footerLines.map(frame),
          ...bottom,
        ];
      },
        invalidate: () => list.invalidate(),
        dispose: close,
        handleInput: (data) => {
          if (matchesKey(data, "escape")) {
            close();
            done(undefined);
            return;
          }
        else if (matchesKey(data, "up")) scroll.scrollBy(-1);
        else if (matchesKey(data, "down")) scroll.scrollBy(1);
        else if (matchesKey(data, "pageUp")) scroll.scrollBy(-Math.max(1, scroll.viewportHeight));
        else if (matchesKey(data, "pageDown")) scroll.scrollBy(Math.max(1, scroll.viewportHeight));
          else return;
          tui.requestRender();
        },
      };
    }, {
      overlay: true,
      overlayOptions: { anchor: "center", width: "70%", maxHeight: "80%", minWidth: 40 },
    });
  } finally {
    close();
  }
}

export class TaskWidget {
  private readonly ui: ExtensionContext["ui"];
  private readonly store: TaskStore;
  private tui: { requestRender(): void } | undefined;
  private component: Component | undefined;
  private timer: ReturnType<typeof setInterval> | undefined;
  private agentRunning = false;
  private frame = 0;
  private disposed = false;

  constructor(ui: ExtensionContext["ui"], store: TaskStore) {
    this.ui = ui;
    this.store = store;
    this.ui.setWidget(WIDGET_KEY, (tui, theme) => {
      this.tui = tui;
      const component: Component = {
        render: (width) => this.render(theme, width),
        invalidate: () => undefined,
      };
      this.component = component;
      this.syncTimer();
      return component;
    });
  }

  setAgentRunning(running: boolean): void {
    if (this.disposed) return;
    this.agentRunning = running;
    this.refresh();
  }

  refresh(): void {
    if (this.disposed) return;
    this.syncTimer();
    this.component?.invalidate();
    this.tui?.requestRender();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopTimer();
    this.component = undefined;
    this.tui = undefined;
    this.ui.setWidget(WIDGET_KEY, undefined);
  }

  private render(theme: WidgetTheme, width: number): string[] {
    const state = this.store.getState();
    if (state.kind !== "ready") return [];
    return renderTaskWidget(
      this.store.list(),
      state.unsaved,
      this.agentRunning,
      this.frame,
      theme,
      width,
    );
  }

  private syncTimer(): void {
    if (this.shouldAnimate()) {
      this.startTimer();
    } else {
      this.stopTimer();
    }
  }

  private shouldAnimate(): boolean {
    if (!this.agentRunning || this.disposed) return false;
    const state = this.store.getState();
    return state.kind === "ready" && this.store.list().some((task) => task.status === "active");
  }

  private startTimer(): void {
    if (this.timer !== undefined) return;
    this.frame = 0;
    this.timer = setInterval(() => {
      if (!this.shouldAnimate()) {
        this.stopTimer();
        this.tui?.requestRender();
        return;
      }
      this.frame = (this.frame + 1) % ACTIVE_FRAMES.length;
      this.tui?.requestRender();
    }, ACTIVE_FRAME_INTERVAL_MS);
  }

  private stopTimer(): void {
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.frame = 0;
  }
}
