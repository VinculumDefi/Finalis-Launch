# Vinculum Finalis — Native XRPL Commitment Vault Lock

## Provenance

**Governing source:** Vinculum Finalis Master Specification, Revision 6 (2026-07-28)
**Governing source SHA-256:** `5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9`
**Requirements:** 209 total, per `Vinculum_Finalis_Requirement_Traceability.csv`
**Environment:** XRPL (Non-EVM, account-model with native Escrow)

## Architecture

The XRPL Commitment Vault Lock uses the XRP Ledger's native Escrow mechanism:

| Transaction | Purpose | Requirements |
|---|---|---|
| `Payment` | Routes the fee to the fixed Dev Fund destination in the original asset (XRP) | VF-FEE-001..006, VF-COM-004 |
| `EscrowCreate` | Locks the principal XRP until maturity (`FinishAfter`), with immutable lock metadata in Memos | VF-COM-016, VF-PRI-001, VF-XCH-005/011/013 |
| `EscrowFinish` | Permissionless release of principal to the bound destination after maturity | VF-PRI-002..006, VF-SEC-006 |

**`EscrowCancel` is never used** — VF-COM-016 explicitly requires the recognized design to remove the early-cancel path. No `CancelAfter` field is set on `EscrowCreate`.

## Atomicity (VF-COM-004, VF-XCH-005)

XRPL does not have native batch atomicity (all-or-nothing) in the EVM/Solana sense. The XRPL-native equivalent uses:

1. **Linked Sequence numbers**: `Payment` uses Sequence N, `EscrowCreate` uses Sequence N+1
2. **Shared LastLedgerSequence**: Both transactions expire together if not processed
3. If `Payment` fails (e.g., insufficient funds), `EscrowCreate` cannot execute (sequence gap blocks it)

This is classified as **DESIGN DEFINED — DEPLOYABILITY EVIDENCE REQUIRED** in the requirement traceability CSV (VF-COM-004, VF-XCH-005).

## Handshake Allowance (VF-COM-006, Section Q.2)

XRPL is classified alongside UTXO/Stellar for a **1-use** Handshake allowance:
- Only **one** qualifying Handshake per bound identity (XRPL account address)
- The official application must block the second qualifying attempt before broadcast (Q.4.2)
- The Base recognition path rejects the second qualifying Handshake by the same identity

This differs from Solana (3-use) because XRPL does not maintain the same type of atomic persistent per-identity on-chain state counter.

## Pending Attempt Resolution (§4.7)

XRPL has **three** terminal disposition paths:

| Disposition | Result | Requirement |
|---|---|---|
| Finalized success | RECOGNIZED | VF-COM-006 |
| Finalized failure | NOT_RECOGNIZED (no allowance consumed) | VF-COM-008 |
| LastLedgerSequence expiry | NOT_RECOGNIZED (objective invalidation) | VF-COM-007/008, VF-VER-003 |

Elapsed time, mempool disappearance, endpoint non-observation, or application timers **never** clear a still-valid pending attempt.

## Finality (VF-XCH-006/010)

XRPL ledgers are immutable once validated. A transaction is final when included in a `validated` ledger. There are no reorgs after validation.

## Asset Support (VF-SEC-001)

- **Native XRP**: Supported via `EscrowCreate` (principal custody) + `Payment` (fee routing)
- **IOU/issued currencies**: NOT supported by native Escrow. A different custody mechanism (e.g., PayChan or custom) would be required — deferred.

Amounts are specified in **drops** (1 XRP = 1,000,000 drops).

## File Structure

```
src/xrpl-lock/
├── package.json              # Project configuration
├── README.md                 # This document
├── tests/
│   └── escrow.test.js        # Integration tests (10 tests)
└── migrations/
    └── deploy-guide.md       # Deployment guide

src/lib/
├── vfXrplAuthority.js        # XRPL environment constants
├── vfXrplRegistry.js         # XRPL asset registry (XRP; full subset deferred)
├── vfXrplLockEngine.js       # Off-chain preflight validation engine
├── vfXrplMockAdapter.js      # Simulation adapter (XRPL dispositions)
└── vfXrplTransactionBuilder.js  # EscrowCreate/Payment/EscrowFinish construction

src/components/xrpl/
├── ProvenanceBanner.jsx      # Revision 6 authority + simulation status
├── TransactionStructure.jsx  # Transaction structure display
├── LockConfigForm.jsx        # Lock parameter configuration
├── PreflightPanel.jsx        # Preflight validation results
└── LifecyclePanel.jsx         # Lifecycle state machine controls

src/pages/
└── XrplLock.jsx               # Main XRPL lock interface

base44/functions/
└── xrplLedgerQuery/entry.ts   # Server-side XRPL RPC proxy (validated commitment)
```

## Deferred External Inputs

| Item | Status | Requirement |
|---|---|---|
| Dev Fund destination (XRPL r-address) | DEFERRED | VF-DEP-001, VF-FEE-004 |
| Canonical chain identifier (genesis ledger hash) | DEFERRED | VF-XCH-003 |
| Full XRPL asset registry subset | DEFERRED | VF-REG-001/011 |
| Deployed program/account address | DEFERRED | VF-DEP-005 |
| xrpl.js signing/serialization | NOT INSTALLED | Requires native environment |

## Build & Test Status

- **Build**: NOT EXECUTED — Base44 environment has no xrpl.js toolchain or XRPL CLI
- **Tests**: 10 integration tests written but NOT EXECUTED — require `node tests/escrow.test.js` with `xrpl` npm package installed
- **Backend function**: Deployed (`xrplLedgerQuery`) — authenticates users, proxies XRPL RPC with `validated` commitment
- **UI**: Functional — full lock lifecycle simulation with transaction object construction

## Requirement Coverage

See `src/solana-vault/TRACEABILITY_MATRIX.md` for the complete 209-requirement traceability matrix. XRPL-specific status:

- **VF-COM-001..026**: Same protocol constants as Solana; XRPL transaction construction differs
- **VF-COM-004**: DESIGN DEFINED (XRPL atomic batch — linked Sequence + shared LLS)
- **VF-COM-006**: 1-use allowance (Q.2 — UTXO/XRPL/Stellar family)
- **VF-COM-016**: RESOLVED — EscrowCancel removed from recognized design
- **VF-PRI-001..006**: Implemented via EscrowCreate (FinishAfter) + EscrowFinish
- **VF-SEC-006**: Permissionless EscrowFinish — callable by anyone
- **VF-XCH-005**: DESIGN DEFINED (XRPL atomic design)
- **VF-XCH-011**: All immutable facts stored in EscrowCreate Memos
- **VF-XCH-013**: Lock ID uniqueness via EscrowCreate (one escrow per owner+sequence)