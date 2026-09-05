# Phase 1 — Intent

Turn an initial development prompt into a shared, user-validated understanding of what the request means, not how to implement it. Required first phase for every topic.

Goal: build a common and complete understanding of the subject.

## Boundaries

- Do not write requirements, design, tasks, or `FR-*`/`NFR-*`/`AC-*` identifiers. Capture success signals in ordinary language.
- If the user only wants an explanation or an impact assessment, direct them to `explore`.
- Capture a proposed solution as intent or an assumption. Defer solution alternatives to phase 2.
- Do not ask about APIs, schemas, libraries, or architecture unless the user has already stated the answer as a constraint.
- Do not chase detail-level precision; phase 2 owns it. Mark inferred interpretations as proposed in the draft. Complete intent approval confirms them; repository evidence and unknowns retain their sources.

## Artifact

`docs/agentic-engineering/<subject>/intent.md` from `assets/intent-template.md`, written once at the end of the phase.

## Workflow

1. Capture the first user-authored development request before changing its wording. Copy it verbatim under Initial Request. Exclude skill names, commands, and arguments that only invoke this workflow as invocation metadata.
2. Inspect relevant repository files, docs, tests, and recent commits. Read a supplied exploration artifact as evidence, not as a decision. State when there is no repository evidence.
3. Build a framing ledger in conversation, not on disk: the restated request in the user's vocabulary, evidence labeled by source (user statement, repository evidence, inference, unknown), and the list of gaps.
4. Ask questions that close material gaps in the understanding. Apply the challenge duty to the stated problem. Do not ask the user to confirm a synthesis you have not yet presented.
5. Synthesize Problem, Proposed outcome, Affected users, Constraints, and Open Questions. Distinguish user statements, repository evidence, and proposed interpretations. Put unresolved unknowns and questions deferred to phase 2 under Open Questions, each with its consequence. Do not request section approvals.
6. Write `intent.md` with `status: draft` at the first validation presentation. Present the complete intent concisely, including proposed interpretations and open questions, and ask the user to validate it once. Apply requested corrections through the shared correction rule. After approval, record accepted interpretations as confirmed and set `status: validated`.

## Completion check

Initial Request contains the first user-authored development request verbatim and excludes invocation metadata. Problem, Proposed outcome, Affected users, and Constraints preserve their sources and have complete intent approval. That approval includes all proposed interpretations. Open Questions holds only unknowns the user could not resolve and questions deferred to phase 2, each with its consequence. Preserve the full request except for revisions the user explicitly approved. No requirement identifiers appear. Validation did not require section or inference approval rounds.
