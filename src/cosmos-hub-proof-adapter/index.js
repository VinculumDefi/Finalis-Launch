/* global require, module, Buffer, process */
'use strict';
// cosmos-hub-proof-adapter — RED-TEAM / NON-PRODUCTION
// VF-XCH-011 normalizer + CometBFT finality gate + ICS-23 existence-proof skeleton +
// Cosmos Hub pending-attempt disposition (Master Spec Section 5.2.3).
// Plain Node.js, no dependencies. Uses node:crypto for SHA-256.

const crypto = require('crypto');

const SOURCE_ENVIRONMENT = 'cosmoshub-4';

// --- VF-XCH-011 required fields for a Commitment Vault Lock event ---
const REQUIRED_FACT_FIELDS = [
  'source_environment',
  'lock_id',
  'canonical_asset',
  'source_account',
  'gross_amount',
  'fee_amount',
  'principal_amount',
  'verified_gross_usd_micro',
  'duration_secs',
  'creation_time_secs',
  'maturity_time_secs',
  'base_recipient',
  'release_destination',
  'output_token',
  'fee_destination',
  'fee_transfer_evidence',
  'handshake_identity',
  'handshake_allowance_count',
  'chonx_activation_receipt',
];

/**
 * Normalize a raw Commitment Vault Lock event/state into the immutable-facts record (VF-XCH-011).
 * Returns { ok: boolean, facts?: object, errors?: string[] }.
 */
function normalizeLockEvent(raw) {
  const errors = [];
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['event is not an object'] };

  // 1. presence of every required field
  for (const f of REQUIRED_FACT_FIELDS) {
    if (raw[f] === undefined || raw[f] === null || raw[f] === '') {
      errors.push(`missing required field: ${f}`);
    }
  }
  // 2. source environment must be the canonical Hub id
  if (raw.source_environment && raw.source_environment !== SOURCE_ENVIRONMENT) {
    errors.push(`source_environment mismatch: expected ${SOURCE_ENVIRONMENT}, got ${raw.source_environment}`);
  }
  // 3. handshake_identity must equal (source_environment, source_account) for an account-model mechanism (VF-COM-005)
  if (raw.handshake_identity && raw.source_account) {
    const expected = `(${raw.source_environment || SOURCE_ENVIRONMENT}, ${raw.source_account})`;
    if (raw.handshake_identity !== expected) {
      errors.push(`handshake_identity mismatch: expected ${expected}, got ${raw.handshake_identity}`);
    }
  }
  // 4. fee + principal consistency (principal = gross - fee)
  if (raw.gross_amount != null && raw.fee_amount != null && raw.principal_amount != null) {
    if (BigInt(raw.gross_amount) - BigInt(raw.fee_amount) !== BigInt(raw.principal_amount)) {
      errors.push('principal != gross - fee');
    }
    if (BigInt(raw.fee_amount) === 0n || BigInt(raw.principal_amount) === 0n) {
      errors.push('zero fee or zero principal (VF-COM-013)');
    }
  }
  // 5. output token
  if (raw.output_token && !['VCLM', 'CHONX'].includes(String(raw.output_token).toUpperCase())) {
    errors.push(`invalid output_token: ${raw.output_token}`);
  }
  // 6. CHONX requires a valid causal activation receipt at creation (VF-COM-025). The contract emits
  //    chonx_activation_receipt as a STRING: a non-empty receipt for CHONX, or "not_applicable" for
  //    VCLM. A genuine contract event must pass the normalizer unchanged (defect 6).
  if (String(raw.output_token).toUpperCase() === 'CHONX') {
    const r = String(raw.chonx_activation_receipt);
    if (r === '' || r === 'not_applicable') {
      errors.push('CHONX selected without a valid activation receipt at creation (VF-COM-025)');
    }
  }
  // 7. fee routed to the fixed destination (VF-FEE-001/006)
  if (raw.fee_destination && raw.fee_transfer_evidence && raw.fee_destination !== raw.fee_transfer_evidence) {
    errors.push('fee_destination != fee_transfer_evidence destination');
  }

  if (errors.length) return { ok: false, errors };
  const facts = {};
  for (const f of REQUIRED_FACT_FIELDS) facts[f] = raw[f];
  return { ok: true, facts };
}

// --- CometBFT finality gate (VF-XCH-006) ---
/**
 * Authorize issuance only if the block is finalized (CometBFT commit).
 * blockMeta: { finalized: boolean, height, hash, ... }
 */
function finalityGate(blockMeta) {
  if (!blockMeta || typeof blockMeta !== 'object') return { ok: false, reason: 'no block meta' };
  if (blockMeta.finalized !== true) return { ok: false, reason: 'block not finalized (VF-XCH-006/010)' };
  return { ok: true, height: blockMeta.height, hash: blockMeta.hash };
}

// --- ICS-23 existence proof skeleton ---
// ExistenceProof: { leaf: { key, value, prefix, hashOp ('SHA256') }, path: [{ prefix, suffix, hashOp }] }
// Recompute: leafHash = SHA256(prefix || hashedKey || hashedValue) (simplified), then fold inner ops.
function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest();
}
function concat(...bufs) {
  return Buffer.concat(bufs);
}
/**
 * Verify an ICS-23 existence proof against the committed AppHash.
 * Returns { ok: boolean, rootHex?: string, reason?: string }.
 */
function verifyExistence(proof, appHash, expectedKey, expectedValue) {
  if (!proof || !proof.leaf) return { ok: false, reason: 'no leaf in proof' };
  const leaf = proof.leaf;
  if (!leaf.key || !leaf.value) return { ok: false, reason: 'leaf missing key/value' };
  const keyBuf = Buffer.from(leaf.key);
  const valueBuf = Buffer.from(leaf.value);
  if (expectedKey !== undefined && !keyBuf.equals(Buffer.from(expectedKey))) {
    return { ok: false, reason: 'proof key != expected key' };
  }
  if (expectedValue !== undefined && !valueBuf.equals(Buffer.from(expectedValue))) {
    return { ok: false, reason: 'proof value != expected value (tampered)' };
  }
  const prefix = leaf.prefix ? Buffer.from(leaf.prefix) : Buffer.alloc(0);
  // simplified leaf hash: SHA256(prefix || SHA256(key) || SHA256(value))
  let hash = sha256(concat(prefix, sha256(keyBuf), sha256(valueBuf)));
  const path = proof.path || [];
  for (const inner of path) {
    const p = inner.prefix ? Buffer.from(inner.prefix) : Buffer.alloc(0);
    const s = inner.suffix ? Buffer.from(inner.suffix) : Buffer.alloc(0);
    hash = sha256(concat(p, hash, s));
  }
  const rootHex = hash.toString('hex');
  const appHashHex = Buffer.isBuffer(appHash) ? appHash.toString('hex') : String(appHash);
  if (rootHex !== appHashHex) return { ok: false, reason: `root mismatch: ${rootHex} != ${appHashHex}` };
  return { ok: true, rootHex };
}

// --- Cosmos Hub pending-attempt disposition (Section 5.2.3) ---
const PENDING_STATE = {
  PENDING: 'PENDING',
  FINALIZED_SUCCESS: 'FINALIZED_SUCCESS',
  FINALIZED_FAILURE: 'FINALIZED_FAILURE',
  INVALIDATED_BY_SEQUENCE: 'INVALIDATED_BY_SEQUENCE',
  INVALIDATED_BY_EXPIRY: 'INVALIDATED_BY_EXPIRY',
};

/**
 * State machine for a single broadcast Handshake attempt by a bound identity.
 * Elapsed time / mempool disappearance / app-local timers NEVER clear a still-valid attempt.
 * Terminal disposition: finalized success/failure, or objective invalidation (sequence consumption
 * or a genuine finite chain-native validity bound, if documented).
 */
class PendingAttempt {
  constructor({ identity, lockId, accountSequence, broadcastTime }) {
    this.identity = identity;
    this.lockId = lockId;
    this.accountSequence = accountSequence;
    this.broadcastTime = broadcastTime;
    this.state = PENDING_STATE.PENDING;
    this.terminatedAt = null;
  }
  isStillPending() { return this.state === PENDING_STATE.PENDING; }
  // The following mark terminal dispositions; they do NOT rely on time/mempool.
  markFinalizedSuccess() { if (this.state === PENDING_STATE.PENDING) { this.state = PENDING_STATE.FINALIZED_SUCCESS; this.terminatedAt = Date.now(); } }
  markFinalizedFailure() { if (this.state === PENDING_STATE.PENDING) { this.state = PENDING_STATE.FINALIZED_FAILURE; this.terminatedAt = Date.now(); } }
  // Objective invalidation: a finalized conflicting transaction consumed the same account sequence.
  markSequenceConsumed() { if (this.state === PENDING_STATE.PENDING) { this.state = PENDING_STATE.INVALIDATED_BY_SEQUENCE; this.terminatedAt = Date.now(); } }
  // Objective invalidation: a genuine finite chain-native validity bound expired (only if documented).
  markExpired(validityBoundSeconds) {
    if (typeof validityBoundSeconds !== 'number' || !isFinite(validityBoundSeconds)) {
      throw new Error('expiry requires a genuine finite chain-native validity bound (C5); elapsed time is not objective invalidation (Section 5.2.3)');
    }
    if (this.state === PENDING_STATE.PENDING) { this.state = PENDING_STATE.INVALIDATED_BY_EXPIRY; this.terminatedAt = Date.now(); }
  }
  // Elapsed time NEVER clears. This always returns false.
  clearByElapsedSeconds() { return false; }
}

/**
 * Tracks pending attempts per identity to prevent a second official submission while an attempt is
 * objectively pending (Section 5.2.3: "Before authorizing another official submission, the
 * application must recheck objective source-chain disposition and Base recognition state.").
 */
class PendingRegistry {
  constructor() { this.attempts = new Map(); /* key: identity -> Map(lockId -> PendingAttempt) */ }
  _bucket(identity) { if (!this.attempts.has(identity)) this.attempts.set(identity, new Map()); return this.attempts.get(identity); }
  hasPending(identity) { const b = this._bucket(identity); for (const a of b.values()) if (a.isStillPending()) return true; return false; }
  register(a) { this._bucket(a.identity).set(a.lockId, a); }
  get(identity, lockId) { return this._bucket(identity).get(lockId); }
}

module.exports = {
  SOURCE_ENVIRONMENT,
  REQUIRED_FACT_FIELDS,
  normalizeLockEvent,
  finalityGate,
  verifyExistence,
  sha256,
  PendingAttempt,
  PendingRegistry,
  PENDING_STATE,
};