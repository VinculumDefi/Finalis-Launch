# Vinculum Finalis Master Specification — Revision 11

**Date:** 2026-10-08

**Status:** Expansion record only. This is not a replacement for Revision 6. Revision 6 remains the governing specification. This file records what was actually built in October 2026 and sits beside Revision 6.

**Review:** Not reviewed by Claude. Not reviewed by ChatGPT. Not voted on by either.

---

## 1. Header

Revision 11, dated 2026-10-08. Not reviewed by Claude. Not reviewed by ChatGPT. Not voted on by either. Expansion record only.

## 2. Deployed Base contracts (chain id 8453)

| Contract | Address |
|---|---|
| VCLM | `0x26b54ca109db68cbd66603f437e6c583a8e5cf84` |
| CHONX | `0x13542f0F5E475D3857dd895c40b46366e9e4919c` |
| Base lock (CommitmentVaultLock) | `0x968BFD5b580144b4398C10BB1E61bD8A6B1aC946` |
| Batch verifier | `0xa159c98f3509648bFB8951AAbbDeFb244f077BC8` |
| Forge (VinculumFinalisSynth) | `0x7A2c77879F2D1f4526682Fa5109b99a75dA288f8` |
| Stake | `0xfa16a1cdA94DD772498144814c9e4d0d7C81a6eF` |
| Price fetcher | `0x60013cD1aF9e81B083aa13eCDe5F491771db0DB4` |
| Old verifier | `0x59E1093f0fD1A5731ACc7b3f261824cD6958c707` (unused, do not use) |

## 3. Batch verifier

`registerAssetPrecision` is written in batches of 50 per signature. 20 batches were written, 961 assets total. 39 dead rows and Cosmos were dropped. The old one-per-transaction verifier was abandoned.

## 4. Stablecoin floor

USDC and USDT use the same twice-daily scheduled price as other assets. Below $0.95, the asset is unavailable for a new valuation. Fail closed. No substitute $1. A lock already created keeps its creation price.

## 5. Durations

Durations are extended up to 10 years. There are sixteen durations, from the 1-hour Handshake to the 10-year vault.

## 6. Governance

Governance is stripped. Immutable auto-treasury. No admin keys. Hands-off model.

## 7. Multi-chain

Base, Solana, Cosmos, Zcash, Stellar, and the other environments in the 17-environment design.

## 8. Asset registry

1001 tokens, 961 writable.

## 9. Non-EVM Dev Funds

Printed, not written to the verifier, because the current verifier cannot hold them.

## 10. Framing

Gumball machine. Tokens exchange with no promises of value or upside, to avoid creating investment-contract expectations under the Howey test.

## 11. Known gap

The spec requires a proof package and Base verification before minting. The deployed Base44 page calls the lock contract directly and does not call `verifyAndMint`. A lock takes custody but the mint does not fire. This gap is recorded, not hidden. It is the next task.
