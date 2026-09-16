---
schema_version: 1
artifact: technical-exploration
subject: "{{subject}}"
status: draft
repository_baseline: "{{commit or unavailable}}"
created: "{{YYYY-MM-DD}}"
updated: "{{YYYY-MM-DD}}"
---

# {{Subject}} Technical Exploration

## Question

{{The question this exploration answers and the requested depth.}}

## Findings

{{The evidence-backed explanation. Distinguish confirmed facts, inferences, and unknowns when it matters.}}

## Research Validation

<!-- Keep for recommendations based on current external information. -->

- **Research date:** {{YYYY-MM-DD}}
- **Option-discovery scope:** {{How the newest relevant viable options were identified.}}
- **Primary sources:** {{Specifications, versions, pricing, and documented limitations.}}
- **Independent evidence:** {{Benchmark or real-world evaluation, or state that none was available.}}
- **Comparability:** {{Versions, configurations, workloads, pricing units, and material mismatches.}}

## Repository Impact

<!-- Keep only for repository-specific impact analysis. Cite files and symbols. -->

- **Entry points:**
- **Contracts and data:**
- **Dependencies and operations:**
- **Tests and verification:**
- **Security and migration:**

## Options and Trade-offs

<!-- Keep only when comparison was requested or materially useful. -->

| Option and version | Price | Performance or latency | Limitations | Evidence | Best fit |
|---|---:|---|---|---|---|
| {{option}} | {{comparable unit or unavailable}} | {{measurement and conditions}} | {{specific}} | {{vendor, independent, inferred, or unknown}} | {{conditions}} |

## Candidate Designs

<!-- Keep only for Design mode. One candidate block per candidate. Any two candidates differ in one consequential decision. Diagrams also render side by side in <subject>-designs.html. -->

**Framing source:** {{The stated request, and the intent artifact path when the user supplied one.}}

### Candidate A: {{name}}

- **Key decision:** {{The consequential decision that sets this candidate apart.}}

```mermaid
{{Component diagram. Existing components as file:symbol; missing components marked new.}}
```

- **Responsibilities:** {{One line per component.}}
- **Flow:** {{Trigger to outcome across the components.}}
- **Constraint fit:** {{Stated constraints satisfied; constraints strained.}}
- **Strongest advantage:** {{specific}}
- **Strongest disadvantage:** {{specific}}

### Candidate B: {{name}}

<!-- Repeat one block per further candidate, or remove this block when one candidate is enough. -->

{{Same structure.}}

### Comparison

<!-- Keep only with more than one candidate. -->

| Candidate | Key decision | Constraint fit | New components | Strongest advantage | Strongest disadvantage |
|---|---|---|---|---|---|
| A | {{decision}} | {{fit}} | {{count or names}} | {{advantage}} | {{disadvantage}} |
| B | {{decision}} | {{fit}} | {{count or names}} | {{advantage}} | {{disadvantage}} |

**Recommendation:** {{Candidate and reasons. This is a recommendation; the user decides and can ask for further candidates.}}

## Example

<!-- Keep only when requested or when it materially reduces uncertainty. State whether the example was executed. -->

## Unknowns

- {{Unknown and why it matters.}}

## Sources

<!-- Cite each externally verifiable factual claim using numbered references. Prefer primary sources and identify independent sources. -->

1. {{Source title and URL}}

## Suggested Next Step

{{Stop, run a named spike, or use sdlc. This is a recommendation, not a commitment to build. An exploration does not replace the required context phase before delivery work.}}
