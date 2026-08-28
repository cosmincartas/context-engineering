import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import test from "node:test";

import { TaskStore, type Task } from "./index.ts";

const cwd = "/workspace/example";
const sessionId = "session-test";

async function withAgentDir(run: (agentDir: string) => Promise<void>): Promise<void> {
  const agentDir = await mkdtemp(join(tmpdir(), "pi-tasks-state-"));
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = agentDir;

  try {
    await run(agentDir);
  } finally {
    if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
    await chmod(agentDir, 0o700).catch(() => undefined);
    await rm(agentDir, { recursive: true, force: true });
  }
}

function taskPath(agentDir: string, workingDirectory: string, id: string): string {
  const workspaceKey = `--${resolve(workingDirectory)
    .replace(/^[/\\]/, "")
    .replace(/[/\\:]/g, "-")}--`;
  return join(agentDir, "tasks", "sessions", workspaceKey, `tasks-${id}.json`);
}

function assertTasks(actual: readonly Task[], expected: readonly Task[]): void {
  assert.deepEqual(actual, expected);
}

test("empty stores open persisted and ephemeral sessions as empty ready stores", async () => {
  await withAgentDir(async (agentDir) => {
    const persisted = await TaskStore.load(cwd, sessionId);
    assert.deepEqual(persisted.getState(), { kind: "ready", unsaved: false });
    assertTasks(persisted.list(), []);
    assert.deepEqual(await readdir(agentDir), []);

    const ephemeral = await TaskStore.load(cwd);
    assert.deepEqual(ephemeral.getState(), { kind: "ready", unsaved: false });
    assertTasks(ephemeral.list(), []);
    await ephemeral.create("memory only");
    assertTasks(ephemeral.list(), [{ id: "1", text: "memory only", status: "pending" }]);
    assert.deepEqual(await readdir(agentDir), []);
  });
});

test("durable task creation writes complete private state and reloads in numeric order", async () => {
  await withAgentDir(async (agentDir) => {
    const store = await TaskStore.load(cwd, sessionId);
    const first = await store.create("First task");
    const second = await store.create("Second task");
    const expected = [
      { id: "1", text: "First task", status: "pending" as const },
      { id: "2", text: "Second task", status: "pending" as const },
    ];
    const path = taskPath(agentDir, cwd, sessionId);

    assert.deepEqual(first, { task: expected[0] });
    assert.deepEqual(second, { task: expected[1] });
    assertTasks(store.list(), expected);
    assert.deepEqual(store.get("1"), expected[0]);
    assert.throws(() => store.get("missing"), /unknown task identifier/i);
    assert.deepEqual(JSON.parse(await readFile(path, "utf8")), expected);
    assert.equal((await stat(join(agentDir, "tasks"))).mode & 0o777, 0o700);
    assert.equal((await stat(join(agentDir, "tasks", "sessions"))).mode & 0o777, 0o700);
    assert.equal((await stat(join(path, ".."))).mode & 0o777, 0o700);
    assert.equal((await stat(path)).mode & 0o777, 0o600);

    const listed = store.list() as Task[];
    listed[0].text = "mutated copy";
    listed.push({ id: "3", text: "unowned", status: "completed" });
    const fetched = store.get("1") as Task;
    fetched.status = "completed";
    assertTasks(store.list(), expected);

    const reloaded = await TaskStore.load(cwd, sessionId);
    assertTasks(reloaded.list(), expected);
  });
});

test("valid task updates apply text, every status, combined changes, and multiple active tasks", async () => {
  await withAgentDir(async () => {
    const store = await TaskStore.load(cwd, sessionId);
    await store.create("First");
    await store.create("Second");
    await store.create("Third");

    assert.deepEqual(await store.update("1", { text: "Renamed" }), {
      task: { id: "1", text: "Renamed", status: "pending" },
    });
    assert.deepEqual(await store.update("1", { status: "active" }), {
      task: { id: "1", text: "Renamed", status: "active" },
    });
    assert.deepEqual(await store.update("2", { status: "active" }), {
      task: { id: "2", text: "Second", status: "active" },
    });
    const activeTasks = [
      { id: "1", text: "Renamed", status: "active" as const },
      { id: "2", text: "Second", status: "active" as const },
      { id: "3", text: "Third", status: "pending" as const },
    ];
    assertTasks(store.list(), activeTasks);
    assertTasks((await TaskStore.load(cwd, sessionId)).list(), activeTasks);
    assert.deepEqual(await store.update("2", { text: "Finished", status: "completed" }), {
      task: { id: "2", text: "Finished", status: "completed" },
    });
    assert.deepEqual(await store.update("3", { status: "pending" }), {
      task: { id: "3", text: "Third", status: "pending" },
    });

    const expected = [
      { id: "1", text: "Renamed", status: "active" as const },
      { id: "2", text: "Finished", status: "completed" as const },
      { id: "3", text: "Third", status: "pending" as const },
    ];
    assertTasks(store.list(), expected);
    assertTasks((await TaskStore.load(cwd, sessionId)).list(), expected);
  });
});

test("invalid mutations preserve memory and durable bytes", async () => {
  await withAgentDir(async (agentDir) => {
    const store = await TaskStore.load(cwd, sessionId);
    await store.create("Keep me");
    await store.create("Also keep me");
    const path = taskPath(agentDir, cwd, sessionId);
    const beforeTasks = store.list();
    const beforeBytes = await readFile(path);

    const invalidCreates = ["", "   ", "line\nbreak", "nul\u0000", "next\u0085"];
    for (const text of invalidCreates) {
      await assert.rejects(() => store.create(text), /invalid task text/i, text);
      assertTasks(store.list(), beforeTasks);
      assert.deepEqual(await readFile(path), beforeBytes, text);
    }

    await assert.rejects(() => store.update("1", { text: "  " }), /invalid task text/i);
    await assert.rejects(() => store.update("1", { text: "bad\u001b" }), /invalid task text/i);
    await assert.rejects(() => store.update("unknown", { text: "new" }), /unknown task identifier/i);
    await assert.rejects(() => store.update("1", {}), /at least one change/i);
    await assert.rejects(() => store.update("1", { status: "blocked" } as any), /invalid task status/i);
    await assert.rejects(() => store.update("1", { status: "" } as any), /invalid task status/i);
    await assert.rejects(() => store.update("1", { text: "new", extra: true } as any), /unknown field/i);

    assertTasks(store.list(), beforeTasks);
    assert.deepEqual(await readFile(path), beforeBytes);
  });
});

test("stored data errors block all operations and preserve bytes", async () => {
  await withAgentDir(async (agentDir) => {
    const invalidFiles = [
      ["invalid-json", "not json", /invalid JSON/i],
      ["invalid-root", "{}", /must contain an array/i],
      ["invalid-shape", "[1]", /must be an object/i],
      [
        "unknown-field",
        '[{"id":"1","text":"Task","status":"pending","extra":true}]',
        /only id, text, and status/i,
      ],
      ["invalid-identifier", '[{"id":"0","text":"Task","status":"pending"}]', /invalid task 0 identifier/i],
      [
        "unordered-identifiers",
        '[{"id":"2","text":"Second","status":"pending"},{"id":"1","text":"First","status":"pending"}]',
        /identifiers must be in numeric order/i,
      ],
    ] as const;

    for (const [id, contents, errorPattern] of invalidFiles) {
      const path = taskPath(agentDir, cwd, id);
      await mkdir(join(path, ".."), { recursive: true, mode: 0o700 });
      await writeFile(path, contents, { encoding: "utf8", mode: 0o600 });
      const beforeBytes = await readFile(path);
      const store = await TaskStore.load(cwd, id);

      assert.equal(store.getState().kind, "load-error", id);
      assert.throws(() => store.list(), errorPattern, id);
      assert.throws(() => store.get("1"), errorPattern, id);
      await assert.rejects(() => store.create("new"), errorPattern, id);
      await assert.rejects(() => store.update("1", { status: "completed" }), errorPattern, id);
      assert.deepEqual(await readFile(path), beforeBytes, id);
    }

    const readErrorPath = taskPath(agentDir, cwd, "read-error");
    await mkdir(readErrorPath, { recursive: true, mode: 0o700 });
    await writeFile(join(readErrorPath, "evidence"), "keep", "utf8");
    const readErrorStore = await TaskStore.load(cwd, "read-error");
    assert.equal(readErrorStore.getState().kind, "load-error");
    assert.throws(() => readErrorStore.list(), /failed to load tasks/i);
    assert.throws(() => readErrorStore.get("1"), /failed to load tasks/i);
    await assert.rejects(() => readErrorStore.create("new"), /failed to load tasks/i);
    await assert.rejects(() => readErrorStore.update("1", { text: "new" }), /failed to load tasks/i);
    assert.deepEqual(await readdir(readErrorPath), ["evidence"]);
  });
});

test("loads persisted task files with multiple active tasks", async () => {
  await withAgentDir(async (agentDir) => {
    const tasks = [
      { id: "1", text: "First", status: "active" as const },
      { id: "2", text: "Second", status: "active" as const },
    ];
    const path = taskPath(agentDir, cwd, "multiple-active");
    await mkdir(join(path, ".."), { recursive: true, mode: 0o700 });
    await writeFile(path, `${JSON.stringify(tasks)}\n`, { encoding: "utf8", mode: 0o600 });

    const store = await TaskStore.load(cwd, "multiple-active");
    assert.deepEqual(store.getState(), { kind: "ready", unsaved: false });
    assertTasks(store.list(), tasks);
  });
});

test("failed saves retain unsaved memory, preserve targets, and remove temporary files", async () => {
  await withAgentDir(async (agentDir) => {
    const temporaryFailure = await TaskStore.load(cwd, "temporary-failure");
    await temporaryFailure.create("Saved task");
    const temporaryPath = taskPath(agentDir, cwd, "temporary-failure");
    const temporaryParent = join(temporaryPath, "..");
    const beforeBytes = await readFile(temporaryPath);

    await chmod(temporaryParent, 0o500);
    try {
      const result = await temporaryFailure.create("Retained after temporary failure");
      assert.match(result.writeError ?? "", /failed to save tasks/i);
      assertTasks(temporaryFailure.list(), [
        { id: "1", text: "Saved task", status: "pending" },
        { id: "2", text: "Retained after temporary failure", status: "pending" },
      ]);
      assert.deepEqual(temporaryFailure.getState(), { kind: "ready", unsaved: true });
      assert.deepEqual(await readFile(temporaryPath), beforeBytes);
    } finally {
      await chmod(temporaryParent, 0o700);
    }
    assert.equal((await readdir(temporaryParent)).some((name) => name.endsWith(".tmp")), false);

    const renameFailure = await TaskStore.load(cwd, "rename-failure");
    await renameFailure.create("Saved task");
    const renamePath = taskPath(agentDir, cwd, "rename-failure");
    const renameParent = join(renamePath, "..");
    await rm(renamePath);
    await mkdir(renamePath, { recursive: true, mode: 0o700 });
    await writeFile(join(renamePath, "evidence"), "keep", "utf8");

    const result = await renameFailure.create("Retained after rename failure");
    assert.match(result.writeError ?? "", /failed to save tasks/i);
    assertTasks(renameFailure.list(), [
      { id: "1", text: "Saved task", status: "pending" },
      { id: "2", text: "Retained after rename failure", status: "pending" },
    ]);
    assert.deepEqual(renameFailure.getState(), { kind: "ready", unsaved: true });
    assert.deepEqual(await readdir(renamePath), ["evidence"]);
    assert.equal((await readdir(renameParent)).some((name) => name.endsWith(".tmp")), false);
  });
});

test("unsaved state clears on cancellation and on a later complete save", async () => {
  await withAgentDir(async (agentDir) => {
    const saveStore = await TaskStore.load(cwd, "complete-save");
    await saveStore.create("Initial task");
    const savePath = taskPath(agentDir, cwd, "complete-save");
    const saveParent = join(savePath, "..");
    await chmod(saveParent, 0o500);
    try {
      const failed = await saveStore.create("Retained task");
      assert.ok(failed.writeError);
    } finally {
      await chmod(saveParent, 0o700);
    }
    assert.deepEqual(saveStore.getState(), { kind: "ready", unsaved: true });
    const completed = await saveStore.create("Saved after failure");
    assert.deepEqual(completed, {
      task: { id: "3", text: "Saved after failure", status: "pending" },
    });
    assert.deepEqual(saveStore.getState(), { kind: "ready", unsaved: false });
    assert.deepEqual(JSON.parse(await readFile(savePath, "utf8")), saveStore.list());

    const cancelStore = await TaskStore.load(cwd, "cancel-failure");
    await cancelStore.create("Keep on disk");
    const cancelPath = taskPath(agentDir, cwd, "cancel-failure");
    const cancelParent = join(cancelPath, "..");
    const beforeCancel = await readFile(cancelPath);
    await chmod(cancelParent, 0o500);
    try {
      const failed = await cancelStore.create("Drop from memory");
      assert.ok(failed.writeError);
    } finally {
      await chmod(cancelParent, 0o700);
    }

    cancelStore.cancelFailedWrite();
    assert.deepEqual(cancelStore.list(), []);
    assert.deepEqual(cancelStore.getState(), { kind: "ready", unsaved: false });
    assert.deepEqual(await readFile(cancelPath), beforeCancel);

    const afterCancel = await cancelStore.create("Fresh task");
    assert.deepEqual(afterCancel, {
      task: { id: "1", text: "Fresh task", status: "pending" },
    });
    assert.deepEqual(cancelStore.getState(), { kind: "ready", unsaved: false });
    assert.deepEqual(JSON.parse(await readFile(cancelPath, "utf8")), cancelStore.list());
  });
});
