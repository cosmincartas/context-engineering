# Phase 2 — Requirements

Turn the validated context brief into a validated Product Requirements Document. This phase runs even when the user already knows what they want.

## Input contract

1. Require `docs/agentic-engineering/<subject>/context-brief.md` with `artifact: context-brief` and `status: validated`. If it is a draft, return to phase 1.
2. Preserve the brief's Scope and Confirmed Understanding. Do not silently reopen settled context.
3. Re-inspect repository facts that requirements depend on. If material repository drift contradicts the brief, show the evidence and ask before you continue.

An `explore` artifact is supporting evidence, not approval of scope or a decision to build.

## Artifact

`docs/agentic-engineering/<subject>/prd.md` from `assets/prd-template.md`, written once at the end of the phase.

## PRD invariant

The PRD must cover one deliverable that can ship independently. It must contain no more than five FRs and five NFRs.

## Workflow

1. Draft Problem and Goal in conversation, then run the **framing gate**.
2. Draft Functional and Non-Functional Requirements with verifications in conversation. Apply both budgets, then run the **requirements gate**.
3. Draft Open Questions without a separate review round — the validation recap covers them. Run the self-checks.
4. Write `prd.md` with `status: draft` — the first and only write. Present a recap per pairing rule 18 and ask the user to validate. Apply changes to the file until approved, then set `status: validated`.

### Framing gate

Present Problem and Goal concisely. Then challenge:

- Name affected users the Goal does not cover and ask whether they are in scope.
- Name unhappy paths and failure situations the Goal ignores and ask whether they must be covered.
- If a Goal clause does not answer part of the Problem, or a Problem statement has no Goal clause, say so.
- Offer scope trade-offs as options with a recommendation when evidence supports one. When a trade-off is accepted, run the scope-revision process only if it changes scope.

### FR budget

The FR list has a maximum of five entries. Give each distinct functional behavior one FR. Never merge behaviors to meet the cap.

1. Fold only edge cases, variants, and failure paths of the same behavior into its Verification field. Never hide a separate behavior in Verification.
2. If the draft exceeds five FRs, return to phase 1's slicing gate. Select a smaller deliverable that can ship independently.
3. Apply the user's scope decision.
4. Park deliverables and behaviors that leave scope before the requirements gate.
5. Run the scope-revision process only after an over-budget draft changes scope.
6. Do not run the requirements gate until the revised brief passes validation and the FR list fits the budget.

### Scope revision

Run this process for NFR deferral; run it for FR overflow or mandatory NFR overflow only when they change scope.

1. Announce the scope revision.
2. Follow the staleness process and warn about downstream staleness.
3. Update the brief's Scope and Parked sections. Send every NFR candidate you defer to the context brief's Parked section.
4. Revalidate the revised context brief.
5. Refresh the PRD context hash before continuing.

### NFR budget

The NFR list has a maximum of five entries. Consider candidates from every category: performance, capacity, security, privacy, availability and recovery, compliance, accessibility, and observability.

1. Infer candidates from the validated brief, user statements, and repository evidence.
2. Rank candidates contextually in this order:
   - mandatory obligations from any category, such as legal, security, privacy, accessibility, and data-loss obligations;
   - explicit user or repository constraints;
   - risks to the core outcome.
3. Keep at most five candidates. Run the scope-revision process after you defer any candidate.
4. If mandatory NFRs exceed five, return to phase 1's slicing gate and reduce feature scope until all mandatory NFRs fit.
5. After mandatory overflow reduces scope, run the scope-revision process. Never defer a mandatory NFR.
6. Skip scope revision when the unchanged list has five or fewer candidates.
7. Do not run the requirements gate until the NFR list fits the budget.

### Requirements gate

Summarize the FR and NFR lists.

Confirm the PRD invariant: one deliverable that can ship independently, five FRs maximum, and five NFRs maximum.

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
- The FR list has no more than five entries. Each distinct functional behavior has its own FR; no FR hides a separate behavior in Verification.
- The NFR list has no more than five entries. Rank candidates from every category contextually. Park lower-priority candidates and keep all mandatory NFRs in scope.
- Every FR and NFR has an observable verification and a source, and every NFR is measurable or binary.
- Every NFR numeric limit has user or repository provenance, or a user-owned `Q-*` entry.
- Both gates received a user response.
- No user-owned `Q-*` remains open.
