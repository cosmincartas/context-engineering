import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import tasksExtension from "./index.ts";

type Tool = {
  name: string;
  label: string;
  description: string;
  parameters: Record<string, any>;
  executionMode?: string;
  execute: (...args: any[]) => Promise<any>;
};

function captureExtension() {
  const handlers = new Map<string, Function>();
  const tools = new Map<string, Tool>();
  tasksExtension({
    on(event: string, handler: Function) {
      handlers.set(event, handler);
    },
    registerTool(tool: Tool) {
      assert.equal(tools.has(tool.name), false, `duplicate tool ${tool.name}`);
      tools.set(tool.name, tool);
    },
  } as any);
  return { handlers, tools };
}

function context(options: {
  mode?: "tui" | "rpc" | "json" | "print";
  cwd?: string;
  sessionFile?: string;
  sessionId?: string;
  notices?: string[];
} = {}) {
  const notices = options.notices ?? [];
  return {
    mode: options.mode ?? "json",
    cwd: options.cwd ?? "/workspace/example",
    sessionManager: {
      getSessionFile: () => options.sessionFile,
      getSessionId: () => options.sessionId ?? "ephemeral-session",
    },
    ui: {
      setWidget() {},
      notify(message: string, level?: string) {
        notices.push(`${level ?? "info"}:${message}`);
      },
      async select() {
        return undefined;
      },
    },
  };
}

async function withAgentDir(run: (agentDir: string) => Promise<void>): Promise<void> {
  const agentDir = await mkdtemp(join(tmpdir(), "pi-tasks-index-"));
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = agentDir;
  try {
    await run(agentDir);
  } finally {
    if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
    await rm(agentDir, { recursive: true, force: true });
  }
}

function taskPath(agentDir: string, cwd: string, sessionId: string): string {
  const workspaceKey = `--${resolve(cwd).replace(/^[/\\\\]/, "").replace(/[/\\\\:]/g, "-")}--`;
  return join(agentDir, "tasks", "sessions", workspaceKey, `tasks-${sessionId}.json`);
}

async function startEphemeralSession(handlers: Map<string, Function>) {
  const ctx = context();
  await handlers.get("session_start")!({ type: "session_start", reason: "startup" }, ctx);
  return ctx;
}

test("model task tools register closed schemas and intended execution modes", () => {
  const { tools } = captureExtension();
  assert.deepEqual([...tools.keys()].sort(), ["TaskCreate", "TaskGet", "TaskList", "TaskUpdate"]);

  const create = tools.get("TaskCreate")!;
  assert.equal(create.label, "TaskCreate");
  assert.equal(create.parameters.additionalProperties, false);
  assert.deepEqual(create.parameters.required, ["text"]);
  assert.equal(create.parameters.properties.text.type, "string");
  assert.equal(create.executionMode, "sequential");

  const update = tools.get("TaskUpdate")!;
  assert.equal(update.parameters.additionalProperties, false);
  assert.deepEqual(update.parameters.required, ["id"]);
  assert.equal(update.parameters.properties.text.type, "string");
  assert.equal(update.parameters.properties.status.type, "string");
  assert.deepEqual(update.parameters.properties.status.enum, ["pending", "active", "completed"]);
  assert.equal(update.executionMode, "sequential");

  const list = tools.get("TaskList")!;
  assert.equal(list.parameters.additionalProperties, false);
  assert.equal(list.executionMode, "parallel");

  const get = tools.get("TaskGet")!;
  assert.equal(get.parameters.additionalProperties, false);
  assert.deepEqual(get.parameters.required, ["id"]);
  assert.equal(get.executionMode, "parallel");
});

test("session lifecycle restores UUID stores, isolates new and fork sessions, and reports load errors", async () => {
  await withAgentDir(async (agentDir) => {
    const { handlers, tools } = captureExtension();
    const oldContext = context({
      mode: "tui",
      sessionFile: "/sessions/old.jsonl",
      sessionId: "old-session",
    });
    await handlers.get("session_start")!({ type: "session_start", reason: "startup" }, oldContext);
    await tools.get("TaskCreate")!.execute("create", { text: "Restored task" }, undefined, undefined, oldContext);

    const reloaded = context({
      sessionFile: "/sessions/old.jsonl",
      sessionId: "old-session",
    });
    await handlers.get("session_start")!({ type: "session_start", reason: "reload" }, reloaded);
    assert.deepEqual(
      (await tools.get("TaskList")!.execute("list", {}, undefined, undefined, reloaded)).details,
      [{ id: "1", text: "Restored task", status: "pending" }],
    );

    for (const reason of ["new", "fork"] as const) {
      const fresh = context({
        sessionFile: `/sessions/${reason}.jsonl`,
        sessionId: `${reason}-session`,
      });
      await handlers.get("session_start")!({ type: "session_start", reason }, fresh);
      assert.deepEqual(
        (await tools.get("TaskList")!.execute("list", {}, undefined, undefined, fresh)).details,
        [],
      );
    }

    const invalidPath = taskPath(agentDir, "/workspace/example", "invalid-session");
    await mkdir(join(invalidPath, ".."), { recursive: true, mode: 0o700 });
    await writeFile(invalidPath, "not json", "utf8");
    const beforeBytes = await readFile(invalidPath);
    const notices: string[] = [];
    const invalidContext = context({
      mode: "tui",
      sessionFile: "/sessions/invalid.jsonl",
      sessionId: "invalid-session",
      notices,
    });
    await handlers.get("session_start")!(
      { type: "session_start", reason: "resume" },
      invalidContext,
    );
    assert.deepEqual(notices, ["error:Failed to load tasks: invalid JSON: Unexpected token 'o', \"not json\" is not valid JSON"]);
    await assert.rejects(
      tools.get("TaskList")!.execute("list", {}, undefined, undefined, invalidContext),
      /failed to load tasks/i,
    );
    assert.deepEqual(await readFile(invalidPath), beforeBytes);
  });
});

test("session lifecycle keeps --no-session tasks in memory without creating a task file", async () => {
  await withAgentDir(async (agentDir) => {
    const { handlers, tools } = captureExtension();
    const ctx = context({ sessionId: "ignored-session" });
    await handlers.get("session_start")!({ type: "session_start", reason: "startup" }, ctx);
    await tools.get("TaskCreate")!.execute("create", { text: "Memory task" }, undefined, undefined, ctx);
    assert.deepEqual(
      (await tools.get("TaskList")!.execute("list", {}, undefined, undefined, ctx)).details,
      [{ id: "1", text: "Memory task", status: "pending" }],
    );
    assert.deepEqual(await readdir(agentDir), []);
  });
});

test("integrated failed-write outcomes retain or cancel state in every mode", async () => {
  await withAgentDir(async (agentDir) => {
    const cases = [
      { mode: "tui" as const, id: "continue", choice: "Continue in memory" },
      { mode: "tui" as const, id: "cancel", choice: "Cancel" },
      { mode: "tui" as const, id: "dismiss", choice: undefined },
      { mode: "rpc" as const, id: "rpc", choice: undefined },
      { mode: "json" as const, id: "json", choice: undefined },
      { mode: "print" as const, id: "print", choice: undefined },
    ];

    for (const currentCase of cases) {
      const { handlers, tools } = captureExtension();
      const notices: string[] = [];
      const ctx: any = context({
        mode: currentCase.mode,
        sessionFile: `/sessions/${currentCase.id}.jsonl`,
        sessionId: `failed-${currentCase.id}`,
        notices,
      });
      let component: any;
      let selected: readonly string[] | undefined;
      if (currentCase.mode === "tui") {
        ctx.ui.setWidget = (_key: string, content: unknown) => {
          if (typeof content === "function") {
            component = content({ requestRender() {} }, {
              fg: (_color: string, text: string) => text,
              bold: (text: string) => text,
            });
          }
        };
        ctx.ui.select = async (_title: string, choices: readonly string[]) => {
          selected = choices;
          return currentCase.choice;
        };
      }

      await handlers.get("session_start")!({ type: "session_start", reason: "startup" }, ctx);
      await tools.get("TaskCreate")!.execute("create", { text: "On disk" }, undefined, undefined, ctx);
      const path = taskPath(agentDir, "/workspace/example", `failed-${currentCase.id}`);
      const parent = join(path, "..");
      const beforeBytes = await readFile(path);
      await chmod(parent, 0o500);
      try {
        await assert.rejects(
          tools.get("TaskCreate")!.execute(
            "create",
            { text: "Failed mutation" },
            undefined,
            undefined,
            ctx,
          ),
          (error: unknown) => {
            assert.match(String(error), /failed to save tasks/i);
            if (currentCase.mode === "tui" && currentCase.choice === "Continue in memory") {
              assert.match(String(error), /retained in memory/i);
            } else if (currentCase.mode === "tui") {
              assert.match(String(error), /cancelled/i);
            } else {
              assert.match(String(error), /retained in memory/i);
            }
            return true;
          },
        );

        assert.deepEqual(await readFile(path), beforeBytes);
        const listed = await tools.get("TaskList")!.execute("list", {}, undefined, undefined, ctx);
        if (currentCase.mode === "tui" && currentCase.choice !== "Continue in memory") {
          assert.deepEqual(listed.details, []);
          assert.match(notices.join("\\n"), /stored tasks may return when the session resumes/i);
          assert.equal(component.render(100)[0].includes("[unsaved]"), false);
        } else {
          assert.deepEqual(listed.details, [
            { id: "1", text: "On disk", status: "pending" },
            { id: "2", text: "Failed mutation", status: "pending" },
          ]);
          if (currentCase.mode === "tui") {
            assert.deepEqual(selected, ["Continue in memory", "Cancel"]);
            assert.match(component.render(100)[0], /\[unsaved\]/);
            assert.deepEqual(notices.map((notice) => notice.split(":", 1)[0]), ["error"]);
          } else {
            assert.deepEqual(notices, []);
          }
        }
      } finally {
        await chmod(parent, 0o700);
      }

      if (currentCase.mode === "tui" && currentCase.choice === "Continue in memory") {
        await tools.get("TaskUpdate")!.execute(
          "update",
          { id: "2", status: "completed" },
          undefined,
          undefined,
          ctx,
        );
        assert.equal(component.render(100)[0].includes("[unsaved]"), false);
      }
    }
  });
});

test("widget synchronization restores, refreshes mutations and tree navigation, tracks agent work, and shuts down", async () => {
  await withAgentDir(async () => {
    const { handlers, tools } = captureExtension();
  const ctx: any = context({
    mode: "tui",
    sessionFile: "/sessions/widget.jsonl",
    sessionId: "widget-session",
  });
  let widgetCalls = 0;
  let registeredFactory: Function | undefined;
  let renderRequests = 0;
  ctx.ui.setWidget = (_key: string, content: unknown) => {
    widgetCalls += 1;
    if (typeof content === "function") registeredFactory = content;
  };

  await handlers.get("session_start")!({ type: "session_start", reason: "startup" }, ctx);
  assert.equal(widgetCalls, 1);
  assert.ok(registeredFactory);
  const component = registeredFactory!({ requestRender: () => { renderRequests += 1; } }, {
    fg: (_color: string, text: string) => text,
    bold: (text: string) => text,
  });
  assert.equal(component.render(100).length, 1);

  await tools.get("TaskCreate")!.execute("create", { text: "Visible task" }, undefined, undefined, ctx);
  assert.match(component.render(100).join("\\n"), /Visible task/);
  assert.ok(renderRequests > 0);
  const afterCreate = renderRequests;

  await handlers.get("session_tree")!({ type: "session_tree" }, ctx);
  assert.ok(renderRequests > afterCreate);
  const afterTree = renderRequests;

  await tools.get("TaskUpdate")!.execute(
    "update",
    { id: "1", status: "active" },
    undefined,
    undefined,
    ctx,
  );
  await handlers.get("agent_start")!({ type: "agent_start" }, ctx);
  assert.match(component.render(100).join("\\n"), /⠋ #1 Visible task/);
  const afterAgentStart = renderRequests;
  await new Promise((resolve) => setTimeout(resolve, 180));
  assert.ok(renderRequests > afterAgentStart);

  await handlers.get("agent_settled")!({ type: "agent_settled" }, ctx);
  assert.match(component.render(100).join("\\n"), /▪ #1 Visible task/);
  const afterSettled = renderRequests;
  await new Promise((resolve) => setTimeout(resolve, 180));
  assert.equal(renderRequests, afterSettled);
  assert.ok(afterTree > afterCreate);

  await handlers.get("session_shutdown")!({ type: "session_shutdown", reason: "quit" }, ctx);
  assert.equal(widgetCalls, 2);
  const afterShutdown = renderRequests;
  await new Promise((resolve) => setTimeout(resolve, 180));
    assert.equal(renderRequests, afterShutdown);
  });
});

test("model task tools create, update, list, and get records in an ephemeral store", async () => {
  const { handlers, tools } = captureExtension();
  const ctx = await startEphemeralSession(handlers);

  const created = await tools.get("TaskCreate")!.execute("create", { text: "First task" }, undefined, undefined, ctx);
  assert.deepEqual(created.details, { id: "1", text: "First task", status: "pending" });
  assert.deepEqual(JSON.parse(created.content[0].text), created.details);

  const updated = await tools.get("TaskUpdate")!.execute(
    "update",
    { id: "1", status: "active", text: "Working task" },
    undefined,
    undefined,
    ctx,
  );
  assert.deepEqual(updated.details, { id: "1", text: "Working task", status: "active" });

  const listed = await tools.get("TaskList")!.execute("list", {}, undefined, undefined, ctx);
  assert.deepEqual(listed.details, [updated.details]);
  assert.deepEqual(JSON.parse(listed.content[0].text), listed.details);

  const fetched = await tools.get("TaskGet")!.execute("get", { id: "1" }, undefined, undefined, ctx);
  assert.deepEqual(fetched.details, updated.details);
  await assert.rejects(
    tools.get("TaskGet")!.execute("get", { id: "missing" }, undefined, undefined, ctx),
    /unknown task identifier/i,
  );
});
