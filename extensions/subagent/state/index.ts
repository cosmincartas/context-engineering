import { getAgentDir } from "@earendil-works/pi-coding-agent";
import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { basename, dirname, join } from "node:path";

const stateFileName = "subagent-config.json";
const roles = ["scout", "worker", "oracle", "reviewer"] as const;
const thinkingLevels: readonly ThinkingLevel[] = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];
const controls = /[\u0000-\u001F\u007F-\u009F]/;

export type ProfileRole = (typeof roles)[number];

export interface ProfileOverride {
  readonly provider: string;
  readonly model: string;
  readonly thinkingLevel: ThinkingLevel;
}

export interface ProfileSettings {
  readonly version: 1;
  readonly agents: Partial<Record<ProfileRole, ProfileOverride>>;
}

export interface ProfileSettingsSnapshot {
  readonly settings: ProfileSettings;
  readonly error?: string;
}

export interface ProfileSettingsStore {
  snapshot(): ProfileSettingsSnapshot;
  save(settings: ProfileSettings): Promise<void>;
}

class FileProfileSettings implements ProfileSettingsStore {
  private active: ProfileSettings;
  private error?: string;
  private readonly statePath: string;

  constructor(statePath: string, settings: ProfileSettings, error?: string) {
    this.statePath = statePath;
    this.active = settings;
    this.error = error;
  }

  snapshot(): ProfileSettingsSnapshot {
    const settings = copySettings(this.active);
    return this.error === undefined ? { settings } : { settings, error: this.error };
  }

  async save(settings: ProfileSettings): Promise<void> {
    let next: ProfileSettings;
    try {
      next = parseSettings(JSON.stringify(settings));
      await replaceState(this.statePath, next);
    } catch (error) {
      this.error = formatError("save", error);
      return;
    }
    this.active = next;
    this.error = undefined;
  }
}

export async function loadProfileSettings(): Promise<ProfileSettingsStore> {
  const statePath = join(getAgentDir(), stateFileName);
  try {
    return new FileProfileSettings(statePath, parseSettings(await fs.readFile(statePath, "utf8")));
  } catch (error) {
    if (isMissingFile(error)) return new FileProfileSettings(statePath, emptySettings());
    return new FileProfileSettings(statePath, emptySettings(), formatError("read", error, statePath));
  }
}

function parseSettings(contents: string): ProfileSettings {
  const value: unknown = JSON.parse(contents);
  if (!isRecord(value) || !hasOnly(value, ["version", "agents"]) || value.version !== 1 || !isRecord(value.agents)) {
    throw new Error("invalid version 1 profile settings");
  }
  const agents: Partial<Record<ProfileRole, ProfileOverride>> = {};
  for (const [role, override] of Object.entries(value.agents)) {
    if (!roles.includes(role as ProfileRole) || !isRecord(override) || !hasOnly(override, ["provider", "model", "thinkingLevel"])) {
      throw new Error("invalid version 1 profile settings");
    }
    if (!validText(override.provider) || !validText(override.model) || !thinkingLevels.includes(override.thinkingLevel as ThinkingLevel)) {
      throw new Error("invalid version 1 profile settings");
    }
    agents[role as ProfileRole] = {
      provider: override.provider,
      model: override.model,
      thinkingLevel: override.thinkingLevel as ThinkingLevel,
    };
  }
  return { version: 1, agents };
}

async function replaceState(statePath: string, settings: ProfileSettings): Promise<void> {
  const temporaryPath = join(dirname(statePath), `.${basename(statePath)}.${process.pid}.${randomUUID()}.tmp`);
  const contents = `${JSON.stringify(settings, null, 2)}\n`;
  try {
    await fs.writeFile(temporaryPath, contents, { encoding: "utf8", flag: "wx", mode: 0o600 });
    try {
      await fs.readFile(statePath, "utf8").then(parseSettings);
    } catch (error) {
      if (!isMissingFile(error)) throw error;
    }
    await fs.rename(temporaryPath, statePath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

function emptySettings(): ProfileSettings {
  return { version: 1, agents: {} };
}

function copySettings(settings: ProfileSettings): ProfileSettings {
  return { version: 1, agents: Object.fromEntries(Object.entries(settings.agents).map(([role, value]) => [role, { ...value }])) } as ProfileSettings;
}

function hasOnly(value: Record<string, unknown>, fields: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === fields.length && keys.every((key) => fields.includes(key));
}

function validText(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "" && !controls.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function formatError(action: "read" | "save", error: unknown, statePath?: string): string {
  const detail = error instanceof Error ? error.message : String(error);
  return action === "read"
    ? `Failed to read profile settings at ${statePath}: ${detail}. Repair or remove it before saving.`
    : `Failed to save profile settings: ${detail}`;
}
