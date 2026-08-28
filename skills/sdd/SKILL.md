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
- `Agent` accepts `{ tasks: [{ agent, title, task }] }`. It runs independent batch items synchronously and in parallel. A batch contains at most eight items. The bundled `agent` values are lowercase: `scout`, `oracle`, `worker`, and `reviewer`.

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
```

Use `TaskList` and `TaskGet` to inspect the current work. The orchestrator, not a task API, decides which tasks are ready by reading their text and the latest evidence.

## 2. Investigate when useful

Use a `Scout` task when code ownership, execution flow, documentation, or affected files are unclear. Give it a read-only question, the relevant files, requested evidence, and an instruction not to change files.

Use an `Oracle` task only when a consequential design, security, data-integrity, or competing-root-cause decision remains unresolved. Record its conclusion in the relevant task text before implementation.

Scout and Oracle work may run together when their scopes are independent. Do not create either role when the orchestrator already has enough evidence.

## 3. Dispatch ready work

At each transition, use `TaskList` to recompute readiness from the task text and completed evidence.

1. Identify every ready independent task in the current dispatch group.
2. Use `TaskUpdate` to mark all ready tasks in that group `active`.
3. Build one ordered `Agent` item for each task. Use the task's role as the lowercase `agent` value, a concise `title`, and a self-contained `task` prompt.
4. Keep the ordered task IDs beside the ordered Agent items. Map each returned outcome by its batch position to the corresponding task ID.
5. Use `TaskUpdate` to mark successful tasks `completed`. Return failed tasks to `pending` and record the failure evidence in their task text.
6. Use `TaskList` again before the next transition.

Send independent tasks together in one `Agent` batch. Keep each batch at or below eight items. If more ready work exists than one batch can hold, use another dispatch group after recording the first group's outcomes; never mark unsent work `active`.

A Worker prompt must include the original requirements, its exact scope, relevant evidence, acceptance criteria, verification commands, explicit exclusions, and a requirement to preserve unrelated changes. The Worker owns implementation and focused checks.

## 4. Review the implementation

After a Worker succeeds, its corresponding Reviewer task becomes ready according to the dependency recorded in its text. Create that Reviewer task with `TaskCreate` if it was not created during framing.

Mark every ready corresponding Reviewer `active` with `TaskUpdate`, then send all independent Reviewers together in one `Agent` batch. Preserve the ordered Reviewer task IDs and map outcomes by position. Mark successful reviews `completed`; return unsuccessful reviews to `pending` and record actionable evidence in their task text.

A Reviewer must inspect independently rather than trust the Worker report. Its prompt must include the original requirements, acceptance criteria, exact review scope, changed-file summary, relevant evidence, required verification commands, and the requirement to preserve unrelated changes.

The review gate passes only when every required Reviewer reports no actionable finding, all applicable checks pass, and no verification blocker remains.

## 5. Correct and repeat

When a Worker or Reviewer finds a concrete problem:

1. Record the location, triggering path, evidence, and correction in the affected task text with `TaskUpdate`.
2. Return the affected task to `pending`.
3. Recompute readiness with `TaskList`.
4. Dispatch the corrected Worker, then its corresponding Reviewer, using the same parallel rules.
5. Repeat until the review gate passes or the user must decide an external issue.

Keep unrelated successful tasks `completed`. Serialize any correction that shares a write scope or mutable verification with another task. Use Oracle only when the disagreement or root cause still needs a decision.

## 6. Report

Before replying, use `TaskList` so task statuses match reality. Every task must be `pending`, `active`, or `completed`; leave unresolved work `pending` with its evidence.

Report the changed behavior, the final verification commands and observed results, review findings, and any remaining issue. Do not claim a task is complete without evidence.
