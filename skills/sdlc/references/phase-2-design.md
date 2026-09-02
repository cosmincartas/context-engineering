# Phase 2 — Design

Turn the validated intent into a validated specification: requirements and technical design in one artifact. This phase runs even when the user already knows what they want. Preserve existing interfaces, constraints, conventions, and verification seams.

## Input contract

1. Require `docs/agentic-engineering/<subject>/intent.md` with `artifact: intent` and `status: validated`. If it is a draft, return to phase 1.
2. Preserve the intent's Scope and Confirmed Understanding. Do not silently reopen settled context.
3. Re-inspect repository facts that requirements and design depend on: implementation language, existing types and interfaces, and naming conventions. If material repository drift contradicts the intent, show the evidence and ask before you continue.

An `explore` artifact is supporting evidence, not approval of scope or a decision to build.

## Artifact

`docs/agentic-engineering/<subject>/spec.md` from `assets/spec-template.md`, written once at the end of the phase.

## Spec invariant

The spec must cover one deliverable that can ship independently.

## Workflow

Each stop presents one section. Never combine two stops into one presentation.

1. Run the **UI stop** when the slice has a user-facing surface. Otherwise omit the User Interface section.
2. Draft Functional Requirements with verifications in conversation. Apply the FR rules, then run the **FR stop**.
3. Draft Non-Functional Requirements in conversation. Apply the NFR rules, then run the **NFR stop**.
4. Run the **HLD step**.
5. Run the **mode selection gate** after HLD approval.
6. Run the selected mode workflow.
7. Run the self-checks.
8. Write `spec.md` with `status: draft` — the first and only write. Present a recap per pairing rule 18 and ask the user to validate. Apply changes to the file until approved, then set `status: validated`.

### UI stop

1. Draft one `UI-*` entry for each screen, widget, or dialog in scope. Each entry has a text mock in a fenced block, its states one line each, and its input map.
2. Present the entries. Ask the user to accept, edit, or counter each one.
3. Probe the empty, loading, error, and narrow states the mock does not show.
4. Apply the answers before you draft requirements.

### FR rules

Define a distinct behavior by its actor, trigger, observable outcome, or independent acceptance decision.
Give each distinct behavior one FR. Keep one checkable behavior per FR. Never merge distinct behaviors.
Fold only edge cases, variants, and failure paths of the same behavior into its Verification field. Never hide a separate behavior in Verification.
When a `UI-*` entry exists, cite it in each FR that renders or reacts to it.
Park behaviors that leave scope before the FR stop.

### Scope revision

Run this process when a parked requirement changes scope.

1. Announce the scope revision.
2. Follow the staleness process and warn about downstream staleness.
3. Update the intent's Scope and Parked sections. Send every parked requirement to the intent's Parked section.
4. Revalidate the revised intent.
5. Refresh the spec intent hash before continuing.

### FR stop

Present the FR list.

Confirm the spec invariant: one deliverable that can ship independently.

Challenge the requirements:

- Collect every requirement you inferred rather than received into one list with sources, and confirm it in a single round per rule 16.
- Name each in-scope item of the intent that has no FR.
- Where a requirement can be strict or lenient, present both as options and recommend one.
- Name requirement conflicts and overlaps instead of resolving them silently.

### NFR rules

Consider candidates from every category: performance, capacity, security, privacy, availability and recovery, compliance, accessibility, and observability.
Infer candidates from the validated intent, user statements, and repository evidence.
Never drop a legal, security, privacy, accessibility, or data-loss obligation.

### NFR stop

Present the NFR list.

Challenge the requirements:

- Collect every NFR you inferred and every numeric limit without user or repository provenance into one list with sources, and confirm it in a single round per rule 16.
- Where an NFR can be strict or lenient, present both as options and recommend one.

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

1. Collect every consequential technical choice. Include technology, data model, and integration choices.
2. Present two or three realistic options with trade-offs. Recommend one and ask one subject at a time per rule 4.
3. Always ask for decisions involving product scope, public compatibility, security policy, material cost, or irreversible data behavior.
4. Apply each decision directly to the design. Return here when a consequential choice appears later.
5. Return to the HLD step when a decision changes the approved architecture.

#### Pairing loop

Use one complete element as the review unit. An element is one model, interface, class, external contract, or function-owner signature batch.

1. Walk components in dependency order. Present each component's elements in dependency order.
2. Present each element as an implementation-shaped skeleton in the repository language. Preserve concrete owners, framework metadata, dependency wiring, fields, signatures, types, and errors. Keep structural bodies that show required wiring. Replace executable logic with `...`.
3. Explain the shape in one line. Add one open question when necessary.
4. Give each weighty element its own turn. Weighty elements include external contracts, new abstractions, persistent models, and gated decisions.
5. Batch a component's minor elements. List inferred entries for confirmation.
6. Ask for the response through `AskUserQuestion` with accept, counter, and `you decide` as options. Edits arrive through Other. Apply challenge duty once to edits and counters.
7. Record each agreed element before you continue.
8. Return to the decision gate when an element needs a consequential decision.

#### Derived sections

Present Behavior, Failure Model, and Traceability as one batch per section. List inferred entries for confirmation. Apply corrections before continuing.

### Proposal mode

1. Collect every consequential choice that is not safely reversible. Include scope, compatibility, security policy, material cost, and irreversible data behavior.
2. Ask one subject at a time per rule 4. Give two or three realistic options, trade-offs, and one recommendation.
3. Select the remaining reversible technical details. Record each selection, its strongest alternative, and the trade-off.
4. Complete Models, Interfaces, Functions, Contracts, Behavior, Failure Model, and Traceability without intermediate reviews.
5. At validation, recap the complete proposal, consequential choices, assumptions, and inferred entries.

## Section rules

- Use stable `UI-*`, `FR-*`, and `NFR-*` identifiers. One checkable behavior per entry. Requirements use "must". Sections 1–3 are ID-keyed lists, never tables.
- **User Interface.** One entry per screen, widget, or dialog: a text mock in a fenced block, its states, and its input map. Omit the section when the slice has no user-facing surface.
- Each NFR has a number, limit, or binary check. Do not disguise a feature as a quality requirement. Consider each category: performance, capacity, security, privacy, availability and recovery, compliance, accessibility, observability. Add an NFR or omit the category; do not write "not applicable" entries.
- Each Verification field states an observable action and result, never "code written".
- A requirement that relies on an unverified assumption names it in Source. A choice the user delegated with `you decide` names the delegation in Source.
- An unknown the user cannot resolve blocks validation. Record the unknown and its consequence in the recap; do not write a dependent entry as confirmed.
- **Architecture.** Preserve the approved HLD Mermaid diagram, responsibilities, flow, and assumptions. Name components by their implemented interfaces or owned functions. Use exit codes only for command-line interfaces.
- **Models.** Types and records the design introduces or changes, as code. Each field has a type; a constraint that the type cannot express is a one-line invariant under the block.
- **Interfaces.** Abstractions as code: interface, protocol, trait, or abstract class, with member signatures. One line after the block names what the abstraction is deliberately not responsible for.
- **Functions.** Show each concrete owner as an implementation-shaped skeleton. Include framework metadata, dependency wiring, and method signatures where relevant. Keep structural bodies that show required wiring. Replace executable logic with `...`. Each method has one line stating its effect and error behavior.
- **Contracts.** Externally shared schemas, formats, and interfaces. A contract has exactly one writer, a version, and invariants.
- **Behavior.** Important flows and state transitions, naming the functions they call in order. Write ordering and sudden-stop recovery only where related persistent writes exist.
- **Failure Model.** Failures relevant to this system, with detector, response, and observable verification. Do not invent optional dependencies, corruption paths, or persistence failures for systems that do not have them.
- **Traceability.** Every `FR-*` and `NFR-*` maps to design elements, and to its `UI-*` entry when one exists. A design element with no requirement or existing repository constraint is scope creep.
- Consider security (authorization, malicious input), privacy (personal data, retention, deletion), and operability (monitoring, configuration, deployment). Add a contract, failure entry, or behavior where one applies; do not write "not applicable" entries.

## Self-checks

Before validation, make sure that:

- Every in-scope item of the intent has at least one FR, and the spec covers one deliverable that can ship independently.
- Each distinct functional behavior has its own FR, defined by actor, trigger, observable outcome, or independent acceptance decision. No FR hides a separate behavior in Verification.
- No FR cites a `UI-*` entry that does not exist. When the slice has a user-facing surface, the User Interface section exists and the user reviewed each entry.
- The NFR list keeps every legal, security, privacy, accessibility, and data-loss obligation.
- Every FR and NFR has an observable verification and a source, and every NFR is measurable or binary.
- Every NFR numeric limit has user or repository provenance.
- No unresolved unknown remains.
- Every stop before the HLD received a user response. The user approved the HLD and selected a mode.
- In pair mode, every weighty element, component batch, and derived-section batch received a user response.
- In proposal mode, the user decided every non-reversible choice. No remaining section received a partial review.
- In proposal mode, the validation recap lists reversible choices, assumptions, and inferred entries.
- Every model, interface, function owner, and contract belongs to one component in the architecture diagram.
- Every function signature references only designed or existing types. Every interface has a designed implementer or consumer. No code block contains executable logic.
- Every contract has one writer, a version, and invariants.
- Every failure has an observable verification.
- Technology and repository choices are existing constraints or decisions from the selected mode.
