// App-side hiding: only the Base rows of Revision D that passed the on-chain read
// (and the founder override rows) are offered. Base only (operator decision t430u item 2).
// Run: node --test src/tests/active-asset-allowlist.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  ACTIVE_ALLOWLIST, resolveOfferable, isOfferable, filterOfferable, isOfferablePackageAsset,
  isOfferableEnvironmentNative, findAllowedToken, NOT_ACTIVE_MESSAGE, FOUNDER_OVERRIDE_ENTRIES,
  OFFERED_ENTRIES,
} from '../lib/vfActiveAssetAllowlist.js';
import { validateLockRequest as validateSolana } from '../lib/vfSolanaLockEngine.js';
import { validateLockRequest as validateXrpl } from '../lib/vfXrplLockEngine.js';
import { SOLANA_REGISTRY } from '../lib/vfSolanaRegistry.js';
import { XRPL_REGISTRY } from '../lib/vfXrplRegistry.js';
import { isInThisDeployment, ACTIVE_ENVIRONMENTS, XRPL_LOCKS_ENABLED, SOLANA_LOCKS_ENABLED } from '../lib/vfDeploymentScope.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEP = path.join(ROOT, 'base-contracts', 'deployment');
const REVD = JSON.parse(readFileSync(path.join(DEP, 'assetRegistry.revD.json'), 'utf8'));
const BASE = REVD.entries.filter((e) => e.environmentId === 'Base');
const HIST = JSON.parse(readFileSync(path.join(DEP, 'assetRegistry.resolved.json'), 'utf8')).entries;
const recD = (row) => {
  const e = BASE.find((x) => x.row === row);
  return { registry_row: e.row, symbol: e.symbol, environment: 'Base', contract_or_native_identifier: e.identifier };
};
const rec = (row, env) => {
  const h = HIST.find((e) => e.row === row && (!env || e.environmentId === env));
  return { registry_row: h.row, symbol: h.symbol, environment: h.environmentId, contract_or_native_identifier: h.identifier };
};
const OG = [[138, 'TigerOG', '0xcf7fc0de71238c9ec45ec2fd24fdc8521345dbb5'], [999, 'LionOG', '0x6731f2d7adf86cfba30d15c4d10113ce98f3492a'], [1000, 'FrogOG', '0x0e3b564bdd09348840811c7e1106bbd0e98b5b4f']];
const TEL_NEW = '0x7e13b43065380acdec1c2d138c579cbbbafa0731';
const TEL_OLD = '0x09be1692ca16e06f536f0038ff11d1da8524adb1';

test('this deployment is Base only', () => {
  assert.deepEqual([...ACTIVE_ENVIRONMENTS], ['Base']);
  assert.equal(isInThisDeployment('Base'), true);
  for (const e of ['Ethereum', 'BNB', 'Avalanche', 'Polygon', 'Arbitrum', 'Optimism', 'Bitcoin', 'Litecoin', 'Dogecoin', 'DigiByte', 'Zcash', 'BitcoinCash', 'XRPL', 'XRP Ledger', 'Stellar', 'Solana', 'CosmosHub', ''])
    assert.equal(isInThisDeployment(e), false, e);
  assert.equal(XRPL_LOCKS_ENABLED, false);
  assert.equal(SOLANA_LOCKS_ENABLED, false);
});

test('allowlist equals the Base rows of Revision D exactly (131 entries: 130 tokens + Base ETH, no native links, nothing excluded)', () => {
  const key = (e) => `${e.environmentId}|${e.row}|${e.canonicalAssetId}`;
  assert.equal(REVD.revision, 'D');
  assert.equal(REVD.entries.length, 591);
  assert.equal(BASE.length, 131);
  assert.deepEqual(ACTIVE_ALLOWLIST.counts, { entries: 131, tokens: 130, natives: 1, nativeLinks: 0, excluded: 0, founderOverride: 3, notOffered: 460 });
  assert.deepEqual(new Set(ACTIVE_ALLOWLIST.entries.map(key)), new Set(BASE.map(key)));
  for (const e of BASE) {
    const a = ACTIVE_ALLOWLIST.entries.find((x) => key(x) === key(e));
    if (e.kind === 'token') assert.equal(a.address, e.identifier.toLowerCase());
    else assert.equal(a.nativeId, e.assetId);
    assert.equal(a.custodyClass, e.custodyClass);
  }
  assert.ok(ACTIVE_ALLOWLIST.entries.every((e) => e.environmentId === 'Base'));
  assert.deepEqual(ACTIVE_ALLOWLIST.nativeLinks, []);
  // Rev 18 VF-REG-002: Base USDC (Circle) row 454 is S1.
  assert.equal(ACTIVE_ALLOWLIST.entries.find((x) => x.row === 454).custodyClass, 1);
});

test('the committed allowlist is exactly what the builder produces from revD.json + the 2026-10-26 on-chain read', () => {
  const out = execFileSync('node', [path.join(ROOT, 'base-contracts', 'scripts', 'buildAppAllowlist.cjs'), '--check'], { encoding: 'utf8' });
  assert.match(out, /is current/);
});

test('a Base token is shown (Base USDC row 454), matched by chain + address in any case', () => {
  const r = recD(454);
  assert.equal(isOfferable(r), true);
  assert.equal(isOfferable({ ...r, contract_or_native_identifier: r.contract_or_native_identifier.toUpperCase().replace('0X', '0x') }), true);
  assert.equal(isOfferable({ ...r, contract_or_native_identifier: r.contract_or_native_identifier.toLowerCase() }), true);
  // same address on another chain is a different key, and that chain is not offered
  assert.equal(isOfferable({ ...r, environment: 'Ethereum' }), false);
});

test('founder override: TigerOG row 138, LionOG 999, FrogOG 1000 are always offered, by exact Base contract', () => {
  assert.deepEqual(FOUNDER_OVERRIDE_ENTRIES.map((e) => [e.row, e.symbol, e.address]), OG);
  for (const [row, sym, addr] of OG) {
    const r = recD(row);
    assert.equal(r.contract_or_native_identifier.toLowerCase(), addr);
    assert.equal(resolveOfferable(r).ok, true, sym);
    assert.ok(findAllowedToken('Base', addr), sym);
    assert.ok(OFFERED_ENTRIES.some((e) => e.row === row), sym);
    assert.match(resolveOfferable(r).entry.founderOverride, /founder override/);
    // the ticker alone, or the same ticker on another address, is not the override
    assert.equal(isOfferable({ environment: 'Base', symbol: sym, contract_or_native_identifier: '' }), false);
    assert.equal(isOfferable({ environment: 'Base', symbol: sym, contract_or_native_identifier: '0x' + '7'.repeat(40) }), false);
  }
  assert.equal(ACTIVE_ALLOWLIST.entries.filter((e) => e.founderOverride).length, 3);
});

test('TEL is offered on the upgraded Base contract only (t430u item 3)', () => {
  const tel = ACTIVE_ALLOWLIST.entries.filter((e) => e.symbol === 'TEL');
  assert.equal(tel.length, 1);
  assert.equal(tel[0].address, TEL_NEW);
  assert.ok(findAllowedToken('Base', TEL_NEW));
  assert.equal(findAllowedToken('Base', TEL_OLD), null);
});

test('rows of every other chain are hidden: Ethereum USDC row 1, BAR row 77, MKR row 32', () => {
  for (const [row, env] of [[1, 'Ethereum'], [77, 'Ethereum'], [32, 'Ethereum']]) {
    const r = rec(row, env);
    assert.equal(isOfferable(r), false, `row ${row}`);
    assert.equal(resolveOfferable(r).reason, 'not_in_this_deployment');
  }
});

test('Solana rows are hidden (token and native), and the Solana picker offers nothing', () => {
  const sol = HIST.find((e) => e.environmentId === 'Solana' && e.identifier && !/^NATIVE/i.test(e.identifier));
  assert.ok(sol);
  assert.equal(resolveOfferable({ environment: 'Solana', symbol: sol.symbol, contract_or_native_identifier: sol.identifier }).reason, 'solana_hidden');
  assert.equal(isOfferable({ environment: 'Solana', symbol: 'SOL', contract_or_native_identifier: 'NATIVE' }), false);
  assert.equal(filterOfferable(SOLANA_REGISTRY).length, 0);
  assert.ok(SOLANA_REGISTRY.length > 0);
});

test('a ticker-only match is hidden: no identifier, or a ticker on an address that is not its own', () => {
  assert.equal(resolveOfferable({ environment: 'Base', symbol: 'USDC', contract_or_native_identifier: '' }).reason, 'no_contract_or_native_identifier');
  assert.equal(isOfferable({ environment: 'Base', symbol: 'USDC' }), false);
  assert.equal(isOfferable({ environment: 'Base', symbol: 'USDC', contract_or_native_identifier: 'USDC' }), false);
  assert.equal(isOfferable({ environment: 'Base', symbol: 'USDC', contract_or_native_identifier: TEL_OLD }), false);
  // a native marker does not let a token ticker through
  assert.equal(isOfferable({ environment: 'Base', symbol: 'USDC', contract_or_native_identifier: 'NATIVE' }), false);
});

test('Base ETH is the only native shown; natives of every other chain are hidden', () => {
  assert.equal(isOfferable({ environment: 'Base', symbol: 'ETH', contract_or_native_identifier: 'NATIVE' }), true);
  const others = [['Ethereum', 'ETH'], ['Bitcoin', 'BTC'], ['Dogecoin', 'DOGE'], ['Litecoin', 'LTC'], ['Bitcoin Cash', 'BCH'],
    ['DigiByte', 'DGB'], ['Zcash', 'ZEC'], ['XRP Ledger', 'XRP'], ['Stellar', 'XLM'], ['Polygon', 'POL'], ['Arbitrum', 'ETH'], ['Optimism', 'ETH'], ['Cosmos', 'ATOM']];
  for (const [env, sym] of others) assert.equal(isOfferable({ environment: env, symbol: sym, contract_or_native_identifier: 'NATIVE' }), false, env);
  assert.equal(isOfferable({ environment: 'BNB Smart Chain', symbol: 'BNB', contract_or_native_identifier: '0x0000000000000000000000000000000000000000' }), false);
  assert.equal(isOfferable({ environment: 'Base', symbol: 'BTC', contract_or_native_identifier: 'NATIVE' }), false);
  assert.deepEqual(filterOfferable(XRPL_REGISTRY), []);
});

test('other entry paths refuse non-allowlisted assets: lock preflight, proof packages, manual addresses, environment pickers', () => {
  const base = { durationSecs: 604800, outputToken: 'VCLM', baseRecipient: '0x' + '1'.repeat(40), releaseDestination: 'x', sourceAccount: 'y',
    grossAssetUnits: '1000000', verifiedGrossUsdMicro: (10n ** 19n).toString(), daysSinceLaunch: 0, chonxActivationReceipt: '', cumulativeVclmIssued: 0n };
  const s = validateSolana({ ...base, assetSymbol: SOLANA_REGISTRY[0].symbol });
  assert.equal(s.ok, false);
  assert.ok(s.errors.some((e) => e.startsWith(NOT_ACTIVE_MESSAGE)), s.errors.join('; '));
  // XRP is no longer offered: the XRPL preflight fails VF-REG-001 (the engine code is kept).
  const x = validateXrpl({ ...base, assetSymbol: 'XRP' });
  assert.equal(x.checks.find((c) => c.id === 'VF-REG-001').pass, false);
  // Proof packages
  assert.equal(isOfferablePackageAsset('Base', 'native-ETH'), true);
  assert.equal(isOfferablePackageAsset('Base', recD(454).contract_or_native_identifier), true);
  assert.equal(isOfferablePackageAsset('Base', BASE.find((e) => e.row === 454).canonicalAssetId), true);
  for (const [env, id] of [['Ethereum', 'native-ETH'], ['BNB', 'native-BNB'], ['XRPL', 'native-XRP'], ['Solana', 'native-SOL'], ['CosmosHub', 'native-uatom'], ['Ethereum', 'USDC']])
    assert.equal(isOfferablePackageAsset(env, id), false, `${env} ${id}`);
  assert.equal(isOfferablePackageAsset('Ethereum', HIST.find((e) => e.row === 1).canonicalAssetId), false);
  // Manual address entry
  assert.ok(findAllowedToken('Base', recD(454).contract_or_native_identifier));
  assert.equal(findAllowedToken('Ethereum', rec(1, 'Ethereum').contract_or_native_identifier), null);
  // Environment pickers (simulated native locks)
  assert.equal(isOfferableEnvironmentNative('Base'), true);
  for (const e of ['Ethereum', 'BNB', 'Avalanche', 'Polygon', 'Arbitrum', 'Optimism', 'Bitcoin', 'Litecoin', 'Dogecoin', 'DigiByte', 'Zcash', 'BitcoinCash', 'XRPL', 'Stellar', 'Solana', 'CosmosHub'])
    assert.equal(isOfferableEnvironmentNative(e), false, e);
});
