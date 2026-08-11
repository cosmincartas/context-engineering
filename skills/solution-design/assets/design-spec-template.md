# Design Specification: {System name} ("{Short name}")

**Status:** Draft v0.1 · **Owner:** {name} · **PRD:** {prd filename + version, or "no upstream PRD — reconstructed requirements"} · **Last updated:** {YYYY-MM-DD}

---

## 1. Scope and PRD Linkage

{One paragraph: what this document specifies, for which version.}

**Requirements in this document:** {FR-1 to FR-n and NFR-1 to NFR-m, or the explicit list. Name any requirement that this spec does not cover, and say why. Mark reconstructed requirements and provisional requirements (FR-Dn) found during design.}

**Design risks:** {FRs with hunch provenance from the PRD, and what the design does about each. Write "none" if the PRD marks none.}

**Not in this document:** {Deferred items. Point to Section 10.}

---

## 2. Design Rules

These rules come from the NFRs. When two designs are possible, use the design that obeys the rule with the lower number.

- **T1 — {Rule name}.** {The rule as an instruction an implementer can apply alone.} ({NFR IDs})
- **T2 — {…}.** {…} ({…})

{4 to 6 rules, in priority order.}

---

## 3. Contracts

{The formats and interfaces that a second implementation must agree on. These are the public API. Each contract has its own version field.}

### 3.1 `{artifact name}` ({who writes it, when})

| Field | Type | Req | Description |
|---|---|---|---|
| {field} | {type} | ✓ | {One or two short sentences.} |

**Rules that are always true:** {The invariants. Short sentences. For example: "The harness only adds lines. The seq value always increases."}

### 3.2 `{next artifact}` …

{Repeat for each contract. If contracts are data schemas, name the normative machine-checkable files in Appendix A.}

---

## 4. Architecture Overview

{One simple diagram. Components and the contracts between them.}

```
{ascii diagram}
```

{One component writes each artifact. Name the writer of each artifact. Name the components that write nothing.}

## 5. Component Designs

### 5.1 {Component} (`{command or entry point}`)
**Functions:** {Short imperative sentences: what it does.}
**Not functions:** {What it deliberately does not do.}
**Interface:** {Command line or call shape. Exit codes with meanings.}

### 5.2 {…}

## 6. Behavior

### 6.1 {Primary state machine}
{States and transitions. The write sequence at each transition, and the reason for the sequence.}

### 6.2 {Flow name}
Condition: {precondition}.
Plan or steps: {…}.
Result: {postcondition}.

### 6.x {Sudden-stop analysis}
{For each pair of related writes: the write order, the state a sudden stop between them produces, and why that state is recoverable. This section proves the durability NFRs.}

## 7. Failure Model

| # | Failure | Found by | Response |
|---|---|---|---|
| F1 | {failure} | {component} | {designed response, with exit code if applicable} |

{Include at minimum: missing inputs, limit violations, sudden stops, unrecoverable external state, missing optional dependencies, detected corruption.}

## 8. Architecture Decision Records

### ADR-1 — {Decision title}
**Context:** {Which PRD open question, or which new tension.}
**Options:** (a) {…}; (b) {…}; (c) {…}.
**Decision:** ({letter}).
**Reason:** {Why the decision is correct. Also why each rejected option is not correct — with the same specificity. If PRD Appendix A already rejected an option, cite it: "rejected at exploration, PRD Appendix A option (x)". If a rejected option returns, give the new fact that changed the picture.}
**Result:** {The consequences the team accepts.}

### ADR-2 — {…}

{One ADR per PRD open question, plus one per new decision of consequence.}

## 9. Traceability and Test Map

| Req | Design | Test |
|---|---|---|
| FR-1 | {section} | {Imperative procedure. "Do X. Make sure that Y."} |
| NFR-1 | {section} | {…} |

Review rule: If a requirement has no row in this table, do not approve this document. If a design element is not in this table, remove the element or give a reason for it.

## 10. Not in This Version

- **Version 2:** {deferred item + the trigger that promotes it}.
- **Never:** {excluded item + the design rule it would break}.

## Appendix A — Applicable schema files

{The machine-checkable schema files, their location, and the rule: if this document and a schema file do not agree, the schema file is correct.}
