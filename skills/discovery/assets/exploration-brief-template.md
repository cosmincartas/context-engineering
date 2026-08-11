
# Exploration Brief: {Topic}

**Date:** {YYYY-MM-DD} · **Participants:** {who} · **Disposition:** {proceed | spike | park | dissolve}

> This is a working document in ASD-STE100 style. Contradictions, dead ends, and unresolved tension are permitted. That is intentional. The brief keeps the rejected branches. They prevent the same debate again later. This session made no code changes and no commits.

---

## 1. Problem Map

{The candidates for the eventual Problem section — including pains that were judged not to matter.}

| # | Pain | Who feels it | Cost (what, how often) | Cost grows with | Symptom of |
|---|------|--------------|------------------------|-----------------|------------|
| P1 | {pain} | {persona} | {time/money/trust, frequency} | {scale/time/—} | {root Px, or "root"} |
| P2 | {…} | | | | |

{Notes: which pains share a root cause; which are preferences rather than costs.}

## 2. Option Space

{All directions generated, including the null option and at least one cheap option. Rejected options stay here with their reasons.}

### O1 — {Option name} {(status: leading | alive | rejected | null-option)}
- **Sketch:** {one or two lines}
- **Strongest case for:** {specific}
- **Strongest case against:** {equally specific}
- **Rests on:** {assumption IDs from Section 3}
- {If rejected: **Rejected because:** {the specific reason}}

### O2 — {…}

## 3. Assumptions & Unknowns

{The beliefs the options rest on, ranked by blast radius.}

| # | Assumption / unknown | Provenance | Options that die if false | Cost to resolve | Resolution path |
|---|----------------------|------------|---------------------------|-----------------|-----------------|
| A1 | {belief} | {pain report / metric / hunch} | {O1, O3} | {cheap / expensive} | {verify now / PRD open question / spike} |
| A2 | {…} | | | | |

## 4. Deliberate Non-Goals

{Things discussed and explicitly placed out of scope, with reasons — captured at the moment of rejection.}

- {Non-goal} — {reason}
- {…}

## 5. Disposition

**Decision:** {proceed to PRD | spike first | park | dissolve}

{If **proceed**: the chosen direction, the named runner-up, and why the choice can be made now.}
{If **spike**: the assumption under test (Ax), the cheap experiment, its success/failure signal, and what each result implies.}
{If **park**: why not now, what would reopen it, and where this brief lives.}
{If **dissolve**: why there is no real problem — and what pain reports, if any, still need a different home.}

---

## Handoff map (for the requirements-definition skill)

- Section 1 → PRD Problem + Current Behavior
- Chosen direction + Section 4 → PRD Goal (capability + non-goals)
- Leading option's implications → seed material for User Stories
- Section 3 "expensive" rows → PRD Open Questions
- Section 2 rejected options → appendix citable by design-spec ADRs
