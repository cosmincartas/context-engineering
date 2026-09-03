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

<!-- Omit this section when the slice has no user-facing surface. -->

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

## 5. Models

### 5.1 `{{TypeName}}`

```{{lang}}
{{type or record declaration with typed fields}}
```

- {{Invariant the type cannot express, or omit.}}

## 6. Interfaces

### 6.1 `{{InterfaceName}}`

```{{lang}}
{{interface, protocol, trait, or abstract class with member signatures}}
```

- **Not responsible for:** {{one line}}

## 7. Functions

### 7.1 `{{owner: module, class, or component}}`

```{{lang}}
{{implementation-shaped class, module, or component skeleton; preserve framework metadata and dependency wiring; replace executable logic with ...}}
```

- {{Each method's effect and error behavior.}}

## 8. Contracts

### 8.1 `{{contract name}}`

- **Version:** {{version}}
- **Writer:** {{one owner}}
- **Readers:** {{consumers}}

- `{{name}}` ({{type}}, {{required/optional}}) — {{meaning}}

**Invariants:**

- {{Rule that is always true.}}

## 9. Behavior

### 9.1 {{Flow or state machine}}

- **Condition:** {{Precondition.}}
- **Steps:** {{Ordered calls to designed functions. State write order and interruption recovery when related persistent writes exist.}}
- **Result:** {{Postcondition.}}

## 10. Failure Model

- **F-1** — {{Relevant failure}}
  - Detector: {{detector}}
  - Response: {{designed response}}
  - Verification: {{observable check}}

## 11. Traceability

- **FR-1** → {{UI-* entry when one exists, section numbers, or element names}}
- **NFR-1** → {{section numbers or element names}}

## 12. Parked

- {{Declined widening option or behavior that left scope. One line. A candidate subject for a future topic.}}
