# Remaining Critical Findings — Implementation Mapping
## 2026-08-07 · baseline 43 passing tests

**Open Criticals: 4** (CL-06, CL-09, CL-11, CL-12)
**New findings from the CL-01 review: 3** (CL-37, CL-38, CL-39)

---

## SUMMARY TABLE

| ID | Contracts | Effort | Regression risk | New tests |
|---|---|---|---|---|
| CL-11 | Verifier | Low — 1 hr | Low | 4 |
| CL-12 | Verifier | Low — 1 hr | Low | 4 |
| CL-06 | Verifier + Stake | Medium — 2–3 hr | **Medium** | 5 |
| CL-09 | Stake | **High — design change** | **High** | 6 |
| CL-37 | Verifier | Low, once decided | Low | 3 |
| CL-38 | Verifier | Medium — needs a decision | **High if changed late** | 4 |
| CL-39 | Verifier | Trivial — 10 min | None | 1 |

**Recommended order: CL-11 → CL-12 → CL-39 → CL-37 → CL-06 → CL-38 → CL-09.**
Cheapest first, highest-risk last, so the difficult work happens against a suite that is already dense.

---

## CL-11 · Handshake allowance read from a caller-controlled field

**Requirements:** VF-COM-006 (allowance determined by the actual selected source mechanism), VF-COM-007 (fourth qualifying attempt rejected on a three-use mechanism)
**Contract:** `VinculumFinalisVerifier.sol` only
**Effort:** Low. Roughly one hour.

`pkg.handshakeAllowanceCount` is supplied by the caller; the code branches on `== 1` and skips the check entirely for any other value. The three-use branch was never implemented.

**Shape of the fix.** The same principle that closed CL-01: the allowance must be a property of the environment, not an assertion in the package. Register the allowance per environment during the deployment ceremony, alongside the chain verifier. Count consumed handshakes per `handshakeIdentity` and reject beyond the registered allowance.

**Regression risk: Low.** Self-contained, and no existing test asserts the current behaviour.

**New tests (4):** allowance derived from environment not package · fourth handshake rejected on a three-use mechanism · second rejected on a single-use mechanism · caller-asserted count ignored entirely.

**Note:** the Cosmos vault already has `positive_three_handshakes_then_fourth_rejected_atomically()`. Mirror its structure.

---

## CL-12 · Dev Fund enforcement exists only as commented-out text

**Requirement:** VF-FEE-009
**Contract:** `VinculumFinalisVerifier.sol` only
**Effort:** Low. Roughly one hour, but see the open question.

The `require` is present as a comment with `// In simulation: skip (deployment pending)`. `pkg.devFundDestination` and `pkg.feeTransferEvidence` are declared and never validated.

**Open question that must be settled first.** `configureDevFund` stores a destination per environment. Enforcement means checking `pkg.devFundDestination` against it — but `feeTransferEvidence` is a source-chain transaction hash, and this contract cannot verify a foreign-chain transfer. So enforcement is either (a) destination-matching only, with the transfer attested by the chain verifier, or (b) full evidence validation delegated to the chain verifier interface. **(a) is achievable now; (b) is a chain-verifier change and belongs with the CL-27 work.**

**Regression risk: Low** for (a). Medium for (b) — it changes `IChainVerifier`.

**New tests (4):** unconfigured destination rejects issuance · mismatched destination rejects · matching destination proceeds · zero evidence hash rejected.

---

## CL-39 · A single signed batch can permanently brick price updates

**Requirement:** VF-IMM-005 (dependency failure must not create an unrecoverable state), VF-IMM-006
**Contract:** `VinculumFinalisVerifier.sol`
**Effort:** Trivial. Ten minutes.
**Found:** during review of the CL-01 implementation, 2026-08-07.

`latestPriceRunId` is a monotonic watermark with no upper bound. A batch signed with `runId` near `2^64 - 1` sets the watermark there permanently; no later batch can satisfy `runId > latestPriceRunId`. Prices freeze forever, with no admin path.

Not an attacker path — only the publisher can sign. It is a fat-finger and tooling-defect path, and under VF-IMM-006 the consequence is permanent.

**Fix.** Bound the forward jump: `require(runId <= latestPriceRunId + MAX_RUN_ADVANCE)`. At two runs per day, an advance cap of 1,000 tolerates well over a year of missed runs while making the brick unreachable.

**Regression risk: None.** Purely additive constraint.

**New tests (1):** a run far beyond the permitted advance is rejected.

---

## CL-37 · No staleness bound on accepted price records

**Requirements:** VF-IMM-005 (failure of an external dependency must prevent unsafe new issuance) **in tension with** VF-ORC-008 (a successful record remains applicable until the next scheduled run)
**Contract:** `VinculumFinalisVerifier.sol`
**Effort:** Low once the question is decided. The decision is the work.
**Found:** during review of the CL-01 implementation, 2026-08-07.

There is no maximum age on a price record. The only temporal check is that `fetchTimestamp` is not in the future. If the price publisher stops running, the last record stays `available` indefinitely and issuance continues against a price of arbitrary age.

**This is a specification question, not an implementation preference.**

- VF-ORC-001 establishes twice-daily runs.
- VF-ORC-008 states a record remains applicable *until the next scheduled run* — read literally, no expiry.
- VF-IMM-005 requires that external dependency failure prevent unsafe new issuance. A publisher outage is precisely such a failure.

These do not reconcile. Either VF-ORC-008 implies a bound that is not stated, or VF-IMM-005 does not treat the price path as an external dependency. **This should go to Revision 7 as a stated maximum record age**, after which issuance fails closed while Commitment Vault principal release remains unaffected — which is what VF-IMM-005 actually asks for.

**Recommendation, not a decision:** a bound in the range of 48 to 72 hours tolerates several consecutive missed runs without permitting week-old pricing. **Do not let me pick the number.**

**Regression risk: Low.** One additional `require` in `_verifiedGrossUsdMicro`.

**New tests (3):** issuance rejects a record older than the bound · issuance proceeds within the bound · principal release is unaffected by a stale price (VF-IMM-005's second limb).

---

## CL-38 · Single price publisher key with no rotation or recovery

**Requirements:** §7.2 (production signing configuration is a deployment deliverable), VF-SEC-005, VF-IMM-006
**Contract:** `VinculumFinalisVerifier.sol`
**Effort:** Medium. The decision is the work; the implementation follows quickly.
**Found:** during review of the CL-01 implementation, 2026-08-07.

`pricePublisher` is a single immutable address. Compromise of that key permits an attacker to sign arbitrary prices for the life of the protocol. VF-IMM-006 forecloses any repair.

**This is permitted by the specification** — §7.2 defers production signing configuration to deployment deliverables. It is not a spec violation. It is an undocumented single point of failure that an auditor will raise immediately.

**Options.**

1. **Accept single-key risk, document it explicitly.** Cheapest. Requires a written statement in the deployment record and public disclosure. Defensible only if key custody is genuinely hardened.
2. **Fixed publisher set with M-of-N threshold.** Constructor takes N immutable keys; a batch requires M valid signatures. No rotation, but no single point of compromise. Moderate implementation cost, and it must be decided **before** deployment because the key set is immutable.
3. **Rotation via an immutable successor rule.** Materially more complex and risks reintroducing exactly the authority VF-IMM-001 forbids. Not recommended.

**Regression risk: High if changed late.** Option 2 alters the constructor and the batch-verification path, and everything built on top of the current single-key assumption would move. **If option 2 is wanted, do it before CL-06 and CL-09, not after.**

**New tests (4):** M valid signatures accepted · M−1 rejected · duplicate signature from one key does not count twice · signature from a non-member rejected.

---

## CL-06 · `rewardBasis` never assigned

**Requirement:** VF-RAC-004 (Epoch Reward Basis is the sum of credits assigned to that epoch)
**Contracts:** `VinculumFinalisStake.sol` **and** `VinculumFinalisVerifier.sol`
**Effort:** Medium. Two to three hours.

Solidity only — the JS layer assigns it correctly. `closeEpoch` contains a comment where the assignment should be, so `allocateEpoch` always takes the zero-eligible branch and no reward is ever paid.

**Why it is not trivial.** The Verifier accumulates RAC credits per identity in `racCredits` / `racEpoch`. Stake needs the *sum per epoch*, which the Verifier does not currently maintain. Either the Verifier keeps a running per-epoch total, or Stake iterates — and iteration is the CL-09 mistake repeated.

**Do the running-total version.** It is the same structural fix CL-09 needs, and doing it here first makes CL-09 smaller.

**Regression risk: Medium.** Touches the epoch boundary in both contracts, and both now depend on `launchTimestamp` agreeing between them — currently two separate constructor arguments with no cross-check. **Add an assertion that they match.**

**New tests (5):** reward basis equals the sum of epoch credits · basis is zero for an epoch with no credits · credits land in the epoch of their fee verification · reward mints only when basis is non-zero · Stake and Verifier agree on epoch boundaries.

---

## CL-09 · Unbounded loops brick epoch processing permanently

**Requirements:** VF-STK-010 (chronological finalization), VF-IMM-006
**Contract:** `VinculumFinalisStake.sol`
**Effort:** High. This is a design change, not a patch. Half a day, realistically.

`closeEpoch` and `allocateEpoch` iterate every position ever created, including withdrawn ones. Once that exceeds the block gas limit both become uncallable; chronological ordering then freezes the reward system permanently with no repair path. **The protocol breaks precisely when it succeeds.**

**Two viable designs.**

**A — Running totals.** Maintain `epochTotalWeight` incrementally as positions are created, extended, and withdrawn. `closeEpoch` becomes O(1). Cleanest outcome; requires every state transition affecting weight to update the total correctly, and a missed path silently corrupts rewards.

**B — Paginated finalization.** `closeEpoch(epochN, startIndex, count)` processes a bounded slice, with completion tracked per epoch. Simpler to reason about, more calls, and needs a guard so a partially-finalized epoch cannot be allocated.

**Recommendation: A**, with B as fallback if the state-transition surface proves larger than expected. A is also what CL-06 wants.

**Regression risk: High.** Rewrites the core accounting of the staking contract. Every existing staking test must still pass unchanged — treat that as the acceptance criterion.

**New tests (6):** `closeEpoch` gas bounded at 10,000 positions · running total matches a brute-force sum over a randomized position set · withdrawal decrements the total · extension updates it · total is correct across an epoch boundary · full existing suite unchanged.

---

## SEQUENCING NOTE

CL-38 is the ordering constraint. If a multi-key publisher set is wanted, it changes the constructor and the verification path, and doing it after CL-06 and CL-09 means reworking code built on the single-key assumption.

**Settle CL-38 before starting CL-06.** The decision costs minutes; discovering it late costs hours.
