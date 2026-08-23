# Presentation Map B — Participation Lifecycle

**Derived from:** Master Specification Revision 6, hash
`5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9`
**Companion to:** `PRESENTATION_MAP_v2.md` (Commitment Lifecycle, §3.2)

> **Information architecture artifact, not a governing document.**

## Markings

| Marking | Meaning |
|---|---|
| **[SPEC]** | Stated in Master Specification Revision 6. |
| **[REV7]** | Proposed in `REVISION_7_CANDIDATE_AMENDMENTS.md`. Not governing. |
| **[DESIGN]** | A product decision. |
| **[OPEN]** | A product decision deliberately not yet made. |

---

## A structural difference from Map A — read this first

**§3.2 enumerates its eight steps explicitly. §10 does not.**

§10 is six topical subsections — Weight, Epochs, Eligibility, Claims and
Withdrawals, Extensions, Rounding and Terminal State. A participant lifecycle
can be derived from the dependencies between its requirements, but **the
specification does not state that ordering.**

Therefore: **every requirement below is `[SPEC]`. The sequence they are
arranged in is `[DESIGN]`.** Map A's step order is specification-stated; Map
B's is a faithful derivation. That difference must not be lost.

Where the specification does fix order, it is marked: VF-STK-010 requires
epochs be finalized chronologically; VF-STK-013 fixes entitlement only after
the scheduled end of the following epoch.

---

## Scope boundary

Map A ends at Step 8 — principal released. **Map B begins at holding**, which
Map A's Step 7 produces.

Map B covers: holding an issued token, staking it, earning across epochs,
claiming, extending, withdrawing, and the protocol's terminal state.

Map B does **not** cover the Commitment Vault Lock. §9's Reward-Accounting
Credit is created at fee verification and belongs to Map A, not here —
though the Epoch Reward Basis it produces is Map B's input.

---

# Cross-cutting overlays

Map A's overlays O1 (absence of control), O2 (fail-closed), O3 (verification
and traceability), O4 (supply accounting) apply here unchanged. Three
additional overlays are specific to participation.

## P1 · Epoch timing integrity — §10.2

**[SPEC]** Protocol launch defines T0. Epoch N is the half-open interval from
T0 + (N−1)×10 days to T0 + N×10 days. **Activity at the exact ending timestamp
belongs to the following epoch.** Every epoch is exactly 10 days (VF-STK-006).

**Anyone may submit the transaction that finalizes an epoch** after its
scheduled ending timestamp (VF-STK-008). Delayed finalization does not shift,
lengthen, shorten or reset any boundary (VF-STK-009). Pending epochs must be
finalized in chronological order (VF-STK-010).

**Spans:** every earning and allocation step.

**Note.** Finalization is permissionless, exactly as proof submission is in
Map A. The same principle: **anyone may act, and it changes nothing about the
outcome.**

**Evidence.** T0 and every boundary are computable by anyone. Finalization
transactions are public.

## P2 · Rounding and inaccessible remainder — §10.6

**[SPEC]** Each position's share is calculated at 18-decimal VCLM precision
and rounds down to the nearest base unit (VF-STK-026). The resulting
microscopic remainder **remains inaccessible in the immutable Treasury Reward
Stake contract and is not carried, redirected, or reused** (VF-STK-027).

**Spans:** allocation and claiming.

**Note.** This is a disclosure, not a defect. The remainder is unreachable by
design because no party has authority to reach it.

## P3 · Terminal state — §10.6

**[SPEC]** If a complete epoch reward exceeds remaining VCLM lifetime
capacity, the epoch **mints nothing**, closes, and marks its credits used.
**Partial epoch minting is prohibited** (VF-STK-028).

When remaining capacity reaches zero, Treasury Reward Stake **permanently
closes to new positions and extensions** (VF-STK-029). All existing staked
tokens become **immediately withdrawable**, and accumulated claimable rewards
remain available (VF-STK-030).

**Spans:** position creation, extension, allocation, withdrawal.

**Note.** The protocol has a defined end state, and at that end participants
retain everything they hold. Nothing is stranded.

---

# The lifecycle

**Ordering is `[DESIGN]`, derived from requirement dependencies. Every
requirement cited is `[SPEC]`.**

## Stage 1 — Holding

**[SPEC] Protocol action.** VCLM, CHONX and SYNTH are transferable.
VF-TOK-013: the protocol imposes **no transfer tax, allowlist, denylist,
administrator freeze, or protocol-level trading restriction.** VF-TOK-014: an
external market does not alter issuance, supply, reward, activation, or lock
rules. VF-TOK-015: **no exchange listing, liquidity level, market price,
redemption value, or appreciation is guaranteed.**

**[SPEC] Acquisition paths.** Issuance from a Commitment Vault Lock (Map A
Step 7); Treasury Reward Stake rewards, which are paid **only in newly minted
VCLM** (VF-STK-004); the SYNTH Forge; external markets.

**[SPEC] SYNTH Forge.** SYNTH is never a Commitment Vault Lock output and is
forged **only through the one-way destruction of both lower-tier tokens** —
1,000 VCLM and 10,000 CHONX per SYNTH. **The Forge is one-way and has no
reversal, redemption, or administrative restoration path** (VF-TOK-005).
Available after 100,000,000 cumulative lifetime CHONX issuance.

**[SPEC] Portability.** §11.4 permits moving an issued token to another chain
via Axelar ITS. VF-XCH-021: transport is not issuance — it does not increase
cumulative lifetime issuance or restore capacity. VF-XCH-019: no independent
or separately issued supply may be created on another chain.

**[DESIGN]** How the four acquisition paths are presented; whether the Forge
is framed as a conversion or a milestone.

**Evidence.** Token balances, transfers, forge transactions and interchain
transfers are all public on-chain. Cumulative CHONX issuance determines Forge
availability and is readable.

**Surface.** Portfolio (app) · Token statistics (public) · Forge (app,
gated) · Portability (app) · Market disclosures (Domain 10)

## Stage 2 — Position creation

**[SPEC] Protocol action.** Treasury Reward Stake is **separate from
Commitment Vault Locks and active from protocol launch** — it does not depend
on CHONX activation (VF-STK-001). Only VCLM, CHONX and SYNTH may be staked
(VF-STK-002). A position must contain a **positive nonzero amount; no
additional minimum applies** (VF-STK-031).

**Weight = staked amount × token multiplier × staking-duration multiplier.**
Only the multipliers listed in §10.1 apply; no others (VF-STK-003).

**[SPEC]** S1, S2 and S3 classifications and **acquisition history never
affect Weight** (VF-STK-005). A token earned as a reward stakes identically to
one bought on an exchange.

**[SPEC]** Rewards are paid **only in newly minted VCLM** (VF-STK-004),
regardless of which token is staked.

**[SPEC] Terminal-state constraint.** At zero remaining capacity, no new
position may be created (VF-STK-029, overlay P3).

**[DESIGN]** Token and duration selection; weight preview.

**Evidence.** Multipliers are fixed in an immutable contract. Weight is
computable by anyone from public position data.

**Surface.** Stake workflow (app) · Multiplier reference (docs) · Weight
calculator (`[DESIGN]`)

## Stage 3 — Earning across epochs

**[SPEC] Protocol action — the eligibility rule is strict.** A position
earning for epoch N must be **active at the exact beginning of N, remain
continuously active through N, and remain active through the scheduled end of
N+1.** The scheduled timestamp controls even if finalization is delayed.

VF-STK-011: a position beginning after an earning epoch starts does not
qualify for it. VF-STK-012: a position expiring before the scheduled end of
the following epoch does not qualify for the earlier epoch's reward.

**Rewards are processed one epoch behind.**

**[SPEC] The reward pool.** Epoch Reward VCLM = Epoch Reward Basis ÷ $0.10,
using the **permanent $0.10 Reward Reference Value, not an oracle or market
price** (VF-RAC-005). The Basis is the sum of Reward-Accounting Credits
recorded in that epoch — produced by Map A's commitment fees.

**[DESIGN]** How the one-epoch-behind rule and the two-epoch activity
requirement are made comprehensible. **This is the least intuitive rule in the
protocol** and the most likely to be misunderstood.

**Evidence.** Epoch boundaries computable from T0. Position start and end
timestamps are on-chain. Eligibility is independently determinable.

**Surface.** Position status with eligibility state (app) · Epoch schedule
(dashboard) · Eligibility rules (docs)

## Stage 4 — Epoch finalization and allocation

**[SPEC] Protocol action.** After an epoch's scheduled end, anyone may
finalize it (VF-STK-008), in chronological order (VF-STK-010). An entitlement
for epoch N becomes **fixed and allocatable after the scheduled end of epoch
N+1** (VF-STK-013).

**The complete Epoch Reward VCLM is minted once to the immutable Treasury
Reward Stake contract, and proportional position entitlements are then
recorded** (VF-STK-014).

**[SPEC] Zero-weight epochs.** An epoch with zero eligible Weight **mints no
VCLM, closes, marks its credits used, and carries no value forward**
(VF-STK-015). Nothing accumulates for a later epoch.

**[SPEC] Capacity-exceeded epochs.** See overlay P3 — mints nothing, closes,
marks credits used, no partial minting.

**[DESIGN]** Whether the application offers finalization, or only observes it.

**Evidence.** Finalization and minting transactions are public. Entitlement
records are on-chain. The full calculation is reproducible from public data.

**Surface.** Epoch status (dashboard) · Your entitlements (app) · Allocation
history (dashboard)

## Stage 5 — Claiming

**[SPEC] Protocol action.** Recorded claimable VCLM **accumulates and never
expires** (VF-STK-016). A user may claim **all currently accumulated VCLM in
one transaction** (VF-STK-017).

**Claims transfer already-minted VCLM. They do not mint again, recalculate
rewards, or consume additional lifetime capacity** (VF-STK-018). Claims may be
paid **only to the position owner or the reward destination bound to the
position** (VF-STK-019).

**[DESIGN]** Claim presentation; whether accumulated-but-unclaimed is
surfaced prominently. **The user owns remembering** — consistent with Map A
Step 8.

**Evidence.** Claimable balances and claim transactions are on-chain.

**Surface.** Claim workflow (app) · Accumulated rewards (app) · Claim history
(app)

## Stage 6 — Extension

**[SPEC] Protocol action.** While a position is active, its user may queue
**one** future term of 30, 60, 90 or 120 days (VF-STK-021). The queued term
begins at the scheduled end of the current term, and **the current multiplier
remains unchanged until then** (VF-STK-022). Only one future term may be
queued at a time; after it begins, another may be queued (VF-STK-023).

**An extension adds or removes no tokens and charges no fee** (VF-STK-024).

**[SPEC] The gap rule.** Without a queued extension, the position becomes
inactive at maturity, and **an expired position cannot retroactively cover an
inactivity gap** (VF-STK-025). Combined with Stage 3's continuity requirement,
a lapse forfeits eligibility that cannot be recovered.

**[SPEC] Terminal-state constraint.** At zero remaining capacity, extensions
are permanently closed (VF-STK-029).

**[DESIGN]** How the consequence of not extending is communicated before
maturity, given the gap rule's irreversibility.

**Evidence.** Queued terms and position state are on-chain.

**Surface.** Extension workflow (app) · Position timeline (app) · Extension
rules (docs)

## Stage 7 — Withdrawal

**[SPEC] Protocol action.** **Withdrawal of matured staked tokens does not
erase accumulated claimable VCLM** (VF-STK-020). The two are independent.

**[SPEC] Terminal state.** At zero remaining capacity, all existing staked
tokens become **immediately withdrawable** and accumulated claimable rewards
remain available (VF-STK-030).

**[DESIGN]** Withdrawal presentation; making the independence of withdrawal
and claiming clear.

**Evidence.** Withdrawal transactions are public. Claimable balance is
readable before and after.

**Surface.** Withdrawal workflow (app) · Position history (app)

---

# What the derivation surfaces

**Permissionless finalization mirrors permissionless proof submission.**
VF-STK-008 and VF-XCH-012 express the same principle in different lifecycles:
anyone may act, and no actor gains authority by acting. That is one story
across both maps.

**Rewards use a fixed $0.10 reference, never a market price.** VF-RAC-005.
Reward calculation is entirely independent of oracle behaviour — unlike
commitment valuation, which depends on it.

**The eligibility rule is the protocol's least intuitive.** Active at the
exact start of N, continuous through N, still active at the scheduled end of
N+1. Combined with VF-STK-025's no-retroactive-cover rule, a participant can
lose an earned entitlement by letting a position lapse one day early.

**Acquisition history is irrelevant to Weight.** VF-STK-005 — a token bought
on an exchange stakes identically to one earned. This is a fairness property
worth stating plainly.

**The protocol has a defined end, and it ends safely.** At terminal state,
staking closes but everything held remains withdrawable and claimable.

---

# Open product decisions

Numbered continuing from Map A's seven.

| # | Decision | Affects |
|---|---|---|
| 8 | Whether the application offers epoch finalization or only observes it | Stage 4 |
| 9 | How the one-epoch-behind eligibility rule is made comprehensible | Stage 3 — highest misunderstanding risk |
| 10 | How the extension gap rule is communicated before maturity | Stage 6 — irreversible consequence |
| 11 | Whether the SYNTH Forge is framed as a conversion or a milestone | Stage 1 |
| 12 | How the inaccessible rounding remainder is disclosed | Overlay P2 |
| 13 | Whether terminal state is presented before it is reached | Overlay P3 |
