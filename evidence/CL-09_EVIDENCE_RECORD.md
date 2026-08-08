# CL-09 — Remediation Evidence Record
## Unbounded epoch accounting · closed 2026-08-07 · evidence level E

**Preserved deliberately.** The pre-fix measurements below cannot be reproduced once the defect is removed. They are the proof that CL-09 was a demonstrated failure characteristic, not speculative technical debt.

---

## THE DEFECT

`closeEpoch` and `allocateEpoch` iterated **every position ever created**, including withdrawn ones:

```solidity
ep.totalWeight = 0;
for (uint256 i = 0; i < nextPositionId; i++) {
    Position storage pos = positions[i];
    if (!pos.withdrawn && _qualifiesForEpoch(pos, epochN)) {
        ep.totalWeight += _getWeight(pos);
    }
}
```

**Requirements:** VF-STK-010 (chronological finalization), VF-IMM-006 (a deployed defect cannot be repaired).

**Consequence.** Once iteration cost exceeded the block gas limit, both functions became uncallable. Chronological ordering then froze the reward system permanently, with no admin path and no upgrade path. The failure arrives in proportion to adoption: **the protocol breaks precisely when it succeeds.**

---

## MEASURED BEFORE FIX

Measured on the pre-fix contract, `closeEpoch(1)`, Hardhat network, solc 0.8.19, optimizer 200 runs, `viaIR: true`.

| Lifetime positions | Gas used |
|---|---|
| 5 | 107,461 |
| 60 | 380,536 |

**Growth:** 3.54× gas for 12× positions.
**Marginal cost:** (380,536 − 107,461) / 55 ≈ **4,965 gas per lifetime position.**

**Extrapolated brick point:** at a 30,000,000 gas block limit, approximately **6,000 lifetime positions** renders `closeEpoch` uncallable. Lifetime, not concurrent — withdrawn positions continued to be iterated forever.

---

## MEASURED AFTER FIX

| Lifetime positions | Gas used | Ratio to 5-position case |
|---|---|---|
| 5 | 109,284 | 1.000× |
| 60 | 109,284 | 1.000× |
| 600 | 109,284 | 1.000× |

**Byte-identical across a 120× range.** The dependency on lifetime position count is eliminated, not reduced.

The 5-position case is ~1,800 gas *more expensive* than before. That is the expected shape of the trade: a small fixed accounting cost exchanged for removal of the O(n) term. An optimization that merely made the loop cheaper would have shown a lower number at 5 and a still-rising number at 600.

---

## THE FIX

A **difference array** over epochs.

A position qualifies for a contiguous range of epochs — those N where `start ≤ T0+(N-1)E` and `end ≥ T0+(N+1)E`. Each position records its weight at the first epoch it qualifies for and withdraws it at the first epoch it does not:

```
weightAddedAt[first]     += w
weightRemovedAt[last + 1] += w
```

`closeEpoch(N)` then advances a running accumulator in O(1):

```
runningQualifyingWeight += weightAddedAt[N] - weightRemovedAt[N]
```

**Mutation paths, each treated as a delta mutation rather than a position mutation with accounting side effects:**

| Path | Handling |
|---|---|
| Creation | Register weight across the computed range |
| Extension | **Unregister the old range in full**, then re-register — an extension changes both `start` and `end`, so the boundary moves at both ends |
| Withdrawal (matured) | Cancel from `lastClosedEpoch + 1`; already-closed epochs keep the weight they closed with |
| Withdrawal (terminal state, early) | Same cancellation path. Handles the case where the position is partway through its range |

The terminal-state case is why cancellation cuts at `lastClosedEpoch + 1` rather than removing the whole range: VF-STK-020 requires that withdrawal not erase claimable VCLM already earned, and that guarantee must hold in the accounting, not only in the payout.

---

## ⚠️ VF-STK-010 AND THE STRICTER CHRONOLOGICAL CHECK

`closeEpoch` now requires:

```solidity
require(epochN == lastClosedEpoch + 1, "VF-STK-010: chronological order");
```

**This is not a new protocol restriction introduced for the optimization's convenience.** It is the pre-existing VF-STK-010 requirement made explicit and enforceable.

The prior code enforced the same rule loosely — `epochs[epochN - 1].closed` — which permitted the same outcome by a weaker check. A running accumulator cannot skip an epoch, so the invariant that was already required is now also structurally necessary.

Recorded here so a later reader does not mistake it for an implementation artifact and relax it.

---

## ACCEPTANCE EVIDENCE

**1 — Baseline preservation.** The 85 passing tests as of immediately before CL-09 were captured by name (`BASELINE_85_tests.txt`) and diffed after the rewrite. **All 85 present, none renamed, none weakened, none removed.** A green aggregate count was explicitly not accepted as sufficient.

**2 — Differential oracle** (`07_differential.test.cjs`). A brute-force eligibility oracle written from §10.1 and §10.2 directly — not derived from the contract — compared against the accumulator at every epoch boundary:

- 20 randomized positions across three tokens, four durations, varied amounts and staggered start times, over 6 epochs
- Withdrawal case: agreement preserved after a withdrawal cancels future contribution
- Conservation: `runningQualifyingWeight` equals the accumulated deltas at every boundary

Agreement was exact at every comparison.

**3 — Scaling** (`06_scaling.test.cjs`). Gas flat from 5 to 600 lifetime positions, asserted on the growth *ratio* rather than an absolute figure so the test survives compiler and optimizer changes.

**4 — False-pass correction.** The original `allocateEpoch` scaling test reported 1.00× before the fix and appeared to pass. It measured nothing: the epoch was zero-eligible, so the function returned before entering its loop. This is annotated in place in the test file rather than silently corrected — a test that passes for the wrong reason is more dangerous than one that fails.

---

## STATUS

**CL-09: Resolved, evidence level E.**

**Critical findings open: 0.**

That statement means the known Critical remediation queue has been exhausted with evidence. It does **not** mean ready to deploy. Three gates remain before code freeze:

1. CL-38 — price publisher key model decision
2. Implementation-domain narrowing audit — every stored, input and output quantity checked against its specification-defined range for truncation, overflow, signedness, precision, representation, sentinel-value and chain-format incompatibility
3. Remaining requirement-family coverage review — 17 of 18 families outstanding

Red team should attack the resulting candidate, not the moving target.
