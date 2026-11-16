---
name: slice
description: Cut a feature into small deliverables by architecture layer after intent. Establish requirements, Technology Stack, and a whole-flow HLD with the user. Write an overview and one self-contained slice file per slice as input for design-specs. Do not design inside a slice or plan implementation.
---

# Slice

The user drives this session. Establish the scope and the whole flow of one feature. Then cut the feature into layer slices.
Each slice is one deliverable. `design-specs` and `implementation-plan` run on one slice at a time, and a reviewer can read its result alone.
This skill does not design inside a slice, create plans, or write production code.

## Inputs and output

- Require an intent file. If it is missing, ask for it and stop. Do not start another skill automatically.
- Use the folder of the intent file as the topic folder, for example `docs/context-engineering/<subject>/`.
- Save `overview.md` in the topic folder. Use [assets/overview-template.md](assets/overview-template.md).
- Save one `slices/NN-<name>/slice.md` for each slice. Use [assets/slice-template.md](assets/slice-template.md). `NN` is the delivery order. `<name>` is the layer in kebab-case.
- Later, `design-specs` saves `spec.md` beside a slice file, and `implementation-plan` saves `plan.md` there.
- Read an existing overview and its slice files before writing. Ask before you replace approved content.
- Keep the intent file unchanged. Record intent conflicts and request an explicit decision.
- Never run `git commit`, create branches, push changes, or modify production code, dependencies, or tests.

## Framed ledger

Read the [framed ledger](../design-specs/assets/ledger.md) before the first gate. Do not copy its text.
This skill fills three ledger categories for the whole feature: Requirements, Technology Stack, and Architecture (HLD). The ledger owns their content rules and the rows that a slice file provides.
This skill has no UI gate. `design-specs` reviews UI for the slice that contains it. This skill has no delegated auto mode.

## Evidence and user control

- Inspect relevant implementation, callers, tests, and public contracts before asking questions that repository evidence can answer.
- Identify existing components with `file:symbol`; mark missing components as new. State when repository evidence is unavailable.
- Separate user statements, repository facts, external evidence, inferences, and unknowns.
- Verify uncertain external technology claims with current primary sources. Record source URLs and the research date.
- Highlight conflicts, feasibility limits, security risks, data-loss risks, and compatibility concerns before dependent work. Explain each with its evidence, its consequence, and the smallest suitable alternative.
- Stop dependent work when an unresolved concern changes scope, acceptance, or feasibility. Preserve the user's approach when no concern requires a decision.
- Ask focused questions with `AskUserQuestion` when available. Otherwise, ask in chat.
- Request each gate approval in a chat message only, then end the turn. Do not use a question tool for approval.
- Silence and factual answers are not approval. User approval accepts a choice; it does not verify a technical fact.

## Workflow

### 1. Scope gate

1. Restate the intent without changing its meaning. Present concerns first and resolve blocking concerns before proposals.
2. Propose requirements for the whole feature under the Requirements rules of the ledger.
3. Ask which proposals to include, exclude, or defer. Permit selection by identifier and user amendments. An unresolved selection is neither an inclusion nor an exclusion.
4. Present the resulting scope and request approval. Revise until approved.
5. After approval, save the overview with the Requirements table, the excluded and deferred proposals, and the Scope approval record.

### 2. HLD gate: the whole flow

1. Draft the Technology Stack under the Technology Stack drafting rule of the ledger.
2. Draft the HLD for the whole feature under the Architecture rules of the ledger, with these limits. Do not request approval yet.
   - Draw one Mermaid flowchart. Put the components of each architecture layer in one subgraph.
   - Write the whole flow as numbered steps from the trigger to the observable outcome. Name the component that acts in each step.
   - Record only decisions that affect more than one layer. `design-specs` owns the design inside a layer.
3. Save the draft in the overview before you request approval. Save each revision before you present it.
4. Present the Technology Stack, the diagram, the flow, and the decisions in one chat message, with the overview path.
5. Request approval in chat and end the turn. Revise until approved. Record the HLD approval before the cut.

### 3. Slices gate: the cut

Cut the feature with these rules:

- Cut only at boundaries between architecture layers, for example contracts and domain, storage, migration, services, UI. Use the layers that the repository shows.
- A slice is one layer, or adjacent layers that you merge. Never cut by component, by user story, or inside a layer.
- Each slice must have a check that passes without a later slice. Merge a layer into its neighbor when it has no such check. One slice is a valid result.
- Order the slices so that each slice depends only on earlier slices. The build and the existing tests must pass after each slice.
- Allocate each included requirement to each slice that does a part of it. Each slice must have one or more requirements.
- The last slice of a requirement closes it and uses its overview check. Each earlier slice states its part and a check at its own seam.
- Write one seam contract for each interface that crosses a slice boundary. Each seam has one provider slice.
- State the seam shape as far as a consumer can observe it: names, types, and errors. When a seam changes an existing definition, state a form that keeps existing consumers in operation.

Then present the cut:

1. Change the diagram to one subgraph per slice. Label each arrow that crosses a slice boundary with its seam identifier.
2. Add the slice identifier to each step of the whole flow.
3. Save the draft in the overview. Present these items in one chat message, with the overview path:
   - the diagram and the flow;
   - the slice table in delivery order, with the goal, the dependencies, and the `Done when` check of each slice;
   - the seam contracts and the requirement allocation.
4. Request approval in chat and end the turn. Revise until approved. Record the Slices approval.

### 4. Write the slice files

1. Write the slice files only after the Slices approval.
2. Copy each seam contract from the overview without change into the slice file of its provider and of each consumer.
3. Report the overview path, the slice paths, and the delivery order. Name `design-specs` with the first slice file as the next step. Stop.

## Format rules

- Write one table row per requirement in the overview and one line per requirement in a slice file. Do not add sub-items.
- Write one sentence in each table cell and each field.
- Keep one diagram, in the overview only. Slice files link to it.
- Limit a seam shape to 15 lines. Cite an existing definition as `file:symbol`; do not copy it.
- Link the intent. Do not repeat its text.
- Do not write models, functions, internal interfaces, behavior, or failure models. `design-specs` owns them.
- A slice file with more than 80 lines contains design detail. Remove that detail.

## Corrections and resume

- On resume, read the overview, the slice files, and the intent again. Use saved decisions, not missing conversation history.
- Compare the intent hash with `intent_sha256`. If the intent changed, stop and present the impact before you update the hash.
- Resume from the earliest gate that has no current approval record. Do not infer approval from an existing heading.
- A correction can come from the user or from `design-specs`. Reopen the earliest affected gate: Scope, HLD, or Slices. Mark the affected approval records superseded and obtain approval again.
- Change the overview first. Then write again only the slice files whose content changes. Keep each other slice file byte-identical, because its specification records its hash.
- Name each slice whose file changed. Its `spec.md` and `plan.md` require review.
- Keep the folder name of an approved slice. Record a changed order in the overview only.
- Report write failures and stop. Never claim unsaved work can be resumed.

## Completion checks

- Scope, HLD, and Slices each have a current approval record in the overview.
- Each included requirement is in one or more slices. Each slice has one or more requirements.
- Each seam has one provider and one or more consumers. Its text is identical in the overview and in each slice file that contains it.
- Each slice depends only on earlier slices. Each check in a slice file can pass without a later slice.
- The files obey the format rules. No unused placeholders remain.
