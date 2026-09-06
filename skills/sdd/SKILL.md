---
name: sdd
description: Delegates non-trivial work through tracked tasks, parallel agents, and independent review.
---

# Subagent Driven Development

Use the task tools to coordinate implementation and review. The orchestrator owns readiness, dependency decisions, and the correction loop. Agents investigate, implement, and review the work assigned in their prompts.

## Supported tools

This package provides only these orchestration tools:

- `TaskCreate` accepts `{ text }` and creates a task with status `pending`.
- `TaskUpdate` accepts `{ id, text?, status? }`. Its status values are `pending`, `active`, and `completed`.
- `TaskList` accepts `{}` and returns every task for the current session.
- `TaskGet` accepts `{ id }` and returns one task for the current session.
- `Agent` accepts `{ tasks: [{ agent, title, task }] }`. It returns at once with a started stub for each valid item. Each started stub includes a run id. Each child later sends one `subagent-result` completion message with that run id and its report. A batch contains at most eight items. The bundled `agent` values are lowercase: `scout`, `oracle`, `worker`, and `reviewer`.

Keep task objects to the fields supplied by these tools. Put role, dependency, scope, and evidence information in the task's `text`; do not add task fields or invent a scheduler or structured dependency API.

## Invariants

- Preserve the original requirements in every task text and agent prompt.
- Give every Agent item a self-contained `title` and `task` prompt.
- Use `Worker` for implementation and `Reviewer` for independent verification. Worker and Reviewer are required. Scout and Oracle are optional.
- Keep independent work parallel. Tasks that share a write scope or mutable verification must be serialized. Shared working-directory access alone does not require serialization.
- Do not commit, push, create branches, or open pull requests unless the user explicitly requests it.
- Preserve unrelated user changes.

## 1. Frame the work

Extract the objective, acceptance criteria, constraints, relevant files, reproduction steps, explicit exclusions, and required verification commands.

Create the smallest useful set of tasks with `TaskCreate`. Create one task for each independent assignment. Include a simple readable record in each task's text, for example:

```text
Role: Worker
Dependencies: none
Scope: extensions/example/index.ts
Acceptance: ...
Verification: ...
Run: none
```

Use `TaskList` and `TaskGet` to inspect the current work. The orchestrator, not a task API, decides which tasks are ready by reading their text and the latest evidence.

## 2. Investigate when useful

Use a `Scout` task when code ownership, execution flow, documentation, or affected files are unclear. Give it a read-only question, the relevant files, requested evidence, and an instruction not to change files.

Use an `Oracle` task only when a consequential design, security, data-integrity, or competing-root-cause decision remains unresolved. Record its conclusion in the relevant task text before implementation.

Scout and Oracle work may run together when their scopes are independent. Do not create either role when the orchestrator already has enough evidence.

## 3. Dispatch ready work

Use `TaskList` to recompute readiness from task text and completed evidence. Identify every ready independent task. Split more than eight ready tasks into batches of at most eight. Mark each batch `active` immediately before its `Agent` call; never mark unsent work `active`.

Build one `Agent` item for each task. Use the task role as the lowercase `agent` value, a concise `title`, and a self-contained `task` prompt. When `Agent` returns its started stub, record `Run: <runId>` in each matching started task's text with `TaskUpdate`. Do not map later completion messages by batch position. If an item is `malformed` or `over-limit`, return that task to `pending` and record the reason as evidence. It is not ready again until its request or batch is corrected; redispatch the corrected item, or record an external blocker and end the turn. Never retry an unchanged malformed or over-limit item.

Send every ready batch before ending the turn. End the turn when nothing is ready; completion messages wake the orchestrator later.

A Worker prompt must include the original requirements, its exact scope, relevant evidence, acceptance criteria, verification commands, explicit exclusions, and a requirement to preserve unrelated changes. The Worker owns implementation and focused checks.

## 4. Process completion messages

On every `subagent-result` message:

1. Read its `runId`. Use `TaskList` and `TaskGet` to find the one task whose text has the matching `Run: <runId>` line. Do not use batch position.
2. Inspect the report against that task's acceptance criteria and required checks. A normal child exit (`succeeded`) is process evidence only, not task success.
3. Mark the task `completed` only when the report supports a passing verdict, all applicable checks pass, and no blocker, actionable finding, or missing evidence remains. Otherwise return it to `pending`, record the report, failed checks, blockers, actionable findings, and missing or ambiguous evidence, then apply section 5.
4. If a passed Worker makes its Reviewer ready, create the Reviewer task with `TaskCreate` when framing did not create it. A Reviewer must inspect independently rather than trust the Worker report. Its prompt must cite spec and plan paths when present, and include acceptance criteria, exact scope, deferred non-findings, changed files, evidence, existing verification commands, and unrelated-change preservation. State when no automated check exists; do not build a validator.
5. Use `TaskList` to recompute readiness. Dispatch every ready independent task through section 3, including ready Reviewers. End the turn when nothing else is ready.

The review gate passes only after every required Reviewer report has been inspected and reports no actionable finding, all applicable checks pass, and no verification blocker or missing evidence remains.

## 5. Correct and repeat

When completion inspection returns a Worker or Reviewer task to `pending`, record the location, triggering path, prior Worker report/evidence, Reviewer findings (or recorded absence), failed checks, blockers, and correction in its text. Keep unrelated successful tasks `completed`. Serialize corrections that share a write scope or mutable verification with another task.

For a failed Reviewer, return the Reviewer to `pending` and create a corresponding correction Worker with `TaskCreate`, or reset an undispatched correction Worker with `TaskUpdate`. Put the original requirements, exact scope, acceptance criteria, verification commands, prior Worker report/evidence, Reviewer findings, failed checks, blockers, triggering path, and recorded correction in the correction Worker's text and prompt. Replace the Reviewer's dependency in its text with that correction Worker and mark it blocked; do not dispatch the Reviewer until the correction Worker passes completion inspection. A passed correction Worker makes that Reviewer ready for a complete re-review of the task scope, not only the correction.

That wake-up recomputes readiness and dispatches correction Workers and only their unblocked, ready Reviewers through section 3. A correction Worker prompt must cite spec and plan paths when present and name the requirement behind each finding. Do not resume or rely on the exited Worker session. Use Oracle only when the disagreement or root cause still needs a decision. Repeat until the review gate passes or the user must decide an external issue.

## 6. Report

Before replying, use `TaskList` so task statuses match reality. Every task must be `pending`, `active`, or `completed`; leave unresolved work `pending` with its evidence.

Report the changed behavior, the final verification commands and observed results, review findings, and any remaining issue. Do not claim a task is complete without evidence.
