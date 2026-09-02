# Phase 2 — Requirements

Turn the validated intent into a validated Product Requirements Document. This phase runs even when the user already knows what they want.

## Input contract

1. Require `docs/agentic-engineering/<subject>/intent.md` with `artifact: intent` and `status: validated`. If it is a draft, return to phase 1.
2. Preserve the intent's Scope and Confirmed Understanding. Do not silently reopen settled context.
3. Re-inspect repository facts that requirements depend on. If material repository drift contradicts the intent, show the evidence and ask before you continue.

An `explore` artifact is supporting evidence, not approval of scope or a decision to build.

## Artifact

`docs/agentic-engineering/<subject>/prd.md` from `assets/prd-template.md`, written once at the end of the phase.

## PRD invariant

The PRD must cover one deliverable that can ship independently.

## Workflow

1. Draft Problem and Goal in conversation, then run the **framing gate**.
2. Draft Functional and Non-Functional Requirements with verifications in conversation. Apply the FR rules and the NFR rules, then run the **requirements gate**.
3. Draft Open Questions without a separate review round — the validation recap covers them. Run the self-checks.
4. Write `prd.md` with `status: draft` — the first and only write.
   Present a recap per pairing rule 18 and ask the user to validate. Apply changes to the file until approved, then set `status: validated`.

### Framing gate

Present Problem and Goal concisely. Then challenge:

- Name affected users the Goal does not cover and ask whether they are in scope.
- Name unhappy paths and failure situations the Goal ignores and ask whether they must be covered.
- If a Goal clause does not answer part of the Problem, or a Problem statement has no Goal clause, say so.
- Offer scope trade-offs as options with a recommendation when evidence supports one. When a trade-off is accepted, run the scope-revision process only if it changes scope.

### FR rules

Define a distinct behavior by its actor, trigger, observable outcome, or independent acceptance decision.
Give each distinct behavior one FR. Keep one checkable behavior per FR. Never merge distinct behaviors.
Fold only edge cases, variants, and failure paths of the same behavior into its Verification field. Never hide a separate behavior in Verification.
Park behaviors that leave scope before the requirements gate.

### Scope revision

Run this process when a parked requirement changes scope.

1. Announce the scope revision.
2. Follow the staleness process and warn about downstream staleness.
3. Update the intent's Scope and Parked sections. Send every parked requirement to the intent's Parked section.
4. Revalidate the revised intent.
5. Refresh the PRD intent hash before continuing.

### NFR rules

Consider candidates from every category: performance, capacity, security, privacy, availability and recovery, compliance, accessibility, and observability.
Infer candidates from the validated intent, user statements, and repository evidence.
Never drop a legal, security, privacy, accessibility, or data-loss obligation.

### Requirements gate

Summarize the FR and NFR lists.

Confirm the PRD invariant: one deliverable that can ship independently.

Challenge the requirements:

- Collect every requirement you inferred rather than received and every NFR numeric limit without user or repository provenance into one list with sources, and confirm it in a single round per rule 16.
- Where a requirement can be strict or lenient, present both as options and recommend one.
- Name requirement conflicts and overlaps instead of resolving them silently.

## Section rules

- Use stable `FR-*`, `NFR-*`, and `Q-*` identifiers. One checkable behavior per entry. Requirements use "must". Sections 3–5 are ID-keyed lists, never tables.
- Each NFR has a number, limit, or binary check. Do not disguise a feature as a quality requirement. Consider each category: performance, capacity, security, privacy, availability and recovery, compliance, accessibility, observability. Add an NFR or omit the category; do not write "not applicable" entries.
- Each Verification field states an observable action and result, never "code written".
- A requirement that relies on an unverified assumption names it in Source.
- Unresolved user-owned `Q-*` block validation. Design-owned `Q-*` pass to phase 3 explicitly.

## Self-checks

Before validation, make sure that:

- Every Goal clause answers the Problem, and every in-scope Problem statement has a Goal clause.
- The PRD covers one deliverable that can ship independently.
- Each distinct functional behavior must have its own FR.
- Define distinct behavior by actor, trigger, observable outcome, or independent acceptance decision.
- Ensure that no FR hides a separate behavior in Verification.
- The NFR list keeps every legal, security, privacy, accessibility, and data-loss obligation.
- Every FR and NFR has an observable verification and a source, and every NFR is measurable or binary.
- Every NFR numeric limit has user or repository provenance, or a user-owned `Q-*` entry.
- Both gates received a user response.
- No user-owned `Q-*` remains open.
