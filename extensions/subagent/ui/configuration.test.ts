import assert from "node:assert/strict";
import test from "node:test";
import { visibleWidth } from "@earendil-works/pi-tui";
import { showSubagentConfiguration, SubagentConfiguration } from "./configuration.ts";

const worker = { provider: "openai", model: "old", thinkingLevel: "high" as const };
const bundled = [
  { name: "scout", model: "openai-codex/gpt-5.6-luna", thinkingLevel: "medium" as const },
  { name: "worker", model: "openai-codex/gpt-5.6-terra", thinkingLevel: "medium" as const },
  { name: "oracle", model: "openai-codex/gpt-6-astra", thinkingLevel: "high" as const },
  { name: "reviewer", model: "openai-codex/gpt-5.6-sol", thinkingLevel: "medium" as const },
] as const;

function setup(error?: string, rows?: number) {
  let saved: any; let closed = 0;
  const store: any = { snapshot: () => ({ settings: { version: 1, agents: { worker } }, ...(error ? { error } : {}) }), save: async (value: any) => { saved = value; } };
  const view = new SubagentConfiguration({ requestRender() {}, ...(rows ? { terminal: { rows } } : {}) } as any, { fg: (_: string, text: string) => text } as any, store, () => closed++, [
    { provider: "openai", id: "old", reasoning: true, thinkingLevelMap: { low: "low", medium: "medium", high: "high" } },
    { provider: "openai", id: "new", reasoning: true, thinkingLevelMap: { medium: "medium", high: "high" } },
    { provider: "custom", id: "provider/model", reasoning: false },
    ...Array.from({ length: 6 }, (_, i) => ({ provider: "other", id: `model-${i}`, reasoning: false })),
  ], bundled);
  return { view, state: { get saved() { return saved; }, get closed() { return closed; } } };
}

const down = "\x1b[B";
const up = "\x1b[A";
const enter = "\r";
const escape = "\x1b";
const pageDown = "\x1b[6~";

test("transitions role to details to model and effort option lists", () => {
  const { view } = setup();
  assert.match(view.render(100).join("\n"), /> Scout/);
  view.handleInput(down);
  assert.match(view.render(100).join("\n"), /> Worker/);
  view.handleInput(enter);
  assert.match(view.render(100).join("\n"), /> Model: openai\/old/);
  view.handleInput(enter);
  assert.match(view.render(100).join("\n"), /Model options:/);
  view.handleInput(down); view.handleInput(enter);
  assert.match(view.render(100).join("\n"), /Model: openai\/new/);
  view.handleInput(down); view.handleInput(enter);
  assert.match(view.render(100).join("\n"), /Effort options/);
  view.handleInput(down); view.handleInput(enter);
  assert.match(view.render(100).join("\n"), /> Effort:/);
});

test("Escape unwinds options, details, and roles without changing an option draft", () => {
  const { view, state } = setup();
  view.handleInput(down); view.handleInput(enter); view.handleInput(enter);
  view.handleInput(down); view.handleInput(escape);
  assert.match(view.render(100).join("\n"), /> Model: openai\/old/);
  view.handleInput(escape);
  assert.match(view.render(100).join("\n"), /> Worker/);
  view.handleInput(escape);
  assert.equal(state.closed, 1);
});

test("Tab is ignored and detail arrows move focus without mutating effort", () => {
  const { view } = setup();
  const before = view.render(100).join("\n");
  view.handleInput("\t");
  assert.equal(view.render(100).join("\n"), before);
  view.handleInput(enter); // details, Model focused
  view.handleInput(down); // Effort focused
  const effort = view.render(100).join("\n").match(/Effort: (\w+)/)?.[1];
  view.handleInput(down); // Reset focused
  assert.equal(view.render(100).join("\n").match(/Effort: (\w+)/)?.[1], effort);
  view.handleInput("\x1b[Z");
  assert.match(view.render(100).join("\n"), /> Reset selected role/);
});

test("retains the framed split, narrow stack, picker search, diagnostics scrolling, and overlay contract", async () => {
  const { view } = setup(`Failed to read /tmp/pi/subagent-config.json: ${"bad JSON ".repeat(16)}`, 10);
  const wide = view.render(100);
  assert.match(wide.join("\n"), /╭.*Subagent configuration.*╮/);
  assert.match(wide.join("\n"), /Scout\s+│\s+Model:/);
  assert.ok(wide.every((line) => visibleWidth(line) <= 100));
  assert.match(view.render(40).join("\n"), /> scout/);
  for (let i = 0; i < 100; i++) view.handleInput("\x1b[5~");
  assert.match(view.render(80).join("\n"), /Error: Failed to read/);
  for (let i = 0; i < 100; i++) view.handleInput("\x1b[6~");
  view.handleInput(enter); view.handleInput(enter); view.handleInput("c"); view.handleInput("u");
  assert.match(view.render(80).join("\n"), /custom\/provider\/model/);

  let options: unknown;
  await showSubagentConfiguration({ modelRegistry: { getAvailable: () => [] }, ui: { custom: async (_factory: Function, value: unknown) => { options = value; } } } as any, { snapshot: () => ({ settings: { version: 1, agents: {} } }), async save() {} }, bundled);
  assert.deepEqual(options, { overlay: true, overlayOptions: { anchor: "center", width: "70%", maxHeight: "80%", minWidth: 40 } });
});

test("tiny widths retain visible focused content", () => {
  for (const [width, focused] of [[1, /s/], [2, />s/], [3, />sc/], [4, />sco/]] as const) {
    const { view } = setup(undefined, 1);
    const roles = view.render(width);
    assert.ok(roles.every((line) => visibleWidth(line) <= width && line.length > 0));
    assert.match(roles.join("\n"), focused);
    view.handleInput(enter);
    assert.match(view.render(width).join("\n"), width === 1 ? /M/ : />M/);
    view.handleInput(enter);
    assert.match(view.render(width).join("\n"), width === 1 ? /o/ : />o/);
  }
});

test("Up wraps roles, details, model options, and effort options", () => {
  const roles = setup().view;
  roles.handleInput(up);
  assert.match(roles.render(100).join("\n"), /> Reviewer/);

  const details = setup().view;
  details.handleInput(enter); details.handleInput(up);
  assert.match(details.render(100).join("\n"), /> Cancel/);

  const models = setup().view;
  models.handleInput(down); models.handleInput(enter); models.handleInput(enter); models.handleInput(up);
  assert.match(models.render(100).join("\n"), /> other\/model-5/);

  const effort = setup().view;
  effort.handleInput(down); effort.handleInput(enter); effort.handleInput(down); effort.handleInput(enter); effort.handleInput(up);
  assert.match(effort.render(100).join("\n"), /> medium/);
});

test("footers and focused markers follow each hierarchical screen", () => {
  const { view } = setup();
  assert.match(view.render(100).join("\n"), /> Scout[\s\S]*↑↓ select role/);
  view.handleInput(enter);
  assert.match(view.render(100).join("\n"), /> Model:[\s\S]*↑↓ select  enter activate/);
  view.handleInput(enter);
  assert.match(view.render(100).join("\n"), /> openai\/old[\s\S]*↑↓ select  enter choose/);
  view.handleInput(escape); view.handleInput(escape); view.handleInput(down); view.handleInput(enter); view.handleInput(down); view.handleInput(enter);
  assert.match(view.render(100).join("\n"), /> high[\s\S]*↑↓ select  enter choose/);
});

test("Page Down visibly scrolls and Escape restores the focused role viewport", () => {
  const { view } = setup(`Failed to read /tmp/pi/subagent-config.json: ${"bad JSON ".repeat(16)}`, 10);
  view.handleInput(down); view.handleInput(enter);
  const initial = view.render(40).join("\n");
  view.handleInput(pageDown);
  assert.notEqual(view.render(40).join("\n"), initial);
  view.handleInput(escape);
  assert.match(view.render(40).join("\n"), /> worker/);
});

test("Save, Reset, and Cancel remain detail actions", async () => {
  const { view, state } = setup();
  view.handleInput(enter); // details
  view.handleInput(down); view.handleInput(down); view.handleInput(enter); // reset
  assert.match(view.render(100).join("\n"), /Source: bundled/);
  view.handleInput(down); view.handleInput(enter);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(state.saved.agents.worker, worker);

  const cancelled = setup();
  cancelled.view.handleInput(enter);
  for (let i = 0; i < 4; i++) cancelled.view.handleInput(down);
  cancelled.view.handleInput(enter);
  assert.equal(cancelled.state.closed, 1);
});

test("saving locks input and a failed save retains the selected draft", async () => {
  let error: string | undefined; let saves = 0; let release!: () => void; let closed = 0;
  const store: any = {
    snapshot: () => ({ settings: { version: 1, agents: { worker } }, ...(error ? { error } : {}) }),
    save: async () => { saves++; await new Promise<void>((resolve) => { release = resolve; }); error = "disk full"; },
  };
  const view = new SubagentConfiguration({ requestRender() {} } as any, { fg: (_: string, text: string) => text } as any, store, () => closed++, [
    { provider: "openai", id: "old", reasoning: true, thinkingLevelMap: { medium: "medium", high: "high" } },
    { provider: "openai", id: "new", reasoning: true, thinkingLevelMap: { medium: "medium", high: "high" } },
  ], bundled);
  view.handleInput(down); view.handleInput(enter); view.handleInput(enter); view.handleInput(down); view.handleInput(enter); // worker -> new
  for (let i = 0; i < 3; i++) view.handleInput(down);
  view.handleInput(enter); view.handleInput(enter); view.handleInput(escape);
  assert.equal(saves, 1); assert.equal(closed, 0);
  assert.match(view.render(80).join("\n"), /Saving\.\.\./);
  release(); await new Promise((resolve) => setImmediate(resolve));
  assert.equal(closed, 0);
  assert.match(view.render(80).join("\n"), /Model: openai\/new/);
  assert.match(view.render(80).join("\n"), /Error: disk full/);
});

test("read errors block Save while empty and unmatched model pickers remain explicit", () => {
  const blocked = setup("Failed to read profile settings at /tmp/config: bad JSON");
  blocked.view.handleInput(enter); for (let i = 0; i < 3; i++) blocked.view.handleInput(down); blocked.view.handleInput(enter);
  assert.equal(blocked.state.saved, undefined);
  assert.match(blocked.view.render(80).join("\n"), /> Save \(disabled\)/);

  const empty = new SubagentConfiguration({ requestRender() {} } as any, { fg: (_: string, text: string) => text } as any, { snapshot: () => ({ settings: { version: 1, agents: {} } }), async save() {} }, () => {}, [], bundled);
  empty.handleInput(enter); empty.handleInput(enter);
  assert.match(empty.render(100).join(" "), /No authenticated models available/);
  const { view } = setup();
  view.handleInput(enter); view.handleInput(enter); view.handleInput("z");
  assert.match(view.render(80).join("\n"), /No matching models/);
});

test("effort choices omit capability holes, clamp selection, and retain focus in a short viewport", () => {
  const limited = new SubagentConfiguration({ requestRender() {} } as any, { fg: (_: string, text: string) => text } as any, { snapshot: () => ({ settings: { version: 1, agents: {} } }), async save() {} }, () => {}, [
    { provider: "limited", id: "medium", reasoning: true, thinkingLevelMap: { high: null, medium: "medium", xhigh: null, max: null } },
  ], bundled);
  limited.handleInput(down); limited.handleInput(down); limited.handleInput(enter); limited.handleInput(enter); limited.handleInput(enter);
  assert.match(limited.render(80).join("\n"), /Reasoning adjusted to medium[\s\S]*Effort: medium/);
  limited.handleInput(down); limited.handleInput(enter);
  assert.match(limited.render(80).join("\n"), /> medium/);
  assert.doesNotMatch(limited.render(80).join("\n"), /high|xhigh|max/);

  const { view } = setup(undefined, 2);
  view.handleInput(down); view.handleInput(enter); view.handleInput(down); view.handleInput(enter);
  const effort = view.render(24);
  assert.match(effort.join("\n"), /> high/);
  assert.ok(effort.every((line) => visibleWidth(line) <= 24));

  view.handleInput(escape); view.handleInput(up); view.handleInput(enter);
  for (let i = 0; i < 8; i++) view.handleInput(down);
  assert.match(view.render(24).join("\n"), /> other\/model-5/);
});

test("narrow details wrap completely and restored drafts recover their source", () => {
  const { view } = setup();
  const narrow = view.render(24).join("").replaceAll("│", "").replaceAll(" ", "");
  assert.ok(narrow.includes("openai-codex/gpt-5.6-luna"));
  assert.ok(narrow.includes("Source:bundled"));
  assert.ok(narrow.includes("Unavailable:fallsbacktoparentmodel/reasoning"));
  assert.ok(view.render(24).every((line) => visibleWidth(line) <= 24));

  view.handleInput(down); view.handleInput(enter); view.handleInput(enter); view.handleInput("n"); view.handleInput("e"); view.handleInput("w"); view.handleInput(enter);
  assert.match(view.render(80).join("\n"), /Source: unsaved changes/);
  view.handleInput(enter); view.handleInput("o"); view.handleInput("l"); view.handleInput("d"); view.handleInput(enter);
  assert.match(view.render(80).join("\n"), /Source: saved/);
});

test("saving one changed role retains another unavailable override", async () => {
  let saved: any;
  const unavailable = { provider: "gone", model: "model", thinkingLevel: "high" as const };
  const view = new SubagentConfiguration({ requestRender() {} } as any, { fg: (_: string, text: string) => text } as any, {
    snapshot: () => ({ settings: { version: 1, agents: { oracle: unavailable } } }), save: async (value: any) => { saved = value; },
  }, () => {}, [
    { provider: "openai", id: "new", reasoning: true, thinkingLevelMap: { medium: "medium", high: "high" } },
  ], bundled);
  view.handleInput(enter); view.handleInput(enter); view.handleInput(enter); // scout -> new
  for (let i = 0; i < 3; i++) view.handleInput(down);
  view.handleInput(enter);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(saved.agents.oracle, unavailable);
  assert.deepEqual(saved.agents.scout, { provider: "openai", model: "new", thinkingLevel: "medium" });
});
