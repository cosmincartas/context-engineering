import type {
  AgentToolResult,
  ExtensionAPI,
  ExtensionContext,
  Theme,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type, type Static } from "typebox";
import {
  createQuestionnaireComponent,
} from "./ui/index.ts";
import type {
  QuestionnaireOutcome,
  QuestionnaireQuestion,
  QuestionnaireResultAnswer,
} from "./state/index.ts";

const QuestionnaireOptionSchema = Type.Object(
  {
    label: Type.String(),
    description: Type.String(),
  },
  { additionalProperties: false },
);

const QuestionnaireQuestionSchema = Type.Object(
  {
    question: Type.String(),
    header: Type.Optional(Type.String()),
    options: Type.Array(QuestionnaireOptionSchema, {
      minItems: 2,
      maxItems: 4,
    }),
  },
  { additionalProperties: false },
);

const QuestionnaireParameters = Type.Object(
  {
    questions: Type.Array(QuestionnaireQuestionSchema, {
      minItems: 1,
      maxItems: 4,
    }),
  },
  { additionalProperties: false },
);

type QuestionnaireRequest = Static<typeof QuestionnaireParameters>;

type UnsupportedMode = "rpc" | "json" | "print";

export interface QuestionnaireResult {
  readonly status: "submitted" | "cancelled" | "unsupported";
  readonly answers: readonly QuestionnaireResultAnswer[];
  readonly mode?: UnsupportedMode;
}

const CONTROL_CHARACTERS = /[\u0000-\u001F\u0080-\u009F]/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertKnownKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  label: string,
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      throw new TypeError(`Invalid questionnaire request: unknown ${label} field "${key}"`);
    }
  }
}

function assertSafeText(value: unknown, label: string, allowBlank = false): asserts value is string {
  if (typeof value !== "string") {
    throw new TypeError(`Invalid questionnaire request: ${label} must be a string`);
  }
  if (!allowBlank && value.trim() === "") {
    throw new TypeError(`Invalid questionnaire request: ${label} must not be blank`);
  }
  if (CONTROL_CHARACTERS.test(value)) {
    throw new TypeError(`Invalid questionnaire request: ${label} contains a control character`);
  }
}

function validateRequest(value: unknown): asserts value is QuestionnaireRequest {
  if (!isRecord(value)) {
    throw new TypeError("Invalid questionnaire request: expected an object");
  }
  assertKnownKeys(value, ["questions"], "request");

  if (!Array.isArray(value.questions) || value.questions.length < 1 || value.questions.length > 4) {
    throw new RangeError("Invalid questionnaire request: questions must contain one to four items");
  }

  for (const [questionIndex, rawQuestion] of value.questions.entries()) {
    if (!isRecord(rawQuestion)) {
      throw new TypeError(`Invalid questionnaire request: question ${questionIndex} must be an object`);
    }
    assertKnownKeys(rawQuestion, ["question", "header", "options"], `question ${questionIndex}`);
    assertSafeText(rawQuestion.question, `question ${questionIndex} text`);
    if (rawQuestion.header !== undefined) {
      assertSafeText(rawQuestion.header, `question ${questionIndex} header`, true);
    }

    if (
      !Array.isArray(rawQuestion.options) ||
      rawQuestion.options.length < 2 ||
      rawQuestion.options.length > 4
    ) {
      throw new RangeError(
        `Invalid questionnaire request: question ${questionIndex} options must contain two to four items`,
      );
    }

    for (const [optionIndex, rawOption] of rawQuestion.options.entries()) {
      if (!isRecord(rawOption)) {
        throw new TypeError(
          `Invalid questionnaire request: question ${questionIndex} option ${optionIndex} must be an object`,
        );
      }
      assertKnownKeys(rawOption, ["label", "description"], `question ${questionIndex} option ${optionIndex}`);
      assertSafeText(rawOption.label, `question ${questionIndex} option ${optionIndex} label`);
      assertSafeText(
        rawOption.description,
        `question ${questionIndex} option ${optionIndex} description`,
      );
    }
  }
}

function normalizeQuestions(request: QuestionnaireRequest): readonly QuestionnaireQuestion[] {
  return request.questions.map((question, questionIndex) => ({
    question: question.question,
    header: question.header?.trim() || `Q${questionIndex + 1}`,
    options: question.options.map((option) => ({
      label: option.label,
      description: option.description,
    })),
  }));
}

function serializedResult(result: QuestionnaireResult): AgentToolResult<QuestionnaireResult> {
  return {
    content: [{ type: "text", text: JSON.stringify(result) }],
    details: result,
  };
}

function cancelledOutcome(): QuestionnaireOutcome {
  return { status: "cancelled", answers: [] };
}

function abortError(signal: AbortSignal): Error {
  const reason = signal.reason;
  return reason instanceof Error
    ? reason
    : new DOMException("The questionnaire was aborted", "AbortError");
}

async function executeQuestionnaire(
  params: unknown,
  signal: AbortSignal | undefined,
  ctx: ExtensionContext,
): Promise<AgentToolResult<QuestionnaireResult>> {
  validateRequest(params);

  if (ctx.mode !== "tui") {
    return serializedResult({
      status: "unsupported",
      answers: [],
      mode: ctx.mode as UnsupportedMode,
    });
  }

  if (signal?.aborted) {
    throw abortError(signal);
  }

  const questions = normalizeQuestions(params);
  let aborted = false;
  let completed = false;
  let finish: ((outcome: QuestionnaireOutcome) => void) | undefined;

  const onAbort = () => {
    if (completed) return;
    aborted = true;
    finish?.(cancelledOutcome());
  };
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const outcome = await ctx.ui.custom<QuestionnaireOutcome>((tui, theme, _keybindings, done) => {
      const complete = (value: QuestionnaireOutcome) => {
        if (completed) return;
        completed = true;
        done(value);
      };
      finish = complete;

      const component = createQuestionnaireComponent(tui, theme, questions, complete);
      if (aborted) complete(cancelledOutcome());
      return component;
    });

    if (aborted || signal?.aborted) {
      throw abortError(signal ?? new AbortController().signal);
    }

    return serializedResult({
      status: outcome.status,
      answers: outcome.answers,
    });
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
}

function escapeControls(text: string): string {
  return text.replace(/[\u0000-\u001F\u0080-\u009F]/g, (character) => {
    const code = character.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0");
    return `\\u${code}`;
  });
}

function renderCall(args: QuestionnaireRequest, theme: Theme): Text {
  const questions = Array.isArray(args?.questions) ? args.questions : [];
  const count = questions.length;
  const labels = questions
    .map((question, index) => escapeControls(question.header?.trim() || `Q${index + 1}`))
    .join(", ");
  const suffix = labels.length > 0 ? ` (${labels})` : "";
  return new Text(
    `${theme.fg("toolTitle", theme.bold("Questionnaire"))} ${theme.fg(
      "muted",
      `${count} question${count === 1 ? "" : "s"}${suffix}`,
    )}`,
    0,
    0,
  );
}

function renderResult(
  result: AgentToolResult<QuestionnaireResult>,
  _options: unknown,
  theme: Theme,
  _context: unknown,
): Text {
  const details = result.details;
  if (details?.status === "submitted") {
    return new Text(
      theme.fg("success", `Submitted (${details.answers.length} answers)`),
      0,
      0,
    );
  }
  if (details?.status === "cancelled") {
    return new Text(theme.fg("warning", "Cancelled"), 0, 0);
  }
  if (details?.status === "unsupported") {
    return new Text(
      theme.fg("warning", `Unsupported (${escapeControls(details.mode)})`),
      0,
      0,
    );
  }

  const text = result.content?.find((item) => item.type === "text")?.text ?? "";
  return new Text(escapeControls(text), 0, 0);
}

export default function questionnaire(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "questionnaire",
    label: "Questionnaire",
    description: "Ask one to four related questions in a guided terminal flow.",
    executionMode: "sequential",
    parameters: QuestionnaireParameters,
    execute(toolCallId, params, signal, _onUpdate, ctx) {
      void toolCallId;
      return executeQuestionnaire(params, signal, ctx);
    },
    renderCall,
    renderResult,
  });
}
