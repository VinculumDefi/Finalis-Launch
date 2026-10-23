#!/bin/bash
# Rig 7 (static): Slither, all detectors, on base-contracts.
# Usage: bash testing-rigs/slither/run_slither.sh   (from repo root)
# Needs: slither 0.11.6 and solc 0.8.19 (solc-select) on PATH.
# Test and mock contracts under contracts/test/ are excluded; everything else
# (token, Verifier, Synth, Stake, CVL, BaseCVL, all readers and checkers,
# scheduled price poster logic in the Verifier) is analyzed.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
cd "$ROOT/base-contracts"
npx hardhat compile --force > /dev/null
slither --version > "$HERE/slither_version.txt"
slither . --hardhat-ignore-compile --filter-paths "contracts/test/|node_modules" \
  --json "$HERE/slither_raw.json" > "$HERE/slither_raw.txt" 2>&1
echo "slither exit=$? (non-zero means findings were reported)" >> "$HERE/slither_raw.txt"
python3 "$HERE/triage.py"
