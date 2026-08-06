# cosmos-hub-vault — RED-TEAM / NON-PRODUCTION build & test notes

> **NOT production-ready. NOT deployment-ready.** See README.md.

## Pinned toolchain (verify against a live node before building)

| Component | Tag | Commit |
|---|---|---|
| Gaia | v27.5.0 | d089f568a9ef2f4d5e6d5660cb128782f4d1b2c0 |
| wasmd | v0.60.7 | edb607cbec61170ea89ba386d7fdb382a87bbea3 |
| Cosmos SDK | v0.53.4 | 908df9d4e2e07c2cd923d7b35f18b1e008c5106c |
| CometBFT | v0.38.23 | feb2aea4dc271d612129afc958cb844713ec792b |
| IBC-Go | v10.7.0 | 40c9dbe397c8bb385dc03cd2cfc8e36c4023a2ba |

Recommended Rust toolchain: `rust 1.78+`, `cargo`, `cosmwasm-check`, `cargo-contract` (optional),
`wasmvm`/`wasmd` local node for integration. CosmWasm target: `wasm32-unknown-unknown`.

## Exact commands (run in an environment with the toolchain)

```sh
# 1. Install the wasm target (once)
rustup target add wasm32-unknown-unknown

# 2. Format + lint
cargo fmt --all
cargo clippy --all-targets -- --deny warnings

# 3. Unit + integration tests (cw-multi-test)
cargo test --workspace --release

# 4. Compile the contract to optimized wasm
cargo build --release --target wasm32-unknown-unknown --lib
# optimize (deterministic):
docker run --rm -v "$(pwd)/target/wasm32-unknown-unknown/release:/code" \
  cosmwasm/rust-optimizer:0.16.0
# (or) cosmwasm-check target/wasm32-unknown-unknown/release/vf_cosmos_hub_vault.wasm

# 5. Generate JSON schema
cargo run --bin schema
```

## Status (honest, as produced in the Base44 build environment)

- **Source written:** complete (instantiate/execute/query; no migrate/sudo by design).
- **Compiled:** NO — the Base44 sandbox has no `rustc`/`cargo`/`cosmwasm-check` (verified:
  `rustc: not found`, `cargo: not found`). Compilation/test was NOT executed here.
- **Tests run:** NO. The integration suite in `tests/integration.rs` is provided to run with the
  pinned toolchain. Do not report these as passing until independently reproduced (VF-VER-006/007).

## Deployment gate (production inputs still pending — VF-FEE-009, VF-DEP-001/002)

Before any mainnet consideration, ALL of the following must be completed and verified:

1. Confirm live `code_upload_access` permissionless via gRPC/CLI direct query (C1) — the REST
   `params` route is not exposed on reachable LCDs; an authoritative query requires gRPC/RPC/CLI egress.
2. Confirm the deployed wasmd enforces empty-admin migrate/admin-change rejection AND that
   migrate/sudo require the contract's own entry (C2) — verified against tagged source here; confirm
   against the running binary.
3. Build + verify the Base-side CometBFT/ICS-23 proof path (C3).
4. Provision the fixed Cosmos Hub Dev Fund destination address (C4b) — NOT the non-production fixture.
5. Define + verify Cosmos Hub finality (CometBFT commit) and pending-attempt invalidation
   (finalized source-account sequence consumption) against the live tx-validity model (C5).
6. Pin exact Gaia/SDK/wasmd/wasmvm/CometBFT/IBC-Go/ICS-23 versions against a live node (C6).
7. Reproduce all tests in a pinned local Gaia/wasmd environment (C7).

The contract `instantiate` MUST set `dev_fund_address` to the real production address; the deployment
gate rejects the non-production fixture (`NON_PRODUCTION_DEV_FUND_FIXTURE`) on mainnet.

## Immutability proof pointer (C2)

- `x/wasm/keeper/authz_policy.go:22-23` — `DefaultAuthorizationPolicy.CanModifyContract` =
  `admin != nil && admin.Equals(actor)` (empty admin blocks all non-gov).
- `x/wasm/keeper/authz_policy.go:66-67` — `GovAuthorizationPolicy.CanModifyContract` = `return true`,
  BUT `x/wasm/keeper/keeper.go:476/512` — `migrate` requires the contract's own `migrate` entry.
- `x/wasm/keeper/keeper.go:618/636` — `Sudo` requires the contract's own `sudo` entry.
- This contract exposes neither entry; therefore no in-protocol actor (incl. governance) can alter it.
- Only a chain-level governance software upgrade (hard-fork equivalent) can — out of scope (VF-XCH-017).