#!/bin/bash
# Revision E fork simulation supervisor (t448u). Run in the work directory.
# Local anvil forks only; nothing is signed or broadcast.
# usage: sup_retry.sh tag listfile ; holder-first retry pass, rotates upstreams on failure
export PATH=$HOME/.foundry/bin:$PATH
T=$1; LIST=$2; P=$((8620+T)); B=$(cat block.txt)
UP=(https://base-rpc.publicnode.com https://base.drpc.org https://base-mainnet.public.blastapi.io https://gateway.tenderly.co/public/base https://mainnet.base.org)
k=${3:-$T}
for try in $(seq 1 40); do
  U=${UP[$((k % ${#UP[@]}))]}
  pkill -f "anvil.*--port $P " ; sleep 1
  anvil --fork-url $U --fork-block-number $B --port $P --chain-id 8453 --silent --no-rate-limit --retries 10 --timeout 60000 > anvil_r$T.log 2>&1 &
  AP=$!
  sleep 6
  # skip addresses already settled (non-ERROR) in this retry output
  python3 - "$LIST" "retry_$T.jsonl" > retry_${T}_todo.txt <<'PY'
import sys,json,os
lst=[l.strip() for l in open(sys.argv[1]) if l.strip()]
done={}
if os.path.exists(sys.argv[2]):
  for l in open(sys.argv[2]):
    r=json.loads(l); done[r['address']]=r['result']
print("\n".join(a for a in lst if done.get(a) in (None,'ERROR')))
PY
  [ -s retry_${T}_todo.txt ] || { echo "RDONE $T" >> sup.log; kill $AP; exit 0; }
  node "$(dirname "$0")/forkLockSimulationRetry.cjs" $P retry_${T}_todo.txt retry_$T.jsonl $U >> retry_$T.log 2>&1 && { echo "RDONE $T" >> sup.log; kill $AP; exit 0; }
  echo "rrestart $T try $try upstream $U" >> sup.log
  kill $AP; k=$((k+1)); sleep 3
done
