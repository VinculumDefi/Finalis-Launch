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
// Revision 12: the Handshake (1 hour, $0.01 to $0.02, 5% fee) has no allowance
// limit. There is no per-identity usage counter and no per-identity refusal;
// one account may have any number of Handshakes, pending or finished.
//
// VF-DEP-001: Dev Fund destination, canonical chain identifier, and deployed program address
// are DEFERRED EXTERNAL INPUT — not present in Revision 6 constants, must not be invented.
// =============================================================================

import { LOCK_STATES, ATTEMPT_STATES } from './vfSpecAuthority.js';
import { SOLANA_LOCKS_ENABLED, SOLANA_NOT_DEPLOYED_MESSAGE } from './vfDeploymentScope.js';

export class SolanaMockAdapter {
  constructor() {
    // Append-only event log (Implementation Brief §5.5: "Event store")
    this.events = [];
    // Attempt tracking: lockId → { identity, isHandshake, state }
    this.attempts = new Map();
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

  // Simulate source submission (creates OBJECTIVELY_PENDING attempt).
  // Revision 12: a Handshake is never refused for the account's earlier or pending Handshakes.
  submitSimulation({ lockId, identity, isHandshake }) {
    // Solana is not part of this deployment: nothing is submitted (fail closed).
    if (!SOLANA_LOCKS_ENABLED) {
      this._log({ type: 'SUBMISSION_PREVENTED', lockId, identity, reason: SOLANA_NOT_DEPLOYED_MESSAGE });
      return { ok: false, reason: SOLANA_NOT_DEPLOYED_MESSAGE };
    }
    const attempt = { lockId, identity, isHandshake, state: ATTEMPT_STATES.OBJECTIVELY_PENDING };
    this.attempts.set(lockId, attempt);
    this._log({ type: 'SOURCE_SUBMITTED', lockId, identity, state: ATTEMPT_STATES.OBJECTIVELY_PENDING });
    return { ok: true, attemptId: lockId, state: ATTEMPT_STATES.OBJECTIVELY_PENDING };
  }

  // --- Solana objective disposition: 4 terminal paths (Implementation Brief §4.7) ---

  // Path 1: Finalized success → RECOGNIZED
  finalizeSuccess(lockId) {
    const attempt = this.attempts.get(lockId);
    if (!attempt || attempt.state !== ATTEMPT_STATES.OBJECTIVELY_PENDING) {
      return { ok: false, reason: 'no pending attempt for this lockId' };
    }
    attempt.state = ATTEMPT_STATES.RECOGNIZED;
    this._log({ type: 'SOURCE_FINALIZED', lockId, disposition: 'FINALIZED_SUCCESS', state: ATTEMPT_STATES.RECOGNIZED });
    return { ok: true, state: ATTEMPT_STATES.RECOGNIZED, disposition: 'FINALIZED_SUCCESS' };
  }

  // Path 2: Finalized failure → NOT_RECOGNIZED
  finalizeFailure(lockId) {
    const attempt = this.attempts.get(lockId);
    if (!attempt || attempt.state !== ATTEMPT_STATES.OBJECTIVELY_PENDING) {
      return { ok: false, reason: 'no pending attempt for this lockId' };
    }
    attempt.state = ATTEMPT_STATES.NOT_RECOGNIZED;
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
  }
}