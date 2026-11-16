---
name: intent
description: Use it to establish complete understanding on the user's request.
disable-model-invocation: false
---

## Goal

Focus on understanding the user's request and its intent, rather than how to implement it. This skill is mostly about the `what` and not the `how`.

## Output

One artifact `docs/context-engineering/<subject>/intent.md` that needs to capture following sections:
- `Problem` - what problem are we trying to solve?
- `Definition of done` - what are the signals that makes the task completed? Write one line per signal: `DoD-N` (`checkable` or `human`) — the observable result. See [Definition of done](#definition-of-done).
- `Affected users and systems` - what is the impact?
- `Constraints` - Stated by the user or by repository evidence;
- `Open questions` - If there are some open items that needs to be clarified in later phases of planning.

## Invariants

- Use a simplified vocabulary, easy to understand and short sentences.
- Never write production code. This skill clarifies; it does not design or implement.
- Never run `git commit`, create branches, or push changes.
- Inspect repository evidence before you ask the user to describe behavior the code already shows.
- Separate user statements, repository evidence, inference, and unknowns. Do not turn an inference into a confirmed constraint. Label inferred interpretations as proposed.
- Batch up to four questions that share one subject. Never mix subjects in one batch. If the user cancels, stop and wait for direction.
- Ask the question whose answer most changes the shared understanding. For a genuine choice, offer concrete options and recommend one when evidence supports it; keep Other available. For a factual question, include only evidence-backed answers and use `Unknown` and `Skip` when you need two options. Do not invent domain answers.
- If the user does not know, record the unknown and its consequence. Do not force a guess.
- Do not agree for the sake of momentum. Name conflicting statements. Correct misunderstandings with evidence instead of quietly adapting the artifact around them. Apply this challenge duty to the problem framing only.

## Boundaries

- Do not chase detail-level precision; design owns it. Mark inferred interpretations as proposed. Keep that label until the user confirms or corrects the interpretation. Repository evidence and unknowns retain their sources.

## Definition of done

Each signal is a result that a person or a program can observe after the work is done. Later phases trace each signal to requirements and checks.

- Give each signal a stable identifier: `DoD-1`, `DoD-2`, and so on. Keep identifiers when you revise the intent.
- Write the result, not the method. For example: "An exported CSV file opens in a spreadsheet with one row per order." Do not write "the export works".
- Label a signal `checkable` when a program can decide it from an observable result.
- Label a signal `human` only when a person must judge it, for example visual quality, wording, or tone. Before you use `human`, try to state the result concretely enough to make it `checkable`.
- Each signal states one result. Split a signal that contains "and" between two different results.

## Workflow

1. Ask questions that close material gaps in the understanding. Investigate unhappy paths, affected users and systems, and edge conditions; ask only when an unresolved answer affects the outcome. Do not ask the user to confirm a synthesis you have not yet presented.

## Verification

When you've completely understood the user's request, check if the `intent.md` artifact has the speficied structure. Check that each Definition of done signal has a `DoD-N` identifier, a `checkable` or `human` label, and one observable result.
