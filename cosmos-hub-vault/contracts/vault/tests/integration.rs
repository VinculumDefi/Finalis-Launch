//! RED-TEAM / NON-PRODUCTION integration tests.
//!
//! These tests exercise the positive, negative, boundary, allowance (concurrency-equivalent),
//! replay, early-release, single-release, and external-dependency-independence obligations of
//! CODA Section 8 against the in-contract logic using `cw-multi-test`.
//!
//! IMPORTANT (VF-VER-006/007): a passing test count is not evidence of production readiness. These
//! tests were NOT executed in the Base44 build environment (no Rust/CosmWasm toolchain). Run them in
//! an environment with the pinned toolchain (see RED_TEAM_NOTES.md) and reproduce independently.

use cosmwasm_std::{coin, coins, Addr, Uint128};
use cw_multi_test::{App, AppBuilder, ContractWrapper, Executor};

use vf_cosmos_hub_vault::msg::{
    ExecuteMsg, HandshakeAllowanceResponse, InstantiateMsg, IsReleasedResponse, LockResponse,
    OutputToken, QueryMsg,
};

// NON-PRODUCTION Dev Fund fixture (VF-DEP-008). Distinct from a real bech32 cosmos1 address.
const DEV_FUND_FIXTURE: &str = "cosmos1VF_NON_PRODUCTION_DEV_FUND_FIXTURE_DO_NOT_USE_ON_MAINNET";
const Alice: &str = "cosmos1alice".repeat(1).as_str();
// Use cw-multi-test default addresses (the framework mints "addr" bech32-like addresses under a
// configurable prefix). Tests use framework-generated sender addresses.

const UATOM: &str = "uatom";
const DURATION_1H: u64 = 3600;
const DURATION_30D: u64 = 30 * 86_400;

fn setup() -> (App, Addr) {
    let mut app = AppBuilder::new().build(|router, _, _| {
        router.bank.init_balance(
            &Addr::unchecked("alice"),
            vec![coin(1_000_000_000u128, UATOM)],
        )
    });
    let code = ContractWrapper::new(
        vf_cosmos_hub_vault::contract::execute,
        vf_cosmos_hub_vault::contract::instantiate,
        vf_cosmos_hub_vault::contract::query,
    );
    // NOTE: deliberately NOT passing a migrate or sudo entry (C2 immutability crux).
    let code_id = app.store_code(Box::new(code));
    let contract = app
        .instantiate_contract(
            code_id,
            Addr::unchecked("alice"),
            InstantiateMsg {
                dev_fund_address: DEV_FUND_FIXTURE.to_string(),
                bech32_prefix: "cosmos".to_string(),
            },
            &[],
            "vf-cosmos-hub-vault",
            // admin = None -> empty admin -> no migrate/admin-change possible (C2).
            None,
        )
        .unwrap();
    (app, contract)
}

fn gross_for_usd(usd_micro: u128) -> Uint128 {
    // For tests, treat 1 uatom = 1 micro-USD equivalence so gross(uatom) == verified_gross_usd_micro.
    Uint128::new(usd_micro)
}

#[test]
fn positive_handshake_succeeds_and_consumes_allowance() {
    let (mut app, contract) = setup();
    let gross = gross_for_usd(1_000_000); // $1.00
    let res = app.execute_contract(
        Addr::unchecked("alice"),
        contract.clone(),
        ExecuteMsg::CommitVaultLock {
            duration_secs: DURATION_1H,
            base_recipient: "base_recipient".to_string(),
            release_destination: "alice".to_string(),
            output_token: OutputToken::Vclm,
            verified_gross_usd_micro: 1_000_000,
            lock_id: "lock-1".to_string(),
        },
        &[coin(gross.u128(), UATOM)],
    );
    assert!(res.is_ok(), "handshake should succeed: {:?}", res);
    let allow: HandshakeAllowanceResponse = app
        .wrap()
        .query_wasm_smart(contract.clone(), QueryMsg::HandshakeAllowance { identity: "alice".to_string() })
        .unwrap();
    assert_eq!(allow.used, 1);
    assert_eq!(allow.remaining, 2);
    assert_eq!(allow.allowance, 3);
}

#[test]
fn positive_three_handshakes_then_fourth_rejected_atomically() {
    let (mut app, contract) = setup();
    for i in 0..3u32 {
        let res = app.execute_contract(
            Addr::unchecked("alice"),
            contract.clone(),
            ExecuteMsg::CommitVaultLock {
                duration_secs: DURATION_1H,
                base_recipient: "base_recipient".to_string(),
                release_destination: "alice".to_string(),
                output_token: OutputToken::Vclm,
                verified_gross_usd_micro: 1_000_000,
                lock_id: format!("lock-{i}"),
            },
            &[coin(1_000_000u128, UATOM)],
        );
        assert!(res.is_ok(), "handshake {} should succeed", i);
    }
    // VF-COM-007: fourth qualifying attempt rejected before value movement.
    let res = app.execute_contract(
        Addr::unchecked("alice"),
        contract.clone(),
        ExecuteMsg::CommitVaultLock {
            duration_secs: DURATION_1H,
            base_recipient: "base_recipient".to_string(),
            release_destination: "alice".to_string(),
            output_token: OutputToken::Vclm,
            verified_gross_usd_micro: 1_000_000,
            lock_id: "lock-3b".to_string(),
        },
        &[coin(1_000_000u128, UATOM)],
    );
    assert!(res.is_err(), "fourth handshake must be rejected");
    // Atomicity: a failed attempt must not consume allowance or move assets (VF-COM-008).
    let allow: HandshakeAllowanceResponse = app
        .wrap()
        .query_wasm_smart(contract, QueryMsg::HandshakeAllowance { identity: "alice".to_string() })
        .unwrap();
    assert_eq!(allow.used, 3, "failed fourth must not consume allowance");
}

#[test]
fn negative_out_of_range_handshake_rejected() {
    let (mut app, contract) = setup();
    // $0.94 (below $0.95) -> rejected (VF-COM-003/026).
    let res = app.execute_contract(
        Addr::unchecked("alice"),
        contract.clone(),
        ExecuteMsg::CommitVaultLock {
            duration_secs: DURATION_1H,
            base_recipient: "base_recipient".to_string(),
            release_destination: "alice".to_string(),
            output_token: OutputToken::Vclm,
            verified_gross_usd_micro: 940_000,
            lock_id: "lock-oob".to_string(),
        },
        &[coin(940_000u128, UATOM)],
    );
    assert!(res.is_err());
}

#[test]
fn negative_standard_below_minimum_rejected() {
    let (mut app, contract) = setup();
    // $9.99 standard (30d) -> rejected (VF-COM-009).
    let res = app.execute_contract(
        Addr::unchecked("alice"),
        contract.clone(),
        ExecuteMsg::CommitVaultLock {
            duration_secs: DURATION_30D,
            base_recipient: "base_recipient".to_string(),
            release_destination: "alice".to_string(),
            output_token: OutputToken::Vclm,
            verified_gross_usd_micro: 9_990_000,
            lock_id: "lock-low".to_string(),
        },
        &[coin(9_990_000u128, UATOM)],
    );
    assert!(res.is_err());
}

#[test]
fn boundary_handshake_value_inclusive_at_bounds() {
    let (mut app, contract) = setup();
    for (usd, lid) in [(950_000u128, "lo"), (1_050_000u128, "hi")] {
        let res = app.execute_contract(
            Addr::unchecked("alice"),
            contract.clone(),
            ExecuteMsg::CommitVaultLock {
                duration_secs: DURATION_1H,
                base_recipient: "base_recipient".to_string(),
                release_destination: "alice".to_string(),
                output_token: OutputToken::Vclm,
                verified_gross_usd_micro: usd,
                lock_id: lid.to_string(),
            },
            &[coin(usd, UATOM)],
        );
        assert!(res.is_ok(), "inclusive bound ${} should succeed", usd as f64 / 1_000_000.0);
    }
}

#[test]
fn boundary_fee_floor_rounding_and_zero_rejection() {
    let (mut app, contract) = setup();
    // gross 1 uatom handshake: fee = floor(1*250/10000) = 0 -> rejected (VF-COM-013).
    let res = app.execute_contract(
        Addr::unchecked("alice"),
        contract.clone(),
        ExecuteMsg::CommitVaultLock {
            duration_secs: DURATION_1H,
            base_recipient: "base_recipient".to_string(),
            release_destination: "alice".to_string(),
            output_token: OutputToken::Vclm,
            verified_gross_usd_micro: 1_000_000,
            lock_id: "lock-tiny".to_string(),
        },
        &[coin(1u128, UATOM)],
    );
    assert!(res.is_err(), "zero-fee/zero-principal must be rejected");
}

#[test]
fn negative_wrong_denom_and_zero_amount_rejected() {
    let (mut app, contract) = setup();
    // wrong denom
    let res = app.execute_contract(
        Addr::unchecked("alice"),
        contract.clone(),
        ExecuteMsg::CommitVaultLock {
            duration_secs: DURATION_30D,
            base_recipient: "base_recipient".to_string(),
            release_destination: "alice".to_string(),
            output_token: OutputToken::Vclm,
            verified_gross_usd_micro: 10_000_000,
            lock_id: "lock-denom".to_string(),
        },
        &[coin(10_000_000u128, "uusd")],
    );
    assert!(res.is_err());
    // no funds
    let res2 = app.execute_contract(
        Addr::unchecked("alice"),
        contract.clone(),
        ExecuteMsg::CommitVaultLock {
            duration_secs: DURATION_30D,
            base_recipient: "base_recipient".to_string(),
            release_destination: "alice".to_string(),
            output_token: OutputToken::Vclm,
            verified_gross_usd_micro: 10_000_000,
            lock_id: "lock-nofunds".to_string(),
        },
        &[],
    );
    assert!(res2.is_err());
}

#[test]
fn negative_unpermitted_duration_rejected() {
    let (mut app, contract) = setup();
    let res = app.execute_contract(
        Addr::unchecked("alice"),
        contract.clone(),
        ExecuteMsg::CommitVaultLock {
            duration_secs: 5_000, // not in permitted set
            base_recipient: "base_recipient".to_string(),
            release_destination: "alice".to_string(),
            output_token: OutputToken::Vclm,
            verified_gross_usd_micro: 10_000_000,
            lock_id: "lock-dur".to_string(),
        },
        &[coin(10_000_000u128, UATOM)],
    );
    assert!(res.is_err());
}

#[test]
fn negative_duplicate_lock_id_rejected() {
    let (mut app, contract) = setup();
    let mk = |id: &str| ExecuteMsg::CommitVaultLock {
        duration_secs: DURATION_30D,
        base_recipient: "base_recipient".to_string(),
        release_destination: "alice".to_string(),
        output_token: OutputToken::Vclm,
        verified_gross_usd_micro: 10_000_000,
        lock_id: id.to_string(),
    };
    assert!(app
        .execute_contract(Addr::unchecked("alice"), contract.clone(), mk("dup"), &[coin(10_000_000u128, UATOM)])
        .is_ok());
    let r2 = app.execute_contract(Addr::unchecked("alice"), contract.clone(), mk("dup"), &[coin(10_000_000u128, UATOM)]);
    assert!(r2.is_err(), "duplicate lock_id must be rejected (VF-XCH-013/015)");
}

#[test]
fn negative_chonx_before_activation_rejected() {
    let (mut app, contract) = setup();
    let res = app.execute_contract(
        Addr::unchecked("alice"),
        contract.clone(),
        ExecuteMsg::CommitVaultLock {
            duration_secs: DURATION_30D,
            base_recipient: "base_recipient".to_string(),
            release_destination: "alice".to_string(),
            output_token: OutputToken::Chonx,
            verified_gross_usd_micro: 10_000_000,
            lock_id: "lock-chonx".to_string(),
        },
        &[coin(10_000_000u128, UATOM)],
    );
    assert!(res.is_err(), "CHONX before activation must be rejected (VF-COM-025)");
}

#[test]
fn release_only_after_maturity_and_only_once() {
    let (mut app, contract) = setup();
    // 1h handshake, maturity in 3600s
    app.execute_contract(
        Addr::unchecked("alice"),
        contract.clone(),
        ExecuteMsg::CommitVaultLock {
            duration_secs: DURATION_1H,
            base_recipient: "base_recipient".to_string(),
            release_destination: "alice".to_string(),
            output_token: OutputToken::Vclm,
            verified_gross_usd_micro: 1_000_000,
            lock_id: "lock-rel".to_string(),
        },
        &[coin(1_000_000u128, UATOM)],
    )
    .unwrap();
    // before maturity -> rejected (VF-PRI-006, VF-COM-016)
    let early = app.execute_any(Addr::unchecked("bob"), cosmwasm_std::CosmosMsg::Wasm(cosmwasm_std::WasmMsg::Execute {
        contract_addr: contract.to_string(),
        msg: cosmwasm_std::to_binary(&ExecuteMsg::ReleasePrincipal { lock_id: "lock-rel".to_string() }).unwrap(),
        funds: vec![],
    }));
    // cw-multi-test exposes execute_contract; use it directly:
    let early2 = app.execute_contract(
        Addr::unchecked("bob"),
        contract.clone(),
        ExecuteMsg::ReleasePrincipal { lock_id: "lock-rel".to_string() },
        &[],
    );
    let _ = early;
    assert!(early2.is_err(), "release before maturity must be rejected");
    // advance time past maturity
    app.update_block(|b| b.time = app.block_info().time.plus_seconds(3601));
    let rel = app.execute_contract(
        Addr::unchecked("bob"),
        contract.clone(),
        ExecuteMsg::ReleasePrincipal { lock_id: "lock-rel".to_string() },
        &[],
    );
    assert!(rel.is_ok(), "permissionless release after maturity must succeed (VF-PRI-004/005/006, VF-SEC-006)");
    // second release -> rejected (VF-PRI-002)
    let rel2 = app.execute_contract(
        Addr::unchecked("bob"),
        contract.clone(),
        ExecuteMsg::ReleasePrincipal { lock_id: "lock-rel".to_string() },
        &[],
    );
    assert!(rel2.is_err(), "second release must be rejected");
    let st: IsReleasedResponse = app
        .wrap()
        .query_wasm_smart(contract, QueryMsg::IsReleased { lock_id: "lock-rel".to_string() })
        .unwrap();
    assert!(st.released);
}

#[test]
fn lock_record_binds_all_immutable_facts() {
    let (mut app, contract) = setup();
    app.execute_contract(
        Addr::unchecked("alice"),
        contract.clone(),
        ExecuteMsg::CommitVaultLock {
            duration_secs: DURATION_30D,
            base_recipient: "base_recipient".to_string(),
            release_destination: "alice".to_string(),
            output_token: OutputToken::Vclm,
            verified_gross_usd_micro: 12_000_000,
            lock_id: "lock-facts".to_string(),
        },
        &[coin(12_000_000u128, UATOM)],
    )
    .unwrap();
    let l: LockResponse = app
        .wrap()
        .query_wasm_smart(contract, QueryMsg::Lock { lock_id: "lock-facts".to_string() })
        .unwrap();
    assert_eq!(l.source_environment, "cosmoshub-4");
    assert_eq!(l.canonical_asset, "uatom");
    assert_eq!(l.gross_amount.u128(), 12_000_000);
    // 5.00% fee: floor(12_000_000 * 500 / 10000) = 600_000
    assert_eq!(l.fee_amount.u128(), 600_000);
    assert_eq!(l.principal_amount.u128(), 11_400_000);
    assert_eq!(l.duration_secs, DURATION_30D);
    assert_eq!(l.maturity_time_secs, l.creation_time_secs + DURATION_30D);
    assert!(!l.released);
}

// C2 immutability note: cw-multi-test ContractWrapper above was created WITHOUT migrate/sudo entry
// points. wasmd's MsgMigrateContract/MsgSudoContract require the contract's own migrate()/sudo()
// entry, which this contract does not expose; therefore no actor — including governance — can
// replace the code or alter state via sudo. This property is asserted structurally (no such entry
// is compiled in) rather than by a runtime call, and is the subject of the wasmd source evidence
// in COSMOS_HUB_OFFICIAL_EVIDENCE.json (keeper.go:476/512, authz_policy.go:22-23/66-67).