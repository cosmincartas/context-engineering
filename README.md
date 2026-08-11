# Context Engineering Workflow

Model-agnostic skills turn an initial development prompt into reusable context, validated requirements, a technical design, and a TDD-ready resumable implementation plan. Exploration and clarification are optional entry points rather than mandatory ceremony.

## Routing

| Intent | Skill | Output |
|---|---|---|
| Understand a concept, compare technologies, inspect implementation impact, or see examples | `explore` | Chat response or optional technical exploration brief |
| Establish shared understanding from an ambiguous initial request | `clarify` | Validated context brief |
| Formalize a materially clear request | `requirements` | Validated PRD |
| Design a validated PRD | `design` | Validated design specification |
| Plan a validated design | `to-plan` | Validated, TDD-ready resumable implementation plan |

The delivery path is:

```text
clarify (optional) → requirements → design → to-plan
```

`explore` is standalone. Its findings enter the delivery path only after the user explicitly chooses to formalize the work. A user who already knows what they want can start directly with `requirements`.

## Usage

```text
Use explore to explain event sourcing and assess what adopting it would affect here.
```

```text
Use clarify to establish shared understanding of this development request.
```

```text
Use requirements with docs/agentic-engineering/context/<date>/<subject>.md.
Use design with docs/agentic-engineering/prd/<date>/<subject>.md.
Use to-plan with docs/agentic-engineering/specs/<date>/<subject>.md.
```

Named-skill invocation syntax varies by runtime.

## Artifacts

| Artifact | Location | Lifecycle |
|---|---|---|
| Technical exploration, when requested | `docs/agentic-engineering/explorations/` | Optional draft → validated |
| Context brief | `docs/agentic-engineering/context/` | Draft checkpoints → validated |
| PRD | `docs/agentic-engineering/prd/` | Draft checkpoints → validated |
| Design specification | `docs/agentic-engineering/specs/` | Draft checkpoints → validated |
| Implementation plan | `docs/agentic-engineering/plans/` | Draft → validated; task status and evidence during external execution |

Artifacts are not committed without explicit user consent. Ignored artifacts resume only in the current working copy; commit them when recovery across machines matters.

## Implementation

This package stops at the validated implementation plan. It does not ship an execution skill.

With Superpowers, use `superpowers:subagent-driven-development` when subagents are available, or `superpowers:executing-plans` otherwise. Apply `superpowers:test-driven-development` to each production-behavior task. Superpowers is an external package and is not bundled here.

## Install

The same `skills/` directory is packaged for Codex, Claude Code, GitHub Copilot, and Pi:

```bash
# Codex
codex plugin marketplace add cosmincartas/context-engineering
codex plugin add agentic-workflow@agentic-workflow

# Claude Code
claude plugin marketplace add cosmincartas/context-engineering
claude plugin install agentic-workflow@agentic-workflow

# GitHub Copilot CLI
copilot plugin install cosmincartas/context-engineering

# Pi
pi install git:github.com/cosmincartas/context-engineering
```

Explicit invocation syntax is host-specific: `$agentic-workflow:explore` in Codex, `/agentic-workflow:explore` in Claude Code, `/agentic-workflow/explore` in Copilot, and `/skill:explore` in Pi.

## Releases

Keep the versions in `.codex-plugin/plugin.json` and `.claude-plugin/plugin.json` equal, tag the commit as `v<version>`, and publish a GitHub Release.

## Validation

Codex's bundled validator requires Python 3 and PyYAML. Validate every skill:

```bash
for skill in skills/*; do
  python3 "${CODEX_HOME:-$HOME/.codex}/skills/.system/skill-creator/scripts/quick_validate.py" "$skill"
done

claude plugin validate .
```
