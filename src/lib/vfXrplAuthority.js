// =============================================================================
// PROVENANCE: Vinculum_Finalis_Protocol_Constants.json — Revision 6, 2026-07-28
// Governing source: 227826f11_Vinculum_Finalis_Master_Specification_Revision_6_2026-07-28.docx
// Governing source SHA-256: 5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9
//
// XRPL environment constants. Every value is transcribed verbatim from the
// authoritative constants file or derived from the XRPL protocol specification.
// No value is invented or carried over from another environment's implementation.
// =============================================================================

// Re-export shared protocol constants (identical for all environments)
export {
  AUTHORITY,
  TOKEN_DECIMALS,
  SCALE,
  TOKEN_HARD_CAPS,
  CHONX_ACTIVATION_THRESHOLD,
  SYNTH_ACTIVATION_THRESHOLD,
  SYNTH_FORGE,
  EMISSION,
  DECAY,
  FIXED_RULES,
  COMMITMENT_DURATIONS,
  HANDSHAKE_DURATION_SECS,
  ASSET_CLASS_MULTIPLIERS_BPS,
  LOCK_STATES,
  ATTEMPT_STATES,
} from './vfRevision6Authority';

// --- XRPL environment (Protocol Constants "supported_environments") ---

// VF-XCH-001/002: XRPL is one of the 17 supported environments.
export const XRPL_ENVIRONMENT = {
  family: 'Non-EVM',
  name: 'XRPL',
  // VF-XCH-003: "The deployment package must record the exact canonical network or chain identifier."
  // The exact XRPL ledger chain identifier (mainnet genesis ledger hash) is a deployment
  // deliverable not present in the governing constants — DEFERRED EXTERNAL INPUT.
  canonical_chain_identifier: null,
  // The number of XRPL entries in the 1,001-asset registry is not separately published
  // in the Revision 6 constants. Full provisioning requires the authoritative registry JSON.
  registry_entries: null,
};

// VF-COM-006: XRPL is classified alongside UTXO/Stellar for the Handshake allowance.
// Per Section Q.2: "1-use Base recognition counter; exactly one canonical release public key
// per UTXO-family mechanism." XRPL account addresses serve as the identity.
// The official application must block the second qualifying attempt before broadcast (Q.4.2).
export const XRPL_HANDSHAKE_ALLOWANCE = 1;

// XRPL objective pending-attempt disposition (Implementation Brief §4.7):
// "XRPL: finalized success/failure, or LastLedgerSequence expiry."
// These are the ONLY terminal dispositions. Elapsed time / mempool disappearance /
// application timers NEVER clear a still-valid pending attempt (VF-COM-007/008).
export const XRPL_DISPOSITION = {
  FINALIZED_SUCCESS: 'FINALIZED_SUCCESS',
  FINALIZED_FAILURE: 'FINALIZED_FAILURE',
  LASTLEDGERSEQUENCE_EXPIRY: 'LASTLEDGERSEQUENCE_EXPIRY',
};

// --- XRPL protocol constants (from XRPL specification, not Revision 6) ---

// 1 XRP = 1,000,000 drops. EscrowCreate Amount is specified in drops.
export const XRPL_DROPS_PER_XRP = 1_000_000;

// XRPL Epoch: January 1, 2000 00:00:00 UTC (Unix timestamp 946684800).
// EscrowCreate FinishAfter is specified in seconds since the XRPL Epoch.
export const XRPL_EPOCH_OFFSET = 946684800;

// VF-XCH-006/010: XRPL finality. A transaction is final once included in a
// validated ledger. XRPL has no reorgs after validation.
export const XRPL_FINALITY = {
  commitment: 'validated',
  description: 'XRPL ledgers are immutable once validated. No reorgs after validation.',
};

// VF-COM-016: No CancelAfter field. EscrowCancel must NOT be used.
// The recognized design removes the early-cancel path entirely.
export const ESCROW_CANCEL_PERMITTED = false;

// Minimum transaction fee on XRPL (typically 10 drops; may be higher for
// multi-signature or EscrowFinish with condition proof).
export const XRPL_BASE_FEE_DROPS = '12';

// Default LastLedgerSequence margin (in ledgers from current).
// Each XRPL ledger closes in ~3.5 seconds. 10 ledgers ≈ 35 seconds.
export const XRPL_DEFAULT_LLS_MARGIN = 10;

// Convert Unix timestamp to XRPL epoch seconds.
export function unixToXrplEpoch(unixSeconds) {
  return unixSeconds - XRPL_EPOCH_OFFSET;
}

// Convert XRPL epoch seconds to Unix timestamp.
export function xrplEpochToUnix(xrplSeconds) {
  return xrplSeconds + XRPL_EPOCH_OFFSET;
}

// VF-PRI-001: Compute FinishAfter for an EscrowCreate.
// FinishAfter = (current_unix_time - XRPL_EPOCH_OFFSET) + duration_secs
export function computeFinishAfter(currentUnixSeconds, durationSecs) {
  return unixToXrplEpoch(currentUnixSeconds) + durationSecs;
}