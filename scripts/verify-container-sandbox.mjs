import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const fixture = join(root, "fixtures", "worktree-demo", "base");
const image =
  "node@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2";

const isolationArgs = [
  "run",
  "--rm",
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
];

function docker(extraArgs) {
  return spawnSync("docker", [...isolationArgs, ...extraArgs], {
    encoding: "utf8",
    timeout: 5000,
    maxBuffer: 1024 * 1024,
  });
}

const daemonProbe = spawnSync("docker", ["info", "--format", "{{.ServerVersion}}"], {
  encoding: "utf8",
  timeout: 5000,
});
if (daemonProbe.status !== 0 || !daemonProbe.stdout.trim()) {
  throw new Error("Docker daemon is unavailable; sandbox boundaries were not tested.");
}

function assertBlocked(result, label) {
  if (
    result.error ||
    result.signal === "SIGTERM" ||
    /docker API|daemon|docker\.sock/i.test(result.stderr)
  ) {
    throw new Error(`${label} verification could not complete.`);
  }
  if (result.status === 0) {
    throw new Error(`${label} was unexpectedly allowed.`);
  }
}

assertBlocked(
  docker([
    "--mount",
    `type=bind,src=${fixture},dst=/workspace,readonly`,
    image,
    "touch",
    "/workspace/specfork-write-probe",
  ]),
  "Source mutation",
);

assertBlocked(
  docker([image, "touch", "/usr/local/specfork-root-write-probe"]),
  "Root filesystem mutation",
);

const networkProbe = docker([
  image,
  "node",
  "-e",
  "fetch('https://example.com',{signal:AbortSignal.timeout(1500)}).then(()=>process.exit(9)).catch(()=>process.exit(0))",
]);
if (networkProbe.status !== 0) {
  throw new Error("External HTTPS unexpectedly succeeded inside the sandbox.");
}

const privilegeProbe = docker([
  image,
  "node",
  "-e",
  "const s=require('node:fs').readFileSync('/proc/self/status','utf8');const n=/NoNewPrivs:\\s+(\\d+)/.exec(s)?.[1];const c=/CapEff:\\s+([0-9a-f]+)/i.exec(s)?.[1];console.log(JSON.stringify({noNewPrivs:n,capEff:c}))",
]);
if (privilegeProbe.status !== 0) {
  throw new Error("Could not inspect container privilege state.");
}

const privilegeState = JSON.parse(privilegeProbe.stdout.trim());
if (
  privilegeState.noNewPrivs !== "1" ||
  !/^0+$/.test(privilegeState.capEff ?? "")
) {
  throw new Error("Container privileges were not fully restricted.");
}

process.stdout.write(
  "Sandbox boundaries verified: source and root are read-only, network is disabled, capabilities are empty, and no-new-privileges is active.\n",
);
