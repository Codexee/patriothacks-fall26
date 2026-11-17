#!/usr/bin/env python3
"""UserPromptSubmit hook: remind Claude to offer a project skill the user did not call.

Reads the hook JSON on stdin and matches the prompt against .claude/skill-triggers.json.
For each matching skill that has not been suggested yet in this session, it adds context
that tells Claude to ask the user, in one line, whether to use that skill.
It never blocks the prompt, and any failure exits silently.
"""
import json
import os
import re
import sys
import tempfile


def main() -> None:
    try:
        event = json.load(sys.stdin)
    except Exception:
        return
    prompt = (event.get("prompt") or "").strip()
    if not prompt:
        return

    root = os.environ.get("CLAUDE_PROJECT_DIR") or event.get("cwd") or os.getcwd()
    try:
        with open(os.path.join(root, ".claude", "skill-triggers.json")) as f:
            triggers = json.load(f)["triggers"]
    except Exception:
        return

    lowered = prompt.lower()
    # The user already chose a skill, or is answering a question or reminder: stay quiet.
    if lowered.startswith("/") or re.search(r"(^|\s)/[a-z][a-z0-9:-]+", lowered):
        return
    if len(lowered) < 12:
        return

    session = re.sub(r"[^A-Za-z0-9_-]", "", str(event.get("session_id") or "default"))[:64]
    state_path = os.path.join(tempfile.gettempdir(), f"patriothacks-skill-nudge-{session}.json")
    try:
        with open(state_path) as f:
            already = set(json.load(f))
    except Exception:
        already = set()

    tooling_note = ""
    if "__tooling__" not in already:
        already.add("__tooling__")
        tooling_note = (
            "Team tooling reminder (PatriotHacks repo, from docs/tooling.md; once per session): "
            "use the JMO workflow tools where they fit, and say which one you are using. "
            "Parallel builds: /parallelize, then Paradev superset:orchestrate (one workspace and worktree per workstream). "
            "Native apps, the Claude for Chrome side panel, or a real browser window: Paradev superset:computer. "
            "Paradev's in-app browser: superset:browser. Backend code and reviews: /codex. "
            "Browser QA: /agent-browser (explore) or /webapp-testing (repeatable). UI feedback: /agentation. "
            "Demo video: /hyperframes. If a tool is not installed or not signed in, tell the user the one command to fix it. "
            "Also suggest any project skill from docs/skills.md that fits the prompt, even if the reminder below names none.\n\n"
        )

    hits = []
    for t in triggers:
        name = t.get("skill")
        if not name or name in already:
            continue
        for pat in t.get("patterns", []):
            try:
                if re.search(pat, lowered):
                    hits.append(t)
                    break
            except re.error:
                continue
        if len(hits) == 2:  # never suggest more than two skills at once
            break

    if not hits and not tooling_note:
        return

    already.update(t["skill"] for t in hits)
    try:
        with open(state_path, "w") as f:
            json.dump(sorted(already), f)
    except Exception:
        pass

    lines = [f"- /{t['skill']}: {t.get('why', '')}" for t in hits]
    if not hits:
        print(json.dumps({"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": tooling_note.strip()}}))
        return
    context = tooling_note + (
        "Skill reminder (PatriotHacks repo): this prompt looks like a job for a project skill "
        "the user did not call:\n" + "\n".join(lines) + "\n"
        "Before doing the work, ask the user in ONE short line whether they want to use it "
        "(e.g. \"Want me to use /" + hits[0]["skill"] + " for this?\"). If the skill clearly does "
        "not fit, or the user already declined, skip the question and proceed. Do not run the "
        "skill without their yes. Ask once; do not repeat it later in the session."
    )
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "UserPromptSubmit",
            "additionalContext": context,
        }
    }))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
    sys.exit(0)
