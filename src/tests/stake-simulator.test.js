// t270u: the staking simulator follows VinculumFinalisStake (main 21ed30b).
// The full cross-check against the compiled contract is
// base-contracts/test/app_stake_simulator_matches_contract.test.cjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StakingEngine, stakeMultiplierBps, TOKEN_MULTIPLIER_BPS, EPOCH_SECS } from '../lib/vfStakingEngine.js';

const S = 10n ** 18n;
const D120 = 10368000;

test('multipliers: tokens 1x/2x/4x, durations 1.00x/1.40x/1.75x/2.10x', () => {
  assert.deepEqual(TOKEN_MULTIPLIER_BPS, { VCLM: 10000, CHONX: 20000, SYNTH: 40000 });
  assert.deepEqual([2592000, 5184000, 7776000, D120].map(stakeMultiplierBps), [10000, 14000, 17500, 21000]);
  assert.equal(stakeMultiplierBps(31536000), 0);
});

test('per-position claim: floor(minted x weight / total) per epoch, 120 days = 2.10x', () => {
  let now = 1000;
  const e = new StakingEngine({ launchTimestamp: 1000, clock: () => now });
  const a = e.createStakePosition('A', 'VCLM', 100n * S, D120);
  const b = e.createStakePosition('B', 'SYNTH', 100n * S, D120);
  assert.equal(a.position.getWeight(), 210n * S);
  assert.equal(b.position.getWeight(), 840n * S);
  e.recordRacCredit('r', 'x', 3n * S, 1); // $3 basis -> 30 VCLM
  now = 1000 + EPOCH_SECS; assert.ok(e.closeEpoch(1).ok);
  assert.equal(e.allocateEpoch(1).reason, 'VF-STK-013: wait for N+1 end');
  now = 1000 + 2 * EPOCH_SECS;
  const al = e.allocateEpoch(1);
  assert.equal(al.minted, 30n * S);
  assert.equal(al.epoch.totalWeight, 1050n * S);
  assert.equal(e.claimableVclm(a.positionId, 1), (30n * S * 210n * S) / (1050n * S));
  assert.equal(e.claimPosition('B', a.positionId, 1).reason, 'VFS: not owner');
  const c = e.claimPosition('A', a.positionId, 1);
  assert.equal(c.amount, 6n * S);
  assert.equal(e.claimPosition('A', a.positionId, 1).reason, 'VFS: nothing to claim');
  assert.equal(e.claimPositions('B', [b.positionId], 1).amount, 24n * S);
  assert.equal(e.lifetimeVclmIssued, 30n * S);
});

test('refusals carry the contract revert text', () => {
  let now = 500;
  const e = new StakingEngine({ launchTimestamp: 1000, clock: () => now });
  assert.equal(e.getCurrentEpoch(), 0);
  now = 1000;
  assert.equal(e.createStakePosition('A', 'ETH', 1n, D120).reason, 'VF-STK-002: invalid token');
  assert.equal(e.createStakePosition('A', 'VCLM', 0n, D120).reason, 'VF-STK-031: zero amount');
  assert.equal(e.createStakePosition('A', 'VCLM', 1n, 86400).reason, 'VF-STK-003: duration not permitted');
  assert.equal(e.closeEpoch(1).reason, 'VF-STK-008: epoch not ended');
  assert.equal(e.closeEpoch(0).reason, 'VF-STK-010: epoch numbering begins at 1');
});
