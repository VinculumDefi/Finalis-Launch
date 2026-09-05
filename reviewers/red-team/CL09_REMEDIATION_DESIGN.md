# CL-09 · Remediation Design

**Tree:** `github.com/VinculumDefi/Finalis-Launch` @ `redteam/prep` (`4ac8e40` + the
pending forfeit-rule patch)
**Status:** Design note. No implementation, no patch, no code proposed.
**Finding:** CL-09, `allocateEpoch` half. `closeEpoch` is already O(1) and closed.

---

## 1 · The measurement

Against a real reward basis with qualifying positions:

| positions | 5 | 60 | 150 |
|---|---|---|---|
| gas | 216,932 | 1,012,947 | 2,315,517 |

≈14,473 gas per lifetime position. Uncallable at roughly **2,062 positions**.
`nextPositionId` never decreases — withdrawn positions are skipped *inside* the
loop, not removed from it — so the cost grows with protocol lifetime rather than
with active stakers.

The committed regression measures none of this. `deployStakeOnly` produces a zero
reward basis, so `allocateEpoch` returns before its loop and reports identical
gas at 5 and 60 positions by construction.

---

## 2 · Two problems, not one

**Problem A — dead weight.** `allocateEpoch` iterates `0..nextPositionId`,
testing every position ever created. Cost grows forever.

**Problem B — a large single epoch.** Crediting N owners requires N writes to
`claimableVclm`. Irreducible. Bounded transactions are the only answer.

Solving B alone does **not** solve A: batching a scan of 250,000 positions into
1,250 transactions bounds each transaction and leaves total work unbounded.
VF-STK-010 forces epochs to close in order, so epoch N+1 waits for all of them.
**Both must be solved.**

---

## 3 · What Rev 6 permits

No requirement mandates single-transaction allocation. Searched for
`single transaction`, `one transaction`, `one invocation`, `atomically`,
`all positions`, `every position` — one hit in the whole specification,
VF-COM-006, an unrelated subsystem.

- **VF-STK-014** attaches "once" to the **mint**, not to the recording of
  entitlements.
- **VF-STK-028** prohibits partial epoch reward **minting**, not partial
  recording.
- **VF-STK-026** requires shares at 18-decimal precision, rounding down.
- **VF-STK-027** requires the remainder to remain inaccessible — satisfied by
  CL-87, which mints the complete reward up front.

A bounded, resumable allocation satisfies all four.

---

## 4 · Invariants any mechanism must hold

1. **`totalReward` minted once, complete, before distribution begins.** CL-87
   already does this, which helps: the amount is committed and cap-recorded
   before the first batch, so batching cannot alter it.
2. **`ep.totalWeight` frozen at close.** Shares are
   `(totalReward * weight) / ep.totalWeight`. If the denominator moved between
   batches, VF-STK-026 determinism would break.
3. **Epochs closed and allocated in order.** VF-STK-010.
4. **Same result regardless of batch count.** A participant receives exactly
   what a single-transaction allocation would have credited.
5. **Forfeit on early withdrawal preserved.** Entombed as intentional,
   2026-09-03. A position withdrawn before its epoch is allocated receives
   nothing. Under batching this becomes order-sensitive — see §7.

---

## 5 · Mechanism A — monotone id window

`startTimestamp = block.timestamp` at creation and ids come from
`nextPositionId++`, so `posFirstEpoch[id]` is non-decreasing in `id`.

- **Upper bound.** Every position qualifying for epoch N has
  `posFirstEpoch ≤ N`. They occupy a prefix; everything above was created too
  late.
- **Lower bound.** The maximum term is 120 days — twelve epochs. Any position
  whose first qualifying epoch is more than twelve behind N has ended.

Both bounds advance monotonically and can be stored cursors.

**Cost:** two storage slots. No per-registration cost. `createPosition` is
unchanged.

**Defect — extensions break the monotonicity.** `applyExtensionIfMatured` sets
`startTimestamp = endTimestamp` and calls `_registerWeight` with a new range.
The position keeps its **old, low id** but acquires a **new, higher**
`posFirstEpoch`. It therefore sits below the lower cursor while being eligible,
and would be silently skipped — losing rewards it is entitled to.

Ranges do not overlap (the new term begins at the old end), so double-crediting
is not a risk; the risk is omission. Mitigating it requires a side list of
extended positions, which is unbounded in principle and reintroduces the problem
being solved.

**Assessment: rejected as a standalone mechanism.** The monotonicity is real but
not durable under VF-STK-021 extensions.

---

## 6 · Mechanism B — epoch → positions index

`_registerWeight` already computes `first` and `last` for every position. Push
the id into `epochPositions[e]` for `e` in `first..last`. The range is bounded by
`maxTerm / EPOCH` = **12** entries.

`allocateEpoch` then iterates `epochPositions[epochN]` — only positions that
actually qualify — from a stored resume cursor, up to a bounded count per call.

**Correct under extensions by construction.** `applyExtensionIfMatured` calls
`_unregisterWeight` then `_registerWeight`, so the new range is indexed the same
way. The new term begins at the old end, so ranges never overlap and no position
is indexed twice for one epoch.

**Cost:** up to 12 array pushes per registration. Cold `SSTORE` dominates, so
`createPosition` becomes materially more expensive — this is the trade and it
should be measured before adoption, not estimated.

**Stale entries.** A withdrawn position remains in the array. The loop must skip
it — which is also what preserves the forfeit rule (§4.5).

**Assessment: viable.** Cost moves from allocation to registration, paid once per
position rather than once per position per epoch forever.

---

## 7 · The batching hazard

Under any resumable design, `withdrawPosition` may be called between batches. A
position in an unprocessed batch would be skipped; one already processed keeps
its credit. Same epoch, different outcome depending on batch position.

That violates invariant 4 while remaining consistent with invariant 5 — the
forfeit rule is intentional, but it is supposed to depend on *whether* the epoch
was allocated, not on *which batch* the position landed in.

Two candidate resolutions, neither proposed here:

- **Freeze eligibility at close.** Snapshot the qualifying set when
  `ep.totalWeight` is frozen. Batching then cannot change membership. Costs
  storage; aligns with §10.3, which states that scheduled timestamps control
  eligibility even if finalization is delayed.
- **Block withdrawal while an allocation is in progress.** Cheaper; introduces a
  window in which a matured position cannot be withdrawn, which needs checking
  against VF-STK-030.

**This must be decided before implementation.** It is the only part of CL-09
that is not purely mechanical.

---

## 8 · Regression obligations

The existing `06_scaling` `allocateEpoch` case measures nothing and must be
rebuilt. A correct harness requires all three of:

1. A non-zero reward basis — record a real RAC; `deployStakeOnly` cannot.
2. Positions satisfying §10.3 — existing before the epoch opens and surviving
   through the scheduled end of N+1. Positions seeded after launch never qualify
   for epoch 1, which is why measurement only works against epoch 2 onward.
3. Chronological closure — VF-STK-010 and VF-STK-013 require closing in order
   and only after epoch N+1 ends.

New coverage required:

- Gas bounded and flat as `nextPositionId` grows.
- Identical credits for a 1-batch and an n-batch allocation of the same epoch.
- An extended position still credited after `applyExtensionIfMatured`.
- Forfeit preserved: withdrawal before allocation still yields zero.
- Dust behaviour unchanged (CL-87): complete reward minted, remainder stranded.

---

## 9 · Recommendation

Mechanism B, subject to two things that are not decided here: the measured cost
of 12 pushes at registration, and the §7 resolution. Mechanism A is rejected on
the extension defect.

**Open question for the owner, and the only one:** should eligibility be frozen
at close, or withdrawal blocked during allocation? Everything else follows.
