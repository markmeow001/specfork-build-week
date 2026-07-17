type AnalysisResponse = {
  ticket: string;
  verdict: "red";
  summary: string;
  disagreement: string[];
  forks: Array<{
    id: string;
    label: string;
    intent: string;
    behavior: string[];
    tests: number;
    artifact: string;
  }>;
  question: {
    prompt: string;
    options: Array<{ id: string; label: string; resolves: string }>;
  };
  source: "gpt-5.6" | "demo";
};

function demoAnalysis(ticket: string): AnalysisResponse {
  if (
    ticket.toLowerCase().includes("export") &&
    ticket.toLowerCase().includes("report")
  ) {
    return {
      ticket,
      verdict: "red",
      summary:
        "Three implementations pass their own tests, but disagree on observable product behavior.",
      disagreement: [
        "File format",
        "Export scope",
        "Filter behavior",
        "Large datasets",
      ],
      source: "demo",
      forks: [
        {
          id: "a",
          label: "Agent A",
          intent: "Data portability",
          behavior: [
            "Exports every accessible row",
            "CSV format",
            "Ignores active filters",
            "Downloads immediately",
          ],
          tests: 14,
          artifact: "exportAllRows({ format: 'csv' })",
        },
        {
          id: "b",
          label: "Agent B",
          intent: "Continue the current workflow",
          behavior: [
            "Exports filtered results only",
            "CSV format",
            "Preserves sort order",
            "Queues large exports",
          ],
          tests: 13,
          artifact: "exportView(activeQuery, { format: 'csv' })",
        },
        {
          id: "c",
          label: "Agent C",
          intent: "Share what is on screen",
          behavior: [
            "Exports the visible report",
            "PDF format",
            "Includes charts and branding",
            "Matches the current viewport",
          ],
          tests: 15,
          artifact: "renderReport({ target: 'pdf', view: current })",
        },
      ],
      question: {
        prompt: "What should the export represent?",
        options: [
          {
            id: "all",
            label: "Everything the user can access",
            resolves: "scope",
          },
          {
            id: "filtered",
            label: "The current filtered results",
            resolves: "scope-and-filters",
          },
          {
            id: "visible",
            label: "Exactly what is visible on screen",
            resolves: "scope-format-and-layout",
          },
        ],
      },
    };
  }

  return {
    ticket,
    verdict: "red",
    summary:
      "Three reasonable implementations satisfy the ticket but disagree on user-visible behavior.",
    disagreement: ["Scope", "Default behavior", "Failure handling", "Completion signal"],
    source: "demo",
    forks: [
      {
        id: "a",
        label: "Agent A",
        intent: "Literal implementation",
        behavior: [
          "Implements the shortest direct path",
          "Uses the existing page defaults",
          "Handles only the happy path",
          "Completes synchronously",
        ],
        tests: 12,
        artifact: "implement(ticket, { strategy: 'literal' })",
      },
      {
        id: "b",
        label: "Agent B",
        intent: "Power-user workflow",
        behavior: [
          "Applies the current user context",
          "Preserves filters and preferences",
          "Adds recoverable error states",
          "Completes in the background",
        ],
        tests: 15,
        artifact: "implement(ticket, { strategy: 'contextual' })",
      },
      {
        id: "c",
        label: "Agent C",
        intent: "Safety-first workflow",
        behavior: [
          "Requires confirmation before action",
          "Uses the narrowest possible scope",
          "Explains partial failures",
          "Creates an audit event",
        ],
        tests: 14,
        artifact: "implement(ticket, { strategy: 'guarded' })",
      },
    ],
    question: {
      prompt: "Which outcome should the user experience?",
      options: [
        { id: "all", label: "Complete the action immediately", resolves: "timing" },
        { id: "filtered", label: "Respect the current context", resolves: "context" },
        { id: "visible", label: "Preview and confirm first", resolves: "safety" },
      ],
    },
  };
}

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

export async function POST(request: Request) {
  let body: { ticket?: string };
  try {
    body = (await request.json()) as { ticket?: string };
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const ticket = body.ticket?.trim().slice(0, 4000);
  if (!ticket) {
    return Response.json({ error: "A ticket is required." }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(demoAnalysis(ticket));
  }

  const prompt = `You are SpecFork, an ambiguity testing engine for software requirements.

Given one product ticket, produce exactly three mutually incompatible but individually reasonable interpretations. Each interpretation must describe observable behavior, not implementation trivia. Then identify the disagreements and ask exactly one multiple-choice clarification question that removes the most ambiguity.

Return JSON only, matching this shape:
{
  "summary": "one sentence",
  "disagreement": ["2-5 short labels"],
  "forks": [
    {
      "id": "a",
      "label": "Agent A",
      "intent": "short title",
      "behavior": ["exactly 4 observable behaviors"],
      "tests": 12,
      "artifact": "one short pseudo-code contract"
    }
  ],
  "question": {
    "prompt": "one decisive question",
    "options": [
      { "id": "all", "label": "answer", "resolves": "short label" },
      { "id": "filtered", "label": "answer", "resolves": "short label" },
      { "id": "visible", "label": "answer", "resolves": "short label" }
    ]
  }
}

Ticket:
${ticket}`;

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
        max_output_tokens: 2400,
      }),
    });

    if (!upstream.ok) {
      return Response.json(demoAnalysis(ticket));
    }

    const payload = await upstream.json();
    const outputText = extractOutputText(payload);
    if (!outputText) return Response.json(demoAnalysis(ticket));

    const parsed = JSON.parse(
      outputText.replace(/^```json\s*/i, "").replace(/\s*```$/, ""),
    ) as Omit<AnalysisResponse, "ticket" | "verdict" | "source">;

    return Response.json({
      ...parsed,
      ticket,
      verdict: "red",
      source: "gpt-5.6",
    } satisfies AnalysisResponse);
  } catch {
    return Response.json(demoAnalysis(ticket));
  }
}
