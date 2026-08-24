import {
  Key,
  matchesKey,
  truncateToWidth,
  type Component,
  type TUI,
  visibleWidth,
  wrapTextWithAnsi,
} from "@earendil-works/pi-tui";

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
  tui: Pick<TUI, "requestRender">,
  theme: QuestionnaireTheme,
  questions: readonly QuestionnaireQuestion[],
  done: (outcome: QuestionnaireOutcome) => void,
): Component {
  let state = createQuestionnaireState(questions);
  let cachedLines: string[] | undefined;
  let cachedWidth: number | undefined;
  let completed = false;

  function refresh(): void {
    cachedLines = undefined;
    tui.requestRender();
  }

  function dispatch(event: QuestionnaireStateEvent): void {
    state = reduceQuestionnaireState(state, event);
    refresh();
    if (state.outcome !== undefined && !completed) {
      completed = true;
      done(state.outcome);
    }
  }

  function handleInput(data: string): void {
    if (completed) return;

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
    if (!matchesKey(data, Key.enter) || state.activeTab >= questions.length) {
      return;
    }

    const question = questions[state.activeTab];
    if (state.activeRow < question.options.length) {
      dispatch({
        type: "answer",
        questionIndex: state.activeTab,
        answer: { kind: "option", optionIndex: state.activeRow },
      });
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
    addPrefixed(" ", styled("accent", "Questionnaire"));

    const tabs = questions.map((question, index) => {
      const active = state.activeTab === index;
      const answered = state.answers[index] !== undefined;
      const header = question.header?.trim() || `Q${index + 1}`;
      return `${active ? ">" : " "} [${answered ? "✓" : "·"}] ${escapeControls(header)}`;
    });
    const finalActive = state.activeTab === questions.length;
    tabs.push(`${finalActive ? ">" : " "} [ ] Confirm`);
    addLine(styled("muted", `← ${tabs.join("  ")} →`));
    addLine("");

    if (state.activeTab < questions.length) {
      const question = questions[state.activeTab];
      addPrefixed(" ", styled("text", question.question));
      addLine("");

      const answer = state.answers[state.activeTab];
      for (let index = 0; index < question.options.length; index++) {
        const option = question.options[index];
        const selected = state.activeRow === index;
        const answered = answer?.kind === "option" && answer.optionIndex === index;
        addPrefixed(
          `${selected ? ">" : " "} [${answerMarker(answered)}] `,
          styled(selected ? "accent" : "text", option.label),
        );
        addPrefixed("      ", styled("muted", option.description));
      }

      const otherSelected = state.activeRow === question.options.length;
      const otherAnswered = answer?.kind === "other";
      addPrefixed(
        `${otherSelected ? ">" : " "} [${answerMarker(otherAnswered)}] `,
        styled(otherSelected ? "accent" : "text", "Other"),
      );
      addPrefixed("      ", styled("muted", "Enter a custom answer."));
    } else {
      addPrefixed(" ", styled("accent", "Final actions"));
      addLine("");
      addPrefixed("> ", styled("accent", "Confirm"));
      addPrefixed("  ", styled("text", "Cancel"));
    }

    addLine("");
    addPrefixed(
      " ",
      styled("dim", "←/→ tabs • ↑/↓ choices • Enter select • Esc cancel"),
    );
    addLine(theme.fg("border", "─".repeat(renderWidth)));

    cachedLines = lines;
    cachedWidth = renderWidth;
    return lines;
  }

  return {
    render,
    handleInput,
    invalidate: () => {
      cachedLines = undefined;
      cachedWidth = undefined;
    },
  };
}

function escapeControls(text: string): string {
  return text.replace(/[\u0000-\u001F\u0080-\u009F]/g, (character) => {
    const code = character.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0");
    return `\\u${code}`;
  });
}
