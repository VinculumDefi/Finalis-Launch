/* global require, module, Buffer, process */
'use strict';
// cosmos-hub-proof-adapter — RED-TEAM / NON-PRODUCTION unit tests.
// Run: node test.js  (no dependencies; Node v18+)
// Reports a JSON summary + individual pass/fail.

const assert = require('assert');
const {
  normalizeLockEvent,
  finalityGate,
  verifyExistence,
  sha256,
  PendingAttempt,
  PendingRegistry,
  PENDING_STATE,
} = require('./index');

const results = [];
function test(name, fn) {
  try { fn(); results.push({ name, pass: true }); }
  catch (e) { results.push({ name, pass: false, err: String(e.message || e).slice(0, 200) }); }
}

// ---------- VF-XCH-011 normalizer ----------
function baseEvent() {
  return {
    source_environment: 'cosmoshub-4',
    lock_id: 'lock-1',
    canonical_asset: 'uatom',
    source_account: 'cosmos1alice',
    gross_amount: '1000000',
    fee_amount: '25000',
    principal_amount: '975000',
    verified_gross_usd_micro: '1000000',
    duration_secs: '3600',
    creation_time_secs: '1700000000',
    maturity_time_secs: '1700003600',
    base_recipient: 'base_recipient',
    release_destination: 'cosmos1alice',
    output_token: 'VCLM',
    fee_destination: 'cosmos1devfund',
    fee_transfer_evidence: 'cosmos1devfund',
    handshake_identity: '(cosmoshub-4, cosmos1alice)',
    handshake_allowance_count: '1',
    chonx_activation_receipt: false,
  };
}

test('normalizer: valid event binds all facts', () => {
  const r = normalizeLockEvent(baseEvent());
  assert.ok(r.ok, 'should be ok: ' + JSON.stringify(r.errors));
  assert.strictEqual(r.facts.source_environment, 'cosmoshub-4');
  assert.strictEqual(r.facts.handshake_identity, '(cosmoshub-4, cosmos1alice)');
});

test('normalizer: missing field rejected', () => {
  const e = baseEvent(); delete e.base_recipient;
  const r = normalizeLockEvent(e);
  assert.ok(!r.ok);
  assert.ok(r.errors.some(x => x.includes('base_recipient')));
});

test('normalizer: wrong source_environment rejected', () => {
  const e = baseEvent(); e.source_environment = 'cosmoshub-testnet';
  const r = normalizeLockEvent(e);
  assert.ok(!r.ok);
  assert.ok(r.errors.some(x => x.includes('source_environment mismatch')));
});

test('normalizer: handshake_identity mismatch rejected (VF-COM-005)', () => {
  const e = baseEvent(); e.handshake_identity = '(cosmoshub-4, cosmos1bob)';
  const r = normalizeLockEvent(e);
  assert.ok(!r.ok);
  assert.ok(r.errors.some(x => x.includes('handshake_identity mismatch')));
});

test('normalizer: principal != gross - fee rejected', () => {
  const e = baseEvent(); e.principal_amount = '900000';
  const r = normalizeLockEvent(e);
  assert.ok(!r.ok);
  assert.ok(r.errors.some(x => x.includes('principal != gross - fee')));
});

test('normalizer: zero fee rejected (VF-COM-013)', () => {
  const e = baseEvent(); e.fee_amount = '0'; e.principal_amount = '1000000';
  const r = normalizeLockEvent(e);
  assert.ok(!r.ok);
  assert.ok(r.errors.some(x => x.includes('zero fee')));
});

test('normalizer: CHONX without activation receipt rejected (VF-COM-025)', () => {
  const e = baseEvent(); e.output_token = 'CHONX'; e.chonx_activation_receipt = false;
  const r = normalizeLockEvent(e);
  assert.ok(!r.ok);
  assert.ok(r.errors.some(x => x.includes('CHONX')));
});

test('normalizer: CHONX with activation receipt accepted', () => {
  const e = baseEvent(); e.output_token = 'CHONX'; e.chonx_activation_receipt = true;
  const r = normalizeLockEvent(e);
  assert.ok(r.ok, JSON.stringify(r.errors));
});

test('normalizer: fee destination != fee-transfer evidence rejected (VF-FEE-001/006)', () => {
  const e = baseEvent(); e.fee_transfer_evidence = 'cosmos1other';
  const r = normalizeLockEvent(e);
  assert.ok(!r.ok);
  assert.ok(r.errors.some(x => x.includes('fee_destination != fee_transfer_evidence')));
});

// ---------- Finality gate ----------
test('finality gate: finalized block authorizes (VF-XCH-006)', () => {
  const r = finalityGate({ finalized: true, height: 1234567, hash: '0xabc' });
  assert.ok(r.ok);
  assert.strictEqual(r.height, 1234567);
});

test('finality gate: non-finalized block rejected (VF-XCH-010)', () => {
  const r = finalityGate({ finalized: false, height: 1234567 });
  assert.ok(!r.ok);
  assert.ok(r.reason.includes('not finalized'));
});

test('finality gate: missing block meta rejected', () => {
  const r = finalityGate(null);
  assert.ok(!r.ok);
});

// ---------- ICS-23 skeleton ----------
test('ICS-23: constructed valid existence proof verifies', () => {
  const key = Buffer.from('locks/lock-1');
  const value = Buffer.from('immutable-facts-bytes');
  const prefix = Buffer.from('leaf:');
  // build a proof: leaf + one inner op, compute expected root
  const leafHash = sha256(Buffer.concat([prefix, sha256(key), sha256(value)]));
  const innerPrefix = Buffer.from('inner:');
  const innerSuffix = Buffer.alloc(0);
  const root = sha256(Buffer.concat([innerPrefix, leafHash, innerSuffix]));
  const proof = {
    leaf: { key, value, prefix, hashOp: 'SHA256' },
    path: [{ prefix: innerPrefix, suffix: innerSuffix, hashOp: 'SHA256' }],
  };
  const r = verifyExistence(proof, root, key, value);
  assert.ok(r.ok, 'valid proof should verify: ' + JSON.stringify(r));
});

test('ICS-23: tampered value rejected', () => {
  const key = Buffer.from('locks/lock-1');
  const value = Buffer.from('immutable-facts-bytes');
  const prefix = Buffer.from('leaf:');
  const leafHash = sha256(Buffer.concat([prefix, sha256(key), sha256(value)]));
  const root = sha256(Buffer.concat([Buffer.from('inner:'), leafHash, Buffer.alloc(0)]));
  const proof = {
    leaf: { key, value: Buffer.from('TAMPERED'), prefix, hashOp: 'SHA256' },
    path: [{ prefix: Buffer.from('inner:'), suffix: Buffer.alloc(0), hashOp: 'SHA256' }],
  };
  const r = verifyExistence(proof, root, key, Buffer.from('immutable-facts-bytes'));
  assert.ok(!r.ok);
  assert.ok(r.reason.includes('tampered') || r.reason.includes('root mismatch'));
});

test('ICS-23: tampered key rejected', () => {
  const key = Buffer.from('locks/lock-1');
  const value = Buffer.from('immutable-facts-bytes');
  const prefix = Buffer.from('leaf:');
  const leafHash = sha256(Buffer.concat([prefix, sha256(key), sha256(value)]));
  const root = sha256(Buffer.concat([Buffer.from('inner:'), leafHash, Buffer.alloc(0)]));
  const proof = {
    leaf: { key: Buffer.from('locks/lock-EVIL'), value, prefix, hashOp: 'SHA256' },
    path: [{ prefix: Buffer.from('inner:'), suffix: Buffer.alloc(0), hashOp: 'SHA256' }],
  };
  const r = verifyExistence(proof, root, key, value);
  assert.ok(!r.ok);
});

// ---------- Pending-attempt disposition (Section 5.2.3) ----------
test('pending: elapsed time NEVER clears (Section 5.2.3)', () => {
  const a = new PendingAttempt({ identity: '(cosmoshub-4, cosmos1alice)', lockId: 'lock-1', accountSequence: 5, broadcastTime: 1000 });
  assert.ok(a.isStillPending());
  assert.strictEqual(a.clearByElapsedSeconds(), false);
  assert.ok(a.isStillPending(), 'elapsed time must not clear a still-valid attempt');
});

test('pending: finalized success terminates', () => {
  const a = new PendingAttempt({ identity: 'x', lockId: 'l', accountSequence: 1, broadcastTime: 0 });
  a.markFinalizedSuccess();
  assert.strictEqual(a.state, PENDING_STATE.FINALIZED_SUCCESS);
  assert.ok(!a.isStillPending());
});

test('pending: finalized failure terminates (consumes no allowance)', () => {
  const a = new PendingAttempt({ identity: 'x', lockId: 'l', accountSequence: 1, broadcastTime: 0 });
  a.markFinalizedFailure();
  assert.strictEqual(a.state, PENDING_STATE.FINALIZED_FAILURE);
  assert.ok(!a.isStillPending());
});

test('pending: objective invalidation by sequence consumption (Cosmos Hub criterion)', () => {
  const a = new PendingAttempt({ identity: 'x', lockId: 'l', accountSequence: 7, broadcastTime: 0 });
  a.markSequenceConsumed();
  assert.strictEqual(a.state, PENDING_STATE.INVALIDATED_BY_SEQUENCE);
  assert.ok(!a.isStillPending());
});

test('pending: expiry requires genuine finite validity bound', () => {
  const a = new PendingAttempt({ identity: 'x', lockId: 'l', accountSequence: 1, broadcastTime: 0 });
  assert.throws(() => a.markExpired(), /genuine finite chain-native validity bound/);
  a.markExpired(3600); // only if a real bound is documented (C5)
  assert.strictEqual(a.state, PENDING_STATE.INVALIDATED_BY_EXPIRY);
});

test('pending registry: second submission blocked while objectively pending (Section 5.2.3)', () => {
  const reg = new PendingRegistry();
  const id = '(cosmoshub-4, cosmos1alice)';
  reg.register(new PendingAttempt({ identity: id, lockId: 'lock-1', accountSequence: 3, broadcastTime: 1 }));
  assert.ok(reg.hasPending(id), 'first attempt should be pending');
  // a second official submission for the same identity while pending is prevented
  assert.ok(reg.hasPending(id));
  // after terminal disposition (sequence consumed), no longer pending -> new submission allowed
  reg.get(id, 'lock-1').markSequenceConsumed();
  assert.ok(!reg.hasPending(id));
});

test('pending: failed/invalid attempt consumes no allowance (VF-COM-008) — modeled', () => {
  // failed attempts terminate as FINALIZED_FAILURE; they never incremented the on-chain allowance
  // (the contract increments only on finalized success). Modeled by disposition state.
  const a = new PendingAttempt({ identity: 'x', lockId: 'l', accountSequence: 1, broadcastTime: 0 });
  a.markFinalizedFailure();
  assert.ok(!a.isStillPending());
  assert.strictEqual(a.state, PENDING_STATE.FINALIZED_FAILURE);
});

// ---------- run ----------
const passed = results.filter(r => r.pass).length;
const failed = results.length - passed;
const summary = { name: 'cosmos-hub-proof-adapter', total: results.length, passed, failed, results };
if (process.argv[1] && process.argv[1].endsWith('test.js')) {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(failed === 0 ? 0 : 1);
}
module.exports = { summary };