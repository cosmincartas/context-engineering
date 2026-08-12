# Phase 4 — Plan

Turn the validated design into a resumable implementation plan that any agent can execute in a fresh session. This phase plans; it does not implement.

## Input contract

1. Require `docs/agentic-engineering/<subject>/design.md` with `artifact: design` and `status: validated`. If it is a draft, return to phase 3.
2. Read the PRD and collect the complete `FR-*`/`NFR-*`/`AC-*` set.
3. Check the full staleness chain: the design's `prd_sha256` against the exact PRD file, and the PRD's `context_sha256` against the exact context brief. Stop on any mismatch; the chain is stale.
4. If `plan.md` already exists, compare its `design_sha256` and `prd_sha256`. Resume or revise a `draft` only with user approval. Do not rewrite an `executing`, `blocked`, or `completed` plan as a planning artifact; ask whether to create a new revision. Never silently overwrite it.
5. Re-inspect the current repository from scratch: relevant implementation and callers, tests and observable contracts, public interfaces, and working-tree changes. Record the current commit as `repository_baseline`, or `unavailable` when Git metadata is absent.
6. Compare repository evidence with design assumptions. Prefer current evidence for implementation facts, but never silently change validated product intent.
7. Stop and ask about material drift. Name the stale assumption and the current evidence; do not draft from a replaced entry point until the user resolves the conflict.

## Drafting rules

Draft the plan from `assets/plan-template.md` and save it to `docs/agentic-engineering/<subject>/plan.md` with `status: draft`.

- Keep the Execution Protocol section intact; it is what lets a fresh session with no conversation history execute and resume the plan.
- Record SHA-256 hashes of the exact validated design and PRD files in `design_sha256` and `prd_sha256`.
- Cover every `FR-*`, `NFR-*`, and `AC-*` from the PRD and design without inventing behavior, and map each one under Requirement Coverage.
- Give each task a unique, stable `Task N` identifier and exactly one independently verifiable outcome, small enough for one red-green-refactor cycle when behavior changes, starting at `Status: Not Started`.
- Give each task exactly one current `file:symbol` entry point when a symbol exists; use one file path only when no stable symbol exists. Tell implementers to trace downstream from that entry point; do not freeze a downstream file map or include production-code listings.
- Declare exact task identifiers under `Depends on:` or `none`. Order tasks so the project builds and its tests pass after every completed task.
- For every production-behavior task, specify a TDD cycle: the test and expected failure for RED, the minimum behavior for GREEN, and the allowed cleanup for REFACTOR. Never plan production code before the failing test.
- For non-behavior tasks, state why TDD does not apply and provide the smallest observable validation.
- Make every verification outcome observable — a test result, command output, or behavior, never "code written".
- Leave execution evidence empty for the implementation skill to fill: changed files, commands and results, completion time, and blocker.
- Include Migration, Rollout, and Rollback only when relevant. Remove inapplicable optional sections instead of writing `N/A`.

## Validation loop

1. Report the saved path with a short summary. If a task order or grouping involves a real trade-off, present the options with a recommendation before you ask for validation.
2. Ask the user to validate the document. Apply requested changes and ask again until the user approves.
3. On approval, set `status: validated`. Execution state lives in the plan itself, so any later session resumes from the active or first unfinished task.
