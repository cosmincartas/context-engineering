---
schema_version: 1
artifact: implementation-plan
subject: "{{subject}}"
status: draft
spec: "spec.md"
spec_sha256: "{{spec content hash}}"
repository_baseline: "{{commit or unavailable}}"
working_tree: "{{clean or summary of existing changes}}"
created: "{{YYYY-MM-DD}}"
updated: "{{YYYY-MM-DD}}"
---

# {{Subject}} Implementation Plan

Before execution, verify `spec_sha256` and its upstream `intent_sha256` against their files; stop on a mismatch. Execution state belongs to the implementer.

## Repository Findings

<!-- Evidence gathered at repository_baseline that tasks rely on. -->

## Tasks

### Task {{N}}: {{Independently Verifiable Outcome}}

- **Requirements:** {{FR-*/NFR-* identifiers}}
- **Entry point:** {{file:symbol}}
- **Depends on:** {{Task identifiers or none}}
- **RED:** {{Test to add, command to run, expected failure}}
- **GREEN:** {{Minimum behavior to pass}}
- **REFACTOR:** {{Permitted cleanup}}
- **Verification:** {{Exact command or observation and expected result}}

<!-- For a non-behavior task, replace RED/GREEN/REFACTOR with "TDD does not apply because ..." and keep Verification. -->
