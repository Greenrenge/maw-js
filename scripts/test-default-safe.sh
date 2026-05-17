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

mapfile -t MOCK_FILES < <(
  git ls-files -- 'test/*.ts' 'test/**/*.ts' |
    while IFS= read -r f; do
      [[ "$f" == test/isolated/* || "$f" == test/helpers/* ]] && continue
      grep -qE '^[[:space:]]*mock\.module[[:space:]]*\(' "$f" || continue
      printf '%s\n' "$f"
    done |
    sort -u
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
bun test "${SAFE_FILES[@]}"

if [[ "${#MOCK_FILES[@]}" -eq 0 ]]; then
  echo ""
  echo "=== no default-suite mock.module files detected ==="
  exit 0
fi

echo ""
echo "=== test-default-safe.sh: ${#MOCK_FILES[@]} mock-module file(s), one process each ==="
for f in "${MOCK_FILES[@]}"; do
  printf -- "--- %s ---\n" "$f"
  bun test "$f" --path-ignore-patterns '**/agents/**'
done
