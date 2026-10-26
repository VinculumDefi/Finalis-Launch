// App-side hiding: only Revision C assets that passed on-chain verification are offered.
// Run: node --test src/tests/active-asset-allowlist.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  ACTIVE_ALLOWLIST, resolveOfferable, isOfferable, filterOfferable, isOfferablePackageAsset,
  isOfferableEnvironmentNative, findAllowedToken, NOT_ACTIVE_MESSAGE,
} from '../lib/vfActiveAssetAllowlist.js';
import { validateLockRequest as validateSolana } from '../lib/vfSolanaLockEngine.js';
import { validateLockRequest as validateXrpl } from '../lib/vfXrplLockEngine.js';
import { SOLANA_REGISTRY } from '../lib/vfSolanaRegistry.js';
import { XRPL_REGISTRY } from '../lib/vfXrplRegistry.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEP = path.join(ROOT, 'base-contracts', 'deployment');
const REVC = JSON.parse(readFileSync(path.join(DEP, 'assetRegistry.revC.json'), 'utf8'));
const HIST = JSON.parse(readFileSync(path.join(DEP, 'assetRegistry.resolved.json'), 'utf8')).entries;
// A hosted-registry style record built from the historical row (same row, chain and address).
const rec = (row, env) => {
  const h = HIST.find((e) => e.row === row && (!env || e.environmentId === env));
  return { registry_row: h.row, symbol: h.symbol, environment: h.environmentId, contract_or_native_identifier: h.identifier };
};

test('allowlist equals Revision C exactly (487 entries: 475 tokens + 12 natives, 3 native links, nothing excluded)', () => {
  const key = (e) => `${e.environmentId}|${e.row}|${e.canonicalAssetId}`;
  assert.equal(ACTIVE_ALLOWLIST.entries.length, 487);
  assert.deepEqual(ACTIVE_ALLOWLIST.counts, { entries: 487, tokens: 475, natives: 12, nativeLinks: 3, excluded: 0 });
  assert.deepEqual(new Set(ACTIVE_ALLOWLIST.entries.map(key)), new Set(REVC.entries.map(key)));
  for (const e of REVC.entries) {
    const a = ACTIVE_ALLOWLIST.entries.find((x) => key(x) === key(e));
    if (e.kind === 'token') assert.equal(a.address, e.identifier.toLowerCase());
    else assert.equal(a.nativeId, e.assetId);
  }
  assert.deepEqual(ACTIVE_ALLOWLIST.nativeLinks.map((l) => [l.environmentId, l.symbol, l.usesRow]),
    REVC.nativeLinks.map((l) => [l.environmentId, l.symbol, l.usesRow]));
  assert.equal(ACTIVE_ALLOWLIST.entries.some((e) => e.environmentId === 'Solana'), false);
  for (const e of REVC.entries) assert.equal(ACTIVE_ALLOWLIST.entries.find((x) => key(x) === key(e)).custodyClass, e.custodyClass);
  // Rev 18 VF-REG-002: Base USDC (Circle) row 454 is S1.
  assert.equal(ACTIVE_ALLOWLIST.entries.find((x) => x.environmentId === 'Base' && x.row === 454).custodyClass, 1);
});

test('the committed allowlist is exactly what the builder produces from revC.json + today\'s verification', () => {
  const out = execFileSync('node', [path.join(ROOT, 'base-contracts', 'scripts', 'buildAppAllowlist.cjs'), '--check'], { encoding: 'utf8' });
  assert.match(out, /is current/);
});

test('a Revision C token is shown (Ethereum USDC row 1), matched by chain + address in any case', () => {
  const r = rec(1, 'Ethereum');
  assert.equal(isOfferable(r), true);
  assert.equal(isOfferable({ ...r, contract_or_native_identifier: r.contract_or_native_identifier.toUpperCase().replace('0X', '0x') }), true);
  assert.equal(isOfferable({ ...r, contract_or_native_identifier: r.contract_or_native_identifier.toLowerCase() }), true);
  // same address on another chain is a different key
  assert.equal(isOfferable({ ...r, environment: 'Polygon' }), false);
});

test('BAR row 77 (symbol-failure), TigerOG row 138, LionOG 999, FrogOG 1000 are hidden', () => {
  for (const [row, env] of [[77, 'Ethereum'], [138, 'Base'], [999, 'Base'], [1000, 'Base']]) {
    const r = rec(row, env);
    assert.equal(resolveOfferable(r).ok, false, `row ${row}`);
    assert.equal(resolveOfferable(r).reason, 'token_not_on_active_list');
  }
});

test('mislabelled row 152 ACM on MKR\'s address is hidden; MKR row 32 itself is shown; an alias row on a shown address is hidden', () => {
  const acm = rec(152, 'Ethereum'), mkr = rec(32, 'Ethereum');
  assert.equal(acm.contract_or_native_identifier.toLowerCase(), mkr.contract_or_native_identifier.toLowerCase());
  assert.equal(resolveOfferable(acm).reason, 'row_not_on_active_list');
  assert.equal(isOfferable(mkr), true);
  // a record without a row number is matched by chain + address only (e.g. a manual address)
  assert.equal(isOfferable({ environment: 'Ethereum', symbol: 'anything', contract_or_native_identifier: mkr.contract_or_native_identifier }), true);
});

test('Solana rows are hidden (token and native), and the Solana picker offers nothing', () => {
  const sol = HIST.find((e) => e.environmentId === 'Solana' && e.identifier && !/^NATIVE/i.test(e.identifier));
  assert.ok(sol);
  assert.equal(resolveOfferable({ environment: 'Solana', symbol: sol.symbol, contract_or_native_identifier: sol.identifier }).reason, 'solana_hidden');
  assert.equal(isOfferable({ environment: 'Solana', symbol: 'SOL', contract_or_native_identifier: 'NATIVE' }), false);
  assert.equal(filterOfferable(SOLANA_REGISTRY).length, 0);
  assert.ok(SOLANA_REGISTRY.length > 0);
});

test('a ticker-only match is hidden: no identifier, or a Revision C ticker on an address that is not its own', () => {
  assert.equal(resolveOfferable({ environment: 'Ethereum', symbol: 'USDC', contract_or_native_identifier: '' }).reason, 'no_contract_or_native_identifier');
  assert.equal(isOfferable({ environment: 'Ethereum', symbol: 'USDC' }), false);
  assert.equal(isOfferable({ environment: 'Ethereum', symbol: 'USDC', contract_or_native_identifier: 'USDC' }), false);
  assert.equal(isOfferable({ environment: 'Ethereum', symbol: 'USDC', contract_or_native_identifier: rec(77, 'Ethereum').contract_or_native_identifier }), false);
  // a native marker does not let a token ticker through
  assert.equal(isOfferable({ environment: 'Ethereum', symbol: 'USDC', contract_or_native_identifier: 'NATIVE' }), false);
});

test('natives on Revision C are shown; Cosmos ATOM (not on Revision C) is hidden', () => {
  const natives = [['Ethereum', 'ETH'], ['Base', 'ETH'], ['Bitcoin', 'BTC'], ['Dogecoin', 'DOGE'], ['Litecoin', 'LTC'], ['Bitcoin Cash', 'BCH'],
    ['DigiByte', 'DGB'], ['Zcash', 'ZEC'], ['XRP Ledger', 'XRP'], ['Stellar', 'XLM']];
  for (const [env, sym] of natives) assert.equal(isOfferable({ environment: env, symbol: sym, contract_or_native_identifier: 'NATIVE — no EVM contract' }), true, env);
  assert.equal(isOfferable({ environment: 'BNB Smart Chain', symbol: 'BNB', contract_or_native_identifier: '0x0000000000000000000000000000000000000000' }), true);
  assert.equal(isOfferable({ environment: 'Avalanche', symbol: 'AVAX', contract_or_native_identifier: '0x0000000000000000000000000000000000000000' }), true);
  assert.equal(isOfferable({ environment: 'Ethereum', symbol: 'ETH', contract_or_native_identifier: 'NATIVE ETH; pricing reference WETH:0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' }), true);
  // native links: Polygon POL, Arbitrum ETH, Optimism ETH
  for (const [env, sym] of [['Polygon', 'POL'], ['Arbitrum', 'ETH'], ['Optimism', 'ETH']]) assert.equal(isOfferable({ environment: env, symbol: sym, contract_or_native_identifier: 'NATIVE' }), true, env);
  assert.equal(isOfferable({ environment: 'Cosmos', symbol: 'ATOM', contract_or_native_identifier: 'NATIVE — no EVM contract' }), false);
  // wrong native on a chain
  assert.equal(isOfferable({ environment: 'Bitcoin', symbol: 'ETH', contract_or_native_identifier: 'NATIVE' }), false);
  assert.deepEqual(filterOfferable(XRPL_REGISTRY).map((a) => a.symbol), ['XRP']);
});

test('other entry paths refuse non-allowlisted assets: lock preflight, proof packages, manual addresses, environment pickers', () => {
  const base = { durationSecs: 604800, outputToken: 'VCLM', baseRecipient: '0x' + '1'.repeat(40), releaseDestination: 'x', sourceAccount: 'y',
    grossAssetUnits: '1000000', verifiedGrossUsdMicro: (10n ** 19n).toString(), daysSinceLaunch: 0, chonxActivationReceipt: '', cumulativeVclmIssued: 0n };
  // Saved or URL-supplied Solana symbol: refused even though it is in the Solana registry file.
  const s = validateSolana({ ...base, assetSymbol: SOLANA_REGISTRY[0].symbol });
  assert.equal(s.ok, false);
  assert.ok(s.errors.some((e) => e.startsWith(NOT_ACTIVE_MESSAGE)), s.errors.join('; '));
  // XRP stays accepted at VF-REG-001.
  const x = validateXrpl({ ...base, assetSymbol: 'XRP' });
  assert.equal(x.checks.find((c) => c.id === 'VF-REG-001').pass, true);
  // Proof packages
  assert.equal(isOfferablePackageAsset('Ethereum', 'USDC'), true);
  assert.equal(isOfferablePackageAsset('Ethereum', 'native-ETH'), true);
  assert.equal(isOfferablePackageAsset('BNB', 'native-BNB'), true);
  assert.equal(isOfferablePackageAsset('XRPL', 'native-XRP'), true);
  assert.equal(isOfferablePackageAsset('Solana', 'native-SOL'), false);
  assert.equal(isOfferablePackageAsset('CosmosHub', 'native-uatom'), false);
  assert.equal(isOfferablePackageAsset('Ethereum', REVC.entries.find((e) => e.row === 1).canonicalAssetId), true);
  assert.equal(isOfferablePackageAsset('Ethereum', HIST.find((e) => e.row === 77).canonicalAssetId), false);
  // Manual address entry
  assert.ok(findAllowedToken('Ethereum', rec(1, 'Ethereum').contract_or_native_identifier));
  assert.equal(findAllowedToken('Ethereum', rec(77, 'Ethereum').contract_or_native_identifier), null);
  assert.equal(findAllowedToken('Base', rec(138, 'Base').contract_or_native_identifier), null);
  assert.equal(isOfferablePackageAsset('Ethereum', rec(77, 'Ethereum').contract_or_native_identifier), false);
  // Environment pickers (simulated native locks)
  assert.equal(isOfferableEnvironmentNative('Solana'), false);
  assert.equal(isOfferableEnvironmentNative('CosmosHub'), false);
  for (const e of ['Ethereum', 'BNB', 'Avalanche', 'Polygon', 'Arbitrum', 'Base', 'Optimism', 'Bitcoin', 'Litecoin', 'Dogecoin', 'DigiByte', 'Zcash', 'BitcoinCash', 'XRPL', 'Stellar'])
    assert.equal(isOfferableEnvironmentNative(e), true, e);
});
