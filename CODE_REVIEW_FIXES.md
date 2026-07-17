# SpecFork — Code Review & Fixes Handoff

**Date:** 2026-07-17 (America/Vancouver)
**Purpose:** Handoff for Codex. Summarizes an adversarial code review of the whole
repo and every fix applied in response. Everything below is implemented, tested, and
committed unless explicitly marked **DEFERRED** or **REMAINING**. See §6 for the
commit list.

---

## 1. Method

The full source tree (~2,670 LOC, excluding `node_modules`/`dist`) was reviewed by
three parallel adversarial reviewers, each with a different lens:

1. **Security / sandbox core** — `scripts/patch-policy.mjs`, `run-agent-patches.mjs`,
   `run-worktree-demo.mjs`, `verify-container-sandbox.mjs`, `verify-runner-timeout.mjs`,
   `normalize-export.mjs`. Goal: break the patch gate and the container sandbox.
2. **API / backend** — `app/api/*/route.ts`, `app/chatgpt-auth.ts`,
   `app/worktree-demo-report.ts`, `worker/index.ts`, `db/*`, config files.
3. **Frontend / fixtures / tests** — `app/SpecForkApp.tsx`, `app/page.tsx`,
   `app/layout.tsx`, `tests/*`, `fixtures/worktree-demo/*`.

### Verified-good (no action needed)
- **No XSS.** All model output is rendered as escaped JSX text; no `dangerouslySetInnerHTML`.
- **No secret leak.** `OPENAI_API_KEY` is server-only, never `NEXT_PUBLIC_`, never in
  responses/logs. `.env.local` is git-ignored and untracked; no `sk-` in tracked source.
- **Container hardening is genuinely strong** and actively tested: `--network none`,
  `--read-only`, `--cap-drop ALL`, `--security-opt no-new-privileges`, non-root
  `1000:1000`, tmpfs `/tmp` `noexec,nosuid`, `--pids-limit 64`, `--memory 96m`,
  `--cpus 0.5`, digest-pinned image. This is the real trust boundary.
- **Immutability** in `SpecForkApp.tsx` is clean (all spreads, no mutation).
- **No remote code-execution surface:** the worktree/container runner is invoked only
  via npm scripts, never imported by any HTTP route.

---

## 2. Findings & fixes (all committed)

Severity uses the reviewers' scale. Status is the current state.

| ID | Sev | Area | Status |
|----|-----|------|--------|
| C1 | CRITICAL | Patch gate bypass | ✅ Fixed |
| H1 | HIGH | Fake "conflict" count | ✅ Fixed |
| H3 | HIGH | Frontend silent failure | ✅ Fixed |
| H5 | HIGH | 500 on malformed body | ✅ Fixed |
| M1 | MEDIUM | Contradictory evidence panels | ✅ Fixed |
| M2 | MEDIUM | Container cleanup on signal | ✅ Fixed |
| M3 | MEDIUM | Probe result spoofing | ✅ Fixed |
| M4 | MEDIUM | Fixtures not truly divergent | ✅ Fixed |
| H2 | HIGH | Unauth OpenAI cost DoS | ⏸️ DEFERRED (see §4) |
| H4 | HIGH | No schema validation on live GPT | ✅ Fixed |

---

### C1 — Patch gate was a bypassable source-text denylist
**Was:** `scripts/patch-policy.mjs` blocked `eval`/`Function`/`process`/`require`/
`constructor` with regexes on raw source. Empirically bypassed by unicode escapes
(`eval` → `eval`, executes; `["constructor"]`) and bare aliasing
(`const p = process`, `const m = require`). A second, **duplicate** `reviewPatch`
existed in `app/api/patches/route.ts`.

**Fix:**
- Added an `obfuscated-source` violation rejecting any `\u`/`\x` escape sequence
  (a data-export patch has no legitimate need for them).
- Tightened the denylist to bare identifiers (`/\bprocess\b/`, `/\brequire\b/`,
  `/\b(?:eval|Function)\b/`) and added `Reflect`/`Proxy`/`WebAssembly` +
  more `node:` modules.
- **DRY:** deleted the duplicate in `patches/route.ts`; it now imports the single
  gate from `scripts/patch-policy.mjs` (so the fix covers both paths and they
  cannot drift).
- **Honesty:** added a code comment + `PROJECT_STATUS.md §6` note stating the gate
  is a **pre-filter for accidents, NOT a security boundary** — the hardened
  container is the sole trust boundary. Untrusted patches only ever run in the
  container (the runner refuses proposals without `--container`).

**Files:** `scripts/patch-policy.mjs`, `app/api/patches/route.ts`, `PROJECT_STATUS.md`
**Tests:** `tests/rendered-html.test.mjs` — new "rejects a patch that hides eval
behind a unicode escape".

---

### H1 — "N observable conflicts" was a hardcoded constant
**Was:** `run-worktree-demo.mjs` computed the three branches' real `normal`/`large`
results but then emitted a **hand-authored** 6-item conflicts array; the served
snapshot `app/worktree-demo-report.ts` hardcoded the same array; the test only
asserted `length === 6`. Editing a branch to agree would not change the number →
the product's core claim was verified nowhere. The curated "6" was also an
arbitrary subset (it omitted `large.scope/format/filter/includesCharts`, which
also diverge).

**Fix:**
- New pure helper `scripts/derive-conflicts.mjs`: diffs every `phase.field` across
  branches, returns those where the three are not unanimous.
- `run-worktree-demo.mjs` and `worktree-demo-report.ts` both derive `conflicts`
  from their own branch data (shared helper → cannot drift).
- Honest derived count is **10** (5 fields × {normal, large}), not 6.
  `PROJECT_STATUS.md` §4 and §11 updated 6 → 10.
- The UI already renders `conflicts.length` dynamically, so it updates automatically.

**Files:** `scripts/derive-conflicts.mjs` (new), `scripts/run-worktree-demo.mjs`,
`app/worktree-demo-report.ts`, `PROJECT_STATUS.md`
**Tests:** `tests/rendered-html.test.mjs` now asserts
`payload.conflicts === deriveConflicts(payload.branches)` and `length === 10`.

---

### M1 — Two evidence panels showed contradictory numbers
**Was:** `app/api/execute/route.ts` hardcoded observations `2,400 / 40 / 2` rows,
while the real fixture (`fixtures/.../report-data.mjs`) and the container-evidence
panel show `4 / 2 / 1`. Same three agents, two different sets of numbers on one screen.

**Fix:** aligned `/api/execute` observations and the scope scenario string with the
real fixture (`4 / 2 / 1`, "1 visible · 2 filtered · 4 accessible"), with a comment
to keep it in sync with `worktree-demo-report.ts`.

**Files:** `app/api/execute/route.ts`
**Tests:** `tests/rendered-html.test.mjs` row-count assertions updated to `4/2/1`.

---

### H5 — `request.json()` threw an unhandled 500 on malformed body
**Was:** all three routes parsed the body outside any try/catch → a non-JSON body
produced an uncaught `SyntaxError` (framework 500, potential stack leak in dev).

**Fix:** each route wraps `request.json()` and returns a clean `400 {error:"Invalid JSON body."}`.

**Files:** `app/api/analyze/route.ts`, `app/api/execute/route.ts`, `app/api/patches/route.ts`
**Tests:** `tests/rendered-html.test.mjs` — new "returns 400 for a malformed JSON body".

---

### H3 — Frontend async handlers failed silently
**Was:** `generatePatchPlan` / `loadWorktreeProof` / `runBehaviorSandbox` had only
`try/finally` (no catch, no error state). A network/non-200 failure just stopped the
spinner and produced an unhandled rejection — nothing shown to the user.

**Fix:**
- Added an `error` state + dismissible error banner (`role="alert"`) in the workspace,
  styled in `globals.css` with existing design tokens.
- Each handler now `catch`es and sets a user-facing message; error cleared on each
  new action and on `reset()`.
- `analyzeTicket` now checks `response.ok` (was missing) so a 4xx JSON error body
  can't be treated as an analysis (would crash `.forks.map`); it still degrades to
  the deterministic demo on failure by design.

**Files:** `app/SpecForkApp.tsx`, `app/globals.css`
**Note:** the banner is client-only; SSR tests can't trigger a client fetch failure,
so it has no automated test (no Playwright in the project).

---

### M4 — The three "independent implementations" were identical templates
**Was:** `implementations/a|b|c.mjs` all returned the same internal shape
`{scope, format, filter, delivery, includesCharts}` with different constants, so the
`normalize-export.mjs` decoupling layer (the thing that answers "contract tests don't
over-bind to internal data shape") was never exercised or tested.

**Fix (make them genuinely divergent internally, identical after normalization):**
- **Agent A** → `rowCount` / `mimeType` / `filterApplied` / `download`.
- **Agent C** → `rows[]` / `filename` / `viewport` / `previewUrl` / `charts[]`.
- **Agent B** → kept the explicit shape on purpose (so the primary branch stays covered).
- All three normalize to the same observable contracts the tests assert; verified
  end-to-end (runner still reports 10 conflicts, all contracts pass).
- New `tests/normalize-export.test.mjs` (7 tests): exercises **every** inference
  branch of `normalize-export.mjs` + a source-level regression guard that fails if
  anyone reverts the implementations to identical shapes. Wired into `npm test`.

**Files:** `fixtures/worktree-demo/implementations/a.mjs`, `b.mjs`, `c.mjs`,
`tests/normalize-export.test.mjs` (new), `package.json` (test script).

---

### M2 — Container cleanup didn't survive signal termination
**Was:** the parent `run-agent-patches.mjs` runs the runner with
`execFileSync(..., {timeout: 60000})`. On timeout Node sends **SIGTERM**, and Node
does **not** run `try/finally` on signal death → orphaned container + leaked temp
repo. Separately, `docker rm -f` failures were swallowed by `catch {}`.

**Fix (`scripts/run-worktree-demo.mjs`):**
- Track created container names in `activeContainers`; install
  `SIGTERM`/`SIGINT`/`SIGHUP` handlers that force-remove them and `rmSync(tempRoot)`
  before exiting.
- `docker rm -f` now distinguishes the benign `No such container` (from a successful
  `--rm`) from real failures, which are `WARN`ed to stderr and kept tracked for the
  exit-time retry instead of silently swallowed.

---

### M3 — Reported probe results could be spoofed via stdout
**Was:** `parseProbe` scraped the last `{...}` line of the probe's stdout. Gated
patch code can call `console.log` / `setTimeout` (not blocked by the gate) and print
a deferred fake JSON line that wins `findLast`, corrupting the reported observation
(and thus the derived conflicts). The `deepEqual` contract tests were not affected
(they use the real return value), only the reported evidence numbers.

**Fix:**
- The runner generates a per-run random `probeToken` and passes it via
  `--probe-token=<hex>`.
- `acceptance-probe.mjs` prints `${token} ${json}`; `parseProbe` only trusts the last
  line with the token prefix.
- Gated patch code cannot read the token (the gate blocks `process`/`process.argv`),
  so it cannot forge a matching line. Verified: a deferred attacker line printed
  after the genuine one is ignored.

**Files:** `scripts/run-worktree-demo.mjs`, `fixtures/worktree-demo/base/acceptance-probe.mjs`

---

### H4 — Live GPT response was trusted without schema validation
**Was:** `/api/analyze` spread `JSON.parse(...)` directly into the response. A
syntactically valid but wrong-shaped model payload could reach the client and crash
rendering when required arrays or nested fields were missing.

**Fix:**
- Added a dependency-free runtime validator for every field the UI consumes,
  including exactly three ordered forks, four behaviors per fork, 2–5 disagreement
  labels, and three uniquely identified question options.
- Invalid live output now falls back to the complete deterministic demo response.
- Added regression coverage for valid output and several malformed shapes.

**Files:** `app/analysis-schema.mjs` (new), `app/api/analyze/route.ts`,
`tests/rendered-html.test.mjs`

### Follow-up — Quiet benign Docker cleanup races
The successful `docker run --rm` path removes its own container before the runner's
defensive `docker rm -f`. Cleanup now captures stderr, so the expected “No such
container” race remains handled without printing misleading daemon errors.

**File:** `scripts/run-worktree-demo.mjs`

---

## 3. Verification

Required checks are green as of this handoff:

```bash
npm test        # 16 passing: worktree runner (real git) + build + rendered-html + normalize-export
npm run lint    # clean
npx tsc --noEmit # only 3 PRE-EXISTING Cloudflare ambient-type errors
                 # (cloudflare:workers / Fetcher / D1Database) — unrelated to these changes
```

Docker-dependent checks were also run locally (Docker 29.4.1) and independently
re-verified for this handoff: `npm run test:sandbox` and `npm run verify:runner-timeout`
both passed. The former verified all three hardened worktree containers (contracts
pass, 10 derived conflicts, boundaries enforced); the latter verified that
non-terminating code is stopped and its container removed. Zero `specfork-` containers
were left behind, and the sandbox run no longer prints benign container-removal errors.

---

## 4. Deferred (not bugs in the current shipping shape)

The remaining deferral assumes the deployed/public build ships **without** an
`OPENAI_API_KEY` (demo mode only), which is the stated plan. It returns the moment a
live key is set in the deployed environment.

- **H2 — Unauthenticated, unthrottled OpenAI spend.** `/api/analyze` and
  `/api/patches` call GPT-5.6 with no auth/rate-limit. `app/chatgpt-auth.ts`
  (`requireChatGPTUser`) exists but is not applied. Keyless deploy → always demo → no
  spend. **If a live key is ever deployed:** gate both routes with auth + a rate
  limiter (KV/D1 token bucket or a Cloudflare rate-limit binding) before the upstream
  `fetch`. Also note `chatgpt-auth.ts` trusts inbound `oai-authenticated-user-email`
  headers — only safe if the platform edge strips client copies.

---

## 5. REMAINING — LOW priority (cosmetic / cleanup, no correctness impact)

Not started. Safe to pick up in any order.

- Text values used as React keys (`li key={item}` in `SpecForkApp.tsx` ~437/695/730)
  → collide on duplicate strings; use index-qualified/id keys.
- Inconsistent "agreement" metric: `/api/execute` returns `25`, the diagnosis ring
  computes `31`, the resolved card hardcodes `96%`.
- `window.setTimeout(...)` in `resolveSpec` isn't cleared on unmount; `280` is a magic number.
- Cmd/Ctrl+Enter has no in-flight guard and no `AbortController`, so rapid submits can
  race and a slow earlier response can overwrite a newer one.
- `SpecForkApp.tsx` is 792 lines / >4 nesting levels — decompose into `Hero`,
  `ForkGrid`, `ExecutionPanel`, `WorktreeProof`, `PatchGate`, etc. + a `useSpecFork` hook.
- `next.config.ts` sets no security headers (CSP etc.).
- M5: three inconsistent "is this the export demo" heuristics (`includes("export button")`
  in the client vs `includes("export") && includes("report")` in the routes) — carry a
  single `source`/`isExportDemo` flag from the analysis response instead of re-sniffing
  the ticket string.
- `ExecutionReport.conflicts` and several typed `limits`/`policy`/`runs[].status` fields
  are fetched/returned but never rendered (dead data).

---

## 6. Git state

Branch `main`, three code commits (repo had no prior history — this is the first
commit series); this handoff is committed on top as a fourth docs commit:

```
39ad4f5  feat: validate live GPT analysis before it reaches the client (H4)
1a76273  fix: harden fixture divergence and container runner integrity   (M4 + M2 + M3)
ae35e31  feat: initial SpecFork commit with review hardening             (C1 + H1 + M1 + H3 + H5 + whole project)
```

- No remote configured yet (GitHub repo not created — PROJECT_STATUS P1). Nothing has
  been pushed.
- `.gitignore` covers `node_modules`, `dist`, `.env*`, `.wrangler`, and (added this
  session) `tsconfig.tsbuildinfo`. `.env.local` is untracked.
- Attribution intentionally omitted from commit messages (per global settings).
