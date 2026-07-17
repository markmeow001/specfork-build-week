import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { reviewPatch } from "./patch-policy.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const fixtureRoot = join(root, "fixtures", "worktree-demo");
const tempRoot = mkdtempSync(join(tmpdir(), "specfork-timeout-test-"));
const proposalPath = join(tempRoot, "proposals.json");

const proposals = [
  {
    forkId: "a",
    intent: "Non-terminating implementation",
    target: "export-service.mjs",
    rationale: "Verifies host timeout and forced container cleanup.",
    content: "export async function exportReport() { while (true) {} }",
  },
  ...["b", "c"].map((id) => ({
    forkId: id,
    intent: `Control implementation ${id}`,
    target: "export-service.mjs",
    rationale: "Control branch for timeout verification.",
    content: readFileSync(
      join(fixtureRoot, "implementations", `${id}.mjs`),
      "utf8",
    ),
  })),
].map(reviewPatch);

try {
  if (proposals.some((proposal) => !proposal.accepted)) {
    throw new Error("Timeout fixture did not pass the static policy gate.");
  }
  writeFileSync(proposalPath, JSON.stringify(proposals), {
    encoding: "utf8",
    mode: 0o600,
  });

  const result = spawnSync(
    process.execPath,
    [
      join(root, "scripts", "run-worktree-demo.mjs"),
      "--container",
      "--proposal-file",
      proposalPath,
      "--patch-source",
      "timeout-test",
    ],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 15000,
      maxBuffer: 2 * 1024 * 1024,
    },
  );
  if (result.status === 0) {
    throw new Error("Non-terminating patch unexpectedly completed.");
  }

  const containers = spawnSync(
    "docker",
    ["ps", "-aq", "--filter", "name=specfork-"],
    { encoding: "utf8", timeout: 5000 },
  );
  if (containers.status !== 0) {
    throw new Error("Could not inspect container cleanup state.");
  }
  if (containers.stdout.trim()) {
    throw new Error("A timed-out SpecFork container was left behind.");
  }

  process.stdout.write(
    "Runner timeout verified: non-terminating code was stopped and its container was removed.\n",
  );
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
