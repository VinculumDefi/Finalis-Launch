// =============================================================================
// PENDING ATTEMPT LIFECYCLE ENGINE
//
// PROVENANCE: Built directly from Revision 6 authoritative documents:
//   - vfRevision6Authority.js: ATTEMPT_STATES, SOLANA_DISPOSITION, LOCK_STATES
//   - Vinculum_Finalis_Architecture_Design.md §4.7 (Objective pending-attempt disposition)
//   - VF-COM-007/008: objective pending-attempt disposition (Revision 6 numbering. Revision 12 superseded the Handshake allowance parts of
//     VF-COM-005..008; the pending-attempt disposition rule still applies.)
//
// STATE MACHINE (ATTEMPT_STATES from vfRevision6Authority):
//   ELIGIBLE → OBJECTIVELY_PENDING → RECOGNIZED       (finality achieved, verifier consumed)
//                                → NOT_RECOGNIZED    (objective terminal disposition: failed)
//
// CARDINAL RULE (VF-COM-007/008):
//   Only objective chain-native terminal dispositions clear a pending attempt.
//   Elapsed time, mempool disappearance, non-observation, and application
//   timers NEVER clear a still-valid pending attempt.
//
// Revision 12: the Handshake has no allowance limit and no Handshake identity.
// The lifecycle labels each attempt with its source account for display only;
// it never refuses an attempt because the same account has another attempt
// pending or finished. Only a chain-native terminal event (finalized success,
// finalized failure, or Solana-specific blockhash/nonce expiry) moves an
// attempt out of the pending state.
// =============================================================================

import { ATTEMPT_STATES, SOLANA_DISPOSITION } from './vfRevision6Authority.js';
import { findEnvironment } from './vfBaseRegistry.js';

// ---------------------------------------------------------------------------
// Terminal dispositions per environment family.
// Only chain-native objective evidence constitutes a terminal disposition.
// Solana's 4 dispositions are explicitly enumerated in the governing constants
// (SOLANA_DISPOSITION). Other families use the two generic chain-native
// terminal states. No disposition is invented beyond the governing source.
// ---------------------------------------------------------------------------

export const TERMINAL_DISPOSITIONS = {
  'EVM':     [SOLANA_DISPOSITION.FINALIZED_SUCCESS, SOLANA_DISPOSITION.FINALIZED_FAILURE],
  'Non-EVM': [
    SOLANA_DISPOSITION.FINALIZED_SUCCESS,
    SOLANA_DISPOSITION.FINALIZED_FAILURE,
    SOLANA_DISPOSITION.RECENT_BLOCKHASH_EXPIRY,
    SOLANA_DISPOSITION.DURABLE_NONCE_ADVANCEMENT,
  ],
  'UTXO':    [SOLANA_DISPOSITION.FINALIZED_SUCCESS, SOLANA_DISPOSITION.FINALIZED_FAILURE],
  'XRPL':    [SOLANA_DISPOSITION.FINALIZED_SUCCESS, SOLANA_DISPOSITION.FINALIZED_FAILURE],
  'Stellar': [SOLANA_DISPOSITION.FINALIZED_SUCCESS, SOLANA_DISPOSITION.FINALIZED_FAILURE],
  'CometBFT': [], // EVIDENCE_REQUIRED — no dispositions defined
};

const FAILURE_DISPOSITIONS = new Set([
  SOLANA_DISPOSITION.FINALIZED_FAILURE,
  SOLANA_DISPOSITION.RECENT_BLOCKHASH_EXPIRY,
  SOLANA_DISPOSITION.DURABLE_NONCE_ADVANCEMENT,
]);

export function getTerminalDispositions(family) {
  return TERMINAL_DISPOSITIONS[family] || [];
}

export function isSuccessDisposition(disposition) {
  return disposition === SOLANA_DISPOSITION.FINALIZED_SUCCESS;
}

// ---------------------------------------------------------------------------
// PendingAttemptLifecycle — the in-flight attempt tracker.
// In the Solidity contract this would be a storage mapping; here it is a Map.
// ---------------------------------------------------------------------------

export class PendingAttemptLifecycle {
  constructor() {
    // lockId → attempt record
    this.attempts = new Map();
    // sourceIdentity → Set<lockId> of pending attempts (query only, never a block)
    this.pendingIdentities = new Map();
  }

  reset() {
    this.attempts.clear();
    this.pendingIdentities.clear();
  }

  // -------------------------------------------------------------------------
  // Register a new pending attempt (ELIGIBLE → OBJECTIVELY_PENDING).
  // Revision 12: any number of attempts per source account, pending or not.
  // -------------------------------------------------------------------------

  registerAttempt(environmentId, sourceIdentity, lockId, submissionTimestamp) {
    const env = findEnvironment(environmentId);
    if (!env) {
      return { ok: false, reason: `VF-XCH-001: unknown environment "${environmentId}"` };
    }
    if (env.verificationStatus === 'EVIDENCE_REQUIRED') {
      return { ok: false, reason: `VF-ARC-002: environment "${environmentId}" mechanism incomplete` };
    }
    if (this.attempts.has(lockId)) {
      return { ok: false, reason: `VF-XCH-013: lockId "${lockId}" already registered` };
    }

    const attempt = {
      lockId,
      environmentId,
      environmentFamily: env.family,
      sourceIdentity,
      state: ATTEMPT_STATES.OBJECTIVELY_PENDING,
      submissionTimestamp: submissionTimestamp || Date.now(),
      terminalDisposition: null,
      resolvedTimestamp: null,
    };

    this.attempts.set(lockId, attempt);
    if (!this.pendingIdentities.has(sourceIdentity)) {
      this.pendingIdentities.set(sourceIdentity, new Set());
    }
    this.pendingIdentities.get(sourceIdentity).add(lockId);

    return { ok: true, attempt };
  }

  // -------------------------------------------------------------------------
  // Query: does this source account have a pending attempt? (display only)
  // -------------------------------------------------------------------------

  isIdentityPending(sourceIdentity) {
    const pending = this.pendingIdentities.get(sourceIdentity);
    if (!pending) return false;
    for (const lockId of pending) {
      const attempt = this.attempts.get(lockId);
      if (attempt && attempt.state === ATTEMPT_STATES.OBJECTIVELY_PENDING) {
        return true;
      }
    }
    return false;
  }

  // -------------------------------------------------------------------------
  // Confirm a pending attempt → RECOGNIZED (finality achieved).
  // Only called after the verifier has successfully consumed the proof.
  // -------------------------------------------------------------------------

  confirmAttempt(lockId) {
    const attempt = this.attempts.get(lockId);
    if (!attempt) {
      return { ok: false, reason: `unknown lockId "${lockId}"` };
    }
    if (attempt.state !== ATTEMPT_STATES.OBJECTIVELY_PENDING) {
      return { ok: false, reason: `attempt is ${attempt.state}, not OBJECTIVELY_PENDING` };
    }
    attempt.state = ATTEMPT_STATES.RECOGNIZED;
    attempt.terminalDisposition = SOLANA_DISPOSITION.FINALIZED_SUCCESS;
    attempt.resolvedTimestamp = Date.now();
    this._cleanupPending(attempt.sourceIdentity, lockId);
    return { ok: true, attempt };
  }

  // -------------------------------------------------------------------------
  // Resolve a pending attempt as failed → NOT_RECOGNIZED.
  // Only valid chain-native terminal dispositions are accepted (VF-COM-007/008).
  // -------------------------------------------------------------------------

  resolveFailedAttempt(lockId, disposition) {
    const attempt = this.attempts.get(lockId);
    if (!attempt) {
      return { ok: false, reason: `unknown lockId "${lockId}"` };
    }
    if (attempt.state !== ATTEMPT_STATES.OBJECTIVELY_PENDING) {
      return { ok: false, reason: `attempt is ${attempt.state}, not OBJECTIVELY_PENDING` };
    }

    const valid = getTerminalDispositions(attempt.environmentFamily);
    if (!valid.includes(disposition)) {
      return {
        ok: false,
        reason: `invalid terminal disposition "${disposition}" for ${attempt.environmentFamily} family — only chain-native evidence clears a pending attempt (VF-COM-007/008)`,
      };
    }
    if (isSuccessDisposition(disposition)) {
      return { ok: false, reason: 'use confirmAttempt() for FINALIZED_SUCCESS' };
    }

    attempt.state = ATTEMPT_STATES.NOT_RECOGNIZED;
    attempt.terminalDisposition = disposition;
    attempt.resolvedTimestamp = Date.now();
    this._cleanupPending(attempt.sourceIdentity, lockId);
    return { ok: true, attempt };
  }

  _cleanupPending(sourceIdentity, lockId) {
    const pending = this.pendingIdentities.get(sourceIdentity);
    if (pending) {
      pending.delete(lockId);
      if (pending.size === 0) {
        this.pendingIdentities.delete(sourceIdentity);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  getAttempt(lockId) {
    return this.attempts.get(lockId) || null;
  }

  getPendingAttempts() {
    return Array.from(this.attempts.values()).filter(
      (a) => a.state === ATTEMPT_STATES.OBJECTIVELY_PENDING,
    );
  }

  getResolvedAttempts() {
    return Array.from(this.attempts.values()).filter(
      (a) => a.state !== ATTEMPT_STATES.OBJECTIVELY_PENDING,
    );
  }

  getStats() {
    let pending = 0, recognized = 0, notRecognized = 0;
    for (const attempt of this.attempts.values()) {
      if (attempt.state === ATTEMPT_STATES.OBJECTIVELY_PENDING) pending++;
      else if (attempt.state === ATTEMPT_STATES.RECOGNIZED) recognized++;
      else if (attempt.state === ATTEMPT_STATES.NOT_RECOGNIZED) notRecognized++;
    }
    return { total: this.attempts.size, pending, recognized, notRecognized };
  }
}