// =============================================================================
// Integration Tests — XRPL Commitment Vault Lock
//
// These tests validate the off-chain transaction construction and validation
// logic. They do NOT submit transactions to the XRPL.
//
// Run: node tests/escrow.test.js (requires `xrpl` npm package for full
// address validation; tests use format-check validation for Phase 1)
// =============================================================================

import assert from 'assert';

// Import the modules under test (ESM)
import {
  validateLockRequest,
  computeFee,
  isPermittedDuration,
  isHandshakeDuration,
  validateXrplAddress,
  buildSourceIdentity,
  computeOutput,
} from '../../lib/vfXrplLockEngine.js';

import {
  buildEscrowCreateTransaction,
  buildFeePaymentTransaction,
  buildEscrowFinishTransaction,
  buildAtomicBatch,
  buildLockMemo,
} from '../../lib/vfXrplTransactionBuilder.js';

import {
  XRPL_DROPS_PER_XRP,
  XRPL_EPOCH_OFFSET,
  computeFinishAfter,
} from '../../lib/vfXrplAuthority.js';

import { XrplMockAdapter } from '../../lib/vfXrplMockAdapter.js';

// --- Test constants ---
const TEST_ACCOUNT = 'rDsbeomae4FXwgQTJp9Rs64Qg9vDiTCdBv'; // known valid format
const TEST_DEV_FUND = 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh'; // known valid format
const TEST_BASE_RECIPIENT = '0x' + '1'.repeat(40);

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}: ${err.message}`);
  }
}

console.log('\n=== XRPL Commitment Vault Lock — Integration Tests ===\n');

// T-01: Address validation
test('T-01: XRPL address format validation', () => {
  assert.strictEqual(validateXrplAddress(TEST_ACCOUNT), true);
  assert.strictEqual(validateXrplAddress('invalid'), false);
  assert.strictEqual(validateXrplAddress(''), false);
  assert.strictEqual(validateXrplAddress('0x' + '1'.repeat(40)), false); // EVM, not XRPL
});

// T-02: Standard lock — fee calculation
test('T-02: Standard lock fee calculation (VF-COM-009/011/012)', () => {
  // 1 XRP = 1,000,000 drops, 7-day lock, 5% fee
  const result = computeFee(1000000, 604800);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.fee.toString(), '50000'); // 5% of 1M = 50000 drops
  assert.strictEqual(result.principal.toString(), '950000');
  assert.strictEqual(result.bps, 500);
});

// T-03: Handshake — fee calculation
test('T-03: Handshake fee calculation (VF-COM-003/004)', () => {
  // 1 XRP = 1,000,000 drops, 1-hour. Rev 12: 5% on every duration, Handshake included.
  const result = computeFee(1000000, 3600);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.fee.toString(), '50000'); // 5% of 1M = 50000 drops
  assert.strictEqual(result.principal.toString(), '950000');
  assert.strictEqual(result.bps, 500);
});

// T-04: Zero amount rejected
test('T-04: Zero gross amount rejected (VF-COM-010)', () => {
  const result = computeFee(0, 604800);
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('VF-COM-010')));
});

// T-05: Invalid duration rejected
test('T-05: Invalid duration rejected (VF-COM-002)', () => {
  assert.strictEqual(isPermittedDuration(999999), false);
  assert.strictEqual(isPermittedDuration(3600), true);
  assert.strictEqual(isPermittedDuration(604800), true);
});

// T-06: Source account label (Revision 12: not a Handshake identity)
test('T-06: Source account label construction (VF-COM-005)', () => {
  const ident = buildSourceIdentity(TEST_ACCOUNT);
  assert.strictEqual(ident, `(XRPL, ${TEST_ACCOUNT})`);
});

// T-07: Full preflight validation
test('T-07: Full preflight validation (VF-ARC-004)', () => {
  const usdMicro = (10n * 10n ** 18n).toString(); // $10.00
  const result = validateLockRequest({
    assetSymbol: 'XRP',
    durationSecs: 604800,
    outputToken: 'VCLM',
    baseRecipient: TEST_BASE_RECIPIENT,
    releaseDestination: TEST_ACCOUNT,
    sourceAccount: TEST_DEV_FUND,
    grossAssetUnits: '1000000',
    verifiedGrossUsdMicro: usdMicro,
    daysSinceLaunch: 0,
    chonxActivationReceipt: '',
    cumulativeVclmIssued: 0n,
  });
  // Base-only launch (t430u item 2): XRP is not offered, so the kept engine
  // refuses it at VF-REG-001 only. Every other preflight check passes.
  assert.strictEqual(result.ok, false);
  assert.deepStrictEqual(result.checks.filter((c) => !c.pass).map((c) => c.id), ['VF-REG-001']);
});

// T-08: EscrowCreate transaction construction
test('T-08: EscrowCreate transaction construction (VF-COM-016, VF-PRI-001)', () => {
  const tx = buildEscrowCreateTransaction({
    sourceAccount: TEST_ACCOUNT,
    principalAmount: 950000n,
    releaseDestination: TEST_DEV_FUND,
    finishAfter: 700000000, // XRPL epoch seconds
    sequence: 1,
    lastLedgerSequence: 12345680,
    memo: buildLockMemo({
      lockId: 'test-lock-1',
      sourceAccount: TEST_ACCOUNT,
      grossAmount: 1000000n,
      feeAmount: 50000n,
      principalAmount: 950000n,
      verifiedGrossUsdMicro: '10000000000000000000',
      durationSecs: 604800,
      creationTimeSecs: Math.floor(Date.now() / 1000),
      maturityTimeSecs: Math.floor(Date.now() / 1000) + 604800,
      baseRecipient: TEST_BASE_RECIPIENT,
      releaseDestination: TEST_DEV_FUND,
      outputToken: 'VCLM',
      devFundDestination: TEST_DEV_FUND,
      chonxActivationReceipt: 'not_applicable',
    }),
  });
  assert.strictEqual(tx.TransactionType, 'EscrowCreate');
  assert.strictEqual(tx.Account, TEST_ACCOUNT);
  assert.strictEqual(tx.Amount, '950000');
  assert.strictEqual(tx.Destination, TEST_DEV_FUND);
  assert.strictEqual(tx.FinishAfter, 700000000);
  assert.strictEqual(tx.CancelAfter, undefined); // VF-COM-016: no early cancel
  assert.ok(tx.Memos);
  assert.ok(tx.Memos[0].Memo.MemoData);
});

// T-09: Fee Payment transaction construction
test('T-09: Fee Payment transaction construction (VF-FEE-001..006)', () => {
  const tx = buildFeePaymentTransaction({
    sourceAccount: TEST_ACCOUNT,
    feeAmount: 50000n,
    devFundDestination: TEST_DEV_FUND,
    sequence: 0,
    lastLedgerSequence: 12345680,
  });
  assert.strictEqual(tx.TransactionType, 'Payment');
  assert.strictEqual(tx.Amount, '50000');
  assert.strictEqual(tx.Destination, TEST_DEV_FUND);
});

// T-10: EscrowFinish transaction construction
test('T-10: EscrowFinish transaction construction (VF-PRI-002..006, VF-SEC-006)', () => {
  const tx = buildEscrowFinishTransaction({
    callerAccount: TEST_DEV_FUND, // anyone can call
    ownerAccount: TEST_ACCOUNT,
    offerSequence: 1,
    lastLedgerSequence: 12345700,
  });
  assert.strictEqual(tx.TransactionType, 'EscrowFinish');
  assert.strictEqual(tx.Account, TEST_DEV_FUND); // caller (permissionless)
  assert.strictEqual(tx.Owner, TEST_ACCOUNT);
  assert.strictEqual(tx.OfferSequence, 1);
});

// T-11: Atomic batch construction
test('T-11: Atomic batch — linked Sequence + shared LLS (VF-COM-004)', () => {
  const batch = buildAtomicBatch({
    lockId: 'test-lock-batch',
    sourceAccount: TEST_ACCOUNT,
    devFundDestination: TEST_DEV_FUND,
    feeAmount: 50000n,
    principalAmount: 950000n,
    releaseDestination: TEST_DEV_FUND,
    durationSecs: 604800,
    creationTimeSecs: Math.floor(Date.now() / 1000),
    verifiedGrossUsdMicro: '10000000000000000000',
    outputToken: 'VCLM',
    chonxActivationReceipt: 'not_applicable',
    baseRecipient: TEST_BASE_RECIPIENT,
    sequence: 0,
  }, 12345678);
  assert.strictEqual(batch.payment.Sequence, 0);
  assert.strictEqual(batch.escrowCreate.Sequence, 1); // N+1
  assert.strictEqual(batch.payment.LastLedgerSequence, batch.escrowCreate.LastLedgerSequence); // shared LLS
  assert.strictEqual(batch.lastLedgerSequence, 12345688); // 12345678 + 10
});

// T-12: Mock adapter — Revision 12, no Handshake allowance limit
test('T-12: Mock adapter accepts any number of Handshakes from one account (Revision 12)', () => {
  const adapter = new XrplMockAdapter();
  const ident = '(XRPL, rTestAccount)';
  assert.strictEqual('handshakeUsage' in adapter, false);
  assert.strictEqual('checkHandshakeEligibility' in adapter, false);
  // Five Handshakes from the same account, each recognized; none is refused.
  for (let i = 1; i <= 5; i++) {
    let r = adapter.submitSimulation({ lockId: `lock-${i}`, identity: ident, isHandshake: true });
    assert.strictEqual(r.ok, true, `Handshake ${i} refused`);
    r = adapter.finalizeSuccess(`lock-${i}`);
    assert.strictEqual(r.state, 'RECOGNIZED');
  }
  // A Handshake while another from the same account is still pending is also accepted.
  let r = adapter.submitSimulation({ lockId: 'lock-6', identity: ident, isHandshake: true });
  assert.strictEqual(r.ok, true);
  r = adapter.submitSimulation({ lockId: 'lock-7', identity: ident, isHandshake: true });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(adapter.isPending('lock-6'), true);
  assert.strictEqual(adapter.isPending('lock-7'), true);
  // The lock memo carries no Handshake identity or allowance count.
  const memo = JSON.stringify(buildLockMemo({ lockId: 'm', sourceAccount: 'rTestAccount' }));
  assert.ok(!/handshake_identity|handshake_allowance_count/.test(Buffer.from(JSON.parse(memo).Memo.MemoData, 'hex').toString()), 'memo still has Handshake identity or count');
});

// T-13: Mock adapter — LLS expiry (objective disposition; Revision 12, nothing to consume)
test('T-13: LLS expiry — NOT_RECOGNIZED, next Handshake accepted (VF-COM-007/008, Revision 12)', () => {
  const adapter = new XrplMockAdapter();
  const ident = '(XRPL, rTestAccount2)';
  let r = adapter.submitSimulation({ lockId: 'lock-3', identity: ident, isHandshake: true });
  assert.strictEqual(r.ok, true);
  r = adapter.expireLastLedgerSequence('lock-3');
  assert.strictEqual(r.state, 'NOT_RECOGNIZED');
  assert.strictEqual(r.disposition, 'LASTLEDGERSEQUENCE_EXPIRY');
  // Revision 12: no allowance exists, so the next Handshake is accepted
  r = adapter.submitSimulation({ lockId: 'lock-4', identity: ident, isHandshake: true });
  assert.strictEqual(r.ok, true);
});

// T-14: FinishAfter computation
test('T-14: FinishAfter = XRPL epoch + duration (VF-PRI-001)', () => {
  const unixTime = 1800000000; // ~2027
  const duration = 604800; // 7 days
  const fa = computeFinishAfter(unixTime, duration);
  assert.strictEqual(fa, (unixTime - XRPL_EPOCH_OFFSET) + duration);
});

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
// Any failure makes the run exit non-zero, so failures cannot hide.
if (failed > 0 || passed === 0) process.exitCode = 1;