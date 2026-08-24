# Phase 4 — Plan

Turn the validated design into an implementation plan that any agent can execute in a fresh session. This phase plans; it does not implement.

## Input contract

1. Require `docs/agentic-engineering/<subject>/design.md` with `artifact: design` and `status: validated`. If it is a draft, return to phase 3.
2. Collect the complete `FR-*`/`NFR-*` set from the PRD.
3. Re-inspect the current repository from scratch: relevant implementation and callers, tests and observable contracts, public interfaces, and working-tree changes. Record the current commit as `repository_baseline`, or `unavailable` when Git metadata is absent.
4. Compare repository evidence with design assumptions. Prefer current evidence for implementation facts, but never silently change validated product intent. Stop and ask about material drift; name the stale assumption and the current evidence.

## Artifact

`docs/agentic-engineering/<subject>/plan.md` from `assets/plan-template.md`. Checkpoints: `drafting` → `awaiting-validation` → `complete`.

## Drafting rules

- Draft and save the complete plan before you present any plan content. Do not present task or section drafts. Ask only factual questions that block drafting.
- Give each task a stable `Task N` identifier and exactly one independently verifiable outcome, small enough for one red-green-refactor cycle when behavior changes.
- Give each task one `file:symbol` entry point: a current symbol, or a symbol the design defines when it does not exist yet; else one file path. Use the designed signatures as written; do not redefine them in the plan. Tell implementers to trace downstream from it; do not freeze a downstream file map or include production-code listings.
- Declare exact task identifiers under `Depends on:` or `none`. Order tasks so the project builds and its tests pass after every completed task.
- For every production-behavior task, specify the TDD cycle: the test and expected failure for RED, the minimum behavior for GREEN, and the allowed cleanup for REFACTOR. For a non-behavior task, state why TDD does not apply.
- Make every verification observable — a test result, command output, or behavior, never "code written".
- Cover every `FR-*` and `NFR-*` from the PRD on at least one task without inventing behavior.

## Validation loop

1. Complete the full draft and check every drafting rule.
2. Set `checkpoint: awaiting-validation`. Report the saved path, present a recap per pairing rule 18, and ask the user to validate. If task order or grouping involves a real trade-off, include the options and a recommendation.
3. Apply requested changes to the complete plan, repeat the checks, and ask for validation again. When approved, set `status: validated` and `checkpoint: complete`. Report the plan path as the input for an external plan-execution skill.
