# Phase 2 — Design

Turn the validated intent into a validated specification: requirements and technical design in one artifact. This phase runs even when the user already knows what they want. Preserve existing interfaces, constraints, conventions, and verification seams.

## Input contract

1. Require `docs/agentic-engineering/<subject>/intent.md` with `artifact: intent` and `status: validated`. If it is a draft, return to phase 1.
2. Preserve the intent's Problem, Proposed outcome, Affected users, and Constraints. Do not silently reopen settled context. Treat Open Questions as input to the scope stop.
3. Re-inspect repository facts that requirements and design depend on: implementation language, existing types and interfaces, and naming conventions. If material repository drift contradicts the intent, show the evidence and ask before you continue.

An `explore` artifact is supporting evidence, not approval of scope or a decision to build.

## Artifact

`docs/agentic-engineering/<subject>/spec.md` from `assets/spec-template.md`, written once at the end of the phase.

## Spec invariant

The spec must cover one deliverable that can ship independently.

## Workflow

Each stop presents one section. Never combine two stops into one presentation.

1. Run the **scope stop**.
2. Run the **UI stop** when the slice has a user-facing surface. Otherwise omit the User Interface section.
3. Draft Functional Requirements with verifications in conversation. Apply the FR rules, then run the **FR stop**.
4. Draft Non-Functional Requirements in conversation. Apply the NFR rules, then run the **NFR stop**.
5. Run the **architecture proposal stop**.
6. Run the **mode selection gate** after architecture proposal approval.
7. Run the selected mode workflow.
8. Run the self-checks.
9. Write `spec.md` with `status: draft` — the first and only write. Present a recap per pairing rule 18 and ask the user to validate. Apply changes to the file until approved, then set `status: validated`.

### Scope stop

1. Infer the main flow from the intent in at most five lines: actor, trigger, and outcome.
2. Collect every point where the flow can widen: variants such as one provider or several, optional behaviors, extra actors, extra surfaces, and Open Questions that change scope.
3. Ask one batch per subject per rule 4. For each point, offer the narrow option and the wider options, and recommend one.
4. Record each declined wider option under Parked, one line. Record each kept answer as a scope fact for the FR draft.
5. Repeat steps 2 to 4 until the flow has one independently verifiable outcome and no widening point is unanswered.
6. Present the narrowed flow and the Parked list. Ask the user to approve.

### UI stop

1. Draft one `UI-*` entry for each screen, widget, or dialog in scope. Each entry has an HTML mock, its states one line each, and its input map.
2. Write every mock into one static file, `docs/agentic-engineering/<subject>/ui.html`. Give each entry one section anchored by its identifier and one block per state. Use inline CSS only: no scripts, no external resources. `ui.html` is a supporting file of the spec, not a status-bearing artifact; edit it in place during this stop.
3. Report the file path so the user can open it in a browser. Present each entry's states and input map in chat. Ask the user to accept, edit, or counter each entry.
4. Probe the empty, loading, error, and narrow states the mock does not show.
5. Apply the answers to `ui.html` and the entries before you draft requirements.

### FR rules

Define a distinct behavior by its actor, trigger, observable outcome, or independent acceptance decision.
Give each distinct behavior one FR. Keep one checkable behavior per FR. Never merge distinct behaviors.
Fold only edge cases, variants, and failure paths of the same behavior into its Verification field. Never hide a separate behavior in Verification.
When a `UI-*` entry exists, cite it in each FR that renders or reacts to it.
Record a behavior that leaves scope under Parked before the FR stop.

### FR stop

Present the FR list.

Confirm the spec invariant: one deliverable that can ship independently.

Challenge the requirements:

- Collect every requirement you inferred rather than received into one list with sources, and confirm it in a single round per rule 16.
- Name each kept scope answer that has no FR.
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

### Architecture proposal stop

1. Collect every known decision that can change the HLD.
2. Include component boundaries, data ownership, integrations, contracts, trust boundaries, deployment, public compatibility, material cost, and irreversible data behavior.
3. Separate repository constraints, user decisions, reversible defaults, and policy concerns.
4. Apply the phase 2 Oracle invariant before you propose each consequential decision.
5. For each user decision, offer two or three realistic options with trade-offs and recommend one.
6. Draft the recommended decision set and one simple Mermaid component diagram.
7. Add concise responsibilities, architectural flow, and important assumptions.
8. Present decisions first, with sources, strongest alternatives, and trade-offs. Present the resulting HLD next, then list concerns.
9. Ask the user to accept, edit, or counter the complete architecture proposal.
10. Apply the response to both decisions and HLD. Repeat until the user approves them together.
11. Use the approved decisions and HLD as the map for every later design element. Preserve both in the Architecture section.
12. Return here when a later decision changes the HLD or an element fits no component.

### Mode selection gate

Offer these choices after architecture proposal approval:

- **Pair mode:** Review decisions and complete design elements one at a time.
- **Proposal mode:** Draft all remaining sections, then present the complete proposal for validation.

Ask the user to select one mode. Record the selection in the working draft.

### Pair mode

1. Run the **detailed decision gate**.
2. Run the **pairing loop** over HLD components in dependency order.
3. Present Behavior, Failure Model, and Traceability as separate derived-section batches.

#### Detailed decision gate

1. Collect every remaining consequential technical choice that does not change the approved architecture.
2. Present two or three realistic options with trade-offs. Recommend one and ask one subject at a time per rule 4.
3. Always ask for remaining decisions involving public compatibility, security policy, material cost, or irreversible data behavior.
4. Apply each decision directly to the design. Return here when a consequential choice appears later.
5. Return to the architecture proposal stop when a decision changes the approved architecture.

#### Pairing loop

Use one complete element as the review unit. An element is one model, interface, class, external contract, or function-owner signature batch.

1. Walk components in dependency order. Present each component's elements in dependency order.
2. Present each element as an implementation-shaped skeleton in the repository language. Preserve concrete owners, framework metadata, dependency wiring, fields, signatures, types, and errors. Keep structural bodies that show required wiring. Replace executable logic with `...`.
3. Explain the shape in one line. Add one open question when necessary.
4. Give each weighty element its own turn. Weighty elements include external contracts, new abstractions, persistent models, and gated decisions.
5. Batch a component's minor elements. List inferred entries for confirmation.
6. Ask for the response through `AskUserQuestion` with accept, counter, and `you decide` as options. Edits arrive through Other. Apply challenge duty once to edits and counters.
7. Record each agreed element before you continue.
8. Return to the detailed decision gate when an element needs a consequential decision.

#### Derived sections

Present Behavior, Failure Model, and Traceability as one batch per section. List inferred entries for confirmation. Apply corrections before continuing.

### Proposal mode

1. Collect every remaining consequential choice that is not safely reversible and does not change the approved architecture.
2. Ask one subject at a time per rule 4. Give two or three realistic options, trade-offs, and one recommendation.
3. Return to the architecture proposal stop when a choice changes the approved architecture.
4. Select the remaining reversible technical details. Record each selection, its strongest alternative, and the trade-off.
5. Complete Models, Interfaces, Functions, Contracts, Behavior, Failure Model, and Traceability without intermediate reviews.
6. At validation, recap the complete proposal, consequential choices, assumptions, and inferred entries.

## Section rules

- Use stable `UI-*`, `FR-*`, and `NFR-*` identifiers. One checkable behavior per entry. Requirements use "must". Sections 1–3 are ID-keyed lists, never tables.
- **User Interface.** One entry per screen, widget, or dialog: a link to its anchor in `ui.html`, its states, and its input map. Omit the section and the file when the slice has no user-facing surface.
- Each NFR has a number, limit, or binary check. Do not disguise a feature as a quality requirement. Consider each category: performance, capacity, security, privacy, availability and recovery, compliance, accessibility, observability. Add an NFR or omit the category; do not write "not applicable" entries.
- Each Verification field states an observable action and result, never "code written".
- A requirement that relies on an unverified assumption names it in Source. A choice the user delegated with `you decide` names the delegation in Source.
- An unknown the user cannot resolve blocks validation. Record the unknown and its consequence in the recap; do not write a dependent entry as confirmed.
- **Architecture.** Preserve the approved decisions, HLD Mermaid diagram, responsibilities, flow, and assumptions. Name components by their implemented interfaces or owned functions. Use exit codes only for command-line interfaces.
- **Models.** Types and records the design introduces or changes, as code. Each field has a type; a constraint that the type cannot express is a one-line invariant under the block.
- **Interfaces.** Abstractions as code: interface, protocol, trait, or abstract class, with member signatures. One line after the block names what the abstraction is deliberately not responsible for.
- **Functions.** Show each concrete owner as an implementation-shaped skeleton. Include framework metadata, dependency wiring, and method signatures where relevant. Keep structural bodies that show required wiring. Replace executable logic with `...`. Each method has one line stating its effect and error behavior.
- **Contracts.** Externally shared schemas, formats, and interfaces. A contract has exactly one writer, a version, and invariants.
- **Behavior.** Important flows and state transitions, naming the functions they call in order. Write ordering and sudden-stop recovery only where related persistent writes exist.
- **Failure Model.** Failures relevant to this system, with detector, response, and observable verification. Do not invent optional dependencies, corruption paths, or persistence failures for systems that do not have them.
- **Traceability.** Every `FR-*` and `NFR-*` maps to design elements, and to its `UI-*` entry when one exists. A design element with no requirement or existing repository constraint is scope creep.
- **Parked.** One line per declined widening option or behavior that left scope. Each is a candidate subject for a future topic.
- Consider security (authorization, malicious input), privacy (personal data, retention, deletion), and operability (monitoring, configuration, deployment). Add a contract, failure entry, or behavior where one applies; do not write "not applicable" entries.

## Self-checks

Before validation, make sure that:

- Every kept scope answer has at least one FR, every declined option appears in Parked, and the spec covers one deliverable that can ship independently.
- Each distinct functional behavior has its own FR, defined by actor, trigger, observable outcome, or independent acceptance decision. No FR hides a separate behavior in Verification.
- No FR cites a `UI-*` entry that does not exist. Every `UI-*` entry has an anchor in `ui.html`. When the slice has a user-facing surface, the User Interface section exists and the user reviewed each entry.
- The NFR list keeps every legal, security, privacy, accessibility, and data-loss obligation.
- Every FR and NFR has an observable verification and a source, and every NFR is measurable or binary.
- Every NFR numeric limit has user or repository provenance.
- No unresolved unknown remains.
- Every earlier stop received a user response. The user approved the architecture decisions and their resulting HLD together.
- Every later decision fits the approved architecture. A decision that changed the HLD returned to the architecture proposal stop.
- The user selected a mode after architecture proposal approval.
- In pair mode, every weighty element, component batch, and derived-section batch received a user response.
- In proposal mode, the user decided every non-reversible choice. No remaining section received a partial review.
- In proposal mode, the validation recap lists reversible choices, assumptions, and inferred entries.
- Every model, interface, function owner, and contract belongs to one component in the architecture diagram.
- Every function signature references only designed or existing types. Every interface has a designed implementer or consumer. No code block contains executable logic.
- Every contract has one writer, a version, and invariants.
- Every failure has an observable verification.
- Technology and repository choices are existing constraints or decisions from the selected mode.
