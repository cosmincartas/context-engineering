import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth, type Component } from "@earendil-works/pi-tui";

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

  for (const task of tasks) {
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

    const prefix = `  ${theme.fg(color, glyph)} #${task.id} `;
    const [firstLine, ...continuationLines] = task.text.split("\n");
    lines.push(`${prefix}${firstLine!.replaceAll("\t", "  ")}`);
    const continuationPrefix = " ".repeat(visibleWidth(prefix));
    for (const line of continuationLines) {
      lines.push(`${continuationPrefix}${line.replaceAll("\t", "  ")}`);
    }
  }

  return lines.map((line) =>
    visibleWidth(line) <= renderWidth ? line : truncateToWidth(line, renderWidth, "", false),
  );
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
