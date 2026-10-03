// Direct lamport movement for program-owned accounts.
// system_program::transfer cannot debit an account owned by this program.

use anchor_lang::prelude::*;
use crate::error::ErrorCode;

pub fn move_lamports<'info>(
    from: &AccountInfo<'info>,
    to: &AccountInfo<'info>,
    amount: u64,
) -> Result<()> {
    require!(amount > 0, ErrorCode::ZeroFeeOrPrincipal);
    let mut from_lamports = from.try_borrow_mut_lamports()?;
    let mut to_lamports = to.try_borrow_mut_lamports()?;
    **from_lamports = from_lamports
        .checked_sub(amount)
        .ok_or(ErrorCode::MathOverflow)?;
    **to_lamports = to_lamports
        .checked_add(amount)
        .ok_or(ErrorCode::MathOverflow)?;
    Ok(())
}

pub fn as_u64(amount: u128) -> Result<u64> {
    u64::try_from(amount).map_err(|_| error!(ErrorCode::MathOverflow))
}
