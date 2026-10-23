#!/usr/bin/env bash
# Rig 10 live reconciliation, read only. Local in-process Hardhat network (no
# fork) for reference deployments; public RPCs for reads.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
BC="$HERE/../../base-contracts"
cd "$BC"
unset RIG_FORK RIG_FORK_BLOCK
NODE_PATH="$BC/node_modules" NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}" npx hardhat --config "$HERE/../hardhat.rig.config.cjs" run "$HERE/live_reconcile.cjs"
