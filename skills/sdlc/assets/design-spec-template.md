---
schema_version: 1
artifact: design
subject: "{{subject}}"
status: draft
prd: "prd.md"
prd_sha256: "{{PRD content hash}}"
repository_baseline: "{{commit or unavailable}}"
language: "{{repository language}}"
created: "{{YYYY-MM-DD}}"
updated: "{{YYYY-MM-DD}}"
---

# {{Subject}} Design Specification

## 1. Architecture

```text
{{Component diagram; components named by the interface they implement or the functions they own}}
```

**Responsibilities:**

- {{Component responsibility.}}

**Flow:**

- {{How a request or event moves through the components.}}

**Assumptions:**

- {{Approved HLD assumption, or omit.}}

## 2. Models

### 2.1 `{{TypeName}}`

```{{lang}}
{{type or record declaration with typed fields}}
```

- {{Invariant the type cannot express, or omit.}}

## 3. Interfaces

### 3.1 `{{InterfaceName}}`

```{{lang}}
{{interface, protocol, trait, or abstract class with member signatures}}
```

- **Not responsible for:** {{one line}}

## 4. Functions

### 4.1 `{{owner: module, class, or component}}`

```{{lang}}
{{function signature}}
```

- {{Effect in one line; error behavior.}}

## 5. Contracts

### 5.1 `{{contract name}}`

- **Version:** {{version}}
- **Writer:** {{one owner}}
- **Readers:** {{consumers}}

- `{{name}}` ({{type}}, {{required/optional}}) — {{meaning}}

**Invariants:**

- {{Rule that is always true.}}

## 6. Behavior

### 6.1 {{Flow or state machine}}

- **Condition:** {{Precondition.}}
- **Steps:** {{Ordered calls to designed functions. State write order and interruption recovery when related persistent writes exist.}}
- **Result:** {{Postcondition.}}

## 7. Failure Model

- **F-1** — {{Relevant failure}}
  - Detector: {{detector}}
  - Response: {{designed response}}
  - Verification: {{observable check}}

## 8. Traceability

- **FR-1** → {{section numbers or element names}}
- **NFR-1** → {{section numbers or element names}}
