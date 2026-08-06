// =============================================================================
// Error definitions — each variant traces to a governing requirement ID.
// =============================================================================

use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    // VF-COM-001/002: Duration validation
    #[msg("VF-COM-002: Duration is not one of the 16 permitted values")]
    DurationNotPermitted,

    // VF-COM-003: Handshake USD value bounds
    #[msg("VF-COM-003: Handshake USD value outside $0.95–$1.05 inclusive")]
    HandshakeValueOutOfRange,

    // VF-COM-009: Standard lock minimum USD value
    #[msg("VF-COM-009: Standard lock USD value below $10.00 minimum")]
    StandardValueBelowMinimum,

    // VF-COM-010: Zero gross amount
    #[msg("VF-COM-010: Zero asset amount is invalid for every duration")]
    ZeroGrossAmount,

    // VF-COM-013: Zero fee or principal after rounding
    #[msg("VF-COM-013: Rounding produced zero fee or zero principal")]
    ZeroFeeOrPrincipal,

    // VF-COM-006/007: Handshake allowance exceeded
    #[msg("VF-COM-007: Identity has used all qualifying Handshake allowance")]
    HandshakeAllowanceExhausted,

    // VF-COM-008: (informational — failed attempts consume no allowance)

    // VF-COM-020: Invalid output token
    #[msg("VF-COM-020: Output token must be VCLM or activated CHONX")]
    InvalidOutputToken,

    // VF-COM-025 / VF-TOK-002: CHONX not activated
    #[msg("VF-TOK-002: CHONX is not yet activated (cumulative VCLM < 10,000,000)")]
    ChonxNotActivated,

    // VF-COM-025: Missing CHONX activation receipt
    #[msg("VF-COM-025: CHONX requires a non-empty activation receipt at creation")]
    MissingChonxReceipt,

    // VF-TOK-007: Protocol token as input
    #[msg("VF-TOK-007: VCLM/CHONX/SYNTH are prohibited as Commitment Vault Lock inputs")]
    ProtocolTokenProhibited,

    // VF-XCH-013: Lock ID uniqueness / format
    #[msg("VF-XCH-013: Lock ID is empty or exceeds maximum length")]
    InvalidLockId,

    #[msg("VF-XCH-013: Lock record already exists for this lock_id")]
    LockAlreadyExists,

    // VF-ARC-006: Invalid Base recipient
    #[msg("VF-ARC-006: Invalid Base recipient (expected 20-byte nonzero EVM address)")]
    InvalidBaseRecipient,

    // VF-PRI-001: Not yet matured
    #[msg("VF-PRI-001: Lock has not yet reached maturity")]
    NotMatured,

    // VF-PRI-002: Already released
    #[msg("VF-PRI-002: Principal has already been released")]
    AlreadyReleased,

    // VF-PRI-003: Release destination mismatch
    #[msg("VF-PRI-003: Release destination does not match the bound address")]
    ReleaseDestinationMismatch,

    // VF-DEP-001/002: Config not initialized or immutable
    #[msg("VF-DEP-001: Program configuration has not been initialized")]
    ConfigNotInitialized,

    // VF-DEP-002: Dev Fund mismatch
    #[msg("VF-DEP-002: Dev Fund destination does not match config")]
    DevFundMismatch,

    // VF-REG-001: Asset not in approved registry
    #[msg("VF-REG-001: Asset is not in the approved Solana registry")]
    AssetNotInRegistry,

    // VF-SEC-006: Unauthorized (release is permissionless, but config updates are not)
    #[msg("VF-SEC-006: Caller is not the program authority")]
    Unauthorized,

    // Internal / PDA validation
    #[msg("Invalid PDA derivation")]
    InvalidPda,

    #[msg("Math overflow in fee or output calculation")]
    MathOverflow,

    #[msg("Asset type mismatch: lock is not native SOL")]
    NotNativeLock,

    #[msg("Asset type mismatch: lock is not SPL token")]
    NotSplLock,

    #[msg("Token account mint mismatch")]
    MintMismatch,

    #[msg("Token account owner mismatch")]
    OwnerMismatch,
}