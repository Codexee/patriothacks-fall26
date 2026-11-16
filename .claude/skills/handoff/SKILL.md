---
name: handoff
description: Compact the current conversation into a handoff document for another agent to pick up.
argument-hint: "What will the next session be used for?"
disable-model-invocation: true
---

Write a handoff document summarising the current conversation so a fresh agent can continue the work. Save to the temporary directory of the user's OS (`$TMPDIR`, else `/tmp`; `%TEMP%` on Windows) - not the current workspace.

**Team override (PatriotHacks repo):** when the next session belongs to a *teammate* (taking over a workstream, or picking up overnight work), save instead to `docs/handoffs/YYYY-MM-DD-<workstream>.md`, then commit and push it so their AI can read it after `git pull`. Name the workstream's branch or worktree, the spec section it implements, what works, what is broken, and the exact next step.

Include a "suggested skills" section in the document, naming which skills the next agent should call the Skill tool for.

Do not duplicate content already captured in other artifacts (specs, plans, ADRs, issues, commits, diffs). Reference them by path or URL instead.

Redact any sensitive information, such as API keys, passwords, or personally identifiable information.

If the user passed arguments, treat them as a description of what the next session will focus on and tailor the doc accordingly.
