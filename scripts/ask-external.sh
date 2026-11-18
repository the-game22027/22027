#!/usr/bin/env bash
# Send one task to a non-Claude model through the Cursor CLI, read-only, and print its answer.
# Used by the external-worker subagent, only for tasks the user routes there; the reviewer checks the output.
#
#   scripts/ask-external.sh --model <model> --prompt "<task>"
#   scripts/ask-external.sh --model <model> --prompt-file task.txt
#   scripts/ask-external.sh --model <model> <<'TASK' ... TASK
#   scripts/ask-external.sh --list-models
#
# Exit codes: 0 ok, 2 bad usage, 3 Cursor not logged in, 4 cursor-agent missing, 124 timeout, other = cursor-agent's.
# Env: ASK_EXTERNAL_TIMEOUT (seconds, default 600).

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
model=""
prompt=""
list_models=false

usage() {
  [[ $# -gt 0 ]] && echo "$1" >&2
  sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//' >&2
  exit 2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --model)
      [[ $# -ge 2 ]] || usage "--model needs a value"
      model="$2"; shift 2 ;;
    --prompt)
      [[ $# -ge 2 ]] || usage "--prompt needs a value"
      prompt="$2"; shift 2 ;;
    --prompt-file)
      [[ $# -ge 2 && -r "$2" ]] || usage "--prompt-file needs a readable file"
      prompt="$(cat -- "$2")"; shift 2 ;;
    --list-models) list_models=true; shift ;;
    -h|--help) usage ;;
    *) usage "unknown argument: $1" ;;
  esac
done

if ! $list_models; then
  [[ -n "$model" ]] || usage "--model is required"
  if [[ -z "$prompt" && ! -t 0 ]]; then
    prompt="$(cat)"
  fi
  [[ -n "$prompt" ]] || usage "a prompt is required (--prompt, --prompt-file or stdin)"
fi

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

# Read-only twice over: --mode ask is Cursor's no-edit mode, and the sandbox blocks writes if a tool slips through.
# Never add --force/--yolo here. Claude applies any suggested change, after the reviewer has checked it.
# `--` ends the options, so a task that starts with "-" (a Markdown bullet) is still read as the prompt.
exec timeout "${ASK_EXTERNAL_TIMEOUT:-600}" cursor-agent \
  --print \
  --output-format text \
  --mode ask \
  --sandbox enabled \
  --trust \
  --workspace "$repo_root" \
  --model "$model" \
  -- "$prompt"
