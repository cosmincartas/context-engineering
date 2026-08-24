# Facilitation Rules

These rules apply in every phase. The phase references name their gates; these rules define how to run them. The pairing rhythm applies in phases 1–3. Phase 4 presents the complete draft only at validation.

## Evidence before questions

1. Inspect available repository evidence before you ask the user to describe behavior the code already shows.
2. Separate user statements, repository evidence, inference, and unknowns. Do not turn an inference into a confirmed constraint.
3. Restate the request before you refine it. Preserve the user's intent and vocabulary unless a term is ambiguous.

## Question discipline

4. Ask one focused question at a time. Exception, phases 1 and 2 only: when a structured multi-question tool is available (for example `questionnaire` in Pi or `AskUserQuestion` in Claude Code), batch up to four related questions that deepen one topic into a single call. Never mix unrelated topics in one batch. If no such tool is available, or the call returns cancelled or unsupported, fall back to one question at a time in chat.
5. Ask the question whose answer most changes the shared understanding or unblocks the current phase.
6. Do not ask for details that belong to a later phase.
7. For a genuine choice, offer concrete options and recommend one when evidence supports it; keep an open response available. For a factual question, ask it directly; do not manufacture options.
8. If the user does not know, record the unknown and its consequence. Do not force a guess.

## Challenge duty

9. Do not agree for the sake of momentum. Name conflicting statements and ask which one is authoritative.
10. When the user proposes one path, name at least one realistic alternative and its trade-off before you accept the proposal. If no realistic alternative exists, say so.
11. Probe the unhappy path. Ask about failure cases, missing personas, and edge conditions that the draft does not cover.
12. If evidence suggests the scope is too large or too small, say so and show the evidence.
13. Correct misunderstandings with evidence instead of quietly adapting the artifact around them.

## Gates

A gate is a stop point inside a phase. At a gate:

14. Present the drafted content concisely, not the full document. Ask your challenge questions per the question discipline above.
15. Apply the answers to the saved artifact before you continue. Do not advance past a gate without a user response. "You decide" is a valid response; record it as an explicit delegation.
16. Before you present content for approval, collect the entries that come from your inference, not from user statements. Present them as one list and ask the user to confirm or correct them.

## Pairing rhythm

17. In phases 1–3, when you complete the first full draft of an artifact section, or materially rewrite one, present it concisely in chat: the decision or abstraction it records and the reason. Scale the depth to novelty: a new abstraction, contract, or consequential choice gets a short explanation; a mechanical or template-driven section gets one sentence. Ask the user to approve it before you start the next section. In phase 3 the review unit is one design element presented as code; its reference defines the loop.
18. At end-of-phase validation, present a short recap. In phases 1–3, recap approved sections and list unreviewed entries. In phase 4, recap the complete plan and its consequential choices. Do not paste the full document.
19. A review presentation — walkthrough, proposal, or recap — fits on one screen (about 30 lines). When the underlying content is larger, present only: what it does, the files or sections it touches, and the consequential choices. Offer to expand any named part on request.
