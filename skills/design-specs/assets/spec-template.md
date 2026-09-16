---
schema_version: 1
artifact: spec
subject: "{{subject}}"
status: draft
intent: "{{source path or supplied in conversation}}"
intent_sha256: "{{source file SHA-256 or not applicable}}"
repository_baseline: "{{commit or unavailable}}"
language: "{{repository language or not applicable}}"
created: "{{YYYY-MM-DD}}"
updated: "{{YYYY-MM-DD}}"
---

# {{Subject}} Specification

<!-- Use ASD-STE100 Simplified Technical English. Remove template instructions and unused example entries from the completed specification. -->
<!-- Keep all ledger rows. Omit inapplicable design sections and explain each omission in the ledger. -->
<!-- During drafting, leave unresolved sections open. Do not present placeholders or unverified assumptions as approved decisions. -->

## Intent and Delivery Scope

- **Intent:** {{source reference, or supplied intent when no source file exists}}
- **Outcome:** {{approved observable outcome}}
- **Includes:** {{one line per included behavior}}
- **Constraints:** {{explicit constraints and their sources}}

## Functional Requirements

<!-- Include only selected requirements. Preserve supplied identifiers and link user stories to their derived requirements. -->

- **FR-1** — The system must {{one checkable behavior}}.
  - Selection: included
  - Source: {{user statement, story, intent, repository evidence, or labeled inference}}
  - Recommendation: {{Recommended mandatory or Optional; omit for supplied requirements}}
  - Reason: {{reason for an inferred recommendation and consequence of exclusion; otherwise omit}}
  - UI: {{related UI-* identifiers; omit when not applicable}}
  - Verification: {{observable action and expected result}}

## Non-Functional Requirements

<!-- Include only selected requirements. Use approved numeric limits or binary conditions. -->

- **NFR-1** ({{category}}) — The system must {{measurable limit or binary condition}}.
  - Selection: included
  - Source: {{source, including provenance for numeric limits}}
  - Recommendation: {{Recommended mandatory or Optional; omit for supplied requirements}}
  - Reason: {{reason for an inferred recommendation and consequence of exclusion; otherwise omit}}
  - Verification: {{observable action and expected result}}

## Excluded and Deferred Requirements

<!-- Preserve rejected proposals outside the binding requirements lists. Write "None" when this section has no entries. -->

- **{{FR-* or NFR-*}}** — {{proposed requirement}}
  - Selection: {{excluded or deferred}}
  - Source: {{source}}
  - Recommendation: {{Recommended mandatory or Optional; omit for supplied requirements}}
  - Verification: {{proposed observable check}}
  - Decision: {{user decision and reason, when supplied}}
  - Consequence: {{effect of exclusion or deferral}}

## Framed Ledger

<!-- Use open, drafted, approved, or not applicable. Explain every not applicable decision. -->
<!-- Mark UI and HLD approved only after their gates. Other applicable rows remain drafted until final approval. -->

| Category | Status | Decision or section reference | Open issue or omission reason |
|---|---|---|---|
| UI | open | {{reference}} | {{issue or none}} |
| Architecture (HLD) | open | {{reference}} | {{issue or none}} |
| Models | open | {{reference}} | {{issue or none}} |
| Contracts | open | {{reference}} | {{issue or none}} |
| Functions | open | {{reference}} | {{issue or none}} |
| Interfaces or Classes | open | {{reference}} | {{issue or none}} |
| Behavior | open | {{reference}} | {{issue or none}} |
| Failure Model | open | {{reference}} | {{issue or none}} |
| Traceability | open | {{reference}} | {{issue or none}} |

### Approval Records

<!-- Record actual approval evidence. A heading or completed section is not approval. -->
<!-- Add records for scope, applicable UI, HLD, and final approval as each occurs. -->
<!-- Mark affected records superseded when decisions change. Preserve unaffected approvals. -->

- **{{gate}}** — {{approved content and decision summary}}
  - Evidence: {{user approval statement and date or available message reference}}
  - Delegation: {{explicit delegation and limits, or none}}
  - Validity: {{current or superseded, with reason}}

## UI

<!-- Include only when the scope adds or changes UI. Use an inline mock or a link to an existing supporting file. -->
<!-- Do not create a broken ui.html link or require HTML for non-HTML interfaces. -->

### `UI-1` — {{screen, control, or dialog}}

- **Requirements:** {{FR-* and applicable NFR-* identifiers}}
- **Mock or wireframe:** {{inline representation or valid supporting-file link}}
- **States:** {{applicable empty, loading, error, access, and narrow-display states}}
- **Inputs:** {{key or action and its effect}}
- **Accessibility:** {{behavior required by the approved scope}}

## Architecture (HLD)

### Architecture Decisions

- **{{decision}}** — {{source and reason}}
  - Alternative: {{strongest realistic alternative and trade-off; omit when unnecessary}}
  - Reuse check: {{present requirement and why existing capabilities are insufficient; omit unless introducing an abstraction or dependency}}

```mermaid
{{component diagram with existing entry points or owned responsibilities}}
```

### Components

- **{{component}}** — {{unchanged, modified, new, or removed}}
  - Evidence: {{existing file:symbol or new component}}
  - Responsibility: {{owned responsibility}}
  - Boundaries: {{interfaces, data ownership, and applicable trust boundary}}

### Architectural Flow

- {{How a trigger reaches its observable outcome through the components.}}

### Constraints and Assumptions

- {{Constraint or material assumption, its source, and verification status.}}
- {{Applicable deployment, compatibility, cost, or recovery decision.}}

## Models

<!-- Include structures that express required contracts or invariants. Omit incidental private representations. -->

### `{{TypeName}}`

- **Owner:** {{HLD component}}
- **Definition:** {{existing definition reference; omit when declaring a required new structure below}}

```{{lang}}
{{required type or record declaration with typed fields}}
```

- **Invariants:** {{constraints the type cannot express}}

## Contracts

### {{Contract name}}

- **Owner:** {{HLD component}}
- **Definition:** {{existing definition reference or required format}}
- **Producers:** {{writers or providers}}
- **Consumers:** {{readers or callers}}
- **Version and compatibility:** {{applicable versioning and compatibility rules}}
- **Validation:** {{trust-boundary checks}}
- **Invariants:** {{rules that always hold}}

## Functions

### {{Owning component or module}}

- **Entry point:** {{existing file:symbol, required new symbol, or component responsibility}}
- **Inputs:** {{required inputs and preconditions}}
- **Effects and outputs:** {{required effects and observable results}}
- **Errors:** {{error behavior or Failure Model reference}}

<!-- Add signatures only when correctness or coordination requires them. Replace executable logic with ... . -->

## Interfaces or Classes

<!-- Do not introduce a class or interface merely to fill this section. Cite existing definitions when available. -->

### `{{InterfaceOrClassName}}`

- **Owner:** {{HLD component}}
- **Responsibility and boundary:** {{required responsibility}}
- **Provider and consumers:** {{known implementation and callers}}

```{{lang}}
{{required signatures, or replace this block with an existing definition reference}}
```

<!-- Leave private decomposition discretionary. Label optional examples as illustrative. -->

## Behavior

### {{Flow or state machine}}

- **Condition:** {{precondition}}
- **Steps:** {{ordered component interactions or state transitions}}
- **Result:** {{observable postcondition}}
- **Interruption recovery:** {{persistent-write ordering and recovery when applicable; otherwise omit}}

## Failure Model

- **F-1** — {{relevant failure}}
  - Owner: {{responsible component}}
  - Detector: {{detection mechanism}}
  - Response: {{designed response}}
  - Verification: {{observable action and expected result}}

## Traceability

<!-- Map every included FR and NFR. Do not map excluded or deferred proposals as implemented behavior. -->

- **FR-1** → {{design section, responsibility, contract, or invariant; include UI-* when applicable}}
  - Verification: {{requirement verification reference or observable check}}
- **NFR-1** → {{design section, responsibility, contract, or invariant}}
  - Verification: {{requirement verification reference or observable check}}

## Open Issues

<!-- Write "None" when no issues remain. Resolve blocking issues before final approval. -->

- **{{issue}}** — {{source and consequence}}
  - Blocks: {{affected decision or none}}
  - Resolution: {{decision needed, or accepted non-blocking limitation and its rationale}}
