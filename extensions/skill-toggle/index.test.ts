import assert from "node:assert/strict";
import { formatSkillsForPrompt } from "@earendil-works/pi-coding-agent";
import test from "node:test";
import extension, { filterSkillCatalog } from "./index.ts";

function skill(name: string, disableModelInvocation = false) {
	return { name, description: `${name} description`, filePath: `/skills/${name}/SKILL.md`, baseDir: `/skills/${name}`, sourceInfo: {}, disableModelInvocation };
}

const options = {
	cwd: "/tmp/project",
	selectedTools: ["read"],
	skills: [skill("enabled"), skill("disabled")],
};

test("replaces only Pi's canonical catalog and leaves skill metadata untouched", () => {
	const source = formatSkillsForPrompt(options.skills);
	const prefix = "before";
	const suffix = "after";
	const prompt = `${prefix}${source}\nCurrent working directory: /tmp/project${suffix}`;
	const result = filterSkillCatalog(prompt, options, {
		isSelected: (name: string) => name === "enabled",
	} as never);

	assert.match(result, /<name>enabled<\/name>/);
	assert.doesNotMatch(result, /<name>disabled<\/name>/);
	assert.match(result, /^before/);
	assert.match(result, /after$/);
	assert.equal(options.skills[1].disableModelInvocation, false);
});

test("inserts a selected catalog when Pi's source catalog is empty", () => {
	const manualOnly = [skill("manual-only", true)];
	const result = filterSkillCatalog("prefix\nCurrent working directory: /tmp/project", { ...options, skills: manualOnly }, {
		isSelected: () => true,
	} as never);
	assert.match(result, /<name>manual-only<\/name>/);
});

test("rejects a prompt without Pi's canonical marker", () => {
	assert.throws(
		() => filterSkillCatalog("not a Pi prompt", options, { isSelected: () => true } as never),
		/canonical|working-directory/i,
	);
});

test("registers the command only after a TUI session starts", async () => {
	const handlers = new Map<string, Function>();
	const commands: string[] = [];
	extension({
		on(event: string, handler: Function) { handlers.set(event, handler); },
		registerCommand(name: string) { commands.push(name); },
	} as never);
	await handlers.get("session_start")!({}, { mode: "rpc" });
	assert.deepEqual(commands, []);
	await handlers.get("session_start")!({}, { mode: "tui" });
	assert.deepEqual(commands, ["skill-toggle"]);
});

test("does not filter prompts when read is inactive", async () => {
	const handlers = new Map<string, Function>();
	extension({
		on(event: string, handler: Function) { handlers.set(event, handler); },
	} as never);
	const prompt = "unchanged";
	const result = await handlers.get("before_agent_start")!({
		systemPrompt: prompt,
		systemPromptOptions: { ...options, selectedTools: ["bash"] },
	}, { mode: "tui" });
	assert.equal(result, undefined);
});
