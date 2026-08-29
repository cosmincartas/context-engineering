---
name: sdlc
description: Use when the user wants to formalize delivery work, create or resume planning artifacts, or plan a request with open design decisions. Do not use for exploratory questions (use explore).
---

# SDLC Pipeline

Write artifacts in ASD-STE100 Simplified Technical English: sentences of at most 20 words (instructions) or 25 (descriptions), active voice, imperative for steps, one meaning for each word, requirements use "must" (never "shall" or "should"). Chat stays in natural conversational language.

Take one topic through four phases. Each phase produces one validated artifact in the topic folder. The pipeline ends with a validated implementation plan; execution belongs to other skills. The pairing rhythm in `references/facilitation-rules.md` applies in phases 1–2. Phase 3 reviews the HLD first, then uses pair mode or proposal mode. Phase 4 presents the complete plan for validation.

| Phase | Name | Artifact | Reference |
|---|---|---|---|
| 1 | Context | `context-brief.md` | `references/phase-1-context.md` |
| 2 | Requirements | `prd.md` | `references/phase-2-requirements.md` |
| 3 | Design | `design.md` | `references/phase-3-design.md` |
| 4 | Plan | `plan.md` | `references/phase-4-plan.md` |

## Invariants

These hold in every phase:

- Use Scout for repository evidence in phases 1, 3, and 4 whenever Scout is available. If Scout is unavailable, perform that work locally.
- In phase 3, use Oracle for consequential design decisions whenever Oracle is available, before proposing each decision. If Oracle is unavailable, resolve the decision locally.
- Never use Worker or Reviewer during SDLC planning, including as fallbacks for unavailable Scout or Oracle.
- Never write production code. This skill plans; it does not implement. In `design.md`, show implementation-shaped skeletons in the repository language. Preserve concrete owners, framework metadata, dependency wiring, fields, and method signatures. Keep structural bodies when they show required wiring. Replace executable logic with `...`.
- Never run `git commit`, create branches, or push changes.
- Validated artifacts are the state. Work each phase in conversation; write the artifact file once, when you present it for validation, with `status: draft`. Set `status: validated` when the user approves. A session interrupted before the write restarts its phase from the validated upstream artifacts; do not reconstruct partial phase work from chat history.
- Facilitate; do not transcribe. Read `references/facilitation-rules.md` before each phase and apply its gates.
- Load only the reference file for the active phase.
- Never inspect, edit, or ask about `.gitignore`. After you save an artifact, you can say exactly: `Consider adding docs/agentic-engineering/ to .gitignore manually.`

## Topic resolution

A topic is one folder: `docs/agentic-engineering/<subject>/`. Use a short kebab-case subject.

1. If the user names no topic, scan `docs/agentic-engineering/*/` and read the frontmatter of the four artifact files. Present a table with subject, active phase, and status. Ask the user to resume a topic or start a new one.
2. If the user names a topic, match it to an existing folder and offer to resume. If no folder matches, create a new topic.

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
2. Read `references/facilitation-rules.md` and the active phase reference file.
3. Follow the phase reference fully, including its interaction gates and self-checks.
4. When the user validates the artifact, set `status: validated`. Then offer one choice: continue to the next phase now, or stop. The topic resumes later from the artifacts.
5. After phase 4 validates, report the plan path as the input for an external plan-execution skill.
