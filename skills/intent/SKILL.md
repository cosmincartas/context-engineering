---
name: intent
description: Use it to establish common understanding with the user on a request.
disable-model-invocation: false
---

## Goal

Understand the user's request and what does it means, not how to implement it.


## Output

One artifact `docs/context-engineering/<subject>/intent.md` that needs to capture following sections:
- `Problem` - what problem are we trying to solve?
- `Definition of done` - what are the signals that makes the task completed?
- `Affected users and systems` - what is the impact?
- `Constraints` - Stated by the user or by repository evidence;
- `Open questions` - If there are some open items that needs to be clarified in later phases of planning.

## Invariants

- Use a simplified vocabulary, easy to understand words and short sentences.
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

## Workflow

1. Ask questions that close material gaps in the understanding. Investigate unhappy paths, affected users and systems, and edge conditions; ask only when an unresolved answer affects the outcome. Do not ask the user to confirm a synthesis you have not yet presented.

## Verification

When you've completely understood the user's request, check if the `intent.md` artifact has the speficied structure.
