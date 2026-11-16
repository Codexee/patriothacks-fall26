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

Each workstream runs in its own git worktree, created with `git worktree add ../wt-<slug> -b ws/<slug>`, or as a Superset workspace. Run them in one of these ways:

- **One machine:** start one sub-agent per workstream (use the Agent tool with `isolation: "worktree"` where available). Give each sub-agent its row of the table, the spec path, the contracts, and its "done when" check.
- **Across teammates:** each person opens their own workstream as a Superset workspace (or a worktree) and runs their AI on that row. Remote teammates take workstreams that need no hardware.

Every sub-agent prompt must say:

1. Read `CLAUDE.md` and the spec first.
2. Touch only the directories you own.
3. Commit small, working steps to your branch.
4. Stop and report when your "done when" check passes, or if you are blocked.

## 4. Integrate

- Merge the branches into `main` one at a time. After each merge, run the app and the checks.
- Run `/codex review` on the combined diff.
- Update the **Status** section in `CLAUDE.md`: what works, what is broken, what comes next.
- Then polish by hand: use `/agentation` for visual feedback, `/better-interface` for a full UI audit, and `/animate` for motion.
