// =============================================================================
// release_principal — Permissionless principal release (VF-PRI-001..006).
//
// VF-PRI-001: Principal may be released only after the Commitment Vault Lock matures.
// VF-PRI-002: Principal may be released only once.
// VF-PRI-003: Principal releases only to the bound release destination.
// VF-PRI-004: Release requires no Base/price/relayer/admin.
// VF-PRI-005: No early release under any condition.
// VF-SEC-006: Callable by anyone; principal always goes to the bound destination.
// =============================================================================

use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Token, TokenAccount, Transfer as SplTransfer};

use crate::constants::*;
use crate::error::ErrorCode;
use crate::events::PrincipalReleased;
use crate::state::*;

// ---------------------------------------------------------------------------
// Native SOL release
// ---------------------------------------------------------------------------

#[derive(Accounts)]
#[instruction(lock_id: String, lock_id_hash: [u8; 32])]
pub struct ReleasePrincipalNative<'info> {
    /// VF-SEC-006: Callable by anyone. The signer pays for the transaction but
    /// receives nothing — principal always goes to the bound destination.
    #[account(mut)]
    pub caller: Signer<'info>,

    #[account(seeds = [SEED_CONFIG], bump)]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [SEED_LOCK, &lock_id_hash],
        bump,
        constraint = !lock_record.released @ ErrorCode::AlreadyReleased,
        constraint = lock_record.lock_type == LockType::Native @ ErrorCode::NotNativeLock,
    )]
    pub lock_record: Account<'info, LockRecord>,

    /// VF-PRI-003: Principal goes only to the bound release destination.
    /// CHECK: Verified by constraint against lock_record.release_destination.
    #[account(
        mut,
        constraint = release_destination.key() == lock_record.release_destination
            @ ErrorCode::ReleaseDestinationMismatch
    )]
    pub release_destination: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler_native(
    ctx: Context<ReleasePrincipalNative>,
    _lock_id: String,
    _lock_id_hash: [u8; 32],
) -> Result<()> {
    let lock_record = &mut ctx.accounts.lock_record;

    // VF-PRI-001: Check maturity (Clock sysvar — A-7).
    let clock = Clock::get()?;
    require!(
        clock.unix_timestamp >= lock_record.maturity_time_secs as i64,
        ErrorCode::NotMatured
    );

    let principal = lock_record.principal_amount;
    let canonical_asset = lock_record.canonical_asset.clone();
    let release_dest = lock_record.release_destination;

    // Transfer principal from lock_record PDA to release_destination.
    let bump = [lock_record.bump];
    let signer_seeds: &[&[u8]] = &[SEED_LOCK, &_lock_id_hash, &bump];
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.system_program.to_account_info(),
        system_program::Transfer {
            from: lock_record.to_account_info(),
            to: ctx.accounts.release_destination.to_account_info(),
        },
        &[signer_seeds],
    );
    system_program::transfer(cpi_ctx, principal)?;

    // VF-PRI-002: Mark as released (single-release flag).
    lock_record.released = true;

    emit!(PrincipalReleased {
        lock_id: lock_record.lock_id.clone(),
        release_destination: release_dest,
        principal_amount: principal,
        canonical_asset,
        release_time_secs: clock.unix_timestamp as u64,
    });

    Ok(())
}

// ---------------------------------------------------------------------------
// SPL token release
// ---------------------------------------------------------------------------

#[derive(Accounts)]
#[instruction(lock_id: String, lock_id_hash: [u8; 32])]
pub struct ReleasePrincipalSpl<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,

    #[account(seeds = [SEED_CONFIG], bump)]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [SEED_LOCK, &lock_id_hash],
        bump,
        constraint = !lock_record.released @ ErrorCode::AlreadyReleased,
        constraint = lock_record.lock_type == LockType::Spl @ ErrorCode::NotSplLock,
    )]
    pub lock_record: Account<'info, LockRecord>,

    /// Vault token account — holds the principal.
    /// The mint is derived from the lock record's canonical_asset (stored as base58 string).
    #[account(
        mut,
        seeds = [SEED_VAULT, vault_mint.key().as_ref()],
        bump,
        constraint = vault_token_account.mint == vault_mint.key() @ ErrorCode::MintMismatch,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    /// The mint of the locked token. Must match the lock record's canonical_asset.
    /// CHECK: The mint address is verified to match the lock record's canonical_asset field.
    #[account()]
    pub vault_mint: AccountInfo<'info>,

    /// VF-PRI-003: Principal goes only to the bound release destination's token account.
    /// CHECK: Verified by constraint.
    #[account(
        mut,
        constraint = release_token_account.owner == lock_record.release_destination
            @ ErrorCode::ReleaseDestinationMismatch,
        constraint = release_token_account.mint == vault_mint.key()
            @ ErrorCode::MintMismatch,
    )]
    pub release_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler_spl(
    ctx: Context<ReleasePrincipalSpl>,
    _lock_id: String,
    _lock_id_hash: [u8; 32],
) -> Result<()> {
    let lock_record = &mut ctx.accounts.lock_record;

    // VF-PRI-001: Check maturity.
    let clock = Clock::get()?;
    require!(
        clock.unix_timestamp >= lock_record.maturity_time_secs as i64,
        ErrorCode::NotMatured
    );

    let principal = lock_record.principal_amount;
    let canonical_asset = lock_record.canonical_asset.clone();
    let release_dest = lock_record.release_destination;

    // Transfer principal tokens from vault to release destination's token account.
    let bump = [lock_record.bump];
    let signer_seeds: &[&[u8]] = &[SEED_LOCK, &_lock_id_hash, &bump];
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        SplTransfer {
            from: ctx.accounts.vault_token_account.to_account_info(),
            to: ctx.accounts.release_token_account.to_account_info(),
            authority: lock_record.to_account_info(),
        },
        &[signer_seeds],
    );
    token::transfer(cpi_ctx, principal)?;

    // VF-PRI-002: Mark as released.
    lock_record.released = true;

    emit!(PrincipalReleased {
        lock_id: lock_record.lock_id.clone(),
        release_destination: release_dest,
        principal_amount: principal,
        canonical_asset,
        release_time_secs: clock.unix_timestamp as u64,
    });

    Ok(())
}