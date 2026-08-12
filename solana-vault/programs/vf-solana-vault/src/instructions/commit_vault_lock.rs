// =============================================================================
// commit_vault_lock — The core Commitment Vault Lock instruction.
//
// Enforces: VF-COM-001..026, VF-ARC-004..006, VF-PRI-003, VF-REG-001,
//           VF-TOK-002/007, VF-XCH-013, VF-SEC-001..006, VF-SUP-015.
//
// Two paths: native SOL (system transfers) and SPL tokens (token transfers).
// Both share the same parameter validation and fee math.
// =============================================================================

use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer as SplTransfer};

use crate::constants::*;
use crate::error::ErrorCode;
use crate::events::*;
use crate::state::*;

// ---------------------------------------------------------------------------
// Shared validation — VF-ARC-004: reject before assets move.
// ---------------------------------------------------------------------------

/// Validates all lock parameters and computes fee/principal.
/// Called by both native and SPL handlers before any transfer.
///
/// Returns (fee_amount, principal_amount, is_handshake) on success.
fn validate_and_compute(params: &CommitVaultLockParams) -> Result<(u128, u128, bool)> {
    // VF-COM-001/002: Duration must be one of the 16 permitted values.
    let duration_entry = PERMITTED_DURATIONS
        .iter()
        .find(|(secs, _)| *secs == params.duration_secs)
        .ok_or(ErrorCode::DurationNotPermitted)?;

    let is_handshake = params.duration_secs == HANDSHAKE_DURATION_SECS;

    // Verify lock_id_hash matches keccak256(lock_id) — prevents PDA/lock_id mismatch.
    let computed_hash =
        anchor_lang::solana_program::hash::hashv(&[params.lock_id.as_bytes()]).to_bytes();
    require!(
        params.lock_id_hash == computed_hash,
        ErrorCode::InvalidLockId
    );

    // VF-XCH-013: Lock ID must be non-empty and bounded.
    require!(
        !params.lock_id.is_empty() && params.lock_id.len() <= MAX_LOCK_ID_LEN,
        ErrorCode::InvalidLockId
    );

    // VF-ARC-006: Base recipient must be nonzero.
    require!(
        !params.base_recipient.iter().all(|&b| b == 0),
        ErrorCode::InvalidBaseRecipient
    );

    // VF-COM-020 / VF-COM-025: CHONX requires non-empty activation receipt.
    if params.output_token == OutputToken::Chonx {
        require!(
            !params.chonx_activation_receipt.is_empty()
                && params.chonx_activation_receipt != "not_applicable",
            ErrorCode::MissingChonxReceipt
        );
    }

    // VF-COM-003/009: USD value bounds.
    if is_handshake {
        require!(
            params.verified_gross_usd_micro >= HANDSHAKE_VALUE_USD_MIN_MICRO
                && params.verified_gross_usd_micro <= HANDSHAKE_VALUE_USD_MAX_MICRO,
            ErrorCode::HandshakeValueOutOfRange
        );
    } else {
        require!(
            params.verified_gross_usd_micro >= STANDARD_MINIMUM_VALUE_USD_MICRO,
            ErrorCode::StandardValueBelowMinimum
        );
    }

    // VF-COM-010: Gross amount must be positive.
    require!(params.gross_amount > 0, ErrorCode::ZeroGrossAmount);

    // VF-COM-011: fee = floor(gross × bps / 10000).
    let bps = if is_handshake {
        HANDSHAKE_FEE_BPS
    } else {
        STANDARD_FEE_BPS
    } as u128;
    let fee = params
        .gross_amount
        .checked_mul(bps)
        .ok_or(ErrorCode::MathOverflow)?
        / 10000;

    // VF-COM-012: principal = gross - fee.
    let principal = params
        .gross_amount
        .checked_sub(fee)
        .ok_or(ErrorCode::MathOverflow)?;

    // VF-COM-013: Reject if rounding produced zero fee or principal.
    require!(fee > 0, ErrorCode::ZeroFeeOrPrincipal);
    require!(principal > 0, ErrorCode::ZeroFeeOrPrincipal);

    Ok((fee, principal, is_handshake))
}

/// Updates the Handshake allowance account (VF-COM-006/007).
/// Called by both handlers when is_handshake is true.
fn consume_handshake(
    ha: &mut HandshakeAllowance,
    signer: &Pubkey,
    bump: u8,
) -> Result<()> {
    // Initialize on first creation.
    if ha.identity.is_empty() {
        ha.identity = format!("({},{})", SOURCE_ENVIRONMENT, signer);
        ha.source_account = *signer;
        ha.bump = bump;
    }

    // VF-COM-007: Check remaining allowance before consuming.
    require!(ha.remaining > 0, ErrorCode::HandshakeAllowanceExhausted);

    ha.used += 1;
    ha.remaining = ha.allowance.saturating_sub(ha.used);

    emit!(HandshakeConsumed {
        identity: ha.identity.clone(),
        used: ha.used,
        remaining: ha.remaining,
    });

    Ok(())
}

/// Writes the lock record fields (shared by native and SPL).
fn write_lock_record(
    record: &mut LockRecord,
    params: &CommitVaultLockParams,
    source_account: Pubkey,
    canonical_asset: String,
    fee: u128,
    principal: u128,
    creation_time: i64,
    lock_type: LockType,
    bump: u8,
) {
    record.lock_id = params.lock_id.clone();
    record.source_environment = SOURCE_ENVIRONMENT.to_string();
    record.source_account = source_account;
    record.canonical_asset = canonical_asset;
    record.gross_amount = params.gross_amount;
    record.fee_amount = fee;
    record.principal_amount = principal;
    record.verified_gross_usd_micro = params.verified_gross_usd_micro;
    record.duration_secs = params.duration_secs;
    record.creation_time_secs = creation_time as u64;
    record.maturity_time_secs = (creation_time as u64).saturating_add(params.duration_secs);
    record.base_recipient = params.base_recipient;
    record.release_destination = params.release_destination;
    record.output_token = params.output_token;
    record.chonx_activation_receipt = if params.output_token == OutputToken::Chonx {
        params.chonx_activation_receipt.clone()
    } else {
        "not_applicable".to_string()
    };
    record.released = false;
    record.lock_type = lock_type;
    record.bump = bump;
}

// ---------------------------------------------------------------------------
// Native SOL path
// ---------------------------------------------------------------------------

#[derive(Accounts)]
#[instruction(params: CommitVaultLockParams)]
pub struct CommitVaultLockNative<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(seeds = [SEED_CONFIG], bump)]
    pub config: Account<'info, Config>,

    #[account(
        init,
        payer = signer,
        space = 8 + LockRecord::LEN,
        seeds = [SEED_LOCK, &params.lock_id_hash],
        bump
    )]
    pub lock_record: Account<'info, LockRecord>,

    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + HandshakeAllowance::LEN,
        seeds = [SEED_HANDSHAKE, signer.key().as_ref()],
        bump
    )]
    pub handshake_allowance: Account<'info, HandshakeAllowance>,

    /// CHECK: Verified against config.dev_fund_destination (VF-DEP-002).
    #[account(mut, constraint = dev_fund.key() == config.dev_fund_destination @ ErrorCode::DevFundMismatch)]
    pub dev_fund: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler_native(
    ctx: Context<CommitVaultLockNative>,
    params: CommitVaultLockParams,
) -> Result<()> {
    // VF-ARC-004: Validate all parameters before any assets move.
    let (fee, principal, is_handshake) = validate_and_compute(&params)?;

    let canonical_asset = "SOL".to_string();
    let clock = Clock::get()?;

    // --- Asset transfers (atomic — revert if any fails) ---

    // Narrow to the chain-native transfer width BEFORE any asset moves.
    // An unrepresentable amount is rejected, never truncated, never panicked.
    let gross_u64 = u64::try_from(params.gross_amount).map_err(|_| ErrorCode::MathOverflow)?;
    let fee_u64 = u64::try_from(fee).map_err(|_| ErrorCode::MathOverflow)?;

    // 1. Transfer gross from signer to lock_record PDA.
    let gross_cpi = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        system_program::Transfer {
            from: ctx.accounts.signer.to_account_info(),
            to: ctx.accounts.lock_record.to_account_info(),
        },
    );
    system_program::transfer(gross_cpi, gross_u64)?;

    // 2. Transfer fee from lock_record PDA to dev_fund.
    let bump = [ctx.bumps.lock_record];
    let signer_seeds: &[&[u8]] = &[SEED_LOCK, &params.lock_id_hash, &bump];
    // Named binding: PDA signer seeds must outlive the CPI call (E0716).
    let signer_seeds_arr = [signer_seeds];
    let fee_cpi = CpiContext::new_with_signer(
        ctx.accounts.system_program.to_account_info(),
        system_program::Transfer {
            from: ctx.accounts.lock_record.to_account_info(),
            to: ctx.accounts.dev_fund.to_account_info(),
        },
        &signer_seeds_arr,
    );
    system_program::transfer(fee_cpi, fee_u64)?;

    // --- Write lock record (VF-XCH-011 immutable facts) ---
    write_lock_record(
        &mut ctx.accounts.lock_record,
        &params,
        ctx.accounts.signer.key(),
        canonical_asset.clone(),
        fee,
        principal,
        clock.unix_timestamp,
        LockType::Native,
        ctx.bumps.lock_record,
    );

    // --- Handshake allowance (VF-COM-006/007) ---
    if is_handshake {
        consume_handshake(
            &mut ctx.accounts.handshake_allowance,
            &ctx.accounts.signer.key(),
            ctx.bumps.handshake_allowance,
        )?;
    }

    // --- Events (evidence trail) ---
    emit!(LockCreated {
        lock_id: params.lock_id.clone(),
        source_account: ctx.accounts.signer.key(),
        canonical_asset: canonical_asset.clone(),
        gross_amount: params.gross_amount,
        fee_amount: fee,
        principal_amount: principal,
        verified_gross_usd_micro: params.verified_gross_usd_micro,
        duration_secs: params.duration_secs,
        maturity_time_secs: ctx.accounts.lock_record.maturity_time_secs,
        base_recipient: params.base_recipient,
        release_destination: params.release_destination,
        output_token: params.output_token,
        lock_type: LockType::Native,
    });

    emit!(FeeTransferred {
        lock_id: params.lock_id.clone(),
        dev_fund_destination: ctx.accounts.dev_fund.key(),
        fee_amount: fee,
        canonical_asset,
    });

    Ok(())
}

// ---------------------------------------------------------------------------
// SPL token path
// ---------------------------------------------------------------------------

#[derive(Accounts)]
#[instruction(params: CommitVaultLockParams)]
pub struct CommitVaultLockSpl<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(seeds = [SEED_CONFIG], bump)]
    pub config: Account<'info, Config>,

    #[account(
        init,
        payer = signer,
        space = 8 + LockRecord::LEN,
        seeds = [SEED_LOCK, &params.lock_id_hash],
        bump
    )]
    pub lock_record: Account<'info, LockRecord>,

    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + HandshakeAllowance::LEN,
        seeds = [SEED_HANDSHAKE, signer.key().as_ref()],
        bump
    )]
    pub handshake_allowance: Account<'info, HandshakeAllowance>,

    // SPL token accounts
    /// Source token account — owned by the signer.
    #[account(
        mut,
        constraint = source_token_account.owner == signer.key() @ ErrorCode::OwnerMismatch,
        constraint = source_token_account.mint == mint.key() @ ErrorCode::MintMismatch,
    )]
    pub source_token_account: Account<'info, TokenAccount>,

    /// Vault token account — PDA-derived, owned (token authority) by lock_record.
    #[account(
        init_if_needed,
        payer = signer,
        token::mint = mint,
        token::authority = lock_record,
        seeds = [SEED_VAULT, mint.key().as_ref()],
        bump
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    /// Dev Fund token account — same mint, owned by config.dev_fund_destination.
    #[account(
        mut,
        constraint = dev_fund_token_account.mint == mint.key() @ ErrorCode::MintMismatch,
        constraint = dev_fund_token_account.owner == config.dev_fund_destination @ ErrorCode::DevFundMismatch,
    )]
    pub dev_fund_token_account: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler_spl(
    ctx: Context<CommitVaultLockSpl>,
    params: CommitVaultLockParams,
) -> Result<()> {
    // VF-ARC-004: Validate all parameters before any assets move.
    let (fee, principal, is_handshake) = validate_and_compute(&params)?;

    let canonical_asset = ctx.accounts.mint.key().to_string();
    let clock = Clock::get()?;

    // --- Asset transfers (atomic) ---

    // Narrow to the chain-native transfer width BEFORE any asset moves.
    let gross_u64 = u64::try_from(params.gross_amount).map_err(|_| ErrorCode::MathOverflow)?;
    let fee_u64 = u64::try_from(fee).map_err(|_| ErrorCode::MathOverflow)?;

    // 1. Transfer gross tokens from source to vault.
    let gross_cpi = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        SplTransfer {
            from: ctx.accounts.source_token_account.to_account_info(),
            to: ctx.accounts.vault_token_account.to_account_info(),
            authority: ctx.accounts.signer.to_account_info(),
        },
    );
    token::transfer(gross_cpi, gross_u64)?;

    // 2. Transfer fee tokens from vault to dev_fund (signed by lock_record PDA).
    let bump = [ctx.bumps.lock_record];
    let signer_seeds: &[&[u8]] = &[SEED_LOCK, &params.lock_id_hash, &bump];
    // Named binding: PDA signer seeds must outlive the CPI call (E0716).
    let signer_seeds_arr = [signer_seeds];
    let fee_cpi = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        SplTransfer {
            from: ctx.accounts.vault_token_account.to_account_info(),
            to: ctx.accounts.dev_fund_token_account.to_account_info(),
            authority: ctx.accounts.lock_record.to_account_info(),
        },
        &signer_seeds_arr,
    );
    token::transfer(fee_cpi, fee_u64)?;

    // --- Write lock record (VF-XCH-011 immutable facts) ---
    write_lock_record(
        &mut ctx.accounts.lock_record,
        &params,
        ctx.accounts.signer.key(),
        canonical_asset.clone(),
        fee,
        principal,
        clock.unix_timestamp,
        LockType::Spl,
        ctx.bumps.lock_record,
    );

    // --- Handshake allowance (VF-COM-006/007) ---
    if is_handshake {
        consume_handshake(
            &mut ctx.accounts.handshake_allowance,
            &ctx.accounts.signer.key(),
            ctx.bumps.handshake_allowance,
        )?;
    }

    // --- Events ---
    emit!(LockCreated {
        lock_id: params.lock_id.clone(),
        source_account: ctx.accounts.signer.key(),
        canonical_asset: canonical_asset.clone(),
        gross_amount: params.gross_amount,
        fee_amount: fee,
        principal_amount: principal,
        verified_gross_usd_micro: params.verified_gross_usd_micro,
        duration_secs: params.duration_secs,
        maturity_time_secs: ctx.accounts.lock_record.maturity_time_secs,
        base_recipient: params.base_recipient,
        release_destination: params.release_destination,
        output_token: params.output_token,
        lock_type: LockType::Spl,
    });

    emit!(FeeTransferred {
        lock_id: params.lock_id.clone(),
        dev_fund_destination: ctx.accounts.dev_fund_token_account.owner,
        fee_amount: fee,
        canonical_asset,
    });

    Ok(())
}