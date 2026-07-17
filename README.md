# SpecFork

> If two agents correctly follow your ticket and build different things, your ticket is broken.

SpecFork is an ambiguity-testing prototype for AI-assisted software development. It gives one product ticket to multiple independent interpretations, compares the observable behaviors they imply, and asks the single clarification question that removes the most uncertainty.

## Demo flow

1. Paste a product ticket.
2. SpecFork generates three reasonable but incompatible behavioral contracts.
3. Run a controlled behavior sandbox against all three contracts.
4. See each branch pass its own probes while producing incompatible outcomes.
5. Answer one high-value clarification question.
6. SpecFork produces a converged, executable specification.

## Hardened Git worktree demo

The repository includes a trusted reports-export fixture and a local runner
that:

1. initializes a temporary Git repository;
2. creates three isolated worktrees and branches;
3. installs one reasonable implementation in each branch;
4. runs each branch in a disposable Docker container with no network, a
   read-only root filesystem, all Linux capabilities dropped, and
   `no-new-privileges`;
5. enforces a five-second host timeout, 96 MB container memory, 64 MB Node
   heap, 0.5 CPU, and 64-process limit;
6. runs the same external probes against every branch;
7. deletes the temporary repository and containers after producing the report.

Run it with:

```bash
npm run demo:sandbox
```

Verify the isolation boundaries independently with:

```bash
npm run verify:sandbox
```

This negative test attempts and rejects source mutation, root-filesystem
mutation, external DNS access, retained Linux capabilities, and privilege
escalation.

The web demo exposes a recorded, reproducible result from this runner. The
deployed Cloudflare-compatible app does not invoke local Git processes.

## Model patch gate

After the three interpretations are created, SpecFork can request three full
replacement proposals for `export-service.mjs`. Every proposal passes through a
server-side policy gate before it can be considered for container execution:

- exactly one allowlisted target file;
- 5,000-byte maximum;
- required `exportReport` contract;
- only the bundled `report-data.mjs` import;
- no process, filesystem, network, environment, dynamic import, `eval`, or
  global-constructor access.

Credential-free demo proposals correspond to the verified container run. Live
GPT proposals are displayed as reviewed proposals but are not executed by the
browser or Cloudflare worker.

The local Agent Runner closes the full loop:

```bash
npm run demo:agent-runner
```

With `OPENAI_API_KEY` in the process environment, this command requests three
GPT-5.6 proposals, revalidates them locally, writes each accepted proposal into
a temporary worktree, executes it only inside the hardened container, and emits
request, commit, patch digest, policy, timing, test, and behavior evidence. With
no key, it labels and runs the deterministic Demo source through the same path.

Non-terminating generated code is covered by:

```bash
npm run verify:runner-timeout
```

The sandbox uses the pinned official image:

```text
node@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2
```

The app includes a deterministic demo mode, so the complete flow works without credentials. When `OPENAI_API_KEY` is set, `/api/analyze` uses GPT-5.6 through the OpenAI Responses API.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Build

```bash
npm run build
```

## OpenAI Build Week

SpecFork was created as a new project during OpenAI Build Week. Codex was used to research the problem, define the product mechanism, build the interaction, implement the API path, and verify the project.

GPT-5.6 is used to generate divergent but reasonable interpretations of ambiguous requirements, identify observable disagreements, and select the clarification question with the highest disambiguation value.

## Current prototype boundary

This version demonstrates semantic forking, controlled behavior probes, real
Git worktrees, hardened disposable containers over a bundled trusted fixture,
and convergence. It does not yet clone arbitrary repositories or let remote
Codex agents produce implementations.
