# Build Classification — Frozen v1

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
