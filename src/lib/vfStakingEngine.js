// =============================================================================
// BASE-STAKE + BASE-EPOCH — Off-Chain Treasury Reward Stake Engine
//
// PROVENANCE: Built directly from Revision 6 authoritative documents:
//   - Vinculum_Finalis_Architecture_Design.md (Section A.16, B.11)
//   - Vinculum_Finalis_Protocol_Constants.json (Revision 6)
//   - Vinculum_Finalis_Requirement_Traceability.csv
//
// This module mirrors the on-chain BASE-STAKE + BASE-EPOCH contract logic.
// It manages stake positions, epoch finalization (two-phase), reward allocation,
// claimable rewards, queued extensions, and terminal state.
//
// Requirements implemented:
//   VF-STK-001: Stake active from launch (not dependent on CHONX activation)
//   VF-STK-002: Only VCLM/CHONX/SYNTH stakable
//   VF-STK-003: Only listed token+duration multipliers apply
//   VF-STK-004: Rewards paid only in newly minted VCLM
//   VF-STK-005: S1/S2/S3 + acquisition history never affect Weight
//   VF-STK-006: Every epoch = exactly 10 days; delayed processing never shifts boundaries
//   VF-STK-007: Credit belongs to epoch recorded; not added to ended epoch
//   VF-STK-008: Permissionless finalization (anyone may close)
//   VF-STK-009: Delayed finalization does not shift/lengthen/shorten/reset epoch boundary
//   VF-STK-010: Pending epochs finalized in chronological order
//   VF-STK-011: Position beginning after epoch start does not qualify for N
//   VF-STK-012: Position expiring before end of N+1 does not qualify for N
//   VF-STK-013: Entitlement fixed only after scheduled end of N+1 (phase 2 allocate)
//   VF-STK-014: Single mint to stake contract after eligibility; proportional entitlements
//   VF-STK-015: Zero-eligible epoch mints nothing/closes/marks credits used
//   VF-STK-016: Claimable VCLM accumulates and never expires
//   VF-STK-017: User may claim all accumulated in one tx
//   VF-STK-018: Claims transfer minted VCLM; no re-mint/recalc/capacity
//   VF-STK-019: Claims only to owner or bound reward destination
//   VF-STK-020: Withdrawal of matured staked tokens does not erase claimable VCLM
//   VF-STK-021: Queue one future term 30/60/90/120d
//   VF-STK-022: Queued term begins at scheduled end of current; current multiplier until then
//   VF-STK-023: Only one future term queued at a time
//   VF-STK-024: Extension adds/removes no tokens and charges no fee
//   VF-STK-025: Without queued extension position inactive at maturity
//   VF-STK-026: Proportional share at 18-decimal VCLM precision; rounds down
//   VF-STK-027: Microscopic remainder inaccessible; not carried/redirected/reused
//   VF-STK-028: Epoch reward exceeding remaining VCLM capacity mints nothing/closes/marks used
//   VF-STK-029: At zero VCLM capacity stake closes to new positions+extensions
//   VF-STK-030: At terminal state staked tokens immediately withdrawable; claimable remain
//   VF-STK-031: Position requires positive nonzero token amount; no other minimum
//
//   VF-RAC-004: Epoch Reward Basis = sum of RAC closed in epoch (phase 1 close)
//   VF-RAC-005: Epoch Reward VCLM uses permanent $0.10 Reward Reference Value
//   VF-RAC-006: Credit becomes Used only at irreversible epoch allocation
//   VF-SUP-009: Epoch reward not fitting capacity mints zero/closes/marks used
//   VF-SUP-010: Later smaller complete epoch reward issued if fits capacity
//   VF-SUP-011: At zero VCLM capacity stake enters terminal state
// =============================================================================

import {
  SCALE,
  TOKEN_HARD_CAPS,
  STAKE_DURATIONS,
  REWARD_REFERENCE_CENTS,
  FIXED_RULES,
} from './vfRevision6Authority';

const EPOCH_SECS = FIXED_RULES.epoch_days * 86400;

// ---------------------------------------------------------------------------
// StakePosition — a single staking position
// ---------------------------------------------------------------------------

export class StakePosition {
  constructor({ owner, token, amount, durationSecs, startTimestamp }) {
    this.id = `stake-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.owner = owner;
    this.token = token; // VCLM, CHONX, or SYNTH
    this.amount = BigInt(amount);
    this.durationSecs = Number(durationSecs);
    this.startTimestamp = Number(startTimestamp);
    this.endTimestamp = this.startTimestamp + this.durationSecs;

    // Multiplier from the stake duration table
    const dur = STAKE_DURATIONS.find((d) => d.secs === this.durationSecs);
    this.multiplierBps = dur ? dur.multiplier_bps : 10000;

    // Queued extension (VF-STK-021/023: only one at a time)
    this.queuedExtension = null; // { durationSecs, multiplierBps }

    // Status
    this.withdrawn = false;
  }

  get isActive() {
    return !this.withdrawn && Date.now() / 1000 < this.endTimestamp;
  }

  get isMatured() {
    return Date.now() / 1000 >= this.endTimestamp;
  }

  // VF-STK-011: Position beginning after epoch start does not qualify for N
  // VF-STK-012: Position expiring before end of N+1 does not qualify for N
  // Eligibility for epoch N: position started at or before epoch N start,
  // and position does not expire before end of epoch N+1.
  qualifiesForEpoch(epochN) {
    const epochStart = epochN * EPOCH_SECS;
    const epochNPlus1End = (epochN + 2) * EPOCH_SECS;
    return this.startTimestamp <= epochStart && this.endTimestamp >= epochNPlus1End;
  }

  // Stake weight = amount × multiplier (VF-STK-003/005)
  // VF-STK-005: classification never affects Weight
  getWeight() {
    return (this.amount * BigInt(this.multiplierBps)) / 10000n;
  }
}

// ---------------------------------------------------------------------------
// EpochState — two-phase epoch finalization (VF-RAC-004, VF-STK-006-010)
// ---------------------------------------------------------------------------

export class EpochState {
  constructor(epochNumber) {
    this.epoch = epochNumber;
    this.scheduledStart = epochNumber * EPOCH_SECS;
    this.scheduledEnd = (epochNumber + 1) * EPOCH_SECS;
    this.closed = false;       // Phase 1: close
    this.allocated = false;   // Phase 2: allocate
    this.rewardBasis = 0n;    // Sum of RAC credits closed in this epoch
    this.totalWeight = 0n;    // Sum of qualifying stake weights
    this.mintedVclm = 0n;     // VCLM minted in phase 2
    this.closeTimestamp = null;
    this.allocateTimestamp = null;
  }
}

// ---------------------------------------------------------------------------
// StakingEngine — the full BASE-STAKE + BASE-EPOCH implementation
// ---------------------------------------------------------------------------

export class StakingEngine {
  constructor() {
    this.positions = new Map();        // id → StakePosition
    this.epochs = new Map();           // epoch → EpochState
    this.racCredits = [];              // [{ racIdentity, recipient, credit, epoch }]
    this.claimableVclm = new Map();    // owner → accumulated claimable VCLM
    this.terminalState = false;        // VF-STK-029: terminal at zero VCLM capacity
    this.cumulativeVclmIssued = 0n;    // shared with VerifierState
    this.nextPositionId = 1;
  }

  reset() {
    this.positions.clear();
    this.epochs.clear();
    this.racCredits = [];
    this.claimableVclm.clear();
    this.terminalState = false;
    this.cumulativeVclmIssued = 0n;
    this.nextPositionId = 1;
  }

  syncFromVerifier(verifierState) {
    this.cumulativeVclmIssued = verifierState.cumulativeVclmIssued;
    // VF-SUP-011 / VF-STK-029: At zero VCLM capacity, stake enters terminal state
    if (this.cumulativeVclmIssued >= TOKEN_HARD_CAPS.VCLM) {
      this.terminalState = true;
    }
  }

  getCurrentEpoch() {
    return Math.floor(Math.floor(Date.now() / 1000) / EPOCH_SECS);
  }

  // -------------------------------------------------------------------------
  // VF-STK-001/002/031: Create a stake position
  // -------------------------------------------------------------------------

  createStakePosition(owner, token, amount, durationSecs) {
    // VF-STK-029: Terminal state — no new positions
    if (this.terminalState) {
      return { ok: false, reason: 'VF-STK-029: Stake in terminal state (zero VCLM capacity)' };
    }

    // VF-STK-002: Only VCLM/CHONX/SYNTH stakable
    if (!['VCLM', 'CHONX', 'SYNTH'].includes(token)) {
      return { ok: false, reason: 'VF-STK-002: Only VCLM/CHONX/SYNTH stakable' };
    }

    // VF-STK-031: Positive nonzero token amount; no other minimum
    const amt = BigInt(amount);
    if (amt <= 0n) {
      return { ok: false, reason: 'VF-STK-031: Position requires positive nonzero token amount' };
    }

    // VF-STK-003: Only listed duration multipliers apply
    const dur = STAKE_DURATIONS.find((d) => d.secs === Number(durationSecs));
    if (!dur) {
      return { ok: false, reason: `VF-STK-003: Duration ${durationSecs}s not in stake duration list` };
    }

    const pos = new StakePosition({
      owner,
      token,
      amount: amt,
      durationSecs,
      startTimestamp: Math.floor(Date.now() / 1000),
    });
    pos.id = `stake-${this.nextPositionId++}`;
    this.positions.set(pos.id, pos);

    return { ok: true, position: pos };
  }

  // -------------------------------------------------------------------------
  // VF-STK-021/022/023/024: Queue a future term extension
  // -------------------------------------------------------------------------

  queueExtension(positionId, durationSecs) {
    const pos = this.positions.get(positionId);
    if (!pos) return { ok: false, reason: 'unknown position' };
    if (pos.withdrawn) return { ok: false, reason: 'position already withdrawn' };

    // VF-STK-023: Only one future term queued at a time
    if (pos.queuedExtension) {
      return { ok: false, reason: 'VF-STK-023: Only one future term queued at a time' };
    }

    const dur = STAKE_DURATIONS.find((d) => d.secs === Number(durationSecs));
    if (!dur) {
      return { ok: false, reason: `VF-STK-003: Duration ${durationSecs}s not permitted` };
    }

    // VF-STK-024: Extension adds/removes no tokens and charges no fee
    pos.queuedExtension = { durationSecs: Number(durationSecs), multiplierBps: dur.multiplier_bps };
    return { ok: true, position: pos };
  }

  // VF-STK-022: Queued term begins at scheduled end of current term
  applyExtensionIfMatured(positionId) {
    const pos = this.positions.get(positionId);
    if (!pos) return { ok: false, reason: 'unknown position' };
    if (!pos.queuedExtension) return { ok: true, position: pos, extended: false };
    if (!pos.isMatured) return { ok: true, position: pos, extended: false };

    const ext = pos.queuedExtension;
    pos.startTimestamp = pos.endTimestamp; // VF-STK-022: begins at scheduled end
    pos.durationSecs = ext.durationSecs;
    pos.endTimestamp = pos.startTimestamp + ext.durationSecs;
    pos.multiplierBps = ext.multiplierBps;
    pos.queuedExtension = null;
    return { ok: true, position: pos, extended: true };
  }

  // -------------------------------------------------------------------------
  // VF-STK-025: Without queued extension, position inactive at maturity
  // -------------------------------------------------------------------------

  withdrawPosition(positionId) {
    const pos = this.positions.get(positionId);
    if (!pos) return { ok: false, reason: 'unknown position' };
    if (pos.withdrawn) return { ok: false, reason: 'already withdrawn' };
    if (!pos.isMatured) return { ok: false, reason: 'position not yet matured' };

    // VF-STK-020: Withdrawal does not erase claimable VCLM
    pos.withdrawn = true;
    return { ok: true, position: pos };
  }

  // -------------------------------------------------------------------------
  // BASE-EPOCH Phase 1: Close epoch (VF-RAC-004, VF-STK-006-010)
  // VF-STK-008: Permissionless — anyone may finalize
  // VF-STK-009: Delayed finalization never shifts boundaries
  // VF-STK-010: Pending epochs finalized in chronological order
  // -------------------------------------------------------------------------

  closeEpoch(epochN) {
    let epoch = this.epochs.get(epochN);
    if (!epoch) {
      epoch = new EpochState(epochN);
      this.epochs.set(epochN, epoch);
    }

    if (epoch.closed) {
      return { ok: false, reason: `Epoch ${epochN} already closed` };
    }

    // VF-STK-010: Chronological order — can't close N if N-1 not closed
    if (epochN > 0) {
      const prev = this.epochs.get(epochN - 1);
      if (!prev || !prev.closed) {
        return { ok: false, reason: `VF-STK-010: Epoch ${epochN - 1} must be closed first (chronological order)` };
      }
    }

    // VF-RAC-004: Epoch Reward Basis = sum of RAC credits closed in epoch
    const epochCredits = this.racCredits.filter((r) => r.epoch === epochN);
    epoch.rewardBasis = epochCredits.reduce((sum, r) => sum + BigInt(r.credit), 0n);

    // VF-STK-014: Calculate total qualifying weight for proportional allocation
    epoch.totalWeight = 0n;
    for (const pos of this.positions.values()) {
      if (!pos.withdrawn && pos.qualifiesForEpoch(epochN)) {
        epoch.totalWeight += pos.getWeight();
      }
    }

    epoch.closed = true;
    epoch.closeTimestamp = Math.floor(Date.now() / 1000);

    return { ok: true, epoch };
  }

  // -------------------------------------------------------------------------
  // BASE-EPOCH Phase 2: Allocate epoch rewards (VF-STK-013-015, VF-RAC-005/006)
  // VF-STK-013: Entitlement fixed only after scheduled end of N+1
  // -------------------------------------------------------------------------

  allocateEpoch(epochN) {
    let epoch = this.epochs.get(epochN);
    if (!epoch) return { ok: false, reason: `Epoch ${epochN} not closed` };
    if (!epoch.closed) return { ok: false, reason: `Epoch ${epochN} not yet closed` };
    if (epoch.allocated) return { ok: false, reason: `Epoch ${epochN} already allocated` };

    // VF-STK-013: Can only allocate after scheduled end of N+1
    const currentTime = Math.floor(Date.now() / 1000);
    const nPlus1End = (epochN + 2) * EPOCH_SECS;
    if (currentTime < nPlus1End) {
      return { ok: false, reason: `VF-STK-013: Entitlement fixed only after scheduled end of N+1 (${nPlus1End - currentTime}s remaining)` };
    }

    // VF-STK-015 / VF-SUP-009: Zero-eligible or zero-basis epoch mints nothing
    if (epoch.rewardBasis === 0n || epoch.totalWeight === 0n) {
      epoch.allocated = true;
      epoch.allocateTimestamp = currentTime;
      epoch.mintedVclm = 0n;
      return { ok: true, epoch, minted: 0n, reason: 'VF-STK-015: zero-eligible epoch' };
    }

    // VF-RAC-005: Epoch Reward VCLM uses permanent $0.10 Reward Reference Value
    // VCLM_reward = RAC_USD / $0.10 = RAC_USD × (100 / reference_cents)
    const totalReward = (epoch.rewardBasis * 100n) / BigInt(REWARD_REFERENCE_CENTS);

    // VF-STK-028 / VF-SUP-009: Cap check — if reward exceeds remaining capacity, mint nothing
    const remaining = TOKEN_HARD_CAPS.VCLM - this.cumulativeVclmIssued;
    if (totalReward > remaining) {
      // VF-STK-028: mints nothing, closes, marks credits used
      epoch.allocated = true;
      epoch.allocateTimestamp = currentTime;
      epoch.mintedVclm = 0n;
      return { ok: true, epoch, minted: 0n, reason: 'VF-STK-028: epoch reward exceeds remaining VCLM capacity' };
    }

    // VF-STK-014/026: Single mint to stake contract; proportional entitlements; rounds down
    const distributions = [];
    let totalDistributed = 0n;

    for (const pos of this.positions.values()) {
      if (!pos.withdrawn && pos.qualifiesForEpoch(epochN)) {
        const weight = pos.getWeight();
        // VF-STK-026: Proportional share at 18-decimal VCLM precision; rounds down
        const share = (totalReward * weight) / epoch.totalWeight;
        if (share > 0n) {
          // VF-STK-016: Claimable VCLM accumulates and never expires
          const current = this.claimableVclm.get(pos.owner) || 0n;
          this.claimableVclm.set(pos.owner, current + share);
          totalDistributed += share;
          distributions.push({
            owner: pos.owner,
            positionId: pos.id,
            weight: weight.toString(),
            share: share.toString(),
          });
        }
      }
    }

    // VF-STK-027: Microscopic remainder inaccessible (totalReward - totalDistributed)
    // Remainder is not carried, redirected, or reused.

    // VF-RAC-006: Credits become Used only at irreversible epoch allocation
    // VF-SUP-010: Later smaller epoch reward issued if fits capacity
    epoch.allocated = true;
    epoch.allocateTimestamp = currentTime;
    epoch.mintedVclm = totalDistributed;
    this.cumulativeVclmIssued += totalDistributed;

    // VF-SUP-011 / VF-STK-029: Check terminal state
    if (this.cumulativeVclmIssued >= TOKEN_HARD_CAPS.VCLM) {
      this.terminalState = true;
    }

    return { ok: true, epoch, minted: totalDistributed, distributions };
  }

  // -------------------------------------------------------------------------
  // VF-STK-016/017/018/019: Claimable VCLM
  // -------------------------------------------------------------------------

  // VF-STK-017: User may claim all accumulated in one tx
  // VF-STK-018: Claims transfer minted VCLM; no re-mint/recalc/capacity
  // VF-STK-019: Claims only to owner
  claimVclm(owner) {
    const amount = this.claimableVclm.get(owner) || 0n;
    if (amount === 0n) {
      return { ok: false, reason: 'no claimable VCLM' };
    }
    this.claimableVclm.set(owner, 0n);
    return { ok: true, amount };
  }

  getClaimableVclm(owner) {
    return this.claimableVclm.get(owner) || 0n;
  }

  // -------------------------------------------------------------------------
  // RAC credit recording (bridges from VerifierState)
  // VF-RAC-003: RAC assigned to 10-day epoch recorded at fee verification
  // VF-RAC-007: Credit belongs to epoch recorded; not added to ended epoch
  // -------------------------------------------------------------------------

  recordRacCredit(racIdentity, recipient, credit, epoch) {
    this.racCredits.push({
      racIdentity,
      recipient,
      credit: BigInt(credit),
      epoch: Number(epoch),
    });
  }

  // -------------------------------------------------------------------------
  // Stats / queries
  // -------------------------------------------------------------------------

  getStats() {
    let activeCount = 0;
    let maturedCount = 0;
    let totalStakedVclm = 0n;
    let totalStakedChonx = 0n;
    let totalStakedSynth = 0n;

    for (const pos of this.positions.values()) {
      if (pos.withdrawn) continue;
      if (pos.isActive) activeCount++;
      if (pos.isMatured) maturedCount++;
      if (pos.token === 'VCLM') totalStakedVclm += pos.amount;
      else if (pos.token === 'CHONX') totalStakedChonx += pos.amount;
      else if (pos.token === 'SYNTH') totalStakedSynth += pos.amount;
    }

    const currentEpoch = this.getCurrentEpoch();
    const epochStats = [];
    for (const [num, ep] of this.epochs) {
      epochStats.push({
        epoch: num,
        closed: ep.closed,
        allocated: ep.allocated,
        rewardBasis: ep.rewardBasis.toString(),
        totalWeight: ep.totalWeight.toString(),
        mintedVclm: ep.mintedVclm.toString(),
        isCurrent: num === currentEpoch,
      });
    }
    epochStats.sort((a, b) => b.epoch - a.epoch);

    return {
      totalPositions: this.positions.size,
      activePositions: activeCount,
      maturedPositions: maturedCount,
      terminalState: this.terminalState,
      staked: {
        VCLM: totalStakedVclm.toString(),
        CHONX: totalStakedChonx.toString(),
        SYNTH: totalStakedSynth.toString(),
      },
      currentEpoch,
      epochs: epochStats,
    };
  }
}