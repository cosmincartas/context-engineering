import assert from "node:assert/strict";
import { initTheme } from "@earendil-works/pi-coding-agent";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import extension from "./index.ts";

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

test("filters structured skill options without parsing Pi's rendered prompt", async () => {
	await withAgentDir(async (agentDir) => {
		await writeFile(
			join(agentDir, stateFileName),
			JSON.stringify({ version: 1, skills: { enabled: true, disabled: false, "manual-only": true } }),
		);
		const { handlers } = captureExtension();
		await handlers.get("session_start")!({ type: "session_start", reason: "startup" }, { mode: "tui" });
		const skills = [...options.skills, skill("manual-only", true)];
		const event = {
			systemPrompt: "Pi's rendered prompt format is opaque to extensions",
			systemPromptOptions: { ...options, skills },
		};

		const result = await handlers.get("before_agent_start")!(event, { mode: "tui" });

		assert.equal(result, undefined);
		assert.deepEqual(event.systemPromptOptions.skills.map((entry) => entry.name), ["enabled", "manual-only"]);
		assert.equal(event.systemPromptOptions.skills[1].disableModelInvocation, false);
		assert.equal(skills[2].disableModelInvocation, true);
	});
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
					const component = factory({ requestRender() {} }, {
						fg: (_color: string, text: string) => text,
						bold: (text: string) => text,
					}, {}, () => undefined);
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
			const beforeEvent = () => ({
				systemPrompt: "opaque",
				systemPromptOptions: { ...options, skills: discovered },
			});

			await sessionStart(sessionEvent, { mode: "tui" });
			const disabled = beforeEvent();
			await beforeAgentStart(disabled, { mode: "tui" });
			assert.deepEqual(disabled.systemPromptOptions.skills, [], reason);

			await writeFile(statePath, JSON.stringify({ version: 1, skills: { reloadable: true } }));
			await sessionStart(sessionEvent, { mode: "tui" });
			const enabled = beforeEvent();
			await beforeAgentStart(enabled, { mode: "tui" });
			assert.deepEqual(enabled.systemPromptOptions.skills.map((entry) => entry.name), ["reloadable"], reason);
		});
	}
});

test("leaves skill rendering to Pi when read is inactive", async () => {
	await withAgentDir(async (agentDir) => {
		await writeFile(
			join(agentDir, stateFileName),
			JSON.stringify({ version: 1, skills: { enabled: true, disabled: false } }),
		);
		const { handlers } = captureExtension();
		await handlers.get("session_start")!({ type: "session_start", reason: "startup" }, { mode: "tui" });
		const event = {
			systemPrompt: "unchanged",
			systemPromptOptions: { ...options, selectedTools: ["bash"] },
		};
		const result = await handlers.get("before_agent_start")!(event, { mode: "tui" });
		assert.equal(result, undefined);
		assert.deepEqual(event.systemPromptOptions.skills.map((entry) => entry.name), ["enabled"]);
	});
});
