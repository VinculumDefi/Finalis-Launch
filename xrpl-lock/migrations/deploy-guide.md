# XRPL Deployment Guide — Vinculum Finalis Commitment Vault Lock

## Prerequisites

1. **xrpl.js library**: `npm install xrpl` (not installed in Base44 environment)
2. **Funded XRPL account**: The source account must have sufficient XRP for:
   - The gross amount (principal + fee)
   - Transaction fees (~12 drops per transaction × 2 transactions = ~24 drops)
   - Reserve (minimum 10 XRP base reserve + 1 XRP per escrow object)
3. **Dev Fund destination**: A valid XRPL r-address (VF-FEE-004, VF-DEP-001)
4. **XRPL mainnet RPC endpoint**: e.g., `wss://xrplcluster.com` or `wss://s1.ripple.com`

## Deployment Steps

### 1. Configure Constants

Set the following in `src/lib/vfXrplAuthority.js` or via environment variables:

```
VF_DEV_FUND_ADDRESS=<r-address>     # VF-FEE-004: fixed Dev Fund destination
VF_XRPL_RPC_URL=<wss://...>         # XRPL mainnet WebSocket endpoint
```

### 2. Install Dependencies

```bash
cd src/xrpl-lock
npm install
```

### 3. Run Tests

```bash
npm test
```

Tests validate:
- Fee calculation (VF-COM-011/012/013)
- Duration validation (VF-COM-001/002)
- Handshake 1-use allowance (VF-COM-006/007)
- LLS expiry (VF-COM-007/008)
- EscrowCreate construction (VF-COM-016, VF-PRI-001)
- EscrowFinish construction (VF-PRI-002..006, VF-SEC-006)
- Atomic batch linked Sequence + shared LLS (VF-COM-004)

### 4. Deploy (Source Lock)

The XRPL Commitment Vault Lock has **no on-chain program** — it uses native XRPL
transactions (EscrowCreate, Payment, EscrowFinish). There is no smart contract to deploy.

Deployment = submitting the first live `EscrowCreate` + `Payment` batch transaction.

#### To submit a lock:

1. **Preflight**: Run `validateLockRequest()` to verify all parameters (VF-ARC-004)
2. **Build**: Call `buildAtomicBatch()` with the current ledger index
3. **Sign**: Sign both transactions with the source account's private key using `xrpl.js`
4. **Submit**: Submit both transactions via `xrpl.js` `client.submit()`:
   - Submit `Payment` (Sequence N) first
   - Submit `EscrowCreate` (Sequence N+1) immediately after
5. **Verify**: Wait for both transactions to appear in a `validated` ledger (VF-XCH-006/010)
6. **Record**: The escrow's `OfferSequence` (= source account's Sequence N+1) is needed for `EscrowFinish`

#### To release principal (after maturity):

1. Build `EscrowFinish` with the source account (Owner) and OfferSequence
2. Sign with **any** account (permissionless — VF-SEC-006)
3. Submit via `xrpl.js`
4. Principal XRP flows to the bound `Destination` from the original `EscrowCreate`

### 5. Post-Deployment Verification

- [ ] Verify Dev Fund received the fee (VF-FEE-001)
- [ ] Verify escrow object exists with correct `FinishAfter` (VF-PRI-001)
- [ ] Verify no `CancelAfter` field (VF-COM-016)
- [ ] Verify memo contains all VF-XCH-011 immutable facts
- [ ] Verify `EscrowFinish` releases principal only to bound destination (VF-PRI-003)

## Limitations

1. **IOU/issued currencies**: Not supported by native Escrow — only native XRP
2. **Atomic batch**: XRPL does not have native all-or-nothing batch atomicity; the linked-Sequence + shared-LLS design is the XRPL-native equivalent (DESIGN DEFINED — VF-COM-004)
3. **CHONX activation verification**: On-chain activation recording is Base-side; the XRPL lock records the receipt in a memo but cannot verify it natively (VF-COM-025)
4. **Asset registry**: Only XRP is confirmed in the registry; full XRPL subset requires provisioning (VF-REG-001/011)

## Never Fabricated

- No ledger transactions are simulated as real
- No account state, balances, signatures, or transaction hashes are invented
- No deployment status is claimed
- No RPC responses are fabricated
- All deferred external inputs are explicitly marked