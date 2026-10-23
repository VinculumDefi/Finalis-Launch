#!/bin/bash
# Rig 5 (symbolic): Mythril on the critical Vinculum contracts.
# Usage: bash testing-rigs/mythril/run_mythril.sh   (from repo root, after
#        "npx hardhat compile --force" in base-contracts)
# Needs: myth (Mythril v0.24.8) on PATH or MYTH=/path/to/myth.
#
# Exit codes: 0 no issues, 1 issues found, 137 killed (OOM).
#
# Mode: RUNTIME bytecode (--bin-runtime). A first attempt in source mode was
# aborted because every target has constructor arguments; Mythril deploys with
# empty arguments, the constructor reverts or exits early, and coverage stayed
# under 5 percent (see results_creation_mode_aborted/). Runtime mode starts
# from the deployed code with symbolic storage, so all external functions are
# reachable. Immutables are zero in Hardhat deployedBytecode.
# Bytecode comes from Hardhat artifacts (solc 0.8.19, optimizer 200, viaIR,
# evm paris), the same settings used for deployment.
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/testing-rigs/mythril/results"
BIN="$OUT/bytecode"
mkdir -p "$OUT" "$BIN"
MYTH="${MYTH:-myth}"
EXEC_TIMEOUT="${EXEC_TIMEOUT:-300}"
TX_COUNT="${TX_COUNT:-2}"
MAX_DEPTH="${MAX_DEPTH:-128}"
SOLVER_TIMEOUT="${SOLVER_TIMEOUT:-20000}"
PARALLEL="${PARALLEL:-1}"
ART="$ROOT/base-contracts/artifacts/contracts"
TARGETS=(
  "VinculumFinalisToken.sol/VinculumFinalisToken"
  "VinculumFinalisSynth.sol/VinculumFinalisSynth"
  "BaseCommitmentVaultLock.sol/BaseCommitmentVaultLock"
  "CommitmentVaultLock.sol/CommitmentVaultLock"
  "VinculumFinalisStake.sol/VinculumFinalisStake"
  "VinculumFinalisVerifier.sol/VinculumFinalisVerifier"
  "chain-verifiers/BaseLockRecordVerifier.sol/BaseLockRecordVerifier"
  "chain-verifiers/EthereumLockReader.sol/EthereumLockReader"
  "chain-verifiers/ArbitrumLockReader.sol/ArbitrumLockReader"
  "chain-verifiers/OptimismLockReader.sol/OptimismLockReader"
  "chain-verifiers/PolygonLockReader.sol/PolygonLockReader"
  "chain-verifiers/BnbSmartChainLockReader.sol/BnbSmartChainLockReader"
  "chain-verifiers/AvalancheLockReader.sol/AvalancheLockReader"
  "chain-verifiers/BitcoinLockReader.sol/BitcoinLockReader"
  "chain-verifiers/BitcoinCashLockReader.sol/BitcoinCashLockReader"
  "chain-verifiers/LitecoinLockReader.sol/LitecoinLockReader"
  "chain-verifiers/DogecoinLockReader.sol/DogecoinLockReader"
  "chain-verifiers/DigiByteLockReader.sol/DigiByteLockReader"
  "chain-verifiers/ZcashLockReader.sol/ZcashLockReader"
  "chain-verifiers/StellarLockReader.sol/StellarLockReader"
  "chain-verifiers/XrplLockReader.sol/XrplLockReader"
  "chain-verifiers/SolanaLockReader.sol/SolanaLockReader"
  # Finality and header checkers the readers call. Pure libraries (RlpReader,
  # MptProof, Secp256k1, Sha512, Blake2b, Bls12381, BeaconSsz, MptGet,
  # ExecutionHeader) have no external entry points; they are inlined into
  # the checkers and readers above and are covered there.
  "checkers/ArbitrumFinalityChecker.sol/ArbitrumFinalityChecker"
  "checkers/AvalancheFinalityChecker.sol/AvalancheFinalityChecker"
  "checkers/BitcoinHeaderChecker.sol/BitcoinHeaderChecker"
  "checkers/BnbFinalityChecker.sol/BnbFinalityChecker"
  "checkers/EthereumBeaconLightClient.sol/EthereumBeaconLightClient"
  "checkers/EthereumFinalityChecker.sol/EthereumFinalityChecker"
  "checkers/OptimismFinalityChecker.sol/OptimismFinalityChecker"
  "checkers/PolygonFinalityChecker.sol/PolygonFinalityChecker"
  "checkers/ZcashHeaderChecker.sol/ZcashHeaderChecker"
)
for t in "${TARGETS[@]}"; do
  name="${t##*/}"
  python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['deployedBytecode'][2:])" "$ART/$t.json" > "$BIN/$name.hex"
done
# ONLY="A B" reruns just those targets and appends to runlog.txt (used to
# rerun targets the shared box OOM-killed, exit 137).
ONLY="${ONLY:-}"
if [ -z "$ONLY" ]; then
{
  echo "mythril: $($MYTH version 2>&1)"
  echo "mode: --bin-runtime on Hardhat deployedBytecode (solc 0.8.19, optimizer 200, viaIR, paris)"
  echo "execution-timeout=${EXEC_TIMEOUT}s transaction-count=${TX_COUNT} max-depth=${MAX_DEPTH} solver-timeout=${SOLVER_TIMEOUT}ms parallel=${PARALLEL}"
  echo "started: $(date -Iseconds)"
} > "$OUT/settings.txt"
else
  echo "rerun ($ONLY) parallel=${PARALLEL}: $(date -Iseconds)" >> "$OUT/settings.txt"
fi
run_one() {
  name="$1"
  start=$(date +%s)
  $MYTH analyze -f "$BIN/$name.hex" --bin-runtime \
    --execution-timeout "$EXEC_TIMEOUT" -t "$TX_COUNT" --max-depth "$MAX_DEPTH" \
    --solver-timeout "$SOLVER_TIMEOUT" -o jsonv2 > "$OUT/$name.json" 2> "$OUT/$name.stderr.txt"
  rc=$?
  end=$(date +%s)
  echo "$name exit=$rc seconds=$((end-start))" >> "$OUT/runlog.txt"
}
export -f run_one
export MYTH EXEC_TIMEOUT TX_COUNT MAX_DEPTH SOLVER_TIMEOUT OUT BIN
if [ -z "$ONLY" ]; then : > "$OUT/runlog.txt"; LIST=$(for t in "${TARGETS[@]}"; do echo "${t##*/}"; done)
else LIST=$(printf '%s\n' $ONLY); fi
echo "$LIST" | xargs -P "$PARALLEL" -I{} bash -c 'run_one "$@"' _ {}
echo "finished: $(date -Iseconds)" >> "$OUT/settings.txt"
python3 "$ROOT/testing-rigs/mythril/summarize.py" "$OUT" > "$OUT/summary.md"
