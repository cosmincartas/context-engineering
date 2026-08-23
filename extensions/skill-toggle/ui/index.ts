import { getSettingsListTheme, type ExtensionCommandContext, type Skill } from "@earendil-works/pi-coding-agent";
import { Container, SettingsList, Text, type SettingItem } from "@earendil-works/pi-tui";
import type { SkillSelection } from "../state/index.ts";

export async function showSkillToggle(
	ctx: Pick<ExtensionCommandContext, "getSystemPromptOptions" | "ui">,
	selection: SkillSelection,
): Promise<void> {
	const skills = (ctx.getSystemPromptOptions().skills ?? []) as Skill[];
	selection.sync(skills);
	const initial = selection.snapshot();
	const committed = new Map(initial.skills.map((item) => [item.name, item.selected]));

	await ctx.ui.custom((tui, _theme, _keybindings, done) => {
		const errorText = new Text(initial.error ? `error: ${initial.error}` : "");
		const items: SettingItem[] = initial.skills.map(({ name, selected }) => ({
			id: name,
			label: name,
			currentValue: selected ? "enabled" : "disabled",
			values: ["enabled", "disabled"],
		}));
		let pending = false;
		const list = new SettingsList(
			items,
			Math.min(items.length + 2, 15),
			getSettingsListTheme(),
			(id, newValue) => {
				const previous = committed.get(id) ?? false;
				if (pending) {
					list.updateValue(id, previous ? "enabled" : "disabled");
					return;
				}
				pending = true;
				void (async () => {
					try {
						await selection.setSelected(id, newValue === "enabled");
						const snapshot = selection.snapshot();
						if (snapshot.error) {
							list.updateValue(id, previous ? "enabled" : "disabled");
							errorText.setText(`error: ${snapshot.error}`);
						} else {
							committed.set(id, newValue === "enabled");
							errorText.setText("");
						}
					} catch (error) {
						list.updateValue(id, previous ? "enabled" : "disabled");
						const detail = error instanceof Error ? error.message : String(error);
						errorText.setText(`error: Failed to save skill selection: ${detail}`);
					} finally {
						pending = false;
						errorText.invalidate();
						list.invalidate();
						tui.requestRender();
					}
				})();
			},
			() => done(undefined),
			{ enableSearch: true },
		);
		const container = new Container();
		container.addChild(errorText);
		container.addChild(list);
		return {
			render: (width: number) => container.render(width),
			invalidate: () => container.invalidate(),
			handleInput: (data: string) => {
				list.handleInput(data);
				tui.requestRender();
			},
		};
	});
}
