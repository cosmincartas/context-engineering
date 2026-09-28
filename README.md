# Context Engineering Workflow

Model-agnostic skills turn an initial development prompt into reusable context, validated requirements, a technical design, and a TDD-ready resumable implementation plan.

## Routing

| Intent | Skill | Output |
|---|---|---|
| Understand a concept, compare technologies, inspect implementation impact, see examples, or see candidate high-level designs for a request | `explore` | Chat response or optional technical exploration brief, with a side-by-side designs page for design candidates |
| Plan delivery work, from scope isolation to an implementation plan, or resume a planning topic | `sdlc` | Validated intent, specification, and implementation plan |
| Auto-plan a change with input only for disruptive decisions | `quickie` | Validated specification and implementation plan |

The delivery pipeline lives in one skill:

```text
explore (optional) → sdlc: intent → requirements → design → plan
explore (optional) → quickie: design-specs (delegated) → implementation-plan (delegated)
```

The `sdlc` pipeline is heavily inspired by Anthropic's [AI-native SDLC playbook](https://claude.com/blog/the-ai-native-sdlc-playbook). It adapts the playbook's phased, artifact-driven approach into skills that run inside the coding agent.

`sdlc` clarifies material gaps and validates the complete intent once. In design, one requirements gate covers scope, FRs, and NFRs. A UI gate follows only when the slice adds or changes UI. One HLD gate combines decisions with the explained design. The agent then drafts applicable sections autonomously before final validation. Corrections reopen the earliest affected approval and require reassessing later decisions. Alternatives address unresolved consequential choices. Approval includes inferred interpretations, without separate section or inference rounds.

Specifications fix required behavior, contracts, invariants, and consequential technical decisions. Private implementation structure remains discretionary within those constraints. Designs check existing code and capabilities before adding abstractions or dependencies. When the user requests the complete pipeline, artifact approval advances to the next phase without a separate continuation prompt.

`quickie` accepts a request or intent file and delegates routine approvals while running `design-specs` and `implementation-plan`. It pauses for disruptive scope, contract, security, compatibility, or architecture decisions. It never implements the plan.

`explore` is standalone. Its findings enter the delivery path only after the user explicitly chooses to formalize the work. Every delivery topic starts with the context phase, including requests that appear clear. In `sdlc`, each phase ends with a user-validated artifact. In `quickie`, delegated approval is recorded instead; the topic can resume at any phase.

## Usage

```text
Use explore to explain event sourcing and assess what adopting it would affect here.
```

```text
Use sdlc to pair with me on this development request.
Use sdlc to resume the payment-retries topic.
```

```text
Use quickie to create a specification and plan for this change. Ask only about disruptive decisions.
```

Named-skill invocation syntax varies by runtime.

## Artifacts

One topic is one folder: `docs/agentic-engineering/<subject>/`.

| Artifact | File | Lifecycle |
|---|---|---|
| Technical exploration, when requested | `docs/agentic-engineering/explorations/` | Optional draft → validated |
| Design candidates page, when explore runs in Design mode | `explorations/<YYYY-MM-DD>/<subject>-designs.html` | Supporting file of the exploration brief; no status |
| Intent | `<subject>/intent.md` | Draft checkpoints → validated |
| Specification | `<subject>/spec.md` | Draft checkpoints → validated |
| UI mocks, when the slice has a visual layer | `<subject>/ui.html` | Supporting file of the specification; no status |
| Implementation plan | `<subject>/plan.md` | Draft → validated; execution state belongs to the implementer |

Each file-based downstream artifact records the SHA-256 hash of its upstream file, so upstream changes mark dependent artifacts as stale. Artifacts are not committed without explicit user consent. Ignored artifacts resume only in the current working copy; commit them when recovery across machines matters.

## Implementation

`sdlc` and `quickie` stop at an implementation plan. The bundled `sdd` skill executes and reviews plans from either workflow or elsewhere. After successful review, it saves `docs/context-engineering/<subject>/tasks.md` and clears its completed session tasks.

With Superpowers, use `superpowers:subagent-driven-development` when subagents are available, or `superpowers:executing-plans` otherwise as external alternatives. Apply `superpowers:test-driven-development` to each production-behavior task. Superpowers is an external package and is not bundled here.

## Install

The `skills/` directory is packaged for Codex, Claude Code, and GitHub Copilot. The Pi package installs only extensions:

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

Explicit invocation syntax is host-specific: `$agentic-workflow:sdlc` in Codex, `/agentic-workflow:sdlc` in Claude Code, and `/agentic-workflow/sdlc` in Copilot. To use the skills in Pi, install them separately.

## Subagent configuration

In Pi's interactive TUI, run `/subagent-config` (no arguments) to set model/provider and supported reasoning defaults for `scout`, `worker`, `oracle`, and `reviewer`. Settings apply to later child batches only; they do not alter the parent model or reasoning level.

Settings are global to the current Pi profile, across projects and sessions, in `~/.pi/agent/subagent-config.json` by default or `$PI_CODING_AGENT_DIR/subagent-config.json`. The role list starts focused: use **Up**/**Down** to choose a role and **Enter** for its details. There, **Up**/**Down** select Model, Effort, Reset, Save, or Cancel; **Enter** activates the row. Model and Effort open option lists, where **Up**/**Down** and **Enter** choose a value; **Escape** closes an option list unchanged, returns from details to roles, then closes the modal. **Page Up**/**Page Down** scroll diagnostics. **Save** persists the complete draft, **Cancel** discards it, and **Reset** removes the selected role's override so it uses its bundled default. The model picker searches all currently available models, including custom providers; unavailable saved models fall back to the parent model/reasoning with a warning. Unsupported saved reasoning is adjusted to the selected model's supported level with a warning.

If the file is malformed or unreadable, children use bundled defaults with a warning. The modal shows the path and blocks Save: repair or remove the file, then reopen. Save failures retain the editable draft and leave existing settings unchanged. If neither the parent nor Pi's effective reasoning level is available for an unavailable configured model, the child fails before spawning.

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
