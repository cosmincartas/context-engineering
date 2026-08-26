---
name: quickie
description: Use when the user wants one small and clear change planned in a single session, without a PRD or a design specification. Produces one validated implementation plan. Do not use when the scope is unclear, when a public contract changes, or when a design decision is open (use sdlc).
---

# Quickie

Write the artifact in ASD-STE100 Simplified Technical English: sentences of at most 20 words (instructions) or 25 (descriptions), active voice, imperative for steps, one meaning for each word, requirements use "must" (never "shall" or "should"). Chat stays in natural conversational language.

Plan one small change in a single pass: align the understanding, draft the plan, validate the plan. This skill plans; it does not implement. Execution belongs to other skills.

## Entry criteria

Use this skill only when every criterion holds:

- The request covers one deliverable that can ship independently.
- The work fits five tasks or fewer.
- The work changes no public contract, data format, or security behavior.
- No design decision with realistic alternatives is open.

If a criterion fails, run the escalation step. Use `sdlc` for paired delivery work through context, requirements, design, and plan. Use `explore` for a question the user asks to learn or to compare.

## Artifact

`docs/agentic-engineering/quickie/<YYYY-MM-DD>-<subject>.md` from `assets/quick-plan-template.md`. Use a short kebab-case subject. The artifact has no upstream artifact and records no upstream hash.

## Invariants

- Never write production code. This skill plans; it does not implement.
- Never run `git commit`, create branches, or push changes.
- Write the artifact file once, when you present it for validation, with `status: draft`. Set `status: validated` when the user approves. A session interrupted before the write restarts the skill.
- Inspect repository evidence before you ask the user to describe behavior the code already shows.
- Separate user statements, repository evidence, inference, and unknowns. Do not turn an inference into a confirmed constraint.
- Make every verification observable — a test result, command output, or behavior, never "code written".
- Never inspect, edit, or ask about `.gitignore`. After you save the artifact, you can say exactly: `Consider adding docs/agentic-engineering/ to .gitignore manually.`

## Step 1 — Align

1. Inspect the relevant implementation, callers, tests, and recent commits. State when there is no repository evidence.
2. Restate the request in the user's vocabulary. Preserve the user's intent, and list the gaps that change the plan.
3. Ask the gap questions in one `AskUserQuestion` batch of at most four related questions. For a genuine choice, offer concrete options and recommend one when evidence supports it. If the user cancels, stop and wait for direction.
4. Present in one screen, about 30 lines: the confirmed understanding, the scope, and the acceptance criteria in ordinary language. Present the entries that come from your inference as one list, and ask the user to confirm or correct them.
5. Run the escalation step against the confirmed understanding.
6. Ask the user to approve the understanding, the scope, and the acceptance criteria before you draft the plan.

### Escalation step

1. Check every entry criterion against the confirmed understanding.
2. If a criterion fails, name the criterion and the evidence, and recommend `sdlc`.
3. Give the confirmed understanding to `sdlc` as input for its context phase. Do not continue in this skill.

## Step 2 — Plan

Draft the complete plan in conversation before you present plan content. Present no partial task drafts. Ask only factual questions that block drafting.

- Write five tasks or fewer. Give each task a stable `Task N` identifier and exactly one independently verifiable outcome.
- Give each task one `file:symbol` entry point: a current symbol, or one file path when the symbol does not exist yet. Tell implementers to trace downstream from it; do not freeze a downstream file map.
- Declare exact task identifiers under `Depends on:` or `none`. Order the tasks so the project builds and its tests pass after every completed task.
- For every production-behavior task, specify the TDD cycle: the test and expected failure for RED, the minimum behavior for GREEN, and the allowed cleanup for REFACTOR. For a non-behavior task, state why TDD does not apply.
- Cover every acceptance criterion on at least one task. Do not invent behavior.
- If the complete draft needs more than five tasks, return to the escalation step.

## Step 3 — Validate

1. Complete the draft and check every rule in step 2 and the completion check.
2. Write the artifact with `status: draft` — the first and only write. Report the saved path.
3. Present a recap of at most 30 lines: what the plan does, the files or symbols it touches, and its consequential choices. Do not paste the full document. Ask the user to validate.
4. Apply requested changes to the complete plan, repeat the checks, and ask for validation again. When the user approves, set `status: validated`.
5. Report the artifact path as the input for an external plan-execution skill.

## Completion check

Before you report the plan as validated, make sure that:

- The user confirmed the understanding, the scope, and the acceptance criteria.
- Every entry criterion holds.
- The plan has five tasks or fewer, and each task has one entry point and one observable verification.
- Every acceptance criterion appears on at least one task.
- Every production-behavior task states its RED, GREEN, and REFACTOR steps.
- The artifact has `status: validated`.
