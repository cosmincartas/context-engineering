import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { StringDecoder } from "node:string_decoder";

import type { Message } from "@earendil-works/pi-ai";
import type {
  AgentToolResult,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { JsonAgentSessionEvent } from "@earendil-works/pi-coding-agent";

import type { AgentDefinition } from "./agents.ts";

export const MAX_RESULT_BYTES = 50 * 1024;

type AttemptState = "running" | "succeeded" | "failed" | "cancelled";

export type ProcessAttempt = {
  readonly number: 1 | 2;
  readonly state: AttemptState;
  readonly activity: readonly string[];
  readonly messages: readonly Message[];
  readonly stderr: string;
  readonly exitCode: number | null;
  readonly error?: string;
};

export type SubagentRun = {
  readonly agent: string;
  readonly task: string;
  readonly state: AttemptState | "retrying";
  readonly model?: AgentDefinition["model"];
  readonly thinkingLevel?: AgentDefinition["thinkingLevel"];
  readonly attempts: readonly ProcessAttempt[];
  readonly error?: string;
};

type MutableAttempt = {
  number: 1 | 2;
  state: AttemptState;
  activity: string[];
  messages: Message[];
  stderr: string;
  exitCode: number | null;
  error?: string;
};

type MutableRun = {
  agent: string;
  task: string;
  state: SubagentRun["state"];
  model?: AgentDefinition["model"];
  thinkingLevel?: AgentDefinition["thinkingLevel"];
  attempts: MutableAttempt[];
  error?: string;
};

type Update = (result: AgentToolResult<SubagentRun>) => void;

type AttemptOutcome = {
  succeeded: boolean;
  cancelled?: boolean;
  retryable?: boolean;
  error?: string;
};

export async function executeSubagent(
  agentName: string,
  task: string,
  catalog: readonly AgentDefinition[],
  ctx: ExtensionContext,
  signal: AbortSignal | undefined,
  onUpdate?: Update,
): Promise<AgentToolResult<SubagentRun>> {
  if (typeof agentName !== "string" || agentName.trim() === "") {
    throw new TypeError("Invalid subagent request: agent must not be blank");
  }
  if (typeof task !== "string" || task.trim() === "") {
    throw new TypeError("Invalid subagent request: task must not be blank");
  }
  signal?.throwIfAborted();

  const definition = catalog.find((candidate) => candidate.name === agentName);
  if (!definition) {
    const available = catalog.map((candidate) => candidate.name).join(", ") || "none";
    const error = `Unknown agent: ${agentName}. Available agents: ${available}.`;
    const details: SubagentRun = {
      agent: agentName,
      task,
      state: "failed",
      attempts: [],
      error,
    };
    return result(details, error);
  }

  const resolved = resolveModel(definition, ctx);
  if (!resolved.model) {
    const error = resolved.warning ?? "Unable to resolve a model for the subagent";
    const details: SubagentRun = {
      agent: agentName,
      task,
      state: "failed",
      attempts: [],
      error,
    };
    return result(details, error);
  }

  const run: MutableRun = {
    agent: agentName,
    task,
    state: "running",
    model: resolved.model,
    thinkingLevel: resolved.thinkingLevel,
    attempts: [],
  };
  const emit = () => {
    onUpdate?.(result(snapshotRun(run), `Subagent ${run.agent} is ${run.state}.`));
  };

  for (const number of [1, 2] as const) {
    signal?.throwIfAborted();
    const attempt: MutableAttempt = {
      number,
      state: "running",
      activity: [
        ...(number === 1 && resolved.warning ? [resolved.warning] : []),
        ...(number === 2 ? ["Retrying after attempt 1 failed."] : []),
      ],
      messages: [],
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
      definition,
      task,
      resolved.model,
      resolved.thinkingLevel,
      ctx,
      signal,
      attempt,
      emit,
      onCancelled,
    );
    if (outcome.cancelled) {
      signal?.throwIfAborted();
      throw new Error("Subagent cancellation was not accompanied by an abort signal");
    }
    attempt.state = outcome.succeeded ? "succeeded" : "failed";
    if (outcome.error) attempt.error = outcome.error;

    if (outcome.succeeded) {
      run.state = "succeeded";
      delete run.error;
      emit();
      const output = finalOutput(attempt.messages);
      return result(snapshotRun(run), resolved.warning ? `${resolved.warning}\n\n${output}` : output);
    }

    run.error = outcome.error || attempt.stderr || "Subagent failed";
    emit();
    if (number === 1 && outcome.retryable !== false) {
      run.state = "retrying";
      emit();
      continue;
    }

    run.state = "failed";
    const output = failureOutput(run);
    return result(snapshotRun(run), resolved.warning ? `${resolved.warning}\n${output}` : output);
  }

  throw new Error("Subagent attempt loop did not return");
}

function resolveModel(
  definition: AgentDefinition,
  ctx: ExtensionContext,
): { model?: AgentDefinition["model"]; thinkingLevel?: AgentDefinition["thinkingLevel"]; warning?: string } {
  const available = ctx.modelRegistry.getAvailable();
  const mappedAvailable = available.some(
    (model) => `${model.provider}/${model.id}` === definition.model,
  );
  if (mappedAvailable) {
    return { model: definition.model, thinkingLevel: definition.thinkingLevel };
  }

  if (!ctx.model) {
    return {
      warning: `Fallback unavailable: mapped model ${definition.model} and the parent model are unavailable.`,
    };
  }

  const model = `${ctx.model.provider}/${ctx.model.id}` as AgentDefinition["model"];
  const thinkingLevel = ctx.thinkingLevel ?? definition.thinkingLevel;
  return {
    model,
    thinkingLevel,
    warning: `Fallback: mapped model ${definition.model} is unavailable; using parent model ${model}.`,
  };
}

async function runAttempt(
  definition: AgentDefinition,
  task: string,
  model: AgentDefinition["model"],
  thinkingLevel: AgentDefinition["thinkingLevel"] | undefined,
  ctx: ExtensionContext,
  signal: AbortSignal | undefined,
  attempt: MutableAttempt,
  emit: () => void,
  onCancelled: () => void,
): Promise<AttemptOutcome> {
  let promptDirectory: string | undefined;
  let outcome: AttemptOutcome = { succeeded: false, error: "Subagent attempt did not start" };
  let cleanupError: string | undefined;

  try {
    promptDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "pi-subagent-"));
    const promptPath = path.join(promptDirectory, `prompt-${definition.name}.md`);
    await fs.writeFile(promptPath, definition.systemPrompt, { encoding: "utf8", mode: 0o600 });
    signal?.throwIfAborted();

    const args = [
      "--mode",
      "json",
      "-p",
      "--no-session",
      "--no-skills",
      "--model",
      model,
      "--thinking",
      thinkingLevel ?? definition.thinkingLevel,
      "--tools",
      definition.tools.join(","),
      "--append-system-prompt",
      promptPath,
      task,
    ];

    const child = spawn("pi", args, {
      cwd: ctx.cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    outcome = await new Promise<AttemptOutcome>((resolve) => {
      let buffer = "";
      const stdoutDecoder = new StringDecoder("utf8");
      const stderrDecoder = new StringDecoder("utf8");
      let childError: string | undefined;
      let closed = false;
      let cancellationRequested = false;
      let forceKillTimer: ReturnType<typeof setTimeout> | undefined;

      function finish(code: number | null, signalName: NodeJS.Signals | null): void {
        if (closed) return;
        closed = true;
        if (forceKillTimer) clearTimeout(forceKillTimer);
        signal?.removeEventListener("abort", cancel);
        buffer += stdoutDecoder.end();
        attempt.stderr += stderrDecoder.end();
        if (buffer.trim()) processLine(buffer);
        attempt.exitCode = code;
        if (cancellationRequested) {
          resolve({ succeeded: false, cancelled: true, retryable: false });
        } else if (childError) {
          resolve({ succeeded: false, error: childError });
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

      function cancel(): void {
        if (closed || cancellationRequested) return;
        cancellationRequested = true;
        onCancelled();
        try {
          child.kill("SIGTERM");
        } catch {
          // The close event still determines when the process is gone.
        }
        forceKillTimer = setTimeout(() => {
          if (closed) return;
          try {
            child.kill("SIGKILL");
          } catch {
            // The parent will rethrow the abort reason after cleanup.
          }
        }, 5_000);
      }

      function processLine(line: string): void {
        if (!line.trim()) return;

        let event: any;
        try {
          event = JSON.parse(line) as JsonAgentSessionEvent;
        } catch {
          attempt.error = `Malformed JSON event: ${line.slice(0, 120)}`;
          emit();
          try {
            child.kill("SIGTERM");
          } catch {
            // The close event will report the protocol failure.
          }
          return;
        }
        if (event === null || typeof event !== "object" || Array.isArray(event) || typeof event.type !== "string") {
          attempt.error = "Malformed JSON event: expected an event object with a type";
          emit();
          try {
            child.kill("SIGTERM");
          } catch {
            // The close event will report the protocol failure.
          }
          return;
        }

        if (event.type === "message_update") {
          const update = event.assistantMessageEvent;
          if (update?.type === "error") {
            attempt.error = update.error?.errorMessage ?? `Provider stopped with ${update.reason}`;
            emit();
            return;
          }
          if (typeof update?.delta === "string" && update.delta.length > 0) {
            const kind = update.type === "thinking_delta" ? "thinking" : "text";
            attempt.activity.push(`${kind}: ${update.delta}`);
            emit();
          }
          return;
        }

        if (event.type === "tool_execution_start") {
          attempt.activity.push(`tool ${event.toolName ?? "unknown"} started`);
          emit();
          return;
        }

        if (event.type === "tool_execution_end") {
          const suffix = event.isError ? " failed" : " completed";
          attempt.activity.push(`tool ${event.toolName ?? "unknown"}${suffix}`);
          emit();
          return;
        }

        if (event.type !== "message_end" || !event.message) return;
        const message = event.message as Message;
        attempt.messages.push(message);
        if (
          message.role === "assistant" &&
          (message.stopReason === "error" ||
            message.stopReason === "aborted" ||
            Boolean(message.errorMessage))
        ) {
          attempt.error = message.errorMessage ?? `Provider stopped with ${message.stopReason}`;
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
      child.once("close", finish);

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

function failureOutput(run: MutableRun): string {
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
    task: run.task,
    state: run.state,
    model: run.model,
    thinkingLevel: run.thinkingLevel,
    attempts: run.attempts.map((attempt) => ({
      number: attempt.number,
      state: attempt.state,
      activity: [...attempt.activity],
      messages: [...attempt.messages],
      stderr: attempt.stderr,
      exitCode: attempt.exitCode,
      ...(attempt.error ? { error: attempt.error } : {}),
    })),
    ...(run.error ? { error: run.error } : {}),
  };
}

function result(details: SubagentRun, text: string): AgentToolResult<SubagentRun> {
  return {
    content: [{ type: "text", text: truncateOutput(text) }],
    details,
  };
}

function truncateOutput(text: string): string {
  const totalBytes = Buffer.byteLength(text, "utf8");
  if (totalBytes <= MAX_RESULT_BYTES) return text;

  let prefixBudget = MAX_RESULT_BYTES;
  for (let attempt = 0; attempt < 8; attempt++) {
    const prefix = takeUtf8Prefix(text, prefixBudget);
    const omittedBytes = totalBytes - Buffer.byteLength(prefix, "utf8");
    const notice = `\n\n[Output truncated: ${omittedBytes} bytes omitted. Full output preserved in tool details.]`;
    const usedBytes = Buffer.byteLength(prefix + notice, "utf8");
    if (usedBytes <= MAX_RESULT_BYTES) return prefix + notice;
    prefixBudget = Math.max(0, prefixBudget - (usedBytes - MAX_RESULT_BYTES));
  }

  const notice = "[Output truncated. Full output preserved in tool details.]";
  return takeUtf8Prefix(notice, MAX_RESULT_BYTES);
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
