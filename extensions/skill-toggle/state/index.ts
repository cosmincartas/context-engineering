import { getAgentDir, type Skill } from "@earendil-works/pi-coding-agent";
import { randomUUID } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

const stateFileName = "skill-toggle.json";
const skillNamePattern = /^(?=.{1,64}$)[a-z0-9]+(?:-[a-z0-9]+)*$/;

type SelectableSkill = Pick<Skill, "name" | "disableModelInvocation">;

export interface SkillSelectionSnapshot {
	skills: Array<{ name: string; selected: boolean }>;
	error?: string;
}

export interface SkillSelection {
	sync(skills: readonly SelectableSkill[]): void;
	isSelected(name: string): boolean;
	snapshot(): SkillSelectionSnapshot;
	setSelected(name: string, selected: boolean): Promise<void>;
}

class FileSkillSelection implements SkillSelection {
	private skills: SelectableSkill[] = [];

	private readonly statePath: string;
	private saved: Map<string, boolean>;
	private readFailed: boolean;
	private error?: string;

	constructor(statePath: string, saved: Map<string, boolean>, readFailed: boolean, error?: string) {
		this.statePath = statePath;
		this.saved = saved;
		this.readFailed = readFailed;
		this.error = error;
	}

	sync(skills: readonly SelectableSkill[]): void {
		this.skills = skills.map(({ name, disableModelInvocation }) => ({
			name,
			disableModelInvocation,
		}));
	}

	isSelected(name: string): boolean {
		const skill = this.skills.find((candidate) => candidate.name === name);
		return this.resolve(name, skill?.disableModelInvocation ?? false);
	}

	snapshot(): SkillSelectionSnapshot {
		const skills = this.skills.map(({ name, disableModelInvocation }) => ({
			name,
			selected: this.resolve(name, disableModelInvocation),
		}));
		return this.error === undefined ? { skills } : { skills, error: this.error };
	}

	async setSelected(name: string, selected: boolean): Promise<void> {
		if (!skillNamePattern.test(name) || typeof selected !== "boolean") {
			this.error = "Failed to save skill selection: invalid selection";
			return;
		}

		const next = new Map(this.saved);
		for (const skill of this.skills) {
			if (skillNamePattern.test(skill.name)) {
				next.set(skill.name, this.resolve(skill.name, skill.disableModelInvocation));
			}
		}
		next.set(name, selected);

		try {
			await replaceState(this.statePath, next);
		} catch (error) {
			this.error = formatError("save", error);
			return;
		}

		this.saved = next;
		this.readFailed = false;
		this.error = undefined;
	}

	private resolve(name: string, disableModelInvocation: boolean): boolean {
		if (this.readFailed) return true;
		if (this.saved.has(name)) return this.saved.get(name)!;
		return !disableModelInvocation;
	}
}

export async function loadSkillSelection(): Promise<SkillSelection> {
	const statePath = join(getAgentDir(), stateFileName);

	try {
		const saved = parseState(await readFile(statePath, "utf8"));
		return new FileSkillSelection(statePath, saved, false);
	} catch (error) {
		if (isMissingFile(error)) {
			return new FileSkillSelection(statePath, new Map(), false);
		}
		return new FileSkillSelection(statePath, new Map(), true, formatError("read", error));
	}
}

function parseState(contents: string): Map<string, boolean> {
	const state: unknown = JSON.parse(contents);
	if (
		typeof state !== "object" ||
		state === null ||
		Array.isArray(state) ||
		Object.keys(state).length !== 2 ||
		!("version" in state) ||
		!("skills" in state) ||
		state.version !== 1 ||
		typeof state.skills !== "object" ||
		state.skills === null ||
		Array.isArray(state.skills)
	) {
		throw new Error("invalid version 1 state");
	}

	const skills = new Map<string, boolean>();
	for (const [name, selected] of Object.entries(state.skills)) {
		if (!skillNamePattern.test(name) || typeof selected !== "boolean") {
			throw new Error("invalid version 1 state");
		}
		skills.set(name, selected);
	}
	return skills;
}

async function replaceState(statePath: string, skills: Map<string, boolean>): Promise<void> {
	const temporaryPath = join(
		dirname(statePath),
		`.${basename(statePath)}.${process.pid}.${randomUUID()}.tmp`,
	);
	const contents = `${JSON.stringify(
		{ version: 1, skills: Object.fromEntries(skills) },
		null,
		2,
	)}\n`;

	try {
		await writeFile(temporaryPath, contents, { encoding: "utf8", flag: "wx", mode: 0o600 });
		await rename(temporaryPath, statePath);
	} catch (error) {
		await rm(temporaryPath, { force: true }).catch(() => undefined);
		throw error;
	}
}

function isMissingFile(error: unknown): boolean {
	return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function formatError(action: "read" | "save", error: unknown): string {
	const detail = error instanceof Error ? error.message : String(error);
	return `Failed to ${action} skill selection: ${detail}`;
}
