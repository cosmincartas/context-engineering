import assert from "node:assert/strict";
import test from "node:test";

import turnBudget, { BUDGET_ENVIRONMENT_VARIABLE, budgetMessage } from "./turn-budget.ts";

// `any` keeps the fake assignable to the narrow handler parameter the extension declares.
type Handler = (event: any) => unknown;

function fakePi() {
  const handlers = new Map<string, Handler>();
  const sent: { message: unknown; options: unknown }[] = [];
  return {
    handlers,
    sent,
    api: {
      on(event: string, handler: Handler) {
        handlers.set(event, handler);
      },
      sendMessage(message: unknown, options: unknown) {
        sent.push({ message, options });
      },
    },
  };
}

function withBudget<T>(value: string | undefined, run: () => T): T {
  const previous = process.env[BUDGET_ENVIRONMENT_VARIABLE];
  if (value === undefined) delete process.env[BUDGET_ENVIRONMENT_VARIABLE];
  else process.env[BUDGET_ENVIRONMENT_VARIABLE] = value;
  try {
    return run();
  } finally {
    if (previous === undefined) delete process.env[BUDGET_ENVIRONMENT_VARIABLE];
    else process.env[BUDGET_ENVIRONMENT_VARIABLE] = previous;
  }
}

test("registers no handler when the budget is absent or unusable", () => {
  for (const value of [undefined, "", "0", "-4", "2.5", "many"]) {
    const pi = fakePi();
    withBudget(value, () => turnBudget(pi.api));
    assert.equal(pi.handlers.size, 0, `budget ${String(value)} must register no handler`);
    assert.equal(pi.sent.length, 0);
  }
});

test("steers once at the budget and blocks every later tool call", () => {
  const pi = fakePi();
  withBudget("2", () => turnBudget(pi.api));
  const turnEnd = pi.handlers.get("turn_end");
  const toolCall = pi.handlers.get("tool_call");
  assert.ok(turnEnd);
  assert.ok(toolCall);

  assert.equal(toolCall({ toolName: "read" }), undefined);
  turnEnd({ turnIndex: 0 });
  assert.equal(toolCall({ toolName: "read" }), undefined);
  assert.equal(pi.sent.length, 0);

  turnEnd({ turnIndex: 1 });
  assert.equal(pi.sent.length, 1);
  assert.deepEqual(pi.sent[0].options, { deliverAs: "steer" });
  assert.deepEqual(pi.sent[0].message, {
    customType: "turn-budget",
    content: budgetMessage(2),
    display: true,
  });

  assert.deepEqual(toolCall({ toolName: "bash" }), { block: true, reason: budgetMessage(2) });
  assert.deepEqual(toolCall({ toolName: "read" }), { block: true, reason: budgetMessage(2) });

  turnEnd({ turnIndex: 2 });
  turnEnd({ turnIndex: 3 });
  assert.equal(pi.sent.length, 1, "the steer must be sent exactly once");
});

test("names the budget in the message it sends and the reason it blocks", () => {
  const message = budgetMessage(40);
  assert.match(message, /40/);
  assert.match(message, /final report/i);
});
