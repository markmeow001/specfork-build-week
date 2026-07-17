# SpecFork agent rules

## Product thesis

SpecFork tests whether independent, reasonable interpretations of one software requirement converge on the same observable behavior.

The core demo is:

`ticket → divergent behavioral contracts → CODE GREEN / SPEC RED → one clarification → converged executable spec`

## Scope

Build the smallest complete OpenAI Build Week submission. Do not turn SpecFork into a general project-management suite, requirements database, coding IDE, or autonomous deployment platform.

## Product rules

- Judge ambiguity through observable behavior, not grammar alone.
- Every fork must be individually reasonable and mutually incompatible.
- The product must show evidence of disagreement, not only an AI-generated score.
- Ask one high-value clarification question at a time.
- Clearly label deterministic demo output versus live GPT-5.6 output.
- Preserve a credential-free demo path for judges.

## Current prototype boundary

The current version generates behavioral contracts, can request three GPT patch proposals through the local Agent Runner, and runs accepted proposals in real Git worktrees inside hardened disposable Docker containers for a bundled trusted fixture. Arbitrary repositories and remote coding-agent infrastructure are not complete and must not be falsely represented as such.

## Safety

- Never expose `OPENAI_API_KEY` to browser code.
- Do not execute generated code or clone untrusted repositories without an isolated sandbox and explicit resource limits.
- Keep the built-in behavior runner deterministic and free of dynamic evaluation.
- The local worktree runner may execute only files shipped in `fixtures/worktree-demo`.
- Container execution must keep networking disabled, the source mount and root filesystem read-only, all capabilities dropped, `no-new-privileges` enabled, and explicit CPU, memory, PID, and timeout limits.
- Model patch proposals must pass the server-side target, size, import, contract, and forbidden-capability policy before any local execution step.
- Live model patches are review-only in the web app; never imply that the browser or Cloudflare worker executed them.
- Only the local Agent Runner may execute an accepted model patch, and only inside the hardened container. A timed-out container must be force-removed in a `finally` path.
- Do not silently fall back while claiming a live-model result.

## Verification

Run:

```bash
npm test
```

before committing meaningful changes.
