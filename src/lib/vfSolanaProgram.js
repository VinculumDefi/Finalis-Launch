// =============================================================================
// Off-chain integration for the Vinculum Finalis Solana Commitment Vault Lock.
//
// PROVENANCE: Revision 6 protocol constants (mirrors on-chain constants.rs).
//
// This module uses @solana/web3.js for REAL PDA derivation and instruction
// building. SHA-256 for lock_id hashing uses the browser Web Crypto API,
// matching the on-chain solana_program::hash::hashv.
//
// STATUS: Functional in the Base44 environment. PDA derivation and instruction
// encoding work client-side. Transaction submission requires a deployed
// program (program ID is currently a placeholder).
// =============================================================================

import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';

// Buffer polyfill for browser/Vite (needed by @solana/web3.js internals)
import { Buffer } from 'buffer';
if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = Buffer;
}

// --- Program metadata ---
// NOTE: Program ID is a placeholder. Replace with the real deployed address.
export const PROGRAM_ID = 'Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS';

// PDA seed constants (mirror on-chain constants.rs)
export const SEED_CONFIG = 'vf_config';
export const SEED_LOCK = 'vf_lock';
export const SEED_HANDSHAKE = 'vf_handshake';
export const SEED_VAULT = 'vf_vault';

// Revision 6 constants (mirror on-chain constants.rs for off-chain preflight)
export const PROGRAM_CONSTANTS = {
  SOURCE_ENVIRONMENT: 'Solana',
  HANDSHAKE_DURATION_SECS: 3600,
  HANDSHAKE_VALUE_USD_MIN_MICRO: 950_000_000_000_000_000n,
  HANDSHAKE_VALUE_USD_MAX_MICRO: 1_050_000_000_000_000_000n,
  HANDSHAKE_FEE_BPS: 250,
  STANDARD_MINIMUM_VALUE_USD_MICRO: 10_000_000_000_000_000_000n,
  STANDARD_FEE_BPS: 500,
  HANDSHAKE_ALLOWANCE: 3,
  MAX_LOCK_ID_LEN: 128,
  SCALE: 10n ** 18n,
  PERMITTED_DURATIONS: [
    [3600, 10000], [604800, 10000], [2592000, 11500], [5184000, 13000],
    [7776000, 15000], [15552000, 20000], [31536000, 25000], [63072000, 38000],
    [94608000, 50000], [126144000, 57500], [157680000, 65000], [189216000, 68000],
    [220752000, 71000], [252288000, 74000], [283824000, 77000], [315360000, 80000],
  ],
};

// --- SHA-256 via Web Crypto API (matches on-chain solana_program::hash::hashv) ---

export async function hashLockId(lockId) {
  const data = new TextEncoder().encode(lockId);
  const hashBuf = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hashBuf); // 32 bytes
}

// --- REAL PDA derivation using @solana/web3.js ---

export function deriveConfigPda(programId = PROGRAM_ID) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_CONFIG)],
    new PublicKey(programId),
  );
}

export async function deriveLockPda(lockId, programId = PROGRAM_ID) {
  const lockIdHash = await hashLockId(lockId);
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_LOCK), Buffer.from(lockIdHash)],
    new PublicKey(programId),
  );
}

export function deriveHandshakePda(sourceAccount, programId = PROGRAM_ID) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_HANDSHAKE), new PublicKey(sourceAccount).toBuffer()],
    new PublicKey(programId),
  );
}

export function deriveVaultPda(mint, programId = PROGRAM_ID) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_VAULT), new PublicKey(mint).toBuffer()],
    new PublicKey(programId),
  );
}

// --- Instruction parameter builder (serializable for Anchor) ---

export async function buildCommitVaultLockParams(params) {
  const lockIdHash = await hashLockId(params.lockId);

  return {
    lockId: params.lockId,
    lockIdHash: Array.from(lockIdHash), // [u8; 32] as array for Anchor serialization
    grossAmount: params.grossAmount.toString(),
    durationSecs: params.durationSecs,
    baseRecipient: Array.from(params.baseRecipient),
    releaseDestination: params.releaseDestination,
    outputToken: params.outputToken === 'CHONX' ? { chonx: {} } : { vclm: {} },
    verifiedGrossUsdMicro: params.verifiedGrossUsdMicro.toString(),
    chonxActivationReceipt:
      params.outputToken === 'CHONX' ? params.chonxActivationReceipt : 'not_applicable',
  };
}

// --- Account layout helpers (for deserializing on-chain accounts) ---
// LockRecord is 329 bytes (see state.rs LOCK_RECORD_SIZE).
// These offsets mirror the on-chain struct field order.

export const LOCK_RECORD_LAYOUT = {
  discriminator: { offset: 0, length: 8 },
  sourceEnvironment: { offset: 8, length: 6 + 4 }, // String (4 len + 6 chars) — but Anchor uses 4-byte len prefix
  // Note: Anchor strings are 4-byte length prefix + data. "Solana" = 4 + 6 = 10 bytes
  // Full layout is complex; for read-only queries we return raw base64 data.
  // Proper deserialization requires @coral-xyz/anchor with the IDL.
  TOTAL_SIZE: 329,
};

// --- Off-chain fee computation (mirrors on-chain validate_and_compute) ---

export function computeFeeOffChain(grossAmount, durationSecs) {
  const gross = BigInt(grossAmount);
  const isHandshake = Number(durationSecs) === PROGRAM_CONSTANTS.HANDSHAKE_DURATION_SECS;
  const bps = BigInt(isHandshake ? PROGRAM_CONSTANTS.HANDSHAKE_FEE_BPS : PROGRAM_CONSTANTS.STANDARD_FEE_BPS);
  const fee = (gross * bps) / 10000n;
  const principal = gross - fee;
  return { gross, fee, principal, bps: Number(bps), isHandshake };
}

// --- Off-chain output calculation (VF-COM-017..020) ---

export function computeEmissionRateOffChain(outputToken, daysSinceLaunch) {
  const SCALE = PROGRAM_CONSTANTS.SCALE;
  const configs = {
    VCLM: { initial: 10n * SCALE, floor: 1n * SCALE },
    CHONX: { initial: 100n * SCALE, floor: 10n * SCALE },
  };
  const config = configs[outputToken];
  if (!config) return null;

  const periods = Math.floor(Number(daysSinceLaunch) / 30);
  const decayRateFp = 16670000000000000n;
  const survivalFp = SCALE - decayRateFp;

  let rate = config.initial;
  for (let i = 0; i < periods; i++) {
    rate = (rate * survivalFp) / SCALE;
    if (rate <= config.floor) {
      rate = config.floor;
      break;
    }
  }
  if (rate < config.floor) rate = config.floor;
  return rate;
}

// --- Direct Solana RPC query (client-side, uses fetch) ---
// Uses public Solana RPC endpoints (CORS-enabled).

const DEFAULT_RPC_URL = 'https://api.mainnet-beta.solana.com';

export async function queryAccountInfo(pdaAddress, rpcUrl = DEFAULT_RPC_URL) {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getAccountInfo',
      params: [pdaAddress, { encoding: 'base64' }],
    }),
  });
  const data = await response.json();
  return data.result?.value; // null if account doesn't exist
}

export async function queryLockRecord(lockId, programId = PROGRAM_ID, rpcUrl = DEFAULT_RPC_URL) {
  const [lockPda] = await deriveLockPda(lockId, programId);
  const account = await queryAccountInfo(lockPda.toBase58(), rpcUrl);
  return {
    pda: lockPda.toBase58(),
    exists: account !== null,
    lamports: account?.lamports ?? 0,
    owner: account?.owner ?? null,
    dataBase64: account?.data?.[0] ?? null,
  };
}

export async function queryHandshakeAllowance(sourceAccount, programId = PROGRAM_ID, rpcUrl = DEFAULT_RPC_URL) {
  const [haPda] = deriveHandshakePda(sourceAccount, programId);
  const account = await queryAccountInfo(haPda.toBase58(), rpcUrl);
  return {
    pda: haPda.toBase58(),
    exists: account !== null,
    lamports: account?.lamports ?? 0,
    owner: account?.owner ?? null,
    dataBase64: account?.data?.[0] ?? null,
  };
}

export async function queryConfig(programId = PROGRAM_ID, rpcUrl = DEFAULT_RPC_URL) {
  const [configPda] = deriveConfigPda(programId);
  const account = await queryAccountInfo(configPda.toBase58(), rpcUrl);
  return {
    pda: configPda.toBase58(),
    exists: account !== null,
    lamports: account?.lamports ?? 0,
    owner: account?.owner ?? null,
    dataBase64: account?.data?.[0] ?? null,
  };
}

// --- Utility: check if a base58 string is a valid Solana address ---

export function isValidAddress(address) {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}