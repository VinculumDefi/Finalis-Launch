// =============================================================================
// Program entry point and instruction dispatch.
// =============================================================================

use anchor_lang::prelude::*;

pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;
use state::CommitVaultLockParams;

declare_id!("2oQy57MWn8xmFBP1g4xi7cXdzTtut7UbdqNmVEzubUfH");

#[program]
pub mod vf_solana_vault {
    use super::*;

    /// VF-DEP-001/002: One-time program configuration.
    /// Sets the fixed Dev Fund destination and source environment.
    pub fn initialize(ctx: Context<Initialize>, dev_fund_destination: Pubkey) -> Result<()> {
        instructions::initialize::handler(ctx, dev_fund_destination)
    }

    /// Commitment Vault Lock for native SOL.
    /// VF-COM-001..026, VF-ARC-004..006, VF-PRI-001..003, VF-SEC-001..006.
    pub fn commit_vault_lock_native(
        ctx: Context<CommitVaultLockNative>,
        params: CommitVaultLockParams,
    ) -> Result<()> {
        instructions::commit_vault_lock::handler_native(ctx, params)
    }

    /// Commitment Vault Lock for SPL tokens.
    /// Same protocol requirements as native; custody differs (token account vs lamports).
    pub fn commit_vault_lock_spl(
        ctx: Context<CommitVaultLockSpl>,
        params: CommitVaultLockParams,
    ) -> Result<()> {
        instructions::commit_vault_lock::handler_spl(ctx, params)
    }

    /// VF-PRI-001..006: Permissionless principal release for native SOL.
    /// Callable by anyone; principal always goes to the bound release_destination.
    pub fn release_principal_native(
        ctx: Context<ReleasePrincipalNative>,
        lock_id: String,
        lock_id_hash: [u8; 32],
    ) -> Result<()> {
        instructions::release_principal::handler_native(ctx, lock_id, lock_id_hash)
    }

    /// VF-PRI-001..006: Permissionless principal release for SPL tokens.
    pub fn release_principal_spl(
        ctx: Context<ReleasePrincipalSpl>,
        lock_id: String,
        lock_id_hash: [u8; 32],
    ) -> Result<()> {
        instructions::release_principal::handler_spl(ctx, lock_id, lock_id_hash)
    }
}