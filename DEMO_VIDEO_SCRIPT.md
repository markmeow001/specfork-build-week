# SpecFork — 2:45 Demo Video Script

The video must be public on YouTube, shorter than three minutes, and include
spoken explanation of both Codex and GPT-5.6. Record at 1080p with browser zoom
set so the full product state remains readable.

## Before recording

- Open the public demo:
  https://specfork-build-week.holykinds.chatgpt.site
- Open a terminal showing only the completed Live Runner result. Never show
  `.env.local`, the API key, shell history, or the command that loads the key.
- Prepare the GitHub repository in a separate tab:
  https://github.com/markmeow001/specfork-build-week
- Turn off notifications and hide bookmarks or unrelated tabs.

## 0:00–0:12 — Hook

**Screen:** SpecFork landing page.

**Voiceover:**

“Tests can prove that code matches an interpretation. They cannot prove that
three agents chose the same interpretation. SpecFork tests the requirement
before agents build three different products.”

## 0:12–0:27 — The ticket

**Screen:** Show the default ticket: “Add an export button to the reports page.”
Click **Fork this spec**.

**Voiceover:**

“This ticket sounds clear, but it never defines what gets exported, which
format to use, whether filters apply, or what happens with large datasets.”

## 0:27–0:48 — Reasonable disagreement

**Screen:** Scroll through Agent A, B, and C. Pause on `CODE GREEN / SPEC RED`.

**Voiceover:**

“GPT-5.6 generates three reasonable, incompatible behavioral contracts: export
all accessible data, export the filtered workflow, or export exactly what is
visible. Every branch can be well implemented and fully tested, while the
product decision is still broken.”

## 0:48–1:08 — Behavior evidence

**Screen:** Click **Run behavior sandbox**. Show 4 rows, 2 rows, and 1 visible
row, plus CSV versus PDF and immediate versus background delivery.

**Voiceover:**

“SpecFork does not stop at language analysis. It runs the same observable probes
against each contract. All three pass their own tests, but their outputs prove
that they build different products.”

## 1:08–1:30 — Worktrees and hardened containers

**Screen:** Click **Inspect worktree run**. Show the three branches, patch hashes,
container limits, and “10 observable conflicts recorded.”

**Voiceover:**

“The local runner creates real Git worktrees and executes the constrained
fixture in disposable containers with networking disabled, read-only filesystems,
dropped capabilities, no new privileges, and explicit resource limits. The 10
conflicts are derived from actual branch outputs, not a hardcoded score.”

## 1:30–1:48 — GPT-5.6 patch gate

**Screen:** Click **Generate + review patches** and show 3/3 policy acceptance.
Briefly cut to the completed terminal output showing `source: gpt-5.6`, accepted
3, rejected 0, and passed contracts.

**Voiceover:**

“GPT-5.6 also produced three real patch proposals. The Agent Runner revalidated
them, committed them into separate worktrees, and completed all three container
contracts. The public site uses credential-free Demo Mode, while this terminal
result proves the live model path.”

## 1:48–2:10 — One decisive question

**Screen:** Return to the question and choose **The current filtered results**.

**Voiceover:**

“Instead of asking the user to rewrite the whole ticket, SpecFork asks one
question with the highest disambiguation value: what should the export
represent?”

## 2:10–2:27 — Convergence

**Screen:** Show `CODE GREEN / SPEC GREEN`, the executable spec, and zero
remaining conflicts.

**Voiceover:**

“One answer resolves scope, filters, format, pagination, and large-result
behavior. The output is an executable specification ready for a coding agent.”

## 2:27–2:45 — Codex and close

**Screen:** Briefly show the public GitHub README, then return to the resolved
spec.

**Voiceover:**

“Codex helped design, implement, adversarially review, test, and deploy the
entire project. GPT-5.6 creates the meaningful divergence; Codex turns that
divergence into reproducible engineering evidence. SpecFork: test your spec
before agents build it.”

## Recording acceptance check

- [x] Total duration is below 3:00
- [x] Video is public on YouTube: https://youtu.be/WYlo6rxChFs
- [x] Voiceover explicitly says “Codex” and “GPT-5.6”
- [x] Public demo URL is visible or included in the description
- [x] GitHub URL is included in the description
- [x] No API key, `.env.local`, request credential, or private terminal content
      appears in any frame
- [x] Demo, Live GPT, and recorded container evidence are not presented as the
      same execution mode
