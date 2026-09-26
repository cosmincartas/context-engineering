---
schema_version: 1
artifact: intent
subject: "{{subject}}"
status: draft
repository_baseline: "{{commit or unavailable}}"
exploration: "{{path or none}}"
created: "{{YYYY-MM-DD}}"
updated: "{{YYYY-MM-DD}}"
---

# {{Subject}} Intent

<!-- In drafts, label inferred interpretations as proposed. Complete intent approval confirms those interpretations. Preserve sources and open questions. -->

## Initial Request

{{The first user-authored development request, copied verbatim without skill invocation metadata.}}

## Problem

{{The problem in the user's vocabulary, with its source.}}

## Proposed outcome

{{State the Definition of Done in ordinary language: the user-visible result and the signals that show it is complete. Give each statement its source. Leave precise acceptance tests and implementation details to the specification.}}

## Affected users

- {{Who is affected and how, with the source.}}

## Affected components

- {{Existing component the trigger-to-outcome path crosses, as `file:symbol`, or a new component the outcome implies, marked new. Include the source.}}

## Constraints

- {{Constraint the user stated or repository evidence shows, with its source.}}

## Open Questions

- {{Question the user could not resolve or phase 2 owns.}} Consequence: {{what changes with the answer.}}
