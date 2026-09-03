# Wave 2 — Architectural Assessment

**Tree:** `github.com/VinculumDefi/Finalis-Launch` @ `redteam/prep`
**Contracts verified at:** `bff9190`, confirmed byte-identical to `f8ed0ea`
**Date:** 30 August 2026
**Status:** Assessment. No implementation, no patch, no finding closed.

Supersedes `REDTEAM_WAVE2_REMEDY_PATH.md`, which is removed. Its content is
carried forward here.

---

## 1 · Question

Is the interface expansion proposed by Wave 1 the architecturally correct
remedy for W1-01, W1-02, W1-05 and the emission-rate vector?

The question is deliberately not "how do we fix it." Contracts intended to
become immutable get one deployment.

---

## 2 · Evidence reviewed

| Source | Read for |
|---|---|
| Rev 6 §11.2, §11.3 — VF-XCH-005/006/007/011, VF-ORC-007/009/010/011/012 | What the specification requires, and what it delegates |
| `interfaces/IChainVerifier.sol` | Return set, mutability, CL-81 provenance note |
| `chain-verifiers/BaseSameChainVerifier.sol` | Same-chain extraction |
| `EthereumChainVerifier.sol`, `PolygonChainVerifier.sol`, `ArbitrumChainVerifier.sol`, `OpStackFaultProofVerifier.sol` | Extraction pattern across four trust chains |
| `VinculumFinalisEvmVault.sol` | What the source event actually contains |
| `libraries/EvmReceipt.sol` | `findLog`, `word`, `topic` |
| `chain-verifiers/UtxoChainVerifier.sol` | Non-EVM extraction |
| `Vinculum_Finalis_Architecture_Design.md` C.8, C.11, C.13–C.17 | Chain-specific mechanisms |

---

## 3 · Observations

**3.1 — The EVM extraction pattern is uniform.** Each of the four verifiers
resolves a proven receipt through its own trust chain — `L1BlockRegistry`, a
Heimdall checkpoint, a confirmed Arbitrum assertion, a resolved OP-Stack dispute
game — then converges on three identical lines: `EvmReceipt.status`,
`EvmReceipt.findLog(receipt, sourceVault, lockEventTopic)`, and
`EvmReceipt.word(lg, 0..5)`.

The trust chains differ. The extraction does not. This is one extraction model
behind four proof front-ends, not four independent implementations.

**3.2 — The source vault already emits the omitted facts.**
`VinculumFinalisEvmVault` emits two logs per lock. `CommitVaultLock` carries the
six numeric words the verifiers read. `CommitVaultLockDetail` carries
`canonicalAssetId`, `baseRecipient`, `releaseDestination`, `outputToken`,
`sourceAccount`, `handshakeAllowanceCount` and the fee destination — and its
comment in the vault names VF-XCH-011 as its purpose.

The verifiers never open it. `findLog` matches a single `topic0`, and all four
pass the `CommitVaultLock` topic. The identity is bound at the source and
discarded at the boundary.

Field positions, verified: `canonicalAssetId` is `topic(3)`, `baseRecipient` is
`word(3)`, `releaseDestination` `word(4)`, `outputToken` `word(5)`. ABI head
entries are fixed-width even for dynamic types, so the leading
`string sourceEnvironment` occupies word 0 as an offset pointer and does not
displace what follows. No change to `EvmReceipt.sol` is implied.

**3.3 — `BaseSameChainVerifier` already holds the omitted facts.** It reads the
full `LockRecord` into memory and returns seven of its fields.

**3.4 — Fact validation at the verifier layer is established practice.** All
four EVM verifiers reject `maturityTimestamp <= creationTimestamp`. They already
validate a relationship between facts they return. The proposal extends an
existing responsibility rather than introducing a new one.

**3.5 — The reviewed UTXO architecture specifies no source-side identity
binding.** The current reviewed UTXO design does not presently specify a
source-side mechanism that binds the Base recipient and related cross-chain
identity fields required by VF-XCH-011. C.8's mechanism is a fee output, a P2WSH
CLTV principal output, and change — none carries a Base recipient or output
token. C.8 states that Bitcoin Script cannot verify the Base recipient on-chain
and defers preflight to Base; deferring verification does not supply the value.

C.11 Stellar solves the same problem within the same document, using a
transaction `Memo` binding lock id, Base recipient, output token, asset identity
and valuation reference. C.13–C.17 inherit the C.8 pattern.

**3.6 — Rev 6 delegates mechanism to the architecture.** §11.2: *"The
specification fixes the required outcome and allows the architecture to define
the concrete chain-specific method."* A search of Rev 6 for `OP_RETURN`, `P2WSH`,
`CLTV`, `Memo`, `claimable balance` and `witness script` returns no mechanism for
any environment.

Consequently 3.5 is an incompleteness in
`Vinculum_Finalis_Architecture_Design.md` C.8 measured against VF-XCH-007, which
requires the architecture to document the exact condition for all seventeen
environments before implementation. It is not a Master Specification revision.

**3.7 — Valuation conformance is lost at the consumer boundary, not the source.**
`VinculumFinalisEvmVault` deliberately computes no USD, citing VF-ORC-007,
VF-ORC-011 and VF-ORC-012 by number. `VinculumFinalisVerifier` then recomputes
valuation from the current price record, which VF-ORC-010 forbids. The vault
conforms; the consumer does not. No source-side change addresses this.

---

## 4 · Assessment

**The architectural deficiency is that the independently verified immutable
facts available to the consumer do not match the evidence field set Rev 6
requires the consumer to validate.**

W1-01, W1-02, W1-05 and the emission-rate vector are evidence of that single
deficiency rather than four independent defects.

**The reviewed evidence supports the proposed architectural direction.** The interface's own header records
that CL-81 changed `extractFacts` from `pure` to `view` because *"the interface
made caller-trust mandatory rather than merely convenient."* Extending the
return set applies the same reasoning to the same interface. Nothing in the four
verifiers, the vault, or the receipt library contradicts it.

### 4.1 Supported scope

Base, Ethereum, Polygon, Arbitrum, OP-Stack, and the fail-closed
`EvmChainVerifier` environments. Solana, per the component inventory, verifies
the Base recipient on-chain; not read this wave.

### 4.2 Unsupported scope

The six UTXO environments, for the reason at 3.5. An interface expansion cannot
surface facts a source transaction does not carry.

### 4.3 Scope corrections carried forward

Six returned facts, not seven — `canonicalAssetId`, `baseRecipient`,
`releaseDestination`, `outputToken`, `creationTimestamp`, `maturityTimestamp`.

`verifiedGrossUsd` cannot be returned by any source verifier, because no source
vault computes USD by design. VF-ORC-010 conformance is a Base-side valuation
rule, not a returned field.

### 4.4 Constraint on any implementation

`22_evm_vault` asserts the vault *"emits
exactly the six data words in the order `EvmReceipt` expects."* That test must
pass unedited. A patch requiring it to change is altering the source event
rather than reading the second log, which the vault's own header identifies as
load-bearing.

---

## 5 · Out of scope

- Implementation and contract modification of any kind.
- Amendment of `Vinculum_Finalis_Architecture_Design.md` C.8.
- Solana, Stellar, XRP Ledger and Cosmos Hub verifier or vault source.
- Gas cost of a second `findLog`. `13_base_e2e` records same-chain
  `verifyAndMint` at 223,880 gas as a baseline.
- Whether the four remote EVM doors need their own adversarial tests before
  patching. `26_w2_remote_evm_identity` covers Ethereum only.

---

## 6 · What Wave 2 accomplished

Wave 2 did not discover a contradictory architecture. It reduced uncertainty
around Wave 1's proposed direction, narrowed its scope twice, and identified one
architecture-document incompleteness without requiring a Master Specification
revision.

Specifically: the remedy went from seven returned facts to six plus a Base-side
valuation rule; the identity fields turned out to be already emitted by the
source vault and discarded at the boundary; the four Wave 1 findings resolved
into evidence of one architectural deficiency; and the UTXO gap was traced to
C.8 of the architecture document rather than to Rev 6 or to any limitation of
the environments themselves.

---

**Wave 2 closes here.** No finding is closed and no code has changed. The next
phase is implementation, and its first act should be the regression tests that
fail against the current tree.
