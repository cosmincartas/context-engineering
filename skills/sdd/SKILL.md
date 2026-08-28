---
name: sdd
description: Delegates non-trivial feature, bug-fix, and refactoring work through tracked subagents with independent review.
---

# Subagent Driven Development

Orchestrate the work through the task graph and subagents. The main agent frames the task, keeps the graph honest, dispatches leaf agents, and synthesizes results. Subagents do the research, implementation, and review.

## Invariants

- Give every subagent a self-contained prompt. Do not use `inherit_context`.
- Preserve the original requirements through every handoff.
- Use the task tools for non-trivial multi-step work. Create the graph with `TaskCreate`, keep status honest with `TaskUpdate`, leave agent-backed tasks `pending` until `TaskExecute` starts them, and mark tasks `completed` only from evidence.
- Represent any material delegated assignment as a task with `agentType` set to the exact agent type: `Scout`, `Oracle`, `Worker`, or `Reviewer`.
- Prefer `TaskExecute` for the normal SDD flow so task state, dependencies, and outputs stay attached to the graph. Do not assume auto-cascade is enabled; explicitly execute all ready leaf tasks, batching independent tasks together.
- Use direct `Agent` calls only for one-off dispatches that do not deserve a durable task. Use `get_subagent_result` to collect full results and `steer_subagent` to redirect running work.
- Do not duplicate active work. If a task-backed run is stale or wrong, stop it with `TaskStop`, update the task, and rerun it. If a direct agent is salvageable, steer it instead of spawning a twin.
- For an implementation plan, create one tracked `Worker` task per independent implementation slice and preserve the plan's dependency edges; never collapse ready plan tasks into one Worker.
- At every graph transition, recompute all ready leaf tasks and dispatch independent ready Workers together in one `TaskExecute` batch/message. Shared cwd alone does not justify serialization: only overlapping write scopes or shared mutable verification do; add a dependency or keep that work in one cohesive Worker. Do not split a cohesive task merely to increase agent count.
- When review scopes are independent, create one `Reviewer` per corresponding Worker, dependent only on that Worker, and batch all ready Reviewers together in one message.
- Scout and Oracle are optional. Worker and Reviewer are required.
- Worker performs implementation checks. Reviewer performs independent final verification.
- The orchestrator does not modify production files or run final verification.
- Do not commit, push, create branches, or open pull requests unless explicitly requested.

## 1. Frame the task and open the graph

Extract:

- Objective and expected behavior
- Acceptance criteria
- Scope and constraints
- Relevant errors or reproduction steps
- Explicit exclusions
- Required verification commands, when known

Ask the user only when missing information would materially change the implementation.

Use `TaskCreate` to open the smallest graph that covers the remaining work. Default shape:

1. Optional Scout tasks for unanswered investigation questions
2. Optional Oracle task for a real decision
3. Worker tasks for implementation slices, blocked by their applicable investigation, decision, and plan-dependency tasks
4. Corresponding Reviewer tasks, each blocked by its Worker
5. Report task blocked by all required corresponding Reviewer tasks when the orchestration itself needs tracking

Use `TaskList` after every task transition so all ready leaf tasks, not just one next task, are explicit.

This step is complete when a Worker could receive a self-contained assignment and the graph reflects the remaining work.

## 2. Investigate when necessary

Dispatch Scout when code ownership, execution flow, documentation, or affected files are unclear.

For tracked work, create one Scout task per independent question with `agentType: Scout`, then execute the ready tasks together with `TaskExecute`. For a single gating question before the graph is stable, a foreground `Agent` call is acceptable.

The Scout prompt must include:

- The exact question to answer
- Requested breadth
- Known files or symbols
- Required evidence
- A statement that no files may be changed

Treat Scout output as evidence, not as an implementation plan. Synthesize the findings into the Worker or Oracle task instead of forwarding raw output alone.

This step is complete when any uncertainty that would change the implementation has been reduced to written evidence or escalated to Oracle.

## 3. Consult Oracle when necessary

Dispatch Oracle only when:

- A consequential architecture decision remains unresolved
- Several plausible root causes survive investigation
- Security, data integrity, or operational risk is substantial
- Worker and Reviewer disagree on the correct resolution

Use a tracked `Oracle` task when the decision belongs in the graph. Use a one-off `Agent` call only when the answer is immediately gating and no durable task is warranted.

Give Oracle the original requirements, relevant Scout evidence, competing options or hypotheses, and the decision that must be made.

Oracle provides a recommendation. Record the conclusion in the Worker or Reviewer task before continuing.

This step is complete when one implementable recommendation is recorded or an external blocker requires user input.

## 4. Dispatch Worker

Represent each implementation slice as a `Worker` task, preserving its applicable investigation, decision, and plan dependencies.

The Worker assignment must contain:

- Original objective and acceptance criteria
- Relevant Scout or Oracle findings, synthesized by the orchestrator
- Exact scope and constraints
- Known files, symbols, and reproduction steps
- Required tests and repository verification commands
- Explicit exclusions
- A requirement to preserve unrelated changes

Start all independent ready Workers together with `TaskExecute` once unblocked, and use `TaskOutput` to wait for or retrieve each full result.

Worker owns implementation and focused verification.

If Worker reports a blocker or partial result, update the Worker task with `TaskUpdate` and rerun it. Create new Scout or Oracle tasks only when their specialization is actually needed.

This step is complete when Worker reports a changed-file summary and fresh focused verification output.

## 5. Dispatch Reviewer as the final gate

Represent final review for each Worker as a `Reviewer` task. When review scopes are independent, make each Reviewer depend only on its corresponding Worker and execute all ready Reviewers together in one batch/message; if scopes overlap or share mutable verification, add a dependency or keep review cohesive.

The Reviewer assignment must contain:

- The original requirements and acceptance criteria
- The exact review scope or fixed point
- Worker’s changed-file summary
- Relevant Scout or Oracle conclusions
- Required repository verification commands
- A requirement to inspect independently rather than trust Worker’s report

Execute ready Reviewer tasks together and use `TaskOutput` to wait for or retrieve each full result.

The gate passes only when all latest required Reviewer runs pass, each reporting:

1. No actionable findings
2. All applicable verification commands passed
3. No unresolved verification blocker

The orchestrator does not repeat Reviewer’s verification.

## 6. Resolve review findings

When Reviewer reports a defect or failed check:

1. Evaluate whether the finding is concrete and within scope.
2. Update the Worker task with `TaskUpdate`, including the actionable finding, location, triggering path, and verification failure.
3. Re-run Worker, then re-run Reviewer.

If a running direct agent merely needs course correction, use `steer_subagent`. If a task-backed run is wedged or obsolete, stop it with `TaskStop`, update the task, and `TaskExecute` it again.

If the same issue repeats or Worker and Reviewer disagree, dispatch Oracle to adjudicate. Any resulting code change still goes through Worker and then Reviewer.

Continue until the Reviewer gate passes or an external blocker requires user input.

## 7. Report completion

Before replying, make the graph match reality: completed leaf tasks closed, deferred work left visible, and nothing still `in_progress` unless it truly is.

Report:

### Changes
The behavior changed and the files involved.

### Final verification
All required Reviewers' commands and observed results.

### Review
All required Reviewers' final finding statuses.

### Remaining
Residual risks, deferred work, or `None`.

Make completion claims only from evidence from all latest required Reviewer runs.
