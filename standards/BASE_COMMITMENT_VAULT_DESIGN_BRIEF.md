# Base Commitment Vault — Design Brief

**Version:** 1 (draft for review)
**Date:** 2026-08-15
**Behavioral reference:** `cosmos-hub-vault/contracts/vault/src/` (SHA-256 of
`contract.rs`: `fde115ae2c2ca07b5d1d304c6ff31e46a227920b0e54015a87dde86a142319f8`)
**Addresses:** CL-79
**Governed by:** Master Specification Revision 6; Verifier Completion Standard

> The Cosmos implementation is the **behavioral reference, not the structural
> template.** Solidity may realize the same guarantees differently where the
> platform provides better mechanisms. The Master Specification governs anything
> not visible in the Rust, including anything the Cosmos vault omits.

---

## 1. Protocol behaviors that must be preserved

### 1.1 Lock creation

A single call accepts the gross asset amount, splits the fee, transfers the fee
to the fixed Dev Fund destination, retains the principal, and records an
immutable lock record — all atomically.

| Behavior | Requirement |
|---|---|
| Duration | Must be one of the 16 permitted durations (§5.1). Any other value rejected. |
| Fee rate | 250 bps for the 3,600s Handshake; 500 bps for all standard durations. |
| Fee calculation | `fee = floor(gross * bps / 10000)` (VF-COM-011) |
| Principal | `principal = gross - fee` (VF-COM-012) |
| Zero guard | Reject if fee or principal computes to zero — **before any asset moves** (VF-COM-013) |
| Value bounds | Handshake: $0.95–$1.05 inclusive. Standard: ≥ $10.00 (VF-COM-003, VF-COM-009) |
| Lock ID | Globally unique per (environment, lock_id); reject duplicates (VF-XCH-013) |
| Base recipient | Nonzero, bound at creation, may differ from sender (VF-ARC-006) |
| Release destination | Bound at creation, immutable thereafter |
| CHONX output | Requires a non-empty activation receipt that is not the VCLM placeholder (VF-COM-025) |
| Handshake allowance | Enforced per bound identity; increments atomically on success (VF-COM-006/007) |

### 1.2 Principal release

| Behavior | Requirement |
|---|---|
| Permissionless | Callable by anyone (VF-PRI-002..006, VF-SEC-006) |
| Destination | Always the `release_destination` bound at creation, never the caller (VF-PRI-003) |
| Timing | Only at or after `maturity_time_secs` |
| Frequency | Exactly once; the `released` flag is the only mutable field |
| Independence | Depends on no price feed, no relayer, no administrator, no Base issuance state |

### 1.3 Immutability

Every field of a lock record is bound at creation and never mutated
(VF-ARC-005). `released` is the sole exception and transitions exactly once
(VF-PRI-002).

---

## 2. State that must exist

**Configuration**, set once at deployment: Dev Fund destination, source
environment identifier, and — new for Base — the approved asset set (see §5.2).

**Lock record**, the VF-XCH-011 immutable-fact schema:

```
lock_id, source_environment, source_account, canonical_asset,
gross_amount, fee_amount, principal_amount, verified_gross_usd_micro,
duration_secs, creation_time_secs, maturity_time_secs,
base_recipient, release_destination, output_token,
chonx_activation_receipt, released
```

**Lock storage**, keyed by lock ID.

**Handshake allowance counter**, keyed by bound identity.

---

## 3. Events that must be emitted

### `commit_vault_lock`

All sixteen lock-record fields, plus:
- `handshake_identity` — the bound identity tuple `(source_environment, source_account)`
- `handshake_allowance_count` — allowance consumed after this lock
- `fee_destination`
- `fee_transfer_evidence`

This event **is** the VF-XCH-011 evidence. Its completeness determines whether
a lock can be proven to the issuance contract. Any field omitted here cannot be
supplied later.

### `release_principal`

`lock_id`, `released_to`, `principal_amount`.

---

## 4. Security invariants

1. Fee routing, lock storage, and allowance increment commit together or revert
   together. No partial state.
2. All arithmetic checked; no unchecked overflow paths.
3. Zero fee or zero principal rejected before assets move.
4. Duplicate lock ID rejected before assets move.
5. Release is permissionless but the destination is not caller-controlled.
6. Release cannot occur twice.
7. Release cannot occur before maturity.
8. No administrator, no pause, no discretionary authority anywhere in either path.

---

## 5. CosmWasm-specific behaviors that must NOT be copied literally

### 5.1 Fund receipt and transfer — the reentrancy problem

The Cosmos vault reads `info.funds` (coins attached to the message) and sends
via `BankMsg::Send`, which the SDK executes after the handler returns. **Neither
mechanism exists on Base**, and the substitution introduces a class of risk
CosmWasm does not have.

Base must handle native ETH (`msg.value`) and ERC-20 (`transferFrom`), and every
ERC-20 transfer is an external call that can reenter. Requirements this creates
that have no Cosmos analogue:

- Checks-effects-interactions ordering in both `commit` and `release`.
- Reentrancy protection on both entry points.
- `SafeERC20`, since some tokens return no boolean.
- Fee-on-transfer and rebasing tokens: measure the balance delta actually
  received rather than trusting the requested amount, or reject such tokens at
  registration.

### 5.2 Single denom vs. 33 approved assets

Cosmos handles exactly one asset (`uatom`) and validates it by string equality.
Base has **33 approved assets** in the registry. The Solidity contract must
therefore enforce registry membership on-chain.

**This is not optional, and the reason is recorded in this project's own
findings.** CL-71 flags the Solana program for accepting any valid SPL mint with
no registry check: VF-ARC-004 requires a known-invalid request to be rejected
before assets move wherever the source environment can determine invalidity, and
registry membership is determinable at source. Combined with the non-refundable
fee rule (§5.2), a user who reaches the contract with an unapproved asset loses
5% irrevocably and receives nothing. Base must not repeat this.

### 5.3 Address validation

`addr_validate` performs bech32 checks that Solidity's `address` type makes
unnecessary. What remains necessary: nonzero checks on the Base recipient and
the release destination. Note the Cosmos contract validates a *foreign* address
format (EVM, 42 chars) for `base_recipient`; on Base that field is a native
`address`.

### 5.4 String-typed fields

`lock_id`, `canonical_asset`, and `chonx_activation_receipt` are strings in
CosmWasm. On Base, `bytes32` is cheaper and comparison-safe for the first two.
`canonical_asset` may be better represented as the token's `address`. The
event's emitted representation must still satisfy VF-XCH-011.

### 5.5 Non-production Dev Fund fixture

Cosmos embeds a fixture address rejected at instantiation on mainnet. The
pattern is sound and should carry over — a deployment gate that fails loudly on
the production chain rather than silently accepting a placeholder. The specific
bech32 derivation does not carry over.

---

## 6. Open questions requiring an operator decision

### 6.1 Isolation structure

The Cosmos vault is a **single contract holding all principal**, with per-lock
accounting via a `lock_id → Lock` map. Register v11 line 389 records the
topology test: *each lock's principal must be releasable at its own maturity
with no dependency outside that lock.* A per-lock architecture satisfies this by
construction; other architectures may satisfy it, but bear the burden of
demonstrating equivalent isolation.

**Observation, not conclusion:** the Cosmos implementation uses the shared-
balance form. Whether that was reviewed and accepted against line 389, or
predates it, is not established here. The Base structure — single contract,
factory with per-lock clones, or another form — should be chosen deliberately
rather than inherited.

### 6.2 Verified Gross USD value: asserted or derived?

In Cosmos, `verified_gross_usd_micro` is **supplied by the caller** as a
parameter. Cosmos has no on-chain price oracle, so assertion is the only option
available there.

**Base is different.** `VinculumFinalisVerifier` already holds oracle-signed
price records with `ecrecover` authentication. A Base vault could *derive* the
USD value from an authenticated price rather than accept the caller's claim.

Given that the value bounds are consensus-critical — they gate Handshake
qualification and the $10 standard minimum — deriving it on Base would be
strictly stronger, and would avoid importing an assertion-based pattern into the
one environment that does not need it.

### 6.3 Handshake allowance count

VF-COM-006 sets the allowance by the source mechanism's state capability: three
uses for a mechanism with persistent atomic state, one otherwise. Solidity has
persistent atomic state, which indicates **three**. Confirmation is an operator
decision, since it is a protocol parameter rather than an implementation detail.

---

## 7. What this brief does not cover

The Base **verifier** is out of scope here. Once this contract exists and emits
`commit_vault_lock`, the same-chain verifier can read lock state directly and
becomes implementable under the Verifier Completion Standard. That is a separate
deliverable.
