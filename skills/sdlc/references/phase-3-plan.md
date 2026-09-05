# Phase 3 — Plan

Turn the validated design into an implementation plan that any agent can execute in a fresh session. This phase plans; it does not implement.

## Input contract

1. Require `docs/agentic-engineering/<subject>/spec.md` with `artifact: spec` and `status: validated`. If it is a draft, return to phase 2.
2. Collect the complete `FR-*`/`NFR-*` set from the spec.
3. Re-inspect the current repository from scratch: relevant implementation and callers, tests and observable contracts, public interfaces, and working-tree changes. Record the current commit as `repository_baseline`, or `unavailable` when Git metadata is absent.
4. Compare repository evidence with spec assumptions. Prefer current evidence for implementation facts, but never silently change validated product intent. Route material drift through the shared correction rule; name the stale assumption and the current evidence.

## Artifact

`docs/agentic-engineering/<subject>/plan.md` from `assets/plan-template.md`, written once at the end of the phase.

## Drafting rules

- Draft the complete plan in conversation before you present any plan content. Do not present task or section drafts. Ask only factual questions that block drafting.
- Give each task a stable `Task N` identifier and exactly one independently verifiable outcome, small enough for one red-green-refactor cycle when behavior changes.
- Give each task one `file:symbol` entry point: a current symbol, or a required symbol the design defines when it does not exist yet; else one file path. Preserve required contract signatures and approved constraints. Choose private structure within those constraints; illustrative skeletons are optional. Tell implementers to trace downstream from the entry point; do not freeze a downstream file map or include production-code listings.
- Carry the implementation discretion from the plan template into the saved plan. Permit private structural changes within approved behavior, contracts, invariants, and architecture. Route consequential deviations through the shared correction rule before dependent work. Prefer existing code and capabilities before introducing an abstraction or dependency.
- Declare exact task identifiers under `Depends on:` or `none`. Order tasks so the project builds and its tests pass after every completed task.
- For every production-behavior task, specify the TDD cycle: the test and expected failure for RED, the minimum behavior for GREEN, and the allowed cleanup for REFACTOR. For a non-behavior task, state why TDD does not apply.
- Make every verification observable — a test result, command output, or behavior, never "code written".
- Cover every `FR-*` and `NFR-*` from the spec on at least one task without inventing behavior.

## Validation loop

1. Complete the full draft and check every drafting rule.
2. Write `plan.md` with `status: draft` at the first validation presentation. Report the saved path and present the complete plan per the shared Final validation rules. Include alternatives only for unresolved consequential choices, then ask the user to validate.
3. Apply requested corrections through the shared correction rule, update the complete plan, and repeat the checks before final approval. When approved, set `status: validated`. Report the plan path as the input for an external plan-execution skill.
