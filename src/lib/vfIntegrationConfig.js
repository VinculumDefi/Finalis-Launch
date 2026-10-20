// Centralized Vinculum Finalis integration configuration for the VinculumFlow page.
// REAL values present in the workspace are used verbatim. Genuinely-undeployed or
// absent addresses are marked "PENDING_DEPLOYMENT" or "NOT_PRESENT", never invented.
//
// Cosmos Hub is permanently dropped (operator, t228u). It is not on Revision B,
// so it is not configured here and the page does not offer it.

export const DEPLOYMENT_STATE = 'AWAITING_DEPLOYMENT'; // Preview / Awaiting deployment / Configured / Live

export const PENDING = 'PENDING_DEPLOYMENT';
export const NOT_PRESENT = 'NOT_PRESENT';

// --- Permitted durations and multipliers (16 entries) ---
// Exactly the sixteen rows of base-contracts/contracts/CommitmentDurations.sol.
// VF-COM-002: No intermediate duration or interpolated multiplier is permitted.
// Rev 12: every duration, including the 1-hour Handshake, charges 5%.
export const PERMITTED_DURATIONS = [
  { secs: 3600,     label: '1 hour - Trust-Building Handshake (1.0x)',          multiplier_bps: 10000,  role: 'Trust-Building Handshake' },
  { secs: 604800,   label: '7 days - Shortest standard (1.0x)',                multiplier_bps: 10000,  role: 'Shortest standard' },
  { secs: 2592000,  label: '30 days - Short (1.15x)',                           multiplier_bps: 11500,  role: 'Short' },
  { secs: 5184000,  label: '60 days - Short-to-medium (1.3x)',                  multiplier_bps: 13000,  role: 'Short-to-medium' },
  { secs: 7776000,  label: '90 days - Medium (1.5x)',                           multiplier_bps: 15000,  role: 'Medium' },
  { secs: 15552000, label: '180 days - Six-month (2.0x)',                       multiplier_bps: 20000,  role: 'Six-month' },
  { secs: 31536000, label: '365 days - One-year (2.5x)',                        multiplier_bps: 25000,  role: 'One-year' },
  { secs: 63072000, label: '730 days - Two-year (3.8x)',                        multiplier_bps: 38000,  role: 'Two-year' },
  { secs: 94608000, label: '1,095 days - Three-year (5.0x)',                    multiplier_bps: 50000,  role: 'Three-year' },
  { secs: 126144000,label: '1,460 days - Four-year (5.75x)',                   multiplier_bps: 57500,  role: 'Four-year' },
  { secs: 157680000,label: '1,825 days - Five-year (6.5x)',                    multiplier_bps: 65000,  role: 'Five-year' },
  { secs: 189216000,label: '2,190 days - Six-year (6.8x)',                     multiplier_bps: 68000,  role: 'Six-year' },
  { secs: 220752000,label: '2,555 days - Seven-year (7.1x)',                   multiplier_bps: 71000,  role: 'Seven-year' },
  { secs: 252288000,label: '2,920 days - Eight-year (7.4x)',                  multiplier_bps: 74000,  role: 'Eight-year' },
  { secs: 283824000,label: '3,285 days - Nine-year (7.7x)',                   multiplier_bps: 77000,  role: 'Nine-year' },
  { secs: 315360000,label: '3,650 days - Ten-year (8.0x)',                     multiplier_bps: 80000,  role: 'Ten-year' },
];
export const DURATION_HANDSHAKE = 3600;

// --- Base chain ---
// The Revision B Base ceremony (base-contracts/deployment/LIVE_DEPLOYMENT_ORDER.md,
// Step 2) deploys a NEW 5% Base lock and a NEW Verifier. Neither exists yet, so
// both stay PENDING_DEPLOYMENT. The older 2026-10-12 Base lock charges 2.5% on the
// Handshake and is deliberately NOT used here (Rev 12 is 5% on every duration).
export const BASE_CHAIN = {
  name: 'Base',
  environment_id: 'Base',
  chain_id: 8453,
  lock_address: PENDING,             // new 5% CommitmentVaultLock("Base", Dev Fund), not deployed
  proof_verifier_address: PENDING,   // new Revision B VinculumFinalisVerifier, not deployed
  vclm_address: PENDING,
  chonx_address: PENDING,
  explorer_tx: 'https://basescan.org/tx/{txHash}',
};

export function isBaseLockDeployed() {
  return BASE_CHAIN.lock_address !== PENDING;
}
export function isBaseVerifierPresent() {
  return BASE_CHAIN.proof_verifier_address !== PENDING;
}
