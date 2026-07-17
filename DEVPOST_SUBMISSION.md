# SpecFork — Devpost Submission Draft

## Submission essentials

- **Project name:** SpecFork
- **Tagline:** Test your spec before agents build three different products.
- **Category:** Developer Tools
- **Live demo:** https://specfork-build-week.holykinds.chatgpt.site
- **Source code:** https://github.com/markmeow001/specfork-build-week
- **License:** MIT
- **Demo video:** `[ADD PUBLIC YOUTUBE URL — UNDER 3 MINUTES]`
- **Codex Session ID:** `[ADD /feedback SESSION ID FROM THE PRIMARY BUILD SESSION]`

## Short description

SpecFork tests whether independent, reasonable interpretations of one software
requirement converge on the same observable behavior. It gives the same ticket
to multiple AI interpretations, turns each interpretation into a behavioral
contract, runs shared probes, and exposes the dangerous case where every branch
passes its own tests while the branches still build different products. It then
asks one high-value clarification question and produces a converged executable
specification.

## Inspiration

AI coding agents are getting better at implementing instructions, but that makes
ambiguous instructions more expensive. A coding agent can produce clean,
well-tested code that faithfully implements the wrong interpretation. Ordinary
tests answer “does the code match this interpretation?” They do not answer “did
everyone choose the same interpretation?”

SpecFork was built around one idea:

> Tests prove the code matches an interpretation. SpecFork proves the team chose
> the same interpretation.

## What it does

1. A user enters a product ticket.
2. GPT-5.6 produces three individually reasonable but mutually incompatible
   interpretations focused on observable behavior.
3. SpecFork compares the resulting contracts and shows `CODE GREEN / SPEC RED`.
4. A controlled fixture runs shared behavior probes against all three contracts.
5. A local Agent Runner can request three GPT-5.6 patch proposals, validate them
   through a server-side policy gate, place them in independent Git worktrees,
   and execute them in hardened disposable Docker containers.
6. SpecFork derives conflicts from the actual outputs instead of displaying a
   hand-authored score.
7. It asks one decisive multiple-choice question and produces a converged,
   executable specification.

The public site intentionally uses credential-free Demo Mode so judges can test
the complete interaction without an API key. Live GPT-5.6 patch execution was
separately verified through the local runner. The website clearly labels demo,
live-model, and recorded container evidence.

## How we built it

SpecFork is a vinext/React application with Cloudflare-compatible API routes.
GPT-5.6 is called through the OpenAI Responses API. Model output is validated at
runtime before reaching the UI.

The executable proof uses:

- real temporary Git repositories and three independent worktrees;
- a shared external behavior-probe contract;
- a single server/local patch policy implementation;
- exact patch SHA-256 and branch commit evidence;
- digest-pinned Node containers;
- disabled networking and proxy variables;
- read-only source and root filesystems;
- a non-root user, dropped Linux capabilities, and `no-new-privileges`;
- CPU, memory, PID, heap, and host timeout limits;
- signal-aware cleanup for timed-out containers.

The policy gate is deliberately described as a pre-filter, not a security
boundary. The hardened container is the trust boundary, and the current
prototype executes only the bundled trusted fixture.

## How we used Codex

Codex was the primary development environment for the project. It helped turn
the initial problem into an explicit product thesis, define the smallest
judgeable workflow, implement the application and runner, and repeatedly test
the project end to end.

Codex was also used adversarially rather than only as a code generator. Separate
review passes attacked the patch gate, API behavior, evidence consistency,
container cleanup, probe integrity, and frontend failure states. Those reviews
found and fixed a source-text gate bypass, hardcoded conflict evidence,
internally identical fixtures, spoofable probe output, malformed-body failures,
and model-response schema risk.

GPT-5.6 supplies the creative divergence at the center of the product: three
reasonable interpretations and three patch proposals. Codex supplied the
engineering loop that made those outputs inspectable, testable, reproducible,
and safe enough for the constrained fixture.

## Challenges we ran into

The hardest problem was avoiding fake evidence. Early versions could display a
curated conflict count even if branch behavior changed. We replaced that with a
shared diff helper that derives every `phase.field` conflict from observed
branch output.

Another challenge was separating observable behavior from implementation shape.
A valid GPT patch returned `rowCount`, `mimeType`, and `filterApplied` instead of
the fixture’s internal field names. The first contract test rejected it even
though the user-visible behavior was correct. We added a normalization layer and
tests covering genuinely different internal representations.

Finally, running generated code required honest boundaries. A regex denylist is
not a sandbox. We retained the policy gate for fast rejection, but moved trust to
a hardened, network-disabled, read-only, resource-limited container and added
negative tests for escape attempts and non-terminating code.

## Accomplishments we are proud of

- The project demonstrates a complete ticket-to-converged-spec workflow.
- Three branches can all pass their own contracts while producing 10 derived
  observable conflicts.
- The full GPT-5.6 → policy gate → Git worktree → hardened container path has
  completed successfully with 3/3 accepted patches and 3/3 passing contracts.
- The public demo requires no credentials and was verified end to end.
- The repository includes 16 automated tests plus sandbox-boundary and timeout
  cleanup verification.
- Security limitations and prototype boundaries are presented directly instead
  of being hidden behind an “AI safety” claim.

## What we learned

Better coding models increase the value of specification testing. When
implementation becomes fast, ambiguity becomes the bottleneck. We also learned
that evidence must be derived from execution, contract tests should bind to
observable behavior rather than internal object shape, and source filtering
must never be confused with process isolation.

## What is next

The next milestone is safe repository intake: lockfile and dependency policy,
secret scanning, artifact retention, and a remote disposable runner protocol.
Only after those controls exist should SpecFork accept arbitrary repositories.
Future integrations could connect requirements from GitHub, Linear, or Jira and
return a converged executable contract before implementation starts.

## Judging-criteria summary

### Technological implementation

GPT-5.6 Responses API, runtime response validation, real Git worktrees, derived
behavior conflicts, a shared patch gate, and hardened container execution with
negative security and timeout tests.

### Design

A complete, coherent sequence from ticket → forks → execution evidence → one
question → `SPEC GREEN`, with explicit provenance labels and a credential-free
judge path.

### Potential impact

SpecFork targets teams adopting coding agents, where an underspecified ticket
can multiply into several polished but incompatible implementations. It catches
that failure before code review or deployment.

### Quality of the idea

Instead of another coding agent or requirement-writing assistant, SpecFork uses
independent implementation disagreement as an ambiguity test and turns the
disagreement into one executable clarification.

## Final submission checklist

- [x] Working public project
- [x] Developer Tools category selected
- [x] Public MIT-licensed repository
- [x] README with setup and testing instructions
- [x] Credential-free judge experience
- [x] Codex and GPT-5.6 usage explained
- [ ] Public YouTube demo under three minutes
- [ ] Demo audio explicitly explains Codex and GPT-5.6
- [ ] `/feedback` Codex Session ID added
- [ ] Final Devpost form reviewed and submitted before the deadline

