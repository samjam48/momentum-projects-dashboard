#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/docs-sync-check.sh [--staged]
  scripts/docs-sync-check.sh --files <file> [<file> ...]

Checks whether API-sensitive or schema-sensitive changes are accompanied by
the required doc updates:
  - docs/api-map.md
  - docs/database-schema.md

Exit codes:
  0 = pass / not applicable
  1 = required doc update missing
  2 = usage or environment error
EOF
}

mode="staged"
declare -a files=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --staged)
      mode="staged"
      shift
      ;;
    --files)
      mode="files"
      shift
      while [[ $# -gt 0 ]]; do
        files+=("$1")
        shift
      done
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ "$mode" == "staged" ]]; then
  while IFS= read -r line; do
    [[ -n "$line" ]] && files+=("$line")
  done < <(git diff --cached --name-only --diff-filter=ACMR)
fi

if [[ ${#files[@]} -eq 0 ]]; then
  echo "docs-sync-check: no relevant files to inspect."
  exit 0
fi

api_touched=0
schema_touched=0
api_doc_updated=0
schema_doc_updated=0

for file in "${files[@]}"; do
  case "$file" in
    docs/api-map.md)
      api_doc_updated=1
      ;;
    docs/database-schema.md)
      schema_doc_updated=1
      ;;
    backend/app/routers/*|backend/app/schemas/*|frontend/src/api/*)
      api_touched=1
      ;;
    backend/app/models/*|backend/app/db/migrations/*|backend/app/db/migrations/**/*)
      schema_touched=1
      ;;
  esac
done

failures=0

if [[ $api_touched -eq 1 && $api_doc_updated -ne 1 ]]; then
  echo "docs-sync-check: API-sensitive files changed but docs/api-map.md was not updated." >&2
  failures=1
fi

if [[ $schema_touched -eq 1 && $schema_doc_updated -ne 1 ]]; then
  echo "docs-sync-check: Schema-sensitive files changed but docs/database-schema.md was not updated." >&2
  failures=1
fi

if [[ $failures -ne 0 ]]; then
  echo "docs-sync-check: update the required docs or stage them before committing." >&2
  exit 1
fi

echo "docs-sync-check: passed."
