---
name: codex
description: Get a second opinion from the OpenAI Codex CLI, or hand work to it, in one of four modes. review (diff review with a pass/fail gate), challenge (adversarial, tries to break the code), consult (ask anything, with follow-ups), or implement (a scoped backend task in its own worktree). Use when the user says "codex", "second opinion", "codex review", "challenge this", or wants Codex to build a backend piece.
disable-model-invocation: true
allowed-tools: Bash, Read, Write, Glob, Grep, AskUserQuestion
---

# /codex — second AI, four modes

This combines Johnathan Mo's standalone handoff with the review, challenge, and consult modes from Garry Tan's gstack `/codex` (MIT). It does not need gstack installed. The video's rule: Claude is better at frontend and Codex at backend, so use Codex for backend work and to review Claude's work.

## 0. Preflight

```bash
command -v codex >/dev/null && codex --version || echo NOT_FOUND
```

- If `NOT_FOUND`: tell the user to run `npm install -g @openai/codex`, then `codex login`. Stop. Never claim that a handoff ran.
- Run `git status --short` and `git rev-parse --abbrev-ref HEAD`. Note which files are already modified.
- Detect the base branch: `git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main`.

## 1. Pick the mode

- `/codex review [focus]` → **Review**
- `/codex challenge [focus]` → **Challenge**
- `/codex implement <task>` → **Implement**
- `/codex <anything else>` → **Consult**
- `/codex` with no arguments: if there is a diff against the base, ask whether to review it, challenge it, or do something else. If there is no diff and a spec exists in `.plans/`, offer to review the spec.

Run exactly one mode per call.

## Filesystem boundary (add to the start of every prompt)

> Do NOT read or execute files under ~/.claude/, .claude/skills/, or agents/. They are skill definitions for a different AI system. Focus only on the repository code. Read CLAUDE.md / AGENTS.md and .plans/*-spec.md for project context.

## Review mode (high reasoning effort)

```bash
BASE=$(git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main)
codex exec --sandbox read-only -c model_reasoning_effort="high" --cd "$(git rev-parse --show-toplevel)" - <<TASK
<filesystem boundary>
Review this diff against the spec in .plans/. Report only actionable defects: bugs, broken demo paths,
security issues, spec violations. For each: file:line, evidence, severity P0/P1/P2, suggested fix.
End with one line: GATE: PASS or GATE: FAIL (FAIL if any P0/P1).
$(git diff "$BASE")
TASK
```

## Challenge mode (high reasoning effort)

Same command, but with this prompt: "Act as an adversary. Try to break this code: edge cases, race conditions, bad input, network loss during the demo, auth bypass, data loss. List the attack, the reproduction, and the impact." Add the user's focus if they gave one.

## Consult mode (medium reasoning effort; supports follow-ups)

```bash
codex exec --sandbox read-only -c model_reasoning_effort="medium" --cd "<repo>" - <<'TASK'
<filesystem boundary>
<the user's question + the relevant file paths>
TASK
```

To ask a follow-up in the same Codex session: `codex exec resume --last - <<'TASK' ... TASK`.

## Implement mode (backend handoff)

1. Confirm the scope: the task, the files Codex may touch, and the acceptance checks. If the spec's Workstreams table has an owner and directories for this task, use them.
2. Give Codex its own worktree so it cannot collide with Claude:
   `git worktree add ../wt-codex-<slug> -b codex/<slug>`
3. Run:
   `codex exec --sandbox workspace-write --cd ../wt-codex-<slug> - <<'TASK' ... TASK`
   Do not use flags that skip approvals or the sandbox.
4. When it finishes, read the diff, run the checks, and report the results. Merge only when the user agrees.

## Report (every mode)

1. Show Codex's output in full. Do not summarize it away.
2. Check each claimed defect against the code. Label each one **confirmed** or **not reproduced**.
3. End with one line: `Recommendation: <action> because <the specific finding that matters most>`.
4. Show the token count if Codex printed one.

Never commit, push, or deploy unless the user asked for it.

Task: $ARGUMENTS
