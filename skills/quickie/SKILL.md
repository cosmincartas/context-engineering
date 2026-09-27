---
name: quickie
description: Use when the user wants one small and clear change planned from an intent file, without a specification. Produces one implementation plan. Do not use when the scope is unclear, when a public contract changes, or when a design decision is open (use design-specs).
---

# Quickie

Use ASD-STE100 Simplified Technical English for every output: chat messages, questions, question options, and the artifact. Sentences have at most 20 words (instructions) or 25 (descriptions). Use active voice, imperative for steps, and one meaning for each word. Requirements use "must", never "shall" or "should". Keep chat messages short. Say only what the user needs for the next step.

Plan one small change in a single pass from a reviewed intent: check the entry criteria, draft the plan, review the plan. This skill plans; it does not implement. Execution belongs to other skills. The `intent` skill owns the shared understanding. Do not rebuild it here.

## Input

- Require an intent file with `artifact: intent`. Accept a file path or a topic folder under `docs/context-engineering/`.
- If no intent is supplied, ask for its path or topic folder and stop. Do not start the `intent` skill automatically.
- Read the complete intent. Use its Proposed outcome, Constraints, Affected users and systems, and Open Questions as the understanding.
- Keep the intent file unchanged. If the intent conflicts with repository evidence, present the conflict and ask the user for an intent revision before drafting.
- Compute the SHA-256 hash of the exact intent bytes for `intent_sha256`.

## Entry criteria

Use this skill only when every criterion holds against the intent:

- The Proposed outcome covers one deliverable that can ship independently.
- The work changes no public contract, data format, or security behavior.
- No design decision with realistic alternatives is open. An Open Question whose consequence changes the design fails this criterion.

If a criterion fails, name the criterion and the evidence from the intent or the repository. Recommend `design-specs` with the same intent file as input. Do not continue in this skill. Use `explore` for a question the user asks to learn or to compare.

## Artifact

`plan.md` beside the source intent, in `docs/context-engineering/<subject>/`, from `assets/quick-plan-template.md`. Record the intent path and `intent_sha256` in the front matter.

## Invariants

- Never write production code. This skill plans; it does not implement.
- Never run `git commit`, create branches, or push changes.
- Write the artifact file once, when you present it for review. Apply requested changes in place. A session interrupted before the write restarts the skill from the intent and current repository evidence.
- Inspect repository evidence before you ask the user to describe behavior the code already shows.
- Separate intent statements, repository evidence, inference, and unknowns. Do not turn an inference into a confirmed constraint.
- Make every verification observable: a test result, command output, or behavior, never "code written".
- Never inspect, edit, or ask about `.gitignore`. After you save the artifact, you can say exactly: `Consider adding docs/context-engineering/ to .gitignore manually.`

## Step 1 — Inspect

1. Inspect the implementation, callers, tests, and recent commits that the intent's Affected users and systems point to. State when there is no repository evidence.
2. Record the current commit as `repository_baseline`, or `unavailable`. Record existing working-tree changes without altering them.
3. Identify the existing test and build commands from repository evidence. Do not invent scripts.
4. Resolve each Open Question of the intent. Use repository evidence first. Ask the user only for a factual answer the repository cannot give, in one `AskUserQuestion` batch of at most four questions. If the user cancels, stop and wait for direction.
5. Check the entry criteria. Escalate when one fails.

## Step 2 — Plan

Draft the complete plan in conversation before you present plan content. Present no partial task drafts. Ask only factual questions that block drafting.

- Derive the acceptance criteria from the intent's Proposed outcome, one checkable behavior per `AC-*`. Do not add behavior the intent does not state or imply.
- Derive In scope and Out of scope from the intent. Record each Out of scope entry with its reason.
- Give each task a stable `Task N` identifier and exactly one independently verifiable outcome.
- Give each task one `file:symbol` entry point: a current symbol, or one file path when the symbol does not exist yet. Tell implementers to trace downstream from it; do not freeze a downstream file map.
- Declare exact task identifiers under `Depends on:` or `none`. Order the tasks so the project builds and its tests pass after every completed task.
- For every production-behavior task, specify the TDD cycle: the test and expected failure for RED, the minimum behavior for GREEN, and the allowed cleanup for REFACTOR. For a non-behavior task, state why TDD does not apply.
- Cover every acceptance criterion on at least one task. Do not invent behavior.

## Step 3 — Review

1. Complete the draft and check every rule in step 2 and the completion check.
2. Write the artifact. This is the first and only write. Report the saved path.
3. Present a recap of at most 30 lines: what the plan does, the files or symbols it touches, and its consequential choices. Do not paste the full document. Invite the user to review it.
4. Apply requested changes to the complete plan, repeat the checks, and present what changed. If a change needs a different outcome or constraint, request an intent revision instead. Stop when the user has no more changes.
5. Compare the intent hash with the saved `intent_sha256` after corrections. If the intent changed, present the impact and reassess affected tasks before you finish.
6. Report the artifact path as the input for an external plan-execution skill.

## Completion check

Before you present the plan for review, make sure that:

- The plan records the intent path and `intent_sha256`, and the intent file is unchanged.
- Every entry criterion holds against the intent.
- Every Open Question of the intent is resolved by evidence, a user answer, or an escalation.
- Every acceptance criterion traces to the intent's Proposed outcome and appears on at least one task.
- Each task has one entry point and one observable verification.
- Every production-behavior task states its RED, GREEN, and REFACTOR steps.
