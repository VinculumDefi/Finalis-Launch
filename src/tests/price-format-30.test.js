// Format-aware prices (t452u, VF-ORC-016), app side.
// Run: node --test src/tests/price-format-30.test.js
// The format follows the Verifier address. Live Verifiers use 18-decimal prices and display
// exactly as before. The Revision E Verifier uses 30 decimals. No magnitude guess anywhere.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LEGACY_PRICE_VERIFIERS, USD_STABLE_MIN_PRICE_LEGACY, priceDecimalsForVerifier, resolvePriceDecimals, parseDecimalToScaled, numberToScaled,
  valueUsd18, formatPrice, formatPriceCompact, stableMinPrice, PRICE_SCALE_REVISION_E, estimateUsd18FromFeed,
} from '../lib/vfPriceFormat.js';
import {
  buildCreateNativeLock, verifiedGrossUsd, computeFee, usdToUsd18, STANDARD_USD_MIN, HANDSHAKE_USD_MIN, HANDSHAKE_USD_MAX,
} from '../lib/vfBaseEthLock.js';
import { computeVerifiedGrossUsdFormatAware, computeVerifiedGrossUsdMicro } from '../lib/vfPriceFormat.js';

const LIVE = '0xfA8A18e0ddE99a06C78231F82E26ec6160006328';
const OLD = '0xb0670826b79e29cc6a1c216Eb396D383a54af47D';
const NEW_ADDR = '0x1111111111111111111111111111111111111111';
const ID = '0x' + '11'.repeat(32);
const A = '0x' + '22'.repeat(20);
const B = '0x' + '33'.repeat(20);
const ok = { lockId: ID, baseRecipient: A, releaseDestination: B, outputToken: 'VCLM', durationSecs: 604800, grossEth: '0.01', priceUsd: '2500' };

test('format table: both live Verifiers are 18 decimals, the pending Revision E Verifier is 30', () => {
  for (const a of [LIVE, OLD, LIVE.toLowerCase(), OLD.toUpperCase().replace('0X', '0x')]) {
    const r = priceDecimalsForVerifier(a);
    assert.equal(r.ok, true, a); assert.equal(r.decimals, 18, a);
  }
  assert.equal(Object.keys(LEGACY_PRICE_VERIFIERS).length, 2);
  assert.equal(priceDecimalsForVerifier('PENDING_DEPLOYMENT').decimals, 30);
});

test('an unknown or malformed Verifier is refused unless it proves PRICE_SCALE() = 1e30', async () => {
  assert.equal(priceDecimalsForVerifier(NEW_ADDR).ok, false);
  assert.equal(priceDecimalsForVerifier('nonsense').ok, false);
  assert.equal(priceDecimalsForVerifier('').ok, false);
  assert.equal((await resolvePriceDecimals(NEW_ADDR)).ok, false); // no reader
  assert.equal((await resolvePriceDecimals(NEW_ADDR, async () => { throw new Error('execution reverted'); })).ok, false);
  assert.equal((await resolvePriceDecimals(NEW_ADDR, async () => 10n ** 18n)).ok, false);
  assert.equal((await resolvePriceDecimals(NEW_ADDR, async () => 10n ** 29n)).ok, false);
  const good = await resolvePriceDecimals(NEW_ADDR, async () => PRICE_SCALE_REVISION_E);
  assert.deepEqual([good.ok, good.decimals], [true, 30]);
  // A known 18-decimal Verifier never needs a read and a read cannot change it.
  let called = false;
  const live = await resolvePriceDecimals(LIVE, async () => { called = true; return PRICE_SCALE_REVISION_E; });
  assert.deepEqual([live.ok, live.decimals, called], [true, 18, false]);
});

test('exact parsing: TigerOG 7.35e-19 is kept at 30 decimals and refused at 18', () => {
  assert.equal(parseDecimalToScaled('7.35e-19', 30), 735000000000n);
  assert.equal(parseDecimalToScaled('0.000000000000000000735', 30), 735000000000n);
  assert.equal(parseDecimalToScaled('0.000000000000000000735', 18), null); // 21 places, more than 18
  assert.equal(parseDecimalToScaled('2500', 18), 2500n * 10n ** 18n);
  assert.equal(parseDecimalToScaled('2500.123456789012345678', 18), 2500123456789012345678n);
  assert.equal(parseDecimalToScaled('1.5e3', 30), 1500n * 10n ** 30n);
  assert.equal(parseDecimalToScaled('1', 24), null); // unsupported format
  for (const bad of ['', 'abc', '-1', '1,5', null, undefined]) assert.equal(parseDecimalToScaled(bad, 30), null, String(bad));
  assert.equal(numberToScaled(7.35e-19, 30), 735000000000n);
  assert.equal(numberToScaled(0.9998, 30), 9998n * 10n ** 26n);
  assert.equal(numberToScaled(2392.22, 18), 239222n * 10n ** 16n);
  assert.equal(numberToScaled(0, 30), null);
});

test('display: 18-decimal prices read exactly as before; 30-decimal prices keep tiny values', () => {
  assert.equal(formatPrice(2392220000000000000000n, 18), '2392.22');
  assert.equal(formatPrice(950000000000000000n, 18), '0.95');
  assert.equal(formatPrice(10n ** 18n, 18), '1');
  assert.equal(formatPrice(735000000000n, 30), '0.000000000000000000735');
  assert.equal(formatPriceCompact(735000000000n, 30), '7.35e-19');
  assert.equal(formatPrice(2319190000000000000000000000000000n, 30), '2319.19');
  assert.equal(formatPriceCompact(2319190000000000000000000000000000n, 30), '2319.19');
  assert.equal(stableMinPrice(18), 950000000000000000n);
  assert.equal(stableMinPrice(30), 950000000000000000000000000000n);
});

test('valuation: 18-decimal path is the existing formula, 30-decimal path is the Revision E formula', () => {
  // Live format unchanged (old helper and new helper agree for ETH).
  const gross = 10n ** 16n; // 0.01 ETH
  const p18 = usdToUsd18('2500');
  assert.equal(verifiedGrossUsd(gross, p18), 25n * 10n ** 18n);
  assert.equal(verifiedGrossUsd(gross, p18, 18), (gross * p18) / 10n ** 18n);
  assert.equal(valueUsd18(gross, 18, p18, 18), 25n * 10n ** 18n);
  // 30 decimals, ETH.
  const p30 = parseDecimalToScaled('2500', 30);
  assert.equal(valueUsd18(gross, 18, p30, 30), 25n * 10n ** 18n);
  // USDC (6 decimals) near $1, both formats.
  assert.equal(valueUsd18(1_500_000n, 6, parseDecimalToScaled('0.9998', 18), 18), 1_499_700_000_000_000_000n);
  assert.equal(valueUsd18(1_500_000n, 6, parseDecimalToScaled('0.9998', 30), 30), 1_499_700_000_000_000_000n);
  // TigerOG (9 decimals) at 7.35e-19: 2e27 units = 2e18 tokens = $1.47.
  assert.equal(valueUsd18(2n * 10n ** 27n, 9, 735000000000n, 30), 1_470_000_000_000_000_000n);
  // At 18 decimals that price cannot be stored, which is why the Revision E Verifier uses 30.
  assert.equal(parseDecimalToScaled('7.35e-19', 18), null);
  // Floor, never round up.
  assert.equal(valueUsd18(1n, 18, 1n, 30), 0n);
  assert.throws(() => valueUsd18(1n, 66, 1n, 30), /decimals out of range/);
  assert.throws(() => valueUsd18(1n, 18, 1n, 24), /unsupported/);
});

test('feed estimate: TigerOG is not rounded to zero at 30 decimals; the 18-decimal estimate path is unchanged', () => {
  const gross = (2n * 10n ** 27n).toString();
  const est30 = computeVerifiedGrossUsdFormatAware(gross, 9, 7.35e-19, 10n ** 18n, 30);
  assert.equal(est30, 1_470_000_000_000_000_000n);
  assert.equal(estimateUsd18FromFeed(gross, 9, 7.35e-19, 30), est30);
  // The old 1e8 estimate rounds that price to 0, which is what the 30-decimal path fixes.
  assert.equal(computeVerifiedGrossUsdMicro(gross, 9, 7.35e-19, 10n ** 18n), 0n);
  // 18-decimal Verifier: byte-identical to the old estimate.
  for (const [g, d, p] of [['10000000000000000', 18, 2392.22], ['1500000', 6, 0.9998], ['123456789', 9, 0.5]]) {
    assert.equal(computeVerifiedGrossUsdFormatAware(g, d, p, 10n ** 18n, 18), computeVerifiedGrossUsdMicro(g, d, p, 10n ** 18n));
  }
  assert.equal(computeVerifiedGrossUsdFormatAware(gross, 9, 7.35e-19, 10n ** 18n, 24), null);
});

test('lock build: price format is required and follows the Verifier', () => {
  assert.match(buildCreateNativeLock(ok).errors.join(), /price format unknown/);
  assert.match(buildCreateNativeLock({ ...ok, priceDecimals: 24 }).errors.join(), /price format unknown/);
  const live = buildCreateNativeLock({ ...ok, priceDecimals: 18 });
  const rev = buildCreateNativeLock({ ...ok, priceDecimals: 30 });
  assert.equal(live.ok, true); assert.equal(rev.ok, true);
  assert.equal(live.call.args.verifiedGrossUsd, (25n * 10n ** 18n).toString());
  assert.equal(rev.call.args.verifiedGrossUsd, (25n * 10n ** 18n).toString()); // same economics
  assert.notEqual(live.call.args.valuationReference, rev.call.args.valuationReference); // reference hashes the Verifier's own scale
  assert.equal(rev.priceDecimals, 30);
});

test('minimum $0.01, 5% fee and duration bounds are the same in both formats', () => {
  assert.equal(STANDARD_USD_MIN, 10n ** 16n);
  for (const dec of [18, 30]) {
    // $0.01 minimum: 0.000004 ETH at $2500 is exactly $0.01.
    const at = buildCreateNativeLock({ ...ok, priceDecimals: dec, grossEth: '0.000004' });
    assert.equal(at.ok, true, `min at ${dec}`);
    assert.equal(at.call.args.verifiedGrossUsd, (10n ** 16n).toString());
    const below = buildCreateNativeLock({ ...ok, priceDecimals: dec, grossEth: '0.000003999999999999' });
    assert.equal(below.ok, false, `below min at ${dec}`);
    assert.match(below.errors.join(), /below \$0\.01/);
    // 5% fee, floored.
    const q = buildCreateNativeLock({ ...ok, priceDecimals: dec }).quote;
    assert.deepEqual(q, computeFee(10n ** 16n));
    assert.equal(q.fee, (5n * 10n ** 14n).toString());
    // Handshake band $0.01 to $0.02.
    const hs = (eth) => buildCreateNativeLock({ ...ok, priceDecimals: dec, durationSecs: 3600, grossEth: eth, priceUsd: '1000' });
    assert.equal(hs('0.00001').ok, true);
    assert.equal(hs('0.00002').ok, true);
    assert.equal(hs('0.000020000000000001').ok, false);
    assert.equal(hs('0.000009').ok, false);
  }
  assert.equal(HANDSHAKE_USD_MIN, 10n ** 16n);
  assert.equal(HANDSHAKE_USD_MAX, 2n * 10n ** 16n);
});

test('a tiny 30-decimal price is never turned into a usable lock by rounding', () => {
  // 1 ETH at 7.35e-19 is worth far less than $0.01, so it is refused, not rounded.
  const r = buildCreateNativeLock({ ...ok, priceDecimals: 30, grossEth: '1', priceUsd: '7.35e-19' });
  assert.equal(r.ok, false);
  assert.match(r.errors.join(), /below \$0\.01/);
  // The same text cannot be entered for an 18-decimal Verifier at all.
  const r18 = buildCreateNativeLock({ ...ok, priceDecimals: 18, grossEth: '1', priceUsd: '7.35e-19' });
  assert.equal(r18.ok, false);
  assert.match(r18.errors.join(), /VF-ORC-005/);
});

test('on-chain rule for an unlisted Verifier: 1e30 scale is 30 decimals; revert plus 0.95e18 floor is 18; anything else is refused', async () => {
  const revert = async () => { throw new Error('execution reverted'); };
  const floor18 = async () => 95n * 10n ** 16n;
  assert.equal(USD_STABLE_MIN_PRICE_LEGACY, 95n * 10n ** 16n);
  // 18 decimals: an unlisted legacy Verifier (like the one the live app uses today) is accepted.
  const legacy = await resolvePriceDecimals(NEW_ADDR, revert, floor18);
  assert.deepEqual([legacy.ok, legacy.decimals], [true, 18]);
  // 30 decimals: PRICE_SCALE() = 1e30 wins and the floor is not consulted.
  let floorRead = false;
  const thirty = await resolvePriceDecimals(NEW_ADDR, async () => PRICE_SCALE_REVISION_E, async () => { floorRead = true; return 95n * 10n ** 28n; });
  assert.deepEqual([thirty.ok, thirty.decimals, floorRead], [true, 30, false]);
  // Refused: revert with any other floor, a failing floor read, no floor reader, a scale that is not 1e30
  // (even with a 0.95e18 floor), and a 1e30 scale that is not exact.
  assert.equal((await resolvePriceDecimals(NEW_ADDR, revert, async () => 95n * 10n ** 28n)).ok, false); // 0.95e30 floor but no scale
  assert.equal((await resolvePriceDecimals(NEW_ADDR, revert, async () => 10n ** 18n)).ok, false);
  assert.equal((await resolvePriceDecimals(NEW_ADDR, revert, async () => 95n * 10n ** 16n + 1n)).ok, false);
  assert.equal((await resolvePriceDecimals(NEW_ADDR, revert, revert)).ok, false);
  assert.equal((await resolvePriceDecimals(NEW_ADDR, revert)).ok, false);
  assert.equal((await resolvePriceDecimals(NEW_ADDR, async () => 10n ** 18n, floor18)).ok, false);
  assert.equal((await resolvePriceDecimals(NEW_ADDR, async () => 10n ** 30n + 1n, floor18)).ok, false);
  const refused = await resolvePriceDecimals(NEW_ADDR, async () => 10n ** 18n, floor18);
  assert.equal(refused.reason, 'Price format unknown for this verifier (refused)');
  // Malformed addresses are refused without any read.
  assert.equal((await resolvePriceDecimals('nonsense', revert, floor18)).ok, false);
  // A listed 18-decimal Verifier needs no read.
  let reads = 0;
  const listed = await resolvePriceDecimals(LIVE, async () => { reads++; return 0n; }, async () => { reads++; return 0n; });
  assert.deepEqual([listed.ok, listed.decimals, reads], [true, 18, 0]);
});
