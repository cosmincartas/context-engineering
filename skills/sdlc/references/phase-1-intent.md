# Phase 1 — Intent

Turn an initial development prompt into a shared, user-validated understanding of what the request means, not how to implement it. Required first phase for every topic.

Goals, in order: build a common and complete understanding of the subject, then narrow the scope to a minimum deliverable.

## Boundaries

- Do not write requirements, design, tasks, or `FR-*`/`NFR-*`/`AC-*` identifiers. Capture success signals in ordinary language.
- If the user only wants an explanation or an impact assessment, direct them to `explore`.
- Capture a proposed solution as intent or an assumption. Do not evaluate alternatives.
- Do not ask about APIs, schemas, libraries, or architecture unless the user has already stated the answer as a constraint.
- Do not chase detail-level precision; phase 2 owns it. Every understanding-level entry must reach user confirmation before the write.

## Artifact

`docs/agentic-engineering/<subject>/intent.md` from `assets/intent-template.md`, written once at the end of the phase.

## Workflow

1. Inspect relevant repository files, docs, tests, and recent commits. Read a supplied exploration artifact as evidence, not as a decision. State when there is no repository evidence.
2. Build a framing ledger in conversation, not on disk: the restated request in the user's vocabulary, evidence labeled by source (user statement, repository evidence, inference, unknown), and the list of gaps.
3. Ask the questions that close the gaps. Apply the challenge duty to the stated problem. Do not ask the user to confirm a synthesis you have not yet presented.
4. Synthesize Confirmed Understanding from confirmed entries only. Present it per the pairing rhythm; present surviving inferences as one list for confirmation (rule 16).
5. Draft Scope and run the **slicing gate** as one step; the gate is the scope review.
6. Write `intent.md` with `status: draft` — the first and only write. Present the recap and ask the user to validate. Apply changes to the file until approved, then set `status: validated`.

### Slicing gate

1. Split a broad request into deliverables that can ship independently. Select one deliverable for this topic and park the rest.
2. Propose the smallest slice of the deliverable you select that can ship independently and has one independently verifiable outcome. Do not add work only to make the slice user-visible.
3. Present two lists: the slice in scope and items to park (one line each).
4. Ask the user to approve, adjust, or reject the slice.
5. Accept and record the approved scope only when it selects one independently verifiable outcome.
6. Apply the slice the user approves to Scope. Record items you park under Parked, each as a candidate subject for a future topic.

## Completion check

Confirmed Understanding states the problem, who is affected, the desired outcome, evidence or greenfield status, and constraints. The user has confirmed the inferred entries. Scope names one deliverable that can ship independently and one independently verifiable outcome, and moves other deliverables and out-of-slice items to Parked.
