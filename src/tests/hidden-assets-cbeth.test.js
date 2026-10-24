// Operator decision 2026-10-24 (finding HH-013): cbETH on Base (Revision B row 25)
// is hidden at the app level. It is never shown or offered as a lock option.
// Revision B, its hash lock and the registry pin are unchanged.
// Run: node --test src/tests/hidden-assets-cbeth.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  ACTIVE_ALLOWLIST, HIDDEN_ASSETS, OFFERED_ENTRIES, OFFERED_COUNT, isOperatorHidden,
  resolveOfferable, isOfferable, filterOfferable, isOfferablePackageAsset, findAllowedToken,
  findAllowedNative,
} from '../lib/vfActiveAssetAllowlist.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const REVB = JSON.parse(readFileSync(path.join(ROOT, 'base-contracts', 'deployment', 'assetRegistry.revB.json'), 'utf8'));
const CBETH = ACTIVE_ALLOWLIST.entries.find((e) => e.environmentId === 'Base' && e.symbol === 'CBETH');
const cbethRecord = {
  registry_row: CBETH.row, symbol: CBETH.symbol, environment: 'Base', contract_or_native_identifier: CBETH.address,
};

test('the hidden list has exactly one entry, cbETH on Base, with a reason and finding HH-013', () => {
  assert.equal(HIDDEN_ASSETS.length, 1);
  const h = HIDDEN_ASSETS[0];
  assert.equal(h.environmentId, 'Base');
  assert.equal(h.symbol, 'CBETH');
  assert.equal(h.finding, 'HH-013');
  assert.match(h.reason, /operator decision 2026-10-24/);
  assert.match(h.reason, /HH-013/);
  assert.equal(h.address, CBETH.address.toLowerCase());
  assert.ok(Object.isFrozen(HIDDEN_ASSETS) && Object.isFrozen(h));
});

test('cbETH is still on Revision B and the allowlist mirror (487 rows unchanged)', () => {
  assert.equal(ACTIVE_ALLOWLIST.entries.length, 487);
  assert.ok(CBETH, 'cbETH row present in the allowlist mirror');
  assert.ok(isOperatorHidden(CBETH));
  const revbRows = REVB.entries || REVB;
  assert.equal(revbRows.length, 487);
});

test('cbETH is never shown or offered, on any entry path', () => {
  assert.equal(findAllowedToken('Base', CBETH.address), null);
  assert.equal(findAllowedToken('Base', CBETH.address.toUpperCase().replace('0X', '0x')), null);
  assert.equal(isOfferable(cbethRecord), false);
  assert.equal(resolveOfferable(cbethRecord).ok, false);
  assert.deepEqual(filterOfferable([cbethRecord]), []);
  assert.equal(isOfferablePackageAsset('Base', CBETH.address), false);
  assert.equal(isOfferablePackageAsset('Base', CBETH.canonicalAssetId), false);
  assert.ok(!OFFERED_ENTRIES.some((e) => e.environmentId === 'Base' && e.symbol === 'CBETH'));
  // Without a row number (manual address entry) it is refused too.
  assert.equal(isOfferable({ environment: 'Base', contract_or_native_identifier: CBETH.address }), false);
});

test('every other allowlisted asset is unaffected (486 offered)', () => {
  assert.equal(OFFERED_COUNT, 486);
  assert.equal(OFFERED_ENTRIES.length, ACTIVE_ALLOWLIST.entries.length - 1);
  for (const e of OFFERED_ENTRIES) {
    if (e.kind === 'token') {
      assert.equal(findAllowedToken(e.environmentId, e.address), e, `${e.environmentId} row ${e.row}`);
      assert.ok(isOfferablePackageAsset(e.environmentId, e.canonicalAssetId), `${e.environmentId} row ${e.row} canonical`);
      assert.ok(isOfferable({ registry_row: e.row, environment: e.environmentId, contract_or_native_identifier: e.address }));
    } else {
      assert.equal(findAllowedNative(e.environmentId, e.nativeId), e, `${e.environmentId} ${e.nativeId}`);
    }
  }
});

test('other Base assets and Base native ETH are still offered; a mixed list drops only cbETH', () => {
  const baseTokens = OFFERED_ENTRIES.filter((e) => e.environmentId === 'Base' && e.kind === 'token');
  assert.ok(baseTokens.length > 0);
  assert.ok(isOfferablePackageAsset('Base', 'native-ETH'));
  const other = baseTokens[0];
  const otherRecord = { registry_row: other.row, environment: 'Base', contract_or_native_identifier: other.address };
  assert.deepEqual(filterOfferable([cbethRecord, otherRecord]), [otherRecord]);
});
