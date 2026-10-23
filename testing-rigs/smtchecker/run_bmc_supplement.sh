#!/usr/bin/env bash
# Rig 6 supplement: BMC engine on the token and synth harnesses, assert target only.
# BMC checks each function on its own with an arbitrary starting state, so it can
# prove function-local properties (P1 minter only, P2 cap, P3) but gives spurious
# results for inductive invariants like P2 conservation. CHC stays the primary engine.
# Needs: solc 0.8.19 on PATH (venv-slither/bin) and LD_LIBRARY_PATH with libz3.so.4.11.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/results"
MEM_KB="${MEM_KB:-2500000}"
WALL="${WALL:-900}"
for job in "bmc_token|$HERE/harness/TokenInstrumented.sol|VinculumFinalisToken" \
           "bmc_synth|$HERE/harness/SynthInstrumented.sol|VinculumFinalisSynth"; do
  IFS='|' read -r name file c <<< "$job"
  s=$(date +%s)
  ( ulimit -v "$MEM_KB"; timeout "$WALL" solc "$file" --base-path / --allow-paths "$HERE/../.." \
      --model-checker-engine bmc --model-checker-targets assert \
      --model-checker-contracts "${file#/}:$c" --model-checker-timeout 30000 \
      --model-checker-show-unproved > "$OUT/$name.txt" 2>&1 )
  rc=$?
  echo "$name exit=$rc seconds=$(( $(date +%s) - s )) happens=$(grep -c 'happens here' "$OUT/$name.txt") might=$(grep -c 'might happen' "$OUT/$name.txt") solver_errors=$(grep -c 'Error trying to invoke SMT solver' "$OUT/$name.txt")" >> "$OUT/runlog_bmc.txt"
done
