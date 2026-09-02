---
schema_version: 1
artifact: prd
subject: "{{subject}}"
status: draft
intent: "intent.md"
intent_sha256: "{{intent content hash}}"
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

- **FR-1** — The system must {{one checkable behavior}}.
  - Verification: {{observable action and expected result}}
  - Source: {{intent, repository evidence, user statement, or assumption}}

## 4. Non-Functional Requirements

- **NFR-1** ({{category}}) — The system must {{measurable limit or binary condition}}.
  - Verification: {{observable check}}
  - Source: {{source}}

## 5. Open Questions

- **Q-1** ({{user or design}}) — {{Question with concrete options.}}
