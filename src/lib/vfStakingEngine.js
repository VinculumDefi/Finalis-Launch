// =============================================================================
// BASE-STAKE + BASE-EPOCH: Off-Chain Treasury Reward Stake simulator
//
// PROVENANCE: Revision 6 (Section 10, VF-STK-001..031, VF-RAC-003..006,
// VF-SUP-002/009/010/011) and the deployed contract
// base-contracts/contracts/VinculumFinalisStake.sol (main 21ed30b, t269u).
//
// t270u: rewritten to mirror the contract exactly. The repository test
// base-contracts/test/app_stake_simulator_matches_contract.test.cjs runs the
// same operations on this simulator and on the compiled contract at the same
// timestamps and requires identical results (success or the same revert
// text, every epoch's mint, every position's claim).
//
// Rules mirrored from the contract:
//   - Epochs are 1-indexed from the protocol launch time T0 (Section 10.2):
//     epoch N runs from T0 + (N-1) x 10 days to T0 + N x 10 days.
//   - Weight = amount x token multiplier x duration multiplier / 1e8 (one
//     floor). Token: VCLM 1.0x, CHONX 2.0x, SYNTH 4.0x. Duration: 30 days
//     1.00x, 60 days 1.40x, 90 days 1.75x, 120 days 2.10x.
//   - A position earns epoch N if it was staked at or before the start of N
//     and its scheduled end (including a queued term) is at or after the end
//     of N+1, and it was not withdrawn before the end of N+1. The duration
//     multiplier is the one in force at the start of N (operator approved).
//   - closeEpoch(N) after N ends, in order; allocateEpoch(N) after N+1 ends.
//     The complete Epoch Reward VCLM (basis / $0.10) is minted once if it
//     fits the remaining cap, else nothing (VF-STK-028).
//   - Claims are per position over a caller-chosen range up to toEpoch: each
//     epoch pays floor(minted x weight / total weight) (VF-STK-026).
//   - Reward VCLM counts toward lifetime VCLM (cap and CHONX activation).
// Reasons returned on failure are the contract's revert texts.
// =============================================================================

import { TOKEN_HARD_CAPS, STAKE_DURATIONS, REWARD_REFERENCE_CENTS, FIXED_RULES } from './vfRevision6Authority.js';

export const EPOCH_SECS = FIXED_RULES.epoch_days * 86400;
export const STAKE_TOKENS = ['VCLM', 'CHONX', 'SYNTH']; // token ids 0, 1, 2
export const TOKEN_MULTIPLIER_BPS = { VCLM: 10000, CHONX: 20000, SYNTH: 40000 };
const TOKEN_BPS_BY_ID = [10000n, 20000n, 40000n];
const VCLM_HARD_CAP = TOKEN_HARD_CAPS.VCLM;
const E = BigInt(EPOCH_SECS);

/** Duration multiplier in bps for a permitted stake duration, else 0. */
export function stakeMultiplierBps(durationSecs) {
  const d = STAKE_DURATIONS.find((x) => x.secs === Number(durationSecs));
  return d ? d.multiplier_bps : 0;
}

function tokenId(token) {
  if (typeof token === 'number' || typeof token === 'bigint') return Number(token);
  const i = STAKE_TOKENS.indexOf(token);
  return i < 0 ? 99 : i;
}

// First epoch whose start is at or after t.
function firstEpochAtOrAfter(t, t0) {
  if (t <= t0) return 1n;
  return (t - t0 + E - 1n) / E + 1n;
}

// Last epoch N whose N+1 ends at or before T (0 if none).
function lastEligibleBy(T, t0) {
  if (T < t0 + 2n * E) return 0n;
  return (T - t0) / E - 1n;
}

const fail = (reason) => ({ ok: false, reason });

export class StakePosition {
  constructor(engine, { id, owner, token, amount, durationSecs, startTimestamp, multiplierBps }) {
    Object.defineProperty(this, 'engine', { value: engine, enumerable: false });
    this.id = id;
    this.owner = owner;
    this.tokenId = token;
    this.token = STAKE_TOKENS[token];
    this.amount = amount;
    this.durationSecs = Number(durationSecs);
    this.startTimestamp = startTimestamp;
    this.endTimestamp = startTimestamp + BigInt(durationSecs);
    this.multiplierBps = multiplierBps;
    this.queuedExtensionBps = 0;
    this.queuedExtensionSecs = 0;
    this.withdrawn = false;
    this.activeSince = startTimestamp;
    this.withdrawnAt = 0n;
    this.terms = [{ start: startTimestamp, multiplierBps }];
    this.nextClaimEpoch = 0n;
  }

  get queuedExtension() {
    return this.queuedExtensionBps > 0 ? { durationSecs: this.queuedExtensionSecs, multiplierBps: this.queuedExtensionBps } : null;
  }

  /** Scheduled end including a queued term. */
  get scheduledEnd() {
    return this.endTimestamp + (this.queuedExtensionBps > 0 ? BigInt(this.queuedExtensionSecs) : 0n);
  }

  get isActive() {
    return !this.withdrawn && this.engine.now() < this.endTimestamp;
  }

  get isMatured() {
    return this.engine.now() >= this.scheduledEnd;
  }

  /** Weight of the current term (contract getPositionWeight). */
  getWeight() {
    return (this.amount * TOKEN_BPS_BY_ID[this.tokenId] * BigInt(this.multiplierBps)) / 100000000n;
  }

  termStart(k) {
    return k < this.terms.length ? this.terms[k].start : this.endTimestamp;
  }

  termMult(k) {
    return k < this.terms.length ? this.terms[k].multiplierBps : this.queuedExtensionBps;
  }

  termCountWithQueued() {
    return this.terms.length + (this.queuedExtensionBps > 0 ? 1 : 0);
  }

  /** Duration multiplier in force at time t. */
  multiplierAt(t) {
    if (this.queuedExtensionBps > 0 && t >= this.endTimestamp) return this.queuedExtensionBps;
    for (let k = this.terms.length; k > 0; k--) if (this.terms[k - 1].start <= t) return this.terms[k - 1].multiplierBps;
    return 0;
  }

  /** Weight this position earns for epoch N (0 if it does not qualify). */
  epochWeight(epochN, t0) {
    const n = BigInt(epochN);
    const epochStart = t0 + (n - 1n) * E;
    const nPlus1End = t0 + (n + 1n) * E;
    if (this.activeSince > epochStart) return 0n;
    if (this.scheduledEnd < nPlus1End) return 0n;
    if (this.withdrawn && this.withdrawnAt < nPlus1End) return 0n;
    return (this.amount * TOKEN_BPS_BY_ID[this.tokenId] * BigInt(this.multiplierAt(epochStart))) / 100000000n;
  }
}

export class EpochState {
  constructor(epochNumber) {
    this.epoch = Number(epochNumber);
    this.closed = false;
    this.allocated = false;
    this.rewardBasis = 0n; // USD, 18 decimals
    this.totalWeight = 0n; // set at allocation, as in the contract
    this.mintedVclm = 0n;
    this.closeTimestamp = null;
    this.allocateTimestamp = null;
  }
}

export class StakingEngine {
  /**
   * @param {object} [opts]
   * @param {number|bigint} [opts.launchTimestamp] T0 in seconds; defaults to the clock at construction.
   * @param {() => number|bigint} [opts.clock] seconds clock; defaults to the system clock.
   */
  constructor(opts = {}) {
    this.clock = opts.clock || (() => Math.floor(Date.now() / 1000));
    this.timeOffset = 0n;
    this.reset();
    this.launchTimestamp = opts.launchTimestamp === undefined ? this.now() : BigInt(opts.launchTimestamp);
  }

  reset() {
    this.positions = new Map(); // id (number) -> StakePosition
    this.epochs = new Map(); // epoch (number) -> EpochState
    this.racCredits = []; // [{ racIdentity, recipient, credit, epoch }]
    this.terminalState = false;
    this.cumulativeVclmIssued = 0n; // Commitment Vault VCLM, from the Verifier
    this.cumulativeRewardVclmMinted = 0n;
    this.nextPositionId = 0;
  }

  now() {
    return BigInt(this.clock()) + this.timeOffset;
  }

  /** Moves the simulated clock forward (demo only). */
  advanceTime(secs) {
    this.timeOffset += BigInt(secs);
  }

  epoch(n) {
    const k = Number(n);
    if (!this.epochs.has(k)) this.epochs.set(k, new EpochState(k));
    return this.epochs.get(k);
  }

  syncFromVerifier(verifierState) {
    this.cumulativeVclmIssued = BigInt(verifierState.cumulativeVclmIssued);
  }

  /** Lifetime VCLM: Commitment Vault mints plus stake reward mints. */
  get lifetimeVclmIssued() {
    return this.cumulativeVclmIssued + this.cumulativeRewardVclmMinted;
  }

  remainingVclmCapacity() {
    const issued = this.lifetimeVclmIssued;
    return issued >= VCLM_HARD_CAP ? 0n : VCLM_HARD_CAP - issued;
  }

  /** True if the stake is, or would now enter, terminal state (no change). */
  capReached() {
    return this.terminalState || this.remainingVclmCapacity() === 0n;
  }

  // Records terminal state. Only called on paths that succeed: a reverted
  // contract call rolls back its own terminal-state write.
  enterTerminalIfCapReached() {
    if (this.terminalState) return true;
    if (this.remainingVclmCapacity() === 0n) {
      this.terminalState = true;
      return true;
    }
    return false;
  }

  launched() {
    return this.launchTimestamp && this.launchTimestamp > 0n ? this.launchTimestamp : null;
  }

  getCurrentEpoch() {
    const t0 = this.launched();
    const t = this.now();
    if (!t0 || t < t0) return 0;
    return Number((t - t0) / E + 1n);
  }

  stakeMultiplierBps(durationSecs) {
    return stakeMultiplierBps(durationSecs);
  }

  // ----- Positions -----

  createStakePosition(owner, token, amount, durationSecs) {
    const t0 = this.launched();
    if (!t0) return fail('VF-STK-001: protocol not launched');
    if (this.capReached()) return fail('VF-STK-029: terminal state');
    const tid = tokenId(token);
    if (!(tid >= 0 && tid <= 2)) return fail('VF-STK-002: invalid token');
    let amt;
    try { amt = BigInt(amount); } catch { return fail('VF-STK-031: zero amount'); }
    if (amt <= 0n) return fail('VF-STK-031: zero amount');
    const mult = stakeMultiplierBps(durationSecs);
    if (!mult) return fail('VF-STK-003: duration not permitted');

    const id = this.nextPositionId++;
    const pos = new StakePosition(this, { id, owner, token: tid, amount: amt, durationSecs: Number(durationSecs), startTimestamp: this.now(), multiplierBps: mult });
    pos.nextClaimEpoch = firstEpochAtOrAfter(pos.startTimestamp, t0);
    this.positions.set(id, pos);
    return { ok: true, position: pos, positionId: id };
  }

  queueExtension(owner, positionId, durationSecs) {
    const pos = this.positions.get(Number(positionId));
    if (!pos || pos.owner !== owner) return fail('VFS: not owner');
    if (pos.withdrawn) return fail('VFS: withdrawn');
    if (this.capReached()) return fail('VF-STK-029: terminal state');
    if (this.now() >= pos.endTimestamp) return fail('VF-STK-025: position not active');
    if (pos.queuedExtensionBps !== 0) return fail('VF-STK-023: already queued');
    const mult = stakeMultiplierBps(durationSecs);
    if (!mult) return fail('VF-STK-003: duration not permitted');
    if (!this.launched()) return fail('VF-STK-001: protocol not launched');
    pos.queuedExtensionBps = mult;
    pos.queuedExtensionSecs = Number(durationSecs);
    return { ok: true, position: pos };
  }

  applyExtensionIfMatured(owner, positionId) {
    const pos = this.positions.get(Number(positionId));
    if (!pos || pos.owner !== owner) return fail('VFS: not owner');
    if (pos.withdrawn) return fail('VFS: withdrawn');
    if (pos.queuedExtensionBps === 0) return fail('VFS: no queued extension');
    if (this.now() < pos.endTimestamp) return fail('VFS: not matured');
    pos.startTimestamp = pos.endTimestamp;
    pos.durationSecs = pos.queuedExtensionSecs;
    pos.endTimestamp = pos.startTimestamp + BigInt(pos.queuedExtensionSecs);
    pos.multiplierBps = pos.queuedExtensionBps;
    pos.queuedExtensionBps = 0;
    pos.queuedExtensionSecs = 0;
    pos.terms.push({ start: pos.startTimestamp, multiplierBps: pos.multiplierBps });
    return { ok: true, position: pos };
  }

  withdrawPosition(owner, positionId) {
    const pos = this.positions.get(Number(positionId));
    if (!pos || pos.owner !== owner) return fail('VFS: not owner');
    if (pos.withdrawn) return fail('VFS: withdrawn');
    // VF-STK-030: at terminal state staked tokens are withdrawable at once.
    const terminal = this.capReached();
    if (!terminal && this.now() < pos.scheduledEnd) return fail('VFS: not matured');
    if (!this.launched()) return fail('VF-STK-001: protocol not launched');
    if (terminal) this.enterTerminalIfCapReached();
    pos.withdrawn = true;
    pos.withdrawnAt = this.now();
    return { ok: true, position: pos };
  }

  // ----- Epochs -----

  /** Sum of every position's weight for epoch N, as it stands now. */
  epochTotalWeight(epochN) {
    const t0 = this.launched();
    if (!t0 || Number(epochN) < 1) return 0n;
    let w = 0n;
    for (const p of this.positions.values()) w += p.epochWeight(epochN, t0);
    return w;
  }

  rewardBasisOf(epochN) {
    return this.racCredits.filter((r) => r.epoch === Number(epochN)).reduce((s, r) => s + r.credit, 0n);
  }

  closeEpoch(epochN) {
    const t0 = this.launched();
    if (!t0) return fail('VF-STK-001: protocol not launched');
    const n = Number(epochN);
    const ep = this.epoch(n);
    if (ep.closed) return fail('VFS: already closed');
    if (n < 1) return fail('VF-STK-010: epoch numbering begins at 1');
    if (this.now() < t0 + BigInt(n) * E) return fail('VF-STK-008: epoch not ended');
    if (n > 1 && !this.epoch(n - 1).closed) return fail('VF-STK-010: chronological order');
    ep.rewardBasis = this.rewardBasisOf(n);
    ep.closed = true;
    ep.closeTimestamp = this.now();
    return { ok: true, epoch: ep };
  }

  allocateEpoch(epochN) {
    const t0 = this.launched();
    if (!t0) return fail('VF-STK-001: protocol not launched');
    const n = Number(epochN);
    const ep = this.epoch(n);
    if (!ep.closed) return fail('VFS: not closed');
    if (ep.allocated) return fail('VFS: already allocated');
    if (this.now() < t0 + BigInt(n + 1) * E) return fail('VF-STK-013: wait for N+1 end');
    const totalWeight = this.epochTotalWeight(n);
    ep.totalWeight = totalWeight;
    ep.allocated = true;
    ep.allocateTimestamp = this.now();
    if (ep.rewardBasis === 0n || totalWeight === 0n) return { ok: true, epoch: ep, minted: 0n, reason: 'VF-STK-015: zero-eligible epoch' };
    const totalReward = (ep.rewardBasis * 100n) / BigInt(REWARD_REFERENCE_CENTS);
    const remaining = this.remainingVclmCapacity();
    if (remaining === 0n) {
      this.enterTerminalIfCapReached();
      return { ok: true, epoch: ep, minted: 0n, reason: 'VF-STK-029: terminal state' };
    }
    if (totalReward > remaining) return { ok: true, epoch: ep, minted: 0n, reason: 'VF-STK-028: epoch reward exceeds remaining VCLM capacity' };
    this.cumulativeRewardVclmMinted += totalReward;
    ep.mintedVclm = totalReward;
    this.enterTerminalIfCapReached();
    return { ok: true, epoch: ep, minted: totalReward };
  }

  // ----- Claims (per position) -----

  claimable(pos, from, toEpoch, t0, strict) {
    const to = BigInt(toEpoch);
    if (strict && this.now() < t0 + (to + 1n) * E) return fail('VF-STK-013: epoch not final');
    let last = lastEligibleBy(pos.scheduledEnd, t0);
    if (pos.withdrawn) {
      const wLast = lastEligibleBy(pos.withdrawnAt, t0);
      if (wLast < last) last = wLast;
    }
    if (to < last) last = to;
    const nTerms = pos.termCountWithQueued();
    let k = 0;
    const base = pos.amount * TOKEN_BPS_BY_ID[pos.tokenId];
    let amount = 0n;
    for (let n = from; n <= last; n++) {
      const ep = this.epochs.get(Number(n));
      if (!ep || !ep.allocated) {
        if (strict) return fail('VFS: epoch not allocated');
        continue;
      }
      if (ep.mintedVclm === 0n) continue;
      const t = t0 + (n - 1n) * E;
      while (k + 1 < nTerms && pos.termStart(k + 1) <= t) k++;
      const weight = (base * BigInt(pos.termMult(k))) / 100000000n;
      amount += (ep.mintedVclm * weight) / ep.totalWeight;
    }
    return { ok: true, amount };
  }

  claimPosition(owner, positionId, toEpoch) {
    const pos = this.positions.get(Number(positionId));
    if (!pos || pos.owner !== owner) return fail('VFS: not owner');
    const t0 = this.launched();
    if (!t0) return fail('VF-STK-001: protocol not launched');
    const from = pos.nextClaimEpoch;
    if (BigInt(toEpoch) < from) return fail('VFS: nothing to claim');
    const r = this.claimable(pos, from, toEpoch, t0, true);
    if (!r.ok) return r;
    pos.nextClaimEpoch = BigInt(toEpoch) + 1n;
    return { ok: true, amount: r.amount, fromEpoch: Number(from), toEpoch: Number(toEpoch) };
  }

  /** All-or-nothing, as one transaction. Skips positions already claimed up to toEpoch. */
  claimPositions(owner, positionIds, toEpoch) {
    const saved = positionIds.map((id) => [id, this.positions.get(Number(id))?.nextClaimEpoch]);
    let total = 0n;
    for (const id of positionIds) {
      const pos = this.positions.get(Number(id));
      if ((pos ? pos.nextClaimEpoch : 0n) > BigInt(toEpoch)) continue;
      const r = this.claimPosition(owner, id, toEpoch);
      if (!r.ok) {
        for (const [sid, v] of saved) { const p = this.positions.get(Number(sid)); if (p) p.nextClaimEpoch = v; }
        return r;
      }
      total += r.amount;
    }
    return { ok: true, amount: total };
  }

  /** VCLM a position could claim now for epochs up to toEpoch (contract claimableVclm). */
  claimableVclm(positionId, toEpoch) {
    const pos = this.positions.get(Number(positionId));
    const t0 = this.launched();
    if (!t0 || !pos || BigInt(toEpoch) < pos.nextClaimEpoch) return 0n;
    return this.claimable(pos, pos.nextClaimEpoch, toEpoch, t0, false).amount;
  }

  /** Latest epoch a claim can end at now: current epoch - 2, capped at the last allocated epoch. */
  latestClaimableEpoch() {
    for (let n = this.getCurrentEpoch() - 2; n >= 1; n--) if (this.epochs.get(n)?.allocated) return n;
    return 0;
  }

  /** Display total: the owner's positions' claimable VCLM up to latestClaimableEpoch(). */
  getClaimableVclm(owner) {
    const to = this.latestClaimableEpoch();
    let s = 0n;
    for (const p of this.positions.values()) if (p.owner === owner) s += this.claimableVclm(p.id, to);
    return s;
  }

  recordRacCredit(racIdentity, recipient, credit, epoch) {
    this.racCredits.push({ racIdentity, recipient, credit: BigInt(credit), epoch: Number(epoch) });
  }

  getStats() {
    let activeCount = 0;
    let maturedCount = 0;
    const staked = { VCLM: 0n, CHONX: 0n, SYNTH: 0n };
    for (const pos of this.positions.values()) {
      if (pos.withdrawn) continue;
      if (pos.isActive) activeCount++;
      if (pos.isMatured) maturedCount++;
      staked[pos.token] += pos.amount;
    }
    const currentEpoch = this.getCurrentEpoch();
    const epochStats = [];
    for (const [num, ep] of this.epochs) {
      epochStats.push({
        epoch: num, closed: ep.closed, allocated: ep.allocated,
        rewardBasis: ep.rewardBasis.toString(), totalWeight: ep.totalWeight.toString(), mintedVclm: ep.mintedVclm.toString(),
        isCurrent: num === currentEpoch,
      });
    }
    epochStats.sort((a, b) => b.epoch - a.epoch);
    let lastClosedEpoch = 0;
    for (const [num, ep] of this.epochs) if (ep.closed && num > lastClosedEpoch) lastClosedEpoch = num;
    return {
      totalPositions: this.positions.size,
      activePositions: activeCount,
      maturedPositions: maturedCount,
      terminalState: this.terminalState,
      staked: { VCLM: staked.VCLM.toString(), CHONX: staked.CHONX.toString(), SYNTH: staked.SYNTH.toString() },
      currentEpoch,
      lastClosedEpoch,
      epochs: epochStats,
    };
  }
}
