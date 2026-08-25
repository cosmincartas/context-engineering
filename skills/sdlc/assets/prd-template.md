---
schema_version: 1
artifact: prd
subject: "{{subject}}"
status: draft
context: "context-brief.md"
context_sha256: "{{context brief content hash}}"
repository_baseline: "{{commit or unavailable}}"
created: "{{YYYY-MM-DD}}"
updated: "{{YYYY-MM-DD}}"
---

# {{Subject}} Product Requirements Document

## 1. Problem

{{What hurts, who is affected, and why it matters. Do not name a solution.}}

## 2. Goal

{{The desired capability and for whom. Each clause answers part of the Problem.}}

## 3. Functional Requirements

| ID | Requirement | Verification | Source |
|---|---|---|---|
| FR-1 | The system must {{one checkable behavior}}. | {{Observable action and expected result.}} | {{brief, repository evidence, user statement, or assumption}} |

## 4. Non-Functional Requirements

| ID | Category | Requirement | Verification | Source |
|---|---|---|---|---|
| NFR-1 | {{category}} | The system must {{measurable limit or binary condition}}. | {{Observable check.}} | {{source}} |

## 5. Open Questions

| ID | Question and options | Owner |
|---|---|---|
| Q-1 | {{Question with concrete options.}} | {{user or design}} |
