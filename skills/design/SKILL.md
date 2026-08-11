---
name: design
description: Use when the user wants a technical design, architecture document, or solution specification, typically from a validated PRD. Produces a user-validated design document that the to-plan skill consumes. Do not use for exploratory explanations or UI/visual design.
---

# Solution Design

Use ASD-STE100 Simplified Technical English when you ask questions or write output files.

Turn a validated PRD into a validated technical design. This skill follows `requirements` and produces the input for `to-plan`.

The skill does not modify production code or make commits. It reads the repository to preserve existing interfaces, constraints, conventions, and verification seams.

## Input contract

Require one saved PRD with `artifact: prd` and `status: validated`. Read it fully and collect:

- Every `FR-*`, `NFR-*`, and `AC-*` identifier.
- Every `Q-*` item and its owner.
- Rejected options and their provenance, when present.
- Repository assumptions and the PRD baseline.

Record the SHA-256 hash of the exact PRD file in the design frontmatter. Stop on unresolved user-owned questions. Resolve design-owned questions as ADRs. If design work exposes a new product requirement, give it a provisional `FR-D*` identifier, record the gap, and ask the user to revise the PRD rather than silently changing scope. Do not validate the design until every `FR-D*` is incorporated into the PRD with normal acceptance traceability or removed from the design.

Re-inspect relevant repository evidence. If material drift contradicts the validated PRD, show the evidence and ask before designing around it.

## Artifact lifecycle

Use `assets/design-spec-template.md` and save the design to `docs/agentic-engineering/specs/<YYYY-MM-DD>/<subject>.md`.

1. If a matching draft exists, offer to resume it before creating another file. Compare the current exact-file PRD SHA-256 with `prd_sha256` before resuming.
2. Save the initial document with `status: draft` and `checkpoint: scope`.
3. Use these checkpoints in order: `scope`, `contracts`, `behavior`, `decisions`, `traceability`, `awaiting-validation`, `complete`.
4. On write failure, report the failure and stop.
5. Before validation, compare the linked PRD with `prd_sha256` again. Stop on mismatch or any remaining `FR-D*`.
6. Present the completed draft and its ADR decisions with `checkpoint: awaiting-validation`.
7. Apply requested changes until approved. Then set `status: validated` and `checkpoint: complete`.

Never silently overwrite a validated design. A revised PRD makes the design stale until its scope and traceability are checked again.

## Workflow

1. Resolve the input contract and record the current repository baseline.
2. Read `references/ste-writing-rules.md`.
3. Fill the template in this order: Scope → Design Rules → Contracts → Architecture → Components → Behavior → Failure Model → Cross-Cutting Concerns → ADRs → Traceability → Deferred.
4. Define contracts before components. Components consume or produce named contracts rather than inventing private interpretations of shared data.
5. Run the self-checks and complete the user-validation loop.
6. Report the validated design path as input to `to-plan`.

## Section rules

**Scope and PRD Linkage.** List every `FR-*`, `NFR-*`, and `AC-*`. Name uncovered or provisional requirements explicitly.

**Design Rules.** Write four to six priority-ordered tie-breakers derived from NFRs. Keep only rules that implementers can apply without interpretation.

**Contracts.** Define externally shared schemas, formats, interfaces, versions, ownership, and invariants. A contract has exactly one writer.

**Architecture Overview.** Use one simple diagram. Name components and the contracts between them.

**Component Designs.** State functions, deliberate non-functions, and externally meaningful interfaces. Include exit codes only for command-line interfaces.

**Behavior.** Describe important flows and state transitions. Include write ordering and sudden-stop recovery only where related persistent writes exist.

**Failure Model.** Cover failures relevant to this system, their detectors, responses, and verification identifiers. Do not invent optional dependencies, corruption paths, or persistence failures for systems that do not have them.

**Cross-Cutting Concerns.** State the design position for each row: security (authorization and malicious input), privacy (personal data exposure, retention, and deletion), and operability (monitoring, configuration, and deployment). Write "Not applicable" with a reason when a concern does not apply to this system. An empty row blocks validation.

**Architecture Decision Records.** Resolve every design-owned `Q-*` and every new consequential technical choice. Record context, options, decision, reasons, and accepted consequences. Ask the user before decisions involving product scope, public compatibility, security policy, cost, or irreversible data behavior. A decision involves cost when a realistic option adds a paid service or a material recurring cost.

**Traceability and Verification Map.** Map every `FR-*`, `NFR-*`, and `AC-*` to design sections and observable verification. Map each failure `F-*` to a verification row as well.

**Deferred and Out of Scope.** Record deferred items with the trigger that would promote each item.

## Self-checks

Before validation, make sure that:

- Every `FR-*`, `NFR-*`, and `AC-*` appears in Scope and Traceability.
- No provisional `FR-D*` remains.
- Every design-owned `Q-*` has an ADR and no user-owned question remains.
- Every contract has one writer, a version, and invariants.
- Every component has deliberate non-functions.
- Persistent write pairs have a recoverable ordering analysis when applicable.
- Every relevant failure has an observable verification row.
- Every cross-cutting concern row has a design position or a written reason it does not apply.
- Every design element traces to a requirement, acceptance criterion, failure, or stated repository constraint.
- Repository and technology choices are either existing constraints or recorded decisions.
- The prose follows the STE rules unless the user requested standard English.

## Downstream contract

`to-plan` consumes the validated design and linked validated PRD. It must carry every `FR-*`, `NFR-*`, and `AC-*` into independently verifiable implementation tasks.
