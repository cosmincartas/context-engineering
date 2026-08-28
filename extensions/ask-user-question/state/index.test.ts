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
    multiSelect: false,
  },
  {
    question: "Choose a size",
    header: "Size",
    options: [
      { label: "Small", description: "A compact size" },
      { label: "Large", description: "A roomy size" },
    ],
    multiSelect: false,
  },
];

test("single answers replace drafts, advance, and build ordered value arrays", () => {
  const initial = createQuestionnaireState(
    questions.map((question) => ({ ...question, multiSelect: false })),
  );
  const selected = reduceQuestionnaireState(initial, {
    type: "selectOption",
    questionIndex: 0,
    optionIndex: 0,
  });

  assert.deepEqual(selected.answers[0], { optionIndexes: [0] });
  assert.equal(selected.activeTab, 1);

  const revisited = reduceQuestionnaireState(selected, {
    type: "moveTab",
    direction: "left",
  });
  const replaced = reduceQuestionnaireState(revisited, {
    type: "selectOption",
    questionIndex: 0,
    optionIndex: 1,
  });
  assert.deepEqual(replaced.answers[0], { optionIndexes: [1] });
  assert.equal(replaced.activeTab, 1);

  const emptyOther = reduceQuestionnaireState(
    reduceQuestionnaireState(replaced, {
      type: "moveTab",
      direction: "left",
    }),
    { type: "submitOther", questionIndex: 0, text: "  " },
  );
  assert.deepEqual(emptyOther.answers[0], { optionIndexes: [], otherText: "" });
  assert.equal(emptyOther.activeTab, 1);

  const submitted = reduceQuestionnaireState(
    reduceQuestionnaireState(emptyOther, { type: "moveTab", direction: "right" }),
    { type: "confirm" },
  );
  assert.deepEqual(submitted.outcome?.answers, [
    { questionIndex: 0, question: "Choose a color", values: ["Other"] },
    { questionIndex: 1, question: "Choose a size", values: [] },
  ]);
});

test("single option selections replace drafts and advance", () => {
  const initial = createQuestionnaireState(questions);
  const selected = reduceQuestionnaireState(initial, {
    type: "selectOption",
    questionIndex: 0,
    optionIndex: 0,
  });
  const revisited = reduceQuestionnaireState(selected, {
    type: "moveTab",
    direction: "left",
  });
  const replaced = reduceQuestionnaireState(revisited, {
    type: "selectOption",
    questionIndex: 0,
    optionIndex: 1,
  });

  assert.equal(initial.answers[0], undefined);
  assert.deepEqual(selected.answers[0], { optionIndexes: [0] });
  assert.deepEqual(replaced.answers[0], { optionIndexes: [1] });
  assert.equal(selected.activeTab, 1);
  assert.equal(replaced.activeTab, 1);
  assert.notStrictEqual(selected, replaced);
});

test("multiple answers toggle independently, retain Other, clear it, and advance", () => {
  const multipleQuestion: QuestionnaireQuestion = {
    question: "Choose features",
    header: "Features",
    options: [
      { label: "Alpha", description: "First" },
      { label: "Beta", description: "Second" },
      { label: "Gamma", description: "Third" },
    ],
    multiSelect: true,
  };
  let state = createQuestionnaireState([multipleQuestion]);

  state = reduceQuestionnaireState(state, {
    type: "selectOption",
    questionIndex: 0,
    optionIndex: 2,
  });
  state = reduceQuestionnaireState(state, {
    type: "selectOption",
    questionIndex: 0,
    optionIndex: 0,
  });
  assert.deepEqual(state.answers[0], { optionIndexes: [0, 2] });
  assert.equal(state.activeTab, 0);

  state = reduceQuestionnaireState(state, {
    type: "submitOther",
    questionIndex: 0,
    text: " custom ",
  });
  assert.deepEqual(state.answers[0], {
    optionIndexes: [0, 2],
    otherText: "custom",
  });
  assert.equal(state.activeTab, 0);
  const submittedWithOther = reduceQuestionnaireState(
    reduceQuestionnaireState(state, { type: "advanceMultiple", questionIndex: 0 }),
    { type: "confirm" },
  );
  assert.deepEqual(submittedWithOther.outcome?.answers[0]?.values, [
    "Alpha",
    "Gamma",
    "custom",
  ]);

  state = reduceQuestionnaireState(state, {
    type: "submitOther",
    questionIndex: 0,
    text: "   ",
  });
  assert.deepEqual(state.answers[0], { optionIndexes: [0, 2] });

  state = reduceQuestionnaireState(state, {
    type: "selectOption",
    questionIndex: 0,
    optionIndex: 2,
  });
  assert.deepEqual(state.answers[0], { optionIndexes: [0] });
  state = reduceQuestionnaireState(state, {
    type: "selectOption",
    questionIndex: 0,
    optionIndex: 0,
  });
  assert.deepEqual(state.answers[0], { optionIndexes: [] });

  const advanced = reduceQuestionnaireState(state, {
    type: "advanceMultiple",
    questionIndex: 0,
  });
  assert.equal(advanced.activeTab, 1);
  assert.equal(advanced.activeRow, 0);
  const submitted = reduceQuestionnaireState(advanced, { type: "confirm" });
  assert.deepEqual(submitted.outcome?.answers[0]?.values, []);
});

test("Other answers escape C0 and C1 controls before trimming", () => {
  const state = reduceQuestionnaireState(createQuestionnaireState(questions), {
    type: "submitOther",
    questionIndex: 0,
    text: "  custom\nanswer\u0085  ",
  });

  assert.deepEqual(state.answers[0], {
    optionIndexes: [],
    otherText: "custom\\u000Aanswer\\u0085",
  });

  const submitted = reduceQuestionnaireState(state, { type: "confirm" });
  assert.deepEqual(submitted.outcome, {
    status: "submitted",
    answers: [
      {
        questionIndex: 0,
        question: "Choose a color",
        values: ["custom\\u000Aanswer\\u0085"],
      },
      {
        questionIndex: 1,
        question: "Choose a size",
        values: [],
      },
    ],
  });
});

test("empty and whitespace-only single Other answers remain explicit completed answers", () => {
  const initial = createQuestionnaireState(questions);
  const empty = reduceQuestionnaireState(initial, {
    type: "submitOther",
    questionIndex: 0,
    text: "",
  });
  const whitespace = reduceQuestionnaireState(empty, {
    type: "submitOther",
    questionIndex: 1,
    text: "   ",
  });

  assert.deepEqual(empty.answers[0], { optionIndexes: [], otherText: "" });
  assert.deepEqual(whitespace.answers[1], { optionIndexes: [], otherText: "" });

  const submitted = reduceQuestionnaireState(whitespace, { type: "confirm" });
  assert.deepEqual(submitted.outcome?.answers.map((answer) => answer.values), [
    ["Other"],
    ["Other"],
  ]);
});

test("confirm derives ordered public arrays and defaults missing answers", () => {
  const state = reduceQuestionnaireState(
    reduceQuestionnaireState(createQuestionnaireState(questions), {
      type: "selectOption",
      questionIndex: 1,
      optionIndex: 1,
    }),
    { type: "confirm" },
  );

  assert.deepEqual(state.outcome, {
    status: "submitted",
    answers: [
      {
        questionIndex: 0,
        question: "Choose a color",
        values: [],
      },
      {
        questionIndex: 1,
        question: "Choose a size",
        values: ["Large"],
      },
    ],
  });
});

test("cancel discards draft answers and returns no public answers", () => {
  const answered = reduceQuestionnaireState(createQuestionnaireState(questions), {
    type: "selectOption",
    questionIndex: 0,
    optionIndex: 0,
  });
  const cancelled = reduceQuestionnaireState(answered, { type: "cancel" });

  assert.deepEqual(cancelled.answers, [undefined, undefined]);
  assert.deepEqual(cancelled.outcome, { status: "cancelled", answers: [] });
  assert.deepEqual(answered.answers[0], { optionIndexes: [0] });
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

test("single option selection advances from the selected question", () => {
  const focused = reduceQuestionnaireState(
    reduceQuestionnaireState(createQuestionnaireState(questions), {
      type: "moveTab",
      direction: "right",
    }),
    { type: "moveRow", direction: "down" },
  );
  const selected = reduceQuestionnaireState(focused, {
    type: "selectOption",
    questionIndex: focused.activeTab,
    optionIndex: focused.activeRow,
  });

  assert.equal(focused.activeTab, 1);
  assert.equal(focused.activeRow, 1);
  assert.equal(selected.activeTab, 2);
  assert.equal(selected.activeRow, 0);
  assert.deepEqual(selected.answers[1], { optionIndexes: [1] });
});
