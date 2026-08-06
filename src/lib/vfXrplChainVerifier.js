// =============================================================================
// XRPL CHAIN VERIFIER (Section O)
// Finality: validated ledger (transaction in a closed+validated ledger)
//
// VF-XCH-006/010: Finality must be objective — ledger must be validated.
// VF-XCH-011: Facts extracted from EscrowCreate + Payment memo.
// =============================================================================

export class XrplChainVerifier {
  constructor() {
    this.environmentId = 'XRPL';
    this.finalityModel = 'validated ledger';
  }

  verifyFinality(lockEventProof, sourceFinalityProof) {
    if (!sourceFinalityProof || typeof sourceFinalityProof !== 'object') {
      return { ok: false, reason: 'VF-XCH-006: XRPL finality proof missing' };
    }
    const proof = sourceFinalityProof;

    // VF-XCH-010: Finality must be objective — ledger must be validated
    if (!proof.validated) {
      return { ok: false, reason: 'VF-XCH-006: XRPL ledger not validated' };
    }
    if (proof.ledgerIndex == null) {
      return { ok: false, reason: 'VF-XCH-006: XRPL finality proof missing ledgerIndex' };
    }

    return {
      ok: true, finalized: true,
      blockHash: proof.ledgerHash || `0x${'0'.repeat(64)}`,
      blockHeight: Number(proof.ledgerIndex),
      model: this.finalityModel,
    };
  }

  extractFacts(lockEventProof) {
    if (!lockEventProof || typeof lockEventProof !== 'object') {
      return { ok: false, reason: 'VF-XCH-011: XRPL lock event proof missing' };
    }

    // lockEventProof = { escrow, payment } from the normalizer
    const escrow = lockEventProof.escrow || lockEventProof;
    const payment = lockEventProof.payment || {};

    // Parse memo for metadata (lock_id, etc.)
    let metadata = {};
    const memo = escrow.Memos?.[0]?.Memo;
    if (memo?.MemoData) {
      try {
        const hex = memo.MemoData;
        const json = hex.match(/.{1,2}/g).map((b) => String.fromCharCode(parseInt(b, 16))).join('');
        metadata = JSON.parse(json);
      } catch { /* memo not JSON */ }
    }

    const lockId = metadata.lock_id || (escrow.Account + ':' + escrow.Sequence);
    const feeAmount = payment.Amount;

    if (!lockId || escrow.Amount == null || feeAmount == null) {
      return { ok: false, reason: 'VF-XCH-011: XRPL lock event missing required fields' };
    }

    // XRPL: EscrowCreate locks the principal; fee paid separately via Payment.
    // Protocol gross = principal + fee.
    const principal = BigInt(String(escrow.Amount));
    const fee = BigInt(String(feeAmount));
    const grossAmount = principal + fee;
    const durationSecs = Number(escrow.FinishAfter || 0) - Number(escrow.date || 0);

    return {
      ok: true,
      facts: {
        lockId: String(lockId),
        grossAmount: String(grossAmount),
        feeAmount: String(feeAmount),
        principalAmount: String(principal),
        durationSecs,
        creationTimestamp: Number(escrow.date || 0),
        maturityTimestamp: Number(escrow.FinishAfter || 0),
      },
    };
  }
}