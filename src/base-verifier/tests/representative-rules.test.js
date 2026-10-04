import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMMITMENT_DURATIONS,
  STAKE_DURATIONS,
  EMISSION,
  DECAY,
  SCALE,
  CHONX_ACTIVATION_THRESHOLD,
  SYNTH_ACTIVATION_THRESHOLD,
  SYNTH_FORGE,
  TOKEN_HARD_CAPS,
} from '../../lib/vfRevision6Authority.js';
import { ENVIRONMENTS, findAssetPrecision, handshakeAllowanceFor } from '../../lib/vfBaseRegistry.js';
import { computeEmissionRate, computeIssuanceFromUsd } from '../../lib/vfVerifierEngine.js';
import { OUTPUT_TOKEN } from '../../lib/vfProofNormalizer.js';

test('stake table is the sixteen commitment rows', () => {
  assert.equal(STAKE_DURATIONS.length, 16);
  assert.equal(STAKE_DURATIONS, COMMITMENT_DURATIONS);
  assert.equal(COMMITMENT_DURATIONS.length, 16);
});

test('S1 and S2 are the named assets and everyone else in the table is S3', () => {
  assert.equal(findAssetPrecision('Ethereum', 'USDC').custodyClass, 'S1');
  assert.equal(findAssetPrecision('Ethereum', 'USDT').custodyClass, 'S1');
  assert.equal(findAssetPrecision('Ethereum', 'native-ETH').custodyClass, 'S2');
  assert.equal(findAssetPrecision('Bitcoin', 'native-BTC').custodyClass, 'S2');
  assert.equal(findAssetPrecision('Ethereum', 'AAVE').custodyClass, 'S2');
  assert.equal(findAssetPrecision('Ethereum', 'LINK').custodyClass, 'S2');
  assert.equal(findAssetPrecision('Ethereum', 'UNI').custodyClass, 'S2');
  assert.equal(findAssetPrecision('Base', 'native-ETH').custodyClass, 'S3');
  assert.equal(findAssetPrecision('BNB', 'native-BNB').custodyClass, 'S3');
  assert.equal(findAssetPrecision('CosmosHub', 'native-uatom').custodyClass, 'S3');
});

test('handshake allowance is derived and Cosmos is not given a count', () => {
  const sixteen = [
    'Base', 'Ethereum', 'Polygon', 'Optimism', 'Arbitrum', 'BNB', 'Avalanche',
    'Bitcoin', 'Litecoin', 'Dogecoin', 'DigiByte', 'Zcash', 'BitcoinCash',
    'Solana', 'XRPL', 'Stellar',
  ];
  for (const id of sixteen) {
    const env = ENVIRONMENTS.find((row) => row.id === id);
    assert.ok(env, id);
    assert.equal(env.handshakeAllowance, handshakeAllowanceFor(env.countsPerIdentity));
  }
  const cosmos = ENVIRONMENTS.find((row) => row.id === 'CosmosHub');
  assert.equal(cosmos.handshakeAllowance, null);
  assert.equal(handshakeAllowanceFor(true), 3);
  assert.equal(handshakeAllowanceFor(false), 1);
});

test('emission uses the authority schedule', () => {
  assert.equal(EMISSION.VCLM.initial_rate_per_dollar, 10n * SCALE);
  assert.equal(EMISSION.VCLM.permanent_floor_per_dollar, 1n * SCALE);
  assert.equal(EMISSION.CHONX.initial_rate_per_dollar, 100n * SCALE);
  assert.equal(EMISSION.CHONX.permanent_floor_per_dollar, 10n * SCALE);
  assert.equal(DECAY.survival_fp, SCALE - 16670000000000000n);
  assert.equal(computeEmissionRate(OUTPUT_TOKEN.VCLM, 0), 10n * SCALE);
  assert.equal(computeEmissionRate(OUTPUT_TOKEN.VCLM, 30), (10n * SCALE * DECAY.survival_fp) / SCALE);
  const ten = 10n * SCALE;
  const s1 = computeIssuanceFromUsd(ten, OUTPUT_TOKEN.VCLM, 'S1', 604800, 0);
  assert.equal(s1.output, 150n * SCALE);
  const chonx = computeIssuanceFromUsd(ten, OUTPUT_TOKEN.CHONX, 'S3', 604800, 0);
  assert.equal(chonx.output, 1000n * SCALE);
  assert.equal(CHONX_ACTIVATION_THRESHOLD, 10_000_000n * SCALE);
  assert.equal(SYNTH_ACTIVATION_THRESHOLD, 100_000_000n * SCALE);
  assert.equal(SYNTH_FORGE.vclm_burn, 1000n * SCALE);
  assert.equal(SYNTH_FORGE.chonx_burn, 10_000n * SCALE);
  assert.equal(TOKEN_HARD_CAPS.SYNTH, 10_000_000n * SCALE);
});
