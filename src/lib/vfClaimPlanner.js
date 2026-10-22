// t276u: Stake claim planner (app level only; no contract change).
//
// Plans "Claim all" for a wallet's Stake positions as a series of
// transactions that each stay at or below MAX_CLAIM_GAS (8,000,000 by
// default, about half of Base's 16,777,216 per-transaction cap).
//
// Contract facts the planner relies on (VinculumFinalisStake, release/2026-10-21):
// - claimPosition(id, toEpoch) pays epochs nextClaimEpoch(id)..toEpoch and sets
//   nextClaimEpoch(id) = toEpoch + 1. It reverts "VFS: nothing to claim" when
//   toEpoch < nextClaimEpoch(id), "VF-STK-013: epoch not final" when toEpoch's
//   next epoch has not ended, and "VFS: epoch not allocated" when an epoch the
//   position earns in that range is not allocated.
// - claimPositions(ids, toEpoch) calls claimPosition for each id whose
//   nextClaimEpoch <= toEpoch and silently SKIPS the others (no revert).
// - Allocation is in strict epoch order, so every epoch up to
//   L = min(getCurrentEpoch() - 2, lastAllocatedEpoch()) is allocated and final.
// - A claim only moves nextClaimEpoch forward, so a stopped plan leaves the rest
//   claimable, and claiming a range again pays nothing (claimPosition reverts,
//   claimPositions skips).
//
// Every transaction is confirmed with eth_estimateGas (chain.estimateClaim)
// before it is offered; if the estimate is above the limit the batch is
// shrunk (half the positions, or half the epoch range for one position) and
// estimated again. The cost formula below is only used to size the first
// guess and for the "about N transactions" preview.
//
// The planner talks to the chain through an adapter (see makeEthersStakeChain):
//   getCurrentEpoch(), lastAllocatedEpoch(), launchTimestamp(),
//   nextClaimEpoch(id), claimableVclm(id, toEpoch), position(id),
//   estimateClaim(tx) -> bigint gas (throws with the revert reason if it fails)
// A tx is { kind: 'one', ids: [id], toEpoch } for claimPosition(id, toEpoch)
// or { kind: 'many', ids, toEpoch } for claimPositions(ids, toEpoch).

export const MAX_CLAIM_GAS = 8_000_000n;
export const EPOCH_SECS = 864000n;
// Conservative sizing formula (measured on release/2026-10-21: one epoch
// about 79,200 gas, then 8,600 to 9,800 gas per extra epoch).
export const GAS_TX = 30_000n;
export const GAS_PER_POSITION = 60_000n;
export const GAS_PER_EPOCH = 11_000n;
const FORMULA_SHARE = 90n; // size the first guess at 90% of the limit

const big = (v) => (typeof v === 'bigint' ? v : BigInt(v));

// Last epoch N whose N+1 ends at or before T (0 if none). Same as the contract.
export function lastEligibleBy(T, t0) {
  T = big(T); t0 = big(t0);
  if (T < t0 + 2n * EPOCH_SECS) return 0n;
  return (T - t0) / EPOCH_SECS - 1n;
}

// Last epoch a position can earn in, from positions(id) and launchTimestamp().
export function lastEligibleEpoch(pos, t0) {
  const queued = big(pos.queuedExtensionBps ?? 0) > 0n ? big(pos.queuedExtensionSecs ?? 0) : 0n;
  let last = lastEligibleBy(big(pos.endTimestamp) + queued, t0);
  if (pos.withdrawn) {
    const w = lastEligibleBy(pos.withdrawnAt, t0);
    if (w < last) last = w;
  }
  return last;
}

export function latestClaimableEpoch(currentEpoch, lastAllocated) {
  const a = big(currentEpoch) - 2n;
  const b = big(lastAllocated);
  const L = a < b ? a : b;
  return L > 0n ? L : 0n;
}

export function formulaGas(spans) {
  let g = GAS_TX;
  for (const s of spans) g += GAS_PER_POSITION + GAS_PER_EPOCH * (s > 0n ? s : 0n);
  return g;
}

export function isUserRejection(e) {
  if (!e) return false;
  const codes = [e.code, e?.info?.error?.code, e?.error?.code, e?.data?.originalError?.code];
  if (codes.includes(4001) || codes.includes('ACTION_REJECTED')) return true;
  return /user (rejected|denied)/i.test(String(e.message || ''));
}

// Reads what the wallet can claim now. Positions with nothing to claim are left out.
export async function readClaimState(chain, ids) {
  const [cur, alloc, t0] = await Promise.all([chain.getCurrentEpoch(), chain.lastAllocatedEpoch(), chain.launchTimestamp()]);
  const L = latestClaimableEpoch(cur, alloc);
  const items = [];
  let total = 0n;
  if (L === 0n) return { L, items, total };
  for (const id of ids) {
    const from = big(await chain.nextClaimEpoch(id));
    if (from > L) continue; // claimed up to L already
    const pos = await chain.position(id);
    let last = lastEligibleEpoch(pos, t0);
    if (last > L) last = L;
    if (last < from) continue; // no earning epoch left in range
    const amount = big(await chain.claimableVclm(id, L));
    if (amount === 0n) continue; // nothing to pay: leave it out
    items.push({ id: big(id), from, last, amount });
    total += amount;
  }
  return { L, items, total };
}

// First guess from the formula: as many whole positions as fit (one claimPositions
// call, toEpoch L), or for a single long history, a prefix of its epoch range.
function firstGuess(state, budget) {
  const { L, items } = state;
  const sorted = [...items].sort((a, b) => (a.last - a.from < b.last - b.from ? -1 : a.last - a.from > b.last - b.from ? 1 : 0));
  const group = [];
  for (const it of sorted) {
    const spans = [...group, it].map((g) => g.last - g.from + 1n);
    if (formulaGas(spans) <= budget) group.push(it);
    else break;
  }
  if (group.length > 1) return { kind: 'many', ids: group.map((g) => g.id), toEpoch: L, items: group };
  if (group.length === 1) return { kind: 'one', ids: [group[0].id], toEpoch: L, items: group };
  // the shortest history alone is over budget: claim part of its range
  const it = sorted[0];
  let n = (budget - GAS_TX - GAS_PER_POSITION) / GAS_PER_EPOCH;
  if (n < 1n) n = 1n;
  const to = it.from + n - 1n < it.last ? it.from + n - 1n : L;
  return { kind: 'one', ids: [it.id], toEpoch: to, items: [it] };
}

async function amountOf(chain, tx, items) {
  if (tx.kind === 'one') return big(await chain.claimableVclm(tx.ids[0], tx.toEpoch));
  let s = 0n;
  for (const it of items) if (tx.ids.includes(it.id)) s += it.amount;
  return s;
}

// The next transaction to send, confirmed by eth_estimateGas at or below maxGas.
// Returns null when there is nothing to claim.
export async function planNextClaim(chain, ids, { maxGas = MAX_CLAIM_GAS } = {}) {
  const state = await readClaimState(chain, ids);
  if (state.items.length === 0) return null;
  const budget = (big(maxGas) * FORMULA_SHARE) / 100n;
  let g = firstGuess(state, budget);
  let tx = { kind: g.kind, ids: g.ids, toEpoch: g.toEpoch };
  let items = g.items;
  const estimates = [];
  for (;;) {
    const gas = big(await chain.estimateClaim(tx));
    estimates.push({ ...tx, gas });
    if (gas <= big(maxGas)) {
      const amount = await amountOf(chain, tx, items);
      return { tx, gas, amount, L: state.L, totalClaimable: state.total, estimates };
    }
    if (tx.ids.length > 1) {
      const keep = tx.ids.slice(0, Math.ceil(tx.ids.length / 2));
      items = items.filter((it) => keep.includes(it.id));
      tx = keep.length === 1 ? { kind: 'one', ids: keep, toEpoch: state.L } : { kind: 'many', ids: keep, toEpoch: state.L };
      continue;
    }
    const it = items[0];
    if (tx.toEpoch <= it.from) throw new Error(`One epoch of position ${it.id} needs ${gas} gas, above the ${maxGas} limit`);
    const end = tx.toEpoch > it.last ? it.last : tx.toEpoch;
    tx = { kind: 'one', ids: [it.id], toEpoch: it.from + (end - it.from) / 2n };
  }
}

// Formula-only preview for the "Claim all" box: total, about how many
// transactions, and a gas estimate for each. Each real transaction is still
// confirmed with eth_estimateGas before it is offered.
export async function previewClaimAll(chain, ids, { maxGas = MAX_CLAIM_GAS } = {}) {
  const state = await readClaimState(chain, ids);
  const budget = (big(maxGas) * FORMULA_SHARE) / 100n;
  let rest = state.items.map((it) => ({ ...it }));
  const txs = [];
  while (rest.length > 0) {
    const g = firstGuess({ L: state.L, items: rest }, budget);
    const spans = g.items.map((it) => (g.toEpoch < it.last ? g.toEpoch : it.last) - it.from + 1n);
    txs.push({ kind: g.kind, ids: g.ids, toEpoch: g.toEpoch, gas: formulaGas(spans) });
    if (g.kind === 'one' && g.toEpoch < g.items[0].last) {
      rest = rest.map((it) => (it.id === g.ids[0] ? { ...it, from: g.toEpoch + 1n } : it));
    } else {
      rest = rest.filter((it) => !g.ids.includes(it.id));
    }
  }
  return { L: state.L, total: state.total, positions: state.items.length, txCount: txs.length, txs };
}

// Runs the plan. send({ tx, gas, amount, index, total }) must run the section 10
// fee check, open the wallet and resolve with the receipt after it is mined
// (throw on rejection or failure). After each mined transaction the state is
// read again from the chain and the rest is planned again.
export async function runClaimAll(chain, ids, { maxGas = MAX_CLAIM_GAS, send, onProgress } = {}) {
  const done = [];
  for (;;) {
    let next;
    try {
      next = await planNextClaim(chain, ids, { maxGas });
    } catch (error) {
      const { total } = await readClaimState(chain, ids);
      return { status: 'error', error, done, remaining: total };
    }
    if (!next) return { status: 'complete', done, remaining: 0n };
    const preview = await previewClaimAll(chain, ids, { maxGas });
    const info = { ...next, index: done.length + 1, total: done.length + Math.max(1, preview.txCount), remainingBefore: next.totalClaimable };
    if (onProgress) await onProgress({ stage: 'before', ...info });
    let receipt;
    try {
      receipt = await send(info);
    } catch (error) {
      const { total } = await readClaimState(chain, ids);
      const status = isUserRejection(error) ? 'stopped' : 'error';
      if (onProgress) await onProgress({ stage: status, ...info, remaining: total });
      return { status, error, done, remaining: total };
    }
    done.push({ ...info, receipt });
    const { total } = await readClaimState(chain, ids);
    if (onProgress) await onProgress({ stage: 'after', ...info, receipt, remaining: total });
  }
}

export function stoppedMessage(remainingText) {
  return `The remaining ${remainingText} VCLM stays available. You can claim it any time.`;
}

// Adapter for an ethers v6 Stake contract connected to the user's signer.
export function makeEthersStakeChain(stake, account) {
  return {
    getCurrentEpoch: () => stake.getCurrentEpoch(),
    lastAllocatedEpoch: () => stake.lastAllocatedEpoch(),
    launchTimestamp: () => stake.launchTimestamp(),
    nextClaimEpoch: (id) => stake.nextClaimEpoch(id),
    claimableVclm: (id, to) => stake.claimableVclm(id, to),
    position: (id) => stake.positions(id),
    estimateClaim: (tx) => (tx.kind === 'one'
      ? stake.claimPosition.estimateGas(tx.ids[0], tx.toEpoch, { from: account })
      : stake.claimPositions.estimateGas(tx.ids, tx.toEpoch, { from: account })),
  };
}

// Adapter for the in-app simulator (src/lib/vfStakingEngine.js). Its gas
// "estimate" is a model of the contract's measured cost (one epoch about
// 79,200 gas, about 9,800 per extra epoch, about 50,000 per extra position in
// claimPositions); it is only for the simulator page. send() returns the
// engine result as a receipt-like object.
export const SIM_GAS_FIRST = 79_200n;
export const SIM_GAS_PER_EPOCH = 9_800n;
export const SIM_GAS_PER_EXTRA_POSITION = 50_000n;
export function makeSimulatorStakeChain(engine, account) {
  const lastOf = (id) => {
    const p = engine.positions.get(Number(id));
    return lastEligibleEpoch({ endTimestamp: p.endTimestamp, queuedExtensionBps: p.queuedExtensionBps, queuedExtensionSecs: p.queuedExtensionSecs, withdrawn: p.withdrawn, withdrawnAt: p.withdrawnAt }, engine.launchTimestamp);
  };
  return {
    getCurrentEpoch: async () => BigInt(engine.getCurrentEpoch()),
    lastAllocatedEpoch: async () => BigInt(engine.lastAllocatedEpoch),
    launchTimestamp: async () => BigInt(engine.launchTimestamp || 0n),
    nextClaimEpoch: async (id) => BigInt(engine.positions.get(Number(id)).nextClaimEpoch),
    claimableVclm: async (id, to) => engine.claimableVclm(Number(id), Number(to)),
    position: async (id) => { const p = engine.positions.get(Number(id)); return { endTimestamp: p.endTimestamp, queuedExtensionBps: p.queuedExtensionBps, queuedExtensionSecs: p.queuedExtensionSecs, withdrawn: p.withdrawn, withdrawnAt: p.withdrawnAt }; },
    estimateClaim: async (tx) => {
      let g = SIM_GAS_FIRST - SIM_GAS_PER_EPOCH;
      for (const id of tx.ids) {
        const p = engine.positions.get(Number(id));
        if (!p || p.owner !== account) throw new Error('VFS: not owner');
        const from = BigInt(p.nextClaimEpoch);
        if (tx.kind === 'one' && tx.toEpoch < from) throw new Error('VFS: nothing to claim');
        if (tx.toEpoch < from) continue;
        const last = lastOf(id) < tx.toEpoch ? lastOf(id) : tx.toEpoch;
        g += SIM_GAS_PER_EXTRA_POSITION + SIM_GAS_PER_EPOCH * (last >= from ? last - from + 1n : 0n);
      }
      return g - SIM_GAS_PER_EXTRA_POSITION;
    },
    send: async (tx) => {
      const r = tx.kind === 'one' ? engine.claimPosition(account, Number(tx.ids[0]), Number(tx.toEpoch)) : engine.claimPositions(account, tx.ids.map(Number), Number(tx.toEpoch));
      if (!r.ok) throw new Error(r.reason);
      return { status: 1, amount: r.amount };
    },
  };
}
