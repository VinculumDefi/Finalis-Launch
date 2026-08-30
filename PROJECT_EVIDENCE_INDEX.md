# Vinculum Project Evidence Index

**Status: Derived Document · v3**

This index is a navigation and status aid only. It establishes nothing.

**Authority order:**

1. Master Specification Revision 6 (`5a93…0bf9`)
2. Source code
3. Executed tests
4. Findings Register
5. Red-team reports
6. **This index**

**If any row disagrees with its cited source, the cited source is authoritative.**
A row is a pointer, not a claim. When you care about a row, follow the evidence
column and read the thing itself.

---

## How to read a status

| Status | Meaning |
|---|---|
| 🟦 Design Defined | Architecture exists. No implementation. |
| 🟨 Implemented | Code exists. Not read by the recorder of this row. |
| 🟩 Read | Source read by the recorder. No executed test cited. |
| 🟢 Tested | A named test executed and passed. |
| 🟪 Reproduced | Confirmed by a second party on a separate machine. |
| 🟥 Defect | Confirmed issue with a reproduction. |
| ⚫ Closed | Fixed, with a regression test that fails on the old code. |

🟨 and 🟩 are deliberately distinct. An unexamined file is not evidence of a
working component, and recording it as one is the failure this project keeps
having. That distinction is inherited from
`standards/COMPONENT_IMPLEMENTATION_INVENTORY_v1.md`, which introduced it.

---

## Recording state

| Field | Value |
|---|---|
| Branch | `redteam/prep` |
| Commit at last full verification | `bff9190` |
| Test totals at that commit | **293 passing · 8 failing** |
| The 8 failures | `25_w1_identity_binding.test.cjs` — intentional; see BASE-08, BASE-09 |
| Session latch | `SESSION_LATCH.md` — paste at the top of a new chat before any review |
| Recorded by | Claude, 30 August 2026, from a clone of `redteam/prep` |
| v2 revision | Adds BASE-14, BASE-15 and the single-root-cause framing. Both found by reading Rev 6, not by testing. |
| v3 revision | BASE-15 upgraded to Reproduced — W1-09a/b execute. Suite now 8 failing, 1 passing (control). BASE-14 still has no test. |
| Full suite command | `npx hardhat test` |

Every row below carries the commit at which it was verified. If the code has
moved since, the row is stale until someone re-runs it and updates the commit.
That is the mechanism that keeps this file honest — not good intentions.

---

## Base environment — Wave 1 scope

| ID | Component | Requirement | Status | Source of truth | Evidence | Commit |
|---|---|---|---|---|---|---|
| BASE-01 | Commitment Vault | Creates a lock, routes fee, funds an isolated clone | 🟢 Tested | `contracts/VinculumFinalisBaseVault.sol` | `13_base_e2e` · `11_base_vault` | `bff9190` |
| BASE-02 | Lock clone | Cannot be drained before maturity | 🟩 Read | `contracts/CommitmentLock.sol:96–120` | Wave 1 §3.1 | `bff9190` |
| BASE-03 | Lock clone | Principal can only reach `releaseDestination` | 🟩 Read | `CommitmentLock.initialize/release` | Wave 1 §3.2 | `bff9190` |
| BASE-04 | Lock clone | Fee-on-transfer assets fail closed at creation | 🟩 Read | `CommitmentLock.confirmFunded()` | Wave 1 §3.3 | `bff9190` |
| BASE-05 | Same-chain verifier | Facts come from vault storage, not the caller | 🟢 Tested | `chain-verifiers/BaseSameChainVerifier.sol` | `12_base_verifier` · `13_base_e2e` | `bff9190` |
| BASE-06 | Issuance verifier | Replay protection — one lock, one mint | 🟢 Tested | `VinculumFinalisVerifier.sol:706,872` | `13_base_e2e` element 9 | `bff9190` |
| BASE-07 | Issuance verifier | A forged package with no real lock cannot mint | 🟢 Tested | `VinculumFinalisVerifier.verifyAndMint` | `10_cl76_forged_package` · `13_base_e2e` | `bff9190` |
| **BASE-08** | **Package identity binding** | **Base recipient is bound at creation (VF-ARC-006)** | **🟥 Defect · 🟪 Reproduced** | `interfaces/IChainVerifier.sol` · `VinculumFinalisVerifier.sol:817–829` | **W1-01** · `25_w1_identity_binding` | `bff9190` |
| **BASE-09** | **Package asset binding** | **Asset substitution is impossible (VF-REG-001, VF-COM-018)** | **🟥 Defect · 🟪 Reproduced** | `interfaces/IChainVerifier.sol` · `VinculumFinalisVerifier.sol:500–516` | **W1-02** · `25_w1_identity_binding` | `bff9190` |
| **BASE-14** | **Valuation binding** | **Proof delay must not reprice the lock (VF-ORC-010, VF-XCH-009)** | **🟥 Defect** | `VinculumFinalisVerifier.sol:500–516` · `VinculumFinalisBaseVault.sol:285` | **W1-05** — reclassified from owner decision | `bff9190` |
| **BASE-15** | **Emission-rate binding** | **Rate follows the Valuation Timestamp of the finalized source block (VF-ORC-011)** | **🟥 Defect · 🟪 Reproduced** | `VinculumFinalisVerifier._daysSinceLaunch:530–536` · discard at `:820` | **W1-09** · `25_w1_identity_binding` W1-09a/b | `bff9190` |
| BASE-10 | Issuance verifier | Stale or unavailable price cannot mint | 🟩 Read | `VinculumFinalisVerifier.sol:503–509` | Wave 1 §3.4 | `bff9190` |
| BASE-11 | Vault | Handshake allowance enforced per source address | 🟢 Tested | `VinculumFinalisBaseVault.sol:292` | `03_handshake` | `bff9190` |
| BASE-12 | Lifetime cap | Issuance rejected in full at the cap | 🟢 Tested | `contracts/VinculumFinalisCap.sol` | `24_cl84_lifetime_cap` | `bff9190` |
| BASE-13 | Clone deployment | Clone address not predictable, so not pre-fundable | 🟩 Read | `VinculumFinalisBaseVault._cloneLock()` | Wave 1 §3.6 | `bff9190` |

### Root cause — one defect, four symptoms

BASE-08, BASE-09, BASE-14 and BASE-15 are not four defects. They are four
consequences of one:

> **`IChainVerifier.extractFacts` returns 7 facts. VF-XCH-011 requires evidence
> to bind 19.** Every omitted field is accepted from the caller instead.

VF-XCH-011 enumerates the required set: source environment, unique lock
identifier, canonical asset identity and precision, user, gross amount, actual
fee amount and asset, Dev Fund destination and fee-transfer evidence,
principal, creation timestamp, maturity, selected output, authorized Base-chain
recipient, release destination, applicable valuation record, RAC identity,
Handshake identity, Handshake allowance count, CHONX-activation receipt.

`VinculumFinalisVerifier.sol:810` cites VF-XCH-011 by name in its own comment
and then cross-checks five of the nineteen.

VF-XCH-005 requires the *source mechanism* to bind user, release destination,
asset, amount, creation timestamp and maturity — in all seventeen environments.
So whether a UTXO or XRPL vault commits these is not an open specification
question. It is a conformance test against each native vault.

VF-XCH-009 independently settles BASE-14 and BASE-15: confirmation and
proof-delivery delays do not alter the original Valuation Timestamp, lock
timestamp, maturity, selected output, recipient, or calculated issuance.

**Interface field set required to close all four:** `canonicalAssetId`,
`baseRecipient`, `releaseDestination`, `outputToken`, `verifiedGrossUsd`,
`creationTimestamp`, `maturityTimestamp`.

### Open at this commit

| ID | Severity | Blocks deploy? | Register |
|---|---|---|---|
| BASE-08 / W1-01 | Critical | **Yes** | `reviewers/red-team/Wave_1/REDTEAM_WAVE1_BASE.md` |
| BASE-09 / W1-02 | Critical | **Yes** | same |
| BASE-14 / W1-05 | Critical — spec violation | **Yes** | reclassified; VF-ORC-010 |
| BASE-15 / W1-09 | Critical — spec violation | **Yes** | register W1-09; VF-ORC-011 |
| W1-03 ethers SRI | High | Site-side | same |
| W1-04, W1-06 | Medium | No | same |
| W1-07, W1-08 | Low | No | same |

**Deployment gate.** No address enters `vinculum-site/config.js` while any
🟥 row above is open. The Wave 1 register is public and contains a working
reproduction; that is harmless against undeployed contracts and an attack
manual against live ones.

---

## Other environments — not verified here

These rows are transcribed from `standards/COMPONENT_IMPLEMENTATION_INVENTORY_v1.md`
(commit `6a0a296`, 22 August 2026). **They were not independently verified for
this index.** The inventory's own verified / present-unexamined distinction is
preserved; do not upgrade a row without reading the file it names.

| Environment | Source lock | Base-side verifier | Status per inventory |
|---|---|---|---|
| Base | `VinculumFinalisBaseVault.sol` | `BaseSameChainVerifier.sol` | Verified |
| Ethereum | `VinculumFinalisEvmVault.sol` | `EthereumChainVerifier.sol` + `L1BlockRegistry.sol` | Verified |
| Polygon | same vault | `PolygonChainVerifier.sol` | Verified |
| Arbitrum | same vault | `ArbitrumChainVerifier.sol` | Verified |
| Optimism | same vault | `OpStackFaultProofVerifier.sol` | Verified — CL-83 |
| BNB, Avalanche | same vault | `EvmChainVerifier.sol` | 🟦 **Fail-closed** — verification DESIGN DEFINED |
| Bitcoin, Bitcoin Cash | — | `UtxoChainVerifier.sol` + `Sha256dHeaderChain.sol` | Verifier verified; **source not implemented** |
| Solana | `solana-vault/` (Rust/Anchor) | Stub | 🟦 **Fail-closed** |
| Cosmos Hub | `cosmos-hub-vault/` (CosmWasm) | **None registered** | Vault present; adapter unexamined |
| XRP Ledger | `xrpl-lock/` | Stub | 🟦 **Skeleton only, fail-closed** |
| Stellar | — | Stub | 🟦 **Not implemented, fail-closed** |
| Litecoin, Dogecoin, DigiByte, Zcash | — | — | 🟦 **Not implemented** |

**Consequence for the public site.** A lock button may not be offered for any
environment whose verifier is a fail-closed stub. `vinculum-site/LAUNCH.md`
step 5 states this; this row is why.

---

## Off-chain components

Transcribed from the same inventory. Recorded because a reviewer reading only
`base-contracts/` concludes these are missing when they are not.

| Component | Implementation | Status per inventory |
|---|---|---|
| A.5 `PRICE-FETCH` | `scripts/vinculum_price_fetcher_v9.py` · `base44/functions/fetchAssetPrice` | 🟨 Present, unexamined |
| A.6 `PRICE-DELIVER` | `src/lib/vfPriceService.js` · `submitPriceBatch` on Base | Receiver verified; off-chain half 🟨 unexamined |
| A.7 `SRC-EVID` | `src/lib/vfProofNormalizer.js` | 🟨 Header read only |
| A.8 `RELAY` | None required — every requirement is a prohibition satisfied on-chain | Satisfied by construction |
| A.17 `AXELAR-ITS` | External service, VF-XCH-018 | Configuration, not repository code |
| A.18 `DEPLOY-MANIFEST` | — | **Not located** |

`src/lib/` holds 36 modules and 6,201 lines, largely unexamined.
`vfProofAdapter.js` is marked **NON-PRODUCTION**. `vfVerifierEngine.js`
describes itself as mirroring on-chain logic and its production status is not
established. Reading those modules is a named outstanding verification task.

---

## Product artifacts

The frozen product baseline lives in `product/` on this branch. It is not
summarized here — `product/PRODUCT_ARCHITECTURE_INDEX_v1.md` is already the
index for that domain and this file does not duplicate it.

One rule from it is worth surfacing, because it is the rule this file exists to
serve: *inability to locate an artifact is not evidence that it does not exist.*

---

## Maintenance

**Add a row when** a component is verified, a test is executed, or a finding is
confirmed or closed.

**Update a row when** the commit it cites is superseded and someone re-runs the
evidence. Change the commit and the date together, or not at all.

**Never** upgrade a status without executing or reading the cited evidence.
🟨 to 🟩 requires reading the file. 🟩 to 🟢 requires running a named test.
🟢 to 🟪 requires a second party on a separate machine.

**Do not** record a row for something you were told. This index carries no row
that rests on a statement by the project owner, and it should stay that way.

---

*Derived from Master Specification Revision 6 (`5a93…0bf9`, hash verified),
the `redteam/prep` tree at `bff9190`, an executed full test run, and
`standards/COMPONENT_IMPLEMENTATION_INVENTORY_v1.md` at `6a0a296`. No other
source.*
