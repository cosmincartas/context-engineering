---
name: quickie
description: Run design-specs and implementation-plan in delegated auto mode from a request or intent file. Produce a validated specification and plan. Ask the user only for disruptive decisions.
---

# Quickie

Run `design-specs`, then `implementation-plan`, in this session. Read both complete skills and their artifact templates. Follow their evidence, design, traceability, freshness, and planning rules. Quickie changes only their interaction gates; it does not implement or execute the plan.

Use their ASD-STE100 language rules for chat and artifacts. Do not start `intent` or create a quick-plan artifact.

## Input and delegation

- Accept the user's request directly, an intent file, or a topic folder. Treat invocation of quickie as delegation for routine scope, UI, HLD, specification, and plan approvals only.
- Preserve explicit user requirements and choices. Derive the shortest subject from the request if no topic folder exists. Do not ask for a separate intent file or subject.
- If the request lacks an observable outcome, ask for that outcome before drafting. Read existing topic artifacts before writing; never overwrite approved content without permission.
- State the delegation and its limits in the specification approval records and the plan approval record. Never claim that the user reviewed content they did not review.

## Disruptive decisions: ask before continuing

Pause at the earliest affected gate. Show evidence, impact, and the smallest viable options. Ask the user when:

- Intent, acceptance, scope, or an explicit user choice needs a material change; alternatives have different user-visible outcomes.
- A design introduces or changes a public contract, persistent format, migration, security or privacy behavior, or creates a material compatibility or data-loss risk not already authorized by the user.
- A consequential dependency, cost, deployment, or architecture choice has realistic alternatives and no clear repository precedent.
- A required fact is unavailable, sources conflict materially, an established obligation conflicts with the request, or the outcome is infeasible.
- Existing approved artifacts require replacement or a source hash has changed in a way that affects approved decisions.

Do not treat routine inferences, UI details, private structure, test selection, or optional enhancements as disruptive. Exclude optional enhancements rather than asking to add scope. Resolve factual questions from repository evidence first. Never infer consent from silence or a factual answer. If the user cancels, stop; retain saved drafts for resumption.

## Flow

1. Inspect relevant code, callers, tests, contracts, and existing artifacts. Separate user input, repository facts, inferences, and unknowns.
2. Run `design-specs` on the supplied intent. In delegated auto mode, include only explicit requirements and necessary implied acceptance conditions. Record optional proposals as excluded or deferred, with reasons. Do not silently add recommended scope. Apply its scope, UI, HLD, and final checks without routine questions; record each gate as approved under this invocation's limited delegation. Ask at the affected gate for a disruptive decision. Save `spec.md` with `status: validated` only after all applicable checks pass.
3. Run `implementation-plan` against that validated specification. Check source hashes and repository freshness. Apply its complete plan checks without routine review questions; record plan approval under the same limited delegation. Ask for a disruptive decision or source correction when needed. Save `plan.md` with `status: validated` only after all checks pass.
4. Report both paths, consequential assumptions, and any excluded optional work. Stop before implementation.

Do not bypass a blocker by labeling it routine. On resume, read the saved artifacts and sources, verify their hashes and approvals, and continue from the earliest incomplete or affected gate. Never run `git commit`, create branches, push changes, or modify production code, tests, dependencies, or project configuration.
