# Phase 3 — Design

Turn the validated PRD into a validated technical design. The design preserves existing interfaces, constraints, conventions, and verification seams.

## Input contract

1. Require `docs/agentic-engineering/<subject>/prd.md` with `artifact: prd` and `status: validated`. If it is a draft, return to phase 2.
2. Read it fully and collect every `FR-*`, `NFR-*`, and `AC-*` identifier, every `Q-*` item and its owner, rejected options when present, and the repository assumptions.
3. Compare the current context-brief file with the PRD's `context_sha256`. Stop on a mismatch; the chain is stale.
4. Record the SHA-256 hash of the exact PRD file in the design frontmatter as `prd_sha256`.
5. Stop on unresolved user-owned questions. Resolve design-owned questions at the decision gate.
6. Re-inspect relevant repository evidence. If material drift contradicts the validated PRD, show the evidence and ask before you design around it.

If design work exposes a new product requirement, give it a provisional `FR-D*` identifier, record the gap, and ask the user to revise the PRD rather than silently changing scope. Do not validate the design until every `FR-D*` is incorporated into the PRD with normal acceptance traceability or removed from the design.

## Artifact lifecycle

The output is `docs/agentic-engineering/<subject>/design.md`, based on `assets/design-spec-template.md`.

1. If a draft exists, offer to resume it. Compare the current PRD hash with `prd_sha256` before you resume.
2. Save the initial document with `status: draft` and `checkpoint: scope`.
3. Use these checkpoints in order: `scope`, `decisions`, `contracts`, `behavior`, `traceability`, `awaiting-validation`, `complete`. The decisions checkpoint is a gate; do not advance past it without a user response.
4. Before validation, compare the PRD with `prd_sha256` again. Stop on mismatch or any remaining `FR-D*`.
5. Set `checkpoint: awaiting-validation` and present a recap per pairing rule 27.
6. Apply requested changes until approved. Then set `status: validated` and `checkpoint: complete`.

Never silently overwrite a validated design. A revised PRD makes the design stale until its scope and traceability are checked again.

## Workflow

1. Resolve the input contract and record the current repository baseline.
2. Fill Scope and PRD Linkage. Save, then run the **decision gate**.
3. Fill Design Rules → Contracts → Architecture → Components → Behavior → Failure Model → Cross-Cutting Concerns → ADRs → Traceability → Deferred. Define contracts before components; components consume or produce named contracts rather than inventing private interpretations of shared data.
4. Run the self-checks and complete the user-validation loop.

### Decision gate

Run this gate before you write contracts or architecture, so the user shapes the design instead of reviewing it after the fact.

1. Collect every design-owned `Q-*` from the PRD and every new consequential technical choice you can already see: architecture shape, technology or library selection, data model direction, integration approach.
2. For each, present two or three realistic options with their trade-offs, and recommend one with reasons, per the facilitation rules. Ask one decision at a time.
3. Always ask the user for decisions involving product scope, public compatibility, security policy, cost, or irreversible data behavior. A decision involves cost when a realistic option adds a paid service or a material recurring cost.
4. Record each resolved decision as an ADR: context, options, decision, reasons, and accepted consequences. Record an explicit "you decide" delegation in the ADR context.
5. A consequential choice that only becomes visible later in the workflow returns to this gate before it is baked into the design.

## Section rules

**Scope and PRD Linkage.** List every `FR-*`, `NFR-*`, and `AC-*`. Name uncovered or provisional requirements explicitly.

**Design Rules.** Write four to six priority-ordered tie-breakers derived from NFRs. Keep only rules that implementers can apply without interpretation.

**Contracts.** Define externally shared schemas, formats, interfaces, versions, ownership, and invariants. A contract has exactly one writer.

**Architecture Overview.** Use one simple diagram. Name components and the contracts between them.

**Component Designs.** State functions, deliberate non-functions, and externally meaningful interfaces. Include exit codes only for command-line interfaces.

**Behavior.** Describe important flows and state transitions. Include write ordering and sudden-stop recovery only where related persistent writes exist.

**Failure Model.** Cover failures relevant to this system, their detectors, responses, and verification identifiers. Do not invent optional dependencies, corruption paths, or persistence failures for systems that do not have them.

**Cross-Cutting Concerns.** State the design position for each row: security (authorization and malicious input), privacy (personal data exposure, retention, and deletion), and operability (monitoring, configuration, and deployment). Write "Not applicable" with a reason when a concern does not apply to this system. An empty row blocks validation.

**Architecture Decision Records.** Every design-owned `Q-*` and every consequential technical choice has an ADR resolved at the decision gate.

**Traceability and Verification Map.** Map every `FR-*`, `NFR-*`, and `AC-*` to design sections and observable verification. Map each failure `F-*` to a verification row as well.

**Deferred and Out of Scope.** Record deferred items with the trigger that would promote each item.

## Self-checks

Before validation, make sure that:

- Every `FR-*`, `NFR-*`, and `AC-*` appears in Scope and Traceability.
- No provisional `FR-D*` remains.
- Every design-owned `Q-*` has an ADR and no user-owned question remains.
- Every ADR records a user decision or an explicit delegation from the decision gate.
- Every contract has one writer, a version, and invariants.
- Every component has deliberate non-functions.
- Persistent write pairs have a recoverable ordering analysis when applicable.
- Every relevant failure has an observable verification row.
- Every cross-cutting concern row has a design position or a written reason it does not apply.
- Every design element traces to a requirement, acceptance criterion, failure, or stated repository constraint.
- Repository and technology choices are either existing constraints or recorded decisions.
- The prose follows the STE rules unless the user requested standard English.
