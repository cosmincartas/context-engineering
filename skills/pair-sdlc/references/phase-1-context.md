# Phase 1 — Context

Turn an initial development prompt into a shared, user-validated understanding of what the request means, not how to implement it. Required first phase for every topic.

## Boundaries

- Do not write requirements, design, tasks, or `FR-*`/`NFR-*`/`AC-*` identifiers. Capture success signals in ordinary language.
- If the user only wants an explanation or an impact assessment, direct them to `explore`.
- Capture a proposed solution as intent or an assumption. Do not evaluate alternatives.
- Do not ask about APIs, schemas, libraries, or architecture unless the answer is already a user constraint.
- Record non-blocking unknowns as "(unconfirmed)" entries instead of forcing certainty; phase 2 owns precision and its `Q-*` table owns open questions.

## Artifact

`docs/agentic-engineering/<subject>/context-brief.md` from `assets/context-brief-template.md`. Checkpoints: `framing` → `awaiting-validation` → `complete`.

## Workflow

1. Inspect relevant repository files, docs, tests, and recent commits. Read any supplied exploration artifact as evidence, not as a decision. State when there is no repository evidence.
2. Draft Scope and Confirmed Understanding. Save with `checkpoint: framing`.
3. Ask only questions whose answers materially change the brief or unblock phase 2. Apply the challenge duty to the stated problem and scope.
4. Set `checkpoint: awaiting-validation`, present the Confirmed Understanding section, and ask the user to validate it.

## Completion check

Confirmed Understanding states the problem, who is affected, the desired outcome, evidence or greenfield status, and constraints, with no "(unconfirmed)" entry left. The user has confirmed the inferred scope entries.
