---
name: design-specs
description: Create system design specifications from intent and requirements or user stories. The user selects scope and approves UI and architecture before autonomous detail drafting. Stop at the approved specification.
---

# Design Specifications

The user drives this session. Preserve their intent, requirements, vocabulary, and explicit design choices.
Recommend changes when evidence shows concerns. Never replace the user's approach without approval.
This skill creates specifications, not production code or implementation plans.

## Language

Use ASD-STE100 Simplified Technical English for all output, including chat, questions, diagrams, and artifacts.
Use active voice and consistent terms. Limit instruction sentences to 20 words and description sentences to 25 words.
Write requirements with "must", not "shall" or "should". Preserve quoted input, identifiers, and required contract syntax exactly.

## Inputs and output

- Accept an intent file or intent supplied in conversation.
- Accept functional requirements, non-functional requirements, user stories, or any combination.
- If intent is missing, ask for it and stop. Do not start another skill automatically.
- If requirements are absent, derive proposals from the intent. Do not require invented user stories.
- Use an existing topic folder when supplied. Otherwise, confirm a short kebab-case subject.
- Save `spec.md` in the supplied topic folder. Otherwise, use `docs/context-engineering/<subject>/spec.md`.
- Read an existing specification before writing. Ask before replacing it or revising approved content.
- Keep supplied intent files unchanged. Record intent conflicts and request an explicit decision.

## Evidence and user control

- Inspect relevant implementation, callers, tests, and public contracts before asking questions that repository evidence can answer.
- Trace affected paths from trigger to observable outcome. Identify existing components with `file:symbol`; mark missing components as new.
- State when repository evidence is unavailable. Do not present proposed components as existing code.
- Separate user statements, repository facts, external evidence, inferences, and unknowns.
- Verify uncertain external technology claims with current primary sources. Record source URLs and the research date.
- User approval accepts a choice. It does not verify a technical fact.
- Ask focused questions with `AskUserQuestion` when available. Otherwise, ask in chat.
- Group questions only when they share a subject and their answers are independent.
- Highlight conflicts, feasibility limits, security risks, data-loss risks, and compatibility concerns before dependent design work.
- Explain each concern, its evidence, its consequence, and the smallest suitable alternative.
- Preserve the user's approach when no concern requires a decision. Do not manufacture alternatives.
- Stop dependent work when an unresolved concern changes scope, acceptance, or feasibility.
- Silence and factual answers are not approval. Record explicit delegation and stay within its limits.
- Never run `git commit`, create branches, push changes, or modify production code, dependencies, or tests.

## Workflow

### 1. Establish requirements and scope

1. Restate the supplied intent and requirements without changing their meaning.
2. Convert user stories into checkable behaviors. Preserve each story's source and identify inferred acceptance conditions.
3. Present concerns first. Resolve blocking concerns with the user before dependent proposals.
4. Present supplied requirements separately from inferred requirements.
5. Group inferred requirements as **Recommended mandatory** and **Optional**. Each group can be empty.
6. Explain why each recommendation is necessary or useful. State the consequence of excluding it.
7. Treat "Recommended mandatory" as a recommendation, not permission to add scope.
8. Ask the user which proposed requirements to include, exclude, or defer. Permit selection by identifier and user amendments.
9. Confirm the complete resulting scope, including supplied requirements, selected proposals, exclusions, and acceptance conditions.
10. Continue only after scope approval. Do not interpret unresolved selections as exclusions or inclusions.

Give each requirement a stable `FR-*` or `NFR-*` identifier. Preserve supplied identifiers when possible.
Record one observable behavior per FR. Include related edge cases without hiding separate behaviors inside verification.
For each requirement, record its statement, source, recommendation when inferred, selection status, and observable verification.
Selection states are `proposed`, `included`, `excluded`, and `deferred`.
Only included requirements bind the design. Preserve excluded and deferred proposals outside the approved requirements lists.

Consider performance, capacity, security, privacy, availability, recovery, compliance, accessibility, and observability when proposing NFRs.
Use measurable limits or binary checks. Do not invent numeric thresholds; ask the user to approve unsupported candidate limits.
Do not invent legal obligations. Cite applicable evidence and distinguish obligations from recommendations.
If exclusion conflicts with an established obligation or makes the outcome impossible, explain the conflict and request a scope decision.
Never silently remove the concern or include the rejected requirement.

### 2. Establish the framed ledger

After requirements approval, create the draft specification and its ledger.
Review these categories in this order:

| Category | Required treatment | Approval |
|---|---|---|
| UI | Screens, controls, states, inputs, and linked requirements | User approval when applicable |
| Architecture (HLD) | Components, ownership, boundaries, decisions, and flow | User approval |
| Models | Required data structures and invariants | Final specification approval |
| Contracts | Shared formats, producers, consumers, and compatibility | Final specification approval |
| Functions | Entry points, effects, and error behavior | Final specification approval |
| Interfaces or Classes | Required signatures, responsibilities, and boundaries | Final specification approval |
| Behavior | Important flows and state transitions | Final specification approval |
| Failure Model | Relevant failures, detection, response, and verification | Final specification approval |
| Traceability | Included requirements mapped to design and verification | Final specification approval |

Each ledger row records its status, decision or section reference, and any unresolved issue.
Use `open`, `drafted`, `approved`, or `not applicable`. Explain each `not applicable` decision.
Do not mark a category complete merely because it was discussed.
UI and HLD require approval before dependent work. Other applicable categories remain drafted until final approval.
Do not create classes, models, or contracts merely to fill a category.

### 3. Review UI

1. Determine whether the approved scope adds or changes UI.
2. If not, mark UI `not applicable` with a reason. Do not request a meaningless approval.
3. Otherwise, present `UI-*` entries with screens or controls, states, input effects, and related `FR-*` identifiers.
4. Show a suitable mock or wireframe. Cover applicable loading, empty, error, access, and narrow-display states.
5. Explain accessibility behavior and concerns within the approved requirements.
6. Ask the user to approve or change the UI. Revise until approved.
7. Record approval before starting HLD review.

### 4. Review architecture

1. Draft one Mermaid component diagram and explain each component's responsibility.
2. Mark components as unchanged, modified, new, or removed. Cite existing entry points where available.
3. Explain trigger-to-outcome flow, data ownership, interfaces, and trust boundaries.
4. Include deployment, compatibility, cost, and recovery decisions when they affect this system.
5. Record consequential choices, evidence, assumptions, and trade-offs. Preserve explicit user choices unless an approved correction changes them.
6. Reuse existing code, standard libraries, native features, and installed dependencies before proposing new abstractions or dependencies.
7. Justify each new dependency or abstraction with an included requirement and an unmet present need.
8. Present the HLD and consequential decisions together. Ask the user to approve or change them.
9. Record approval before drafting dependent details.

### 5. Draft remaining design autonomously

Take responsibility for the remaining ledger categories after UI and HLD approval.
Do not request routine section approvals. Ask only about blocking unknowns or changes to approved decisions.
Choose reversible details within approved constraints and identify material assumptions in the final review.

- **Models:** Specify required fields, types, ownership, and invariants. Omit incidental private representations.
- **Contracts:** Specify producers, consumers, validation, compatibility, and versioning when applicable. Cite existing definitions instead of duplicating them.
- **Functions:** Describe existing entry points or required responsibilities, inputs, effects, outputs, and errors.
- **Interfaces or Classes:** Specify signatures where correctness or coordination requires them. Do not mandate class-based design.
- **Behavior:** Describe preconditions, ordered interactions, transitions, and observable results. Include interruption recovery when persistent writes require it.
- **Failure Model:** Record relevant failures, detectors, responses, and observable checks. Cover applicable trust-boundary validation and data-loss risks.
- **Traceability:** Map every included FR and NFR to design elements and verification. Link UI entries when applicable.

Use repository-language signatures when exact syntax matters. Replace executable logic with `...`.
Leave private decomposition to implementation unless an approved constraint requires it.
Do not invent design elements without an included requirement or an established repository constraint.

### 6. Validate the specification

1. Check scope, UI, and HLD approvals against the complete draft.
2. Check every ledger category. Explain omitted categories and resolve blocking unknowns.
3. Check every included requirement for a source, observable verification, and design coverage.
4. Check that excluded and deferred requirements did not enter the design.
5. Check that contracts agree with models, interfaces, behavior, and failure responses. Check all output against the language rules.
6. Present the saved path, completed ledger, requirements coverage, and details added after HLD approval.
7. Ask the user to approve the complete specification. Apply corrections and repeat affected checks.
8. Set `status: validated` only after explicit final approval. Mark applicable ledger categories approved.
9. Report the artifact path and stop. Do not generate an implementation plan.

## Artifact structure and continuation

Read [assets/spec-template.md](assets/spec-template.md) before creating the draft specification. Use it as the artifact template.
Fill applicable sections and explain omitted categories in the ledger. Remove template instructions and unused placeholders before final validation.
Preserve requirement identifiers, sources, selection decisions, and approval records. Keep the ledger order defined by this skill.

Record the supplied intent in the artifact when no source file exists. Preserve its meaning and distinguish quotations from synthesis.
Save scope selections and approval records with the draft. Update it after each gate and during autonomous drafting.
Each approval record names the approved content and any explicit delegation. Do not infer approval from an existing heading.
Before requirements approval, keep proposals in conversation. An interruption before that checkpoint requires renewed scope confirmation.

On resume or a conversation branch change, read the artifact and its intent source again.
Use saved decisions, not missing conversation history. Resume from the earliest open or affected gate.
Explain that saved approvals remain authoritative when navigating to older conversation points. Ask before reopening or replacing those decisions.
Compare the repository baseline and inspect relevant working-tree changes. Recheck dependent facts and reopen gates affected by material changes.
Record the current baseline after resolving those changes. State when repository comparison is unavailable.
For file-based intent, compare its current hash with the saved hash before continuing and before final validation.
If the source changed, stop and present the impact. Request approval for affected decisions before updating the recorded hash.
Treat branch summaries as evidence, not approval. Do not overwrite an approved specification with an alternative design without permission.

When a correction changes approved scope, UI, or HLD, reopen the earliest affected gate.
Explain the change and downstream effects. Retain unaffected approvals and obtain approval again for affected decisions.
If the correction changes supplied intent, request an explicit intent revision before dependent work.
When revising a validated specification, warn that dependent plans require review. Set the specification to draft before revision.
Report write failures and stop. Never claim unsaved work can be resumed.
