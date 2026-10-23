#!/usr/bin/env bash
# Runs one rig test file with the rig Hardhat config.
#   testing-rigs/run.sh none|base|eth <file relative to testing-rigs> [more files]
# base/eth fork a public RPC into the LOCAL in-process Hardhat network, pinned
# to a block a few blocks behind the tip. Nothing is broadcast.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
BC="$HERE/../base-contracts"
mode="$1"; shift
if [ "$mode" != "none" ]; then
  export RIG_FORK="$mode"
  if [ -z "${RIG_FORK_BLOCK:-}" ]; then
    url=$([ "$mode" = base ] && echo "${RIG_BASE_RPC:-https://base-rpc.publicnode.com}" || echo "${RIG_ETH_RPC:-https://ethereum-rpc.publicnode.com}")
    tip=$(curl -s -X POST -H 'content-type: application/json' --data '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}' "$url" | sed -E 's/.*"result":"(0x[0-9a-f]+)".*/\1/')
    export RIG_FORK_BLOCK=$(( tip - 5 ))
  fi
  echo "fork $mode at block $RIG_FORK_BLOCK"
fi
files=(); for f in "$@"; do files+=("$HERE/$f"); done
cd "$BC"
NODE_PATH="$BC/node_modules" NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}" npx hardhat --config "$HERE/hardhat.rig.config.cjs" test "${files[@]}"
