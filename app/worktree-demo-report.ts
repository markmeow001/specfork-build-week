import { deriveConflicts } from "../scripts/derive-conflicts.mjs";

const branches = [
    {
      id: "a",
      branch: "specfork/agent-a",
      intent: "Data portability",
      patchSha256:
        "061fbc00362b0729cc5c8f0c3655fd32180a39f3be09f3b7ce81d6e553def768",
      commit: "989a532c",
      contractStatus: "passed",
      durationMs: 641,
      normal: {
        scope: 4,
        format: "csv",
        filter: "ignored",
        delivery: "immediate",
        includesCharts: false,
      },
      large: {
        scope: 25000,
        format: "csv",
        filter: "ignored",
        delivery: "immediate",
        includesCharts: false,
      },
    },
    {
      id: "b",
      branch: "specfork/agent-b",
      intent: "Continue the current workflow",
      patchSha256:
        "350f637dae5a156127c3dd2b78d7d6dd6a474cd319402885be3bd097d1b10a9b",
      commit: "53292bf1",
      contractStatus: "passed",
      durationMs: 562,
      normal: {
        scope: 2,
        format: "csv",
        filter: "preserved",
        delivery: "immediate",
        includesCharts: false,
      },
      large: {
        scope: 25000,
        format: "csv",
        filter: "preserved",
        delivery: "background-job",
        includesCharts: false,
      },
    },
    {
      id: "c",
      branch: "specfork/agent-c",
      intent: "Share what is on screen",
      patchSha256:
        "865a67210e3aa944f29b0f418304dd4ed20c1da20051267d94b4aaec52f60c40",
      commit: "dbe2cdeb",
      contractStatus: "passed",
      durationMs: 597,
      normal: {
        scope: 1,
        format: "pdf",
        filter: "visible-state",
        delivery: "preview",
        includesCharts: true,
      },
      large: {
        scope: 1,
        format: "pdf",
        filter: "visible-state",
        delivery: "preview",
        includesCharts: true,
      },
    },
  ] as const;

export const worktreeDemoReport = {
  schemaVersion: 1,
  runner: "docker-worktree-demo",
  trustBoundary: "bundled-fixture-only",
  repository: "trusted/reports-export-fixture",
  patchSource: "demo",
  baseCommit: "fc519b9a",
  generatedAt: "2026-07-16T19:51:08.121Z",
  limits: {
    timeoutMs: 5000,
    maxOldSpaceMb: 64,
    containerMemoryMb: 96,
    cpus: 0.5,
    pids: 64,
    network: "disabled",
    rootFilesystem: "read-only",
    capabilities: "all dropped",
    noNewPrivileges: true,
    credentials: "empty temporary HOME",
    image:
      "node@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2",
  },
  branches,
  conflicts: deriveConflicts(branches),
} as const;
