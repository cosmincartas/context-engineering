import {
  getMarkdownTheme,
  type AgentToolResult,
  type ExtensionAPI,
  type Theme,
  type ToolRenderResultOptions,
} from "@earendil-works/pi-coding-agent";
import { Container, Markdown, Spacer, Text, type Component } from "@earendil-works/pi-tui";
import { Type, type Static } from "typebox";

import { loadBundledAgents } from "./agents.ts";
import { executeSubagent, type ProcessAttempt, type SubagentRun } from "./runtime.ts";

const SubagentParameters = Type.Object(
  {
    agent: Type.String({ minLength: 1 }),
    task: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

type SubagentRequest = Static<typeof SubagentParameters>;

const COLLAPSED_ACTIVITY_COUNT = 10;

function contentText(result: AgentToolResult<SubagentRun>): string {
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
  return `${marker} ${theme.fg("toolTitle", theme.bold(run.agent))} — ${state}`;
}

export function renderSubagentResult(
  result: AgentToolResult<SubagentRun>,
  options: ToolRenderResultOptions,
  theme: Theme,
): Component {
  const run = result.details;
  if (!run?.agent || !Array.isArray(run.attempts)) {
    return new Text(contentText(result) || "(no output)", 0, 0);
  }

  if (!options.expanded) {
    const activity = run.attempts.flatMap((attempt) => attempt.activity);
    const visible = activity.slice(-COLLAPSED_ACTIVITY_COUNT);
    const omitted = activity.length - visible.length;
    const lines = [stateHeader(run, theme)];
    if (omitted > 0) lines.push(theme.fg("muted", `… ${omitted} earlier activities`));
    lines.push(...visible.map((item) => theme.fg("toolOutput", `• ${item}`)));
    if (visible.length === 0) lines.push(theme.fg("muted", "(no activity)"));
    return new Text(lines.join("\n"), 0, 0);
  }

  const container = new Container();
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
        new Text(attempt.activity.map((item) => `• ${item}`).join("\n"), 0, 0),
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
  return container;
}

export default function subagentExtension(pi: ExtensionAPI): void {
  pi.on("session_start", async (_event, ctx) => {
    if (ctx.mode !== "tui") return;

    try {
      const catalog = await loadBundledAgents(new URL("./agents/", import.meta.url));
      const description = [
        "Delegate one task to a bundled subagent with an isolated context.",
        ...catalog.map((agent) => `${agent.name}: ${agent.description}`),
      ].join(" ");

      pi.registerTool({
        name: "subagent",
        label: "Subagent",
        description,
        executionMode: "sequential",
        parameters: SubagentParameters,
        execute(_toolCallId, params: SubagentRequest, signal, onUpdate, toolContext) {
          return executeSubagent(
            params.agent,
            params.task,
            catalog,
            toolContext,
            signal,
            onUpdate,
          );
        },
        renderResult: renderSubagentResult,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      ctx.ui.notify(`Subagent extension unavailable: ${message}`, "error");
    }
  });
}
