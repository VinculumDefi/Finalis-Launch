import assert from 'assert';

import { getChainVerifier, isVerifierRegistered, getRegisteredEnvironments, dispatchFinalityCheck, dispatchFactExtraction } from '../../lib/vfChainVerifierRegistry.js';
import { FINALITY_STATUS, EvmChainVerifier } from '../../lib/vfEvmChainVerifier.js';
import { SolanaChainVerifier } from '../../lib/vfSolanaChainVerifier.js';
import { UtxoChainVerifier } from '../../lib/vfUtxoChainVerifier.js';
import { XrplChainVerifier } from '../../lib/vfXrplChainVerifier.js';
import { StellarChainVerifier } from '../../lib/vfStellarChainVerifier.js';
import { VerifierState, verifyProof, checkFinalityProof } from '../../lib/vfVerifierEngine.js';
import { normalizeSolanaEvidence, normalizeXrplEvidence, normalizeUtxoEvidence, normalizeEvmEvidence, normalizeStellarEvidence, OUTPUT_TOKEN } from '../../lib/vfProofNormalizer.js';
import { buildMockEvent } from '../../lib/vfMockEventBuilder.js';
import { ENVIRONMENTS } from '../../lib/vfBaseRegistry.js';

let passed = 0, failed = 0;

function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.log(`  ✗ ${name}`); console.log(`    ${e.message}`); }
}

const USD_10 = '10000000000000000000';

console.log('\n=== Per-Environment Chain Verifier Tests ===\n');

// --- Registry Tests ---

test('CV-01: 16 of 17 environments have registered chain verifiers', () => {
  const registered = getRegisteredEnvironments();
  assert.strictEqual(registered.length, 16);
  // Cosmos Hub is NOT registered (EVIDENCE_REQUIRED)
  assert.ok(!isVerifierRegistered('CosmosHub'));
  // All 16 deployable environments are registered
  for (const env of ENVIRONMENTS) {
    if (env.verificationStatus !== 'EVIDENCE_REQUIRED') {
      assert.ok(isVerifierRegistered(env.id), `${env.id} should be registered`);
    }
  }
});

test('CV-02: Each verifier has correct environmentId and finalityModel', () => {
  const sol = getChainVerifier('Solana');
  assert.ok(sol instanceof SolanaChainVerifier);
  assert.strictEqual(sol.finalityModel, 'finalized slot');

  const eth = getChainVerifier('Ethereum');
  assert.ok(eth instanceof EvmChainVerifier);
  assert.strictEqual(eth.finalityModel, 'PoS finalized');

  const btc = getChainVerifier('Bitcoin');
  assert.ok(btc instanceof UtxoChainVerifier);
  assert.strictEqual(btc.minConfirmations, 6);

  const zec = getChainVerifier('Zcash');
  assert.strictEqual(zec.minConfirmations, 10);

  const xrp = getChainVerifier('XRPL');
  assert.ok(xrp instanceof XrplChainVerifier);

  const stellar = getChainVerifier('Stellar');
  assert.ok(stellar instanceof StellarChainVerifier);
});

// --- Finality Verification Tests ---

test('CV-03: Solana accepts finalized slot', () => {
  const v = getChainVerifier('Solana');
  const r = v.verifyFinality({}, { commitment: 'finalized', slot: 250000000, blockhash: '0xabc' });
  assert.ok(r.ok);
  assert.strictEqual(r.blockHeight, 250000000);
});

test('CV-04: Solana rejects non-finalized slot', () => {
  const v = getChainVerifier('Solana');
  const r = v.verifyFinality({}, { commitment: 'confirmed', slot: 250000000 });
  assert.ok(!r.ok);
  assert.ok(r.reason.includes('finalized'));
});

test('CV-05: Ethereum accepts PoS finalized status', () => {
  const v = getChainVerifier('Ethereum');
  const r = v.verifyFinality({}, { finalityStatus: FINALITY_STATUS.FINALIZED, blockHash: '0xdef', blockNumber: 19000000 });
  assert.ok(r.ok);
  assert.strictEqual(r.model, 'PoS finalized');
});

test('CV-06: Ethereum rejects pending status', () => {
  const v = getChainVerifier('Ethereum');
  const r = v.verifyFinality({}, { finalityStatus: FINALITY_STATUS.PENDING, blockNumber: 100 });
  assert.ok(!r.ok);
  assert.ok(r.reason.includes('not finalized'));
});

test('CV-07: BNB accepts FFF with 2+ confirmations', () => {
  const v = getChainVerifier('BNB');
  const r = v.verifyFinality({}, { confirmations: 2, blockHash: '0x1', blockNumber: 35000000 });
  assert.ok(r.ok);
});

test('CV-08: BNB rejects FFF with < 2 confirmations', () => {
  const v = getChainVerifier('BNB');
  const r = v.verifyFinality({}, { confirmations: 1 });
  assert.ok(!r.ok);
});

test('CV-09: Avalanche accepts Snowman accepted status', () => {
  const v = getChainVerifier('Avalanche');
  const r = v.verifyFinality({}, { finalityStatus: FINALITY_STATUS.ACCEPTED, blockNumber: 40000000 });
  assert.ok(r.ok);
});

test('CV-10: Polygon accepts checkpoint verified status', () => {
  const v = getChainVerifier('Polygon');
  const r = v.verifyFinality({}, { finalityStatus: FINALITY_STATUS.CHECKPOINT_VERIFIED, blockNumber: 55000000 });
  assert.ok(r.ok);
});

test('CV-11: Arbitrum accepts L1 finalized status', () => {
  const v = getChainVerifier('Arbitrum');
  const r = v.verifyFinality({}, { finalityStatus: FINALITY_STATUS.L1_FINALIZED, blockNumber: 180000000 });
  assert.ok(r.ok);
});

test('CV-12: Arbitrum accepts challenge period passed', () => {
  const v = getChainVerifier('Arbitrum');
  const r = v.verifyFinality({}, { finalityStatus: FINALITY_STATUS.CHALLENGE_PERIOD_PASSED, blockNumber: 180000000 });
  assert.ok(r.ok);
});

test('CV-13: Base accepts same-chain (no cross-chain verification)', () => {
  const v = getChainVerifier('Base');
  const r = v.verifyFinality({}, { blockHash: '0xbase', blockNumber: 12000000 });
  assert.ok(r.ok);
  assert.strictEqual(r.model, 'RESOLVED_SAME_CHAIN');
});

test('CV-14: Bitcoin accepts depth >= 6', () => {
  const v = getChainVerifier('Bitcoin');
  const r = v.verifyFinality({}, { confirmations: 6, blockHash: '0xbtc', blockHeight: 800000 });
  assert.ok(r.ok);
  assert.strictEqual(r.model, 'depth>=6');
});

test('CV-15: Bitcoin rejects depth < 6', () => {
  const v = getChainVerifier('Bitcoin');
  const r = v.verifyFinality({}, { confirmations: 5 });
  assert.ok(!r.ok);
  assert.ok(r.reason.includes('confirmations'));
});

test('CV-16: Zcash requires depth >= 10', () => {
  const v = getChainVerifier('Zcash');
  assert.ok(v.verifyFinality({}, { confirmations: 10 }).ok);
  assert.ok(!v.verifyFinality({}, { confirmations: 9 }).ok);
});

test('CV-17: Litecoin (N REQUIRES_EXTERNAL_INPUT) accepts at depth >= 6 with warning', () => {
  const v = getChainVerifier('Litecoin');
  const r = v.verifyFinality({}, { confirmations: 6, blockHeight: 2500000 });
  assert.ok(r.ok);
  assert.ok(r.warning);
  assert.ok(r.warning.includes('REQUIRES_EXTERNAL_INPUT'));
});

test('CV-18: XRPL accepts validated ledger', () => {
  const v = getChainVerifier('XRPL');
  const r = v.verifyFinality({}, { validated: true, ledgerIndex: 85000000, ledgerHash: '0xxrp' });
  assert.ok(r.ok);
  assert.strictEqual(r.blockHeight, 85000000);
});

test('CV-19: XRPL rejects non-validated ledger', () => {
  const v = getChainVerifier('XRPL');
  const r = v.verifyFinality({}, { validated: false, ledgerIndex: 100 });
  assert.ok(!r.ok);
  assert.ok(r.reason.includes('not validated'));
});

test('CV-20: Stellar accepts SCP-closed ledger', () => {
  const v = getChainVerifier('Stellar');
  const r = v.verifyFinality({}, { closed: true, ledgerSequence: 50000000, ledgerHash: '0xxlm' });
  assert.ok(r.ok);
  assert.strictEqual(r.blockHeight, 50000000);
});

test('CV-21: Stellar rejects non-closed ledger', () => {
  const v = getChainVerifier('Stellar');
  const r = v.verifyFinality({}, { closed: false, ledgerSequence: 100 });
  assert.ok(!r.ok);
  assert.ok(r.reason.includes('not SCP-closed'));
});

test('CV-22: Missing finality proof rejected for all environments', () => {
  for (const envId of getRegisteredEnvironments()) {
    const r = dispatchFinalityCheck(envId, {}, null);
    assert.ok(!r.ok, `${envId} should reject null proof`);
  }
});

// --- Fact Extraction Tests ---

test('CV-23: Solana fact extraction matches normalizer output', () => {
  const mock = buildMockEvent('Solana', 604800, 'VCLM');
  const raw = normalizeSolanaEvidence(mock.event, { commitment: 'finalized', slot: 100 });
  const factsResult = dispatchFactExtraction('Solana', raw.package.lock_event_proof);
  assert.ok(factsResult.ok);
  assert.strictEqual(factsResult.facts.lockId, raw.package.commitment_vault_lock_id);
  assert.strictEqual(factsResult.facts.grossAmount, raw.package.gross_amount_smallest_units);
  assert.strictEqual(factsResult.facts.feeAmount, raw.package.actual_fee_amount_smallest_units);
  assert.strictEqual(factsResult.facts.principalAmount, raw.package.principal_amount_smallest_units);
  assert.strictEqual(factsResult.facts.durationSecs, Number(raw.package.duration_secs));
});

test('CV-24: EVM fact extraction matches normalizer output', () => {
  const mock = buildMockEvent('Ethereum', 604800, 'VCLM');
  const raw = normalizeEvmEvidence('Ethereum', mock.event, { finalityStatus: FINALITY_STATUS.FINALIZED, blockNumber: 100 });
  const factsResult = dispatchFactExtraction('Ethereum', raw.package.lock_event_proof);
  assert.ok(factsResult.ok);
  assert.strictEqual(factsResult.facts.lockId, raw.package.commitment_vault_lock_id);
  assert.strictEqual(factsResult.facts.grossAmount, raw.package.gross_amount_smallest_units);
});

test('CV-25: UTXO fact extraction matches normalizer output', () => {
  const mock = buildMockEvent('Bitcoin', 604800, 'VCLM');
  const raw = normalizeUtxoEvidence('Bitcoin', mock.event, { confirmations: 6, blockHeight: 800000 });
  const factsResult = dispatchFactExtraction('Bitcoin', raw.package.lock_event_proof);
  assert.ok(factsResult.ok);
  assert.strictEqual(factsResult.facts.grossAmount, raw.package.gross_amount_smallest_units);
  assert.strictEqual(factsResult.facts.principalAmount, raw.package.principal_amount_smallest_units);
});

test('CV-26: XRPL fact extraction matches normalizer output', () => {
  const mock = buildMockEvent('XRPL', 604800, 'VCLM');
  const raw = normalizeXrplEvidence(mock.event.escrow, mock.event.payment, { validated: true, ledgerIndex: 100 });
  const factsResult = dispatchFactExtraction('XRPL', raw.package.lock_event_proof);
  assert.ok(factsResult.ok);
  assert.strictEqual(factsResult.facts.grossAmount, raw.package.gross_amount_smallest_units);
  assert.strictEqual(factsResult.facts.feeAmount, raw.package.actual_fee_amount_smallest_units);
});

test('CV-27: Stellar fact extraction matches normalizer output', () => {
  const mock = buildMockEvent('Stellar', 604800, 'VCLM');
  const raw = normalizeStellarEvidence(mock.event, { closed: true, ledgerSequence: 100 });
  const factsResult = dispatchFactExtraction('Stellar', raw.package.lock_event_proof);
  assert.ok(factsResult.ok);
  assert.strictEqual(factsResult.facts.grossAmount, raw.package.gross_amount_smallest_units);
});

// --- Fact Cross-Check (Tamper Detection) Tests ---

test('CV-28: Tampered gross amount detected by fact cross-check', () => {
  const state = new VerifierState();
  const mock = buildMockEvent('Solana', 604800, 'VCLM');
  const raw = normalizeSolanaEvidence(mock.event, { commitment: 'finalized', slot: 100, blockhash: '0xabc' });
  // Tamper with the gross amount in the package (but not in the lock event proof)
  raw.package.gross_amount_smallest_units = String(BigInt(raw.package.gross_amount_smallest_units) + 1n);
  // Also need to fix principal to pass fee math check... but we want to test fact cross-check specifically
  // Actually the fee math check will catch this first. Let's test with a package where fee math still passes.
  // Instead, let's tamper with the lock_event_proof to have a different gross.
  const raw2 = normalizeSolanaEvidence(mock.event, { commitment: 'finalized', slot: 100, blockhash: '0xabc' });
  raw2.package.lock_event_proof.gross_amount = String(BigInt(raw2.package.lock_event_proof.gross_amount) + 1n);
  const r = checkFinalityProof(raw2.package);
  assert.ok(!r.ok);
  assert.ok(r.reason.includes('fact mismatch') || r.reason.includes('VF-XCH-011'));
});

test('CV-29: Tampered lockId detected by fact cross-check', () => {
  const mock = buildMockEvent('Solana', 604800, 'VCLM');
  const raw = normalizeSolanaEvidence(mock.event, { commitment: 'finalized', slot: 100, blockhash: '0xabc' });
  raw.package.lock_event_proof.lock_id = 'tampered-id';
  const r = checkFinalityProof(raw.package);
  assert.ok(!r.ok);
  assert.ok(r.reason.includes('lockId'));
});

// --- End-to-End Integration Tests ---

test('CV-30: Solana full pipeline with chain verifier dispatch → ISSUE', () => {
  const state = new VerifierState();
  const mock = buildMockEvent('Solana', 604800, 'VCLM');
  const raw = normalizeSolanaEvidence(mock.event, { commitment: 'finalized', slot: 250000000, blockhash: '0xslot' });
  const r = verifyProof(state, raw.package, { verifiedGrossUsdMicro: USD_10, daysSinceLaunch: 0 });
  assert.ok(r.ok, r.reason);
  assert.strictEqual(r.decision, 'ISSUE');
  // Verify the finality check used the real chain verifier (not simulation)
  const finalityCheck = r.checks.find((c) => c.step.includes('Source finality'));
  assert.ok(finalityCheck.detail.includes('finalized slot'));
  assert.ok(finalityCheck.detail.includes('+facts'));
});

test('CV-31: All 16 environments pass full verification with chain verifiers', () => {
  const envs = ['Ethereum', 'BNB', 'Avalanche', 'Polygon', 'Arbitrum', 'Base', 'Optimism',
    'Solana', 'Bitcoin', 'Litecoin', 'Dogecoin', 'DigiByte', 'Zcash', 'BitcoinCash', 'XRPL', 'Stellar'];

  const finalityProofs = {
    Ethereum: { finalityStatus: FINALITY_STATUS.FINALIZED, blockNumber: 19000000 },
    BNB: { confirmations: 2, blockNumber: 35000000 },
    Avalanche: { finalityStatus: FINALITY_STATUS.ACCEPTED, blockNumber: 40000000 },
    Polygon: { finalityStatus: FINALITY_STATUS.CHECKPOINT_VERIFIED, blockNumber: 55000000 },
    Arbitrum: { finalityStatus: FINALITY_STATUS.L1_FINALIZED, blockNumber: 180000000 },
    Base: { blockNumber: 12000000 },
    Optimism: { finalityStatus: FINALITY_STATUS.L1_FINALIZED, blockNumber: 110000000 },
    Solana: { commitment: 'finalized', slot: 250000000, blockhash: '0xabc' },
    Bitcoin: { confirmations: 6, blockHeight: 800000 },
    Litecoin: { confirmations: 6, blockHeight: 2500000 },
    Dogecoin: { confirmations: 6, blockHeight: 4500000 },
    DigiByte: { confirmations: 6, blockHeight: 15000000 },
    Zcash: { confirmations: 10, blockHeight: 2200000 },
    BitcoinCash: { confirmations: 6, blockHeight: 800000 },
    XRPL: { validated: true, ledgerIndex: 85000000 },
    Stellar: { closed: true, ledgerSequence: 50000000 },
  };

  for (const envId of envs) {
    const state = new VerifierState();
    const mock = buildMockEvent(envId, 604800, 'VCLM');
    let raw;
    if (envId === 'Solana') raw = normalizeSolanaEvidence(mock.event, finalityProofs[envId]);
    else if (envId === 'XRPL') raw = normalizeXrplEvidence(mock.event.escrow, mock.event.payment, finalityProofs[envId]);
    else if (envId === 'Stellar') raw = normalizeStellarEvidence(mock.event, finalityProofs[envId]);
    else if (['Bitcoin','Litecoin','Dogecoin','DigiByte','Zcash','BitcoinCash'].includes(envId))
      raw = normalizeUtxoEvidence(envId, mock.event, finalityProofs[envId]);
    else raw = normalizeEvmEvidence(envId, mock.event, finalityProofs[envId]);
    assert.ok(raw.ok, `${envId} normalization failed: ${raw.errors?.join('; ')}`);
    const r = verifyProof(state, raw.package, { verifiedGrossUsdMicro: USD_10, daysSinceLaunch: 0 });
    assert.ok(r.ok, `${envId} verification failed: ${r.reason}`);
    assert.strictEqual(r.decision, 'ISSUE', `${envId} decision not ISSUE`);
    // Verify chain verifier was used (not simulation mode)
    const finalityCheck = r.checks.find((c) => c.step.includes('Source finality'));
    assert.ok(!finalityCheck.detail.includes('simulated'), `${envId} still using simulation mode`);
  }
});

test('CV-32: Missing finality proof fails verification (not simulation fallback)', () => {
  const state = new VerifierState();
  const mock = buildMockEvent('Solana', 604800, 'VCLM');
  const raw = normalizeSolanaEvidence(mock.event, null);
  const r = verifyProof(state, raw.package, { verifiedGrossUsdMicro: USD_10, daysSinceLaunch: 0 });
  assert.ok(!r.ok);
  assert.ok(r.reason.includes('finality proof missing') || r.reason.includes('VF-XCH-006'));
});

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);