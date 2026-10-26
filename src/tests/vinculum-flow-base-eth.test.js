// VinculumFlow page: Cosmos removed, Base ETH lock call built for the new 5% Base lock.
// Run: node --test src/tests/vinculum-flow-base-eth.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  buildCreateNativeLock, computeFee, resolvePageAsset, submitLock, submitRelease, buildRelease,
  valuationReferenceFor, CREATE_NATIVE_LOCK_SELECTOR, ethToWei,
} from '../lib/vfBaseEthLock.js';
import { PERMITTED_DURATIONS, BASE_CHAIN, PENDING } from '../lib/vfIntegrationConfig.js';
import * as cfg from '../lib/vfIntegrationConfig.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { ethers } = createRequire(path.join(ROOT, 'base-contracts', 'package.json'))('ethers');
// Compiled ABI when base-contracts has been compiled (artifacts are not committed);
// otherwise the same two signatures as written in CommitmentVaultLock.sol.
const ART = path.join(ROOT, 'base-contracts', 'artifacts', 'contracts', 'CommitmentVaultLock.sol', 'CommitmentVaultLock.json');
const CVL_ABI = existsSync(ART) ? JSON.parse(readFileSync(ART, 'utf8')).abi : [
  'function createNativeLock(bytes32 lockId, address baseRecipient, uint8 outputToken, bytes32 assetIdentity, bytes32 valuationReference, address releaseDestination, uint256 duration, uint256 verifiedGrossUsd) payable returns (uint256 fee, uint256 principal)',
  'function release(bytes32 lockId)',
];
const CVL = new ethers.Interface(CVL_ABI);
const REVD = JSON.parse(readFileSync(path.join(ROOT, 'base-contracts', 'deployment', 'assetRegistry.revD.json'), 'utf8'));

const A = '0x' + '11'.repeat(20);
const B = '0x' + '22'.repeat(20);
const ID = '0x' + 'ab'.repeat(32);
const ok = { lockId: ID, baseRecipient: A, releaseDestination: B, outputToken: 'VCLM', durationSecs: 604800, grossEth: '0.01', priceUsd: '2500' };

test('page asset is Base ETH from the active list, with the Revision D Base ETH asset id', () => {
  const r = resolvePageAsset();
  assert.equal(r.ok, true);
  assert.equal(r.entry.environmentId, 'Base');
  assert.equal(r.entry.symbol, 'ETH');
  assert.equal(r.entry.row, 2);
  const revdEth = REVD.entries.find((e) => e.environmentId === 'Base' && e.kind === 'native');
  assert.equal(revdEth.row, 2);
  assert.equal(revdEth.canonicalAssetId.toLowerCase(), r.entry.canonicalAssetId.toLowerCase());
});

test('no Cosmos anywhere on the page or its config; Cosmos-only libraries removed', () => {
  const page = readFileSync(path.join(ROOT, 'src', 'pages', 'VinculumFlow.jsx'), 'utf8');
  for (const s of ['COSMOS_HUB', 'Keplr', 'keplr', 'uatom', 'cosmoshub-4', 'vfCosmosLock', 'vfProofAdapter']) assert.ok(!page.includes(s), s);
  assert.equal('COSMOS_HUB' in cfg, false);
  assert.equal(existsSync(path.join(ROOT, 'src', 'lib', 'vfCosmosLock.js')), false);
  assert.equal(existsSync(path.join(ROOT, 'src', 'lib', 'vfProofAdapter.js')), false);
});

test('durations equal CommitmentDurations.sol (16 rows)', () => {
  const sol = readFileSync(path.join(ROOT, 'base-contracts', 'contracts', 'CommitmentDurations.sol'), 'utf8');
  const rows = [...sol.matchAll(/if \(secs == (\d+)\) return (\d+);/g)].map((m) => [Number(m[1]), Number(m[2])]);
  assert.equal(rows.length, 16);
  assert.deepEqual(PERMITTED_DURATIONS.map((d) => [d.secs, d.multiplier_bps]), rows);
});

test('fee is floor(5%) on every duration, Handshake included', () => {
  assert.deepEqual(computeFee(1000n), { gross: '1000', fee: '50', principal: '950' });
  assert.deepEqual(computeFee(39n), { gross: '39', fee: '1', principal: '38' });
  for (const d of PERMITTED_DURATIONS) {
    const usd = d.secs === 3600 ? '1.5' : '2500'; // Handshake: 0.000006 ETH x $2,500 = $0.015
    const r = buildCreateNativeLock({ ...ok, durationSecs: d.secs, grossEth: d.secs === 3600 ? '0.00001' : '0.01', priceUsd: usd === '1.5' ? '1500' : usd });
    assert.equal(r.ok, true, `${d.secs}: ${r.errors}`);
    const gross = BigInt(r.call.value);
    assert.equal(BigInt(r.quote.fee), (gross * 500n) / 10000n);
  }
});

test('calldata decodes with the compiled CommitmentVaultLock ABI to exactly the arguments built', () => {
  const r = buildCreateNativeLock(ok);
  assert.equal(r.ok, true);
  assert.equal(CVL.getFunction('createNativeLock').selector, CREATE_NATIVE_LOCK_SELECTOR);
  assert.equal(CVL.getFunction('release').selector, buildRelease(ID).data.slice(0, 10));
  const d = CVL.decodeFunctionData('createNativeLock', r.call.data);
  assert.equal(d.lockId, ID);
  assert.equal(d.baseRecipient.toLowerCase(), A);
  assert.equal(d.outputToken, 0n);
  assert.equal(d.assetIdentity, resolvePageAsset().entry.canonicalAssetId);
  assert.equal(d.releaseDestination.toLowerCase(), B);
  assert.equal(d.duration, 604800n);
  assert.equal(d.verifiedGrossUsd, 25n * 10n ** 18n); // 0.01 ETH x $2,500 = $25
  assert.equal(r.call.value, (10n ** 16n).toString());
  const p = 2500n * 10n ** 18n;
  assert.equal(valuationReferenceFor(p), ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [p])));
  assert.equal(d.valuationReference, valuationReferenceFor(p));
});

test('fails closed: no price, zero price, bad addresses, bad id, bad duration, CHONX without receipt', () => {
  const bad = (o) => buildCreateNativeLock({ ...ok, ...o });
  assert.match(bad({ priceUsd: '' }).errors.join(), /VF-ORC-005/);
  assert.match(bad({ priceUsd: '0' }).errors.join(), /VF-ORC-005/);
  assert.equal(bad({ baseRecipient: '0x' + '0'.repeat(40) }).ok, false);
  assert.equal(bad({ releaseDestination: 'cosmos1abc' }).ok, false);
  assert.equal(bad({ lockId: 'abc' }).ok, false);
  assert.equal(bad({ durationSecs: 3601 }).ok, false);
  assert.equal(bad({ grossEth: '0' }).ok, false);
  assert.equal(bad({ grossEth: '0.0000000000000000001' }).ok, false); // 19 decimals
  assert.match(bad({ outputToken: 'CHONX' }).errors.join(), /VF-COM-025/);
  assert.equal(bad({ outputToken: 'CHONX', chonxActivationReceipt: 'r' }).ok, true);
  assert.equal(bad({ grossEth: '0.000000000000000019' }).ok, false); // fee rounds to zero
});

test('USD bounds mirror CommitmentVaultLock.sol (Handshake $0.01 to $0.02; others at least $0.01)', () => {
  const sol = readFileSync(path.join(ROOT, 'base-contracts', 'contracts', 'CommitmentVaultLock.sol'), 'utf8');
  assert.match(sol, /HANDSHAKE_USD_MIN = 0\.01e18/);
  assert.match(sol, /HANDSHAKE_USD_MAX = 0\.02e18/);
  assert.match(sol, /STANDARD_USD_MIN = 0\.01e18/);
  const hs = (eth) => buildCreateNativeLock({ ...ok, durationSecs: 3600, grossEth: eth, priceUsd: '1000' });
  assert.equal(hs('0.00001').ok, true);   // $0.01
  assert.equal(hs('0.00002').ok, true);   // $0.02
  assert.equal(hs('0.000021').ok, false); // $0.021
  assert.equal(hs('0.000009').ok, false); // $0.009
  assert.equal(buildCreateNativeLock({ ...ok, grossEth: '0.000009', priceUsd: '1000' }).ok, false);
  assert.equal(buildCreateNativeLock({ ...ok, grossEth: '0.00001', priceUsd: '1000' }).ok, true);
});

test('nothing is sent: lock and release are blocked (pending lock, or preview never broadcasts)', async () => {
  const r = buildCreateNativeLock(ok);
  const s = await submitLock(r);
  if (!cfg.CEREMONY.finalized) {
    assert.equal(BASE_CHAIN.lock_address, PENDING);
    assert.equal(r.call.to, PENDING);
    assert.equal(s.missing, 'BASE_CHAIN.lock_address');
  } else {
    assert.match(BASE_CHAIN.lock_address, /^0x[0-9a-fA-F]{40}$/);
    assert.equal(r.call.to, BASE_CHAIN.lock_address);
    assert.equal(s.missing, 'broadcast disabled');
  }
  assert.equal(s.ok, false); assert.equal(s.blocked, true);
  const rel = await submitRelease(ID);
  assert.equal(rel.ok, false); assert.equal(rel.blocked, true);
  assert.equal(ethToWei('1.5'), 15n * 10n ** 17n);
});

test('addresses come from one generated file; retired 2.5% locks are never offered for a new lock', () => {
  const cfgSrc = readFileSync(path.join(ROOT, 'src', 'lib', 'vfIntegrationConfig.js'), 'utf8');
  assert.ok(!/0x[0-9a-fA-F]{40}/.test(cfgSrc), 'vfIntegrationConfig.js must not type addresses');
  const gen = readFileSync(path.join(ROOT, 'src', 'lib', 'vfDeployedAddresses.js'), 'utf8');
  assert.match(gen, /^\/\/ GENERATED by base-contracts\/scripts\/applyCeremonyAddresses\.cjs/);
  // Base-only launch: one new lock (Base) and one reader (Base).
  assert.deepEqual(Object.keys(cfg.LOCKS_5PCT), ['Base']);
  assert.deepEqual(Object.keys(cfg.READERS), ['Base']);
  assert.equal('Solana' in cfg.READERS, false);
  for (const env of ['Ethereum', 'Arbitrum', 'Optimism', 'Polygon', 'BNB Smart Chain', 'Avalanche', 'Bitcoin', 'Solana']) assert.equal(cfg.lockForNewLock(env), null);
  const retired = cfg.RETIRED_LOCKS.map((r) => r.address.toLowerCase());
  assert.deepEqual(retired.sort(), ['0x4ede54e1cb6e337923f8d63fa0799ae778263b1a', '0x5ab40cdd51036ea88889c26e182b2936ddf76a8a', '0x968bfd5b580144b4398c10bb1e61bd8a6b1ac946']);
  for (const r of cfg.RETIRED_LOCKS) {
    assert.equal(r.new_locks, false); assert.equal(r.release_allowed, true);
    assert.equal(cfg.isRetiredLock(r.address), true);
    assert.equal(cfg.lockAllowedForRelease(r.address), true);
  }
  for (const env of Object.keys(cfg.LOCKS_5PCT)) {
    const a = cfg.lockForNewLock(env);
    if (cfg.CEREMONY.finalized) { assert.match(a, /^0x[0-9a-fA-F]{40}$/); assert.equal(cfg.isRetiredLock(a), false); }
    else assert.equal(a, null);
  }
  assert.equal(cfg.DEPLOYMENT_STATE, cfg.CEREMONY.finalized ? 'CONFIGURED' : 'AWAITING_DEPLOYMENT');
  assert.equal(cfg.isBaseVerifierPresent(), cfg.CEREMONY.finalized);
  for (const r of cfg.RETIRED_BASE_CONTRACTS) assert.notEqual(BASE_CHAIN.proof_verifier_address.toLowerCase(), r.address.toLowerCase());
});
