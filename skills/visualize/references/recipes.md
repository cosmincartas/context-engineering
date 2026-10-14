# Visualize Recipes

Choose one recipe that fits the source and the reader's question. A recipe sets reading order. It does not change source meaning or approval rules.

Keep every source section unless the user asks for a narrower view. A complete view is the default. For a scoped view, list included and omitted sections near the top.

## Explanation or exploration

Use for technical explanations, comparisons, and design explorations.

**Order:** title and source record → purpose and summary → source-supported flow → sequence when time order matters → source excerpts → limits and open questions → source references.

Use a code block only for text that exists in the source. Label proposals and examples as proposals and examples. Do not turn a candidate into an approved decision.

## Specification or requirement review

Use when the source contains a specification or requirement ledger.

**Order:** source record and scope → complete requirements table → approval and evidence → models and contracts → diagrams → verification mapping → open items.

Keep each ID and statement exact. Include its source, selection state, verification, and approval evidence when present. Do not turn prose recommendations into requirements. If no requirement ledger exists, state that and do not create rows.

## Plan review or handover

Use for a plan or implementation handover.

**Order:** source record and scope → outcomes and constraints → exact tasks with IDs and dependencies → milestone grouping only when supported → requirement coverage → verification plan → risks and limits.

A plan describes intended work. Do not show tasks as started or complete without source evidence. Do not add delivery dates, dependencies, progress, production-code listings, or diffs that the plan does not contain.

## Code change or review

Use only when the source contains an actual diff or the user supplies a verified diff.

**Order:** source record and diff basis → exact changed files and diff → source-grounded snippets → review notes → verification evidence and limits.

Do not reconstruct a diff from a summary. Preserve signs, hunk headers, order, and context. Keep code and diff text escaped. Do not claim that a check passed unless the source records its command and result.

## Verification or review report

Use when the source records review findings, accepted IDs, test runs, or other verification evidence.

**Order:** scope and review stage → findings with exact IDs → accepted and unresolved items → commands and observed results → limits and blockers.

Preserve review stages and approval evidence. Do not infer acceptance from silence, completion from a worker exit, or success from a command name.

## Flow and sequence diagrams

Add a flow diagram to explain supported components and data movement. Add a sequence diagram only when source evidence supports ordered interactions.

Use the source's names and direction. Label a proposed or inferred path as such. Keep unknown paths out of the diagram and name relevant omissions in nearby text. Add a written description so the information remains available without the drawing.

## Block selection

- **Code snippet:** use for a short, relevant, exact source excerpt with a path and purpose.
- **Code changes:** use only for a real diff.
- **Milestones:** use only for exact source tasks. Group tasks without changing their IDs or dependencies. Show actual status only from evidence.
- **Requirement table:** use only when the source has requirements. Preserve its traceability fields.
- **Flow diagram:** use when it explains a source-supported path.
- **Sequence diagram:** use when interaction order matters and is supported.

Do not add a block to make the page look complete. Preserve the source instead.
