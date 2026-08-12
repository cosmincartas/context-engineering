---
name: sdlc
description: Use when the user wants to plan delivery work end to end or in part — clarify or scope a feature request, write a PRD, user stories, or formal requirements, create a technical design or architecture document, produce an implementation plan — or resume a planning topic that was left in progress. Do not use for exploratory questions (use explore) or for executing a validated plan.
---

# SDLC Planning Pipeline

Use ASD-STE100 Simplified Technical English when you ask questions or write output files. Read `references/ste-writing-rules.md` before you write an artifact.

Take one topic through four phases. Each phase produces one validated artifact in the topic folder. The pipeline ends with a validated implementation plan. Execution belongs to other skills.

| Phase | Name | Artifact | Reference |
|---|---|---|---|
| 1 | Context | `context-brief.md` | `references/phase-1-context.md` |
| 2 | Requirements | `prd.md` | `references/phase-2-requirements.md` |
| 3 | Design | `design.md` | `references/phase-3-design.md` |
| 4 | Plan | `plan.md` | `references/phase-4-plan.md` |

## Invariants

These hold in every phase:

- Never write production code. This skill plans; it does not implement.
- Never run `git commit`, create branches, or push changes.
- The artifacts are the state. Save the draft before you ask questions. Update it after each material answer. A stopped session must be resumable from the artifacts alone.
- Facilitate; do not transcribe. Read `references/facilitation-rules.md` before each phase and apply its gates.
- Load only the reference file for the active phase.
- Never inspect, edit, or ask about `.gitignore`. After you save an artifact, you can say exactly: `Consider adding docs/agentic-engineering/ to .gitignore manually.`

## Topic resolution

A topic is one folder: `docs/agentic-engineering/<subject>/`. Use a short kebab-case subject.

1. If the user names no topic, scan `docs/agentic-engineering/*/` and read the frontmatter of the four artifact files. Present a table with subject, active phase, status, and checkpoint. Ask the user to resume a topic or start a new one.
2. If the user names a topic, match it to an existing folder and offer to resume. If no folder matches, create a new topic.
3. If the user supplies an artifact from the old date-based layout (`docs/agentic-engineering/context/`, `prd/`, `specs/`, or `plans/`), copy it unchanged into the topic folder with the standard file name before you continue.

## Phase detection

1. The pipeline order is: `context-brief.md`, `prd.md`, `design.md`, `plan.md`.
2. The active phase is the first artifact that is missing or does not have `status: validated`.
3. Never start phase N+1 while the phase N artifact is not validated.
4. If the user asks for a later phase directly ("write me a PRD"), route through the missing earlier phases. Move quickly when the answers are clear, but do not skip a phase or its gates.

## Staleness chain

Each artifact records the SHA-256 hash of the exact upstream file: `prd.md` records `context_sha256`, `design.md` records `prd_sha256`, and `plan.md` records both `design_sha256` and `prd_sha256`.

- Before phase work and again before validation, compare each recorded hash with the current file. On a mismatch, stop, show the difference, and ask the user how to proceed.
- A change to a validated artifact makes every downstream artifact stale. Say this to the user before you revise a validated artifact. Never silently overwrite one.
- On write failure, report the failure and stop. Never claim that unsaved work is resumable.

## Phase execution

1. Resolve the topic and detect the active phase.
2. Read `references/facilitation-rules.md`, `references/ste-writing-rules.md`, and the active phase reference file.
3. Follow the phase reference fully, including its interaction gates and self-checks.
4. When the user validates the artifact, set `status: validated` and `checkpoint: complete`. Then offer one choice: continue to the next phase now, or stop. The topic resumes later from the artifacts.
5. After phase 4 validates, report the plan path as the input for an external plan-execution skill.
