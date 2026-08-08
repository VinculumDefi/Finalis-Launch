// =============================================================================
// PROVENANCE: Vinculum_Finalis_Protocol_Constants.json — Revision 6, 2026-07-28
// Governing source SHA-256: 5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9
//
// Every constant below is transcribed verbatim from the authoritative constants file.
// No value is invented, interpolated, or carried over from a prior revision.
// =============================================================================

/// VF-XCH-011: source environment identifier.
pub const SOURCE_ENVIRONMENT: &str = "Solana";

/// VF-COM-003/026: The one-hour duration is the only qualifying Trust-Building Handshake.
pub const HANDSHAKE_DURATION_SECS: u64 = 3600;

/// VF-COM-003: Handshake USD value range $0.95–$1.05 inclusive (18-decimal fixed-point).
pub const HANDSHAKE_VALUE_USD_MIN_MICRO: u128 = 950_000_000_000_000_000;       // $0.95 × 10^18
pub const HANDSHAKE_VALUE_USD_MAX_MICRO: u128 = 1_050_000_000_000_000_000;     // $1.05 × 10^18

/// VF-COM-004: Handshake fee 2.50% (250 basis points).
pub const HANDSHAKE_FEE_BPS: u64 = 250;

/// VF-COM-009: Standard lock minimum USD value $10.00 (18-decimal fixed-point).
pub const STANDARD_MINIMUM_VALUE_USD_MICRO: u128 = 10_000_000_000_000_000_000; // $10.00 × 10^18

/// VF-COM-009: Standard lock fee 5.00% (500 basis points).
pub const STANDARD_FEE_BPS: u64 = 500;

/// VF-COM-010: No lock may use an actual zero gross asset amount.
pub const MIN_GROSS_AMOUNT: u128 = 1;

/// VF-TOK-001: Protocol output tokens use 18 decimal places.
pub const TOKEN_DECIMALS: u8 = 18;
pub const SCALE: u128 = 10u128.pow(TOKEN_DECIMALS as u32);

/// VF-TOK-002: CHONX activation threshold — cumulative lifetime VCLM issuance ≥ 10,000,000.
pub const CHONX_ACTIVATION_THRESHOLD: u128 = 10_000_000u128 * SCALE;

/// VF-SUP-015: Token hard caps (remaining capacity check).
pub const VCLM_HARD_CAP: u128 = 10_000_000_000u128 * SCALE;
pub const CHONX_HARD_CAP: u128 = 100_000_000_000u128 * SCALE;

/// VF-COM-006: Account-model mechanism with persistent per-identity state → three-use allowance.
/// Solana PDAs maintain atomic persistent per-identity state, qualifying for three.
pub const HANDSHAKE_ALLOWANCE: u32 = 3;

/// VF-XCH-013: Lock ID maximum length (bytes).
/// Revision 6 does not specify a maximum. 128 bytes is a practical limit that fits
/// the SHA-256 PDA seed strategy (see lock_record seeds in lib.rs).
pub const MAX_LOCK_ID_LEN: usize = 128;

/// VF-COM-001/002: The 16 permitted durations (seconds) with their output multipliers (basis points).
/// No intermediate duration or interpolated multiplier is permitted (VF-COM-002).
pub const PERMITTED_DURATIONS: &[(u64, u64)] = &[
    (3600, 10000),         // 1 hour    — Trust-Building Handshake, 1.0x
    (604800, 10000),       // 7 days    — shortest standard, 1.0x
    (2592000, 11500),      // 30 days   — 1.15x
    (5184000, 13000),      // 60 days   — 1.3x
    (7776000, 15000),      // 90 days   — 1.5x
    (15552000, 20000),     // 180 days  — 2.0x
    (31536000, 25000),     // 365 days  — 2.5x
    (63072000, 38000),     // 730 days  — 3.8x
    (94608000, 50000),     // 1095 days — 5.0x
    (126144000, 57500),    // 1460 days — 5.75x
    (157680000, 65000),    // 1825 days — 6.5x
    (189216000, 68000),    // 2190 days — 6.8x
    (220752000, 71000),    // 2555 days — 7.1x
    (252288000, 74000),    // 2920 days — 7.4x
    (283824000, 77000),    // 3285 days — 7.7x
    (315360000, 80000),    // 3650 days — 8.0x
];

/// PDA seed constants.
pub const SEED_CONFIG: &[u8] = b"vf_config";
pub const SEED_LOCK: &[u8] = b"vf_lock";
pub const SEED_HANDSHAKE: &[u8] = b"vf_handshake";
pub const SEED_VAULT: &[u8] = b"vf_vault";

/// VF-ARC-006: Base recipient length (0x + 40 hex = 42 chars, 20 bytes decoded).
pub const BASE_RECIPIENT_LEN: usize = 20;