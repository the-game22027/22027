#!/usr/bin/env bash
# Send one task to a non-Claude model through the Cursor CLI, read-only, and print its answer.
# Used by the external-worker subagent, only for tasks the user routes there; the reviewer checks the output.
#
#   scripts/ask-external.sh --model <model> --prompt "<task>"
#   scripts/ask-external.sh --model <model> --prompt-file task.txt
#   echo "<task>" | scripts/ask-external.sh --model <model>
#   scripts/ask-external.sh --list-models
#
# Exit codes: 0 ok, 2 bad usage, 3 Cursor not logged in, 4 cursor-agent missing, 124 timeout, other = cursor-agent's.
# Env: ASK_EXTERNAL_TIMEOUT (seconds, default 600).

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
model=""
prompt=""
list_models=false

usage() { sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//' >&2; exit 2; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --model) model="${2:-}"; shift 2 ;;
    --prompt) prompt="${2:-}"; shift 2 ;;
    --prompt-file) prompt="$(cat "${2:?--prompt-file needs a path}")"; shift 2 ;;
    --list-models) list_models=true; shift ;;
    -h|--help) usage ;;
    *) echo "unknown argument: $1" >&2; usage ;;
  esac
done

if ! command -v cursor-agent >/dev/null 2>&1; then
  echo "cursor-agent is not installed (https://cursor.com/cli)" >&2
  exit 4
fi
if cursor-agent status 2>&1 | grep -qi "not logged in"; then
  echo "Cursor CLI is not logged in: run 'cursor-agent login' once, then retry" >&2
  exit 3
fi

if $list_models; then
  exec cursor-agent --list-models
fi

[[ -n "$model" ]] || { echo "--model is required" >&2; usage; }
if [[ -z "$prompt" && ! -t 0 ]]; then
  prompt="$(cat)"
fi
[[ -n "$prompt" ]] || { echo "a prompt is required (--prompt, --prompt-file or stdin)" >&2; usage; }

# --mode ask is Cursor's read-only mode: the external model can read the repo but not edit files or run
# commands. Its answer comes back as text; Claude applies any change, and the reviewer checks it first.
exec timeout "${ASK_EXTERNAL_TIMEOUT:-600}" cursor-agent \
  --print \
  --output-format text \
  --mode ask \
  --trust \
  --workspace "$repo_root" \
  --model "$model" \
  "$prompt"
