//! vf-cosmos-hub-vault — RED-TEAM / NON-PRODUCTION clean-room implementation.
//!
//! Entry points exposed: `instantiate`, `execute`, `query`.
//!
//! DELIBERATELY NOT EXPOSED:
//!   - NO `migrate` entry point   -> MsgMigrateContract (even by governance) fails at the contract level.
//!   - NO `sudo`  entry point     -> MsgSudoContract (even by governance) fails at the contract level.
//!
//! This is the C2 immutability crux, resolved against wasmd v0.60.7 (commit edb607cb):
//!   DefaultAuthorizationPolicy.CanModifyContract = (admin != nil && admin.Equals(actor))
//!   GovAuthorizationPolicy.CanModifyContract     = true, BUT migrate() dispatches to the contract's
//!   own migrate entry, which this contract does not implement. Therefore no actor — including a
//!   Cosmos Hub governance proposal — can replace the code, change the admin, or alter state via sudo.
//!   The only remaining alter path is a chain-level software upgrade (hard-fork equivalent), which is
//!   out of scope under VF-XCH-017 (chain-equivalent outcome principle).

#![allow(deprecated)] // cosmwasm-std 2.1.3 deprecates to_binary/from_binary/mock_info in favor of
                      // to_json_binary/from_json/message_info, which were added later; allow the
                      // stable names so the crate compiles under `-D warnings`.

pub mod contract;
pub mod error;
pub mod msg;
pub mod state;

#[cfg(test)]
mod tests;

use cosmwasm_std::{entry_point, Binary, Deps, DepsMut, Env, MessageInfo, Response, StdResult};
use msg::{ExecuteMsg, InstantiateMsg, QueryMsg};

#[entry_point]
pub fn instantiate(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: InstantiateMsg,
) -> Result<Response, error::ContractError> {
    contract::instantiate(deps, env, info, msg)
}

#[entry_point]
pub fn execute(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> Result<Response, error::ContractError> {
    contract::execute(deps, env, info, msg)
}

#[entry_point]
pub fn query(deps: Deps, env: Env, msg: QueryMsg) -> StdResult<Binary> {
    contract::query(deps, env, msg)
}

// NOTE: no `migrate` and no `sudo` entry point is exposed by design. See crate docs above.
