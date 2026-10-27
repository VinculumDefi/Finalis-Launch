#!/bin/bash
# Revision E fork simulation supervisor (t448u). Run in the work directory.
# Local anvil forks only; nothing is signed or broadcast.
# usage: sup.sh shard nshard ; rotates upstreams on failure
export PATH=$HOME/.foundry/bin:$PATH
S=$1; N=$2; P=$((8610+S)); B=$(cat block.txt)
UP=(https://base-rpc.publicnode.com https://base.drpc.org https://base-mainnet.public.blastapi.io https://gateway.tenderly.co/public/base https://mainnet.base.org)
k=${3:-$S}
for try in $(seq 1 60); do
  U=${UP[$((k % ${#UP[@]}))]}
  pkill -f "anvil.*--port $P " ; sleep 1
  anvil --fork-url $U --fork-block-number $B --port $P --chain-id 8453 --silent --no-rate-limit --retries 10 --timeout 60000 > anvil_$S.log 2>&1 &
  AP=$!
  sleep 6
  node "$(dirname "$0")/forkLockSimulation.cjs" $P $S $N $U >> sim_$S.log 2>&1 && { echo "DONE $S" >> sup.log; kill $AP; exit 0; }
  echo "restart $S try $try upstream $U" >> sup.log
  kill $AP; k=$((k+1)); sleep 3
done
