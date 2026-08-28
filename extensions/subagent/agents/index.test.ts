import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, cp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  BUNDLED_AGENT_NAMES,
  loadBundledAgents,
  type AgentDefinition,
} from "./index.ts";

const bundledDirectory = new URL("./", import.meta.url);

function assertCatalog(definitions: readonly AgentDefinition[]): void {
  assert.deepEqual(
    definitions.map((definition) => definition.name),
    [...BUNDLED_AGENT_NAMES],
  );
  assert.deepEqual(definitions.map((definition) => definition.model), [
    "openai-codex/gpt-5.6-luna",
    "openai-codex/gpt-5.6-luna",
    "openai-codex/gpt-5.6-sol",
    "openai-codex/gpt-5.6-sol",
  ]);
  assert.deepEqual(definitions.map((definition) => definition.thinkingLevel), [
    "medium",
    "max",
    "xhigh",
    "xhigh",
  ]);
  const oracle = definitions.find((definition) => definition.name === "oracle");
  assert.ok(oracle);
  assert.doesNotMatch(oracle.systemPrompt, /\bbash\b/i);
  assert.deepEqual(definitions.map((definition) => [...definition.tools]), [
    ["read", "grep", "find", "ls", "mcp", "mcpScript", "web_search", "web_fetch"],
    ["read", "bash", "edit", "write", "grep", "find", "ls", "mcp", "mcpScript", "web_search", "web_fetch"],
    ["read", "grep", "find", "ls", "mcp", "mcpScript", "web_search", "web_fetch"],
    ["read", "bash", "grep", "find", "ls", "mcp", "mcpScript", "web_search", "web_fetch"],
  ]);
  for (const definition of definitions) {
    assert.notEqual(definition.description.trim(), "");
    assert.notEqual(definition.systemPrompt.trim(), "");
  }
}

test("loads exactly the four bundled agents with the validated mappings", async () => {
  const definitions = await loadBundledAgents(bundledDirectory);
  assertCatalog(definitions);
});

test("rejects a missing bundled agent file", async () => {
  const directory = await copyCatalog();
  await rm(path.join(directory, "scout.md"));

  await assert.rejects(loadBundledAgents(pathToDirectoryUrl(directory)), /scout\.md/);
});

test("rejects extra frontmatter fields and mismatched names", async () => {
  const extraFieldDirectory = await copyCatalog();
  const scoutPath = path.join(extraFieldDirectory, "scout.md");
  const scout = await readFile(scoutPath, "utf8");
  await writeFile(scoutPath, scout.replace("model: ", "unexpected: true\nmodel: "));
  await assert.rejects(loadBundledAgents(pathToDirectoryUrl(extraFieldDirectory)), /scout\.md/);

  const mismatchDirectory = await copyCatalog();
  const workerPath = path.join(mismatchDirectory, "worker.md");
  const worker = await readFile(workerPath, "utf8");
  await writeFile(workerPath, worker.replace("name: worker", "name: scout"));
  await assert.rejects(loadBundledAgents(pathToDirectoryUrl(mismatchDirectory)), /worker\.md/);
});

test("rejects blank prompts and invalid mapping fields", async () => {
  const directory = await copyCatalog();
  const oraclePath = path.join(directory, "oracle.md");
  const oracle = await readFile(oraclePath, "utf8");
  await writeFile(
    oraclePath,
    oracle
      .replace(
        "tools: [read, grep, find, ls, mcp, mcpScript, web_search, web_fetch]",
        "tools: [read, read, grep, find, ls, mcp, mcpScript, web_search, web_fetch]",
      )
      .replace(/\n[^]*$/, "\n"),
  );

  await assert.rejects(loadBundledAgents(pathToDirectoryUrl(directory)), /oracle\.md/);
});

async function copyCatalog(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pi-subagent-catalog-"));
  for (const name of BUNDLED_AGENT_NAMES) {
    await cp(new URL(`${name}.md`, bundledDirectory), path.join(directory, `${name}.md`));
  }
  return directory;
}

function pathToDirectoryUrl(directory: string): URL {
  return new URL(`file://${directory.replaceAll("\\", "/")}/`);
}
