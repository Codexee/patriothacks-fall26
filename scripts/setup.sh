#!/usr/bin/env bash
# Teammate setup: installs the same toolchain the video uses.
# Safe to re-run. macOS gets the desktop apps through Homebrew. Linux and Windows (WSL) get the CLI tools only.
set -u

say()  { printf "\n\033[1;35m==> %s\033[0m\n" "$*"; }
ok()   { printf "  \033[32m✔\033[0m %s\n" "$*"; }
warn() { printf "  \033[33m!\033[0m %s\n" "$*"; }

say "Claude Code"
if command -v claude >/dev/null; then ok "claude $(claude --version 2>/dev/null)"; else
  warn "Claude Code not found. Install it: https://code.claude.com/docs/en/setup, then sign in by running: claude"; fi

say "Codex CLI (backend handoffs and reviews, used by /codex)"
if command -v codex >/dev/null; then ok "$(codex --version)"; else
  if command -v npm >/dev/null; then npm install -g @openai/codex && ok "installed. Now run: codex login";
  else warn "npm not found. Install Node.js 20+ first, then: npm install -g @openai/codex"; fi; fi

say "JMO plugin (the original workflow skills. This repo ships upgraded copies and disables the plugin inside the repo)"
if command -v claude >/dev/null; then
  claude plugin marketplace add 23jmo/jmo-skills >/dev/null 2>&1 || true
  claude plugin install jmo-workflow@jmo-skills >/dev/null 2>&1 && ok "jmo-workflow installed (user scope)" || warn "plugin install failed. Run it by hand: claude plugin install jmo-workflow@jmo-skills"
fi

if [[ "$(uname)" == "Darwin" ]] && command -v brew >/dev/null; then
  say "Desktop apps (Homebrew casks)"
  for cask in superset; do
    if brew list --cask "$cask" >/dev/null 2>&1; then ok "$cask already installed"; else brew install --cask "$cask" && ok "$cask installed"; fi
  done
else
  say "Desktop apps"
  warn "Not on macOS with Homebrew. Install by hand:"
  warn "  Paradev, formerly Superset (parallel agents and worktrees, macOS): https://superset.sh. Alternative: plain 'git worktree' or Cursor"
fi

say "Optional MCP plugins (install only if the locked spec needs them)"
echo "  claude plugin install jmo-supabase@jmo-skills   # database"
echo "  claude plugin install jmo-neon@jmo-skills       # Postgres"
echo "  claude plugin install jmo-stripe@jmo-skills     # payments (use test mode)"
echo "  Agentation live feedback: claude mcp add agentation -- npx -y agentation-mcp server"

say "Inspiration board"
echo "  Cosmos (a Pinterest-like board for web references): https://www.cosmos.so"

say "Done. Restart Claude Code, open this repo, and paste ONBOARDING_PROMPT.md into your AI."
