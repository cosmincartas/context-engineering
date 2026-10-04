import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const documents = [
  "../../../skills/sdd/SKILL.md",
  "../../../skills/sdd-cc/SKILL.md",
  "./reviewer.md",
  "./worker.md",
  "../../../agents-claude/reviewer.md",
  "../../../agents-claude/worker.md",
  "../../../agents-codex/reviewer.toml",
  "../../../agents-codex/worker.toml",
] as const;

const source = new Map<string, string>();
for (const document of documents) {
  source.set(document, await readFile(new URL(document, import.meta.url), "utf8"));
}

const skills = documents.slice(0, 2).map((document) => source.get(document)!);
const reviewers = ["./reviewer.md", "../../../agents-claude/reviewer.md", "../../../agents-codex/reviewer.toml"].map(
  (document) => source.get(document)!,
);
const workers = ["./worker.md", "../../../agents-claude/worker.md", "../../../agents-codex/worker.toml"].map(
  (document) => source.get(document)!,
);

// These are static policy-contract checks, not model-adherence tests or simulations of runtime orchestration.
function section(text: string, title: string | readonly string[]): string {
  const titles = typeof title === "string" ? [title] : title;
  const headings = [...text.matchAll(/^#{1,6} .+$/gm)];
  const start = headings.find((heading) => titles.includes(heading[0].replace(/^#+\s*/, "").trim()));
  assert.ok(start, `missing policy section: ${titles.join(" / ")}`);
  const level = /^#+/.exec(start[0])![0].length;
  const next = headings.find((heading) => heading.index! > start.index! && /^#+/.exec(heading[0])![0].length <= level);
  return text.slice(start.index!, next?.index);
}

function requirePolicy(text: string, pattern: RegExp, description: string): void {
  assert.match(text, pattern, `missing policy: ${description}`);
}

function rejectsMissingInstruction(text: string, instruction: RegExp, required: RegExp): void {
  const mutated = text.replace(instruction, "");
  assert.notEqual(mutated, text, "negative fixture must remove an existing policy instruction");
  assert.throws(() => requirePolicy(mutated, required, "critical instruction"));
}

const processSection = ["4. Process returned outcomes", "4. Process returned results"] as const;

test("nonblocking preferences are never corrections", () => {
  for (const skill of skills) {
    const process = section(skill, processSection);
    requirePolicy(process, /implementation preferences; these are non-findings/i, "preferences filtered as non-findings");
    requirePolicy(process, /must neither block completion nor become correction tasks/i, "preferences cannot block or create corrections");
  }
  for (const reviewer of reviewers) {
    requirePolicy(reviewer, /Reject preferences, optional improvements, speculative hardening, redesigns, and new requirements/i, "reviewer rejects preferences");
  }
  for (const worker of workers) {
    requirePolicy(section(worker, "Correction tasks"), /Do not add requirements, redesign to suit preferences/i, "worker does not implement preferences");
  }

  rejectsMissingInstruction(
    section(skills[0], processSection),
    /Reject new requirements, redesign proposals, speculative hardening, and implementation preferences; these are non-findings/i,
    /implementation preferences; these are non-findings/i,
  );
});

test("unrelated edits stay excluded and attributable scope violations are surfaced", () => {
  for (const skill of skills) {
    const framing = section(skill, "1. Frame the work");
    requirePolicy(framing, /Context-only reads outside task-owned targets are not review targets/i, "unrelated files remain context only");
    requirePolicy(framing, /Scope violations are not silently exempted/i, "scope violations are surfaced");
  }
  for (const reviewer of reviewers) {
    requirePolicy(reviewer, /Treat all other files as read-only context/i, "reviewer excludes other files");
    requirePolicy(reviewer, /report attributable edits outside task scope as scope violations/i, "reviewer surfaces scope violations");
  }
  for (const worker of workers) {
    requirePolicy(worker, /Preserve unrelated (?:user )?changes/i, "worker preserves unrelated changes");
  }
});

test("initial review is consolidated, complete, and tracks stable findings across one batch", () => {
  for (const skill of skills) {
    const process = section(skill, processSection);
    requirePolicy(process, /one complete consolidated \*\*Initial review\*\* report/i, "one complete consolidated initial report");
    requirePolicy(process, /partial, incomplete, budget-limited, truncated, or coverage-missing report is insufficient/i, "incomplete initial reports are insufficient");
    requirePolicy(process, /stable ID once and preserve its ID, status, and evidence/i, "stable finding ledger");
    requirePolicy(section(skill, "5. Correct and repeat"), /exactly one automatic correction batch/i, "single consolidated correction allowance");
  }
  for (const reviewer of reviewers) {
    requirePolicy(reviewer, /consolidate all findings with coverage and limits/i, "reviewer consolidates all findings and coverage");
    requirePolicy(reviewer, /each accepted stable finding ID/i, "reviewer verifies stable accepted IDs");
  }
  for (const worker of workers) {
    requirePolicy(section(worker, "Correction tasks"), /Resolve all accepted (?:finding )?IDs and required verification check failures together/i, "worker resolves the consolidated correction handoff");
  }
});

test("verification is limited to accepted IDs and correction delta, including regressions", () => {
  for (const skill of skills) {
    const process = section(skill, processSection);
    requirePolicy(process, /Verification review.*?correction-only attributable delta/s, "verification requires the correction-only delta");
    requirePolicy(process, /not unrestricted discovery/i, "verification is not a rediscovery pass");
    requirePolicy(process, /Check every accepted ID against its original evidence; validate correction regressions/i, "verify accepted IDs and correction regressions");
    requirePolicy(section(skill, "5. Correct and repeat"), /Verification review only/i, "follow-up mode is verification only");
  }
  for (const reviewer of reviewers) {
    requirePolicy(reviewer, /correction-only attributable delta/i, "reviewer uses the correction delta");
    requirePolicy(reviewer, /Do not re-review the full original change for new defects/i, "reviewer does not repeat initial review");
    requirePolicy(reviewer, /check regressions caused by the correction/i, "reviewer checks correction regressions");
  }
});

test("incomplete, truncated, budget-limited, or coverage-missing reports cannot pass or trigger partial corrections", () => {
  for (const skill of skills) {
    const process = section(skill, processSection);
    requirePolicy(process, /partial, incomplete, budget-limited, truncated, or coverage-missing report is insufficient/i, "incomplete reports fail the evidence gate");
    requirePolicy(process, /do not correct from partial findings/i, "no partial corrections");
    requirePolicy(process, /review gate passes only after.*?no verification blocker or missing evidence remains/s, "missing evidence blocks the gate");
  }
  for (const reviewer of reviewers) {
    requirePolicy(reviewer, /partial inspection means the review is incomplete/i, "partial inspection is incomplete");
    requirePolicy(reviewer, /Missing any input means incomplete/i, "missing verification evidence is incomplete");
  }

  rejectsMissingInstruction(
    section(skills[1], processSection),
    /A partial, incomplete, budget-limited, truncated, or coverage-missing report is insufficient/i,
    /budget-limited, truncated, or coverage-missing report is insufficient/i,
  );
});

test("correction allowance survives resume and new IDs, then escalates after consumption", () => {
  for (const skill of skills) {
    const correction = section(skill, "5. Correct and repeat");
    requirePolicy(correction, /exactly one automatic correction batch/i, "one correction batch per original assignment");
    requirePolicy(correction, /new task IDs or resumed orchestration do not reset it/i, "allowance persists over resume and new IDs");
    requirePolicy(correction, /After that batch.*?requires user escalation|After the single correction batch.*?requires user escalation/s, "escalate rather than automatically correcting again");
    requirePolicy(correction, /Record that allowance as consumed/i, "consumption is recorded before dispatch");
  }
  for (const reviewer of reviewers) {
    requirePolicy(reviewer, /existing one automatic correction batch limit/i, "verification findings honor the consumed allowance");
  }

  const correctionSection = section(skills[0], "5. Correct and repeat");
  rejectsMissingInstruction(
    correctionSection,
    /new task IDs or resumed orchestration do not reset it/i,
    /new task IDs or resumed orchestration do not reset it/i,
  );
});
