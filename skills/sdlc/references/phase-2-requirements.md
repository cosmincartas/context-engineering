# Phase 2 — Requirements

Turn the validated context brief into a validated Product Requirements Document. This phase runs even when the user already knows what they want.

## Input contract

1. Require `docs/agentic-engineering/<subject>/context-brief.md` with `artifact: context-brief` and `status: validated`. If it is a draft, return to phase 1.
2. Read it fully. Preserve its confirmed problem, desired outcome, scope, constraints, provenance, and unresolved questions. Do not silently reopen settled context.
3. Record the SHA-256 hash of the exact context-brief file in the PRD frontmatter as `context_sha256`.
4. Re-inspect repository facts that requirements depend on. If material repository drift contradicts the brief, show the evidence and ask before you continue.

An `explore` artifact is supporting evidence. It is not user approval of scope or a decision to build.

## Artifact lifecycle

The output is `docs/agentic-engineering/<subject>/prd.md`, based on `assets/prd-template.md`.

1. If a draft exists, offer to resume it. Compare the current context-brief hash with `context_sha256` before you resume.
2. Save the initial document with `status: draft` and `checkpoint: framing`.
3. Use these checkpoints in order: `framing`, `requirements`, `acceptance`, `awaiting-validation`, `complete`. The framing and requirements checkpoints end with a gate; do not advance past a gate without a user response.
4. Before validation, compare the context brief with `context_sha256` again. Stop on mismatch.
5. Present the completed draft with `checkpoint: awaiting-validation` and ask the user to validate it.
6. Apply requested changes until approved. Then set `status: validated` and `checkpoint: complete`.

Never silently overwrite a validated PRD. Ask whether the user wants a revision and explain that downstream artifacts become stale.

## Workflow

1. Resolve the input contract and record the repository baseline.
2. Draft Problem → Current Behavior → Goal → User Stories. Save, then run the **framing gate**.
3. Draft Functional Requirements → Non-Functional Requirements. Save, then run the **requirements gate**.
4. Draft Acceptance Criteria and Open Questions. Set `checkpoint: acceptance`.
5. Preserve provenance. Repository claims cite files or symbols. Assumptions remain visibly marked.
6. Run the self-checks, then complete the validation loop.

### Framing gate

Present the Goal and the User Stories concisely. Then challenge, per the facilitation rules:

- Name personas or affected users that the stories do not cover, and ask whether they are in scope.
- Name unhappy paths and failure situations the stories ignore, and ask whether a story must cover them.
- If a Goal clause does not answer part of the Problem, or a Problem statement has no Goal clause, say so.
- Offer scope trade-offs as options with a recommendation when the evidence supports one.

### Requirements gate

Present the FR and NFR tables as a short summary. Then challenge:

- For each requirement you inferred rather than received, present it with its provenance and ask for confirmation.
- Where a requirement can be strict or lenient, present both formulations as options and recommend one.
- For each NFR numeric limit without user or repository provenance, ask the user to confirm the limit.
- Name requirement conflicts and overlaps instead of resolving them silently.

## Section rules

**Problem.** State what hurts, who is affected, what it costs, and why it matters. Do not name a solution component.

**Current Behavior.** Describe what happens now. Cite repository evidence for codebase claims. Include relevant workarounds and why they are insufficient. State when the work is greenfield.

**Goal.** State the desired capability, measurable success signals, and explicit non-goals. Every Goal clause must answer part of the Problem.

**User Stories.** Use stable `US-*` identifiers. Write one persona capability per story. For technical work without end users, use technical personas such as the developer or the operator. Stories state the reason; requirements state the precision.

**Functional Requirements.** Use stable `FR-*` identifiers. Each row contains one checkable behavior and traces to at least one story. Use "must." Mark requirements that rely on an unverified assumption.

**Non-Functional Requirements.** Use stable `NFR-*` identifiers. Each requirement has a number, limit, or binary check. Each requirement names its origin in the "Derived from" column: a Goal clause, a scope boundary, a story, or a constraint from the context brief. Do not disguise features as quality requirements. Complete the Category coverage table: give each listed category one or more `NFR-*` rows, or mark it "Not applicable" with a reason. If a numeric limit does not come from a user statement or repository evidence, confirm it at the requirements gate or add a user-owned `Q-*` entry.

**Acceptance Criteria.** Use stable `AC-*` identifiers. Each criterion maps to `US-*` and `FR-*`/`NFR-*` identifiers and contains an observable action and result.

**Open Questions.** Give each question a stable `Q-*` identifier, options, and an owner. Unresolved user-owned questions block validation. Design-owned implementation choices pass to phase 3 explicitly.

**Appendix A — Rejected Options.** Include only when supplied evidence records rejected options. Preserve their reasons and provenance.

## Self-checks

Before validation, make sure that:

- Every story has at least one FR, and every FR traces to a story.
- Every `FR-*` and `NFR-*` maps to at least one `AC-*`.
- Every `AC-*` names the requirements it verifies and has an observable result.
- Every Goal clause answers the Problem, and every in-scope Problem statement has a Goal clause.
- Every NFR is measurable or binary and has a "Derived from" entry.
- Every category in the NFR Category coverage table maps to `NFR-*` rows or has a written reason it does not apply.
- Every NFR numeric limit has user or repository provenance, or a user-owned `Q-*` entry.
- The framing gate and the requirements gate each received a user response.
- Repository claims cite evidence.
- Assumptions are marked and unresolved product or scope decisions are not hidden.
- The prose follows the STE rules unless the user requested standard English.
