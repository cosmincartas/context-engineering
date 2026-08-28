import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

export type TaskStatus = "pending" | "active" | "completed";

export interface Task {
  readonly id: string;
  readonly text: string;
  readonly status: TaskStatus;
}

export type TaskFile = readonly Task[];

export type TaskStoreState =
  | { readonly kind: "ready"; readonly unsaved: boolean }
  | { readonly kind: "load-error"; readonly error: string };

export interface TaskChanges {
  readonly text?: string;
  readonly status?: TaskStatus;
}

export interface TaskMutationResult {
  readonly task: Task;
  readonly writeError?: string;
}

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/;
const TASK_STATUSES: readonly TaskStatus[] = ["pending", "active", "completed"];

export class TaskStore {
  private tasks: Task[];
  private readonly statePath: string | undefined;
  private state: TaskStoreState;

  private constructor(tasks: Task[], statePath: string | undefined, state: TaskStoreState) {
    this.tasks = tasks;
    this.statePath = statePath;
    this.state = state;
  }

  static async load(cwd: string, sessionId?: string): Promise<TaskStore> {
    const statePath = sessionId === undefined ? undefined : taskPath(cwd, sessionId);
    if (statePath === undefined) return new TaskStore([], undefined, readyState(false));

    try {
      const contents = await readFile(statePath, "utf8");
      return new TaskStore(parseTaskFile(contents), statePath, readyState(false));
    } catch (error) {
      if (isMissingFile(error)) {
        return new TaskStore([], statePath, readyState(false));
      }
      return new TaskStore([], statePath, {
        kind: "load-error",
        error: formatError("load", error),
      });
    }
  }

  getState(): TaskStoreState {
    return this.state;
  }

  list(): readonly Task[] {
    this.assertReady();
    return this.tasks.map(copyTask);
  }

  get(id: string): Task {
    this.assertReady();
    const task = this.tasks.find((candidate) => candidate.id === id);
    if (task === undefined) throw new Error(`Unknown task identifier: ${String(id)}`);
    return copyTask(task);
  }

  async create(text: string): Promise<TaskMutationResult> {
    this.assertReady();

    const task: Task = {
      id: nextTaskId(this.tasks),
      text: normalizeTaskText(text),
      status: "pending",
    };
    this.tasks = [...this.tasks, task];
    return this.finishMutation(task);
  }

  async update(id: string, changes: TaskChanges): Promise<TaskMutationResult> {
    this.assertReady();
    const validatedChanges = validateChanges(changes);
    const taskIndex = this.tasks.findIndex((task) => task.id === id);
    if (taskIndex < 0) throw new Error(`Unknown task identifier: ${String(id)}`);

    const current = this.tasks[taskIndex];
    const nextStatus = validatedChanges.status ?? current.status;
    const nextTask: Task = {
      id: current.id,
      text: validatedChanges.text ?? current.text,
      status: nextStatus,
    };
    this.tasks = this.tasks.map((task, index) => index === taskIndex ? nextTask : task);
    return this.finishMutation(nextTask);
  }

  cancelFailedWrite(): void {
    if (this.state.kind !== "ready") return;
    this.tasks = [];
    this.state = readyState(false);
  }

  private async finishMutation(task: Task): Promise<TaskMutationResult> {
    try {
      await this.save();
      return { task: copyTask(task) };
    } catch (error) {
      this.state = readyState(true);
      return { task: copyTask(task), writeError: formatError("save", error) };
    }
  }

  private async save(): Promise<void> {
    // ponytail: no cross-process lock; add one if multiple Pi processes share a session.
    if (this.statePath === undefined) {
      this.state = readyState(false);
      return;
    }

    const directory = dirname(this.statePath);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const temporaryPath = join(
      directory,
      `.${basename(this.statePath)}.${process.pid}.${randomUUID()}.tmp`,
    );
    const contents = `${JSON.stringify(this.tasks, null, 2)}\n`;

    try {
      await writeFile(temporaryPath, contents, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      });
      await rename(temporaryPath, this.statePath);
    } catch (error) {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
      throw error;
    }

    this.state = readyState(false);
  }

  private assertReady(): void {
    if (this.state.kind === "load-error") {
      throw new Error(this.state.error);
    }
  }
}

function taskPath(cwd: string, sessionId: string): string {
  const resolvedCwd = resolve(cwd);
  const workspaceKey = `--${resolvedCwd.replace(/^[/\\]/, "").replace(/[/\\:]/g, "-")}--`;
  return join(getAgentDir(), "tasks", "sessions", workspaceKey, `tasks-${sessionId}.json`);
}

function nextTaskId(tasks: readonly Task[]): string {
  if (tasks.length === 0) return "1";
  return (BigInt(tasks[tasks.length - 1].id) + 1n).toString();
}

function validateChanges(changes: TaskChanges): { text?: string; status?: TaskStatus } {
  if (!isRecord(changes)) throw new TypeError("Invalid task changes: expected an object");
  const keys = Object.keys(changes);
  if (keys.length === 0) throw new TypeError("Invalid task changes: at least one change is required");
  for (const key of keys) {
    if (key !== "text" && key !== "status") {
      throw new TypeError(`Invalid task change: unknown field \"${key}\"`);
    }
  }

  const validated: { text?: string; status?: TaskStatus } = {};
  if (keys.includes("text")) {
    validated.text = normalizeTaskText(changes.text);
  }
  if (keys.includes("status")) {
    assertTaskStatus(changes.status);
    validated.status = changes.status;
  }
  return validated;
}

function parseTaskFile(contents: string): Task[] {
  let value: unknown;
  try {
    value = JSON.parse(contents);
  } catch (error) {
    throw new Error(`invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!Array.isArray(value)) throw new Error("task file must contain an array");

  const tasks: Task[] = [];
  let previousId: bigint | undefined;
  for (const [index, rawTask] of value.entries()) {
    if (!isRecord(rawTask)) throw new Error(`task ${index} must be an object`);
    const keys = Object.keys(rawTask).sort();
    if (keys.join(",") !== "id,status,text") {
      throw new Error(`task ${index} must contain only id, text, and status`);
    }
    assertTaskId(rawTask.id, index);
    const idNumber = BigInt(rawTask.id);
    if (previousId !== undefined && idNumber <= previousId) {
      throw new Error(`task ${index} identifiers must be in numeric order`);
    }
    previousId = idNumber;
    const text = normalizeTaskText(rawTask.text);
    assertTaskStatus(rawTask.status);
    tasks.push({ id: rawTask.id, text, status: rawTask.status });
  }
  return tasks;
}

function assertTaskId(value: unknown, index?: number): asserts value is string {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    const label = index === undefined ? "task identifier" : `task ${index} identifier`;
    throw new TypeError(`Invalid ${label}`);
  }
}

function normalizeTaskText(value: unknown): string {
  if (typeof value !== "string") {
    throw new TypeError("Invalid task text: must not be blank");
  }
  const text = value.replace(/\r\n?/g, "\n");
  if (text.trim() === "") {
    throw new TypeError("Invalid task text: must not be blank");
  }
  if (CONTROL_CHARACTERS.test(text)) {
    throw new TypeError("Invalid task text: contains a control character");
  }
  return text;
}

function assertTaskStatus(value: unknown): asserts value is TaskStatus {
  if (!TASK_STATUSES.includes(value as TaskStatus)) {
    throw new TypeError(`Invalid task status: ${String(value)}`);
  }
}

function copyTask(task: Task): Task {
  return { id: task.id, text: task.text, status: task.status };
}

function readyState(unsaved: boolean): TaskStoreState {
  return { kind: "ready", unsaved };
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function formatError(action: "load" | "save", error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return `Failed to ${action} tasks: ${detail}`;
}
