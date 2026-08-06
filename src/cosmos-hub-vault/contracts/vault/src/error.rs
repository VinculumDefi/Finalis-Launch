//! Contract error type.

use cosmwasm_std::StdError;
use thiserror::Error;

#[derive(Error, Debug, PartialEq)]
pub enum ContractError {
    #[error("{0}")]
    Std(#[from] StdError),

    #[error("duration not permitted: {0} seconds (VF-COM-001/002)")]
    DurationNotPermitted(u64),

    #[error("handshake value out of range: ${0} (must be $0.95..=$1.05) (VF-COM-003)")]
    HandshakeValueOutOfRange(u128),

    #[error("standard lock below minimum $10.00: ${0} (VF-COM-009)")]
    StandardBelowMinimum(u128),

    #[error("zero gross amount (VF-COM-010)")]
    ZeroAmount,

    #[error("rounding produced zero fee or zero principal (VF-COM-013)")]
    ZeroFeeOrPrincipal,

    #[error("only the native base denom '{expected}' is accepted, got '{got}' (VF-SEC-001/003)")]
    WrongDenom { expected: String, got: String },

    #[error("no funds sent (VF-COM-010)")]
    NoFunds,

    #[error("handshake allowance exhausted for identity {0}: 3 of 3 used (VF-COM-006/007)")]
    AllowanceExhausted(String),

    #[error("lock already exists: {0} (VF-XCH-013 single issuance)")]
    LockAlreadyExists(String),

    #[error("lock not found: {0}")]
    LockNotFound(String),

    #[error(
        "lock not yet mature: maturity at block time {maturity}, now {now} (VF-COM-016/VF-PRI-006)"
    )]
    NotMature { maturity: u64, now: u64 },

    #[error("principal already released for lock {0} (VF-PRI-002 single release)")]
    AlreadyReleased(String),

    #[error("invalid bech32 release destination: {0}")]
    InvalidAddress(String),

    #[error("invalid Base recipient (expected 0x + 40 hex): {0}")]
    InvalidBaseRecipient(String),

    #[error("invalid lock identifier: {0}")]
    InvalidLockId(String),

    #[error("dev fund address is the non-production fixture and cannot be used on cosmoshub-4 (VF-FEE-009/VF-DEP-008)")]
    NonProductionFixture,

    #[error("CHONX not activated at creation; later activation cannot cure (VF-COM-025)")]
    ChonxNotActivated,

    #[error("arithmetic overflow (VF-SEC-002)")]
    ArithmeticOverflow,
}
