//! Message types for the Vinculum Finalis Cosmos Hub Commitment Vault.
//!
//! All monetary amounts are in the canonical native base denom `uatom` (micro-ATOM, 6 decimals),
//! expressed as unsigned integers (CosmWasm `Uint128`).

use cosmwasm_std::Uint128;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// Non-production test fixture for the Dev Fund destination. This IS a valid `cosmos`-prefixed
/// bech32 address (so it passes the same bech32 validation as any real address — defect 5), but the
/// contract REJECTS it on `cosmoshub-4` at instantiation (VF-FEE-009 / VF-DEP-008). The real Cosmos Hub
/// Dev Fund destination is a deferred external input (Section 8.2) and MUST be supplied via
/// `instantiate.dev_fund_address` as an explicit deployment gate (VF-DEP-001/002). Derived as
/// bech32("cosmos", sha256("VF_NON_PRODUCTION_DEV_FUND_FIXTURE")[0..20]) — conspicuous by constant
/// name and by mainnet rejection, never by malformation.
pub const NON_PRODUCTION_DEV_FUND_FIXTURE: &str = "cosmos13cnmjwh69nn6ycjz8t3zlmkpx276lq4gpnylud";

/// Permitted Commitment Vault Lock durations, in seconds (Vinculum Finalis Protocol Constants, §5.1).
/// The one-hour duration is the Trust-Building Handshake; 7d..=3650d are standard locks.
pub const DURATION_HANDSHAKE: u64 = 3600;
pub const DURATION_MIN_STANDARD: u64 = 7 * 86_400;
pub const DURATION_MAX_STANDARD: u64 = 3650 * 86_400;

/// The 16 permitted durations (seconds), transcribed from Revision 6 Section 5.1.
/// Any other duration is rejected (VF-COM-001/002).
///
/// Governing source SHA-256: 5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9
///
/// Every entry is written as an explicit day count multiplied by 86,400. Year-based
/// arithmetic (`n * 365 * 86_400`) is deliberately not used: Section 5.1 is stated in
/// days, and a year multiplier invites the reader to supply a duration the table does
/// not contain. Asserted against Section 5.1 in `tests::all_16_permitted_durations_accepted`,
/// which compares this table to the specification in both directions (CL-74).
pub const PERMITTED_DURATIONS_SECS: &[u64] = &[
    3_600,             // 1 hour     — Trust-Building Handshake only (VF-COM-003)
    7 * 86_400,        // 7 days
    30 * 86_400,       // 30 days
    60 * 86_400,       // 60 days
    90 * 86_400,       // 90 days
    180 * 86_400,      // 180 days
    365 * 86_400,      // 365 days
    730 * 86_400,      // 730 days
    1_095 * 86_400,    // 1,095 days
    1_460 * 86_400,    // 1,460 days
    1_825 * 86_400,    // 1,825 days
    2_190 * 86_400,    // 2,190 days
    2_555 * 86_400,    // 2,555 days
    2_920 * 86_400,    // 2,920 days
    3_285 * 86_400,    // 3,285 days
    3_650 * 86_400,    // 3,650 days — maximum
];

/// Fee basis points per duration class (Protocol Constants, §5.2/5.3).
pub const FEE_BPS_HANDSHAKE: u64 = 250; // 2.50%
pub const FEE_BPS_STANDARD: u64 = 500; // 5.00%

/// Verified Gross USD value bounds for a qualifying Trust-Building Handshake (VF-COM-003), micro-USD.
/// Inclusive: $0.95 ..= $1.05.
pub const HANDSHAKE_USD_MIN_MICRO: u128 = 950_000; // $0.95
pub const HANDSHAKE_USD_MAX_MICRO: u128 = 1_050_000; // $1.05

/// Minimum Verified Gross USD value for a standard (>=7d) lock (VF-COM-009). Inclusive: >= $10.00.
pub const STANDARD_USD_MIN_MICRO: u128 = 10_000_000; // $10.00

/// Handshake allowance per bound identity for a persistent-state mechanism (VF-COM-006).
/// Cosmos Hub (CosmWasm) maintains persistent on-chain state -> THREE-use.
pub const HANDSHAKE_ALLOWANCE: u32 = 3;

/// Native base denom for the Cosmos Hub environment (chain-registry cosmoshub/assetlist.json).
pub const NATIVE_BASE_DENOM: &str = "uatom";

/// Canonical EVM (Base-chain) recipient format: 0x + 40 hex chars (defect 10).
pub const BASE_RECIPIENT_LEN: usize = 42;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
pub struct InstantiateMsg {
    /// Fixed, immutable Dev Fund destination (bech32 cosmos1...). NON-PRODUCTION fixture by default;
    /// the production address is a deferred external input and an explicit deployment gate.
    pub dev_fund_address: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {
    /// Create a Commitment Vault Lock. Funds sent with this message are the gross amount. The contract
    /// atomically routes the rounded fee to the fixed Dev Fund and retains the principal until
    /// maturity, releasing it once to the bound release destination.
    CommitVaultLock {
        duration_secs: u64,
        /// Authorized Base-chain (EVM) recipient, bound at creation (VF-ARC-006). May differ from sender.
        base_recipient: String,
        /// Destination on the Cosmos Hub to which principal is released at maturity (bound at creation).
        release_destination: String,
        output_token: OutputToken,
        /// Verified Gross USD value of the gross amount, in micro-USD, at lock creation (VF-XCH-011).
        verified_gross_usd_micro: u128,
        /// Unique Commitment Vault Lock identifier, globally unique per (env, lock_id) (VF-XCH-013).
        lock_id: String,
        /// Causal CHONX activation receipt (VF-COM-025). Required (non-empty, not "not_applicable")
        /// for CHONX output; ignored for VCLM (the contract records "not_applicable"). Verified
        /// off-chain by the proof path — no administrator is involved (defect 7).
        chonx_activation_receipt: String,
    },
    /// Release matured principal to the bound release destination. Permissionless; depends on no
    /// Base/price/relayer/admin (VF-PRI-002..006, VF-SEC-006). Callable by anyone; principal is always
    /// sent to the release_destination bound at creation (VF-PRI-003).
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
    /// Contract configuration (Dev Fund destination, source environment, native denom).
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
    pub chonx_activation_receipt: String,
    pub released: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
pub struct ConfigResponse {
    pub dev_fund_address: String,
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