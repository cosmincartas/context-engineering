---
name: to-plan
description: Use when the user explicitly provides a validated design document and requests an implementation plan. Produces a validated, resumable implementation plan split into granular, independently verifiable tasks.
---

# To Plan

Turn one validated design document into a resumable implementation plan that any agent can execute in a fresh session. Run only when the user explicitly invokes this skill; run the stages in order and never skip a gate.

## Invariants

These hold in every stage:

- Never run `git commit` without the user's explicit consent. Approval to save an artifact or continue the workflow is not consent to commit.
- Never write production code. This skill plans; it does not implement.
- Never inspect, edit, or ask about `.gitignore`. After saving the plan, you may say exactly: `Consider adding docs/agentic-engineering/ to .gitignore manually.`

## Stage 1 — Eligibility & Evidence

1. Require one saved design document path. If it is absent or unreadable, stop without drafting.
2. Require `artifact: design` and `status: validated` in the design frontmatter. Pressure cannot waive eligibility.
3. Read the linked PRD from `prd:` and require `artifact: prd` and `status: validated`. Collect the complete `FR-*`/`NFR-*`/`AC-*` set.
4. Require `prd_sha256:` in the design and compare it with the exact linked PRD file. If the PRD links a context brief, require and verify its `context_sha256` as well. Stop on any mismatch because the artifact chain is stale.
5. If a plan already exists at the target path, compare its `design_sha256` and `prd_sha256`. Resume or revise a `draft` only with user approval. Do not rewrite an `executing`, `blocked`, or `completed` plan as a planning artifact; ask whether to create a new revision. Never silently overwrite it or create a collision suffix.
6. Re-inspect the current repository from scratch: relevant implementation and callers, tests and observable contracts, public interfaces, and working-tree changes. Record the current commit as `repository_baseline`, or `unavailable` when Git metadata is absent.
7. Compare repository evidence with design assumptions. Prefer current evidence for implementation facts, but never silently change validated product intent.
8. Stop and ask about material drift. Name the stale assumption and the current evidence; do not draft from a replaced entry point until the user resolves the conflict.

## Stage 2 — Plan

1. Draft the plan from `assets/plan.md`.
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
2. Save it immediately to `docs/agentic-engineering/plans/<session>/<subject>.md` with `status: draft`. Reuse the design document's `<session>` and `<subject>` so the artifacts pair by name. On a collision, ask whether to resume or revise; never silently overwrite. On write failure, report it and stop.
3. Report the saved path with a short summary and ask the user to validate the document.
4. Apply requested changes and ask again until the user approves.
5. On approval, set `status: validated` and report the plan path as the input for an external plan-execution skill. Execution state lives in the plan itself, so any later session resumes from the active or first unfinished task.
