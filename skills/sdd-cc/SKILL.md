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

Extract the objective, acceptance criteria, constraints, relevant files, reproduction steps, explicit exclusions, and required verification commands.

Call `TaskList` before creating tasks. Record the IDs of any unrelated tasks already in the list; never modify or delete them.

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
3. Mark the task `completed` only when the report supports a passing verdict, all applicable checks pass, and no blocker, actionable finding, or missing evidence remains. Otherwise return it to `pending`, record the report, failed checks, blockers, actionable findings, and missing or ambiguous evidence in its description, then apply section 5.
4. If a passed Worker makes its Reviewer ready, create the Reviewer task with `TaskCreate` when framing did not create it. A Reviewer must inspect independently rather than trust the Worker report. Its prompt must cite spec and plan paths when present, and include acceptance criteria, exact scope, deferred non-findings, changed files, evidence, existing verification commands, and unrelated-change preservation. State when no automated check exists; do not build a validator.
5. After every returned result has been inspected, use `TaskList` to recompute readiness. Dispatch every ready independent task through section 3, including ready Reviewers. Stop when nothing else is ready.

The review gate passes only after every required Reviewer report has been inspected and reports no actionable finding, all applicable checks pass, and no verification blocker or missing evidence remains.

## 5. Correct and repeat

When result inspection returns a Worker or Reviewer task to `pending`, record the location, triggering path, prior Worker report and evidence, Reviewer findings (or their recorded absence), failed checks, blockers, and correction in its description. Keep unrelated successful tasks `completed`. Serialize corrections that share a write scope or mutable verification with another task.

For a failed Reviewer, return the Reviewer to `pending` and create a corresponding correction Worker with `TaskCreate`, or reset an undispatched correction Worker with `TaskUpdate`. Put the original requirements, exact scope, acceptance criteria, verification commands, prior Worker report and evidence, Reviewer findings, failed checks, blockers, triggering path, and recorded correction in the correction Worker's description and prompt. Block the Reviewer on that correction Worker with `addBlockedBy`; do not dispatch the Reviewer until the correction Worker passes result inspection. A passed correction Worker makes that Reviewer ready for a complete re-review of the task scope, not only the correction.

Recompute readiness and dispatch correction Workers and only their unblocked, ready Reviewers through section 3. A correction Worker prompt must cite spec and plan paths when present and name the requirement behind each finding. Start a fresh Worker for each correction; do not resume or rely on the earlier Worker. Use Oracle only when the disagreement or root cause still needs a decision. Repeat until the review gate passes or the user must decide an external issue.

## 6. Report

Before replying, use `TaskList` so task statuses match reality. Every task from this run must be `pending`, `in_progress`, or `completed`; leave unresolved work `pending` with its evidence.

When the review gate passes and every task from this run is completed:

1. Use the specification or plan folder when it lies under `docs/context-engineering/<subject>/`. Otherwise, derive a short subject and use that path.
2. Save `tasks.md` in that folder before deleting anything. Include each task's ID, role, final status, assignment, outcome, verification result, and review verdict. Keep prior `tasks.md` content when appending another run.
3. Read the saved file and confirm that it contains the final task record. If the save or check fails, leave the task list intact and report the error.
4. Delete this run's tasks with `TaskUpdate` and `status: "deleted"`, then confirm with `TaskList` that none of them remain. Never delete unrelated tasks. If a deletion fails, keep the saved file and report which tasks remain.

Do not archive or delete unfinished work as completed. Report the changed behavior, verification results, review findings, remaining issues, and the `tasks.md` path when saved. Do not claim completion without evidence.
