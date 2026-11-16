---
schema_version: 1
artifact: implementation-plan
subject: "{{subject}}"
spec: "{{source specification path relative to this plan folder, e.g. spec.md}}"
spec_sha256: "{{SHA-256 of the exact specification bytes}}"
repository_baseline: "{{commit or unavailable}}"
working_tree: "{{clean or summary of existing changes}}"
created: "{{YYYY-MM-DD}}"
updated: "{{YYYY-MM-DD}}"
---

# {{Subject}} Implementation Plan

<!-- Remove template instructions and unused placeholders before you present the plan for review. -->

## Source and Execution Boundaries

This plan implements only the included requirements of the referenced specification.
Before execution, confirm that the specification's exact content matches `spec_sha256`.
Resolve relative specification paths against this plan's folder. Resolve relative intent paths against the specification's folder.
Accept existing absolute source paths as written. Verify source existence and hash equality regardless of path format.
For file-based intent, verify the specification's `intent_sha256` against its source file. Stop on missing sources or mismatched hashes.
For conversation-supplied intent, require recorded intent content and `intent_sha256: not applicable` in the specification.
Verify the supporting-file hashes below. Stop if a file is missing or changed, and request review of affected approvals.
Inspect relevant repository changes against the baseline, including working-tree changes. Review affected tasks before execution.
When Git metadata is unavailable, inspect current relevant files and record the comparison limit.
Execution state belongs to the implementer, not this planning artifact.

## Supporting Sources

<!-- Record local supporting files that define approved design using paths relative to this plan's folder. Write None when absent. -->

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

## Approval Record

<!-- Record direct approval or quickie delegation, the approved plan, evidence, and limits. Never claim direct review for delegated approval. -->

- **Decision:** {{direct approval, delegated approval, or pending}}
- **Evidence:** {{user statement and date or quickie invocation and date}}
- **Limits:** {{delegation boundaries or none}}

## Repository Findings

- **Entry points and callers:** {{relevant file:symbol references and observed behavior}}
- **Tests and commands:** {{existing test or build facilities with source references}}
- **Contracts and conventions:** {{relevant definitions and constraints}}
- **Existing changes:** {{working-tree changes relevant to execution, or none}}
- **Known failures or limits:** {{evidence-backed failures, unavailable facilities, or none}}

### Baseline Verification

<!-- Record each declared command. A command that did not run is unproven. -->

| Command | Source | Result | Exit code | Duration | Timeout | Failing tests or skip reason |
|---|---|---|---|---|---|---|
| `{{command}}` | {{manifest script, Makefile target, CI configuration, or documentation}} | {{ran or skipped}} | {{code}} | {{seconds}} | {{seconds}} | {{names, reason, or none}} |

## Gates

<!-- These gates apply after every task and in Final Verification. -->

- **Commands:** {{declared typecheck, lint, and build commands}}, and a regression run of every check that passed earlier.
- **Protected paths:** {{Task 0 files, approved visual baselines and golden files, lockfiles, lint, test, and CI configuration}}. A change fails the gate unless a task names the path as its outcome.
- **Dependencies:** No new packages unless the specification Technology Stack lists them: {{listed new packages or none}}.
- **Scope:** A change outside the allowed areas of the task fails the gate. The implementer reports the need instead.

## Checks

<!-- A program decides each check from its exit code and output. A report from the implementer is never a result. -->
<!-- Derive expected values from the specification oracle. RED must fail because the behavior is missing, not because of a syntax error, a missing file, or a timeout. -->
<!-- level: unit, integration, contract, e2e, visual, or human. For human, the command captures evidence and the user reviews it. -->

```yaml
checks:
  - id: C-{{N}}
    covers: [{{DoD-*, FR-*, NFR-*, or F-* identifiers}}]
    level: {{level}}
    written_by: Task {{N}}
    passes_in: Task {{N}}
    files: [{{test or capture script paths}}]
    cmd: "{{exact command}}"
    timeout_s: {{seconds}}
    red: { exit: {{nonzero code}}, match: "{{pattern that names the missing behavior}}" }
    green: { exit: 0, match: "{{pattern, or omit when the exit code identifies the test}}" }
  - id: C-{{N}}
    covers: [{{DoD-* identifier}}]
    level: human
    written_by: Task 0
    passes_in: Task {{N}}
    files: [{{capture script path}}]
    cmd: "{{capture command}}"
    timeout_s: {{seconds}}
    red: { exit: {{nonzero code}}, match: "{{pattern that names the missing screen or output}}" }
    green: { exit: 0 }
    evidence: [{{screenshot, video, or output paths}}]
    review: "{{review criterion from the specification}}"
```

## Tasks

<!-- Give each task one independently verifiable outcome. Use stable Task N identifiers and explicit dependencies. -->
<!-- Cite included requirements only. Justify supporting tasks through included requirements or established repository constraints. -->
<!-- Include Task 0 when the scope has an e2e, visual, or human check, or a check that covers a DoD-* item. Otherwise, remove it. -->

### Task 0: Acceptance Checks

- **Requirements:** {{DoD-* and requirement identifiers of the Task 0 checks}}
- **Checks written:** {{C-* identifiers}}
- **Outcome:** Every listed check exists and gives its RED result. No production code changes.
- **Review:** {{user, or reviewer under delegated approval}} compares each test with its oracle and its DoD-* item before other tasks start.
- **Allowed areas:** {{test and capture directories}}
- **After review:** The files of these checks are protected paths.

### Task {{N}}: {{Independently Verifiable Outcome}}

- **Requirements:** {{included FR-* and NFR-* identifiers, or repository constraint for a supporting task}}
- **Design references:** {{relevant specification sections or established repository constraint}}
- **Entry point:** {{existing file:symbol, required new symbol, or file path}}
- **Allowed areas:** {{directories or modules this task may change}}
- **Depends on:** {{Task 0 when it exists, other exact Task N identifiers, or none}}
- **RED:** {{test to add or change}}; checks {{C-* identifiers}} give their RED result.
- **GREEN:** {{minimum behavior needed to pass}}
- **REFACTOR:** {{permitted cleanup with tests remaining green}}
- **Verification:** Checks {{C-* identifiers}} give their GREEN result, and the gates pass.
- **Prerequisites:** {{environment, data, or earlier task that creates a required test or script; otherwise none}}

<!-- For non-behavior tasks, replace RED, GREEN, and REFACTOR with a reason why TDD does not apply. Retain checks. -->

## Coverage

<!-- Map every included requirement and DoD-* item to checks. Do not include excluded, deferred, proposed, or parked requirements. -->

- **{{DoD-*, FR-*, NFR-*, or F-*}}** → {{C-* identifiers}} in {{Task N identifiers}}

## Final Verification

<!-- Always include this section. Run every check and every gate on the integrated result. -->

- **Run:** every check in the Checks block and every gate.
- **Definition of done:**

| DoD | Type | Checks | Done when |
|---|---|---|---|
| DoD-{{N}} | checkable | {{C-* identifiers}} | All listed checks give their GREEN result. |
| DoD-{{N}} | human | {{C-* identifiers}} | The capture succeeds and the user approves the evidence. |
