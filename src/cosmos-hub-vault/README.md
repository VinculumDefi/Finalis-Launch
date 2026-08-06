# cosmos-hub-vault — RED-TEAM / NON-PRODUCTION

> **RED-TEAM / NON-PRODUCTION clean-room implementation. NOT PRODUCTION-READY. NOT DEPLOYMENT-READY.**
> Do **not** broadcast, upload, or instantiate this code on any mainnet. No final external addresses are
> provisioned (VF-DEP-008). The Dev Fund destination is a **conspicuous non-production test fixture** until the
> production address is set as an explicit deployment gate.

## Purpose

A no-admin CosmWasm Commitment Vault for the live Cosmos Hub (`cosmoshub-4`) holding **native ATOM (`uatom`)**,
implementing the Vinculum Finalis source-side mechanism for the Cosmos Hub environment (registry row 479,
class S3) under the chain-equivalent outcome principle (VF-XCH-017 / VF-EXT-001).

## Immutability design (C2 crux — resolved)

Verified against tagged wasmd **v0.60.7** (commit `edb607cbec61170ea89ba386d7fdb382a87bbea3`,
`x/wasm/keeper/authz_policy.go`):

- `DefaultAuthorizationPolicy.CanModifyContract(admin, actor)` = `admin != nil && admin.Equals(actor)`.
  Instantiating with `admin=""` → no actor can migrate or admin-change the contract under the default policy.
- `GovAuthorizationPolicy.CanModifyContract(...)` = `return true`. Governance is *authorized* by wasmd to
  *attempt* a migrate/admin-change, **but** `keeper.migrate` (keeper.go:460) invokes the contract's own
  `migrate` entry point. This contract **deliberately exposes NO `migrate` entry** and **NO `sudo` entry**,
  so any migrate/sudo call (including a governance proposal) fails at the contract level and changes no
  state. The contract's `Execute` transfers only the rounded fee to the fixed Dev Fund and never transfers
  principal out before maturity. The bank module requires the account owner's signature to spend; a contract
  account has no spendable key, so governance cannot drain the balance without a chain-level software upgrade.
- The **only** remaining alter path is a Cosmos Hub governance **software upgrade** (rewriting the Gaia binary),
  which is a chain-level social hard-fork — out of scope for the deployed-mechanism immutability analysis under
  the governing chain-equivalent principle (VF-XCH-017).

## Compilation status (honest)

- **NOT compiled and NOT tested in the Base44 build environment.** The sandbox exposes Node v20.20.2 on Linux
  but no `rustc`, `cargo`, `cosmwasm-check`, or `cargo-contract` (verified). Compilation/test must run in an
  environment with the pinned Rust/CosmWasm toolchain and a local Gaia/wasmd node.
- Exact commands and expected toolchain pins are in `Makefile` and `RED_TEAM_NOTES.md`.
- Do **not** treat this package as passing tests (VF-VER-006/007). A test count is not evidence until
  independently reproduced.

## Layout

```
cosmos-hub-vault/
  Cargo.toml                 # workspace
  README.md                  # this file
  RED_TEAM_NOTES.md           # pinned versions, exact compile/test commands, open items
  Makefile                    # reproduce commands
  contracts/vault/
    Cargo.toml
    src/lib.rs                # entry points: instantiate/execute/query ONLY (no migrate, no sudo)
    src/contract.rs           # core logic
    src/msg.rs                # message types
    src/state.rs              # state + immutable lock-fact schema
    src/error.rs
    tests/integration.rs      # positive/negative/boundary/concurrency/replay/finality/pending/immutability/release/isolation
```

## Pinned versions (to verify against a live node before compiling)

| Component | Tag | Commit (resolved) |
|---|---|---|
| Gaia | v27.5.0 | d089f568a9ef2f4d5e6d5660cb128782f4d1b2c0 |
| wasmd | v0.60.7 | edb607cbec61170ea89ba386d7fdb382a87bbea3 |
| Cosmos SDK | v0.53.4 | 908df9d4e2e07c2cd923d7b35f18b1e008c5106c |
| CometBFT | v0.38.23 | feb2aea4dc271d612129afc958cb844713ec792b (live nodes report 0.38.22) |
| IBC-Go | v10.7.0 | 40c9dbe397c8bb385dc03cd2cfc8e36c4023a2ba |
| chain-registry | cosmoshub/chain.json | chain_id=cosmoshub-4, base_denom=uatom, bech32=cosmos |