//! Core Commitment Vault logic for the Vinculum Finalis Cosmos Hub environment.
//!
//! Atomicity (VF-ARC-004, VF-SEC-002): the SDK/CosmWasm handler is atomic — any error before the
//! final state commit reverts the fee transfer, the lock store, and the allowance increment together.

use cosmwasm_std::{
    coins, to_binary, Addr, BankMsg, Binary, Deps, DepsMut, Env, Event, MessageInfo, Response, StdResult,
    Timestamp, Uint128,
};
use cw2::set_contract_version;

use crate::error::ContractError;
use crate::msg::{
    ConfigResponse, ExecuteMsg, HandshakeAllowanceResponse, InstantiateMsg, IsReleasedResponse,
    LockResponse, OutputToken, QueryMsg, DURATION_HANDSHAKE, FEE_BPS_HANDSHAKE, FEE_BPS_STANDARD,
    HANDSHAKE_ALLOWANCE, HANDSHAKE_USD_MAX_MICRO, HANDSHAKE_USD_MIN_MICRO, NATIVE_BASE_DENOM,
    NON_PRODUCTION_DEV_FUND_FIXTURE, PERMITTED_DURATIONS_SECS, STANDARD_USD_MIN_MICRO,
};
use crate::state::{AllowanceCounter, CHONX_ACTIVATED, CONFIG, HANDSHAKE_USED, LOCKS, Config, Lock};

pub const CONTRACT_NAME: &str = "vf-cosmos-hub-vault";
pub const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");
/// Source environment identifier bound into every lock (VF-XCH-011), verified live = cosmoshub-4.
pub const SOURCE_ENVIRONMENT: &str = "cosmoshub-4";

pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    _info: MessageInfo,
    msg: InstantiateMsg,
) -> Result<Response, ContractError> {
    set_contract_version(deps.storage, CONTRACT_NAME, CONTRACT_VERSION)?;
    let dev_fund = deps
        .api
        .addr_validate(&msg.dev_fund_address)
        .map_err(|e| ContractError::InvalidAddress(e.to_string()))?;
    // The non-production fixture is permitted at prototype stage (VF-DEP-008). The deployment gate
    // (VF-FEE-009) must reject it on mainnet.
    let is_fixture = dev_fund.as_str() == NON_PRODUCTION_DEV_FUND_FIXTURE;
    let cfg = Config {
        dev_fund_address: dev_fund,
        bech32_prefix: msg.bech32_prefix,
        source_environment: SOURCE_ENVIRONMENT.to_string(),
        native_base_denom: NATIVE_BASE_DENOM.to_string(),
    };
    CONFIG.save(deps.storage, &cfg)?;
    // CHONX is not active at launch (VF-TOK-002/003); activates at 10M cumulative lifetime VCLM issuance
    // off-chain, with a causal activation receipt communicated via the proof path (VF-COM-025).
    CHONX_ACTIVATED.save(deps.storage, &false)?;
    Ok(Response::new()
        .add_attribute("method", "instantiate")
        .add_attribute("source_environment", SOURCE_ENVIRONMENT)
        .add_attribute("native_base_denom", NATIVE_BASE_DENOM)
        .add_attribute("dev_fund_is_non_production_fixture", is_fixture.to_string()))
}

pub fn execute(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> Result<Response, ContractError> {
    match msg {
        ExecuteMsg::CommitVaultLock {
            duration_secs,
            base_recipient,
            release_destination,
            output_token,
            verified_gross_usd_micro,
            lock_id,
        } => commit_vault_lock(
            deps,
            env,
            info,
            duration_secs,
            base_recipient,
            release_destination,
            output_token,
            verified_gross_usd_micro,
            lock_id,
        ),
        ExecuteMsg::ReleasePrincipal { lock_id } => release_principal(deps, env, lock_id),
    }
}

#[allow(clippy::too_many_arguments)]
fn commit_vault_lock(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    duration_secs: u64,
    base_recipient: String,
    release_destination: String,
    output_token: OutputToken,
    verified_gross_usd_micro: u128,
    lock_id: String,
) -> Result<Response, ContractError> {
    let cfg = CONFIG.load(deps.storage)?;

    // VF-COM-001/002: only permitted durations.
    if !PERMITTED_DURATIONS_SECS.contains(&duration_secs) {
        return Err(ContractError::DurationNotPermitted(duration_secs));
    }

    // VF-SEC-001/003 + VF-COM-010: exactly one native uatom coin, nonzero.
    let gross: Uint128 = match info.funds.len() {
        1 => {
            let c = &info.funds[0];
            if c.denom != cfg.native_base_denom {
                return Err(ContractError::WrongDenom {
                    expected: cfg.native_base_denom.clone(),
                    got: c.denom.clone(),
                });
            }
            c.amount
        }
        0 => return Err(ContractError::NoFunds),
        _ => {
            return Err(ContractError::WrongDenom {
                expected: cfg.native_base_denom.clone(),
                got: "multiple coins".to_string(),
            })
        }
    };
    if gross.is_zero() {
        return Err(ContractError::ZeroAmount);
    }

    // VF-COM-011: fee = floor(gross * bps / 10000). VF-COM-012: principal = gross - rounded fee.
    let is_handshake = duration_secs == DURATION_HANDSHAKE;
    let bps: u128 = if is_handshake {
        FEE_BPS_HANDSHAKE.into()
    } else {
        FEE_BPS_STANDARD.into()
    };
    let gross_u128 = gross.u128();
    let fee_u128 = gross_u128.checked_mul(bps).unwrap() / 10_000u128;
    let principal_u128 = gross_u128.checked_sub(fee_u128).unwrap();
    // VF-COM-013: reject zero fee or zero principal before assets move.
    if fee_u128 == 0 || principal_u128 == 0 {
        return Err(ContractError::ZeroFeeOrPrincipal);
    }

    // VF-COM-003/009: value bounds (Verified Gross USD Value, micro-USD).
    if is_handshake {
        if verified_gross_usd_micro < HANDSHAKE_USD_MIN_MICRO
            || verified_gross_usd_micro > HANDSHAKE_USD_MAX_MICRO
        {
            return Err(ContractError::HandshakeValueOutOfRange(verified_gross_usd_micro));
        }
    } else if verified_gross_usd_micro < STANDARD_USD_MIN_MICRO {
        return Err(ContractError::StandardBelowMinimum(verified_gross_usd_micro));
    }

    // VF-COM-006/007: three-use Handshake allowance for persistent-state mechanism (CosmWasm).
    if is_handshake {
        let used = HANDSHAKE_USED
            .may_load(deps.storage, &info.sender)?
            .unwrap_or_default()
            .used;
        if used >= HANDSHAKE_ALLOWANCE {
            return Err(ContractError::AllowanceExhausted(info.sender.to_string()));
        }
    }

    // VF-COM-025: CHONX output requires activation at creation (causal receipt).
    let chonx_activated = CHONX_ACTIVATED.load(deps.storage)?;
    if output_token == OutputToken::Chonx && !chonx_activated {
        return Err(ContractError::ChonxNotActivated);
    }

    // VF-ARC-006: bind nonzero authorized Base recipient + release destination at creation.
    let release_addr = deps
        .api
        .addr_validate(&release_destination)
        .map_err(|e| ContractError::InvalidAddress(e.to_string()))?;
    if base_recipient.trim().is_empty() {
        return Err(ContractError::InvalidAddress("base_recipient empty".to_string()));
    }

    // VF-XCH-013: lock_id globally unique per (source_environment, lock_id).
    if LOCKS.has(deps.storage, &lock_id) {
        return Err(ContractError::LockAlreadyExists(lock_id.clone()));
    }

    let creation = env.block.time.seconds();
    let maturity = creation.checked_add(duration_secs).unwrap();
    let lock = Lock {
        lock_id: lock_id.clone(),
        source_environment: cfg.source_environment.clone(),
        source_account: info.sender.clone(),
        canonical_asset: cfg.native_base_denom.clone(),
        gross_amount: gross,
        fee_amount: Uint128::new(fee_u128),
        principal_amount: Uint128::new(principal_u128),
        verified_gross_usd_micro,
        duration_secs,
        creation_time_secs: creation,
        maturity_time_secs: maturity,
        base_recipient: base_recipient.clone(),
        release_destination: release_addr.clone(),
        output_token,
        chonx_activated_at_creation: chonx_activated,
        released: false,
    };

    // Atomic state transition (VF-ARC-004, VF-SEC-002): fee routing + lock store + allowance increment
    // all commit together or revert together on any error.
    let fee_msg = BankMsg::Send {
        to_address: cfg.dev_fund_address.to_string(),
        amount: coins(fee_u128, &cfg.native_base_denom),
    };
    LOCKS.save(deps.storage, &lock.lock_id, &lock)?;
    if is_handshake {
        let mut c = HANDSHAKE_USED
            .may_load(deps.storage, &info.sender)?
            .unwrap_or_default();
        c.used += 1;
        HANDSHAKE_USED.save(deps.storage, &info.sender, &c)?;
    }

    let used_now = HANDSHAKE_USED
        .may_load(deps.storage, &info.sender)?
        .unwrap_or_default()
        .used;
    let evt = Event::new("commit_vault_lock")
        .add_attribute("lock_id", &lock.lock_id)
        .add_attribute("source_environment", &lock.source_environment)
        .add_attribute("source_account", lock.source_account.as_str())
        .add_attribute("canonical_asset", &lock.canonical_asset)
        .add_attribute("gross_amount", lock.gross_amount)
        .add_attribute("fee_amount", lock.fee_amount)
        .add_attribute("principal_amount", lock.principal_amount)
        .add_attribute("verified_gross_usd_micro", lock.verified_gross_usd_micro.to_string())
        .add_attribute("duration_secs", lock.duration_secs.to_string())
        .add_attribute("creation_time_secs", lock.creation_time_secs.to_string())
        .add_attribute("maturity_time_secs", lock.maturity_time_secs.to_string())
        .add_attribute("base_recipient", &lock.base_recipient)
        .add_attribute("release_destination", lock.release_destination.as_str())
        .add_attribute("output_token", match lock.output_token {
            OutputToken::Vclm => "VCLM",
            OutputToken::Chonx => "CHONX",
        })
        .add_attribute("chonx_activated_at_creation", lock.chonx_activated_at_creation.to_string())
        .add_attribute(
            "handshake_identity",
            format!("({}, {})", lock.source_environment, lock.source_account.as_str()),
        )
        .add_attribute("handshake_allowance_count", used_now.to_string())
        .add_attribute("fee_destination", cfg.dev_fund_address.as_str());

    Ok(Response::new().add_message(fee_msg).add_event(evt))
}

fn release_principal(
    deps: DepsMut,
    env: Env,
    lock_id: String,
) -> Result<Response, ContractError> {
    let mut lock = LOCKS
        .load(deps.storage, &lock_id)
        .map_err(|_| ContractError::LockNotFound(lock_id.clone()))?;
    if lock.released {
        return Err(ContractError::AlreadyReleased(lock_id));
    }
    if env.block.time.seconds() < lock.maturity_time_secs {
        return Err(ContractError::NotMature {
            maturity: lock.maturity_time_secs,
            now: env.block.time.seconds(),
        });
    }
    let cfg = CONFIG.load(deps.storage)?;
    // VF-PRI-002/003: release exactly once, only to the bound release destination.
    let send = BankMsg::Send {
        to_address: lock.release_destination.to_string(),
        amount: coins(lock.principal_amount.u128(), &cfg.native_base_denom),
    };
    lock.released = true;
    LOCKS.save(deps.storage, &lock_id, &lock)?;
    let evt = Event::new("release_principal")
        .add_attribute("lock_id", &lock_id)
        .add_attribute("released_to", lock.release_destination.as_str())
        .add_attribute("principal_amount", lock.principal_amount);
    Ok(Response::new().add_message(send).add_event(evt))
}

pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::Lock { lock_id } => {
            let l = LOCKS.load(deps.storage, &lock_id)?;
            to_binary(&lock_to_response(&l))
        }
        QueryMsg::Config {} => {
            let c = CONFIG.load(deps.storage)?;
            to_binary(&ConfigResponse {
                dev_fund_address: c.dev_fund_address,
                bech32_prefix: c.bech32_prefix,
                source_environment: c.source_environment,
                native_base_denom: c.native_base_denom,
            })
        }
        QueryMsg::HandshakeAllowance { identity } => {
            let addr = deps.api.addr_validate(&identity)?;
            let a = HANDSHAKE_USED
                .may_load(deps.storage, &addr)?
                .unwrap_or_default();
            to_binary(&HandshakeAllowanceResponse {
                identity,
                used: a.used,
                remaining: HANDSHAKE_ALLOWANCE - a.used,
                allowance: HANDSHAKE_ALLOWANCE,
            })
        }
        QueryMsg::IsReleased { lock_id } => {
            let l = LOCKS.may_load(deps.storage, &lock_id)?;
            to_binary(&IsReleasedResponse {
                released: l.map(|x| x.released).unwrap_or(false),
                lock_id,
            })
        }
    }
}

fn lock_to_response(l: &Lock) -> LockResponse {
    LockResponse {
        lock_id: l.lock_id.clone(),
        source_environment: l.source_environment.clone(),
        source_account: l.source_account.to_string(),
        canonical_asset: l.canonical_asset.clone(),
        gross_amount: l.gross_amount,
        fee_amount: l.fee_amount,
        principal_amount: l.principal_amount,
        verified_gross_usd_micro: l.verified_gross_usd_micro,
        duration_secs: l.duration_secs,
        creation_time_secs: l.creation_time_secs,
        maturity_time_secs: l.maturity_time_secs,
        base_recipient: l.base_recipient.clone(),
        release_destination: l.release_destination.to_string(),
        output_token: l.output_token,
        chonx_activated_at_creation: l.chonx_activated_at_creation,
        released: l.released,
    }
}

// Silence unused-import warnings for symbols reserved for future proof-path hooks.
#[allow(dead_code)]
fn _reserved(_t: Timestamp) {}