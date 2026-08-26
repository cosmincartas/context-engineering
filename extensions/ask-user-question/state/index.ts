export interface QuestionnaireOption {
  readonly label: string;
  readonly description: string;
}

export interface QuestionnaireQuestion {
  readonly question: string;
  readonly header?: string;
  readonly options: readonly QuestionnaireOption[];
}

export interface OptionAnswer {
  readonly kind: "option";
  readonly optionIndex: number;
  readonly label: string;
}

export interface OtherAnswer {
  readonly kind: "other";
  readonly text: string;
}

export type QuestionnaireAnswer = OptionAnswer | OtherAnswer;

export type QuestionnaireAnswerInput =
  | {
      readonly kind: "option";
      readonly optionIndex: number;
    }
  | {
      readonly kind: "other";
      readonly text: string;
    };

export interface QuestionnaireResultAnswer {
  readonly questionIndex: number;
  readonly question: string;
  readonly value: string;
}

export interface SubmittedQuestionnaireOutcome {
  readonly status: "submitted";
  readonly answers: readonly QuestionnaireResultAnswer[];
}

export interface CancelledQuestionnaireOutcome {
  readonly status: "cancelled";
  readonly answers: readonly [];
}

export type QuestionnaireOutcome =
  | SubmittedQuestionnaireOutcome
  | CancelledQuestionnaireOutcome;

export interface QuestionnaireState {
  readonly questions: readonly QuestionnaireQuestion[];
  readonly activeTab: number;
  readonly activeRow: number;
  readonly answers: readonly (QuestionnaireAnswer | undefined)[];
  readonly outcome?: QuestionnaireOutcome;
}

export type QuestionnaireStateEvent =
  | {
      readonly type: "answer";
      readonly questionIndex: number;
      readonly answer: QuestionnaireAnswerInput;
    }
  | {
      readonly type: "moveRow";
      readonly direction: "up" | "down";
    }
  | {
      readonly type: "moveTab";
      readonly direction: "left" | "right";
    }
  | { readonly type: "confirm" }
  | { readonly type: "cancel" };

export function createQuestionnaireState(
  questions: readonly QuestionnaireQuestion[],
): QuestionnaireState {
  return {
    questions: questions.map((question) => ({
      question: question.question,
      ...(question.header === undefined ? {} : { header: question.header }),
      options: question.options.map((option) => ({
        label: option.label,
        description: option.description,
      })),
    })),
    activeTab: 0,
    activeRow: 0,
    answers: Array.from({ length: questions.length }, () => undefined),
  };
}

export function reduceQuestionnaireState(
  state: QuestionnaireState,
  event: QuestionnaireStateEvent,
): QuestionnaireState {
  if (state.outcome !== undefined) {
    return state;
  }

  switch (event.type) {
    case "answer":
      return answerQuestion(state, event.questionIndex, event.answer);
    case "moveRow":
      return moveRow(state, event.direction);
    case "moveTab":
      return moveTab(state, event.direction);
    case "confirm":
      return { ...state, outcome: buildSubmittedOutcome(state) };
    case "cancel":
      return {
        ...state,
        answers: state.answers.map(() => undefined),
        outcome: { status: "cancelled", answers: [] },
      };
  }
}

function moveRow(
  state: QuestionnaireState,
  direction: "up" | "down",
): QuestionnaireState {
  const maximumRow = rowCount(state) - 1;
  const offset = direction === "down" ? 1 : -1;
  const activeRow = Math.min(
    maximumRow,
    Math.max(0, state.activeRow + offset),
  );

  return { ...state, activeRow };
}

function moveTab(
  state: QuestionnaireState,
  direction: "left" | "right",
): QuestionnaireState {
  const maximumTab = state.questions.length;
  const offset = direction === "right" ? 1 : -1;
  const activeTab = Math.min(
    maximumTab,
    Math.max(0, state.activeTab + offset),
  );

  if (activeTab === state.activeTab) {
    return state;
  }

  return { ...state, activeTab, activeRow: 0 };
}

function rowCount(state: QuestionnaireState): number {
  return state.activeTab === state.questions.length
    ? 2
    : state.questions[state.activeTab].options.length + 1;
}

function answerQuestion(
  state: QuestionnaireState,
  questionIndex: number,
  answer: QuestionnaireAnswerInput,
): QuestionnaireState {
  assertQuestionIndex(state, questionIndex);

  const question = state.questions[questionIndex];
  const answers = state.answers.slice();

  if (answer.kind === "option") {
    if (
      !Number.isInteger(answer.optionIndex) ||
      answer.optionIndex < 0 ||
      answer.optionIndex >= question.options.length
    ) {
      throw new RangeError(`Invalid option index: ${answer.optionIndex}`);
    }

    answers[questionIndex] =
      state.answers[questionIndex]?.kind === "option" &&
      state.answers[questionIndex].optionIndex === answer.optionIndex
        ? undefined
        : {
            kind: "option",
            optionIndex: answer.optionIndex,
            label: question.options[answer.optionIndex].label,
          };
  } else {
    answers[questionIndex] = {
      kind: "other",
      text: normalizeOtherText(answer.text),
    };
  }

  return { ...state, answers };
}

function assertQuestionIndex(
  state: QuestionnaireState,
  questionIndex: number,
): void {
  if (
    !Number.isInteger(questionIndex) ||
    questionIndex < 0 ||
    questionIndex >= state.questions.length
  ) {
    throw new RangeError(`Invalid question index: ${questionIndex}`);
  }
}

function normalizeOtherText(text: string): string {
  const escaped = text.replace(/[\u0000-\u001F\u0080-\u009F]/g, (character) => {
    const code = character.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0");
    return `\\u${code}`;
  });

  return escaped.trim();
}

function buildSubmittedOutcome(
  state: QuestionnaireState,
): SubmittedQuestionnaireOutcome {
  return {
    status: "submitted",
    answers: state.questions.map((question, questionIndex) => ({
      questionIndex,
      question: question.question,
      value: publicValue(state.answers[questionIndex]),
    })),
  };
}

function publicValue(answer: QuestionnaireAnswer | undefined): string {
  if (answer === undefined) {
    return "Skipped";
  }

  return answer.kind === "option"
    ? answer.label
    : answer.text === ""
      ? "Other"
      : answer.text;
}
