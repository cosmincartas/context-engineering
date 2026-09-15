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

## Example

<!-- Keep only when requested or when it materially reduces uncertainty. State whether the example was executed. -->

## Unknowns

- {{Unknown and why it matters.}}

## Sources

<!-- Cite each externally verifiable factual claim using numbered references. Prefer primary sources and identify independent sources. -->

1. {{Source title and URL}}

## Suggested Next Step

{{Stop, run a named spike, or use sdlc. This is a recommendation, not a commitment to build. An exploration does not replace the required context phase before delivery work.}}
