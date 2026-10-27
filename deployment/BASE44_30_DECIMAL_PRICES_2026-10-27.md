> SUPERSEDED (2026-10-27). Base44 refused this document: the live app's files are lockMint.js, mintConfig.js and the Lock page, and it points at a verifier (0x771f...B3C) that is not in our deployment records. Use deployment/BASE44_PROMPT_PRICE_FORMAT_v2_2026-10-27.txt instead. It detects the price format on chain (PRICE_SCALE() = 1e30 means 30 decimals; a revert plus USD_STABLE_MIN_PRICE() = 0.95e18 means 18 decimals; anything else is refused). The repo module src/lib/vfPriceFormat.js now follows the same rule. Pending: the operator applies and publishes the v2 prompt himself.

# Base44 change: Verifier price format, 18 or 30 decimals (VF-ORC-016)

Date: 2026-10-27. Authorized by the operator (messages pt451u and pt452u) for this change only.
Status: NOT published. Needs the operator to publish (see "How it reaches the live app").

## What this changes, in plain English

The Revision E Verifier stores USD prices with 30 decimals so a price like TigerOG 7.35e-19 is not rounded to zero. The Verifiers live today store 18 decimals. The app must show and use prices correctly for whichever Verifier it is pointed at.

- The price format is chosen by the Verifier address, never by guessing from the size of a number.
- 0xfA8A...6328 (live set of 2026-10-22) and 0xb067...47D (2026-10-12) are 18 decimals. Their display and math stay exactly as they are now.
- A not-yet-deployed Verifier (placeholder PENDING_DEPLOYMENT) is the Revision E Verifier, 30 decimals.
- Any other Verifier address is accepted only if PRICE_SCALE() returns exactly 1e30. Otherwise the app refuses.
- Valuation, the $0.01 minimum, the 5% fee and the S1/S2/S3 multipliers (1.5x, 1.3x, 1.0x) are identical. The lock still takes a USD value with 18 decimals.
- Do NOT point the app at any new address. Addresses are set later, in a separate step, after post-deploy reads succeed.

## Files and exact changes

1. NEW file src/lib/vfPriceFormat.js: paste the module at the end of this document.
2. src/lib/vfPriceService.js: remove the body of computeVerifiedGrossUsdMicro and replace it with
   `export { computeVerifiedGrossUsdMicro, computeVerifiedGrossUsdFormatAware } from './vfPriceFormat.js';`
   (the legacy function is moved unchanged into the new module).
3. src/lib/vfBaseEthLock.js:
   - verifiedGrossUsd(grossWei, priceScaled, priceDecimals = 18) returns valueUsd18(grossWei, 18, priceScaled, priceDecimals).
   - buildCreateNativeLock takes a new argument priceDecimals. If isSupportedPriceDecimals(priceDecimals) is false it refuses with "price format unknown". It parses the price with parseDecimalToScaled(priceUsd, priceDecimals). The returned object includes priceDecimals.
4. src/pages/TokenLayer.jsx: where usd was computed with computeVerifiedGrossUsdMicro, use
   `const fmt = priceDecimalsForConfiguredVerifier(<the configured Base verifier address>); const est = fmt.ok ? computeVerifiedGrossUsdFormatAware(grossAmount, decimals, priceResult.usd, SCALE, fmt.decimals) : null; if (est === null) { refuse(fmt.reason || 'price format unknown for this Verifier', 'Price format unknown'); return; } usd = est.toString();`
5. src/pages/VinculumFlow.jsx: compute `priceFormat = priceDecimalsForConfiguredVerifier(<configured Base verifier address>)`, pass `priceDecimals: priceFormat.ok ? priceFormat.decimals : undefined` to buildCreateNativeLock, and show one line under the price input: "Price format: N decimals (basis)" or "Price format unknown: reason".
6. Wherever the live app reads scheduledPrices(key): the returned first value is priceUsd18 on the live Verifiers and priceUsd30 on Revision E (same selector 0x3e72f4c9, same two outputs). Display it with formatPrice(raw, decimals) from the new module. The USDC and USDT floor is stableMinPrice(decimals) (0.95 in that format). Read USD_STABLE_MIN_PRICE() from the same Verifier; it must equal stableMinPrice(decimals).

In the repo copy the configured Verifier address is BASE_CONTRACTS.verifier in src/lib/vfDeployedAddresses.js (value PENDING_DEPLOYMENT today). In the repo copy the helper reads it for you; in the paste version above, pass it in.

## Verification done (all passed)

- App tests: src/tests/price-format-30.test.js (9) and the updated vinculum-flow-base-eth.test.js. Whole app suite: 112 of 112 pass.
- On-chain test against the Revision E Verifier built by the ceremony: base-contracts/test/app_price_format_revE.test.cjs (7 tests). It checks TigerOG 7.35e-19, USDC about $1, ETH, the real createNativeLock call built by the app, the $0.01 minimum, the 5% fee, S1/S2/S3 issuance equal to the Verifier's previewIssuance and to actual minted amounts, PRICE_SCALE() = 1e30, and refusal of a contract with no PRICE_SCALE().
- Live display unchanged (read-only calls on Base, 2026-10-27): both live Verifiers resolve to 18 decimals, USD_STABLE_MIN_PRICE equals the app's 0.95e18, PRICE_SCALE() reverts on both, and ETH shows 2392.22 (0xfA8A...6328) and 2473.32 (0xb067...47D). Evidence: deployment/evidence/base44_live_display_check_2026-10-27.json.
  The USDC_BASE price is not posted on either live Verifier (raw 0, usable false), so the app has nothing to display for it there. That is not changed by this work.

## How it reaches the live app

The repo is a Base44 project (base44/config.jsonc exists), so the Base44 CLI can deploy it: `npx base44@latest login`, link to the app, then `npx base44@latest site deploy`. The box is not signed in (checked 2026-10-27: login needs the operator to confirm a device code at https://app.base44.com/login/device), and the repo holds no app id. The repo cannot prove it equals the live app source, so a site deploy could overwrite live code. I did not publish.

Two ways to publish (operator choice):
- A. Web editor: open the Base44 app editor for the live app (the link is in your Base44 dashboard; it is not in the repo), paste this whole document into the chat as an instruction, review the diff, then Publish.
- B. CLI: on a computer where you are signed in, check out branch release/base-only-candidate and run the three CLI commands above. Compare the live app's code first.

## Module to paste: src/lib/vfPriceFormat.js

```js
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
// format by returning exactly 1e30 from PRICE_SCALE(); anything else is refused.
//
// Valuation is identical to the contracts in each case:
//   18 decimals: floor(floor(gross * 1e18 / 10^dec) * price / 1e18)
//   30 decimals: floor(gross * price / (10^dec * 1e12))
// Both return a USD value with 18 decimals, which is what the lock takes.
const PENDING = 'PENDING_DEPLOYMENT';

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

// Async resolver. readPriceScale() must return the bigint from PRICE_SCALE() or throw
// when the function does not exist. A Verifier outside the table is accepted only
// when PRICE_SCALE() is exactly 1e30. Nothing else is accepted.
export async function resolvePriceDecimals(verifierAddress, readPriceScale) {
  const known = priceDecimalsForVerifier(verifierAddress);
  if (known.ok || !known.needsOnChainRead) return known;
  if (typeof readPriceScale !== 'function') return { ok: false, reason: 'no on-chain reader supplied; price format unknown (refused)' };
  let scale;
  try { scale = BigInt(await readPriceScale()); } catch { scale = null; }
  if (scale === PRICE_SCALE_REVISION_E) {
    return { ok: true, decimals: PRICE_DECIMALS_REVISION_E, basis: 'on-chain PRICE_SCALE() = 1e30' };
  }
  return { ok: false, reason: 'verifier does not report PRICE_SCALE() = 1e30 and is not a known 18-decimal Verifier (refused)' };
}

// The format for the Verifier this app build is configured with.
export function priceDecimalsForConfiguredVerifier(verifierAddress) {
  return priceDecimalsForVerifier(verifierAddress);
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
```
