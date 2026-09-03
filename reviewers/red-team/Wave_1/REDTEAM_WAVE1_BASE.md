# Vinculum Red Team — Wave 1 · Base Only

**Tree:** `github.com/VinculumDefi/Finalis-Launch` @ `redteam/prep` (`bff9190`)
**Scope:** `VinculumFinalisBaseVault`, `CommitmentLock`, `VinculumFinalisVerifier`, `BaseSameChainVerifier`, `vinculum-site/lock.html`, `vinculum-site/protocol.js`
**Out of scope for Wave 1:** every non-Base environment, stake, cap, SYNTH, tokens
**Method:** source review against Rev 6. No deployment. No mainnet.
**Date:** 30 August 2026

Finding shape per the agreed standard: attacker · precondition · action · impact · evidence · fix or accept. A finding that cannot name a file is not a finding.

---

> **Superseded architecturally by Wave 2 — read that before drawing conclusions.**
>
> `reviewers/red-team/Wave_2/WAVE_2_ARCHITECTURAL_ASSESSMENT.md` concludes that
> W1-01, W1-02, W1-05 and W1-09 are best understood as four observable
> consequences of a single architectural deficiency: the independently verified
> immutable facts available to the consumer do not match the evidence field set
> Rev 6 requires the consumer to validate.
>
> Wave 2 also narrows the remedy recorded below — six returned facts rather than
> seven, plus a Base-side valuation rule — and limits its scope to the EVM
> family and Solana.
>
> **This document is not amended to match.** It remains an accurate record of
> the investigation performed during Wave 1, including the reasoning that was
> later narrowed. Where it and Wave 2 differ on the remedy, Wave 2 governs.

---

## Summary

| ID | Severity | Title | Status |
|---|---|---|---|
| W1-01 | **Critical** | Mint package recipient and output token are not bound to the lock record | **Confirmed · reproduced** |
| W1-02 | **Critical** | Mint package asset identity is not bound — issuance inflation by substitution | **Confirmed · reproduced** |
| W1-03 | High | `ethers` still loaded without Subresource Integrity | Open |
| W1-04 | Medium | Verifier-side handshake allowance keyed on a caller-supplied string | **Half retracted · half open** |
| W1-05 | **Critical** | Verifier reprices the lock at mint time — VF-ORC-010 violation | **Confirmed · specification** |
| W1-09 | **Critical** | Emission rate taken from a caller-supplied Valuation Timestamp — VF-ORC-011 violation | **Confirmed · reproduced** |
| W1-06 | Medium | Rebasing assets are checked only at creation | Open |
| W1-07 | Low | Site performs no USD-bound preflight; guaranteed revert costs the user gas | Open |
| W1-08 | Low | Stray ETH sent to a native-asset clone is permanently stuck | Accept candidate |

**Checked and found sound:** six items, Section 3.

### Root cause — one gap, four findings

W1-01, W1-02, W1-05 and W1-09 are four consequences of one defect:

> **`IChainVerifier.extractFacts` returns 7 facts. VF-XCH-011 requires evidence
> to bind 19.** Every omitted field is accepted from the caller instead.

`VinculumFinalisVerifier.sol:810` cites VF-XCH-011 by name in its own comment,
then cross-checks five of the nineteen.

VF-XCH-005 requires the *source mechanism* to bind user, release destination,
asset, amount, creation timestamp and maturity — in all seventeen environments.
Whether a UTXO or XRPL vault does so is therefore a conformance test against each
native vault, not an open specification question.

**Field set required to close all four — corrected in Wave 2.** Six returned
facts, not seven: `canonicalAssetId`, `baseRecipient`, `releaseDestination`,
`outputToken`, `creationTimestamp`, `maturityTimestamp`.

`verifiedGrossUsd` **cannot** be a returned fact. `VinculumFinalisEvmVault`
computes no USD value — valuation lives on Base under VF-ORC-007 — so no source
event carries it. W1-05 closes instead by a Base-side rule: select the price
record at the Valuation Timestamp rather than recomputing from the current one.
See `reviewers/red-team/Wave_2/WAVE_2_ARCHITECTURAL_ASSESSMENT.md` §4.3.

---

### Reproduction — W1-01 and W1-02

Both criticals are reproduced by an executed test, not by argument.

**Test:** `base-contracts/test/25_w1_identity_binding.test.cjs`
**Run:** `npx hardhat test test/25_w1_identity_binding.test.cjs`
**Tree:** `redteam/prep` @ `bff9190`
**Result:** 8 failing, 1 passing. The six failures are the finding. The single
pass is the control, which proves the honest path still mints correctly and the
six are therefore the defect rather than a broken fixture.

```
W1-01b   reverted: false
         locker received:   0.0 VCLM
         attacker received: 1150.0 VCLM
         lock consumed:     true

W1-02b   reverted: false
         honest mint:     1150.0 VCLM
         substituted:     1150000.0 VCLM
         inflation ratio: 100000%
```

**Independently reproduced.** First run in a Linux review sandbox; second run by
the project owner on Windows 10, Node/npm installed fresh, no shared state.
Identical output both times. A finding reproduced on two machines by two parties
is a different class of evidence from one reproduced by whoever wrote it.

**W1-01c is worth reading closely.** It fails with `VF-COM-025: CHONX not
activated` — an unrelated guard that happens to stand in front of the missing
binding. A test written as a bare `.to.be.reverted` would have passed and
recorded the hole as closed. The helper matches on the revert reason for
exactly this reason.

**Full suite at the same commit:** 293 passing, 8 failing. The tree was
292 passing / 0 failing before this file was added.

---

---

## 1 · Critical findings

### W1-01 · Mint package recipient and output token are not bound to the lock record

**Attacker.** Any address with gas. Not the locker, not a relayer, not privileged.

**Precondition.** Vault and verifier finalized. A victim has created a Commitment Vault Lock on Base and has not yet called the mint path. Price record fresh. Nothing else.

**Action.**
1. Watch for the `CommitVaultLock` event, or poll — `getLock(bytes32)` is a public view.
2. Read the victim's lock record.
3. Build the `ProofPackage` exactly as `protocol.js: packageFromLock` does, from the victim's record, with two fields changed: `baseRecipient` set to the attacker's address, and optionally `selectedOutputToken` changed.
4. Call `recordFeeAndRac(pkg)`, then `verifyAndMint(pkg)`.

Both entrypoints are `external onlyWhenFinalized` — permissionless.

**Why it passes.** `verifyAndMint` cross-checks the package against `verifier.extractFacts()` at `VinculumFinalisVerifier.sol:817–829`. The comparison covers exactly five values:

```
extLockId == pkg.commitmentVaultLockId
extGross     == pkg.grossAmountSmallestUnits
extFee       == pkg.actualFeeAmountSmallestUnits
extPrincipal == pkg.principalAmountSmallestUnits
extDuration  == pkg.durationSecs
```

All five come from vault storage, so all five match — the attacker read them from the same place. `baseRecipient` is checked only for nonzero at line 773 (`VF-ARC-006: zero base recipient`). It is never compared to `r.baseRecipient`. `selectedOutputToken` is checked only `<= 1` at line 743. It is never compared to `r.outputToken`.

The mint then executes to the package's value, not the record's:

```solidity
vclmToken.mint(pkg.baseRecipient, issuanceAmount);   // line 857
chonxToken.mint(pkg.baseRecipient, issuanceAmount);  // line 868
```

`consumedLocks[lockIdHash] = true` at line 872. The victim can now never mint their own lock.

**Root cause.** `IChainVerifier.extractFacts` returns seven values and none of them is an identity field. `BaseSameChainVerifier.extractFacts` (`chain-verifiers/BaseSameChainVerifier.sol:114–140`) reads `r.baseRecipient`, `r.releaseDestination`, `r.outputToken` and `r.canonicalAssetId` into memory and returns none of them. The consumer cannot cross-check what the interface does not hand it.

The verifier's own header comment states the design intent correctly — *the caller supplies a pointer; the chain supplies the facts* — and the numeric facts honour it. The identity facts do not.

**Impact.** Complete theft of issuance. The victim's principal is safe: it sits in the `CommitmentLock` clone with `releaseDestination` bound at initialization and unreachable by the attacker (see 3.1). But the entire VCLM or CHONX output goes to the attacker, and the lock is consumed so the victim has no second attempt. The victim has paid a non-refundable fee and locked principal for up to ten years in exchange for nothing.

Every lock on Base is exposed from the moment it is created until it is minted. The window is whatever the honest user's delay is, and the site's own flow makes that window wide — `lock.html` requires the user to manually paste the lock id into `mintLockId` and press a second button.

**Violates.** VF-ARC-006 (recipient bound at creation), VF-COM-020 (one output token, bound), VF-XCH-011 (the cross-check this defeats).

**Fix.** Extend `IChainVerifier.extractFacts` to return the identity fields, have `BaseSameChainVerifier` return them from vault storage, and require equality in `verifyAndMint` for `baseRecipient`, `selectedOutputToken`, `canonicalAssetId`, `valuationTimestamp` and `maturityTimestamp`. Every other chain verifier implementing the interface must return them too, or return a sentinel the consumer treats as failure.

Interface change, not a `require` bolted onto the consumer. Adding the check only in `VinculumFinalisVerifier` would leave the same hole open for every future verifier.

**Missing test.** No test in the suite constructs a valid package for a real lock with a tampered identity field. `10_cl76_forged_package.test.cjs` covers the adjacent-but-different case — an unprivileged caller with *no lock on any chain*, an invented block, a repeated forged handshake. `13_base_e2e.test.cjs:155` builds the package with `baseRecipient: r.baseRecipient`, straight from the record.

Add: *real lock, package identical except `baseRecipient`, must revert.* Then the same for `selectedOutputToken` and `canonicalAssetId`.

---

### W1-02 · Mint package asset identity is not bound — issuance inflation by substitution

**Attacker.** Any address with gas, including the locker.

**Precondition.** Two assets registered in `assetPrecisionTable` for environment `base` that share a decimal count and differ in price. Both have fresh price records.

**Action.** Create a legitimate lock in the cheap asset. Build the package from the real record, changing `canonicalAssetId` to the expensive asset and `assetPrecision` to that asset's decimals. Call `recordFeeAndRac`, then `verifyAndMint`.

**Why it passes.** The gross unit count is cross-checked and correct — it comes from vault storage. But the *valuation* of those units is computed entirely from package-supplied identity:

```solidity
// VinculumFinalisVerifier.sol:500–516
PriceRecord storage pr = priceRecords[pkg.canonicalAssetId];
...
return (pkg.grossAmountSmallestUnits * pr.priceUsdMicro * 1e12)
       / (10 ** _registeredPrecision(pkg));
```

The registry lookup at line 713 keys on `pkg.canonicalAssetId`, so `entry` is also the attacker's chosen asset. Line 716 checks `entry.decimals == pkg.assetPrecision` — which proves only that two attacker-supplied values agree with each other, not that either matches the locked asset.

`entry.custodyClass` then feeds `_computeIssuance` at line 833, so the attacker additionally selects the classification multiplier — S1 at 1.5× rather than the locked asset's S3 at 1.0×.

**Impact.** Issuance inflated by the full price ratio between the two assets, multiplied by up to 1.5× from the classification swap. Lifetime VCLM capacity is consumed by mints with no matching committed value behind them. This is worse than W1-01: W1-01 redirects a correct amount, W1-02 fabricates the amount.

Note the interaction. Step 6 checks `verifiedGrossUsdMicro >= STANDARD_USD_MIN` — computed from the substituted asset. So substitution also lets a sub-$10 lock clear the minimum, and lets a lock outside $0.95–$1.05 clear the handshake band.

**Violates.** VF-REG-001, VF-COM-018, VF-ORC-012, VF-SUP-004.

**Fix.** Same interface change as W1-01. `canonicalAssetId` must come from vault storage, and `assetPrecision` and `custodyClass` must be derived from the registry entry for *that* id, never from the package.

**Missing test.** *Lock asset A, submit package claiming asset B, must revert.* Then: *claim an asset with a different custody class, must revert.*

---

## 2 · Remaining findings

### W1-03 · `ethers` still loaded without Subresource Integrity — High

**Attacker.** Anyone who can serve a modified file from `cdn.jsdelivr.net`: a CDN compromise, a hijacked npm publish, or a network-position attacker against a user without HSTS-pinned DNS.

**Evidence.** `vinculum-site/lock.html:12`

```html
<script src="https://cdn.jsdelivr.net/npm/ethers@6.13.5/dist/ethers.umd.min.js" crossorigin="anonymous"></script>
```

`crossorigin="anonymous"` was added since the last review. It provides no integrity guarantee on its own — it enables the CORS mode that SRI *requires*, and it surfaces full error details. Without an `integrity` attribute there is no hash to check the delivered bytes against.

**Impact.** The substituted script runs with full DOM and wallet access on the only page that builds and broadcasts transactions. It can rewrite `baseRecipient`, rewrite `releaseDestination`, or replace the transaction entirely while the interface continues to display the user's intended values. The user signs what they were shown; the wallet broadcasts something else.

**Fix.** Vendor `ethers.umd.min.js` into the site directory. If it must stay remote, add `integrity="sha384-…"` computed from the exact file. A protocol whose thesis is independence from operators should not depend on a third party at the moment of signature.

**Missing test.** Not unit-testable. Add to the launch checklist as a blocking item, and to `LAUNCH.md` step 6.

---

### W1-04 · Verifier-side handshake allowance keyed on a caller-supplied string — Medium

**Evidence.** `VinculumFinalisVerifier.sol:764`

```solidity
bytes32 handshakeKey = keccak256(abi.encodePacked(pkg.handshakeIdentity));
```

`pkg.handshakeIdentity` is a free `string` in the package. `protocol.js: packageFromLock` builds it as `"base:" + sourceAccount.toLowerCase()`, but nothing on chain requires that form or ties it to `r.sourceAccount`.

**Mitigating.** The real gate is the vault, and it is sound.
`VinculumFinalisBaseVault.sol:292` checks `handshakeUsed[msg.sender] >= HANDSHAKE_ALLOWANCE` before a handshake lock can be created, keyed on the actual caller with `HANDSHAKE_ALLOWANCE = 3`. That is correct for Base under VF-COM-006, and it cannot be bypassed by string choice. A fresh wallet earning a fresh allowance is explicitly permitted by VF-COM-005.

**Retraction — the allowance-count half of this finding is wrong.** Wave 1 v1 stated that `pkg.handshakeAllowanceCount` is caller-supplied and trusted. It is not. Two executed tests establish this and both predate Wave 1:

- `04_endtoend` — *"CL-11: the caller's asserted allowance count is ignored entirely."* Mints once against a package claiming an allowance of 99 where the registry says 1, then rejects the second with `VF-COM-007: handshake allowance exhausted`.
- `03_handshake` — *"the package field is no longer consulted anywhere in enforcement."*

The registry value governs. That half is closed and should never have been recorded as open. The error was writing the finding from a source read without checking whether the suite already covered it.

**Residual impact — this half stands.** `pkg.handshakeIdentity` remains a free `string` at `VinculumFinalisVerifier.sol:764`, never derived from the verified `sourceAccount`. An attacker minting their own legitimate lock can pass `handshakeIdentity = "base:0xVictim"`, incrementing the victim's verifier-side counter and corrupting `getHandshakeUsage()` for anyone reading it. No issuance is stolen and no allowance is fabricated; the vault still gates creation.

**Fix.** Derive `handshakeIdentity` on chain from the verified `sourceAccount` rather than accepting it. Covered by the same interface change as W1-01.

**Missing test.** *Mint lock A while claiming another account's handshake identity; `getHandshakeUsage` for that account must not move.* Not yet written.

---

### W1-05 · Verifier reprices the lock at mint time — Critical

**Reclassified.** Wave 1 v1 recorded this as Medium and as a design decision for
the owner. That was wrong. Rev 6 answers it outright and the entry should never
have been framed as a choice.

> **VF-ORC-010:** A proof delay or retry does not reprice the Commitment Vault
> Lock using a later market observation.

> **VF-XCH-009:** Confirmation and proof-delivery delays do not alter the
> original Valuation Timestamp, Commitment Vault Lock timestamp, maturity,
> selected output, recipient, or calculated issuance.

**Attacker.** None required. This fires against honest users through ordinary
price drift. It is a conformance defect, not an exploit.

**Precondition.** A lock is created while the price record is fresh. By the time
the mint package is submitted, the record has aged past `MAX_PRICE_RECORD_AGE`,
or the asset has been marked unavailable by a later batch, or the price has
moved enough that `verifiedGrossUsdMicro` now falls below `STANDARD_USD_MIN`.

**Evidence.** The vault computes and stores `verifiedGrossUsd` at creation —
`VinculumFinalisBaseVault.sol:285`. `verifyAndMint` discards it and recomputes
from the *current* price record — `VinculumFinalisVerifier.sol:701` →
`_verifiedGrossUsdMicro:500–516` — then re-applies the bound checks. Nothing
carries the creation-time valuation forward.

Twice-daily price refresh against a 48-hour staleness window makes the timing
window real rather than theoretical.

**Impact.** Two distinct harms. Issuance is calculated from a price the
specification says must not be used. And where the recomputed value falls out of
bounds, the fee is spent, the principal is locked for the full duration, and no
issuance ever occurs — making the §5.2.2 fail-safe an ordinary outcome driven by
price drift.

**Root cause.** The same as W1-01 and W1-02. `verifiedGrossUsd` exists in vault
storage and `IChainVerifier.extractFacts` does not return it, so the consumer has
no trustworthy path to it. Taking it from the package instead would recreate
W1-02 in a new place.

**Fix.** `verifiedGrossUsd` joins the returned fact set. Not a separate change.

**Missing test.** *Create a lock, advance time past the staleness window, mint,
and assert the issuance matches the creation-time valuation.*

---

### W1-09 · Emission rate taken from a caller-supplied Valuation Timestamp — Critical

**Attacker.** Any address with gas. Same reach as W1-01.

**Precondition.** Any real lock exists and has not yet minted. Emission has
decayed measurably since launch, so the protocol has been running for some time.
The defect is present from day one; its value to an attacker grows as decay
deepens.

**Action.** Build the package from the real lock as `protocol.js` does, then set
`valuationTimestamp` to `launchTimestamp` — or any earlier date than the true
creation block. Call `recordFeeAndRac`, then `verifyAndMint`.

**Evidence.**

```solidity
// VinculumFinalisVerifier.sol:530-536
function _daysSinceLaunch(ProofPackage calldata pkg)
    internal view returns (uint256)
{
    require(pkg.valuationTimestamp >= launchTimestamp, "VF-ORC-011: valuation precedes launch");
    require(pkg.valuationTimestamp <= block.timestamp,  "VF-ORC-011: valuation in future");
    return (pkg.valuationTimestamp - launchTimestamp) / 1 days;
}
```

Both requires bound the value to a window; neither ties it to the lock.
`extractFacts` returns `creationTimestamp`, and `verifyAndMint` discards it with
a bare comma in the destructuring at line 820. The emission rate that
`_computeIssuance` applies therefore follows a number the caller chose.

> **VF-ORC-011:** The Valuation Timestamp is the timestamp of the finalized
> source-chain block containing the Commitment Vault Lock.

**Impact.** Issuance inflated by the full decay differential between launch and
the true creation date. Consumes lifetime VCLM capacity against value that was
never committed. Unauthenticated and permissionless, like W1-01.

**Fix.** `creationTimestamp` joins the returned fact set and
`pkg.valuationTimestamp` must equal it.

**Reproduction.** `25_w1_identity_binding.test.cjs`, cases W1-09a and W1-09b.
Lock created 400 days after launch, package rewound to launch:

```
honest (day ~400):  924.248167728223589235 VCLM
rewound to launch:  1150.0 VCLM
reverted: false
```

Roughly 24% inflation at day 400, and it widens with every day of decay.

**Fixture note, recorded because it nearly produced a false negative.** The first
version of these two cases advanced 400 days without republishing the price
batch, so `commitVaultLock` reverted on `PriceRecordStale()` inside the vault —
before the finding was ever exercised. Written as a bare `.to.be.reverted`, both
cases would have passed and recorded W1-09 as closed. This is the same failure
mode W1-01c documents, met while writing the test that documents it. The fixture
now republishes prices after time travel; see `advanceDaysAndRefreshPrices`.

---

### W1-06 · Rebasing assets are checked only at creation — Medium

**Evidence.** `CommitmentLock.confirmFunded()` enforces `bal != principalAmount` in the same transaction as creation. This correctly fail-closes fee-on-transfer tokens — good, deliberate, and worth keeping.

A token that rebases *after* creation is not covered. If the balance rebases down, `release()` attempts to transfer `principalAmount` against a smaller balance and reverts permanently. Principal is stuck with no administrative recovery, by design.

**Fix or accept.** Either exclude rebasing assets at registry level, or accept and document. Note that the registry currently carries no field distinguishing them.

**Missing test.** *Lock a downward-rebasing mock, advance to maturity, assert the chosen behaviour.*

---

### W1-07 · No USD-bound preflight on the site — Low

`lock.html: commit()` validates addresses, a positive amount, `approvedAsset != ZeroHash`, and nonzero fee and principal. It does not check the $10.00 minimum or the $0.95–$1.05 handshake band, both of which the vault enforces at lines 289–296.

**Impact.** Guaranteed revert, user pays gas. Also a §5.2.2 obligation — the qualifying value range is on the mandatory preflight list.

**Fix.** Read the price record client-side and check before enabling the button.

---

### W1-08 · Stray ETH to a native-asset clone is stuck — Low, accept candidate

`CommitmentLock` has `receive() external payable {}` and `release()` transfers exactly `principalAmount`. ETH sent to a clone after creation is unreachable forever.

Removing `receive()` is not obviously right — the factory needs to fund the clone. Reasonable to accept and record.

---

## 3 · Checked and found sound

Recorded so nobody re-derives these.

**3.1 · Can anyone drain a clone before maturity?** No. `CommitmentLock.release()` is the only value-moving function; it reverts with `NotMature` below `maturityTime`, and there is no other path out. `contracts/CommitmentLock.sol:96–120`.

**3.2 · Can principal go anywhere other than `releaseDestination`?** No. The destination is bound in `initialize()`, is rejected if zero, has no setter, and `release()` reads it from storage. The caller influences neither destination nor amount. Permissionless release is correct here — it satisfies VF-PRI-002 without letting the caller choose where funds go.

**3.3 · Fee-on-transfer tokens.** Caught at creation. `confirmFunded()` requires exact balance equality and the whole creation reverts otherwise. Correct and fail-closed.

**3.4 · Can a stale or zero price mint?** No. `_verifiedGrossUsdMicro` requires `pr.available` and `block.timestamp - pr.fetchTimestamp <= MAX_PRICE_RECORD_AGE`, with CL-37 handling the boundary at exactly 48 hours. `VinculumFinalisVerifier.sol:503–509`.

**3.5 · Handshake reuse by changing wallets.** Permitted, by specification. VF-COM-005 states that a new wallet earns its own allowance and that person-level clustering is neither required nor permitted. The vault's per-`msg.sender` counter implements this correctly. Not a finding.

**3.6 · Clone address pre-funding griefing.** Not applicable. `_cloneLock()` uses non-deterministic deployment and checks `instance == address(0)`, so a clone address cannot be predicted and pre-funded to force `confirmFunded()` to revert. Would be a live griefing vector under CREATE2 with a predictable salt — worth preserving this property if the deployment method is ever revisited.

**3.7 · Replay.** `consumedLocks[keccak256(envId, lockId)]` set at line 872, checked at line 706. `recordedRacs[pkg.racIdentity]` enforces RAC exact-once at line 636. Both sound in isolation — note that W1-01 exploits the replay guard rather than defeating it.

---

## 3a · What the suite already covered — and the shape it missed

Recorded because it is the most transferable lesson from Wave 1 and because it
corrects an implied criticism of the existing tests.

The suite is not short of adversarial thinking. At `af40537` it holds 293
passing tests, and several are attack tests of exactly the right kind:

- `10_cl76_forged_package` — a forged package with **no lock on any chain**
- `04_endtoend` CL-11 — a package **lying about its allowance count**
- `02_oracle` CL-41 — a package **understating asset precision**, which prints
  `inflation: 1x` to prove the field is economically inert
- `12_base_verifier` — *"ignores the caller's claimed amounts and returns vault
  storage instead"*
- `04_endtoend` — *"VF-XCH-011: a package contradicting the source facts is
  rejected"*, covering the five numeric fields that are cross-checked

CL-41 is the direct ancestor of W1-02. Someone had already reasoned that a
package field could be economically abused, tested it, and proved that
particular field harmless.

**The gap was one specific shape: a real lock, plus a package that disagrees
with it on an identity field.** CL-76 covers no-lock. CL-11 covers a lied-about
scalar. Nobody had built the case in between, and all four findings lived there.

For Wave 2 against Ethereum, Polygon, Arbitrum and OP-Stack, that is the shape
to reach for first: take the honest artifact the suite already builds, change
one field, and assert on the revert reason rather than on the fact of reverting.

---

## 4 · What Wave 1 did not cover

Stated so the boundary is testable.

- Stake, cap, SYNTH, token contracts
- Every non-Base environment. The fail-closed stubs are correct to leave off the site; the four written EVM verifiers (Ethereum, Polygon, Arbitrum, OP-Stack) are Wave 2
- The `_computeIssuance` decay arithmetic itself
- Price publisher authorization and the twice-daily batch path
- Reentrancy across contract boundaries
- Gas-limit denial of service

---

## 5 · Recommended order

1. **W1-01 and W1-02 together.** One interface change closes both. Nothing else on this list matters until they are closed — both are unauthenticated, both are remotely reachable by any address, and one of them fabricates supply.
2. **Write the four adversarial tests first, watch them fail, then fix.** The suite's 85 tests all pass today against a codebase with two critical holes. That is the evidence for writing the test before the patch.
3. **W1-03.** Ten minutes, unrelated to everything else.
4. **W1-05 and W1-09 need no separate decision.** Both close with the same field-set change as W1-01 and W1-02.
5. Wave 2 only after Base is closed out.

---

*Derived from Rev 6 (`5a93…0bf9`) and the `redteam/prep` tree at `bff9190`. No claim in this document rests on a statement by the project owner; every finding names a file and a line.*
