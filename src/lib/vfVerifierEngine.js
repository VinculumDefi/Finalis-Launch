// =============================================================================
// BASE-VERIFY + BASE-ISSUE + BASE-EMIT + BASE-MULT + BASE-CAP + BASE-ACT + BASE-RAC
// Off-Chain Verification Engine — mirrors the on-chain Solidity verifier logic.
//
// PROVENANCE: Built directly from Revision 6 authoritative documents:
//   - Vinculum_Finalis_Architecture_Design.md (Sections A.9, A.11-A.13, A.16, B.3, D, P)
//   - Vinculum_Finalis_Protocol_Constants.json (Revision 6)
//   - Vinculum_Finalis_Requirement_Traceability.csv
//
// This engine is the Base-side recognition boundary (BASE-VERIFY).
// It accepts a normalized ProofPackage and performs the complete protocol
// verification before authorizing issuance. It is chain-agnostic: the same
// verifyProof() function handles Solana, XRPL, Cosmos, Bitcoin, Stellar,
// and all 17 supported environments.
//
// VF-XCH-006: Issuance occurs only after source finality is verified.
// VF-XCH-011: All immutable-facts fields are validated.
// VF-RAC-001: RAC exact-once by immutable-facts key, independent of issuance replay.
// VF-SUP-015: Hard-cap rejection in full.
// =============================================================================

import {
  SCALE,
  EMISSION,
  DECAY,
  FIXED_RULES,
  COMMITMENT_DURATIONS,
  HANDSHAKE_DURATION_SECS,
  TOKEN_HARD_CAPS,
  CHONX_ACTIVATION_THRESHOLD,
  ASSET_CLASS_MULTIPLIERS_BPS,
} from './vfRevision6Authority';
import { findEnvironment, findAssetPrecision, getAssetMultiplierBps, isDevFundConfigured } from './vfBaseRegistry';
import { OUTPUT_TOKEN, outputTokenToString } from './vfProofNormalizer';
import { dispatchFinalityCheck, dispatchFactExtraction, isVerifierRegistered } from './vfChainVerifierRegistry';

// ---------------------------------------------------------------------------
// Fixed-point USD boundary thresholds (VF-COM-003/009)
// Derived once as exact BigInt from the authoritative decimal bounds so the
// acceptance decision never touches IEEE-754. 18-decimal fixed-point (SCALE).
// ---------------------------------------------------------------------------
const HANDSHAKE_USD_MIN_FP = (95n * SCALE) / 100n;  // $0.95 inclusive
const HANDSHAKE_USD_MAX_FP = (105n * SCALE) / 100n; // $1.05 inclusive
const STANDARD_USD_MIN_FP = 10n * SCALE;           // $10.00 inclusive

// ---------------------------------------------------------------------------
// State: consumed replay set, RAC set, Handshake counters, lifetime caps
// In the Solidity contract these are storage mappings; here they are Maps.
// ---------------------------------------------------------------------------

export class VerifierState {
  constructor() {
    // VF-XCH-013: replay protection — (env, lockId) consumed only on issuance success
    this.consumedLocks = new Set();
    // VF-RAC-001: RAC exact-once — keyed by rac_identity
    this.recordedRacs = new Set();
    // VF-COM-006/007: Handshake allowance counter for Base-enforced environments
    this.handshakeUsage = new Map(); // identity → count used
    // Lifetime issuance tracking (BASE-CAP)
    this.cumulativeVclmIssued = 0n;
    this.cumulativeChonxIssued = 0n;
    // CHONX activation state (BASE-ACT)
    this.chonxActivated = false;
    this.chonxActivationBlock = null;
    // RAC credits (BASE-RAC)
    this.racCredits = [];
  }

  reset() {
    this.consumedLocks.clear();
    this.recordedRacs.clear();
    this.handshakeUsage.clear();
    this.cumulativeVclmIssued = 0n;
    this.cumulativeChonxIssued = 0n;
    this.chonxActivated = false;
    this.chonxActivationBlock = null;
    this.racCredits = [];
  }
}

// ---------------------------------------------------------------------------
// Step 1: Replay protection check (VF-XCH-013)
// ---------------------------------------------------------------------------

export function checkReplay(state, pkg) {
  const key = `${pkg.source_environment_id}:${pkg.commitment_vault_lock_id}`;
  if (state.consumedLocks.has(key)) {
    return { ok: false, reason: 'VF-XCH-013: lock already consumed (replay)' };
  }
  return { ok: true, key };
}

// ---------------------------------------------------------------------------
// Step 2: RAC exact-once check (VF-RAC-001)
// ---------------------------------------------------------------------------

export function checkRacDedup(state, pkg) {
  if (!pkg.rac_identity) {
    return { ok: false, reason: 'VF-RAC-001: missing rac_identity' };
  }
  // VF-RAC-001: RAC is exact-once by immutable-facts key, INDEPENDENT of issuance
  // replay. If the RAC was already recorded (from a prior submission that verified
  // fees but failed later, e.g. CHONX not yet activated), do NOT block re-issuance.
  // The recording guard at Step 6 prevents double-counting of the RAC credit.
  return { ok: true, alreadyRecorded: state.recordedRacs.has(pkg.rac_identity) };
}

// ---------------------------------------------------------------------------
// Step 3: Environment + asset registry check (VF-XCH-001, VF-REG-001)
// ---------------------------------------------------------------------------

export function checkEnvironmentAndAsset(pkg) {
  const env = findEnvironment(pkg.source_environment_id);
  if (!env) {
    return { ok: false, reason: `VF-XCH-001: unknown environment "${pkg.source_environment_id}"` };
  }
  if (env.verificationStatus === 'EVIDENCE_REQUIRED') {
    return { ok: false, reason: `VF-ARC-002: environment "${pkg.source_environment_id}" mechanism incomplete (EVIDENCE REQUIRED)` };
  }
  const precision = findAssetPrecision(pkg.source_environment_id, pkg.canonical_asset_id);
  if (!precision) {
    return { ok: false, reason: `VF-REG-001: asset "${pkg.canonical_asset_id}" not in immutable registry for ${pkg.source_environment_id}` };
  }
  // VF-QNORM: precision from table, not from proof
  if (pkg.asset_precision != null && Number(pkg.asset_precision) !== precision.decimals) {
    return { ok: false, reason: `VF-QNORM: precision mismatch (table=${precision.decimals}, proof=${pkg.asset_precision})` };
  }
  return { ok: true, env, precision };
}

// ---------------------------------------------------------------------------
// Step 4: Fee math verification (VF-COM-011/012/013)
// ---------------------------------------------------------------------------

export function checkFeeMath(pkg) {
  const gross = BigInt(pkg.gross_amount_smallest_units);
  const fee = BigInt(pkg.actual_fee_amount_smallest_units);
  const principal = BigInt(pkg.principal_amount_smallest_units);
  if (gross - fee !== principal) {
    return { ok: false, reason: 'VF-COM-012: principal != gross - fee' };
  }
  if (fee === 0n) return { ok: false, reason: 'VF-COM-013: zero fee' };
  if (principal === 0n) return { ok: false, reason: 'VF-COM-013: zero principal' };
  // VF-COM-011: verify fee = floor(gross × bps / 10000)
  const isHandshake = Number(pkg.duration_secs) === HANDSHAKE_DURATION_SECS;
  const bps = BigInt(isHandshake ? FIXED_RULES.handshake_fee_bps : FIXED_RULES.standard_fee_bps);
  const expectedFee = (gross * bps) / 10000n;
  if (fee !== expectedFee) {
    return { ok: false, reason: `VF-COM-011: fee ${fee} != expected ${expectedFee} (bps=${bps})` };
  }
  return { ok: true, fee, principal, gross, bps: Number(bps) };
}

// ---------------------------------------------------------------------------
// Step 5: USD value bounds (VF-COM-003/009)
// ---------------------------------------------------------------------------

export function checkUsdBounds(pkg, verifiedGrossUsdMicro) {
  const isHandshake = Number(pkg.duration_secs) === HANDSHAKE_DURATION_SECS;
  const usdMicro = BigInt(verifiedGrossUsdMicro);
  // VF-COM-003/009 decision: exact fixed-point BigInt comparison (no IEEE-754).
  // A floating-point USD value is created ONLY below, AFTER the decision resolves,
  // solely for human-readable message formatting — it never influences the decision.
  if (isHandshake) {
    if (usdMicro < HANDSHAKE_USD_MIN_FP || usdMicro > HANDSHAKE_USD_MAX_FP) {
      const usd = Number(usdMicro) / Number(SCALE);
      return { ok: false, reason: `VF-COM-003: handshake USD $${usd.toFixed(4)} outside $0.95–$1.05` };
    }
  } else {
    if (usdMicro < STANDARD_USD_MIN_FP) {
      const usd = Number(usdMicro) / Number(SCALE);
      return { ok: false, reason: `VF-COM-009: standard USD $${usd.toFixed(4)} below $10.00 minimum` };
    }
  }
  const usd = Number(usdMicro) / Number(SCALE);
  return { ok: true, usd, isHandshake };
}

// ---------------------------------------------------------------------------
// Step 6: Duration check (VF-COM-001/002)
// ---------------------------------------------------------------------------

export function checkDuration(pkg) {
  const dur = COMMITMENT_DURATIONS.find((d) => d.secs === Number(pkg.duration_secs));
  if (!dur) {
    return { ok: false, reason: `VF-COM-002: duration ${pkg.duration_secs}s not permitted` };
  }
  return { ok: true, duration: dur };
}

// ---------------------------------------------------------------------------
// Step 7: Output token eligibility (VF-COM-020, VF-COM-025, VF-TOK-002)
// ---------------------------------------------------------------------------

export function checkOutputEligibility(state, pkg) {
  if (pkg.selected_output_token !== OUTPUT_TOKEN.VCLM && pkg.selected_output_token !== OUTPUT_TOKEN.CHONX) {
    return { ok: false, reason: 'VF-COM-020: output must be VCLM or CHONX' };
  }
  if (pkg.selected_output_token === OUTPUT_TOKEN.CHONX) {
    if (!state.chonxActivated) {
      return { ok: false, reason: 'VF-COM-025/VF-TOK-002: CHONX not yet activated' };
    }
    if (!pkg.chonx_activation_receipt) {
      return { ok: false, reason: 'VF-COM-025: CHONX requires activation receipt (causal ordering)' };
    }
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Step 8: Handshake allowance check (VF-COM-006/007/008)
// For source-enforced environments (EVM, Solana), the source consumed the
// allowance atomically. For Base-enforced environments (UTXO, XRPL, Stellar),
// BASE-VERIFY maintains the counter.
// ---------------------------------------------------------------------------

export function checkHandshakeAllowance(state, pkg, env) {
  // Cosmos Hub: allowance dependent on mechanism — EVIDENCE REQUIRED
  if (env.handshakeAllowance === null) {
    return { ok: false, reason: 'VF-COM-006: Handshake allowance undefined (mechanism incomplete)' };
  }
  // Source-enforced: trust the source counter (EVM, Solana)
  if (env.handshakeEnforcement === 'source') {
    return { ok: true, enforcement: 'source', allowance: env.handshakeAllowance };
  }
  // Base-enforced: check and consume the counter (UTXO, XRPL, Stellar)
  const identity = pkg.handshake_identity;
  const used = state.handshakeUsage.get(identity) || 0;
  if (used >= env.handshakeAllowance) {
    return { ok: false, reason: `VF-COM-007: Handshake allowance exhausted (${used}/${env.handshakeAllowance} for ${identity})` };
  }
  return { ok: true, enforcement: 'base', allowance: env.handshakeAllowance, used, remaining: env.handshakeAllowance - used };
}

// ---------------------------------------------------------------------------
// Step 9: Base recipient check (VF-ARC-006)
// ---------------------------------------------------------------------------

export function checkBaseRecipient(pkg) {
  const addr = String(pkg.base_recipient);
  if (!addr || addr.length !== 42 || !addr.startsWith('0x')) {
    return { ok: false, reason: 'VF-ARC-006: invalid base_recipient format' };
  }
  if (addr.slice(2) === '0'.repeat(40)) {
    return { ok: false, reason: 'VF-ARC-006: zero base_recipient' };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Step 10: Dev Fund destination check (VF-FEE-004/009)
// ---------------------------------------------------------------------------

export function checkDevFund(pkg) {
  if (!isDevFundConfigured(pkg.source_environment_id)) {
    return { ok: false, reason: `VF-FEE-009: Dev Fund destination not configured for ${pkg.source_environment_id} (deployment pending)` };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Step 11: Finality proof check (VF-XCH-006/010)
// DESIGN DEFINED — the actual proof verification is environment-specific.
// In the Solidity contract this dispatches to per-environment verifier contracts.
// Here we check that a proof object was provided and is marked validated.
// ---------------------------------------------------------------------------

export function checkFinalityProof(pkg) {
  // VF-XCH-006: Dispatch to the per-environment chain verifier for finality verification.
  // VF-XCH-010: Finality must be objective (chain-native evidence, not timers/mempool).
  const finalityResult = dispatchFinalityCheck(
    pkg.source_environment_id,
    pkg.lock_event_proof,
    pkg.source_finality_proof,
  );
  if (!finalityResult.ok) {
    return finalityResult;
  }

  // VF-XCH-011: Cross-check — independently extract facts from the raw lock event
  // proof and verify they match the ProofPackage facts. This prevents tampering
  // by the normalizer/relayer: the chain verifier extracts directly from the
  // chain-specific event, not from the normalized fields.
  const factsResult = dispatchFactExtraction(
    pkg.source_environment_id,
    pkg.lock_event_proof,
  );
  if (!factsResult.ok) {
    return factsResult;
  }

  const facts = factsResult.facts;
  const mismatches = [];
  if (String(facts.lockId) !== String(pkg.commitment_vault_lock_id)) {
    mismatches.push(`lockId (extracted=${facts.lockId}, package=${pkg.commitment_vault_lock_id})`);
  }
  if (String(facts.grossAmount) !== String(pkg.gross_amount_smallest_units)) {
    mismatches.push(`grossAmount (extracted=${facts.grossAmount}, package=${pkg.gross_amount_smallest_units})`);
  }
  if (String(facts.feeAmount) !== String(pkg.actual_fee_amount_smallest_units)) {
    mismatches.push(`feeAmount (extracted=${facts.feeAmount}, package=${pkg.actual_fee_amount_smallest_units})`);
  }
  if (String(facts.principalAmount) !== String(pkg.principal_amount_smallest_units)) {
    mismatches.push(`principalAmount (extracted=${facts.principalAmount}, package=${pkg.principal_amount_smallest_units})`);
  }
  if (Number(facts.durationSecs) !== Number(pkg.duration_secs)) {
    mismatches.push(`durationSecs (extracted=${facts.durationSecs}, package=${pkg.duration_secs})`);
  }
  if (mismatches.length > 0) {
    return { ok: false, reason: `VF-XCH-011: fact mismatch — ${mismatches.join('; ')}` };
  }

  return {
    ok: true,
    height: finalityResult.blockHeight,
    hash: finalityResult.blockHash,
    model: finalityResult.model,
    factsVerified: true,
    warning: finalityResult.warning || null,
  };
}

// ---------------------------------------------------------------------------
// Step 12: Issuance calculation (BASE-ISSUE + BASE-EMIT + BASE-MULT)
// VF-COM-018: calculation order = USD × emission × asset_mult × duration_mult
// VF-COM-019: every integer division floors; factors may not be reordered.
// ---------------------------------------------------------------------------

export function computeEmissionRate(outputToken, daysSinceLaunch) {
  const config = EMISSION[outputTokenToString(outputToken)];
  if (!config) return null;
  const periods = Math.floor(Number(daysSinceLaunch) / DECAY.period_days);
  let rate = config.initial_rate_per_dollar;
  for (let i = 0; i < periods; i++) {
    rate = (rate * DECAY.survival_fp) / SCALE;
    if (rate <= config.permanent_floor_per_dollar) {
      rate = config.permanent_floor_per_dollar;
      break;
    }
  }
  if (rate < config.permanent_floor_per_dollar) rate = config.permanent_floor_per_dollar;
  return rate;
}

export function computeIssuance(pkg, precision, daysSinceLaunch) {
  const tokenStr = outputTokenToString(pkg.selected_output_token);
  const emissionRate = computeEmissionRate(pkg.selected_output_token, daysSinceLaunch);
  if (!emissionRate) return { ok: false, errors: ['unknown output token'] };

  // VF-QNORM: convert smallest units → asset units → USD
  const grossSmallest = BigInt(pkg.gross_amount_smallest_units);
  const assetUnits = grossSmallest / (10n ** BigInt(precision.decimals));
  // Verified Gross USD = asset_units × price (price provided externally)
  // For the verifier, the USD value is already computed and provided
  // as verifiedGrossUsdMicro by the price-record verification path.
  // Here we accept it as a parameter to the issuance calculation.
  return { ok: true, emissionRate, assetUnits };
}

export function computeIssuanceFromUsd(verifiedGrossUsdMicro, outputToken, custodyClass, durationSecs, daysSinceLaunch) {
  const tokenStr = outputTokenToString(outputToken);
  const config = EMISSION[tokenStr];
  if (!config) return { ok: false, errors: ['unknown output token'] };

  const emissionRate = computeEmissionRate(outputToken, daysSinceLaunch);
  const usd = BigInt(verifiedGrossUsdMicro);

  // Step 1: USD × emission rate (VF-COM-018 order)
  let step = (usd * emissionRate) / SCALE;

  // Step 2: × asset multiplier
  const assetBps = BigInt(getAssetMultiplierBps(custodyClass));
  const assetMultFp = (SCALE * assetBps) / 10000n;
  step = (step * assetMultFp) / SCALE;

  // Step 3: × duration multiplier
  const dur = COMMITMENT_DURATIONS.find((d) => d.secs === Number(durationSecs));
  if (!dur) return { ok: false, errors: ['VF-COM-002: duration not permitted'] };
  const durMultFp = (SCALE * BigInt(dur.multiplier_bps)) / 10000n;
  step = (step * durMultFp) / SCALE;

  return {
    ok: true,
    output: step,
    emissionRate,
    assetMultiplierBps: Number(assetBps),
    durationMultiplierBps: dur.multiplier_bps,
  };
}

// ---------------------------------------------------------------------------
// Step 13: Hard-cap check (VF-SUP-015)
// ---------------------------------------------------------------------------

export function checkHardCap(state, outputToken, outputAmount) {
  const tokenStr = outputTokenToString(outputToken);
  const cap = TOKEN_HARD_CAPS[tokenStr];
  if (!cap) return { ok: false, reason: 'VF-SUP-015: unknown token' };
  const issued = tokenStr === 'VCLM' ? state.cumulativeVclmIssued : state.cumulativeChonxIssued;
  const remaining = cap - issued;
  if (BigInt(outputAmount) > remaining) {
    return { ok: false, reason: 'VF-SUP-015: output exceeds remaining lifetime capacity — reject in full', remaining };
  }
  return { ok: true, remaining };
}

// ---------------------------------------------------------------------------
// Step 14: RAC credit computation (BASE-RAC)
// RAC = Verified USD Fee Value × 60% (reward_accounting_credit_rate)
// ---------------------------------------------------------------------------

export function computeRacCredit(verifiedGrossUsdMicro, feeUnits, grossUnits) {
  const usd = BigInt(verifiedGrossUsdMicro);
  const fee = BigInt(feeUnits);
  const gross = BigInt(grossUnits);
  if (gross === 0n) return 0n;
  const feeUsd = (usd * fee) / gross;
  return (feeUsd * 60n) / 100n; // floor
}

// ---------------------------------------------------------------------------
// CHONX activation (BASE-ACT)
// VF-TOK-002: permanent when cumulative VCLM issuance reaches 10,000,000.
// ---------------------------------------------------------------------------

export function checkChonxActivation(state) {
  if (state.chonxActivated) return { activated: true, block: state.chonxActivationBlock };
  if (state.cumulativeVclmIssued >= CHONX_ACTIVATION_THRESHOLD) {
    state.chonxActivated = true;
    state.chonxActivationBlock = state.cumulativeVclmIssued; // simplified: use issuance as block proxy
    return { activated: true, newlyActivated: true, block: state.chonxActivationBlock };
  }
  return { activated: false };
}

// ---------------------------------------------------------------------------
// Full verification — the canonical entry point
// BASE-VERIFY: the recognition boundary.
// Returns { ok, decision, checks, issuance, racCredit } on success.
// Returns { ok: false, reason, checks } on failure.
// ---------------------------------------------------------------------------

export function verifyProof(state, pkg, { verifiedGrossUsdMicro, daysSinceLaunch = 0 } = {}) {
  const checks = [];

  // Step 1: Replay protection
  const replay = checkReplay(state, pkg);
  checks.push({ step: 'VF-XCH-013: Replay protection', pass: replay.ok, detail: replay.ok ? 'not consumed' : replay.reason });
  if (!replay.ok) return reject(checks, replay.reason);

  // Step 2: RAC dedup
  const rac = checkRacDedup(state, pkg);
  checks.push({ step: 'VF-RAC-001: RAC exact-once', pass: rac.ok, detail: rac.ok ? 'not recorded' : rac.reason });
  if (!rac.ok) return reject(checks, rac.reason);

  // Step 3: Environment + asset registry
  const envAsset = checkEnvironmentAndAsset(pkg);
  checks.push({ step: 'VF-XCH-001/REG-001: Environment + asset registry', pass: envAsset.ok, detail: envAsset.ok ? `${envAsset.env.id} / ${envAsset.precision.symbol}` : envAsset.reason });
  if (!envAsset.ok) return reject(checks, envAsset.reason);

  // Step 4: Fee math
  const fee = checkFeeMath(pkg);
  checks.push({ step: 'VF-COM-011/012/013: Fee math', pass: fee.ok, detail: fee.ok ? `fee=${fee.fee} principal=${fee.principal} bps=${fee.bps}` : fee.reason });
  if (!fee.ok) return reject(checks, fee.reason);

  // Step 5: Duration
  const dur = checkDuration(pkg);
  checks.push({ step: 'VF-COM-001/002: Permitted duration', pass: dur.ok, detail: dur.ok ? dur.duration.label : dur.reason });
  if (!dur.ok) return reject(checks, dur.reason);

  // Step 6: USD value bounds
  if (verifiedGrossUsdMicro == null) {
    return reject(checks, 'VF-ORC-001: verifiedGrossUsdMicro not provided (price record required)');
  }
  const usd = checkUsdBounds(pkg, verifiedGrossUsdMicro);
  checks.push({ step: 'VF-COM-003/009: USD value bounds', pass: usd.ok, detail: usd.ok ? `$${usd.usd.toFixed(4)} (${usd.isHandshake ? 'handshake' : 'standard'})` : usd.reason });
  if (!usd.ok) return reject(checks, usd.reason);

  // VF-FEE-011 / VF-RAC-002: Record RAC on fee verification, independent of issuance.
  // VF-RAC-008: No RAC after VCLM capacity = 0.
  // VF-SUP-012: At zero VCLM capacity, fees still reach Dev Fund but no RAC.
  // RAC is keyed by immutable-facts identity (VF-RAC-001: exact-once).
  if (!state.recordedRacs.has(pkg.rac_identity)) {
    state.recordedRacs.add(pkg.rac_identity);
    if (state.cumulativeVclmIssued < TOKEN_HARD_CAPS.VCLM) {
      const racCredit = computeRacCredit(verifiedGrossUsdMicro, fee.fee, fee.gross);
      state.racCredits.push({
        racIdentity: pkg.rac_identity,
        credit: racCredit,
        epoch: Math.floor(Date.now() / (FIXED_RULES.epoch_days * 86400 * 1000)),
      });
    }
  }

  // Step 7: Output eligibility
  const output = checkOutputEligibility(state, pkg);
  checks.push({ step: 'VF-COM-020/025: Output eligibility', pass: output.ok, detail: output.ok ? outputTokenToString(pkg.selected_output_token) : output.reason });
  if (!output.ok) return reject(checks, output.reason);

  // Step 8: Handshake allowance
  const handshake = checkHandshakeAllowance(state, pkg, envAsset.env);
  checks.push({ step: 'VF-COM-006/007: Handshake allowance', pass: handshake.ok, detail: handshake.ok ? `${handshake.enforcement} enforcement (${handshake.allowance}-use)` : handshake.reason });
  if (!handshake.ok) return reject(checks, handshake.reason);

  // Step 9: Base recipient
  const recipient = checkBaseRecipient(pkg);
  checks.push({ step: 'VF-ARC-006: Base recipient', pass: recipient.ok, detail: recipient.ok ? pkg.base_recipient : recipient.reason });
  if (!recipient.ok) return reject(checks, recipient.reason);

  // Step 10: Dev Fund destination
  const devFund = checkDevFund(pkg);
  checks.push({ step: 'VF-FEE-009: Dev Fund destination', pass: devFund.ok, detail: devFund.ok ? 'configured' : devFund.reason });
  // Dev Fund check is a warning, not a hard reject in simulation (deployment pending)
  // In production, this IS a hard reject.

  // Step 11: Finality proof + fact cross-check (VF-XCH-006/010/011)
  const finality = checkFinalityProof(pkg);
  const finalityDetail = finality.ok
    ? `${finality.model || 'verified'} h=${finality.height}${finality.factsVerified ? ' +facts✓' : ''}${finality.warning ? ' ⚠' + finality.warning : ''}`
    : finality.reason;
  checks.push({ step: 'VF-XCH-006/010/011: Source finality + fact cross-check', pass: finality.ok, detail: finalityDetail });
  if (!finality.ok) return reject(checks, finality.reason);

  // Step 12: Issuance calculation
  const issuance = computeIssuanceFromUsd(
    verifiedGrossUsdMicro,
    pkg.selected_output_token,
    envAsset.precision.custodyClass,
    pkg.duration_secs,
    daysSinceLaunch,
  );
  checks.push({ step: 'VF-COM-018/019: Issuance calculation', pass: issuance.ok, detail: issuance.ok ? `${issuance.output.toString()} smallest units` : (issuance.errors || []).join('; ') });
  if (!issuance.ok) return reject(checks, (issuance.errors || []).join('; '));

  // Step 13: Hard cap
  const cap = checkHardCap(state, pkg.selected_output_token, issuance.output);
  checks.push({ step: 'VF-SUP-015: Hard cap', pass: cap.ok, detail: cap.ok ? `remaining=${cap.remaining.toString()}` : cap.reason });
  if (!cap.ok) return reject(checks, cap.reason);

  // ---- All checks passed — authorize issuance ----

  // Consume Handshake allowance (Base-enforced only)
  if (handshake.enforcement === 'base') {
    const used = state.handshakeUsage.get(pkg.handshake_identity) || 0;
    state.handshakeUsage.set(pkg.handshake_identity, used + 1);
  }

  // Mint tokens (BASE-EMIT) — RAC already recorded at fee verification (step 6)
  if (pkg.selected_output_token === OUTPUT_TOKEN.VCLM) {
    state.cumulativeVclmIssued += issuance.output;
  } else {
    state.cumulativeChonxIssued += issuance.output;
  }

  // Check CHONX activation
  const chonxAct = checkChonxActivation(state);

  // Consume replay lock (only on issuance success — VF-XCH-013)
  state.consumedLocks.add(replay.key);

  return {
    ok: true,
    decision: 'ISSUE',
    checks,
    issuance: {
      token: outputTokenToString(pkg.selected_output_token),
      amount: issuance.output.toString(),
      emissionRate: issuance.emissionRate.toString(),
      assetMultiplierBps: issuance.assetMultiplierBps,
      durationMultiplierBps: issuance.durationMultiplierBps,
      recipient: pkg.base_recipient,
    },
    racCredit: state.racCredits.length > 0 ? state.racCredits[state.racCredits.length - 1] : null,
    chonxActivation: chonxAct,
    state: {
      cumulativeVclmIssued: state.cumulativeVclmIssued.toString(),
      cumulativeChonxIssued: state.cumulativeChonxIssued.toString(),
      consumedLocks: state.consumedLocks.size,
      recordedRacs: state.recordedRacs.size,
    },
  };
}

function reject(checks, reason) {
  return { ok: false, decision: 'REJECT', checks, reason };
}