import assert from "node:assert/strict";
import {
	chmod,
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { loadSkillSelection } from "./index.ts";

const stateFileName = "skill-toggle.json";

function skill(name: string, disableModelInvocation = false) {
	return { name, disableModelInvocation };
}

async function withAgentDir(run: (agentDir: string) => Promise<void>) {
	const agentDir = await mkdtemp(join(tmpdir(), "skill-toggle-state-"));
	const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
	process.env.PI_CODING_AGENT_DIR = agentDir;

	try {
		await run(agentDir);
	} finally {
		if (previousAgentDir === undefined) {
			delete process.env.PI_CODING_AGENT_DIR;
		} else {
			process.env.PI_CODING_AGENT_DIR = previousAgentDir;
		}
		await chmod(agentDir, 0o700).catch(() => undefined);
		await rm(agentDir, { recursive: true, force: true });
	}
}

test("a missing state file uses Pi's automatic and manual-only defaults", async () => {
	await withAgentDir(async () => {
		const selection = await loadSkillSelection();
		selection.sync([skill("automatic"), skill("manual-only", true)]);

		assert.deepEqual(selection.snapshot(), {
			skills: [
				{ name: "automatic", selected: true },
				{ name: "manual-only", selected: false },
			],
		});
		assert.equal(selection.isSelected("automatic"), true);
		assert.equal(selection.isSelected("manual-only"), false);

		const snapshot = selection.snapshot();
		snapshot.skills[0].selected = false;
		assert.equal(selection.isSelected("automatic"), true);
	});
});

test("saved values win and a change writes the complete selection", async () => {
	await withAgentDir(async (agentDir) => {
		const statePath = join(agentDir, stateFileName);
		await writeFile(
			statePath,
			JSON.stringify({
				version: 1,
				skills: { "saved-skill": false, "undiscovered-skill": true },
			}),
		);

		const selection = await loadSkillSelection();
		selection.sync([
			skill("saved-skill"),
			skill("new-automatic"),
			skill("new-manual", true),
		]);

		assert.deepEqual(selection.snapshot(), {
			skills: [
				{ name: "saved-skill", selected: false },
				{ name: "new-automatic", selected: true },
				{ name: "new-manual", selected: false },
			],
		});
		assert.equal(selection.isSelected("undiscovered-skill"), true);

		await selection.setSelected("new-automatic", false);

		assert.deepEqual(JSON.parse(await readFile(statePath, "utf8")), {
			version: 1,
			skills: {
				"saved-skill": false,
				"undiscovered-skill": true,
				"new-automatic": false,
				"new-manual": false,
			},
		});
		assert.equal(selection.isSelected("new-automatic"), false);
		assert.deepEqual(await readdir(agentDir), [stateFileName]);
	});
});

test("invalid state is rejected as a read failure", async () => {
	const invalidStates: Array<[string, string]> = [
		["malformed JSON", "{"],
		["missing version", JSON.stringify({ skills: {} })],
		["unknown version", JSON.stringify({ version: 2, skills: {} })],
		["missing skills", JSON.stringify({ version: 1 })],
		["array skills", JSON.stringify({ version: 1, skills: [] })],
		["extra data", JSON.stringify({ version: 1, skills: {}, extra: true })],
		["empty name", JSON.stringify({ version: 1, skills: { "": true } })],
		["uppercase name", JSON.stringify({ version: 1, skills: { Upper: true } })],
		["leading hyphen", JSON.stringify({ version: 1, skills: { "-start": true } })],
		["trailing hyphen", JSON.stringify({ version: 1, skills: { "end-": true } })],
		["consecutive hyphens", JSON.stringify({ version: 1, skills: { "two--parts": true } })],
		[
			"long name",
			JSON.stringify({ version: 1, skills: { ["a".repeat(65)]: true } }),
		],
		[
			"non-Boolean selection",
			JSON.stringify({ version: 1, skills: { valid: "true" } }),
		],
	];

	for (const [label, contents] of invalidStates) {
		await withAgentDir(async (agentDir) => {
			await writeFile(join(agentDir, stateFileName), contents);
			const selection = await loadSkillSelection();
			selection.sync([skill("automatic"), skill("manual-only", true)]);
			const snapshot = selection.snapshot();

			assert.deepEqual(
				snapshot.skills,
				[
					{ name: "automatic", selected: true },
					{ name: "manual-only", selected: true },
				],
				label,
			);
			assert.match(snapshot.error ?? "", /read skill selection/i, label);
			assert.deepEqual(Object.keys(snapshot).sort(), ["error", "skills"], label);
		});
	}
});

test("a filesystem read failure enables every discovered skill", async () => {
	await withAgentDir(async (agentDir) => {
		await mkdir(join(agentDir, stateFileName));
		const selection = await loadSkillSelection();
		selection.sync([skill("automatic"), skill("manual-only", true)]);

		assert.deepEqual(selection.snapshot().skills, [
			{ name: "automatic", selected: true },
			{ name: "manual-only", selected: true },
		]);
		assert.match(selection.snapshot().error ?? "", /read skill selection/i);
	});
});

test("a successful write recovers from a read failure", async () => {
	await withAgentDir(async (agentDir) => {
		const statePath = join(agentDir, stateFileName);
		await writeFile(statePath, "not JSON");
		const selection = await loadSkillSelection();
		selection.sync([skill("automatic"), skill("manual-only", true)]);

		await selection.setSelected("manual-only", false);

		assert.deepEqual(selection.snapshot(), {
			skills: [
				{ name: "automatic", selected: true },
				{ name: "manual-only", selected: false },
			],
		});
		assert.deepEqual(JSON.parse(await readFile(statePath, "utf8")), {
			version: 1,
			skills: { automatic: true, "manual-only": false },
		});
	});
});

test("a temporary write failure keeps the persisted and in-memory selection", async () => {
	await withAgentDir(async (agentDir) => {
		const statePath = join(agentDir, stateFileName);
		const original = JSON.stringify({ version: 1, skills: { saved: true } });
		await writeFile(statePath, original);
		const selection = await loadSkillSelection();
		selection.sync([skill("saved")]);
		await chmod(agentDir, 0o500);

		try {
			await selection.setSelected("saved", false);
			assert.equal(selection.isSelected("saved"), true);
			assert.match(selection.snapshot().error ?? "", /save skill selection/i);
			assert.equal(await readFile(statePath, "utf8"), original);
			assert.deepEqual(await readdir(agentDir), [stateFileName]);
		} finally {
			await chmod(agentDir, 0o700);
		}
	});
});

test("a failed rename does not commit the next selection", async () => {
	await withAgentDir(async (agentDir) => {
		const statePath = join(agentDir, stateFileName);
		await writeFile(statePath, JSON.stringify({ version: 1, skills: { saved: true } }));
		const selection = await loadSkillSelection();
		selection.sync([skill("saved")]);
		await rm(statePath);
		await mkdir(statePath);

		await selection.setSelected("saved", false);

		assert.equal(selection.isSelected("saved"), true);
		assert.match(selection.snapshot().error ?? "", /save skill selection/i);
		assert.deepEqual(await readdir(agentDir), [stateFileName]);
	});
});
