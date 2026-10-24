// Revision 12 Handshake rules (Master Specification Revision 12, lines 10, 11
// and 16): 1 hour, $0.01 to $0.02, 5% fee, and no allowance limit. A wallet may
// create any number of 1-hour Handshakes. There is no handshakeIdentity and no
// allowance counter.
// Run: node --test src/tests/handshake-rev12.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PendingAttemptLifecycle } from '../lib/vfPendingAttemptLifecycle.js';
import { XrplMockAdapter } from '../lib/vfXrplMockAdapter.js';
import * as xrplAuthority from '../lib/vfXrplAuthority.js';
import { ENVIRONMENTS } from '../lib/vfBaseRegistry.js';
import { REQUIREMENTS, STATUS } from '../lib/vfComplianceData.js';

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(path.join(SRC, rel), 'utf8');

test('lifecycle accepts many pending attempts from one source account', () => {
  const lc = new PendingAttemptLifecycle();
  for (const env of ['Ethereum', 'Bitcoin', 'XRPL', 'Stellar']) {
    for (let i = 0; i < 5; i++) {
      const r = lc.registerAttempt(env, `(${env}, acct-1)`, `${env}-lock-${i}`, 1000 + i);
      assert.equal(r.ok, true, `${env} attempt ${i}: ${r.reason}`);
    }
  }
  assert.equal(lc.getPendingAttempts().length, 20);
  // A duplicate lockId is still refused (VF-XCH-013); that rule is not a Handshake limit.
  assert.equal(lc.registerAttempt('Ethereum', '(Ethereum, acct-1)', 'Ethereum-lock-0', 2000).ok, false);
});

test('XRPL mock adapter recognizes 5 Handshakes from one account', () => {
  const a = new XrplMockAdapter();
  for (let i = 0; i < 5; i++) {
    const id = `hs-${i}`;
    assert.equal(a.submitSimulation({ lockId: id, identity: '(XRPL, rAcct)', isHandshake: true }).ok, true);
  }
  assert.equal(a.handshakeUsage, undefined);
  assert.equal(a.checkHandshakeEligibility, undefined);
});

test('no environment row carries an allowance or a counting flag', () => {
  for (const e of ENVIRONMENTS) {
    assert.equal(e.handshakeAllowance, undefined, e.id);
    assert.equal(e.countsPerIdentity, undefined, e.id);
    assert.equal(e.handshakeEnforcement, undefined, e.id);
  }
  assert.equal(xrplAuthority.XRPL_HANDSHAKE_ALLOWANCE, undefined);
});

test('Revision 6 allowance requirements are marked superseded', () => {
  for (const id of ['VF-COM-005', 'VF-COM-006', 'VF-COM-007', 'VF-COM-008', 'VF-COM-024']) {
    const r = REQUIREMENTS.find((x) => x.id === id);
    assert.equal(r.status, STATUS.SUPERSEDED, id);
    assert.match(r.trace, /Revision 12/, id);
  }
});

test('verifier, normalizer and adapters have no allowance check', () => {
  const files = [
    'lib/vfVerifierEngine.js', 'lib/vfProofNormalizer.js', 'lib/vfBaseRegistry.js',
    'lib/vfSolanaMockAdapter.js', 'lib/vfXrplMockAdapter.js', 'lib/vfPendingAttemptLifecycle.js',
    'lib/vfXrplTransactionBuilder.js', 'lib/vfSolanaLockEngine.js', 'lib/vfXrplLockEngine.js',
  ];
  for (const f of files) {
    const s = read(f);
    assert.doesNotMatch(s, /checkHandshakeAllowance|checkHandshakeEligibility|handshakeUsage|buildHandshakeIdentity/, f);
  }
});
