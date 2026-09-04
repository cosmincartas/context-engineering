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

- {{Decision, source, strongest alternative, and trade-off.}}

```mermaid
{{Approved HLD Mermaid diagram; components named by the interface they implement or the functions they own}}
```

**Responsibilities:**

- {{Component responsibility.}}

**Flow:**

- {{How a request or event moves through the components.}}

**Assumptions:**

- {{Approved HLD assumption, or omit.}}

<!-- Include section 5 only when the design introduces or changes models. Omit the heading and contents otherwise. Keep this section number. -->
## 5. Models

### 5.1 `{{TypeName}}`

```{{lang}}
{{type or record declaration with typed fields}}
```

- {{Invariant the type cannot express, or omit.}}

<!-- Include section 6 only when the design introduces or changes interfaces. Omit the heading and contents otherwise. Keep this section number. -->
## 6. Interfaces

### 6.1 `{{InterfaceName}}`

```{{lang}}
{{interface, protocol, trait, or abstract class with member signatures}}
```

- **Not responsible for:** {{one line}}

<!-- Include section 7 only when the design introduces or changes concrete functions. Omit the heading and contents otherwise. Keep this section number. -->
## 7. Functions

### 7.1 `{{owner: module, class, or component}}`

```{{lang}}
{{implementation-shaped class, module, or component skeleton; preserve framework metadata and dependency wiring; replace executable logic with ...}}
```

- {{Each method's effect and error behavior.}}

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
- **Steps:** {{Ordered calls to designed functions. State write order and interruption recovery when related persistent writes exist.}}
- **Result:** {{Postcondition.}}

<!-- Include section 10 only when the design has relevant failures to record. Omit the heading and contents otherwise. Keep this section number. -->
## 10. Failure Model

- **F-1** — {{Relevant failure}}
  - Detector: {{detector}}
  - Response: {{designed response}}
  - Verification: {{observable check}}

<!-- Include section 11 when traceability entries apply. Omit the heading and contents otherwise. Keep this section number. -->
## 11. Traceability

- **FR-1** → {{UI-* entry when one exists, section numbers, or element names}}
- **NFR-1** → {{section numbers or element names}}

<!-- Include section 12 only when a widening option or behavior leaves scope. Omit the heading and contents otherwise. Keep this section number. -->
## 12. Parked

- {{Declined widening option or behavior that left scope. One line. A candidate subject for a future topic.}}
