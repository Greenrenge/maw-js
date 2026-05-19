#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf coverage
mkdir -p coverage
MANIFEST="coverage/.lcov-manifest.txt"
: > "$MANIFEST"

export MAW_LCOV_MANIFEST="$MANIFEST"

bash scripts/test-default-safe.sh \
  --coverage \
  --coverage-reporter=lcov \
  --coverage-dir=coverage/default

bash scripts/test-isolated.sh \
  --coverage \
  --coverage-reporter=lcov \
  --coverage-dir=coverage/isolated

MAW_TEST_MODE=1 bun test test/zz-mock-tmux-smoke.test.ts \
  --coverage \
  --coverage-reporter=lcov \
  --coverage-dir=coverage/mock-smoke \
  --path-ignore-patterns '**/agents/**'
printf '%s\n' "coverage/mock-smoke/lcov.info" >> "$MANIFEST"

MAW_TEST_MODE=1 bun test src/commands/plugins/ \
  --coverage \
  --coverage-reporter=lcov \
  --coverage-dir=coverage/plugin \
  --path-ignore-patterns '**/agents/**'
printf '%s\n' "coverage/plugin/lcov.info" >> "$MANIFEST"

bun scripts/merge-lcov.ts --out coverage/lcov.info --manifest "$MANIFEST"

bun scripts/coverage-gap-analysis.ts coverage/lcov.info docs/testing/coverage-gap-analysis.md
bun scripts/coverage-badge.ts coverage/lcov.info coverage/maw-js-coverage.json
