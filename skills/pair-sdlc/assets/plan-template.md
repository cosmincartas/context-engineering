---
schema_version: 1
artifact: implementation-plan
subject: "{{subject}}"
status: draft
design: "design.md"
design_sha256: "{{design content hash}}"
prd: "prd.md"
prd_sha256: "{{PRD content hash}}"
repository_baseline: "{{commit or unavailable}}"
working_tree: "{{clean or summary of existing changes}}"
created: "{{YYYY-MM-DD}}"
updated: "{{YYYY-MM-DD}}"
---

# {{Subject}} Implementation Plan

## Execution Protocol

Instructions for any implementing agent, in any session:

1. Start only when this plan's `status` is `validated`, `executing`, or `blocked`.
2. Compare the exact design and PRD files in this folder with `design_sha256` and `prd_sha256`. Also require and verify the design's `prd_sha256` and the PRD's `context_sha256` against their exact files. Stop on any missing link or mismatch.
3. Review the plan and current repository before editing. Stop and ask when the plan has a critical gap or material repository drift.
4. Resume the single `In Progress` task. Otherwise, work from the first task in plan order whose status is not `Done`. Never skip unresolved blocked work.
5. For production-behavior changes, use test-driven development: observe RED before production code, implement the minimum GREEN behavior, then REFACTOR while tests remain green.
6. Set a task to `In Progress` before editing. Set it to `Done` only after its verification passes and its execution evidence is recorded. Set it to `Blocked` instead of guessing.
7. Complete one task before starting the next. Leave the project building and its tests passing after every `Done` task.
8. Set the plan status to `executing`, `blocked`, or `completed` as work progresses. Never run `git commit` without the user's explicit consent.

## Goal and Design Reference

<!-- State the goal, design and PRD paths, and the FR-*/NFR-*/AC-* identifiers covered. -->

## Repository Findings

<!-- Record evidence gathered at repository_baseline that tasks rely on. -->

## Tasks

### Task {{N}}: {{Independently Verifiable Outcome}}

- **Status:** Not Started
- **Requirements:** {{FR-*/NFR-*/AC-* identifiers}}
- **Entry point:** {{file:symbol}}
- **Depends on:** {{Task identifiers or none}}
- **Expected behavior:** {{One observable outcome}}
- **TDD cycle:**
  - **RED:** {{Test or check to add, command to run, and expected failure}}
  - **GREEN:** {{Minimum behavior needed to pass}}
  - **REFACTOR:** {{Permitted cleanup after GREEN}}
- **Verification:** {{Exact command or observation and expected result}}
- **Execution evidence:**
  - **Changed files:**
  - **Commands and results:**
  - **Completed at:**
  - **Blocked reason:**

<!-- For a non-behavior task, replace the TDD cycle with "TDD does not apply because ..." and provide an observable verification. Status is Not Started, In Progress, Blocked, or Done. -->

## Migration, Rollout, and Rollback

<!-- Remove when genuinely irrelevant. -->

## Requirement Coverage

<!-- Map every FR-*, NFR-*, and AC-* identifier to a task and its observable verification. -->
