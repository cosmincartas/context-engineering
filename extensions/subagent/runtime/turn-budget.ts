// Loaded into every subagent child with `-e`. It bounds a run by turns without an abort:
// at the budget it asks the model for its final report, then refuses every later tool call.
// An abort would set stopReason "aborted", which the parent reports as a provider error.

export const BUDGET_ENVIRONMENT_VARIABLE = "PI_SUBAGENT_MAX_TURNS";

export function budgetMessage(budget: number): string {
  return `Turn budget of ${budget} turns reached. Do not call tools. Write your final report now.`;
}

type BlockedToolCall = { readonly block: true; readonly reason: string };

type TurnBudgetApi = {
  readonly on: (event: string, handler: (event: any) => unknown) => unknown;
  readonly sendMessage: (
    message: { customType: string; content: string; display: boolean },
    options: { deliverAs: "steer" },
  ) => unknown;
};

export default function turnBudget(pi: TurnBudgetApi): void {
  const budget = Number(process.env[BUDGET_ENVIRONMENT_VARIABLE]);
  if (!Number.isInteger(budget) || budget < 1) return;

  let completedTurns = 0;
  let steered = false;

  pi.on("turn_end", () => {
    completedTurns += 1;
    if (completedTurns < budget || steered) return;
    steered = true;
    pi.sendMessage(
      { customType: "turn-budget", content: budgetMessage(budget), display: true },
      { deliverAs: "steer" },
    );
  });

  // `tool_call` for a turn fires before that turn's `turn_end`, so this only refuses
  // calls the model makes after it has seen the message above.
  pi.on("tool_call", (): BlockedToolCall | undefined =>
    completedTurns >= budget ? { block: true, reason: budgetMessage(budget) } : undefined,
  );
}
