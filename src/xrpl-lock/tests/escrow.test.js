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
  buildHandshakeIdentity,
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
  XRPL_HANDSHAKE_ALLOWANCE,
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
  // 1 XRP = 1,000,000 drops, 1-hour, 2.5% fee
  const result = computeFee(1000000, 3600);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.fee.toString(), '25000'); // 2.5% of 1M = 25000 drops
  assert.strictEqual(result.principal.toString(), '975000');
  assert.strictEqual(result.bps, 250);
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

// T-06: Handshake identity
test('T-06: Handshake identity construction (VF-COM-005)', () => {
  const ident = buildHandshakeIdentity(TEST_ACCOUNT);
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
  assert.strictEqual(result.ok, true, `Expected pass, got errors: ${result.errors.join('; ')}`);
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

// T-12: Mock adapter — 1-use Handshake allowance
test('T-12: Mock adapter 1-use Handshake (VF-COM-006/007)', () => {
  const adapter = new XrplMockAdapter();
  const ident = '(XRPL, rTestAccount)';
  // First Handshake: allowed
  let r = adapter.submitSimulation({ lockId: 'lock-1', identity: ident, isHandshake: true });
  assert.strictEqual(r.ok, true);
  // Finalize success
  r = adapter.finalizeSuccess('lock-1');
  assert.strictEqual(r.state, 'RECOGNIZED');
  // Second Handshake by same identity: rejected (1-use)
  r = adapter.submitSimulation({ lockId: 'lock-2', identity: ident, isHandshake: true });
  assert.strictEqual(r.ok, false);
  assert.ok(r.reason.includes('VF-COM-007'));
});

// T-13: Mock adapter — LLS expiry (no allowance consumed)
test('T-13: LLS expiry — NOT_RECOGNIZED, no allowance consumed (VF-COM-007/008)', () => {
  const adapter = new XrplMockAdapter();
  const ident = '(XRPL, rTestAccount2)';
  let r = adapter.submitSimulation({ lockId: 'lock-3', identity: ident, isHandshake: true });
  assert.strictEqual(r.ok, true);
  r = adapter.expireLastLedgerSequence('lock-3');
  assert.strictEqual(r.state, 'NOT_RECOGNIZED');
  assert.strictEqual(r.disposition, 'LASTLEDGERSEQUENCE_EXPIRY');
  // Allowance NOT consumed (VF-COM-008) — second Handshake should still be allowed
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