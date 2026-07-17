# SpecFork MVP decisions

## 1. Competition objective

SpecFork is an OpenAI Build Week Developer Tools submission. The judging story is:

> Tests prove the code matches an interpretation. SpecFork proves the team chose the same interpretation.

## 2. MVP

The MVP includes:

- product-ticket input;
- three independent behavioral interpretations;
- visible comparison of conflicting behavior;
- a controlled executable behavior fixture;
- real Git worktrees over a bundled trusted repository fixture;
- hardened disposable containers with explicit resource and privilege limits;
- a server-side allowlist and forbidden-capability gate for model patch proposals;
- a local Agent Runner that can execute accepted GPT patches only inside the hardened containers;
- a `CODE GREEN / SPEC RED` verdict;
- one disambiguating multiple-choice question;
- a converged executable specification;
- deterministic demo mode;
- optional GPT-5.6 Responses API analysis.

## 3. Explicitly deferred

- cloning arbitrary repositories;
- running generated code;
- remote Codex agents;
- GitHub, Linear, or Jira integrations;
- accounts, billing, and persistent projects;
- automatic pull requests.

## 4. Why demo mode exists

Hackathon judges may not rebuild the project and API credentials can fail. Demo mode guarantees that the complete product mechanism remains testable without misrepresenting it as a live model call.

## 5. Next technical milestone

Design safe repository intake, dependency policy, secret scanning, artifact
retention, and a remote runner protocol before accepting a user-selected
repository. The bundled fixture remains the only executable repository.
