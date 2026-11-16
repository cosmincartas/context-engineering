# Framed Ledger

The ledger tracks each design category of a specification from open to reviewed.
Keep the categories in this order.

## Categories

| Category | Required treatment | User action |
|---|---|---|
| Requirements | Included FRs and NFRs, each with its source and a concrete oracle; each `DoD-*` mapped | Approval |
| Technology Stack | Languages, frameworks, runtimes, data stores, key libraries, and verification facilities used for the implementation | Review |
| UI | Screens, controls, states, inputs, and linked requirements | Approval when applicable |
| Architecture (HLD) | Components, ownership, boundaries, decisions, and flow | Approval |
| Models | Required data structures and invariants | Review |
| Contracts | Shared formats, producers, consumers, and compatibility | Review |
| Functions | Entry points, effects, and error behavior | Review |
| Interfaces or Classes | Required signatures, responsibilities, and boundaries | Review |
| Behavior | Important flows and state transitions | Review |
| Failure Model | Relevant failures, detection, response, test trigger, and verification | Review |
| Traceability | Included requirements and `DoD-*` items mapped to design, verification, and verification level | Review |

## Row status

Each ledger row records its status, decision or section reference, and any unresolved issue.
Use `open`, `drafted`, `approved`, or `not applicable`. Explain each `not applicable` decision.
Use `approved` for Requirements, UI, and HLD only after direct approval, recorded quickie delegation, or the provided-rows rule below.
Do not mark a category drafted or approved merely because it was discussed.
Requirements, UI, and HLD require direct or delegated approval before dependent work. Other applicable categories remain drafted until final review or delegated validation.
Do not create classes, models, or contracts merely to fill a category.

## Provided rows

A slice file (`artifact: slice`, written by the `slice` skill) provides the Requirements row, the Technology Stack row, and the seam contracts of the Contracts row.
A row is provided only when the overview of the slice file has a current approval record for its gate: Scope for Requirements, HLD for Technology Stack, Slices for seam contracts. A heading in the slice file is not approval.
In the specification, record a provided Requirements row as `approved` and a provided Technology Stack row as `drafted`. Refer to the slice file and to the overview approval record.
Do not draft, review at a gate, or change provided content. The Contracts row stays open for the contracts inside the slice.
For provided requirements, the overview owns the `DoD-*` mapping. Do not rewrite provided requirement lines to match the oracle rules. Draft the verification level and the Traceability of the slice as usual.

## Requirements rules

These rules define the content of the Requirements row. The invoking skill owns the gate that approves it.

- Convert user stories into checkable behaviors. Preserve each story's source and identify inferred acceptance conditions.
- Present supplied requirements separately from inferred requirements. Group inferred requirements as **Recommended mandatory** and **Optional**. Each group can be empty.
- Explain why each inferred requirement is necessary or useful. State the consequence of excluding it. "Recommended mandatory" is a recommendation, not permission to add scope.
- Give each requirement a stable `FR-*` or `NFR-*` identifier. Preserve supplied identifiers when possible.
- Record one observable behavior per FR. Include related edge cases without hiding separate behaviors inside verification.
- For each requirement, record its statement, source, recommendation when inferred, selection status, and observable verification.
- Write each FR verification as a concrete oracle: **Given** a precondition with example values, **When** one action, **Then** an exact observable result, such as a value, an output, a state, or an error. Do not use "works", "correctly", "succeeds", "handles", or "as expected" as the result.
- Write each NFR verification as a measurement method, its conditions, and the approved limit, or as a binary check.
- Map each `DoD-*` item of the intent to one or more included requirements. A `human` item can map to a human review instead. State the review criterion.
- A `checkable` `DoD-*` item without an included requirement is a scope gap. Present it as a concern before scope approval. Never mark it `human` to close the gap.
- When the intent has no `DoD-*` identifiers, derive them from its Definition of done or its outcome. Label them derived in the specification. Keep the intent file unchanged.
- Selection states are `proposed`, `included`, `excluded`, and `deferred`. Only included requirements bind the design. Preserve excluded and deferred proposals outside the approved requirements lists.
- Consider performance, capacity, security, privacy, availability, recovery, compliance, accessibility, and observability when proposing NFRs.
- Use measurable limits or binary checks. Do not invent numeric thresholds; ask the user to approve unsupported candidate limits.
- Do not invent legal obligations. Cite applicable evidence and distinguish obligations from recommendations.
- If exclusion conflicts with an established obligation or makes the outcome impossible, explain the conflict and request a scope decision. Never silently remove the concern or include the rejected requirement.

## Architecture rules

These rules define the content of the Architecture (HLD) row. The invoking skill owns the gate that approves it.

- Draft one Mermaid component diagram and explain each component's responsibility.
- Mark components as unchanged, modified, new, or removed. Cite existing entry points where available.
- Explain trigger-to-outcome flow, data ownership, interfaces, and trust boundaries.
- Include deployment, compatibility, cost, and recovery decisions when they affect this system.
- Record consequential choices, evidence, assumptions, and trade-offs. Preserve explicit user choices unless an approved correction changes them.
- Reuse existing code, standard libraries, native features, and installed dependencies before proposing new abstractions or dependencies.
- Justify each new dependency or abstraction with an included requirement and an unmet present need.

## Drafting rules

Draft Technology Stack before UI review. Requirements, UI, and HLD follow their review gates in the invoking skill. Draft the other categories after HLD approval.

- **Technology Stack:** Record the languages, frameworks, runtimes, data stores, and key libraries the implementation uses, with versions. Cite repository evidence such as manifest or lock files. Mark each entry existing or new. Justify each new entry at the HLD gate.
- **Verification facilities:** In the Technology Stack, record each tool and command that verification of this scope needs: typecheck, lint, build, unit and integration tests, contract checks, e2e, visual comparison, and evidence capture for `human` items. Cite the source of each existing command, such as a manifest script, a Makefile target, or CI configuration. A missing facility that a verification level needs is a new entry. Justify it at the HLD gate like other new technology.
- **Models:** Specify required fields, types, ownership, and invariants. Omit incidental private representations.
- **Contracts:** Specify producers, consumers, validation, compatibility, and versioning when applicable. Cite existing definitions instead of duplicating them.
- **Functions:** Describe existing entry points or required responsibilities, inputs, effects, outputs, and errors.
- **Interfaces or Classes:** Specify signatures where correctness or coordination requires them. Do not mandate class-based design.
- **Behavior:** Describe preconditions, ordered interactions, transitions, and observable results. Include interruption recovery when persistent writes require it.
- **Failure Model:** Record relevant failures, detectors, responses, and observable checks. Cover applicable trust-boundary validation and data-loss risks. For each failure, name a trigger that a test can produce every time: an input, a fake collaborator, or an injection point. When no such trigger exists, record the failure as not testable and give the reason.
- **Traceability:** Map every included FR and NFR to design elements, verification, and one verification level: `unit`, `integration`, `contract`, `e2e`, `visual`, or `human`. Use the lowest level that can observe the oracle. Each level must have a facility in the Technology Stack. Map every `DoD-*` item to its requirements or to its human review. Link UI entries when applicable.

Use repository-language signatures when exact syntax matters. Replace executable logic with `...`.
Leave private decomposition to implementation unless an approved constraint requires it.
Do not invent design elements without an included requirement or an established repository constraint.
