import assert from "node:assert/strict";
import { formatSkillsForPrompt, initTheme } from "@earendil-works/pi-coding-agent";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

const stateFileName = "skill-toggle.json";

async function withAgentDir(run: (agentDir: string) => Promise<void>) {
	const agentDir = await mkdtemp(join(tmpdir(), "skill-toggle-root-"));
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

function captureExtension() {
	const handlers = new Map<string, Function>();
	const commands = new Map<string, { handler: Function }>();
	extension({
		on(event: string, handler: Function) { handlers.set(event, handler); },
		registerCommand(name: string, command: { handler: Function }) { commands.set(name, command); },
	} as never);
	return { handlers, commands };
}

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
	await handlers.get("session_start")!({ type: "session_start", reason: "startup" }, { mode: "rpc" });
	assert.deepEqual(commands, []);
	await handlers.get("session_start")!({ type: "session_start", reason: "startup" }, { mode: "tui" });
	assert.deepEqual(commands, ["skill-toggle"]);
});

test("validates command arguments and opens with the current skill list", async () => {
	await withAgentDir(async (agentDir) => {
		await writeFile(
			join(agentDir, stateFileName),
			JSON.stringify({ version: 1, skills: { current: false } }),
		);
		initTheme("dark");
		const { handlers, commands } = captureExtension();
		await handlers.get("session_start")!({ type: "session_start", reason: "startup" }, { mode: "tui" });
		const command = commands.get("skill-toggle");
		assert.ok(command);
		const currentSkills = [skill("current"), skill("new-skill")];
		const notifications: string[] = [];
		let opened = false;
		let rendered: string[] = [];
		const commandContext = {
			mode: "tui",
			getSystemPromptOptions: () => ({ skills: currentSkills }),
			ui: {
				notify(message: string) { notifications.push(message); },
				custom: async (factory: Function) => {
					opened = true;
					const component = factory({ requestRender() {} }, {}, {}, () => undefined);
					rendered = component.render(100);
				},
			},
		};

		await command.handler("unexpected", commandContext);
		assert.deepEqual(notifications, ["/skill-toggle does not take arguments"]);
		assert.equal(opened, false);

		await command.handler("", commandContext);
		assert.equal(opened, true);
		assert.match(rendered.join("\n"), /current/);
		assert.match(rendered.join("\n"), /disabled/);
		assert.match(rendered.join("\n"), /new-skill/);
		assert.match(rendered.join("\n"), /enabled/);
	});
});

test("reloads selection for startup, reload, new, resume, and fork session starts", async () => {
	for (const reason of ["startup", "reload", "new", "resume", "fork"] as const) {
		await withAgentDir(async (agentDir) => {
			const statePath = join(agentDir, stateFileName);
			const discovered = [skill("reloadable")];
			await writeFile(statePath, JSON.stringify({ version: 1, skills: { reloadable: false } }));
			const { handlers } = captureExtension();
			const sessionStart = handlers.get("session_start")!;
			const beforeAgentStart = handlers.get("before_agent_start")!;
			const sessionEvent = { type: "session_start", reason, previousSessionFile: "previous-session.json" };
			const beforeEvent = {
				systemPrompt: `${formatSkillsForPrompt(discovered)}\nCurrent working directory: /tmp/project`,
				systemPromptOptions: { ...options, skills: discovered },
			};

			await sessionStart(sessionEvent, { mode: "tui" });
			const disabled = await beforeAgentStart(beforeEvent, { mode: "tui" });
			assert.doesNotMatch(disabled?.systemPrompt ?? "", /<name>reloadable<\/name>/, reason);

			await writeFile(statePath, JSON.stringify({ version: 1, skills: { reloadable: true } }));
			await sessionStart(sessionEvent, { mode: "tui" });
			const enabled = await beforeAgentStart(beforeEvent, { mode: "tui" });
			assert.match(enabled?.systemPrompt ?? "", /<name>reloadable<\/name>/, reason);
		});
	}
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
