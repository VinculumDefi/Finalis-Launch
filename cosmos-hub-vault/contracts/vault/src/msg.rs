//! Message types for the Vinculum Finalis Cosmos Hub Commitment Vault.
//!
//! All monetary amounts are in the canonical native base denom `uatom` (micro-ATOM, 6 decimals),
//! expressed as unsigned integers (CosmWasm `Uint128`).

use cosmwasm_std::{Addr, Uint128};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// Non-production test fixture for the Dev Fund destination. CONSPICUOUS and deliberately invalid as a
/// real address so it can never be mistaken for a production address. The real Cosmos Hub Dev Fund
/// destination is a deferred external input (VF-FEE-004/009, Section 8.2) and MUST be set via
/// `instantiate.dev_fund_address` at deployment as an explicit deployment gate (VF-DEP-001/002).
pub const NON_PRODUCTION_DEV_FUND_FIXTURE: &str =
    "cosmos1VF_NON_PRODUCTION_DEV_FUND_FIXTURE_DO_NOT_USE_ON_MAINNET";

/// Permitted Commitment Vault Lock durations, in seconds (Vinculum Finalis Protocol Constants, Section 5.1).
/// The one-hour duration is the Trust-Building Handshake; 7d..3650d are standard locks.
pub const DURATION_HANDSHAKE: u64 = 3600;
pub const DURATION_MIN_STANDARD: u64 = 7 * 86_400;
pub const DURATION_MAX_STANDARD: u64 = 3650 * 86_400;

/// All 16 permitted durations (seconds). Any other duration is rejected (VF-COM-001/002).
pub const PERMITTED_DURATIONS_SECS: &[u64] = &[
    3600,                       // 1h (Trust-Building Handshake only; VF-COM-003)
    7 * 86_400,                 // 7d
    14 * 86_400,                // 14d
    30 * 86_400,                // 30d
    60 * 86_400,                // 60d
    90 * 86_400,                // 90d
    120 * 86_400,               // 120d
    180 * 86_400,               // 180d
    365 * 86_400,               // 1y
    2 * 365 * 86_400,           // 2y
    3 * 365 * 86_400,           // 3y
    5 * 365 * 86_400,           // 5y
    7 * 365 * 86_400,           // 7y
    10 * 365 * 86_400,          // 10y
    2592 * 86_400,              // 2592d (~7.1y)
    3650 * 86_400,              // 3650d (10y, max)
];

/// Fee basis points per duration class (Vinculum Finalis Protocol Constants, Section 5.2/5.3).
pub const FEE_BPS_HANDSHAKE: u64 = 250;   // 2.50%
pub const FEE_BPS_STANDARD: u64 = 500;   // 5.00%

/// Verified Gross USD value bounds for a qualifying Trust-Building Handshake (VF-COM-003), in micro-USD
/// (1e-6 USD) to keep integer arithmetic. Inclusive: $0.95 ..= $1.05.
pub const HANDSHAKE_USD_MIN_MICRO: u128 = 950_000;   // $0.95
pub const HANDSHAKE_USD_MAX_MICRO: u128 = 1_050_000; // $1.05

/// Minimum Verified Gross USD value for a standard (>=7d) lock (VF-COM-009), in micro-USD. Inclusive: >= $10.00.
pub const STANDARD_USD_MIN_MICRO: u128 = 10_000_000; // $10.00

/// Handshake allowance per bound identity for a mechanism with persistent per-identity state (VF-COM-006).
/// Cosmos Hub (CosmWasm) maintains persistent on-chain state -> THREE-use.
pub const HANDSHAKE_ALLOWANCE: u32 = 3;

/// Native base denom for the Cosmos Hub environment (chain-registry cosmoshub/assetlist.json).
pub const NATIVE_BASE_DENOM: &str = "uatom";

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
pub struct InstantiateMsg {
    /// Fixed, immutable Dev Fund destination (bech32 cosmos1...). NON-PRODUCTION fixture by default;
    /// the production address is a deferred external input and an explicit deployment gate.
    pub dev_fund_address: String,
    /// Bech32 HRP for address validation (cosmoshub mainnet = "cosmos").
    pub bech32_prefix: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {
    /// Create a Commitment Vault Lock. Funds sent with this message are the gross amount.
    /// The contract atomically routes the rounded fee to the fixed Dev Fund and retains the principal
    /// until maturity, releasing it once to the bound release destination.
    CommitVaultLock {
        /// Commitment Vault Lock duration in seconds; must be one of PERMITTED_DURATIONS_SECS.
        duration_secs: u64,
        /// Authorized Base-chain recipient (bound at creation, VF-ARC-006). May differ from sender.
        base_recipient: String,
        /// Destination on the Cosmos Hub to which principal is released at maturity (bound at creation).
        release_destination: String,
        /// Selected output token: "VCLM" or "CHONX". CHONX requires an activation receipt (VF-COM-025).
        output_token: OutputToken,
        /// Verified Gross USD value of the gross amount, in micro-USD (1e-6 USD), at lock creation.
        /// Bound into immutable lock facts and verified off-chain (VF-XCH-011).
        verified_gross_usd_micro: u128,
        /// Unique Commitment Vault Lock identifier assigned off-chain and bound here (VF-XCH-013).
        /// The contract records it for replay protection; it MUST be globally unique per (env, lock_id).
        lock_id: String,
    },
    /// Release matured principal to the bound release destination. Permissionless; depends on no
    /// Base/price/relayer/admin (VF-PRI-002..006, VF-SEC-006). Callable by anyone; the principal is
    /// always sent to the release_destination bound at creation (VF-PRI-003).
    ReleasePrincipal { lock_id: String },
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, JsonSchema)]
#[serde(rename_all = "UPPERCASE")]
pub enum OutputToken {
    Vclm,
    Chonx,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryMsg {
    /// Full immutable lock record (VF-XCH-011 fields) by lock_id.
    Lock { lock_id: String },
    /// Contract configuration (Dev Fund destination, bech32 prefix).
    Config {},
    /// Remaining Handshake allowance for a bound identity (account) (VF-COM-006/007).
    HandshakeAllowance { identity: String },
    /// Whether a lock's principal has been released (VF-PRI-002 single-release).
    IsReleased { lock_id: String },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
pub struct LockResponse {
    pub lock_id: String,
    pub source_environment: String,
    pub source_account: String,
    pub canonical_asset: String,
    pub gross_amount: Uint128,
    pub fee_amount: Uint128,
    pub principal_amount: Uint128,
    pub verified_gross_usd_micro: u128,
    pub duration_secs: u64,
    pub creation_time_secs: u64,
    pub maturity_time_secs: u64,
    pub base_recipient: String,
    pub release_destination: String,
    pub output_token: OutputToken,
    pub chonx_activated_at_creation: bool,
    pub released: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
pub struct ConfigResponse {
    pub dev_fund_address: Addr,
    pub bech32_prefix: String,
    pub source_environment: String,
    pub native_base_denom: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
pub struct HandshakeAllowanceResponse {
    pub identity: String,
    pub used: u32,
    pub remaining: u32,
    pub allowance: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
pub struct IsReleasedResponse {
    pub lock_id: String,
    pub released: bool,
}