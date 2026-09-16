---
name: explore
description: Use when the user wants to understand a technical concept, compare options, see code examples, assess the impact of adopting something in the current repository, or see candidate high-level designs for a request. Produces an explanation or exploration brief. Do not use when the user has a settled direction and wants requirements, design, or implementation.
---

# Explore

Use ASD-STE100 Simplified Technical English when you ask questions or write output files.

Answer a technical question without turning it into a delivery project. The user is learning, comparing, or assessing impact. They have not committed to building anything.

## Modes

Infer only the modes needed by the request:

- **Concept:** Explain how something works and where it is useful.
- **Impact:** Inspect the current repository and identify what adopting the change would affect.
- **Comparison:** Compare realistic options and their trade-offs.
- **Example:** Show the smallest useful code example.
- **Design:** Show one or more candidate high-level designs for a stated request. Use this mode only when the user asks for a design or design options.

A request can combine modes. Ask one clarifying question only when the requested outcome is ambiguous enough to change the investigation.

## Workflow

1. **Establish the question.** Restate the question and the requested depth. Do not broaden it into product discovery.
2. **Gather evidence.**
   - For repository-impact questions, inspect the relevant implementation, callers, tests, public contracts, and recent changes.
   - For external technologies, prefer current authoritative documentation and distinguish documented behavior from inference.
   - For design questions, use the stated request as the framing. When the user supplies an intent artifact, use its Problem, Constraints, and Affected components as evidence. Inspect the components on the trigger-to-outcome path before you draft a candidate.
   - Label important claims as confirmed, inferred, or unknown when the distinction matters.
   - When making a recommendation that depends on current external information:
     - Record the research date and identify the newest relevant viable options. Do not stop at the first plausible option.
     - Prefer primary sources for specifications, versions, pricing, and documented limitations.
     - Cite each externally verifiable factual claim. Clearly distinguish measured evidence, vendor claims, inference, and unknowns.
     - Compare equivalent versions, configurations, workloads, pricing units, and measurement conditions. Explain material mismatches.
     - Compare benchmarks, pricing, latency, and limitations when they are relevant and available. State when comparable data is unavailable.
     - Cross-check material performance or reliability claims against at least one independent benchmark or real-world evaluation. State explicitly when independent evidence is unavailable.
3. **Answer the requested modes.**
   - Concept: explain the mechanism, useful applications, limitations, and common failure modes.
   - Impact: name affected entry points, contracts, data, dependencies, tests, operations, security, and migration concerns when applicable.
   - Comparison: include only viable options. Give the strongest relevant advantage and disadvantage of each.
   - Example: provide the smallest idiomatic example. State whether it was executed or is illustrative.
   - Design: draft the candidates the request needs. One candidate is enough when the evidence points one way. Any two candidates differ in at least one consequential decision: a component boundary, data ownership, sync or async flow, an integration point, or a contract. Do not present cosmetic variants. Give each candidate a name, its key decision, one Mermaid component diagram, component responsibilities, the flow from trigger to outcome, the stated constraints it satisfies or strains, and its strongest advantage and disadvantage. Name existing components as `file:symbol` and mark missing components as new. With more than one candidate, close with a comparison table and a recommendation with reasons. Offer to draft further candidates. When the user asks for another possibility or proposes one, draft it in the same format. Do not write requirements, decision records, or a plan.
4. **Close without manufacturing work.** Summarize what is known, what remains unknown, and the smallest sensible next step: stop, run a named spike, or use `sdlc`. An exploration does not replace the required context phase before delivery work.

## Output

Answer in chat by default. When the user asks for a reusable artifact, fill `assets/technical-brief-template.md` and save it to `docs/agentic-engineering/explorations/<YYYY-MM-DD>/<subject>.md`. Ask before overwriting an existing artifact. Mark it `validated` only after the user approves it.

For Design mode, also write a companion page `docs/agentic-engineering/explorations/<YYYY-MM-DD>/<subject>-designs.html` that renders every candidate side by side. Use one section per candidate with its name, key decision, and diagram. Use inline CSS only. The only script is the Mermaid renderer loaded from a CDN. The page is a supporting file of the brief, not a status-bearing artifact. In chat, show the Mermaid code blocks.

Remove optional sections that do not apply. A concept explanation does not need a repository-impact section. A repository-impact assessment does not need sample code unless the example reduces uncertainty.

## Boundaries

- Do not create a specification or implementation plan.
- Do not modify production code, project configuration, dependencies, or tests.
- Do not force multiple options when one factual answer is sufficient. Design mode is the exception, because the user asked for candidates.
- Do not select a design candidate for the user. Recommend one with reasons. The user decides, and can ask for more candidates.
- Do not present illustrative code as repository-compatible or tested unless you verified it.
- Do not estimate effort unless the user requests it. If requested, state the assumptions and use ranges rather than false precision.
- Never run `git commit`, create branches, or push changes.

## Completion check

Before finishing, make sure that:

- The response answers the user's actual question.
- Repository claims cite concrete files or symbols when applicable.
- External claims use current authoritative evidence when recency matters.
- Current recommendations state the research date and cover the newest relevant viable options.
- Externally verifiable factual claims have citations.
- Vendor claims, independent measurements, inference, and unknowns are clearly distinguished.
- Material comparisons use equivalent conditions or explain why they are not directly comparable.
- Material performance or reliability claims are independently cross-checked, or the lack of independent evidence is stated.
- Examples state whether they were run.
- Any two design candidates differ in one consequential decision. Each candidate cites its components and states its constraint fit.
- The next step is optional rather than an assumed commitment to build.
