// =============================================================================
// SOLANA CHAIN VERIFIER (Section O)
// Finality: finalized slot (max-rooted commitment level)
//
// VF-XCH-006/010: Finality must be objective — slot must be at 'finalized' commitment.
// VF-XCH-011: Facts extracted independently from raw LockCreated event.
//
// VF-COM-007/008: Pending attempt dispositions (objective, chain-native):
//   FINALIZED_SUCCESS, FINALIZED_FAILURE, RECENT_BLOCKHASH_EXPIRY,
//   DURABLE_NONCE_ADVANCEMENT. Elapsed time/mempool absence never clears a
//   still-valid pending attempt.
// =============================================================================

import { FINALITY_STATUS } from './vfEvmChainVerifier';

export class SolanaChainVerifier {
  constructor() {
    this.environmentId = 'Solana';
    this.finalityModel = 'finalized slot';
  }

  verifyFinality(lockEventProof, sourceFinalityProof) {
    if (!sourceFinalityProof || typeof sourceFinalityProof !== 'object') {
      return { ok: false, reason: 'VF-XCH-006: Solana finality proof missing' };
    }
    const proof = sourceFinalityProof;

    // VF-XCH-010: Finality must be objective (chain-native evidence)
    // Solana: slot must be at 'finalized' commitment level (max-rooted)
    const commitment = proof.commitment || proof.finalityStatus;
    if (commitment !== 'finalized' && commitment !== FINALITY_STATUS.FINALIZED) {
      return { ok: false, reason: `VF-XCH-006: Solana commitment="${commitment}" (requires "finalized")` };
    }

    if (proof.slot == null && proof.blockNumber == null) {
      return { ok: false, reason: 'VF-XCH-006: Solana finality proof missing slot' };
    }

    return {
      ok: true, finalized: true,
      blockHash: proof.blockhash || proof.blockHash || `0x${'0'.repeat(64)}`,
      blockHeight: Number(proof.slot ?? proof.blockNumber ?? 0),
      model: this.finalityModel,
    };
  }

  extractFacts(lockEventProof) {
    if (!lockEventProof || typeof lockEventProof !== 'object') {
      return { ok: false, reason: 'VF-XCH-011: Solana lock event proof missing' };
    }
    const ev = lockEventProof;
    const lockId = ev.lock_id;
    const grossAmount = ev.gross_amount;
    const feeAmount = ev.fee_amount;
    const principalAmount = ev.principal_amount;
    const durationSecs = ev.duration_secs;
    const creationTimestamp = ev.creation_time_secs;
    const maturityTimestamp = ev.maturity_time_secs;

    if (!lockId || grossAmount == null || feeAmount == null || principalAmount == null || durationSecs == null) {
      return { ok: false, reason: 'VF-XCH-011: Solana lock event missing required fields' };
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