import fs from "node:fs/promises";
import os from "node:os";

import {
  AssistantMessageComponent,
  CustomEditor,
  SessionManager,
  ToolExecutionComponent,
  UserMessageComponent,
  getMarkdownTheme,
} from "@earendil-works/pi-coding-agent";
import type {
  ExtensionContext,
  ReadonlyFooterDataProvider,
  SessionMessageEntry,
  Theme,
} from "@earendil-works/pi-coding-agent";
import {
  CURSOR_MARKER,
  Key,
  matchesKey,
  truncateToWidth,
  visibleWidth,
  Container,
  ScrollView,
  Text,
  VStack,
  type Component,
  type EditorComponent,
  type Focusable,
  type TUI,
} from "@earendil-works/pi-tui";

import type { Message } from "@earendil-works/pi-ai";

import { normalizeTitle } from "./runtime.ts";
import type {
  ChildSessionState,
  MonitoredRun,
  ProcessAttempt,
  SubagentRun,
} from "./runtime.ts";

export type SubagentUIHandle = {
  readonly registry: SubagentRegistry;
  readonly footer: AgentFooter;
  onMonitorEvent(event: import("./runtime.ts").SubagentMonitorEvent): void;
  openChild(run: MonitoredRun): Promise<void>;
  dispose(): void;
};

export type FooterAction =
  | { readonly type: "none" }
  | { readonly type: "focusEditor" }
  | { readonly type: "openOrchestrator" }
  | { readonly type: "openChild"; readonly run: MonitoredRun };

const ZERO_USAGE = { inputTokens: 0, outputTokens: 0, contextTokens: 0 };

type CursorAwareEditor = EditorComponent & {
  getLines(): string[];
  getCursor(): { line: number; col: number };
  getPaddingX(): number;
  isShowingAutocomplete?(): boolean;
};

export class SubagentRegistry {
  private readonly runs = new Map<string, MonitoredRun>();
  private readonly listeners = new Set<() => void>();

  add(run: MonitoredRun): void {
    if (typeof run.runId !== "string" || run.runId.trim() === "") {
      throw new TypeError("Subagent run id must not be blank");
    }
    if (this.runs.has(run.runId)) {
      throw new Error(`Duplicate subagent run: ${run.runId}`);
    }
    this.runs.set(run.runId, copyMonitoredRun(run));
    this.notify();
  }

  update(run: MonitoredRun): void {
    if (!this.runs.has(run.runId)) {
      throw new Error(`Unknown subagent run: ${run.runId}`);
    }
    this.runs.set(run.runId, copyMonitoredRun(run));
    this.notify();
  }

  remove(runId: string): void {
    if (!this.runs.has(runId)) {
      throw new Error(`Unknown subagent run: ${runId}`);
    }
    this.runs.delete(runId);
    this.notify();
  }

  list(): readonly MonitoredRun[] {
    return [...this.runs.values()].map(copyMonitoredRun);
  }

  get(runId: string): MonitoredRun | undefined {
    const run = this.runs.get(runId);
    return run ? copyMonitoredRun(run) : undefined;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  clear(): void {
    if (this.runs.size === 0) return;
    this.runs.clear();
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}

export async function readChildSession(
  session: ChildSessionState,
): Promise<readonly Message[]> {
  if (!session.file) return [];
  const metadata = await fs.stat(session.file);
  if (metadata.size === 0) return [];
  const manager = SessionManager.open(session.file, os.tmpdir());
  return manager
    .getBranch()
    .filter((entry): entry is SessionMessageEntry => entry.type === "message")
    .map((entry) => entry.message)
    .filter((message): message is Message =>
      message.role === "user" || message.role === "assistant" || message.role === "toolResult",
    );
}

export function createAgentNavigationEditor(
  base: EditorComponent,
  footer: AgentFooter,
  registry: SubagentRegistry,
  onFooterAction: (action: FooterAction) => void,
): EditorComponent & Focusable {
  const editor = new AgentNavigationEditor(base, footer, registry, onFooterAction);
  footer.onAction = (action) => editor.handleFooterAction(action);
  return editor;
}

export function isCursorOnLastVisualLine(
  editor: CursorAwareEditor,
  width: number,
): boolean {
  if (!hasCursorMethods(editor)) return false;
  const lines = editor.getLines();
  const cursor = editor.getCursor();
  if (cursor.line !== lines.length - 1 || cursor.line < 0) return false;

  const rendered = editor.render(width);
  const markerLine = rendered.findIndex((line) => line.includes(CURSOR_MARKER));
  if (markerLine >= 0) return markerLine >= rendered.length - 2;

  const maxPadding = Math.max(0, Math.floor((width - 1) / 2));
  const padding = Math.min(Math.max(0, editor.getPaddingX()), maxPadding);
  const layoutWidth = Math.max(1, width - padding * 2 - (padding ? 0 : 1));
  const line = lines[cursor.line] ?? "";
  if (visibleWidth(line) <= layoutWidth) return true;
  return visibleWidth(line.slice(cursor.col)) <= layoutWidth;
}

export class AgentFooter implements Component, Focusable {
  focused = false;
  onAction?: (action: FooterAction) => void;

  private readonly tui: TUI;
  private readonly theme: Theme;
  private readonly footerData: ReadonlyFooterDataProvider;
  private readonly registry: SubagentRegistry;
  private readonly ctx: ExtensionContext;
  private selectedIndex = 0;
  private selectedRunId?: string;
  private readonly unsubscribe: () => void;
  private readonly unsubscribeBranch: () => void;
  private readonly timer: ReturnType<typeof setInterval>;
  private disposed = false;

  constructor(
    tui: TUI,
    theme: Theme,
    footerData: ReadonlyFooterDataProvider,
    registry: SubagentRegistry,
    ctx: ExtensionContext,
  ) {
    this.tui = tui;
    this.theme = theme;
    this.footerData = footerData;
    this.registry = registry;
    this.ctx = ctx;
    this.unsubscribe = registry.subscribe(() => {
      this.syncSelection();
      this.invalidate();
      this.tui.requestRender();
    });
    this.unsubscribeBranch = footerData.onBranchChange(() => {
      this.invalidate();
      this.tui.requestRender();
    });
    this.timer = setInterval(() => {
      if (this.registry.list().some(({ run }) => run.state === "running" || run.state === "retrying")) {
        this.invalidate();
        this.tui.requestRender();
      }
    }, 1_000);
    (this.timer as any).unref?.();
  }

  focus(): void {
    this.focused = true;
    this.tui.requestRender();
  }

  blur(): void {
    this.focused = false;
    this.tui.requestRender();
  }

  isFocused(): boolean {
    return this.focused;
  }

  focusEditor(editor: Component): void {
    this.tui.setFocus(editor);
  }

  handleInput(data: string): FooterAction {
    const count = this.itemCount();
    if (matchesKey(data, Key.left)) {
      this.selectedIndex = (this.selectedIndex - 1 + count) % count;
      this.rememberSelection();
      this.invalidate();
      this.tui.requestRender();
      return { type: "none" };
    }
    if (matchesKey(data, Key.right)) {
      this.selectedIndex = (this.selectedIndex + 1) % count;
      this.rememberSelection();
      this.invalidate();
      this.tui.requestRender();
      return { type: "none" };
    }
    if (matchesKey(data, Key.up) || matchesKey(data, Key.escape)) {
      return this.dispatch({ type: "focusEditor" });
    }
    if (matchesKey(data, Key.enter)) {
      const selected = this.registry.list()[this.selectedIndex - 1];
      return this.dispatch(
        selected ? { type: "openChild", run: selected } : { type: "openOrchestrator" },
      );
    }
    return { type: "none" };
  }

  render(width: number): string[] {
    const safeWidth = Math.max(1, Math.floor(width));
    const children = this.registry.list();
    const selected = children[this.selectedIndex - 1];
    const focusPrefix = this.focused ? "› " : "";
    const processWidth = Math.max(1, safeWidth - visibleWidth(focusPrefix));
    let processRow: string;
    let telemetry: string | undefined;
    if (selected) {
      const usage = totalUsage(selected.run);
      telemetry = telemetryLine(selected.run, this.selectedIndex, usage, safeWidth);
      const radioWidth = processWidth - visibleWidth(telemetry) - 1;
      const compactSelectedLabel = `${displayTitle(selected.run.title)} ${stateWord(selected.run.state)}`;
      if (radioWidth >= 1 && visibleWidth(`◉ ${compactSelectedLabel}`) <= radioWidth) {
        const radio = radioGroup(children, this.selectedIndex, radioWidth);
        processRow = `${focusPrefix}${radio}${" ".repeat(processWidth - visibleWidth(radio) - visibleWidth(telemetry))}${telemetry}`;
        telemetry = undefined;
      } else {
        processRow = `${focusPrefix}${radioGroup(children, this.selectedIndex, processWidth)}`;
      }
    } else {
      processRow = `${focusPrefix}${radioGroup(children, this.selectedIndex, processWidth)}`;
    }

    const lines = [this.line(processRow, "muted", safeWidth)];
    if (telemetry) lines.push(this.line(telemetry, "text", safeWidth));

    lines.push(this.line(this.defaultInfo(), "dim", safeWidth));
    const statuses = [...this.footerData.getExtensionStatuses().entries()]
      .sort(([left], [right]) => left.localeCompare(right));
    for (const [, text] of statuses) {
      const status = sanitizeStatusText(text);
      if (status) lines.push(this.line(status, "dim", safeWidth));
    }
    return lines;
  }

  invalidate(): void {}

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.focused = false;
    clearInterval(this.timer);
    this.unsubscribe();
    this.unsubscribeBranch();
  }

  private dispatch(action: FooterAction): FooterAction {
    this.onAction?.(action);
    return action;
  }

  private itemCount(): number {
    return this.registry.list().length + 1;
  }

  private rememberSelection(): void {
    this.selectedRunId = this.registry.list()[this.selectedIndex - 1]?.runId;
  }

  private syncSelection(): void {
    const children = this.registry.list();
    if (this.selectedRunId) {
      const index = children.findIndex((run) => run.runId === this.selectedRunId);
      if (index >= 0) {
        this.selectedIndex = index + 1;
        return;
      }
      this.selectedRunId = undefined;
    }
    this.selectedIndex = Math.min(this.selectedIndex, children.length);
  }

  private line(text: string, color: string, width: number): string {
    return this.theme.fg(color as never, truncateToWidth(text, width, ""));
  }

  private defaultInfo(): string {
    const branch = sanitizeStatusText(this.footerData.getGitBranch() ?? "");
    const sessionName = sanitizeStatusText(this.ctx.sessionManager.getSessionName() ?? "");
    const cwd = sanitizeStatusText(this.ctx.sessionManager.getCwd() || this.ctx.cwd);
    const location = `${cwd}${branch ? ` (${branch})` : ""}${sessionName ? ` • ${sessionName}` : ""}`;
    const model = this.ctx.model?.id ?? "no-model";
    const providerCount = this.footerData.getAvailableProviderCount();
    const provider = providerCount > 1 && this.ctx.model?.provider
      ? `(${this.ctx.model.provider}) `
      : "";
    const contextUsage = this.ctx.getContextUsage();
    const contextText = contextUsage
      ? ` ctx ${contextUsage.tokens == null ? "?" : formatTokens(contextUsage.tokens)}/${formatTokens(contextUsage.contextWindow ?? 0)}`
      : "";
    const thinking = this.ctx.thinkingLevel && this.ctx.thinkingLevel !== "off"
      ? ` • ${this.ctx.thinkingLevel}`
      : "";
    return `${location} ${provider}${model}${thinking}${contextText}`;
  }
}

class AgentNavigationEditor implements EditorComponent, Focusable {
  private readonly base: EditorComponent;
  private readonly footer: AgentFooter;
  private readonly registry: SubagentRegistry;
  private readonly onFooterAction: (action: FooterAction) => void;
  private focusedFallback = false;
  private lastWidth = 80;

  constructor(
    base: EditorComponent,
    footer: AgentFooter,
    registry: SubagentRegistry,
    onFooterAction: (action: FooterAction) => void,
  ) {
    this.base = base;
    this.footer = footer;
    this.registry = registry;
    this.onFooterAction = onFooterAction;
  }

  get focused(): boolean {
    return "focused" in this.base ? Boolean((this.base as any).focused) : this.focusedFallback;
  }

  set focused(value: boolean) {
    this.focusedFallback = value;
    if ("focused" in this.base) (this.base as any).focused = value;
  }

  get onSubmit(): ((text: string) => void) | undefined {
    return this.base.onSubmit;
  }

  set onSubmit(value: ((text: string) => void) | undefined) {
    this.base.onSubmit = value;
  }

  get onChange(): ((text: string) => void) | undefined {
    return this.base.onChange;
  }

  set onChange(value: ((text: string) => void) | undefined) {
    this.base.onChange = value;
  }

  get borderColor(): ((str: string) => string) | undefined {
    return this.base.borderColor;
  }

  set borderColor(value: ((str: string) => string) | undefined) {
    if (value !== undefined) this.base.borderColor = value;
  }

  get actionHandlers(): Map<string, () => void> | undefined {
    return (this.base as any).actionHandlers;
  }

  set actionHandlers(value: Map<string, () => void> | undefined) {
    if ("actionHandlers" in this.base) (this.base as any).actionHandlers = value;
  }

  onAction(action: string, handler: () => void): void {
    const register = (this.base as any).onAction;
    if (typeof register === "function") register.call(this.base, action, handler);
    else this.actionHandlers?.set(action, handler);
  }

  get disableSubmit(): boolean | undefined {
    return (this.base as any).disableSubmit;
  }

  set disableSubmit(value: boolean | undefined) {
    (this.base as any).disableSubmit = value;
  }

  get onEscape(): (() => void) | undefined {
    return (this.base as any).onEscape;
  }

  set onEscape(value: (() => void) | undefined) {
    (this.base as any).onEscape = value;
  }

  get onCtrlD(): (() => void) | undefined {
    return (this.base as any).onCtrlD;
  }

  set onCtrlD(value: (() => void) | undefined) {
    (this.base as any).onCtrlD = value;
  }

  get onPasteImage(): (() => void) | undefined {
    return (this.base as any).onPasteImage;
  }

  set onPasteImage(value: (() => void) | undefined) {
    (this.base as any).onPasteImage = value;
  }

  get onExtensionShortcut(): ((data: string) => boolean) | undefined {
    return (this.base as any).onExtensionShortcut;
  }

  set onExtensionShortcut(value: ((data: string) => boolean) | undefined) {
    (this.base as any).onExtensionShortcut = value;
  }

  get wantsKeyRelease(): boolean | undefined {
    return this.base.wantsKeyRelease;
  }

  set wantsKeyRelease(value: boolean | undefined) {
    this.base.wantsKeyRelease = value;
  }

  getText(): string {
    return this.base.getText();
  }

  setText(text: string): void {
    this.base.setText(text);
  }

  getExpandedText(): string {
    return this.base.getExpandedText?.() ?? this.base.getText();
  }

  addToHistory(text: string): void {
    this.base.addToHistory?.(text);
  }

  insertTextAtCursor(text: string): void {
    this.base.insertTextAtCursor?.(text);
  }

  setAutocompleteProvider(provider: Parameters<NonNullable<EditorComponent["setAutocompleteProvider"]>>[0]): void {
    this.base.setAutocompleteProvider?.(provider);
  }

  setPaddingX(padding: number): void {
    this.base.setPaddingX?.(padding);
  }

  setAutocompleteMaxVisible(maxVisible: number): void {
    this.base.setAutocompleteMaxVisible?.(maxVisible);
  }

  getLines(): string[] {
    return (this.base as any).getLines?.() ?? [];
  }

  getCursor(): { line: number; col: number } {
    return (this.base as any).getCursor?.() ?? { line: 0, col: 0 };
  }

  getPaddingX(): number {
    return (this.base as any).getPaddingX?.() ?? 0;
  }

  isShowingAutocomplete(): boolean {
    return (this.base as any).isShowingAutocomplete?.() ?? false;
  }

  render(width: number): string[] {
    this.lastWidth = width;
    return this.base.render(width);
  }

  handleInput(data: string): void {
    if (this.footer.isFocused()) {
      if (isFooterNavigationKey(data)) {
        this.footer.handleInput(data);
        return;
      }
      this.footer.blur();
      this.base.handleInput(data);
      return;
    }
    if (
      matchesKey(data, Key.down) &&
      this.registry.list().length > 0 &&
      !(this.base as any).isShowingAutocomplete?.() &&
      hasCursorMethods(this.base as EditorComponent) &&
      isCursorOnLastVisualLine(this.base as CursorAwareEditor, this.lastWidth)
    ) {
      this.footer.focus();
      return;
    }
    this.base.handleInput(data);
  }

  invalidate(): void {
    this.base.invalidate();
  }

  handleFooterAction(action: FooterAction): void {
    if (action.type === "focusEditor") {
      this.footer.blur();
      this.footer.focusEditor(this);
    }
    this.onFooterAction(action);
  }
}

function isFooterNavigationKey(data: string): boolean {
  return matchesKey(data, Key.left) ||
    matchesKey(data, Key.right) ||
    matchesKey(data, Key.up) ||
    matchesKey(data, Key.down) ||
    matchesKey(data, Key.escape) ||
    matchesKey(data, Key.enter);
}

function hasCursorMethods(editor: EditorComponent): editor is CursorAwareEditor {
  const value = editor as any;
  return typeof value.getLines === "function" &&
    typeof value.getCursor === "function" &&
    typeof value.getPaddingX === "function";
}

export type ChildViewExit = {
  readonly type: "orchestrator";
};

export class ChildSessionView extends VStack {
  private readonly tui: TUI;
  private readonly theme: Theme;
  private readonly footer: AgentFooter;
  private readonly registry: SubagentRegistry;
  private readonly onExit: (result: ChildViewExit) => void;
  private readonly cwd: string;
  private readonly header: Text;
  private readonly transcript = new Container();
  private readonly scroll: ScrollView;
  private readonly unsubscribe: () => void;
  private run: MonitoredRun;
  private loadedRunId: string;
  private messagesByAttempt = new Map<number, readonly Message[]>();
  private refreshGeneration = 0;
  private lastFrame?: readonly string[];
  private hasTranscriptContent = false;
  private lastWidth = 80;
  private readError?: unknown;
  private disposed = false;

  constructor(
    tui: TUI,
    theme: Theme,
    footer: AgentFooter,
    registry: SubagentRegistry,
    initialRun: MonitoredRun,
    onExit: (result: ChildViewExit) => void,
    cwd = process.cwd(),
  ) {
    super([], { gap: 0 });
    this.tui = tui;
    this.theme = theme;
    this.footer = footer;
    this.registry = registry;
    this.run = initialRun;
    this.loadedRunId = initialRun.runId;
    this.onExit = onExit;
    this.cwd = cwd;
    this.header = new Text("", 0, 0);
    this.scroll = new ScrollView(this.transcript, {
      follow: "end",
      overscroll: "contain",
      scrollbar: "hidden",
    });
    this.addChild(this.header);
    this.addChild(this.scroll, { basis: "auto", grow: 1, shrink: 1, minSize: 1 });
    this.unsubscribe = registry.subscribe(() => {
      const latest = registry.get(this.run.runId);
      if (latest) this.setRun(latest);
      else {
        this.invalidate();
        this.tui.requestRender();
      }
    });
    this.rebuild();
  }

  get runId(): string {
    return this.run.runId;
  }

  setRun(run: MonitoredRun): void {
    if (this.disposed) return;
    if (run.runId !== this.loadedRunId) {
      this.loadedRunId = run.runId;
      this.messagesByAttempt = new Map();
      this.readError = undefined;
      this.lastFrame = undefined;
      this.scroll.scrollToEnd();
    }
    this.run = run;
    this.rebuild();
    void this.refresh();
  }

  async refresh(): Promise<void> {
    if (this.disposed) return;
    const generation = ++this.refreshGeneration;
    const runId = this.run.runId;
    const messages = new Map<number, readonly Message[]>();
    let readError: unknown;
    for (const session of this.run.sessions) {
      try {
        const completed = await readChildSession(session);
        if (completed.length > 0) messages.set(session.attempt, completed);
      } catch (error) {
        readError ??= error;
      }
    }
    if (this.disposed || generation !== this.refreshGeneration || this.run.runId !== runId) return;
    if (messages.size > 0) {
      const next = new Map(this.messagesByAttempt);
      for (const [attempt, completed] of messages) next.set(attempt, completed);
      this.messagesByAttempt = next;
    }
    this.readError = readError;
    this.rebuild();
    this.tui.requestRender();
  }

  handleInput(data: string): void {
    if (this.footer.isFocused()) {
      const action = this.footer.handleInput(data);
      if (!this.footer.onAction) this.handleFooterAction(action);
      return;
    }
    if (matchesKey(data, Key.escape)) {
      this.onExit({ type: "orchestrator" });
      return;
    }
    if (!matchesKey(data, Key.up) && !matchesKey(data, Key.down)) return;
    this.ensureScrollLayout();
    if (matchesKey(data, Key.up)) {
      this.scroll.scrollBy(-1);
      this.tui.setFocus?.(this);
      this.tui.requestRender();
      return;
    }
    const remaining = this.scroll.scrollBy(1);
    if (remaining > 0) this.footer.focus();
    else this.tui.requestRender();
  }

  handleFooterAction(action: FooterAction): void {
    if (action.type === "openChild") {
      this.footer.blur();
      this.setRun(action.run);
      this.tui.setFocus?.(this);
    } else if (action.type === "openOrchestrator") {
      this.footer.blur();
      this.onExit({ type: "orchestrator" });
    } else if (action.type === "focusEditor") {
      this.footer.blur();
      this.tui.setFocus?.(this);
    }
  }

  render(width: number): string[] {
    const safeWidth = Math.max(1, Math.floor(width));
    this.lastWidth = safeWidth;
    const headerLines = this.header.render(safeWidth);
    const contentLines = this.transcript.render(safeWidth);
    const viewportHeight = this.getViewportHeight(safeWidth, contentLines.length, headerLines.length);
    this.scroll.updateLayout(contentLines.length, viewportHeight, () => this.tui.requestRender());
    const frame = [...headerLines, ...contentLines.slice(this.scroll.scrollTop, this.scroll.scrollTop + viewportHeight)];
    if (this.readError && !this.hasTranscriptContent && this.lastFrame) {
      return this.lastFrame.map((line) => truncateToWidth(line, safeWidth, ""));
    }
    this.lastFrame = frame;
    return frame;
  }

  invalidate(): void {
    super.invalidate();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.refreshGeneration++;
    this.unsubscribe();
    this.footer.blur();
  }

  private ensureScrollLayout(): void {
    if (this.scroll.viewportHeight > 0) return;
    const headerHeight = this.header.render(this.lastWidth).length;
    const contentHeight = this.transcript.render(this.lastWidth).length;
    const viewportHeight = this.getViewportHeight(this.lastWidth, contentHeight, headerHeight);
    this.scroll.updateLayout(contentHeight, viewportHeight, () => this.tui.requestRender());
  }

  private getViewportHeight(width: number, contentHeight: number, headerHeight: number): number {
    const footerHeight = this.footer.render(width).length;
    const terminalRows = this.tui.terminal?.rows ?? contentHeight + footerHeight + headerHeight;
    return Math.max(1, terminalRows - footerHeight - headerHeight);
  }

  private rebuild(): void {
    const usage = totalUsage(this.run.run);
    this.header.setText(
      `${displayTitle(this.run.run.title)} (${this.run.run.agent}) ${stateText(this.run.run.state)} ${formatDuration(this.run.run)} ↑${formatTokens(usage.inputTokens)} ↓${formatTokens(usage.outputTokens)} ctx ${formatTokens(usage.contextTokens)}`,
    );
    this.transcript.clear();
    let hasTranscriptContent = false;
    const attempts = this.run.run.attempts;
    for (let index = 0; index < attempts.length; index++) {
      const attempt = attempts[index];
      if (index > 0) {
        this.transcript.addChild(new Text(this.theme.fg("muted", `── attempt ${attempt.number} ──`), 0, 0));
      }
      const loaded = this.messagesByAttempt.get(attempt.number);
      const messages = loaded ? mergeMessages(loaded, attempt.messages) : attempt.messages;
      if (messages.length > 0) hasTranscriptContent = true;
      const pendingTools = new Map<string, ToolExecutionComponent>();
      for (const message of messages) this.addMessage(message, pendingTools);

      const session = this.run.sessions.find((candidate) => candidate.attempt === attempt.number);
      const currentAttempt = attempts.at(-1)?.number === attempt.number;
      const live = attempt.state === "running" && currentAttempt;
      if (live && session && (session.partialText || session.partialThinking)) {
        hasTranscriptContent = true;
        this.addMessage(partialAssistant(session), pendingTools);
      }
      if (attempt.state === "failed" || attempt.state === "cancelled") {
        const diagnostic = attempt.error || attempt.stderr || `Attempt ${attempt.number} ${attempt.state}`;
        for (const component of pendingTools.values()) {
          component.updateResult({
            content: [{ type: "text", text: diagnostic }],
            isError: true,
          });
        }
        pendingTools.clear();
      }
    }
    this.hasTranscriptContent = hasTranscriptContent;
    if (!hasTranscriptContent && this.readError) {
      const message = this.readError instanceof Error ? this.readError.message : String(this.readError);
      this.transcript.addChild(new Text(this.theme.fg("warning", `Session unavailable: ${message}`), 0, 0));
    }
  }

  private addMessage(
    message: Message,
    pendingTools: Map<string, ToolExecutionComponent>,
  ): void {
    if (message.role === "user") {
      this.transcript.addChild(new UserMessageComponent(messageText(message.content), getMarkdownTheme(), 0));
    } else if (message.role === "assistant") {
      this.transcript.addChild(new AssistantMessageComponent(message, false, getMarkdownTheme(), "Thinking...", 0));
      for (const part of message.content) {
        if (part.type !== "toolCall") continue;
        const component = new ToolExecutionComponent(
          part.name,
          part.id,
          part.arguments,
          { showImages: false },
          undefined,
          this.tui,
          this.cwd,
        );
        component.markExecutionStarted();
        component.setArgsComplete();
        pendingTools.set(part.id, component);
        this.transcript.addChild(component);
      }
    } else {
      let component = pendingTools.get(message.toolCallId);
      if (!component) {
        component = new ToolExecutionComponent(
          message.toolName,
          message.toolCallId,
          {},
          { showImages: false },
          undefined,
          this.tui,
          this.cwd,
        );
        component.markExecutionStarted();
        component.setArgsComplete();
        this.transcript.addChild(component);
      } else {
        pendingTools.delete(message.toolCallId);
      }
      component.updateResult({
        content: message.content,
        details: message.details,
        isError: message.isError,
      });
    }
  }
}

export function installSubagentUI(ctx: ExtensionContext): SubagentUIHandle {
  const registry = new SubagentRegistry();
  const previousEditorFactory = ctx.ui.getEditorComponent();
  let footer: AgentFooter | undefined;
  let navigationEditor: EditorComponent & Focusable | undefined;
  let navigationTui: TUI | undefined;
  let activeView: ChildSessionView | undefined;
  let activeDone: ((result: ChildViewExit) => void) | undefined;
  let disposed = false;

  try {
    ctx.ui.setFooter((tui, theme, footerData) => {
      footer = new AgentFooter(tui, theme, footerData, registry, ctx);
      footer.onAction = routeFooterAction;
      return footer;
    });

    ctx.ui.setEditorComponent((tui, theme, keybindings) => {
      navigationTui = tui;
      const base = previousEditorFactory
        ? previousEditorFactory(tui, theme, keybindings)
        : new CustomEditor(tui, theme, keybindings);
      if (!footer) throw new Error("Subagent footer was not created");
      const editor = createAgentNavigationEditor(
        base,
        footer,
        registry,
        routeFooterAction,
      );
      navigationEditor = editor;
      return editor;
    });
  } catch (error) {
    try {
      footer?.dispose();
    } catch {
      // Preserve the installation failure.
    }
    try {
      ctx.ui.setEditorComponent(previousEditorFactory);
    } catch {
      // Preserve the installation failure.
    }
    try {
      ctx.ui.setFooter(undefined);
    } catch {
      // Preserve the installation failure.
    }
    throw error;
  }

  function routeFooterAction(action: FooterAction): void {
    if (action.type === "openChild") {
      if (activeView) activeView.handleFooterAction(action);
      else void openChild(action.run).catch((error) => {
        ctx.ui.notify(`Unable to open subagent: ${error instanceof Error ? error.message : String(error)}`, "error");
      });
    } else if (activeView) {
      activeView.handleFooterAction(action);
    } else if (action.type === "focusEditor") {
      footer?.blur();
      navigationTui?.setFocus(navigationEditor ?? null);
    }
  }

  function onMonitorEvent(event: import("./runtime.ts").SubagentMonitorEvent): void {
    if (disposed) return;
    if (event.type === "started") {
      registry.add(event.run);
    } else if (event.type === "updated") {
      registry.update(event.run);
    } else {
      if (activeView?.runId === event.run.runId) activeView.setRun(event.run);
      if (registry.get(event.run.runId)) registry.remove(event.run.runId);
    }
  }

  async function openChild(run: MonitoredRun): Promise<void> {
    if (disposed) return;
    if (activeView) {
      activeView.handleFooterAction({ type: "openChild", run });
      return;
    }
    let view: ChildSessionView | undefined;
    try {
      footer?.blur();
      await ctx.ui.custom<ChildViewExit>((tui, theme, _keybindings, done) => {
        activeDone = done;
        const created = new ChildSessionView(tui, theme, footer!, registry, run, (exit) => done(exit), ctx.cwd);
        view = created;
        activeView = created;
        void created.refresh();
        return created;
      });
    } finally {
      if (activeView === view) activeView = undefined;
      if (activeDone) activeDone = undefined;
    }
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    let cleanupError: unknown;
    const attempt = (cleanup: () => void): void => {
      try {
        cleanup();
      } catch (error) {
        cleanupError ??= error;
      }
    };

    attempt(() => activeDone?.({ type: "orchestrator" }));
    activeDone = undefined;
    attempt(() => activeView?.dispose());
    activeView = undefined;
    attempt(() => registry.clear());
    attempt(() => footer?.dispose());
    attempt(() => ctx.ui.setEditorComponent(previousEditorFactory));
    attempt(() => ctx.ui.setFooter(undefined));
    if (cleanupError) throw cleanupError;
  }

  return { registry, footer: footer!, onMonitorEvent, openChild, dispose };
}

function partialAssistant(session: ChildSessionState): Message {
  const content: any[] = [];
  if (session.partialThinking) content.push({ type: "thinking", thinking: session.partialThinking });
  if (session.partialText) content.push({ type: "text", text: session.partialText });
  return {
    role: "assistant",
    content,
    api: "openai-responses",
    provider: "unknown",
    model: "unknown",
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
    stopReason: "pending",
    timestamp: Date.now(),
  } as Message;
}

function mergeMessages(loaded: readonly Message[], live: readonly Message[]): readonly Message[] {
  if (live.length === 0) return loaded;
  const result = [...loaded];
  const indexes = new Map<string, number[]>();
  loaded.forEach((message, index) => {
    const key = messageKey(message);
    const matches = indexes.get(key);
    if (matches) matches.push(index);
    else indexes.set(key, [index]);
  });
  for (const message of live) {
    const matches = indexes.get(messageKey(message));
    const index = matches?.shift();
    if (index === undefined) result.push(message);
    else result[index] = message;
  }
  return result;
}

function messageKey(message: Message): string {
  return message.role === "toolResult"
    ? `${message.role}:${message.toolCallId}`
    : `${message.role}:${message.timestamp}`;
}

function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((part) => part?.type === "text" ? part.text : part?.type === "image" ? "[image]" : "").join("");
}

function displayTitle(title: unknown): string {
  if (typeof title !== "string") return "(untitled)";
  try {
    return normalizeTitle(title);
  } catch {
    return "(untitled)";
  }
}

function stateWord(state: SubagentRun["state"]): string {
  return state === "retrying" ? "retrying" : state === "running" ? "running" : state;
}

function stateText(state: SubagentRun["state"]): string {
  switch (state) {
    case "succeeded": return "✓ succeeded";
    case "failed": return "✗ failed";
    case "cancelled": return "■ cancelled";
    case "retrying": return "↻ retrying";
    default: return "… running";
  }
}

function radioGroup(
  children: readonly MonitoredRun[],
  selectedIndex: number,
  width: number,
): string {
  type Option = { readonly selected: boolean; label: string };
  const options: Option[] = [
    { selected: selectedIndex === 0, label: "orchestrator" },
    ...children.map((run, index) => ({
      selected: index + 1 === selectedIndex,
      label: index + 1 === selectedIndex
        ? selectedProcessLabel(run.run, width)
        : `${displayTitle(run.run.title)} ${stateWord(run.run.state)}`,
    })),
  ];
  const compose = (): string => options
    .map((option) => `${option.selected ? "◉" : "○"}${option.label ? ` ${option.label}` : ""}`)
    .join(" ");

  let row = compose();
  for (let index = options.length - 1; index >= 0 && visibleWidth(row) > width; index--) {
    const option = options[index];
    if (option.selected || !option.label) continue;
    const overflow = visibleWidth(row) - width;
    options[index] = {
      ...option,
      label: truncateToWidth(option.label, Math.max(0, visibleWidth(option.label) - overflow), ""),
    };
    row = compose();
  }
  for (let index = options.length - 1; index >= 0 && visibleWidth(row) > width; index--) {
    if (options[index].selected) continue;
    options.splice(index, 1);
    row = compose();
  }
  return truncateToWidth(row, width, "");
}

function selectedProcessLabel(run: SubagentRun, width: number): string {
  const available = Math.max(0, width - visibleWidth("◉ "));
  const state = ` ${stateWord(run.state)}`;
  const title = displayTitle(run.title);
  const full = `${title} (${run.agent})${state}`;
  if (visibleWidth(full) <= available) return full;
  if (visibleWidth(state) <= available) {
    return `${truncateToWidth(title, available - visibleWidth(state), "")}${state}`;
  }
  return truncateToWidth(state.trim(), available, "");
}

function telemetryLine(
  run: SubagentRun,
  processNumber: number,
  usage: { inputTokens: number; outputTokens: number; contextTokens: number },
  width: number,
): string {
  const duration = formatDuration(run);
  const input = formatTokens(usage.inputTokens);
  const output = formatTokens(usage.outputTokens);
  const context = formatTokens(usage.contextTokens);
  const full = `  #${processNumber} ${duration} ↑${input} ↓${output} ctx ${context}`;
  return visibleWidth(full) <= width
    ? full
    : `#${processNumber} ${duration} ↑${input} ↓${output} ctx${context}`;
}

function totalUsage(run: SubagentRun): { inputTokens: number; outputTokens: number; contextTokens: number } {
  let inputTokens = 0;
  let outputTokens = 0;
  let contextTokens = 0;
  for (const attempt of run.attempts) {
    const usage = attempt.usage ?? ZERO_USAGE;
    inputTokens += usage.inputTokens;
    outputTokens += usage.outputTokens;
    contextTokens = usage.contextTokens;
  }
  return { inputTokens, outputTokens, contextTokens };
}

function formatTokens(value: number): string {
  if (value < 1_000) return String(value);
  if (value < 1_000_000) return `${(value / 1_000).toFixed(value < 10_000 ? 1 : 0)}k`;
  return `${(value / 1_000_000).toFixed(value < 10_000_000 ? 1 : 0)}M`;
}

function formatDuration(run: SubagentRun): string {
  const elapsed = Math.max(0, (run.endedAt ?? Date.now()) - run.startedAt);
  const seconds = Math.floor(elapsed / 1_000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m${String(seconds % 60).padStart(2, "0")}s`;
}

function sanitizeStatusText(text: string): string {
  try {
    return normalizeTitle(text);
  } catch {
    return "";
  }
}

function copyMonitoredRun(value: MonitoredRun): MonitoredRun {
  return {
    runId: value.runId,
    run: copyRun(value.run),
    sessions: value.sessions.map((session) => ({ ...session })),
  };
}

function copyRun(value: SubagentRun): SubagentRun {
  return {
    ...value,
    attempts: value.attempts.map(copyAttempt),
  };
}

function copyAttempt(value: ProcessAttempt): ProcessAttempt {
  return {
    ...value,
    activity: [...value.activity],
    messages: value.messages.map((message) => structuredClone(message)),
    usage: { ...(value.usage ?? ZERO_USAGE) },
  };
}
