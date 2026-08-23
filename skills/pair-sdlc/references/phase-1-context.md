# Phase 1 — Context

Turn an initial development prompt into a shared, user-validated understanding. This phase establishes what the request means. It does not decide how to implement it. It is the required first phase for every topic.

## Boundaries

- Do not write formal requirements, solution design, implementation tasks, or production code.
- Do not turn every request into a project. If the user only wants an explanation or impact assessment, direct them to `explore`.
- Capture a proposed solution as intent or an assumption. Do not evaluate alternatives unless the user switches to `explore`.
- Capture success signals in ordinary language. Do not create `FR-*`, `NFR-*`, or `AC-*` identifiers.
- Do not ask design questions about APIs, schemas, libraries, or internal architecture unless the answer is already a user constraint.
- Do not ask questions already answered by repository evidence or a supplied exploration.
- Do not require complete certainty. Record non-blocking unknowns and let phase 2 own later precision.

## Artifact lifecycle

The output is `docs/agentic-engineering/<subject>/context-brief.md`, based on `assets/context-brief-template.md`.

1. If a draft exists, offer to resume it before you create another file.
2. After the initial evidence pass, save the brief with `status: draft` and `checkpoint: framing`.
3. Update the brief after each material answer so an interrupted session can resume from the unresolved questions.
4. Before you present it for approval, set `checkpoint: awaiting-validation`.
5. Apply requested changes until the user approves it. Then set `status: validated` and `checkpoint: complete`.

## Workflow

1. Inspect relevant repository files, documentation, tests, public behavior, and recent commits. If no repository exists or the request is greenfield, state the evidence limitation.
2. Read any exploration artifact supplied by the user. Treat it as evidence, not as a decision or a commitment to build.
3. Draft the initial request, problem, current behavior, desired outcome, known scope, constraints, assumptions, and unresolved questions. Save the draft.
4. Ask one focused question at a time. Ask only questions whose answers materially change the brief or unblock phase 2. Apply the challenge duty from the facilitation rules to the stated problem and scope.
5. Keep the brief current during the conversation. Distinguish user statements, repository evidence, inference, and unknowns.
6. Present the Confirmed Understanding section as a concise restatement. Ask the user to validate it.

## Completion check

The brief is ready for validation only when it states:

- The initial request and why it matters.
- Current behavior with evidence, or a greenfield statement.
- The desired outcome and affected users.
- In-scope and out-of-scope boundaries, with inferred entries confirmed by the user.
- Known constraints, assumptions, and unresolved questions.
- A concise Confirmed Understanding that the user can approve or correct.
