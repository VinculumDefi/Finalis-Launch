# LAST_SESSION_STATE.md

**Status:** Derived operational artifact (not authoritative)

## Purpose

This document allows any reviewer — human or AI — to resume productive work with
minimal reconstruction. It captures the operational state of the repository at
the conclusion of a work session and directs the reviewer to the authoritative
artifacts.

It never supersedes:

1. Master Specification (current accepted revision)
2. Accepted project standards
3. Source code
4. Executed tests
5. Findings Register
6. Accepted red-team reports

If any statement here conflicts with one of those, the authoritative artifact
governs.

---

# Session Identity

**Date:** 30 August 2026

**Session:** Wave 1 red team (Base identity binding) → Wave 2 opening (remedy path)

**Repository:** `github.com/VinculumDefi/Finalis-Launch`

**Branch:** `redteam/prep`

**HEAD Commit:** `a91a23e`

**Previous HEAD:** `2ae5704`

---

# Executive Summary

Wave 1 moved from written findings to findings reproduced by executed tests.
Two criticals identified from source review — a mint package naming a different
Base recipient, and one naming a different canonical asset — were confirmed by a
new adversarial test file, run first in a review sandbox and then independently
by the owner on a separate machine with identical output. Reading Rev 6 to
resolve a question that had been wrongly framed as an owner decision produced two
further defects: the verifier reprices a lock at mint time, and it selects the
emission rate from a caller-supplied Valuation Timestamp. All four are
consequences of a single defect — `IChainVerifier.extractFacts` returns seven
facts where VF-XCH-011 requires evidence to bind nineteen, and every omitted
field is accepted from the caller instead. A seven-field interface change closes
all four.

The session also disproved one of its own findings. Half of W1-04 claimed the
verifier trusts a caller-asserted handshake allowance count; two tests that
predate Wave 1 show the registry value governs and the package field is ignored.
That half is retracted in the register with the tests cited.

Running the full suite established that the existing tests are not short of
adversarial thinking — CL-76, CL-11 and CL-41 are all attack tests, and CL-41 is
the direct ancestor of W1-02. The gap was one specific shape: a real lock plus a
package that disagrees with it on an identity field. All four findings lived
there.

Two new documents entered the repository so this state survives without anyone
remembering it: the Project Evidence Index, and the session latch that became
this file.

Wave 2 then opened with a source read rather than a patch, and it narrowed the
defect. `VinculumFinalisEvmVault` already emits every VF-XCH-011 identity field
in a second event, `CommitVaultLockDetail`, whose own comment names that
requirement as its purpose. The Base-side verifiers never open it, because
`EvmReceipt.findLog` matches one topic and every verifier passes the
`CommitVaultLock` topic. It is a wiring gap, not a missing capability. The same
read corrected the remedy from seven returned facts to six plus a Base-side
valuation rule, because no source vault computes USD by design. And it produced
W2-05: six UTXO environments specify no carrier for the Base recipient at all,
so the interface change closes W1-01 for the EVM family and Solana but not
protocol-wide. W1-03 was closed on the site side by vendoring `ethers` locally.

---

# Repository State

## Current Phase

Wave 2 — remedy path established by source read. No patch written. No finding closed on the contract side.

---

## Deployment Status

☑ **Deploy Blocked**

**Reason:** Four confirmed critical defects, three reproduced by executed tests.
No address may enter `vinculum-site/config.js` while any remains open. The Wave 1
register is public and contains a working reproduction — harmless against
undeployed contracts, an attack manual against live ones.

---

## Repository Health

**Evidence Index Version:** v6

**Findings Register Version:** v16 — *not reviewed this session; the Wave 1
report was updated instead. Whether v16 needs a corresponding entry is unresolved.*

**Current Red Team Wave:** Wave 1 (Base) closed as a review · Wave 2 opened — remedy path established, no patch written

**Master Specification Revision:** Rev 6 · `5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9` (hash verified this session)

---

# Reading Order

0. `LAST_SESSION_STATE.md`
1. `00_PROJECT_START_HERE.md`
2. `PROJECT_EVIDENCE_INDEX.md`
3. `reviewers/Vinculum_Finalis_Findings_Register_v16.md`
4. `reviewers/red-team/Wave_1/REDTEAM_WAVE1_BASE.md`
5. Source files named below

Never begin by asking the owner what happened.

**Minimum paste kit for a new chat:** this file, then
`PROJECT_EVIDENCE_INDEX.md`, plus the repository URL and the branch name
`redteam/prep`. Add the Wave 1 report for red-team work, the Rev 6 `.docx` for
protocol questions, `product/PRODUCT_ARCHITECTURE_INDEX_v1.md` for website or
application work. Do not paste the Master Specification by default — it is
roughly 237,000 characters and will consume the context the work needs.

**Ask any AI reviewer early:** did you clone `redteam/prep` and read the source,
or are you reasoning from the documents pasted into this chat? A reviewer working
from summaries will sound equally confident and will miss what is in the files.
All four findings recorded here came from reading contracts.

---

# Major Outcomes

## New Evidence

- `base-contracts/test/25_w1_identity_binding.test.cjs` — nine cases, eight failing by design, one control passing.
- Full suite executed at `af40537`: **293 passing, 8 failing.** Same totals on two machines, two operating systems.
- W1-09 demonstration reproduced to eighteen decimal places across both machines (`924.248167728223589235`), establishing the fixture is deterministic.
- **Toolchain confirmed identical across both machines.** A fresh `npm install` rewrote 1,185 lines of `base-contracts/package-lock.json`, but `lockfileVersion` is unchanged and `solc` still resolves to `solc-0.8.19.tgz`; `hardhat` and `ethers` entries were not touched at all. The churn is transitive dependencies. Both reproductions therefore ran on the same compiler, and the two-machine claim is two independent confirmations of one build rather than two runs on different builds.

---

## Confirmed Findings

- **W1-01 · Critical · reproduced.** `baseRecipient` and `selectedOutputToken` are not bound to the lock record. An unprivileged address front-runs the honest minter and takes the entire issuance. Observed: locker 0.0 VCLM, attacker 1150.0 VCLM, lock consumed.
- **W1-02 · Critical · reproduced.** `canonicalAssetId` is not bound. Substituting a legitimately registered higher-priced asset inflates issuance by the full price ratio and additionally selects a higher custody class. Observed: 1150.0 honest against 1150000.0 substituted — 100000%.
- **W1-05 · Critical · specification.** The verifier recomputes valuation from the live price record at mint time. VF-ORC-010 forbids repricing on proof delay. No test yet.
- **W1-09 · Critical · reproduced.** The emission rate follows `pkg.valuationTimestamp`, caller-supplied and bounded only between launch and now. Observed: 924.248… honest at day ~400 against 1150.0 rewound to launch.

---

## Retracted Findings

- **W1-04, allowance-count half.** Claimed `pkg.handshakeAllowanceCount` is trusted. It is not. `04_endtoend` CL-11 mints once against a claimed allowance of 99 where the registry says 1, then rejects the second. `03_handshake` asserts the package field is not consulted anywhere in enforcement. Both predate Wave 1.
- **A claimed correction that was itself wrong.** The register was said to misstate the custody-class vector; it did not. It already read `entry.custodyClass`, which is correct.

---

## Closed Findings

- **W1-03 · site.** `ethers` is now vendored into `vinculum-site` and served from the site's own origin, replacing the unpinned CDN load on `lock.html`. Hash of the npm 6.13.5 tarball build recorded in a comment above the tag: `sha384-NRAZj94DQk3dgtsOZzVYHbYVV1DFkF5QhL5RRxF0ILZLi6OQ7CsMlun748D42JbO`. **Not yet committed — `lock.html` and `ethers-6.13.5.umd.min.js` are pending in the `vinculum-site` tree and need a browser check that the wallet still connects.**

No contract finding is closed. No patch has been written.

---

## Newly Opened Findings

- **W1-09** — emission rate from a caller-supplied Valuation Timestamp.
- **W1-05 reclassified** from Medium / owner decision to Critical / specification violation.
- **W2-05 · architecture.** Bitcoin, Bitcoin Cash, Litecoin, Dogecoin, DigiByte and Zcash specify no carrier for the Base recipient or selected output token. C.8 states outright that Bitcoin Script cannot verify the Base recipient on-chain and defers preflight to Base — but deferring verification does not supply the value. Stellar C.11 solves the identical problem with a transaction `Memo`; C.8 has no equivalent and the five inheriting environments have none either. Whether C.8 gains an `OP_RETURN` is a specification question, not a red-team decision.

---

# Tests

## New Tests Added

- `25_w1_identity_binding.test.cjs` · W1-01a, W1-01b, W1-01c, W1-02a, W1-02b, W1-02c, W1-09a, W1-09b, and one control.
- Helper `expectRevertMatching` asserts on the revert **reason**, not merely that a revert occurred.
- Helper `advanceDaysAndRefreshPrices` republishes the price batch after time travel.
- `26_w2_remote_evm_identity.test.cjs` · W2-01 through W2-04 plus one control. Builds an Ethereum receipt carrying **both** vault logs — what the vault actually emits — and asserts `extractFacts` surfaces the identity. 4 failing, 1 passing. W2-04 is the sharpest: extraction succeeds against a receipt binding no identity at all.

---

## Tests Executed

| Test | Result | Commit |
|------|--------|--------|
| `13_base_e2e` (baseline before changes) | 5 passing | `bff9190` |
| `25_w1_identity_binding` (sandbox) | 8 failing, 1 passing | `bff9190` |
| `25_w1_identity_binding` (owner, Windows) | 8 failing, 1 passing | `af40537` |
| Full suite (sandbox) | 293 passing, 8 failing | `af40537` |
| Full suite (owner, Windows) | 293 passing, 8 failing | `af40537` |
| `26_w2_remote_evm_identity` (sandbox) | 4 failing, 1 passing | `36f2a9c` |

---

## Regression Coverage Learned

Today's run proved the suite already covers these. Do not rediscover them.

- `10_cl76_forged_package` — a forged package with **no lock on any chain** is refused.
- `04_endtoend` CL-11 — a caller-asserted allowance count is **ignored entirely**.
- `02_oracle` CL-41 — an understated `assetPrecision` is **economically inert**; prints `inflation: 1x`.
- `12_base_verifier` — the same-chain verifier **ignores caller-claimed amounts and returns vault storage**.
- `04_endtoend` — a package contradicting the source facts is rejected, for the **five numeric fields** that are cross-checked.
- `11_base_vault` — release before maturity refused; release only to the bound destination; second release refused; release consults neither verifier, price feed, nor factory.
- `02_oracle` CL-37 — stale price fails closed, including the exact 48-hour boundary.

**The shape the suite missed:** a real lock, plus a package that disagrees with
it on an identity field. CL-76 covers no-lock. CL-11 covers a lied-about scalar.
Nobody had built the case in between. All four findings lived there. This is the
first shape to reach for in Wave 2.

---

# Specification Discoveries

Requirements that answered questions previously believed to need owner input.

- **VF-ORC-010** — a proof delay or retry does not reprice the lock using a later market observation. Answers W1-05 outright. There was never an A/B choice.
- **VF-XCH-009** — confirmation and proof-delivery delays do not alter the original Valuation Timestamp, lock timestamp, maturity, selected output, recipient, or calculated issuance. Independently settles W1-05 and W1-09.
- **VF-ORC-011** — the Valuation Timestamp is the timestamp of the finalized source-chain block containing the lock. Produced W1-09.
- **VF-XCH-011** — enumerates the nineteen facts evidence must bind. This is the required interface field set. It does not need deriving from attack analysis.
- **VF-XCH-005** — the source mechanism binds user, principal-release destination, asset, amount, creation timestamp and maturity, in all seventeen environments. Whether a UTXO or XRPL vault does so is therefore a conformance test against that vault, not an open specification question. A planned research session was cancelled on this basis.

---

# Process Corrections

- **Presented W1-05 to the owner as an A/B decision when VF-ORC-010 already answered it.** The specification was open and had been quoted repeatedly in the same session. The failure was not consulting it, not forgetting it.
- **Was about to research the cross-chain identity question that VF-XCH-011 and VF-XCH-005 state outright.**
- **Asked the owner to hand-edit two markdown files.** `00_PROJECT_START_HERE.md` already states *"Whole files, not line edits"* under Working conventions. Deliver complete files.
- **Wrote W1-04 without checking whether the suite already covered it.** Half of it had been closed before Wave 1 was written.
- **Issued a correction to the register that was itself wrong,** from misremembering a document rather than reading it.
- **Recorded Wave 1 §3 items as source reads when named tests already existed.** Four rows were later upgraded to Tested once the suite was actually run.

---

# Current Deployment Blockers

| ID | Description | Type | Status |
|----|-------------|------|--------|
| W1-01 / BASE-08 | Base recipient and output token not bound at mint | Contract | Confirmed · reproduced |
| W1-02 / BASE-09 | Canonical asset id not bound at mint | Contract | Confirmed · reproduced |
| W1-05 / BASE-14 | Verifier reprices at mint time | Contract | Confirmed · specification; **no test yet** |
| W1-09 / BASE-15 | Emission rate from caller-supplied timestamp | Contract | Confirmed · reproduced |
| W1-03 | `ethers` loaded without Subresource Integrity on `lock.html` | Site | **Fixed, uncommitted** |
| W2-05 | Six UTXO environments bind no Base recipient | Architecture / specification | Open — not a deploy blocker for Base |

All four contract blockers close with one change:

```
extractFacts must additionally return — SIX facts, corrected in Wave 2
  canonicalAssetId
  baseRecipient
  releaseDestination
  outputToken
  creationTimestamp     already returned; stop discarding it
  maturityTimestamp     already returned; stop discarding it

verifiedGrossUsd is NOT among them. No source vault computes USD, by
design (VF-ORC-007). W1-05 closes by a Base-side rule instead: select the
price record at the Valuation Timestamp, never recompute from the current
one (VF-ORC-009/010).
```

Interface, then every implementer, then equality checks in `verifyAndMint`. Not a
Base-only `require`.

**Path A is the chosen route for the EVM family:** each verifier performs a
second `findLog` against the `CommitVaultLockDetail` topic in the receipt it has
already decoded. `baseRecipient` is `word(3)`, `releaseDestination` `word(4)`,
`outputToken` `word(5)`, `canonicalAssetId` `topic(3)`. No change to
`EvmReceipt.sol`. **`22_evm_vault` must keep passing unedited** — if a patch
requires editing it, that patch is Path B wearing Path A's name.

---

# Immediate Next Task

Extend `IChainVerifier.extractFacts` with the six facts and implement Path A in
`BaseSameChainVerifier` first — it already reads the full `LockRecord` into
memory and discards those fields, so it is roughly four lines and it turns the
eight failures in `25_w1_identity_binding` green.

Do not proceed to the four remote EVM verifiers until Base passes.

---

# Required Reading Before That Task

- `reviewers/red-team/Wave_2/REDTEAM_WAVE2_REMEDY_PATH.md` — the chosen path, the word offsets, and W2-05
- `base-contracts/contracts/interfaces/IChainVerifier.sol`
- `base-contracts/contracts/chain-verifiers/BaseSameChainVerifier.sol` (lines 114–140)
- `base-contracts/contracts/VinculumFinalisVerifier.sol` (lines 700–880)
- Rev 6 — VF-XCH-005, VF-XCH-011, VF-XCH-012, VF-ORC-009/010/011

Note: `22_evm_vault` already asserts the EVM vault *"emits exactly the six data
words in the order EvmReceipt expects."* Any change to what verifiers extract
must be checked against that test.

---

# Decisions Already Made

- Rev 6 governs. `redteam/prep` is the only branch under review.
- The owner is not a verification source. He sets design appetite and priority.
- If Rev 6 answers a question, quote the VF requirement instead of asking.
- The Evidence Index is derived. The Findings Register and red-team reports outrank it.
- Deliver complete files. Never request manual text edits.
- Assert on revert reasons, not on the fact of a revert.
- Deploy is blocked while any confirmed critical is open.
- Fail-closed environments stay off the public site.

---

# Questions Still Open

- Whether Findings Register v16 requires entries corresponding to W1-01, W1-02, W1-05 and W1-09, or whether the Wave 1 report is the sole record. Not resolved this session.
**Resolved after this file was first written:**

- `package-lock.json` — committed at `8cac1bc` after verifying the compiler did not move. Reproducibility is better served by a lockfile matching what was actually built with.
- `SESSION_LATCH.md` — removed at `28c218e`, superseded by this file. `00_PROJECT_START_HERE.md` row 0 repointed at `cef5ca3`.

**Still open:**

- Whether C.8 should gain an `OP_RETURN` output binding the Base recipient and output token, as C.11 Stellar does with a `Memo`. Affects six environments. Specification question — W2-05.
- Whether C.10 XRP Ledger specifies a carrier for the Base recipient. Not read this session.

---

# Session Snapshot

**Repository:** `github.com/VinculumDefi/Finalis-Launch`
**Branch:** `redteam/prep`
**HEAD Commit:** `a91a23e`
**Evidence Index:** v6
**Findings Register:** v16 (not updated this session)
**Red Team Wave:** Wave 1 closed · Wave 2 open (remedy path, no patch)
**Deployment Status:** Deploy Blocked
**Known Deployment Blockers:** W1-01, W1-02, W1-05, W1-09 (contract) · W1-03 (site)
**Next Task:** Read the four EVM verifiers and the EVM vault before touching `IChainVerifier`

---

# Commit Summary

- `06992f4` — Project Evidence Index; W1 identity-binding adversarial tests (6 failing by design)
- `b30edf1` — W1-01/W1-02 confirmed and reproduced; Evidence Index enters startup reading order
- `847c467` — Evidence Index v2; session latch enters repo and startup reading order
- `af40537` — W1-05 reclassified Critical (VF-ORC-010); W1-09 added and reproduced; suite 8 failing by design
- `2dafc2b` — Evidence Index v4: full suite executed on two machines; 4 rows upgraded to Tested; W1-04 half retracted
- `bc6578b` — W1-04 half retracted with citations; record what the suite already covered and the shape it missed
- `28c218e` — remove `SESSION_LATCH.md`
- `cef5ca3` — add `LAST_SESSION_STATE.md`; repoint startup reading order
- `8cac1bc` — lockfile from a fresh `npm install` on Windows; `solc`, `hardhat` and `ethers` unchanged, transitive dependencies only
- `151ff7a` — session state current to `8cac1bc`; toolchain verification and paste kit
- `36f2a9c` — Wave 2 remedy path; field set corrected to six facts plus a valuation rule
- `2afb1ce` — W2 remote EVM identity tests (4 failing by design)
- `a91a23e` — W2-05: six UTXO environments specify no carrier for the Base recipient

---

# Staleness

This file records the state at `a91a23e`. If `git log -1` shows a later commit,
this file is stale by that much. It is derived and loses to its sources — the
Findings Register, the red-team reports, the source code, and executed tests all
outrank it.

Regenerate it at the end of a session, not during one.

---

# Closing Notes

Wave 1 is closed as a review. No fix has been written and no finding is closed.

Twelve tests fail on `redteam/prep` by design — eight in `25_w1_identity_binding`
and four in `26_w2_remote_evm_identity`. A continuous-integration run will
show red; that is the recorded state, not a regression. The single passing case
in `25_w1_identity_binding` is the control, and it is what establishes that the
eight failures are the defect rather than a broken fixture. If the control ever
fails, the fixture is wrong and the other eight prove nothing.

The reproduction is public and the contracts are not deployed. That ordering must
not reverse.
