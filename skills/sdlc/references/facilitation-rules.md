# Facilitation Rules

These rules apply in every phase. The phase references name their gates. Use these rules for clarification, approval, and corrections.

## Evidence before questions

- Inspect available repository evidence before you ask the user to describe behavior the code already shows.
- Separate user statements, repository evidence, inference, and unknowns. Do not turn an inference into a confirmed constraint.
- Restate the request before you refine it. Preserve the user's intent and vocabulary unless a term is ambiguous.

## Question discipline

- Use `AskUserQuestion` for every user question. Batch up to four questions that share one subject. Never mix subjects in one batch. Batch design decisions only when they share a subject and no answer changes the options of another question in the batch. If the user cancels, stop the phase and wait for direction.
- Ask the question whose answer most changes the shared understanding or unblocks the current phase.
- Do not ask for details that belong to a later phase.
- For a genuine choice, offer concrete options and recommend one when evidence supports it; keep Other available. For a factual question, include only evidence-backed answers. Use `Unknown` and `Skip` when you need two options, and let the user answer through Other. Do not invent domain answers.
- If the user does not know, record the unknown and its consequence. Do not force a guess.

## Challenge duty

- Do not agree for the sake of momentum. Name conflicting statements. Ask which one is authoritative only when authority remains ambiguous. Route explicit user revisions through the correction rule without redundant clarification.
- Present alternatives when an unresolved choice materially affects scope, acceptance, architecture, compatibility, security, cost, or reversibility. Recommend one using evidence and explain the strongest realistic alternative. Do not manufacture alternatives or reopen settled choices without new evidence. In phase 1, apply this to problem framing only; phase 2 owns solution alternatives.
- Investigate unhappy paths, affected users, and edge conditions. Ask only when an unresolved answer affects the outcome or a consequential decision. Include non-blocking findings in the final recap; apply the correction rule when a finding changes approved content.
- Correct misunderstandings with evidence instead of quietly adapting the artifact around them.

## Gates and stops

A gate or stop is a review point inside a phase.

- Present one concise proposal per gate. Include inferred entries and their sources in that presentation. Approval covers the proposal and its interpretations; do not run separate section or inference approvals. User acceptance does not verify a technical fact.
- A clear response approving the presented content and its consequences satisfies the gate. Do not ask for the same approval again. Apply corrections through the correction rule below.
- Do not advance past a gate without approval or explicit delegation. Silence, cancellation, and answers to factual questions are not approval. "You decide" delegates the named choice; record that delegation and resolve it within its scope.

## Final validation

- In phase 1, present the complete intent for one validation, including proposed interpretations and open questions. Do not seek individual section approvals.
- In phase 2, recap the assembled design, details added since HLD approval, and consequential assumptions. Explain how the completed design satisfies the approved requirements.
- In phase 3, recap the complete plan and its consequential choices. Ask earlier questions only when their answers are needed to draft it.
- Present the saved artifact path with the recap. Requested corrections use the correction rule; do not duplicate approvals already obtained.
- A review presentation fits on one screen, about 30 lines. Summarize what the proposal does, the files or sections it touches, and consequential choices. Include material inferences and concerns. Offer to expand any named part on request.

## Correction rule

When a correction or discovery changes approved content, identify the earliest affected approval:

| What changes | Where approval resumes |
|---|---|
| Problem, intended outcome, affected users, or an intent constraint | Intent validation |
| Scope, functional behavior, quality requirements, or acceptance conditions | Requirements gate |
| UI presentation or interaction within approved requirements | UI gate |
| Architecture, ownership, contracts, or consequential technical decisions | HLD gate |
| Task grouping, order, or verification instructions within the approved spec | Plan validation |
| Wording or private implementation details without semantic impact | No earlier gate; use normal final validation |

1. When several approvals are affected, start with the earliest. Present the change, its reason, and its consequences with enough context to assess them.
2. Obtain approval before continuing dependent work. A response approving an already presented change and its consequences satisfies that approval.
3. Reassess later approvals for consistency. Retain those whose decisions still hold; reopen affected ones in normal phase and gate order. Complete gates that have not yet been approved in that order.
4. When returning to an earlier phase, make it the active phase and read its reference. Revisions to validated artifacts still follow the staleness chain in `SKILL.md`.
5. Apply the approved change to the complete draft and rerun its self-checks before final validation.
