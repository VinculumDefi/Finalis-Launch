// Live contract rules in the practice simulator (t249u).
// Rev 12: 5% on every duration, Handshake $0.01 to $0.02. Contract minimum $0.01.
// The Revision 6 record (vfRevision6Authority.js) stays as transcribed, but no
// live code path reads its Handshake band, Handshake fee or $10 minimum.
// Run: node --test src/tests/live-rules.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { LIVE_RULES, HANDSHAKE_USD_MIN_FP, HANDSHAKE_USD_MAX_FP, STANDARD_USD_MIN_FP, feeBpsForDuration } from '../lib/vfLiveRules.js';
import { FIXED_RULES } from '../lib/vfRevision6Authority.js';
import { checkFeeMath, checkUsdBounds } from '../lib/vfVerifierEngine.js';
import { buildMockEvent, buildFinalityProof } from '../lib/vfMockEventBuilder.js';
import { normalizeSolanaEvidence } from '../lib/vfProofNormalizer.js';
import * as xrpl from '../lib/vfXrplLockEngine.js';
import * as sol from '../lib/vfSolanaLockEngine.js';
import { DEV_FUND_DESTINATIONS } from '../lib/vfBaseRegistry.js';
import { createRequire } from 'node:module';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');
const SCALE = 10n ** 18n;
const usd18 = (cents) => ((BigInt(cents) * SCALE) / 100n).toString();

test('LIVE_RULES equal the constants in CommitmentVaultLock.sol and VinculumFinalisVerifier.sol', () => {
  for (const f of ['base-contracts/contracts/CommitmentVaultLock.sol', 'base-contracts/contracts/VinculumFinalisVerifier.sol']) {
    const s = read(f);
    assert.match(s, /STANDARD_FEE_BPS = 500;/, f);
    assert.match(s, /HANDSHAKE_USD_MIN = 0\.01e18;/, f);
    assert.match(s, /HANDSHAKE_USD_MAX = 0\.02e18;/, f);
    assert.match(s, /STANDARD_USD_MIN = 0\.01e18;/, f);
  }
  assert.equal(LIVE_RULES.handshake_fee_bps, 500);
  assert.equal(LIVE_RULES.standard_fee_bps, 500);
  assert.equal(LIVE_RULES.handshake_value_usd_min, 0.01);
  assert.equal(LIVE_RULES.handshake_value_usd_max, 0.02);
  assert.equal(LIVE_RULES.standard_minimum_value_usd, 0.01);
  assert.equal(HANDSHAKE_USD_MIN_FP, 10n ** 16n);
  assert.equal(HANDSHAKE_USD_MAX_FP, 2n * 10n ** 16n);
  assert.equal(STANDARD_USD_MIN_FP, 10n ** 16n);
  assert.equal(feeBpsForDuration(3600), 500n);
  assert.equal(feeBpsForDuration(604800), 500n);
  assert.ok(Object.isFrozen(LIVE_RULES));
});

test('the Revision 6 record is unchanged (historical)', () => {
  assert.equal(FIXED_RULES.handshake_fee_bps, 250);
  assert.equal(FIXED_RULES.handshake_value_usd_min, 0.95);
  assert.equal(FIXED_RULES.handshake_value_usd_max, 1.05);
  assert.equal(FIXED_RULES.standard_minimum_value_usd, 10.0);
});

test('no live code path reads the stale Revision 6 Handshake band, Handshake fee or $10 minimum', () => {
  const files = [];
  const walk = (d) => {
    for (const f of readdirSync(path.join(ROOT, d))) {
      const rel = path.join(d, f);
      if (statSync(path.join(ROOT, rel)).isDirectory()) { if (!['tests', 'node_modules'].includes(f)) walk(rel); }
      else if (/\.(js|jsx)$/.test(f)) files.push(rel);
    }
  };
  for (const d of ['src/lib', 'src/pages', 'src/components', 'src/api', 'src/hooks', 'src/utils']) {
    try { walk(d); } catch { /* folder absent */ }
  }
  assert.ok(files.length > 20);
  const stale = /FIXED_RULES\s*\.\s*(handshake_fee_bps|handshake_value_usd_min|handshake_value_usd_max|standard_minimum_value_usd)/;
  const hits = files.filter((f) => f !== path.join('src', 'lib', 'vfRevision6Authority.js') && stale.test(read(f)));
  assert.deepEqual(hits, []);
});

test('verifier engine: 5% fee on the Handshake, 2.5% refused; $0.01 standard minimum', () => {
  const mock = buildMockEvent('Solana', 3600, 'VCLM');
  const pkg = normalizeSolanaEvidence(mock.event, buildFinalityProof('Solana')).package;
  const gross = BigInt(pkg.gross_amount_smallest_units);
  assert.equal(BigInt(pkg.actual_fee_amount_smallest_units), (gross * 500n) / 10000n);
  assert.equal(checkFeeMath(pkg).ok, true);
  const half = { ...pkg, actual_fee_amount_smallest_units: String((gross * 250n) / 10000n), principal_amount_smallest_units: String(gross - (gross * 250n) / 10000n) };
  assert.equal(checkFeeMath(half).ok, false);
  const std = { ...pkg, duration_secs: 604800 };
  assert.equal(checkUsdBounds(std, usd18(1)).ok, true);
  assert.equal(checkUsdBounds(std, '9999999999999999').ok, false);
  assert.equal(checkUsdBounds(pkg, usd18(1)).ok, true);
  assert.equal(checkUsdBounds(pkg, usd18(2)).ok, true);
  assert.equal(checkUsdBounds(pkg, '20000000000000001').ok, false);
  assert.equal(checkUsdBounds(pkg, usd18(100)).ok, false); // $1.00, the old band
});

for (const [name, eng, asset, src, dest] of [
  ['XRPL', xrpl, 'XRP', 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH', 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe'],
  ['Solana', sol, 'SOL', '7xKXtg2CW87d97TXJSDpbD5jBkheTqAAdANpSUQk3', '7xKXtg2CW87d97TXJSDpbD5jBkheTqAAdANpSUQk3'],
]) {
  test(`${name} practice engine: Handshake $0.01 to $0.02 and fee 5%; standard minimum $0.01`, () => {
    assert.equal(eng.computeFee(1000000, 3600).bps, 500);
    assert.equal(eng.computeFee(1000000, 3600).fee, 50000n);
    const req = (durationSecs, cents) => eng.validateLockRequest({
      assetSymbol: asset, durationSecs, outputToken: 'VCLM', baseRecipient: '0x' + '1'.repeat(40),
      releaseDestination: dest, sourceAccount: src, grossAssetUnits: '1000000',
      verifiedGrossUsdMicro: typeof cents === 'string' ? cents : usd18(cents), daysSinceLaunch: 0,
      chonxActivationReceipt: '', cumulativeVclmIssued: 0n,
    });
    const band = (r) => r.errors.filter((e) => e.startsWith('VF-COM-003') || e.startsWith('VF-COM-009'));
    assert.deepEqual(band(req(3600, 1)), []);
    assert.deepEqual(band(req(3600, 2)), []);
    assert.equal(band(req(3600, 100)).length, 1); // $1.00 was inside the old band
    assert.match(band(req(3600, '20000000000000001'))[0], /outside \$0\.01 to \$0\.02/);
    assert.equal(band(req(3600, '9999999999999999')).length, 1);
    assert.deepEqual(band(req(604800, 1)), []);
    assert.deepEqual(band(req(604800, 500)), []); // $5.00, refused under the old $10 rule
    assert.match(band(req(604800, '9999999999999999'))[0], /below \$0\.01 minimum/);
  });
}

// Base-only launch (t430u item 2): XRP is not offered, so the kept XRPL engine
// refuses it at VF-REG-001. Every other check still passes.
test('XRPL practice engine refuses XRP only at VF-REG-001 (Base-only deployment)', () => {
  const r = xrpl.validateLockRequest({
    assetSymbol: 'XRP', durationSecs: 3600, outputToken: 'VCLM', baseRecipient: '0x' + '1'.repeat(40),
    releaseDestination: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH', sourceAccount: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH',
    grossAssetUnits: '7500', verifiedGrossUsdMicro: ((15n * SCALE) / 1000n).toString(), daysSinceLaunch: 0,
    chonxActivationReceipt: '', cumulativeVclmIssued: 0n,
  });
  assert.equal(r.ok, false);
  assert.deepEqual(r.checks.filter((c) => !c.pass).map((c) => c.id), ['VF-REG-001']);
});

test('simulator Dev Funds equal the live Dev Funds the contracts are deployed with', () => {
  const require = createRequire(import.meta.url);
  const { rows } = require('../../base-contracts/deployment/representativeBase.cjs');
  const data = JSON.parse(read('base-contracts/scripts/deploy-pages/ceremony-data.json'));
  const NAME = { BNB: 'BNB Smart Chain', BitcoinCash: 'Bitcoin Cash', XRPL: 'XRP Ledger' };
  let n = 0;
  for (const [env, addr] of Object.entries(DEV_FUND_DESTINATIONS)) {
    if (addr == null) continue;
    const row = rows.find((r) => r.environment === (NAME[env] || env));
    assert.ok(row, env);
    assert.equal(addr, row.devFund, env);
    n++;
  }
  assert.equal(n, 16);
  assert.equal(DEV_FUND_DESTINATIONS.Base, data.devFund);
});
