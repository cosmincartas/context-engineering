# Phase 2 — Design

Turn the validated intent into a validated specification: requirements and technical design in one artifact. This phase runs even when the user already knows what they want. Preserve existing interfaces, constraints, conventions, and verification seams.

## Input contract

1. Require `docs/agentic-engineering/<subject>/intent.md` with `artifact: intent` and `status: validated`. If it is a draft, return to phase 1.
2. Preserve Initial Request when present. Accept older validated intent artifacts that omit this section.
3. Preserve the intent's Problem, Proposed outcome, Affected users, and Constraints. Do not silently reopen settled context. Treat Open Questions as input to the requirements gate.
4. Re-inspect repository facts that requirements and design depend on: implementation language, existing types and interfaces, and naming conventions. If material repository drift contradicts the intent, show the evidence and ask before you continue.

An `explore` artifact is supporting evidence, not approval of scope or a decision to build.

## Artifact

Create the draft `docs/agentic-engineering/<subject>/spec.md` from `assets/spec-template.md` once at first final-validation presentation. Apply requested corrections in place. Set `status: validated` only after approval.

## Spec invariant

The spec must cover one deliverable that can ship independently.

## Workflow

Run the gates in this order: requirements, UI when the slice adds or changes UI, HLD, and final validation.

1. Draft scope, Functional Requirements, and Non-Functional Requirements in conversation. Apply the requirements rules, then run the **requirements gate**.
2. When the approved scope adds or changes UI, draft `UI-*` entries and `ui.html`, then run the **UI gate**. Otherwise skip the UI gate, omit the User Interface section, and do not create, modify, or delete `ui.html`.
3. Draft key architecture decisions and the explained HLD, then run the **HLD gate**.
4. After HLD approval, autonomously complete only the applicable remaining sections. Resolve reversible details from repository evidence and the approved HLD. Ask only questions that block validation or reveal an HLD change.
5. If a late discovery changes the HLD, reopen only the HLD gate. Resume autonomous drafting after approval.
6. Run the self-checks.
7. Write `spec.md` with `status: draft`. Present a final recap and ask the user to validate.
8. Apply requested changes to the complete spec.
9. If a final-validation correction changes architecture, reopen only the HLD gate.
10. After that HLD approval, resume autonomous drafting, rerun self-checks, and return to final validation.
11. For other corrections, rerun self-checks and ask for validation again until the user approves.
12. Set `status: validated` only after approval.

### Requirements gate

1. Infer the main flow from the intent in at most five lines: actor, trigger, and outcome.
2. Collect every point where the flow can widen. Include variants such as one provider or several, optional behaviors, extra actors, extra surfaces, and scope-changing Open Questions.
3. For each widening point, offer the narrow option and wider options, recommend one, and record declined options under Parked.
4. Draft each distinct functional behavior with its verification and each applicable non-functional requirement with its measurable or binary verification.
5. Present the scope, FR list, NFR list, Parked list, inferred entries with sources, conflicts, and the independent-deliverable invariant together.
6. Ask the user to approve the complete requirements gate.
7. If the user edits or counters, apply corrections and repeat this same combined gate until approved.
8. Continue only after approval.

### UI gate

1. Draft one `UI-*` entry for each screen, widget, or dialog in scope. Each entry has an HTML mock, one-line states, and an input map.
2. Capture the exact `ui.html` contents and existence state exactly once before the first UI write. Retain the original snapshot across every UI-gate rerun.
3. After requirements approval, synchronize each affected FR's UI references with each created or changed `UI-*` entry.
4. Write every mock into `docs/agentic-engineering/<subject>/ui.html`. Give each entry one section anchored by its identifier and one block per state. Use inline CSS only: no scripts or external resources. `ui.html` is a supporting file of the spec, not a status-bearing artifact; edit it in place during this gate.
5. Probe empty, loading, error, and narrow states the mock does not show.
6. Present the file path, entries, states, input maps, and affected FR UI references. Ask the user to accept, edit, or counter the complete UI gate.
7. If accepted, proceed directly to the HLD gate.
8. After an edit or counter, apply corrections to `ui.html`, the entries, and affected FR UI references.
9. If corrections change scope, an FR, or an NFR, rerun the requirements gate.
10. After requirements approval, rerun the UI gate only while UI remains in approved scope.
11. If approved revised scope removes UI, omit the User Interface section and remove all UI references from FRs.
12. In that case, restore `ui.html` exactly from the retained original snapshot, including its existence state.
13. After corrections or removal, proceed directly to the HLD gate.

### FR rules

Define a distinct behavior by its actor, trigger, observable outcome, or independent acceptance decision.
Give each distinct behavior one FR. Keep one checkable behavior per FR. Never merge distinct behaviors.
Fold only edge cases, variants, and failure paths of the same behavior into its Verification field. Never hide a separate behavior in Verification.
When a `UI-*` entry exists, cite it in each FR that renders or reacts to it.
Record a behavior that leaves scope under Parked before the requirements gate.

### NFR rules

Consider candidates from every category: performance, capacity, security, privacy, availability and recovery, compliance, accessibility, and observability.
Infer candidates from the validated intent, user statements, and repository evidence.
Never drop a legal, security, privacy, accessibility, or data-loss obligation.

### Requirements challenge

- Collect every requirement inferred rather than received into one list with sources.
- Name each kept scope answer that has no FR.
- Where a requirement can be strict or lenient, present both options and recommend one.
- Name requirement conflicts and overlaps instead of resolving them silently.
- Collect every inferred NFR and every numeric limit without user or repository provenance into the same list.

### HLD gate

1. Collect every known decision that can change the HLD.
2. Include component boundaries, data ownership, integrations, contracts, trust boundaries, deployment, public compatibility, material cost, and irreversible data behavior.
3. Separate repository constraints, user decisions, reversible defaults, and policy concerns.
4. Apply the phase 2 Oracle invariant before each consequential decision.
5. For each user decision, offer two or three realistic options with trade-offs and recommend one.
6. Draft the recommended decisions and one simple Mermaid component diagram.
7. Add concise responsibilities, architectural flow, and important assumptions.
8. Present decisions first, with sources, strongest alternatives, and trade-offs. Present the explained HLD next, then list concerns.
9. Ask the user to accept, edit, or counter the complete HLD gate.
10. Apply the response to both decisions and HLD. Repeat this gate until the user approves them together.
11. Use the approved decisions and HLD as the map for every later design element. Preserve both in the Architecture section.

### Autopilot

1. Select reversible technical details from repository evidence and the approved HLD.
2. Complete only applicable sections 5 through 12 in dependency order. Preserve each section's fixed number when included; omit empty sections.
3. Include inferred entries, assumptions, and non-blocking concerns in the final recap.
4. Ask a question only when an unresolved unknown blocks validation or a discovery changes the HLD.
5. When a discovery changes the HLD, reopen only the HLD gate, apply its approval, and resume autopilot.

## Section rules

- Use stable `UI-*`, `FR-*`, and `NFR-*` identifiers. One checkable behavior per entry. Requirements use "must". Sections 1–3 are ID-keyed lists, never tables.
- **User Interface.** One entry per screen, widget, or dialog: a link to its anchor in `ui.html`, its states, and its input map. Include the section only when the approved scope adds or changes UI. For non-UI work, skip the UI gate and do not create, modify, or delete `ui.html`.
- Include sections 5 through 12 only when applicable. Keep their fixed section numbers when included; omit empty sections without renumbering later sections.
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
- No FR cites a `UI-*` entry that does not exist. Every `UI-*` entry has an anchor in `ui.html`.
- For each `UI-*` entry, verify every affected FR references it.
- For each FR UI reference, verify its `UI-*` entry exists and affects that FR.
- The NFR list keeps every legal, security, privacy, accessibility, and data-loss obligation.
- Every FR and NFR has an observable verification and a source, and every NFR is measurable or binary.
- Every NFR numeric limit has user or repository provenance.
- No unresolved unknown remains.
- Each requirements-gate run receives one combined user response for scope, FRs, and NFRs.
- When UI remains in scope, the UI gate followed the requirements gate and received a user response.
- When UI remains in scope, the User Interface section exists, and the user reviewed each entry.
- When UI is not in scope from the start, the UI gate was skipped.
- When UI is not in scope from the start, the section was omitted.
- When UI is not in scope from the start, `ui.html` was not created, modified, or deleted.
- If revised scope removes UI, the User Interface section was omitted, and `ui.html` matches its exact pre-gate state.
- If UI corrections changed requirements, the requirements gate ran again.
- Each HLD-gate run receives combined approval for architecture decisions and the explained HLD.
- Every later design element fits the approved HLD.
- Every late discovery that changes the HLD reopens only the HLD gate before drafting resumes.
- Every final-validation correction that changes architecture reopens only the HLD gate before validation resumes.
- Only applicable sections 5 through 12 appear, with fixed numbers and no renumbering.
- Every model, interface, function owner, and contract belongs to one component in the architecture diagram.
- Every function signature references only designed or existing types. Every interface has a designed implementer or consumer. No code block contains executable logic.
- Every contract has one writer, a version, and invariants.
- Every failure has an observable verification.
- Technology and repository choices are existing constraints or decisions recorded in the approved HLD.
- After HLD approval, applicable remaining sections were drafted without routine approval questions.
- The draft spec was written before final user validation, and validated status followed that validation.
- Each validation response was applied to the complete spec before the self-checks ran again.
