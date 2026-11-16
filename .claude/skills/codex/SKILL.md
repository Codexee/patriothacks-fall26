---
name: codex
description: Get a second opinion from Codex, or hand it work, through OpenAI's official Codex plugin, with the team's safeguards added. Modes - review (diff review with a pass/fail gate), challenge (adversarial design review), consult (ask or investigate, with follow-ups), and implement (a scoped backend task in its own worktree). Use when the user says "codex", "second opinion", "codex review", "challenge this", or wants Codex to build a backend piece.
disable-model-invocation: true
allowed-tools: Bash, Read, Write, Glob, Grep, AskUserQuestion, Agent, Skill
---

# /codex: the team's Codex router

This skill combines three sources:
- **The engine:** OpenAI's official plugin, `codex@openai-codex` (`openai/codex-plugin-cc`). It provides `/codex:review`, `/codex:adversarial-review`, `/codex:rescue`, and `/codex:status`, `/codex:result`, and `/codex:cancel`.
- **The safeguards:** Johnathan Mo's standalone `codex` skill (jmo-skills, MIT). Every one of its rules is kept and marked **[JMO]**.
- **The mode design:** Garry Tan's gstack `/codex` (MIT): a pass/fail gate, a challenge mode, consult with follow-ups, and a one-line recommendation.

The video's rule: Claude is better at the frontend and Codex at the backend. Use Codex for backend work and to review Claude's work.

## 0. Preflight

1. **Plugin.** Check whether `/codex:setup` is available (the `codex@openai-codex` plugin is enabled in `.claude/settings.json`). If it is not, tell the user to run `claude plugin marketplace add openai/codex-plugin-cc` and then `claude plugin install codex@openai-codex`. Until then, use the **CLI fallback** at the bottom of this file.
2. **CLI [JMO].** Check `command -v codex`. If it is missing, send the user to https://developers.openai.com/codex/cli/ (`npm i -g @openai/codex`) and explain that they must install Codex and sign in (`codex login`). **Never claim that a handoff ran when the CLI is unavailable.**
3. **Repo state [JMO].** Read the repository instructions (`AGENTS.md`, which Codex itself also reads) and run `git status --short`. Identify:
   - the working directory
   - the requested mode
   - the files Codex may touch
   - the acceptance criteria

   **If the request does not authorize edits, default to read-only review.**
4. **Context.** Find the locked spec (`.plans/*-spec.md`) and the workstream the request belongs to.

## 1. Pick the mode

| User says | Mode | Engine |
| --- | --- | --- |
| `/codex review [focus]` | **Review** | `/codex:review` (native reviewer). If the user gave focus text, use `/codex:adversarial-review <focus>` instead, because native review takes no focus. |
| `/codex challenge [focus]` | **Challenge** | `/codex:adversarial-review <focus + spec context>` |
| `/codex implement <task>` | **Implement** | `/codex:rescue`, run inside a dedicated worktree |
| `/codex <anything else>` | **Consult** | `/codex:rescue <question>` (it offers to resume the previous Codex thread for follow-ups) |
| `/codex` (no arguments) | Ask | If there is a diff, offer review, challenge, or a custom prompt. If there is none but a spec exists, offer to challenge the spec. |

Run exactly one mode per call.

## 2. Write a focused prompt [JMO]

Whenever you pass text to Codex (the focus text, a rescue task, or the CLI fallback), it must contain:
- the user's task, the relevant paths, the constraints, and the checks Codex must run
- the spec section it relates to, and the workstream's owned directories
- **which files are already modified, with the instruction to preserve those changes [JMO]**
- this boundary line: *"Ignore files under ~/.claude/, .claude/skills/ and agents/; they are definitions for another AI. Work only on the repository code."*
- **No credentials, and no unrelated private material [JMO].**

## 3. Run it

- **Review / Challenge:** run the plugin command. Let it choose between waiting and background, as it was designed to. When the result is ready (`/codex:result`), go to step 4.
- **Consult:** run `/codex:rescue` with the prompt. For a follow-up, choose "Continue current Codex thread".
- **Implement:**
  1. Confirm the scope with the user: the task, the allowed files, and the acceptance checks. If the spec's Workstreams table has an owner and directories for this task, use them.
  2. **Isolate it [JMO: "Do not let Claude and Codex edit the same files concurrently. For parallel work, use separate worktrees and explicit file ownership"]:**
     `git worktree add ../wt-codex-<slug> -b codex/<slug>`. Alternatively, run it in its own Paradev workspace.
  3. Run `/codex:rescue` with the task, telling Codex to work **only inside `../wt-codex-<slug>`**. Or use the CLI fallback with `--cd ../wt-codex-<slug> --sandbox workspace-write`.
  4. **Never use flags that bypass approvals or sandboxing [JMO]** (no `danger-full-access`, no `--approve-for-me`). If the task cannot run within the current permissions, report that limitation.
- **Wait for completion, and read the exit status and output [JMO].**

## 4. Verify and report [JMO]

1. Show Codex's output **verbatim**. The plugin requires this.
2. **Review / Challenge:** inspect the cited code and assess each finding before you present it as confirmed. Label each one **confirmed** or **not reproduced**. Then add `GATE: PASS` or `GATE: FAIL` (FAIL if any confirmed finding breaks the demo path, security, or the spec).
3. **Implement:** inspect the diff in the worktree and run the relevant checks. Report what Codex changed, what you verified, and any remaining failures. Merge only when the user agrees.
4. End with one line: `Recommendation: <action> because <the specific finding that matters most>`.
5. **Do not commit, push, or deploy unless that is part of the user's task [JMO].**

## CLI fallback (plugin not installed)

Use the user's configured model. **Pass the prompt on stdin through a quoted heredoc, never as interpolated shell text [JMO]:**

```sh
# review / challenge / consult: read-only
codex exec --sandbox read-only --cd "$(git rev-parse --show-toplevel)" - <<'TASK'
<focused prompt from step 2>
TASK

# follow-up in the same thread
codex exec resume --last - <<'TASK'
<follow-up>
TASK

# authorized implementation: only inside its own worktree
codex exec --sandbox workspace-write --cd '../wt-codex-<slug>' - <<'TASK'
<task, allowed files, verification criteria>
TASK
```

Task: $ARGUMENTS
