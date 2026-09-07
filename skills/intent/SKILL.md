---
name: intent
description: Use to transform user request to common understanding.
---

# Goal
Turn an initial development prompt into a shared, user-validated understanding of what the request means, not how to implement it.

# Output
- Output structure contains: Initial Request, Problem, Proposed outcome, Affected users, Constraints and Open Questions according to the template from `./assets/intent-template.md`.
- This phase should be saved under an artifact called `docs/context-engineering/<subject>/intent.md`.

# Workflow
1. Capture initial request.
2. Don't make assumptions.
3. Inspect relevant repository files, docs, tests, and recent commits. State when there is no repository evidence.
4. To establish full understanding on the request, intreview the user in batches of up to four questions that share the same subject.
5. Once you've achieved complete and common understanding of the request, save the artifact with draft status and wait for user approval.
6. Once the user approves the document, change the status to `validated` and save the `intent.md`. 
