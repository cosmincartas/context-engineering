# Phase 1 — Context

Turn an initial development prompt into a shared, user-validated understanding of what the request means, not how to implement it. Required first phase for every topic.

Goals, in order: build a common and complete understanding of the subject, then narrow the scope to a minimum deliverable.

## Boundaries

- Do not write requirements, design, tasks, or `FR-*`/`NFR-*`/`AC-*` identifiers. Capture success signals in ordinary language.
- If the user only wants an explanation or an impact assessment, direct them to `explore`.
- Capture a proposed solution as intent or an assumption. Do not evaluate alternatives.
- Do not ask about APIs, schemas, libraries, or architecture unless the user has already stated the answer as a constraint.
- Do not chase detail-level precision; phase 2's `Q-*` list owns it. Every understanding-level entry must reach user confirmation before the write.

## Artifact

`docs/agentic-engineering/<subject>/context-brief.md` from `assets/context-brief-template.md`, written once at the end of the phase.

## Workflow

1. Inspect relevant repository files, docs, tests, and recent commits. Read a supplied exploration artifact as evidence, not as a decision. State when there is no repository evidence.
2. Build a framing ledger in conversation, not on disk: the restated request in the user's vocabulary, evidence labeled by source (user statement, repository evidence, inference, unknown), and the list of gaps.
3. Ask the questions that close the gaps. Apply the challenge duty to the stated problem. Do not ask the user to confirm a synthesis you have not yet presented.
4. Synthesize Confirmed Understanding from confirmed entries only. Present it per the pairing rhythm; present surviving inferences as one list for confirmation (rule 16).
5. Draft Scope and run the **slicing gate** as one step; the gate is the scope review.
6. Write `context-brief.md` with `status: draft` — the first and only write. Present the recap and ask the user to validate. Apply changes to the file until approved, then set `status: validated`.

### Slicing gate

1. Propose the thinnest slice of the request that still delivers one user-visible outcome. Never slice below a user-visible outcome.
2. Present two lists: the slice (stays in scope) and the parked items (everything cut, one line each).
3. The user approves, adjusts, or rejects the slice. "Keep the full scope" is a valid answer; record it as an explicit decision.
4. Apply the approved slice to Scope. Record parked items under Parked, each as a candidate subject for a future topic.

## Completion check

Confirmed Understanding states the problem, who is affected, the desired outcome, evidence or greenfield status, and constraints. The user has confirmed the inferred entries. Scope reflects the approved slice and parked items are recorded.
