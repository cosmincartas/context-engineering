---
schema_version: 1
artifact: context-brief
subject: "{{subject}}"
status: draft
checkpoint: framing
repository_baseline: "{{commit or unavailable}}"
exploration: "{{path or none}}"
created: "{{YYYY-MM-DD}}"
updated: "{{YYYY-MM-DD}}"
---

# {{Subject}} Context Brief

## Initial Request

{{The user's request in their terms.}}

## Problem and Motivation

{{What is happening, who is affected, and why the request matters. Do not name an unconfirmed solution as the problem.}}

## Current Behavior and Evidence

{{Describe current behavior. Cite repository files, documentation, observed behavior, or user statements. State when the work is greenfield.}}

## Desired Outcome

{{The capability or change the user wants and the ordinary-language signals of success. Do not write formal requirements.}}

## Affected Users

- {{User or system and how it is affected.}}

## Scope

### In scope

- {{Boundary confirmed by the user or evidence.}}

### Out of scope

- {{Non-goal and reason.}}

## Constraints

- {{Compatibility, policy, timing, budget, or technology constraint. Include provenance.}}

## Assumptions

- {{Assumption, provenance, and consequence if false.}}

## Unresolved Questions

- {{Question that still affects shared understanding or requirements.}}

## Confirmed Understanding

{{A concise restatement of the problem, desired outcome, scope, and important constraints for user approval.}}
