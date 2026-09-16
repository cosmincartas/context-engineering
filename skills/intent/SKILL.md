---
name: intent
description: Use only when the user explicitly asks for it. Turns one development request into a validated intent artifact that states what the request means, not how to implement it. Produces docs/context-engineering/<subject>/intent.md, which sdlc accepts as its validated phase 1 artifact.
disable-model-invocation: true
---

# Intent

Write the artifact in ASD-STE100 Simplified Technical English: sentences of at most 20 words (instructions) or 25 (descriptions), active voice, imperative for steps, one meaning for each word. Chat stays in natural conversational language.

Turn an initial development prompt into a shared, user-validated understanding of what the request means, not how to implement it. This skill stops at the validated intent. Design, planning, and execution belong to other skills.

## Artifact

`docs/context-engineering/<subject>/intent.md` from `assets/intent-template.md`. Use a short kebab-case subject. Write the file once at the end of the skill, at the first validation presentation. The artifact matches the `sdlc` phase 1 artifact, so `sdlc` can resume the topic at its design phase.

## Invariants

- Never write production code. This skill clarifies; it does not design or implement.
- Never run `git commit`, create branches, or push changes.
- Inspect repository evidence before you ask the user to describe behavior the code already shows.
- Separate user statements, repository evidence, inference, and unknowns. Do not turn an inference into a confirmed constraint. Label inferred interpretations as proposed in the draft.
- Restate the request before you refine it. Preserve the user's intent and vocabulary unless a term is ambiguous.
- Use `AskUserQuestion` for every user question. Batch up to four questions that share one subject. Never mix subjects in one batch. If the user cancels, stop and wait for direction.
- Ask the question whose answer most changes the shared understanding. For a genuine choice, offer concrete options and recommend one when evidence supports it; keep Other available. For a factual question, include only evidence-backed answers and use `Unknown` and `Skip` when you need two options. Do not invent domain answers.
- If the user does not know, record the unknown and its consequence. Do not force a guess.
- Do not agree for the sake of momentum. Name conflicting statements. Correct misunderstandings with evidence instead of quietly adapting the artifact around them. Apply this challenge duty to the problem framing only.
- Write the file with `status: draft` at the first validation presentation. Apply requested corrections in place. Set `status: validated` only after approval. A session interrupted before the write restarts the skill; do not reconstruct partial work from chat history.
- Never inspect, edit, or ask about `.gitignore`. After you save the artifact, you can say exactly: `Consider adding docs/context-engineering/ to .gitignore manually.`

## Boundaries

- Do not write requirements, design, tasks, or `FR-*`/`NFR-*`/`AC-*` identifiers. Capture success signals in ordinary language.
- If the user only wants an explanation or an impact assessment, direct them to `explore`.
- Capture a proposed solution as intent or an assumption. Defer solution alternatives to design.
- Do not ask about APIs, schemas, libraries, or architecture unless the user has already stated the answer as a constraint. Infer Affected components from repository evidence; do not ask the user to name them.
- Do not chase detail-level precision; design owns it. Mark inferred interpretations as proposed in the draft. Complete intent approval confirms them; repository evidence and unknowns retain their sources.

## Workflow

1. Capture the first user-authored development request before changing its wording. Copy it verbatim under Initial Request. Exclude skill names, commands, and arguments that only invoke this skill as invocation metadata.
2. Inspect relevant repository files, docs, tests, and recent commits. Read a supplied exploration artifact as evidence, not as a decision. State when there is no repository evidence.
   Trace the path from each trigger to the Proposed outcome through the repository. Record each component the path crosses as `file:symbol`, and each component the outcome implies but the repository lacks as new. This map is an inference; complete intent approval confirms it.
3. Build a framing ledger in conversation, not on disk: the restated request in the user's vocabulary, evidence labeled by source (user statement, repository evidence, inference, unknown), and the list of gaps.
4. Ask questions that close material gaps in the understanding. Investigate unhappy paths, affected users, and edge conditions; ask only when an unresolved answer affects the outcome. Do not ask the user to confirm a synthesis you have not yet presented.
5. Synthesize Problem, Proposed outcome, Affected users, Affected components, Constraints, and Open Questions. Distinguish user statements, repository evidence, and proposed interpretations. Put unresolved unknowns and questions deferred to design under Open Questions, each with its consequence. Do not request section approvals.
6. Write `intent.md` with `status: draft`. Present the complete intent concisely in about 30 lines, including proposed interpretations and open questions, and ask the user to validate it once. Offer to expand any named part on request.
7. Apply requested corrections to the complete draft, rerun the completion check, and ask for validation again. After approval, record accepted interpretations as confirmed, set `status: validated`, and report the artifact path as the input for `sdlc`.

## Completion check

Before you report the intent as validated, make sure that:

- Initial Request contains the first user-authored development request verbatim and excludes invocation metadata.
- Problem, Proposed outcome, Affected users, Affected components, and Constraints preserve their sources and have complete intent approval. That approval includes all proposed interpretations.
- Affected components names each component on the trigger-to-outcome path, existing ones as `file:symbol` and missing ones as new.
- Open Questions holds only unknowns the user could not resolve and questions deferred to design, each with its consequence.
- The full request is preserved except for revisions the user explicitly approved.
- No requirement identifiers appear.
- Validation did not require section or inference approval rounds.
- The artifact has `status: validated`.
