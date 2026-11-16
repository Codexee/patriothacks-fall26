---
name: parallelize
description: Split a locked master spec into independent workstreams and run one sub-agent per workstream, each in its own git worktree, then integrate the results. Use after /interview produces a locked spec and the team is ready to build.
---

# /parallelize — one agent per independent task

Based on the video's Opticon workflow. Johnathan split his master plan into independent tasks and ran one sub-agent per task for 5–6 hours. After that, he spent 1 hour refining by hand with `/agentation`.

## 1. Read the spec

- Open the newest `.plans/*-spec.md`. If its `Status` is not `locked`, ask whether to continue anyway.
- Use the **Workstreams** table. If it is missing, write it now. Each row needs an owner, the directories it owns, its dependencies, and its "done when" check.

## 2. Make the tasks truly independent

- No two workstreams may own the same file or directory.
- Shared contracts (API schemas, types, environment variable names) go first, in one small **contracts** task. Commit it before the parallel work starts. Everything else then codes against it.
- If task B needs task A's output, B must wait for A. Do not run them in parallel.
- Assign backend-heavy tasks to Codex (`/codex implement`) and frontend tasks to Claude, following the video's split.

## 3. Launch

Each workstream runs in its own git worktree or Paradev (formerly Superset) workspace. Choose the first option that is available:

- **Paradev (preferred: this is the video's setup).** If the `superset:orchestrate` skill is available and `superset auth whoami` succeeds, call `superset:orchestrate` and hand it the Workstreams table as its coordinator table:
  - one Paradev workspace (branch) per workstream
  - a Claude Code agent for the frontend rows and a Codex agent for the backend rows
  - the dependencies, the "done when" checks, and the worker prompt below

  Follow its worker protocol to dispatch the agents, read their progress, and collect structured results.
- **One machine, without Paradev.** Start one sub-agent per workstream, using the Agent tool with `isolation: "worktree"` where that is available, or create a worktree with `git worktree add ../wt-<slug> -b ws/<slug>`. Give each sub-agent its row of the table, the spec path, the contracts, and its "done when" check.
- **Across teammates.** Each person opens their own workstream as a Paradev workspace or a worktree, and runs their AI on that row. Remote teammates take the workstreams that need no hardware. When a workstream changes hands, use `/handoff`.

Every sub-agent prompt must say:

1. Read `CLAUDE.md` and the spec first.
2. Touch only the directories you own.
3. Commit small, working steps to your branch.
4. Stop and report when your "done when" check passes, or if you are blocked.

## 4. Integrate

- Merge the branches into `main` one at a time. After each merge, run the app and the checks.
- Run `/codex review` on the combined diff.
- Update the **Status** section in `CLAUDE.md`: what works, what is broken, what comes next.
- Run the app in a real browser with `/agent-browser` or `/webapp-testing`. When something breaks, use `/systematic-debugging` before changing any code.
- Then polish by hand: use `/agentation` for visual feedback (or `/agentation-self-driving` to let the agent annotate the page itself), `/better-interface` for a full UI audit, and `/animate` for motion.
