import { getSettingsListTheme, type ExtensionCommandContext, type Skill } from "@earendil-works/pi-coding-agent";
import { Container, SettingsList, Text, truncateToWidth, visibleWidth, type SettingItem } from "@earendil-works/pi-tui";
import type { SkillSelection } from "../state/index.ts";

export async function showSkillToggle(
	ctx: Pick<ExtensionCommandContext, "getSystemPromptOptions" | "ui">,
	selection: SkillSelection,
): Promise<void> {
	const skills = (ctx.getSystemPromptOptions().skills ?? []) as Skill[];
	selection.sync(skills);
	const initial = selection.snapshot();
	const committed = new Map(initial.skills.map((item) => [item.name, item.selected]));

	await ctx.ui.custom((tui, theme, _keybindings, done) => {
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
							const committedValue = snapshot.skills.find((item) => item.name === id)?.selected ?? previous;
							committed.set(id, committedValue);
							list.updateValue(id, committedValue ? "enabled" : "disabled");
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
			render: (width: number) => {
				const renderWidth = Math.max(4, Math.floor(width));
				const contentWidth = renderWidth - 4;
				const border = (text: string) => theme.fg("accent", text);
				const frame = (line: string) => `${border("│")} ${truncateToWidth(line, contentWidth, "", true)} ${border("│")}`;
				const title = truncateToWidth(` ${theme.bold("Skills")} `, renderWidth - 2);
				const left = "─".repeat(Math.floor((renderWidth - 2 - visibleWidth(title)) / 2));
				const right = "─".repeat(renderWidth - 2 - visibleWidth(title) - left.length);
				const maxHeight = tui.terminal?.rows === undefined ? Number.MAX_SAFE_INTEGER : Math.max(3, Math.floor(tui.terminal.rows * 0.8));
				const body = container.render(contentWidth).slice(0, maxHeight - 2);
				return [
					`${border(`╭${left}`)}${title}${border(`${right}╮`)}`,
					...body.map(frame),
					border(`╰${"─".repeat(renderWidth - 2)}╯`),
				];
			},
			invalidate: () => container.invalidate(),
			handleInput: (data: string) => {
				list.handleInput(data);
				tui.requestRender();
			},
		};
	}, {
		overlay: true,
		overlayOptions: { anchor: "center", width: "70%", maxHeight: "80%", minWidth: 40 },
	});
}
