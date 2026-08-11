---
name: clarify
description: Use for an initial development request before requirements, design, or implementation planning. Produces a user-validated context brief that the requirements skill consumes. Do not use for exploratory explanations or impact assessments.
---

# Clarify

Use ASD-STE100 Simplified Technical English when you ask questions or write output files.

Turn an initial development prompt into a shared, user-validated understanding. Clarification establishes what the request means. It does not decide how to implement it.

This is the required first stage for delivery work. A validated context brief is required before `requirements` can start.

## Invariants

- Do not write formal requirements, solution design, implementation tasks, or production code.
- Do not turn every request into a project. If the user only wants an explanation or impact assessment, use `explore`.
- Never run `git commit`, create branches, or push changes.

## Artifact lifecycle

The output is a context brief based on `assets/context-brief-template.md`.

1. Use `docs/agentic-engineering/context/<YYYY-MM-DD>/<subject>.md`.
2. If a matching draft exists, offer to resume it before creating another file.
3. After the initial evidence pass, save the brief with `status: draft` and `checkpoint: framing`.
4. Update the brief after each material answer so an interrupted session can resume from the unresolved questions.
5. Before presenting it for approval, set `checkpoint: awaiting-validation`.
6. Apply requested changes until the user approves it. Then set `status: validated` and `checkpoint: complete`.
7. On write failure, report the failure and stop. Never claim that unsaved context is resumable.

## Workflow

1. Read `references/facilitation-rules.md` before asking questions.
2. Inspect relevant repository files, documentation, tests, public behavior, and recent commits. If no repository exists or the request is greenfield, state the evidence limitation.
3. Read any exploration artifact supplied by the user. Treat it as evidence, not as a decision or a commitment to build.
4. Draft the initial request, problem, current behavior, desired outcome, known scope, constraints, assumptions, and unresolved questions. Save the draft.
5. Ask one focused question at a time. Ask only questions whose answers materially change the brief or unblock requirements.
6. Keep the brief current during the conversation. Distinguish user statements, repository evidence, inference, and unknowns.
7. Present the Confirmed Understanding section as a concise restatement. Ask the user to validate it.
8. On approval, validate the artifact and report its path as the required input to `requirements`.

## Boundaries

- Capture a proposed solution as intent or an assumption. Do not evaluate alternatives unless the user switches to `explore`.
- Capture success signals in ordinary language. Do not create `FR-*`, `NFR-*`, or `AC-*` identifiers.
- Do not ask design questions about APIs, schemas, libraries, or internal architecture unless the answer is already a user constraint.
- Do not ask questions already answered by repository evidence or a supplied exploration.
- Do not require complete certainty. Record non-blocking unknowns and let requirements own later precision.

## Completion check

The brief is ready for validation only when it states:

- The initial request and why it matters.
- Current behavior with evidence, or a greenfield statement.
- The desired outcome and affected users.
- In-scope and out-of-scope boundaries.
- Known constraints, assumptions, and unresolved questions.
- A concise Confirmed Understanding that the user can approve or correct.
