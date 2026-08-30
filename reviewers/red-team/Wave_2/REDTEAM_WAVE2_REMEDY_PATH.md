# Vinculum Red Team — Wave 2 Opening Note · Remedy Path

**Tree:** `github.com/VinculumDefi/Finalis-Launch` @ `redteam/prep`
**Contracts verified at:** `bff9190` — byte-identical to HEAD (`git diff HEAD origin/redteam/prep -- base-contracts/contracts/` is empty)
**Scope:** Determine whether extending `IChainVerifier.extractFacts` is a sufficient remedy for W1-01, W1-02, W1-05 and W1-09.
**Date:** 30 August 2026
**Status:** Source read. **No implementation.** No finding closed.

---

## Question

Wave 1 established that `extractFacts` returns seven facts where VF-XCH-011
requires evidence to bind nineteen. The proposed remedy was to extend the
interface. This note asks whether that remedy is sufficient, or whether the
source events themselves cannot supply the missing fields.

Answered by reading source, not by inference from the Evidence Index.

---

## Finding: the vault already binds the VF-XCH-011 identity — in a second event

`VinculumFinalisEvmVault` emits **two** logs per lock.

```solidity
// The lock event. Order and indexing are load-bearing.
event CommitVaultLock(
    bytes32 indexed lockId,
    uint256 grossAmount,        // word 0
    uint256 feeAmount,          // word 1
    uint256 principalAmount,    // word 2
    uint256 durationSecs,       // word 3
    uint256 creationTimestamp,  // word 4
    uint256 maturityTimestamp   // word 5
);

// Fields the verifiers do not read, emitted for observability and
// for the Base-side cross-check (VF-XCH-011).
event CommitVaultLockDetail(
    bytes32 indexed lockId,
    string  sourceEnvironment,
    address indexed sourceAccount,
    bytes32 indexed canonicalAssetId,
    address asset,
    address lockContract,
    address baseRecipient,
    address releaseDestination,
    uint8   outputToken,
    bytes32 chonxActivationReceipt,
    uint32  handshakeAllowanceCount,
    address feeDestination
);
```

The second event's own comment names VF-XCH-011 as its purpose. **The vault did
its part.** The identity is bound on the source chain, in the same transaction,
emitted from storage so the event and the record cannot disagree.

The Base-side verifiers never open it. `EvmReceipt.findLog(receipt, emitter,
topic0)` matches a single `topic0`, and every EVM verifier passes the
`CommitVaultLock` topic. `CommitVaultLockDetail` sits in the same receipt,
unread.

This is a wiring gap, not a missing capability. The defect is narrower than
Wave 1 assumed.

---

## The identity fields are reachable with the accessors that already exist

`CommitVaultLockDetail` indexes three fields, so those become topics. The
remaining nine encode head-first, and ABI head entries are fixed-width even when
the value is dynamic — `sourceEnvironment` occupies word 0 as an offset pointer
and every field after it sits at a predictable index.

| Field | Location | Accessor |
|---|---|---|
| `lockId` | topic 1 | `EvmReceipt.topic(lg, 1)` |
| `sourceAccount` | topic 2 | `EvmReceipt.topic(lg, 2)` |
| `canonicalAssetId` | topic 3 | `EvmReceipt.topic(lg, 3)` |
| `sourceEnvironment` | word 0 → tail | not needed — the verifier knows its own environment |
| `asset` | word 1 | `EvmReceipt.word(lg, 1)` |
| `lockContract` | word 2 | `EvmReceipt.word(lg, 2)` |
| **`baseRecipient`** | **word 3** | `EvmReceipt.word(lg, 3)` |
| **`releaseDestination`** | **word 4** | `EvmReceipt.word(lg, 4)` |
| **`outputToken`** | **word 5** | `EvmReceipt.word(lg, 5)` |
| `chonxActivationReceipt` | word 6 | `EvmReceipt.word(lg, 6)` |
| `handshakeAllowanceCount` | word 7 | `EvmReceipt.word(lg, 7)` |
| `feeDestination` | word 8 | `EvmReceipt.word(lg, 8)` |

No new RLP work. No offset-following. No change to `EvmReceipt.sol`. The only
dynamic field is the one nobody needs.

**W1-09 needs nothing new whatsoever.** `creationTimestamp` is already `word(4)`
of `CommitVaultLock`, already extracted by every EVM verifier, and already
returned by `extractFacts`. `verifyAndMint` discards it with a bare comma at
`VinculumFinalisVerifier.sol:820`. That fix is one destructuring position and one
equality check.

---

## Chosen path

**Path A — read the Detail log the vault already emits.**

Each EVM verifier performs a second `findLog` against the
`CommitVaultLockDetail` topic in the same receipt it has already decoded, and
returns the identity fields alongside the existing six.

**Path B — move identity into `CommitVaultLock`'s data words — is rejected.**
It breaks a load-bearing layout, every verifier's `word(lg, n)` indices, and
`22_evm_vault`'s assertion that the vault *"emits exactly the six data words in
the order `EvmReceipt` expects."* Path A leaves that test true.

**Constraint that survives either path:** `22_evm_vault` must continue to pass
unchanged. If a proposed patch requires editing it, the patch is Path B wearing
Path A's name.

---

## Corrected field set

Wave 1 and Evidence Index v5 both name **seven** returned facts including
`verifiedGrossUsd`. That is wrong and is corrected here.

`VinculumFinalisEvmVault` computes no USD value, deliberately — valuation lives
on Base under VF-ORC-007. Neither event carries it, and no source event can.

```
RETURNED FACTS (added to IChainVerifier.extractFacts)
  canonicalAssetId
  baseRecipient
  releaseDestination
  outputToken
  creationTimestamp     — already returned; must stop being discarded
  maturityTimestamp     — already returned; must stop being discarded

VALUATION RULE (Base-side, not a returned field)
  verifiedGrossUsd is derived on Base from the returned canonicalAssetId,
  the cross-checked gross amount, and the price record selected by the
  Valuation Timestamp — which is the finalized source block containing the
  lock (VF-ORC-011). Never live at mint time (VF-ORC-010), never from the
  package (VF-ORC-012).
```

Six returned facts and one rule, not seven fields.

**Consequence for W1-05:** it does not close by extending the interface alone.
It closes when the Base-side valuation stops recomputing from the current price
record and starts selecting the record at the Valuation Timestamp. Same commit,
different mechanism.

---

## Implementers affected

Eleven contracts implement `IChainVerifier`:

| Implementer | Cost of Path A |
|---|---|
| `BaseSameChainVerifier` | Trivial — already reads the full `LockRecord` into memory at `:114–140` and discards these fields. Return them. |
| `EthereumChainVerifier` | Second `findLog`, six accessor calls. |
| `PolygonChainVerifier` | Same pattern. |
| `ArbitrumChainVerifier` | Same pattern. |
| `OpStackFaultProofVerifier` | Same pattern. |
| `EvmChainVerifier` (BNB, Avalanche) | Same pattern — currently fail-closed. |
| `UtxoChainVerifier` | **Open question.** It already exposes `releasePubKeyHash` as the handshake identity, so identity extraction from a witness script is established practice. Whether a Bitcoin lock script commits `baseRecipient` and `outputToken` is not answered by this note. |
| `SolanaChainVerifier`, `StellarChainVerifier`, `XrplChainVerifier` | Stubs. Signature must compile; fail-closed return is correct behaviour. |
| `MockChainVerifier` | Test double. Must move with the interface. |

---

## Precedent worth noting: CL-81 already fixed half of this problem

The interface header records that `extractFacts` was previously declared `pure`,
and was changed to `view` because:

> A pure function cannot read storage and cannot call another contract, so no
> implementation could establish anything beyond decoding its own argument — the
> interface made caller-trust mandatory rather than merely convenient.

That is the identical reasoning as W1-01 and W1-02, applied to mutability rather
than to the return set. Somebody had already seen that this interface forced
caller-trust and fixed the half they noticed. The return set is the other half.

---

## What this note does not establish

- No patch is written and no finding is closed.
- Whether UTXO source scripts commit `baseRecipient` and `outputToken` is not answered. That is the next open question, and it may be a specification matter rather than an implementation one.
- The Solana, XRPL, Stellar and Cosmos vaults were not read.
- Gas cost of a second `findLog` per verification was not measured. `13_base_e2e` records same-chain `verifyAndMint` at 223,880 gas as a baseline.
- No adversarial test exists yet for the remote EVM doors. Wave 1's shape — a real lock plus a package that disagrees with it on an identity field — should be written against `EthereumChainVerifier` before any patch.

---

## Recommended sequence

1. Write the failing tests for the remote EVM path, same shape as Wave 1.
2. Extend `IChainVerifier` with the six facts.
3. `BaseSameChainVerifier` first — it is four lines and makes the existing eight failures pass.
4. The four written EVM verifiers via Path A.
5. Stubs: signature only, fail-closed.
6. Base-side valuation rule for W1-05.
7. `MockChainVerifier` and any test double.
8. Re-run the full suite. `22_evm_vault` must pass unedited.

---

*Sources: `VinculumFinalisEvmVault.sol:130–175, 345–370`,
`libraries/EvmReceipt.sol:93–120`, `interfaces/IChainVerifier.sol`,
`chain-verifiers/EthereumChainVerifier.sol:147–152`,
`chain-verifiers/BaseSameChainVerifier.sol:114–140`,
`chain-verifiers/UtxoChainVerifier.sol:136–186`, Rev 6 VF-XCH-005/011/012 and
VF-ORC-009/010/011/012. Contracts confirmed unchanged between `bff9190` and HEAD.*
