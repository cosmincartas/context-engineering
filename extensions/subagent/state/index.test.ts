import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { mock } from "node:test";

import { loadProfileSettings, type ProfileSettings } from "./index.ts";

const stateFileName = "subagent-config.json";
const worker = { provider: "openai-codex", model: "openai-codex/gpt-5.6-terra", thinkingLevel: "medium" as const };
const scout = { provider: "anthropic", model: "anthropic:claude/sonnet", thinkingLevel: "high" as const };
const oracle = { provider: "google", model: "google/gemini:pro", thinkingLevel: "xhigh" as const };
const reviewer = { provider: "openai", model: "openai/gpt-5", thinkingLevel: "low" as const };

async function withAgentDir(run: (agentDir: string) => Promise<void>) {
  const agentDir = await mkdtemp(join(tmpdir(), "subagent-profile-state-"));
  const previous = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = agentDir;
  try {
    await run(agentDir);
  } finally {
    if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previous;
    await rm(agentDir, { recursive: true, force: true });
  }
}

function config(agents: Record<string, unknown> = { worker }): ProfileSettings {
  return { version: 1, agents } as ProfileSettings;
}

test("missing state is an empty override and valid complete tuples persist", async () => {
  await withAgentDir(async (agentDir) => {
    const settings = await loadProfileSettings();
    assert.deepEqual(settings.snapshot(), { settings: config({}) });

    await settings.save(config({ worker, scout, oracle, reviewer }));
    assert.deepEqual(settings.snapshot(), { settings: config({ worker, scout, oracle, reviewer }) });
    assert.deepEqual(JSON.parse(await readFile(join(agentDir, stateFileName), "utf8")), config({ worker, scout, oracle, reviewer }));
  });
});

test("invalid documents are read errors and their bytes remain untouched", async () => {
  const invalid = [
    "{",
    JSON.stringify({ version: 2, agents: {} }),
    JSON.stringify({ version: 1, agents: {}, extra: true }),
    JSON.stringify({ version: 1, agents: { unknown: worker } }),
    JSON.stringify({ version: 1, agents: { worker: { ...worker, extra: true } } }),
    JSON.stringify({ version: 1, agents: { worker: { provider: "x" } } }),
    JSON.stringify({ version: 1, agents: { worker: { ...worker, provider: " \n" } } }),
    JSON.stringify({ version: 1, agents: { worker: { ...worker, model: "x\u0000y" } } }),
    JSON.stringify({ version: 1, agents: { worker: { ...worker, thinkingLevel: "maximum" } } }),
    JSON.stringify({ version: 1, agents: { worker: { ...worker, apiKey: "secret" } } }),
  ];
  for (const bytes of invalid) {
    await withAgentDir(async (agentDir) => {
      const statePath = join(agentDir, stateFileName);
      await writeFile(statePath, bytes);
      const settings = await loadProfileSettings();
      assert.deepEqual(settings.snapshot().settings, config({}));
      assert.match(settings.snapshot().error ?? "", /read profile settings/i);
      assert.equal(await readFile(statePath, "utf8"), bytes);
    });
  }
});

test("unreadable state is distinct from missing", async () => {
  await withAgentDir(async (agentDir) => {
    await mkdir(join(agentDir, stateFileName));
    const settings = await loadProfileSettings();
    assert.deepEqual(settings.snapshot().settings, config({}));
    assert.match(settings.snapshot().error ?? "", /read profile settings/i);
  });
});

test("restart and separate instances read persisted settings", async () => {
  await withAgentDir(async () => {
    const first = await loadProfileSettings();
    await first.save(config({ worker }));
    const second = await loadProfileSettings();
    const restarted = await loadProfileSettings();
    assert.deepEqual(second.snapshot(), { settings: config({ worker }) });
    assert.deepEqual(restarted.snapshot(), { settings: config({ worker }) });
  });
});

test("failed temp write or rename preserves bytes and active settings", async () => {
  await withAgentDir(async (agentDir) => {
    const statePath = join(agentDir, stateFileName);
    const original = JSON.stringify(config({ worker }));
    await writeFile(statePath, original);
    const settings = await loadProfileSettings();

    const write = mock.method(fs, "writeFile", async () => { throw new Error("disk full"); });
    try { await settings.save(config({ scout })); } finally { write.mock.restore(); }
    assert.equal(await readFile(statePath, "utf8"), original);
    assert.deepEqual(settings.snapshot().settings, config({ worker }));
    assert.match(settings.snapshot().error ?? "", /save profile settings/i);
    assert.deepEqual(await readdir(agentDir), [stateFileName]);

    const rename = mock.method(fs, "rename", async () => { throw new Error("rename blocked"); });
    try { await settings.save(config({ scout })); } finally { rename.mock.restore(); }
    assert.equal(await readFile(statePath, "utf8"), original);
    assert.deepEqual(settings.snapshot().settings, config({ worker }));
    assert.deepEqual(await readdir(agentDir), [stateFileName]);
  });
});

test("an invalid existing destination blocks replacement and sequential successful saves are last-wins", async () => {
  await withAgentDir(async (agentDir) => {
    const statePath = join(agentDir, stateFileName);
    const settings = await loadProfileSettings();
    await writeFile(statePath, "not JSON");
    await settings.save(config({ scout }));
    assert.equal(await readFile(statePath, "utf8"), "not JSON");
    assert.deepEqual(settings.snapshot().settings, config({}));

    await rm(statePath);
    const other = await loadProfileSettings();
    await settings.save(config({ worker }));
    await other.save(config({ scout }));
    assert.deepEqual((await loadProfileSettings()).snapshot(), { settings: config({ scout }) });
  });
});
