# PRD: {Product or feature name} ("{Short name}")

**Status:** Draft v0.1 · **Owner:** {name} · **Last updated:** {YYYY-MM-DD}
**Source brief:** {exploration brief filename + date, or "none — material extracted from conversation"} · **Brief disposition:** {proceed | overruled: {reason}}

---

## 1. Problem

{What hurts today. What the pain costs. Why the cost grows with time or scale. Name no solution here. Short sentences. One idea per sentence.}

## 2. Current Behavior

{What happens today, in neutral language. Bullet points are acceptable here.}

- {How the work is done today.}
- {What data exists and what data is lost.}
- {What happens after a failure or an interruption.}
- {The workarounds that exist, and why they are not sufficient.}

## 3. Goal

{One or two sentences. The capability the product gives. Each clause must answer a sentence in Section 1.}

**Success criteria:**

- {A measurable outcome. Give a number or a binary check.}
- {…}

**Not in this version:**

- {An explicit non-goal.}
- {…}

## 4. User Stories

**US-1 — {Short title}.** {Capability statement: "The {persona} can {goal}. {One sentence of effect or reason.}"}

**US-2 — {Short title}.** {…}

{3 to 8 stories. One goal per story. Stories carry the reason; requirements carry the precision.}

## 5. Functional Requirements

| ID | Requirement | Story |
|----|-------------|-------|
| FR-1 | The {system} must {behavior}. {Split compound behavior into more rows.} | US-1 |
| FR-2 | {…} | {…} |

{Each FR traces to at least one story. Each story has at least one FR. Use "must".}

## 6. Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-1 | {Quality, for example: Speed, Security, Same results} | {A measurable or checkable constraint. Give a number or a binary condition.} |
| NFR-2 | {…} | {…} |

{NFRs cut across stories. Do not trace them to single stories. Do not write them as user stories.}

## 7. Acceptance Criteria

**US-1 (FR-x to FR-y):**
- {Command sentence.} Make sure that {check}.
- {Command sentence.} Make sure that {check}.

**US-2 (FR-x):**
- {…}

{Each criterion is a test procedure: do something, then check something. A person or a machine can run it without interpretation.}

## 8. Open Questions

1. {A decision this PRD does not make. State the options: "X can be (a) … or (b) …. Which is correct for version 1?"}
2. {…}

{These questions become Architecture Decision Records in the design specification.}

## Appendix A — Rejected Options

{Only when an exploration brief supplied them. Copy each rejected option with its reason. Downstream design-spec ADRs cite "Appendix A, option (x)" instead of a new debate.}

- **(a) {Option name}** — Rejected because: {the specific reason from the brief}.
- **(b) {…}** — {…}
