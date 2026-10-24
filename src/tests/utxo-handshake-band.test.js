// Bitcoin, Bitcoin Cash and Litecoin Handshake unit band (t239u), app side.
// Same band as the Revision B verifier (t238u) and utxo-locks/lock.py.
// Run: node --test src/tests/utxo-handshake-band.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  UTXO_HANDSHAKE_UNIT_BAND, UTXO_HANDSHAKE_DURATION_SECS, HANDSHAKE_ISSUANCE_USD_CAP_18, UTXO_P2PKH_DUST,
  isUtxoHandshake, checkUtxoHandshakeLock, capHandshakeUsd18, utxoHandshakeNote, checkUtxoMinimumLock,
} from '../lib/vfUtxoMinimumLock.js';
import { buildMockEvent, buildFinalityProof, UTXO_PRACTICE_HANDSHAKE_GROSS, UTXO_PRACTICE_GROSS } from '../lib/vfMockEventBuilder.js';
import { VerifierState, verifyProof, computeIssuanceFromUsd, checkUsdBounds } from '../lib/vfVerifierEngine.js';
import { normalizeUtxoEvidence, normalizeEvmEvidence } from '../lib/vfProofNormalizer.js';
import { findAssetPrecision } from '../lib/vfBaseRegistry.js';
import { FIXED_RULES } from '../lib/vfSpecAuthority.js';
import { feeBpsForDuration } from '../lib/vfLiveRules.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');
const SCALE = 10n ** 18n;
const THREE = ['Bitcoin', 'BitcoinCash', 'Litecoin'];
const NATIVE = { Bitcoin: 'native-BTC', BitcoinCash: 'native-BCH', Litecoin: 'native-LTC' };

function utxoPkg(env, duration = 3600, gross) {
  const mock = buildMockEvent(env, duration, 'VCLM');
  if (gross !== undefined) {
    const fee = (BigInt(gross) * feeBpsForDuration(duration)) / 10000n; // 5% on every duration (Rev 12)
    mock.event.gross_satoshis = String(gross);
    mock.event.fee_satoshis = String(fee);
    mock.event.principal_satoshis = String(BigInt(gross) - fee);
  }
  const r = normalizeUtxoEvidence(env, mock.event, buildFinalityProof(env));
  assert.ok(r.ok, (r.errors || []).join('; '));
  return r.package;
}

test('band equals the Revision B verifier constants and lock.py HANDSHAKE_UNIT_BAND', () => {
  const sol = read('base-contracts/contracts/VinculumFinalisVerifier.sol');
  const c = (name) => BigInt(sol.match(new RegExp(`uint256 public constant ${name} = ([0-9_]+);`))[1].replace(/_/g, ''));
  assert.equal(BigInt(UTXO_HANDSHAKE_DURATION_SECS), c('HANDSHAKE_DURATION_SECS'));
  for (const [env, tag] of [['Bitcoin', 'BTC'], ['BitcoinCash', 'BCH'], ['Litecoin', 'LTC']]) {
    assert.deepEqual(UTXO_HANDSHAKE_UNIT_BAND[env], [c(`${tag}_HANDSHAKE_MIN_UNITS`), c(`${tag}_HANDSHAKE_MAX_UNITS`)]);
  }
  assert.match(sol, /HANDSHAKE_USD_MAX = 0\.02e18/);
  assert.equal(HANDSHAKE_ISSUANCE_USD_CAP_18, 2n * 10n ** 16n);
  const py = read('utxo-locks/lock.py');
  const band = py.match(/HANDSHAKE_UNIT_BAND = \{([\s\S]*?)\}/)[1];
  const pyBand = Object.fromEntries([...band.matchAll(/"([a-z-]+)": \(([0-9_]+), ([0-9_]+)\)/g)].map((m) => [m[1], [BigInt(m[2].replace(/_/g, '')), BigInt(m[3].replace(/_/g, ''))]]));
  assert.deepEqual(pyBand, { bitcoin: UTXO_HANDSHAKE_UNIT_BAND.Bitcoin, 'bitcoin-cash': UTXO_HANDSHAKE_UNIT_BAND.BitcoinCash, litecoin: UTXO_HANDSHAKE_UNIT_BAND.Litecoin });
});

test('min and max accepted with an exact 5% fee at or above dust; min-1 and max+1 refused; no price needed', () => {
  for (const env of THREE) {
    const [low, high] = UTXO_HANDSHAKE_UNIT_BAND[env];
    for (const g of [low, high]) {
      const r = checkUtxoHandshakeLock({ env, grossSmallestUnits: g });
      assert.ok(r.ok, r.reason);
      assert.equal(r.fee, (g * 500n) / 10000n);
      assert.equal(r.principal, g - r.fee);
      assert.ok(r.fee >= UTXO_P2PKH_DUST[env]);
    }
    assert.match(checkUtxoHandshakeLock({ env, grossSmallestUnits: low - 1n }).reason, /VF-COM-003: .*under the .* band minimum/);
    assert.match(checkUtxoHandshakeLock({ env, grossSmallestUnits: high + 1n }).reason, /VF-COM-003: .*over the .* band maximum/);
    assert.equal(checkUtxoHandshakeLock({ env, grossSmallestUnits: 'abc' }).ok, false);
  }
  assert.equal(checkUtxoHandshakeLock({ env: 'Dogecoin', grossSmallestUnits: 16500n }).ok, false);
});

test('isUtxoHandshake: only the three chains, only 3600 s, only the native asset', () => {
  for (const env of THREE) {
    assert.equal(isUtxoHandshake(env, 3600), true);
    assert.equal(isUtxoHandshake(env, 3600, NATIVE[env]), true);
    assert.equal(isUtxoHandshake(env, 3600, 'native-DOGE'), false);
    assert.equal(isUtxoHandshake(env, 604800), false);
  }
  assert.equal(isUtxoHandshake('Bitcoin Cash', 3600), true);
  for (const env of ['Dogecoin', 'DigiByte', 'Zcash', 'Ethereum', 'XRPL', 'Stellar']) assert.equal(isUtxoHandshake(env, 3600), false);
});

test('practice Handshake amounts are mid-band; standard practice amounts unchanged', () => {
  for (const env of THREE) {
    const [low, high] = UTXO_HANDSHAKE_UNIT_BAND[env];
    assert.equal(UTXO_PRACTICE_HANDSHAKE_GROSS[env], (low + high) / 2n);
    const ev = buildMockEvent(env, 3600, 'VCLM').event;
    assert.equal(BigInt(ev.gross_satoshis), UTXO_PRACTICE_HANDSHAKE_GROSS[env]);
    assert.ok(checkUtxoHandshakeLock({ env, grossSmallestUnits: ev.gross_satoshis }).ok);
    assert.equal(BigInt(buildMockEvent(env, 604800, 'VCLM').event.gross_satoshis), UTXO_PRACTICE_GROSS[env]);
  }
  assert.equal(BigInt(buildMockEvent('Dogecoin', 3600, 'VCLM').event.gross_satoshis), 100000n);
});

test('engine: BTC/BCH/LTC Handshake uses the unit band and counts at most $0.02 for VCLM and RAC', () => {
  for (const env of THREE) {
    const custody = findAssetPrecision(env, NATIVE[env]).custodyClass;
    for (const [usd18, counted] of [[9n * SCALE, HANDSHAKE_ISSUANCE_USD_CAP_18], [SCALE / 100n, SCALE / 100n]]) {
      const pkg = utxoPkg(env);
      const r = verifyProof(new VerifierState(), pkg, { verifiedGrossUsdMicro: usd18.toString(), daysSinceLaunch: 0 });
      assert.ok(r.ok, r.reason);
      const expected = computeIssuanceFromUsd(counted.toString(), pkg.selected_output_token, custody, 3600, 0);
      assert.equal(r.issuance.amount, expected.output.toString());
      const fee = BigInt(pkg.actual_fee_amount_smallest_units), gross = BigInt(pkg.gross_amount_smallest_units);
      assert.equal(BigInt(r.racCredit.credit), (((counted * fee) / gross) * 6000n) / 10000n);
    }
    const [low, high] = UTXO_HANDSHAKE_UNIT_BAND[env];
    for (const g of [low - 1n, high + 1n]) {
      const r = verifyProof(new VerifierState(), utxoPkg(env, 3600, g), { verifiedGrossUsdMicro: (SCALE / 100n).toString(), daysSinceLaunch: 0 });
      assert.equal(r.ok, false);
      assert.match(r.reason, /VF-COM-003: .*band/);
    }
    assert.equal(capHandshakeUsd18(10n ** 30n), HANDSHAKE_ISSUANCE_USD_CAP_18);
  }
});

test('engine: standard locks on these chains unchanged (USD path, uncapped)', () => {
  for (const env of THREE) {
    const pkg = utxoPkg(env, 604800);
    const usd = (50n * SCALE).toString();
    const b = checkUsdBounds(pkg, usd);
    assert.equal(b.issuanceUsdMicro, usd);
    const r = verifyProof(new VerifierState(), pkg, { verifiedGrossUsdMicro: usd, daysSinceLaunch: 0 });
    assert.ok(r.ok, r.reason);
    const custody = findAssetPrecision(env, NATIVE[env]).custodyClass;
    assert.equal(r.issuance.amount, computeIssuanceFromUsd(usd, pkg.selected_output_token, custody, 604800, 0).output.toString());
  }
});

test('engine: other chains keep the $0.01 to $0.02 Handshake USD band, uncapped (Ethereum, Dogecoin)', () => {
  const ethMock = buildMockEvent('Ethereum', 3600, 'VCLM');
  const eth = normalizeEvmEvidence('Ethereum', ethMock.event, buildFinalityProof('Ethereum')).package;
  const doge = utxoPkg('Dogecoin');
  for (const pkg of [eth, doge]) {
    for (const usd18 of [SCALE / 100n, (15n * SCALE) / 1000n, (2n * SCALE) / 100n]) {
      const b = checkUsdBounds(pkg, usd18.toString());
      assert.ok(b.ok, b.reason);
      assert.equal(b.issuanceUsdMicro, usd18.toString());
      assert.equal(b.unitBand, undefined);
    }
    for (const usd18 of [SCALE / 100n - 1n, (2n * SCALE) / 100n + 1n, SCALE, 9n * SCALE]) {
      const b = checkUsdBounds(pkg, usd18.toString());
      assert.equal(b.ok, false);
      assert.match(b.reason, /VF-COM-003: handshake USD .* outside \$0\.01 to \$0\.02/);
    }
  }
  const r = verifyProof(new VerifierState(), doge, { verifiedGrossUsdMicro: ((15n * SCALE) / 1000n).toString(), daysSinceLaunch: 0 });
  assert.ok(r.ok, r.reason);
  const custody = findAssetPrecision('Dogecoin', 'native-DOGE').custodyClass;
  assert.equal(r.issuance.amount, computeIssuanceFromUsd(((15n * SCALE) / 1000n).toString(), doge.selected_output_token, custody, 3600, 0).output.toString());
});

test('user note: set coin amount, USD only from a fresh price, counted as $0.02', () => {
  const now = 1792523380;
  const n = utxoHandshakeNote('Bitcoin', { priceUsd: '82465', priceAsOf: now - 60, nowSecs: now });
  assert.match(n, /0\.00011 to 0\.00022 BTC \(11,000 to 22,000 sats\)/);
  assert.match(n, /about \$9\.07 to \$18\.14/);
  assert.match(n, /as if it were worth \$0\.02/);
  assert.ok(!/\u2014/.test(n));
  const stale = utxoHandshakeNote('Bitcoin', { priceUsd: '82465', priceAsOf: now - 86400, nowSecs: now });
  assert.match(stale, /No fresh price/);
  assert.match(utxoHandshakeNote('Litecoin'), /0\.0011 to 0\.0022 LTC \(110,000 to 220,000 litoshis\)/);
  assert.match(utxoHandshakeNote('BitcoinCash'), /Bitcoin Cash Handshake/);
  assert.equal(utxoHandshakeNote('Dogecoin'), null);
});

test('pages: Handshakes on these chains are band-checked and show the note; no $0.95 band left in live paths', () => {
  for (const page of ['src/pages/TokenLayer.jsx', 'src/pages/BaseVerifier.jsx']) {
    const src = read(page);
    assert.match(src, /isUtxoHandshake\(env, duration(\.secs)?, (normResult|rawPkg)\.package\.canonical_asset_id\)/);
    assert.match(src, /checkUtxoHandshakeLock\(\{ env, grossSmallestUnits:/);
    assert.match(src, /utxoHandshakeNote\(env/);
  }
  const tl = read('src/pages/TokenLayer.jsx');
  assert.ok(!tl.includes('$0.95'));
  assert.match(tl, /\(15n \* SCALE\) \/ 1000n/);
  const engine = read('src/lib/vfVerifierEngine.js');
  assert.ok(!/\(95n \* SCALE\)|105n \* SCALE|outside \$0\.95/.test(engine)); // code, not the history comment
  // The Revision 6 record stays as transcribed (historical); the engine no longer reads its band.
  assert.equal(FIXED_RULES.handshake_value_usd_min, 0.95);
  assert.ok(!engine.includes('handshake_value_usd'));
  // The standard minimum lock check is unchanged and still needs a price.
  assert.equal(checkUtxoMinimumLock({ env: 'Bitcoin', grossSmallestUnits: 30000n }).ok, false);
});
