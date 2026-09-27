---
schema_version: 1
artifact: intent
subject: "{{subject}}"
repository_baseline: "{{commit or unavailable}}"
exploration: "{{path or none}}"
created: "{{YYYY-MM-DD}}"
updated: "{{YYYY-MM-DD}}"
---

# {{Subject}} Intent

<!-- Label inferred interpretations as proposed. Keep the label until the user confirms or corrects the interpretation. Preserve sources and open questions. -->

## Initial Request

{{The first user-authored development request, copied verbatim without skill invocation metadata.}}

## Problem

{{The problem in the user's vocabulary, with its source.}}

## Proposed outcome

{{State the Definition of Done in ordinary language: the user-visible result and the signals that show it is complete. Give each statement its source. Leave precise acceptance tests and implementation details to the specification.}}

## Affected users and systems

- {{User group affected and how, with the source.}}
- {{System affected and how: this repository, an external service, a data store, or an integration. Include the source.}}

## Constraints

- {{Constraint the user stated or repository evidence shows, with its source.}}

## Open Questions

- {{Question the user could not resolve or phase 2 owns.}} Consequence: {{what changes with the answer.}}
