#!/usr/bin/env bash
set -euo pipefail

git config --local core.hooksPath .githooks
chmod +x .githooks/pre-commit
chmod +x scripts/docs-sync-check.sh
chmod +x scripts/pre-commit-verification.sh

echo "Installed repo-local git hooks with core.hooksPath=.githooks"
echo "Pre-commit verification modes:"
echo "  MOMENTUM_PRECOMMIT_MODE=ticket git commit ..."
echo "  MOMENTUM_PRECOMMIT_MODE=ticket MOMENTUM_TARGETED_TEST_CMD='<cmd>' git commit ..."
echo "  MOMENTUM_PRECOMMIT_MODE=full git commit ..."
