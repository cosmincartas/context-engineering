import assert from "node:assert/strict";
import test from "node:test";

import { CURSOR_MARKER, visibleWidth } from "@earendil-works/pi-tui";

import {
  createQuestionnaireComponent,
  type QuestionnaireTheme,
} from "./index.ts";
import type { QuestionnaireOutcome, QuestionnaireQuestion } from "../state/index.ts";

const questions: QuestionnaireQuestion[] = [
  {
    question: "Which delivery approach should we use?",
    header: "Approach",
    options: [
      { label: "Iterative", description: "Deliver a small slice first." },
      { label: "Big bang", description: "Deliver everything at once." },
    ],
  },
  {
    question: "Who is the audience?",
    options: [
      { label: "Operators", description: "People who run the system." },
      { label: "Developers", description: "People who extend the system." },
    ],
  },
  {
    question: "Which risk matters most?",
    header: "Risk",
    options: [
      { label: "Safety", description: "Avoid unsafe behavior." },
      { label: "Speed", description: "Keep the workflow quick." },
    ],
  },
];

const plainTheme: QuestionnaireTheme = {
  fg: (_color, text) => text,
  bg: (_color, text) => text,
  bold: (text) => text,
};

const input = {
  right: "\u001b[C",
  left: "\u001b[D",
  down: "\u001b[B",
  up: "\u001b[A",
  enter: "\r",
  escape: "\u001b",
  ctrlC: "\u0003",
};

function makeComponent(testQuestions: readonly QuestionnaireQuestion[] = questions) {
  const tui = {
    requestRender() {},
    terminal: { rows: 24 },
  };
  const outcomes: QuestionnaireOutcome[] = [];
  const component = createQuestionnaireComponent(
    tui,
    plainTheme,
    testQuestions,
    (outcome) => outcomes.push(outcome),
  );

  return { component, outcomes };
}

test("renders grouped tabs, completion markers, labels, and descriptions", () => {
  const { component } = makeComponent();
  const output = component.render(120).join("\n");

  assert.match(output, /Approach/);
  assert.match(output, /Q2/);
  assert.match(output, /Risk/);
  assert.match(output, /[·○]/);
  assert.match(output, /Iterative/);
  assert.match(output, /Deliver a small slice first\./);
  assert.match(output, /Other/);
  assert.match(output, /←/);
  assert.match(output, /→/);
});

test("routes arrows between tabs and Enter selects a listed answer", () => {
  const { component, outcomes } = makeComponent();

  component.handleInput?.(input.right);
  assert.match(component.render(120).join("\n"), /> \[·\] Q2/);

  component.handleInput?.(input.down);
  assert.match(component.render(120).join("\n"), /> \[ \] Developers/);
  component.handleInput?.(input.up);
  assert.match(component.render(120).join("\n"), /> \[ \] Operators/);
  component.handleInput?.(input.down);
  component.handleInput?.(input.enter);
  const output = component.render(120).join("\n");

  assert.match(output, /Developers/);
  assert.match(output, /✓/);
  assert.deepEqual(outcomes, []);

  component.handleInput?.(input.left);
  assert.match(component.render(120).join("\n"), /> \[·\] Approach/);
});

test("Escape cancels the grouped flow without draft answers", () => {
  const { component, outcomes } = makeComponent();

  component.handleInput?.(input.enter);
  component.handleInput?.(input.escape);

  assert.deepEqual(outcomes, [{ status: "cancelled", answers: [] }]);
});

test("Ctrl+C cancels the grouped flow without draft answers", () => {
  const { component, outcomes } = makeComponent();

  component.handleInput?.(input.enter);
  component.handleInput?.(input.ctrlC);

  assert.deepEqual(outcomes, [{ status: "cancelled", answers: [] }]);
});

test("keeps visible state meaning without color and fits every tested width", () => {
  const { component } = makeComponent();
  component.handleInput?.(input.enter);

  const meaningfulOutput = component.render(80).join("\n");
  assert.match(meaningfulOutput, />/);
  assert.match(meaningfulOutput, /✓/);
  assert.match(meaningfulOutput, /\[x\]/);

  const narrowOutput = component.render(1);
  for (const line of narrowOutput) {
    assert.ok(
      visibleWidth(line) <= 1,
      `line width ${visibleWidth(line)} exceeds 1: ${JSON.stringify(line)}`,
    );
  }

  for (const width of [1, 2, 5, 12, 24, 40, 80]) {
    component.invalidate();
    for (const line of component.render(width)) {
      assert.ok(
        visibleWidth(line) <= width,
        `line width ${visibleWidth(line)} exceeds ${width}: ${JSON.stringify(line)}`,
      );
    }
  }
});

test("renders control characters as visible escapes", () => {
  const unsafeQuestions: QuestionnaireQuestion[] = [
    {
      question: "Prompt\u0000 with a C0 control",
      header: "Header\u0085",
      options: [
        { label: "Label\u001b", description: "Description\u009f" },
        { label: "Safe", description: "Still safe" },
      ],
    },
  ];
  const { component } = makeComponent(unsafeQuestions);
  const lines = component.render(80);
  const output = lines.join("\n");

  assert.match(output, /\\u0000/);
  assert.match(output, /\\u0085/);
  assert.match(output, /\\u001B/);
  assert.match(output, /\\u009F/);
  assert.equal(
    lines.some((line) =>
      [...line].some((character) => {
        const code = character.charCodeAt(0);
        return (code >= 0 && code <= 0x1f) || (code >= 0x80 && code <= 0x9f);
      }),
    ),
    false,
  );
});

test("opens Other, submits trimmed text, and keeps the question active", () => {
  const { component, outcomes } = makeComponent(questions.slice(0, 1));

  component.handleInput?.(input.down);
  component.handleInput?.(input.down);
  component.handleInput?.(input.enter);
  assert.match(component.render(80).join("\n"), /Your answer/);

  component.handleInput?.("  custom answer  ");
  component.handleInput?.(input.enter);
  const edited = component.render(80).join("\n");
  assert.match(edited, /> \[x\] Other/);
  assert.deepEqual(outcomes, []);

  component.handleInput?.(input.right);
  assert.deepEqual(outcomes, []);
});

test("prefills a non-empty Other answer and leaves an empty answer empty", () => {
  const { component } = makeComponent(questions.slice(0, 1));

  component.handleInput?.(input.down);
  component.handleInput?.(input.down);
  component.handleInput?.(input.enter);
  component.handleInput?.("prefilled-value");
  component.handleInput?.(input.enter);
  component.handleInput?.(input.enter);
  assert.match(component.render(80).join("\n"), /prefilled-value/);
  component.handleInput?.(input.escape);

  const empty = makeComponent(questions.slice(0, 1)).component;
  empty.handleInput?.(input.down);
  empty.handleInput?.(input.down);
  empty.handleInput?.(input.enter);
  empty.handleInput?.(input.enter);
  empty.handleInput?.(input.enter);
  const emptyEditor = empty.render(80).join("\n");
  assert.match(emptyEditor, /Your answer/);
  assert.doesNotMatch(emptyEditor, /prefilled-value/);
});

test("Escape leaves Other editing without replacing an existing answer", () => {
  const { component } = makeComponent(questions.slice(0, 1));

  component.handleInput?.(input.enter);
  component.handleInput?.(input.down);
  component.handleInput?.(input.down);
  component.handleInput?.(input.enter);
  component.handleInput?.("draft");
  component.handleInput?.(input.escape);
  const output = component.render(80).join("\n");

  assert.match(output, /\[x\] Iterative/);
  assert.match(output, /> \[ \] Other/);
  assert.doesNotMatch(output, /draft/);
});

test("Ctrl+C cancels from Other editing without returning a draft", () => {
  const { component, outcomes } = makeComponent(questions.slice(0, 1));

  component.handleInput?.(input.down);
  component.handleInput?.(input.down);
  component.handleInput?.(input.enter);
  component.handleInput?.("draft");
  component.handleInput?.(input.ctrlC);

  assert.deepEqual(outcomes, [{ status: "cancelled", answers: [] }]);
});

test("forwards editor arrows and normalizes submitted control characters", () => {
  const { component } = makeComponent(questions.slice(0, 1));

  component.handleInput?.(input.down);
  component.handleInput?.(input.down);
  component.handleInput?.(input.enter);
  component.handleInput?.("abc");
  component.handleInput?.(input.left);
  component.handleInput?.("X\u0085");
  component.handleInput?.(input.enter);
  component.handleInput?.(input.enter);

  assert.match(component.render(80).join("\n"), /abX\\u0085c/);
});

test("propagates focus to the embedded Editor for input methods", () => {
  const { component } = makeComponent(questions.slice(0, 1));

  component.focused = true;
  component.handleInput?.(input.down);
  component.handleInput?.(input.down);
  component.handleInput?.(input.enter);

  assert.equal(component.focused, true);
  assert.ok(component.render(80).some((line) => line.includes(CURSOR_MARKER)));

  component.focused = false;
  assert.equal(component.render(80).some((line) => line.includes(CURSOR_MARKER)), false);
});

test("keeps embedded Editor lines within every supplied width", () => {
  const { component } = makeComponent(questions.slice(0, 1));

  component.handleInput?.(input.down);
  component.handleInput?.(input.down);
  component.handleInput?.(input.enter);
  component.handleInput?.("a long custom answer that must wrap safely");

  for (const width of [1, 2, 5, 12, 24, 40, 80]) {
    component.invalidate();
    for (const line of component.render(width)) {
      assert.ok(
        visibleWidth(line) <= width,
        `line width ${visibleWidth(line)} exceeds ${width}: ${JSON.stringify(line)}`,
      );
    }
  }
});
