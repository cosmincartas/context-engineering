# Context Engineering Workflow

Model-agnostic skills turn an initial development prompt into reusable context, validated requirements, a technical design, and a TDD-ready resumable implementation plan.

## Routing

| Intent | Skill | Output |
|---|---|---|
| Understand a concept, compare technologies, inspect implementation impact, or see examples | `explore` | Chat response or optional technical exploration brief |
| Plan delivery work, from scope isolation to an implementation plan, or resume a planning topic | `sdlc` | Validated context brief, PRD, design specification, and implementation plan |
| Plan one small and clear change in a single session | `quickie` | Validated quick plan: understanding, scope, acceptance criteria, and tasks |

The delivery pipeline lives in one skill:

```text
explore (optional) → sdlc: context → requirements → design → plan
explore (optional) → quickie: align → plan
```

`sdlc` pairs on context and requirements. In design, the user approves an HLD, then selects pair mode or proposal mode.

`quickie` covers one deliverable that fits five tasks or fewer, changes no public contract, and has no open design decision. When a criterion fails, it stops and hands the confirmed understanding to `sdlc`.

`explore` is standalone. Its findings enter the delivery path only after the user explicitly chooses to formalize the work. Every delivery topic starts with the context phase, including requests that appear clear. Each phase ends with a user-validated artifact, and the topic can stop and resume at any phase.

## Usage

```text
Use explore to explain event sourcing and assess what adopting it would affect here.
```

```text
Use sdlc to pair with me on this development request.
Use sdlc to resume the payment-retries topic.
```

```text
Use quickie to plan this small change.
```

Named-skill invocation syntax varies by runtime.

## Artifacts

One topic is one folder: `docs/agentic-engineering/<subject>/`.

| Artifact | File | Lifecycle |
|---|---|---|
| Technical exploration, when requested | `docs/agentic-engineering/explorations/` | Optional draft → validated |
| Quick plan | `quickie/<YYYY-MM-DD>-<subject>.md` | Draft → validated; no upstream hash |
| Context brief | `<subject>/context-brief.md` | Draft checkpoints → validated |
| PRD | `<subject>/prd.md` | Draft checkpoints → validated |
| Design specification | `<subject>/design.md` | Draft checkpoints → validated |
| Implementation plan | `<subject>/plan.md` | Draft → validated; task status and evidence during external execution |

Each `sdlc` artifact records the SHA-256 hash of its exact upstream file, so a change to a validated artifact marks everything downstream as stale. Artifacts are not committed without explicit user consent. Ignored artifacts resume only in the current working copy; commit them when recovery across machines matters.

## Implementation

`sdlc` and `quickie` stop at a validated implementation plan. The bundled `sdd` skill executes and reviews implementation plans generally, whether they come from either workflow or elsewhere.

With Superpowers, use `superpowers:subagent-driven-development` when subagents are available, or `superpowers:executing-plans` otherwise as external alternatives. Apply `superpowers:test-driven-development` to each production-behavior task. Superpowers is an external package and is not bundled here.

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

Keep the versions in `package.json`, `.codex-plugin/plugin.json`, and `.claude-plugin/plugin.json` equal, tag the commit as `v<version>`, and publish a GitHub Release.

## Validation

Codex's bundled validator requires Python 3 and PyYAML. Validate every skill:

```bash
for skill in skills/*; do
  python3 "${CODEX_HOME:-$HOME/.codex}/skills/.system/skill-creator/scripts/quick_validate.py" "$skill"
done

claude plugin validate .
```
