# Vinculum Finalis — Base-Side Verification & Minting Contract

## Overview

The canonical Base-chain verifier (`BASE-VERIFY`) that accepts deterministic proof packages from native source-chain Commitment Locks and performs protocol verification before minting VCLM/CHONX tokens.

**Chain-agnostic design:** the same `verifyAndMint()` function handles all 17 supported source environments — Solana, XRPL, Cosmos, Bitcoin, Litecoin, Dogecoin, DigiByte, Zcash, Bitcoin Cash, Stellar, Ethereum, BNB, Avalanche, Polygon, Arbitrum, Base, and Optimism — without changing protocol behavior. Per-environment finality proof verification is dispatched to `IChainVerifier` implementations.

## Authority

- **Revision:** 6 (2026-07-28)
- **Governing source:** `227826f11_Vinculum_Finalis_Master_Specification_Revision_6_2026-07-28.docx`
- **Governing source SHA-256:** `5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9`
- **Requirements count:** 209

## Files

| File | Purpose |
|------|---------|
| `contracts/VinculumFinalisVerifier.sol` | Solidity 0.8.19 contract — the on-chain recognition boundary |
| `../../lib/vfVerifierEngine.js` | Off-chain verification engine (mirrors Solidity logic) |
| `../../lib/vfProofNormalizer.js` | Chain-agnostic proof package normalization |
| `../../lib/vfBaseRegistry.js` | Immutable asset-precision table (BASE-QNORM) + 17-environment registry |
| `../../lib/vfMockEventBuilder.js` | Mock event builders for all environment families |
| `../../components/base/VerifierArchitecture.jsx` | Contract structure display |
| `../../components/base/ProofPackageViewer.jsx` | Normalized ProofPackage viewer |
| `../../components/base/VerificationFlow.jsx` | Verification result panel |
| `../../pages/BaseVerifier.jsx` | Main interface page |
| `tests/verifier.test.js` | 20 integration tests |
| `tests/chain-verifiers.test.js` | 32 chain verifier integration tests |
| `contracts/VinculumFinalisToken.sol` | VCLM/CHONX ERC-20 token contract (deployed twice) |
| `contracts/VinculumFinalisSynth.sol` | SYNTH token + forge mechanism (burns VCLM+CHONX) |
| `tests/token.test.js` | Token layer integration tests |
| `../../lib/vfTokenEngine.js` | Off-chain token engine (mint, burn, forge, activation) |
| `../../components/tokens/TokenOverview.jsx` | Token stats display (VCLM, CHONX, SYNTH) |
| `../../components/tokens/ForgePanel.jsx` | SYNTH forge interface |
| `../../components/tokens/IssuancePipeline.jsx` | End-to-end pipeline visualization |
| `../../pages/TokenLayer.jsx` | Token layer page with full pipeline simulation |
| `contracts/interfaces/IChainVerifier.sol` | Shared per-environment verifier interface (Section O) |
| `contracts/chain-verifiers/EvmChainVerifier.sol` | EVM family verifier (7 environments, configurable finality model) |
| `contracts/chain-verifiers/SolanaChainVerifier.sol` | Solana verifier (finalized slot) |
| `contracts/chain-verifiers/UtxoChainVerifier.sol` | UTXO family verifier (6 environments, PoW confirmation depth) |
| `contracts/chain-verifiers/XrplChainVerifier.sol` | XRPL verifier (validated ledger) |
| `contracts/chain-verifiers/StellarChainVerifier.sol` | Stellar verifier (SCP closed) |
| `../../lib/vfChainVerifierRegistry.js` | Off-chain dispatcher — routes to per-environment verifier |
| `../../lib/vfEvmChainVerifier.js` | Off-chain EVM family chain verifier |
| `../../lib/vfSolanaChainVerifier.js` | Off-chain Solana chain verifier |
| `../../lib/vfUtxoChainVerifier.js` | Off-chain UTXO family chain verifier |
| `../../lib/vfXrplChainVerifier.js` | Off-chain XRPL chain verifier |
| `../../lib/vfStellarChainVerifier.js` | Off-chain Stellar chain verifier |
| `../../components/base/ChainVerifierPanel.jsx` | Per-environment verifier status panel |
| `tests/chain-verifiers.test.js` | 32 chain verifier integration tests |

## Verification Steps (14)

The `verifyAndMint()` function performs these checks in order. Any failure rejects the proof (fail-closed).

| # | Step | Requirement | Description |
|---|------|-------------|-------------|
| 1 | Replay protection | VF-XCH-013 | `(env, lockId)` must not be consumed |
| 2 | RAC dedup | VF-RAC-001 | `rac_identity` must not be recorded |
| 3 | Registry + precision | VF-REG-001, VF-QNORM | Asset in immutable table; precision matches |
| 4 | Fee math | VF-COM-011/012/013 | `principal == gross - fee`; fee > 0; fee = floor(gross×bps/10000) |
| 5 | Duration | VF-COM-001/002 | Must be one of 16 permitted durations |
| 6 | USD bounds | VF-COM-003/009 | Handshake: $0.95–$1.05; Standard: ≥ $10.00 |
| 7 | Output eligibility | VF-COM-020/025, VF-TOK-002 | VCLM or activated CHONX; receipt if CHONX |
| 8 | Handshake allowance | VF-COM-006/007/008 | 1-use (Base-enforced) or 3-use (source-enforced) |
| 9 | Base recipient | VF-ARC-006 | Nonzero EVM address |
| 10 | Dev Fund | VF-FEE-009 | Configured destination |
| 11 | Source finality + fact cross-check | VF-XCH-006/010/011 | Dispatched to per-environment `IChainVerifier`; facts independently extracted and cross-checked against ProofPackage |
| 12 | Issuance calc | VF-COM-018/019 | USD × emission × asset_mult × duration_mult (floor) |
| 13 | Hard cap | VF-SUP-015 | Output ≤ remaining lifetime capacity |
| 14 | Mint + RAC | VF-RAC-001 | Mint to recipient; record RAC credit (60% of fee USD) |

## Chain-Agnostic Interface

Every source environment normalizes into the same `ProofPackage` structure (Section D of the Architecture Design):

```
ProofPackage {
  source_environment_id       // "Solana", "XRPL", "Bitcoin", etc.
  commitment_vault_lock_id    // unique per environment
  handshake_identity          // (env, account) or (env, canonical_release_pubkey)
  handshake_allowance_count   // 1 or 3
  canonical_asset_id          // from immutable registry
  asset_precision             // from immutable table (NOT relayer)
  gross/fee/principal_amount  // smallest units
  dev_fund_destination         // fixed per environment
  valuation/maturity_timestamp
  duration_secs
  selected_output_token        // VCLM or CHONX
  base_recipient               // EVM address
  release_destination          // source-chain address
  chonx_activation_receipt     // causal ordering proof
  rac_identity                 // H(env, lockId, feeTxHash, feeOp, feeAsset, feeAmount)
  source_finality_proof        // chain-specific, dispatched to IChainVerifier
  lock_event_proof             // chain-specific
}
```

## Per-Environment Handshake Enforcement

| Family | Environments | Allowance | Enforcement |
|--------|-------------|-----------|-------------|
| EVM (7) | Ethereum, BNB, Avalanche, Polygon, Arbitrum, Base, Optimism | 3 | Source (contract counter) |
| Solana | Solana | 3 | Source (program PDA counter) |
| UTXO (6) | Bitcoin, Litecoin, Dogecoin, DigiByte, Zcash, BitcoinCash | 1 | Base (recognition counter) |
| XRPL | XRPL | 1 | Base (recognition counter) |
| Stellar | Stellar | 1 | Base (recognition counter) |
| Cosmos Hub | CosmosHub | — | EVIDENCE REQUIRED (mechanism incomplete) |

## Deployment Status

| Component | Status |
|-----------|--------|
| Solidity contract source | ✅ Written — not compiled/deployed |
| Off-chain engine (JS) | ✅ Validated in Base44 |
| VCLM/CHONX token contracts | ✅ Written (`VinculumFinalisToken.sol`) — not compiled/deployed |
| SYNTH token + forge contract | ✅ Written (`VinculumFinalisSynth.sol`) — not compiled/deployed |
| Off-chain token engine (JS) | ✅ Validated in Base44 (14 tests pass) |
| Token layer UI | ✅ Functional (`/token-layer` page) |
| Per-environment `IChainVerifier` (off-chain JS) | ✅ Implemented (16/17 environments; Cosmos Hub = EVIDENCE_REQUIRED) |
| Per-environment `IChainVerifier` (Solidity) | ✅ Written — not compiled/deployed |
| Finality dispatch + fact cross-check | ✅ Integrated into off-chain engine (VF-XCH-006/010/011) |
| Dev Fund destinations (17) | ⚠️ PENDING_DEPLOYMENT (deferred external input) |
| Canonical chain identifiers | ⚠️ PENDING_DEPLOYMENT (deferred external input) |

## Running Tests

```bash
cd src/base-verifier
npm test
node tests/verifier.test.js
node tests/token.test.js
node tests/chain-verifiers.test.js