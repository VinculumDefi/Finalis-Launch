// =============================================================================
// STELLAR CHAIN VERIFIER (Section O)
// Finality: SCP closed (transaction in a ledger closed by SCP consensus)
//
// VF-XCH-006/010: Finality must be objective — ledger must be SCP-closed.
// VF-XCH-011: Facts extracted independently from ClaimableBalance + Payment.
// =============================================================================

export class StellarChainVerifier {
  constructor() {
    this.environmentId = 'Stellar';
    this.finalityModel = 'SCP closed';
  }

  verifyFinality(lockEventProof, sourceFinalityProof) {
    if (!sourceFinalityProof || typeof sourceFinalityProof !== 'object') {
      return { ok: false, reason: 'VF-XCH-006: Stellar finality proof missing' };
    }
    const proof = sourceFinalityProof;

    // VF-XCH-010: Finality must be objective — ledger must be SCP-closed
    if (!proof.closed) {
      return { ok: false, reason: 'VF-XCH-006: Stellar ledger not SCP-closed' };
    }
    if (proof.ledgerSequence == null) {
      return { ok: false, reason: 'VF-XCH-006: Stellar finality proof missing ledgerSequence' };
    }

    return {
      ok: true, finalized: true,
      blockHash: proof.ledgerHash || `0x${'0'.repeat(64)}`,
      blockHeight: Number(proof.ledgerSequence),
      model: this.finalityModel,
    };
  }

  extractFacts(lockEventProof) {
    if (!lockEventProof || typeof lockEventProof !== 'object') {
      return { ok: false, reason: 'VF-XCH-011: Stellar lock event proof missing' };
    }
    const ev = lockEventProof;
    const lockId = ev.lock_id;
    const grossAmount = ev.gross_stroops;
    const feeAmount = ev.fee_stroops;
    const principalAmount = ev.principal_stroops;
    const durationSecs = ev.duration_secs;
    const creationTimestamp = ev.lock_ledger_timestamp;
    const maturityTimestamp = ev.maturity_timestamp;

    if (!lockId || grossAmount == null || feeAmount == null || principalAmount == null || durationSecs == null) {
      return { ok: false, reason: 'VF-XCH-011: Stellar lock event missing required fields' };
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