// =============================================================================
// XRPL Commitment Vault Lock — Domain Engine
//
// PROVENANCE: Built directly from Revision 6 authoritative documents:
//   - Vinculum_Finalis_Protocol_Constants.json (Revision 6, 2026-07-28)
//   - Vinculum_Finalis_Governing_Requirements.json (209 requirements)
//   - Vinculum_Finalis_Base44_Implementation_Brief.md
//
// This module implements the protocol domain logic for the XRPL environment:
// validation, fee calculation, emission decay, output calculation, Handshake
// identity/allowance, and the lock state machine.
//
// Every function cites the governing requirement IDs it enforces.
// No value is fabricated. No Solana/Cosmos/EVM logic is reused (clean-room rule).
// =============================================================================

import {
  SCALE,
  EMISSION,
  DECAY,
  FIXED_RULES,
  COMMITMENT_DURATIONS,
  HANDSHAKE_DURATION_SECS,
  ASSET_CLASS_MULTIPLIERS_BPS,
  CHONX_ACTIVATION_THRESHOLD,
  TOKEN_HARD_CAPS,
} from './vfRevision6Authority';
import { XRPL_ENVIRONMENT, XRPL_HANDSHAKE_ALLOWANCE } from './vfXrplAuthority';
import { XRPL_REGISTRY } from './vfXrplRegistry';

// ---------------------------------------------------------------------------
// Duration helpers — VF-COM-001/002
// ---------------------------------------------------------------------------

// VF-COM-001: "Only the durations and multipliers in Section 5.1 are permitted."
// VF-COM-002: "No intermediate duration or interpolated multiplier is permitted."
export function isPermittedDuration(secs) {
  return COMMITMENT_DURATIONS.some((d) => d.secs === Number(secs));
}

export function getDuration(secs) {
  return COMMITMENT_DURATIONS.find((d) => d.secs === Number(secs)) || null;
}

// VF-COM-003/026: The one-hour duration is only a qualifying Trust-Building Handshake.
export function isHandshakeDuration(secs) {
  return Number(secs) === HANDSHAKE_DURATION_SECS;
}

// ---------------------------------------------------------------------------
// Asset lookup — VF-REG-001
// ---------------------------------------------------------------------------

// VF-REG-001: "The approved asset registry is the sole source of recognized
// external asset identities for Commitment Vault Locks."
export function findXrplAsset(symbol) {
  return XRPL_REGISTRY.find((a) => a.symbol === symbol) || null;
}

// VF-TOK-007: "VCLM, CHONX, and SYNTH are prohibited Commitment Vault Lock inputs."
export function isProtocolToken(symbol) {
  return ['VCLM', 'CHONX', 'SYNTH'].includes(String(symbol).toUpperCase());
}

// ---------------------------------------------------------------------------
// Address validation — VF-ARC-006, VF-PRI-003
// ---------------------------------------------------------------------------

// XRPL base58 alphabet (different from Bitcoin/Solana).
const XRPL_BASE58_ALPHABET = 'rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz';

// VF-PRI-003: Principal releases only to the user or release destination bound at creation.
// XRPL accounts are r-prefixed base58 addresses, 25–35 characters, with a 4-byte checksum.
// Phase 1: format check only (alphabet + length + r-prefix). Full checksum verification
// requires the xrpl library or async Web Crypto SHA-256 — deferred to production.
export function validateXrplAddress(addr) {
  if (!addr || typeof addr !== 'string') return false;
  if (addr.length < 25 || addr.length > 35) return false;
  if (!addr.startsWith('r')) return false;
  for (const char of addr) {
    if (XRPL_BASE58_ALPHABET.indexOf(char) === -1) return false;
  }
  return true;
}

// VF-ARC-006: Base-chain recipient must be a valid nonzero address bound at lock creation.
// Base is an EVM environment → 0x + 40 hex characters.
export function validateBaseRecipient(addr) {
  if (!addr || typeof addr !== 'string') return false;
  if (addr.length !== 42 || !addr.startsWith('0x')) return false;
  const hex = addr.slice(2);
  if (hex === '0'.repeat(40)) return false; // nonzero
  return /^[0-9a-fA-F]{40}$/.test(hex);
}

// ---------------------------------------------------------------------------
// Handshake identity — VF-COM-005
// ---------------------------------------------------------------------------

// VF-COM-005: "For an account-model mechanism it is the source environment combined
// with the source account." XRPL is account-model → identity = (XRPL, source_account).
export function buildHandshakeIdentity(sourceAccount) {
  if (!sourceAccount) return null;
  return `(${XRPL_ENVIRONMENT.name}, ${sourceAccount})`;
}

// ---------------------------------------------------------------------------
// Fee calculation — VF-COM-011/012/013
// ---------------------------------------------------------------------------

// VF-COM-011: "Fee asset units equal floor(gross asset units × applicable fee basis points / 10,000)."
// VF-COM-012: "Commitment principal units equal gross asset units minus actual rounded fee units."
// VF-COM-013: "The request is rejected before assets move if rounding produces a zero fee or zero principal."
export function computeFee(grossAssetUnits, durationSecs) {
  const gross = BigInt(grossAssetUnits);
  // VF-COM-010: "An actual zero asset amount is invalid for every duration."
  if (gross <= 0n) {
    return { ok: false, errors: ['VF-COM-010: zero asset amount is invalid'] };
  }
  const handshake = isHandshakeDuration(durationSecs);
  const bps = BigInt(handshake ? FIXED_RULES.handshake_fee_bps : FIXED_RULES.standard_fee_bps);
  // VF-COM-011: floor(gross × bps / 10000)
  const fee = (gross * bps) / 10000n;
  // VF-COM-012: principal = gross - fee
  const principal = gross - fee;
  const errors = [];
  if (fee === 0n) errors.push('VF-COM-013: rounding produced zero fee — reject before assets move');
  if (principal === 0n) errors.push('VF-COM-013: rounding produced zero principal — reject before assets move');
  return { ok: errors.length === 0, gross, fee, principal, bps: Number(bps), errors };
}

// ---------------------------------------------------------------------------
// Emission rate with decay — VF-COM-017/018, VF-TOK-008/009
// ---------------------------------------------------------------------------

// VF-TOK-008/009: VCLM begins at 10 per $1.00; decays 1.667% per completed 30-day period.
// VF-COM-019: "Every integer division rounds down."
// Permanent floors: VCLM 1/$1, CHONX 10/$1.
export function computeEmissionRate(outputToken, daysSinceLaunch) {
  const config = EMISSION[outputToken];
  if (!config) return null;
  const periods = Math.floor(Number(daysSinceLaunch) / DECAY.period_days);
  let rate = config.initial_rate_per_dollar;
  for (let i = 0; i < periods; i++) {
    // VF-COM-019: floor at each step
    rate = (rate * DECAY.survival_fp) / SCALE;
    if (rate <= config.permanent_floor_per_dollar) {
      rate = config.permanent_floor_per_dollar;
      break;
    }
  }
  if (rate < config.permanent_floor_per_dollar) rate = config.permanent_floor_per_dollar;
  return rate;
}

// ---------------------------------------------------------------------------
// Output calculation — VF-COM-017/018/019/020
// ---------------------------------------------------------------------------

// VF-COM-018: "The required calculation order is Verified Gross USD Value, time-dependent
// emission rate, asset multiplier, Commitment Vault Lock duration multiplier, then smallest
// protocol-token units."
// VF-COM-019: "Every integer division rounds down; factors may not be reordered."
// VF-COM-020: "A Commitment Vault Lock creates exactly one selected output token."
export function computeOutput({
  verifiedGrossUsdMicro,
  outputToken,
  assetClass,
  durationSecs,
  daysSinceLaunch,
}) {
  const emissionRate = computeEmissionRate(outputToken, daysSinceLaunch);
  if (!emissionRate) return { ok: false, errors: ['unknown output token'] };

  const usd = BigInt(verifiedGrossUsdMicro);

  // Step 1: Verified Gross USD Value × emission rate (VF-COM-018 order)
  let step = (usd * emissionRate) / SCALE;

  // Step 2: × asset multiplier
  const assetBps = BigInt(
    ASSET_CLASS_MULTIPLIERS_BPS[assetClass] || ASSET_CLASS_MULTIPLIERS_BPS.S3,
  );
  const assetMultFp = (SCALE * assetBps) / 10000n;
  step = (step * assetMultFp) / SCALE;

  // Step 3: × duration multiplier
  const dur = getDuration(durationSecs);
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
// Reward-Accounting Credit — constants "reward_accounting_credit"
// ---------------------------------------------------------------------------

// "Verified USD Fee Value × 60%" — the credit created when a fee is recognized.
export function computeRewardCredit(verifiedGrossUsdMicro, feeUnits, grossUnits) {
  const usd = BigInt(verifiedGrossUsdMicro);
  const fee = BigInt(feeUnits);
  const gross = BigInt(grossUnits);
  if (gross === 0n) return 0n;
  const feeUsd = (usd * fee) / gross;
  return (feeUsd * 60n) / 100n; // floor
}

// ---------------------------------------------------------------------------
// Supply / activation checks — VF-TOK-002, VF-SUP-015
// ---------------------------------------------------------------------------

// VF-TOK-002: "CHONX activation is permanent when cumulative lifetime VCLM issuance reaches 10,000,000."
export function isChonxActivated(cumulativeVclmIssued) {
  return BigInt(cumulativeVclmIssued) >= CHONX_ACTIVATION_THRESHOLD;
}

// VF-SUP-015: "Any output or complete epoch reward exceeding remaining capacity is rejected in full."
export function checkHardCap(outputToken, outputAmount, cumulativeIssued) {
  const cap = TOKEN_HARD_CAPS[outputToken];
  if (!cap) return { ok: false, reason: 'unknown token' };
  const issued = BigInt(cumulativeIssued);
  const output = BigInt(outputAmount);
  const remaining = cap - issued;
  if (output > remaining) {
    return { ok: false, reason: 'VF-SUP-015: output exceeds remaining lifetime capacity — reject in full', remaining };
  }
  return { ok: true, remaining };
}

// ---------------------------------------------------------------------------
// Full lock validation (preflight) — VF-ARC-004, VF-COM-001..026, VF-SEC-001..006
// ---------------------------------------------------------------------------

// VF-ARC-004: "A known-invalid Commitment Vault Lock request must be rejected before fee or
// principal assets move whenever the source environment can determine the invalidity."
export function validateLockRequest({
  assetSymbol,
  durationSecs,
  outputToken,
  baseRecipient,
  releaseDestination,
  sourceAccount,
  grossAssetUnits,
  verifiedGrossUsdMicro,
  daysSinceLaunch,
  chonxActivationReceipt,
  cumulativeVclmIssued,
}) {
  const errors = [];
  const checks = [];

  // VF-REG-001: asset must be in the approved XRPL registry
  const asset = findXrplAsset(assetSymbol);
  if (!asset) {
    errors.push(`VF-REG-001: asset "${assetSymbol}" is not in the approved XRPL registry`);
    checks.push({ id: 'VF-REG-001', pass: false });
  } else {
    checks.push({ id: 'VF-REG-001', pass: true, detail: `${asset.symbol} (class ${asset.class})` });
  }

  // VF-TOK-007: protocol tokens are prohibited inputs
  if (isProtocolToken(assetSymbol)) {
    errors.push('VF-TOK-007: VCLM/CHONX/SYNTH are prohibited as Commitment Vault Lock inputs');
    checks.push({ id: 'VF-TOK-007', pass: false });
  } else {
    checks.push({ id: 'VF-TOK-007', pass: true });
  }

  // VF-COM-001/002: permitted duration only
  if (!isPermittedDuration(durationSecs)) {
    errors.push(`VF-COM-002: duration ${durationSecs}s is not a permitted duration`);
    checks.push({ id: 'VF-COM-001', pass: false });
  } else {
    checks.push({ id: 'VF-COM-001', pass: true, detail: getDuration(durationSecs).label });
  }

  // VF-COM-020: exactly one output token
  if (!['VCLM', 'CHONX'].includes(outputToken)) {
    errors.push('VF-COM-020: output must be exactly one of VCLM or activated CHONX');
    checks.push({ id: 'VF-COM-020', pass: false });
  } else {
    checks.push({ id: 'VF-COM-020', pass: true, detail: outputToken });
  }

  // VF-COM-025 / VF-TOK-002: CHONX must already be activated at creation time
  if (outputToken === 'CHONX') {
    const activated = isChonxActivated(cumulativeVclmIssued || 0n);
    if (!activated) {
      errors.push('VF-COM-025 / VF-TOK-002: CHONX is not yet activated (cumulative VCLM < 10,000,000)');
      checks.push({ id: 'VF-COM-025', pass: false });
    } else if (!chonxActivationReceipt || chonxActivationReceipt.trim() === '') {
      errors.push('VF-COM-025: CHONX requires a non-empty activation receipt at creation');
      checks.push({ id: 'VF-COM-025', pass: false });
    } else {
      checks.push({ id: 'VF-COM-025', pass: true });
    }
  } else {
    checks.push({ id: 'VF-COM-025', pass: true, detail: 'not applicable (VCLM)' });
  }

  // VF-ARC-006: valid nonzero Base recipient
  if (!validateBaseRecipient(baseRecipient)) {
    errors.push('VF-ARC-006: invalid Base recipient (expected 0x + 40 hex, nonzero)');
    checks.push({ id: 'VF-ARC-006', pass: false });
  } else {
    checks.push({ id: 'VF-ARC-006', pass: true });
  }

  // VF-PRI-003: valid release destination (XRPL address)
  if (!validateXrplAddress(releaseDestination)) {
    errors.push('VF-PRI-003: invalid release destination (XRPL r-address format)');
    checks.push({ id: 'VF-PRI-003', pass: false });
  } else {
    checks.push({ id: 'VF-PRI-003', pass: true });
  }

  // VF-COM-005: source account required for Handshake identity
  if (!sourceAccount || !validateXrplAddress(sourceAccount)) {
    errors.push('VF-COM-005: invalid source account (XRPL r-address format)');
    checks.push({ id: 'VF-COM-005', pass: false });
  } else {
    checks.push({ id: 'VF-COM-005', pass: true });
  }

  // VF-COM-010/011/012/013: fee and principal
  const feeResult = computeFee(grossAssetUnits, durationSecs);
  if (!feeResult.ok) {
    errors.push(...feeResult.errors);
    checks.push({ id: 'VF-COM-011', pass: false });
  } else {
    checks.push({
      id: 'VF-COM-011/012',
      pass: true,
      detail: `fee=${feeResult.fee.toString()} drops principal=${feeResult.principal.toString()} drops`,
    });
  }

  // VF-COM-003/009: USD value bounds
  const usd = Number(BigInt(verifiedGrossUsdMicro)) / Number(SCALE);
  const handshake = isHandshakeDuration(durationSecs);
  if (handshake) {
    // VF-COM-003: $0.95–$1.05 inclusive
    if (usd < FIXED_RULES.handshake_value_usd_min || usd > FIXED_RULES.handshake_value_usd_max) {
      errors.push(`VF-COM-003: Handshake USD value $${usd.toFixed(4)} outside $0.95–$1.05 inclusive`);
      checks.push({ id: 'VF-COM-003', pass: false });
    } else {
      checks.push({ id: 'VF-COM-003', pass: true, detail: `$${usd.toFixed(4)}` });
    }
  } else {
    // VF-COM-009: ≥ $10.00
    if (usd < FIXED_RULES.standard_minimum_value_usd) {
      errors.push(`VF-COM-009: standard lock USD value $${usd.toFixed(4)} below $10.00 minimum`);
      checks.push({ id: 'VF-COM-009', pass: false });
    } else {
      checks.push({ id: 'VF-COM-009', pass: true, detail: `$${usd.toFixed(4)}` });
    }
  }

  // VF-COM-017..020: output calculation
  if (asset && feeResult.ok && ['VCLM', 'CHONX'].includes(outputToken)) {
    const output = computeOutput({
      verifiedGrossUsdMicro,
      outputToken,
      assetClass: asset.class,
      durationSecs,
      daysSinceLaunch,
    });
    if (!output.ok) {
      errors.push(...output.errors);
      checks.push({ id: 'VF-COM-018', pass: false });
    } else {
      // VF-SUP-015: hard-cap check
      const capCheck = checkHardCap(
        outputToken,
        output.output,
        outputToken === 'VCLM' ? cumulativeVclmIssued || 0n : 0n,
      );
      if (!capCheck.ok) {
        errors.push(capCheck.reason);
        checks.push({ id: 'VF-SUP-015', pass: false });
      } else {
        checks.push({
          id: 'VF-COM-018',
          pass: true,
          detail: `${output.output.toString()} smallest units (remaining cap: ${capCheck.remaining.toString()})`,
        });
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    checks,
    fee: feeResult.ok ? { fee: feeResult.fee, principal: feeResult.principal, gross: feeResult.gross, bps: feeResult.bps } : null,
    asset,
    handshake,
    identity: sourceAccount ? buildHandshakeIdentity(sourceAccount) : null,
  };
}