// =============================================================================
// EVM FAMILY CHAIN VERIFIER (Section O)
// Handles: Ethereum, BNB, Avalanche, Polygon, Arbitrum, Base, Optimism
//
// Each EVM environment has its own finality model:
//   Ethereum  — PoS finalized (2 epochs ≈ 12.8 min)
//   BNB       — Fast Finality (FFF) — 2 blocks
//   Avalanche — Snowman — accepted block
//   Polygon   — Heimdall v2 checkpoint
//   Arbitrum  — Optimistic rollup — L1 finalized or challenge period passed
//   Base      — OP Stack same-chain (RESOLVED_SAME_CHAIN)
//   Optimism  — OP Stack — L1 finalized or challenge period passed
//
// VF-XCH-006/010: Finality must be objective (chain-native evidence).
// VF-XCH-011: Facts extracted independently from raw lock event proof.
// =============================================================================

// Finality status codes (shared across all chain verifiers)
export const FINALITY_STATUS = {
  PENDING: 0,
  FINALIZED: 1,
  ACCEPTED: 2,
  CHECKPOINT_VERIFIED: 3,
  L1_FINALIZED: 4,
  CHALLENGE_PERIOD_PASSED: 5,
  SAME_CHAIN: 6,
};

export class EvmChainVerifier {
  constructor(environmentId, config) {
    this.environmentId = environmentId;
    this.finalityModel = config.finalityModel;
    this.minConfirmations = config.minConfirmations;
    this.challengePeriodBlocks = config.challengePeriodBlocks;
    this.sameChain = config.sameChain || false;
  }

  verifyFinality(lockEventProof, sourceFinalityProof) {
    if (!sourceFinalityProof || typeof sourceFinalityProof !== 'object') {
      return { ok: false, reason: `VF-XCH-006: ${this.environmentId} finality proof missing` };
    }
    const proof = sourceFinalityProof;
    const status = Number(proof.finalityStatus ?? proof.status ?? -1);

    // Base (same-chain): VF-XCH-003 RESOLVED_SAME_CHAIN — no cross-chain verification needed
    if (this.sameChain) {
      return {
        ok: true, finalized: true,
        blockHash: proof.blockHash || `0x${'0'.repeat(64)}`,
        blockHeight: Number(proof.blockNumber || 0),
        model: 'RESOLVED_SAME_CHAIN',
      };
    }

    // Ethereum: PoS finalized
    if (this.finalityModel === 'PoS finalized') {
      if (status !== FINALITY_STATUS.FINALIZED) {
        return { ok: false, reason: `VF-XCH-006: Ethereum PoS not finalized (status=${status})` };
      }
    }

    // BNB: Fast Finality (FFF) — minConfirmations blocks
    if (this.finalityModel === 'FFF') {
      const confs = Number(proof.confirmations || 0);
      if (confs < this.minConfirmations) {
        return { ok: false, reason: `VF-XCH-006: BNB FFF confirmations ${confs} < ${this.minConfirmations}` };
      }
    }

    // Avalanche: Snowman — accepted block
    if (this.finalityModel === 'Snowman') {
      if (status !== FINALITY_STATUS.ACCEPTED && status !== FINALITY_STATUS.FINALIZED) {
        return { ok: false, reason: `VF-XCH-006: Avalanche Snowman not accepted (status=${status})` };
      }
    }

    // Polygon: Heimdall v2 checkpoint
    if (this.finalityModel === 'Heimdall v2') {
      if (status !== FINALITY_STATUS.CHECKPOINT_VERIFIED) {
        return { ok: false, reason: 'VF-XCH-006: Polygon Heimdall checkpoint not verified' };
      }
    }

    // Arbitrum / Optimism: Optimistic rollup — L1 finalized OR challenge period passed
    if (this.finalityModel === 'Optimistic' || this.finalityModel === 'OP Stack') {
      const l1Finalized = status === FINALITY_STATUS.L1_FINALIZED || proof.l1Finalized === true;
      const challengePassed = status === FINALITY_STATUS.CHALLENGE_PERIOD_PASSED || proof.challengePeriodPassed === true;
      if (!l1Finalized && !challengePassed) {
        const confs = Number(proof.confirmations || 0);
        if (confs < (this.challengePeriodBlocks || 0)) {
          return { ok: false, reason: `VF-XCH-006: ${this.environmentId} L1 not finalized, challenge period not passed` };
        }
      }
    }

    return {
      ok: true, finalized: true,
      blockHash: proof.blockHash || `0x${'0'.repeat(64)}`,
      blockHeight: Number(proof.blockNumber || 0),
      model: this.finalityModel,
    };
  }

  extractFacts(lockEventProof) {
    if (!lockEventProof || typeof lockEventProof !== 'object') {
      return { ok: false, reason: 'VF-XCH-011: EVM lock event proof missing' };
    }
    const ev = lockEventProof;
    const lockId = ev.lockId || ev.lock_id;
    const grossAmount = ev.grossAmount || ev.gross_amount;
    const feeAmount = ev.feeAmount || ev.fee_amount;
    const principalAmount = ev.principalAmount || ev.principal_amount;
    const durationSecs = ev.durationSecs || ev.duration_secs;
    const creationTimestamp = ev.blockTimestamp || ev.creation_time_secs || ev.valuation_timestamp;
    const maturityTimestamp = ev.maturityTimestamp || ev.maturity_timestamp;

    if (!lockId || grossAmount == null || feeAmount == null || principalAmount == null || durationSecs == null) {
      return { ok: false, reason: 'VF-XCH-011: EVM lock event missing required fields' };
    }

    return {
      ok: true,
      facts: {
        lockId: String(lockId),
        grossAmount: String(grossAmount),
        feeAmount: String(feeAmount),
        principalAmount: String(principalAmount),
        durationSecs: Number(durationSecs),
        creationTimestamp: Number(creationTimestamp || 0),
        maturityTimestamp: Number(maturityTimestamp || 0),
      },
    };
  }
}