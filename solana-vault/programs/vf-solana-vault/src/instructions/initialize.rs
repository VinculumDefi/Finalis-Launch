// =============================================================================
// initialize — One-time program configuration (VF-DEP-001/002).
// =============================================================================

use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::ErrorCode;
use crate::events::ConfigInitialized;
use crate::state::Config;

#[derive(Accounts)]
pub struct Initialize<'info> {
    /// The authority that initializes the program. Becomes the upgrade authority
    /// (should be burned after audit for immutability).
    #[account(mut)]
    pub authority: Signer<'info>,

    /// Singleton config PDA. Created once; cannot be re-created (PDA uniqueness).
    #[account(
        init,
        payer = authority,
        space = 8 + Config::LEN,
        seeds = [SEED_CONFIG],
        bump
    )]
    pub config: Account<'info, Config>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Initialize>, dev_fund_destination: Pubkey) -> Result<()> {
    // VF-DEP-002: Dev Fund destination must be a valid nonzero address.
    require!(
        dev_fund_destination != Pubkey::default(),
        ErrorCode::DevFundMismatch
    );

    let config = &mut ctx.accounts.config;
    config.dev_fund_destination = dev_fund_destination;
    config.source_environment = SOURCE_ENVIRONMENT.to_string();
    // VF-XCH-003: canonical chain identifier is a deployment deliverable.
    // Set to all-zeros until the mainnet genesis hash is provided post-deployment.
    config.canonical_chain_identifier = [0u8; 32];
    config.authority = ctx.accounts.authority.key();
    config.bump = ctx.bumps.config;

    emit!(ConfigInitialized {
        authority: config.authority,
        dev_fund_destination: config.dev_fund_destination,
        source_environment: config.source_environment.clone(),
    });

    Ok(())
}