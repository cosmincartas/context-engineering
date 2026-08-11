---
name: explore
description: Use when the user wants to understand a technical concept, compare options, see code examples, or assess the impact of adopting something in the current repository. Produces an explanation or exploration brief. Do not use when the user has a settled direction and wants requirements, design, or implementation.
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

A request can combine modes. Ask one clarifying question only when the requested outcome is ambiguous enough to change the investigation.

## Workflow

1. **Establish the question.** Restate the question and the requested depth. Do not broaden it into product discovery.
2. **Gather evidence.**
   - For repository-impact questions, inspect the relevant implementation, callers, tests, public contracts, and recent changes.
   - For external technologies, prefer current authoritative documentation and distinguish documented behavior from inference.
   - Label important claims as confirmed, inferred, or unknown when the distinction matters.
3. **Answer the requested modes.**
   - Concept: explain the mechanism, useful applications, limitations, and common failure modes.
   - Impact: name affected entry points, contracts, data, dependencies, tests, operations, security, and migration concerns when applicable.
   - Comparison: include only viable options. Give the strongest relevant advantage and disadvantage of each.
   - Example: provide the smallest idiomatic example. State whether it was executed or is illustrative.
4. **Close without manufacturing work.** Summarize what is known, what remains unknown, and the smallest sensible next step: stop, run a spike, use `clarify`, or proceed to `requirements` after explicit user confirmation.

## Output

Answer in chat by default. When the user asks for a reusable artifact, fill `assets/technical-brief-template.md` and save it to `docs/agentic-engineering/explorations/<YYYY-MM-DD>/<subject>.md`. Ask before overwriting an existing artifact. Mark it `validated` only after the user approves it.

Remove optional sections that do not apply. A concept explanation does not need a repository-impact section. A repository-impact assessment does not need sample code unless the example reduces uncertainty.

## Boundaries

- Do not create a PRD, design document, or implementation plan.
- Do not modify production code, project configuration, dependencies, or tests.
- Do not force multiple options when one factual answer is sufficient.
- Do not present illustrative code as repository-compatible or tested unless you verified it.
- Do not estimate effort unless the user requests it. If requested, state the assumptions and use ranges rather than false precision.
- Never run `git commit`, create branches, or push changes.

## Completion check

Before finishing, make sure that:

- The response answers the user's actual question.
- Repository claims cite concrete files or symbols when applicable.
- External claims use current authoritative evidence when recency matters.
- Examples state whether they were run.
- The next step is optional rather than an assumed commitment to build.
