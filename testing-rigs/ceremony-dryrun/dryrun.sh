#!/usr/bin/env bash
# npm run ceremony:dryrun (from base-contracts). Forks Base mainnet into the
# LOCAL in-process Hardhat network a few blocks behind the tip, with the real
# Base block gas limit, and runs ceremony_dryrun.cjs. Nothing is broadcast.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
BC="$HERE/../../base-contracts"
URL="${RIG_BASE_RPC:-https://base-rpc.publicnode.com}"
rpc() { curl -s -X POST -H 'content-type: application/json' --data "$1" "$URL"; }
tip=$(rpc '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}' | sed -E 's/.*"result":"(0x[0-9a-f]+)".*/\1/')
export RIG_FORK=base
export RIG_FORK_BLOCK="${RIG_FORK_BLOCK:-$(( tip - 5 ))}"
gl=$(rpc "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_getBlockByNumber\",\"params\":[\"$(printf '0x%x' "$RIG_FORK_BLOCK")\",false]}" | sed -E 's/.*"gasLimit":"(0x[0-9a-f]+)".*/\1/')
export RIG_BLOCK_GAS=$(( gl ))
echo "dry-run: local Base fork at block $RIG_FORK_BLOCK, block gas limit $RIG_BLOCK_GAS" >&2
cd "$BC"
NODE_PATH="$BC/node_modules" NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=6144}" npx hardhat --config "$HERE/../hardhat.rig.config.cjs" run "$HERE/ceremony_dryrun.cjs"
