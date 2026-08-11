---
name: solution-design
description: Write design specification documents (SDS) in ASD-STE100 Simplified Technical English, downstream of a PRD, with a fixed 10-section structure - Scope and PRD Linkage, Design Rules, Contracts, Architecture Overview, Component Designs, Behavior, Failure Model, Architecture Decision Records, Traceability and Test Map, Deferred items. Consumes the PRD produced by the requirements-definition skill as its primary input. Use this skill whenever the user asks for a design spec, design document, technical design, architecture document, system design, SDS, or asks to turn a PRD or requirements list into a design, or to resolve open design questions as ADRs. Also use it to review or restructure an existing design document. Do not use it for UI or visual design requests.
---

# Solution Design

Write a design specification with contracts before components, explicit behavior flows, ADRs for every open decision, and a bidirectional traceability map. Style is ASD-STE100 Simplified Technical English. This skill is the third stage of the SDLC document pipeline: `discovery` → `requirements-definition` → **`solution-design`**. It consumes the PRD and produces the spec that a future `test-definition` stage consumes.

Like the upstream skills, this skill makes no code changes and no commits. It reads code only to describe constraints that the design must obey (existing interfaces, formats, tools). The design spec describes the system to build. It does not build the system.

## Input contract: the PRD

The primary input is a PRD (the output of the `requirements-definition` skill). Resolve the input before you write anything:

**1. A PRD exists** (attached, referenced, or present in the conversation). Read it fully, then collect four things:

- **All FR and NFR IDs.** These become the Scope list (Section 1) and the left column of the Traceability table (Section 9). Every ID must appear in both.
- **All Open Questions.** Each one becomes an ADR (Section 8). An Open Question with no ADR blocks the spec.
- **Appendix A (rejected options), if present.** ADRs cite "PRD Appendix A, option (x)" instead of a new debate on a dead branch. If a rejected option becomes relevant again, say so explicitly in the ADR and give the new fact that changed the picture. Do not resurrect a rejected option in silence.
- **The acceptance criteria.** The Test column of Section 9 must be compatible with them: a design that cannot pass the PRD's ACs is wrong, not the ACs.

Then validate: if the PRD has FRs marked with hunch provenance, list them in Section 1 as design risks. The design must not make a hunch load-bearing without a note.

**2. No PRD exists.** Say that the spec will be weaker without one, and offer the `requirements-definition` skill first. If the user declines, reconstruct a minimal requirements list from the conversation, write it into Section 1 as "reconstructed requirements", and mark the spec header "no upstream PRD". Do not write a spec against requirements that exist only in your head.

**3. The PRD changes during design.** Design work finds requirement gaps. When a new requirement appears, do not add it to the spec in silence. Name it, give it a provisional ID (FR-Dn), put it in Section 1, and tell the user that the PRD needs an update.

## Workflow

1. Resolve the input per the contract above.
2. Read `references/ste-writing-rules.md`. All prose obeys those rules.
3. Copy `assets/design-spec-template.md` as the starting file. Keep the section sequence.
4. Fill the sections in this order: Scope → Design Rules → **Contracts** → Architecture → Components → Behavior → Failure Model → ADRs → Traceability → Deferred. Contracts come before components on purpose: a component is then a reader and a writer of named contracts, and two implementers can work against frozen contracts in parallel.
5. Run the self-checks (bottom of this file).
6. Write the output to a Markdown file and present it. If the contracts are data schemas, offer to also write them as JSON Schema files that CI can validate.

## Section rules

**Scope and PRD Linkage.** One paragraph of scope. Then the explicit list of FR and NFR IDs this spec covers, the design risks from hunch-provenance FRs, and any requirement the spec does not cover — with the reason. A gap is a finding. Do not hide it.

**Design Rules (tenets).** 4 to 6 tie-breaking rules derived from the NFRs, in priority order. Each rule cites the NFRs it serves. Their function: when two designs are valid, the rule with the lower number wins. Write each rule so that an implementer — person or agent — can apply it without a question.

**Contracts.** The schemas, file formats, and interfaces that a second implementation must agree on. For each contract: a field table, the one writer that owns it, and the rules that are always true (invariants). Contracts are the public API. They get versions independent of the code. Apply this test to each candidate detail: does a second implementation need to agree on it? If yes, it goes here. If no, it goes in code comments.

**Architecture Overview.** One diagram, kept simple. Name each component and the single contract it writes. One writer per artifact. Name the components that write nothing.

**Component Designs.** For each component: "Functions" (what it does), "Not functions" (what it deliberately does not do), and its interface with exit codes. The "Not functions" list is mandatory. It is what stops scope creep during implementation.

**Behavior.** State machines and flows, with conditions and results per step. Include the write-ordering analysis: for each pair of related writes, give the write sequence, the state that a sudden stop between them produces, and the reason that state is recoverable. This section proves the durability NFRs. It does not only assert them.

**Failure Model.** A table: failure, detector, designed response. Include at minimum: missing inputs, limit violations, sudden stops, unrecoverable external state, missing optional dependencies, and detected corruption. Each row must produce a test in Section 9.

**Architecture Decision Records.** One ADR per PRD Open Question, plus one per new decision of consequence. Fixed shape: Context, Options, Decision, Reason, Result. The reason for each rejected option must be as specific as the reason for the accepted one. A rejection without a reason gets proposed again later — by a person or by an agent. When PRD Appendix A already rejected an option, cite it. Do not repeat the debate.

**Traceability and Test Map.** A table: requirement ID → design section → test procedure. Write the test procedures in imperative STE form: "Do X. Make sure that Y." Verification *design* belongs here — what must be proven, and the shape of the proof. Test *definition* does not: concrete test cases, fixtures, test code, environments, and coverage targets belong to the downstream test-definition stage. Attach the review rule to the table: a requirement with no row blocks approval; a design element with no row is scope creep — remove it or give a reason.

**Deferred and Out of Scope.** Version-2 items, each with the trigger that promotes it. "Never" items, each with the design rule it would break.

## Self-checks before presenting

- Every FR and NFR from the PRD appears in the Scope list and in the Traceability table. Reconstructed or provisional (FR-Dn) requirements have marks.
- Every PRD Open Question has an ADR. Every ADR records the rejected options with specific reasons. ADRs cite PRD Appendix A where it applies; no rejected option returns in silence.
- Every contract names exactly one writer and lists its invariants.
- Every component has a "Not functions" list.
- The Behavior section contains a write-ordering analysis if the system persists state.
- Every Failure Model row has a matching test in the Traceability table.
- The Traceability tests are compatible with the PRD acceptance criteria.
- No function signatures, no library choices, no language choices. Test for each detail: must a second implementation agree on it? If no, remove it.
- The prose obeys the STE rules.

If the user asks for standard English instead of STE, keep the structure and all rules. Drop only the STE style constraints.

## Downstream contract

A future `test-definition` stage consumes Section 9 (the test map) and Section 7 (the failure model), together with the PRD's acceptance criteria, and expands each row into test files, fixtures, and CI wiring. That stage has little creative latitude by design. Write Sections 7 and 9 so that the expansion is close to transcription: one row, one test, no interpretation.
