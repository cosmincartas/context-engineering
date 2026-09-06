import { clampThinkingLevel, getSupportedThinkingLevels, type Model as PiModel } from "@earendil-works/pi-ai";
import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { ExtensionCommandContext, Theme } from "@earendil-works/pi-coding-agent";
import { Key, matchesKey, ScrollView, Text, truncateToWidth, visibleWidth, wrapTextWithAnsi, type Component, type TUI } from "@earendil-works/pi-tui";

import { BUNDLED_AGENT_NAMES, type AgentDefinition } from "../agents/index.ts";
import type { ProfileOverride, ProfileRole, ProfileSettings, ProfileSettingsStore } from "../state/index.ts";

type Model = { provider: string; id: string; reasoning: boolean; thinkingLevelMap?: Partial<Record<ThinkingLevel, unknown | null>> };
type Bundled = Pick<AgentDefinition, "name" | "model" | "thinkingLevel">;
type Draft = Partial<Record<ProfileRole, ProfileOverride>>;
type Screen = "roles" | "details" | "model-options" | "effort-options";

/** Keyboard-only configuration view. Kept independent of command registration for testability. */
export class SubagentConfiguration implements Component {
  private readonly models: readonly Model[];
  private readonly bundled: Readonly<Record<ProfileRole, Bundled>>;
  private readonly initial: Draft;
  private draft: Draft;
  private role = 0;
  private screen: Screen = "roles";
  private detail = 0; // model, effort, reset, save, cancel
  private optionIndex = 0;
  private query = "";
  private readonly readDiagnostic: string;
  private message = "";
  private saving = false;
  private manualScroll = false;
  private content: string[] = [];
  private readonly viewport = new ScrollView({ render: () => this.content, invalidate() {} }, { overscroll: "contain", scrollbar: "hidden" });

  private readonly tui: TUI;
  private readonly theme: Theme;
  private readonly store: ProfileSettingsStore;
  private readonly done: () => void;

  constructor(tui: TUI, theme: Theme, store: ProfileSettingsStore, done: () => void, models: readonly Model[], bundled: readonly Bundled[]) {
    this.tui = tui;
    this.theme = theme;
    this.store = store;
    this.done = done;
    const snapshot = store.snapshot();
    this.initial = copy(snapshot.settings.agents);
    this.draft = copy(snapshot.settings.agents);
    this.models = models;
    this.bundled = Object.fromEntries(bundled.map((agent) => [agent.name, agent])) as Readonly<Record<ProfileRole, Bundled>>;
    this.readDiagnostic = snapshot.error?.startsWith("Failed to read") ? snapshot.error : "";
    this.message = this.readDiagnostic ? "" : snapshot.error ?? "";
  }

  render(width: number): string[] {
    const renderWidth = Math.max(1, Math.floor(width));
    const tiny = renderWidth <= 4;
    const contentWidth = tiny ? renderWidth : renderWidth - 4;
    const narrow = contentWidth < 60;
    const role = BUNDLED_AGENT_NAMES[this.role];
    const value = this.draft[role];
    const effective = value ?? bundledOverride(this.bundled[role]);
    const lines: string[] = [];
    const detailMarker = (index: number) => this.screen === "details" && this.detail === index ? marker(true, tiny, contentWidth) : marker(false, tiny, contentWidth);
    const append = (line: string) => { const start = lines.length; lines.push(...wrapTextWithAnsi(line, contentWidth)); return start; };
    if (this.readDiagnostic) append(this.paint(`Error: ${this.readDiagnostic}`, "warning"));
    if (this.message) append(this.paint(`Error: ${this.message}`, "warning"));
    const notes = roleNotes(value, this.initial[role], this.bundled[role], this.models);
    const roleLines: number[] = [];
    let detailLines: number[] = [];
    const controls = [
      `${detailMarker(0)}Model: ${modelText(value, this.bundled[role])}`,
      `${detailMarker(1)}${reasoningText(effective, this.models)}`,
      ...notes,
      `${detailMarker(2)}Reset selected role`,
      `${detailMarker(3)}Save${this.readError() ? " (disabled)" : ""}`,
      `${detailMarker(4)}Cancel`,
    ];
    if (narrow) {
      for (const [i, name] of BUNDLED_AGENT_NAMES.entries()) roleLines.push(append(`${this.screen === "roles" && i === this.role ? marker(true, tiny, contentWidth) : marker(false, tiny, contentWidth)}${name}`));
      detailLines = controls.map(append);
    } else {
      const split = Math.max(20, Math.floor(contentWidth * .42));
      const detailWidth = contentWidth - split - 3;
      const roles = BUNDLED_AGENT_NAMES.map((name, i) => `${this.screen === "roles" && i === this.role ? "> " : "  "}${name[0]!.toUpperCase()}${name.slice(1)}`);
      for (let i = 0; i < Math.max(roles.length, controls.length); i++) {
        const left = wrapTextWithAnsi(roles[i] ?? "", split);
        const right = wrapTextWithAnsi(controls[i] ?? "", detailWidth);
        const start = lines.length;
        for (let j = 0; j < Math.max(left.length, right.length); j++) lines.push(`${(left[j] ?? "").padEnd(split)} │ ${right[j] ?? ""}`);
        if (i < roles.length) roleLines.push(start);
        if (i < controls.length) detailLines.push(start);
      }
    }
    const savingLine = this.saving ? append(this.paint("Saving...", "accent")) : undefined;
    const controlLines = [detailLines[0]!, detailLines[1]!, detailLines[notes.length + 2]!, detailLines[notes.length + 3]!, detailLines[notes.length + 4]!];
    let focusedLine = savingLine ?? (this.screen === "roles" ? roleLines[this.role]! : controlLines[this.detail]!);
    if (this.screen === "model-options" || this.screen === "effort-options") {
      const options = this.options();
      append(this.paint(`${this.screen === "model-options" ? "Model" : "Effort"} options${this.screen === "model-options" ? `: ${this.query}` : ""}`, "accent"));
      const start = Math.max(0, Math.min(this.optionIndex - 2, options.length - 5));
      const shown = options.slice(start, start + 5);
      let optionLine = lines.length;
      for (const [i, option] of shown.entries()) {
        const line = append(`${start + i === this.optionIndex ? marker(true, tiny, contentWidth) : marker(false, tiny, contentWidth)}${option}`);
        if (start + i === this.optionIndex) optionLine = line;
      }
      if (!shown.length) optionLine = append(this.screen === "model-options" ? this.models.length ? "  No matching models" : "  No authenticated models available. Authenticate a provider and reopen /subagent-config" : "  No supported effort levels");
      if (options.length > 5) append(`  (${this.optionIndex + 1}/${options.length})`);
      focusedLine = optionLine;
    }
    this.content = lines;
    const border = (text: string) => this.theme.fg("accent", text);
    const frame = tiny ? (line: string) => truncateToWidth(line, contentWidth, "", true) : (line: string) => `${border("│")} ${truncateToWidth(line, contentWidth, "", true)} ${border("│")}`;
    const title = tiny ? "" : truncateToWidth(` ${this.theme.bold?.("Subagent configuration") ?? "Subagent configuration"} `, renderWidth - 2);
    const left = tiny ? "" : "─".repeat(Math.floor((renderWidth - 2 - visibleWidth(title)) / 2));
    const right = tiny ? "" : "─".repeat(renderWidth - 2 - visibleWidth(title) - left.length);
    const maxHeight = this.tui.terminal?.rows === undefined ? Number.MAX_SAFE_INTEGER : Math.max(1, Math.floor(this.tui.terminal.rows * .8));
    const chrome = !tiny && maxHeight >= 3;
    const top = chrome ? [`${border(`╭${left}`)}${title}${border(`${right}╮`)}`] : [];
    const bottom = chrome ? [border(`╰${"─".repeat(renderWidth - 2)}╯`)] : [];
    const help = this.screen.endsWith("options") ? "↑↓ select  enter choose  esc cancel" : this.screen === "roles" ? "↑↓ select role  enter details  pgup/pgdn scroll  esc close" : "↑↓ select  enter activate  pgup/pgdn scroll  esc roles";
    let footerLines = chrome ? new Text(help, 0, 0).render(contentWidth) : [];
    if (top.length + footerLines.length + bottom.length + 1 > maxHeight) footerLines = [];
    const height = Math.min(this.content.length, Math.max(1, maxHeight - top.length - footerLines.length - bottom.length));
    this.viewport.updateLayout(this.content.length, height, () => this.tui.requestRender());
    if (!this.manualScroll) {
      if (focusedLine < this.viewport.scrollTop) this.viewport.scrollTo(focusedLine);
      else if (focusedLine >= this.viewport.scrollTop + height) this.viewport.scrollTo(focusedLine - height + 1);
    }
    return [...top, ...this.content.slice(this.viewport.scrollTop, this.viewport.scrollTop + height).map(frame), ...footerLines.map(frame), ...bottom];
  }

  invalidate(): void {}
  handleInput(data: string): void {
    if (this.saving) return;
    if (matchesKey(data, Key.escape)) return this.escape();
    if (this.screen === "model-options" || this.screen === "effort-options") return this.optionInput(data);
    const pageUp = matchesKey(data, Key.pageUp);
    const pageDown = matchesKey(data, Key.pageDown);
    if (pageUp || pageDown) {
      this.manualScroll = true;
      this.viewport.scrollBy((pageUp ? -1 : 1) * Math.max(1, this.viewport.viewportHeight - 2));
      return this.refresh();
    }
    if (matchesKey(data, Key.up) || matchesKey(data, Key.down)) {
      this.manualScroll = false;
      const delta = matchesKey(data, Key.up) ? -1 : 1;
      if (this.screen === "roles") this.role = (this.role + delta + BUNDLED_AGENT_NAMES.length) % BUNDLED_AGENT_NAMES.length;
      else this.detail = (this.detail + delta + 5) % 5;
      return this.refresh();
    }
    if (!matchesKey(data, Key.enter)) return;
    this.manualScroll = false;
    if (this.screen === "roles") this.screen = "details";
    else if (this.detail === 0) { this.screen = "model-options"; this.optionIndex = 0; this.query = ""; }
    else if (this.detail === 1) { this.screen = "effort-options"; this.optionIndex = this.efforts().indexOf(effectiveOverride(this.draft[BUNDLED_AGENT_NAMES[this.role]], this.bundled[BUNDLED_AGENT_NAMES[this.role]]).thinkingLevel); if (this.optionIndex < 0) this.optionIndex = 0; }
    else if (this.detail === 2) delete this.draft[BUNDLED_AGENT_NAMES[this.role]];
    else if (this.detail === 3) void this.save();
    else this.done();
    this.refresh();
  }

  private escape(): void {
    if (this.screen.endsWith("options")) { this.screen = "details"; this.manualScroll = false; }
    else if (this.screen === "details") { this.screen = "roles"; this.manualScroll = false; }
    else this.done();
    this.refresh();
  }

  private optionInput(data: string): void {
    const options = this.options();
    if (matchesKey(data, Key.up) || matchesKey(data, Key.down)) {
      if (options.length) this.optionIndex = (this.optionIndex + (matchesKey(data, Key.up) ? -1 : 1) + options.length) % options.length;
    } else if (this.screen === "model-options" && matchesKey(data, Key.backspace)) { this.query = this.query.slice(0, -1); this.optionIndex = 0; }
    else if (matchesKey(data, Key.enter)) {
      const option = options[this.optionIndex];
      if (option) {
        if (this.screen === "model-options") this.select(this.filtered()[this.optionIndex]!);
        else this.selectEffort(option as ThinkingLevel);
        this.screen = "details";
      }
    } else if (this.screen === "model-options" && data.length === 1 && data >= " ") { this.query += data; this.optionIndex = 0; }
    this.refresh();
  }

  private options(): readonly string[] { return this.screen === "model-options" ? this.filtered().map((model) => `${model.provider}/${model.id}`) : this.efforts(); }
  private efforts(): ThinkingLevel[] {
    const value = effectiveOverride(this.draft[BUNDLED_AGENT_NAMES[this.role]], this.bundled[BUNDLED_AGENT_NAMES[this.role]]);
    const model = this.models.find((candidate) => candidate.provider === value.provider && candidate.id === value.model);
    return model ? getSupportedThinkingLevels(model as PiModel<any>) as ThinkingLevel[] : [];
  }
  private select(model: Model): void {
    const role = BUNDLED_AGENT_NAMES[this.role];
    const previous = effectiveOverride(this.draft[role], this.bundled[role]);
    const thinkingLevel = clampThinkingLevel(model as PiModel<any>, previous.thinkingLevel) as ThinkingLevel;
    this.draft[role] = { provider: model.provider, model: model.id, thinkingLevel };
    if (previous.thinkingLevel !== thinkingLevel) this.message = `Reasoning adjusted to ${thinkingLevel} for ${model.provider}/${model.id}`;
  }
  private selectEffort(thinkingLevel: ThinkingLevel): void {
    const role = BUNDLED_AGENT_NAMES[this.role];
    this.draft[role] = { ...effectiveOverride(this.draft[role], this.bundled[role]), thinkingLevel };
  }

  private async save(): Promise<void> {
    if (this.readError()) return this.refresh();
    for (const role of BUNDLED_AGENT_NAMES) {
      const value = this.draft[role]; const original = this.initial[role];
      if (!value || same(value, original)) continue;
      const model = this.models.find((m) => m.provider === value.provider && m.id === value.model);
      if (!model) { this.message = `${role}: selected model is unavailable`; return this.refresh(); }
      if (!getSupportedThinkingLevels(model as PiModel<any>).includes(value.thinkingLevel)) { this.message = `${role}: reasoning is not supported by selected model`; return this.refresh(); }
    }
    this.saving = true; this.refresh();
    try {
      await this.store.save({ version: 1, agents: copy(this.draft) } satisfies ProfileSettings);
      const error = this.store.snapshot().error;
      if (error) { this.message = error; return; }
      this.done();
    } catch (error) { this.message = `Failed to save profile settings: ${error instanceof Error ? error.message : String(error)}`; }
    finally { this.saving = false; this.refresh(); }
  }

  private filtered(): readonly Model[] { const q = this.query.toLowerCase(); return this.models.filter((m) => `${m.provider}/${m.id}`.toLowerCase().includes(q)); }
  private readError(): boolean { return Boolean(this.readDiagnostic); }
  private paint(text: string, color: "accent" | "warning"): string { return this.theme.fg(color, text); }
  private refresh(): void { this.invalidate(); this.tui.requestRender(); }
}

export async function showSubagentConfiguration(ctx: Pick<ExtensionCommandContext, "ui" | "modelRegistry">, store: ProfileSettingsStore, bundled: readonly Bundled[]): Promise<void> {
  const models = ctx.modelRegistry.getAvailable() as Model[];
  await ctx.ui.custom((tui, theme, _keys, done) => new SubagentConfiguration(tui, theme, store, () => done(undefined), models, bundled), { overlay: true, overlayOptions: { anchor: "center", width: "70%", maxHeight: "80%", minWidth: 40 } });
}

function marker(selected: boolean, tiny: boolean, width: number): string { return selected ? tiny ? width === 1 ? "" : ">" : "> " : tiny ? "" : "  "; }
function modelText(value: ProfileOverride | undefined, bundled: Bundled): string { return value ? `${value.provider}/${value.model}` : bundled.model; }
function roleNotes(value: ProfileOverride | undefined, initial: ProfileOverride | undefined, bundled: Bundled, models: readonly Model[]): string[] {
  const effective = value ?? bundledOverride(bundled);
  const unavailable = !models.some((candidate) => candidate.provider === effective.provider && candidate.id === effective.model);
  const source = same(value, initial) ? value ? "saved" : "bundled" : "unsaved changes";
  return [`Source: ${source}`, ...(unavailable ? ["Unavailable: falls back to parent model/reasoning"] : [])];
}
function reasoningText(value: ProfileOverride, models: readonly Model[]): string {
  const model = models.find((candidate) => candidate.provider === value.provider && candidate.id === value.model);
  const supported = model ? getSupportedThinkingLevels(model as PiModel<any>) : [];
  return `Effort: ${value.thinkingLevel}${supported.length ? ` (${supported.join(", ")})` : " (model unavailable)"}`;
}
function bundledOverride(bundled: Bundled): ProfileOverride {
  const [provider, ...model] = bundled.model.split("/");
  return { provider: provider!, model: model.join("/"), thinkingLevel: bundled.thinkingLevel };
}
function effectiveOverride(value: ProfileOverride | undefined, bundled: Bundled): ProfileOverride { return value ?? bundledOverride(bundled); }
function same(left: ProfileOverride | undefined, right: ProfileOverride | undefined): boolean { return left?.provider === right?.provider && left?.model === right?.model && left?.thinkingLevel === right?.thinkingLevel; }
function copy(value: Draft): Draft { return Object.fromEntries(Object.entries(value).map(([role, item]) => [role, { ...item }])) as Draft; }
