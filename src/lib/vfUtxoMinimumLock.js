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
// Native floor (t235u): the minimum is the HIGHER of the USD minimum and a fixed
// floor in smallest units, so a lock at the minimum keeps an exact 5% fee at or
// above dust and a release that clears a stress fee rate, however high the coin
// price goes. Same numbers as lock.py MIN_LOCK_FLOOR_UNITS:
//   Bitcoin      22,000 sats      = max(20 x 546, ceil((546 + 100 sat/vB x 200 B) / 0.95) = 21,628), rounded up
//   Bitcoin Cash 11,000 sats      = max(20 x 546, ceil((546 + 5 sat/B x 200 B) / 0.95) = 1,628), rounded up
//   Litecoin     110,000 litoshis = max(20 x 5,460, ceil((5,460 + 20 lit/vB x 200 B) / 0.95) = 9,958), rounded up
//
// Handshake (t239u, same as the Revision B verifier, t238u, and lock.py
// HANDSHAKE_UNIT_BAND): on these three chains a 1-hour Handshake (3600 s) is a
// set coin amount, not a USD value. Gross must be within the unit band
// (inclusive): Bitcoin and Bitcoin Cash 11,000 to 22,000 sats, Litecoin 110,000
// to 220,000 litoshis. No price is needed. The fee is still exactly 5% and a
// fee under dust is refused. The verifier counts the Handshake as at most $0.02
// for VCLM and RAC, however much it is worth. The USD minimum and floor above
// apply to the other fifteen durations only.
//
// Other chains are not affected; their Handshake stays the $0.01 to $0.02 USD band.

export const UTXO_MIN_LOCK_USD = { Bitcoin: '20', BitcoinCash: '1', Litecoin: '1' };
export const UTXO_P2PKH_DUST = { Bitcoin: 546n, BitcoinCash: 546n, Litecoin: 5460n }; // lock.py P2PKH_DUST_MINIMUM
export const UTXO_MIN_LOCK_FLOOR_UNITS = { Bitcoin: 22000n, BitcoinCash: 11000n, Litecoin: 110000n };
export const RELEASE_SPEND_BYTES = 200n;
export const STRESS_RELEASE_FEE_RATE = { Bitcoin: 100n, BitcoinCash: 5n, Litecoin: 20n }; // units per byte
export const UTXO_DECIMALS = 8;
export const PRICE_MAX_AGE_SECS = 24 * 60 * 60;
export const PRICE_MAX_FUTURE_SECS = 5 * 60;
const FEE_BPS = 500n;
const SCALE18 = 10n ** 18n;

// Handshake unit band, inclusive. Equal to VinculumFinalisVerifier.sol
// BTC/BCH/LTC_HANDSHAKE_MIN_UNITS / _MAX_UNITS and lock.py HANDSHAKE_UNIT_BAND.
export const UTXO_HANDSHAKE_DURATION_SECS = 3600;
export const UTXO_HANDSHAKE_UNIT_BAND = {
  Bitcoin: [11000n, 22000n],
  BitcoinCash: [11000n, 22000n],
  Litecoin: [110000n, 220000n],
};
// The USD the verifier uses for these Handshakes' VCLM and RAC is capped here
// (VinculumFinalisVerifier.sol HANDSHAKE_USD_MAX = 0.02e18).
export const HANDSHAKE_ISSUANCE_USD_CAP = '0.02';
export const HANDSHAKE_ISSUANCE_USD_CAP_18 = 2n * 10n ** 16n;
const NATIVE_ASSET = { Bitcoin: 'native-BTC', BitcoinCash: 'native-BCH', Litecoin: 'native-LTC' };
const COIN = { Bitcoin: 'BTC', BitcoinCash: 'BCH', Litecoin: 'LTC' };
const UNIT_NAME = { Bitcoin: 'sats', BitcoinCash: 'sats', Litecoin: 'litoshis' };
const NAME = { Bitcoin: 'Bitcoin', BitcoinCash: 'Bitcoin Cash', Litecoin: 'Litecoin' };

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

// Smallest gross (8-decimal units) worth at least the USD minimum at this price.
export function usdMinGrossFor(env, priceUsd) {
  const e = minimumEnv(env);
  const p = toUsd18(priceUsd);
  if (!e || p === null) return null;
  const need = toUsd18(UTXO_MIN_LOCK_USD[e]) * 10n ** BigInt(UTXO_DECIMALS);
  return (need + p - 1n) / p;
}

// Effective minimum: the higher of the USD minimum at this price and the native floor.
export function minGrossFor(env, priceUsd) {
  const u = usdMinGrossFor(env, priceUsd);
  if (u === null) return null;
  const f = UTXO_MIN_LOCK_FLOOR_UNITS[minimumEnv(env)];
  return u > f ? u : f;
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
  if (gross < UTXO_MIN_LOCK_FLOOR_UNITS[e]) {
    return { ok: false, reason: `Minimum lock: ${e} needs at least ${UTXO_MIN_LOCK_FLOOR_UNITS[e]} units (native floor); this lock is under it` };
  }
  const fee = (gross * FEE_BPS) / 10000n;
  if (fee < UTXO_P2PKH_DUST[e]) {
    return { ok: false, reason: `5% fee output ${fee} is under the ${UTXO_P2PKH_DUST[e]} dust minimum; refused (fee is never raised)` };
  }
  return { ok: true, grossUsd18, fee, principal: gross - fee };
}

// True for a Bitcoin, Bitcoin Cash or Litecoin Handshake (3600 s). When a canonical
// asset id is given it must be that chain's native coin (same key the verifier uses).
export function isUtxoHandshake(env, durationSecs, canonicalAssetId) {
  const e = minimumEnv(env);
  if (!e || Number(durationSecs) !== UTXO_HANDSHAKE_DURATION_SECS) return false;
  return canonicalAssetId === undefined || canonicalAssetId === NATIVE_ASSET[e];
}

// Handshake check, no price. Returns { ok: true, fee, principal, band } or { ok: false, reason }.
export function checkUtxoHandshakeLock({ env, grossSmallestUnits }) {
  const e = minimumEnv(env);
  if (!e) return { ok: false, reason: `no Handshake unit band recorded for ${env}` };
  let gross;
  try { gross = BigInt(grossSmallestUnits); } catch { return { ok: false, reason: 'gross is not a whole number of smallest units' }; }
  const [low, high] = UTXO_HANDSHAKE_UNIT_BAND[e];
  if (gross < low) return { ok: false, reason: `VF-COM-003: ${NAME[e]} Handshake is ${gross} ${UNIT_NAME[e]}, under the ${low} band minimum; refused` };
  if (gross > high) return { ok: false, reason: `VF-COM-003: ${NAME[e]} Handshake is ${gross} ${UNIT_NAME[e]}, over the ${high} band maximum; refused` };
  const fee = (gross * FEE_BPS) / 10000n;
  if (fee < UTXO_P2PKH_DUST[e]) {
    return { ok: false, reason: `5% fee output ${fee} is under the ${UTXO_P2PKH_DUST[e]} dust minimum; refused (fee is never raised)` };
  }
  return { ok: true, fee, principal: gross - fee, band: [low, high] };
}

// The USD (18 decimals) the verifier uses for a BTC/BCH/LTC Handshake's VCLM and RAC.
export function capHandshakeUsd18(usd18) {
  const v = BigInt(usd18);
  return v > HANDSHAKE_ISSUANCE_USD_CAP_18 ? HANDSHAKE_ISSUANCE_USD_CAP_18 : v;
}

function coins(units) {
  const s = (Number(units) / 1e8).toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
  return s;
}

// Plain-words note for choosing a Handshake on these chains. priceUsd is shown
// only when it is fresh (priceAsOf under 24 hours old at nowSecs).
export function utxoHandshakeNote(env, { priceUsd, priceAsOf, nowSecs } = {}) {
  const e = minimumEnv(env);
  if (!e) return null;
  const [low, high] = UTXO_HANDSHAKE_UNIT_BAND[e];
  let usdText = 'No fresh price, so the dollar value is not shown.';
  const p = toUsd18(priceUsd);
  const fresh = p !== null && Number.isInteger(priceAsOf) && Number.isInteger(nowSecs)
    && priceAsOf <= nowSecs + PRICE_MAX_FUTURE_SECS && nowSecs - priceAsOf < PRICE_MAX_AGE_SECS;
  if (fresh) {
    const usd = (u) => (Number((u * p) / 10n ** BigInt(UTXO_DECIMALS)) / 1e18).toFixed(2);
    usdText = `That is about $${usd(low)} to $${usd(high)} at the current price.`;
  }
  return `A ${NAME[e]} Handshake is a set amount: ${coins(low)} to ${coins(high)} ${COIN[e]} `
    + `(${low.toLocaleString('en-US')} to ${high.toLocaleString('en-US')} ${UNIT_NAME[e]}). ${usdText} `
    + `It earns VCLM as if it were worth $${HANDSHAKE_ISSUANCE_USD_CAP}, whatever it is worth. `
    + 'The 5% fee goes to the Dev Fund and the rest is yours to release after one hour.';
}

export const NO_FRESH_PRICE_MESSAGE = 'Minimum lock: Bitcoin, Bitcoin Cash and Litecoin locks need a fresh price (under 24 hours) to check the $20 / $1 / $1 minimum (or the native floor, whichever is higher); refused';
