---
name: implementation-plan
description: Create a validated implementation plan from an approved specification. Inspect repository evidence, define verifiable tasks, and map included requirements to verification. Do not design new scope or execute the plan.
---

# Implementation Plan

Turn an approved specification into a plan that an implementer can use in a fresh session.
The user controls scope and approves the complete plan. Draft implementation details autonomously within the approved specification.
This skill works independently. It does not require an SDLC session.

## Language

Use ASD-STE100 Simplified Technical English for all output, including chat, questions, and artifacts.
Use active voice and consistent terms. Limit instruction sentences to 20 words and description sentences to 25 words.
Preserve quoted input, identifiers, required signatures, and commands exactly.

## Inputs and output

- Require a specification file with `artifact: spec` and `status: validated`.
- Accept specifications from `design-specs` or `sdlc`. Do not require identical section numbering.
- If no specification is supplied, ask for its path or topic folder.
- If the specification is missing, unapproved, or inconsistent, explain the blocker and stop.
- Do not start another skill or approve the specification on the user's behalf.
- Save `plan.md` beside the source specification using [assets/plan-template.md](assets/plan-template.md).
- Read an existing plan before writing. Ask before replacing it or revising approved content.
- Keep the specification and its intent unchanged.

## Boundaries and interaction

- Never implement tasks or modify production code, tests, dependencies, or project configuration.
- Never run `git commit`, create branches, or push changes.
- Inspect evidence before asking questions that the repository can answer.
- Separate repository facts, user decisions, inferences, and unknowns.
- Ask only questions that block drafting or affect an approved decision.
- Use `AskUserQuestion` when available. Otherwise, ask in chat.
- Group questions only when they share a subject and their answers are independent.
- Explain concerns with evidence, consequences, and the smallest suitable alternative.
- Do not manufacture alternatives or reopen approved choices without new evidence.
- Silence, cancellation, and factual answers are not approval. Record explicit delegation and its limits.
- Use read-only repository investigation. Do not run implementation or verification commands merely because the plan contains them.
- Distinguish commands proposed for execution from checks actually performed during planning.

## Workflow

### 1. Validate the source

1. Read the complete specification and relevant supporting files, including approved UI references when applicable.
2. Check that no unresolved issue blocks implementation. Check approval records when the specification provides them.
3. Collect included functional and non-functional requirements with their identifiers, acceptance conditions, and design references.
4. Exclude proposed, excluded, deferred, and parked requirements from implementation coverage.
5. For SDLC specifications without selection fields, use the approved FR and NFR sections as the included set.
6. Resolve ambiguous selection or missing acceptance conditions before drafting dependent tasks. Do not silently interpret them as approval.
7. Compute the SHA-256 hash of the exact specification bytes for `spec_sha256`.
8. Record paths and SHA-256 hashes for local supporting files that define approved design, including referenced UI mocks.
9. If supporting-file approval is unclear, request confirmation before treating its current content as approved.
10. Check upstream intent freshness using the source rules below.

### 2. Inspect the current repository

1. Inspect implementation, callers, tests, public interfaces, scripts, and working-tree changes relevant to the specification.
2. Trace each included behavior from its entry point through affected components and observable outputs.
3. Record the current commit as `repository_baseline`, or `unavailable` when Git metadata is absent.
4. Record existing working-tree changes without altering them. Do not assume a clean repository.
5. Identify existing test commands, build commands, verification methods, and prerequisites from repository evidence.
6. Record known baseline failures and unavailable verification facilities. Do not claim checks passed without executing them.
7. Compare current evidence with specification assumptions. Route material conflicts through the correction rules before dependent planning.

### 3. Draft the complete plan

Read the template and prepare the complete plan before presenting it. Do not request routine task or section approvals.
Keep the plan sufficient for a fresh session without copying the complete specification.

- Give each task a stable `Task N` identifier and one independently verifiable outcome.
- Keep behavior tasks small enough for one red-green-refactor cycle. Avoid separate tasks for disconnected layers of one outcome.
- Give each task one entry point: an existing `file:symbol`, a required new symbol, or a file path.
- Tell the implementer to trace downstream from that entry point. Do not freeze an exhaustive downstream file list.
- Cite included requirement identifiers and relevant specification sections for each task.
- Justify necessary supporting tasks with an included requirement or an established repository constraint. Do not invent requirement identifiers.
- Declare exact task identifiers under `Depends on`, or use `none`.
- Order tasks so dependencies are satisfied and completed tasks preserve buildability and existing passing tests.
- Record known baseline failures separately. Do not add unrelated repair work without approval.
- Preserve required signatures, contracts, invariants, architecture, and acceptance conditions.
- Leave private helpers, class decomposition, and incidental wiring to implementation within those constraints.
- Reuse existing code, standard libraries, native capabilities, and installed dependencies before proposing additions.
- Route consequential new technology choices to specification review. Do not hide new design decisions inside tasks.
- Do not include production-code listings. Include exact contract references when correctness requires them.
- Plan migration, rollback, security, accessibility, and operational verification when the approved specification requires them.

For every production-behavior task, specify:

- **RED:** The test to add or change, its command, and the expected failure caused by missing behavior.
- **GREEN:** The minimum behavior that passes the test.
- **REFACTOR:** Permitted cleanup within approved constraints, with tests remaining green.
- **Verification:** Exact commands or observable checks, prerequisites, and expected results.

For non-behavior tasks, replace the TDD fields with a reason why TDD does not apply. Retain observable verification.
Use existing verification facilities. Do not invent available scripts or claim proposed commands already exist.
When a command requires a new test or script, name its creating task and the dependency.
When automated verification is unavailable, specify a reproducible observation and explain the limitation.

Map every included FR and NFR to at least one task and its verification.
Include integration or end-to-end checks when isolated task checks cannot establish an approved acceptance condition.
Do not use "code written" or "task completed" as verification.

### 4. Review and approve

1. Complete the checks below and save the entire plan with `status: draft` at the first review presentation.
2. Present the saved path, task order, dependencies, requirement coverage, and material concerns.
3. Keep the recap concise. Offer to expand any task without replacing the saved complete plan.
4. Ask the user to approve the complete plan. Apply requested corrections in place.
5. Recheck source freshness and repository evidence before final approval. Explain any changes since drafting.
6. After explicit approval, record the approved content and approval evidence. Set `status: validated`.
7. Report the plan path as input for a separate execution skill and stop. Do not start execution.

## Source freshness and continuation

Resolve relative `spec` paths against the plan folder. Resolve relative `intent` paths against the specification folder.
For file-based intent, require its source file and matching `intent_sha256` before planning and final validation.
For conversation-supplied intent, accept `intent_sha256: not applicable` only when the specification records the supplied intent.
If a required source or hash is missing, explain the blocker. Do not fabricate a hash or silently bypass the check.

On resume or a conversation branch change, read the plan, source specification, and relevant supporting files again.
Compare the saved `spec_sha256` with the current source. Recheck upstream intent freshness.
Verify recorded supporting-file hashes on resume and before final validation. Treat missing or changed files as source staleness.
Inspect relevant repository changes against the recorded baseline, including uncommitted changes. Reassess affected tasks before continuing.
If Git metadata is unavailable, state the limit and inspect current relevant files directly.
Use saved approvals rather than absent conversation history. Ask before reopening or replacing an approved plan.
Before the first draft is saved, interrupted planning restarts from the approved specification and current repository evidence.
Report write failures and stop. Never claim unsaved work can be resumed.

## Corrections

- If source hashes differ, stop and identify changed assumptions or sections. State when the earlier content is unavailable for comparison.
- Never refresh a hash merely to hide staleness. Review the changed source and obtain approval for affected content first.
- If intent changes, request intent review before dependent specification or plan revisions.
- If scope, acceptance, UI, contracts, or architecture change, request specification review through `design-specs` or its original workflow.
- Do not edit upstream artifacts or start another skill automatically. Resume after the corrected specification is validated.
- If only task order, grouping, or verification changes, revise the plan and request plan approval.
- Private structural choices within approved constraints do not require specification approval.
- Before revising a validated plan, explain the impact and set its status to draft. Supersede the affected approval record.

## Completion checks

- The source specification is validated, current, and free of implementation-blocking issues.
- Only included requirements appear in task coverage. Every included FR and NFR maps to tasks and observable verification.
- Every task has a stable identifier, one outcome, an entry point, dependencies, and a specification or repository justification.
- Dependency identifiers exist, have no cycles, and precede dependent tasks.
- Behavior tasks contain RED, GREEN, REFACTOR, and verification. Other tasks explain why TDD does not apply.
- Verification commands are evidence-backed or explicitly planned. Each check names prerequisites and an expected result.
- Existing changes, known failures, unexecuted checks, and unavailable evidence are clearly distinguished.
- Tasks preserve the approved scope, contracts, invariants, and architecture without freezing incidental private structure.
- The plan contains no unresolved consequential design decision disguised as implementation work.
- The saved plan contains source hashes, repository findings, implementation discretion, correction rules, and approval evidence.
- The artifact and recap follow the language rules. No unused placeholders remain at final approval.
- Final validated status follows explicit user approval. No implementation work has started.
