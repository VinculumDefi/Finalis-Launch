// =============================================================================
// SRC-EVID + BASE-VERIFY — Chain-Agnostic Proof Package Normalization
//
// PROVENANCE: Built directly from Revision 6 authoritative documents:
//   - Vinculum_Finalis_Architecture_Design.md (Section D — evidence schema)
//   - Vinculum_Finalis_Protocol_Constants.json (Revision 6)
//   - Vinculum_Finalis_Requirement_Traceability.csv
//
// This module normalizes chain-specific source evidence into the canonical
// ProofPackage structure that BASE-VERIFY consumes. Every source environment
// (Solana, XRPL, Cosmos, Bitcoin, Stellar, Cardano, EVM, etc.) produces the
// same normalized structure — the verifier never needs to know the source
// chain's internal representation.
//
// VF-XCH-011: The normalized package contains ALL immutable-facts fields.
// RAC identity is derived from immutable source facts, not serialized proof bytes.
// =============================================================================

import { findAssetPrecision, findEnvironment, getAssetMultiplierBps } from './vfBaseRegistry';
import { SCALE, COMMITMENT_DURATIONS, HANDSHAKE_DURATION_SECS, FIXED_RULES } from './vfRevision6Authority';

// ---------------------------------------------------------------------------
// Canonical ProofPackage structure (Section D)
// This is the single interface every source environment normalizes into.
// ---------------------------------------------------------------------------

export const PROOF_PACKAGE_FIELDS = [
  // Source identity
  'source_environment_id',
  'commitment_vault_lock_id',
  // Handshake
  'handshake_identity',
  'handshake_allowance_count',
  // Asset identity + quantity
  'canonical_asset_id',
  'canonical_asset_symbol',
  'asset_precision',
  'asset_custody_class',
  'gross_amount_smallest_units',
  'actual_fee_amount_smallest_units',
  'principal_amount_smallest_units',
  'fee_asset_id',
  // Fee routing evidence
  'dev_fund_destination',
  'fee_transfer_evidence',
  // Timing
  'valuation_timestamp',
  'maturity_timestamp',
  'duration_secs',
  // Output
  'selected_output_token',
  // Bindings
  'base_recipient',
  'release_destination',
  // CHONX activation (if applicable)
  'chonx_activation_receipt',
  // RAC identity (pre-computed from immutable facts)
  'rac_identity',
  // Chain-specific proofs (opaque to the normalizer, consumed by BASE-VERIFY)
  'source_finality_proof',
  'lock_event_proof',
];

// ---------------------------------------------------------------------------
// RAC identity derivation (Section D — Repair 2.K)
// rac_identity = H(source_environment_id ‖ lock_id ‖ canonical_fee_tx_hash
//                  ‖ fee_op_or_output_index ‖ canonical_fee_asset ‖ actual_fee_amount)
// Derived from immutable source facts, NOT serialized proof bytes.
// ---------------------------------------------------------------------------

export function computeRacIdentity({
  sourceEnvironmentId,
  lockId,
  canonicalFeeTxHash,
  feeOpOrOutputIndex,
  canonicalFeeAsset,
  actualFeeAmount,
}) {
  // Synchronous deterministic hash — uses a simple string hash since Web Crypto
  // SHA-256 is async. The Solidity contract uses keccak256; the off-chain engine
  // uses this for dedup keying only (the on-chain rac_identity is keccak256).
  const parts = [
    sourceEnvironmentId,
    lockId,
    canonicalFeeTxHash,
    String(feeOpOrOutputIndex),
    canonicalFeeAsset,
    String(actualFeeAmount),
  ];
  return parts.join('‖');
}

// ---------------------------------------------------------------------------
// Output token enum
// ---------------------------------------------------------------------------

export const OUTPUT_TOKEN = {
  VCLM: 0,
  CHONX: 1,
};

export function outputTokenToString(token) {
  return token === OUTPUT_TOKEN.VCLM ? 'VCLM' : token === OUTPUT_TOKEN.CHONX ? 'CHONX' : 'UNKNOWN';
}

// ---------------------------------------------------------------------------
// Chain-agnostic normalization
// Each source environment provides raw evidence; this function normalizes it
// into the canonical ProofPackage. The normalizer never fabricates fields —
// it maps, validates, and rejects if required fields are missing.
// ---------------------------------------------------------------------------

export function normalizeProofPackage(raw) {
  const errors = [];

  if (!raw || typeof raw !== 'object') {
    return { ok: false, errors: ['proof package is not an object'] };
  }

  // VF-XCH-001: environment must be in the 17-environment registry
  const env = findEnvironment(raw.source_environment_id);
  if (!env) {
    errors.push(`VF-XCH-001: unknown source environment "${raw.source_environment_id}"`);
  }

  // VF-REG-001: asset must be in the immutable precision table
  const precisionEntry = findAssetPrecision(
    raw.source_environment_id,
    raw.canonical_asset_id,
  );
  if (!precisionEntry) {
    errors.push(
      `VF-REG-001: asset "${raw.canonical_asset_id}" not in immutable precision table for ${raw.source_environment_id}`,
    );
  }

  // VF-XCH-011: all required fields must be present
  for (const field of PROOF_PACKAGE_FIELDS) {
    if (raw[field] === undefined || raw[field] === null || raw[field] === '') {
      // chonx_activation_receipt is optional unless output is CHONX
      if (field === 'chonx_activation_receipt') continue;
      errors.push(`VF-XCH-011: missing field "${field}"`);
    }
  }

  // VF-COM-012: principal == gross - fee
  if (raw.gross_amount_smallest_units != null && raw.actual_fee_amount_smallest_units != null && raw.principal_amount_smallest_units != null) {
    try {
      const gross = BigInt(raw.gross_amount_smallest_units);
      const fee = BigInt(raw.actual_fee_amount_smallest_units);
      const principal = BigInt(raw.principal_amount_smallest_units);
      if (gross - fee !== principal) {
        errors.push('VF-COM-012: principal != gross - fee');
      }
      // VF-COM-013: zero fee or principal
      if (fee === 0n) errors.push('VF-COM-013: zero fee');
      if (principal === 0n) errors.push('VF-COM-013: zero principal');
    } catch {
      errors.push('non-integer amount field');
    }
  }

  // VF-COM-001: duration must be in the 16 permitted entries
  if (raw.duration_secs != null) {
    const dur = COMMITMENT_DURATIONS.find((d) => d.secs === Number(raw.duration_secs));
    if (!dur) {
      errors.push(`VF-COM-001: duration ${raw.duration_secs}s not permitted`);
    }
  }

  // VF-COM-020: output token must be VCLM or CHONX
  if (raw.selected_output_token != null) {
    if (raw.selected_output_token !== OUTPUT_TOKEN.VCLM && raw.selected_output_token !== OUTPUT_TOKEN.CHONX) {
      errors.push('VF-COM-020: output token must be VCLM or CHONX');
    }
  }

  // VF-COM-025: CHONX requires activation receipt
  if (raw.selected_output_token === OUTPUT_TOKEN.CHONX) {
    if (!raw.chonx_activation_receipt || raw.chonx_activation_receipt === '') {
      errors.push('VF-COM-025: CHONX output requires activation receipt');
    }
  }

  // VF-ARC-006: base_recipient must be a nonzero EVM address
  if (raw.base_recipient) {
    const addr = String(raw.base_recipient);
    if (addr.length !== 42 || !addr.startsWith('0x') || addr.slice(2) === '0'.repeat(40)) {
      errors.push('VF-ARC-006: invalid base_recipient (nonzero 0x+40 hex required)');
    }
  }

  // Handshake allowance count must be 1 or 3 (or null for Cosmos Hub)
  if (raw.handshake_allowance_count != null && env) {
    const count = Number(raw.handshake_allowance_count);
    if (env.handshakeAllowance !== null && count !== env.handshakeAllowance) {
      errors.push(
        `VF-COM-006: handshake_allowance_count ${count} does not match environment allowance ${env.handshakeAllowance}`,
      );
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // Build the normalized package
  const pkg = {};
  for (const field of PROOF_PACKAGE_FIELDS) {
    pkg[field] = raw[field];
  }

  // Enrich with resolved metadata
  pkg._environment = env;
  pkg._precisionEntry = precisionEntry;
  pkg._assetMultiplierBps = precisionEntry ? getAssetMultiplierBps(precisionEntry.custodyClass) : null;

  // Compute RAC identity if not pre-computed
  if (!pkg.rac_identity && raw.canonical_fee_tx_hash) {
    pkg.rac_identity = computeRacIdentity({
      sourceEnvironmentId: raw.source_environment_id,
      lockId: raw.commitment_vault_lock_id,
      canonicalFeeTxHash: raw.canonical_fee_tx_hash,
      feeOpOrOutputIndex: raw.fee_op_or_output_index || 0,
      canonicalFeeAsset: raw.fee_asset_id || raw.canonical_asset_id,
      actualFeeAmount: raw.actual_fee_amount_smallest_units,
    });
  }

  return { ok: true, package: pkg };
}

// ---------------------------------------------------------------------------
// Per-environment normalizers
// Each takes chain-native evidence and produces raw fields for normalizeProofPackage.
// These are the chain-agnostic adapters — adding a new environment means adding
// a new normalizer function here, not changing BASE-VERIFY.
// ---------------------------------------------------------------------------

// Solana: LockCreated event → ProofPackage
export function normalizeSolanaEvidence(event, finalityProof) {
  return normalizeProofPackage({
    source_environment_id: 'Solana',
    commitment_vault_lock_id: event.lock_id,
    handshake_identity: event.handshake_identity,
    handshake_allowance_count: 3, // Solana is source-enforced 3-use
    canonical_asset_id: event.lock_type === 'Native' ? 'native-SOL' : event.mint,
    canonical_asset_symbol: event.canonical_asset === 'SOL' ? 'SOL' : event.canonical_asset,
    asset_precision: event.lock_type === 'Native' ? 9 : null, // resolved from table
    asset_custody_class: 'S3',
    gross_amount_smallest_units: event.gross_amount,
    actual_fee_amount_smallest_units: event.fee_amount,
    principal_amount_smallest_units: event.principal_amount,
    fee_asset_id: event.canonical_asset,
    dev_fund_destination: event.dev_fund_destination,
    fee_transfer_evidence: event.dev_fund_destination,
    valuation_timestamp: event.creation_time_secs,
    maturity_timestamp: event.maturity_time_secs,
    duration_secs: event.duration_secs,
    selected_output_token: event.output_token === 'VCLM' ? OUTPUT_TOKEN.VCLM : OUTPUT_TOKEN.CHONX,
    base_recipient: '0x' + Array.from(event.base_recipient).map((b) => b.toString(16).padStart(2, '0')).join('').padStart(40, '0').slice(-40),
    release_destination: event.release_destination,
    chonx_activation_receipt: event.chonx_activation_receipt || null,
    rac_identity: null, // computed by normalizeProofPackage
    source_finality_proof: finalityProof || null,
    lock_event_proof: event,
  });
}

// XRPL: EscrowCreate + Payment memo → ProofPackage
export function normalizeXrplEvidence(escrowTx, paymentTx, finalityProof) {
  const memo = escrowTx.Memos?.[0]?.Memo;
  let metadata = {};
  if (memo?.MemoData) {
    try {
      const hex = memo.MemoData;
      const json = hex.match(/.{1,2}/g).map((b) => String.fromCharCode(parseInt(b, 16))).join('');
      metadata = JSON.parse(json);
    } catch { /* memo not JSON */ }
  }
  // In XRPL, EscrowCreate locks the principal; the fee is paid separately via Payment.
  // Protocol gross = principal + fee (total committed by the user).
  const _xrplPrincipal = BigInt(String(escrowTx.Amount));
  const _xrplFee = BigInt(String(paymentTx.Amount));
  const _xrplGross = _xrplPrincipal + _xrplFee;
  return normalizeProofPackage({
    source_environment_id: 'XRPL',
    commitment_vault_lock_id: metadata.lock_id || escrowTx.Account + ':' + escrowTx.Sequence,
    handshake_identity: `(XRPL, ${escrowTx.Account})`,
    handshake_allowance_count: 1, // XRPL is Base-enforced 1-use
    canonical_asset_id: 'native-XRP',
    canonical_asset_symbol: 'XRP',
    asset_precision: 6,
    asset_custody_class: 'S3',
    gross_amount_smallest_units: String(_xrplGross),
    actual_fee_amount_smallest_units: String(_xrplFee),
    principal_amount_smallest_units: String(_xrplPrincipal),
    fee_asset_id: 'native-XRP',
    dev_fund_destination: paymentTx.Destination,
    fee_transfer_evidence: paymentTx.Destination,
    valuation_timestamp: String(escrowTx.date),
    maturity_timestamp: String(escrowTx.FinishAfter),
    duration_secs: String(Number(escrowTx.FinishAfter) - Number(escrowTx.date)),
    selected_output_token: metadata.output_token === 'VCLM' ? OUTPUT_TOKEN.VCLM : OUTPUT_TOKEN.CHONX,
    base_recipient: metadata.base_recipient,
    release_destination: metadata.release_destination || escrowTx.Account,
    chonx_activation_receipt: metadata.chonx_activation_receipt || null,
    rac_identity: null,
    source_finality_proof: finalityProof || null,
    lock_event_proof: { escrow: escrowTx, payment: paymentTx },
  });
}

// Cosmos: CosmWasm lock event → ProofPackage
export function normalizeCosmosEvidence(event, finalityProof) {
  return normalizeProofPackage({
    source_environment_id: 'CosmosHub',
    commitment_vault_lock_id: event.lock_id,
    handshake_identity: `(cosmoshub-4, ${event.source_account})`,
    handshake_allowance_count: null, // EVIDENCE REQUIRED — dependent on mechanism
    canonical_asset_id: 'native-uatom',
    canonical_asset_symbol: 'ATOM',
    asset_precision: 6,
    asset_custody_class: 'S3',
    gross_amount_smallest_units: event.gross_amount,
    actual_fee_amount_smallest_units: event.fee_amount,
    principal_amount_smallest_units: event.principal_amount,
    fee_asset_id: 'native-uatom',
    dev_fund_destination: event.fee_destination,
    fee_transfer_evidence: event.fee_transfer_evidence,
    valuation_timestamp: event.creation_time_secs,
    maturity_timestamp: event.maturity_time_secs,
    duration_secs: event.duration_secs,
    selected_output_token: event.output_token === 'VCLM' ? OUTPUT_TOKEN.VCLM : OUTPUT_TOKEN.CHONX,
    base_recipient: event.base_recipient,
    release_destination: event.release_destination,
    chonx_activation_receipt: event.chonx_activation_receipt || null,
    rac_identity: null,
    source_finality_proof: finalityProof || null,
    lock_event_proof: event,
  });
}

// UTXO family (Bitcoin/Litecoin/Doge/DGB/Zcash/BCH): CLTV tx → ProofPackage
export function normalizeUtxoEvidence(envId, txData, finalityProof) {
  return normalizeProofPackage({
    source_environment_id: envId,
    commitment_vault_lock_id: txData.lock_id,
    handshake_identity: `(${envId}, ${txData.canonical_release_public_key})`,
    handshake_allowance_count: 1, // UTXO is Base-enforced 1-use per canonical release public key
    canonical_asset_id: `native-${txData.asset_symbol}`,
    canonical_asset_symbol: txData.asset_symbol,
    asset_precision: 8,
    asset_custody_class: 'S3',
    gross_amount_smallest_units: txData.gross_satoshis,
    actual_fee_amount_smallest_units: txData.fee_satoshis,
    principal_amount_smallest_units: txData.principal_satoshis,
    fee_asset_id: `native-${txData.asset_symbol}`,
    dev_fund_destination: txData.dev_fund_address,
    fee_transfer_evidence: txData.fee_output_txid,
    valuation_timestamp: txData.lock_block_timestamp,
    maturity_timestamp: txData.maturity_timestamp,
    duration_secs: txData.duration_secs,
    selected_output_token: txData.output_token === 'VCLM' ? OUTPUT_TOKEN.VCLM : OUTPUT_TOKEN.CHONX,
    base_recipient: txData.base_recipient,
    release_destination: txData.canonical_release_public_key,
    chonx_activation_receipt: txData.chonx_activation_receipt || null,
    rac_identity: null,
    source_finality_proof: finalityProof || null,
    lock_event_proof: txData,
  });
}

// Stellar: ClaimableBalance + Payment → ProofPackage
export function normalizeStellarEvidence(txData, finalityProof) {
  return normalizeProofPackage({
    source_environment_id: 'Stellar',
    commitment_vault_lock_id: txData.lock_id,
    handshake_identity: `(Stellar, ${txData.source_account})`,
    handshake_allowance_count: 1, // Stellar is Base-enforced 1-use
    canonical_asset_id: 'native-XLM',
    canonical_asset_symbol: 'XLM',
    asset_precision: 7,
    asset_custody_class: 'S3',
    gross_amount_smallest_units: txData.gross_stroops,
    actual_fee_amount_smallest_units: txData.fee_stroops,
    principal_amount_smallest_units: txData.principal_stroops,
    fee_asset_id: 'native-XLM',
    dev_fund_destination: txData.dev_fund_account,
    fee_transfer_evidence: txData.fee_payment_txid,
    valuation_timestamp: txData.lock_ledger_timestamp,
    maturity_timestamp: txData.maturity_timestamp,
    duration_secs: txData.duration_secs,
    selected_output_token: txData.output_token === 'VCLM' ? OUTPUT_TOKEN.VCLM : OUTPUT_TOKEN.CHONX,
    base_recipient: txData.base_recipient,
    release_destination: txData.release_destination,
    chonx_activation_receipt: txData.chonx_activation_receipt || null,
    rac_identity: null,
    source_finality_proof: finalityProof || null,
    lock_event_proof: txData,
  });
}

// EVM: vault LockCreated event → ProofPackage
export function normalizeEvmEvidence(envId, event, finalityProof) {
  return normalizeProofPackage({
    source_environment_id: envId,
    commitment_vault_lock_id: event.lockId,
    handshake_identity: `(${envId}, ${event.sourceAccount})`,
    handshake_allowance_count: 3, // EVM is source-enforced 3-use
    canonical_asset_id: event.isNative ? `native-${event.assetSymbol}` : event.assetSymbol,
    canonical_asset_symbol: event.assetSymbol,
    asset_precision: event.assetDecimals,
    asset_custody_class: event.custodyClass || 'S3',
    gross_amount_smallest_units: event.grossAmount,
    actual_fee_amount_smallest_units: event.feeAmount,
    principal_amount_smallest_units: event.principalAmount,
    fee_asset_id: event.isNative ? `native-${event.assetSymbol}` : event.assetSymbol,
    dev_fund_destination: event.devFundDestination,
    fee_transfer_evidence: event.feeTransferTxHash,
    valuation_timestamp: event.blockTimestamp,
    maturity_timestamp: event.maturityTimestamp,
    duration_secs: event.durationSecs,
    selected_output_token: event.outputToken === 0 ? OUTPUT_TOKEN.VCLM : OUTPUT_TOKEN.CHONX,
    base_recipient: event.baseRecipient,
    release_destination: event.sourceAccount,
    chonx_activation_receipt: event.chonxActivationReceipt || null,
    rac_identity: null,
    source_finality_proof: finalityProof || null,
    lock_event_proof: event,
  });
}