// =============================================================================
// UTXO FAMILY CHAIN VERIFIER (Section O)
// Handles: Bitcoin, Litecoin, Dogecoin, DigiByte, Zcash, BitcoinCash
// Finality: block depth >= N confirmations (PoW)
//
// VF-XCH-006/010: Finality must be objective — PoW confirmation depth.
// Bitcoin=6 and Zcash=10 are defined in protocol constants.
// Litecoin, Dogecoin, DigiByte, BitcoinCash: exact N is DEFERRED EXTERNAL INPUT.
// =============================================================================

export class UtxoChainVerifier {
  constructor(environmentId, config) {
    this.environmentId = environmentId;
    this.minConfirmations = config.minConfirmations; // null = REQUIRES_EXTERNAL_INPUT
  }

  verifyFinality(lockEventProof, sourceFinalityProof) {
    if (!sourceFinalityProof || typeof sourceFinalityProof !== 'object') {
      return { ok: false, reason: `VF-XCH-006: ${this.environmentId} finality proof missing` };
    }
    const proof = sourceFinalityProof;
    const confirmations = Number(proof.confirmations || 0);

    if (this.minConfirmations === null) {
      // Exact confirmation depth not yet provisioned — DEFERRED EXTERNAL INPUT.
      // In simulation, accept at depth >= 6 (common standard), but flag as REQUIRES_EXTERNAL_INPUT.
      if (confirmations < 6) {
        return { ok: false, reason: `VF-XCH-006: ${this.environmentId} confirmations ${confirmations} < 6 (exact N REQUIRES_EXTERNAL_INPUT)` };
      }
      return {
        ok: true, finalized: true,
        blockHash: proof.blockHash || `0x${'0'.repeat(64)}`,
        blockHeight: Number(proof.blockHeight || 0),
        model: `depth>=N (accepted at ${confirmations}, exact N REQUIRES_EXTERNAL_INPUT)`,
        warning: 'REQUIRES_EXTERNAL_INPUT: exact confirmation depth not yet provisioned',
      };
    }

    if (confirmations < this.minConfirmations) {
      return { ok: false, reason: `VF-XCH-006: ${this.environmentId} confirmations ${confirmations} < ${this.minConfirmations}` };
    }

    return {
      ok: true, finalized: true,
      blockHash: proof.blockHash || `0x${'0'.repeat(64)}`,
      blockHeight: Number(proof.blockHeight || 0),
      model: `depth>=${this.minConfirmations}`,
    };
  }

  extractFacts(lockEventProof) {
    if (!lockEventProof || typeof lockEventProof !== 'object') {
      return { ok: false, reason: 'VF-XCH-011: UTXO lock event proof missing' };
    }
    const ev = lockEventProof;
    const lockId = ev.lock_id;
    const grossAmount = ev.gross_satoshis;
    const feeAmount = ev.fee_satoshis;
    const principalAmount = ev.principal_satoshis;
    const durationSecs = ev.duration_secs;
    const creationTimestamp = ev.lock_block_timestamp;
    const maturityTimestamp = ev.maturity_timestamp;

    if (!lockId || grossAmount == null || feeAmount == null || principalAmount == null || durationSecs == null) {
      return { ok: false, reason: 'VF-XCH-011: UTXO lock event missing required fields' };
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