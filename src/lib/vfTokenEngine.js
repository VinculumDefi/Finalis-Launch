// =============================================================================
// BASE-TOK + BASE-FORGE — Off-Chain Token Layer Engine
//
// PROVENANCE: Built directly from Revision 6 authoritative documents:
//   - Vinculum_Finalis_Protocol_Constants.json (Revision 6, 2026-07-28)
//   - Vinculum_Finalis_Architecture_Design.md (Sections A.9, A.11-A.13)
//   - Vinculum_Finalis_Requirement_Traceability.csv
//
// This module mirrors the on-chain token contract logic for the VCLM, CHONX,
// and SYNTH tokens. It integrates with the existing VerifierState to exercise
// the full issuance pipeline end-to-end:
//
//   Source Lock → ProofPackage → verifyProof() → mint VCLM/CHONX → forge SYNTH
//
// Requirements implemented:
//   VF-TOK-001: 18 decimal places for VCLM, CHONX, SYNTH
//   VF-TOK-002: CHONX activation at 10,000,000 cumulative VCLM
//   VF-TOK-003: SYNTH activation at 100,000,000 cumulative CHONX
//   VF-TOK-004: Forge 1 SYNTH = burn 1,000 VCLM + 10,000 CHONX
//   VF-TOK-009: VCLM hard cap = 10,000,000,000
//   VF-TOK-010: CHONX hard cap = 100,000,000,000; SYNTH hard cap = 10,000,000
//   VF-SUP-015: Hard-cap rejection in full
// =============================================================================

import {
  SCALE,
  TOKEN_HARD_CAPS,
  CHONX_ACTIVATION_THRESHOLD,
  SYNTH_ACTIVATION_THRESHOLD,
  SYNTH_FORGE,
  FIXED_RULES,
} from './vfRevision6Authority';

// ---------------------------------------------------------------------------
// TokenLayerState — tracks balances, cumulative issuance, and activation
// ---------------------------------------------------------------------------

export class TokenLayerState {
  constructor() {
    // Per-account balances: Map<address, bigint>
    this.balances = {
      VCLM: new Map(),
      CHONX: new Map(),
      SYNTH: new Map(),
    };

    // Lifetime cumulative issuance (mirrors VerifierState)
    this.cumulativeVclmIssued = 0n;
    this.cumulativeChonxIssued = 0n;
    this.cumulativeSynthMinted = 0n;

    // Activation state (mirrors on-chain flags)
    this.chonxActivated = false;
    this.synthActivated = false;

    // History (append-only)
    this.mintHistory = [];
    this.forgeHistory = [];

    // Epoch Reward Distribution (VF-RAC / BASE-EPOCH)
    // RAC credits accumulate per epoch; distribution happens at epoch boundary.
    this.racCredits = [];            // [{ racIdentity, recipient, credit, epoch }]
    this.distributedEpochs = new Set();
    this.epochDistributions = [];    // [{ epoch, distributions, totalDistributed, ts }]
  }

  // ----- Balance helpers -----

  getBalance(token, account) {
    return this.balances[token].get(account) || 0n;
  }

  setBalance(token, account, amount) {
    this.balances[token].set(account, amount);
  }

  // ----- Sync from VerifierState (after verifyProof) -----

  syncFromVerifier(verifierState) {
    this.cumulativeVclmIssued = verifierState.cumulativeVclmIssued;
    this.cumulativeChonxIssued = verifierState.cumulativeChonxIssued;
    this.chonxActivated = verifierState.chonxActivated;
    this._checkSynthActivation();
  }

  _checkSynthActivation() {
    if (!this.synthActivated && this.cumulativeChonxIssued >= SYNTH_ACTIVATION_THRESHOLD) {
      this.synthActivated = true;
    }
  }

  // ----- Mint VCLM (called after verifyProof succeeds with VCLM output) -----

  mintVclm(to, amount, { skipCumulativeUpdate = false } = {}) {
    const amt = BigInt(amount);

    if (skipCumulativeUpdate) {
      // Verifier already checked hard cap and updated cumulative via syncFromVerifier.
      // Only update balance + history here.
      if (amt <= 0n) return { ok: false, reason: 'VFT: zero mint amount' };
      this.balances.VCLM.set(to, (this.balances.VCLM.get(to) || 0n) + amt);
      this.mintHistory.push({ token: 'VCLM', to, amount: amt.toString(), ts: Date.now() });
      return { ok: true, cumulativeIssued: this.cumulativeVclmIssued, chonxActivated: this.chonxActivated };
    }

    // VF-SUP-015: hard-cap rejection in full
    const remaining = TOKEN_HARD_CAPS.VCLM - this.cumulativeVclmIssued;
    if (amt > remaining) {
      return { ok: false, reason: 'VF-SUP-015: VCLM hard cap exceeded — reject in full' };
    }
    if (amt <= 0n) {
      return { ok: false, reason: 'VFT: zero mint amount' };
    }

    this.cumulativeVclmIssued += amt;
    this.balances.VCLM.set(to, (this.balances.VCLM.get(to) || 0n) + amt);
    this.mintHistory.push({
      token: 'VCLM', to, amount: amt.toString(), ts: Date.now(),
    });

    // VF-TOK-002: CHONX activation at 10M cumulative VCLM
    let newlyActivated = false;
    if (!this.chonxActivated && this.cumulativeVclmIssued >= CHONX_ACTIVATION_THRESHOLD) {
      this.chonxActivated = true;
      newlyActivated = true;
    }

    return { ok: true, cumulativeIssued: this.cumulativeVclmIssued, chonxActivated: this.chonxActivated, newlyActivated };
  }

  // ----- Mint CHONX (called after verifyProof succeeds with CHONX output) -----

  mintChonx(to, amount, { skipCumulativeUpdate = false } = {}) {
    const amt = BigInt(amount);

    // VF-COM-025 / VF-TOK-002: CHONX must be activated
    if (!this.chonxActivated) {
      return { ok: false, reason: 'VF-COM-025/VF-TOK-002: CHONX not activated' };
    }

    if (skipCumulativeUpdate) {
      // Verifier already checked hard cap and updated cumulative via syncFromVerifier.
      if (amt <= 0n) return { ok: false, reason: 'VFT: zero mint amount' };
      this.balances.CHONX.set(to, (this.balances.CHONX.get(to) || 0n) + amt);
      this.mintHistory.push({ token: 'CHONX', to, amount: amt.toString(), ts: Date.now() });
      const wasSynthActivated = this.synthActivated;
      this._checkSynthActivation();
      return { ok: true, cumulativeIssued: this.cumulativeChonxIssued, synthActivated: this.synthActivated, newlyActivated: !wasSynthActivated && this.synthActivated };
    }

    // VF-SUP-015: hard-cap rejection in full
    const remaining = TOKEN_HARD_CAPS.CHONX - this.cumulativeChonxIssued;
    if (amt > remaining) {
      return { ok: false, reason: 'VF-SUP-015: CHONX hard cap exceeded — reject in full' };
    }
    if (amt <= 0n) {
      return { ok: false, reason: 'VFT: zero mint amount' };
    }

    this.cumulativeChonxIssued += amt;
    this.balances.CHONX.set(to, (this.balances.CHONX.get(to) || 0n) + amt);
    this.mintHistory.push({
      token: 'CHONX', to, amount: amt.toString(), ts: Date.now(),
    });

    // VF-TOK-003: SYNTH activation at 100M cumulative CHONX
    const wasSynthActivated = this.synthActivated;
    this._checkSynthActivation();
    const newlyActivated = !wasSynthActivated && this.synthActivated;

    return { ok: true, cumulativeIssued: this.cumulativeChonxIssued, synthActivated: this.synthActivated, newlyActivated };
  }

  // ----- Forge SYNTH (VF-TOK-004) -----

  forgeSynth(from, count) {
    const n = BigInt(count);
    if (n <= 0n) {
      return { ok: false, reason: 'SYNTH: zero forge count' };
    }

    // VF-TOK-003: SYNTH must be activated
    if (!this.synthActivated) {
      return { ok: false, reason: 'VF-TOK-003: SYNTH not activated (cumulative CHONX < 100,000,000)' };
    }

    // VF-TOK-004: calculate burn amounts
    const vclmBurn = SYNTH_FORGE.vclm_burn * n;
    const chonxBurn = SYNTH_FORGE.chonx_burn * n;
    const synthMint = n * SCALE;

    // Check balances
    const vclmBal = this.getBalance('VCLM', from);
    const chonxBal = this.getBalance('CHONX', from);
    if (vclmBal < vclmBurn) {
      return { ok: false, reason: `insufficient VCLM: have ${vclmBal}, need ${vclmBurn}` };
    }
    if (chonxBal < chonxBurn) {
      return { ok: false, reason: `insufficient CHONX: have ${chonxBal}, need ${chonxBurn}` };
    }

    // VF-SUP-015: SYNTH hard cap
    const synthRemaining = TOKEN_HARD_CAPS.SYNTH - this.cumulativeSynthMinted;
    if (synthMint > synthRemaining) {
      return { ok: false, reason: 'VF-SUP-015: SYNTH hard cap exceeded — reject in full' };
    }

    // Execute: burn VCLM + CHONX, mint SYNTH
    this.balances.VCLM.set(from, vclmBal - vclmBurn);
    this.balances.CHONX.set(from, chonxBal - chonxBurn);
    this.cumulativeSynthMinted += synthMint;
    this.balances.SYNTH.set(from, (this.balances.SYNTH.get(from) || 0n) + synthMint);

    this.forgeHistory.push({
      from,
      count: n.toString(),
      vclmBurn: vclmBurn.toString(),
      chonxBurn: chonxBurn.toString(),
      synthMinted: synthMint.toString(),
      ts: Date.now(),
    });

    return { ok: true, vclmBurn, chonxBurn, synthMinted: synthMint };
  }

  // ----- Epoch Reward Distribution (VF-RAC / BASE-EPOCH) -----
  //
  // VF-RAC: Reward Accounting Credits accrue at 60% of the verified fee USD
  // value per successful verification. Credits are tagged with an epoch number
  // (epoch_days = 10 per FIXED_RULES). At epoch boundary, accumulated credits
  // are converted to VCLM at the current emission rate and distributed to the
  // qualifying base_recipients. Each epoch distributes exactly once.

  recordRacCredit(racIdentity, recipient, credit, epoch) {
    this.racCredits.push({ racIdentity, recipient, credit: BigInt(credit), epoch: Number(epoch) });
  }

  getCurrentEpoch() {
    return Math.floor(Date.now() / (FIXED_RULES.epoch_days * 86400 * 1000));
  }

  getEpochStats() {
    const currentEpoch = this.getCurrentEpoch();
    const byEpoch = new Map();
    for (const rc of this.racCredits) {
      if (!byEpoch.has(rc.epoch)) byEpoch.set(rc.epoch, { credits: 0n, count: 0 });
      const e = byEpoch.get(rc.epoch);
      e.credits += rc.credit;
      e.count++;
    }
    const epochs = [];
    for (const [epoch, data] of byEpoch) {
      epochs.push({
        epoch,
        totalCredits: data.credits.toString(),
        creditCount: data.count,
        distributed: this.distributedEpochs.has(epoch),
        isCurrent: epoch === currentEpoch,
      });
    }
    return { currentEpoch, epochs: epochs.sort((a, b) => b.epoch - a.epoch) };
  }

  distributeEpochRewards(epoch) {
    if (this.distributedEpochs.has(epoch)) {
      return { ok: false, reason: `Epoch ${epoch} already distributed` };
    }

    const epochCredits = this.racCredits.filter((r) => r.epoch === epoch);
    if (epochCredits.length === 0) {
      return { ok: false, reason: `No RAC credits recorded for epoch ${epoch}` };
    }

    // Group by recipient and sum RAC credits
    const byRecipient = new Map();
    for (const rc of epochCredits) {
      byRecipient.set(rc.recipient, (byRecipient.get(rc.recipient) || 0n) + rc.credit);
    }

    // VF-RAC-005: Epoch Reward VCLM uses PERMANENT $0.10 Reward Reference Value.
    // VCLM_reward = RAC_USD / $0.10 = RAC_USD × (100 / reference_cents)
    //             = RAC_USD × (100 / 10) = RAC_USD × 10
    // This rate NEVER decays — it is the permanent reward reference, not the
    // current emission rate (which decays 1.667% per 30-day period).
    const REWARD_REFERENCE_CENTS = 10n; // $0.10 (EMISSION.VCLM.reference_cents)
    const distributions = [];
    let totalDistributed = 0n;

    for (const [recipient, racUsd] of byRecipient) {
      const vclmAmount = (racUsd * 100n) / REWARD_REFERENCE_CENTS;
      if (vclmAmount > 0n) {
        // Epoch rewards are minted outside the hard-cap path (they are accounting
        // credits, not new lock issuance) but still respect the VCLM hard cap.
        const remaining = TOKEN_HARD_CAPS.VCLM - this.cumulativeVclmIssued;
        const actual = vclmAmount > remaining ? remaining : vclmAmount;
        if (actual > 0n) {
          this.balances.VCLM.set(recipient, (this.balances.VCLM.get(recipient) || 0n) + actual);
          this.cumulativeVclmIssued += actual;
          totalDistributed += actual;
          distributions.push({
            recipient,
            racCredit: racUsd.toString(),
            vclmAmount: actual.toString(),
          });
        }
      }
    }

    this.distributedEpochs.add(epoch);
    const distRecord = {
      epoch,
      distributions,
      totalDistributed: totalDistributed.toString(),
      rewardReferenceCents: 10, // $0.10 permanent (VF-RAC-005)
      ts: Date.now(),
    };
    this.epochDistributions.push(distRecord);

    return { ok: true, ...distRecord };
  }

  // ----- Stats -----

  getStats() {
    return {
      VCLM: {
        name: 'Vinculum Finalis VCLM',
        symbol: 'VCLM',
        decimals: 18,
        issued: this.cumulativeVclmIssued.toString(),
        cap: TOKEN_HARD_CAPS.VCLM.toString(),
        remaining: (TOKEN_HARD_CAPS.VCLM - this.cumulativeVclmIssued).toString(),
        activated: true, // VCLM is always available
      },
      CHONX: {
        name: 'Vinculum Finalis CHONX',
        symbol: 'CHONX',
        decimals: 18,
        issued: this.cumulativeChonxIssued.toString(),
        cap: TOKEN_HARD_CAPS.CHONX.toString(),
        remaining: (TOKEN_HARD_CAPS.CHONX - this.cumulativeChonxIssued).toString(),
        activated: this.chonxActivated,
        activationThreshold: CHONX_ACTIVATION_THRESHOLD.toString(),
      },
      SYNTH: {
        name: 'Vinculum Finalis SYNTH',
        symbol: 'SYNTH',
        decimals: 18,
        minted: this.cumulativeSynthMinted.toString(),
        cap: TOKEN_HARD_CAPS.SYNTH.toString(),
        remaining: (TOKEN_HARD_CAPS.SYNTH - this.cumulativeSynthMinted).toString(),
        activated: this.synthActivated,
        activationThreshold: SYNTH_ACTIVATION_THRESHOLD.toString(),
        forgeRatio: {
          vclmBurn: SYNTH_FORGE.vclm_burn.toString(),
          chonxBurn: SYNTH_FORGE.chonx_burn.toString(),
        },
      },
    };
  }

  reset() {
    this.balances.VCLM.clear();
    this.balances.CHONX.clear();
    this.balances.SYNTH.clear();
    this.cumulativeVclmIssued = 0n;
    this.cumulativeChonxIssued = 0n;
    this.cumulativeSynthMinted = 0n;
    this.chonxActivated = false;
    this.synthActivated = false;
    this.mintHistory = [];
    this.forgeHistory = [];
    this.racCredits = [];
    this.distributedEpochs = new Set();
    this.epochDistributions = [];
  }
}

// ---------------------------------------------------------------------------
// Helper: format bigint token amount for display
// ---------------------------------------------------------------------------

export function formatTokenAmount(amount, decimals = 18) {
  const val = BigInt(amount);
  const divisor = 10n ** BigInt(decimals);
  const whole = val / divisor;
  const fraction = val % divisor;
  const fracStr = fraction.toString().padStart(Number(decimals), '0').replace(/0+$/, '');
  return fracStr ? `${whole.toString()}.${fracStr}` : whole.toString();
}