#!/bin/bash
# Rig 6 (formal): solc SMTChecker, CHC engine.
# Usage: bash testing-rigs/smtchecker/run_smtchecker.sh   (from repo root)
# Needs: solc 0.8.19 on PATH and libz3.so.4.11 on LD_LIBRARY_PATH
#        (solc 0.8.19 loads exactly z3 4.11; z3-solver==4.11.2.0 from pip provides it).
# Certora is not used: no CERTORAKEY in the environment.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
OUT="$HERE/results"
mkdir -p "$OUT"
TARGETS="assert,overflow,underflow,divByZero,outOfBounds"
QUERY_TIMEOUT="${QUERY_TIMEOUT:-30000}"   # ms per solver query
WALL="${WALL:-1800}"                       # s per job (exit 124 = wall timeout)
python3 "$HERE/instrument.py" > "$OUT/instrument.txt" || { echo "strip-check failed"; exit 1; }
python3 "$HERE/extract_issuance.py" >> "$OUT/instrument.txt"
python3 "$HERE/extract_feemath.py" >> "$OUT/instrument.txt"
{
  echo "solc: $(solc --version | tail -1)"
  echo "engine=chc targets=$TARGETS query-timeout=${QUERY_TIMEOUT}ms wall=${WALL}s ext-calls=untrusted"
  echo "mem-cap=${MEM_KB:-5000000}KB (ulimit -v) parallel=${PARALLEL:-1}"
  echo "certora: not available (CERTORAKEY not set)"
  echo "started: $(date -Iseconds)"
} > "$OUT/settings.txt"
# name | source file | contract
JOBS=(
  "harness_token|$HERE/harness/TokenInstrumented.sol|VinculumFinalisToken"
  "harness_synth|$HERE/harness/SynthInstrumented.sol|VinculumFinalisSynth"
  "harness_feemath|$HERE/harness/FeeMath.sol|FeeMath"
  "harness_issuance|$HERE/harness/IssuanceMath.sol|IssuanceMath"
  "prod_token|$ROOT/base-contracts/contracts/VinculumFinalisToken.sol|VinculumFinalisToken"
  "prod_synth|$ROOT/base-contracts/contracts/VinculumFinalisSynth.sol|VinculumFinalisSynth"
  "prod_basecvl|$ROOT/base-contracts/contracts/BaseCommitmentVaultLock.sol|BaseCommitmentVaultLock"
  "prod_stake|$ROOT/base-contracts/contracts/VinculumFinalisStake.sol|VinculumFinalisStake"
  "prod_verifier|$ROOT/base-contracts/contracts/VinculumFinalisVerifier.sol|VinculumFinalisVerifier"
)
run_job() {
  IFS='|' read -r name file contract <<< "$1"
  start=$(date +%s)
  # Memory cap so a large CHC query fails inside this job instead of
  # triggering the machine OOM killer (the box is shared with other agents).
  ulimit -v "$MEM_KB"
  timeout "$WALL" solc "$file" --base-path / --allow-paths "$ROOT" \
    --model-checker-engine chc --model-checker-targets "$TARGETS" \
    --model-checker-contracts "${file#/}:$contract" \
    --model-checker-timeout "$QUERY_TIMEOUT" --model-checker-show-unproved \
    > "$OUT/$name.txt" 2>&1
  rc=$?
  end=$(date +%s)
  v=$(grep -c 'happens here' "$OUT/$name.txt")
  u=$(grep -c 'might happen here' "$OUT/$name.txt")
  bad=$(grep -c 'does not exist' "$OUT/$name.txt")
  echo "$name exit=$rc seconds=$((end-start)) violations=$v unproved=$u badspec=$bad" >> "$OUT/runlog.txt"
}
export -f run_job
MEM_KB="${MEM_KB:-5000000}"
export OUT ROOT TARGETS QUERY_TIMEOUT WALL MEM_KB
# Exit codes: 0 done, 1 compile error, 124 wall timeout. solc here is the
# solc-select wrapper, which maps a signal to 256-signal: 247 = SIGKILL (OOM
# killer), 245 = SIGSEGV (crash inside libz3), 250 = SIGABRT (bad_alloc at cap).
[ -s "$OUT/runlog.txt" ] && { echo "# previous run, archived $(date -Iseconds)"; cat "$OUT/runlog.txt"; } >> "$OUT/runlog_history.txt"
: "${ONLY:=}"   # optional space-separated job names; reruns append to runlog
if [ -z "$ONLY" ]; then : > "$OUT/runlog.txt"; SEL=("${JOBS[@]}"); else
  SEL=(); for j in "${JOBS[@]}"; do for o in $ONLY; do [ "${j%%|*}" = "$o" ] && SEL+=("$j"); done; done; fi
printf '%s\n' "${SEL[@]}" | xargs -P "${PARALLEL:-1}" -I{} bash -c 'run_job "$@"' _ {}
echo "finished: $(date -Iseconds)" >> "$OUT/settings.txt"
