import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
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
		event.systemPromptOptions.skills = skills
			.filter((skill) => selection.isSelected(skill.name))
			.map((skill) => ({ ...skill, disableModelInvocation: false }));
	});
}
