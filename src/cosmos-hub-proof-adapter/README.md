# cosmos-hub-proof-adapter — RED-TEAM / NON-PRODUCTION

> **RED-TEAM / NON-PRODUCTION.** Off-chain Base-side CometBFT/ICS-23 proof normalizer and verifier
> for the Vinculum Finalis Cosmos Hub Commitment Vault. Plain JavaScript (Node), no dependencies.

## Purpose

Reads a finalized Cosmos Hub Commitment Vault `commit_vault_lock` event (or queried on-chain state),
normalizes it into the immutable-facts record required by VF-XCH-011, verifies a CometBFT/ICS-23
existence proof against the committed AppHash, enforces the finality gate (VF-XCH-006), and models
the Cosmos Hub pending-attempt disposition per Master Specification Section 5.2.3.

## Cosmos Hub pending-attempt disposition (Section 5.2.3 — defined here)

A broadcast Cosmos Hub Handshake transaction remains pending until one of:

1. **Finalized success** — a finalized block contains the `commit_vault_lock` for this `(cosmoshub-4, lock_id)`.
2. **Finalized failure** — a finalized block contains a failed/reverted execution for the same account+sequence.
3. **Objective invalidation by sequence consumption** — a finalized transaction consuming the same
   source-account `sequence` (a finalized conflicting spend) invalidates the pending original. This is
   the direct analogy to the Stellar criterion in Section 5.2.3, because Cosmos SDK transactions are
   ordered by account `sequence` and the standard tx format has no default mempool TTL.
4. **Genuine finite chain-native validity bound** — only if a real, documented finite validity bound
   applies to the deployed Cosmos SDK tx format (to be confirmed live, C5). If none exists, this branch
   is inactive and elapsed time / mempool disappearance / application-local timers NEVER clear a
   still-valid attempt.

Elasped time, mempool disappearance, "not seen within a window", and application-local timers are NOT
objective invalidation (Section 5.2.3) and do NOT clear a still-valid attempt.

## Finality gate (VF-XCH-006)

Issuance is authorized only when the block carrying the event is **finalized** (CometBFT commit: ≥2/3
validator voting power committed). Premature/unconfirmed/later-reversed events cannot authorize
issuance (VF-XCH-010). A reversal requires a >1/3 validator Byzantine fault (a chain-level hard-fork
equivalent, out of scope under VF-XCH-017).

## ICS-23 verification skeleton

`verifyExistence(proof, appHash, key, value)` recomputes the leaf/inner hash chain from a simplified
ICS-23 `ExistenceProof` (LeafOp hash of prefix||key||value, then InnerOp prefix||child||suffix up to
the root) and compares the recomputed root to the committed AppHash. This is a verifiable skeleton of
the standard leaf/inner hashing; the full proofs.io domain-separation and the validator-set/trusted
header commitment are production inputs pending the C3 build. A tampered value or key fails.

## Status (honest)

- Unit tests in `test.js` are executable with `node test.js` and were **run in the Base44 build
  environment** (Node v20.20.2). Pass/fail counts are reported in `COSMOS_HUB_BUILD_AND_TEST_REPORT.md`.
- This adapter is off-chain logic only; it does not replace the on-chain Rust mechanism or the
  production proof path (C3). It is not production-ready (VF-VER-007).