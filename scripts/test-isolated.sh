#!/usr/bin/env bash
# Strategy A: per-file subprocess test runner for test/isolated/.
#
# WHY: Bun's `mock.module(...)` is process-global. Running the entire
# test/isolated/ suite in a single `bun test` invocation lets mocks leak
# across files — producing flaky, order-dependent failures that gate CI
# even though each file is green in isolation.
#
# This script runs ONE bun process per test file. Trade-off: slower
# (~bun startup cost × N files) but true isolation. Zero test code
# changes required.
#
# Usage:
#   bash scripts/test-isolated.sh                         # normal run
#   bash scripts/test-isolated.sh --randomize             # passes --randomize to each file
#   bash scripts/test-isolated.sh test/isolated/foo.test.ts # fast targeted run, still isolated
#   bash scripts/test-isolated.sh test/isolated/foo.test.ts --randomize
set -eo pipefail

cd "$(dirname "$0")/.."

# #820 — Tell the source guard in src/config/load.ts that we're running tests.
# saveConfig() refuses to write to the real ~/.config/maw/ when this is set,
# preventing fixture leaks into developer config mid-session.
export MAW_TEST_MODE=1

IGNORE_ARGS=(
  --path-ignore-patterns '**/agents/**'
)

BUN_EXTRA_ARGS=()
REQUESTED_FILES=()

for arg in "$@"; do
  if [[ "$arg" == -* ]]; then
    BUN_EXTRA_ARGS+=("$arg")
  elif [[ -d "$arg" ]]; then
    while IFS= read -r file; do
      REQUESTED_FILES+=("$file")
    done < <(find "$arg" -type f -name '*.test.ts' | sort)
  elif [[ -f "$arg" ]]; then
    REQUESTED_FILES+=("$arg")
  else
    echo "error: unknown test path: $arg" >&2
    exit 2
  fi
done

COVERAGE_DIR=""
RUN_ARGS=()
EXPECT_COVERAGE_DIR_VALUE=0
for arg in "${BUN_EXTRA_ARGS[@]}"; do
  if [[ "$EXPECT_COVERAGE_DIR_VALUE" -eq 1 ]]; then
    COVERAGE_DIR="$arg"
    EXPECT_COVERAGE_DIR_VALUE=0
    continue
  fi
  if [[ "$arg" == --coverage-dir=* ]]; then
    COVERAGE_DIR="${arg#--coverage-dir=}"
    continue
  fi
  if [[ "$arg" == "--coverage-dir" ]]; then
    EXPECT_COVERAGE_DIR_VALUE=1
    continue
  fi
  RUN_ARGS+=("$arg")
done
if [[ "$EXPECT_COVERAGE_DIR_VALUE" -eq 1 ]]; then
  echo "error: --coverage-dir requires a value" >&2
  exit 2
fi

append_lcov_manifest() {
  local lcov_path="$1"
  if [[ -n "${MAW_LCOV_MANIFEST:-}" && -f "$lcov_path" ]]; then
    printf '%s\n' "$lcov_path" >> "$MAW_LCOV_MANIFEST"
  fi
}

if [ "${#REQUESTED_FILES[@]}" -gt 0 ]; then
  FILES=("${REQUESTED_FILES[@]}")
else
  FILES=(test/isolated/*.test.ts)
fi

TOTAL=${#FILES[@]}
PASSED=0
FAILED=0
FAILED_FILES=()

if [ "$TOTAL" -eq 0 ]; then
  echo "error: no isolated test files matched" >&2
  exit 2
fi

echo "=== test-isolated.sh: $TOTAL files, one process each ==="
run_index=0
for f in "${FILES[@]}"; do
  printf -- "--- %s ---\n" "$f"
  if [[ -n "$COVERAGE_DIR" ]]; then
    run_index=$((run_index + 1))
    run_dir="$COVERAGE_DIR/run-$run_index"
    mkdir -p "$run_dir"
    if bun test "$f" "${IGNORE_ARGS[@]}" "${RUN_ARGS[@]}" --coverage-dir "$run_dir"; then
      append_lcov_manifest "$run_dir/lcov.info"
      PASSED=$((PASSED + 1))
    else
      FAILED=$((FAILED + 1))
      FAILED_FILES+=("$f")
    fi
  elif bun test "$f" "${IGNORE_ARGS[@]}" "${RUN_ARGS[@]}"; then
    PASSED=$((PASSED + 1))
  else
    FAILED=$((FAILED + 1))
    FAILED_FILES+=("$f")
  fi
done

echo ""
echo "=== summary: $PASSED/$TOTAL files passed, $FAILED failed ==="
if [ "$FAILED" -gt 0 ]; then
  echo "failed files:"
  for f in "${FAILED_FILES[@]}"; do echo "  - $f"; done
  exit 1
fi
