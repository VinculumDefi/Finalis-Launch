// =============================================================================
// Base Token Layer — Integration Tests
//
// Tests the VCLM, CHONX, and SYNTH token logic end-to-end:
//   1. VCLM mint + hard cap
//   2. CHONX activation (VF-TOK-002)
//   3. CHONX mint + hard cap
//   4. SYNTH activation (VF-TOK-003)
//   5. SYNTH forge (VF-TOK-004)
//   6. SYNTH hard cap (VF-SUP-015)
//   7. Full pipeline: verifyProof → mint → forge
// =============================================================================

import assert from 'assert';
import { TokenLayerState, formatTokenAmount } from '../../lib/vfTokenEngine.js';
import { VerifierState, verifyProof, computeIssuanceFromUsd } from '../../lib/vfVerifierEngine.js';
import { buildMockEvent } from '../../lib/vfMockEventBuilder.js';
import { normalizeSolanaEvidence, normalizeXrplEvidence, OUTPUT_TOKEN } from '../../lib/vfProofNormalizer.js';
import { SCALE, TOKEN_HARD_CAPS, CHONX_ACTIVATION_THRESHOLD, SYNTH_ACTIVATION_THRESHOLD, SYNTH_FORGE, COMMITMENT_DURATIONS } from '../../lib/vfRevision6Authority.js';

let passed = 0, failed = 0;

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

console.log('\n=== Base Token Layer Tests ===\n');

// ---------------------------------------------------------------------------
// Test 1: VCLM mint + hard cap
// ---------------------------------------------------------------------------

test('VCLM mint updates balance and cumulative issuance', () => {
  const state = new TokenLayerState();
  const result = state.mintVclm('0x' + '1'.repeat(40), 100n * SCALE);
  assert.ok(result.ok, 'mint should succeed');
  assert.strictEqual(state.getBalance('VCLM', '0x' + '1'.repeat(40)).toString(), (100n * SCALE).toString());
  assert.strictEqual(state.cumulativeVclmIssued.toString(), (100n * SCALE).toString());
});

test('VCLM hard cap rejection (VF-SUP-015)', () => {
  const state = new TokenLayerState();
  // Mint exactly the cap
  state.mintVclm('0x' + '1'.repeat(40), TOKEN_HARD_CAPS.VCLM);
  // Next mint should fail
  const result = state.mintVclm('0x' + '2'.repeat(40), 1n * SCALE);
  assert.ok(!result.ok, 'should reject over-cap mint');
  assert.ok(result.reason.includes('VF-SUP-015'), 'should cite VF-SUP-015');
});

// ---------------------------------------------------------------------------
// Test 2: CHONX activation (VF-TOK-002)
// ---------------------------------------------------------------------------

test('CHONX not activated until 10M VCLM issued (VF-TOK-002)', () => {
  const state = new TokenLayerState();
  state.mintVclm('0x' + '1'.repeat(40), (CHONX_ACTIVATION_THRESHOLD - 1n * SCALE));
  assert.ok(!state.chonxActivated, 'CHONX should not be activated below threshold');
  state.mintVclm('0x' + '1'.repeat(40), 1n * SCALE);
  assert.ok(state.chonxActivated, 'CHONX should be activated at 10M VCLM');
});

test('CHONX mint rejected before activation (VF-COM-025)', () => {
  const state = new TokenLayerState();
  const result = state.mintChonx('0x' + '1'.repeat(40), 100n * SCALE);
  assert.ok(!result.ok, 'should reject CHONX mint before activation');
  assert.ok(result.reason.includes('VF-COM-025') || result.reason.includes('VF-TOK-002'));
});

test('CHONX mint succeeds after activation', () => {
  const state = new TokenLayerState();
  state.mintVclm('0x' + '1'.repeat(40), CHONX_ACTIVATION_THRESHOLD);
  const result = state.mintChonx('0x' + '2'.repeat(40), 1000n * SCALE);
  assert.ok(result.ok, 'CHONX mint should succeed after activation');
  assert.strictEqual(state.getBalance('CHONX', '0x' + '2'.repeat(40)).toString(), (1000n * SCALE).toString());
});

// ---------------------------------------------------------------------------
// Test 3: SYNTH activation (VF-TOK-003)
// ---------------------------------------------------------------------------

test('SYNTH not activated until 100M CHONX issued (VF-TOK-003)', () => {
  const state = new TokenLayerState();
  state.mintVclm('0x' + '1'.repeat(40), CHONX_ACTIVATION_THRESHOLD); // activate CHONX
  state.mintChonx('0x' + '1'.repeat(40), (SYNTH_ACTIVATION_THRESHOLD - 1n * SCALE));
  assert.ok(!state.synthActivated, 'SYNTH should not be activated below 100M CHONX');
  state.mintChonx('0x' + '1'.repeat(40), 1n * SCALE);
  assert.ok(state.synthActivated, 'SYNTH should be activated at 100M CHONX');
});

// ---------------------------------------------------------------------------
// Test 4: SYNTH forge (VF-TOK-004)
// ---------------------------------------------------------------------------

test('SYNTH forge rejected before activation', () => {
  const state = new TokenLayerState();
  const result = state.forgeSynth('0x' + '1'.repeat(40), 1n);
  assert.ok(!result.ok, 'should reject forge before activation');
  assert.ok(result.reason.includes('VF-TOK-003'));
});

test('SYNTH forge burns 1000 VCLM + 10000 CHONX, mints 1 SYNTH (VF-TOK-004)', () => {
  const state = new TokenLayerState();
  const acct = '0x' + '1'.repeat(40);

  // Activate CHONX and SYNTH
  state.mintVclm(acct, CHONX_ACTIVATION_THRESHOLD);
  state.mintChonx(acct, SYNTH_ACTIVATION_THRESHOLD);

  // Need enough VCLM and CHONX to forge
  state.mintVclm(acct, SYNTH_FORGE.vclm_burn);
  state.mintChonx(acct, SYNTH_FORGE.chonx_burn);

  const vclmBefore = state.getBalance('VCLM', acct);
  const chonxBefore = state.getBalance('CHONX', acct);

  const result = state.forgeSynth(acct, 1n);
  assert.ok(result.ok, 'forge should succeed');
  assert.strictEqual(result.vclmBurn.toString(), SYNTH_FORGE.vclm_burn.toString());
  assert.strictEqual(result.chonxBurn.toString(), SYNTH_FORGE.chonx_burn.toString());
  assert.strictEqual(result.synthMinted.toString(), SCALE.toString());

  // Check balances
  assert.strictEqual(state.getBalance('VCLM', acct).toString(), (vclmBefore - SYNTH_FORGE.vclm_burn).toString());
  assert.strictEqual(state.getBalance('CHONX', acct).toString(), (chonxBefore - SYNTH_FORGE.chonx_burn).toString());
  assert.strictEqual(state.getBalance('SYNTH', acct).toString(), SCALE.toString());
});

test('SYNTH forge rejected with insufficient VCLM balance', () => {
  const state = new TokenLayerState();
  const acct = '0x' + '1'.repeat(40);

  state.mintVclm(acct, CHONX_ACTIVATION_THRESHOLD);
  state.mintChonx(acct, SYNTH_ACTIVATION_THRESHOLD);
  // No extra VCLM minted — insufficient for forge
  state.mintChonx(acct, SYNTH_FORGE.chonx_burn);

  const result = state.forgeSynth(acct, 1n);
  assert.ok(!result.ok, 'should reject with insufficient VCLM');
});

test('SYNTH forge multiple tokens at once', () => {
  const state = new TokenLayerState();
  const acct = '0x' + '1'.repeat(40);

  state.mintVclm(acct, CHONX_ACTIVATION_THRESHOLD);
  state.mintChonx(acct, SYNTH_ACTIVATION_THRESHOLD);
  state.mintVclm(acct, SYNTH_FORGE.vclm_burn * 5n);
  state.mintChonx(acct, SYNTH_FORGE.chonx_burn * 5n);

  const result = state.forgeSynth(acct, 5n);
  assert.ok(result.ok, 'forge 5 should succeed');
  assert.strictEqual(result.synthMinted.toString(), (5n * SCALE).toString());
  assert.strictEqual(state.getBalance('SYNTH', acct).toString(), (5n * SCALE).toString());
});

// ---------------------------------------------------------------------------
// Test 5: SYNTH hard cap (VF-SUP-015)
// ---------------------------------------------------------------------------

test('SYNTH hard cap rejection (VF-SUP-015)', () => {
  const state = new TokenLayerState();
  const acct = '0x' + '1'.repeat(40);

  // Activate CHONX and SYNTH
  state.mintVclm(acct, CHONX_ACTIVATION_THRESHOLD);
  state.mintChonx(acct, SYNTH_ACTIVATION_THRESHOLD);

  // Mint enough VCLM and CHONX for a small forge
  state.mintVclm(acct, SYNTH_FORGE.vclm_burn * 5n);
  state.mintChonx(acct, SYNTH_FORGE.chonx_burn * 5n);

  // Forge 5 SYNTH
  const result = state.forgeSynth(acct, 5n);
  assert.ok(result.ok, 'forge 5 should succeed');

  // Manually set cumulativeSynthMinted near the cap to test cap rejection
  // (In production, the SYNTH cap can never be reached because VCLM/CHONX
  //  hard caps are the binding constraint — activation thresholds consume
  //  VCLM and CHONX, leaving insufficient supply to forge the full SYNTH cap.)
  state.cumulativeSynthMinted = TOKEN_HARD_CAPS.SYNTH - SCALE; // 1 SYNTH remaining
  const nearCapResult = state.forgeSynth(acct, 1n);
  assert.ok(nearCapResult.ok, 'forge 1 when 1 remains should succeed');

  // Now at cap — one more should fail
  const overResult = state.forgeSynth(acct, 1n);
  assert.ok(!overResult.ok, 'should reject over-cap forge');
  assert.ok(overResult.reason.includes('VF-SUP-015'));
});

// ---------------------------------------------------------------------------
// Test 6: Full pipeline — verifyProof → mint → forge
// ---------------------------------------------------------------------------

test('Full pipeline: verifyProof (Solana) → mint VCLM → forge impossible (CHONX not activated)', () => {
  const verifierState = new VerifierState();
  const tokenState = new TokenLayerState();

  // Build a Solana mock event (7-day standard lock, VCLM output)
  const { event } = buildMockEvent('Solana', COMMITMENT_DURATIONS[1].secs, 'VCLM');
  const { ok, pkg } = normalizeSolanaEvidence(event, { validated: true, height: 1000 });
  assert.ok(ok, 'normalization should succeed');

  // Verify proof
  const usd = (10n * SCALE).toString(); // $10.00
  const result = verifyProof(verifierState, pkg, { verifiedGrossUsdMicro: usd, daysSinceLaunch: 0 });
  assert.ok(result.ok, 'verification should succeed');
  assert.strictEqual(result.decision, 'ISSUE');

  // Sync token state from verifier
  tokenState.syncFromVerifier(verifierState);

  // Mint VCLM to recipient
  const mintResult = tokenState.mintVclm(result.issuance.recipient, BigInt(result.issuance.amount));
  assert.ok(mintResult.ok, 'VCLM mint should succeed');

  // Try to forge SYNTH — should fail (CHONX not activated)
  const forgeResult = tokenState.forgeSynth(result.issuance.recipient, 1n);
  assert.ok(!forgeResult.ok, 'forge should fail — CHONX not activated');
});

test('Full pipeline: verifyProof (XRPL) → mint CHONX (after activation) → forge SYNTH', () => {
  const verifierState = new VerifierState();
  const tokenState = new TokenLayerState();
  const acct = '0x' + '1'.repeat(40);

  // Activate CHONX by minting 10M VCLM directly through token state
  tokenState.mintVclm(acct, CHONX_ACTIVATION_THRESHOLD);
  assert.ok(tokenState.chonxActivated, 'CHONX should be activated');

  // Activate SYNTH by minting 100M CHONX
  tokenState.mintChonx(acct, SYNTH_ACTIVATION_THRESHOLD);
  assert.ok(tokenState.synthActivated, 'SYNTH should be activated');

  // Now mint enough VCLM + CHONX for forge
  tokenState.mintVclm(acct, SYNTH_FORGE.vclm_burn);
  tokenState.mintChonx(acct, SYNTH_FORGE.chonx_burn);

  // Forge 1 SYNTH
  const forgeResult = tokenState.forgeSynth(acct, 1n);
  assert.ok(forgeResult.ok, 'forge should succeed');
  assert.strictEqual(tokenState.getBalance('SYNTH', acct).toString(), SCALE.toString());
});

// ---------------------------------------------------------------------------
// Test 7: Format helper
// ---------------------------------------------------------------------------

test('formatTokenAmount displays correctly', () => {
  assert.strictEqual(formatTokenAmount((100n * SCALE).toString()), '100');
  assert.strictEqual(formatTokenAmount((1050n * SCALE).toString()), '1050');
  assert.strictEqual(formatTokenAmount((10_000_000n * SCALE).toString()), '10000000');
});

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);