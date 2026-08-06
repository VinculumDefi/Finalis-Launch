// =============================================================================
// XRPL Transaction Builder — Native Escrow-based Commitment Lock
//
// PROVENANCE: Revision 6 protocol + XRPL transaction specification.
//
// XRPL mechanism:
//   - EscrowCreate: locks principal XRP until FinishAfter (maturity)
//   - Payment: routes fee to Dev Fund (same asset, original form)
//   - EscrowFinish: permissionless release of principal to bound destination
//   - NO EscrowCancel (VF-COM-016: no early cancel)
//
// VF-COM-004: "Handshake fee routed within the chain-native atomic construction"
//   → Payment + EscrowCreate submitted with linked Sequence numbers and a shared
//     LastLedgerSequence (DESIGN DEFINED — XRPL atomic batch/design per CSV)
//
// VF-XCH-005: "Source binds user/principal-release dest/asset/amount/creation/maturity
//   within the chain-native atomic construction" — escrow terms are immutable after creation.
//
// VF-COM-016: "No early release; XRPL recognized design must remove EscrowCancel
//   early-cancel path" — CancelAfter is omitted; no EscrowCancel transaction is built.
// =============================================================================

import {
  XRPL_DROPS_PER_XRP,
  XRPL_EPOCH_OFFSET,
  XRPL_BASE_FEE_DROPS,
  XRPL_DEFAULT_LLS_MARGIN,
  computeFinishAfter,
} from './vfXrplAuthority';
import { validateXrplAddress, validateBaseRecipient, buildHandshakeIdentity } from './vfXrplLockEngine';

// ---------------------------------------------------------------------------
// Lock metadata (stored in EscrowCreate Memos — VF-XCH-011 immutable facts)
// ---------------------------------------------------------------------------

/**
 * Builds the memo payload containing all VF-XCH-011 immutable-facts fields.
 * These are stored as a JSON object in the EscrowCreate MemoData field.
 *
 * @param {object} params - Lock parameters
 * @returns {object} Memo object in XRPL format
 */
export function buildLockMemo(params) {
  const metadata = {
    source_environment: 'XRPL',
    lock_id: params.lockId,
    canonical_asset: 'XRP',
    source_account: params.sourceAccount,
    gross_amount: String(params.grossAmount),
    fee_amount: String(params.feeAmount),
    principal_amount: String(params.principalAmount),
    verified_gross_usd_micro: String(params.verifiedGrossUsdMicro),
    duration_secs: String(params.durationSecs),
    creation_time_secs: String(params.creationTimeSecs),
    maturity_time_secs: String(params.maturityTimeSecs),
    base_recipient: params.baseRecipient,
    release_destination: params.releaseDestination,
    output_token: params.outputToken,
    fee_destination: params.devFundDestination || 'DEFERRED_EXTERNAL_INPUT',
    chonx_activation_receipt: params.chonxActivationReceipt || 'not_applicable',
    handshake_identity: buildHandshakeIdentity(params.sourceAccount),
    handshake_allowance_count: 1, // VF-COM-006: 1-use for XRPL (Section Q.2)
  };

  // XRPL memos use hex-encoded data
  function toHex(str) {
    return Array.from(str)
      .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }
  const jsonStr = JSON.stringify(metadata);
  const hexData = toHex(jsonStr);

  return {
    Memo: {
      MemoType: toHex('VF_LOCK_METADATA'),
      MemoData: hexData,
      MemoFormat: toHex('application/json'),
    },
  };
}

// ---------------------------------------------------------------------------
// Fee Payment Transaction (VF-FEE-001..006)
// ---------------------------------------------------------------------------

/**
 * VF-FEE-001/002/004: Builds a Payment transaction routing the fee to the
 * fixed Dev Fund destination in the original asset (native XRP / drops).
 *
 * @param {object} params
 * @param {string} params.sourceAccount - XRPL r-address
 * @param {BigInt|number|string} params.feeAmount - Fee in drops
 * @param {string} params.devFundDestination - Dev Fund XRPL r-address
 * @param {number} params.sequence - Account sequence number
 * @param {number} [params.lastLedgerSequence] - LLS for expiry binding
 * @returns {object} XRPL Payment transaction JSON
 */
export function buildFeePaymentTransaction({
  sourceAccount,
  feeAmount,
  devFundDestination,
  sequence,
  lastLedgerSequence,
}) {
  if (!validateXrplAddress(sourceAccount)) throw new Error('Invalid source XRPL address');
  if (!validateXrplAddress(devFundDestination)) throw new Error('Invalid Dev Fund XRPL address');
  if (BigInt(feeAmount) <= 0n) throw new Error('VF-COM-013: fee must be positive');

  return {
    TransactionType: 'Payment',
    Account: sourceAccount,
    Amount: String(feeAmount), // drops as string
    Destination: devFundDestination,
    Sequence: sequence,
    LastLedgerSequence: lastLedgerSequence || null,
    Fee: XRPL_BASE_FEE_DROPS,
    SigningPubKey: '', // Set during signing
  };
}

// ---------------------------------------------------------------------------
// EscrowCreate Transaction (VF-COM-016: NO CancelAfter)
// ---------------------------------------------------------------------------

/**
 * VF-COM-016 / VF-PRI-001: Builds an EscrowCreate transaction that locks
 * the principal XRP until maturity (FinishAfter). No CancelAfter is set —
 * the recognized design removes the early-cancel path entirely.
 *
 * @param {object} params
 * @param {string} params.sourceAccount - XRPL r-address (source/owner)
 * @param {BigInt|number|string} params.principalAmount - Principal in drops
 * @param {string} params.releaseDestination - Bound release destination (XRPL r-address)
 * @param {number} params.finishAfter - XRPL epoch seconds (maturity time)
 * @param {number} params.sequence - Account sequence number
 * @param {number} [params.lastLedgerSequence] - LLS for expiry binding
 * @param {object} [params.memo] - Lock metadata memo (from buildLockMemo)
 * @returns {object} XRPL EscrowCreate transaction JSON
 */
export function buildEscrowCreateTransaction({
  sourceAccount,
  principalAmount,
  releaseDestination,
  finishAfter,
  sequence,
  lastLedgerSequence,
  memo,
}) {
  if (!validateXrplAddress(sourceAccount)) throw new Error('Invalid source XRPL address');
  if (!validateXrplAddress(releaseDestination)) throw new Error('Invalid release destination XRPL address');
  if (BigInt(principalAmount) <= 0n) throw new Error('VF-COM-013: principal must be positive');
  if (finishAfter <= 0) throw new Error('VF-PRI-001: FinishAfter must be positive (future maturity)');

  const tx = {
    TransactionType: 'EscrowCreate',
    Account: sourceAccount,
    Amount: String(principalAmount), // drops as string
    Destination: releaseDestination,
    FinishAfter: finishAfter,
    // VF-COM-016: CancelAfter is intentionally omitted — no early cancel.
    Sequence: sequence,
    LastLedgerSequence: lastLedgerSequence || null,
    Fee: XRPL_BASE_FEE_DROPS,
    SigningPubKey: '', // Set during signing
  };

  if (memo) {
    tx.Memos = [memo];
  }

  return tx;
}

// ---------------------------------------------------------------------------
// EscrowFinish Transaction (VF-PRI-002/003/004/005/006, VF-SEC-006)
// ---------------------------------------------------------------------------

/**
 * VF-PRI-002/003 / VF-SEC-006: Builds an EscrowFinish transaction.
 * Permissionless — callable by anyone. Principal goes only to the bound
 * Destination from the original EscrowCreate.
 *
 * @param {object} params
 * @param {string} params.callerAccount - Any XRPL account (permissionless)
 * @param {string} params.ownerAccount - Source account from EscrowCreate
 * @param {number} params.offerSequence - Transaction sequence of the EscrowCreate
 * @param {number} [params.lastLedgerSequence] - Optional LLS
 * @returns {object} XRPL EscrowFinish transaction JSON
 */
export function buildEscrowFinishTransaction({
  callerAccount,
  ownerAccount,
  offerSequence,
  lastLedgerSequence,
}) {
  if (!validateXrplAddress(callerAccount)) throw new Error('Invalid caller XRPL address');
  if (!validateXrplAddress(ownerAccount)) throw new Error('Invalid owner XRPL address');
  if (typeof offerSequence !== 'number' || offerSequence < 0) {
    throw new Error('Invalid offerSequence (must be the EscrowCreate transaction sequence)');
  }

  return {
    TransactionType: 'EscrowFinish',
    Account: callerAccount, // Permissionless — anyone can call
    Owner: ownerAccount,
    OfferSequence: offerSequence,
    // No Condition/ConditionProof — time-based escrow only (FinishAfter)
    LastLedgerSequence: lastLedgerSequence || null,
    Fee: XRPL_BASE_FEE_DROPS,
    SigningPubKey: '', // Set during signing
  };
}

// ---------------------------------------------------------------------------
// Atomic Batch (VF-COM-004, VF-XCH-005)
// ---------------------------------------------------------------------------

/**
 * VF-COM-004 / VF-XCH-005: Builds the atomic batch of Payment + EscrowCreate.
 *
 * XRPL atomicity model (DESIGN DEFINED per CSV):
 *   - Payment uses Sequence N; EscrowCreate uses Sequence N+1
 *   - Both share the same LastLedgerSequence
 *   - If Payment fails (e.g., insufficient funds), EscrowCreate cannot execute
 *     (sequence gap blocks it until Payment resolves or LLS expires)
 *   - If LLS expires, both are invalidated
 *
 * Note: XRPL does not have native batch atomicity (all-or-nothing) in the
 * EVM/Solana sense. The linked-sequence + shared-LLS design is the XRPL-native
 * equivalent. True atomic batch support is DESIGN DEFINED — DEPLOYABILITY
 * EVIDENCE REQUIRED per the CSV (VF-COM-004).
 *
 * @param {object} params - All parameters needed for both transactions
 * @param {number} currentLedgerIndex - Current XRPL ledger sequence
 * @returns {object} { payment, escrowCreate, lastLedgerSequence }
 */
export function buildAtomicBatch(params, currentLedgerIndex) {
  const lastLedgerSequence = currentLedgerIndex + XRPL_DEFAULT_LLS_MARGIN;
  const baseSequence = params.sequence;

  const payment = buildFeePaymentTransaction({
    sourceAccount: params.sourceAccount,
    feeAmount: params.feeAmount,
    devFundDestination: params.devFundDestination,
    sequence: baseSequence,
    lastLedgerSequence,
  });

  const finishAfter = computeFinishAfter(params.creationTimeSecs, params.durationSecs);

  const memo = buildLockMemo({
    ...params,
    maturityTimeSecs: params.creationTimeSecs + params.durationSecs,
  });

  const escrowCreate = buildEscrowCreateTransaction({
    sourceAccount: params.sourceAccount,
    principalAmount: params.principalAmount,
    releaseDestination: params.releaseDestination,
    finishAfter,
    sequence: baseSequence + 1,
    lastLedgerSequence,
    memo,
  });

  return {
    payment,
    escrowCreate,
    lastLedgerSequence,
    finishAfter,
  };
}

// ---------------------------------------------------------------------------
// Utility: XRP ↔ drops conversion
// ---------------------------------------------------------------------------

export function xrpToDrops(xrpAmount) {
  // Convert a decimal XRP amount to drops (integer string)
  const drops = BigInt(Math.floor(Number(xrpAmount) * XRPL_DROPS_PER_XRP));
  return drops;
}

export function dropsToXrp(dropsAmount) {
  return Number(BigInt(dropsAmount)) / XRPL_DROPS_PER_XRP;
}

export { computeFinishAfter, XRPL_EPOCH_OFFSET };