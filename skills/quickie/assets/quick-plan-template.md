---
schema_version: 1
artifact: quick-plan
subject: "{{subject}}"
status: draft
repository_baseline: "{{commit or unavailable}}"
working_tree: "{{clean or summary of existing changes}}"
created: "{{YYYY-MM-DD}}"
updated: "{{YYYY-MM-DD}}"
---

# {{Subject}} Quick Plan

Execution state belongs to the implementer.

## Understanding

{{The problem, the desired outcome, the evidence or greenfield status, and the constraints, confirmed by the user.}}

## Scope

### In scope

- {{Boundary confirmed by the user or evidence.}}

### Out of scope

- {{Non-goal and reason.}}

## Acceptance Criteria

- **AC-1** — The system must {{one checkable behavior in ordinary language}}.
  - Verification: {{observable action and expected result}}

## Repository Findings

<!-- Evidence gathered at repository_baseline that the tasks rely on. Cite files and symbols. -->

## Tasks

### Task {{N}}: {{Independently Verifiable Outcome}}

- **Criteria:** {{AC-* identifiers}}
- **Entry point:** {{file:symbol}}
- **Depends on:** {{Task identifiers or none}}
- **RED:** {{Test to add, command to run, expected failure}}
- **GREEN:** {{Minimum behavior to pass}}
- **REFACTOR:** {{Permitted cleanup}}
- **Verification:** {{Exact command or observation and expected result}}

<!-- For a non-behavior task, replace RED/GREEN/REFACTOR with "TDD does not apply because ..." and keep Verification. -->
