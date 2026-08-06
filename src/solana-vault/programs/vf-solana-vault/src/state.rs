// =============================================================================
// State accounts for the Vinculum Finalis Solana Commitment Vault Lock.
// Every field maps to a VF-XCH-011 immutable fact or a protocol requirement.
// =============================================================================

use anchor_lang::prelude::*;

/// Singleton program configuration. Created once by `initialize` (VF-DEP-001/002).
#[account]
pub struct Config {
    /// VF-FEE-009 / VF-DEP-001: Fixed, immutable Dev Fund destination.
    /// Fee (100% of the rounded fee) is routed here in the original asset.
    pub dev_fund_destination: Pubkey,
    /// VF-XCH-011: source environment identifier ("Solana").
    pub source_environment: String,
    /// VF-XCH-003: Exact canonical network/chain identifier (mainnet genesis hash).
    /// DEFERRED EXTERNAL INPUT — set to all-zeros until provided post-deployment.
    pub canonical_chain_identifier: [u8; 32],
    /// Upgrade authority (burned after audit for immutability).
    pub authority: Pubkey,
    pub bump: u8,
}

impl Config {
    pub const SOURCE_ENVIRONMENT_MAX: usize = 7; // "Solana"
    pub const LEN: usize = 8 // discriminator
        + 32 // dev_fund_destination
        + 4 + Self::SOURCE_ENVIRONMENT_MAX // source_environment
        + 32 // canonical_chain_identifier
        + 32 // authority
        + 1; // bump
}

/// VF-XCH-011: The immutable facts record for a single Commitment Vault Lock.
/// One PDA per (source_environment, lock_id) — globally unique (VF-XCH-013).
#[account]
pub struct LockRecord {
    /// VF-XCH-013: Globally unique lock identifier per (env, lock_id).
    pub lock_id: String,
    /// VF-XCH-011: Source environment ("Solana").
    pub source_environment: String,
    /// VF-XCH-011 / VF-COM-005: Source account (signer of the lock).
    pub source_account: Pubkey,
    /// VF-XCH-011: Canonical asset identity (mint pubkey as base58 string, or "SOL" for native).
    pub canonical_asset: String,
    /// VF-COM-010/011: Gross asset units received.
    pub gross_amount: u128,
    /// VF-COM-011: Rounded fee asset units.
    pub fee_amount: u128,
    /// VF-COM-012: Principal asset units (gross - fee).
    pub principal_amount: u128,
    /// VF-XCH-011: Verified Gross USD Value in 18-decimal fixed-point.
    /// Provided off-chain; the program records it as-is (A-11).
    pub verified_gross_usd_micro: u128,
    /// VF-COM-001: Permitted duration in seconds.
    pub duration_secs: u64,
    /// VF-XCH-011: Lock creation time (Clock sysvar unix_timestamp).
    pub creation_time_secs: u64,
    /// VF-PRI-001: Maturity time = creation + duration.
    pub maturity_time_secs: u64,
    /// VF-ARC-006: Bound Base-chain recipient (EVM address, 20 bytes).
    pub base_recipient: [u8; 20],
    /// VF-PRI-003: Bound release destination (Solana address).
    pub release_destination: Pubkey,
    /// VF-COM-020: Selected output token.
    pub output_token: OutputToken,
    /// VF-COM-025: CHONX activation receipt (non-empty if CHONX, "not_applicable" if VCLM).
    pub chonx_activation_receipt: String,
    /// VF-PRI-002: Single-release flag.
    pub released: bool,
    /// Lock type (native SOL or SPL token).
    pub lock_type: LockType,
    /// PDA bump.
    pub bump: u8,
}

impl LockRecord {
    pub const LOCK_ID_MAX: usize = 128;
    pub const SOURCE_ENVIRONMENT_MAX: usize = 7;
    pub const CANONICAL_ASSET_MAX: usize = 44; // base58 pubkey string
    pub const RECEIPT_MAX: usize = 128;

    pub const LEN: usize = 8 // discriminator
        + 4 + Self::LOCK_ID_MAX // lock_id
        + 4 + Self::SOURCE_ENVIRONMENT_MAX // source_environment
        + 32 // source_account
        + 4 + Self::CANONICAL_ASSET_MAX // canonical_asset
        + 16 // gross_amount
        + 16 // fee_amount
        + 16 // principal_amount
        + 16 // verified_gross_usd_micro
        + 8 // duration_secs
        + 8 // creation_time_secs
        + 8 // maturity_time_secs
        + 20 // base_recipient
        + 32 // release_destination
        + 1 // output_token enum
        + 4 + Self::RECEIPT_MAX // chonx_activation_receipt
        + 1 // released
        + 1 // lock_type enum
        + 1; // bump
}

/// VF-COM-006/007: Per-identity Handshake allowance tracking.
/// One PDA per source_account. Tracks qualifying Handshake usage.
#[account]
pub struct HandshakeAllowance {
    /// VF-COM-005: Identity string "(Solana, source_account)".
    pub identity: String,
    /// The bound source account.
    pub source_account: Pubkey,
    /// Successful qualifying Handshakes consumed.
    pub used: u32,
    /// Remaining qualifying Handshakes.
    pub remaining: u32,
    /// VF-COM-006: Allowance (3 for account-model with persistent state).
    pub allowance: u32,
    pub bump: u8,
}

impl HandshakeAllowance {
    pub const IDENTITY_MAX: usize = 64; // "(Solana, " + 44-char pubkey + ")"
    pub const LEN: usize = 8 // discriminator
        + 4 + Self::IDENTITY_MAX // identity
        + 32 // source_account
        + 4 // used
        + 4 // remaining
        + 4 // allowance
        + 1; // bump
}

/// VF-COM-020: Selected output token.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum OutputToken {
    Vclm,
    Chonx,
}

/// Lock type (native SOL or SPL token).
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum LockType {
    Native,
    Spl,
}

/// Instruction parameters for commit_vault_lock (shared by native and SPL paths).
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CommitVaultLockParams {
    /// VF-XCH-013: Unique lock identifier.
    pub lock_id: String,
    /// keccak256(lock_id) — computed off-chain, verified on-chain.
    /// Used as the PDA seed (avoids 32-byte seed limit for long lock_ids).
    pub lock_id_hash: [u8; 32],
    /// VF-COM-010: Gross asset units to lock.
    pub gross_amount: u128,
    /// VF-COM-001: Permitted duration in seconds.
    pub duration_secs: u64,
    /// VF-ARC-006: Bound Base-chain recipient (20-byte EVM address).
    pub base_recipient: [u8; 20],
    /// VF-PRI-003: Bound release destination.
    pub release_destination: Pubkey,
    /// VF-COM-020: Selected output token.
    pub output_token: OutputToken,
    /// VF-XCH-011: Verified Gross USD Value (18-decimal fixed-point).
    pub verified_gross_usd_micro: u128,
    /// VF-COM-025: CHONX activation receipt ("not_applicable" for VCLM).
    pub chonx_activation_receipt: String,
}

/// Default for HandshakeAllowance — init_if_needed uses this when creating the account.
/// remaining and allowance are initialized to HANDSHAKE_ALLOWANCE (3).
impl Default for HandshakeAllowance {
    fn default() -> Self {
        Self {
            identity: String::new(),
            source_account: Pubkey::default(),
            used: 0,
            remaining: crate::constants::HANDSHAKE_ALLOWANCE,
            allowance: crate::constants::HANDSHAKE_ALLOWANCE,
            bump: 0,
        }
    }
}