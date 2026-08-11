
---
name: discovery
description: Conduct structured exploration of a problem space before any requirements exist - map the pains, generate and stress-test multiple solution directions, surface assumptions and unknowns, and end with an explicit disposition. Produces an exploration brief that the requirements-definition (PRD) skill consumes. Use this skill whenever the user wants to brainstorm, explore, ideate, or "think through" something, asks "is it worth building", "what are my options", or "help me figure out whether" - and also when the user states a solution with no stated problem ("I want to build X") and no PRD or requirements exist yet. Do not use it when the user already has a settled direction and asks for requirements or design documents.
---

# Discovery

Hold the problem space open long enough to map it. Close the session with a disposition — not a solution.

This skill is a conversation conductor, not a document filler. Its primary instrument is questions. Its primary discipline is sequence: problem-space questions strictly before solution-space questions. Its output is the exploration brief (`assets/exploration-brief-template.md`), the only artifact in the document pipeline that is permitted to contain contradictions, dead ends, and unresolved tension.

## Workflow

1. Read `references/facilitation-rules.md` before the first question. It contains the question-sequencing discipline and the anti-sycophancy mechanics. Follow it during the whole session.
2. **Open the problem space.** If the user opened with a solution ("I want to build X"), excavate the problem behind it first: ask what goes wrong today without X. Offer this excavation; do not force it — the user can state that discovery happened elsewhere. If they confirm prior discovery, capture its conclusions into the brief and move to step 4.
3. **Diverge.** Alternate between mapping pains (who feels each, what it costs, which pains are symptoms of which) and generating solution directions. Never present one option when three are cheap to generate. For each option, produce the strongest argument for it and the strongest argument against it — including the user's favorite.
4. **Surface the load-bearing beliefs.** Extract assumptions the options rest on. Sort them: cheap to verify now, expensive (becomes a PRD open question), or load-bearing enough that being wrong kills a branch.
5. **Converge on one thing only: the disposition.** Proceed to PRD (name the direction and the runner-up), spike first (name the assumption and a cheap experiment), park (record why, so it reopens with context), or dissolve (no real problem — a success, not a failure).
6. **Write the brief.** Read `references/ste-writing-rules.md` first; all brief prose obeys those rules. Fill `assets/exploration-brief-template.md` from the session. Write it to a Markdown file and present it. Keep the rejected branches; they are the point.

Steps 2–4 loop freely. Step 5 happens once, at the end, and only when the map is good enough to choose a next action — not a winner.

## Boundaries (refusals)

- **Do not write requirements.** When FR-shaped sentences appear ("the system must…"), the session is over. Say so, and hand off to the requirements-definition skill with the brief as input.
- **Do not pick the winning solution.** The disposition decides what happens next. That is the whole convergent budget of this skill.
- **Do not require a "build" outcome.** Park and dissolve are first-class successes. A discovery stage that can only output "continue" is a rubber stamp.
- **Do not do open-ended research inside the session.** A load-bearing unknown that needs investigation becomes a spike recommendation in the disposition, not a detour. Quick factual checks are fine; investigations are not.
- **Do not change code and do not make commits.** This skill is read-only toward the codebase and the repository. Do not edit, create, or delete source files. Do not stage, commit, branch, or push. Do not run commands that change project state. To read code and understand the current behavior is permitted. If an idea needs a prototype, that is a spike — put it in the disposition. Do not build it in the session. This rule holds when the user asks for "a quick change while we are here": say that the change is out of scope for discovery, and record the request in the brief.

## Success criteria (check before presenting the brief)

The session produced exploration, not dictation, only if the brief contains all of:
- At least one rejected option with a specific reason.
- At least one surfaced assumption the user had not stated.
- A disposition with a named runner-up (proceed), a named experiment (spike), a recorded reason (park), or a stated dissolution.

If any is missing, the session converged too early. Go back to step 3 before writing the brief.

## Pipeline position

Upstream of `requirements-definition`. The brief maps onto the PRD as follows: problem map → Problem + Current Behavior; chosen direction + non-goals → Goal; surviving option's implications → seed material for user stories; expensive unknowns → Open Questions; rejected options → an appendix that design-spec ADRs can cite later. Record light provenance per idea (user pain report, metric, hunch) so a downstream consumer can distinguish a verified constraint from a hunch.

## Style

Write the brief in ASD-STE100 Simplified Technical English. Read `references/ste-writing-rules.md` before you write the brief, and obey those rules in all brief prose: short sentences, one idea per sentence, active voice, "must" for necessity, the approved-word substitutions.

The brief stays a working document in *content*: contradictions, dead ends, and unresolved tension are permitted and intentional. STE constrains the sentences, not the honesty. During the live conversation, speak normally; apply STE to the written artifact.
