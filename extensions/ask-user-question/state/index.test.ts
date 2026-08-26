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

test("row navigation clamps at the first and last question rows", () => {
  const initial = createQuestionnaireState(questions);
  const atFirst = reduceQuestionnaireState(initial, {
    type: "moveRow",
    direction: "up",
  });
  const atSecond = reduceQuestionnaireState(atFirst, {
    type: "moveRow",
    direction: "down",
  });
  const atOther = reduceQuestionnaireState(atSecond, {
    type: "moveRow",
    direction: "down",
  });
  const stillAtOther = reduceQuestionnaireState(atOther, {
    type: "moveRow",
    direction: "down",
  });

  assert.equal(atFirst.activeRow, 0);
  assert.equal(atSecond.activeRow, 1);
  assert.equal(atOther.activeRow, 2);
  assert.equal(stillAtOther.activeRow, 2);

  const backAtSecond = reduceQuestionnaireState(atOther, {
    type: "moveRow",
    direction: "up",
  });
  assert.equal(backAtSecond.activeRow, 1);
});

test("tab navigation clamps at the first and final tabs", () => {
  const initial = createQuestionnaireState(questions);
  const stillFirst = reduceQuestionnaireState(initial, {
    type: "moveTab",
    direction: "left",
  });
  const second = reduceQuestionnaireState(initial, {
    type: "moveTab",
    direction: "right",
  });
  const final = reduceQuestionnaireState(second, {
    type: "moveTab",
    direction: "right",
  });
  const stillFinal = reduceQuestionnaireState(final, {
    type: "moveTab",
    direction: "right",
  });

  assert.equal(stillFirst.activeTab, 0);
  assert.equal(second.activeTab, 1);
  assert.equal(final.activeTab, questions.length);
  assert.equal(stillFinal.activeTab, questions.length);
});

test("entering the final tab focuses Confirm", () => {
  const focusedOnOther = reduceQuestionnaireState(
    reduceQuestionnaireState(createQuestionnaireState(questions), {
      type: "moveRow",
      direction: "down",
    }),
    { type: "moveRow", direction: "down" },
  );
  const second = reduceQuestionnaireState(focusedOnOther, {
    type: "moveTab",
    direction: "right",
  });
  const final = reduceQuestionnaireState(second, {
    type: "moveTab",
    direction: "right",
  });

  assert.equal(focusedOnOther.activeRow, 2);
  assert.equal(final.activeTab, questions.length);
  assert.equal(final.activeRow, 0);

  const cancel = reduceQuestionnaireState(final, {
    type: "moveRow",
    direction: "down",
  });
  assert.equal(cancel.activeRow, 1);

  const backToQuestion = reduceQuestionnaireState(cancel, {
    type: "moveTab",
    direction: "left",
  });
  assert.equal(backToQuestion.activeTab, 1);
  assert.equal(backToQuestion.activeRow, 0);
});

test("answer selection keeps the selected question active", () => {
  const focused = reduceQuestionnaireState(
    reduceQuestionnaireState(createQuestionnaireState(questions), {
      type: "moveTab",
      direction: "right",
    }),
    { type: "moveRow", direction: "down" },
  );
  const selected = reduceQuestionnaireState(focused, {
    type: "answer",
    questionIndex: focused.activeTab,
    answer: { kind: "option", optionIndex: focused.activeRow },
  });

  assert.equal(focused.activeTab, 1);
  assert.equal(focused.activeRow, 1);
  assert.equal(selected.activeTab, 1);
  assert.equal(selected.activeRow, 1);
  assert.deepEqual(selected.answers[1], {
    kind: "option",
    optionIndex: 1,
    label: "Large",
  });
});
