import { StringEnum } from "@earendil-works/pi-ai";
import type { AgentToolResult, ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type, type Static } from "typebox";

import {
  TaskStore,
  type Task,
  type TaskChanges,
  type TaskMutationResult,
  type TaskStatus,
} from "./state/index.ts";
import { handleWriteFailure, TaskWidget } from "./ui/index.ts";

const TaskStatusSchema = StringEnum(["pending", "active", "completed"] as const);
const TaskCreateParameters = Type.Object(
  { text: Type.String() },
  { additionalProperties: false },
);
const TaskUpdateParameters = Type.Object(
  {
    id: Type.String(),
    text: Type.Optional(Type.String()),
    status: Type.Optional(TaskStatusSchema),
  },
  { additionalProperties: false },
);
const TaskListParameters = Type.Object({}, { additionalProperties: false });
const TaskGetParameters = Type.Object(
  { id: Type.String() },
  { additionalProperties: false },
);

type TaskCreateRequest = Static<typeof TaskCreateParameters>;
type TaskUpdateRequest = Static<typeof TaskUpdateParameters>;
type TaskGetRequest = Static<typeof TaskGetParameters>;

function serialized<T>(details: T): AgentToolResult<T> {
  return {
    content: [{ type: "text", text: JSON.stringify(details) }],
    details,
  };
}

function currentStore(store: TaskStore | undefined): TaskStore {
  if (store === undefined) throw new Error("Task store is not initialized");
  return store;
}

async function finishMutation(
  store: TaskStore,
  widget: TaskWidget | undefined,
  ctx: ExtensionContext,
  operation: () => Promise<TaskMutationResult>,
): Promise<AgentToolResult<Task>> {
  const result = await operation();
  if (result.writeError === undefined) {
    widget?.refresh();
    return serialized(result.task);
  }

  const choice = await handleWriteFailure(ctx, result.writeError);
  if (choice === "cancel") {
    store.cancelFailedWrite();
    widget?.refresh();
    throw new Error(
      `${result.writeError}; task mutation was cancelled in memory and stored tasks may return when the session resumes`,
    );
  }

  widget?.refresh();
  throw new Error(`${result.writeError}; task mutation was retained in memory and remains unsaved`);
}

export default function tasksExtension(pi: ExtensionAPI): void {
  let store: TaskStore | undefined;
  let widget: TaskWidget | undefined;

  pi.on("session_start", async (_event, ctx) => {
    widget?.dispose();
    widget = undefined;

    const sessionId = ctx.sessionManager.getSessionFile() === undefined
      ? undefined
      : ctx.sessionManager.getSessionId();
    store = await TaskStore.load(ctx.cwd, sessionId);
    const state = store.getState();
    if (state.kind === "load-error" && (ctx.mode === "tui" || ctx.mode === "rpc")) {
      ctx.ui.notify(state.error, "error");
    }
    if (ctx.mode === "tui") {
      widget = new TaskWidget(ctx.ui, store);
      widget.refresh();
    }
  });

  pi.on("session_tree", async (_event, _ctx) => {
    widget?.refresh();
  });

  pi.on("agent_start", async (_event, _ctx) => {
    widget?.setAgentRunning(true);
  });

  pi.on("agent_settled", async (_event, _ctx) => {
    widget?.setAgentRunning(false);
  });

  pi.on("session_shutdown", async (_event, _ctx) => {
    widget?.dispose();
    widget = undefined;
    store = undefined;
  });

  pi.registerTool({
    name: "TaskCreate",
    label: "TaskCreate",
    description: "Create a pending task for the current session.",
    executionMode: "sequential",
    parameters: TaskCreateParameters,
    async execute(_toolCallId, params: TaskCreateRequest, _signal, _onUpdate, ctx: ExtensionContext) {
      const activeStore = currentStore(store);
      return finishMutation(activeStore, widget, ctx, () => activeStore.create(params.text));
    },
  });

  pi.registerTool({
    name: "TaskUpdate",
    label: "TaskUpdate",
    description: "Update the text or status of a task in the current session.",
    executionMode: "sequential",
    parameters: TaskUpdateParameters,
    async execute(_toolCallId, params: TaskUpdateRequest, _signal, _onUpdate, ctx: ExtensionContext) {
      const changes: TaskChanges = {};
      if (params.text !== undefined) changes.text = params.text;
      if (params.status !== undefined) changes.status = params.status as TaskStatus;
      const activeStore = currentStore(store);
      return finishMutation(activeStore, widget, ctx, () => activeStore.update(params.id, changes));
    },
  });

  pi.registerTool({
    name: "TaskList",
    label: "TaskList",
    description: "List every task in the current session.",
    executionMode: "parallel",
    parameters: TaskListParameters,
    async execute(_toolCallId, _params, _signal, _onUpdate, _ctx: ExtensionContext) {
      return serialized(currentStore(store).list());
    },
  });

  pi.registerTool({
    name: "TaskGet",
    label: "TaskGet",
    description: "Get one task from the current session by identifier.",
    executionMode: "parallel",
    parameters: TaskGetParameters,
    async execute(_toolCallId, params: TaskGetRequest, _signal, _onUpdate, _ctx: ExtensionContext) {
      return serialized(currentStore(store).get(params.id));
    },
  });
}
