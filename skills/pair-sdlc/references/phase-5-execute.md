# Phase 5 — Execute

Execute the validated implementation plan as a pair. The user approves every repository change before you apply it. The plan's own Execution Protocol governs task order, TDD, and bookkeeping; this reference adds the pairing interaction.

## Input contract

1. Require `docs/agentic-engineering/<subject>/plan.md` with `artifact: implementation-plan` and a status of `validated`, `executing`, or `blocked`. If it is a draft, return to phase 4.
2. Follow the plan's Execution Protocol fully, including its hash-chain verification. Stop on any missing link or mismatch.
3. Compare the current repository with the plan's Repository Findings. Stop and ask on material drift.

## Session start

1. Before the first task of each session, present a short orientation: the key abstractions the work touches from the design, the task order and current statuses, and what completion looks like. Keep it under one screen.
2. Resume the single `In Progress` task. Otherwise take the first task in plan order whose status is not `Done`.

## Task loop

Run this loop for one task at a time:

1. Announce the task: its expected behavior, entry point, requirement identifiers, and dependencies.
2. Explain your intended approach and the abstraction it touches. Scale the depth to novelty per pairing rule 25.
3. Propose the change concisely: its intent, the files it touches, and the key interface or behavior changes. Include the full diff only when it fits pairing rule 29; otherwise show the RED test in full (it is the behavioral contract) and summarize the implementation per file, expanding any file on request. Do not change a repository file yet.
4. Ask the user to approve the proposal. Apply requested amendments and present the revised proposal. Do not apply anything without an explicit approval.
5. Apply the approved change in TDD order: add the test, run it, and show the RED failure; apply the implementation and show GREEN; refactor while tests stay green. If observed behavior differs from the proposal, stop and show the difference.
6. Run the task's verification and show the result.
7. Record the execution evidence in the plan and set the task status. Set `Blocked` with a reason instead of guessing.
8. Offer one choice: continue to the next task now, or stop. The plan resumes later from its task statuses.

## Deviations

- If the approved proposal stops matching reality during application — a failing assumption, a missing symbol, a conflicting test — stop, show the evidence, and re-propose.
- If the work exposes a defect in the plan or the design, stop and name it. A plan change follows the phase 4 rules. A design change makes downstream artifacts stale per the staleness chain.
- Never run `git commit`, create branches, or push changes without the user's explicit consent.

## Completion

When every task is `Done`, set the plan status to `completed` and present a short recap: the changed files, the verification evidence, and any deferred items.
