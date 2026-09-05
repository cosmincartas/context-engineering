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

{{The desired outcome and its success signals in ordinary language, with their sources.}}

## Affected users

- {{Who is affected and how, with the source.}}

## Constraints

- {{Constraint the user stated or repository evidence shows, with its source.}}

## Open Questions

- {{Question the user could not resolve or phase 2 owns.}} Consequence: {{what changes with the answer.}}
