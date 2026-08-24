import assert from "node:assert/strict";
import { initTheme } from "@earendil-works/pi-coding-agent";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadSkillSelection } from "../state/index.ts";
import { showSkillToggle } from "./index.ts";

function skill(name: string, disableModelInvocation = false) {
	return { name, description: `${name} description`, filePath: `/skills/${name}/SKILL.md`, baseDir: `/skills/${name}`, sourceInfo: {}, disableModelInvocation };
}

function contextFor(
	skills: ReturnType<typeof skill>[],
	custom: (factory: Function, options?: unknown) => Promise<void>,
) {
	return {
		getSystemPromptOptions: () => ({ skills }),
		ui: { custom },
	};
}

test("opens as a centered overlay dialog", async () => {
	let options: unknown;
	await showSkillToggle(
		contextFor([], async (_factory, customOptions) => {
			options = customOptions;
		}),
		{
			sync() {},
			isSelected() { return false; },
			snapshot() { return { skills: [] }; },
			async setSelected() {},
		},
	);
	assert.deepEqual(options, {
		overlay: true,
		overlayOptions: { anchor: "center", width: "70%", maxHeight: "80%", minWidth: 40 },
	});
});

test("shows searchable textual skill states and persists a toggle", async () => {
	const agentDir = await mkdtemp(join(tmpdir(), "skill-toggle-ui-"));
	const previous = process.env.PI_CODING_AGENT_DIR;
	process.env.PI_CODING_AGENT_DIR = agentDir;
	initTheme("dark");
	try {
		const selection = await loadSkillSelection();
		let component: { render(width: number): string[]; handleInput(data: string): void } | undefined;
		let rendered: string[] = [];
		await showSkillToggle(
			contextFor([skill("automatic"), skill("manual-only", true)], async (factory) => {
				component = factory({ requestRender() {} }, {}, {}, () => undefined);
				rendered = component!.render(100);
				component!.handleInput("\r");
				await new Promise((resolve) => setTimeout(resolve, 10));
			}),
			selection,
		);
		assert.match(rendered.join("\n"), /automatic/);
		assert.match(rendered.join("\n"), /enabled/);
		assert.match(rendered.join("\n"), /manual-only/);
		assert.match(rendered.join("\n"), /disabled/);
		assert.equal(selection.isSelected("automatic"), false);
	} finally {
		if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
		else process.env.PI_CODING_AGENT_DIR = previous;
		await rm(agentDir, { recursive: true, force: true });
	}
});

test("shows a failed-write error and restores the committed row", async () => {
	initTheme("dark");
	let component: { render(width: number): string[]; handleInput(data: string): void } | undefined;
	const selection = {
		sync() {},
		isSelected() { return true; },
		snapshot() { return { skills: [{ name: "one", selected: true }] }; },
		async setSelected() { throw new Error("read-only"); },
	};
	await showSkillToggle(
		contextFor([skill("one")], async (factory) => {
			const tui = { requestRender() {} };
			component = factory(tui, {}, {}, () => undefined);
			component!.handleInput("\r");
			await new Promise((resolve) => setTimeout(resolve, 10));
			assert.match(component!.render(100).join("\n"), /Failed to save skill selection: read-only/);
		}),
		selection,
	);
});

test("renders the committed value after repeated input during a delayed write", async () => {
	let releaseWrite!: () => void;
	let writeStarted!: () => void;
	const started = new Promise<void>((resolve) => {
		writeStarted = resolve;
	});
	const finished = new Promise<void>((resolve) => {
		releaseWrite = resolve;
	});
	const values = { one: true };
	const selection = {
		sync() {},
		isSelected(name: string) { return values[name as keyof typeof values] ?? false; },
		snapshot() { return { skills: [{ name: "one", selected: values.one }] }; },
		async setSelected(name: string, selected: boolean) {
			writeStarted();
			await finished;
			values[name as keyof typeof values] = selected;
		},
	};
	let rendered: string[] = [];

	await showSkillToggle(
		contextFor([skill("one")], async (factory) => {
			const component = factory({ requestRender() {} }, {}, {}, () => undefined) as { render(width: number): string[]; handleInput(data: string): void };
			component.handleInput("\r");
			await started;
			component.handleInput("\r");
			releaseWrite();
			await new Promise((resolve) => setTimeout(resolve, 10));
			rendered = component.render(100);
		}),
		selection,
	);

	assert.match(rendered.join("\n"), /one/);
	assert.match(rendered.join("\n"), /disabled/);
	assert.equal(values.one, false);
});

test("does not let a second toggle race the first write", async () => {
	let calls = 0;
	const values: Record<string, boolean> = { one: true, two: true };
	const selection = {
		sync() {},
		isSelected(name: string) { return values[name] ?? false; },
		snapshot() { return { skills: Object.entries(values).map(([name, selected]) => ({ name, selected })) }; },
		async setSelected(name: string, selected: boolean) {
			calls += 1;
			await new Promise((resolve) => setTimeout(resolve, 20));
			values[name] = selected;
		},
	};
	await showSkillToggle(
		contextFor([skill("one"), skill("two")], async (factory) => {
			const component = factory({ requestRender() {} }, {}, {}, () => undefined) as { handleInput(data: string): void };
			component.handleInput("\r");
			component.handleInput("\u001b[B");
			await new Promise((resolve) => setTimeout(resolve, 40));
		}),
		selection,
	);
	assert.equal(calls, 1);
});
