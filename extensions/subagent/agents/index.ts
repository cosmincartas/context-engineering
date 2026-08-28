import { readFile } from "node:fs/promises";

import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import { parseFrontmatter } from "@earendil-works/pi-coding-agent";

export const BUNDLED_AGENT_NAMES = ["scout", "worker", "oracle", "reviewer"] as const;

export type AgentName = (typeof BUNDLED_AGENT_NAMES)[number];
export type AgentToolName =
  | "read"
  | "bash"
  | "edit"
  | "write"
  | "grep"
  | "find"
  | "ls"
  | "mcp"
  | "mcpScript"
  | "web_search"
  | "web_fetch";
export type AgentModel = `${string}/${string}`;

export type AgentDefinition = {
  readonly name: AgentName;
  readonly description: string;
  readonly tools: readonly AgentToolName[];
  readonly model: AgentModel;
  readonly thinkingLevel: ThinkingLevel;
  readonly systemPrompt: string;
};

type AgentContract = {
  readonly tools: readonly AgentToolName[];
  readonly model: AgentModel;
  readonly thinkingLevel: ThinkingLevel;
};

type AgentFrontmatter = Record<string, unknown>;

const AGENT_CONTRACTS: Readonly<Record<AgentName, AgentContract>> = {
  scout: {
    tools: ["read", "grep", "find", "ls", "mcp", "mcpScript", "web_search", "web_fetch"],
    model: "openai-codex/gpt-5.6-luna",
    thinkingLevel: "medium",
  },
  worker: {
    tools: ["read", "bash", "edit", "write", "grep", "find", "ls", "mcp", "mcpScript", "web_search", "web_fetch"],
    model: "openai-codex/gpt-5.6-luna",
    thinkingLevel: "max",
  },
  oracle: {
    tools: ["read", "grep", "find", "ls", "mcp", "mcpScript", "web_search", "web_fetch"],
    model: "openai-codex/gpt-5.6-sol",
    thinkingLevel: "xhigh",
  },
  reviewer: {
    tools: ["read", "bash", "grep", "find", "ls", "mcp", "mcpScript", "web_search", "web_fetch"],
    model: "openai-codex/gpt-5.6-sol",
    thinkingLevel: "xhigh",
  },
};

const FRONTMATTER_FIELDS = [
  "version",
  "name",
  "description",
  "tools",
  "model",
  "thinkingLevel",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseAgent(name: AgentName, content: string): AgentDefinition {
  const normalized = content.replace(/\r\n?/g, "\n");
  if (!normalized.startsWith("---\n")) {
    throw new Error(`${name}.md is missing YAML frontmatter`);
  }

  const closingMarker = normalized.indexOf("\n---", 4);
  if (
    closingMarker < 0 ||
    (normalized.length > closingMarker + 4 && normalized[closingMarker + 4] !== "\n")
  ) {
    throw new Error(`${name}.md has unterminated YAML frontmatter`);
  }

  let parsed: { frontmatter: AgentFrontmatter; body: string };
  try {
    parsed = parseFrontmatter<AgentFrontmatter>(normalized);
  } catch (error) {
    throw new Error(`${name}.md has invalid YAML frontmatter`, { cause: error });
  }

  if (!isRecord(parsed.frontmatter)) {
    throw new Error(`${name}.md frontmatter must be an object`);
  }

  const fields = Object.keys(parsed.frontmatter);
  if (
    fields.length !== FRONTMATTER_FIELDS.length ||
    fields.some((field) => !FRONTMATTER_FIELDS.includes(field as (typeof FRONTMATTER_FIELDS)[number]))
  ) {
    throw new Error(`${name}.md has unexpected frontmatter fields`);
  }

  const frontmatter = parsed.frontmatter;
  if (frontmatter.version !== 1) throw new Error(`${name}.md version must be 1`);
  if (frontmatter.name !== name) throw new Error(`${name}.md name must be ${name}`);
  if (typeof frontmatter.description !== "string" || frontmatter.description.trim() === "") {
    throw new Error(`${name}.md description must be non-empty`);
  }
  if (typeof frontmatter.model !== "string") throw new Error(`${name}.md model must be a string`);
  if (typeof frontmatter.thinkingLevel !== "string") {
    throw new Error(`${name}.md thinkingLevel must be a string`);
  }
  const rawTools = frontmatter.tools;
  if (
    !Array.isArray(rawTools) ||
    rawTools.length === 0 ||
    !rawTools.every((tool): tool is AgentToolName =>
      typeof tool === "string" &&
      [
        "read",
        "bash",
        "edit",
        "write",
        "grep",
        "find",
        "ls",
        "mcp",
        "mcpScript",
        "web_search",
        "web_fetch",
      ].includes(tool),
    )
  ) {
    throw new Error(`${name}.md tools must be a list of known tool names`);
  }
  const tools = rawTools as AgentToolName[];
  if (tools.some((tool, index) => tools.indexOf(tool) !== index)) {
    throw new Error(`${name}.md tools must not contain duplicates`);
  }
  if (parsed.body.trim() === "") throw new Error(`${name}.md system prompt must be non-empty`);

  const contract = AGENT_CONTRACTS[name];
  if (frontmatter.model !== contract.model) {
    throw new Error(`${name}.md model does not match the bundled mapping`);
  }
  if (frontmatter.thinkingLevel !== contract.thinkingLevel) {
    throw new Error(`${name}.md thinkingLevel does not match the bundled mapping`);
  }
  if (
    tools.length !== contract.tools.length ||
    tools.some((tool, index) => tool !== contract.tools[index])
  ) {
    throw new Error(`${name}.md tools do not match the bundled mapping`);
  }

  return Object.freeze({
    name,
    description: frontmatter.description,
    tools: Object.freeze([...tools]),
    model: contract.model,
    thinkingLevel: contract.thinkingLevel,
    systemPrompt: parsed.body,
  });
}

export async function loadBundledAgents(
  agentDirectory: URL,
): Promise<readonly AgentDefinition[]> {
  const directory = agentDirectory.href.endsWith("/")
    ? agentDirectory
    : new URL(`${agentDirectory.href}/`);
  const definitions = await Promise.all(
    BUNDLED_AGENT_NAMES.map(async (name) => {
      const file = new URL(`${name}.md`, directory);
      let content: string;
      try {
        content = await readFile(file, "utf8");
      } catch (error) {
        throw new Error(`Unable to read bundled agent ${name}.md`, { cause: error });
      }
      return parseAgent(name, content);
    }),
  );

  const names = new Set(definitions.map((definition) => definition.name));
  if (names.size !== BUNDLED_AGENT_NAMES.length) {
    throw new Error("Bundled agent names must be unique");
  }
  return Object.freeze(definitions);
}
