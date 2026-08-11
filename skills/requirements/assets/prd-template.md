---
schema_version: 1
artifact: prd
subject: "{{subject}}"
status: draft
checkpoint: framing
context: "{{validated context brief path}}"
context_sha256: "{{context brief content hash}}"
repository_baseline: "{{commit or unavailable}}"
created: "{{YYYY-MM-DD}}"
updated: "{{YYYY-MM-DD}}"
---

# {{Subject}} Product Requirements Document

## 1. Problem

{{What hurts, who is affected, what it costs, and why it matters. Do not name a solution component.}}

## 2. Current Behavior

{{Describe current behavior and workarounds. Cite repository files or symbols for codebase claims. State when the work is greenfield.}}

## 3. Goal

{{The desired capability. Each clause answers part of the Problem.}}

### Success signals

- {{Measurable outcome or binary result.}}

### Not in this version

- {{Explicit non-goal and reason.}}

## 4. User Stories

**US-1 — {{Short title}}.** The {{persona}} can {{goal}}. {{Reason or effect.}}

## 5. Functional Requirements

| ID | Requirement | Stories | Provenance |
|---|---|---|---|
| FR-1 | The system must {{one checkable behavior}}. | US-1 | {{context, repository evidence, user statement, or assumption}} |

## 6. Non-Functional Requirements

| ID | Category | Requirement | Provenance |
|---|---|---|---|
| NFR-1 | {{category}} | The system must {{measurable limit or binary condition}}. | {{source}} |

## 7. Acceptance Criteria

| ID | Story | Requirements | Procedure and expected result |
|---|---|---|---|
| AC-1 | US-1 | FR-1 | {{Do an observable action. Make sure that the expected result occurs.}} |

## 8. Open Questions

| ID | Question and options | Owner |
|---|---|---|
| Q-1 | {{Question with concrete options.}} | {{user or design}} |

## Appendix A — Rejected Options

<!-- Keep only when supplied evidence records rejected options. Preserve each option, reason, and provenance. -->

- **{{Option}}** — Rejected because {{specific reason}}. Source: {{source}}.
