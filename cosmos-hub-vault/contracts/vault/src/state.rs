//! On-chain state and the immutable Commitment Vault Lock-fact schema (VF-XCH-011).
//!
//! All state is persistent on the Cosmos Hub (cosmoshub-4), satisfying the three-use Handshake
//! allowance condition of VF-COM-006.

use cosmwasm_std::{Addr, Uint128};
use cw_storage_plus::{Item, Map};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use crate::msg::OutputToken;

/// Immutable contract configuration, set once at instantiation (VF-DEP-001).
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
pub struct Config {
    /// Fixed, immutable Dev Fund destination (bech32). NON-PRODUCTION fixture until deployment gate.
    pub dev_fund_address: Addr,
    pub bech32_prefix: String,
    /// Source environment identifier, bound into every lock's immutable facts (VF-XCH-011).
    pub source_environment: String,
    /// Canonical native base denom (uatom).
    pub native_base_denom: String,
}

pub const CONFIG: Item<Config> = Item::new("config");

/// A Commitment Vault Lock record. Every field is bound at creation and never mutated thereafter
/// (VF-ARC-005). `released` is the only field that transitions, exactly once (VF-PRI-002).
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
pub struct Lock {
    pub lock_id: String,
    pub source_environment: String,
    /// Handshake identity for an account-model mechanism = (source_environment, source_account) (VF-COM-005).
    pub source_account: Addr,
    pub canonical_asset: String,
    pub gross_amount: Uint128,
    pub fee_amount: Uint128,
    pub principal_amount: Uint128,
    pub verified_gross_usd_micro: u128,
    pub duration_secs: u64,
    pub creation_time_secs: u64,
    pub maturity_time_secs: u64,
    pub base_recipient: String,
    pub release_destination: Addr,
    pub output_token: OutputToken,
    pub chonx_activated_at_creation: bool,
    pub released: bool,
}

/// lock_id -> Lock. Globally unique per (source_environment, lock_id) (VF-XCH-013).
pub const LOCKS: Map<&str, Lock> = Map::new("locks");

/// Handshake allowance counter per bound identity (source_account) (VF-COM-006/007).
/// Stores the number of successful qualifying Handshakes consumed; increments atomically on success.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, Default, PartialEq, Eq, JsonSchema)]
pub struct AllowanceCounter {
    pub used: u32,
}

pub const HANDSHAKE_USED: Map<&Addr, AllowanceCounter> = Map::new("hs_used");

/// CHONX activation flag (off-chain-set proof of activation at creation, VF-COM-025).
/// In a non-production prototype this is a simple boolean set at instantiation time to model the
/// causal activation receipt; the production design receives activation evidence via the proof path.
pub const CHONX_ACTIVATED: Item<bool> = Item::new("chonx_activated");