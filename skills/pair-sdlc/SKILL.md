---
name: pair-sdlc
description: Use when the user wants to pair on delivery work and review each section, decision, or code change as it is made — clarify a request, write a PRD, create a design, produce a plan, or execute a validated plan together — or resume a paired topic left in progress. Do not use for exploratory questions (use explore) or when the user wants the standard low-touch pipeline (use sdlc).
---

# Pair SDLC Pipeline

Use ASD-STE100 Simplified Technical English when you write output files. Read `references/ste-writing-rules.md` before you write an artifact. Chat stays in natural conversational language.

Take one topic through five phases as a pair. Each planning phase produces one validated artifact in the topic folder; phase 5 executes the validated plan. The pairing rhythm in `references/facilitation-rules.md` applies in every phase: the user reviews each section, decision, and repository change as it is made, never as one large final document.

| Phase | Name | Artifact | Reference |
|---|---|---|---|
| 1 | Context | `context-brief.md` | `references/phase-1-context.md` |
| 2 | Requirements | `prd.md` | `references/phase-2-requirements.md` |
| 3 | Design | `design.md` | `references/phase-3-design.md` |
| 4 | Plan | `plan.md` | `references/phase-4-plan.md` |
| 5 | Execute | `plan.md` (status and evidence) | `references/phase-5-execute.md` |

## Invariants

These hold in every phase:

- Write production code only in phase 5, and only after the user approves the proposed change for the current task. Phases 1 to 4 plan; they do not implement.
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
3. When all four artifacts are validated, the active phase is 5. Phase 5 ends when the plan status is `completed`.
4. Never start phase N+1 while the phase N artifact is not validated.
5. If the user asks for a later phase directly ("write me a PRD", "execute the plan"), route through the missing earlier phases. Move quickly when the answers are clear, but do not skip a phase or its gates.

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
5. After phase 4 validates, offer to continue into phase 5 in this skill, or stop. Phase 5 resumes later from the task statuses in the plan.
