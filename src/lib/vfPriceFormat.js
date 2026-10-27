// Price format per Verifier (VF-ORC-016).
//
// Two Verifier generations exist on Base:
//   - the currently deployed Verifiers store scheduled prices with 18 decimals
//     (scheduledPrices(key).priceUsd18, USD_STABLE_MIN_PRICE = 0.95e18). They have
//     no PRICE_SCALE() function; calling it reverts (checked on Base 2026-10-27).
//   - the Revision E Verifier stores prices with 30 decimals (priceUsd30,
//     USD_STABLE_MIN_PRICE = 0.95e30) and exposes PRICE_SCALE() = 1e30.
//
// The format is chosen by the Verifier address the app is pointed at. There is no
// magnitude guess. A Verifier address that is not in the table below must prove its
// format on chain: PRICE_SCALE() = 1e30 means 30 decimals; PRICE_SCALE() reverting with
// USD_STABLE_MIN_PRICE() = 0.95e18 means 18 decimals; anything else is refused.
//
// Valuation is identical to the contracts in each case:
//   18 decimals: floor(floor(gross * 1e18 / 10^dec) * price / 1e18)
//   30 decimals: floor(gross * price / (10^dec * 1e12))
// Both return a USD value with 18 decimals, which is what the lock takes.
import { BASE_CONTRACTS } from './vfDeployedAddresses.js';
import { PENDING } from './vfIntegrationConfig.js';

export const PRICE_DECIMALS_LEGACY = 18;
export const PRICE_DECIMALS_REVISION_E = 30;
export const PRICE_SCALE_REVISION_E = 10n ** 30n;
export const PRICE_SCALE_SELECTOR = '0xc33f59d3'; // keccak256("PRICE_SCALE()")[0:4]
export const MAX_VALUATION_DECIMALS = 65;

// Verifiers known to use 18-decimal prices. Lower case keys. Both answer
// USD_STABLE_MIN_PRICE() = 0.95e18 and revert on PRICE_SCALE().
export const LEGACY_PRICE_VERIFIERS = Object.freeze({
  '0xfa8a18e0dde99a06c78231f82e26ec6160006328': 'Base Verifier live since 2026-10-22 (18-decimal prices)',
  '0xb0670826b79e29cc6a1c216eb396d383a54af47d': 'Base Verifier of 2026-10-12 (18-decimal prices)',
});

const ADDR = /^0x[0-9a-fA-F]{40}$/;

// Sync lookup. Returns { ok, decimals, basis } or { ok:false, reason, needsOnChainRead }.
export function priceDecimalsForVerifier(verifierAddress) {
  const a = String(verifierAddress ?? '');
  if (a === PENDING) {
    return { ok: true, decimals: PRICE_DECIMALS_REVISION_E, basis: 'Revision E Verifier (pending deployment, 30-decimal prices)' };
  }
  if (!ADDR.test(a)) return { ok: false, reason: 'verifier address is not valid; price format unknown (refused)' };
  const legacy = LEGACY_PRICE_VERIFIERS[a.toLowerCase()];
  if (legacy) return { ok: true, decimals: PRICE_DECIMALS_LEGACY, basis: legacy };
  return { ok: false, needsOnChainRead: true, reason: 'verifier not in the price-format table; read PRICE_SCALE() on chain' };
}

// Async resolver. The format is decided by reading the chain, never by the size of a number:
//   - PRICE_SCALE() returns exactly 1e30            -> 30-decimal prices.
//   - PRICE_SCALE() reverts AND USD_STABLE_MIN_PRICE() returns exactly 0.95e18
//                                                    -> 18-decimal prices (any unlisted
//                                                       18-decimal Verifier is accepted this way).
//   - anything else (other scale, no reader, read error, other floor) -> refused.
// readPriceScale() must return the bigint from PRICE_SCALE() or throw when the call reverts.
// readStableMin() must return the bigint from USD_STABLE_MIN_PRICE(). Addresses in the table
// (and the pending Revision E address) need no read.
export const USD_STABLE_MIN_PRICE_LEGACY = 95n * 10n ** 16n; // 0.95e18
export async function resolvePriceDecimals(verifierAddress, readPriceScale, readStableMin) {
  const known = priceDecimalsForVerifier(verifierAddress);
  if (known.ok || !known.needsOnChainRead) return known;
  if (typeof readPriceScale !== 'function') return { ok: false, reason: 'no on-chain reader supplied; price format unknown (refused)' };
  let scale = null;
  let reverted = false;
  try { scale = BigInt(await readPriceScale()); } catch { reverted = true; }
  if (!reverted && scale === PRICE_SCALE_REVISION_E) {
    return { ok: true, decimals: PRICE_DECIMALS_REVISION_E, basis: 'on-chain PRICE_SCALE() = 1e30' };
  }
  if (reverted && typeof readStableMin === 'function') {
    let floor = null;
    try { floor = BigInt(await readStableMin()); } catch { floor = null; }
    if (floor === USD_STABLE_MIN_PRICE_LEGACY) {
      return { ok: true, decimals: PRICE_DECIMALS_LEGACY, basis: 'on-chain: PRICE_SCALE() reverts and USD_STABLE_MIN_PRICE() = 0.95e18' };
    }
  }
  return { ok: false, reason: 'Price format unknown for this verifier (refused)' };
}

// The format for the Verifier this app build is configured with.
export function priceDecimalsForConfiguredVerifier() {
  return priceDecimalsForVerifier(BASE_CONTRACTS.verifier);
}

const SUPPORTED = (d) => d === PRICE_DECIMALS_LEGACY || d === PRICE_DECIMALS_REVISION_E;
export const isSupportedPriceDecimals = (d) => SUPPORTED(Number(d));

// Exact decimal string (plain or e-notation, no sign) -> integer scaled by 10^decimals.
// More fractional digits than `decimals` returns null (never rounds silently).
export function parseDecimalToScaled(text, decimals) {
  const d = Number(decimals);
  if (!SUPPORTED(d)) return null;
  const s = String(text ?? '').trim().toLowerCase();
  const m = s.match(/^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/);
  if (!m) return null;
  let intPart = m[1];
  let frac = m[2] || '';
  const exp = m[3] ? parseInt(m[3], 10) : 0;
  if (Math.abs(exp) > 80) return null;
  if (exp > 0) {
    const take = frac.slice(0, exp);
    intPart += take.padEnd(exp, '0');
    frac = frac.slice(exp);
  } else if (exp < 0) {
    const pad = intPart.padStart(-exp + 1, '0');
    frac = pad.slice(pad.length + exp) + frac;
    intPart = pad.slice(0, pad.length + exp);
  }
  frac = frac.replace(/0+$/, '');
  if (frac.length > d) return null;
  return BigInt(intPart || '0') * 10n ** BigInt(d) + BigInt(frac.padEnd(d, '0') || '0');
}

// A JS number (from a price feed) -> scaled integer, truncated toward zero at `decimals`.
// Number.prototype.toString gives the shortest round-trip digits, so no float error
// is added. Used only for off-chain estimates; the Verifier posts its own price.
export function numberToScaled(n, decimals) {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return null;
  const d = Number(decimals);
  const s = x.toString().toLowerCase();
  const m = s.match(/^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/);
  if (!m) return null;
  // Expand to a plain digit string, then cut to `decimals` places.
  const exp = m[3] ? parseInt(m[3], 10) : 0;
  let digits = m[1] + (m[2] || '');
  let pointPos = m[1].length + exp; // digits before the decimal point
  if (pointPos < 0) { digits = '0'.repeat(-pointPos) + digits; pointPos = 0; }
  if (pointPos > digits.length) digits = digits.padEnd(pointPos, '0');
  const intPart = digits.slice(0, pointPos) || '0';
  const frac = digits.slice(pointPos).slice(0, d).padEnd(d, '0');
  return BigInt(intPart) * 10n ** BigInt(d) + BigInt(frac || '0');
}

// USD value with 18 decimals, byte-for-byte the on-chain arithmetic for each format.
export function valueUsd18(grossSmallestUnits, assetDecimals, priceScaled, priceDecimals) {
  const d = Number(priceDecimals);
  if (!SUPPORTED(d)) throw new Error('unsupported price format');
  const gross = BigInt(grossSmallestUnits);
  const price = BigInt(priceScaled);
  const dec = BigInt(assetDecimals);
  if (dec > BigInt(MAX_VALUATION_DECIMALS)) throw new Error('VF-ORC-004: decimals out of range');
  if (d === PRICE_DECIMALS_LEGACY) {
    const assetUnitsFp = (gross * 10n ** 18n) / 10n ** dec;
    return (assetUnitsFp * price) / 10n ** 18n;
  }
  return (gross * price) / (10n ** dec * 10n ** 12n);
}

// USDC/USDT floor: 0.95 in the Verifier's own price format.
export function stableMinPrice(priceDecimals) {
  const d = Number(priceDecimals);
  if (!SUPPORTED(d)) throw new Error('unsupported price format');
  return 95n * 10n ** BigInt(d - 2);
}

// Exact decimal USD price string from a scaled integer, trailing zeros trimmed.
export function formatPrice(priceScaled, priceDecimals) {
  const d = Number(priceDecimals);
  if (!SUPPORTED(d)) throw new Error('unsupported price format');
  const p = BigInt(priceScaled);
  const s = p.toString().padStart(d + 1, '0');
  const intPart = s.slice(0, s.length - d);
  const frac = s.slice(s.length - d).replace(/0+$/, '');
  return frac ? `${intPart}.${frac}` : intPart;
}

// Same value in e-notation with 3 significant digits, for very small prices (7.35e-19).
export function formatPriceCompact(priceScaled, priceDecimals) {
  const d = Number(priceDecimals);
  if (!SUPPORTED(d)) throw new Error('unsupported price format');
  const p = BigInt(priceScaled);
  if (p === 0n) return '0';
  const digits = p.toString();
  const exp10 = digits.length - 1 - d;
  const sig = digits.slice(0, 3).replace(/0+$/, '');
  const mant = sig.length > 1 ? `${sig[0]}.${sig.slice(1)}` : sig;
  return exp10 >= -4 && exp10 <= 6 ? formatPrice(p, d) : `${mant}e${exp10}`;
}

// USD estimate (18 decimals) from a feed number, format-aware. For 18-decimal Verifiers the
// existing 1e8 estimate path is kept exactly (see vfPriceService).
export function estimateUsd18FromFeed(grossSmallestUnits, assetDecimals, priceUsdNumber, priceDecimals) {
  const scaled = numberToScaled(priceUsdNumber, priceDecimals);
  if (scaled === null) return null;
  return valueUsd18(grossSmallestUnits, assetDecimals, scaled, priceDecimals);
}

export function computeVerifiedGrossUsdMicro(grossAmountStr, decimals, priceUsd, scale) {
  const grossAmount = BigInt(grossAmountStr);
  const priceScaled = BigInt(Math.round(priceUsd * 1e8));
  const priceScale = 10n ** 8n;
  const dec = BigInt(decimals);
  return (grossAmount * priceScaled * scale) / (10n ** dec * priceScale);
}

// Format-aware estimate, keyed to the Verifier's price format.
//   18-decimal Verifier: exactly the existing computeVerifiedGrossUsdMicro result.
//   30-decimal Verifier: exact floor(gross * price30 / (10^dec * 1e12)), so a price like
//   7.35e-19 is kept instead of rounding to zero at 1e-8.
// An unsupported format returns null (the caller must refuse).
export function computeVerifiedGrossUsdFormatAware(grossAmountStr, decimals, priceUsd, scale, priceDecimals) {
  if (!isSupportedPriceDecimals(priceDecimals)) return null;
  if (Number(priceDecimals) === PRICE_DECIMALS_LEGACY) {
    return computeVerifiedGrossUsdMicro(grossAmountStr, decimals, priceUsd, scale);
  }
  return estimateUsd18FromFeed(grossAmountStr, decimals, priceUsd, priceDecimals);
}
