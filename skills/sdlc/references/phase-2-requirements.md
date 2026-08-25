# Phase 2 — Requirements

Turn the validated context brief into a validated Product Requirements Document. This phase runs even when the user already knows what they want.

## Input contract

1. Require `docs/agentic-engineering/<subject>/context-brief.md` with `artifact: context-brief` and `status: validated`. If it is a draft, return to phase 1.
2. Preserve the brief's Scope and Confirmed Understanding. Do not silently reopen settled context.
3. Re-inspect repository facts that requirements depend on. If material repository drift contradicts the brief, show the evidence and ask before you continue.

An `explore` artifact is supporting evidence, not approval of scope or a decision to build.

## Artifact

`docs/agentic-engineering/<subject>/prd.md` from `assets/prd-template.md`, written once at the end of the phase.

## Workflow

1. Draft Problem and Goal in conversation, then run the **framing gate**.
2. Draft Functional and Non-Functional Requirements with their verifications in conversation, apply the **FR budget**, then run the **requirements gate**.
3. Draft Open Questions. Run the self-checks.
4. Write `prd.md` with `status: draft` — the first and only write. Present a recap per pairing rule 18 and ask the user to validate. Apply changes to the file until approved, then set `status: validated`.

### Framing gate

Present Problem and Goal concisely. Then challenge:

- Name affected users the Goal does not cover and ask whether they are in scope.
- Name unhappy paths and failure situations the Goal ignores and ask whether they must be covered.
- If a Goal clause does not answer part of the Problem, or a Problem statement has no Goal clause, say so.
- Offer scope trade-offs as options with a recommendation when evidence supports one.

### FR budget

The FR list is capped at 10 entries. A minimum slice that needs more is over-split or mis-sliced. When a draft exceeds the cap, resolve it before the requirements gate:

1. Merge: one FR per user-visible behavior; fold edge cases, variants, and failure paths into that FR's Verification field instead of adding entries.
2. If still over the cap, the slice is too big: propose which FRs to park as future topics and apply the user's decision. The requirements gate does not run until the list is within budget.

### Requirements gate

Present the FR and NFR lists as a short summary. Then challenge:

- Present each requirement you inferred rather than received, with its source, and ask for confirmation.
- Where a requirement can be strict or lenient, present both as options and recommend one.
- Ask the user to confirm each NFR numeric limit that has no user or repository provenance.
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
- The FR list is within the FR budget, and no FR restates or rephrases another.
- Every FR and NFR has an observable verification and a source, and every NFR is measurable or binary.
- Every NFR numeric limit has user or repository provenance, or a user-owned `Q-*` entry.
- Both gates received a user response.
- No user-owned `Q-*` remains open.
