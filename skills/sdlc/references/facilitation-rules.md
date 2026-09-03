# Facilitation Rules

These rules apply in every phase. The phase references name their gates; these rules define how to run them. The pairing rhythm applies in phase 1, before the phase 2 architecture proposal, and in pair mode. Phase 2 reviews architecture decisions and their resulting HLD together before mode selection. Proposal mode and phase 3 present the remaining draft only at validation.

## Evidence before questions

1. Inspect available repository evidence before you ask the user to describe behavior the code already shows.
2. Separate user statements, repository evidence, inference, and unknowns. Do not turn an inference into a confirmed constraint.
3. Restate the request before you refine it. Preserve the user's intent and vocabulary unless a term is ambiguous.

## Question discipline

4. Use `AskUserQuestion` for every user question. Batch up to four questions that share one subject. Never mix subjects in one batch. Batch design decisions only when they share a subject and no answer changes the options of another question in the batch. If the user cancels, stop the phase and wait for direction.
5. Ask the question whose answer most changes the shared understanding or unblocks the current phase.
6. Do not ask for details that belong to a later phase.
7. For a genuine choice, offer concrete options and recommend one when evidence supports it; keep Other available. For a factual question, include only evidence-backed answers. Use `Unknown` and `Skip` when you need two options, and let the user answer through Other. Do not invent domain answers.
8. If the user does not know, record the unknown and its consequence. Do not force a guess.

## Challenge duty

9. Do not agree for the sake of momentum. Name conflicting statements and ask which one is authoritative.
10. When the user proposes one path, name at least one realistic alternative and its trade-off before you accept the proposal. If no realistic alternative exists, say so. In phase 1, apply this to problem framing only, never to a proposed solution.
11. Probe the unhappy path. Ask about uncovered failures, personas, and edge conditions. In proposal mode, include non-blocking findings in the final proposal.
13. Correct misunderstandings with evidence instead of quietly adapting the artifact around them.

## Gates and stops

A gate or stop is a review point inside a phase. At a gate or stop:

14. Present the drafted content concisely, not the full document. Ask your challenge questions per the question discipline above. This presentation is the rule-17 section review for every section the gate covers; do not run a separate approval round for those sections before or after the gate.
15. Apply the answers to the working draft before you continue. Do not advance past a gate without a user response. "You decide" is a valid response; record it as an explicit delegation.
16. Before you present content for approval, collect the entries that come from your inference, not from user statements. Present them as one list and ask the user to confirm or correct them.

## Pairing rhythm

17. In phase 1, before the phase 2 architecture proposal, and in pair mode, present each completed section concisely in chat. State its decision or abstraction and the reason. Give new abstractions, contracts, and consequential choices a short explanation. Give mechanical sections one sentence. Ask the user to approve each section before you continue. In pair mode, review one complete design element or one minor-element batch.
18. At end-of-phase validation, present a short recap. In phase 1 and in phase 2 pair mode, recap approved sections and list unreviewed entries. In proposal mode and phase 3, recap the complete proposal and its consequential choices. Do not paste the full document.
19. A review presentation — walkthrough, proposal, or recap — fits on one screen (about 30 lines). When the underlying content is larger, present only: what it does, the files or sections it touches, and the consequential choices. Offer to expand any named part on request.
