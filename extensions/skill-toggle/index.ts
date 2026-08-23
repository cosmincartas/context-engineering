import {
	formatSkillsForPrompt,
	type ExtensionAPI,
	type Skill,
} from "@earendil-works/pi-coding-agent";
import { loadSkillSelection, type SkillSelection } from "./state/index.ts";
import { showSkillToggle } from "./ui/index.ts";

export default function skillToggleExtension(pi: ExtensionAPI): void {
	let selection: SkillSelection | undefined;

	pi.on("session_start", async (_event, ctx) => {
		if (ctx.mode !== "tui") return;
		selection = await loadSkillSelection();
		pi.registerCommand("skill-toggle", {
			description: "Enable or disable discovered skills",
			handler: async (args, commandContext) => {
				if (commandContext.mode !== "tui") return;
				if (args.trim() !== "") {
					commandContext.ui.notify("/skill-toggle does not take arguments", "error");
					return;
				}
				const current = commandContext.getSystemPromptOptions().skills ?? [];
				selection?.sync(current);
				if (selection) await showSkillToggle(commandContext, selection);
			},
		});
	});

	pi.on("before_agent_start", async (event, ctx) => {
		if (ctx.mode !== "tui") return;
		if (!selection) selection = await loadSkillSelection();
		const skills = event.systemPromptOptions.skills ?? [];
		selection.sync(skills);
		if (!isReadActive(event.systemPromptOptions.selectedTools)) return;
		return { systemPrompt: filterSkillCatalog(event.systemPrompt, event.systemPromptOptions, selection) };
	});
}

function isReadActive(selectedTools: readonly string[] | undefined): boolean {
	return selectedTools === undefined || selectedTools.includes("read");
}

function filterSkillCatalog(
	systemPrompt: string,
	options: { cwd: string; skills?: Skill[] },
	selection: SkillSelection,
): string {
	const skills = options.skills ?? [];
	const sourceCatalog = formatSkillsForPrompt(skills);
	const selectedSkills = skills
		.filter((skill) => selection.isSelected(skill.name))
		.map((skill) => ({ ...skill, disableModelInvocation: false }));
	const selectedCatalog = formatSkillsForPrompt(selectedSkills);
	const marker = `\nCurrent working directory: ${options.cwd.replace(/\\/g, "/")}`;
	const markerIndex = systemPrompt.lastIndexOf(marker);
	if (markerIndex < 0) throw new Error("Skill Toggle could not find Pi's working-directory marker");

	if (sourceCatalog.length > 0) {
		const catalogStart = markerIndex - sourceCatalog.length;
		if (catalogStart < 0 || systemPrompt.slice(catalogStart, markerIndex) !== sourceCatalog) {
			throw new Error("Skill Toggle could not find Pi's canonical skill catalog");
		}
		return `${systemPrompt.slice(0, catalogStart)}${selectedCatalog}${systemPrompt.slice(markerIndex)}`;
	}

	return `${systemPrompt.slice(0, markerIndex)}${selectedCatalog}${systemPrompt.slice(markerIndex)}`;
}

export { filterSkillCatalog };
