---
schema_version: 1
artifact: design
subject: "{{subject}}"
status: draft
checkpoint: scope
prd: "prd.md"
prd_sha256: "{{PRD content hash}}"
repository_baseline: "{{commit or unavailable}}"
created: "{{YYYY-MM-DD}}"
updated: "{{YYYY-MM-DD}}"
---

# {{Subject}} Design Specification

## 1. Scope and PRD Linkage

{{What this document specifies and for which version.}}

- **Functional requirements:** {{FR-* list}}
- **Non-functional requirements:** {{NFR-* list}}
- **Acceptance criteria:** {{AC-* list}}
- **Provisional or uncovered requirements:** {{FR-D* list during drafting; must be none before validation}}
- **Design risks:** {{Unverified assumptions or none}}

## 2. Design Rules

1. **T1 — {{Rule}}.** {{Tie-breaking instruction.}} ({{NFR-*}})
2. **T2 — {{Rule}}.** {{Tie-breaking instruction.}} ({{NFR-*}})

## 3. Contracts

### 3.1 `{{contract name}}`

- **Version:** {{version}}
- **Writer:** {{one owner}}
- **Readers:** {{consumers}}

| Field or operation | Type | Required | Description |
|---|---|---|---|
| {{name}} | {{type}} | {{yes/no}} | {{meaning}} |

**Invariants:**

- {{Rule that is always true.}}

## 4. Architecture Overview

```text
{{Simple component and contract diagram}}
```

{{Name each component and the single contract or artifact it writes. Name components that write nothing.}}

## 5. Component Designs

### 5.1 {{Component}}

- **Functions:** {{What it does.}}
- **Not functions:** {{What it deliberately does not do.}}
- **Interface:** {{Externally meaningful call, command, event, or boundary.}}

## 6. Behavior

### 6.1 {{Flow or state machine}}

- **Condition:** {{Precondition.}}
- **Steps:** {{Ordered behavior.}}
- **Result:** {{Postcondition.}}

### 6.2 Write ordering and interruption recovery

<!-- Keep only when the system has related persistent writes. -->

| Writes | Order | Interrupted state | Recovery |
|---|---|---|---|
| {{A and B}} | {{A then B}} | {{state}} | {{why recoverable}} |

## 7. Failure Model

| ID | Failure | Detector | Response | Verification |
|---|---|---|---|---|
| F-1 | {{Relevant failure}} | {{detector}} | {{designed response}} | {{observable check}} |

## 8. Cross-Cutting Concerns

<!-- Each row gets a design position or "Not applicable" with a reason. An empty row blocks validation. -->

| Concern | Design position |
|---|---|
| Security — authorization | {{Who can do each operation, or "Not applicable" and reason}} |
| Security — malicious input | {{How the system detects and refuses hostile input, or "Not applicable" and reason}} |
| Privacy | {{Personal data exposure, retention, and deletion, or "Not applicable" and reason}} |
| Operability — monitoring | {{How failures become visible in operation, or "Not applicable" and reason}} |
| Operability — deployment and configuration | {{Rollout and configuration effects, or "Not applicable" and reason}} |

## 9. Architecture Decision Records

### ADR-1 — {{Decision title}}

- **Context:** {{Q-* or new technical tension. Record a "you decide" delegation here.}}
- **Options:** {{Realistic options presented at the decision gate.}}
- **Decision:** {{Selected option and who selected it.}}
- **Reasons:** {{Why it wins and why alternatives lose.}}
- **Consequences:** {{Accepted effects and risks.}}

## 10. Traceability and Verification Map

| Source | Design sections | Verification |
|---|---|---|
| FR-1 | {{sections}} | {{Observable procedure and result.}} |
| NFR-1 | {{sections}} | {{Observable procedure and result.}} |
| AC-1 | {{sections}} | {{Observable procedure and result.}} |
| F-1 | {{sections}} | {{Observable procedure and result.}} |

A source with no row blocks validation. A design element with no source is scope creep unless it records an existing repository constraint.

## 11. Deferred and Out of Scope

- **Deferred:** {{Item and promotion trigger.}}
- **Never:** {{Excluded item and reason.}}

## Appendix A — Normative Schema Files

<!-- Keep only when machine-checkable schemas exist. Name their paths and precedence. -->
