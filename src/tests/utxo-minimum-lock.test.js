// Bitcoin $20, Bitcoin Cash $1, Litecoin $1 minimum lock (t230u), app side.
// Run: node --test src/tests/utxo-minimum-lock.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  UTXO_MIN_LOCK_USD, UTXO_P2PKH_DUST, PRICE_MAX_AGE_SECS, hasUtxoMinimum, minGrossFor, usdMinGrossFor,
  checkUtxoMinimumLock, priceAsOfSecs, toUsd18, UTXO_MIN_LOCK_FLOOR_UNITS, RELEASE_SPEND_BYTES, STRESS_RELEASE_FEE_RATE,
} from '../lib/vfUtxoMinimumLock.js';
import { buildMockEvent, UTXO_PRACTICE_GROSS } from '../lib/vfMockEventBuilder.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// CoinGecko USD prices read 2026-10-20 11:35 AM ET (test inputs only).
const PRICE = { Bitcoin: '82410', BitcoinCash: '276.28', Litecoin: '59.59' };
const NOW = 1792510532;
const ok = (env, gross, extra = {}) => checkUtxoMinimumLock({ env, grossSmallestUnits: gross, priceUsd: PRICE[env], priceAsOf: NOW, nowSecs: NOW, ...extra });

test('minimums are $20 / $1 / $1 and apply to Bitcoin, Bitcoin Cash, Litecoin only', () => {
  assert.deepEqual(UTXO_MIN_LOCK_USD, { Bitcoin: '20', BitcoinCash: '1', Litecoin: '1' });
  for (const e of ['Bitcoin', 'BitcoinCash', 'Bitcoin Cash', 'Litecoin']) assert.equal(hasUtxoMinimum(e), true, e);
  for (const e of ['Dogecoin', 'DigiByte', 'Zcash', 'Ethereum', 'Base', 'XRPL', 'Stellar', 'Solana']) assert.equal(hasUtxoMinimum(e), false, e);
});

test('same values as utxo-locks/lock.py (minimums, dust, 24-hour freshness)', () => {
  const py = readFileSync(path.join(ROOT, 'utxo-locks', 'lock.py'), 'utf8');
  assert.match(py, /"bitcoin": Decimal\("20"\)/);
  assert.match(py, /"bitcoin-cash": Decimal\("1"\)/);
  assert.match(py, /"litecoin": Decimal\("1"\)/);
  assert.match(py, /"bitcoin": 546,/);
  assert.match(py, /"bitcoin-cash": 546,/);
  assert.match(py, /"litecoin": 5_460,/);
  assert.match(py, /PRICE_MAX_AGE_SECS = 24 \* 60 \* 60/);
  assert.equal(PRICE_MAX_AGE_SECS, 86400);
  assert.deepEqual(UTXO_P2PKH_DUST, { Bitcoin: 546n, BitcoinCash: 546n, Litecoin: 5460n });
});

test('accept exactly at the minimum, refuse one unit below; fee exactly 5%', () => {
  const expected = { Bitcoin: 24269n, BitcoinCash: 361952n, Litecoin: 1678134n }; // same as lock.py min_gross_for
  for (const env of Object.keys(PRICE)) {
    const g = minGrossFor(env, PRICE[env]);
    assert.equal(g, expected[env], env);
    const r = ok(env, g);
    assert.equal(r.ok, true, `${env}: ${r.reason}`);
    assert.equal(r.fee, (g * 500n) / 10000n);
    assert.equal(r.principal, g - r.fee);
    const b = ok(env, g - 1n);
    assert.equal(b.ok, false);
    assert.match(b.reason, /Minimum lock/);
  }
});

test('fails closed without a fresh price', () => {
  const g = 10n ** 8n;
  for (const env of Object.keys(PRICE)) {
    for (const extra of [
      { priceUsd: null }, { priceUsd: undefined }, { priceUsd: 0 }, { priceUsd: '0' }, { priceUsd: '-5' },
      { priceUsd: 'abc' }, { priceUsd: NaN }, { priceUsd: Infinity }, { priceUsd: true },
      { priceAsOf: null }, { priceAsOf: undefined }, { nowSecs: undefined }, { priceAsOf: NOW + 0.5 },
      { priceAsOf: NOW - PRICE_MAX_AGE_SECS }, { priceAsOf: NOW - 30 * 86400 }, { priceAsOf: NOW + 301 },
    ]) {
      const r = ok(env, g, extra);
      assert.equal(r.ok, false, `${env} ${JSON.stringify(extra)}`);
    }
    assert.equal(ok(env, g, { priceAsOf: NOW - PRICE_MAX_AGE_SECS + 1 }).ok, true);
    assert.equal(ok(env, g, { priceUsd: Number(PRICE[env]) }).ok, true);
  }
});

test('a fetch-time stamp is not a price age; only last_updated_at / price_as_of count', () => {
  assert.equal(priceAsOfSecs({ usd: 82410, timestamp: '2026-10-20T15:35:00Z' }), null);
  assert.equal(priceAsOfSecs({ usd: 82410, last_updated_at: NOW }), NOW);
  assert.equal(priceAsOfSecs({ usd: 82410, price_as_of: NOW }), NOW);
  assert.equal(priceAsOfSecs({ usd: 82410, price_as_of: '2026-10-20T15:35:32Z' }), NOW);
  assert.equal(priceAsOfSecs({ usd: 82410, price_as_of: 'garbage' }), null);
  assert.equal(priceAsOfSecs(null), null);
});

test('native floors match lock.py and their derivation', () => {
  const py = readFileSync(path.join(ROOT, 'utxo-locks', 'lock.py'), 'utf8');
  assert.match(py, /"bitcoin": 22_000,/);
  assert.match(py, /"bitcoin-cash": 11_000,/);
  assert.match(py, /"litecoin": 110_000,/);
  assert.match(py, /RELEASE_SPEND_BYTES = 200/);
  assert.match(py, /STRESS_RELEASE_FEE_RATE = \{"bitcoin": 100, "bitcoin-cash": 5, "litecoin": 20\}/);
  assert.deepEqual(UTXO_MIN_LOCK_FLOOR_UNITS, { Bitcoin: 22000n, BitcoinCash: 11000n, Litecoin: 110000n });
  for (const env of Object.keys(UTXO_MIN_LOCK_FLOOR_UNITS)) {
    const dust = UTXO_P2PKH_DUST[env];
    const need = dust + STRESS_RELEASE_FEE_RATE[env] * RELEASE_SPEND_BYTES;
    const viaRelease = (need * 100n + 94n) / 95n;
    const raw = 20n * dust > viaRelease ? 20n * dust : viaRelease;
    const floor = UTXO_MIN_LOCK_FLOOR_UNITS[env];
    assert.ok(floor >= raw && floor - raw < 1000n, env);
    const fee = (floor * 500n) / 10000n;
    assert.ok(fee >= dust, env);
    assert.ok(floor - fee - STRESS_RELEASE_FEE_RATE[env] * RELEASE_SPEND_BYTES >= dust, env);
  }
});

test('effective minimum: USD minimum wins at today\'s price, the floor wins at high prices; at it accepted with exact 5%, one below refused', () => {
  const cases = [
    ['Bitcoin', '82000', 24391n, 'usd'],
    ['Bitcoin', '250000', 22000n, 'floor'],
    ['Bitcoin', '1000000', 22000n, 'floor'],
    ['BitcoinCash', '276.69', 361416n, 'usd'],
    ['BitcoinCash', '2766.9', 36142n, 'usd'],
    ['BitcoinCash', '27669', 11000n, 'floor'],
    ['Litecoin', '59.7', 1675042n, 'usd'],
    ['Litecoin', '597', 167505n, 'usd'],
    ['Litecoin', '5970', 110000n, 'floor'],
  ];
  for (const [env, price, expected, wins] of cases) {
    const g = minGrossFor(env, price);
    assert.equal(g, expected, `${env} ${price}`);
    assert.equal(UTXO_MIN_LOCK_FLOOR_UNITS[env] > usdMinGrossFor(env, price) ? 'floor' : 'usd', wins, `${env} ${price}`);
    const r = checkUtxoMinimumLock({ env, grossSmallestUnits: g, priceUsd: price, priceAsOf: NOW, nowSecs: NOW });
    assert.equal(r.ok, true, `${env} ${price}: ${r.reason}`);
    assert.equal(r.fee, (g * 500n) / 10000n);
    assert.equal(r.principal, g - r.fee);
    const b = checkUtxoMinimumLock({ env, grossSmallestUnits: g - 1n, priceUsd: price, priceAsOf: NOW, nowSecs: NOW });
    assert.equal(b.ok, false);
    assert.match(b.reason, wins === 'floor' ? /native floor/ : /needs at least \$/);
  }
});

test('never raises the fee: a price rise that would put 5% under dust is refused by the floor', () => {
  // $200,000 per BTC: $20 is 10,000 sats, 5% is 500 < 546. The floor (22,000) refuses it.
  assert.equal(usdMinGrossFor('Bitcoin', '200000'), 10000n);
  assert.equal(minGrossFor('Bitcoin', '200000'), 22000n);
  const r = checkUtxoMinimumLock({ env: 'Bitcoin', grossSmallestUnits: 10000n, priceUsd: '200000', priceAsOf: NOW, nowSecs: NOW });
  assert.equal(r.ok, false);
  assert.match(r.reason, /native floor/);
});

test('other chains are refused by this check (no minimum recorded), not silently passed', () => {
  for (const env of ['Dogecoin', 'Ethereum']) {
    const r = checkUtxoMinimumLock({ env, grossSmallestUnits: 10n ** 9n, priceUsd: '1', priceAsOf: NOW, nowSecs: NOW });
    assert.equal(r.ok, false);
  }
  assert.equal(toUsd18('1.5'), 15n * 10n ** 17n);
});

test('both app pages that build Bitcoin, Bitcoin Cash, Litecoin lock events run the check', () => {
  for (const page of ['TokenLayer.jsx', 'BaseVerifier.jsx']) {
    const src = readFileSync(path.join(ROOT, 'src', 'pages', page), 'utf8');
    assert.match(src, /vfUtxoMinimumLock/, page);
    assert.match(src, /hasUtxoMinimum\(/, page);
  }
  const tl = readFileSync(path.join(ROOT, 'src', 'pages', 'TokenLayer.jsx'), 'utf8');
  assert.match(tl, /checkUtxoMinimumLock\(/);
  assert.match(tl, /priceAsOfSecs\(/);
});

test('practice lock amounts clear the minimum with margin (BCH and LTC about $5, BTC about $82)', () => {
  // CoinGecko USD prices read 2026-10-20 12:30 PM ET (test inputs only).
  const P = { Bitcoin: '82405', BitcoinCash: '276.69', Litecoin: '59.7' };
  const AS_OF = 1792513842;
  assert.deepEqual(UTXO_PRACTICE_GROSS, { Bitcoin: 100000n, BitcoinCash: 1800000n, Litecoin: 8400000n });
  for (const env of Object.keys(P)) {
    const { type, event } = buildMockEvent(env, 604800, 'VCLM');
    assert.equal(type, 'utxo');
    assert.equal(BigInt(event.gross_satoshis), UTXO_PRACTICE_GROSS[env]);
    assert.equal(BigInt(event.fee_satoshis), (UTXO_PRACTICE_GROSS[env] * 500n) / 10000n);
    const r = checkUtxoMinimumLock({ env, grossSmallestUnits: event.gross_satoshis, priceUsd: P[env], priceAsOf: AS_OF, nowSecs: AS_OF });
    assert.equal(r.ok, true, `${env}: ${r.reason}`);
    // Margin: still at or above the minimum after the price falls by 60% (BCH, LTC) or 70% (BTC).
    const fallen = (Number(P[env]) * (env === 'Bitcoin' ? 0.3 : 0.4)).toFixed(4);
    assert.equal(checkUtxoMinimumLock({ env, grossSmallestUnits: event.gross_satoshis, priceUsd: fallen, priceAsOf: AS_OF, nowSecs: AS_OF }).ok, true, `${env} at ${fallen}`);
  }
  for (const env of ['Dogecoin', 'DigiByte', 'Zcash']) assert.equal(buildMockEvent(env, 604800, 'VCLM').event.gross_satoshis, '100000');
});

test('the documented fetchAssetPrice response (price_as_of, integer Unix seconds) is read; null refuses', () => {
  const resp = { usd: 82405, source: 'CoinGecko', timestamp: '2026-10-20T16:30:52.000Z', price_as_of: 1792513842 };
  const asOf = priceAsOfSecs(resp);
  assert.equal(asOf, 1792513842);
  const now = 1792513852;
  assert.equal(checkUtxoMinimumLock({ env: 'Bitcoin', grossSmallestUnits: 100000n, priceUsd: resp.usd, priceAsOf: asOf, nowSecs: now }).ok, true);
  const none = { ...resp, price_as_of: null };
  assert.equal(priceAsOfSecs(none), null);
  assert.equal(checkUtxoMinimumLock({ env: 'Bitcoin', grossSmallestUnits: 100000n, priceUsd: none.usd, priceAsOf: priceAsOfSecs(none), nowSecs: now }).ok, false);
});
