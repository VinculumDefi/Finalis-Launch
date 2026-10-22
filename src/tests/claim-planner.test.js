// t276u: the claim planner (src/lib/vfClaimPlanner.js) on the in-app
// simulator. The test against the compiled Stake contract on a local chain is
// base-contracts/test/stake_t276_claim_planner.test.cjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StakingEngine, EPOCH_SECS } from '../lib/vfStakingEngine.js';
import { makeSimulatorStakeChain, previewClaimAll, planNextClaim, runClaimAll, readClaimState, exactClaimable, latestClaimableEpoch, lastEligibleBy, isUserRejection, stoppedMessage } from '../lib/vfClaimPlanner.js';

const S = 10n ** 18n;
const D30 = 2592000, D120 = 10368000;
const LIMIT = 2_000_000n; // small limit so a 300-epoch history needs several transactions

function build() {
  let now = 1000;
  const e = new StakingEngine({ launchTimestamp: 1000, clock: () => now });
  now = 1005;
  const long = e.createStakePosition('A', 'VCLM', 500n * S, D30).positionId;
  const mid = e.createStakePosition('A', 'CHONX', 40n * S, D120).positionId;
  const other = e.createStakePosition('B', 'VCLM', 100n * S, D120).positionId;
  const done = e.createStakePosition('A', 'SYNTH', 1n * S, D30).positionId;
  e.queueExtension('A', long, D30);
  let closed = 0;
  for (let n = 1; n <= 302; n++) e.recordRacCredit('r' + n, 'x', BigInt(100 + (n % 7)) * S, n);
  while (closed < 301) {
    const p = e.positions.get(long);
    const nextClose = 1000 + (closed + 1) * EPOCH_SECS;
    if (p.queuedExtensionBps > 0 && Number(p.endTimestamp) <= nextClose) {
      now = Number(p.endTimestamp) + 1;
      assert.ok(e.applyExtensionIfMatured('A', long).ok);
      assert.ok(e.queueExtension('A', long, D30).ok);
      continue;
    }
    now = nextClose; closed++;
    assert.ok(e.closeEpoch(closed).ok);
    if (closed >= 2) assert.ok(e.allocateEpoch(closed - 1).ok);
    if (closed === 10) assert.ok(e.claimPosition('A', done, 9).ok); // fully claimed early
  }
  return { e, ids: [long, mid, done], other, setNow: (t) => { now = t; }, getNow: () => now };
}

test('latest claimable epoch and eligibility helpers match the contract rules', () => {
  assert.equal(latestClaimableEpoch(10n, 5n), 5n);
  assert.equal(latestClaimableEpoch(6n, 9n), 4n);
  assert.equal(latestClaimableEpoch(1n, 0n), 0n);
  assert.equal(lastEligibleBy(1000n + 4n * 864000n, 1000n), 3n);
  assert.equal(lastEligibleBy(1000n + 4n * 864000n - 1n, 1000n), 2n);
  assert.ok(isUserRejection({ code: 4001 }) && isUserRejection({ code: 'ACTION_REJECTED' }) && !isUserRejection(new Error('VFS: epoch not allocated')));
  assert.equal(stoppedMessage('12.5'), 'The remaining 12.5 VCLM stays available. You can claim it any time.');
});

test('claim all in batches under the limit, stop after transaction 1, resume, exact total, no double pay', async () => {
  const { e, ids, setNow, getNow } = build();
  const chain = makeSimulatorStakeChain(e, 'A');
  const L = BigInt(e.latestClaimableEpoch());
  let entitled = 0n;
  for (const id of ids) entitled += e.claimableVclm(id, Number(L));
  const st = await readClaimState(chain, ids);
  assert.equal(st.total, entitled);
  assert.equal(st.items.length, 2); // the fully claimed position is left out
  const preview = await previewClaimAll(chain, ids, { maxGas: LIMIT });
  assert.ok(preview.txCount >= 2);
  const sent = [];
  let calls = 0;
  const send = async (info) => { calls++; if (calls === 2) { const err = new Error('User rejected the request.'); err.code = 4001; throw err; } assert.ok(info.gas <= LIMIT); const r = await chain.send(info.tx); assert.equal(r.amount, info.amount); sent.push(info); return r; };
  const r1 = await runClaimAll(chain, ids, { maxGas: LIMIT, send });
  assert.equal(r1.status, 'stopped');
  assert.equal(r1.remaining, entitled - sent[0].amount);
  setNow(getNow() + 86400);
  const r2 = await runClaimAll(chain, ids, { maxGas: LIMIT, send: async (info) => { assert.ok(info.gas <= LIMIT); const r = await chain.send(info.tx); sent.push(info); return r; } });
  assert.equal(r2.status, 'complete');
  assert.equal(sent.reduce((s, x) => s + x.amount, 0n), entitled);
  assert.ok(sent.length >= 3);
  for (const id of ids.slice(0, 2)) assert.equal(e.positions.get(id).nextClaimEpoch, L + 1n);
  // the same range again: claimPosition refuses, claimPositions pays 0, the planner finds nothing
  assert.equal(e.claimPosition('A', ids[0], Number(L)).reason, 'VFS: nothing to claim');
  assert.equal(e.claimPositions('A', ids, Number(L)).amount, 0n);
  assert.equal(await planNextClaim(chain, ids, { maxGas: LIMIT }), null);
});

test('a non-rejection failure stops with status error and leaves everything claimable', async () => {
  const { e, ids } = build();
  const chain = makeSimulatorStakeChain(e, 'A');
  const before = (await readClaimState(chain, ids)).total;
  const r = await runClaimAll(chain, ids, { maxGas: LIMIT, send: async () => { throw new Error('nonce too low'); } });
  assert.equal(r.status, 'error');
  assert.equal(r.remaining, before);
});

test('t277u: displayed amount is computed per epoch, equals the view at every read group, and a mismatch blocks the claim', async () => {
  const { e, ids } = build();
  const chain = makeSimulatorStakeChain(e, 'A');
  const L = BigInt(e.latestClaimableEpoch());
  for (const id of ids) {
    for (const to of [1n, 2n, 50n, 150n, L]) {
      if (to > L) continue;
      for (const group of [1n, 7n, 100n, 500n]) {
        const r = await exactClaimable(chain, id, to, { group, crossCheck: false });
        assert.equal(r.amount, e.claimableVclm(id, Number(to)));
      }
    }
  }
  // the view is read only as a cross-check for short ranges; a different value blocks the claim
  let views = 0;
  const counting = { ...chain, claimableVclm: async (id, to) => { views++; return chain.claimableVclm(id, to); } };
  await readClaimState(counting, ids);
  assert.equal(views, 1); // only the short history (the 120-day position) is cross-checked; the 300-epoch one is above 200
  const wrong = { ...chain, claimableVclm: async (id, to) => (await chain.claimableVclm(id, to)) + 1n };
  await assert.rejects(exactClaimable(wrong, ids[1], 5n), /Claim display check failed/);
  const r = await runClaimAll({ ...wrong, nextClaimEpoch: chain.nextClaimEpoch }, [ids[1]], { maxGas: LIMIT, send: async () => { throw new Error('must not send'); } });
  assert.equal(r.status, 'error');
  assert.match(r.error.message, /Claim display check failed/);
  assert.equal(r.remaining, null);
  assert.equal(stoppedMessage(null), 'The remaining VCLM stays available. You can claim it any time.');
});
