import assert from "node:assert/strict";
import test from "node:test";

import {
  createQuestionnaireState,
  reduceQuestionnaireState,
  type QuestionnaireQuestion,
} from "./index.ts";

const questions: QuestionnaireQuestion[] = [
  {
    question: "Choose a color",
    header: "Color",
    options: [
      { label: "Blue", description: "A cool color" },
      { label: "Green", description: "A fresh color" },
    ],
  },
  {
    question: "Choose a size",
    header: "Size",
    options: [
      { label: "Small", description: "A compact size" },
      { label: "Large", description: "A roomy size" },
    ],
  },
];

test("answer events replace the current answer and preserve tagged provenance", () => {
  const initial = createQuestionnaireState(questions);
  const selected = reduceQuestionnaireState(initial, {
    type: "answer",
    questionIndex: 0,
    answer: { kind: "option", optionIndex: 0 },
  });
  const replaced = reduceQuestionnaireState(selected, {
    type: "answer",
    questionIndex: 0,
    answer: { kind: "option", optionIndex: 1 },
  });

  assert.equal(initial.answers[0], undefined);
  assert.deepEqual(selected.answers[0], {
    kind: "option",
    optionIndex: 0,
    label: "Blue",
  });
  assert.deepEqual(replaced.answers[0], {
    kind: "option",
    optionIndex: 1,
    label: "Green",
  });
  assert.notStrictEqual(selected, replaced);
});

test("Other answers escape C0 and C1 controls before trimming", () => {
  const state = reduceQuestionnaireState(createQuestionnaireState(questions), {
    type: "answer",
    questionIndex: 0,
    answer: { kind: "other", text: "  custom\nanswer\u0085  " },
  });

  assert.deepEqual(state.answers[0], {
    kind: "other",
    text: "custom\\u000Aanswer\\u0085",
  });

  const submitted = reduceQuestionnaireState(state, { type: "confirm" });
  assert.deepEqual(submitted.outcome, {
    status: "submitted",
    answers: [
      {
        questionIndex: 0,
        question: "Choose a color",
        value: "custom\\u000Aanswer\\u0085",
      },
      {
        questionIndex: 1,
        question: "Choose a size",
        value: "Skipped",
      },
    ],
  });
});

test("empty and whitespace-only Other answers remain explicit completed answers", () => {
  const initial = createQuestionnaireState(questions);
  const empty = reduceQuestionnaireState(initial, {
    type: "answer",
    questionIndex: 0,
    answer: { kind: "other", text: "" },
  });
  const whitespace = reduceQuestionnaireState(empty, {
    type: "answer",
    questionIndex: 1,
    answer: { kind: "other", text: "   " },
  });

  assert.deepEqual(empty.answers[0], { kind: "other", text: "" });
  assert.deepEqual(whitespace.answers[1], { kind: "other", text: "" });

  const submitted = reduceQuestionnaireState(whitespace, { type: "confirm" });
  assert.deepEqual(submitted.outcome?.answers.map((answer) => answer.value), [
    "Other",
    "Other",
  ]);
});

test("confirm derives one ordered public answer per question and defaults missing answers", () => {
  const state = reduceQuestionnaireState(
    reduceQuestionnaireState(createQuestionnaireState(questions), {
      type: "answer",
      questionIndex: 1,
      answer: { kind: "option", optionIndex: 1 },
    }),
    { type: "confirm" },
  );

  assert.deepEqual(state.outcome, {
    status: "submitted",
    answers: [
      {
        questionIndex: 0,
        question: "Choose a color",
        value: "Skipped",
      },
      {
        questionIndex: 1,
        question: "Choose a size",
        value: "Large",
      },
    ],
  });
});

test("cancel discards draft answers and returns no public answers", () => {
  const answered = reduceQuestionnaireState(createQuestionnaireState(questions), {
    type: "answer",
    questionIndex: 0,
    answer: { kind: "option", optionIndex: 0 },
  });
  const cancelled = reduceQuestionnaireState(answered, { type: "cancel" });

  assert.deepEqual(cancelled.answers, [undefined, undefined]);
  assert.deepEqual(cancelled.outcome, { status: "cancelled", answers: [] });
  assert.deepEqual(answered.answers[0], {
    kind: "option",
    optionIndex: 0,
    label: "Blue",
  });
});
