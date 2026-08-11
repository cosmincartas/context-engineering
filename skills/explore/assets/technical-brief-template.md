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

## Repository Impact

<!-- Keep only for repository-specific impact analysis. Cite files and symbols. -->

- **Entry points:**
- **Contracts and data:**
- **Dependencies and operations:**
- **Tests and verification:**
- **Security and migration:**

## Options and Trade-offs

<!-- Keep only when comparison was requested or materially useful. -->

| Option | Advantages | Disadvantages | Best fit |
|---|---|---|---|
| {{option}} | {{specific}} | {{specific}} | {{conditions}} |

## Example

<!-- Keep only when requested or when it materially reduces uncertainty. State whether the example was executed. -->

## Unknowns

- {{Unknown and why it matters.}}

## Suggested Next Step

{{Stop, run a named spike, or use clarify. This is a recommendation, not a commitment to build. An exploration does not replace the required clarification step before delivery work.}}
