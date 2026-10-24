// Solana is not part of the 2026-10-21 deployment (t251u): the app does not
// offer it for a new lock and cannot build or submit a Solana lock (fail closed).
// The program id and the config, lock and vault PDA seeds in vfSolanaProgram.js
// are unchanged. Its Handshake constants follow Rev 12 (see
// solana-program-rev12.test.js); Rev 12 removed the Handshake allowance seed.
// Run: node --test src/tests/solana-not-deployed.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  NOT_IN_THIS_DEPLOYMENT, NOT_IN_THIS_DEPLOYMENT_LABEL, SOLANA_NOT_DEPLOYED_MESSAGE, SOLANA_LOCKS_ENABLED, isInThisDeployment,
} from '../lib/vfDeploymentScope.js';
import { validateLockRequest } from '../lib/vfSolanaLockEngine.js';
import { SolanaMockAdapter } from '../lib/vfSolanaMockAdapter.js';
import { ENVIRONMENTS } from '../lib/vfBaseRegistry.js';

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(path.join(SRC, rel), 'utf8');

// A request that would pass every other check if Solana assets were offerable.
const REQ = {
  assetSymbol: 'SOL', durationSecs: 604800, outputToken: 'VCLM',
  baseRecipient: '0x' + '1'.repeat(40), releaseDestination: 'D'.repeat(44), sourceAccount: 'E'.repeat(44),
  grossAssetUnits: '1000000000', verifiedGrossUsdMicro: (10n ** 19n).toString(), daysSinceLaunch: 0,
  chonxActivationReceipt: '', cumulativeVclmIssued: 0n,
};

test('scope: Solana is the one environment not in this deployment', () => {
  assert.deepEqual([...NOT_IN_THIS_DEPLOYMENT], ['Solana']);
  assert.equal(SOLANA_LOCKS_ENABLED, false);
  assert.equal(isInThisDeployment('Solana'), false);
  assert.equal(NOT_IN_THIS_DEPLOYMENT_LABEL, 'Not part of this deployment');
  for (const e of ENVIRONMENTS.filter((x) => x.id !== 'Solana')) assert.equal(isInThisDeployment(e.id), true, e.id);
});

test('Solana lock engine refuses every request (fail closed)', () => {
  for (const durationSecs of [3600, 604800, 315360000]) {
    const r = validateLockRequest({ ...REQ, durationSecs });
    assert.equal(r.ok, false);
    assert.equal(r.errors[0], SOLANA_NOT_DEPLOYED_MESSAGE);
    assert.deepEqual(r.checks[0], { id: 'VF-DEP-SOL', pass: false, detail: NOT_IN_THIS_DEPLOYMENT_LABEL });
  }
});

test('Solana mock adapter refuses to submit and records nothing as pending', () => {
  const a = new SolanaMockAdapter();
  for (const isHandshake of [true, false]) {
    const r = a.submitSimulation({ lockId: `l-${isHandshake}`, identity: '(Solana, x)', isHandshake });
    assert.equal(r.ok, false);
    assert.equal(r.reason, SOLANA_NOT_DEPLOYED_MESSAGE);
  }
  assert.equal(a.attempts.size, 0);
  // Revision 12: there is no per-account pending map or Handshake counter.
  assert.equal(a.pendingByIdentity, undefined);
  assert.equal(a.handshakeUsage, undefined);
  assert.ok(a.events.every((e) => e.type === 'SUBMISSION_PREVENTED'));
});

test('Solana instruction builder refuses; program id and seeds unchanged', () => {
  const src = read('lib/vfSolanaProgram.js');
  assert.match(src, /export async function buildCommitVaultLockParams\(params\) \{\n  \/\/ Solana is not part of this deployment: no lock instruction is built\.\n  if \(!SOLANA_LOCKS_ENABLED\) throw new Error\(SOLANA_NOT_DEPLOYED_MESSAGE\);/);
  // the Rust-mirrored constants are as before
  assert.ok(src.includes("export const PROGRAM_ID = 'Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS';"));
  for (const s of ["SEED_CONFIG = 'vf_config'", "SEED_LOCK = 'vf_lock'", "SEED_VAULT = 'vf_vault'"]) assert.ok(src.includes(s), s);
  // Rev 12: no Handshake allowance seed or PDA
  assert.ok(!src.includes('SEED_HANDSHAKE') && !src.includes('vf_handshake'), 'Handshake allowance seed still present');
});

test('Solana page says it is not part of this deployment and cannot submit', () => {
  const page = read('pages/SolanaLock.jsx');
  assert.ok(page.includes('data-testid="solana-not-deployed"'));
  assert.ok(page.includes('{NOT_IN_THIS_DEPLOYMENT_LABEL}'));
  assert.ok(page.includes('if (result.ok && SOLANA_LOCKS_ENABLED) {'));
  assert.ok(page.includes('if (!SOLANA_LOCKS_ENABLED) return;'));
});

test('no chain list for new locks offers Solana', () => {
  const tokenLayer = read('pages/TokenLayer.jsx');
  const envOptions = tokenLayer.slice(tokenLayer.indexOf('const ENV_OPTIONS'), tokenLayer.indexOf('].filter', tokenLayer.indexOf('const ENV_OPTIONS')));
  assert.ok(!envOptions.includes("'Solana'"));
  assert.ok(tokenLayer.includes('isInThisDeployment(e) && isOfferableEnvironmentNative(e)'));
  const baseVerifier = read('pages/BaseVerifier.jsx');
  const groups = baseVerifier.slice(baseVerifier.indexOf('const ENV_GROUPS'), baseVerifier.indexOf('function parseUsdToFixedPoint'));
  assert.ok(!groups.includes("'Solana'"));
  assert.ok(groups.includes('isInThisDeployment(e) && isOfferableEnvironmentNative(e)'));
  const pending = read('components/base/PendingAttemptPanel.jsx');
  assert.ok(pending.includes("useState('Ethereum')"));
  assert.ok(pending.includes('isInThisDeployment(e.id)'));
  // the Base lock page and the app nav do not link to the Solana page
  assert.ok(!read('pages/VinculumFlow.jsx').includes('/solana-lock'));
});
