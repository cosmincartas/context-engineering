---
name: design-specs
description: Create system design specifications from intent and requirements or user stories, or from one slice file of the slice skill.
---

# Design Specifications

The user drives this session. Preserve their intent, requirements, vocabulary, and explicit design choices.
Recommend changes when evidence shows concerns. Never replace the user's approach without approval.
This skill creates specifications, not production code or implementation plans.

## Inputs and output

- Accept an intent file, intent supplied in conversation, or one slice file (`artifact: slice`) in place of the intent. For a slice file, apply [Slice input](#slice-input).
- Accept functional requirements, non-functional requirements, user stories, or any combination.
- If intent is missing, ask for it and stop. Do not start another skill automatically.
- If requirements are absent, derive proposals from the intent. Do not require invented user stories.
- Use an existing topic folder when supplied. Otherwise, confirm a short kebab-case subject. In delegated auto mode, derive it from the request.
- Save `spec.md` in the supplied topic folder. Otherwise, use `docs/context-engineering/<subject>/spec.md`.
- When `quickie` invokes this skill, use its limited delegated auto mode. Skip routine approval requests below; keep all evidence and validation checks. All other invocations keep the approval gates.
- Read an existing specification before writing. Ask before you replace it or change its approved scope, UI, or HLD.
- Keep supplied intent files unchanged. Record intent conflicts and request an explicit decision.

## Slice input

A slice file is the output of the `slice` skill for one layer slice of a feature. It replaces the intent as the source of the specification.
These rules apply to slice input only. Without a slice file, this skill does not change.

- Read the slice file and the overview that it names. Do these checks at the start and on resume. If one fails, stop, report it, and name `slice` as the next step:
  - The overview has a current approval record for Scope, for HLD, and for Slices.
  - The `intent_sha256` of the overview matches its intent file.
  - The requirement identifiers and the seam contracts of the slice file agree with the overview.
- Apply the provided-rows rule in [assets/ledger.md](assets/ledger.md). Skip section 1 and the Technology Stack draft in section 2. Do not propose inferred requirements.
- Copy the requirement lines, the Technology Stack entries, and the seam contracts from the slice file without change. For each skipped gate, record the overview approval record as evidence, not a new approval.
- Seam contracts are fixed constraints. Design a provided seam exactly as its contract states. Use a consumed seam only as its contract states. When a consumed seam is not yet in the repository, record it as provided by its slice, not as a new component of this slice.
- Do not add, remove, or change a requirement, a provided Technology Stack entry, or a seam contract. When the design needs such a change, stop, explain it with evidence, and name `slice` as the next step.
- In section 4, design only inside the slice: its components, their responsibilities, and its local decisions. Show the seams as the edges of the diagram. Link the overview for the whole flow; do not repeat it.
- Each verification must pass without a later slice.
- Save `spec.md` beside the slice file. Use the `subject` and `slice` values of the slice file as the subject. Store `intent: "slice.md"` and the hash of the slice file as `intent_sha256`. Keep the slice file and the overview unchanged.

## Evidence and user control

- Inspect relevant implementation, callers, tests, and public contracts before asking questions that repository evidence can answer.
- Trace affected paths from trigger to observable outcome. Identify existing components with `file:symbol`; mark missing components as new.
- State when repository evidence is unavailable. Do not present proposed components as existing code.
- Separate user statements, repository facts, external evidence, inferences, and unknowns.
- Verify uncertain external technology claims with current primary sources. Record source URLs and the research date.
- User approval accepts a choice. It does not verify a technical fact.
- Ask focused questions with `AskUserQuestion` when available. Otherwise, ask in chat.
- Exception: request UI and HLD approval in a chat message only. Do not use `AskUserQuestion` or another question tool.
- Group questions only when they share a subject and their answers are independent.
- Highlight conflicts, feasibility limits, security risks, data-loss risks, and compatibility concerns before dependent design work.
- Explain each concern, its evidence, its consequence, and the smallest suitable alternative.
- Preserve the user's approach when no concern requires a decision. Do not manufacture alternatives.
- Stop dependent work when an unresolved concern changes scope, acceptance, or feasibility.
- Silence and factual answers are not approval. Record explicit delegation and stay within its limits.
- In quickie's delegated auto mode, record the invocation as approval evidence for routine gates only. Ask for disruptive decisions under quickie's rules before dependent work. Never describe delegated approval as direct user review.
- Treat each answer you gave as complete. Focus on the current question.
- Do not repeat or revise an earlier answer unless the user asks about it or identifies a problem with it.
- Never run `git commit`, create branches, push changes, or modify production code, dependencies, or tests.

## Workflow

### 1. Establish requirements and scope

Read [assets/ledger.md](assets/ledger.md) before this step. Its Requirements rules define the requirement content.

1. Restate the supplied intent and requirements without changing their meaning. List the `DoD-*` items of the intent, or derive them under the Requirements rules.
2. Present concerns first, including each `checkable` `DoD-*` item that no requirement covers. Resolve blocking concerns with the user before dependent proposals.
3. Propose requirements under the Requirements rules. Write each verification as a concrete oracle and show the `DoD-*` mapping.
4. Outside delegated auto mode, ask which proposals to include, exclude, or defer. Permit selection by identifier and user amendments.
5. Confirm the resulting scope, including supplied requirements, selected proposals, exclusions, and acceptance conditions.
6. Continue after direct or delegated scope approval. In delegated auto mode, include explicit requirements and necessary implied acceptance conditions. Exclude optional proposals with reasons. Ask about disruptive scope choices.
7. Do not interpret unresolved selections as exclusions or inclusions outside delegated auto mode.

### 2. Establish the framed ledger

After requirements approval, create the draft specification and its ledger.
The ledger asset defines the categories, their order, the row statuses, and the drafting rules for each category.
Draft the Technology Stack category from repository evidence before UI review, including its verification facilities. Present it with the UI, or with the HLD when UI is not applicable.

### 3. Review UI

1. Determine whether the approved scope adds or changes UI.
2. If not, mark UI `not applicable` with a reason. Do not request a meaningless approval.
3. Otherwise, present `UI-*` entries with screens or controls, states, input effects, and related `FR-*` identifiers.
4. Show a suitable mock or wireframe. Cover applicable loading, empty, error, access, and narrow-display states.
5. Explain accessibility behavior and concerns within the approved requirements.
6. Outside delegated auto mode, present the UI and request approval in chat. In delegated auto mode, record the UI decision and continue unless disruptive.
7. Outside delegated auto mode, end the turn and wait for the user's reply. In delegated auto mode, record approval and continue unless a disruptive decision remains.
8. Revise until approved. Present each revision in the same manner.
9. Record direct or delegated approval before starting HLD review.

### 4. Review architecture

1. Draft the HLD under the Architecture rules in [assets/ledger.md](assets/ledger.md).
2. Outside delegated auto mode, present the HLD and request approval in chat. In delegated auto mode, record the HLD decision and continue unless disruptive.
3. Outside delegated auto mode, end the turn and wait for the user's reply. In delegated auto mode, record approval and continue unless a disruptive decision remains.
4. Revise until approved. Present each revision in the same manner.
5. Record approval before drafting dependent details.

### 5. Draft remaining design autonomously

Take responsibility for the remaining ledger categories after UI and HLD approval.
Do not request routine section approvals. Ask only about blocking unknowns or changes to approved decisions.
Choose reversible details within approved constraints and identify material assumptions in the specification review.
Continue when a step does not require user input. Put status notes in the same message as your next action.
Stop and ask only when you cannot continue without the user, or before a destructive action.
Destructive actions include deleting data and changing anything outside this repository.

Draft each remaining category under the drafting rules in [assets/ledger.md](assets/ledger.md).

### 6. Review the specification

1. Check scope, UI, and HLD approvals against the complete draft.
2. Check every ledger category. Explain omitted categories and resolve blocking unknowns.
3. Check every included requirement for a source, a concrete oracle, a verification level, and design coverage. Check that each verification level has a facility in the Technology Stack.
   - Check that every `DoD-*` item maps to included requirements or, for a `human` item, to a review criterion. For slice input, the overview owns this mapping.
   - Check that every Failure Model entry has a test trigger or a reason why it is not testable.
4. Check that excluded and deferred requirements did not enter the design.
5. Check that contracts agree with models, interfaces, behavior, and failure responses.
6. Present the saved path, current ledger, requirements coverage, and details added after HLD approval.
7. Outside delegated auto mode, invite the user to review the specification. Apply corrections and repeat affected checks.
8. In delegated auto mode, record final delegated approval only after all checks pass. Return the path to quickie for planning. Otherwise, report the path and stop.

## Artifact structure and continuation

Read [assets/spec-template.md](assets/spec-template.md) before creating the draft specification. Use it as the artifact template.
Fill applicable sections and explain omitted categories in the ledger. Remove template instructions and unused placeholders before you present the specification for review.
Preserve requirement identifiers, sources, selection decisions, and approval records. Keep the ledger order defined in [assets/ledger.md](assets/ledger.md).

For file-based intent, store `intent` relative to the specification folder; use `intent.md` when both files share that folder.
Resolve supplied paths before converting them. Confirm the stored path resolves to the source before hashing its exact bytes.
Store local supporting-file links relative to the specification folder. Use repository-relative paths for code evidence.
Absolute paths in tool output or clickable chat links do not define the artifact's stored paths.
Record the supplied intent in the artifact when no source file exists. Preserve its meaning and distinguish quotations from synthesis.
Save scope selections and approval records with the draft. Update it after each gate and during autonomous drafting.
Each approval record names the approved content, the invocation or user decision as evidence, and delegation limits. Do not infer approval from an existing heading.
Before requirements approval, keep proposals in conversation. An interruption before that checkpoint requires renewed scope confirmation.

On resume or a conversation branch change, read the artifact and its intent source again.
Use saved decisions, not missing conversation history. Resume from the earliest open or affected gate.
Explain that saved approvals remain authoritative when navigating to older conversation points. Ask before reopening or replacing those decisions.
Compare the repository baseline and inspect relevant working-tree changes. Recheck dependent facts and reopen gates affected by material changes.
Record the current baseline after resolving those changes. State when repository comparison is unavailable.
For file-based intent, compare its current hash with the saved hash before continuing and after corrections.
If the source changed, stop and present the impact. Request approval for affected decisions before updating the recorded hash.
Treat branch summaries as evidence, not approval. Do not overwrite a saved specification with an alternative design without permission.

When a correction changes approved scope, UI, or HLD, reopen the earliest affected gate.
Explain the change and downstream effects. Retain unaffected approvals and obtain approval again for affected decisions.
If the correction changes supplied intent, request an explicit intent revision before dependent work.
When revising a specification that has a dependent plan, warn that the plan requires review.
Report write failures and stop. Never claim unsaved work can be resumed.
