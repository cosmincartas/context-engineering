# Phase 3 — Design

Turn the validated PRD into a validated technical design. The design preserves existing interfaces, constraints, conventions, and verification seams. This phase is pair programming on the design surface: you and the user agree on the architecture first, then define models, interfaces, and contracts together as complete declarations mapped onto it.

## Input contract

1. Require `docs/agentic-engineering/<subject>/prd.md` with `artifact: prd` and `status: validated`. If it is a draft, return to phase 2.
2. Collect every `FR-*` and `NFR-*`, and every `Q-*` with its owner. Stop on an unresolved user-owned question; resolve design-owned questions at the decision gate.
3. Re-inspect relevant repository evidence: the implementation language, existing types and interfaces the design must fit, and naming conventions. If material drift contradicts the PRD, show the evidence and ask before you design around it.

If design work exposes a new product requirement, give it a provisional `FR-D*` identifier and ask the user to revise the PRD. Do not validate the design while an `FR-D*` remains.

## Artifact

`docs/agentic-engineering/<subject>/design.md` from `assets/design-spec-template.md`, written once at the end of the phase.

## Workflow

1. Run the **decision gate**.
2. Run the **architecture step**: one component diagram with its architectural flow, reviewed in one turn. It is the map every later element attaches to.
3. Run the **pairing loop** over the components of the architecture, in dependency order.
4. Present the **derived sections** — Behavior, Failure Model, Traceability — one batch per section.
5. Run the self-checks.
6. Write `design.md` with `status: draft` — the first and only write. Present a recap per pairing rule 18 and ask the user to validate. Apply changes to the file until approved, then set `status: validated`.

### Decision gate

Run this gate before you write any design element, so the user shapes the design instead of reviewing it after the fact.

1. Collect every design-owned `Q-*` and every consequential technical choice you can already see: architecture shape, technology or library selection, data model direction, integration approach. For a greenfield repository with no evident implementation language, the language is a decision here.
2. For each, present two or three realistic options with trade-offs and recommend one. Ask one decision at a time.
3. Always ask for decisions involving product scope, public compatibility, security policy, cost (a paid service or material recurring cost), or irreversible data behavior.
4. Apply each decision directly in the design sections. A consequential choice that only becomes visible later returns to this gate before it is baked into the design.

### Architecture step

1. Propose one simple component diagram and, under it, the architectural flow in a few lines: how a request or event moves through the components. Name each component by the responsibility it owns; when a later element gives it a proper name (an interface it implements, functions it owns), rename it to match.
2. This is one review turn: the user accepts, edits, or counters, under the same response rules as the pairing loop.
3. The diagram is the map for the rest of the phase. Every model, interface, function owner, and contract belongs to one component. An element that fits no component returns here to change the diagram first.

### Pairing loop

The unit of work is one complete element: a whole model, a whole interface or class with every member signature, or a whole external contract. Never present an element member by member. You drive; the user navigates.

1. Walk the components in dependency order. Within a component, propose elements in dependency order: a type before the interface that uses it, an interface before the functions that take it.
2. Propose each element as one code block in the repository language, complete: all type fields, all member signatures with parameter types, return types, and raised or returned errors. Never write a function body. After the code block, give one line on why it has this shape and, if you have one, one open question. The presentation follows facilitation rule 19 (one screen).
3. A **weighty element** gets its own turn: an external contract, a new abstraction, a persistent model, or any element that applies a decision from the gate. Wait for the user's response before you propose the next element.
4. A component's remaining minor elements — helper signatures, internal types — go in one batch per component. Present the batch concisely and list the entries that come from your inference for confirmation (facilitation rule 16).
5. The user answers with one of: accept, edit (a changed version), counter (a different shape), or "you decide". Treat an edit or a counter as the new proposal: apply challenge duty once (rule 10), then record the result. "You decide" is an explicit delegation; record it.
6. Record the agreed element in the working draft, in conversation, before you propose the next one.
7. When the user proposes an element before you do, critique it by the same rules and record the result.
8. When an element would need a decision that belongs to the gate, return to the gate first.

### Derived sections

Present Behavior, Failure Model, and Traceability one batch per section: the complete section as a short summary, with the entries that come from your inference listed for confirmation (rule 16). One batch per turn; apply the user's corrections before the next section.

## Section rules

- **Architecture.** One simple diagram plus the architectural flow. Name components by the interface they implement or the functions they own. Exit codes only for command-line interfaces.
- **Models.** Types and records the design introduces or changes, as code. Each field has a type; a constraint that the type cannot express is a one-line invariant under the block.
- **Interfaces.** Abstractions as code: interface, protocol, trait, or abstract class, with member signatures. One line after the block names what the abstraction is deliberately not responsible for.
- **Functions.** Signatures grouped by owner (module, class, or component). Each signature has one line stating its effect and its error behavior. A function references only models and interfaces in this design or already in the repository.
- **Contracts.** Externally shared schemas, formats, and interfaces. A contract has exactly one writer, a version, and invariants.
- **Behavior.** Important flows and state transitions, naming the functions they call in order. Write ordering and sudden-stop recovery only where related persistent writes exist.
- **Failure Model.** Failures relevant to this system, with detector, response, and observable verification. Do not invent optional dependencies, corruption paths, or persistence failures for systems that do not have them.
- **Traceability.** Every `FR-*` and `NFR-*` maps to design elements. A design element with no requirement or existing repository constraint is scope creep.
- Consider security (authorization, malicious input), privacy (personal data, retention, deletion), and operability (monitoring, configuration, deployment). Add a contract, failure entry, or behavior where one applies; do not write "not applicable" entries.

## Self-checks

Before validation, make sure that:

- Every `FR-*` and `NFR-*` has a traceability entry, and no `FR-D*` remains.
- Every design-owned `Q-*` was decided at the gate, and no user-owned question remains open.
- The architecture, every weighty element, every component batch, and every derived-section batch received a user response.
- Every model, interface, function owner, and contract belongs to one component in the architecture diagram.
- Every function signature references only designed or existing types; every interface has at least one designed implementer or consumer; no code block contains a function body.
- Every contract has one writer, a version, and invariants.
- Every failure has an observable verification.
- Technology and repository choices are existing constraints or decisions from the gate.
