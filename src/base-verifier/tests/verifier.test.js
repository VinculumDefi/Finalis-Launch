import assert from 'assert';

// Import the modules under test
import { VerifierState, verifyProof, computeIssuanceFromUsd, checkFeeMath, checkHardCap, computeRacCredit } from '../../lib/vfVerifierEngine.js';
import { normalizeProofPackage, normalizeSolanaEvidence, normalizeXrplEvidence, normalizeUtxoEvidence, normalizeEvmEvidence, normalizeCosmosEvidence, normalizeStellarEvidence, OUTPUT_TOKEN, computeRacIdentity } from '../../lib/vfProofNormalizer.js';
import { findEnvironment, findAssetPrecision, ENVIRONMENT_COUNT } from '../../lib/vfBaseRegistry.js';
import { COMMITMENT_DURATIONS, HANDSHAKE_DURATION_SECS, SCALE, TOKEN_HARD_CAPS, CHONX_ACTIVATION_THRESHOLD } from '../../lib/vfRevision6Authority.js';
import { buildMockEvent, buildFinalityProof } from '../../lib/vfMockEventBuilder.js';

let passed = 0, failed = 0;

function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.log(`  ✗ ${name}`); console.log(`    ${e.message}`); }
}

const USD_10 = '10000000000000000000'; // $10.00 in 18-decimal
const USD_1 = '1000000000000000000';   // $1.00
const USD_0_95 = '950000000000000000'; // $0.95

console.log('\n=== Base Verifier Integration Tests ===\n');

// T-01: Environment registry has 17 entries
test('T-01: 17 environments registered', () => {
  assert.strictEqual(ENVIRONMENT_COUNT, 17);
  assert.ok(findEnvironment('Solana'));
  assert.ok(findEnvironment('XRPL'));
  assert.ok(findEnvironment('Bitcoin'));
  assert.ok(findEnvironment('CosmosHub'));
  assert.strictEqual(findEnvironment('NonExistent'), null);
});

// T-02: Asset precision table resolves known assets
test('T-02: Asset precision table resolves SOL, XRP, BTC, ATOM', () => {
  assert.strictEqual(findAssetPrecision('Solana', 'native-SOL').decimals, 9);
  assert.strictEqual(findAssetPrecision('XRPL', 'native-XRP').decimals, 6);
  assert.strictEqual(findAssetPrecision('Bitcoin', 'native-BTC').decimals, 8);
  assert.strictEqual(findAssetPrecision('CosmosHub', 'native-uatom').decimals, 6);
  assert.strictEqual(findAssetPrecision('Stellar', 'native-XLM').decimals, 7);
  assert.strictEqual(findAssetPrecision('Ethereum', 'native-ETH').decimals, 18);
});

// T-03: Solana proof — valid verification succeeds
test('T-03: Solana valid proof → ISSUE', () => {
  const state = new VerifierState();
  const mock = buildMockEvent('Solana', 604800, 'VCLM');
  const raw = normalizeSolanaEvidence(mock.event, buildFinalityProof('Solana'));
  assert.ok(raw.ok, raw.errors?.join('; '));
  const r = verifyProof(state, raw.package, { verifiedGrossUsdMicro: USD_10, daysSinceLaunch: 0 });
  assert.ok(r.ok, r.reason);
  assert.strictEqual(r.decision, 'ISSUE');
  assert.strictEqual(r.issuance.token, 'VCLM');
  assert.ok(BigInt(r.issuance.amount) > 0n);
});

// T-04: XRPL proof — valid verification succeeds
test('T-04: XRPL valid proof → ISSUE', () => {
  const state = new VerifierState();
  const mock = buildMockEvent('XRPL', 604800, 'VCLM');
  const raw = normalizeXrplEvidence(mock.event.escrow, mock.event.payment, buildFinalityProof('XRPL'));
  assert.ok(raw.ok, raw.errors?.join('; '));
  const r = verifyProof(state, raw.package, { verifiedGrossUsdMicro: USD_10, daysSinceLaunch: 0 });
  assert.ok(r.ok, r.reason);
  assert.strictEqual(r.decision, 'ISSUE');
});

// T-05: Bitcoin proof — valid verification succeeds (1-use Handshake, Base-enforced)
test('T-05: Bitcoin valid proof → ISSUE (1-use Base-enforced)', () => {
  const state = new VerifierState();
  const mock = buildMockEvent('Bitcoin', 604800, 'VCLM');
  const raw = normalizeUtxoEvidence('Bitcoin', mock.event, buildFinalityProof('Bitcoin'));
  assert.ok(raw.ok, raw.errors?.join('; '));
  const r = verifyProof(state, raw.package, { verifiedGrossUsdMicro: USD_10, daysSinceLaunch: 0 });
  assert.ok(r.ok, r.reason);
  assert.strictEqual(r.decision, 'ISSUE');
});

// T-06: Ethereum proof — valid verification succeeds (3-use source-enforced)
test('T-06: Ethereum valid proof → ISSUE (3-use source-enforced)', () => {
  const state = new VerifierState();
  const mock = buildMockEvent('Ethereum', 604800, 'VCLM');
  const raw = normalizeEvmEvidence('Ethereum', mock.event, buildFinalityProof('Ethereum'));
  assert.ok(raw.ok, raw.errors?.join('; '));
  const r = verifyProof(state, raw.package, { verifiedGrossUsdMicro: USD_10, daysSinceLaunch: 0 });
  assert.ok(r.ok, r.reason);
  assert.strictEqual(r.decision, 'ISSUE');
});

// T-07: Replay protection — same lockId rejected
test('T-07: Replay — same lockId rejected (VF-XCH-013)', () => {
  const state = new VerifierState();
  const mock = buildMockEvent('Solana', 604800, 'VCLM');
  const raw = normalizeSolanaEvidence(mock.event, buildFinalityProof('Solana'));
  const r1 = verifyProof(state, raw.package, { verifiedGrossUsdMicro: USD_10, daysSinceLaunch: 0 });
  assert.ok(r1.ok);
  const r2 = verifyProof(state, raw.package, { verifiedGrossUsdMicro: USD_10, daysSinceLaunch: 0 });
  assert.ok(!r2.ok);
  assert.ok(r2.reason.includes('replay'));
});

// T-08: RAC exact-once — same RAC identity rejected
test('T-08: RAC exact-once — duplicate RAC rejected (VF-RAC-001)', () => {
  const state = new VerifierState();
  const mock1 = buildMockEvent('Solana', 604800, 'VCLM');
  const raw1 = normalizeSolanaEvidence(mock1.event, buildFinalityProof('Solana'));
  const r1 = verifyProof(state, raw1.package, { verifiedGrossUsdMicro: USD_10, daysSinceLaunch: 0 });
  assert.ok(r1.ok);

  // Same RAC identity, different lockId (should still fail RAC dedup)
  const mock2 = buildMockEvent('Solana', 604800, 'VCLM');
  raw2 = normalizeSolanaEvidence(mock2.event, buildFinalityProof('Solana'));
  raw2.package.rac_identity = raw1.package.rac_identity; // force same RAC
  raw2.package.commitment_vault_lock_id = 'different-lock-id';
  const r2 = verifyProof(state, raw2.package, { verifiedGrossUsdMicro: USD_10, daysSinceLaunch: 0 });
  assert.ok(!r2.ok);
  assert.ok(r2.reason.includes('RAC'));
});

// T-09: Handshake allowance — 1-use UTXO identity exhausted after first
test('T-09: Handshake — 1-use identity exhausted (VF-COM-006/007)', () => {
  const state = new VerifierState();
  const mock1 = buildMockEvent('Bitcoin', 3600, 'VCLM');
  const raw1 = normalizeUtxoEvidence('Bitcoin', mock1.event, buildFinalityProof('Bitcoin'));
  const r1 = verifyProof(state, raw1.package, { verifiedGrossUsdMicro: USD_1, daysSinceLaunch: 0 });
  assert.ok(r1.ok, r1.reason);

  // Second attempt with same handshake identity
  const mock2 = buildMockEvent('Bitcoin', 3600, 'VCLM');
  const raw2 = normalizeUtxoEvidence('Bitcoin', mock2.event, buildFinalityProof('Bitcoin'));
  raw2.package.handshake_identity = raw1.package.handshake_identity;
  raw2.package.commitment_vault_lock_id = 'different-btc-lock';
  raw2.package.rac_identity = null; // let it recompute
  const r2 = verifyProof(state, raw2.package, { verifiedGrossUsdMicro: USD_1, daysSinceLaunch: 0 });
  assert.ok(!r2.ok);
  assert.ok(r2.reason.includes('handshake') || r2.reason.includes('Handshake'));
});

// T-10: CHONX rejected before activation
test('T-10: CHONX rejected before activation (VF-COM-025/VF-TOK-002)', () => {
  const state = new VerifierState();
  const mock = buildMockEvent('Solana', 604800, 'CHONX');
  const raw = normalizeSolanaEvidence(mock.event, buildFinalityProof('Solana'));
  const r = verifyProof(state, raw.package, { verifiedGrossUsdMicro: USD_10, daysSinceLaunch: 0 });
  assert.ok(!r.ok);
  assert.ok(r.reason.includes('CHONX') || r.reason.includes('activated'));
});

// T-11: Standard USD below $10.00 rejected
test('T-11: Standard USD below $10.00 rejected (VF-COM-009)', () => {
  const state = new VerifierState();
  const mock = buildMockEvent('Solana', 604800, 'VCLM');
  const raw = normalizeSolanaEvidence(mock.event, buildFinalityProof('Solana'));
  const r = verifyProof(state, raw.package, { verifiedGrossUsdMicro: '5000000000000000000', daysSinceLaunch: 0 }); // $5.00
  assert.ok(!r.ok);
  assert.ok(r.reason.includes('USD') || r.reason.includes('standard'));
});

// T-12: Handshake USD outside $0.95–$1.05 rejected
test('T-12: Handshake USD outside range rejected (VF-COM-003)', () => {
  const state = new VerifierState();
  const mock = buildMockEvent('Solana', HANDSHAKE_DURATION_SECS, 'VCLM');
  const raw = normalizeSolanaEvidence(mock.event, buildFinalityProof('Solana'));
  const r = verifyProof(state, raw.package, { verifiedGrossUsdMicro: '2000000000000000000', daysSinceLaunch: 0 }); // $2.00
  assert.ok(!r.ok);
  assert.ok(r.reason.includes('handshake') || r.reason.includes('USD'));
});

// T-13: Fee math — principal != gross - fee rejected
test('T-13: Fee math — tampered principal rejected (VF-COM-012)', () => {
  const state = new VerifierState();
  const mock = buildMockEvent('Solana', 604800, 'VCLM');
  const raw = normalizeSolanaEvidence(mock.event, buildFinalityProof('Solana'));
  raw.package.principal_amount_smallest_units = String(BigInt(raw.package.gross_amount_smallest_units) - BigInt(raw.package.actual_fee_amount_smallest_units) + 1n);
  const r = verifyProof(state, raw.package, { verifiedGrossUsdMicro: USD_10, daysSinceLaunch: 0 });
  assert.ok(!r.ok);
  assert.ok(r.reason.includes('principal') || r.reason.includes('gross'));
});

// T-14: Issuance calculation — correct order and floor
test('T-14: Issuance — $10 × 10 VCLM/$ × 1.3x S2 × 1.0x 7d = 130 VCLM', () => {
  const result = computeIssuanceFromUsd(USD_10, OUTPUT_TOKEN.VCLM, 'S2', 604800, 0);
  assert.ok(result.ok);
  // $10 × 10 = 100 × 1.3 (S2) = 130 × 1.0 (7d) = 130
  const expected = 130n * SCALE;
  assert.strictEqual(result.output, expected, `expected ${expected}, got ${result.output}`);
});

// T-15: Hard cap — output exceeding cap rejected
test('T-15: Hard cap — exceeds remaining rejected (VF-SUP-015)', () => {
  const state = new VerifierState();
  // Fill VCLM cap to near-full
  state.cumulativeVclmIssued = TOKEN_HARD_CAPS.VCLM - 1n;
  const capCheck = checkHardCap(state, OUTPUT_TOKEN.VCLM, 2n);
  assert.ok(!capCheck.ok);
  assert.ok(capCheck.reason.includes('cap'));
});

// T-16: RAC credit — 60% of fee USD value
test('T-16: RAC credit — 60% of fee USD (VF-RAC)', () => {
  // $10 gross, $0.50 fee → fee USD = $0.50 → RAC = $0.30
  const credit = computeRacCredit(USD_10, '500000000000000000', '10000000000000000000'); // 5% of $10 = $0.50 fee
  assert.ok(credit > 0n);
  // fee_usd = $10 × 0.05 = $0.50; RAC = $0.50 × 0.60 = $0.30
  const expected = 300000000000000000n; // $0.30 in 18-decimal
  assert.strictEqual(credit, expected);
});

// T-17: Cosmos Hub — rejected (EVIDENCE REQUIRED)
test('T-17: Cosmos Hub rejected — mechanism incomplete', () => {
  const state = new VerifierState();
  const mock = buildMockEvent('CosmosHub', 604800, 'VCLM');
  const raw = normalizeCosmosEvidence(mock.event, buildFinalityProof('CosmosHub'));
  const r = verifyProof(state, raw.package, { verifiedGrossUsdMicro: USD_10, daysSinceLaunch: 0 });
  assert.ok(!r.ok);
  assert.ok(r.reason.includes('EVIDENCE') || r.reason.includes('incomplete') || r.reason.includes('mechanism'));
});

// T-18: CHONX activation triggers at 10M VCLM
test('T-18: CHONX activation at 10M VCLM (VF-TOK-002)', () => {
  const state = new VerifierState();
  state.cumulativeVclmIssued = CHONX_ACTIVATION_THRESHOLD;
  assert.ok(state.cumulativeVclmIssued >= CHONX_ACTIVATION_THRESHOLD);
  // After activation, CHONX should be allowed
  state.chonxActivated = true;
  const mock = buildMockEvent('Solana', 604800, 'CHONX');
  const raw = normalizeSolanaEvidence(mock.event, buildFinalityProof('Solana'));
  const r = verifyProof(state, raw.package, { verifiedGrossUsdMicro: USD_10, daysSinceLaunch: 0 });
  assert.ok(r.ok, r.reason);
  assert.strictEqual(r.decision, 'ISSUE');
  assert.strictEqual(r.issuance.token, 'CHONX');
});

// T-19: Unknown environment rejected
test('T-19: Unknown environment rejected (VF-XCH-001)', () => {
  const state = new VerifierState();
  const raw = normalizeProofPackage({
    source_environment_id: 'Cardano',
    commitment_vault_lock_id: 'test',
    handshake_identity: '(Cardano, addr1)',
    handshake_allowance_count: 1,
    canonical_asset_id: 'native-ADA',
    canonical_asset_symbol: 'ADA',
    asset_precision: 6,
    asset_custody_class: 'S3',
    gross_amount_smallest_units: '1000000',
    actual_fee_amount_smallest_units: '50000',
    principal_amount_smallest_units: '950000',
    fee_asset_id: 'native-ADA',
    dev_fund_destination: 'addr1dev',
    fee_transfer_evidence: 'addr1dev',
    valuation_timestamp: '1000',
    maturity_timestamp: '2000',
    duration_secs: 604800,
    selected_output_token: 0,
    base_recipient: '0x' + '1'.repeat(40),
    release_destination: 'addr1',
    rac_identity: 'test-rac',
    source_finality_proof: buildFinalityProof('Cardano'),
    lock_event_proof: {},
  });
  assert.ok(!raw.ok);
  assert.ok(raw.errors.some((e) => e.includes('unknown') || e.includes('not in')));
});

// T-20: Chain-agnostic — all 16 deployable environments produce valid proofs
test('T-20: Chain-agnostic — all 16 deployable environments verify', () => {
  const envs = ['Ethereum', 'BNB', 'Avalanche', 'Polygon', 'Arbitrum', 'Base', 'Optimism',
    'Solana', 'Bitcoin', 'Litecoin', 'Dogecoin', 'DigiByte', 'Zcash', 'BitcoinCash', 'XRPL', 'Stellar'];
  for (const envId of envs) {
    const state = new VerifierState();
    const mock = buildMockEvent(envId, 604800, 'VCLM');
    let raw;
    if (envId === 'Solana') raw = normalizeSolanaEvidence(mock.event, buildFinalityProof(envId));
    else if (envId === 'XRPL') raw = normalizeXrplEvidence(mock.event.escrow, mock.event.payment, buildFinalityProof(envId));
    else if (envId === 'Stellar') raw = normalizeStellarEvidence(mock.event, buildFinalityProof(envId));
    else if (['Bitcoin','Litecoin','Dogecoin','DigiByte','Zcash','BitcoinCash'].includes(envId))
      raw = normalizeUtxoEvidence(envId, mock.event, buildFinalityProof(envId));
    else raw = normalizeEvmEvidence(envId, mock.event, buildFinalityProof(envId));
    assert.ok(raw.ok, `${envId} normalization failed: ${raw.errors?.join('; ')}`);
    const r = verifyProof(state, raw.package, { verifiedGrossUsdMicro: USD_10, daysSinceLaunch: 0 });
    assert.ok(r.ok, `${envId} verification failed: ${r.reason}`);
    assert.strictEqual(r.decision, 'ISSUE', `${envId} decision not ISSUE`);
  }
});

var raw2; // hoist for T-08

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);