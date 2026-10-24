#!/usr/bin/env bash
# Run one CLI baseline in a prepared folder (paper.pdf + TASK.md) and keep its token record.
# Usage: cli_run.sh codex|claude <dir>
# codex: gpt-6.1-sol, reasoning high (as the GAID run), JSON events with per-turn usage in events.jsonl.
# claude: Claude Opus 5.5, no MCP servers, result JSON with usage and total_cost_usd in result.json.
# Both keep the user's global instructions (~/.codex/AGENTS.md, ~/.claude/CLAUDE.md): that is the CLI as normally used.
set -euo pipefail
cli=$1 dir=$2
prompt='Read TASK.md in this folder and do what it asks: read and understand paper.pdf, then write the Workflow draft JSON to draft.json. Work only in this folder and finish without asking questions.'
cd "$dir"
start=$(date +%s)
case $cli in
  codex)
    codex exec --json --skip-git-repo-check -C "$dir" -s workspace-write -m gpt-6.1-sol -c model_reasoning_effort=high "$prompt" >events.jsonl 2>stderr.log
    ;;
  claude)
    claude -p "$prompt" --output-format json --model claude-opus-5-5 --strict-mcp-config --mcp-config '{"mcpServers":{}}' \
      --permission-mode bypassPermissions >result.json 2>stderr.log
    ;;
esac
echo "{\"seconds\": $(($(date +%s) - start))}" >timing.json
