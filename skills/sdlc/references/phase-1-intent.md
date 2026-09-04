# Phase 1 — Intent

Turn an initial development prompt into a shared, user-validated understanding of what the request means, not how to implement it. Required first phase for every topic.

Goal: build a common and complete understanding of the subject.

## Boundaries

- Do not write requirements, design, tasks, or `FR-*`/`NFR-*`/`AC-*` identifiers. Capture success signals in ordinary language.
- If the user only wants an explanation or an impact assessment, direct them to `explore`.
- Capture a proposed solution as intent or an assumption. Do not evaluate alternatives.
- Do not ask about APIs, schemas, libraries, or architecture unless the user has already stated the answer as a constraint.
- Do not chase detail-level precision; phase 2 owns it. Every understanding-level entry must reach user confirmation before the write.

## Artifact

`docs/agentic-engineering/<subject>/intent.md` from `assets/intent-template.md`, written once at the end of the phase.

## Workflow

1. Capture the first user-authored development request before changing its wording. Copy it verbatim under Initial Request. Exclude skill names, commands, and arguments that only invoke this workflow as invocation metadata.
2. Inspect relevant repository files, docs, tests, and recent commits. Read a supplied exploration artifact as evidence, not as a decision. State when there is no repository evidence.
3. Build a framing ledger in conversation, not on disk: the restated request in the user's vocabulary, evidence labeled by source (user statement, repository evidence, inference, unknown), and the list of gaps.
4. Ask the questions that close the gaps. Apply the challenge duty to the stated problem. Do not ask the user to confirm a synthesis you have not yet presented.
5. Synthesize the five sections from confirmed entries only: Problem, Proposed outcome, Affected users, Constraints, Open Questions. Put unknowns the user could not resolve and detail-level questions deferred to phase 2 under Open Questions, each with its consequence (rule 8). Present the sections per the pairing rhythm; present surviving inferences as one list for confirmation (rule 16).
6. Write `intent.md` with `status: draft` — the first and only write. Present the recap and ask the user to validate. Apply changes to the file until approved, then set `status: validated`.

## Completion check

Initial Request contains the first user-authored development request verbatim and excludes invocation metadata. Problem, Proposed outcome, Affected users, and Constraints hold only entries the user confirmed. Open Questions holds only unknowns the user could not resolve and questions deferred to phase 2, each with its consequence. No narrowing and no requirement identifiers appear.
