#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/pre-commit-verification.sh [--mode auto|ticket|full] [--test-command "<cmd>"] [--staged]
  scripts/pre-commit-verification.sh --mode ticket --files <file> [<file> ...]

Modes:
  auto    Read MOMENTUM_PRECOMMIT_MODE and MOMENTUM_TARGETED_TEST_CMD if set.
  ticket  Require a targeted test command and run it.
  full    Run make lint and make test.

Examples:
  scripts/pre-commit-verification.sh --mode ticket --test-command "cd backend && ../backend/.venv/bin/pytest --cov-fail-under=0 app/tests/test_tasks.py"
  scripts/pre-commit-verification.sh --mode ticket
  scripts/pre-commit-verification.sh --mode ticket --files backend/app/routers/projects.py docs/api-map.md
  scripts/pre-commit-verification.sh --mode full

Environment:
  MOMENTUM_PRECOMMIT_MODE=ticket|full
  MOMENTUM_TARGETED_TEST_CMD="<cmd>"
EOF
}

mode="auto"
test_command=""
input_mode="staged"
declare -a explicit_files=()

split_tokens() {
  local value="$1"
  value="$(printf '%s' "$value" | tr '[:upper:]' '[:lower:]')"
  value="$(printf '%s' "$value" | sed -E 's/([a-z0-9])([A-Z])/\1 \2/g')"
  printf '%s\n' "$value" | tr '/._-' ' ' | tr -s ' ' '\n'
}

normalize_token() {
  local token="$1"
  case "$token" in
    projects) echo "project" ;;
    tasks) echo "task" ;;
    ventures) echo "venture" ;;
    labels) echo "label" ;;
    types) echo "type" ;;
    logs) echo "log" ;;
    activities) echo "activity" ;;
    categories) echo "category" ;;
    stories) echo "story" ;;
    *) echo "$token" ;;
  esac
}

append_unique() {
  local item="$1"
  local existing
  local array_name="$2"
  eval "for existing in \"\${${array_name}[@]:-}\"; do
    if [[ \"\$existing\" == \"$item\" ]]; then
      return 0
    fi
  done"
  eval "${array_name}+=(\"\$item\")"
}

collect_tokens_for_path() {
  local path="$1"
  declare -a result=()
  while IFS= read -r token; do
    token="$(normalize_token "$token")"
    [[ ${#token} -ge 3 ]] || continue
    case "$token" in
      src|app|backend|frontend|components|component|pages|page|stores|store|scripts|tests|test|models|model|routers|router|schemas|schema|services|service)
        continue
        ;;
    esac
    append_unique "$token" result
  done < <(split_tokens "$path")
  printf '%s\n' "${result[@]}"
}

score_candidate() {
  local candidate="$1"
  shift
  local score=0
  local token
  local candidate_lower
  candidate_lower="$(printf '%s' "$candidate" | tr '[:upper:]' '[:lower:]')"

  for token in "$@"; do
    [[ -n "$token" ]] || continue
    if [[ "$candidate_lower" == *"$token"* ]]; then
      score=$((score + 2))
    fi
  done

  printf '%s\n' "$score"
}

pick_best_candidates() {
  local candidate_list="$1"
  shift
  local -a tokens=("$@")
  local candidate score best_score=-1
  declare -a scored=()

  while IFS= read -r candidate; do
    [[ -n "$candidate" ]] || continue
    score="$(score_candidate "$candidate" "${tokens[@]}")"
    if (( score > 0 )); then
      scored+=("${score}|${candidate}")
      if (( score > best_score )); then
        best_score=$score
      fi
    fi
  done <<< "$candidate_list"

  if (( best_score < 0 )); then
    return 0
  fi

  for candidate in "${scored[@]}"; do
    score="${candidate%%|*}"
    candidate="${candidate#*|}"
    if (( score >= best_score - 1 )); then
      printf '%s\n' "$candidate"
    fi
  done
}

infer_backend_tests_for_file() {
  local file="$1"
  local backend_tests="$2"
  declare -a tokens=()
  local token

  while IFS= read -r token; do
    [[ -n "$token" ]] && tokens+=("$token")
  done < <(collect_tokens_for_path "$file")

  case "$file" in
    backend/app/db/migrations/*)
      printf '%s\n' "app/tests/test_phase_1_6_migration_groundwork.py"
      printf '%s\n' "app/tests/test_time_log_schema_upgrade.py"
      return 0
      ;;
  esac

  case "$file" in
    *activity*|*time_log*)
      tokens+=("activity" "time" "log")
      ;;
    *venture_category*)
      tokens+=("venture" "category" "label")
      ;;
  esac

  pick_best_candidates "$backend_tests" "${tokens[@]}"
}

infer_frontend_tests_for_file() {
  local file="$1"
  local frontend_tests="$2"
  local basename stem candidate
  declare -a exact_matches=()
  declare -a tokens=()
  local token

  basename="$(basename "$file")"
  stem="${basename%.*}"

  while IFS= read -r candidate; do
    [[ -n "$candidate" ]] || continue
    case "$candidate" in
      *"/${stem}.test.ts"|*"/${stem}.test.tsx"|*"/${stem}."*.test.ts|*"/${stem}."*.test.tsx)
        exact_matches+=("$candidate")
        ;;
    esac
  done <<< "$frontend_tests"

  if [[ ${#exact_matches[@]} -gt 0 ]]; then
    printf '%s\n' "${exact_matches[@]}"
    return 0
  fi

  while IFS= read -r token; do
    [[ -n "$token" ]] && tokens+=("$token")
  done < <(collect_tokens_for_path "$file")

  case "$file" in
    frontend/src/api/*)
      tokens+=("api" "contract" "modules")
      ;;
    frontend/src/components/layout/*)
      tokens+=("layout")
      ;;
    frontend/src/App.tsx)
      tokens+=("app")
      ;;
  esac

  pick_best_candidates "$frontend_tests" "${tokens[@]}"
}

build_default_test_command() {
  local file
  local backend_tests frontend_tests candidate
  declare -a backend_candidates=()
  declare -a frontend_candidates=()
  declare -a commands=()

  backend_tests="$(find backend/app/tests -maxdepth 1 -type f -name 'test_*.py' | sort | sed 's#^backend/##')"
  frontend_tests="$(find frontend/src -type f \( -name '*.test.ts' -o -name '*.test.tsx' \) | sort | sed 's#^frontend/##')"

  for file in "${changed_files[@]}"; do
    case "$file" in
      backend/app/tests/test_*.py)
        append_unique "${file#backend/}" backend_candidates
        ;;
      backend/*)
        while IFS= read -r candidate; do
          [[ -n "$candidate" ]] && append_unique "$candidate" backend_candidates
        done < <(infer_backend_tests_for_file "$file" "$backend_tests")
        ;;
      frontend/src/*.test.ts|frontend/src/*.test.tsx|frontend/src/**/*.test.ts|frontend/src/**/*.test.tsx)
        append_unique "${file#frontend/}" frontend_candidates
        ;;
      frontend/*)
        while IFS= read -r candidate; do
          [[ -n "$candidate" ]] && append_unique "$candidate" frontend_candidates
        done < <(infer_frontend_tests_for_file "$file" "$frontend_tests")
        ;;
    esac
  done

  if [[ ${#backend_candidates[@]} -gt 0 ]]; then
    commands+=("cd backend && ../backend/.venv/bin/pytest --cov-fail-under=0 ${backend_candidates[*]}")
  fi

  if [[ ${#frontend_candidates[@]} -gt 0 ]]; then
    commands+=("cd frontend && CI=true npm run test -- --run ${frontend_candidates[*]}")
  fi

  if [[ ${#commands[@]} -eq 0 ]]; then
    return 0
  fi

  local joined=""
  for candidate in "${commands[@]}"; do
    if [[ -n "$joined" ]]; then
      joined="${joined} && "
    fi
    joined="${joined}${candidate}"
  done

  printf '%s\n' "$joined"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      mode="${2:-}"
      shift 2
      ;;
    --test-command)
      test_command="${2:-}"
      shift 2
      ;;
    --staged)
      input_mode="staged"
      shift
      ;;
    --files)
      input_mode="files"
      shift
      while [[ $# -gt 0 ]]; do
        explicit_files+=("$1")
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

if [[ "$mode" == "auto" && -n "${MOMENTUM_PRECOMMIT_MODE:-}" ]]; then
  mode="${MOMENTUM_PRECOMMIT_MODE}"
fi

if [[ -z "$test_command" && -n "${MOMENTUM_TARGETED_TEST_CMD:-}" ]]; then
  test_command="${MOMENTUM_TARGETED_TEST_CMD}"
fi

declare -a changed_files=()
if [[ "$input_mode" == "files" ]]; then
  changed_files=("${explicit_files[@]}")
else
  while IFS= read -r line; do
    [[ -n "$line" ]] && changed_files+=("$line")
  done < <(git diff --cached --name-only --diff-filter=ACMR)
fi

if [[ ${#changed_files[@]} -eq 0 ]]; then
  echo "pre-commit-verification: no files detected."
  exit 0
fi

if [[ "$input_mode" == "files" ]]; then
  scripts/docs-sync-check.sh --files "${changed_files[@]}"
else
  scripts/docs-sync-check.sh --staged
fi

code_touched=0
for file in "${changed_files[@]}"; do
  case "$file" in
    backend/*|frontend/*|Makefile)
      code_touched=1
      ;;
  esac
done

if [[ $code_touched -ne 1 ]]; then
  echo "pre-commit-verification: no backend/frontend code changes detected; docs-only or prompt-only commit passed."
  exit 0
fi

if [[ "$mode" != "ticket" && "$mode" != "full" ]]; then
  echo "pre-commit-verification: choose --mode ticket or --mode full." >&2
  echo "For ticket commits, also provide --test-command or MOMENTUM_TARGETED_TEST_CMD." >&2
  exit 2
fi

if [[ "$mode" == "ticket" ]]; then
  if [[ -z "$test_command" ]]; then
    test_command="$(build_default_test_command)"
  fi

  if [[ -z "$test_command" ]]; then
    echo "pre-commit-verification: could not infer a targeted test command for the staged code changes." >&2
    echo "Provide --test-command or MOMENTUM_TARGETED_TEST_CMD." >&2
    exit 2
  fi

  echo "pre-commit-verification: running targeted ticket checks..."
  echo "pre-commit-verification: inferred command: $test_command"
  bash -lc "$test_command"
  echo "pre-commit-verification: ticket verification passed."
  exit 0
fi

echo "pre-commit-verification: running full verification..."
make lint
make test
echo "pre-commit-verification: full verification passed."
