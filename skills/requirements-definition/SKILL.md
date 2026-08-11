---
name: requirements-definition
description: Write Product Requirements Documents (PRDs) in ASD-STE100 Simplified Technical English, with a fixed structure - Problem, Current Behavior, Goal, User Stories, Functional Requirements, Non-Functional Requirements, Acceptance Criteria, Open Questions - and full traceability between sections. Consumes the exploration brief produced by the discovery skill as its primary input when one exists. Use this skill whenever the user asks for a PRD, a requirements document, a product spec, user stories with acceptance criteria, or asks to formalize a feature idea, tool, workflow, discovery session, or exploration brief into requirements. Also use it when the user asks to review, restructure, or convert an existing requirements document, even if they do not say "PRD".
---

# Requirements Definition

Write a PRD with a fixed section structure, strict traceability rules, and ASD-STE100 Simplified Technical English style. This skill is the second stage of the SDLC document pipeline: `discovery` → **`requirements-definition`** → `solution-design`. It consumes the exploration brief from `discovery` and produces the PRD that `solution-design` consumes.

Like `discovery`, this skill makes no code changes and no commits. It reads code only to make the Current Behavior section correct.

## Input contract: the exploration brief

The primary input is an exploration brief (the output of the `discovery` skill). Resolve the input before you write anything:

**1. A brief exists** (attached, referenced, or present in the conversation). Read it fully, then validate it:

- **Check the disposition.** The disposition must be "proceed".
  - *Proceed:* consume the brief through the handoff map below.
  - *Spike:* tell the user that the brief asks for an experiment first. If the user continues, write the PRD, and put the untested assumption in Open Questions as an explicit risk.
  - *Park* or *dissolve:* stop and ask. A PRD is opposite to the brief's own conclusion. The user must overrule the brief consciously. Record the overrule in the PRD header.
- **Check the direction.** A "proceed" disposition must name a chosen direction and a runner-up. If the direction is missing, ask one question to settle it. Do not guess.

**2. No brief exists.** Say that the PRD will be stronger after a discovery pass, and offer the `discovery` skill. If the user declines, or the conversation already contains the equivalent material (pains, options, a settled direction), extract that material into brief-shaped notes first. Then write the PRD from the notes. The PRD gets provenance in each case.

Do not invent Problem or Current Behavior content that the brief, the code, or the user did not supply. A requirement without provenance is a guess with an ID.

## The handoff map (brief → PRD)

Apply this map mechanically, then refine:

| Brief section | → | PRD section | Transformation |
|---|---|---|---|
| §1 Problem Map | → | §1 Problem | Select the root-cause pains with real costs. Fold symptoms under their roots. Drop the pains with the label "preference", or move them to non-goals. The map was the evidence; the Problem section is the verdict. |
| §1 Problem Map + workaround notes | → | §2 Current Behavior | Describe today in neutral language. Include the workarounds the brief found not sufficient, and the reasons. |
| §5 chosen direction + §4 Deliberate Non-Goals | → | §3 Goal | Each Goal clause must answer a Problem sentence. Brief non-goals become "Not in this version" entries. Keep the reasons. Name the runner-up direction one time here. |
| §2 leading option's implications | → | §4 User Stories | Write the capabilities the chosen direction gives, one goal per story. Do not write stories for the runner-up. |
| §3 assumptions marked "expensive" or "spike" | → | §8 Open Questions | Carry them with their options stated. Assumptions marked "cheap": make sure of them now; do not carry them. |
| §2 rejected options | → | Appendix A | Copy the rejected options with their reasons. Design-spec ADRs cite this appendix. They do not open the debate again. |
| §3 provenance column | → | FR annotations | When an FR rests on an assumption with the provenance "hunch", mark the FR. The reviewer and the design stage must know which requirements stand on ground that is not verified. |

## Workflow

1. Resolve the input per the contract above. If a user interview is necessary, ask only about the Problem and Current Behavior. Do not ask about solution details.
2. Read `references/ste-writing-rules.md`. All prose obeys those rules.
3. Copy `assets/prd-template.md` as the starting file. Keep the section sequence. Do not remove sections. If a section does not apply, write one sentence that says why.
4. Fill the sections in this order: Problem → Current Behavior → Goal → User Stories → FRs → NFRs → Acceptance Criteria → Open Questions → Appendix A. Each section constrains the next one.
5. Run the self-checks (bottom of this file).
6. Write the output to a Markdown file and present it. Do not paste a full PRD into chat.

## Section rules

**Problem.** Say what hurts, what it costs, and why the cost grows. Do not name a solution. Test: if you delete the rest of the document, the Problem section must stay true.

**Current Behavior.** Describe what happens today, in neutral language. Include the workarounds and the reasons they are not sufficient. This section answers the reviewer question "can you not just…?" before a reviewer asks it.

**Goal.** One capability statement, plus measurable success criteria, plus explicit non-goals. Each Goal clause must answer a Problem sentence. A Goal clause with no Problem sentence is scope creep. A Problem sentence with no Goal clause is a pain without an answer — add a clause, or move the pain to the non-goals.

**User Stories.** Short, persona-driven, one goal each. In STE, write capability statements ("The operator can…"), not first-person wishes. Stories carry the reason. They do not carry the precision.

**Functional Requirements.** A table with ID, requirement, and a "traces to" column with story IDs. Use "must". Do not use "shall" or "should" (STE rule). Each FR traces to a minimum of one story. One requirement per row; split compound requirements. Mark the FRs that rest on hunch-provenance assumptions.

**Non-Functional Requirements.** A table with ID, category, requirement. NFRs do not trace to single stories — they cut across stories. Each NFR must be measurable or checkable. "The system must be fast" is not a requirement. "The system compiles a 200,000-token input in less than 5 seconds" is a requirement. Do not write an NFR as a user story.

**Acceptance Criteria.** Group them by story. Write them as test procedures: command sentences plus "Make sure that…" checks. A person or a machine must be able to do each AC without interpretation. ACs gate story completion. Success metrics (in the Goal) measure the product across time. Do not mix the two.

**Open Questions.** Numbered decisions that this PRD does not make, each with its options stated. Sources: the brief's expensive unknowns, plus new decisions found during writing. These become ADRs in the design spec.

**Appendix A — Rejected Options** (only when a brief supplied them). The rejected options with their reasons, copied from the brief. Downstream documents cite "Appendix A, option (x)".

## Self-checks before presenting

- Every FR has a minimum of one story in "traces to". Every story has a minimum of one FR.
- Every Goal clause maps to a Problem sentence, and the opposite.
- No NFR is written as a user story. Every NFR has a number, a limit, or a binary check.
- Every AC starts with a command verb and contains a minimum of one "Make sure that" check.
- The Problem section names no solution component.
- If a brief was consumed: the disposition was "proceed", or the PRD header records a conscious overrule; every "expensive" assumption is in Open Questions; the rejected options are in Appendix A; the hunch-provenance FRs have marks.
- The prose obeys the STE rules (sentence length, approved-word substitutions, "must" for requirements).

If the user asks for standard English instead of STE, keep the structure and all traceability rules. Drop only the STE style constraints.

## Downstream contract

The `solution-design` skill will: put every FR and NFR ID in its scope list, resolve every Open Question as an ADR, and cite Appendix A instead of a new debate on dead branches. Write the PRD so that these three operations are mechanical.
