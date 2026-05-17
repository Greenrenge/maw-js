#!/usr/bin/env bash
# test-default-safe.sh — run the default suite without cross-file mock pollution.
#
# WHY:
#   `bun test test/` is not a ship gate by itself because Bun's `mock.module()`
#   is process-global and retroactive. A handful of default-suite files still
#   install module mocks outside `test/isolated/`, which can bleed into later
#   files when they share one Bun process. This script keeps the fast broad
#   sweep for pure/default tests, but peels every default-suite mock-module file
#   into its own Bun subprocess.
#
# RESULT:
#   - one shared Bun process for the ordinary default suite
#   - one Bun process per default-suite file that calls mock.module()
#
# This is the release/CI-safe replacement for bare `bun run test`.

set -eo pipefail

cd "$(dirname "$0")/.."

export MAW_TEST_MODE=1

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

run_bun_case() {
  local coverage_key="$1"
  shift

  if [[ -n "$COVERAGE_DIR" ]]; then
    local run_dir="$COVERAGE_DIR/$coverage_key"
    mkdir -p "$run_dir"
    bun test "$@" "${RUN_ARGS[@]}" --coverage-dir "$run_dir"
    append_lcov_manifest "$run_dir/lcov.info"
  else
    bun test "$@" "${RUN_ARGS[@]}"
  fi
}

if [ "${#REQUESTED_FILES[@]}" -gt 0 ]; then
  ALL_TEST_FILES=()
  for f in "${REQUESTED_FILES[@]}"; do
    [[ "$f" == test/helpers/* ]] && continue
    [[ "$f" == test/isolated/* ]] && continue
    [[ "$f" == *"/agents/"* ]] && continue
    [[ "$f" == test/zz-mock-tmux-smoke.test.ts ]] && continue
    ALL_TEST_FILES+=("$f")
  done
else
  mapfile -t ALL_TEST_FILES < <(
    git ls-files -- 'test/*.ts' 'test/**/*.ts' |
      while IFS= read -r f; do
        [[ "$f" == test/helpers/* ]] && continue
        [[ "$f" == test/isolated/* ]] && continue
        [[ "$f" == *"/agents/"* ]] && continue
        [[ "$f" == test/zz-mock-tmux-smoke.test.ts ]] && continue
        printf '%s\n' "$f"
      done
  )
fi

if [ "${#ALL_TEST_FILES[@]}" -eq 0 ]; then
  echo "error: no default-suite test files matched" >&2
  exit 2
fi

mapfile -t MOCK_FILES < <(
  printf '%s\n' "${ALL_TEST_FILES[@]}" |
    while IFS= read -r f; do
      grep -qE '^[[:space:]]*mock\.module[[:space:]]*\(' "$f" || continue
      printf '%s\n' "$f"
    done | sort -u
)

declare -A MOCK_SET=()
for f in "${MOCK_FILES[@]}"; do
  MOCK_SET["$f"]=1
done

SAFE_FILES=()
for f in "${ALL_TEST_FILES[@]}"; do
  [[ -n "${MOCK_SET[$f]:-}" ]] && continue
  SAFE_FILES+=("$f")
done

echo "=== test-default-safe.sh: shared default sweep ==="
if [[ "${#SAFE_FILES[@]}" -gt 0 ]]; then
  run_bun_case "shared" "${SAFE_FILES[@]}"
else
  echo "(skipped: no shared default-suite files matched)"
fi

if [[ "${#MOCK_FILES[@]}" -eq 0 ]]; then
  echo ""
  echo "=== no default-suite mock.module files detected ==="
  exit 0
fi

echo ""
echo "=== test-default-safe.sh: ${#MOCK_FILES[@]} mock-module file(s), one process each ==="
mock_index=0
for f in "${MOCK_FILES[@]}"; do
  printf -- "--- %s ---\n" "$f"
  mock_index=$((mock_index + 1))
  run_bun_case "mock-$mock_index" "$f" --path-ignore-patterns '**/agents/**'
done
