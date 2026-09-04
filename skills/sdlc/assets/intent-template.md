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

## Initial Request

{{The first user-authored development request, copied verbatim without skill invocation metadata.}}

## Problem

{{The problem in the user's vocabulary, confirmed by the user.}}

## Proposed outcome

{{The desired outcome and its success signals in ordinary language, confirmed by the user.}}

## Affected users

- {{Who is affected and how.}}

## Constraints

- {{Constraint the user stated or repository evidence shows, with its source.}}

## Open Questions

- {{Question the user could not resolve or phase 2 owns.}} Consequence: {{what changes with the answer.}}
