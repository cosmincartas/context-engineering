# Phase 3 — Design

Turn the validated PRD into a validated technical design. Preserve existing interfaces, constraints, conventions, and verification seams. Review a high-level design (HLD) first. Then let the user select pair mode or proposal mode.

## Input contract

1. Require `docs/agentic-engineering/<subject>/prd.md` with `artifact: prd` and `status: validated`. If it is a draft, return to phase 2.
2. Collect every `FR-*`, `NFR-*`, and owned `Q-*`. Stop on unresolved user-owned questions. Resolve design-owned questions in the selected mode.
3. Re-inspect relevant repository evidence: implementation language, existing types and interfaces, and naming conventions. Show material drift and ask before design work.

Complete these checks before the first design interaction. If no check blocks progress, present the HLD first.

If design work exposes a new product requirement, give it a provisional `FR-D*` identifier. Ask the user to revise the PRD. Do not validate the design while an `FR-D*` remains.

## Artifact

`docs/agentic-engineering/<subject>/design.md` from `assets/design-spec-template.md`, written once at the end of the phase.

## Workflow

1. Run the **HLD step**.
2. Run the **mode selection gate** after HLD approval.
3. Run the selected mode workflow.
4. Run the self-checks.
5. Write `design.md` with `status: draft` as the first write. Present the validation recap and ask for approval. Apply requested changes until approval, then set `status: validated`.

### HLD step

1. Propose one simple component diagram as a Mermaid diagram in a ```mermaid block. Add concise component responsibilities, architectural flow, and important assumptions.
2. Ask the user to accept, edit, or counter the HLD. Do not continue without approval.
3. Use the approved HLD as the map for every later design element. Preserve it in the final Architecture section.
4. Return here when a later decision changes the HLD or an element fits no component.

### Mode selection gate

Offer these choices after HLD approval:

- **Pair mode:** Review decisions and complete design elements one at a time.
- **Proposal mode:** Draft all remaining sections, then present the complete proposal for validation.

Ask the user to select one mode. Record the selection in the working draft.

### Pair mode

1. Run the **decision gate**.
2. Run the **pairing loop** over HLD components in dependency order.
3. Present Behavior, Failure Model, and Traceability as separate derived-section batches.

#### Decision gate

1. Collect every design-owned `Q-*` and every consequential technical choice. Include technology, data model, and integration choices.
2. Present two or three realistic options with trade-offs. Recommend one and ask one decision at a time.
3. Always ask for decisions involving product scope, public compatibility, security policy, material cost, or irreversible data behavior.
4. Apply each decision directly to the design. Return here when a consequential choice appears later.
5. Return to the HLD step when a decision changes the approved architecture.

#### Pairing loop

Use one complete element as the review unit. An element is one model, interface, class, external contract, or function-owner signature batch.

1. Walk components in dependency order. Present each component's elements in dependency order.
2. Present each element as one complete code block in the repository language. Include fields, signatures, types, and errors. Never write a function body.
3. Explain the shape in one line. Add one open question when necessary.
4. Give each weighty element its own turn. Weighty elements include external contracts, new abstractions, persistent models, and gated decisions.
5. Batch a component's minor elements. List inferred entries for confirmation.
6. Accept these responses: accept, edit, counter, or `you decide`. Apply challenge duty once to edits and counters.
7. Record each agreed element before you continue.
8. Return to the decision gate when an element needs a consequential decision.

#### Derived sections

Present Behavior, Failure Model, and Traceability as one batch per section. List inferred entries for confirmation. Apply corrections before continuing.

### Proposal mode

1. Collect every consequential choice that is not safely reversible. Include scope, compatibility, security policy, material cost, and irreversible data behavior.
2. Ask one decision at a time. Give two or three realistic options, trade-offs, and one recommendation.
3. Select the remaining reversible technical details. Record each selection, its strongest alternative, and the trade-off.
4. Complete Models, Interfaces, Functions, Contracts, Behavior, Failure Model, and Traceability without intermediate reviews.
5. At validation, recap the complete proposal, consequential choices, assumptions, and inferred entries.

## Section rules

- **Architecture.** Preserve the approved HLD Mermaid diagram, responsibilities, flow, and assumptions. Name components by their implemented interfaces or owned functions. Use exit codes only for command-line interfaces.
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
- Every design-owned `Q-*` has a user decision or a recorded proposal-mode selection. No user-owned question remains open.
- The user approved the HLD and selected a mode.
- In pair mode, every weighty element, component batch, and derived-section batch received a user response.
- In proposal mode, the user decided every non-reversible choice. No remaining section received a partial review.
- In proposal mode, the validation recap lists reversible choices, assumptions, and inferred entries.
- Every model, interface, function owner, and contract belongs to one component in the architecture diagram.
- Every function signature references only designed or existing types; every interface has at least one designed implementer or consumer; no code block contains a function body.
- Every contract has one writer, a version, and invariants.
- Every failure has an observable verification.
- Technology and repository choices are existing constraints or decisions from the selected mode.
