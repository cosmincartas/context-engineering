---
name: requirements
description: Use when the user wants a PRD, product specification, user stories, or formal requirements, or wants to formalize a clarified request into requirements. Produces a user-validated PRD that the design skill consumes. Do not use for exploratory questions or technical design.
---

# Requirements Definition

Use ASD-STE100 Simplified Technical English when you ask questions or write output files.

Turn a validated context brief into a validated Product Requirements Document. This skill must follow `clarify`, even when the user already knows what they want.

The skill makes no production-code changes and no commits. It reads the repository only to establish current behavior and constraints.

## Input contract

Resolve the input before writing requirements.

### Required validated context brief

1. Require one saved context-brief path from `clarify`. If it is absent or unreadable, stop and direct the user to `clarify`.
2. Read it fully and require `artifact: context-brief` and `status: validated` in its frontmatter. If it is still a draft, stop and offer to resume `clarify`.
3. Preserve its confirmed problem, desired outcome, scope, constraints, provenance, and unresolved questions. Do not silently reopen settled context.
4. Record the SHA-256 hash of the exact context-brief file in the PRD frontmatter so later stages can detect stale context.
5. Re-inspect repository facts that requirements depend on. If material repository drift contradicts the brief, show the evidence and ask before continuing.

An `explore` artifact is supporting evidence. It is not user approval of scope or a decision to build.

## Artifact lifecycle

Use `assets/prd-template.md` and save the PRD to `docs/agentic-engineering/prd/<YYYY-MM-DD>/<subject>.md`.

1. If a matching PRD exists, reject it when it does not link a validated context brief with a matching exact-file SHA-256 hash. For a matching draft that passes this check, offer to resume it before creating another file. Compare the current exact-file SHA-256 with `context_sha256` before resuming.
2. Save the initial document with `status: draft` and `checkpoint: framing` after resolving the input.
3. Use these checkpoints in order: `framing`, `requirements`, `acceptance`, `awaiting-validation`, `complete`.
4. On write failure, report the failure and stop.
5. Before validation, compare the linked context brief with `context_sha256` again. Stop on mismatch.
6. Present the completed draft with `checkpoint: awaiting-validation` and ask the user to validate it.
7. Apply requested changes until approved. Then set `status: validated` and `checkpoint: complete`.

Never silently overwrite a validated PRD. Ask whether the user wants a revision and explain that downstream artifacts can become stale.

## Workflow

1. Resolve the input contract and record the repository baseline.
2. Read `references/ste-writing-rules.md`.
3. Fill the template in this order: Problem → Current Behavior → Goal → User Stories → Functional Requirements → Non-Functional Requirements → Acceptance Criteria → Open Questions → Appendix A.
4. Preserve provenance. Repository claims cite files or symbols. Assumptions remain visibly marked.
5. Run the self-checks.
6. Complete the validation loop and report the validated PRD path as input to `design`.

## Section rules

**Problem.** State what hurts, who is affected, what it costs, and why it matters. Do not name a solution component.

**Current Behavior.** Describe what happens now. Cite repository evidence for codebase claims. Include relevant workarounds and why they are insufficient. State when the work is greenfield.

**Goal.** State the desired capability, measurable success signals, and explicit non-goals. Every Goal clause must answer part of the Problem.

**User Stories.** Use stable `US-*` identifiers. Write one persona capability per story. Stories state the reason; requirements state the precision.

**Functional Requirements.** Use stable `FR-*` identifiers. Each row contains one checkable behavior and traces to at least one story. Use “must.” Mark requirements that rely on an unverified assumption.

**Non-Functional Requirements.** Use stable `NFR-*` identifiers. Each requirement has a number, limit, or binary check. Do not disguise features as quality requirements.

**Acceptance Criteria.** Use stable `AC-*` identifiers. Each criterion maps to `US-*` and `FR-*`/`NFR-*` identifiers and contains an observable action and result.

**Open Questions.** Give each question a stable `Q-*` identifier, options, and an owner. Unresolved user-owned questions block validation. Design-owned implementation choices can pass downstream explicitly.

**Appendix A — Rejected Options.** Include only when supplied evidence records rejected options. Preserve their reasons and provenance.

## Self-checks

Before validation, make sure that:

- Every story has at least one FR, and every FR traces to a story.
- Every `FR-*` and `NFR-*` maps to at least one `AC-*`.
- Every `AC-*` names the requirements it verifies and has an observable result.
- Every Goal clause answers the Problem, and every in-scope Problem statement has a Goal clause.
- Every NFR is measurable or binary.
- Repository claims cite evidence.
- Assumptions are marked and unresolved product or scope decisions are not hidden.
- The prose follows the STE rules unless the user requested standard English.

## Downstream contract

`design` consumes the validated PRD. It must cover every `FR-*`, `NFR-*`, and `AC-*`, resolve design-owned `Q-*` items as ADRs, and stop on unresolved user-owned decisions.
