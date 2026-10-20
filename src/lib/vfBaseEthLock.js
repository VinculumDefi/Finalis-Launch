// Base ETH lock construction for the VinculumFlow page.
//
// Builds the exact CommitmentVaultLock.createNativeLock call that the NEW 5%
// Base lock (base-contracts/contracts/CommitmentVaultLock.sol) expects:
//   createNativeLock(bytes32 lockId, address baseRecipient, uint8 outputToken,
//     bytes32 assetIdentity, bytes32 valuationReference, address releaseDestination,
//     uint256 duration, uint256 verifiedGrossUsd)   payable, msg.value = gross wei
//
// The asset is Base ETH, taken from the active asset list (Revision B with the
// 2026-10-20 on-chain verification). If it is not on that list, nothing is built.
//
// Fee: floor(gross * 500 / 10000) on every duration, including the 1-hour
// Handshake (Rev 12). USD bounds are the ones in CommitmentVaultLock.sol, so a
// call this file builds is a call that contract would accept.
//
// Nothing is ever sent. The new Base lock is PENDING_DEPLOYMENT, so submit()
// returns blocked. No price is invented: the scheduled price must be supplied
// from the Verifier read, and an empty or zero price refuses the build.
import { keccak_256 } from '@noble/hashes/sha3';
import { PERMITTED_DURATIONS, DURATION_HANDSHAKE, BASE_CHAIN, PENDING, isBaseLockDeployed } from './vfIntegrationConfig.js';
import { resolveOfferable, NOT_ACTIVE_MESSAGE } from './vfActiveAssetAllowlist.js';

export const FEE_BPS = 500n;               // CommitmentVaultLock.STANDARD_FEE_BPS, every duration
export const BPS_DENOMINATOR = 10000n;
// 18-decimal USD, verbatim from CommitmentVaultLock.sol.
export const HANDSHAKE_USD_MIN = 10n ** 16n;      // $0.01
export const HANDSHAKE_USD_MAX = 2n * 10n ** 16n; // $0.02
export const STANDARD_USD_MIN = 10n ** 16n;       // $0.01
// keccak256("createNativeLock(bytes32,address,uint8,bytes32,bytes32,address,uint256,uint256)")[0:4]
export const CREATE_NATIVE_LOCK_SELECTOR = '0x7f22a052';
export const OUTPUT_TOKENS = { VCLM: 0, CHONX: 1 };

// The page's asset: Base native ETH. Resolved through the active list, never by ticker alone.
export const PAGE_ASSET = { environment: 'Base', contract_or_native_identifier: 'NATIVE', symbol: 'ETH', nativeId: 'native-ETH' };
export function resolvePageAsset() {
  const r = resolveOfferable(PAGE_ASSET);
  if (!r.ok) return { ok: false, reason: `${NOT_ACTIVE_MESSAGE}: ETH (Base)` };
  return { ok: true, entry: r.entry };
}

const ADDR = /^0x[0-9a-fA-F]{40}$/;
const ZERO_ADDR = /^0x0{40}$/;
const B32 = /^0x[0-9a-fA-F]{64}$/;
const INT = /^\d+$/;

export function isPermittedDuration(secs) {
  return PERMITTED_DURATIONS.some((d) => d.secs === Number(secs));
}

// Mirror of CommitmentVaultLock._quote fee math: floor(gross * 500 / 10000), any duration.
export function computeFee(grossWei) {
  const gross = BigInt(grossWei);
  const fee = (gross * FEE_BPS) / BPS_DENOMINATOR;
  return { gross: gross.toString(), fee: fee.toString(), principal: (gross - fee).toString() };
}

// Exact decimal ETH string -> wei. No floating point.
export function ethToWei(eth) {
  const m = String(eth ?? '').trim().match(/^(\d+)(?:\.(\d{1,18}))?$/);
  if (!m) return null;
  return BigInt(m[1]) * 10n ** 18n + BigInt((m[2] || '').padEnd(18, '0'));
}
// Exact decimal USD string -> 18-decimal integer. No floating point.
export function usdToUsd18(usd) {
  const m = String(usd ?? '').trim().match(/^(\d+)(?:\.(\d{1,18}))?$/);
  if (!m) return null;
  return BigInt(m[1]) * 10n ** 18n + BigInt((m[2] || '').padEnd(18, '0'));
}

// Same arithmetic as the 2026-10-12 saved app: gross (18 decimals) times price, 18-decimal USD.
export function verifiedGrossUsd(grossWei, priceUsd18) {
  return (BigInt(grossWei) * BigInt(priceUsd18)) / 10n ** 18n;
}

export function validateValueBounds(usd18, durationSecs) {
  const v = BigInt(usd18);
  if (Number(durationSecs) === DURATION_HANDSHAKE) return v >= HANDSHAKE_USD_MIN && v <= HANDSHAKE_USD_MAX;
  return v >= STANDARD_USD_MIN;
}

const hex32 = (n) => BigInt(n).toString(16).padStart(64, '0');
const word = (h) => h.toLowerCase().replace(/^0x/, '').padStart(64, '0');
const toHex = (bytes) => '0x' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');

// keccak256(abi.encode(uint256 priceUsd18)), as the saved app computes valuationReference.
export function valuationReferenceFor(priceUsd18) {
  const buf = new Uint8Array(32);
  const h = hex32(priceUsd18);
  for (let i = 0; i < 32; i++) buf[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return toHex(keccak_256(buf));
}

export function encodeCreateNativeLock(a) {
  return CREATE_NATIVE_LOCK_SELECTOR
    + word(a.lockId) + word(a.baseRecipient) + hex32(a.outputToken) + word(a.assetIdentity)
    + word(a.valuationReference) + word(a.releaseDestination) + hex32(a.duration) + hex32(a.verifiedGrossUsd);
}

// Build the call. Every check refuses (fail closed); nothing here sends.
export function buildCreateNativeLock({ lockId, baseRecipient, outputToken, releaseDestination, durationSecs, grossEth, priceUsd, chonxActivationReceipt }) {
  const errors = [];
  const asset = resolvePageAsset();
  if (!asset.ok) return { ok: false, errors: [asset.reason] };
  if (!B32.test(String(lockId ?? ''))) errors.push('invalid lock id (expected 0x + 64 hex)');
  if (!ADDR.test(String(baseRecipient ?? '')) || ZERO_ADDR.test(baseRecipient)) errors.push('invalid Base recipient (expected 0x + 40 hex, not zero)');
  if (!ADDR.test(String(releaseDestination ?? '')) || ZERO_ADDR.test(releaseDestination)) errors.push('invalid release destination (expected 0x + 40 hex, not zero)');
  if (!(outputToken in OUTPUT_TOKENS)) errors.push(`invalid output token: ${outputToken}`);
  if (outputToken === 'CHONX' && !String(chonxActivationReceipt ?? '').trim()) errors.push('CHONX requires a non-empty activation receipt (VF-COM-025)');
  if (!isPermittedDuration(durationSecs)) errors.push(`duration not permitted: ${durationSecs}`);
  const gross = ethToWei(grossEth);
  if (gross === null || gross === 0n) errors.push('invalid gross amount (ETH, up to 18 decimals, above zero)');
  const price = usdToUsd18(priceUsd);
  if (price === null || price === 0n) errors.push('no usable scheduled price (VF-ORC-005): enter the Base ETH price read from the Verifier');
  if (errors.length) return { ok: false, errors };

  const q = computeFee(gross);
  if (q.fee === '0' || q.principal === '0') return { ok: false, errors: ['zero fee or principal (VF-COM-013)'] };
  const usd = verifiedGrossUsd(gross, price);
  if (!validateValueBounds(usd, durationSecs)) {
    return { ok: false, errors: [Number(durationSecs) === DURATION_HANDSHAKE
      ? 'Handshake value outside $0.01 to $0.02 (CommitmentVaultLock HANDSHAKE_USD_MIN/MAX)'
      : 'value below $0.01 (CommitmentVaultLock STANDARD_USD_MIN)'] };
  }
  const args = {
    lockId: lockId.toLowerCase(),
    baseRecipient,
    outputToken: OUTPUT_TOKENS[outputToken],
    assetIdentity: asset.entry.canonicalAssetId,
    valuationReference: valuationReferenceFor(price),
    releaseDestination,
    duration: Number(durationSecs),
    verifiedGrossUsd: usd.toString(),
  };
  return {
    ok: true,
    call: {
      chainId: BASE_CHAIN.chain_id,
      to: BASE_CHAIN.lock_address,
      function: 'createNativeLock',
      args,
      value: gross.toString(),
      data: encodeCreateNativeLock(args),
    },
    quote: q,
    asset: asset.entry,
  };
}

// Never sends. The new 5% Base lock is not deployed, so this is blocked at the boundary.
export async function submitLock(built) {
  if (!built || !built.ok) return { ok: false, reason: 'no valid lock call was built' };
  if (!isBaseLockDeployed()) {
    return { ok: false, blocked: true, reason: 'Not sent: the new 5% Base lock is pending deployment.', missing: 'BASE_CHAIN.lock_address' };
  }
  return { ok: false, blocked: true, reason: 'Not sent: this preview never broadcasts.', missing: 'broadcast disabled' };
}

export async function submitRelease(lockId) {
  if (!B32.test(String(lockId ?? ''))) return { ok: false, reason: 'invalid lock id (expected 0x + 64 hex)' };
  return { ok: false, blocked: true, reason: 'Not sent: the new 5% Base lock is pending deployment. Release pays only the recorded destination, which must send it.', missing: 'BASE_CHAIN.lock_address' };
}

export function buildRelease(lockId) {
  // keccak256("release(bytes32)")[0:4] = 0x67d42a8b
  return { to: BASE_CHAIN.lock_address === PENDING ? PENDING : BASE_CHAIN.lock_address, function: 'release', args: { lockId }, data: '0x67d42a8b' + word(lockId) };
}
