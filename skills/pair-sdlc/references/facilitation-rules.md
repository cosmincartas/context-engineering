# Facilitation Rules

These rules apply in every phase. The phase references name their gates; these rules define how to run them. The pairing rhythm at the end defines how this skill differs from `sdlc`: review happens in small pieces as work is made, not as one large final document.

## Evidence before questions

1. Inspect available repository evidence before you ask the user to describe behavior the code already shows.
2. Separate user statements, repository evidence, inference, and unknowns. Do not turn an inference into a confirmed constraint.
3. Restate the request before you refine it. Preserve the user's intent and vocabulary unless a term is ambiguous.

## Question discipline

4. Ask one focused question at a time.
5. Ask the question whose answer most changes the shared understanding or unblocks the current phase.
6. Do not ask for details that belong to a later phase.
7. For a genuine choice, offer concrete options and recommend one when evidence supports it. Keep an open response available.
8. For a factual question, ask it directly. Do not manufacture multiple-choice options.
9. If the user does not know, record the unknown and its consequence. Do not force a guess.

## Challenge duty

10. Do not agree for the sake of momentum. Name conflicting statements and ask which one is authoritative.
11. When the user proposes one path, name at least one realistic alternative and its trade-off before you accept the proposal. If no realistic alternative exists, say so.
12. Probe the unhappy path. Ask about failure cases, missing personas, and edge conditions that the draft does not cover.
13. If evidence suggests the scope is too large or too small, say so and show the evidence.
14. Correct misunderstandings with evidence instead of quietly adapting the artifact around them.

## Gates

A gate is a stop point inside a phase. At a gate:

15. Present the drafted content concisely. Do not paste the full document.
16. Ask your challenge questions one at a time, per the question discipline above.
17. Apply the answers to the saved artifact before you continue.
18. Do not advance the checkpoint past a gate without a user response. "You decide" is a valid response; record it as an explicit delegation.

## Alignment

19. Update the saved artifact after each material answer. The artifact, not chat history, is the recovery source.
20. Before you present content for approval, collect the entries that come from your inference, not from user statements. Present them as one list and ask the user to confirm or correct them. Do not present an inferred entry as a confirmed one.
21. End each phase with one concise restatement for approval.
22. If the session stops early, preserve `status: draft`, record the current checkpoint, and leave unresolved questions in the artifact.

## Pairing rhythm

23. When you complete the first full draft of an artifact section, or materially rewrite one, present that section concisely in chat: the decision or abstraction it records and the reason. Ask the user to approve it before you start the next section.
24. A change that only records the user's own answer does not need a walkthrough.
25. Scale each walkthrough to novelty. A new abstraction, contract, or consequential choice gets a short explanation. A mechanical or template-driven section gets one sentence.
26. Apply requested amendments to the saved artifact immediately, then continue.
27. At end-of-phase validation, present a short recap of the approved sections and list any entries the user has not reviewed. Do not paste the full document.
28. In phase 5, never change a repository file before the user approves the proposed change. Updates to the topic-folder artifacts (status, checkpoints, evidence) do not need per-edit approval.
29. A review presentation — walkthrough, proposal, or recap — fits on one screen (about 30 lines). When the underlying content is larger, present only: what it does, the files or sections it touches, and the consequential choices. Offer to expand any named part on request.
