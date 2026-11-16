---
schema_version: 1
artifact: slice
subject: "{{subject}}"
slice: "{{NN-name}}"
overview: "../../overview.md"
created: "{{YYYY-MM-DD}}"
updated: "{{YYYY-MM-DD}}"
---

# {{Subject}}: slice {{NN-name}}

<!-- Remove template instructions and unused example entries from the completed slice file. -->
<!-- This file is the complete input of design-specs for this slice. Only the slice skill changes it. -->
<!-- One sentence in each field. No sub-items. No diagram. No design inside the slice. -->

- **Overview:** [overview.md](../../overview.md) (whole flow, all slices, approval records)
- **Layer:** {{one layer, or merged adjacent layers}}
- **Goal:** {{what exists after this slice}}
- **Depends on:** {{slice identifiers that must be done first, or none}}
- **Done when:** {{one command or observation at a seam that this slice provides, or at the external entry point; it passes without a later slice, and the build and the existing tests stay green}}

## Requirements

<!-- One line per requirement. Use the overview identifiers. Each check must pass without a later slice. -->
<!-- "closes here": copy the requirement and its check from the overview. "part": state only what this layer does, with a check at this slice's seam. -->

- **FR-1** (part, closes in `{{NN-name}}`) — This slice must {{one checkable behavior of this layer}}. Check: {{observable action and expected result at this slice's seam}}.
- **FR-2** (closes here) — The system must {{requirement from the overview}}. Check: {{check from the overview}}.
- **NFR-1** ({{part, closes in `NN-name`; or closes here}}) — {{measurable limit or binary condition for this layer}}. Check: {{observable action and expected result}}.

## Technology Stack

<!-- Only the overview entries that this slice uses. -->

- **{{entry}}** {{version}} — {{existing or new}}; {{use in this slice}}. Evidence: {{manifest or lock file, or source URL}}.

## Seam contracts

<!-- Copies of the overview entries, without change. design-specs treats them as fixed constraints. -->

### Provides

{{Copy of each `SEAM-*` entry that names this slice as Provider, or "None".}}

### Consumes

{{Copy of each `SEAM-*` entry that names this slice as a Consumer, or "None".}}
