#!/usr/bin/env bash
# SessionStart hook: tell the agent (and so the user) when this copy of the repo is behind GitHub,
# and show the newest CHANGELOG entry so everyone knows what changed. It never blocks the session.
cd "${CLAUDE_PROJECT_DIR:-$(pwd)}" 2>/dev/null || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

# Fetch quietly, with a time limit so that a slow network never stalls startup.
GIT_TERMINAL_PROMPT=0 git -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=5 fetch --quiet origin >/dev/null 2>&1 || true

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
upstream=$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null) || upstream=""
behind=0
[ -n "$upstream" ] && behind=$(git rev-list --count "HEAD..$upstream" 2>/dev/null || echo 0)

if [ "${behind:-0}" -gt 0 ]; then
  echo "REPO SYNC: this copy ($branch) is $behind commit(s) behind $upstream. Tell the user at the start of your first reply, and offer to run \`git pull\` (ask before pulling if they have uncommitted changes). Changes since their copy:"
  git log --oneline "HEAD..$upstream" 2>/dev/null | head -10 | sed 's/^/  /'
else
  echo "REPO SYNC: up to date with ${upstream:-the local branch}."
fi

if [ -f CHANGELOG.md ]; then
  echo "Latest team changelog entry (CHANGELOG.md):"
  awk '/^## /{n++} n==1' CHANGELOG.md | head -25
fi
exit 0
