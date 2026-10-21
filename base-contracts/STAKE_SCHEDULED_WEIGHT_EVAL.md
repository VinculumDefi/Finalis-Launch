# t270u: Scheduled Epoch Weight Accounting, evaluation (test branch only)

Branch `eval/scheduled-epoch-weight`. Nothing deployed, nothing broadcast, no keys.

## Finding

The Stake at main `21ed30b` already is the scheduled-weight design. Each create or
queued extension records its weight against the future epochs it qualifies for, as a
start entry and an end entry (`_weightAddAt` / `_weightSubAt`) plus a running total per
epoch. `closeEpoch` reads the total in O(1). `allocateEpoch` mints the whole epoch
reward once, in O(1). Claims pay floor(epoch reward x weight / total weight) per
position per epoch and transfer already-minted VCLM.

Audit result: all points (a) to (h) pass, with one minor gap. The claim term pointer
restarts at the position's first term on every claim (`_claimable`, 21ed30b line 529).
That makes claim cost grow with that one position's own term count: about 1,850 gas
per term. The Base cap would be reached only after about 9,000 terms, which is more
than 700 years of back-to-back 30-day terms. The branch adds a per-position term
checkpoint (`_claimTermIdx`) that closes it. The ABI is unchanged.

## Evidence (tests on this branch)

- `test/stake_scheduled_weight_eval.test.cjs`: 72 randomized seeds vs the frozen f816be3 Stake.
- `test/stake_scheduled_weight_gas.test.cjs`: 500-position differential, 5,000 historical
  positions, 600-epoch positions, constructed worst cases, 100-epoch delay.

Both pass against the 21ed30b contract and against the branch contract.
