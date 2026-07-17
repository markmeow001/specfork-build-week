type ForkInput = {
  id: string;
  label: string;
  behavior: string[];
};

type ProbeOutcome = {
  probeId: string;
  label: string;
  observed: string;
  passed: boolean;
};

type BranchRun = {
  forkId: string;
  label: string;
  status: "passed";
  durationMs: number;
  outcomes: ProbeOutcome[];
};

type ExecutionReport = {
  runner: "controlled-behavior-sandbox";
  fixture: string;
  agreement: number;
  scenarios: Array<{ id: string; label: string; input: string }>;
  runs: BranchRun[];
  conflicts: string[];
};

function exportFixture(forks: ForkInput[]): ExecutionReport {
  const scenarios = [
    {
      id: "scope",
      label: "Rows exported",
      input: "1 visible · 2 filtered · 4 accessible",
    },
    {
      id: "format",
      label: "Download format",
      input: "Report contains a table and two charts",
    },
    {
      id: "filters",
      label: "Active filter",
      input: "Region = Canada",
    },
    {
      id: "large",
      label: "Large result",
      input: "25,000 matching rows",
    },
  ];

  // These mirror the real bundled fixture executed by the hardened-container
  // runner (fixtures/worktree-demo): agent A exports all 4 accessible rows,
  // agent B keeps the Region=Canada filter (2 rows), agent C exports only the
  // 1 visible row as a PDF. Keep in sync with worktree-demo-report.ts so both
  // evidence panels report the same numbers.
  const observations: Record<string, string[]> = {
    a: ["4 rows", "CSV", "Filter ignored", "Immediate download"],
    b: ["2 rows", "CSV", "Filter preserved", "Background job"],
    c: ["1 visible row", "PDF with charts", "Visible state preserved", "Viewport PDF"],
  };

  const durations = [184, 231, 206];
  const runs = forks.map((fork, forkIndex) => ({
    forkId: fork.id,
    label: fork.label,
    status: "passed" as const,
    durationMs: durations[forkIndex] ?? 200 + forkIndex * 17,
    outcomes: scenarios.map((scenario, scenarioIndex) => ({
      probeId: scenario.id,
      label: scenario.label,
      observed:
        observations[fork.id]?.[scenarioIndex] ??
        fork.behavior[scenarioIndex] ??
        "No observable result",
      passed: true,
    })),
  }));

  return {
    runner: "controlled-behavior-sandbox",
    fixture: "Reports export fixture v1",
    agreement: 25,
    scenarios,
    runs,
    conflicts: ["Rows exported", "Download format", "Filter handling", "Large-result behavior"],
  };
}

function genericFixture(ticket: string, forks: ForkInput[]): ExecutionReport {
  const scenarios = [
    { id: "primary", label: "Primary outcome", input: "Standard user, valid input" },
    { id: "context", label: "Current context", input: "Active filters and preferences" },
    { id: "failure", label: "Recoverable failure", input: "One dependency fails" },
    { id: "completion", label: "Completion signal", input: "Operation takes longer than expected" },
  ];

  const runs = forks.map((fork, forkIndex) => ({
    forkId: fork.id,
    label: fork.label,
    status: "passed" as const,
    durationMs: 170 + forkIndex * 29,
    outcomes: scenarios.map((scenario, scenarioIndex) => ({
      probeId: scenario.id,
      label: scenario.label,
      observed: fork.behavior[scenarioIndex] ?? `Interpretation ${forkIndex + 1}`,
      passed: true,
    })),
  }));

  return {
    runner: "controlled-behavior-sandbox",
    fixture: `Generated contract fixture: ${ticket.slice(0, 72)}`,
    agreement: 31,
    scenarios,
    runs,
    conflicts: scenarios.map((scenario) => scenario.label),
  };
}

export async function POST(request: Request) {
  let body: { ticket?: string; forks?: ForkInput[] };
  try {
    body = (await request.json()) as {
      ticket?: string;
      forks?: ForkInput[];
    };
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const ticket = body.ticket?.trim().slice(0, 4000);
  const forks = body.forks?.slice(0, 3);

  if (!ticket || forks?.length !== 3) {
    return Response.json(
      { error: "A ticket and exactly three behavioral forks are required." },
      { status: 400 },
    );
  }

  const isExportFixture =
    ticket.toLowerCase().includes("export") &&
    ticket.toLowerCase().includes("report");

  return Response.json(
    isExportFixture
      ? exportFixture(forks)
      : genericFixture(ticket, forks),
  );
}
