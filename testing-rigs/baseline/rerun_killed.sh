#!/usr/bin/env bash
# Reruns, one at a time, every file that the per-file baseline lost to an
# OOM kill (EXIT 137, caused by other processes on the shared box), and
# prints the per-file counts. Local only.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
BC="$HERE/../../base-contracts"
LOG="$HERE/logs/hardhat_files.log"
OUT="$HERE/logs/rerun_killed.log"
export NODE_OPTIONS=--max-old-space-size=12288
: > "$OUT"
cd "$BC"
for f in $(grep "=== EXIT 137" "$LOG" | awk '{print $4}'); do
  echo "=== FILE $f" >> "$OUT"
  npx hardhat test "$f" >> "$OUT" 2>&1; echo "=== EXIT $? $f" >> "$OUT"
done
p=0; fl=0
for n in $(grep -E "^\s+[0-9]+ passing" "$OUT" | awk '{print $1}'); do p=$((p+n)); done
for n in $(grep -E "^\s+[0-9]+ failing" "$OUT" | awk '{print $1}'); do fl=$((fl+n)); done
echo "RERUN TOTAL passing=$p failing=$fl" | tee -a "$OUT"
