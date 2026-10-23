#!/usr/bin/env bash
# Rig 1 baseline. Runs the base-contracts Hardhat suite, the app tests, lint
# and build, and prints counts. Local only.
#   MODE=full  one Hardhat process for the whole suite (needs ~12 GB free)
#   MODE=files one Hardhat process per test file, same tests, counts summed
#              (used when the box is short of memory; the full run was
#              OOM-killed by the kernel on 2026-10-23 at 470 passing, 0 failing)
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$HERE/../.."
BC="$ROOT/base-contracts"
OUT="${OUT:-$HERE/logs}"
mkdir -p "$OUT"
export NODE_OPTIONS=--max-old-space-size=12288
MODE="${MODE:-files}"
cd "$BC"
if [ "$MODE" = full ]; then
  npx hardhat test > "$OUT/hardhat_full.log" 2>&1; echo "EXIT $?" >> "$OUT/hardhat_full.log"
else
  : > "$OUT/hardhat_files.log"
  for f in $(find test -name "*.test.cjs" -o -name "*.test.js" | sort); do
    echo "=== FILE $f" >> "$OUT/hardhat_files.log"
    npx hardhat test "$f" >> "$OUT/hardhat_files.log" 2>&1; echo "=== EXIT $? $f" >> "$OUT/hardhat_files.log"
  done
  p=0; fl=0; pe=0
  for n in $(grep -E "^\s+[0-9]+ passing" "$OUT/hardhat_files.log" | awk '{print $1}'); do p=$((p+n)); done
  for n in $(grep -E "^\s+[0-9]+ failing" "$OUT/hardhat_files.log" | awk '{print $1}'); do fl=$((fl+n)); done
  for n in $(grep -E "^\s+[0-9]+ pending" "$OUT/hardhat_files.log" | awk '{print $1}'); do pe=$((pe+n)); done
  echo "HARDHAT TOTAL passing=$p failing=$fl pending=$pe" | tee -a "$OUT/hardhat_files.log"
fi
cd "$ROOT"
node --test src/tests/*.js > "$OUT/app_tests.log" 2>&1; echo "EXIT $?" >> "$OUT/app_tests.log"
npm run lint > "$OUT/lint.log" 2>&1; echo "EXIT $?" >> "$OUT/lint.log"
npm run build > "$OUT/build.log" 2>&1; echo "EXIT $?" >> "$OUT/build.log"
echo BASELINE DONE
