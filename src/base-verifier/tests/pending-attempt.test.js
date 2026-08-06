import assert from 'assert';

import { PendingAttemptLifecycle, getTerminalDispositions, isSuccessDisposition } from '../../lib/vfPendingAttemptLifecycle.js';
import { ATTEMPT_STATES, SOLANA_DISPOSITION } from '../../lib/vfRevision6Authority.js';

let passed = 0, failed = 0;

function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.log(`  ✗ ${name}`); console.log(`    ${e.message}`); }
}

console.log('\n=== Pending Attempt Lifecycle Tests ===\n');

// PAL-01: Register a pending attempt → OBJECTIVELY_PENDING
test('PAL-01: registerAttempt → OBJECTIVELY_PENDING', () => {
  const lc = new PendingAttemptLifecycle();
  const r = lc.registerAttempt('Solana', '(Solana, addr1)', 'lock-001', 1000);
  assert.ok(r.ok, r.reason);
  assert.strictEqual(r.attempt.state, ATTEMPT_STATES.OBJECTIVELY_PENDING);
  assert.strictEqual(r.attempt.environmentId, 'Solana');
  assert.strictEqual(r.attempt.handshakeIdentity, '(Solana, addr1)');
});

// PAL-02: Identity reservation — concurrent reuse blocked
test('PAL-02: identity reservation blocks concurrent reuse (VF-COM-007)', () => {
  const lc = new PendingAttemptLifecycle();
  lc.registerAttempt('Solana', '(Solana, addr1)', 'lock-001', 1000);
  const r2 = lc.registerAttempt('Solana', '(Solana, addr1)', 'lock-002', 2000);
  assert.ok(!r2.ok);
  assert.ok(r2.reason.includes('in-flight'));
});

// PAL-03: Confirm attempt → RECOGNIZED
test('PAL-03: confirmAttempt → RECOGNIZED', () => {
  const lc = new PendingAttemptLifecycle();
  lc.registerAttempt('Solana', '(Solana, addr1)', 'lock-001', 1000);
  const r = lc.confirmAttempt('lock-001');
  assert.ok(r.ok);
  assert.strictEqual(r.attempt.state, ATTEMPT_STATES.RECOGNIZED);
  assert.strictEqual(r.attempt.terminalDisposition, SOLANA_DISPOSITION.FINALIZED_SUCCESS);
});

// PAL-04: After confirmation, identity is released for reuse
test('PAL-04: identity released after confirmation', () => {
  const lc = new PendingAttemptLifecycle();
  lc.registerAttempt('Solana', '(Solana, addr1)', 'lock-001', 1000);
  lc.confirmAttempt('lock-001');
  // Identity should no longer be pending → new attempt allowed
  const r = lc.registerAttempt('Solana', '(Solana, addr1)', 'lock-002', 2000);
  assert.ok(r.ok, r.reason);
});

// PAL-05: Resolve failed attempt → NOT_RECOGNIZED
test('PAL-05: resolveFailedAttempt → NOT_RECOGNIZED', () => {
  const lc = new PendingAttemptLifecycle();
  lc.registerAttempt('Solana', '(Solana, addr1)', 'lock-001', 1000);
  const r = lc.resolveFailedAttempt('lock-001', SOLANA_DISPOSITION.RECENT_BLOCKHASH_EXPIRY);
  assert.ok(r.ok, r.reason);
  assert.strictEqual(r.attempt.state, ATTEMPT_STATES.NOT_RECOGNIZED);
  assert.strictEqual(r.attempt.terminalDisposition, SOLANA_DISPOSITION.RECENT_BLOCKHASH_EXPIRY);
});

// PAL-06: After failed resolution, identity is released
test('PAL-06: identity released after failed resolution', () => {
  const lc = new PendingAttemptLifecycle();
  lc.registerAttempt('Solana', '(Solana, addr1)', 'lock-001', 1000);
  lc.resolveFailedAttempt('lock-001', SOLANA_DISPOSITION.RECENT_BLOCKHASH_EXPIRY);
  const r = lc.registerAttempt('Solana', '(Solana, addr1)', 'lock-002', 2000);
  assert.ok(r.ok, r.reason);
});

// PAL-07: Invalid disposition rejected — non-chain-native evidence
test('PAL-07: invalid disposition rejected (VF-COM-008)', () => {
  const lc = new PendingAttemptLifecycle();
  lc.registerAttempt('Solana', '(Solana, addr1)', 'lock-001', 1000);
  const r = lc.resolveFailedAttempt('lock-001', 'TIMEOUT');
  assert.ok(!r.ok);
  assert.ok(r.reason.includes('invalid terminal disposition') || r.reason.includes('VF-COM-007'));
});

// PAL-08: FINALIZED_SUCCESS must use confirmAttempt, not resolveFailedAttempt
test('PAL-08: FINALIZED_SUCCESS via resolveFailedAttempt rejected', () => {
  const lc = new PendingAttemptLifecycle();
  lc.registerAttempt('Solana', '(Solana, addr1)', 'lock-001', 1000);
  const r = lc.resolveFailedAttempt('lock-001', SOLANA_DISPOSITION.FINALIZED_SUCCESS);
  assert.ok(!r.ok);
  assert.ok(r.reason.includes('confirmAttempt'));
});

// PAL-09: Solana-specific dispositions accepted for Non-EVM family
test('PAL-09: Solana dispositions accepted (RECENT_BLOCKHASH_EXPIRY, DURABLE_NONCE_ADVANCEMENT)', () => {
  const lc = new PendingAttemptLifecycle();

  // RECENT_BLOCKHASH_EXPIRY
  lc.registerAttempt('Solana', '(Solana, addr1)', 'lock-001', 1000);
  let r = lc.resolveFailedAttempt('lock-001', SOLANA_DISPOSITION.RECENT_BLOCKHASH_EXPIRY);
  assert.ok(r.ok, r.reason);

  // DURABLE_NONCE_ADVANCEMENT
  lc.registerAttempt('Solana', '(Solana, addr2)', 'lock-002', 2000);
  r = lc.resolveFailedAttempt('lock-002', SOLANA_DISPOSITION.DURABLE_NONCE_ADVANCEMENT);
  assert.ok(r.ok, r.reason);
});

// PAL-10: Solana-specific dispositions rejected for EVM family
test('PAL-10: Solana-specific disposition rejected for EVM', () => {
  const lc = new PendingAttemptLifecycle();
  lc.registerAttempt('Ethereum', '(Ethereum, addr1)', 'lock-001', 1000);
  const r = lc.resolveFailedAttempt('lock-001', SOLANA_DISPOSITION.RECENT_BLOCKHASH_EXPIRY);
  assert.ok(!r.ok);
  assert.ok(r.reason.includes('invalid terminal disposition'));
});

// PAL-11: Duplicate lockId rejected
test('PAL-11: duplicate lockId rejected', () => {
  const lc = new PendingAttemptLifecycle();
  lc.registerAttempt('Solana', '(Solana, addr1)', 'lock-001', 1000);
  const r = lc.registerAttempt('Solana', '(Solana, addr2)', 'lock-001', 2000);
  assert.ok(!r.ok);
  assert.ok(r.reason.includes('already registered'));
});

// PAL-12: Unknown environment rejected
test('PAL-12: unknown environment rejected', () => {
  const lc = new PendingAttemptLifecycle();
  const r = lc.registerAttempt('Cardano', '(Cardano, addr1)', 'lock-001', 1000);
  assert.ok(!r.ok);
});

// PAL-13: Cosmos Hub rejected (EVIDENCE_REQUIRED)
test('PAL-13: Cosmos Hub rejected (EVIDENCE_REQUIRED)', () => {
  const lc = new PendingAttemptLifecycle();
  const r = lc.registerAttempt('CosmosHub', '(CosmosHub, addr1)', 'lock-001', 1000);
  assert.ok(!r.ok);
  assert.ok(r.reason.includes('incomplete') || r.reason.includes('EVIDENCE'));
});

// PAL-14: isIdentityPending correctly reflects state
test('PAL-14: isIdentityPending reflects state correctly', () => {
  const lc = new PendingAttemptLifecycle();
  assert.ok(!lc.isIdentityPending('(Solana, addr1)'));
  lc.registerAttempt('Solana', '(Solana, addr1)', 'lock-001', 1000);
  assert.ok(lc.isIdentityPending('(Solana, addr1)'));
  lc.confirmAttempt('lock-001');
  assert.ok(!lc.isIdentityPending('(Solana, addr1)'));
});

// PAL-15: Stats are accurate
test('PAL-15: getStats accurate', () => {
  const lc = new PendingAttemptLifecycle();
  lc.registerAttempt('Solana', '(Solana, addr1)', 'lock-001', 1000);
  lc.registerAttempt('Ethereum', '(Ethereum, addr1)', 'lock-002', 2000);
  lc.confirmAttempt('lock-001');
  lc.resolveFailedAttempt('lock-002', SOLANA_DISPOSITION.FINALIZED_FAILURE);

  const stats = lc.getStats();
  assert.strictEqual(stats.total, 2);
  assert.strictEqual(stats.pending, 0);
  assert.strictEqual(stats.recognized, 1);
  assert.strictEqual(stats.notRecognized, 1);
});

// PAL-16: All 16 deployable environments accept registerAttempt
test('PAL-16: all 16 deployable environments accept registerAttempt', () => {
  const envs = ['Ethereum','BNB','Avalanche','Polygon','Arbitrum','Base','Optimism',
    'Solana','Bitcoin','Litecoin','Dogecoin','DigiByte','Zcash','BitcoinCash','XRPL','Stellar'];
  for (const envId of envs) {
    const lc = new PendingAttemptLifecycle();
    const r = lc.registerAttempt(envId, `(${envId}, addr1)`, `lock-${envId}`, 1000);
    assert.ok(r.ok, `${envId}: ${r.reason}`);
  }
});

// PAL-17: Different identities can coexist as pending
test('PAL-17: different identities coexist as pending', () => {
  const lc = new PendingAttemptLifecycle();
  const r1 = lc.registerAttempt('Solana', '(Solana, addr1)', 'lock-001', 1000);
  const r2 = lc.registerAttempt('Solana', '(Solana, addr2)', 'lock-002', 2000);
  assert.ok(r1.ok);
  assert.ok(r2.ok);
  assert.strictEqual(lc.getPendingAttempts().length, 2);
});

// PAL-18: Terminal dispositions per family
test('PAL-18: terminal dispositions per family', () => {
  assert.ok(getTerminalDispositions('Non-EVM').includes(SOLANA_DISPOSITION.RECENT_BLOCKHASH_EXPIRY));
  assert.ok(getTerminalDispositions('Non-EVM').includes(SOLANA_DISPOSITION.DURABLE_NONCE_ADVANCEMENT));
  assert.ok(!getTerminalDispositions('EVM').includes(SOLANA_DISPOSITION.RECENT_BLOCKHASH_EXPIRY));
  assert.strictEqual(getTerminalDispositions('CometBFT').length, 0);
  assert.ok(isSuccessDisposition(SOLANA_DISPOSITION.FINALIZED_SUCCESS));
  assert.ok(!isSuccessDisposition(SOLANA_DISPOSITION.FINALIZED_FAILURE));
});

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);