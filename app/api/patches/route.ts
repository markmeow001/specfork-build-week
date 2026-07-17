import {
  reviewPatch,
  ALLOWED_TARGET,
  MAX_PATCH_BYTES,
} from "../../../scripts/patch-policy.mjs";

type PatchProposal = {
  forkId: string;
  intent: string;
  target: string;
  content: string;
  rationale: string;
};

const demoProposals: PatchProposal[] = [
  {
    forkId: "a",
    intent: "Data portability",
    target: ALLOWED_TARGET,
    rationale: "Export all accessible rows immediately as CSV.",
    content: `import { reportRows } from "./report-data.mjs";

export async function exportReport({ largeDataset = false } = {}) {
  return {
    scope: largeDataset ? 25000 : reportRows.length,
    format: "csv",
    filter: "ignored",
    delivery: "immediate",
    includesCharts: false,
  };
}`,
  },
  {
    forkId: "b",
    intent: "Continue the current workflow",
    target: ALLOWED_TARGET,
    rationale: "Preserve the current filter and queue large CSV exports.",
    content: `import { reportRows, reportView } from "./report-data.mjs";

export async function exportReport({ largeDataset = false } = {}) {
  const filtered = reportRows.filter(
    (row) => row.region === reportView.activeFilter.region,
  );
  return {
    scope: largeDataset ? 25000 : filtered.length,
    format: "csv",
    filter: "preserved",
    delivery: largeDataset ? "background-job" : "immediate",
    includesCharts: false,
  };
}`,
  },
  {
    forkId: "c",
    intent: "Share what is on screen",
    target: ALLOWED_TARGET,
    rationale: "Render the visible branded report as a previewable PDF.",
    content: `import { reportView } from "./report-data.mjs";

export async function exportReport() {
  return {
    scope: reportView.visibleRowIds.length,
    format: "pdf",
    filter: "visible-state",
    delivery: "preview",
    includesCharts: true,
  };
}`,
  },
];

function extractOutputText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const candidate = payload as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
  };
  if (candidate.output_text) return candidate.output_text;
  for (const item of candidate.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.text) return content.text;
    }
  }
  return null;
}

function response(
  proposals: PatchProposal[],
  source: "gpt-5.6" | "demo" | "submitted",
) {
  const reviewed = proposals.slice(0, 3).map(reviewPatch);
  return Response.json({
    source,
    policy: {
      allowedTargets: [ALLOWED_TARGET],
      maxPatchBytes: MAX_PATCH_BYTES,
      network: "forbidden",
      processExecution: "forbidden",
      environmentAccess: "forbidden",
      execution: "hardened-container-only",
    },
    accepted: reviewed.filter((proposal) => proposal.accepted).length,
    proposals: reviewed,
    executionEligible:
      source === "demo" && reviewed.every((proposal) => proposal.accepted),
  });
}

export async function POST(request: Request) {
  let body: { ticket?: string; proposals?: PatchProposal[] };
  try {
    body = (await request.json()) as {
      ticket?: string;
      proposals?: PatchProposal[];
    };
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (body.proposals?.length) {
    return response(body.proposals, "submitted");
  }
  const ticket = body.ticket?.trim().slice(0, 4000);
  if (!ticket) {
    return Response.json({ error: "A ticket is required." }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return response(demoProposals, "demo");

  const prompt = `You are one stage in SpecFork, a software ambiguity tester.

Create exactly three mutually incompatible implementations for this ticket:
${ticket}

You may replace only export-service.mjs. It must export async function exportReport. It may import only ./report-data.mjs. Do not use filesystem, process, environment, network, dynamic imports, eval, Function, require, dependencies, or side effects.

Return JSON only:
{"proposals":[{"forkId":"a","intent":"short title","target":"export-service.mjs","content":"complete JavaScript module","rationale":"one sentence"}]}`;

  try {
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
    });
    if (!upstream.ok) return response(demoProposals, "demo");

    const outputText = extractOutputText(await upstream.json());
    if (!outputText) return response(demoProposals, "demo");
    const parsed = JSON.parse(
      outputText.replace(/^```json\s*/i, "").replace(/\s*```$/, ""),
    ) as { proposals?: PatchProposal[] };
    if (parsed.proposals?.length !== 3) return response(demoProposals, "demo");
    return response(parsed.proposals, "gpt-5.6");
  } catch {
    return response(demoProposals, "demo");
  }
}
