// Centralized Vinculum Finalis integration configuration for the VinculumFlow page.
// REAL values present in the workspace are used verbatim. Genuinely-undeployed or
// absent addresses are marked "PENDING_DEPLOYMENT" or "NOT_PRESENT", never invented.
//
// Contract addresses are NOT typed here. They come from vfDeployedAddresses.js,
// which base-contracts/scripts/applyCeremonyAddresses.cjs writes from the Base
// ceremony output. Until then every address there is PENDING_DEPLOYMENT.
//
// Cosmos Hub is permanently dropped (operator, t228u). It is not on Revision B,
// so it is not configured here and the page does not offer it.

import { CEREMONY, BASE_CONTRACTS, LOCKS_5PCT, READERS, RETIRED_LOCKS, RETIRED_BASE_CONTRACTS } from './vfDeployedAddresses.js';

export { CEREMONY, LOCKS_5PCT, READERS, RETIRED_LOCKS, RETIRED_BASE_CONTRACTS };

// Preview / Awaiting deployment / Configured / Live
export const DEPLOYMENT_STATE = CEREMONY.finalized ? 'CONFIGURED' : 'AWAITING_DEPLOYMENT';

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
// Step 2) deploys a NEW 5% Base lock and a NEW Verifier, VCLM, CHONX, Forge and
// Stake. The older 2026-10-12 Base lock charges 2.5% on the Handshake and is
// RETIRED (RETIRED_LOCKS): it is never offered for a new lock.
export const BASE_CHAIN = Object.freeze({
  name: 'Base',
  environment_id: 'Base',
  chain_id: 8453,
  lock_address: BASE_CONTRACTS.lock,             // new 5% CommitmentVaultLock("Base", Dev Fund)
  proof_verifier_address: BASE_CONTRACTS.verifier, // new Revision B VinculumFinalisVerifier
  vclm_address: BASE_CONTRACTS.vclm,
  chonx_address: BASE_CONTRACTS.chonx,
  forge_address: BASE_CONTRACTS.forge,
  stake_address: BASE_CONTRACTS.stake,
  explorer_tx: 'https://basescan.org/tx/{txHash}',
});

const isAddr = (a) => typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a) && !/^0x0{40}$/.test(a);

export function isRetiredLock(address) {
  if (typeof address !== 'string') return false;
  const a = address.toLowerCase();
  return RETIRED_LOCKS.some((r) => r.address.toLowerCase() === a);
}

export function isRetiredBaseContract(address) {
  if (typeof address !== 'string') return false;
  const a = address.toLowerCase();
  return RETIRED_BASE_CONTRACTS.some((r) => r.address.toLowerCase() === a);
}

// The lock a NEW lock on this environment must use, or null. Never a retired lock.
export function lockForNewLock(environmentId) {
  const a = LOCKS_5PCT[environmentId];
  if (!isAddr(a) || isRetiredLock(a)) return null;
  return a;
}

// Release of an existing lock may target a retired lock (the recorded destination
// releases its own principal at maturity) or a new one.
export function lockAllowedForRelease(address) {
  return isRetiredLock(address) || Object.values(LOCKS_5PCT).some((a) => isAddr(a) && a.toLowerCase() === String(address).toLowerCase());
}

export function isBaseLockDeployed() {
  return isAddr(BASE_CHAIN.lock_address) && !isRetiredLock(BASE_CHAIN.lock_address);
}
export function isBaseVerifierPresent() {
  return isAddr(BASE_CHAIN.proof_verifier_address) && !isRetiredBaseContract(BASE_CHAIN.proof_verifier_address);
}
