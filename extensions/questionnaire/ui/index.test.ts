import assert from "node:assert/strict";
import test from "node:test";

import { visibleWidth } from "@earendil-works/pi-tui";

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
  enter: "\r",
  escape: "\u001b",
};

function makeComponent() {
  const tui = {
    requestRender() {},
  };
  const outcomes: QuestionnaireOutcome[] = [];
  const component = createQuestionnaireComponent(
    tui,
    plainTheme,
    questions,
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

test("keeps visible state meaning without color and fits every tested width", () => {
  const { component } = makeComponent();
  component.handleInput?.(input.enter);

  const meaningfulOutput = component.render(80).join("\n");
  assert.match(meaningfulOutput, />/);
  assert.match(meaningfulOutput, /✓/);
  assert.match(meaningfulOutput, /\[x\]/);

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
