// =============================================================================
// Event definitions — emitted for every state transition.
// These provide the evidence trail for off-chain proof extraction (VF-XCH-011).
// =============================================================================

use anchor_lang::prelude::*;
use crate::state::{OutputToken, LockType};

#[event]
pub struct ConfigInitialized {
    pub authority: Pubkey,
    pub dev_fund_destination: Pubkey,
    pub source_environment: String,
}

#[event]
pub struct LockCreated {
    /// VF-XCH-013: Unique lock identifier.
    pub lock_id: String,
    /// VF-COM-005: Source account.
    pub source_account: Pubkey,
    /// VF-XCH-011: Canonical asset identity.
    pub canonical_asset: String,
    /// VF-COM-010/011: Gross amount.
    pub gross_amount: u128,
    /// VF-COM-011: Fee amount.
    pub fee_amount: u128,
    /// VF-COM-012: Principal amount.
    pub principal_amount: u128,
    /// VF-XCH-011: Verified Gross USD Value (18-decimal fixed-point).
    pub verified_gross_usd_micro: u128,
    /// VF-COM-001: Duration in seconds.
    pub duration_secs: u64,
    /// VF-PRI-001: Maturity timestamp.
    pub maturity_time_secs: u64,
    /// VF-ARC-006: Bound Base recipient.
    pub base_recipient: [u8; 20],
    /// VF-PRI-003: Bound release destination.
    pub release_destination: Pubkey,
    /// VF-COM-020: Output token.
    pub output_token: OutputToken,
    /// Lock type (native or SPL).
    pub lock_type: LockType,
}

#[event]
pub struct FeeTransferred {
    pub lock_id: String,
    /// VF-FEE-009: Dev Fund destination.
    pub dev_fund_destination: Pubkey,
    /// VF-COM-011: Fee amount transferred.
    pub fee_amount: u128,
    /// VF-XCH-009: Fee transfer evidence (canonical asset identity).
    pub canonical_asset: String,
}

#[event]
pub struct HandshakeConsumed {
    /// VF-COM-005: Identity.
    pub identity: String,
    /// VF-COM-006: Used count after this Handshake.
    pub used: u32,
    /// VF-COM-006: Remaining count after this Handshake.
    pub remaining: u32,
}

#[event]
pub struct PrincipalReleased {
    /// VF-XCH-013: Lock identifier.
    pub lock_id: String,
    /// VF-PRI-003: Release destination.
    pub release_destination: Pubkey,
    /// VF-PRI-002: Principal amount released.
    pub principal_amount: u128,
    /// VF-COM-012: Canonical asset identity.
    pub canonical_asset: String,
    /// Release timestamp.
    pub release_time_secs: u64,
}