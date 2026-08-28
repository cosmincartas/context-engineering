import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  getMarkdownTheme,
  type AgentToolResult,
  type ExtensionAPI,
  type Theme,
  type ToolRenderResultOptions,
} from "@earendil-works/pi-coding-agent";
import { Container, Markdown, Spacer, Text, type Component } from "@earendil-works/pi-tui";
import { Type, type Static } from "typebox";

import { loadBundledAgents } from "./agents/index.ts";
import {
  executeSubagentBatch,
  normalizeTitle,
  type ProcessAttempt,
  type SubagentBatchDetails,
  type SubagentBatchOutcome,
  type SubagentRun,
} from "./runtime/index.ts";
import { installSubagentUI, type SubagentUIHandle } from "./ui/index.ts";

const SubagentParameters = Type.Object(
  {
    tasks: Type.Array(Type.Unknown(), { minItems: 1 }),
  },
  { additionalProperties: false },
);

type ToolSubagentRequest = Static<typeof SubagentParameters>;

function contentText(result: AgentToolResult<unknown>): string {
  return result.content
    .filter((item): item is { type: "text"; text: string } => item.type === "text")
    .map((item) => item.text)
    .join("\n");
}

function finalOutput(attempt: ProcessAttempt): string {
  for (let index = attempt.messages.length - 1; index >= 0; index--) {
    const message = attempt.messages[index];
    if (message.role !== "assistant") continue;
    return message.content
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join("");
  }
  return "";
}

function toolCalls(attempt: ProcessAttempt): string[] {
  return attempt.messages.flatMap((message) => {
    if (message.role !== "assistant") return [];
    return message.content.flatMap((part) => {
      if (part.type !== "toolCall") return [];
      const args = JSON.stringify(part.arguments);
      return [`${part.name}${args === "{}" ? "" : ` ${args}`}`];
    });
  });
}

function stateHeader(run: SubagentRun, theme: Theme): string {
  const marker =
    run.state === "succeeded" ? "✓" :
    run.state === "failed" ? "✗" :
    run.state === "cancelled" ? "■" :
    run.state === "retrying" ? "↻" : "…";
  const state =
    run.state === "succeeded" ? theme.fg("success", run.state) :
    run.state === "failed" ? theme.fg("error", run.state) :
    run.state === "cancelled" || run.state === "retrying"
      ? theme.fg("warning", run.state)
      : theme.fg("accent", run.state);
  return `${marker} ${theme.fg("toolTitle", theme.bold(run.agent))} — ${safeTitle(run.title)} — ${state}`;
}

function safeTitle(title: unknown): string {
  if (typeof title !== "string") return "(untitled)";
  try {
    return normalizeTitle(title);
  } catch {
    return "(untitled)";
  }
}

export function renderSubagentResult(
  result: AgentToolResult<SubagentBatchDetails>,
  options: ToolRenderResultOptions,
  theme: Theme,
): Component {
  const details = result.details;
  if (!isBatchDetails(details)) {
    return new Text(contentText(result) || "(no output)", 0, 0);
  }

  if (!options.expanded) {
    return new Text(batchSummary(details.outcomes), 0, 0);
  }

  const container = new Container();
  container.addChild(new Text(batchSummary(details.outcomes), 0, 0));
  for (const outcome of details.outcomes) {
    container.addChild(new Spacer(1));
    if (isRunOutcome(outcome)) {
      container.addChild(new Text(theme.fg("muted", `Task ${outcome.index + 1}`), 0, 0));
      addRunDetails(container, outcome.run, theme);
    } else {
      const text = outcome.status === "queued"
        ? `${theme.fg("muted", `Task ${outcome.index + 1}`)} — queued: ${safeTitle(outcome.request.title)}`
        : `${theme.fg("muted", `Task ${outcome.index + 1}`)} — ${outcome.status}: ${outcome.reason}`;
      container.addChild(new Text(text, 0, 0));
    }
  }
  return container;
}

function batchSummary(outcomes: readonly SubagentBatchOutcome[]): string {
  const counts = new Map<string, number>();
  for (const outcome of outcomes) counts.set(outcome.status, (counts.get(outcome.status) ?? 0) + 1);
  const summary = [...counts.entries()].map(([status, count]) => `${count} ${status}`).join(", ");
  return `Subagents (${outcomes.length}): ${summary || "no outcomes"}`;
}

function addRunDetails(container: Container, run: SubagentRun, theme: Theme): void {
  container.addChild(new Text(stateHeader(run, theme), 0, 0));
  container.addChild(new Spacer(1));
  container.addChild(new Text(theme.fg("muted", "Task"), 0, 0));
  container.addChild(new Text(run.task, 0, 0));

  for (const attempt of run.attempts) {
    container.addChild(new Spacer(1));
    container.addChild(
      new Text(
        `${theme.fg("muted", `Attempt ${attempt.number}`)} — ${attempt.state}`,
        0,
        0,
      ),
    );
    if (attempt.activity.length > 0) {
      container.addChild(
        new Text(attempt.activity.map((item: string) => `• ${item}`).join("\n"), 0, 0),
      );
    }
    for (const call of toolCalls(attempt)) {
      container.addChild(new Text(`${theme.fg("muted", "Tool:")} ${call}`, 0, 0));
    }

    const output = finalOutput(attempt);
    if (output) {
      container.addChild(new Text(theme.fg("muted", "Output"), 0, 0));
      container.addChild(
        attempt.state === "succeeded"
          ? new Markdown(output, 0, 0, getMarkdownTheme())
          : new Text(output, 0, 0),
      );
    }
    if (attempt.exitCode !== null) {
      container.addChild(new Text(`Exit code: ${attempt.exitCode}`, 0, 0));
    }
    if (attempt.stderr) container.addChild(new Text(`Standard error: ${attempt.stderr}`, 0, 0));
    if (attempt.error) container.addChild(new Text(`Error: ${attempt.error}`, 0, 0));
  }

  if (run.error && !run.attempts.some((attempt) => attempt.error === run.error)) {
    container.addChild(new Spacer(1));
    container.addChild(new Text(`Error: ${run.error}`, 0, 0));
  }
}

function isBatchDetails(value: unknown): value is SubagentBatchDetails {
  if (!value || typeof value !== "object" || !Array.isArray((value as any).outcomes)) return false;
  if ((value as any).outcomes.length === 0) return false;
  return (value as any).outcomes.every((outcome: unknown, index: number) =>
    isBatchOutcome(outcome) && outcome.index === index
  );
}

function isBatchOutcome(value: unknown): value is SubagentBatchOutcome {
  if (!value || typeof value !== "object") return false;
  const outcome = value as any;
  if (!Number.isInteger(outcome.index) || outcome.index < 0) return false;
  if (outcome.status === "malformed" || outcome.status === "over-limit") {
    return typeof outcome.reason === "string";
  }
  if (outcome.status === "queued") return isRequest(outcome.request);
  if (!isRunState(outcome.status)) return false;
  return isRunOutcome(outcome) && outcome.run.state === outcome.status;
}

function isRunState(value: unknown): value is SubagentRun["state"] {
  return value === "running" ||
    value === "retrying" ||
    value === "succeeded" ||
    value === "failed" ||
    value === "cancelled";
}

function isRequest(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const request = value as any;
  return typeof request.agent === "string" &&
    typeof request.title === "string" &&
    typeof request.task === "string";
}

function isRunOutcome(value: unknown): value is Extract<SubagentBatchOutcome, { run: SubagentRun }> {
  if (!value || typeof value !== "object") return false;
  const outcome = value as any;
  return typeof outcome.status === "string" && isRun(outcome.run);
}

function isRun(value: unknown): value is SubagentRun {
  if (!value || typeof value !== "object") return false;
  const run = value as any;
  return typeof run.agent === "string" &&
    typeof run.title === "string" &&
    typeof run.task === "string" &&
    isRunState(run.state) &&
    typeof run.startedAt === "number" && Number.isFinite(run.startedAt) &&
    (run.endedAt === undefined || typeof run.endedAt === "number" && Number.isFinite(run.endedAt)) &&
    (run.error === undefined || typeof run.error === "string") &&
    Array.isArray(run.attempts) &&
    run.attempts.every((attempt: any) =>
      attempt && typeof attempt === "object" &&
      (attempt.number === 1 || attempt.number === 2) &&
      isAttemptState(attempt.state) &&
      Array.isArray(attempt.activity) &&
      attempt.activity.every((item: unknown) => typeof item === "string") &&
      Array.isArray(attempt.messages) &&
      attempt.messages.every(isMessage) &&
      (attempt.exitCode === null || typeof attempt.exitCode === "number") &&
      typeof attempt.stderr === "string" &&
      (attempt.error === undefined || typeof attempt.error === "string")
    );
}

function isAttemptState(value: unknown): value is ProcessAttempt["state"] {
  return value === "running" || value === "succeeded" || value === "failed" || value === "cancelled";
}

function isMessage(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const message = value as any;
  return typeof message.role === "string" &&
    (message.role !== "assistant" ||
      Array.isArray(message.content) && message.content.every((part: unknown) =>
        part && typeof part === "object" && typeof (part as any).type === "string"
      ));
}

type ActiveSubagentSession = {
  readonly root: string;
  readonly ui: SubagentUIHandle;
  readonly abortController: AbortController;
  readonly executions: Set<Promise<unknown>>;
  shutdown?: Promise<void>;
};

export default function subagentExtension(pi: ExtensionAPI): void {
  let activeSession: ActiveSubagentSession | undefined;

  pi.on("session_shutdown", async (_event, ctx) => {
    const session = activeSession;
    if (!session) return;
    if (session.shutdown) {
      await session.shutdown;
      return;
    }

    session.shutdown = (async () => {
      let cleanupError: unknown;
      session.abortController.abort();
      while (session.executions.size > 0) {
        await Promise.allSettled([...session.executions]);
      }
      try {
        session.ui.dispose();
      } catch (error) {
        cleanupError = error;
      }
      try {
        await fs.rm(session.root, { recursive: true, force: true });
      } catch (error) {
        cleanupError ??= error;
      }
      if (cleanupError) {
        const message = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
        ctx.ui.notify(`Subagent session cleanup failed: ${message}`, "error");
      }
    })();
    await session.shutdown;
    if (activeSession === session) activeSession = undefined;
  });

  pi.on("session_start", async (_event, ctx) => {
    if (ctx.mode !== "tui") return;

    let root: string | undefined;
    let ui: SubagentUIHandle | undefined;
    try {
      const catalog = await loadBundledAgents(new URL("./agents/", import.meta.url));
      root = await fs.mkdtemp(path.join(os.tmpdir(), "pi-subagent-sessions-"));
      ui = installSubagentUI(ctx);
      const session: ActiveSubagentSession = {
        root,
        ui,
        abortController: new AbortController(),
        executions: new Set(),
      };
      activeSession = session;
      const description = [
        "Delegate independent tasks to bundled subagents in parallel. Provide a non-empty tasks array of items with agent, title, and task fields; only the first eight items can run.",
        ...catalog.map((agent) => `${agent.name}: ${agent.description}`),
      ].join(" ");

      pi.registerTool({
        name: "subagent",
        label: "Subagent",
        description,
        parameters: SubagentParameters,
        executionMode: "parallel",
        execute(toolCallId, params: ToolSubagentRequest, signal, onUpdate, toolContext) {
          const combinedSignal = signal
            ? AbortSignal.any([session.abortController.signal, signal])
            : session.abortController.signal;
          const execution = executeSubagentBatch(
            toolCallId,
            params,
            catalog,
            toolContext,
            session.root,
            combinedSignal,
            {
              onToolUpdate: onUpdate,
              onMonitorEvent: session.ui.onMonitorEvent,
            },
          );
          session.executions.add(execution);
          void execution.then(
            () => session.executions.delete(execution),
            () => session.executions.delete(execution),
          );
          return execution;
        },
        renderResult: renderSubagentResult,
      });
    } catch (error) {
      if (activeSession?.ui === ui) activeSession = undefined;
      try {
        ui?.dispose();
      } catch {
        // Preserve the startup failure notification.
      }
      if (root) {
        try {
          await fs.rm(root, { recursive: true, force: true });
        } catch {
          // The startup notification remains the single failure report.
        }
      }
      const message = error instanceof Error ? error.message : String(error);
      ctx.ui.notify(`Subagent extension unavailable: ${message}`, "error");
    }
  });
}
