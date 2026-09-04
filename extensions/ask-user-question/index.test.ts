import assert from "node:assert/strict";
import test from "node:test";

import {
  getKeybindings,
  visibleWidth,
  type Component,
  type TUI,
} from "@earendil-works/pi-tui";
import askUserQuestion from "./index.ts";

interface RegisteredTool {
  name: string;
  label: string;
  description: string;
  parameters: Record<string, any>;
  execute: (...args: any[]) => Promise<any>;
  renderCall: (args: any, theme: any, context: any) => Component;
  renderResult: (result: any, options: any, theme: any, context: any) => Component;
}

const plainTheme = {
  fg: (_color: string, text: string) => text,
  bg: (_color: string, text: string) => text,
  bold: (text: string) => text,
};

const input = {
  right: "\u001b[C",
  down: "\u001b[B",
  enter: "\r",
  escape: "\u001b",
};

const validRequest = {
  questions: [
    {
      question: "Choose a delivery approach",
      header: "Approach",
      options: [
        { label: "Iterative", description: "Deliver a small slice first." },
        { label: "Big bang", description: "Deliver everything at once." },
      ],
    },
  ],
};

function registeredTool(): RegisteredTool {
  let captured: RegisteredTool | undefined;
  askUserQuestion({
    registerTool(tool: RegisteredTool) {
      assert.equal(captured, undefined, "ask-user-question must register one tool");
      captured = tool;
    },
  } as any);
  assert.ok(captured);
  return captured;
}

function makeTui(): TUI {
  return {
    requestRender() {},
    terminal: { rows: 24 },
  } as unknown as TUI;
}

function makeContext(
  mode: "tui" | "rpc" | "json" | "print",
  onComponent?: (component: Component) => void,
  keybindings = getKeybindings(),
) {
  let customCalls = 0;
  let doneCalls = 0;
  const context = {
    mode,
    ui: {
      custom: async (factory: any) => {
        customCalls += 1;
        return new Promise((resolve) => {
          const done = (outcome: unknown) => {
            doneCalls += 1;
            resolve(outcome);
          };
          const component = factory(makeTui(), plainTheme, keybindings, done);
          onComponent?.(component);
        });
      },
    },
  };
  return {
    context,
    get customCalls() {
      return customCalls;
    },
    get doneCalls() {
      return doneCalls;
    },
  };
}

function resultFromJson(result: any): any {
  const text = result.content?.[0]?.text;
  assert.equal(typeof text, "string");
  return JSON.parse(text);
}

function assertSerializedResult(result: any): void {
  assert.deepEqual(resultFromJson(result), result.details);
}

test("registers exactly one AskUserQuestion tool with a closed bounded schema", () => {
  const tool = registeredTool();
  const questionSchema = tool.parameters.properties.questions.items;
  const optionSchema = questionSchema.properties.options.items;

  assert.equal(tool.name, "AskUserQuestion");
  assert.equal(tool.label, "AskUserQuestion");
  assert.equal((tool as any).executionMode, "sequential");
  assert.equal(tool.parameters.additionalProperties, false);
  assert.equal(tool.parameters.properties.questions.minItems, 1);
  assert.equal(tool.parameters.properties.questions.maxItems, 4);
  assert.equal(questionSchema.additionalProperties, false);
  assert.equal(optionSchema.additionalProperties, false);
  assert.equal(questionSchema.properties.options.minItems, 2);
  assert.equal(questionSchema.properties.options.maxItems, 4);
  assert.match(questionSchema.properties.options.description, /distinct, non-overlapping/);
  assert.match(questionSchema.properties.options.description, /adds Other/);
  assert.match(optionSchema.properties.label.description, /Do not use Other/);
  assert.match(optionSchema.properties.description.description, /Do not repeat the label/);
  assert.match(tool.description, /fewest useful, distinct options/);
  assert.match(tool.description, /adds Other automatically/);
  assert.deepEqual(questionSchema.required, ["question", "options"]);
  assert.deepEqual(optionSchema.required, ["label", "description"]);
});

test("accepts optional boolean multiSelect and rejects malformed or unknown question fields", async () => {
  const tool = registeredTool();
  const questionSchema = tool.parameters.properties.questions.items;

  assert.equal(questionSchema.properties.multiSelect.type, "boolean");
  assert.deepEqual(questionSchema.required, ["question", "options"]);

  for (const multiSelect of [true, false, undefined]) {
    const question = { ...validRequest.questions[0] };
    if (multiSelect !== undefined) question.multiSelect = multiSelect;
    const harness = makeContext("rpc");
    const result = await tool.execute("call", { questions: [question] }, undefined, undefined, harness.context);
    assert.equal(result.details.status, "unsupported");
    assert.equal(harness.customCalls, 0);
  }

  for (const multiSelect of ["true", 1, null, []]) {
    const harness = makeContext("rpc");
    await assert.rejects(
      tool.execute(
        "call",
        { questions: [{ ...validRequest.questions[0], multiSelect }] },
        undefined,
        undefined,
        harness.context,
      ),
    );
    assert.equal(harness.customCalls, 0);
  }

  const harness = makeContext("rpc");
  await assert.rejects(
    tool.execute(
      "call",
      { questions: [{ ...validRequest.questions[0], unexpected: true }] },
      undefined,
      undefined,
      harness.context,
    ),
  );
  assert.equal(harness.customCalls, 0);
});

test("accepts every question and option count boundary and rejects counts outside it", async () => {
  const tool = registeredTool();
  const validMax = {
    questions: Array.from({ length: 4 }, (_, questionIndex) => ({
      question: `Question ${questionIndex}`,
      options: Array.from({ length: 4 }, (_, optionIndex) => ({
        label: `Option ${optionIndex}`,
        description: `Description ${optionIndex}`,
      })),
    })),
  };

  for (const request of [validRequest, validMax]) {
    const harness = makeContext("rpc");
    const result = await tool.execute("call", request, undefined, undefined, harness.context);
    assert.equal(result.details.status, "unsupported");
    assert.equal(harness.customCalls, 0);
  }

  for (const request of [
    { questions: [] },
    { questions: [...validMax.questions, validMax.questions[0]] },
    {
      questions: [
        {
          ...validRequest.questions[0],
          options: [validRequest.questions[0].options[0]],
        },
      ],
    },
    {
      questions: [
        {
          ...validRequest.questions[0],
          options: [
            ...validRequest.questions[0].options,
            { label: "Third", description: "A third option." },
            { label: "Fourth", description: "A fourth option." },
            { label: "Fifth", description: "A fifth option." },
          ],
        },
      ],
    },
  ]) {
    const harness = makeContext("rpc");
    await assert.rejects(tool.execute("call", request, undefined, undefined, harness.context));
    assert.equal(harness.customCalls, 0);
  }
});

test("rejects blank and C0/C1 request text before checking any mode", async () => {
  const tool = registeredTool();
  const invalidRequests = [
    { ...validRequest, questions: [{ ...validRequest.questions[0], question: "   " }] },
    {
      ...validRequest,
      questions: [{ ...validRequest.questions[0], header: "Header\u0000" }],
    },
    {
      ...validRequest,
      questions: [
        {
          ...validRequest.questions[0],
          options: [{ label: "\u0085", description: "Description" }, validRequest.questions[0].options[1]],
        },
      ],
    },
    {
      ...validRequest,
      questions: [
        {
          ...validRequest.questions[0],
          options: [{ label: "Label", description: "\u001b" }, validRequest.questions[0].options[1]],
        },
      ],
    },
  ];

  for (const mode of ["tui", "rpc", "json", "print"] as const) {
    for (const request of invalidRequests) {
      const harness = makeContext(mode);
      await assert.rejects(tool.execute("call", request, undefined, undefined, harness.context));
      assert.equal(harness.customCalls, 0, `${mode} opened UI for invalid request`);
    }
  }
});

test("returns unsupported results for every valid non-TUI mode", async () => {
  const tool = registeredTool();

  for (const mode of ["rpc", "json", "print"] as const) {
    const harness = makeContext(mode);
    const result = await tool.execute("call", validRequest, undefined, undefined, harness.context);
    assert.deepEqual(result.details, { status: "unsupported", answers: [], mode });
    assertSerializedResult(result);
    assert.equal(harness.customCalls, 0);
  }
});

test("normalizes headers, runs the TUI component, and serializes submitted results", async () => {
  const tool = registeredTool();
  let firstRender = "";
  const harness = makeContext("tui", (component) => {
    firstRender = component.render(100).join("\n");
    component.handleInput?.(input.enter);
    component.handleInput?.(input.right);
    component.handleInput?.(input.enter);
  });
  const request = {
    questions: [
      { ...validRequest.questions[0], header: "   " },
    ],
  };

  const result = await tool.execute("call", request, undefined, undefined, harness.context);

  assert.match(firstRender, /Q1/);
  assert.match(firstRender, /1\. Iterative/);
  assert.doesNotMatch(firstRender, /\[ \] Iterative/);
  assert.match(result.content[0].text, /"status":"submitted"/);
  assert.deepEqual(result.details, {
    status: "submitted",
    answers: [
      {
        questionIndex: 0,
        question: "Choose a delivery approach",
        values: ["Iterative"],
      },
    ],
  });
  assertSerializedResult(result);
  assert.equal(harness.customCalls, 1);
});

test("preserves printable whitespace around supplied headers", async () => {
  const tool = registeredTool();
  let firstRender = "";
  const request = {
    questions: [{ ...validRequest.questions[0], header: "  Deployment  " }],
  };
  const harness = makeContext("tui", (component) => {
    firstRender = component.render(100).join("\n");
    component.handleInput?.(input.escape);
  });

  await tool.execute("call", request, undefined, undefined, harness.context);

  assert.ok(firstRender.includes("  Deployment  "));
  const callText = tool.renderCall(request, plainTheme, {}).render(100).join("\n");
  assert.ok(callText.includes("  Deployment  "));
});

test("returns an answer-free cancelled result from the TUI", async () => {
  const tool = registeredTool();
  const harness = makeContext("tui", (component) => {
    component.handleInput?.(input.enter);
    component.handleInput?.(input.escape);
  });

  const result = await tool.execute("call", validRequest, undefined, undefined, harness.context);

  assert.deepEqual(result.details, { status: "cancelled", answers: [] });
  assertSerializedResult(result);
  assert.equal(harness.customCalls, 1);
});

test("forwards the injected keybindings to the questionnaire editor", async () => {
  const tool = registeredTool();
  let matchesCalls = 0;
  const injectedKeybindings = {
    getResolvedBindings: () => ({ "tui.editor.synthetic": "\u001d" }),
    matches: (data: string) => {
      matchesCalls += 1;
      return data === "\u001d";
    },
  };
  const harness = makeContext(
    "tui",
    (component) => {
      component.handleInput?.(input.down);
      component.handleInput?.(input.down);
      component.handleInput?.(input.enter);
      component.handleInput?.("\u001d");
      component.handleInput?.(input.escape);
      component.handleInput?.(input.escape);
    },
    injectedKeybindings as any,
  );

  const result = await tool.execute("call", validRequest, undefined, undefined, harness.context);

  assert.deepEqual(result.details, { status: "cancelled", answers: [] });
  assert.ok(matchesCalls > 0, "the injected keybindings manager was not consulted");
});

test("tears down the custom UI and preserves an arbitrary abort reason", async () => {
  const tool = registeredTool();
  const controller = new AbortController();
  const reason = { code: "questionnaire-aborted" };
  const harness = makeContext("tui");
  const pending = tool.execute("call", validRequest, controller.signal, undefined, harness.context);

  controller.abort(reason);

  await assert.rejects(pending, (error) => error === reason);
  assert.equal(harness.customCalls, 1);
  assert.equal(harness.doneCalls, 1);
});

test("does not replace a submitted result when abort arrives after completion", async () => {
  const tool = registeredTool();
  const controller = new AbortController();
  const harness = makeContext("tui", (component) => {
    component.handleInput?.(input.enter);
    component.handleInput?.(input.right);
    component.handleInput?.(input.enter);
    controller.abort(new Error("late abort"));
  });

  const result = await tool.execute("call", validRequest, controller.signal, undefined, harness.context);

  assert.equal(result.details.status, "submitted");
});

test("renders visible call and terminal status components", async () => {
  const tool = registeredTool();
  const callText = tool.renderCall(validRequest, plainTheme, {}).render(120).join("\n");
  assert.match(callText, /AskUserQuestion/);
  assert.match(callText, /1 question/);

  for (const details of [
    { status: "submitted", answers: validRequest.questions.map((question, index) => ({ questionIndex: index, question: question.question, values: ["Iterative"] })) },
    { status: "cancelled", answers: [] },
    { status: "unsupported", answers: [], mode: "rpc" },
  ]) {
    const result = {
      content: [{ type: "text", text: JSON.stringify(details) }],
      details,
    };
    const rendered = tool.renderResult(result, { expanded: false, isPartial: false }, plainTheme, {}).render(120).join("\n");
    assert.match(rendered, new RegExp(details.status, "i"));
    assert.ok(rendered.length > 0);
    assert.ok(visibleWidth(rendered) > 0);
  }
});
