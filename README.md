# Context Engineering Workflow

Model-agnostic skills turn an initial development prompt into reusable context, validated requirements, a technical design, and a TDD-ready resumable implementation plan.

## Routing

| Intent | Skill | Output |
|---|---|---|
| Understand a concept, compare technologies, inspect implementation impact, or see examples | `explore` | Chat response or optional technical exploration brief |
| Plan delivery work, from scope isolation to an implementation plan, or resume a planning topic | `sdlc` | Validated context brief, PRD, design specification, and implementation plan |
| Pair on delivery work with per-section review of each artifact as it is drafted | `pair-sdlc` | The same validated artifacts, reviewed section by section |

The delivery pipeline lives in one skill, with a paired variant:

```text
explore (optional) → sdlc:      context → requirements → design → plan
explore (optional) → pair-sdlc: context → requirements → design → plan
```

`pair-sdlc` is a full fork of `sdlc` for experimenting with different guards per phase; changes to it never affect `sdlc`. It adds a pairing rhythm: the user approves each artifact section as it is drafted, and in the design phase the pair defines models, interfaces, and function signatures one element at a time as code.

`explore` is standalone. Its findings enter the delivery path only after the user explicitly chooses to formalize the work. Every delivery topic starts with the context phase, including requests that appear clear. Each phase ends with a user-validated artifact, and the topic can stop and resume at any phase.

## Usage

```text
Use explore to explain event sourcing and assess what adopting it would affect here.
```

```text
Use sdlc to plan this development request.
Use sdlc to resume the payment-retries topic.
```

```text
Use pair-sdlc to pair with me on this development request.
```

Named-skill invocation syntax varies by runtime.

## Artifacts

One topic is one folder: `docs/agentic-engineering/<subject>/`.

| Artifact | File | Lifecycle |
|---|---|---|
| Technical exploration, when requested | `docs/agentic-engineering/explorations/` | Optional draft → validated |
| Context brief | `<subject>/context-brief.md` | Draft checkpoints → validated |
| PRD | `<subject>/prd.md` | Draft checkpoints → validated |
| Design specification | `<subject>/design.md` | Draft checkpoints → validated |
| Implementation plan | `<subject>/plan.md` | Draft → validated; task status and evidence during external execution |

Each artifact records the SHA-256 hash of its exact upstream file, so a change to a validated artifact marks everything downstream as stale. Artifacts are not committed without explicit user consent. Ignored artifacts resume only in the current working copy; commit them when recovery across machines matters.

## Implementation

Both skills stop at the validated implementation plan. Neither ships an execution skill.

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

Explicit invocation syntax is host-specific: `$agentic-workflow:sdlc` in Codex, `/agentic-workflow:sdlc` in Claude Code, `/agentic-workflow/sdlc` in Copilot, and `/skill:sdlc` in Pi.

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
