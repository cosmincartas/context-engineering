---
name: intent
description: Use only when the user explicitly asks for it. Turns one development request into an intent artifact that states what the request means, not how to implement it.
disable-model-invocation: true
---

# Intent

Use ASD-STE100 Simplified Technical English for every output: chat messages, questions, question options, and the artifact. Sentences have at most 20 words (instructions) or 25 (descriptions). Use active voice, imperative for steps, and one meaning for each word. Keep chat messages short. Say only what the user needs for the next step.

Turn an initial development prompt into a shared understanding of what the request means, not how to implement it. This skill stops at the intent artifact, which the user reviews and corrects. Design, planning, and execution belong to other skills.

## Artifact

`docs/context-engineering/<subject>/intent.md` from `assets/intent-template.md`. Use a short kebab-case subject. Write the file once, when you present the intent for review. Apply requested changes in place.

## Invariants

- Never write production code. This skill clarifies; it does not design or implement.
- Never run `git commit`, create branches, or push changes.
- Inspect repository evidence before you ask the user to describe behavior the code already shows.
- Separate user statements, repository evidence, inference, and unknowns. Do not turn an inference into a confirmed constraint. Label inferred interpretations as proposed.
- Restate the request before you refine it. Preserve the user's intent and vocabulary unless a term is ambiguous.
- Use `AskUserQuestion` for every user question. Batch up to four questions that share one subject. Never mix subjects in one batch. If the user cancels, stop and wait for direction.
- Ask the question whose answer most changes the shared understanding. For a genuine choice, offer concrete options and recommend one when evidence supports it; keep Other available. For a factual question, include only evidence-backed answers and use `Unknown` and `Skip` when you need two options. Do not invent domain answers.
- If the user does not know, record the unknown and its consequence. Do not force a guess.
- Do not agree for the sake of momentum. Name conflicting statements. Correct misunderstandings with evidence instead of quietly adapting the artifact around them. Apply this challenge duty to the problem framing only.
- The artifact has no status field. Write it when you present the intent for review and apply requested corrections in place. A session interrupted before the write restarts the skill; do not reconstruct partial work from chat history.
- Never inspect, edit, or ask about `.gitignore`. After you save the artifact, you can say exactly: `Consider adding docs/context-engineering/ to .gitignore manually.`

## Boundaries

- Do not write requirements, design, tasks, or `FR-*`/`NFR-*`/`AC-*` identifiers. Define done as the desired outcome and its observable success signals, in ordinary language. Leave precise acceptance criteria to the specification.
- If the user only wants an explanation or an impact assessment, direct them to `explore`.
- Capture a proposed solution as intent or an assumption. Defer solution alternatives to design.
- Do not ask about APIs, schemas, libraries, or architecture unless the user has already stated the answer as a constraint. Infer affected systems from repository evidence; ask the user only when evidence is absent.
- Do not chase detail-level precision; design owns it. Mark inferred interpretations as proposed. Keep that label until the user confirms or corrects the interpretation. Repository evidence and unknowns retain their sources.

## Workflow

1. Capture the first user-authored development request before changing its wording. Copy it verbatim under Initial Request. Exclude skill names, commands, and arguments that only invoke this skill as invocation metadata.
2. Inspect relevant repository files, docs, tests, and recent commits. Read a supplied exploration artifact as evidence, not as a decision. State when there is no repository evidence.
   Identify the systems the outcome touches: this repository, external services, data stores, and integrations. Name them as systems, not as files or symbols. Leave the file-level path map to design.
3. Build a framing ledger in conversation, not on disk: the restated request in the user's vocabulary, evidence labeled by source (user statement, repository evidence, inference, unknown), and the list of gaps.
4. Ask questions that close material gaps in the understanding. Investigate unhappy paths, affected users and systems, and edge conditions; ask only when an unresolved answer affects the outcome. Do not ask the user to confirm a synthesis you have not yet presented.
5. Synthesize Problem, Definition of done, Affected users and systems, Constraints, and Open Questions. Distinguish user statements, repository evidence, and proposed interpretations. Put unresolved unknowns and questions deferred to design under Open Questions, each with its consequence. Do not request section approvals.
6. Write `intent.md`. Present the complete intent concisely in about 30 lines, including proposed interpretations and open questions, and invite the user to review it. Offer to expand any named part on request.
7. Apply requested corrections to the complete file, rerun the completion check, and present what changed. Record interpretations the user confirms as confirmed. Stop when the user has no more changes.

## Completion check

Before you present the intent for review, make sure that:

- Initial Request contains the first user-authored development request verbatim and excludes invocation metadata.
- Problem, Definition of done, Affected users and systems, and Constraints preserve their sources. Every inferred interpretation carries the proposed label.
- Affected users and systems names who and what the outcome touches, without file-level detail.
- Open Questions holds only unknowns the user could not resolve and questions deferred to design, each with its consequence.
- The full request is preserved except for revisions the user explicitly approved.
- No requirement identifiers appear.
- You did not request section or inference approvals.
