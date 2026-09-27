---
schema_version: 1
artifact: quick-plan
subject: "{{subject}}"
intent: "{{source intent path, relative to this plan or absolute}}"
intent_sha256: "{{SHA-256 of the exact intent bytes}}"
repository_baseline: "{{commit or unavailable}}"
working_tree: "{{clean or summary of existing changes}}"
created: "{{YYYY-MM-DD}}"
updated: "{{YYYY-MM-DD}}"
---

# {{Subject}} Quick Plan

Execution state belongs to the implementer. Before execution, confirm that the intent's exact content matches `intent_sha256`.

## Source

- **Intent:** {{intent path}}
- **Resolved open questions:** {{each intent Open Question with its answer and source, or none}}

## Scope

### In scope

- {{Boundary from the intent or repository evidence, with its source.}}

### Out of scope

- {{Non-goal and reason.}}

## Acceptance Criteria

- **AC-1** — The system must {{one checkable behavior derived from the intent's Proposed outcome}}.
  - Verification: {{observable action and expected result}}

## Repository Findings

<!-- Evidence gathered at repository_baseline that the tasks rely on: test and build commands, prerequisites, known baseline failures. Cite files and symbols. -->

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
