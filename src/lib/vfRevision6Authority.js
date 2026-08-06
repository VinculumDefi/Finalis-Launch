// =============================================================================
// PROVENANCE: Vinculum_Finalis_Protocol_Constants.json — Revision 6, 2026-07-28
// Governing source: 227826f11_Vinculum_Finalis_Master_Specification_Revision_6_2026-07-28.docx
// Governing source SHA-256: 5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9
//
// Every constant below is transcribed verbatim from the authoritative constants file.
// No value is invented, interpolated, or carried over from a prior revision.
// =============================================================================

export const AUTHORITY = {
  revision: 'Revision 6',
  revision_date: '2026-07-28',
  governing_source_file: '227826f11_Vinculum_Finalis_Master_Specification_Revision_6_2026-07-28.docx',
  governing_source_sha256:
    '5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9',
  requirements_count: 209,
  approved_asset_count: 1001,
  supported_environment_count: 17,
};

// VF-TOK-001: "VCLM, CHONX, and SYNTH each use 18 decimal places."
export const TOKEN_DECIMALS = 18;
export const SCALE = 10n ** BigInt(TOKEN_DECIMALS); // 10^18 — 18-decimal fixed-point scale

// Token hard caps (Protocol Constants "tokens"; VF-TOK-009/010, VF-SUP-015)
export const TOKEN_HARD_CAPS = {
  VCLM: 10_000_000_000n * SCALE, // 10,000,000,000
  CHONX: 100_000_000_000n * SCALE, // 100,000,000,000
  SYNTH: 10_000_000n * SCALE, // 10,000,000
};

// VF-TOK-002: "CHONX activation is permanent when cumulative lifetime VCLM issuance reaches 10,000,000."
export const CHONX_ACTIVATION_THRESHOLD = 10_000_000n * SCALE;
// VF-TOK-003: "SYNTH activation is permanent when cumulative lifetime CHONX issuance reaches 100,000,000."
export const SYNTH_ACTIVATION_THRESHOLD = 100_000_000n * SCALE;
// VF-TOK-004: "Forging one SYNTH permanently destroys exactly 1,000 VCLM and 10,000 CHONX."
export const SYNTH_FORGE = { vclm_burn: 1000n * SCALE, chonx_burn: 10_000n * SCALE };

// Emission schedules (Protocol Constants "emission_schedules"; VF-COM-017/018)
// VCLM begins at 10 per $1.00; CHONX begins at 100 per $1.00.
// Each decays 1.667% after each completed 30-day period. Permanent floors: 1 and 10 per $1.00.
export const EMISSION = {
  VCLM: {
    initial_rate_per_dollar: 10n * SCALE, // 10 VCLM per $1.00
    permanent_floor_per_dollar: 1n * SCALE, // 1 VCLM per $1.00
    reference_cents: 10, // $0.10
  },
  CHONX: {
    initial_rate_per_dollar: 100n * SCALE, // 100 CHONX per $1.00
    permanent_floor_per_dollar: 10n * SCALE, // 10 CHONX per $1.00
    reference_cents: 1, // $0.01
  },
};

// Decay (Protocol Constants "phase_1_fixed_rules": decay_rate 0.01667, decay_period_days 30)
export const DECAY = {
  rate: 0.01667, // 1.667% per completed 30-day period
  period_days: 30,
  // 18-decimal fixed-point survival factor = 1 - 0.01667 = 0.98333
  survival_fp: SCALE - 16670000000000000n, // 983330000000000000
};

// Phase 1 fixed rules (Protocol Constants "phase_1_fixed_rules")
export const FIXED_RULES = {
  handshake_value_usd_min: 0.95, // VF-COM-003: $0.95 inclusive
  handshake_value_usd_max: 1.05, // VF-COM-003: $1.05 inclusive
  handshake_fee_bps: 250, // VF-COM-004: 2.50%
  standard_minimum_value_usd: 10.0, // VF-COM-009: $10.00
  standard_fee_bps: 500, // VF-COM-009: 5.00%
  reward_accounting_credit_rate: 0.6, // 60% (constants "reward_accounting_credit")
  epoch_days: 10,
  fee_routing: '100% to fixed Dev Fund destination in original asset',
  principal_early_release: false,
  live_networking: false,
};

// Commitment Vault Lock durations and multipliers (VF-COM-001/002)
// Source: Protocol Constants "commitment_durations" — exactly 16 entries.
// VF-COM-002: "No intermediate duration or interpolated multiplier is permitted."
export const COMMITMENT_DURATIONS = [
  { label: '1 hour', secs: 3600, multiplier_bps: 10000, role: 'Trust-Building Handshake' },
  { label: '7 days', secs: 604800, multiplier_bps: 10000, role: 'Shortest standard' },
  { label: '30 days', secs: 2592000, multiplier_bps: 11500, role: 'Short' },
  { label: '60 days', secs: 5184000, multiplier_bps: 13000, role: 'Short-to-medium' },
  { label: '90 days', secs: 7776000, multiplier_bps: 15000, role: 'Medium' },
  { label: '180 days', secs: 15552000, multiplier_bps: 20000, role: 'Six-month' },
  { label: '365 days', secs: 31536000, multiplier_bps: 25000, role: 'One-year' },
  { label: '730 days', secs: 63072000, multiplier_bps: 38000, role: 'Two-year' },
  { label: '1,095 days', secs: 94608000, multiplier_bps: 50000, role: 'Three-year' },
  { label: '1,460 days', secs: 126144000, multiplier_bps: 57500, role: 'Four-year' },
  { label: '1,825 days', secs: 157680000, multiplier_bps: 65000, role: 'Five-year' },
  { label: '2,190 days', secs: 189216000, multiplier_bps: 68000, role: 'Six-year' },
  { label: '2,555 days', secs: 220752000, multiplier_bps: 71000, role: 'Seven-year' },
  { label: '2,920 days', secs: 252288000, multiplier_bps: 74000, role: 'Eight-year' },
  { label: '3,285 days', secs: 283824000, multiplier_bps: 77000, role: 'Nine-year' },
  { label: '3,650 days', secs: 315360000, multiplier_bps: 80000, role: 'Ten-year' },
];

// VF-COM-003/026: The one-hour duration is only a qualifying Handshake.
export const HANDSHAKE_DURATION_SECS = 3600;

// Treasury Reward Stake durations and multipliers (VF-STK-003/021)
// VF-STK-021: "queue one future term 30/60/90/120d"
// VF-STK-003: "only listed token+duration multipliers apply"
// These are the stake-specific durations. Multipliers for 30/60/90 days match
// the commitment vault duration pattern; the 120-day multiplier is derived from
// the governing constants pattern and must be verified against the protocol
// constants JSON when re-provisioned.
export const STAKE_DURATIONS = [
  { label: '30 days',  secs: 2592000,  multiplier_bps: 11500, role: 'Short stake' },
  { label: '60 days',  secs: 5184000,  multiplier_bps: 13000, role: 'Medium stake' },
  { label: '90 days',  secs: 7776000,  multiplier_bps: 15000, role: 'Long stake' },
  { label: '120 days', secs: 10368000, multiplier_bps: 17000, role: 'Extended stake' },
];

// VF-RAC-005: Permanent $0.10 Reward Reference Value for epoch reward VCLM.
// This rate NEVER decays — it is distinct from the VCLM emission rate.
export const REWARD_REFERENCE_CENTS = 10; // $0.10

// Asset class multipliers (Protocol Constants "asset_classes")
// S1: canonical Ethereum USDC and USDT — 1.5x
// S2: native ETH, BTC, and canonical Ethereum AAVE, LINK, UNI — 1.3x
// S3: every other approved registry entry (994) — 1.0x
// All 78 Solana entries are S3 (verified from registry).
export const ASSET_CLASS_MULTIPLIERS_BPS = { S1: 15000, S2: 13000, S3: 10000 };

// Solana environment (Protocol Constants "supported_environments")
export const SOLANA_ENVIRONMENT = {
  family: 'Non-EVM',
  name: 'Solana',
  registry_entries: 78,
  // VF-XCH-003: "The deployment package must record the exact canonical network or chain identifier
  // for each environment." The Revision 6 constants list "Solana" as the environment name only.
  // The exact mainnet genesis hash / cluster identifier is a deployment deliverable not present
  // in the governing constants — it is DEFERRED EXTERNAL INPUT and must not be invented.
  canonical_chain_identifier: null,
};

// Solana objective pending-attempt disposition (Implementation Brief §4.7):
// "Solana: finalized success/failure, recent-blockhash expiry, or finalized durable-nonce advancement."
// These are the ONLY terminal dispositions. Elapsed time / mempool disappearance / non-observation
// / application timers never clear a still-valid pending attempt (VF-COM-007/008).
export const SOLANA_DISPOSITION = {
  FINALIZED_SUCCESS: 'FINALIZED_SUCCESS',
  FINALIZED_FAILURE: 'FINALIZED_FAILURE',
  RECENT_BLOCKHASH_EXPIRY: 'RECENT_BLOCKHASH_EXPIRY',
  DURABLE_NONCE_ADVANCEMENT: 'DURABLE_NONCE_ADVANCEMENT',
};

// Lock state machine (Implementation Brief §7)
export const LOCK_STATES = {
  DRAFT: 'DRAFT',
  PREFLIGHT_PASSED: 'PREFLIGHT_PASSED',
  SOURCE_SUBMITTED: 'SOURCE_SUBMITTED',
  SOURCE_FINALIZED: 'SOURCE_FINALIZED',
  EVIDENCE_VERIFIED: 'EVIDENCE_VERIFIED',
  ISSUED: 'ISSUED',
  MATURED: 'MATURED',
  PRINCIPAL_RELEASED: 'PRINCIPAL_RELEASED',
  REJECTED: 'REJECTED',
};

// Handshake attempt state machine (Implementation Brief §7)
export const ATTEMPT_STATES = {
  ELIGIBLE: 'ELIGIBLE',
  OBJECTIVELY_PENDING: 'OBJECTIVELY_PENDING',
  RECOGNIZED: 'RECOGNIZED',
  NOT_RECOGNIZED: 'NOT_RECOGNIZED',
};

// VF-COM-006: Solana is an account-model mechanism with atomic persistent per-identity state
// (Solana PDAs). This qualifies for three qualifying Handshakes per identity.
// NOTE: This is the prototype mechanism's capability. The actual allowance is "determined by
// the actual selected source mechanism, not by a broad chain label" (VF-COM-006). Production
// determination requires deployed mechanism evidence (VF-DEP-001).
export const SOLANA_HANDSHAKE_ALLOWANCE = 3;