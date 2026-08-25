# Phase 3 — Design

Turn the validated PRD into a validated technical design. The design preserves existing interfaces, constraints, conventions, and verification seams. This phase is pair programming on the design surface: you and the user define models, interfaces, function signatures, and contracts together, one element at a time, as code.

## Input contract

1. Require `docs/agentic-engineering/<subject>/prd.md` with `artifact: prd` and `status: validated`. If it is a draft, return to phase 2.
2. Collect every `FR-*` and `NFR-*`, and every `Q-*` with its owner. Stop on an unresolved user-owned question; resolve design-owned questions at the decision gate.
3. Re-inspect relevant repository evidence: the implementation language, existing types and interfaces the design must fit, and naming conventions. If material drift contradicts the PRD, show the evidence and ask before you design around it.

If design work exposes a new product requirement, give it a provisional `FR-D*` identifier and ask the user to revise the PRD. Do not validate the design while an `FR-D*` remains.

## Artifact

`docs/agentic-engineering/<subject>/design.md` from `assets/design-spec-template.md`, written once at the end of the phase.

## Workflow

1. Run the **decision gate**.
2. Run the **pairing loop** over Models → Interfaces → Functions → Contracts.
3. Draft Architecture → Behavior → Failure Model → Traceability, one element at a time per the **element review** rule.
4. Run the self-checks.
5. Write `design.md` with `status: draft` — the first and only write. Present a recap per pairing rule 18 and ask the user to validate. Apply changes to the file until approved, then set `status: validated`.

### Decision gate

Run this gate before you write any design element, so the user shapes the design instead of reviewing it after the fact.

1. Collect every design-owned `Q-*` and every consequential technical choice you can already see: architecture shape, technology or library selection, data model direction, integration approach. For a greenfield repository with no evident implementation language, the language is a decision here.
2. For each, present two or three realistic options with trade-offs and recommend one. Ask one decision at a time.
3. Always ask for decisions involving product scope, public compatibility, security policy, cost (a paid service or material recurring cost), or irreversible data behavior.
4. Apply each decision directly in the design sections. A consequential choice that only becomes visible later returns to this gate before it is baked into the design.

### Pairing loop

The unit of work is one design element: one model, one interface or abstraction, one function signature, or one external contract. You drive; the user navigates.

1. Pick the next element in dependency order: a type before the interface that uses it, an interface before the function that takes it, functions before the external contract that exposes them. Within a section, start with the element the most requirements depend on.
2. Propose the element as a code block in the repository language. Write only declarations: type fields, interface members, function name, parameters with types, return type, raised or returned errors. Never write a function body. After the code block, give one line on why it has this shape and, if you have one, one open question. The whole proposal fits in 15 lines.
3. Wait. The user answers with one of: accept, edit (a changed version), counter (a different shape), or "you decide". Treat an edit or a counter as the new proposal: apply challenge duty once (rule 10), then record the result. "You decide" is an explicit delegation; record it.
4. Record the agreed element in the working draft before you propose the next one. One element per turn; do not batch.
5. When the user proposes an element before you do, critique it by the same rules and record the result.
6. When a new element would need a decision that belongs to the gate, return to the gate first.

### Element review

In workflow step 3, present each Behavior flow, Failure row, and Traceability row one at a time for approval, in the same turn rhythm as the pairing loop. The architecture diagram is one element.

## Section rules

- **Models.** Types and records the design introduces or changes, as code. Each field has a type; a constraint that the type cannot express is a one-line invariant under the block.
- **Interfaces.** Abstractions as code: interface, protocol, trait, or abstract class, with member signatures. One line after the block names what the abstraction is deliberately not responsible for.
- **Functions.** Signatures grouped by owner (module, class, or component). Each signature has one line stating its effect and its error behavior. A function references only models and interfaces in this design or already in the repository.
- **Contracts.** Externally shared schemas, formats, and interfaces. A contract has exactly one writer, a version, and invariants.
- **Architecture.** One simple diagram. Name components by the interface they implement or the functions they own. Exit codes only for command-line interfaces.
- **Behavior.** Important flows and state transitions, naming the functions they call in order. Write ordering and sudden-stop recovery only where related persistent writes exist.
- **Failure Model.** Failures relevant to this system, with detector, response, and observable verification. Do not invent optional dependencies, corruption paths, or persistence failures for systems that do not have them.
- **Traceability.** Every `FR-*` and `NFR-*` maps to design elements. A design element with no requirement or existing repository constraint is scope creep.
- Consider security (authorization, malicious input), privacy (personal data, retention, deletion), and operability (monitoring, configuration, deployment). Add a contract, failure row, or behavior where one applies; do not write "not applicable" entries.

## Self-checks

Before validation, make sure that:

- Every `FR-*` and `NFR-*` has a traceability row, and no `FR-D*` remains.
- Every design-owned `Q-*` was decided at the gate, and no user-owned question remains open.
- Every element in Models, Interfaces, Functions, and Contracts received a user response in the pairing loop.
- Every function signature references only designed or existing types; every interface has at least one designed implementer or consumer; no code block contains a function body.
- Every contract has one writer, a version, and invariants.
- Every failure has an observable verification.
- Technology and repository choices are existing constraints or decisions from the gate.
