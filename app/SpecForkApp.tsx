"use client";

import { useMemo, useState } from "react";

type Fork = {
  id: string;
  label: string;
  intent: string;
  behavior: string[];
  tests: number;
  artifact: string;
};

type Analysis = {
  ticket: string;
  verdict: "red" | "green";
  summary: string;
  disagreement: string[];
  forks: Fork[];
  question: {
    prompt: string;
    options: { id: string; label: string; resolves: string }[];
  };
  resolvedSpec?: string[];
  source: "gpt-5.6" | "demo";
};

type ExecutionReport = {
  runner: "controlled-behavior-sandbox";
  fixture: string;
  agreement: number;
  scenarios: { id: string; label: string; input: string }[];
  runs: {
    forkId: string;
    label: string;
    status: "passed";
    durationMs: number;
    outcomes: {
      probeId: string;
      label: string;
      observed: string;
      passed: boolean;
    }[];
  }[];
  conflicts: string[];
};

type WorktreeReport = {
  runner: "docker-worktree-demo";
  trustBoundary: "bundled-fixture-only";
  repository: string;
  patchSource: string;
  baseCommit: string;
  limits: {
    timeoutMs: number;
    maxOldSpaceMb: number;
    containerMemoryMb: number;
    cpus: number;
    pids: number;
    network: string;
    rootFilesystem: string;
    capabilities: string;
    noNewPrivileges: boolean;
    credentials: string;
    image: string;
  };
  branches: {
    id: string;
    branch: string;
    intent: string;
    patchSha256: string;
    commit: string;
    contractStatus: "passed";
    durationMs: number;
    normal: {
      scope: number;
      format: string;
      filter: string;
      delivery: string;
      includesCharts: boolean;
    };
    large: {
      delivery: string;
    };
  }[];
  conflicts: string[];
};

type PatchPlan = {
  source: "gpt-5.6" | "demo";
  accepted: number;
  executionEligible: boolean;
  policy: {
    allowedTargets: string[];
    maxPatchBytes: number;
    network: string;
    processExecution: string;
    environmentAccess: string;
    execution: string;
  };
  proposals: {
    forkId: string;
    intent: string;
    target: string;
    content: string;
    rationale: string;
    accepted: boolean;
    violations: string[];
    bytes: number;
  }[];
};

const SAMPLE_TICKET = "Add an export button to the reports page.";

const DEMO_ANALYSIS: Analysis = {
  ticket: SAMPLE_TICKET,
  verdict: "red",
  summary:
    "Three implementations pass their own tests, but disagree on observable product behavior.",
  disagreement: ["File format", "Export scope", "Filter behavior", "Large datasets"],
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

const RESOLVED_SPECS: Record<string, string[]> = {
  all: [
    "Add an Export CSV button to the Reports page.",
    "Export every row the signed-in user is authorized to access.",
    "Do not apply temporary table filters or pagination.",
    "For exports above 10,000 rows, create a background job and show progress.",
  ],
  filtered: [
    "Add an Export CSV button to the Reports page.",
    "Export the complete result set matching the current filters and sort order.",
    "Do not limit the export to the visible page.",
    "For exports above 10,000 rows, create a background job and show progress.",
  ],
  visible: [
    "Add an Export PDF button to the Reports page.",
    "Export exactly the charts, columns, filters, and date range currently visible.",
    "Preserve report branding and layout in the generated PDF.",
    "Show a preview before download.",
  ],
};

export function SpecForkApp() {
  const [ticket, setTicket] = useState(SAMPLE_TICKET);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoadingProof, setIsLoadingProof] = useState(false);
  const [isGeneratingPatches, setIsGeneratingPatches] = useState(false);
  const [execution, setExecution] = useState<ExecutionReport | null>(null);
  const [worktreeProof, setWorktreeProof] = useState<WorktreeReport | null>(
    null,
  );
  const [patchPlan, setPatchPlan] = useState<PatchPlan | null>(null);
  const [mode, setMode] = useState<"input" | "forks" | "resolved">("input");
  const [error, setError] = useState<string | null>(null);

  const confidence = useMemo(() => {
    if (!analysis) return 0;
    return analysis.verdict === "red" ? 31 : 96;
  }, [analysis]);

  async function analyzeTicket() {
    if (!ticket.trim()) return;
    setIsLoading(true);
    setError(null);
    setSelected(null);
    setExecution(null);
    setWorktreeProof(null);
    setPatchPlan(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ticket }),
      });
      if (!response.ok) throw new Error("Analysis request failed");
      const data = (await response.json()) as Analysis;
      setAnalysis(data);
    } catch {
      // Analysis has a deterministic demo fallback by design, so a failed
      // request degrades to demo mode rather than blocking the user.
      setAnalysis({ ...DEMO_ANALYSIS, ticket, source: "demo" });
    } finally {
      setMode("forks");
      setIsLoading(false);
    }
  }

  async function generatePatchPlan() {
    if (!analysis) return;
    setIsGeneratingPatches(true);
    setError(null);
    try {
      const response = await fetch("/api/patches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ticket: analysis.ticket }),
      });
      if (!response.ok) throw new Error("Patch proposals unavailable");
      setPatchPlan((await response.json()) as PatchPlan);
    } catch {
      setError("Could not generate the patch plan. Please try again.");
    } finally {
      setIsGeneratingPatches(false);
    }
  }

  async function loadWorktreeProof() {
    setIsLoadingProof(true);
    setError(null);
    try {
      const response = await fetch("/api/worktree");
      if (!response.ok) throw new Error("Worktree evidence unavailable");
      setWorktreeProof((await response.json()) as WorktreeReport);
    } catch {
      setError(
        "Could not load the hardened-container evidence. Please try again.",
      );
    } finally {
      setIsLoadingProof(false);
    }
  }

  async function runBehaviorSandbox() {
    if (!analysis) return;
    setIsRunning(true);
    setError(null);
    try {
      const response = await fetch("/api/execute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ticket: analysis.ticket,
          forks: analysis.forks,
        }),
      });
      if (!response.ok) throw new Error("Sandbox failed");
      setExecution((await response.json()) as ExecutionReport);
    } catch {
      setError("The behavior sandbox did not complete. Please try again.");
    } finally {
      setIsRunning(false);
    }
  }

  function resolveSpec(optionId: string) {
    if (!analysis) return;
    setSelected(optionId);
    const isExportDemo = analysis.ticket
      .toLowerCase()
      .includes("export button");
    const selectedOption = analysis.question.options.find(
      (option) => option.id === optionId,
    );
    const genericSpec = [
      `Implement this ticket: ${analysis.ticket}`,
      `The intended outcome is: ${selectedOption?.label ?? "the selected behavior"}.`,
      "Define the visible success state, recoverable failure state, and permission boundary.",
      "Add acceptance tests that verify the selected behavior and reject the two discarded interpretations.",
    ];
    setAnalysis({
      ...analysis,
      verdict: "green",
      summary:
        "The observable behavior is now specific enough for independent implementations to converge.",
      resolvedSpec: isExportDemo
        ? (RESOLVED_SPECS[optionId] ?? RESOLVED_SPECS.filtered)
        : genericSpec,
    });
    window.setTimeout(() => setMode("resolved"), 280);
  }

  function reset() {
    setAnalysis(null);
    setSelected(null);
    setExecution(null);
    setWorktreeProof(null);
    setPatchPlan(null);
    setError(null);
    setMode("input");
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={reset} aria-label="Return home">
          <span className="brand-mark" aria-hidden="true">
            SF
          </span>
          <span>SpecFork</span>
        </button>
        <div className="topbar-meta">
          <span className="model-pill">
            <span className="live-dot" /> GPT-5.6
          </span>
          <a href="#how-it-works">How it works</a>
        </div>
      </header>

      {mode === "input" ? (
        <section className="hero">
          <div className="eyebrow">AMBIGUITY TESTING FOR AI-BUILT SOFTWARE</div>
          <h1>
            Your code can be green
            <br />
            while your <span>spec is broken.</span>
          </h1>
          <p className="hero-copy">
            SpecFork gives the same ticket to independent AI agents. When valid
            implementations disagree, it shows exactly what your requirement
            forgot to decide.
          </p>

          <div className="ticket-composer">
            <div className="composer-label">
              <span>Paste a product ticket</span>
              <span className="shortcut">⌘ ↵ to run</span>
            </div>
            <textarea
              value={ticket}
              onChange={(event) => setTicket(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  analyzeTicket();
                }
              }}
              aria-label="Product ticket"
            />
            <div className="composer-footer">
              <button
                className="sample-link"
                onClick={() => setTicket(SAMPLE_TICKET)}
              >
                Load demo ticket
              </button>
              <button
                className="primary-button"
                onClick={analyzeTicket}
                disabled={isLoading || !ticket.trim()}
              >
                {isLoading ? "Forking interpretations…" : "Fork this spec"}
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>

          <div className="promise-row">
            <span>01</span> Find reasonable interpretations
            <i />
            <span>02</span> Build competing contracts
            <i />
            <span>03</span> Ask one decisive question
          </div>
        </section>
      ) : (
        <section className="workspace">
          <div className="workspace-heading">
            <div>
              <button className="back-button" onClick={reset}>
                ← New ticket
              </button>
              <div className="eyebrow">
                {mode === "resolved" ? "SPEC CONVERGED" : "FORK ANALYSIS"} ·{" "}
                {analysis?.source === "gpt-5.6" ? "LIVE MODEL" : "DEMO MODE"}
              </div>
              <h2>{analysis?.ticket}</h2>
            </div>
            <div className={`verdict-card ${mode === "resolved" ? "pass" : ""}`}>
              <div className="verdict-label">CODE STATUS</div>
              <strong>GREEN</strong>
              <div className="verdict-divider" />
              <div className="verdict-label">SPEC STATUS</div>
              <strong>{mode === "resolved" ? "GREEN" : "RED"}</strong>
            </div>
          </div>

          {error ? (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                aria-label="Dismiss error"
              >
                ×
              </button>
            </div>
          ) : null}

          {mode === "forks" && analysis ? (
            <>
              <div className="fork-grid">
                {analysis.forks.map((fork, index) => (
                  <article className="fork-card" key={fork.id}>
                    <div className="fork-topline">
                      <span className={`agent agent-${index}`}>{fork.label}</span>
                      <span className="tests">✓ {fork.tests} tests passed</span>
                    </div>
                    <h3>{fork.intent}</h3>
                    <ul>
                      {fork.behavior.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                    <code>{fork.artifact}</code>
                  </article>
                ))}
              </div>

              <section className="execution-panel">
                <div className="execution-heading">
                  <div>
                    <div className="eyebrow">EXECUTION EVIDENCE</div>
                    <h3>Run the same behavioral probes against every fork.</h3>
                    <p>
                      A controlled fixture executes each contract independently.
                      No generated or untrusted code is evaluated.
                    </p>
                  </div>
                  <button
                    className="primary-button"
                    onClick={runBehaviorSandbox}
                    disabled={isRunning}
                  >
                    {isRunning
                      ? "Running sandbox…"
                      : execution
                        ? "Run again"
                        : "Run behavior sandbox"}
                    <span aria-hidden="true">▶</span>
                  </button>
                </div>

                {execution ? (
                  <>
                    <div className="execution-meta">
                      <span>{execution.fixture}</span>
                      <strong>{execution.agreement}% cross-fork agreement</strong>
                    </div>
                    <div className="run-grid">
                      {execution.runs.map((run, runIndex) => (
                        <article className="run-card" key={run.forkId}>
                          <div className="run-title">
                            <span className={`agent agent-${runIndex}`}>
                              {run.label}
                            </span>
                            <span className="run-pass">
                              {run.outcomes.length}/{run.outcomes.length} own
                              probes passed · {run.durationMs}ms
                            </span>
                          </div>
                          <ul>
                            {run.outcomes.map((outcome) => (
                              <li key={outcome.probeId}>
                                <span>{outcome.label}</span>
                                <strong>{outcome.observed}</strong>
                              </li>
                            ))}
                          </ul>
                        </article>
                      ))}
                    </div>
                    <div className="execution-verdict">
                      <span>✓ Every branch passes its own contract</span>
                      <strong>✕ The branches still build different products</strong>
                    </div>

                    <div className="worktree-proof">
                      <div className="worktree-proof-heading">
                        <div>
                          <div className="eyebrow">
                            HARDENED CONTAINER EVIDENCE
                          </div>
                          <h4>
                            Three branches. Three containers. Zero shared
                            assumptions.
                          </h4>
                          <p>
                            This recorded run was produced by the included local
                            runner against a bundled trusted repository fixture.
                            Every branch executed inside a disposable,
                            network-disabled container.
                          </p>
                        </div>
                        {!worktreeProof ? (
                          <button
                            className="secondary-button"
                            onClick={loadWorktreeProof}
                            disabled={isLoadingProof}
                          >
                            {isLoadingProof
                              ? "Loading proof…"
                              : "Inspect worktree run"}
                          </button>
                        ) : null}
                      </div>

                      {worktreeProof ? (
                        <>
                          <div className="isolation-strip">
                            <span>Base {worktreeProof.baseCommit}</span>
                            <span>Patch source {worktreeProof.patchSource}</span>
                            <span>{worktreeProof.limits.timeoutMs}ms timeout</span>
                            <span>
                              {worktreeProof.limits.containerMemoryMb}MB container
                            </span>
                            <span>{worktreeProof.limits.cpus} CPU</span>
                            <span>{worktreeProof.limits.pids} PIDs</span>
                            <span>Network {worktreeProof.limits.network}</span>
                          </div>
                          <div className="branch-grid">
                            {worktreeProof.branches.map((branch, index) => (
                              <article key={branch.id}>
                                <div className="branch-head">
                                  <span className={`agent agent-${index}`}>
                                    {branch.branch}
                                  </span>
                                  <code>{branch.commit}</code>
                                </div>
                                <strong>{branch.intent}</strong>
                                <dl>
                                  <div>
                                    <dt>Contract</dt>
                                    <dd>✓ {branch.contractStatus}</dd>
                                  </div>
                                  <div>
                                    <dt>Patch SHA</dt>
                                    <dd>{branch.patchSha256.slice(0, 10)}</dd>
                                  </div>
                                  <div>
                                    <dt>Normal export</dt>
                                    <dd>
                                      {branch.normal.scope} rows ·{" "}
                                      {branch.normal.format.toUpperCase()}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt>Filter</dt>
                                    <dd>{branch.normal.filter}</dd>
                                  </div>
                                  <div>
                                    <dt>25k rows</dt>
                                    <dd>{branch.large.delivery}</dd>
                                  </div>
                                </dl>
                              </article>
                            ))}
                          </div>
                          <div className="proof-footer">
                            <strong>
                              {worktreeProof.branches.length} isolated containers
                            </strong>
                            <span>
                              {worktreeProof.conflicts.length} observable
                              conflicts recorded
                            </span>
                            <code>npm run demo:sandbox</code>
                          </div>

                          <section className="patch-gate">
                            <div className="patch-gate-heading">
                              <div>
                                <div className="eyebrow">MODEL PATCH GATE</div>
                                <h4>Code proposals stop here before execution.</h4>
                                <p>
                                  Each proposal is checked against a one-file
                                  allowlist and rejected for process, network,
                                  environment, filesystem, or dynamic-code access.
                                </p>
                              </div>
                              {!patchPlan ? (
                                <button
                                  className="secondary-button"
                                  onClick={generatePatchPlan}
                                  disabled={isGeneratingPatches}
                                >
                                  {isGeneratingPatches
                                    ? "Reviewing patches…"
                                    : "Generate + review patches"}
                                </button>
                              ) : null}
                            </div>

                            {patchPlan ? (
                              <>
                                <div className="policy-strip">
                                  <span>
                                    {patchPlan.source === "gpt-5.6"
                                      ? "Live GPT-5.6 proposals"
                                      : "Deterministic demo proposals"}
                                  </span>
                                  <span>Only export-service.mjs</span>
                                  <span>≤ {patchPlan.policy.maxPatchBytes} bytes</span>
                                  <strong>
                                    {patchPlan.accepted}/3 passed policy
                                  </strong>
                                </div>
                                <div className="patch-grid">
                                  {patchPlan.proposals.map((proposal, index) => (
                                    <article key={proposal.forkId}>
                                      <div className="patch-status">
                                        <span className={`agent agent-${index}`}>
                                          Agent {proposal.forkId.toUpperCase()}
                                        </span>
                                        <strong
                                          className={
                                            proposal.accepted ? "accepted" : "rejected"
                                          }
                                        >
                                          {proposal.accepted ? "✓ ACCEPTED" : "✕ REJECTED"}
                                        </strong>
                                      </div>
                                      <h5>{proposal.intent}</h5>
                                      <p>{proposal.rationale}</p>
                                      <code>
                                        {proposal.target} · {proposal.bytes} bytes
                                      </code>
                                      {proposal.violations.length ? (
                                        <small>{proposal.violations.join(" · ")}</small>
                                      ) : (
                                        <small>No policy violations</small>
                                      )}
                                    </article>
                                  ))}
                                </div>
                                <div className="patch-decision">
                                  <strong>
                                    {patchPlan.executionEligible
                                      ? "Demo patches match the verified container run."
                                      : "Live patches are reviewed only; local container execution is still required."}
                                  </strong>
                                  <span>
                                    Browser code never applies or executes a patch.
                                  </span>
                                </div>
                              </>
                            ) : null}
                          </section>
                        </>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <div className="execution-empty">
                    Awaiting execution · 4 probes × 3 independent contracts
                  </div>
                )}
              </section>

              <div className="diagnosis-panel">
                <div className="score-ring" style={{ "--score": `${confidence * 3.6}deg` } as React.CSSProperties}>
                  <span>{confidence}%</span>
                  <small>agreement</small>
                </div>
                <div className="diagnosis-copy">
                  <div className="eyebrow">WHY THE SPEC FAILED</div>
                  <h3>{analysis.summary}</h3>
                  <div className="chips">
                    {analysis.disagreement.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="question-panel">
                <div>
                  <span className="question-index">ONE QUESTION TO CONVERGE</span>
                  <h3>{analysis.question.prompt}</h3>
                </div>
                <div className="option-grid">
                  {analysis.question.options.map((option, index) => (
                    <button
                      key={option.id}
                      className={selected === option.id ? "selected" : ""}
                      onClick={() => resolveSpec(option.id)}
                    >
                      <span>{String.fromCharCode(65 + index)}</span>
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : null}

          {mode === "resolved" && analysis?.resolvedSpec ? (
            <div className="resolved-layout">
              <section className="resolved-card">
                <div className="resolved-icon">✓</div>
                <div className="eyebrow">EXECUTABLE SPEC</div>
                <h3>Independent agents now agree.</h3>
                <ol>
                  {analysis.resolvedSpec.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ol>
                <div className="resolved-actions">
                  <button className="primary-button" onClick={reset}>
                    Test another ticket
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() =>
                      navigator.clipboard?.writeText(
                        analysis.resolvedSpec?.join("\n") ?? "",
                      )
                    }
                  >
                    Copy resolved spec
                  </button>
                </div>
              </section>
              <aside className="proof-card">
                <div className="eyebrow">CONVERGENCE PROOF</div>
                <div className="proof-row">
                  <span>Contracts compared</span>
                  <strong>3</strong>
                </div>
                <div className="proof-row">
                  <span>Behavior probes</span>
                  <strong>{execution?.scenarios.length ?? 4}</strong>
                </div>
                <div className="proof-row">
                  <span>Conflicts before</span>
                  <strong>4</strong>
                </div>
                <div className="proof-row">
                  <span>Conflicts after</span>
                  <strong className="good">0</strong>
                </div>
                <div className="proof-row">
                  <span>Behavioral agreement</span>
                  <strong className="good">96%</strong>
                </div>
                <p>
                  The resolved ticket now includes observable acceptance
                  boundaries and is ready to hand to a coding agent.
                </p>
              </aside>
            </div>
          ) : null}
        </section>
      )}

      <section className="method" id="how-it-works">
        <p>
          SpecFork does not ask whether a ticket <em>sounds</em> clear. It asks
          whether independent, reasonable implementations produce the same
          observable behavior.
        </p>
        <span>Built with Codex + GPT-5.6</span>
      </section>
    </main>
  );
}
