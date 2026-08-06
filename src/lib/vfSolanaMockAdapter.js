// =============================================================================
// Solana Mock Adapter — Deterministic Simulation (Phase 1)
//
// PROVENANCE: Implementation Brief §4.7, §5.3, §7; Build Prompt §3.4/§4/§10.
//
// This adapter SIMULATES the Solana source-chain behavior. It makes NO network calls,
// performs NO wallet signing, and broadcasts NO transactions (Phase 1 boundary).
//
// Solana objective pending-attempt disposition (Implementation Brief §4.7):
//   "Solana: finalized success/failure, recent-blockhash expiry, or finalized durable-nonce
//   advancement."
//
// VF-COM-007/008: "elapsed time, mempool disappearance, endpoint non-observation, or an
// application timer alone must never clear a still-valid transaction."
//
// VF-COM-006: Solana is an account-model mechanism with atomic persistent per-identity state
// (PDAs) → three qualifying Handshakes per identity. Failed/reverted/invalid attempts consume
// NO allowance (VF-COM-008).
//
// VF-DEP-001: Dev Fund destination, canonical chain identifier, and deployed program address
// are DEFERRED EXTERNAL INPUT — not present in Revision 6 constants, must not be invented.
// =============================================================================

import { SOLANA_HANDSHAKE_ALLOWANCE, LOCK_STATES, ATTEMPT_STATES } from './vfRevision6Authority';

export class SolanaMockAdapter {
  constructor() {
    // Append-only event log (Implementation Brief §5.5: "Event store")
    this.events = [];
    // Attempt tracking: lockId → { identity, isHandshake, state }
    this.attempts = new Map();
    // VF-COM-006/007: per-identity Handshake usage count
    this.handshakeUsage = new Map();
    // VF-COM-007: per-identity pending attempt set (prevention)
    this.pendingByIdentity = new Map();
    // VF-TOK-002/003: cumulative lifetime issuance (supply state)
    this.supply = { vclmIssued: 0n, chonxIssued: 0n };
    // VF-DEP-001: DEFERRED EXTERNAL INPUT — not invented
    this.devFundDestination = null;
    this.canonicalChainIdentifier = null;
    this.programAddress = null;
  }

  _log(event) {
    this.events.push({ ...event, timestamp: new Date().toISOString() });
  }

  // VF-COM-006/007: Check allowance and prevention before submission.
  checkHandshakeEligibility(identity) {
    const used = this.handshakeUsage.get(identity) || 0;
    if (used >= SOLANA_HANDSHAKE_ALLOWANCE) {
      return { ok: false, reason: `VF-COM-007: identity has used all ${SOLANA_HANDSHAKE_ALLOWANCE} qualifying Handshakes` };
    }
    const pending = this.pendingByIdentity.get(identity);
    if (pending && pending.size > 0) {
      return { ok: false, reason: 'VF-COM-007: identity has an objectively pending attempt — refuse before broadcast' };
    }
    return { ok: true, remaining: SOLANA_HANDSHAKE_ALLOWANCE - used };
  }

  // Simulate source submission (creates OBJECTIVELY_PENDING attempt).
  // VF-COM-007: "The official application must refuse an additional Handshake before broadcast
  // while the identity is used or has an objectively pending attempt."
  submitSimulation({ lockId, identity, isHandshake }) {
    if (isHandshake) {
      const check = this.checkHandshakeEligibility(identity);
      if (!check.ok) {
        this._log({ type: 'SUBMISSION_PREVENTED', lockId, identity, reason: check.reason });
        return check;
      }
      // Register as pending (prevents duplicate official submission — VF-COM-007)
      if (!this.pendingByIdentity.has(identity)) this.pendingByIdentity.set(identity, new Set());
      this.pendingByIdentity.get(identity).add(lockId);
    }
    const attempt = { lockId, identity, isHandshake, state: ATTEMPT_STATES.OBJECTIVELY_PENDING };
    this.attempts.set(lockId, attempt);
    this._log({ type: 'SOURCE_SUBMITTED', lockId, identity, state: ATTEMPT_STATES.OBJECTIVELY_PENDING });
    return { ok: true, attemptId: lockId, state: ATTEMPT_STATES.OBJECTIVELY_PENDING };
  }

  // Clear pending (internal helper — never timer-based)
  _clearPending(attempt) {
    const set = this.pendingByIdentity.get(attempt.identity);
    if (set) set.delete(attempt.lockId);
  }

  // --- Solana objective disposition: 4 terminal paths (Implementation Brief §4.7) ---

  // Path 1: Finalized success → RECOGNIZED
  finalizeSuccess(lockId) {
    const attempt = this.attempts.get(lockId);
    if (!attempt || attempt.state !== ATTEMPT_STATES.OBJECTIVELY_PENDING) {
      return { ok: false, reason: 'no pending attempt for this lockId' };
    }
    attempt.state = ATTEMPT_STATES.RECOGNIZED;
    this._clearPending(attempt);
    // VF-COM-007: successful qualifying Handshake consumes allowance
    if (attempt.isHandshake) {
      this.handshakeUsage.set(attempt.identity, (this.handshakeUsage.get(attempt.identity) || 0) + 1);
    }
    this._log({ type: 'SOURCE_FINALIZED', lockId, disposition: 'FINALIZED_SUCCESS', state: ATTEMPT_STATES.RECOGNIZED });
    return { ok: true, state: ATTEMPT_STATES.RECOGNIZED, disposition: 'FINALIZED_SUCCESS' };
  }

  // Path 2: Finalized failure → NOT_RECOGNIZED (VF-COM-008: no allowance consumed)
  finalizeFailure(lockId) {
    const attempt = this.attempts.get(lockId);
    if (!attempt || attempt.state !== ATTEMPT_STATES.OBJECTIVELY_PENDING) {
      return { ok: false, reason: 'no pending attempt for this lockId' };
    }
    attempt.state = ATTEMPT_STATES.NOT_RECOGNIZED;
    this._clearPending(attempt);
    this._log({ type: 'SOURCE_FINALIZED', lockId, disposition: 'FINALIZED_FAILURE', state: ATTEMPT_STATES.NOT_RECOGNIZED });
    return { ok: true, state: ATTEMPT_STATES.NOT_RECOGNIZED, disposition: 'FINALIZED_FAILURE' };
  }

  // Path 3: Recent-blockhash expiry → NOT_RECOGNIZED (objective invalidation)
  expireRecentBlockhash(lockId) {
    const attempt = this.attempts.get(lockId);
    if (!attempt || attempt.state !== ATTEMPT_STATES.OBJECTIVELY_PENDING) {
      return { ok: false, reason: 'no pending attempt for this lockId' };
    }
    attempt.state = ATTEMPT_STATES.NOT_RECOGNIZED;
    this._clearPending(attempt);
    this._log({ type: 'SOURCE_INVALIDATED', lockId, disposition: 'RECENT_BLOCKHASH_EXPIRY', state: ATTEMPT_STATES.NOT_RECOGNIZED });
    return { ok: true, state: ATTEMPT_STATES.NOT_RECOGNIZED, disposition: 'RECENT_BLOCKHASH_EXPIRY' };
  }

  // Path 4: Durable-nonce advancement → NOT_RECOGNIZED (objective invalidation)
  advanceDurableNonce(lockId) {
    const attempt = this.attempts.get(lockId);
    if (!attempt || attempt.state !== ATTEMPT_STATES.OBJECTIVELY_PENDING) {
      return { ok: false, reason: 'no pending attempt for this lockId' };
    }
    attempt.state = ATTEMPT_STATES.NOT_RECOGNIZED;
    this._clearPending(attempt);
    this._log({ type: 'SOURCE_INVALIDATED', lockId, disposition: 'DURABLE_NONCE_ADVANCEMENT', state: ATTEMPT_STATES.NOT_RECOGNIZED });
    return { ok: true, state: ATTEMPT_STATES.NOT_RECOGNIZED, disposition: 'DURABLE_NONCE_ADVANCEMENT' };
  }

  // VF-COM-007/008: Check if an attempt is still objectively pending.
  // NOTE: This NEVER clears by elapsed time (VF-COM-007/008, Implementation Brief §4.7).
  isPending(lockId) {
    const attempt = this.attempts.get(lockId);
    return !!(attempt && attempt.state === ATTEMPT_STATES.OBJECTIVELY_PENDING);
  }

  // VF-XCH-013: "(source_environment, unique lock identifier) may authorize Base issuance only once."
  // VF-SEC-004: "The source Commitment Vault Lock identifier is consumed only after successful Base issuance."
  recordIssuance(lockId, outputToken, amount) {
    if (outputToken === 'VCLM') this.supply.vclmIssued += BigInt(amount);
    if (outputToken === 'CHONX') this.supply.chonxIssued += BigInt(amount);
    this._log({ type: 'ISSUANCE_RECORDED', lockId, outputToken, amount: amount.toString() });
  }

  // VF-PRI-002: "Commitment Vault principal may be released only once."
  recordRelease(lockId) {
    this._log({ type: 'PRINCIPAL_RELEASED', lockId });
  }

  // Reset for a fresh simulation run (does NOT clear supply state — lifetime is cumulative)
  reset() {
    this.events = [];
    this.attempts = new Map();
    this.handshakeUsage = new Map();
    this.pendingByIdentity = new Map();
  }
}