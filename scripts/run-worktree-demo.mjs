import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
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

// Per-run secret that signs the probe's result line so untrusted patch code
// (which can call console.log / setTimeout but cannot read process.argv through
// the policy gate) cannot forge or override the reported observation.
const probeToken = randomBytes(16).toString("hex");

// Containers created this run, so signal-driven termination can still remove
// them. try/finally does NOT run when the process is killed by a signal (e.g.
// the parent runner's execFileSync timeout sends SIGTERM), which would
// otherwise orphan a running container and leak the temp repo.
const activeContainers = new Set();

function emergencyCleanup() {
  for (const name of activeContainers) {
    try {
      execFileSync("docker", ["rm", "-f", name], {
        stdio: "ignore",
        timeout: 2000,
      });
    } catch {
      // Best effort — we are already tearing down.
    }
  }
  activeContainers.clear();
  rmSync(tempRoot, { recursive: true, force: true });
}

for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"]) {
  process.on(signal, () => {
    emergencyCleanup();
    process.exit(signal === "SIGINT" ? 130 : 143);
  });
}

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
  // Only trust the line the probe signed with the per-run token. Untrusted
  // patch code can print arbitrary `{...}` lines (even deferred via setTimeout,
  // which would win a plain findLast), but cannot produce the token because the
  // gate blocks it from reading process.argv.
  const prefix = `${probeToken} `;
  const line = stdout.split("\n").findLast((item) => item.startsWith(prefix));
  if (!line) throw new Error("Probe did not return a signed result line.");
  return JSON.parse(line.slice(prefix.length));
}

function runInContainer(worktree, nodeArgs) {
  const containerName = `specfork-${process.pid}-${containerCounter++}`;
  activeContainers.add(containerName);
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
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 2000,
      });
      activeContainers.delete(containerName);
    } catch (error) {
      const message = String(error?.stderr ?? error?.message ?? "");
      if (/No such container/i.test(message)) {
        // Benign: a successful --rm run already removed the container.
        activeContainers.delete(containerName);
      } else {
        // A real failure (daemon busy, rm timeout) may leave a live container.
        // Surface it and keep it tracked so emergencyCleanup retries on exit.
        process.stderr.write(
          `WARN: could not remove container ${containerName}: ${message.trim()}\n`,
        );
      }
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
      executeNode(worktree, [
        "acceptance-probe.mjs",
        `--probe-token=${probeToken}`,
      ]),
    );
    const large = parseProbe(
      executeNode(worktree, [
        "acceptance-probe.mjs",
        `--probe-token=${probeToken}`,
        "--large",
      ]),
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
