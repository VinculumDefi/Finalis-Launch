// =============================================================================
// Live contract rules for the practice simulator and the lock helpers.
//
// vfRevision6Authority.js is a pinned historical record of Revision 6. Its
// FIXED_RULES still carry the Revision 6 Handshake values ($0.95 to $1.05,
// 250 bps) and the Revision 6 $10.00 standard minimum. The contracts that will
// be deployed use different values, so no live code path reads those four
// fields. Every live path reads LIVE_RULES below instead.
//
// Source of each value (base-contracts/contracts):
//   CommitmentVaultLock.sol      STANDARD_FEE_BPS = 500 on every duration
//                                HANDSHAKE_USD_MIN = 0.01e18, HANDSHAKE_USD_MAX = 0.02e18
//                                STANDARD_USD_MIN = 0.01e18
//   VinculumFinalisVerifier.sol  the same four constants
// Revision 12 governs the Handshake (5% on every duration, $0.01 to $0.02).
// Bitcoin, Bitcoin Cash and Litecoin native Handshakes use the coin unit band
// in vfUtxoMinimumLock.js, with their USD for VCLM and RAC capped at $0.02.
// Revision 6 governs everything else; those fields are taken unchanged from
// FIXED_RULES.
// =============================================================================

import { FIXED_RULES, SCALE, HANDSHAKE_DURATION_SECS } from './vfRevision6Authority.js';

export const LIVE_RULES = Object.freeze({
  ...FIXED_RULES,
  handshake_value_usd_min: 0.01, // Rev 12, contract HANDSHAKE_USD_MIN
  handshake_value_usd_max: 0.02, // Rev 12, contract HANDSHAKE_USD_MAX
  handshake_fee_bps: 500,        // Rev 12, contract STANDARD_FEE_BPS on every duration
  standard_minimum_value_usd: 0.01, // contract STANDARD_USD_MIN
  standard_fee_bps: 500,         // contract STANDARD_FEE_BPS
});

// Exact 18-decimal fixed-point bounds, so acceptance never uses floating point.
export const HANDSHAKE_USD_MIN_FP = SCALE / 100n;        // $0.01 inclusive
export const HANDSHAKE_USD_MAX_FP = (2n * SCALE) / 100n; // $0.02 inclusive
export const STANDARD_USD_MIN_FP = SCALE / 100n;         // $0.01 inclusive

// 500 bps on every duration, Handshake included.
export function feeBpsForDuration(durationSecs) {
  return BigInt(Number(durationSecs) === HANDSHAKE_DURATION_SECS
    ? LIVE_RULES.handshake_fee_bps
    : LIVE_RULES.standard_fee_bps);
}

// Human-readable bands for messages and labels.
export const HANDSHAKE_BAND_TEXT = '$0.01 to $0.02';
export const STANDARD_MINIMUM_TEXT = '$0.01';
