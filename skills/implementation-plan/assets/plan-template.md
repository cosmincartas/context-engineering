---
schema_version: 1
artifact: implementation-plan
subject: "{{subject}}"
status: draft
spec: "{{source specification path, relative to this plan or absolute}}"
spec_sha256: "{{SHA-256 of the exact specification bytes}}"
repository_baseline: "{{commit or unavailable}}"
working_tree: "{{clean or summary of existing changes}}"
created: "{{YYYY-MM-DD}}"
updated: "{{YYYY-MM-DD}}"
---

# {{Subject}} Implementation Plan

<!-- Use ASD-STE100 Simplified Technical English. Remove template instructions and unused placeholders before final approval. -->

## Source and Execution Boundaries

This plan implements only the included requirements of the referenced specification.
Before execution, confirm that the specification remains validated and its exact content matches `spec_sha256`.
Resolve relative specification paths against this plan's folder. Resolve relative intent paths against the specification's folder.
For file-based intent, verify the specification's `intent_sha256` against its source file. Stop on missing sources or mismatched hashes.
For conversation-supplied intent, require recorded intent content and `intent_sha256: not applicable` in the specification.
Verify the supporting-file hashes below. Stop if a file is missing or changed, and request review of affected approvals.
Inspect relevant repository changes against the baseline, including working-tree changes. Review affected tasks before execution.
When Git metadata is unavailable, inspect current relevant files and record the comparison limit.
Execution state belongs to the implementer, not this planning artifact.

## Supporting Sources

<!-- Record local supporting files that define approved design. Resolve relative paths against this plan's folder. Write None when absent. -->

- **Path:** {{approved supporting-file path}}
  - SHA-256: {{hash of exact file bytes}}
  - Role: {{approved UI mock or other binding design content}}

## Implementation Discretion

Preserve approved behavior, required signatures, contracts, invariants, architecture, and acceptance conditions.
Choose private helpers, class structure, and incidental wiring within those constraints. Required internal contracts remain binding.
Trace downstream from each task's entry point. The entry point is not an exhaustive list of affected files.
Check existing code, standard libraries, native capabilities, and installed dependencies before adding abstractions or dependencies.
Justify additions through a present requirement and an unmet need. Obtain specification approval for consequential technology changes.

## Correction Rules

Stop dependent work when a change affects approved scope, acceptance, UI, contracts, or architecture.
Request specification review through `design-specs` or the original specification workflow. Do not silently change upstream artifacts.
For changed intent, request intent review first. Reassess downstream approvals after upstream correction.
For task order, grouping, or verification changes within the approved specification, request plan revision through `implementation-plan`.
Private structural changes within approved constraints require verification, not another design approval.
Do not refresh source hashes without reviewing changes and obtaining approval for affected content.

## Repository Findings

- **Entry points and callers:** {{relevant file:symbol references and observed behavior}}
- **Tests and commands:** {{existing test or build facilities with source references}}
- **Contracts and conventions:** {{relevant definitions and constraints}}
- **Existing changes:** {{working-tree changes relevant to execution, or none}}
- **Baseline verification:** {{checks actually performed and results; otherwise not executed}}
- **Known failures or limits:** {{evidence-backed failures, unavailable facilities, or none}}

## Tasks

<!-- Give each task one independently verifiable outcome. Use stable Task N identifiers and explicit dependencies. -->
<!-- Cite included requirements only. Justify supporting tasks through included requirements or established repository constraints. -->

### Task {{N}}: {{Independently Verifiable Outcome}}

- **Requirements:** {{included FR-* and NFR-* identifiers, or repository constraint for a supporting task}}
- **Design references:** {{relevant specification sections or established repository constraint}}
- **Entry point:** {{existing file:symbol, required new symbol, or file path}}
- **Depends on:** {{exact Task N identifiers or none}}
- **RED:** {{test to add or change, exact command, and expected missing-behavior failure}}
- **GREEN:** {{minimum behavior needed to pass}}
- **REFACTOR:** {{permitted cleanup with tests remaining green}}
- **Verification:** {{exact command or reproducible observation and expected result}}
- **Prerequisites:** {{environment, data, or earlier task that creates a required test or script; otherwise none}}

<!-- For non-behavior tasks, replace RED, GREEN, and REFACTOR with a reason why TDD does not apply. -->
<!-- Retain observable verification. Label commands that require facilities created by this plan. -->

## Requirement Coverage

<!-- Map every included requirement to tasks and verification. Do not include excluded, deferred, proposed, or parked requirements. -->

- **{{FR-* or NFR-*}}** → {{Task N identifiers}}
  - Verification: {{task verification reference or approved acceptance check}}

## Final Verification

<!-- Include combined checks when individual tasks cannot establish complete acceptance. Otherwise, reference sufficient task checks. -->

- **Check:** {{command or reproducible observation}}
  - Prerequisites: {{required completed tasks and environment}}
  - Expected result: {{observable acceptance condition}}
  - Coverage: {{included requirement identifiers}}

## Approval Records

<!-- Use Pending before first approval. Add a record only after explicit approval of the complete saved plan. -->
<!-- Preserve earlier records. Mark affected approvals superseded when revising the plan. -->

- **Revision:** {{sequential approved revision number}}
  - Approved content: {{task set and scope approved in this revision}}
  - Evidence: {{user approval statement and date or available message reference}}
  - Delegation: {{explicit delegation and limits, or none}}
  - Validity: {{current or superseded, with reason}}
