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

## t270u(g): chronological allocation (branch)

`allocateEpoch(N)` now requires `N == lastAllocatedEpoch + 1` (revert
"VF-STK-010: allocate in epoch order (t270u)"), and stays permissionless. Every
allocation outcome (zero RAC, zero weight, cap skip, terminal, paid) marks the epoch
allocated, so the next epoch can always follow. New view `lastAllocatedEpoch()`
(0x70462f62). All other selectors are unchanged. The differential now allocates in
order (80 seeds, plus 186 refused out-of-order attempts), and a dedicated test covers
the order rule, every outcome counting as allocated, and catch-up after 100 epochs.
App simulator (src/lib/vfStakingEngine.js) and StakingPanel mirror the rule.

## t272u evidence on release/2026-10-21 (measured 2026-10-21, ET)

Gas units are from the hardhat EVM with the release-branch build. ETH cost uses Base
at 0.006 gwei and ETH at $2,470.08 (7:57 PM ET); the Base L1 data fee adds well under
0.000001 ETH per call.

1. allocateEpoch does not grow with positions (test/stake_t272_allocation_scale.test.cjs,
   25,000 in test-scale/stake_allocation_25000.test.cjs, run separately). 20 wallets,
   positions created across epochs 1 to 10, a tenth extended, matured ones withdrawn.

   | Historical positions | Epoch 12 | Epoch 13 | Epoch 14 | Max over epochs 1 to 14 |
   |---|---|---|---|---|
   | 10 | 138,851 | 138,851 | 138,851 | 155,951 |
   | 1,000 | 138,851 | 138,851 | 138,851 | 155,951 |
   | 10,000 | 138,851 | 138,851 | 138,851 | 155,951 |
   | 25,000 | 138,851 | 138,851 | 138,851 | 155,951 |

   Spread across sizes: 0 gas (the test allows at most 100). 155,951 is the first
   allocation that mints (fresh storage). Worst case seen in the randomized runs: 173,051.

2. Eligibility (test/stake_t272_eligibility.test.cjs, against StakeV1Reference, the
   frozen f816be3 Stake, same block): a 30-day position ending exactly at the end of
   epoch 4 counts in epochs 2 and 3; one ending one second earlier counts in epoch 2
   only. Same result in f816be3. A 30-day position with a 120-day term queued 100
   seconds before epoch 3 ends: epochs 2, 3 and 4 use the 30-day multiplier (10,000
   bps; epoch 4 starts 5 seconds before the new term), epoch 5 on uses 21,000 bps.
   Epoch totals equal f816be3 and the sum of position weights through create, expiry,
   withdrawal at maturity, queued and applied extensions, and early terminal withdrawal.

3. Long unclaimed history (test/stake_t272_long_claims.test.cjs): 2,100 epochs (about
   57.5 years) unclaimed. Claiming is per position; settlement is part of the claim.

   | Claim | 120-day terms (176 terms) | 30-day terms (701 terms) |
   |---|---|---|
   | 1 epoch | 79,122 | 79,173 |
   | 36 epochs (1 year) | 404,871 | 447,573 |
   | 180 epochs (about 5 years) | 1,644,015 | 1,857,321 |
   | Gas per extra epoch | 8,605 | 9,789 |
   | Most epochs in one transaction under 16,777,216 | 1,941 | 1,706 |
   | Largest claim run | 1,882 epochs, 16,488,184 | 1,671 epochs, 16,631,155 |

   Claiming all 2,100 epochs in one transaction exceeds the cap and reverts with no
   change; two claims recover everything to the wei. Any position unclaimed for up to
   about 46 years (30-day terms) or 53 years (120-day terms) claims in one transaction.
   A wallet with many positions claims each position, or several at once with
   claimPositions (10 positions with 10 paid epochs each: 565,459 gas); the only limit
   is the total of the per-position costs under the cap.

4. Exact rewards (test/stake_scheduled_weight_eval.test.cjs, EVAL_SEEDS=1-100): 100
   seeds, 3,051 stakes, 3,380 final epochs, 1,056 wallets (805 with more than one
   position), 491 epochs allocated 2 or more epochs late, 234 out-of-order attempts
   refused, 25 runs capped and 25 ending in terminal state, 434 cap-skipped epochs.
   Every epoch total, every mint, every position's payout (exact floor rule, rounding
   included), every owner total and the terminal state equal f816be3. Mismatches: 0.
   Rounding dust left in the Stake: 6,385 wei in total. An accumulator would differ for
   2,461 of 3,051 stakes (max 222,979 wei).
