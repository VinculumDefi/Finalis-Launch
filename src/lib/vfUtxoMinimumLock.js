// Minimum lock size for Bitcoin, Bitcoin Cash and Litecoin (operator, t230u).
//
// Same rule as utxo-locks/lock.py (check_minimum_lock / split_outputs):
//   - Standard locks: gross USD at lock time must be at least
//     $20 on Bitcoin, $1 on Bitcoin Cash, $1 on Litecoin.
//   - The USD value uses a FRESH price: under 24 hours old at lock time.
//     The price must carry its own age (last_updated_at in Unix seconds, or
//     price_as_of). A fetch-time stamp alone ("timestamp") is not a price age,
//     so it is not accepted. No price, a bad price or a stale price refuses.
//   - The fee is exactly floor(gross * 500 / 10000). If that is under the
//     chain's P2PKH dust minimum the lock is refused; it is never raised.
//
// Other chains are not affected. The Base verifier's Handshake band
// ($0.01 to $0.02) is not changed and still refuses every Bitcoin, Bitcoin
// Cash and Litecoin Handshake, because 5% of $0.02 is under dust on all three.

export const UTXO_MIN_LOCK_USD = { Bitcoin: '20', BitcoinCash: '1', Litecoin: '1' };
export const UTXO_P2PKH_DUST = { Bitcoin: 546n, BitcoinCash: 546n, Litecoin: 5460n }; // lock.py P2PKH_DUST_MINIMUM
export const UTXO_DECIMALS = 8;
export const PRICE_MAX_AGE_SECS = 24 * 60 * 60;
export const PRICE_MAX_FUTURE_SECS = 5 * 60;
const FEE_BPS = 500n;
const SCALE18 = 10n ** 18n;

const ALIASES = { 'Bitcoin Cash': 'BitcoinCash', BCH: 'BitcoinCash', BTC: 'Bitcoin', LTC: 'Litecoin' };
export function minimumEnv(env) {
  const e = ALIASES[env] || env;
  return Object.prototype.hasOwnProperty.call(UTXO_MIN_LOCK_USD, e) ? e : null;
}
export function hasUtxoMinimum(env) { return minimumEnv(env) !== null; }

// Exact decimal string -> 18-decimal integer. Returns null for anything that is
// not a finite positive number.
export function toUsd18(value) {
  if (value === null || value === undefined || typeof value === 'boolean') return null;
  let s;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null;
    s = value.toFixed(18);
  } else {
    s = String(value).trim();
  }
  const m = s.match(/^(\d+)(?:\.(\d+))?$/);
  if (!m) return null;
  const v = BigInt(m[1]) * SCALE18 + BigInt((m[2] || '').slice(0, 18).padEnd(18, '0'));
  return v > 0n ? v : null;
}

// The price's own age, in Unix seconds, from a price result. Only fields that
// describe when the price itself was set are used.
export function priceAsOfSecs(result) {
  if (!result) return null;
  if (Number.isInteger(result.last_updated_at)) return result.last_updated_at;
  const p = result.price_as_of;
  if (Number.isInteger(p)) return p;
  if (typeof p === 'string' && p) {
    const ms = Date.parse(p);
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
  }
  return null;
}

// Smallest gross (8-decimal units) worth at least the minimum at this price.
export function minGrossFor(env, priceUsd) {
  const e = minimumEnv(env);
  const p = toUsd18(priceUsd);
  if (!e || p === null) return null;
  const need = toUsd18(UTXO_MIN_LOCK_USD[e]) * 10n ** BigInt(UTXO_DECIMALS);
  return (need + p - 1n) / p;
}

// Returns { ok: true, grossUsd18, fee, principal } or { ok: false, reason }.
export function checkUtxoMinimumLock({ env, grossSmallestUnits, priceUsd, priceAsOf, nowSecs }) {
  const e = minimumEnv(env);
  if (!e) return { ok: false, reason: `no minimum lock size recorded for ${env}` };
  let gross;
  try { gross = BigInt(grossSmallestUnits); } catch { return { ok: false, reason: 'gross is not a whole number of smallest units' }; }
  if (gross <= 0n) return { ok: false, reason: 'gross must be positive' };
  const price = toUsd18(priceUsd);
  if (price === null) return { ok: false, reason: 'VF-ORC-005: no fresh price; lock refused' };
  if (!Number.isInteger(priceAsOf) || !Number.isInteger(nowSecs)) return { ok: false, reason: 'VF-ORC-005: price has no age; cannot confirm it is fresh; lock refused' };
  if (priceAsOf > nowSecs + PRICE_MAX_FUTURE_SECS) return { ok: false, reason: 'VF-ORC-005: price is stamped in the future; lock refused' };
  if (nowSecs - priceAsOf >= PRICE_MAX_AGE_SECS) return { ok: false, reason: 'VF-ORC-005: price is 24 hours old or older; lock refused' };
  const grossUsd18 = (gross * price) / 10n ** BigInt(UTXO_DECIMALS);
  const min18 = toUsd18(UTXO_MIN_LOCK_USD[e]);
  if (grossUsd18 < min18) {
    return { ok: false, reason: `Minimum lock: ${e} needs at least $${UTXO_MIN_LOCK_USD[e]} gross; this lock is under it` };
  }
  const fee = (gross * FEE_BPS) / 10000n;
  if (fee < UTXO_P2PKH_DUST[e]) {
    return { ok: false, reason: `5% fee output ${fee} is under the ${UTXO_P2PKH_DUST[e]} dust minimum; refused (fee is never raised)` };
  }
  return { ok: true, grossUsd18, fee, principal: gross - fee };
}

export const NO_FRESH_PRICE_MESSAGE = 'Minimum lock: Bitcoin, Bitcoin Cash and Litecoin locks need a fresh price (under 24 hours) to check the $20 / $1 / $1 minimum; refused';
