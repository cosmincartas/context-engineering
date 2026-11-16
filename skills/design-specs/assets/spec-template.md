---
schema_version: 1
artifact: spec
subject: "{{subject}}"
intent: "{{source path relative to this specification folder, e.g. intent.md, or slice.md for slice input; or supplied in conversation}}"
intent_sha256: "{{source file SHA-256 or not applicable}}"
repository_baseline: "{{commit or unavailable}}"
language: "{{repository language or not applicable}}"
created: "{{YYYY-MM-DD}}"
updated: "{{YYYY-MM-DD}}"
---

# {{Subject}} Specification

<!-- Remove template instructions and unused example entries from the completed specification. -->
<!-- Keep all ledger rows. Omit inapplicable design sections and explain each omission in the ledger. -->
<!-- During drafting, leave unresolved sections open. Do not present placeholders or unverified assumptions as approved decisions. -->
<!-- Resolve intent and local supporting-file links against this specification's folder. Confirm file-based intent exists and hash its exact bytes. -->

## Intent and Delivery Scope

- **Intent:** {{source reference relative to this specification folder, or supplied intent when no source file exists}}
- **Outcome:** {{approved observable outcome}}
- **Includes:** {{one line per included behavior}}
- **Constraints:** {{explicit constraints and their sources}}

### Definition of Done

<!-- Copy each DoD-* item from the intent. When the intent has no identifiers, derive them and add "(derived)". For slice input, link the overview instead of this list. -->
<!-- A checkable item maps to included requirements. A human item maps to requirements or to a review criterion. -->

- **DoD-1** ({{checkable or human}}) — {{observable result}}
  - Covered by: {{FR-* and NFR-* identifiers, or human review: criterion}}

## Functional Requirements

<!-- Include only selected requirements. Preserve supplied identifiers and link user stories to their derived requirements. -->
<!-- For slice input, copy the requirement lines of the slice file without change into this section and the next. Do not add sub-items. In Excluded and Deferred Requirements, link the overview. -->

- **FR-1** — The system must {{one checkable behavior}}.
  - Selection: included
  - Source: {{user statement, story, intent, repository evidence, or labeled inference}}
  - Recommendation: {{Recommended mandatory or Optional; omit for supplied requirements}}
  - Reason: {{reason for an inferred recommendation and consequence of exclusion; otherwise omit}}
  - UI: {{related UI-* identifiers; omit when not applicable}}
  - Verification: Given {{precondition with example values}}, when {{one action}}, then {{exact observable result}}.

## Non-Functional Requirements

<!-- Include only selected requirements. Use approved numeric limits or binary conditions. -->

- **NFR-1** ({{category}}) — The system must {{measurable limit or binary condition}}.
  - Selection: included
  - Source: {{source, including provenance for numeric limits}}
  - Recommendation: {{Recommended mandatory or Optional; omit for supplied requirements}}
  - Reason: {{reason for an inferred recommendation and consequence of exclusion; otherwise omit}}
  - Verification: {{measurement method, conditions, and approved limit, or binary check}}

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
<!-- Mark Requirements, UI, and HLD approved only after their gates or under the provided-rows rule of the ledger. Other applicable rows remain drafted; do not mark them approved. -->

| Category | Status | Decision or section reference | Open issue or omission reason |
|---|---|---|---|
| Requirements | open | {{reference}} | {{issue or none}} |
| Technology Stack | open | {{reference}} | {{issue or none}} |
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
<!-- Add records for scope, applicable UI, and HLD as each gate occurs. -->
<!-- Mark affected records superseded when decisions change. Preserve unaffected approvals. -->

- **{{gate}}** — {{approved content and decision summary}}
  - Evidence: {{user approval statement and date or available message reference}}
  - Delegation: {{explicit delegation and limits, or none}}
  - Validity: {{current or superseded, with reason}}

## Technology Stack

<!-- List only technology the implementation of this scope uses. Cite manifest or lock files for existing entries. -->

- **{{language, framework, runtime, data store, or library}}** {{version}} — {{existing or new}}
  - Evidence: {{repository-relative manifest or lock file, or source URL for a new entry}}
  - Use: {{what this scope uses it for}}

### Verification Facilities

<!-- List each tool and command that the verification levels in Traceability need. A missing facility is a new entry, justified at the HLD gate. -->

- **{{typecheck, lint, build, unit, integration, contract, e2e, visual, or evidence capture}}** — `{{command}}` — {{existing or new}}
  - Evidence: {{manifest script, Makefile target, CI configuration, or source URL for a new entry}}

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
  - Test trigger: {{input, fake collaborator, or injection point that produces the failure every time; or not testable, with reason}}
  - Verification: Given {{the trigger}}, when {{one action}}, then {{exact observable response}}.

## Traceability

<!-- Map every included FR and NFR. Do not map excluded or deferred proposals as implemented behavior. -->
<!-- Level is the lowest of unit, integration, contract, e2e, visual, or human that can observe the oracle. Each level needs a Verification Facilities entry. -->

- **FR-1** → {{design section, responsibility, contract, or invariant; include UI-* when applicable}}
  - Verification: {{requirement verification reference}}
  - Level: {{unit, integration, contract, e2e, visual, or human}}
- **NFR-1** → {{design section, responsibility, contract, or invariant}}
  - Verification: {{requirement verification reference}}
  - Level: {{unit, integration, contract, e2e, visual, or human}}
- **DoD-1** → {{FR-* and NFR-* identifiers, or human review: criterion}}

## Open Issues

<!-- Write "None" when no issues remain. Resolve blocking issues before you present the specification for review. -->

- **{{issue}}** — {{source and consequence}}
  - Blocks: {{affected decision or none}}
  - Resolution: {{decision needed, or accepted non-blocking limitation and its rationale}}
