//! Unit tests using `cosmwasm_std::testing` mocks (standard CosmWasm single-contract testing).
//!
//! These tests exercise the contract logic directly (validation, state, allowance, release)
//! without the multi-contract runtime, so the build does not depend on the heavyweight
//! `wasmer`-backed `cw-multi-test`. Fee routing and principal release are asserted on the
//! emitted `Response` messages (`BankMsg::Send` to the immutable Dev Fund / bound release
//! destination), which is the exact on-chain effect the contract produces; the SDK dispatches
//! those messages atomically.
//!
//! VF-VER-006/007: a passing test count is not, by itself, evidence of production readiness.

use cosmwasm_std::{
    coin, coins, from_binary,
    testing::{mock_dependencies, mock_env, mock_info, MockApi},
    BankMsg, CosmosMsg, Deps, DepsMut, Env, Response, Timestamp,
};

use crate::contract;
use crate::error::ContractError;
use crate::msg::{
    ConfigResponse, ExecuteMsg, HandshakeAllowanceResponse, InstantiateMsg, IsReleasedResponse,
    LockResponse, OutputToken, QueryMsg, HANDSHAKE_ALLOWANCE, NON_PRODUCTION_DEV_FUND_FIXTURE,
    PERMITTED_DURATIONS_SECS,
};

const ALICE: &str = "cosmos190vqdjtlpcq27xslcveglfmr4ynfwg7gqmchsn";
const BOB: &str = "cosmos1sxmr0k8u6trd5c6eu6trzyapzux7090y3u5dan";
const FIXTURE: &str = NON_PRODUCTION_DEV_FUND_FIXTURE;
const BASE: &str = "0x6a3c13a4f44c36016e2711a43581d543c96da121";
const UATOM: &str = "uatom";
const TEST_CHAIN: &str = "cosmoshub-testnet-1";
const T0: u64 = 1_000_000;
const D1H: u64 = 3600;
const D30D: u64 = 30 * 86_400;

fn env_at(t: u64) -> Env {
    let mut e = mock_env();
    e.block.time = Timestamp::from_seconds(t);
    e.block.chain_id = TEST_CHAIN.to_string();
    e
}

fn env_chain(t: u64, chain: &str) -> Env {
    let mut e = mock_env();
    e.block.time = Timestamp::from_seconds(t);
    e.block.chain_id = chain.to_string();
    e
}

/// Fresh dependencies with the contract instantiated against the non-production fixture on a
/// non-mainnet chain (TEST_CHAIN), so the fixture is accepted for prototype operation.
macro_rules! fresh {
    () => {{
        let mut d = mock_dependencies();
        d.api = MockApi::default().with_prefix("cosmos");
        contract::instantiate(
            d.as_mut(),
            env_at(T0),
            mock_info("deployer", &[]),
            InstantiateMsg {
                dev_fund_address: FIXTURE.to_string(),
            },
        )
        .unwrap();
        d
    }};
}

#[allow(clippy::too_many_arguments)]
fn commit(
    deps: DepsMut,
    env: Env,
    sender: &str,
    duration: u64,
    usd_micro: u128,
    lock_id: &str,
    output: OutputToken,
    receipt: &str,
) -> Result<Response, ContractError> {
    let info = mock_info(sender, &coins(usd_micro, UATOM));
    contract::execute(
        deps,
        env,
        info,
        ExecuteMsg::CommitVaultLock {
            duration_secs: duration,
            base_recipient: BASE.to_string(),
            release_destination: ALICE.to_string(),
            output_token: output,
            verified_gross_usd_micro: usd_micro,
            lock_id: lock_id.to_string(),
            chonx_activation_receipt: receipt.to_string(),
        },
    )
}

fn handshake(deps: DepsMut, sender: &str, lock_id: &str) {
    contract::execute(
        deps,
        env_at(T0),
        mock_info(sender, &coins(1_000_000u128, UATOM)),
        ExecuteMsg::CommitVaultLock {
            duration_secs: D1H,
            base_recipient: BASE.to_string(),
            release_destination: ALICE.to_string(),
            output_token: OutputToken::Vclm,
            verified_gross_usd_micro: 1_000_000,
            lock_id: lock_id.to_string(),
            chonx_activation_receipt: String::new(),
        },
    )
    .unwrap();
}

/// Extract every `BankMsg::Send` (to_address, amount, denom) emitted on a Response.
fn sends(res: &Response) -> Vec<(String, u128, String)> {
    res.messages
        .iter()
        .filter_map(|m| match &m.msg {
            CosmosMsg::Bank(BankMsg::Send { to_address, amount }) => amount
                .first()
                .map(|c| (to_address.clone(), c.amount.u128(), c.denom.clone())),
            _ => None,
        })
        .collect()
}

fn allowance(deps: Deps, identity: &str) -> HandshakeAllowanceResponse {
    from_binary(
        &contract::query(
            deps,
            env_at(T0),
            QueryMsg::HandshakeAllowance {
                identity: identity.to_string(),
            },
        )
        .unwrap(),
    )
    .unwrap()
}

#[test]
fn positive_handshake_succeeds_and_consumes_allowance() {
    let mut deps = fresh!();
    let res = commit(
        deps.as_mut(),
        env_at(T0),
        ALICE,
        D1H,
        1_000_000,
        "h1",
        OutputToken::Vclm,
        "",
    );
    assert!(res.is_ok(), "{:?}", res);
    let s = sends(&res.unwrap());
    assert_eq!(s, vec![(FIXTURE.to_string(), 25_000, UATOM.to_string())]); // floor(1e6*250/10000)
    assert_eq!(allowance(deps.as_ref(), ALICE).used, 1);
    assert_eq!(
        allowance(deps.as_ref(), ALICE).remaining,
        HANDSHAKE_ALLOWANCE - 1
    );
}

#[test]
fn positive_three_handshakes_then_fourth_rejected_atomically() {
    let mut deps = fresh!();
    for i in 0..3u32 {
        assert!(commit(
            deps.as_mut(),
            env_at(T0),
            ALICE,
            D1H,
            1_000_000,
            &format!("h{i}"),
            OutputToken::Vclm,
            ""
        )
        .is_ok());
    }
    let r4 = commit(
        deps.as_mut(),
        env_at(T0),
        ALICE,
        D1H,
        1_000_000,
        "h3b",
        OutputToken::Vclm,
        "",
    );
    assert!(r4.is_err(), "fourth handshake must be rejected");
    assert_eq!(allowance(deps.as_ref(), ALICE).used, 3); // VF-COM-008: failed fourth consumed no allowance
}

#[test]
fn negative_out_of_range_handshake_below_095_rejected() {
    let mut deps = fresh!();
    assert!(commit(
        deps.as_mut(),
        env_at(T0),
        ALICE,
        D1H,
        940_000,
        "x",
        OutputToken::Vclm,
        ""
    )
    .is_err());
}

#[test]
fn negative_out_of_range_handshake_above_105_rejected() {
    let mut deps = fresh!();
    assert!(commit(
        deps.as_mut(),
        env_at(T0),
        ALICE,
        D1H,
        1_100_000,
        "x",
        OutputToken::Vclm,
        ""
    )
    .is_err());
}

#[test]
fn boundary_handshake_inclusive_at_095() {
    let mut deps = fresh!();
    assert!(commit(
        deps.as_mut(),
        env_at(T0),
        ALICE,
        D1H,
        950_000,
        "lo",
        OutputToken::Vclm,
        ""
    )
    .is_ok());
}

#[test]
fn boundary_handshake_inclusive_at_105() {
    let mut deps = fresh!();
    assert!(commit(
        deps.as_mut(),
        env_at(T0),
        ALICE,
        D1H,
        1_050_000,
        "hi",
        OutputToken::Vclm,
        ""
    )
    .is_ok());
}

#[test]
fn boundary_handshake_immediately_below_095_rejected() {
    let mut deps = fresh!();
    assert!(commit(
        deps.as_mut(),
        env_at(T0),
        ALICE,
        D1H,
        949_999,
        "x",
        OutputToken::Vclm,
        ""
    )
    .is_err());
}

#[test]
fn boundary_handshake_immediately_above_105_rejected() {
    let mut deps = fresh!();
    assert!(commit(
        deps.as_mut(),
        env_at(T0),
        ALICE,
        D1H,
        1_050_001,
        "x",
        OutputToken::Vclm,
        ""
    )
    .is_err());
}

#[test]
fn boundary_standard_inclusive_at_10() {
    let mut deps = fresh!();
    assert!(commit(
        deps.as_mut(),
        env_at(T0),
        ALICE,
        D30D,
        10_000_000,
        "s10",
        OutputToken::Vclm,
        ""
    )
    .is_ok());
}

#[test]
fn boundary_standard_immediately_below_10_rejected() {
    let mut deps = fresh!();
    assert!(commit(
        deps.as_mut(),
        env_at(T0),
        ALICE,
        D30D,
        9_999_999,
        "x",
        OutputToken::Vclm,
        ""
    )
    .is_err());
}

#[test]
fn all_16_permitted_durations_accepted() {
    // Rev 6 §5.1, transcribed from the specification table — NOT read from the
    // implementation. VF-COM-001: only these durations are permitted.
    // Spec hash 5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9.
    const SPEC_5_1_DURATIONS_SECS: [u64; 16] = [
        3600,               // 1 hour   — Trust-Building Handshake
        7 * 86_400,         // 7 days
        30 * 86_400,        // 30 days
        60 * 86_400,        // 60 days
        90 * 86_400,        // 90 days
        180 * 86_400,       // 180 days
        365 * 86_400,       // 365 days
        730 * 86_400,       // 730 days
        1_095 * 86_400,     // 1,095 days
        1_460 * 86_400,     // 1,460 days
        1_825 * 86_400,     // 1,825 days
        2_190 * 86_400,     // 2,190 days
        2_555 * 86_400,     // 2,555 days
        2_920 * 86_400,     // 2,920 days
        3_285 * 86_400,     // 3,285 days
        3_650 * 86_400,     // 3,650 days
    ];

    // VF-COM-001/002: the implementation's table must equal §5.1 exactly —
    // no missing entries, no additions, no duplicates.
    assert_eq!(
        PERMITTED_DURATIONS_SECS.len(),
        16,
        "implementation table must hold exactly 16 entries, found {}",
        PERMITTED_DURATIONS_SECS.len()
    );

    for &d in SPEC_5_1_DURATIONS_SECS.iter() {
        assert!(
            PERMITTED_DURATIONS_SECS.contains(&d),
            "§5.1 duration {}s ({} days) is missing from the implementation table",
            d,
            d / 86_400
        );
    }

    for &d in PERMITTED_DURATIONS_SECS.iter() {
        assert!(
            SPEC_5_1_DURATIONS_SECS.contains(&d),
            "implementation permits {}s ({} days), which §5.1 does not",
            d,
            d / 86_400
        );
    }

    // Every §5.1 duration must be accepted through the production commit path.
    let mut deps = fresh!();
    for (i, &d) in SPEC_5_1_DURATIONS_SECS.iter().enumerate() {
        let usd = if d == D1H { 1_000_000u128 } else { 10_000_000u128 };
        let r = commit(
            deps.as_mut(),
            env_at(T0),
            ALICE,
            d,
            usd,
            &format!("d{i}"),
            OutputToken::Vclm,
            "",
        );
        assert!(
            r.is_ok(),
            "§5.1 duration {}s ({} days) must be permitted: {:?}",
            d,
            d / 86_400,
            r.err()
        );
    }
}

#[test]
fn durations_outside_section_5_1_rejected() {
    // Regression guard for CL-74. Each value below was accepted by the
    // implementation's table while absent from Rev 6 §5.1.
    let mut deps = fresh!();
    let cases: [(u64, &str); 3] = [
        (14 * 86_400, "14 days — not in §5.1"),
        (120 * 86_400, "120 days — §10.1 staking term, not a §5.1 lock duration"),
        (2_592 * 86_400, "2,592 days — seconds-value transposed into a days slot"),
    ];
    for (i, (d, why)) in cases.iter().enumerate() {
        let r = commit(
            deps.as_mut(),
            env_at(T0),
            ALICE,
            *d,
            10_000_000u128,
            &format!("cl74n{i}"),
            OutputToken::Vclm,
            "",
        );
        assert!(r.is_err(), "{}s must be rejected — {}", d, why);
    }
}

#[test]
fn adjacent_unpermitted_durations_rejected() {
    let mut deps = fresh!();
    for &d in &[3601u64, 6 * 86_400, 8 * 86_400, 100 * 86_400] {
        let usd = if d < D1H {
            1_000_000u128
        } else {
            10_000_000u128
        };
        assert!(
            commit(
                deps.as_mut(),
                env_at(T0),
                ALICE,
                d,
                usd,
                "x",
                OutputToken::Vclm,
                ""
            )
            .is_err(),
            "duration {d}s must be rejected"
        );
    }
}

#[test]
fn fee_floor_rounding_5pct() {
    let mut deps = fresh!();
    let res = commit(
        deps.as_mut(),
        env_at(T0),
        ALICE,
        D30D,
        10_000_001,
        "f5",
        OutputToken::Vclm,
        "",
    )
    .unwrap();
    assert_eq!(sends(&res)[0].1, 500_000); // floor(10_000_001*500/10000)=500_000
    let l: LockResponse = from_binary(
        &contract::query(
            deps.as_ref(),
            env_at(T0),
            QueryMsg::Lock {
                lock_id: "f5".to_string(),
            },
        )
        .unwrap(),
    )
    .unwrap();
    assert_eq!(l.fee_amount.u128(), 500_000);
    assert_eq!(l.principal_amount.u128(), 9_500_001);
}

#[test]
fn fee_floor_rounding_2_5pct_handshake() {
    let mut deps = fresh!();
    // 1_000_020 is within the handshake USD range [0.95, 1.05]; its 2.5% fee is 25000.5, which
    // must be FLOOR-truncated to 25000 (not rounded to 25001) — demonstrating floor rounding.
    let res = commit(
        deps.as_mut(),
        env_at(T0),
        ALICE,
        D1H,
        1_000_020,
        "f25",
        OutputToken::Vclm,
        "",
    )
    .unwrap();
    assert_eq!(sends(&res)[0].1, 25_000); // floor(1_000_020*250/10000)=floor(25000.5)=25000
    let l: LockResponse = from_binary(
        &contract::query(
            deps.as_ref(),
            env_at(T0),
            QueryMsg::Lock {
                lock_id: "f25".to_string(),
            },
        )
        .unwrap(),
    )
    .unwrap();
    assert_eq!(l.fee_amount.u128(), 25_000);
    assert_eq!(l.principal_amount.u128(), 975_020);
}

#[test]
fn zero_fee_rejected() {
    let mut deps = fresh!();
    assert!(commit(
        deps.as_mut(),
        env_at(T0),
        ALICE,
        D1H,
        1,
        "z",
        OutputToken::Vclm,
        ""
    )
    .is_err()); // fee=0
}

// (removed: direct helper)

#[test]
fn wrong_denom_rejected() {
    let mut deps = fresh!();
    let r = contract::execute(
        deps.as_mut(),
        env_at(T0),
        mock_info(ALICE, &[coin(10_000_000u128, "uusd")]),
        ExecuteMsg::CommitVaultLock {
            duration_secs: D30D,
            base_recipient: BASE.to_string(),
            release_destination: ALICE.to_string(),
            output_token: OutputToken::Vclm,
            verified_gross_usd_micro: 10_000_000,
            lock_id: "wd".to_string(),
            chonx_activation_receipt: String::new(),
        },
    );
    assert!(r.is_err());
}

#[test]
fn multiple_denoms_rejected() {
    let mut deps = fresh!();
    let r = contract::execute(
        deps.as_mut(),
        env_at(T0),
        mock_info(
            ALICE,
            &[coin(5_000_000u128, UATOM), coin(5_000_000u128, "uusd")],
        ),
        ExecuteMsg::CommitVaultLock {
            duration_secs: D30D,
            base_recipient: BASE.to_string(),
            release_destination: ALICE.to_string(),
            output_token: OutputToken::Vclm,
            verified_gross_usd_micro: 10_000_000,
            lock_id: "md".to_string(),
            chonx_activation_receipt: String::new(),
        },
    );
    assert!(r.is_err());
}

#[test]
fn no_funds_rejected() {
    let mut deps = fresh!();
    let r = contract::execute(
        deps.as_mut(),
        env_at(T0),
        mock_info(ALICE, &[]),
        ExecuteMsg::CommitVaultLock {
            duration_secs: D30D,
            base_recipient: BASE.to_string(),
            release_destination: ALICE.to_string(),
            output_token: OutputToken::Vclm,
            verified_gross_usd_micro: 10_000_000,
            lock_id: "nf".to_string(),
            chonx_activation_receipt: String::new(),
        },
    );
    assert!(r.is_err());
}

#[test]
fn zero_amount_rejected() {
    let mut deps = fresh!();
    let r = contract::execute(
        deps.as_mut(),
        env_at(T0),
        mock_info(ALICE, &[coin(0u128, UATOM)]),
        ExecuteMsg::CommitVaultLock {
            duration_secs: D30D,
            base_recipient: BASE.to_string(),
            release_destination: ALICE.to_string(),
            output_token: OutputToken::Vclm,
            verified_gross_usd_micro: 10_000_000,
            lock_id: "za".to_string(),
            chonx_activation_receipt: String::new(),
        },
    );
    assert!(r.is_err());
}

#[test]
fn failed_attempt_consumes_no_allowance() {
    let mut deps = fresh!();
    assert!(commit(
        deps.as_mut(),
        env_at(T0),
        ALICE,
        D1H,
        500_000,
        "bad",
        OutputToken::Vclm,
        ""
    )
    .is_err());
    assert_eq!(allowance(deps.as_ref(), ALICE).used, 0);
}

#[test]
fn duplicate_lock_id_rejected() {
    let mut deps = fresh!();
    assert!(commit(
        deps.as_mut(),
        env_at(T0),
        ALICE,
        D30D,
        10_000_000,
        "dup",
        OutputToken::Vclm,
        ""
    )
    .is_ok());
    assert!(commit(
        deps.as_mut(),
        env_at(T0),
        ALICE,
        D30D,
        10_000_000,
        "dup",
        OutputToken::Vclm,
        ""
    )
    .is_err());
}

#[test]
fn malformed_lock_id_empty_rejected() {
    let mut deps = fresh!();
    assert!(commit(
        deps.as_mut(),
        env_at(T0),
        ALICE,
        D30D,
        10_000_000,
        "",
        OutputToken::Vclm,
        ""
    )
    .is_err());
}

#[test]
fn malformed_lock_id_whitespace_rejected() {
    let mut deps = fresh!();
    assert!(commit(
        deps.as_mut(),
        env_at(T0),
        ALICE,
        D30D,
        10_000_000,
        "has space",
        OutputToken::Vclm,
        ""
    )
    .is_err());
}

fn commit_with_base(deps: DepsMut, base: &str) -> Result<Response, ContractError> {
    contract::execute(
        deps,
        env_at(T0),
        mock_info(ALICE, &[coin(10_000_000u128, UATOM)]),
        ExecuteMsg::CommitVaultLock {
            duration_secs: D30D,
            base_recipient: base.to_string(),
            release_destination: ALICE.to_string(),
            output_token: OutputToken::Vclm,
            verified_gross_usd_micro: 10_000_000,
            lock_id: "bp".to_string(),
            chonx_activation_receipt: String::new(),
        },
    )
}

#[test]
fn malformed_base_recipient_no_prefix_rejected() {
    let mut deps = fresh!();
    assert!(commit_with_base(deps.as_mut(), "6a3c13a4f44c36016e2711a43581d543c96da121").is_err());
}

#[test]
fn malformed_base_recipient_wrong_length_rejected() {
    let mut deps = fresh!();
    assert!(commit_with_base(deps.as_mut(), "0x6a3c").is_err());
}

#[test]
fn vclm_creation_succeeds() {
    let mut deps = fresh!();
    let res = commit(
        deps.as_mut(),
        env_at(T0),
        ALICE,
        D30D,
        12_000_000,
        "v1",
        OutputToken::Vclm,
        "",
    )
    .unwrap();
    assert_eq!(sends(&res)[0].0, FIXTURE);
    let l: LockResponse = from_binary(
        &contract::query(
            deps.as_ref(),
            env_at(T0),
            QueryMsg::Lock {
                lock_id: "v1".to_string(),
            },
        )
        .unwrap(),
    )
    .unwrap();
    assert_eq!(l.output_token, OutputToken::Vclm);
    assert_eq!(l.chonx_activation_receipt, "not_applicable");
}

#[test]
fn chonx_before_activation_rejected() {
    let mut deps = fresh!();
    assert!(commit(
        deps.as_mut(),
        env_at(T0),
        ALICE,
        D30D,
        10_000_000,
        "c0",
        OutputToken::Chonx,
        ""
    )
    .is_err());
}

#[test]
fn chonx_with_receipt_accepted() {
    let mut deps = fresh!();
    assert!(commit(
        deps.as_mut(),
        env_at(T0),
        ALICE,
        D30D,
        10_000_000,
        "c1",
        OutputToken::Chonx,
        "activation:block:900000"
    )
    .is_ok());
    let l: LockResponse = from_binary(
        &contract::query(
            deps.as_ref(),
            env_at(T0),
            QueryMsg::Lock {
                lock_id: "c1".to_string(),
            },
        )
        .unwrap(),
    )
    .unwrap();
    assert_eq!(l.output_token, OutputToken::Chonx);
    assert_eq!(l.chonx_activation_receipt, "activation:block:900000");
}

#[test]
fn chonx_with_not_applicable_receipt_rejected() {
    let mut deps = fresh!();
    assert!(commit(
        deps.as_mut(),
        env_at(T0),
        ALICE,
        D30D,
        10_000_000,
        "c2",
        OutputToken::Chonx,
        "not_applicable"
    )
    .is_err());
}

#[test]
fn later_activation_never_cures_earlier_invalid_lock() {
    let mut deps = fresh!();
    assert!(commit(
        deps.as_mut(),
        env_at(T0),
        ALICE,
        D30D,
        10_000_000,
        "early",
        OutputToken::Chonx,
        ""
    )
    .is_err());
    let q = contract::query(
        deps.as_ref(),
        env_at(T0),
        QueryMsg::Lock {
            lock_id: "early".to_string(),
        },
    );
    assert!(q.is_err(), "the rejected CHONX lock must not exist");
    assert!(commit(
        deps.as_mut(),
        env_at(T0),
        ALICE,
        D30D,
        10_000_000,
        "late",
        OutputToken::Chonx,
        "activation:block:900000"
    )
    .is_ok());
}

#[test]
fn exact_fee_transfer_to_immutable_fixture_destination() {
    let mut deps = fresh!();
    let res = commit(
        deps.as_mut(),
        env_at(T0),
        ALICE,
        D30D,
        12_000_000,
        "ef",
        OutputToken::Vclm,
        "",
    )
    .unwrap();
    let s = sends(&res);
    assert_eq!(s.len(), 1);
    assert_eq!(s[0].0, FIXTURE);
    assert_eq!(s[0].1, 600_000); // floor(12e6*500/10000)
}

#[test]
fn no_alternate_fee_destination() {
    let mut deps = fresh!();
    let res = commit(
        deps.as_mut(),
        env_at(T0),
        ALICE,
        D30D,
        10_000_000,
        "na",
        OutputToken::Vclm,
        "",
    )
    .unwrap();
    assert_eq!(
        sends(&res),
        vec![(FIXTURE.to_string(), 500_000, UATOM.to_string())]
    );
}

#[test]
fn principal_retained_before_maturity() {
    let mut deps = fresh!();
    commit(
        deps.as_mut(),
        env_at(T0),
        ALICE,
        D30D,
        10_000_000,
        "pr",
        OutputToken::Vclm,
        "",
    )
    .unwrap();
    let r = contract::execute(
        deps.as_mut(),
        env_at(T0 + 10),
        mock_info(BOB, &[]),
        ExecuteMsg::ReleasePrincipal {
            lock_id: "pr".to_string(),
        },
    );
    assert!(r.is_err());
}

#[test]
fn permissionless_release_at_maturity_by_any_sender() {
    let mut deps = fresh!();
    commit(
        deps.as_mut(),
        env_at(T0),
        ALICE,
        D1H,
        1_000_000,
        "rl",
        OutputToken::Vclm,
        "",
    )
    .unwrap();
    let res = contract::execute(
        deps.as_mut(),
        env_at(T0 + D1H + 1),
        mock_info(BOB, &[]),
        ExecuteMsg::ReleasePrincipal {
            lock_id: "rl".to_string(),
        },
    )
    .unwrap();
    let s = sends(&res);
    assert_eq!(s.len(), 1);
    assert_eq!(s[0].0, ALICE); // released to bound destination, not the caller BOB
}

#[test]
fn exact_principal_amount_released() {
    let mut deps = fresh!();
    commit(
        deps.as_mut(),
        env_at(T0),
        ALICE,
        D1H,
        1_000_000,
        "ep",
        OutputToken::Vclm,
        "",
    )
    .unwrap();
    let res = contract::execute(
        deps.as_mut(),
        env_at(T0 + D1H + 1),
        mock_info(BOB, &[]),
        ExecuteMsg::ReleasePrincipal {
            lock_id: "ep".to_string(),
        },
    )
    .unwrap();
    assert_eq!(sends(&res)[0].1, 975_000); // 1e6 - 25_000
}

#[test]
fn exactly_once_release() {
    let mut deps = fresh!();
    commit(
        deps.as_mut(),
        env_at(T0),
        ALICE,
        D1H,
        1_000_000,
        "eo",
        OutputToken::Vclm,
        "",
    )
    .unwrap();
    let env = env_at(T0 + D1H + 1);
    assert!(contract::execute(
        deps.as_mut(),
        env.clone(),
        mock_info(BOB, &[]),
        ExecuteMsg::ReleasePrincipal {
            lock_id: "eo".to_string()
        }
    )
    .is_ok());
    assert!(contract::execute(
        deps.as_mut(),
        env,
        mock_info(BOB, &[]),
        ExecuteMsg::ReleasePrincipal {
            lock_id: "eo".to_string()
        }
    )
    .is_err());
    let st: IsReleasedResponse = from_binary(
        &contract::query(
            deps.as_ref(),
            env_at(T0 + D1H + 1),
            QueryMsg::IsReleased {
                lock_id: "eo".to_string(),
            },
        )
        .unwrap(),
    )
    .unwrap();
    assert!(st.released);
}

#[test]
fn release_independent_of_external_services() {
    let mut deps = fresh!();
    commit(
        deps.as_mut(),
        env_at(T0),
        ALICE,
        D1H,
        1_000_000,
        "ri",
        OutputToken::Vclm,
        "",
    )
    .unwrap();
    let res = contract::execute(
        deps.as_mut(),
        env_at(T0 + D1H + 1),
        mock_info("anyone", &[]),
        ExecuteMsg::ReleasePrincipal {
            lock_id: "ri".to_string(),
        },
    );
    assert!(
        res.is_ok(),
        "release must succeed with no external services (VF-PRI-004/005/006)"
    );
}

#[test]
fn overflow_max_value_rejected_without_panic() {
    let mut deps = fresh!();
    let r = contract::execute(
        deps.as_mut(),
        env_at(T0),
        mock_info(ALICE, &[coin(u128::MAX, UATOM)]),
        ExecuteMsg::CommitVaultLock {
            duration_secs: D1H,
            base_recipient: BASE.to_string(),
            release_destination: ALICE.to_string(),
            output_token: OutputToken::Vclm,
            verified_gross_usd_micro: 1_000_000,
            lock_id: "ov".to_string(),
            chonx_activation_receipt: String::new(),
        },
    );
    assert!(matches!(r, Err(ContractError::ArithmeticOverflow)));
}

#[test]
fn configuration_immutable_no_setter() {
    let deps = fresh!();
    let c: ConfigResponse =
        from_binary(&contract::query(deps.as_ref(), env_at(T0), QueryMsg::Config {}).unwrap())
            .unwrap();
    assert_eq!(c.dev_fund_address, FIXTURE);
    assert_eq!(c.source_environment, "cosmoshub-4");
    assert_eq!(c.native_base_denom, "uatom");
    // No ExecuteMsg variant alters Config; only CommitVaultLock and ReleasePrincipal exist.
}

#[test]
fn mainnet_rejects_non_production_fixture() {
    let mut deps = mock_dependencies();
    deps.api = MockApi::default().with_prefix("cosmos");
    let r = contract::instantiate(
        deps.as_mut(),
        env_chain(T0, "cosmoshub-4"),
        mock_info("deployer", &[]),
        InstantiateMsg {
            dev_fund_address: FIXTURE.to_string(),
        },
    );
    assert!(matches!(r, Err(ContractError::NonProductionFixture)));
}

#[test]
fn mainnet_accepts_real_dev_fund_address() {
    let mut deps = mock_dependencies();
    deps.api = MockApi::default().with_prefix("cosmos");
    let r = contract::instantiate(
        deps.as_mut(),
        env_chain(T0, "cosmoshub-4"),
        mock_info("deployer", &[]),
        InstantiateMsg {
            dev_fund_address: BOB.to_string(),
        },
    );
    assert!(
        r.is_ok(),
        "a real address must be accepted on mainnet: {:?}",
        r.err()
    );
}

#[test]
fn lock_record_binds_all_immutable_facts() {
    let mut deps = fresh!();
    commit(
        deps.as_mut(),
        env_at(T0),
        ALICE,
        D30D,
        12_000_000,
        "facts",
        OutputToken::Vclm,
        "",
    )
    .unwrap();
    let l: LockResponse = from_binary(
        &contract::query(
            deps.as_ref(),
            env_at(T0),
            QueryMsg::Lock {
                lock_id: "facts".to_string(),
            },
        )
        .unwrap(),
    )
    .unwrap();
    assert_eq!(l.source_environment, "cosmoshub-4");
    assert_eq!(l.canonical_asset, "uatom");
    assert_eq!(l.gross_amount.u128(), 12_000_000);
    assert_eq!(l.fee_amount.u128(), 600_000);
    assert_eq!(l.principal_amount.u128(), 11_400_000);
    assert_eq!(l.duration_secs, D30D);
    assert_eq!(l.maturity_time_secs, l.creation_time_secs + D30D);
    assert_eq!(l.base_recipient, BASE);
    assert_eq!(l.release_destination, ALICE);
    assert_eq!(l.chonx_activation_receipt, "not_applicable");
    assert!(!l.released);
}

#[test]
fn validation_helpers_directly() {
    use crate::contract::{validate_base_recipient, validate_lock_id};
    assert!(validate_base_recipient(BASE).is_ok());
    assert!(validate_base_recipient("0xabc").is_err());
    assert!(validate_base_recipient("zzz6a3c13a4f44c36016e2711a43581d543c96da121").is_err());
    assert!(validate_lock_id("lock-1").is_ok());
    assert!(validate_lock_id("").is_err());
    assert!(validate_lock_id("has space").is_err());
    assert!(validate_lock_id(&"x".repeat(200)).is_err());
}

#[test]
fn distinct_identities_get_their_own_allowance() {
    let mut deps = fresh!();
    handshake(deps.as_mut(), ALICE, "a1");
    handshake(deps.as_mut(), ALICE, "a2");
    assert_eq!(allowance(deps.as_ref(), ALICE).used, 2);
    assert_eq!(allowance(deps.as_ref(), BOB).used, 0);
}

#[test]
fn handshake_allowance_query_for_unused_identity() {
    let deps = fresh!();
    let a = allowance(deps.as_ref(), BOB);
    assert_eq!(a.used, 0);
    assert_eq!(a.remaining, HANDSHAKE_ALLOWANCE);
}