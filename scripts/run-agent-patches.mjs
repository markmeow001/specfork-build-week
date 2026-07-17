import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { reviewPatch } from "./patch-policy.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const fixtureRoot = join(root, "fixtures", "worktree-demo");
const tempRoot = mkdtempSync(join(tmpdir(), "specfork-agent-patches-"));
const proposalPath = join(tempRoot, "proposals.json");
const runnerPath = join(root, "scripts", "run-worktree-demo.mjs");
const ticket = "Add an export button to the reports page.";

const branches = [
  { id: "a", intent: "Data portability" },
  { id: "b", intent: "Continue the current workflow" },
  { id: "c", intent: "Share what is on screen" },
];

function extractOutputText(payload) {
  if (payload?.output_text) return payload.output_text;
  for (const item of payload?.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.text) return content.text;
    }
  }
  return null;
}

function demoProposals() {
  return branches.map((branch) => ({
    forkId: branch.id,
    intent: branch.intent,
    target: "export-service.mjs",
    rationale: "Credential-free proposal matching the trusted demo fixture.",
    content: readFileSync(
      join(fixtureRoot, "implementations", `${branch.id}.mjs`),
      "utf8",
    ),
  }));
}

function proposalSummary(proposal) {
  const summary = { ...proposal };
  delete summary.content;
  return summary;
}

function executionErrorSummary(error) {
  const candidate = error && typeof error === "object" ? error : {};
  const combined = [candidate.stdout, candidate.stderr, candidate.message]
    .filter(Boolean)
    .join("\n");
  return combined.split("\n").filter(Boolean).slice(-24);
}

async function generateProposals() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { source: "demo", requestId: null, proposals: demoProposals() };
  }

  const reportData = readFileSync(
    join(fixtureRoot, "base", "report-data.mjs"),
    "utf8",
  );
  const prompt = `You are SpecFork's implementation stage.

Ticket: ${ticket}

Create exactly three mutually incompatible but reasonable complete replacements for export-service.mjs. Assign forkId a, b, and c. The module must export async function exportReport and may import only ./report-data.mjs.

The established behavioral contracts are:
- a: export all accessible rows as CSV, ignore active filters, deliver immediately even for a large dataset.
- b: export filtered rows as CSV, preserve the active filter, queue a 25,000-row export as background-job.
- c: export the visible report as PDF, preserve visible-state, include charts, and deliver a preview.

The observable result is normalized to these fields before testing:
{ scope: number, format: "csv" | "pdf", filter: "ignored" | "preserved" | "visible-state", delivery: "immediate" | "background-job" | "preview", includesCharts: boolean }
You may return richer fields such as filename, mimeType, rowCount, or data, but the normalized result must satisfy the assigned behavioral contract.

Security policy: no filesystem, process, environment, network, dependencies, dynamic import, eval, Function, require, globalThis, constructor tricks, or side effects. Keep each file below 5,000 UTF-8 bytes.

Available fixture:
${reportData}

Return JSON only:
{"proposals":[{"forkId":"a","intent":"short title","target":"export-service.mjs","content":"complete JavaScript module","rationale":"one sentence"}]}`;

  const upstream = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5.6",
      reasoning: { effort: "medium" },
      input: prompt,
      max_output_tokens: 4200,
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!upstream.ok) {
    throw new Error(`OpenAI Responses API returned ${upstream.status}.`);
  }

  const payload = await upstream.json();
  const outputText = extractOutputText(payload);
  if (!outputText) throw new Error("OpenAI response did not contain text.");
  const parsed = JSON.parse(
    outputText.replace(/^```json\s*/i, "").replace(/\s*```$/, ""),
  );
  return {
    source: "gpt-5.6",
    requestId: payload.id ?? null,
    proposals: parsed.proposals,
  };
}

try {
  const generated = await generateProposals();
  const reviewed = (generated.proposals ?? []).map(reviewPatch);
  const ids = reviewed.map((proposal) => proposal.forkId).sort().join("");
  if (
    reviewed.length !== 3 ||
    ids !== "abc" ||
    reviewed.some((proposal) => !proposal.accepted)
  ) {
    process.stdout.write(
      `${JSON.stringify({
        status: "rejected",
        source: generated.source,
        requestId: generated.requestId,
        proposals: reviewed.map(proposalSummary),
      }, null, 2)}\n`,
    );
    process.exitCode = 2;
  } else {
    writeFileSync(proposalPath, JSON.stringify(reviewed), {
      encoding: "utf8",
      mode: 0o600,
    });
    try {
      const runnerOutput = execFileSync(
        process.execPath,
        [
          runnerPath,
          "--container",
          "--proposal-file",
          proposalPath,
          "--patch-source",
          generated.source,
          "--json",
        ],
        {
          cwd: root,
          encoding: "utf8",
          timeout: 60000,
          maxBuffer: 2 * 1024 * 1024,
          env: {
            PATH: process.env.PATH,
            HOME: tempRoot,
            LANG: "C",
            LC_ALL: "C",
          },
        },
      );
      const execution = JSON.parse(runnerOutput);
      process.stdout.write(
        `${JSON.stringify({
          status: "completed",
          source: generated.source,
          requestId: generated.requestId,
          patchGate: {
            accepted: reviewed.length,
            rejected: 0,
            proposals: reviewed.map(proposalSummary),
          },
          execution,
        }, null, 2)}\n`,
      );
    } catch (error) {
      process.stdout.write(
        `${JSON.stringify({
          status: "execution_failed",
          source: generated.source,
          requestId: generated.requestId,
          patchGate: {
            accepted: reviewed.length,
            rejected: 0,
            proposals: reviewed.map(proposalSummary),
          },
          error: executionErrorSummary(error),
        }, null, 2)}\n`,
      );
      process.exitCode = 3;
    }
  }
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
