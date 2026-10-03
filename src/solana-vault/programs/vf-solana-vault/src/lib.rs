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

declare_id!("E96mDgb9EjCKyxhrUPtDtAQ7Kp2bpkQW7foJDYxnVv1s");

#[program]
pub mod vf_solana_vault {
    use super::*;

    /// VF-DEP-001/002: One-time program configuration.
    pub fn initialize(ctx: Context<Initialize>, dev_fund_destination: Pubkey) -> Result<()> {
        handler(ctx, dev_fund_destination)
    }

    /// Commitment Vault Lock for native SOL.
    pub fn commit_vault_lock_native(
        ctx: Context<CommitVaultLockNative>,
        params: CommitVaultLockParams,
    ) -> Result<()> {
        commit_native(ctx, params)
    }

    /// Commitment Vault Lock for SPL tokens.
    pub fn commit_vault_lock_spl(
        ctx: Context<CommitVaultLockSpl>,
        params: CommitVaultLockParams,
    ) -> Result<()> {
        commit_spl(ctx, params)
    }

    /// VF-PRI-001..006: Permissionless principal release for native SOL.
    pub fn release_principal_native(
        ctx: Context<ReleasePrincipalNative>,
        lock_id: String,
        lock_id_hash: [u8; 32],
    ) -> Result<()> {
        release_native(ctx, lock_id, lock_id_hash)
    }

    /// VF-PRI-001..006: Permissionless principal release for SPL tokens.
    pub fn release_principal_spl(
        ctx: Context<ReleasePrincipalSpl>,
        lock_id: String,
        lock_id_hash: [u8; 32],
    ) -> Result<()> {
        release_spl(ctx, lock_id, lock_id_hash)
    }
}
