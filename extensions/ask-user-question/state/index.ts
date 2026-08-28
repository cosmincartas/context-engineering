export interface QuestionnaireOption {
  readonly label: string;
  readonly description: string;
}

export interface QuestionnaireQuestion {
  readonly question: string;
  readonly header?: string;
  readonly options: readonly QuestionnaireOption[];
  readonly multiSelect: boolean;
}

export interface QuestionnaireDraftAnswer {
  readonly optionIndexes: readonly number[];
  readonly otherText?: string;
}

export interface QuestionnaireResultAnswer {
  readonly questionIndex: number;
  readonly question: string;
  readonly values: readonly string[];
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
  readonly answers: readonly (QuestionnaireDraftAnswer | undefined)[];
  readonly outcome?: QuestionnaireOutcome;
}

export type QuestionnaireStateEvent =
  | {
      readonly type: "selectOption";
      readonly questionIndex: number;
      readonly optionIndex: number;
    }
  | {
      readonly type: "submitOther";
      readonly questionIndex: number;
      readonly text: string;
    }
  | {
      readonly type: "advanceMultiple";
      readonly questionIndex: number;
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
      multiSelect: question.multiSelect ?? false,
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
    case "selectOption":
      return selectOption(state, event.questionIndex, event.optionIndex);
    case "submitOther":
      return submitOther(state, event.questionIndex, event.text);
    case "advanceMultiple":
      return advanceMultiple(state, event.questionIndex);
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
  if (state.activeTab === state.questions.length) return 2;
  return state.questions[state.activeTab].options.length +
    (state.questions[state.activeTab].multiSelect ? 2 : 1);
}

function selectOption(
  state: QuestionnaireState,
  questionIndex: number,
  optionIndex: number,
): QuestionnaireState {
  assertOptionIndex(state, questionIndex, optionIndex);

  const question = state.questions[questionIndex];
  const current = state.answers[questionIndex];
  if (!question.multiSelect) {
    return advanceQuestion(
      replaceAnswer(state, questionIndex, { optionIndexes: [optionIndex] }),
      questionIndex,
    );
  }

  const optionIndexes = current?.optionIndexes.includes(optionIndex)
    ? current.optionIndexes.filter((index) => index !== optionIndex)
    : [...(current?.optionIndexes ?? []), optionIndex].sort((left, right) => left - right);
  const answer: QuestionnaireDraftAnswer = {
    optionIndexes,
    ...(current?.otherText === undefined ? {} : { otherText: current.otherText }),
  };
  return replaceAnswer(state, questionIndex, answer);
}

function submitOther(
  state: QuestionnaireState,
  questionIndex: number,
  text: string,
): QuestionnaireState {
  assertQuestionIndex(state, questionIndex);
  const normalizedText = normalizeOtherText(text);
  const question = state.questions[questionIndex];

  if (!question.multiSelect) {
    return advanceQuestion(
      replaceAnswer(state, questionIndex, {
        optionIndexes: [],
        otherText: normalizedText,
      }),
      questionIndex,
    );
  }

  const current = state.answers[questionIndex];
  return replaceAnswer(state, questionIndex, {
    optionIndexes: current?.optionIndexes ?? [],
    ...(normalizedText === "" ? {} : { otherText: normalizedText }),
  });
}

function advanceMultiple(
  state: QuestionnaireState,
  questionIndex: number,
): QuestionnaireState {
  assertQuestionIndex(state, questionIndex);
  if (!state.questions[questionIndex].multiSelect) {
    throw new TypeError(`Question ${questionIndex} does not accept multiple answers`);
  }
  return advanceQuestion(state, questionIndex);
}

function replaceAnswer(
  state: QuestionnaireState,
  questionIndex: number,
  answer: QuestionnaireDraftAnswer,
): QuestionnaireState {
  const answers = state.answers.slice();
  answers[questionIndex] = answer;
  return { ...state, answers };
}

function advanceQuestion(
  state: QuestionnaireState,
  questionIndex: number,
): QuestionnaireState {
  return {
    ...state,
    activeTab: Math.min(state.questions.length, questionIndex + 1),
    activeRow: 0,
  };
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

function assertOptionIndex(
  state: QuestionnaireState,
  questionIndex: number,
  optionIndex: number,
): void {
  assertQuestionIndex(state, questionIndex);
  if (
    !Number.isInteger(optionIndex) ||
    optionIndex < 0 ||
    optionIndex >= state.questions[questionIndex].options.length
  ) {
    throw new RangeError(`Invalid option index: ${optionIndex}`);
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
      values: publicValues(question, state.answers[questionIndex]),
    })),
  };
}

function publicValues(
  question: QuestionnaireQuestion,
  answer: QuestionnaireDraftAnswer | undefined,
): readonly string[] {
  if (answer === undefined) return [];

  const values = answer.optionIndexes.map((optionIndex) => question.options[optionIndex].label);
  if (answer.otherText !== undefined) {
    values.push(answer.otherText === "" ? "Other" : answer.otherText);
  }
  return values;
}
