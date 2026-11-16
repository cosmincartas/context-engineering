# Context Engineering Workflow

Model-agnostic skills turn an initial development prompt into reusable context, requirements, a technical design, and a TDD-ready resumable implementation plan.

## Routing

| Intent | Skill | Output |
|---|---|---|
| Understand a concept, compare technologies, inspect implementation impact, see examples, or see candidate high-level designs for a request | `explore` | Chat response or optional technical exploration brief, with a side-by-side designs page for design candidates |
| Plan delivery work, from scope isolation to an implementation plan, or resume a planning topic | `sdlc` | Intent, specification, and implementation plan |
| Auto-plan a change with input only for disruptive decisions | `quickie` | Specification and implementation plan |
| Cut a feature into small deliverables by architecture layer, after `intent` | [`slice`](skills/slice/SKILL.md) | Overview and one slice file per slice |
| Create a visual view of existing Markdown without changing its source or approval state | [`visualize`](skills/visualize/SKILL.md) | Derived, standalone HTML presentation |
| Hand tasks to `claude`, `pi`, and `codex` role agents in visible `hc` terminals instead of builtin subagents | [`shepherd`](skills/shepherd/SKILL.md) | One result per agent, plus any blocked terminals left for the user |

The delivery pipeline lives in one skill:

```text
explore (optional) → sdlc: intent → requirements → design → plan
explore (optional) → quickie: design-specs (delegated) → implementation-plan (delegated)
intent → slice → for each slice, in order: design-specs → implementation-plan
```

The `sdlc` pipeline is heavily inspired by Anthropic's [AI-native SDLC playbook](https://claude.com/blog/the-ai-native-sdlc-playbook). It adapts the playbook's phased, artifact-driven approach into skills that run inside the coding agent.

`sdlc` clarifies material gaps and validates the complete intent once. In design, one requirements gate covers scope, FRs, and NFRs. A UI gate follows only when the slice adds or changes UI. One HLD gate combines decisions with the explained design. The agent then drafts applicable sections autonomously before final review. Corrections reopen the earliest affected approval and require reassessing later decisions. Alternatives address unresolved consequential choices. Approval includes inferred interpretations, without separate section or inference rounds.

Specifications fix required behavior, contracts, invariants, and consequential technical decisions. Private implementation structure remains discretionary within those constraints. Designs check existing code and capabilities before adding abstractions or dependencies. When the user requests the complete pipeline, artifact approval advances to the next phase without a separate continuation prompt.

`quickie` accepts a request or intent file and delegates routine approvals while running `design-specs` and `implementation-plan`. It pauses for disruptive scope, contract, security, compatibility, or architecture decisions. It never implements the plan.

`slice` runs after `intent` when one specification would be too large to review. It has three gates: scope (FRs and NFRs), the whole-flow HLD with the Technology Stack, and the cut. It cuts only by architecture layer; one slice is a valid result. Each slice file is the complete input of `design-specs` for one slice: its requirements, its Technology Stack entries, and its fixed seam contracts. `design-specs` skips the gates that the slice file provides and keeps a small HLD gate for the design inside the slice. A missing requirement or a seam change goes back to `slice`.

Verification is traced from the intent to the plan. `intent` gives each Definition of done signal a `DoD-N` identifier and labels it `checkable` or `human`. `design-specs` maps each `DoD-*` item to requirements, writes each verification as a Given/When/Then oracle with exact results, assigns a verification level, and lists the verification facilities in the Technology Stack. `implementation-plan` runs the declared verification commands once at baseline and writes every check as a structured entry with a command and exact RED and GREEN expectations. A program, not the implementer, decides each check. Task 0 writes the acceptance checks before production code, and gates protect them. For `human` items, the agent captures screenshots or video and the user reviews the evidence.

`explore` is standalone. Its findings enter the delivery path only after the user explicitly chooses to formalize the work. Every delivery topic starts with the context phase, including requests that appear clear. In `sdlc`, each phase ends with a user-reviewed artifact. In `quickie`, delegated approval is recorded instead; the topic can resume at any phase.

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

Invoke [`visualize`](skills/visualize/SKILL.md) manually when you want an HTML view; no other skill invokes it automatically. It turns source Markdown into a separate, standalone HTML view using six composing blocks: code snippets, milestones, code changes, requirement tables, flow diagrams, and sequence diagrams. Keep the Markdown authoritative, including its source format and approval state. Diagrams are embedded in the HTML for offline viewing.

```text
Use visualize to create a standalone HTML view of docs/agentic-engineering/payment-retries/spec.md. Keep the Markdown authoritative and do not change its approval state or source format.
```

Named-skill invocation syntax varies by runtime.

## Artifacts

One topic is one folder: `docs/agentic-engineering/<subject>/`.

| Artifact | File | Lifecycle |
|---|---|---|
| Technical exploration, when requested | `docs/agentic-engineering/explorations/` | Optional; reviewed by the user |
| Design candidates page, when explore runs in Design mode | `explorations/<YYYY-MM-DD>/<subject>-designs.html` | Supporting file of the exploration brief |
| Intent | `<subject>/intent.md` | Reviewed and corrected in place |
| Overview, when `slice` runs | `<subject>/overview.md` | Saved after each gate; holds the whole flow, the slice table, the seam contracts, and the approval records |
| Slice file | `<subject>/slices/NN-<name>/slice.md` | Written after the cut is approved; `spec.md` and `plan.md` of the slice are saved beside it |
| Specification | `<subject>/spec.md` | Saved after each gate; reviewed by the user |
| UI mocks, when the slice has a visual layer | `<subject>/ui.html` | Supporting file of the specification |
| Implementation plan | `<subject>/plan.md` | Reviewed by the user; execution state belongs to the implementer |

Each file-based downstream artifact records the SHA-256 hash of its upstream file, so upstream changes mark dependent artifacts as stale. The overview records the hash of the intent. A specification made from a slice file records the hash of that slice file. Artifacts are not committed without explicit user consent. Ignored artifacts resume only in the current working copy; commit them when recovery across machines matters.

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

## Reusable prompts

[`prompts/code-changes.md`](prompts/code-changes.md) contains harness-neutral instructions for approaching code changes, choosing dependencies, and verifying results. Keep this repository copy as the shared source across machines and harnesses. These instructions are not installed automatically by the plugin or Pi package.

For Pi, copy it into the global append system prompt file from the repository root:

```bash
mkdir -p ~/.pi/agent
cp -i prompts/code-changes.md ~/.pi/agent/APPEND_SYSTEM.md
```

If you use `PI_CODING_AGENT_DIR`, use that directory instead of `~/.pi/agent`. Review any existing destination file before replacing it; merge the instructions if it contains other guidance. Repeat the copy after updating the repository prompt.

For other harnesses, merge the same Markdown into their supported global or project instruction file, or use their append-system-prompt mechanism. Append it to existing guidance rather than replacing the harness's base system prompt.

## Claude Code subagents

The Claude Code plugin ships the `scout`, `worker`, `oracle`, and `reviewer` subagents from `agents/`. They are available as `agentic-workflow:<name>` after installing the plugin. To use them without the namespace, copy them to `~/.claude/agents/` instead. Keep them in sync with the Pi definitions in `extensions/subagent/agents/`.

## Codex CLI subagents

The `agents-codex/` directory contains Codex versions of `scout`, `worker`, `oracle`, and `reviewer`, adapted from `agents/`. Each standalone TOML file defines its name, description, and developer instructions. Each file explicitly sets `model` and `model_reasoning_effort`, which you can customize:

| Agent | Model | Reasoning effort |
|---|---|---|
| `scout` | `gpt-6-luna` | `medium` |
| `worker` | `gpt-6-luna` | `max` |
| `reviewer` | `gpt-6.1-sol` | `high` |
| `oracle` | `gpt-6-astra` | `high` |

Luna handles research and implementation, Sol handles review, and Astra is reserved for Oracle's difficult analysis and decisions. These are role-based defaults, not exact equivalents of the Claude models. See the official [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol) and [Astra](https://developers.openai.com/api/docs/models/gpt-6-astra) model documentation. Choose an available model in each file if your account does not have access.

From this repository, copy the definitions into your personal agent directory:

```bash
mkdir -p ~/.codex/agents
cp -i agents-codex/*.toml ~/.codex/agents/
```

For project scope, copy them into that project's `.codex/agents/` instead. Start a new Codex CLI session and request a role explicitly, for example:

```text
Have scout map the affected code paths, worker implement the change, and reviewer review the resulting diff.
```

These are standalone definitions installed by copying the files. The custom `worker` takes precedence over Codex's built-in agent of the same name. `scout`, `oracle`, and `reviewer` configure `sandbox_mode = "read-only"`; `worker` inherits the parent permissions. Parent runtime permission overrides can take precedence over agent sandbox settings. Keep the role instructions in sync with `agents/` and `extensions/subagent/agents/`.

See the official [Codex subagent documentation](https://learn.chatgpt.com/docs/agent-configuration/subagents) for configuration details.

## Shepherd agents through hc

[`shepherd`](skills/shepherd/SKILL.md) dispatches role agents through herdr core (`hc`) instead of the builtin subagent tools. One run can mix `claude`, `pi`, and `codex` agents. Each agent runs in its own `hc` terminal, so you can watch it with `hc attach <t>` and step in. The skill is a dispatch layer only: it starts agents, waits for their `hc send` reports, reads the results, reports blocked agents to you, and cleans up at the end of the run. It does not answer a blocked agent; blocked terminals stay alive for you.

Requirements:

- `hc` 0.1.21 or later.
- `claude`, `pi`, and `codex` (0.169.0 or later, which reports its status to `hc`) on `PATH` and logged in.
- The orchestrator runs inside an `hc` terminal, so that `HC_TERMINAL_ID` is set and agents can report to it. For example, start it with `hc run --bg --name lead claude`, then `hc attach lead`.

The role mapping lives in `hc` templates. The role files ship in `skills/shepherd/assets/templates/`:

| Role | Agent | Model and effort | Access |
|---|---|---|---|
| `scout` | `claude` | Claude Haiku 5.5, effort `high` | Read-only |
| `oracle` | `claude` | Claude Fable 5.2, effort `high` | Read-only |
| `worker` | `pi` | Fireworks `accounts/fireworks/routers/deepseek-v4p1-flash-1017-ultrafast`, Pi default thinking | Changes files |
| `reviewer` | `codex` | GPT 6.1 Sol, reasoning effort `xhigh` | Read-only |
| `tester` | `claude` | Claude Haiku 5.5, effort `high` | Runs the system; writes evidence outside the repository only |

Install them from the repository root. The skill never writes to `~/.config/herdr-core/`, so you run the copy yourself:

```bash
mkdir -p ~/.config/herdr-core/templates && cp -i skills/shepherd/assets/templates/*.md ~/.config/herdr-core/templates/
```

Then `hc templates` lists the five roles. Edit the `command` line of a copied file to change its agent or model. Keep the role instructions in sync with `agents-claude/`, `agents-codex/`, and `extensions/subagent/agents/`. `tester` exists only in the shepherd role files.

`tester` runs the system without changing it. A tester task names `Reproduction` (reproduce a reported bug and reduce its steps) or `Verification` (run acceptance scenarios or earlier reproduction steps) and says how to start the system. It reports observed behavior as evidence; it does not diagnose, fix, or add tests.

### Auto-approval setup

The shepherd assumes that each agent CLI approves its own actions. The shipped commands carry no approval flag; you configure auto-approval once in each CLI. A prompt that appears anyway makes the agent `blocked`, and the shepherd reports it to you.

- `claude`: use auto mode. If it is not already your default, add to `~/.claude/settings.json`:

  ```json
  { "permissions": { "defaultMode": "auto" } }
  ```

  A classifier approves safe actions, including the agent's `hc send` report. It blocks risky actions, and a blocked agent can then stop and wait for you. Claude Code can show a one-time notice the first time you use auto mode. Start `claude` in auto mode once by hand and dismiss it before a shepherd run.

  For no checks at all, use bypass mode. The top-level key removes the warning dialog that otherwise stops each agent at start:

  ```json
  {
    "permissions": { "defaultMode": "bypassPermissions" },
    "skipDangerousModePermissionPrompt": true
  }
  ```

- `codex`: add to `~/.codex/config.toml`, with the two top-level keys before any table. The agent's `hc send` must reach the `hc` core, so the sandbox needs network access and the `hc` state folders as writable roots. Use absolute paths. Without these settings, `codex` reports fail. `sandbox_mode = "danger-full-access"` also works, with no sandbox.

  ```toml
  approval_policy = "never"
  sandbox_mode = "workspace-write"

  [sandbox_workspace_write]
  network_access = true
  writable_roots = ["/home/<user>/.local/state/herdr-core", "/run/user/<uid>/herdr-core"]
  ```

- `pi`: no setting. Pi has no permission prompts.

These settings do not remove the workspace-trust dialog. `claude` and `codex` both show it in a folder that you have not trusted, and the shepherd then reports the agent as blocked. The task of that agent is not delivered, even after you accept the dialog. Trust each working folder before a run: open `claude` and `codex` in it one time and accept. For `codex`, you can instead add this table after the top-level keys of `~/.codex/config.toml`:

```toml
[projects."/absolute/path/to/folder"]
trust_level = "trusted"
```

With auto-approval, the read-only access of `scout`, `oracle`, and `reviewer`, and the run-only access of `tester`, come from their role instructions only. The CLI does not enforce them.

Phase 1 is verified with Claude Code as the orchestrator only. The skill text uses plain `hc` commands, so `pi` and `codex` orchestrators are expected to work but are not verified.

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
