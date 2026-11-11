#!/usr/bin/env bash
# Downloads the backend's OpenAPI document into openapi/openapi.json.
# Keys are sorted and indented so a contract change shows up as a readable diff.
# Needs the backend running (from the backend worktree: npm run start:api:dev).
set -euo pipefail
cd "$(dirname "$0")/.."

docs_url="${OPENAPI_URL:-http://localhost:3000/docs-json}"
tmp_file="$(mktemp)"
trap 'rm -f "$tmp_file"' EXIT

curl --fail --silent --show-error "$docs_url" -o "$tmp_file"
python3 - "$tmp_file" openapi/openapi.json <<'PY'
import json, sys
with open(sys.argv[1], encoding="utf-8") as source:
    document = json.load(source)
with open(sys.argv[2], "w", encoding="utf-8") as target:
    json.dump(document, target, indent=2, sort_keys=True, ensure_ascii=False)
    target.write("\n")
PY
echo "Updated openapi/openapi.json from $docs_url. Next: tool/generate_api_client.sh"
