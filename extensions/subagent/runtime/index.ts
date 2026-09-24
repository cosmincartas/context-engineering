import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { StringDecoder } from "node:string_decoder";
import { fileURLToPath } from "node:url";

import {
  clampThinkingLevel,
  getSupportedThinkingLevels,
  type Message,
  type Model,
  type Usage,
} from "@earendil-works/pi-ai";
import { stripTerminalSequences } from "@earendil-works/pi-tui";
import type {
  AgentToolResult,
  AgentToolUpdateCallback,
  ExtensionContext,
  JsonAgentSessionEvent,
} from "@earendil-works/pi-coding-agent";

import type { AgentDefinition } from "../agents/index.ts";
import type { ProfileSettingsSnapshot } from "../state/index.ts";
import { BUDGET_ENVIRONMENT_VARIABLE } from "./turn-budget.ts";

export const MAX_RESULT_BYTES = 50 * 1024;

/** Bounds each child by turns. See `turn-budget.ts`. */
const TURN_BUDGET_EXTENSION = fileURLToPath(new URL("./turn-budget.ts", import.meta.url));
const DELEGATION_ROLE_ENVIRONMENT_VARIABLE = "PI_SUBAGENT_DELEGATION_ROLE";
const DELEGATION_SESSION_DIRECTORY_ENVIRONMENT_VARIABLE = "PI_SUBAGENT_DELEGATION_SESSION_DIRECTORY";

/**
 * Streaming deltas arrive per token and each published snapshot rebuilds the
 * whole batch result, so they publish at most one snapshot per interval.
 * Everything else publishes immediately.
 */
export const STREAM_EMIT_INTERVAL_MS = 50;

type StreamEmitter = {
  /** Publish the accumulated streaming state once the interval elapses. */
  schedule(): void;
  /** Publish a pending streaming snapshot before its state is replaced. */
  flush(): void;
};

type AttemptState = "running" | "succeeded" | "failed" | "cancelled";

export type SubagentRequest = {
  readonly agent: string;
  readonly title: string;
  readonly task: string;
};

export type SubagentBatchRequest = {
  readonly tasks: readonly unknown[];
};

export type SubagentBatchOutcome =
  | {
      readonly index: number;
      readonly status: "queued";
      readonly request: SubagentRequest;
    }
  | {
      readonly index: number;
      readonly status: "running" | "retrying" | "succeeded" | "failed" | "cancelled";
      readonly run: SubagentRun;
    }
  | {
      readonly index: number;
      readonly status: "malformed" | "over-limit";
      readonly reason: string;
    };

export type SubagentBatchDetails = {
  readonly outcomes: readonly SubagentBatchOutcome[];
};

export type SubagentUsage = {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly contextTokens: number;
};

export type ScoutExecution = {
  readonly toolCallId: string;
  readonly outcomes: readonly SubagentBatchOutcome[];
  /** True when cancellation prevented the tool's final result from arriving. */
  readonly partial: boolean;
};

export type ProcessAttempt = {
  readonly number: 1 | 2;
  readonly state: AttemptState;
  readonly activity: readonly string[];
  readonly messages: readonly Message[];
  /** Usage for this specialist attempt; delegated Scout usage stays in `scouts`. */
  readonly usage: SubagentUsage;
  readonly scouts: readonly ScoutExecution[];
  readonly stderr: string;
  readonly exitCode: number | null;
  readonly error?: string;
};

export type SubagentRun = {
  readonly agent: string;
  readonly title: string;
  readonly task: string;
  readonly state: AttemptState | "retrying";
  readonly startedAt: number;
  readonly endedAt?: number;
  readonly model?: AgentDefinition["model"];
  readonly thinkingLevel?: AgentDefinition["thinkingLevel"];
  readonly warnings: readonly string[];
  readonly attempts: readonly ProcessAttempt[];
  readonly error?: string;
};

export type ChildSessionState = {
  readonly attempt: 1 | 2;
  readonly directory: string;
  readonly sessionId?: string;
  readonly file?: string;
  readonly partialText: string;
  readonly partialThinking: string;
};

export type MonitoredRun = {
  readonly runId: string;
  readonly run: SubagentRun;
  readonly sessions: readonly ChildSessionState[];
};

export type SubagentMonitorEvent =
  | { readonly type: "started"; readonly run: MonitoredRun }
  | { readonly type: "updated"; readonly run: MonitoredRun }
  | { readonly type: "finished"; readonly run: MonitoredRun };

export type SubagentRuntimeCallbacks = {
  readonly onToolUpdate?: AgentToolUpdateCallback<SubagentRun>;
  readonly onMonitorEvent: (event: SubagentMonitorEvent) => void;
};

export type SubagentBatchRuntimeCallbacks = {
  readonly onToolUpdate?: AgentToolUpdateCallback<SubagentBatchDetails>;
  readonly onMonitorEvent: (event: SubagentMonitorEvent) => void;
};

type MutableAttempt = {
  number: 1 | 2;
  state: AttemptState;
  activity: string[];
  messages: readonly Message[];
  usage: SubagentUsage;
  committedUsage: SubagentUsage;
  pendingUsage?: SubagentUsage;
  scouts: MutableScoutExecution[];
  stderr: string;
  exitCode: number | null;
  error?: string;
  providerError?: string;
};

type MutableRun = {
  agent: string;
  title: string;
  task: string;
  state: SubagentRun["state"];
  startedAt: number;
  endedAt?: number;
  model?: AgentDefinition["model"];
  thinkingLevel?: AgentDefinition["thinkingLevel"];
  warnings: string[];
  attempts: MutableAttempt[];
  error?: string;
};

type ScoutTask = { title: string; task: string };

type MutableScoutExecution = {
  toolCallId: string;
  tasks: readonly (ScoutTask | undefined)[];
  outcomes: SubagentBatchOutcome[];
  final: boolean;
  partial: boolean;
};

type MutableChildSessionState = {
  attempt: 1 | 2;
  directory: string;
  sessionId?: string;
  file?: string;
  partialText: string;
  partialThinking: string;
};

type AttemptOutcome = {
  succeeded: boolean;
  cancelled?: boolean;
  retryable?: boolean;
  error?: string;
};

const ZERO_USAGE: SubagentUsage = {
  inputTokens: 0,
  outputTokens: 0,
  contextTokens: 0,
};

type DispatchSnapshot = {
  readonly settings: ProfileSettingsSnapshot;
  readonly available: readonly Model<any>[];
  readonly parentModel?: { readonly provider: string; readonly id: string };
  readonly parentThinkingLevel?: AgentDefinition["thinkingLevel"];
};

export function normalizeTitle(title: string): string {
  const normalized = stripTerminalSequences(title)
    .replace(/\u001b(?:[PX\]^_])[\s\S]*?(?:\u001b\\|\u0007|$)/g, "")
    .replace(/[\u0090\u0098\u009d\u009e\u009f][\s\S]*?(?:\u009c|\u0007|$)/g, "")
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\u009d[^\u0007]*(?:\u0007|\u001b\\)|\u009b[0-?]*[ -/]*[@-~]/g, "")
    .replace(/[\t\n\r\f\v\u0085\u2028\u2029]/g, " ")
    .replace(/[\u0000-\u0008\u000b\u000e-\u001f\u007f-\u009f]/g, "")
    .replace(/\p{Cf}/gu, "")
    .replace(/ +/g, " ")
    .trim();
  if (normalized === "") {
    throw new TypeError("Invalid subagent title: normalized title must not be blank");
  }
  return normalized;
}

export async function executeSubagent(
  runId: string,
  request: SubagentRequest,
  catalog: readonly AgentDefinition[],
  ctx: ExtensionContext,
  sessionRoot: string,
  signal: AbortSignal | undefined,
  callbacks: SubagentRuntimeCallbacks,
  dispatchSnapshot?: DispatchSnapshot,
): Promise<AgentToolResult<SubagentRun>> {
  if (typeof runId !== "string" || runId.trim() === "") {
    throw new TypeError("Invalid subagent request: run id must not be blank");
  }
  if (!request || typeof request !== "object") {
    throw new TypeError("Invalid subagent request");
  }
  if (typeof request.agent !== "string" || request.agent.trim() === "") {
    throw new TypeError("Invalid subagent request: agent must not be blank");
  }
  if (typeof request.title !== "string") {
    throw new TypeError("Invalid subagent request: title must be a string");
  }
  if (typeof request.task !== "string" || request.task.trim() === "") {
    throw new TypeError("Invalid subagent request: task must not be blank");
  }
  const title = normalizeTitle(request.title);
  signal?.throwIfAborted();

  const run: MutableRun = {
    agent: request.agent,
    title,
    task: request.task,
    state: "running",
    startedAt: Date.now(),
    warnings: [],
    attempts: [],
  };
  const sessions: MutableChildSessionState[] = [];
  let streamTimer: ReturnType<typeof setTimeout> | undefined;
  const emit = (type: SubagentMonitorEvent["type"] = "updated") => {
    if (streamTimer !== undefined) {
      clearTimeout(streamTimer);
      streamTimer = undefined;
    }
    const snapshot = snapshotMonitoredRun(runId, run, sessions);
    callbacks.onMonitorEvent({ type, run: snapshot });
    callbacks.onToolUpdate?.(result(snapshot.run, `Subagent ${run.title} is ${run.state}.`));
  };
  const stream: StreamEmitter = {
    schedule() {
      if (streamTimer !== undefined || run.endedAt !== undefined) return;
      streamTimer = setTimeout(() => {
        streamTimer = undefined;
        emit();
      }, STREAM_EMIT_INTERVAL_MS);
    },
    flush() {
      if (streamTimer !== undefined) emit();
    },
  };

  emit("started");

  const snapshot = dispatchSnapshot ?? captureDispatchSnapshot(ctx);
  const definition = catalog.find((candidate) => candidate.name === request.agent);
  if (!definition) {
    const available = catalog.map((candidate) => candidate.name).join(", ") || "none";
    const error = `Unknown agent: ${request.agent}. Available agents: ${available}.`;
    run.state = "failed";
    run.error = error;
    run.endedAt = Date.now();
    emit("finished");
    return result(snapshotRun(run), error);
  }

  const resolved = resolveModel(definition, snapshot);
  run.warnings.push(...resolved.warnings);
  if (!resolved.model) {
    const error = resolved.warnings.at(-1) ?? "Unable to resolve a model for the subagent";
    run.state = "failed";
    run.error = error;
    run.endedAt = Date.now();
    emit("finished");
    return result(snapshotRun(run), error);
  }

  run.model = resolved.model;
  run.thinkingLevel = resolved.thinkingLevel;

  try {
    for (const number of [1, 2] as const) {
      signal?.throwIfAborted();
      const attempt: MutableAttempt = {
        number,
        state: "running",
        activity: number === 2 ? ["Retrying after attempt 1 failed."] : [],
        messages: Object.freeze([]),
        usage: {
          ...ZERO_USAGE,
          contextTokens: run.attempts.at(-1)?.usage.contextTokens ?? ZERO_USAGE.contextTokens,
        },
        committedUsage: { ...ZERO_USAGE },
        scouts: [],
        stderr: "",
        exitCode: null,
      };
      run.attempts.push(attempt);
      emit();

      const onCancelled = () => {
        attempt.state = "cancelled";
        run.state = "cancelled";
        emit();
      };
      const outcome = await runAttempt(
        runId,
        definition,
        { ...request, title: run.title },
        resolved.model!,
        resolved.thinkingLevel,
        ctx,
        sessionRoot,
        signal,
        attempt,
        sessions,
        emit,
        stream,
        onCancelled,
      );
      if (outcome.cancelled) {
        run.state = "cancelled";
        run.endedAt = Date.now();
        emit("finished");
        signal?.throwIfAborted();
        throw new Error("Subagent cancellation was not accompanied by an abort signal");
      }

      attempt.state = outcome.succeeded ? "succeeded" : "failed";
      if (outcome.error) attempt.error = outcome.error;

      if (outcome.succeeded) {
        run.state = "succeeded";
        delete run.error;
        // The child stops itself at its budget, so an extra turn means it was cut short.
        const usedTurns = attempt.messages.filter((message) => message.role === "assistant").length;
        const overBudget = usedTurns > definition.maxTurns;
        if (overBudget) {
          attempt.activity.push(`turn budget reached after ${definition.maxTurns} turns`);
        }
        run.endedAt = Date.now();
        emit("finished");
        const output = finalOutput(attempt.messages);
        const notices = [
          ...resolved.warnings,
          ...(overBudget
            ? [
              `Turn budget reached: the report below was written after ${definition.maxTurns} turns and may be incomplete.`,
            ]
            : []),
        ];
        return result(
          snapshotRun(run),
          notices.length > 0 ? `${notices.join("\n\n")}\n\n${output}` : output,
        );
      }

      run.error = outcome.error || attempt.stderr || "Subagent failed";
      if (number === 1 && outcome.retryable !== false && startedWork(attempt) && mutatesWorkspace(definition)) {
        attempt.activity.push(
          `Not retried: ${definition.name} can change files and had already started work.`,
        );
        outcome.retryable = false;
      }
      emit();
      if (number === 1 && outcome.retryable !== false) {
        run.state = "retrying";
        emit();
        continue;
      }

      run.state = "failed";
      run.endedAt = Date.now();
      const output = failureOutput(run);
      emit("finished");
      return result(snapshotRun(run), resolved.warnings.length > 0 ? `${resolved.warnings.join("\n")}\n${output}` : output);
    }
  } catch (error) {
    if (signal?.aborted) {
      run.state = "cancelled";
      if (run.endedAt === undefined) {
        run.endedAt = Date.now();
        emit("finished");
      }
      throw error;
    }
    throw error;
  }

  throw new Error("Subagent attempt loop did not return");
}

export async function executeSubagentBatch(
  batchId: string,
  request: SubagentBatchRequest,
  catalog: readonly AgentDefinition[],
  ctx: ExtensionContext,
  sessionRoot: string,
  signal: AbortSignal | undefined,
  callbacks: SubagentBatchRuntimeCallbacks,
  settings: ProfileSettingsSnapshot = { settings: { version: 1, agents: {} } },
): Promise<AgentToolResult<SubagentBatchDetails>> {
  if (typeof batchId !== "string" || batchId.trim() === "") {
    throw new TypeError("Invalid subagent batch request: batch id must not be blank");
  }
  const outcomes = classifyBatch(request);
  const dispatchSnapshot = captureDispatchSnapshot(ctx, settings);
  const queued = outcomes.filter((outcome): outcome is Extract<SubagentBatchOutcome, { status: "queued" }> => outcome.status === "queued");

  signal?.throwIfAborted();
  const runQueued = async (
    outcome: Extract<SubagentBatchOutcome, { status: "queued" }>,
  ): Promise<void> => {
    signal?.throwIfAborted();
    const childRunId = `${batchId}:${outcome.index}`;
    let monitorStarted = false;
    let finalOutcome!: Extract<SubagentBatchOutcome, { run: SubagentRun }>;
    try {
      const child = await executeSubagent(
        childRunId,
        outcome.request,
        catalog,
        ctx,
        sessionRoot,
        signal,
        {
          onToolUpdate: (update) => {
            outcomes[outcome.index] = {
              index: outcome.index,
              status: update.details.state,
              run: update.details,
            };
            publishBatchUpdate(callbacks, outcomes);
          },
          onMonitorEvent: (event) => {
            if (event.type === "started") monitorStarted = true;
            callbacks.onMonitorEvent(event);
          },
        },
        dispatchSnapshot,
      );
      finalOutcome = {
        index: outcome.index,
        status: child.details.state,
        run: child.details,
      };
      outcomes[outcome.index] = finalOutcome;
    } catch (error) {
      if (signal?.aborted) throw error;
      const run = failedRun(outcome.request, error);
      finalOutcome = { index: outcome.index, status: "failed", run };
      outcomes[outcome.index] = finalOutcome;
      if (monitorStarted) {
        callbacks.onMonitorEvent({
          type: "finished",
          run: { runId: childRunId, run, sessions: [] },
        });
      }
      publishBatchUpdate(callbacks, outcomes);
    }
  };
  const settled = await Promise.allSettled(queued.map(runQueued));
  if (signal?.aborted) throw signal.reason;
  const rejection = settled.find((result): result is PromiseRejectedResult => result.status === "rejected");
  if (rejection) throw rejection.reason;

  const details = snapshotBatch(outcomes);
  return {
    content: [{ type: "text", text: formatSubagentBatch(details) }],
    details,
  };
}

export function classifyBatch(request: unknown): SubagentBatchOutcome[] {
  let requestKeys: (string | symbol)[];
  try {
    if (!isRecord(request)) throw new TypeError();
    requestKeys = Reflect.ownKeys(request);
  } catch {
    throw new TypeError("Invalid subagent batch request: tasks must be a non-empty array");
  }
  if (
    requestKeys.length !== 1 ||
    requestKeys[0] !== "tasks" ||
    !Array.isArray(request.tasks) ||
    request.tasks.length === 0
  ) {
    throw new TypeError("Invalid subagent batch request: tasks must be a non-empty array");
  }

  const outcomes: SubagentBatchOutcome[] = [];
  for (let index = 0; index < request.tasks.length; index++) {
    outcomes.push(index >= 8
      ? {
          index,
          status: "over-limit",
          reason: "Task was not run because the batch limit is eight items.",
        }
      : classifyTask(index, request.tasks[index]));
  }
  return outcomes;
}

function classifyTask(index: number, value: unknown): SubagentBatchOutcome {
  let keys: (string | symbol)[];
  try {
    if (!isRecord(value)) {
      return { index, status: "malformed", reason: "Task must contain only agent, title, and task fields." };
    }
    keys = Reflect.ownKeys(value);
  } catch {
    return { index, status: "malformed", reason: "Task could not be inspected safely." };
  }
  if (
    keys.length !== 3 ||
    keys.some((key) => key !== "agent" && key !== "title" && key !== "task")
  ) {
    return { index, status: "malformed", reason: "Task must contain only agent, title, and task fields." };
  }
  let agent: unknown;
  let title: unknown;
  let task: unknown;
  try {
    agent = value.agent;
    title = value.title;
    task = value.task;
  } catch {
    return { index, status: "malformed", reason: "Task could not be read safely." };
  }
  if (typeof agent !== "string" || agent.trim() === "") {
    return { index, status: "malformed", reason: "Task agent must be a non-blank string." };
  }
  if (typeof title !== "string") {
    return { index, status: "malformed", reason: "Task title must be a string." };
  }
  if (typeof task !== "string" || task.trim() === "") {
    return { index, status: "malformed", reason: "Task task must be a non-blank string." };
  }
  try {
    return {
      index,
      status: "queued",
      request: {
        agent,
        title: normalizeTitle(title),
        task,
      },
    };
  } catch {
    return { index, status: "malformed", reason: "Task title must normalize to a non-blank line." };
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function publishBatchUpdate(
  callbacks: SubagentBatchRuntimeCallbacks,
  outcomes: readonly SubagentBatchOutcome[],
): void {
  const details = snapshotBatch(outcomes);
  callbacks.onToolUpdate?.({
    content: [{ type: "text", text: formatSubagentBatch(details) }],
    details,
  });
}

function snapshotBatch(outcomes: readonly SubagentBatchOutcome[]): SubagentBatchDetails {
  return { outcomes: outcomes.map(cloneOutcome) };
}

function cloneOutcome(outcome: SubagentBatchOutcome): SubagentBatchOutcome {
  if (outcome.status === "queued") {
    return { index: outcome.index, status: "queued", request: { ...outcome.request } };
  }
  if (outcome.status === "malformed" || outcome.status === "over-limit") {
    return { index: outcome.index, status: outcome.status, reason: outcome.reason };
  }
  if ("run" in outcome) {
    return { index: outcome.index, status: outcome.status, run: cloneRun(outcome.run) };
  }
  throw new TypeError("Invalid subagent batch outcome");
}

function cloneRun(run: SubagentRun): SubagentRun {
  return {
    ...run,
    warnings: [...run.warnings],
    attempts: run.attempts.map((attempt) => ({
      ...attempt,
      activity: [...attempt.activity],
      messages: attempt.messages,
      usage: { ...attempt.usage },
      scouts: attempt.scouts.map((scout) => ({
        toolCallId: scout.toolCallId,
        outcomes: scout.outcomes.map(cloneOutcome),
        partial: scout.partial,
      })),
    })),
  };
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function failedRun(request: SubagentRequest, error: unknown): SubagentRun {
  const now = Date.now();
  return {
    agent: request.agent,
    title: request.title,
    task: request.task,
    state: "failed",
    startedAt: now,
    endedAt: now,
    warnings: [],
    attempts: [],
    error: error instanceof Error ? error.message : String(error),
  };
}

function mutatesWorkspace(definition: AgentDefinition): boolean {
  return definition.tools.some((tool) => tool === "edit" || tool === "write" || tool === "bash");
}

function startedWork(attempt: MutableAttempt): boolean {
  return attempt.messages.some((message) => message.role === "assistant");
}

function captureDispatchSnapshot(
  ctx: ExtensionContext,
  settings: ProfileSettingsSnapshot = { settings: { version: 1, agents: {} } },
): DispatchSnapshot {
  const parent = ctx.model;
  return Object.freeze({
    settings: Object.freeze({
      settings: Object.freeze({
        version: 1,
        agents: Object.freeze(Object.fromEntries(Object.entries(settings.settings.agents).map(([role, value]) => [role, Object.freeze({ ...value })]))),
      }),
      ...(settings.error ? { error: settings.error } : {}),
    }),
    available: Object.freeze(ctx.modelRegistry.getAvailable().map((model) => Object.freeze({
      ...model,
      ...(model.thinkingLevelMap ? { thinkingLevelMap: Object.freeze({ ...model.thinkingLevelMap }) } : {}),
    })) as Model<any>[]),
    ...(parent ? { parentModel: Object.freeze({ provider: parent.provider, id: parent.id }) } : {}),
    ...(ctx.thinkingLevel ? { parentThinkingLevel: ctx.thinkingLevel as AgentDefinition["thinkingLevel"] } : {}),
  });
}

function resolveModel(
  definition: AgentDefinition,
  snapshot: DispatchSnapshot,
): { model?: AgentDefinition["model"]; thinkingLevel?: AgentDefinition["thinkingLevel"]; warnings: string[] } {
  const override = snapshot.settings.settings.agents[definition.name];
  const configuredModel = override
    ? `${override.provider}/${override.model}` as AgentDefinition["model"]
    : definition.model;
  const configuredThinking = override?.thinkingLevel ?? definition.thinkingLevel;
  const warnings = snapshot.settings.error ? [snapshot.settings.error] : [];
  const available = snapshot.available.find((model) => `${model.provider}/${model.id}` === configuredModel);
  if (available) {
    const supported = getSupportedThinkingLevels(available);
    const thinkingLevel = supported.includes(configuredThinking)
      ? configuredThinking
      : clampThinkingLevel(available, configuredThinking);
    if (thinkingLevel !== configuredThinking) {
      warnings.push(`Configured reasoning ${configuredThinking} is unsupported by ${configuredModel}; using ${thinkingLevel}.`);
    }
    return { model: configuredModel, thinkingLevel, warnings };
  }

  if (!snapshot.parentModel || !snapshot.parentThinkingLevel) {
    warnings.push(`Fallback unavailable: configured model ${configuredModel} is unavailable and the parent model or reasoning level is unavailable.`);
    return { warnings };
  }

  const model = `${snapshot.parentModel.provider}/${snapshot.parentModel.id}` as AgentDefinition["model"];
  warnings.push(`Fallback: configured model ${configuredModel} is unavailable; using parent model ${model} and reasoning ${snapshot.parentThinkingLevel}.`);
  return { model, thinkingLevel: snapshot.parentThinkingLevel, warnings };
}

async function runAttempt(
  runId: string,
  definition: AgentDefinition,
  request: SubagentRequest,
  model: AgentDefinition["model"],
  thinkingLevel: AgentDefinition["thinkingLevel"] | undefined,
  ctx: ExtensionContext,
  sessionRoot: string,
  signal: AbortSignal | undefined,
  attempt: MutableAttempt,
  sessions: MutableChildSessionState[],
  emit: () => void,
  stream: StreamEmitter,
  onCancelled: () => void,
): Promise<AttemptOutcome> {
  let promptDirectory: string | undefined;
  let session: MutableChildSessionState | undefined;
  let outcome: AttemptOutcome = { succeeded: false, error: "Subagent attempt did not start" };
  let cleanupError: string | undefined;

  try {
    const directory = await fs.mkdtemp(path.join(sessionRoot, `attempt-${attempt.number}-`));
    session = {
      attempt: attempt.number,
      directory,
      partialText: "",
      partialThinking: "",
    };
    sessions.push(session);
    emit();

    promptDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "pi-subagent-"));
    const promptPath = path.join(promptDirectory, `prompt-${definition.name}.md`);
    const prompt = definition.name === "scout"
      ? `${definition.systemPrompt}\n\nIf codex-research is unavailable, report that web research is unavailable for a task that actually needs it; continue any local research and never claim unavailable web evidence succeeded.`
      : definition.systemPrompt;
    await fs.writeFile(promptPath, prompt, { encoding: "utf8", mode: 0o600 });
    signal?.throwIfAborted();

    const args = [
      "--mode",
      "json",
      "-p",
      "--no-skills",
      "--model",
      model,
      "--thinking",
      thinkingLevel ?? definition.thinkingLevel,
      "--tools",
      definition.tools.join(","),
      "--append-system-prompt",
      promptPath,
      "--session-dir",
      directory,
      "--name",
      request.title,
      "-e",
      TURN_BUDGET_EXTENSION,
      request.task,
    ];

    // Nested Scouts stay in their specialist's process group. The specialist's
    // owner can therefore still stop them after the specialist itself exits.
    const ownsProcessGroup = process.platform !== "win32" && !isNestedScout(definition);
    const child = spawn("pi", args, {
      cwd: ctx.cwd,
      shell: false,
      detached: ownsProcessGroup,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        [BUDGET_ENVIRONMENT_VARIABLE]: String(definition.maxTurns),
        [DELEGATION_ROLE_ENVIRONMENT_VARIABLE]: definition.name,
        [DELEGATION_SESSION_DIRECTORY_ENVIRONMENT_VARIABLE]: directory,
      },
    });

    outcome = await new Promise<AttemptOutcome>((resolve) => {
      let buffer = "";
      const stdoutDecoder = new StringDecoder("utf8");
      const stderrDecoder = new StringDecoder("utf8");
      let childError: string | undefined;
      let sessionDiscoveryError: string | undefined;
      let sessionDiscoveryPromise: Promise<void> | undefined;
      let closed = false;
      let cancellationRequested = false;
      let forceKillTimer: ReturnType<typeof setTimeout> | undefined;
      let windowsTermination: Promise<void> | undefined;
      let posixTermination: Promise<void> | undefined;
      const trackedDescendants = new Set<number>();

      function discoverSessionFile(): Promise<void> {
        if (!session?.sessionId || session.file) return Promise.resolve();
        if (sessionDiscoveryPromise) return sessionDiscoveryPromise;
        sessionDiscoveryPromise = findChildSessionFile(session.directory, session.sessionId)
          .then((file) => {
            if (file && session && !session.file) {
              session.file = file;
              if (!closed) emit();
            }
          })
          .finally(() => {
            sessionDiscoveryPromise = undefined;
          });
        return sessionDiscoveryPromise;
      }

      function reportSessionDiscoveryError(error: unknown): void {
        if (closed) return;
        attempt.error = `Child session discovery failed: ${error instanceof Error ? error.message : String(error)}`;
        emit();
      }

      async function finish(code: number | null, signalName: NodeJS.Signals | null): Promise<void> {
        if (closed) return;
        closed = true;
        signal?.removeEventListener("abort", cancel);
        buffer += stdoutDecoder.end();
        attempt.stderr += stderrDecoder.end();
        if (buffer.trim()) processLine(buffer);
        attempt.exitCode = code;
        if (!attempt.error && attempt.providerError) attempt.error = attempt.providerError;
        try {
          await discoverSessionFile();
        } catch (error) {
          sessionDiscoveryError = error instanceof Error ? error.message : String(error);
        }
        // The specialist can exit while its Scouts keep the process group alive.
        // Stop and reap that group before returning or retrying this attempt.
        if (process.platform !== "win32") {
          markScoutUsagePartial(attempt);
          await stopProcessTree("SIGTERM");
          scheduleForceKill();
          await waitForProcessTree(child.pid, ownsProcessGroup, trackedDescendants);
          if (forceKillTimer) clearTimeout(forceKillTimer);
        }
        if (cancellationRequested) {
          markScoutUsagePartial(attempt);
          resolve({ succeeded: false, cancelled: true, retryable: false });
        } else if (childError) {
          resolve({ succeeded: false, error: childError });
        } else if (sessionDiscoveryError) {
          resolve({ succeeded: false, error: `Child session discovery failed: ${sessionDiscoveryError}` });
        } else if (attempt.error) {
          resolve({ succeeded: false, error: attempt.error });
        } else if (code !== 0 || signalName) {
          resolve({
            succeeded: false,
            error: signalName
              ? `Child exited with signal ${signalName}`
              : `Child exited with code ${code ?? "unknown"}`,
          });
        } else {
          resolve({ succeeded: true });
        }
      }

      function scheduleForceKill(): void {
        if (process.platform === "win32" || forceKillTimer) return;
        forceKillTimer = setTimeout(() => {
          if (ownsProcessGroup) {
            void terminateProcessTree(child.pid, "SIGKILL", true);
          } else {
            terminateTrackedProcesses(trackedDescendants, "SIGKILL");
          }
          child.stdout?.destroy();
          child.stderr?.destroy();
        }, 5_000);
      }

      function stopProcessTree(signalName: NodeJS.Signals): Promise<void> {
        if (process.platform !== "win32") {
          // Discover descendants before terminating the parent: otherwise a nested
          // Scout can be reparented before it is retained for forced cleanup.
          posixTermination ??= terminateProcessTree(child.pid, signalName, ownsProcessGroup, trackedDescendants);
          return posixTermination;
        }
        windowsTermination ??= terminateProcessTree(child.pid, signalName, ownsProcessGroup);
        return windowsTermination;
      }

      async function cancel(): Promise<void> {
        if (closed || cancellationRequested) return;
        cancellationRequested = true;
        onCancelled();
        await stopProcessTree("SIGTERM");
        scheduleForceKill();
      }

      function handleSessionHeader(id: unknown): void {
        if (typeof id !== "string" || !session) return;
        session.sessionId = id;
        if (!closed) emit();
        void discoverSessionFile().catch(reportSessionDiscoveryError);
      }

      function processLine(line: string): void {
        if (!line.trim()) return;

        let event: any;
        try {
          event = JSON.parse(line) as JsonAgentSessionEvent;
        } catch {
          attempt.error = `Malformed JSON event: ${line.slice(0, 120)}`;
          emit();
          void stopProcessTree("SIGTERM");
          return;
        }
        if (event === null || typeof event !== "object" || Array.isArray(event) || typeof event.type !== "string") {
          attempt.error = "Malformed JSON event: expected an event object with a type";
          emit();
          void stopProcessTree("SIGTERM");
          return;
        }

        if (session?.sessionId && !session.file) {
          void discoverSessionFile().catch(reportSessionDiscoveryError);
        }

        if (event.type === "session") {
          handleSessionHeader(event.id);
          return;
        }

        if (event.type === "message_update") {
          const update = event.assistantMessageEvent;
          const usage = usageFrom(event.usage);
          if (usage) {
            attempt.pendingUsage = usage;
            refreshAttemptUsage(attempt, usage.contextTokens);
          }
          if (update?.type === "error") {
            attempt.providerError = update.error?.errorMessage ?? `Provider stopped with ${update.reason}`;
            attempt.activity.push(`provider error: ${attempt.providerError}`);
            emit();
            return;
          }
          if (typeof update?.delta === "string" && update.delta.length > 0 && session) {
            if (update.type === "thinking_delta") session.partialThinking += update.delta;
            else if (update.type === "text_delta") session.partialText += update.delta;
            stream.schedule();
          } else if (usage) {
            stream.schedule();
          }
          return;
        }

        if (event.type === "tool_execution_start") {
          attempt.activity.push(`tool ${event.toolName ?? "unknown"} started`);
          trackScoutStart(attempt, event);
          emit();
          return;
        }

        if (event.type === "tool_execution_update") {
          if (trackScoutResult(attempt, event, false)) emit();
          return;
        }

        if (event.type === "tool_execution_end") {
          const suffix = event.isError ? " failed" : " completed";
          attempt.activity.push(`tool ${event.toolName ?? "unknown"}${suffix}`);
          trackScoutResult(attempt, event, true);
          emit();
          return;
        }

        if (event.type !== "message_end" || !event.message) return;
        stream.flush();
        const message = event.message as Message;
        attempt.messages = Object.freeze([
          ...attempt.messages,
          deepFreeze(structuredClone(message)),
        ]);
        if (message.role === "assistant") {
          const usage = usageFrom(message.usage) ?? attempt.pendingUsage;
          if (usage) {
            attempt.committedUsage = {
              inputTokens: attempt.committedUsage.inputTokens + usage.inputTokens,
              outputTokens: attempt.committedUsage.outputTokens + usage.outputTokens,
              contextTokens: usage.contextTokens,
            };
            attempt.pendingUsage = undefined;
            refreshAttemptUsage(attempt, usage.contextTokens);
          }
          if (session) {
            session.partialText = "";
            session.partialThinking = "";
          }
          if (
            message.stopReason === "error" ||
            message.stopReason === "aborted" ||
            Boolean(message.errorMessage)
          ) {
            attempt.providerError = message.errorMessage ?? `Provider stopped with ${message.stopReason}`;
            attempt.activity.push(`provider error: ${attempt.providerError}`);
          } else {
            attempt.providerError = undefined;
          }
        }
        emit();
      }

      child.stdout?.on("data", (chunk: Buffer | string) => {
        buffer += typeof chunk === "string" ? chunk : stdoutDecoder.write(chunk);
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) processLine(line);
      });
      child.stderr?.on("data", (chunk: Buffer | string) => {
        attempt.stderr += typeof chunk === "string" ? chunk : stderrDecoder.write(chunk);
      });
      child.once("error", (error) => {
        childError = error.message;
      });
      child.once("close", (code, signalName) => {
        void finish(code, signalName);
      });

      if (signal) {
        if (signal.aborted) cancel();
        else signal.addEventListener("abort", cancel, { once: true });
      }
    });
  } catch (error) {
    if (signal?.aborted) {
      onCancelled();
      outcome = { succeeded: false, cancelled: true, retryable: false };
    } else {
      const message = error instanceof Error ? error.message : String(error);
      attempt.error = message;
      outcome = { succeeded: false, error: message };
    }
  } finally {
    if (promptDirectory) {
      try {
        await fs.rm(promptDirectory, { recursive: true, force: true });
      } catch (error) {
        cleanupError = error instanceof Error ? error.message : String(error);
      }
    }
  }

  if (cleanupError && !outcome.cancelled) {
    const message = `Temporary prompt cleanup failed: ${cleanupError}`;
    attempt.error = message;
    return { succeeded: false, retryable: false, error: message };
  }
  return outcome;
}

function trackScoutStart(attempt: MutableAttempt, event: any): void {
  if (event.toolName !== "Scout" || typeof event.toolCallId !== "string" || attempt.scouts.some((scout) => scout.toolCallId === event.toolCallId)) return;
  const tasks = scoutTasks(event.args);
  if (!tasks) return;
  attempt.scouts.push({
    toolCallId: event.toolCallId,
    tasks,
    outcomes: tasks.map((task, index) => task
      ? { index, status: "queued" as const, request: { agent: "scout", ...task } }
      : { index, status: "malformed" as const, reason: "Scout task must contain only title and task fields." }),
    final: false,
    partial: false,
  });
}

function trackScoutResult(attempt: MutableAttempt, event: any, final: boolean): boolean {
  if (event.toolName !== "Scout" || typeof event.toolCallId !== "string") return false;
  const scout = attempt.scouts.find((candidate) => candidate.toolCallId === event.toolCallId);
  if (!scout || scout.final) return false;
  const result = final ? event.result : event.partialResult;
  const outcomes = scoutOutcomes(result, scout.tasks);
  if (!outcomes) {
    if (final) {
      const error = event.isError
        ? "Scout tool failed before reporting a result."
        : "Scout tool completed without reporting a valid result.";
      scout.final = true;
      scout.partial = true;
      scout.outcomes = scout.outcomes.map((outcome) => {
        if (outcome.status === "queued") {
          return { index: outcome.index, status: "failed" as const, run: failedRun(outcome.request, error) };
        }
        if (outcome.status === "running" || outcome.status === "retrying") {
          return { index: outcome.index, status: "failed" as const, run: failedScoutRun(outcome.run, error) };
        }
        return outcome;
      });
    }
    return false;
  }
  scout.outcomes = outcomes;
  scout.final = final;
  return true;
}

function failedScoutRun(run: SubagentRun, error: string): SubagentRun {
  return {
    ...run,
    state: "failed",
    endedAt: Date.now(),
    error,
    attempts: run.attempts.map((attempt) => ({
      ...attempt,
      state: attempt.state === "running" ? "failed" : attempt.state,
    })),
  };
}

function scoutTasks(value: unknown): readonly (ScoutTask | undefined)[] | undefined {
  if (!isRecord(value) || Reflect.ownKeys(value).length !== 1 || !Array.isArray(value.tasks)) return undefined;
  return value.tasks.map((task): ScoutTask | undefined => {
    if (!isRecord(task) || Reflect.ownKeys(task).length !== 2 || typeof task.title !== "string" || typeof task.task !== "string") return undefined;
    try {
      return { title: normalizeTitle(task.title), task: task.task };
    } catch {
      return undefined;
    }
  });
}

function scoutOutcomes(value: unknown, tasks: readonly (ScoutTask | undefined)[]): SubagentBatchOutcome[] | undefined {
  if (!isRecord(value) || !isRecord(value.details) || !Array.isArray(value.details.outcomes) || value.details.outcomes.length !== tasks.length) return undefined;
  const outcomes: SubagentBatchOutcome[] = [];
  for (let index = 0; index < tasks.length; index++) {
    const outcome = value.details.outcomes[index];
    if (!isRecord(outcome) || outcome.index !== index || !isScoutOutcome(outcome, tasks[index])) return undefined;
    outcomes.push(cloneOutcome(outcome as SubagentBatchOutcome));
  }
  return outcomes;
}

function isScoutOutcome(outcome: Record<string, any>, task: ScoutTask | undefined): boolean {
  if (outcome.status === "malformed") return typeof outcome.reason === "string";
  if (!task) return false;
  if (outcome.status === "over-limit") return typeof outcome.reason === "string";
  if (outcome.status === "queued") return isScoutRequest(outcome.request, task);
  if (!["running", "retrying", "succeeded", "failed", "cancelled"].includes(outcome.status) || !isRecord(outcome.run)) return false;
  const run = outcome.run;
  return run.agent === "scout" && run.title === task.title && run.task === task.task &&
    Array.isArray(run.warnings) && Array.isArray(run.attempts) && run.attempts.every((attempt: unknown) =>
      isRecord(attempt) && Array.isArray(attempt.activity) && Array.isArray(attempt.messages) &&
      isSubagentUsage(attempt.usage) && Array.isArray(attempt.scouts) && attempt.scouts.length === 0,
    );
}

function isSubagentUsage(value: unknown): value is SubagentUsage {
  return isRecord(value) &&
    typeof value.inputTokens === "number" && Number.isFinite(value.inputTokens) && value.inputTokens >= 0 &&
    typeof value.outputTokens === "number" && Number.isFinite(value.outputTokens) && value.outputTokens >= 0 &&
    typeof value.contextTokens === "number" && Number.isFinite(value.contextTokens) && value.contextTokens >= 0;
}

function isScoutRequest(value: unknown, task: { title: string; task: string }): boolean {
  return isRecord(value) && value.agent === "scout" && value.title === task.title && value.task === task.task;
}

function markScoutUsagePartial(attempt: MutableAttempt): void {
  for (const scout of attempt.scouts) if (!scout.final) scout.partial = true;
}

function isNestedScout(definition: AgentDefinition): boolean {
  return definition.name === "scout" && ["worker", "oracle", "reviewer"].includes(process.env[DELEGATION_ROLE_ENVIRONMENT_VARIABLE] ?? "");
}

async function terminateProcessTree(
  pid: number | undefined,
  signal: NodeJS.Signals,
  ownsProcessGroup: boolean,
  trackedDescendants?: Set<number>,
): Promise<void> {
  if (!pid) return;
  if (process.platform === "win32") {
    await new Promise<void>((resolve) => {
      const taskkill = spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
      taskkill.once("error", resolve);
      taskkill.once("close", resolve);
    });
    return;
  }
  const targets = ownsProcessGroup ? [-pid] : [...(await descendantPids(pid)).reverse(), pid];
  if (!ownsProcessGroup) for (const target of targets) trackedDescendants?.add(target);
  for (const target of targets) {
    try {
      process.kill(target, signal);
    } catch {
      // The close event (and group polling on cancellation) determines completion.
    }
  }
}

function terminateTrackedProcesses(pids: ReadonlySet<number>, signal: NodeJS.Signals): void {
  for (const pid of pids) {
    try {
      process.kill(pid, signal);
    } catch {
      // A tracked descendant may already have exited.
    }
  }
}

function descendantPids(pid: number): Promise<number[]> {
  return new Promise((resolve) => {
    let output = "";
    const ps = spawn("ps", ["-eo", "pid=,ppid="], { stdio: ["ignore", "pipe", "ignore"] });
    ps.stdout?.on("data", (chunk: Buffer | string) => { output += chunk.toString(); });
    ps.once("error", () => resolve([]));
    ps.once("close", () => {
      const children = new Map<number, number[]>();
      for (const line of output.split("\n")) {
        const match = /^\s*(\d+)\s+(\d+)\s*$/.exec(line);
        if (!match) continue;
        const child = Number(match[1]);
        const parent = Number(match[2]);
        const siblings = children.get(parent) ?? [];
        siblings.push(child);
        children.set(parent, siblings);
      }
      const descendants: number[] = [];
      const collect = (parent: number): void => {
        for (const child of children.get(parent) ?? []) {
          descendants.push(child);
          collect(child);
        }
      };
      collect(pid);
      resolve(descendants);
    });
  });
}

async function waitForProcessTree(pid: number | undefined, ownsProcessGroup: boolean, trackedDescendants: ReadonlySet<number>): Promise<void> {
  if (!pid || process.platform === "win32") return;
  while (true) {
    const alive = ownsProcessGroup
      ? (() => {
        try {
          process.kill(-pid, 0);
          return true;
        } catch {
          return false;
        }
      })()
      : [...trackedDescendants].some((descendant) => {
        try {
          process.kill(descendant, 0);
          return true;
        } catch {
          return false;
        }
      });
    if (!alive) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

async function findChildSessionFile(
  directory: string,
  sessionId: string,
): Promise<string | undefined> {
  const entries = await fs.readdir(directory);
  const suffix = `_${sessionId}.jsonl`;
  const file = entries.find((entry) => entry === `${sessionId}.jsonl` || entry.endsWith(suffix));
  return file ? path.join(directory, file) : undefined;
}

function usageFrom(value: unknown): SubagentUsage | undefined {
  if (!value || typeof value !== "object") return undefined;
  const usage = value as Partial<Usage> & { contextTokens?: unknown };
  const inputTokens = numberOrZero(usage.input);
  const outputTokens = numberOrZero(usage.output);
  const contextTokens = typeof usage.contextTokens === "number" && Number.isFinite(usage.contextTokens)
    ? usage.contextTokens
    : typeof usage.totalTokens === "number" && Number.isFinite(usage.totalTokens)
      ? usage.totalTokens
      : inputTokens + numberOrZero(usage.cacheRead) + numberOrZero(usage.cacheWrite);
  return { inputTokens, outputTokens, contextTokens };
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function refreshAttemptUsage(attempt: MutableAttempt, contextTokens: number): void {
  const pending = attempt.pendingUsage ?? ZERO_USAGE;
  attempt.usage = {
    inputTokens: attempt.committedUsage.inputTokens + pending.inputTokens,
    outputTokens: attempt.committedUsage.outputTokens + pending.outputTokens,
    contextTokens: contextTokens || attempt.usage.contextTokens,
  };
}

function safeTitle(title: unknown): string {
  if (typeof title !== "string") return "(untitled)";
  try {
    return normalizeTitle(title);
  } catch {
    return "(untitled)";
  }
}

export function formatSubagentBatch(details: SubagentBatchDetails): string {
  const output = details.outcomes.map(formatSubagentOutcome).join("\n\n");
  if (Buffer.byteLength(output, "utf8") <= MAX_RESULT_BYTES) return output;

  // Reserve the ordered outcome states before a single oversized report consumes the output budget.
  const statuses = details.outcomes.map(formatBatchStatus).join("\n");
  const remaining = MAX_RESULT_BYTES - Buffer.byteLength(`${statuses}\n\n`, "utf8");
  return remaining > 0 ? `${statuses}\n\n${truncateOutput(output, remaining)}` : truncateOutput(statuses);
}

function formatBatchStatus(outcome: SubagentBatchOutcome): string {
  const reason = outcome.status === "malformed" || outcome.status === "over-limit"
    ? outcome.reason
    : outcome.status === "failed" || outcome.status === "cancelled"
      ? failureOutput(outcome.run)
      : "";
  const text = `${outcome.index + 1}. ${outcome.status}${reason ? `: ${reason}` : ""}`;
  const compact = stripTerminalSequences(text).replace(/\s+/g, " ").trim();
  const maxBytes = 512;
  return Buffer.byteLength(compact, "utf8") <= maxBytes
    ? compact
    : `${takeUtf8Prefix(compact, maxBytes - Buffer.byteLength("…", "utf8"))}…`;
}

export function formatSubagentOutcome(outcome: SubagentBatchOutcome): string {
  if (outcome.status === "malformed" || outcome.status === "over-limit") {
    return `${outcome.index + 1}. ${outcome.status}: ${outcome.reason}`;
  }
  if (outcome.status === "queued") {
    return `${outcome.index + 1}. ${safeTitle(outcome.request.title)} — queued`;
  }
  if (!("run" in outcome)) throw new TypeError("Invalid subagent batch outcome");
  const output = outcome.status === "succeeded"
    ? finalOutput(outcome.run.attempts.at(-1)?.messages ?? [])
    : failureOutput(outcome.run);
  const warnings = outcome.run.warnings.length > 0 ? `${outcome.run.warnings.join("\n")}\n` : "";
  // Usage must remain visible when the specialist's report is oversized.
  return truncateOutput(`${outcome.index + 1}. ${safeTitle(outcome.run.title)} — ${outcome.status}\n${warnings}${formatUsage(outcome.run)}\n${output}`);
}

function formatUsage(run: SubagentRun): string {
  const own = totalUsage(run.attempts);
  const scouts = run.attempts.flatMap((attempt) => attempt.scouts);
  if (scouts.length === 0) return "";
  const delegated = totalUsage(scouts.flatMap((scout) => scout.outcomes.flatMap((outcome) =>
    "run" in outcome ? outcome.run.attempts : [],
  )));
  return `\n\nUsage: own ↑${own.inputTokens} ↓${own.outputTokens} ctx ${own.contextTokens} | Scouts${scouts.some((scout) => scout.partial) ? " (partial)" : ""} ↑${delegated.inputTokens} ↓${delegated.outputTokens} ctx ${delegated.contextTokens}`;
}

function totalUsage(attempts: readonly Pick<ProcessAttempt, "usage">[]): SubagentUsage {
  return attempts.reduce((total, attempt) => ({
    inputTokens: total.inputTokens + attempt.usage.inputTokens,
    outputTokens: total.outputTokens + attempt.usage.outputTokens,
    contextTokens: total.contextTokens + attempt.usage.contextTokens,
  }), { ...ZERO_USAGE });
}

function finalOutput(messages: readonly Message[]): string {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (message.role !== "assistant") continue;
    return message.content
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join("");
  }
  return "(no output)";
}

function failureOutput(run: Pick<SubagentRun, "error" | "attempts">): string {
  const diagnostics = run.attempts
    .map((attempt) => {
      const details = [attempt.error, attempt.stderr].filter(Boolean).join("; ");
      return `Attempt ${attempt.number}: ${details || "no diagnostic"}`;
    })
    .join("\n");
  return `${run.error ?? "Subagent failed"}${diagnostics ? `\n${diagnostics}` : ""}`;
}

function snapshotRun(run: MutableRun): SubagentRun {
  return {
    agent: run.agent,
    title: run.title,
    task: run.task,
    state: run.state,
    startedAt: run.startedAt,
    ...(run.endedAt !== undefined ? { endedAt: run.endedAt } : {}),
    model: run.model,
    thinkingLevel: run.thinkingLevel,
    warnings: [...run.warnings],
    attempts: run.attempts.map((attempt) => ({
      number: attempt.number,
      state: attempt.state,
      activity: [...attempt.activity],
      messages: attempt.messages,
      usage: { ...attempt.usage },
      scouts: attempt.scouts.map((scout) => ({
        toolCallId: scout.toolCallId,
        outcomes: scout.outcomes.map(cloneOutcome),
        partial: scout.partial,
      })),
      stderr: attempt.stderr,
      exitCode: attempt.exitCode,
      ...(attempt.error ? { error: attempt.error } : {}),
    })),
    ...(run.error ? { error: run.error } : {}),
  };
}

function snapshotMonitoredRun(
  runId: string,
  run: MutableRun,
  sessions: readonly MutableChildSessionState[],
): MonitoredRun {
  return {
    runId,
    run: snapshotRun(run),
    sessions: sessions.map((session) => ({ ...session })),
  };
}

function result(details: SubagentRun, text: string): AgentToolResult<SubagentRun> {
  return {
    content: [{ type: "text", text: truncateOutput(text) }],
    details,
  };
}

function truncateOutput(text: string, maxBytes = MAX_RESULT_BYTES): string {
  const totalBytes = Buffer.byteLength(text, "utf8");
  if (totalBytes <= maxBytes) return text;
  if (maxBytes <= 0) return "";

  let prefixBudget = maxBytes;
  for (let attempt = 0; attempt < 8; attempt++) {
    const prefix = takeUtf8Prefix(text, prefixBudget);
    const omittedBytes = totalBytes - Buffer.byteLength(prefix, "utf8");
    const notice = `\n\n[Output truncated: ${omittedBytes} bytes omitted. Full output preserved in tool details.]`;
    const usedBytes = Buffer.byteLength(prefix + notice, "utf8");
    if (usedBytes <= maxBytes) return prefix + notice;
    prefixBudget = Math.max(0, prefixBudget - (usedBytes - maxBytes));
  }

  const notice = "[Output truncated. Full output preserved in tool details.]";
  return takeUtf8Prefix(notice, maxBytes);
}

function takeUtf8Prefix(text: string, maxBytes: number): string {
  if (maxBytes <= 0) return "";
  let bytes = 0;
  let prefix = "";
  for (const character of text) {
    const characterBytes = Buffer.byteLength(character, "utf8");
    if (bytes + characterBytes > maxBytes) break;
    prefix += character;
    bytes += characterBytes;
  }
  return prefix;
}
