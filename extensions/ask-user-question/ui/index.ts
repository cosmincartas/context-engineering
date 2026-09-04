import {
  Editor,
  Key,
  matchesKey,
  truncateToWidth,
  type Component,
  type EditorTheme,
  type Focusable,
  type Keybinding,
  type KeybindingsManager,
  type TUI,
  visibleWidth,
  wrapTextWithAnsi,
} from "@earendil-works/pi-tui";
import { decodePrintableKey } from "@earendil-works/pi-tui/dist/keys.js";
import {
  createQuestionnaireState,
  reduceQuestionnaireState,
  type QuestionnaireOutcome,
  type QuestionnaireQuestion,
  type QuestionnaireStateEvent,
} from "../state/index.ts";

export interface QuestionnaireTheme {
  fg(color: string, text: string): string;
  bg(color: string, text: string): string;
  bold(text: string): string;
}

export function createQuestionnaireComponent(
  tui: TUI,
  theme: QuestionnaireTheme,
  questions: readonly QuestionnaireQuestion[],
  done: (outcome: QuestionnaireOutcome) => void,
  keybindings: KeybindingsManager,
): Component & Focusable {
  let state = createQuestionnaireState(questions);
  let cachedLines: string[] | undefined;
  let cachedWidth: number | undefined;
  let completed = false;
  let focused = false;
  let editingQuestionIndex: number | undefined;
  let pasteInputActive = false;

  const editorTheme: EditorTheme = {
    borderColor: (text) => theme.fg("accent", text),
    selectList: {
      selectedPrefix: (text) => theme.fg("accent", text),
      selectedText: (text) => theme.fg("accent", text),
      description: (text) => theme.fg("muted", text),
      scrollInfo: (text) => theme.fg("dim", text),
      noMatch: (text) => theme.fg("warning", text),
    },
  };
  const editor = new Editor(tui, editorTheme);

  function refresh(): void {
    cachedLines = undefined;
    tui.requestRender();
  }

  function closeEditor(): void {
    if (pasteInputActive) {
      editor.handleInput(BRACKETED_PASTE_END);
      pasteInputActive = false;
    }
    editingQuestionIndex = undefined;
    editor.focused = false;
    editor.setText("");
  }

  function openEditor(questionIndex: number): void {
    const answer = state.answers[questionIndex];
    editor.setText(answer?.otherText ?? "");
    editingQuestionIndex = questionIndex;
    editor.focused = focused;
    refresh();
  }

  function dispatch(event: QuestionnaireStateEvent): void {
    state = reduceQuestionnaireState(state, event);
    refresh();
    if (state.outcome !== undefined && !completed) {
      completed = true;
      done(state.outcome);
    }
  }

  editor.onSubmit = (text) => {
    if (editingQuestionIndex === undefined) return;

    const questionIndex = editingQuestionIndex;
    closeEditor();
    dispatch({
      type: "submitOther",
      questionIndex,
      text,
    });
  };

  function sanitizeEditorInput(data: string): string {
    let remaining = data;
    let sanitized = "";

    while (remaining.length > 0) {
      if (pasteInputActive) {
        const end = remaining.indexOf(BRACKETED_PASTE_END);
        if (end === -1) {
          return sanitized + escapeControls(remaining);
        }
        sanitized += escapeControls(remaining.slice(0, end));
        sanitized += BRACKETED_PASTE_END;
        remaining = remaining.slice(end + BRACKETED_PASTE_END.length);
        pasteInputActive = false;
        continue;
      }

      const start = remaining.indexOf(BRACKETED_PASTE_START);
      if (start !== -1) {
        sanitized += escapeControls(remaining.slice(0, start));
        sanitized += BRACKETED_PASTE_START;
        remaining = remaining.slice(start + BRACKETED_PASTE_START.length);
        pasteInputActive = true;
        continue;
      }

      const printable = decodePrintableKey(remaining);
      if (printable !== undefined) {
        return sanitized + escapeControls(printable);
      }
      if (isEditorControlKey(remaining, keybindings)) {
        return sanitized + remaining;
      }
      return sanitized + escapeControls(remaining);
    }

    return sanitized;
  }

  function handleInput(data: string): void {
    if (completed) return;

    if (editingQuestionIndex !== undefined) {
      if (pasteInputActive || data.includes(BRACKETED_PASTE_START)) {
        editor.handleInput(sanitizeEditorInput(data));
        refresh();
        return;
      }
      if (matchesKey(data, Key.ctrl("c"))) {
        closeEditor();
        dispatch({ type: "cancel" });
        return;
      }
      if (matchesKey(data, Key.escape)) {
        closeEditor();
        refresh();
        return;
      }
      editor.handleInput(sanitizeEditorInput(data));
      refresh();
      return;
    }

    if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c"))) {
      dispatch({ type: "cancel" });
      return;
    }
    if (matchesKey(data, Key.left)) {
      dispatch({ type: "moveTab", direction: "left" });
      return;
    }
    if (matchesKey(data, Key.right)) {
      dispatch({ type: "moveTab", direction: "right" });
      return;
    }
    if (matchesKey(data, Key.up)) {
      dispatch({ type: "moveRow", direction: "up" });
      return;
    }
    if (matchesKey(data, Key.down)) {
      dispatch({ type: "moveRow", direction: "down" });
      return;
    }
    if (!matchesKey(data, Key.enter)) {
      return;
    }

    if (state.activeTab >= questions.length) {
      dispatch({ type: state.activeRow === 0 ? "confirm" : "cancel" });
      return;
    }

    const question = state.questions[state.activeTab];
    if (state.activeRow < question.options.length) {
      dispatch({
        type: "selectOption",
        questionIndex: state.activeTab,
        optionIndex: state.activeRow,
      });
    } else if (state.activeRow === question.options.length) {
      openEditor(state.activeTab);
    } else {
      dispatch({ type: "advanceMultiple", questionIndex: state.activeTab });
    }
  }

  function render(width: number): string[] {
    const renderWidth = Math.max(1, Math.floor(width));
    if (cachedLines !== undefined && cachedWidth === renderWidth) return cachedLines;
    const lines: string[] = [];

    function fit(line: string): string {
      if (visibleWidth(line) <= renderWidth) return line;
      return truncateToWidth(line, renderWidth, "", false);
    }

    function addLine(line: string): void {
      lines.push(fit(line));
    }

    function addPrefixed(prefix: string, text: string): void {
      const safePrefix = fit(prefix);
      const prefixWidth = visibleWidth(safePrefix);
      const availableWidth = Math.max(1, renderWidth - prefixWidth);
      const wrapped = wrapTextWithAnsi(text, availableWidth);
      const content = wrapped.length === 0 ? [""] : wrapped;
      const continuation = " ".repeat(prefixWidth);
      for (let index = 0; index < content.length; index++) {
        addLine(`${index === 0 ? safePrefix : continuation}${content[index]}`);
      }
    }

    function styled(color: string, text: string): string {
      return theme.fg(color, escapeControls(text));
    }

    function answerMarker(answered: boolean): string {
      return answered ? "x" : " ";
    }

    addLine(theme.fg("border", "─".repeat(renderWidth)));

    if (questions.length > 1) {
      const tabs = questions.map((question, index) => {
        const active = state.activeTab === index;
        const answered = state.answers[index] !== undefined;
        const header = question.header?.trim() ? question.header : `Q${index + 1}`;
        return `${active ? ">" : " "} [${answered ? "✓" : "·"}] ${escapeControls(header)}`;
      });
      const finalActive = state.activeTab === questions.length;
      tabs.push(`${finalActive ? ">" : " "} [ ] Confirm`);
      addLine(styled("muted", `← ${tabs.join("  ")} →`));
    }

    if (state.activeTab < questions.length) {
      const question = state.questions[state.activeTab];
      const answer = state.answers[state.activeTab];
      const header = question.header?.trim() ? question.header : `Q${state.activeTab + 1}`;
      addPrefixed(
        " ",
        `${styled("muted", `${header} [${answer === undefined ? "·" : "✓"}]`)} ${styled("text", question.question)}`,
      );

      if (question.multiSelect) {
        for (let index = 0; index < question.options.length; index++) {
          const option = question.options[index];
          const selected = state.activeRow === index;
          const answered = answer?.optionIndexes.includes(index) ?? false;
          addPrefixed(
            `${selected ? ">" : " "} [${answerMarker(answered)}] `,
            `${styled(selected ? "accent" : "text", option.label)}  ${styled("muted", option.description)}`,
          );
        }

        const otherSelected = state.activeRow === question.options.length;
        const otherAnswered = answer?.otherText !== undefined;
        addPrefixed(
          `${otherSelected ? ">" : " "} [${answerMarker(otherAnswered)}] `,
          `${styled(otherSelected ? "accent" : "text", "Other")}  ${styled("muted", "Enter a custom answer.")}`,
        );

        const submitSelected = state.activeRow === question.options.length + 1;
        addPrefixed(
          `${submitSelected ? "> " : "  "}`,
          `${styled(submitSelected ? "accent" : "text", "Submit")}  ${styled("muted", "Continue with these selections.")}`,
        );
      } else {
        for (let index = 0; index < question.options.length; index++) {
          const option = question.options[index];
          const selected = state.activeRow === index;
          const answered = answer?.optionIndexes.includes(index) ?? false;
          const numberedPrefix = `${selected ? "> " : "  "}${index + 1}. `;
          const completionInPrefix =
            answered && renderWidth <= visibleWidth(numberedPrefix);
          const label = completionInPrefix
            ? `${index + 1}. ${option.label}`
            : `${option.label}${answered ? " ✓" : ""}`;
          addPrefixed(
            completionInPrefix
              ? `${selected ? "> " : "  "}✓ `
              : numberedPrefix,
            `${styled(selected ? "accent" : "text", label)}  ${styled("muted", option.description)}`,
          );
        }

        const otherSelected = state.activeRow === question.options.length;
        const otherAnswered = answer?.otherText !== undefined;
        const otherNumberedPrefix =
          `${otherSelected ? "> " : "  "}${question.options.length + 1}. `;
        const otherCompletionInPrefix =
          otherAnswered && renderWidth <= visibleWidth(otherNumberedPrefix);
        const otherLabel = otherCompletionInPrefix
          ? `${question.options.length + 1}. Other`
          : `Other${otherAnswered ? " ✓" : ""}`;
        addPrefixed(
          otherCompletionInPrefix
            ? `${otherSelected ? "> " : "  "}✓ `
            : otherNumberedPrefix,
          `${styled(otherSelected ? "accent" : "text", otherLabel)}  ${styled("muted", "Enter a custom answer.")}`,
        );
      }

      if (editingQuestionIndex === state.activeTab) {
        addPrefixed(" ", styled("muted", "Your answer:"));
        const editorWidth = Math.max(1, renderWidth - 2);
        for (const line of editor.render(editorWidth)) {
          addLine(`  ${line}`);
        }
        addPrefixed(" ", styled("dim", "Enter submit • Esc leave • Ctrl+C cancel"));
      }
    } else {
      addPrefixed(" ", styled("accent", "Final actions"));
      const confirmSelected = state.activeRow === 0;
      addPrefixed(
        `${confirmSelected ? "> " : "  "}`,
        styled(confirmSelected ? "accent" : "text", "Confirm"),
      );
      addPrefixed(
        `${confirmSelected ? "  " : "> "}`,
        styled(confirmSelected ? "text" : "accent", "Cancel"),
      );
    }

    if (editingQuestionIndex === undefined) {
      addPrefixed(
        " ",
        styled(
          "dim",
          questions.length > 1
            ? "←/→ tabs • ↑/↓ choices • Enter select • Esc cancel"
            : state.activeTab === questions.length
              ? "← back • ↑/↓ actions • Enter select • Esc cancel"
              : "↑/↓ choices • Enter select • Esc cancel",
        ),
      );
    }

    addLine(theme.fg("border", "─".repeat(renderWidth)));

    cachedLines = lines;
    cachedWidth = renderWidth;
    return lines;
  }

  return {
    render,
    handleInput,
    get focused(): boolean {
      return focused;
    },
    set focused(value: boolean) {
      focused = value;
      editor.focused = editingQuestionIndex !== undefined && value;
      refresh();
    },
    invalidate: () => {
      cachedLines = undefined;
      cachedWidth = undefined;
      editor.invalidate();
    },
  };
}

const BRACKETED_PASTE_START = "\x1b[200~";
const BRACKETED_PASTE_END = "\x1b[201~";
function isEditorControlKey(data: string, keybindings: KeybindingsManager): boolean {
  return Object.keys(keybindings.getResolvedBindings())
    .filter(
      (keybinding) =>
        keybinding.startsWith("tui.editor.") || keybinding.startsWith("tui.input."),
    )
    .some((keybinding) => keybindings.matches(data, keybinding as Keybinding));
}

function escapeControls(text: string): string {
  return text.replace(/[\u0000-\u001F\u0080-\u009F]/g, (character) => {
    const code = character.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0");
    return `\\u${code}`;
  });
}
