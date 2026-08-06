// Faithful ESM browser port of the existing dependency-free proof adapter at
// src/cosmos-hub-proof-adapter/index.js (RED-TEAM / NON-PRODUCTION).
// Normalizes a Commitment Vault Lock event into the immutable-facts record (VF-XCH-011),
// gates on CometBFT finality, and verifies an ICS-23 existence proof against the AppHash.
// No fabrication: every function operates on the inputs it is given.

const SOURCE_ENVIRONMENT = 'cosmoshub-4';

export const REQUIRED_FACT_FIELDS = [
  'source_environment', 'lock_id', 'canonical_asset', 'source_account',
  'gross_amount', 'fee_amount', 'principal_amount', 'verified_gross_usd_micro',
  'duration_secs', 'creation_time_secs', 'maturity_time_secs', 'base_recipient',
  'release_destination', 'output_token', 'fee_destination', 'fee_transfer_evidence',
  'handshake_identity', 'handshake_allowance_count', 'chonx_activation_receipt',
];

export const PENDING_STATE = {
  PENDING: 'PENDING',
  FINALIZED_SUCCESS: 'FINALIZED_SUCCESS',
  FINALIZED_FAILURE: 'FINALIZED_FAILURE',
  INVALIDATED_BY_SEQUENCE: 'INVALIDATED_BY_SEQUENCE',
  INVALIDATED_BY_EXPIRY: 'INVALIDATED_BY_EXPIRY',
};

// Pure normalization — no crypto, identical logic to the original adapter.
export function normalizeLockEvent(raw) {
  const errors = [];
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['event is not an object'] };
  for (const f of REQUIRED_FACT_FIELDS) {
    if (raw[f] === undefined || raw[f] === null || raw[f] === '') {
      errors.push(`missing required field: ${f}`);
    }
  }
  if (raw.source_environment && raw.source_environment !== SOURCE_ENVIRONMENT) {
    errors.push(`source_environment mismatch: expected ${SOURCE_ENVIRONMENT}, got ${raw.source_environment}`);
  }
  if (raw.handshake_identity && raw.source_account) {
    const expected = `(${raw.source_environment || SOURCE_ENVIRONMENT}, ${raw.source_account})`;
    if (raw.handshake_identity !== expected) {
      errors.push(`handshake_identity mismatch: expected ${expected}, got ${raw.handshake_identity}`);
    }
  }
  if (raw.gross_amount != null && raw.fee_amount != null && raw.principal_amount != null) {
    try {
      if (BigInt(raw.gross_amount) - BigInt(raw.fee_amount) !== BigInt(raw.principal_amount)) {
        errors.push('principal != gross - fee');
      }
      if (BigInt(raw.fee_amount) === 0n || BigInt(raw.principal_amount) === 0n) {
        errors.push('zero fee or principal (VF-COM-013)');
      }
    } catch { errors.push('non-integer amount field'); }
  }
  if (raw.output_token && !['VCLM', 'CHONX'].includes(String(raw.output_token).toUpperCase())) {
    errors.push(`invalid output_token: ${raw.output_token}`);
  }
  if (String(raw.output_token).toUpperCase() === 'CHONX') {
    const r = String(raw.chonx_activation_receipt);
    if (r === '' || r === 'not_applicable') {
      errors.push('CHONX selected without a valid activation receipt at creation (VF-COM-025)');
    }
  }
  if (raw.fee_destination && raw.fee_transfer_evidence && raw.fee_destination !== raw.fee_transfer_evidence) {
    errors.push('fee_destination != fee_transfer_evidence destination');
  }
  if (errors.length) return { ok: false, errors };
  const facts = {};
  for (const f of REQUIRED_FACT_FIELDS) facts[f] = raw[f];
  return { ok: true, facts };
}

export function finalityGate(blockMeta) {
  if (!blockMeta || typeof blockMeta !== 'object') return { ok: false, reason: 'no block meta' };
  if (blockMeta.finalized !== true) return { ok: false, reason: 'block not finalized (VF-XCH-006/010)' };
  return { ok: true, height: blockMeta.height, hash: blockMeta.hash };
}

// SHA-256 via the platform Web Crypto API (async). Mirrors node:crypto createHash('sha256').
export async function sha256(buf) {
  const subtle = globalThis.crypto && globalThis.crypto.subtle;
  if (!subtle) throw new Error('Web Crypto subtle not available in this environment');
  const ab = await subtle.digest('SHA-256', buf);
  return new Uint8Array(ab);
}

function concat(...bufs) {
  const out = new Uint8Array(bufs.reduce((n, b) => n + b.length, 0));
  let o = 0;
  for (const b of bufs) { out.set(b, o); o += b.length; }
  return out;
}
function toHex(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i++) s += u8[i].toString(16).padStart(2, '0');
  return s;
}

// ICS-23 existence proof verification — same algorithm as the original adapter (async sha256).
export async function verifyExistence(proof, appHash, expectedKey, expectedValue) {
  if (!proof || !proof.leaf) return { ok: false, reason: 'no leaf in proof' };
  const leaf = proof.leaf;
  if (!leaf.key || !leaf.value) return { ok: false, reason: 'leaf missing key/value' };
  const toU8 = (v) => v instanceof Uint8Array ? v : new TextEncoder().encode(String(v));
  const keyBuf = toU8(leaf.key);
  const valueBuf = toU8(leaf.value);
  if (expectedKey !== undefined && !keyBuf.equals(toU8(expectedKey))) {
    return { ok: false, reason: 'proof key != expected key' };
  }
  if (expectedValue !== undefined && !valueBuf.equals(toU8(expectedValue))) {
    return { ok: false, reason: 'proof value != expected value (tampered)' };
  }
  const prefix = leaf.prefix ? toU8(leaf.prefix) : new Uint8Array(0);
  let hash = await sha256(concat(prefix, await sha256(keyBuf), await sha256(valueBuf)));
  for (const inner of (proof.path || [])) {
    const p = inner.prefix ? toU8(inner.prefix) : new Uint8Array(0);
    const s = inner.suffix ? toU8(inner.suffix) : new Uint8Array(0);
    hash = await sha256(concat(p, hash, s));
  }
  const rootHex = toHex(hash);
  const appHashHex = appHash instanceof Uint8Array ? toHex(appHash) : String(appHash);
  if (rootHex !== appHashHex) return { ok: false, reason: `root mismatch: ${rootHex} != ${appHashHex}` };
  return { ok: true, rootHex };
}

export class PendingAttempt {
  constructor({ identity, lockId, accountSequence, broadcastTime }) {
    this.identity = identity; this.lockId = lockId;
    this.accountSequence = accountSequence; this.broadcastTime = broadcastTime;
    this.state = PENDING_STATE.PENDING; this.terminatedAt = null;
  }
  isStillPending() { return this.state === PENDING_STATE.PENDING; }
  markFinalizedSuccess() { if (this.state === PENDING_STATE.PENDING) { this.state = PENDING_STATE.FINALIZED_SUCCESS; this.terminatedAt = Date.now(); } }
  markFinalizedFailure() { if (this.state === PENDING_STATE.PENDING) { this.state = PENDING_STATE.FINALIZED_FAILURE; this.terminatedAt = Date.now(); } }
  markSequenceConsumed() { if (this.state === PENDING_STATE.PENDING) { this.state = PENDING_STATE.INVALIDATED_BY_SEQUENCE; this.terminatedAt = Date.now(); } }
  clearByElapsedSeconds() { return false; } // elapsed time NEVER clears
}

export class PendingRegistry {
  constructor() { this.attempts = new Map(); }
  _bucket(identity) { if (!this.attempts.has(identity)) this.attempts.set(identity, new Map()); return this.attempts.get(identity); }
  hasPending(identity) { const b = this._bucket(identity); for (const a of b.values()) if (a.isStillPending()) return true; return false; }
  register(a) { this._bucket(a.identity).set(a.lockId, a); }
  get(identity, lockId) { return this._bucket(identity).get(lockId); }
}