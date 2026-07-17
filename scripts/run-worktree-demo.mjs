import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { reviewPatch } from "./patch-policy.mjs";
import { deriveConflicts } from "./derive-conflicts.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const fixtureRoot = join(root, "fixtures", "worktree-demo");
const tempRoot = mkdtempSync(join(tmpdir(), "specfork-worktree-"));
const repository = join(tempRoot, "repository");
const worktreesRoot = join(tempRoot, "worktrees");
const timeout = 5000;
const containerMode = process.argv.includes("--container");
const containerImage =
  "node@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2";
const proposalFlag = process.argv.indexOf("--proposal-file");
const patchSourceFlag = process.argv.indexOf("--patch-source");
const proposalFile = proposalFlag >= 0 ? process.argv[proposalFlag + 1] : null;
const patchSource =
  patchSourceFlag >= 0 ? process.argv[patchSourceFlag + 1] : "bundled-fixture";
const proposals = proposalFile
  ? JSON.parse(readFileSync(proposalFile, "utf8")).map(reviewPatch)
  : null;
let containerCounter = 0;

const branches = [
  {
    id: "a",
    name: "specfork/agent-a",
    intent: "Data portability",
  },
  {
    id: "b",
    name: "specfork/agent-b",
    intent: "Continue the current workflow",
  },
  {
    id: "c",
    name: "specfork/agent-c",
    intent: "Share what is on screen",
  },
];

function run(binary, args, cwd) {
  return execFileSync(binary, args, {
    cwd,
    encoding: "utf8",
    timeout,
    maxBuffer: 1024 * 1024,
    env: {
      PATH: process.env.PATH,
      HOME: tempRoot,
      LANG: "C",
      LC_ALL: "C",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_DATE: "2026-01-01T00:00:00Z",
      GIT_COMMITTER_DATE: "2026-01-01T00:00:00Z",
    },
  }).trim();
}

function git(args, cwd = repository) {
  return run("git", args, cwd);
}

function parseProbe(stdout) {
  const line = stdout.split("\n").findLast((item) => item.trim().startsWith("{"));
  if (!line) throw new Error("Probe did not return JSON.");
  return JSON.parse(line);
}

function runInContainer(worktree, nodeArgs) {
  const containerName = `specfork-${process.pid}-${containerCounter++}`;
  try {
    return run(
      "docker",
      [
      "run",
      "--rm",
      "--name",
      containerName,
      "--read-only",
      "--network",
      "none",
      "--env",
      "HTTP_PROXY=",
      "--env",
      "HTTPS_PROXY=",
      "--env",
      "ALL_PROXY=",
      "--env",
      "NO_PROXY=*",
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges",
      "--pids-limit",
      "64",
      "--memory",
      "96m",
      "--cpus",
      "0.5",
      "--user",
      "1000:1000",
      "--tmpfs",
      "/tmp:rw,noexec,nosuid,size=16m",
      "--mount",
      `type=bind,src=${worktree},dst=/workspace,readonly`,
      "--workdir",
      "/workspace",
      containerImage,
      "node",
      "--max-old-space-size=64",
      ...nodeArgs,
      ],
      worktree,
    );
  } finally {
    try {
      execFileSync("docker", ["rm", "-f", containerName], {
        stdio: "ignore",
        timeout: 2000,
      });
    } catch {
      // A successful --rm run leaves nothing to clean up.
    }
  }
}

function executeNode(worktree, nodeArgs) {
  if (containerMode) return runInContainer(worktree, nodeArgs);
  return run(
    process.execPath,
    ["--max-old-space-size=64", ...nodeArgs],
    worktree,
  );
}

try {
  if (proposals && !containerMode) {
    throw new Error("External patch proposals require --container.");
  }
  if (
    proposals &&
    (proposals.length !== 3 ||
      proposals.map((proposal) => proposal.forkId).sort().join("") !== "abc" ||
      proposals.some(
        (proposal) =>
          !proposal.accepted || proposal.target !== "export-service.mjs",
      ))
  ) {
    throw new Error("Patch proposal file did not pass the policy gate.");
  }
  cpSync(join(fixtureRoot, "base"), repository, { recursive: true });
  git(["init", "--initial-branch=main"]);
  git(["config", "user.name", "SpecFork Demo Runner"]);
  git(["config", "user.email", "runner@specfork.local"]);
  git(["add", "."]);
  git(["commit", "-m", "Create trusted reports fixture"]);

  const startedAt = new Date();
  const results = [];

  for (const branch of branches) {
    const worktree = join(worktreesRoot, branch.id);
    git(["worktree", "add", "-b", branch.name, worktree, "main"]);

    const proposal = proposals?.find((item) => item.forkId === branch.id);
    if (proposal) {
      writeFileSync(join(worktree, "export-service.mjs"), proposal.content, {
        encoding: "utf8",
        mode: 0o644,
      });
    } else {
      cpSync(
        join(fixtureRoot, "implementations", `${branch.id}.mjs`),
        join(worktree, "export-service.mjs"),
      );
    }
    cpSync(
      join(fixtureRoot, "contracts", `${branch.id}.test.mjs`),
      join(worktree, "contract.test.mjs"),
    );

    git(["add", "export-service.mjs", "contract.test.mjs"], worktree);
    git(["commit", "-m", `Implement ${proposal?.intent ?? branch.intent}`], worktree);

    const testStarted = performance.now();
    const testOutput = executeNode(worktree, [
      "--test",
      "contract.test.mjs",
    ]);
    const durationMs = Math.max(1, Math.round(performance.now() - testStarted));
    const normal = parseProbe(
      executeNode(worktree, ["acceptance-probe.mjs"]),
    );
    const large = parseProbe(
      executeNode(worktree, ["acceptance-probe.mjs", "--large"]),
    );

    results.push({
      id: branch.id,
      branch: branch.name,
      intent: proposal?.intent ?? branch.intent,
      patchSha256: createHash("sha256")
        .update(readFileSync(join(worktree, "export-service.mjs")))
        .digest("hex"),
      commit: git(["rev-parse", "--short=8", "HEAD"], worktree),
      contractStatus: "passed",
      contractEvidence: testOutput.split("\n").slice(-5),
      durationMs,
      normal,
      large,
    });
  }

  const report = {
    schemaVersion: 1,
    runner: containerMode ? "docker-worktree-demo" : "git-worktree-demo",
    trustBoundary: "bundled-fixture-only",
    repository: "trusted/reports-export-fixture",
    patchSource,
    baseCommit: git(["rev-parse", "--short=8", "main"]),
    generatedAt: startedAt.toISOString(),
    limits: {
      timeoutMs: timeout,
      maxOldSpaceMb: 64,
      containerMemoryMb: containerMode ? 96 : null,
      cpus: containerMode ? 0.5 : null,
      pids: containerMode ? 64 : null,
      network: containerMode ? "disabled" : "not requested",
      rootFilesystem: containerMode ? "read-only" : "host",
      capabilities: containerMode ? "all dropped" : "host",
      noNewPrivileges: containerMode,
      credentials: "empty temporary HOME",
      image: containerMode ? containerImage : null,
    },
    branches: results,
    conflicts: deriveConflicts(results),
  };

  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(
      `SpecFork created ${results.length} worktrees in ${containerMode ? "hardened containers" : "the local runner"}; every contract passed; ${report.conflicts.length} observable conflicts remain.\n`,
    );
  }
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
