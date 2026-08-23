# Build Classification — Frozen v1

> **SUPERSEDED IN SCOPE — read the correction below before relying on this.**

**Date:** 2026-08-22
**Basis:** Architecture Design C.1–C.17 status lines; repository contract and
directory listing at commit `a086746`.

> **This classification may be changed only by new repository evidence or
> changes to the governing artifacts. It shall not be revised by inference,
> recollection, or speculative implementation ideas.**

---

## The question this table answers

For each environment: **is protocol code missing?**

Not "could something be improved." Not "what would be nice to have." Only
whether a protocol component required by Revision 6 is absent from the
repository.

Two answers are possible, and they are not the same thing:

**Case 1 — code is missing.** The architecture specifies a component, the
component does not exist, writing it resolves the gap.

**Case 2 — the architecture has not established deployability.**
`DESIGN DEFINED — DEPLOYABILITY EVIDENCE REQUIRED` means the architecture has
not established that a deployable mechanism exists on the target chain.
Writing code does not resolve this. The missing input is evidence or a
platform capability, not an implementation.

---

## Classification

| Environment | Protocol code missing? | Missing component |
|---|---|---|
| Base | **No** | — |
| Ethereum | **No** | — |
| Polygon | **No** | — |
| Arbitrum | **No** | — |
| Optimism | **No** | — |
| BNB | No | Verification DESIGN DEFINED (C.2). Source built. |
| Avalanche | No | Verification DESIGN DEFINED (C.3). Source built. |
| Solana | No | Verification DESIGN DEFINED (C.9). Source built. |
| Bitcoin | No | Source mechanism DESIGN DEFINED (C.8). Verifier built. |
| Bitcoin Cash | No | Source mechanism DESIGN DEFINED (C.17). Verifier built. |
| Litecoin | No | Source + verification DESIGN DEFINED (C.13) |
| Dogecoin | No | Source + verification DESIGN DEFINED (C.14) |
| DigiByte | No | Source + verification DESIGN DEFINED (C.15) |
| Zcash | No | Source + verification DESIGN DEFINED (C.16) |
| Stellar | No | Source + verification DESIGN DEFINED (C.11) |
| XRP Ledger | No | Source + verification DESIGN DEFINED (C.10) |
| Cosmos Hub | No | EVIDENCE REQUIRED — CHAIN-NATIVE FEASIBILITY ANALYSIS INCOMPLETE (C.12) |

**The Case 1 queue is empty.** No environment is blocked by missing protocol
code.

---

## What is built

The protocol is not measured in environments. These components are
environment-independent and complete:

| Component | Implementation |
|---|---|
| Issuance and verification | `VinculumFinalisVerifier` |
| Lifetime-cap accounting (BASE-CAP, A.12) | `VinculumFinalisCap` |
| Tokens | `VinculumFinalisToken` |
| Staking, epochs, rewards, RAC | `VinculumFinalisStake` |
| SYNTH forge | `VinculumFinalisSynth` |
| Base source vault | `VinculumFinalisBaseVault` + `CommitmentLock` |
| EVM source vault (six environments) | `VinculumFinalisEvmVault` |
| Cosmos source vault | `cosmos-hub-vault/` |
| Solana source program | `solana-vault/programs/vf-solana-vault/` |
| Verifier framework | `IChainVerifier` + six implementations |
| Proof libraries | `MerklePatriciaProof`, `EvmReceipt`, `BitcoinTx` |
| Light clients | `L1BlockRegistry`, `Sha256dHeaderChain` |

**Suite: 292 passing, 0 failing** (`evidence/CL84_BASE_CAP_2026-08-22.txt`).

## Operational environments

**Base, Ethereum, Polygon, Arbitrum, Optimism** — a user can lock and mint on
each today. Both halves exist: a source lock and a Base-side verifier.

This is deployment scope, not protocol completeness. The protocol's economics,
issuance, accounting, staking, rewards, activation and conversion do not vary
by environment and are complete for all seventeen.

---

## What the remaining environments need

Not code. Each needs the architecture to establish that a deployable mechanism
exists — the CODA analysis C.12 describes: current authoritative evidence of
chain capabilities, every credible chain-native candidate, deployability
verification, adversarial testing, and a precise explanation where a candidate
fails a mandatory invariant.

That is analysis and evidence, not implementation.

---

## Consequence

**No protocol construction remains that the governing artifacts authorize.**

The next phase is auditing what has been built, not finding more to build.


---

## SCOPE CORRECTION — added 2026-08-22, same day

**This document classified environments only. It did not classify components,
and its conclusion was stated more broadly than its evidence supported.**

The table below answers: *for each of the seventeen environments, is protocol
code missing?* That question was answered correctly from the C.1–C.17 status
lines, and those rows stand.

What it did **not** ask is whether every architecture component A.1–A.21 is
implemented. Immediately after this document was frozen, four components were
raised as possibly missing — `A.5 PRICE-FETCH`, `A.6 PRICE-DELIVER`,
`A.7 SRC-EVID`, `A.8 RELAY` — none of which appears anywhere in the table.

**Those four were then checked against the repository and the governing
artifacts. All four are resolved:**

| Component | Finding |
|---|---|
| A.5 `PRICE-FETCH` | Implemented — `scripts/vinculum_price_fetcher_v9.py`, `base44/functions/fetchAssetPrice` |
| A.6 `PRICE-DELIVER` | Implemented — `src/lib/vfPriceService.js` and the Base receiver `submitPriceBatch` |
| A.7 `SRC-EVID` | Implemented — `src/lib/vfProofNormalizer.js`, whose header cites *"SRC-EVID + BASE-VERIFY"* |
| A.8 `RELAY` | No implementation required. Every requirement is a prohibition — VF-XCH-012, VF-SEC-005, VF-XCH-017 — already satisfied on-chain. Submission is permissionless by construction. |

**The reason they were raised at all** is that the reviewer read the commit
history, saw only Solidity, and inferred absence. The repository contains
6,201 lines in `src/lib/` alone, plus Rust, CosmWasm, Python and serverless
functions. **Implementation is not synonymous with Solidity.**

### Governing scope

For **environments**, this document remains authoritative.

For **components**, the authoritative artifact is
`standards/COMPONENT_IMPLEMENTATION_INVENTORY_v1.md`, which maps every
architecture component to its implementation across all languages and marks
each row verified or present-but-unexamined.

**Neither document alone answers "is the build complete."** Read both.

### What remains open after both

Not construction. Verification: 33 of the 36 `src/lib` modules have not been
read, and the production-versus-simulation status of `vfVerifierEngine.js` and
`vfProofAdapter.js` is unestablished — the latter is explicitly marked
RED-TEAM / NON-PRODUCTION.
