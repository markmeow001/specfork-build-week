import assert from "node:assert/strict";
import test from "node:test";
import { parseAnalysisPayload } from "../app/analysis-schema.mjs";
import { deriveConflicts } from "../scripts/derive-conflicts.mjs";

async function render(path = "/", init) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, init),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the SpecFork product", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>SpecFork/);
  assert.match(html, /Your code can be green/);
  assert.match(html, /spec is broken/);
  assert.match(html, /Fork this spec/);
  assert.match(html, /Built with Codex \+ GPT-5\.6/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});

test("returns a complete deterministic analysis without an API key", async () => {
  const response = await render("/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ticket: "Add an export button to the reports page.",
    }),
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.verdict, "red");
  assert.equal(payload.source, "demo");
  assert.equal(payload.forks.length, 3);
  assert.equal(payload.question.options.length, 3);
});

test("executes three contracts in the controlled behavior sandbox", async () => {
  const analysisResponse = await render("/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ticket: "Add an export button to the reports page.",
    }),
  });
  const analysis = await analysisResponse.json();

  const response = await render("/api/execute", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ticket: analysis.ticket,
      forks: analysis.forks,
    }),
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.runner, "controlled-behavior-sandbox");
  assert.equal(payload.runs.length, 3);
  assert.equal(payload.scenarios.length, 4);
  assert.equal(payload.agreement, 25);
  assert.equal(payload.runs[0].outcomes[0].observed, "4 rows");
  assert.equal(payload.runs[1].outcomes[0].observed, "2 rows");
  assert.equal(payload.runs[2].outcomes[0].observed, "1 visible row");
});

test("serves verified evidence from the hardened container demo", async () => {
  const response = await render("/api/worktree");
  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.equal(payload.runner, "docker-worktree-demo");
  assert.equal(payload.trustBoundary, "bundled-fixture-only");
  assert.equal(payload.patchSource, "demo");
  assert.equal(payload.limits.network, "disabled");
  assert.equal(payload.limits.rootFilesystem, "read-only");
  assert.equal(payload.limits.capabilities, "all dropped");
  assert.equal(payload.limits.noNewPrivileges, true);
  assert.equal(payload.branches.length, 3);
  assert.equal(payload.branches[0].patchSha256.length, 64);
  assert.equal(
    payload.branches.every((branch) => branch.contractStatus === "passed"),
    true,
  );
  assert.notEqual(
    payload.branches[0].normal.format,
    payload.branches[2].normal.format,
  );
  // The served conflict list must be derived from the served branch data,
  // never a hand-curated constant (SpecFork's core claim). Diffing the real
  // fixture yields 10 observable conflicts (5 fields × normal + large).
  assert.deepEqual(payload.conflicts, deriveConflicts(payload.branches));
  assert.equal(payload.conflicts.length, 10);
});

test("accepts the three allowlisted demo patch proposals", async () => {
  const response = await render("/api/patches", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ticket: "Add an export button to the reports page.",
    }),
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.source, "demo");
  assert.equal(payload.accepted, 3);
  assert.equal(payload.executionEligible, true);
  assert.equal(payload.proposals.length, 3);
});

test("rejects a submitted patch that attempts privileged access", async () => {
  const response = await render("/api/patches", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      proposals: [
        {
          forkId: "x",
          intent: "Escape the runner",
          target: "../server.mjs",
          rationale: "unsafe test fixture",
          content:
            'import fs from "node:fs"; export async function exportReport(){ return process.env; }',
        },
      ],
    }),
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.source, "submitted");
  assert.equal(payload.accepted, 0);
  assert.equal(payload.executionEligible, false);
  assert.deepEqual(payload.proposals[0].violations.sort(), [
    "import-not-allowed",
    "privileged-module",
    "process-access",
    "target-not-allowed",
  ]);
});

test("rejects a patch that hides eval behind a unicode escape", async () => {
  const response = await render("/api/patches", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      proposals: [
        {
          forkId: "a",
          intent: "Obfuscated escape",
          target: "export-service.mjs",
          rationale: "unsafe test fixture",
          // eval resolves to eval at runtime but never spells "eval" in source.
          content:
            'export async function exportReport(){ \\u0065val("1"); return {}; }',
        },
      ],
    }),
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.accepted, 0);
  assert.equal(payload.executionEligible, false);
  assert.ok(payload.proposals[0].violations.includes("obfuscated-source"));
});

test("returns 400 for a malformed JSON body", async () => {
  const response = await render("/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{ not valid json",
  });

  assert.equal(response.status, 400);
});

test("validates live model analysis before it reaches the client", () => {
  const valid = {
    summary: "Three reasonable interpretations disagree.",
    disagreement: ["Scope", "Format"],
    forks: ["a", "b", "c"].map((id, index) => ({
      id,
      label: `Agent ${id.toUpperCase()}`,
      intent: `Intent ${index + 1}`,
      behavior: ["One", "Two", "Three", "Four"],
      tests: 12 + index,
      artifact: `contract${id.toUpperCase()}()`,
    })),
    question: {
      prompt: "Which behavior should win?",
      options: ["all", "filtered", "visible"].map((id) => ({
        id,
        label: id,
        resolves: "scope",
      })),
    },
  };

  assert.deepEqual(parseAnalysisPayload(valid), valid);
  assert.equal(parseAnalysisPayload({ ...valid, forks: valid.forks.slice(0, 2) }), null);
  assert.equal(
    parseAnalysisPayload({
      ...valid,
      question: { ...valid.question, options: [{ id: "only" }] },
    }),
    null,
  );
  assert.equal(parseAnalysisPayload({ ...valid, summary: 42 }), null);
});
