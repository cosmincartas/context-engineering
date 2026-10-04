---
name: sdd-cc
description: Claude Code variant of sdd. Delegates non-trivial work through tracked tasks, parallel subagents, and independent review.
---

# Subagent Driven Development for Claude Code

Use Claude Code's task tools and the `Agent` tool to coordinate implementation and review. The orchestrator owns readiness, dependency decisions, and the correction loop. Subagents investigate, implement, and review the work assigned in their prompts.

## Supported tools

This skill uses only these Claude Code tools:

- `TaskCreate` accepts `{ subject, description, activeForm?, metadata? }` and creates a task with status `pending`.
- `TaskUpdate` accepts `{ taskId, status?, subject?, description?, activeForm?, owner?, metadata?, addBlockedBy?, addBlocks? }`. Its status values are `pending`, `in_progress`, and `completed`; `deleted` permanently removes the task. `addBlockedBy` records the task IDs that must complete before this task can start.
- `TaskList` accepts `{}` and returns each task's `id`, `subject`, `status`, `owner`, and open `blockedBy` IDs.
- `TaskGet` accepts `{ taskId }` and returns one task's full `subject`, `description`, `status`, `blocks`, and `blockedBy`.
- `Agent` accepts `{ description, prompt, subagent_type, run_in_background? }` and runs one subagent. Several `Agent` calls in one message run in parallel. The required `subagent_type` values are `worker` and `reviewer`; `scout` and `oracle` are optional. When installed through the plugin, these agents are namespaced, such as `agentic-workflow:worker`; use whichever form is listed.

The task tools are not enabled by default on every model. If `TaskCreate` is unavailable, stop and tell the user to enable the task tools, for example by setting `CLAUDE_CODE_ENABLE_TODO_TOOLS=1`; do not substitute another tracker. If the task tools are listed but not loaded, load them before use. If the `worker` or `reviewer` subagent is unavailable, stop and report it; do not substitute another agent type.

Keep task objects to the fields supplied by these tools. Record the role in `metadata.role`, dependencies with `addBlockedBy`, and scope, acceptance, and evidence in `description`; do not invent a scheduler.

## Invariants

- Preserve the original requirements in every task description and agent prompt.
- Give every `Agent` call a short `description` that starts with its task ID, and a self-contained `prompt`.
- Use `worker` for implementation and `reviewer` for independent verification. Worker and Reviewer are required. Scout and Oracle are optional.
- Keep independent work parallel. Tasks that share a write scope or mutable verification must be serialized with `addBlockedBy`. Shared working-directory access alone does not require serialization.
- Do not commit, push, create branches, or open pull requests unless the user explicitly requests it.
- Preserve unrelated user changes.

## 1. Frame the work

Extract the objective, acceptance criteria, constraints, relevant files, reproduction steps, explicit exclusions, and required verification commands. Freeze these before review: record the spec/plan reference content and version when present, otherwise the original request; included requirements and checks; explicit rules and exclusions; and task-owned file scope. Any change to this frozen basis requires user approval. Do not expand review to the full planned scope.

Call `TaskList` before creating tasks. Record the IDs of any unrelated tasks already in the list; never modify or delete them.

Before dispatching a Worker, record the repository change baseline (tracked and untracked status and relevant diffs) so later changes can be attributed, including changed-file attribution for new, deleted, and untracked files. Note pre-existing edits, including edits in files the Worker may touch. If the baseline or later comparison cannot distinguish the Worker's changes from unrelated changes, record the ambiguity; do not guess attribution. Context-only reads outside task-owned targets are not review targets. Scope violations are not silently exempted: report them as a scope issue and pause for user decision.

Create the smallest useful set of tasks with `TaskCreate`. Create one task for each independent assignment, with an imperative `subject`, `metadata: { role }`, and a readable record in `description`, for example:

```text
Scope: extensions/example/index.ts
Acceptance: ...
Verification: ...
```

Then record dependencies with `TaskUpdate` and `addBlockedBy`. Record the IDs of every task this run creates.

Use `TaskList` and `TaskGet` to inspect the current work. A task is ready when it is `pending`, its `blockedBy` list is empty, and the orchestrator's reading of its description and the latest evidence confirms it can start.

## 2. Investigate when useful

Use a `scout` task when code ownership, execution flow, documentation, or affected files are unclear. Give it a read-only question, the relevant files, requested evidence, and an instruction not to change files.

Use an `oracle` task only when a consequential design, security, data-integrity, or competing-root-cause decision remains unresolved. Record its conclusion in the relevant task description before implementation.

Scout and Oracle work may run together when their scopes are independent. Do not create either role when the orchestrator already has enough evidence.

## 3. Dispatch ready work

Use `TaskList` to recompute readiness. Identify every ready independent task. Mark each task `in_progress` immediately before dispatching it; never mark unsent work `in_progress`.

Dispatch all ready tasks in one message, with one `Agent` call per task. Use the task's role as `subagent_type`, `#<id> <subject>` as `description`, and a self-contained `prompt`. When the agents run in the background, wait for every completion notification before processing results; never predict or assume a result that has not arrived.

If an `Agent` call returns an error instead of a report, return that task to `pending` and record the error in its description. It is not ready again until its request is corrected; redispatch the corrected call, or record an external blocker and stop. Never retry an unchanged failing call.

After processing the returned results, recompute readiness and dispatch every ready task. Stop when nothing is ready.

A Worker prompt must include the original requirements, its exact scope, relevant evidence, acceptance criteria, verification commands, explicit exclusions, and a requirement to preserve unrelated changes. The Worker owns implementation and focused checks.

## 4. Process returned results

After each dispatch, inspect every returned result:

1. Map each result to its task through the task ID in the call's `description`.
2. Inspect the report against that task's acceptance criteria and required checks. A report that returns without error is process evidence only, not task success.
3. Before completion processing, filter every Reviewer report's findings. Keep only actionable findings grounded in the frozen original requirement, an applicable explicit repository rule, or a demonstrable regression introduced by the attributable change. Each finding must give its location, trigger, evidence, and basis. Reject new requirements, redesign proposals, speculative hardening, and implementation preferences; these are non-findings and must neither block completion nor become correction tasks. A raw failing verdict based only on such non-findings cannot veto the filtered decision. Use only filtered findings—not raw findings—for completion decisions and corrections.
4. Require one complete consolidated **Initial review** report covering the entire agreed attributable worker-change set across the assignment(s) and every acceptance criterion/check, listing all findings together and stating coverage and any limits. Its prompt must name Initial review. A partial, incomplete, budget-limited, truncated, or coverage-missing report is insufficient: pause for complete evidence and do not correct from partial findings. Assign each accepted finding a stable ID once and preserve its ID, status, and evidence in a task-description ledger across corrections and resumes. Record failed verification checks there too.

**Verification review** is only after the single correction batch. Its prompt must name Verification review and include the consolidated original Initial review report, accepted finding IDs with current status and evidence for each resolution, the reviewed pre-correction snapshot, and the correction-only attributable delta. It is not unrestricted discovery and must not repeat Initial review over the full change set. Check every accepted ID against its original evidence; validate correction regressions; inspect unchanged files and surrounding diff context only as needed to verify accepted findings. Record every ID resolved or unresolved with evidence. Missing original report, ID ledger, status/evidence, pre-correction snapshot, or correction-only delta makes verification incomplete; never fall back implicitly to Initial review. Report mode, accepted-ID resolutions when applicable, later-finding classifications and evidence, coverage, checks, and limits.

Before generic correction, completion, or readiness handling, classify every later Verification review finding by origin: (a) a correction-caused regression is eligible only within the existing one automatic correction batch limit; (b) a defect missed in Initial review must explain the miss and be escalated, with no automatic extra correction task; (c) a preference or new requirement is rejected as a non-finding and is nonblocking. An ambiguous or unsupported origin is incomplete and must be escalated, not turned into correction work. The orchestrator must resolve these classifications first so unapproved rediscovery cannot create correction work. Initial prompts use Initial review; follow-up prompts use Verification review.
5. Mark the task `completed` only when the filtered assessment supports a passing verdict, all applicable checks pass, and no blocker, accepted finding, scope issue, or missing evidence remains. Otherwise return it to `pending`, record the report and evidence in the task description, then apply section 5.
6. If a passed Worker makes its Reviewer ready, create the Reviewer task with `TaskCreate` when framing did not create it. A Reviewer must inspect independently rather than trust the Worker report. Its prompt must cite spec and plan paths when present, and include the frozen contract (reference content and version when present, otherwise the original request; included requirements and checks; explicit rules and exclusions; and task-owned file scope), acceptance criteria, exact scope, deferred non-findings, the baseline and comparison evidence, the Worker's attributable changed-file diff (including new, deleted, and untracked files), existing verification commands, and unrelated-change preservation. Require the Reviewer to use the same actionable-finding bar: findings must be grounded in a frozen original requirement, an applicable explicit repository rule, or a demonstrable regression in the attributable change, with location, trigger, evidence, and basis. Prohibit new requirements, redesign proposals, speculative hardening, and implementation preferences as findings. Review only the attributable task-owned changes, not the full working tree or planned task scope. Separate unrelated edits within changed files using the baseline; if attribution is ambiguous, record the ambiguity and do not guess or treat uncertain changes as review targets. Other files may be read only as necessary context, not as additional review targets. Require one consolidated report covering the entire agreed change set and each acceptance criterion/check, with all findings, coverage, and limits stated; partial or incomplete reports are insufficient. State when no automated check exists; do not build a validator.
7. After every returned result has been inspected, use `TaskList` to recompute readiness. Dispatch every ready independent task through section 3, including ready Reviewers. Stop when nothing else is ready.

The review gate passes only after every required Initial review and Verification review report has been inspected, all accepted IDs are resolved with evidence, there are no filtered actionable findings, all applicable checks pass, and no verification blocker or missing evidence remains.

## 5. Correct and repeat

When result inspection returns a Worker or Reviewer task to `pending`, record the location, triggering path, prior Worker report and evidence, filtered actionable Reviewer findings (or their recorded absence), failed checks, blockers, and correction in its description. Keep unrelated successful tasks `completed`. Serialize corrections that share a write scope or mutable verification with another task.

For a failed Reviewer, return the Reviewer to `pending` and create a corresponding correction Worker with `TaskCreate`, or reset an undispatched correction Worker with `TaskUpdate`. Put the original requirements, exact scope, acceptance criteria, verification commands, prior Worker report and evidence, filtered actionable Reviewer findings, failed checks, blockers, triggering path, and recorded correction in the correction Worker's description and prompt. Block the Reviewer on that correction Worker with `addBlockedBy`; do not dispatch the Reviewer until the correction Worker passes result inspection. Make the correction handoff self-contained: include all accepted finding IDs together with each finding's original evidence and the relevant required verification failures; the frozen original requirements, acceptance criteria, exclusions, task-owned file scope, approved contracts and reference content/version, plus spec/plan paths when present; and required verification commands. Instruct the Worker to resolve all accepted IDs and required check failures together without changing the frozen basis. A passed correction Worker makes that Reviewer ready for Verification review only, using the accumulated attributable task-owned changes from the original Worker and correction against the frozen acceptance basis—not the full planned task scope. Make the full-diff workflow mode-aware: inspect the full agreed attributable worker-change set during Initial review; during Verification review inspect only the correction delta and the context necessary to verify accepted IDs and correction regressions.

For each original Worker assignment, allow exactly one automatic correction batch, consolidating all accepted findings and required verification failures. Record that allowance as consumed in the task description before dispatch; new task IDs or resumed orchestration do not reset it. Recompute readiness and dispatch correction Workers and only their unblocked, ready Reviewers through section 3. A correction Worker prompt must cite spec and plan paths when present and name the requirement behind each finding. If the Worker determines that a file-scope or approved-contract expansion is necessary, it must stop before making that change and report the need for user approval to the parent; only after approval may the parent update the correction contract. Never infer approval from raw Reviewer advice. Start a fresh Worker for the correction; do not resume or rely on the earlier Worker. Use Oracle only when the disagreement or root cause still needs a decision. After the single correction batch, any correction failure, valid finding on verification review, failed check, blocker, scope ambiguity, or incomplete evidence requires user escalation; leave unresolved tasks `pending` and do not dispatch another automatic correction. Keep each accepted finding's original ID, status, and evidence in the task-description ledger through the verification review. The sequence is initial review, one correction batch, then verification review. Never declare completion without the required evidence.

## 6. Report

Before replying, use `TaskList` so task statuses match reality. Every task from this run must be `pending`, `in_progress`, or `completed`; leave unresolved work `pending` with its evidence.

When the review gate passes and every task from this run is completed:

1. Use the specification or plan folder when it lies under `docs/context-engineering/<subject>/`. Otherwise, derive a short subject and use that path.
2. Save `tasks.md` in that folder before deleting anything. Include each task's ID, role, final status, assignment, outcome, verification result, and review verdict. Keep prior `tasks.md` content when appending another run.
3. Read the saved file and confirm that it contains the final task record. If the save or check fails, leave the task list intact and report the error.
4. Delete this run's tasks with `TaskUpdate` and `status: "deleted"`, then confirm with `TaskList` that none of them remain. Never delete unrelated tasks. If a deletion fails, keep the saved file and report which tasks remain.

Do not archive or delete unfinished work as completed. Report the changed behavior, verification results, review findings, remaining issues, and the `tasks.md` path when saved. Do not claim completion without evidence.
