---
schema_version: 1
artifact: spec
subject: "{{subject}}"
status: draft
intent: "intent.md"
intent_sha256: "{{intent content hash}}"
repository_baseline: "{{commit or unavailable}}"
language: "{{repository language}}"
created: "{{YYYY-MM-DD}}"
updated: "{{YYYY-MM-DD}}"
---

# {{Subject}} Specification

## 1. User Interface

<!-- Include this section only when the approved scope adds or changes UI. For non-UI work, skip the UI gate and do not create, modify, or delete ui.html. -->

### 1.1 `UI-1` — {{screen, widget, or dialog}}

- **Mock:** [ui.html#UI-1](ui.html#UI-1)
- **States:** {{one line per state: empty, loading, error, narrow, or omit.}}
- **Inputs:** {{key or action → effect}}

## 2. Functional Requirements

- **FR-1** — The system must {{one checkable behavior}}.
  - UI: {{UI-* entry, or omit}}
  - Verification: {{observable action and expected result}}
  - Source: {{intent, repository evidence, user statement, assumption, or delegation}}

## 3. Non-Functional Requirements

- **NFR-1** ({{category}}) — The system must {{measurable limit or binary condition}}.
  - Verification: {{observable check}}
  - Source: {{source}}

## 4. Architecture

**Architecture decisions:**

<!-- For a new abstraction or dependency, name the present requirement and why existing code or capabilities are insufficient. -->

- {{Decision, source, and reason. Include the strongest alternative and trade-off when a consequential choice was unresolved.}}

```mermaid
{{Approved HLD Mermaid diagram; components named by existing entry points, required contracts, or owned responsibilities}}
```

**Responsibilities:**

- {{Component responsibility.}}

**Flow:**

- {{How a request or event moves through the components.}}

**Assumptions:**

- {{Approved HLD assumption, or omit.}}

<!-- Include section 5 when a model's structure expresses a required contract or invariant. Omit incidental internal representations. Keep this section number. -->
## 5. Models

### 5.1 `{{TypeName}}`

```{{lang}}
{{type or record declaration with typed fields}}
```

- {{Invariant the type cannot express, or omit.}}

<!-- Include section 6 for required public, shared, or important internal interfaces. Cite existing definitions when available. Keep this section number. -->
## 6. Interfaces

### 6.1 `{{InterfaceName}}`

```{{lang}}
{{required interface signatures, or replace this block with a reference to the existing definition}}
```

- **Responsibility and boundary:** {{one line}}

<!-- Include section 7 when entry points or function constraints need explanation. Keep this section number. -->
## 7. Functions

### 7.1 `{{owner: module, class, or component}}`

- **Entry point:** {{existing file:symbol, required new symbol, or component responsibility}}
- **Behavior:** {{required effect and error behavior}}

<!-- Add a code block only to clarify required signatures, framework hooks, or wiring. Show those constraints and use ... for executable logic. Label optional examples "Illustrative; private structure may change within approved constraints". -->

<!-- Include section 8 only when the design introduces or changes an external contract. Omit the heading and contents otherwise. Keep this section number. -->
## 8. Contracts

### 8.1 `{{contract name}}`

- **Version:** {{version}}
- **Writer:** {{one owner}}
- **Readers:** {{consumers}}

- `{{name}}` ({{type}}, {{required/optional}}) — {{meaning}}

**Invariants:**

- {{Rule that is always true.}}

<!-- Include section 9 only when the design has an important flow or state transition. Omit the heading and contents otherwise. Keep this section number. -->
## 9. Behavior

### 9.1 {{Flow or state machine}}

- **Condition:** {{Precondition.}}
- **Steps:** {{Ordered component responsibilities, contracts, or existing entry points. State write order and interruption recovery when related persistent writes exist.}}
- **Result:** {{Postcondition.}}

<!-- Include section 10 only when the design has relevant failures to record. Omit the heading and contents otherwise. Keep this section number. -->
## 10. Failure Model

- **F-1** — {{Relevant failure}}
  - Detector: {{detector}}
  - Response: {{designed response}}
  - Verification: {{observable check}}

<!-- Include section 11 when traceability entries apply. Omit the heading and contents otherwise. Keep this section number. -->
## 11. Traceability

- **FR-1** → {{UI-* entry when one exists, component responsibility, contract, invariant, or required design element}}
- **NFR-1** → {{component responsibility, contract, invariant, or required design element}}

<!-- Include section 12 only when a widening option or behavior leaves scope. Omit the heading and contents otherwise. Keep this section number. -->
## 12. Parked

- {{Declined widening option or behavior that left scope. One line. A candidate subject for a future topic.}}
