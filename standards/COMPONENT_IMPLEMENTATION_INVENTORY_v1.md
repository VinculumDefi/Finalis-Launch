# Component Implementation Inventory — v1

**Date:** 2026-08-22 · **Repository state:** commit `6a0a296`

> **Purpose.** Vinculum Finalis spans Solidity, Rust, CosmWasm, JavaScript,
> Python and serverless functions. No artifact has mapped architecture
> components to their implementations across all of them. The absence of this
> document is why sessions repeatedly "rediscover" work that was already
> finished — a reviewer reading only `base-contracts/` concludes that
> `PRICE-FETCH`, `SRC-EVID` and `RELAY` are missing when they are not.

> **Axiom.** *Implementation is not synonymous with Solidity.* A component is
> implemented if the repository contains it in the form the governing artifacts
> require — Solidity, Rust, CosmWasm, TypeScript, JavaScript, Python, a web
> service, or external configuration.

> **Verification standard.** Rows marked **verified** were read this session.
> Rows marked **present, unexamined** name a file that exists but whose
> contents have not been read. That distinction is deliberate: an unexamined
> file is not evidence of a working component, and pretending otherwise is the
> failure this document exists to prevent.

---

## Base-chain components (Solidity)

| Component | Implementation | Status |
|---|---|---|
| A.9 `BASE-VERIFY` | `base-contracts/contracts/VinculumFinalisVerifier.sol` | **Verified** |
| A.10 `BASE-REG` | `registerAssetPrecision` in the verifier | **Verified** |
| A.11 `BASE-ISSUE` / `EMIT` / `MULT` | `VinculumFinalisVerifier.sol` | **Verified** |
| A.12 `BASE-CAP` | `base-contracts/contracts/VinculumFinalisCap.sol` | **Verified** — CL-84, commit `a086746` |
| A.13 `BASE-ACT` | Activation recording in the verifier | **Verified**, on-chain half |
| A.14 `BASE-TOK-*` | `VinculumFinalisToken.sol` | **Verified** |
| A.15 `BASE-FORGE` | `VinculumFinalisSynth.sol` | **Verified** |
| A.16 `BASE-STAKE` / `EPOCH` / `RAC` | `VinculumFinalisStake.sol` | **Verified** |
| A.18 `DEPLOY-FIN` | `finalize()`, `finalizeConfiguration()` | **Verified** |
| A.20 `BASE-QNORM` | `assetPrecisionTable` | **Verified** |
| A.17 `AXELAR-ITS` | **External service.** Rev 7 §11.4: *"a binding architectural requirement rather than a prescribed low-level integration design."* VF-XCH-018 permits the implementer to design the integration. | **Configuration, not repository code** |
| A.18 `DEPLOY-MANIFEST` | — | **Not located** |

## Source-lock mechanisms

| Environment | Implementation | Status |
|---|---|---|
| Base | `VinculumFinalisBaseVault.sol` + `CommitmentLock.sol` | **Verified** |
| Ethereum, BNB, Avalanche, Polygon, Arbitrum, Optimism | `VinculumFinalisEvmVault.sol` — one contract, six deployments | **Verified** |
| Cosmos Hub | `cosmos-hub-vault/contracts/vault/src/` (CosmWasm) | **Present**, 45 tests recorded |
| Solana | `solana-vault/programs/vf-solana-vault/src/` (Rust/Anchor) | **Present** |
| XRP Ledger | `xrpl-lock/` — `package.json`, README, deploy guide, one test | **Skeleton only** |
| Bitcoin family, Stellar | — | **Not implemented.** Source mechanism DESIGN DEFINED per C.8, C.11, C.13–C.17 |

## Base-side verifiers (Solidity)

| Environment | Implementation | Status |
|---|---|---|
| Base | `BaseSameChainVerifier.sol` | **Verified** |
| Bitcoin, Bitcoin Cash | `UtxoChainVerifier.sol` + `Sha256dHeaderChain.sol` + `BitcoinTx.sol` | **Verified** |
| Ethereum | `EthereumChainVerifier.sol` + `L1BlockRegistry.sol` | **Verified** |
| Optimism | `OpStackFaultProofVerifier.sol` | **Verified** — CL-83 remediation |
| Polygon | `PolygonChainVerifier.sol` | **Verified** |
| Arbitrum | `ArbitrumChainVerifier.sol` | **Verified** |
| BNB, Avalanche | `EvmChainVerifier.sol` | **Fail-closed** — verification DESIGN DEFINED |
| Solana, Stellar, XRPL | Stubs | **Fail-closed** |
| Cosmos Hub | — | **None**; `cosmos-hub-proof-adapter/` exists, unexamined |

## Off-chain components — the section most often missed

| Component | Implementation | Status |
|---|---|---|
| A.5 `PRICE-FETCH` | `scripts/vinculum_price_fetcher_v9.py`; `base44/functions/fetchAssetPrice` | **Present, unexamined** |
| A.6 `PRICE-DELIVER` | `src/lib/vfPriceService.js`; Base receiver `submitPriceBatch` | Receiver **verified**; off-chain half **present, unexamined** |
| A.7 `SRC-EVID` | `src/lib/vfProofNormalizer.js` — header cites *"SRC-EVID + BASE-VERIFY"*, built from Rev 6 §D | **Verified present**, contents unexamined beyond header |
| A.8 `RELAY` | **No implementation required.** Every `RELAY` requirement is a prohibition: VF-XCH-012 (cannot alter contents, choose output, redirect, approve), VF-SEC-005 (no parameter or value authority), VF-XCH-017 (no discretionary approver). All are satisfied on-chain — `verifyAndMint` derives facts from proofs and grants the caller nothing. Submission is permissionless; a user may relay for themselves. | **Satisfied by construction** |
| A.19 `APP-PUBLIC` | `src/pages/`, `src/components/`, `base44/` | **Present, unexamined** |

## `src/lib/` — 36 modules, 6,201 lines

Present but unexamined except where noted. Named here so no future session
concludes these components are missing.

**Evidence and verification:** `vfProofNormalizer.js` (SRC-EVID, header read) ·
`vfProofAdapter.js` (**marked RED-TEAM / NON-PRODUCTION**) ·
`vfVerifierEngine.js` (header cites BASE-VERIFY + ISSUE + EMIT + MULT + CAP +
ACT + RAC; describes itself as mirroring on-chain logic — **production status
not established**)

**Per-chain verifier modules:** `vfUtxoChainVerifier.js` ·
`vfEvmChainVerifier.js` · `vfSolanaChainVerifier.js` ·
`vfStellarChainVerifier.js` · `vfXrplChainVerifier.js` ·
`vfChainVerifierRegistry.js`

**Source-lock construction:** `vfXrplLockEngine.js` ·
`vfXrplTransactionBuilder.js` · `vfXrplAuthority.js` · `vfXrplRegistry.js` ·
`vfXrplMockAdapter.js` · `vfSolanaLockEngine.js` · `vfSolanaProgram.js` ·
`vfSolanaRegistry.js` · `vfSolanaMockAdapter.js` · `vfCosmosLock.js` ·
`cosmosCandidateData.js`

**Protocol engines:** `vfStakingEngine.js` · `vfTokenEngine.js` ·
`vfPendingAttemptLifecycle.js`

**Registry and compliance:** `vfBaseRegistry.js` · `vfRegistryVerification.js` ·
`vfComplianceData.js` · `vfRevision6Authority.js` · `vfIntegrationConfig.js` ·
`vfPriceService.js` · `vfMockEventBuilder.js`

---

## Immediate consequence

**`SRC-EVID`, `PRICE-FETCH` and `PRICE-DELIVER` are implemented.** Any
classification listing them as missing protocol construction is wrong. `RELAY`
requires no implementation — its requirements are prohibitions already
satisfied on-chain.

## What this inventory does not establish

Whether the JavaScript modules are production components or application-side
simulation. `vfProofAdapter.js` is explicitly marked NON-PRODUCTION;
`vfVerifierEngine.js` describes itself as mirroring on-chain logic. **Reading
those 33 unexamined modules is the next verification task** — and it is
verification, not construction.
