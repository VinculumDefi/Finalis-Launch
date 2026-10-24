#!/usr/bin/env bash
# npm run ceremony:dryrun:simulate (from base-contracts). Base-only launch
# (t357u). Forks Base mainnet into the LOCAL in-process Hardhat network a few
# blocks behind the tip, with the real Base block gas limit, and runs
# ceremony_dryrun.cjs with a local test signer. Nothing is broadcast. No other
# chain is forked or read.
#
# --simulate: the only mode (Base-only SIMULATE rehearsal). No flag means the
# same thing. --simulate-non-base-locks is retired (no non-Base lock is
# deployed or checked in the Base-only launch).
set -euo pipefail
for a in "$@"; do
  case "$a" in
    --simulate) ;;
    --simulate-non-base-locks) echo "retired: --simulate-non-base-locks (Base-only launch; use --simulate)" >&2; exit 64 ;;
    *) echo "unknown option: $a (only --simulate)" >&2; exit 64 ;;
  esac
done
HERE="$(cd "$(dirname "$0")" && pwd)"
BC="$HERE/../../base-contracts"
# publicnode answered 403 mid-run on 2026-10-23, so the default is mainnet.base.org.
export RIG_BASE_RPC="${RIG_BASE_RPC:-https://mainnet.base.org}"
URL="$RIG_BASE_RPC"
rpc() { curl -s -X POST -H 'content-type: application/json' --data "$1" "$URL"; }
tip=$(rpc '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}' | sed -E 's/.*"result":"(0x[0-9a-f]+)".*/\1/')
export RIG_FORK=base
export RIG_FORK_BLOCK="${RIG_FORK_BLOCK:-$(( tip - 5 ))}"
gl=$(rpc "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_getBlockByNumber\",\"params\":[\"$(printf '0x%x' "$RIG_FORK_BLOCK")\",false]}" | sed -E 's/.*"gasLimit":"(0x[0-9a-f]+)".*/\1/')
export RIG_BLOCK_GAS=$(( gl ))
echo "dry-run: local Base fork at block $RIG_FORK_BLOCK, block gas limit $RIG_BLOCK_GAS" >&2
echo "dry-run: SIMULATE mode, Base-only, local Base fork, local test signer" >&2
cd "$BC"
OUTF=$(mktemp)
set +e
NODE_PATH="$BC/node_modules" NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=6144}" npx hardhat --config "$HERE/../hardhat.rig.config.cjs" run "$HERE/ceremony_dryrun.cjs" > "$OUTF"
rc=$?
set -e
cat "$OUTF"
# A crash of the fork backend (for example an RPC 403) can end the process
# without a verdict. That is a harness failure, never a pass.
if ! grep -q "^mode: SIMULATE (Base-only" "$OUTF" || ! grep -q "^ceremony would" "$OUTF"; then
  echo "dry-run harness did not reach a verdict (exit $rc, see stderr); this is NOT a pass"
  rm -f "$OUTF"; exit 1
fi
# Rig 10: a rehearsal that succeeded must also print its reconciliation verdict.
if grep -q "^ceremony would succeed" "$OUTF" && ! grep -q "^reconciliation " "$OUTF"; then
  echo "reconciliation did not reach a verdict (exit $rc); this is NOT a pass"
  rm -f "$OUTF"; exit 1
fi
rm -f "$OUTF"; exit $rc
