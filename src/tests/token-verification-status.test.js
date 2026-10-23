// Candidate branch (test/registry-candidate-2026-10-23): the app hides any token
// whose row failed the 2026-10-23 on-chain check or was never checked; only
// verified tokens stay offerable. The status comes from
// src/data/tokenVerificationStatus.json (built by
// testing-rigs/registry-verify/buildCandidate.cjs), not a hardcoded list.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  ACTIVE_ALLOWLIST, TOKEN_VERIFICATION_STATUS, OFFERED_ENTRIES, buildStatusIndex, tokenVerification,
  resolveOfferable, isOfferable, filterOfferable, isOfferablePackageAsset, findAllowedToken,
} from '../lib/vfActiveAssetAllowlist.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEP = path.join(ROOT, 'base-contracts', 'deployment');
const HIST = JSON.parse(readFileSync(path.join(DEP, 'assetRegistry.resolved.json'), 'utf8')).entries;
const REVB = JSON.parse(readFileSync(path.join(DEP, 'assetRegistry.revB.json'), 'utf8')).entries;
const rec = (row, env) => {
  const h = HIST.find((e) => e.row === row && e.environmentId === env);
  return { registry_row: h.row, symbol: h.symbol, environment: h.environmentId, contract_or_native_identifier: h.identifier };
};
// Three allowlisted Revision B tokens used as fixtures.
const USDC = rec(1, 'Ethereum');
const USDT = rec(6, 'Ethereum');
const WBTC = rec(7, 'Ethereum');
const realRecords = TOKEN_VERIFICATION_STATUS.records;
const without = (...rows) => realRecords.filter((r) => !(r.environmentId === 'Ethereum' && rows.includes(r.row)));
const status = (env, row, s, reason) => ({ environmentId: env, row, address: HIST.find((e) => e.row === row && e.environmentId === env).identifier.toLowerCase(), status: s, ...(reason ? { reason } : {}) });

test('the status file is generated, current, and covers every checked row (876: 857 pass, 19 fail, 0 unchecked)', () => {
  const out = execFileSync('node', [path.join(ROOT, 'testing-rigs', 'registry-verify', 'buildCandidate.cjs'), '--check'], { encoding: 'utf8' });
  assert.match(out, /tokenVerificationStatus\.json is current/);
  assert.equal(realRecords.length, 876);
  assert.deepEqual(TOKEN_VERIFICATION_STATUS.counts, { records: 876, pass: 857, fail: 19 });
  assert.equal(realRecords.some((r) => r.environmentId === 'Solana'), false);
});

test('hidden if failed: an allowlisted token whose row failed verification is not offered on any path', () => {
  const statusIndex = buildStatusIndex({ records: [...without(1), status('Ethereum', 1, 'fail', 'symbol_mismatch')] });
  const opts = { statusIndex };
  assert.equal(tokenVerification(ACTIVE_ALLOWLIST.entries.find((e) => e.row === 1 && e.environmentId === 'Ethereum'), opts).status, 'fail');
  const r = resolveOfferable(USDC, opts);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'token_failed_verification');
  assert.equal(r.detail, 'symbol_mismatch');
  assert.equal(isOfferable(USDC, opts), false);
  assert.deepEqual(filterOfferable([USDC, USDT], opts).map((x) => x.symbol), ['USDT']);
  assert.equal(findAllowedToken('Ethereum', USDC.contract_or_native_identifier, opts), null); // manual address entry
  assert.equal(isOfferablePackageAsset('Ethereum', USDC.contract_or_native_identifier, opts), false); // proof package by address
  assert.equal(isOfferablePackageAsset('Ethereum', REVB.find((e) => e.row === 1).canonicalAssetId, opts), false); // by canonical id
  assert.equal(isOfferablePackageAsset('Ethereum', 'USDC', opts), false); // by app short id
  // the other tokens are unaffected
  assert.equal(isOfferable(USDT, opts), true);
});

test('hidden if unchecked: a token with status unchecked, or with no record at all, is not offered', () => {
  const unchecked = { statusIndex: buildStatusIndex({ records: [...without(6), status('Ethereum', 6, 'unchecked', 'rpc_timeout')] }) };
  assert.equal(resolveOfferable(USDT, unchecked).reason, 'token_not_verified');
  assert.equal(resolveOfferable(USDT, unchecked).detail, 'rpc_timeout');
  assert.equal(isOfferablePackageAsset('Ethereum', USDT.contract_or_native_identifier, unchecked), false);
  const neverChecked = { statusIndex: buildStatusIndex({ records: without(7) }) };
  assert.equal(resolveOfferable(WBTC, neverChecked).reason, 'token_not_verified');
  assert.equal(resolveOfferable(WBTC, neverChecked).detail, 'never_checked');
  assert.equal(findAllowedToken('Ethereum', WBTC.contract_or_native_identifier, neverChecked), null);
  // An empty status file hides every token but keeps the natives.
  const none = { statusIndex: buildStatusIndex({ records: [] }) };
  assert.equal(filterOfferable([USDC, USDT, WBTC], none).length, 0);
  assert.equal(isOfferable({ environment: 'Bitcoin', symbol: 'BTC', contract_or_native_identifier: 'NATIVE' }, none), true);
  assert.equal(isOfferablePackageAsset('Ethereum', 'native-ETH', none), true);
  // A pass record for a different row on the same address does not verify this row.
  const otherRow = { statusIndex: buildStatusIndex({ records: [...without(1), { ...status('Ethereum', 1, 'pass'), row: 458 }] }) };
  assert.equal(isOfferable(USDC, otherRow), false);
});

test('shown if verified: allowlisted tokens with a pass row are offered on every path, with the real status file', () => {
  for (const r of [USDC, USDT, WBTC]) {
    assert.equal(resolveOfferable(r).ok, true, r.symbol);
    assert.ok(findAllowedToken('Ethereum', r.contract_or_native_identifier));
  }
  assert.equal(isOfferablePackageAsset('Ethereum', 'USDC'), true);
  assert.equal(isOfferablePackageAsset('Ethereum', REVB.find((e) => e.row === 1).canonicalAssetId), true);
  // With today's results every allowlisted (Revision B) token passed, so the app still offers 475 tokens + 12 natives.
  for (const e of ACTIVE_ALLOWLIST.entries.filter((x) => x.kind === 'token')) assert.equal(tokenVerification(e).status, 'pass', `row ${e.row}`);
  assert.equal(OFFERED_ENTRIES.length, 487);
  // A row that failed today (Ethereum row 77, symbol_mismatch) is not offered.
  const failed = realRecords.find((r) => r.environmentId === 'Ethereum' && r.row === 77);
  assert.equal(failed.status, 'fail');
  assert.equal(isOfferable(rec(77, 'Ethereum')), false);
});
