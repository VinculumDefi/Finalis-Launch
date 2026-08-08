# Cosmos Hub (cosmoshub-4) Deployment-Compatibility Report — `vf-cosmos-hub-vault`

**Access date/time (UTC):** 2026-07-29, ~09:44–10:45 UTC
**Scope:** Can an ordinary external account currently upload, instantiate, and execute this CosmWasm contract (built against `cosmwasm-std =2.1.3`) directly on cosmoshub-4 mainnet?
**Method:** read-only live RPC/REST queries against cosmoshub-4; Gaia v27.5.0 source/`go.mod`; wasmd v0.60.7 proto/README; chain-registry. No deployment, no writes, no fund transfer. Contract source was read only — not modified.

---

## 1. Executive conclusion

**Decision: A. DIRECTLY DEPLOYABLE.**

An ordinary external account can upload (`MsgStoreCode`), instantiate (`MsgInstantiateContract`), and execute (`MsgExecuteContract`) this contract directly on cosmoshub-4 under the **current** on-chain parameters:

- The x/wasm module is **registered and active** on the running mainnet (live `cosmwasm.wasm.v1` query routes return data, and uploaded `code_id`s 1–N already exist).
- Live wasm params: `code_upload_access = Everybody`, `instantiate_default_permission = Everybody`.
- `cosmwasm-std 2.1.3` is compatible with the running `wasmvm v2.3.3` (both CosmWasm 2.x; interface backward-compatible per wasmd README).
- The contract's chain assumptions (HRP `cosmos`, denom `uatom`, `source_environment = "cosmoshub-4"`, mainnet fixture rejection) all match cosmoshub-4.

**Caveats (non-blocking):**
- The contract must be instantiated with **`admin: None`** to complete its no-admin design (see §6). The contract has no `migrate`/`sudo`/`reply` entry points, so even a set admin could not upgrade it — but `admin: None` is required so the on-chain `admin` field is empty.
- The optimized artifact must be built with `cosmwasm/optimizer:0.16.x` (NOT `0.17.0+`, which produces CosmWasm-3.0-only artifacts).
- The final authoritative compatibility gate is the chain's own `wasmvm` `check_wasm` at `MsgStoreCode` time; `cosmwasm-check 2.1.3` (run by the verification package) is the pre-upload equivalent.

> **Note on prior claims:** Some older community discussion (e.g., the "Cosmos Hub Adds EVM — But What About CosmWasm?" forum thread, and rejected Proposal #69 "Include CosmWasm in Rho Upgrade") states the Hub "never enabled permissionless CosmWasm." That is **outdated relative to the live state**: Gaia integrated `wasmd` in v25.0.0 (2025-06-20) and the live on-chain params now read `Everybody/Everybody` with codes already stored. The live RPC/REST evidence in §2–§3 is authoritative and overrides the older forum claim.

---

## 2. Live-chain evidence

### 2.1 Running mainnet software

**Query (Tendermint RPC):** `GET https://cosmos-rpc.polkachu.com/status`
**Result (200):**
```json
{
  "result": {
    "node_info": { "network": "cosmoshub-4", "version": "0.38.22", "protocol_version": {"block":"11"} },
    "sync_info": { "latest_block_height": "32252892",
                   "latest_block_time": "2026-07-29T10:15:19.022698994Z",
                   "catching_up": false }
  }
}
```
- `network = cosmoshub-4` (confirmed), height 32252892, block time 2026-07-29T10:15:19Z, not catching up (a synced mainnet node).
- `node_info.version = 0.38.22` is the **CometBFT** consensus-engine version, not the app version.

**Query (ABCI Info — app version):** `GET https://cosmos-rpc.polkachu.com/abci_info`
**Result (200):**
```json
{ "result": { "response": { "data": "GaiaApp", "version": "v27.5.0",
                           "last_block_height": "32252894",
                           "last_block_app_hash": "6CMVv9HZ9GdLPHRMoxOVXUvUjU+qv4pxTfh3/QgSxD0=" } } }
```
- **Running app: Gaia `v27.5.0`** (the `version` field is the Gaia app version). Matches the chain-registry `recommended_version: v27.5.0`.

**Chain registry (`cosmos/chain-registry` cosmoshub/chain.json):** `chain_id: cosmoshub-4`, `bech32_prefix: cosmos`, `daemon: gaiad`, `codebase.recommended_version: v27.5.0`, `consensus: CometBFT v0.38.23`, `sdk: v0.53.4`, `ibc: v10.7.0`, `cosmwasm: wasmd v0.60.7`.
URL: https://raw.githubusercontent.com/cosmos/chain-registry/master/cosmoshub/chain.json

**Gaia v27.5.0 release notes** (CHANGELOG, v27.5.0 dated 2026-06-19): dependency bump only (ibc-go 10.6.0→10.7.0). The major CosmWasm-integration release was **v25.0.0 (2025-06-20)** ("Bump wasmd to v0.60.1, wasmvm to v2.2.4" — STATE BREAKING); **v26.0.0 (2026-02-09)** added "stake validation to vote messages from **wasm contracts**"; **v27.6.0 (2026-07-17)** "Raise the max Wasm contract size from 800KB to 1.6MiB" and "Allow CosmWasm contracts read-only gRPC query access to Query/Validator and Query/Proposal". (v27.6.0 is a *future* release not yet applied — running mainnet is v27.5.0.)
URL: https://raw.githubusercontent.com/cosmos/gaia/main/CHANGELOG.md

### 2.2 Does the running binary include x/wasm? (general contracts vs. IBC 08-wasm light client)

Gaia v27.5.0 `app/app.go` imports and instantiates **both** wasm subsystems (read from the pinned release tag):

- **General-purpose x/wasm (wasmd):** imports `github.com/CosmWasm/wasmd/x/wasm`, `wasmkeeper`, `wasmtypes` (`app.go:67–69`); constructs `app.WasmKeeper` and calls `app.WasmKeeper.InitializePinnedCodes(ctx)` (`app.go:321`, `app.go:352–353`); registers `WasmConfig` + `TXCounterStoreService` keyed on `wasmtypes.StoreKey` (`app.go:289–290`).
- **IBC 08-wasm light client (constrained Wasm):** imports `github.com/cosmos/ibc-go/modules/light-clients/08-wasm/v10` (`app.go:21–23`); `ibcwasm.NewLightClientModule(app.WasmClientKeeper, …)` + `clientKeeper.AddRoute(ibcwasmtypes.ModuleName, …)` (`app.go:195–197`); `ibcwasmkeeper.NewWasmSnapshotter(…, &app.WasmClientKeeper)` (`app.go:322`).

`go.mod` (Gaia v27.5.0):
```
github.com/CosmWasm/wasmd v0.60.7
github.com/CosmWasm/wasmvm/v2 v2.3.3
github.com/cosmos/ibc-go/modules/light-clients/08-wasm/v10 v10.5.0
```

**Conclusion:** the running binary includes the general-purpose `x/wasm` module (not *only* the 08-wasm light client). The presence of `app.WasmKeeper` + pinned-code initialization, plus the live query/params/codes responses below, confirms general-purpose CosmWasm is wired into the app (per the user's instruction, this is not inferred from `go.mod` alone — it is corroborated by `app.go` module wiring and live query responses).

### 2.3 Mainnet transaction services — are the wasm messages/queries accepted?

The decisive test: live REST queries to the `cosmwasm.wasm.v1` query service. (Earlier "Not Implemented" results were caused by using the **wrong REST paths** `/cosmwasm/wasm/v1/params` and `/cosmwasm/wasm/v1/codes`. The correct wasmd v0.60.7 gRPC-gateway paths — from `proto/cosmwasm/wasm/v1/query.proto` — are `/cosmwasm/wasm/v1/codes/params` (Params) and `/cosmwasm/wasm/v1/code` (Codes). With the correct paths the queries succeed.)

**Correct routes (wasmd v0.60.7 `query.proto`, lines 62–82):**
- `Codes` → `GET /cosmwasm/wasm/v1/code`
- `Params` → `GET /cosmwasm/wasm/v1/codes/params`
- `Code` → `GET /cosmwasm/wasm/v1/code/{code_id}`
- `CodeInfo` → `GET /cosmwasm/wasm/v1/code-info/{code_id}`
- `PinnedCodes` → `GET /cosmwasm/wasm/v1/codes/pinned`
- `WasmLimitsConfig` → `GET /cosmwasm/wasm/v1/wasm-limits-config`

**Live `Params` query** — `GET https://rest.cosmoshub-main.ccvalidators.com/cosmwasm/wasm/v1/codes/params` (and 5 other providers, all 200, identical):
```json
{"params":{"code_upload_access":{"permission":"Everybody","addresses":[]},
           "instantiate_default_permission":"Everybody"}}
```
Providers returning this exact value (all 200): CryptoCrew `rest.cosmoshub-main.ccvalidators.com`, kjnodes `cosmoshub.api.kjnodes.com`, NodeStake `api.cosmos.nodestake.org`, Stakin `cosmoshub.rest.stakin-nodes.com`, Allnodes/publicnode `cosmos-rest.publicnode.com`, Easy2Stake `cosmos-lcd.easy2stake.com`.

**Live `Codes` query** — `GET 'https://rest.cosmoshub-main.ccvalidators.com/cosmwasm/wasm/v1/code?pagination.limit=3'`:
```json
{"code_infos":[
  {"code_id":"1","creator":"cosmos1559zgk3mxm00qtr0zu2x5n4rh5vw704qaqj6ap",
   "data_hash":"624562D70D0010BE49CF9A834F21A0929CAEF09432DD770E7B9AE0D28AA9783A",
   "instantiate_permission":{"permission":"Everybody","addresses":[]}},
  {"code_id":"2","creator":"cosmos1559zgk3mxm00qtr0zu2x5n4rh5vw704qaqj6ap","data_hash":"169935F014BA0F62845B77FA18025A4630148852DDAFC7A2BBAF2AA291EF0CA8","instantiate_permission":{"permission":"Everybody","addresses":[]}},
  {"code_id":"3","creator":"cosmos1559zgk3mxm00qtr0zu2x5n4rh5vw704qaqj6ap", ...}
]}
```

**Live `WasmLimitsConfig`** — `GET https://rest.cosmoshub-main.ccvalidators.com/cosmwasm/wasm/v1/wasm-limits-config`:
```json
{"config":"{}"}
```
(empty config ⇒ wasmd defaults apply).

**Interpretation:** the `cosmwasm.wasm.v1` query service is registered and answering with real on-chain data; codes already exist on mainnet, uploaded by account `cosmos1559…qj6ap` and open to instantiation by anyone. Because the module's query service is registered, its message service (`MsgServiceRouter`) is also registered (same `RegisterServices` call in `app.go:242–243`), so the chain accepts `MsgStoreCode`, `MsgInstantiateContract`, `MsgExecuteContract`, `Query/ContractInfo`, and `Query/Params`.

---

## 3. Current permissions

**On-chain wasm params (live, quoted exactly):**
```json
{
  "code_upload_access": { "permission": "Everybody", "addresses": [] },
  "instantiate_default_permission": "Everybody"
}
```

| Control | Live value | Meaning for an ordinary external account |
|---|---|---|
| `code_upload_access.permission` | **`Everybody`** | Any account may submit `MsgStoreCode` to upload a compiled contract. No governance, allowlist, or specific address required. |
| `code_upload_access.addresses` | `[]` | No allowlist restriction (irrelevant when permission is `Everybody`). |
| `instantiate_default_permission` | **`Everybody`** | Newly uploaded code defaults to instantiation-by-anyone. Any account may submit `MsgInstantiateContract` for such code. |
| Per-code `instantiate_permission` (observed on existing code_id 1) | `Everybody` | Existing stored code is also open to anyone. |

- **Upload:** permissionless — `Everybody`.
- **Instantiate:** permissionless — `Everybody` (default, and observed on existing codes).
- **No governance/allowlist/specific-address gate** is present in the params.
- **Maximum WASM size:** the `WasmLimitsConfig` query returns `{}` (defaults). Per the Gaia CHANGELOG (v27.6.0 entry: "Raise the max Wasm contract size from **800KB** to 1.6MiB"), the running **v27.5.0** limit is **800 KiB (819,200 bytes)**. The optimized artifact from `cosmwasm/optimizer:0.16.1` for this contract is far below this (unoptimized `cargo build --release` output was ~299 KB; optimized will be smaller). No size risk.
- **Gas/fee:** standard cosmoshub-4 fee token is `uatom` (chain-registry `fee_tokens[0].denom = uatom`, `fixed_min_gas_price = 0.005`). Upload/instantiate/execute pay normal gas in uatom; no wasm-specific surcharge beyond `query_gas_limit` (default 3,000,000 for smart queries) applies to these txs.

**Query endpoint + command (reproducible):**
```bash
curl -s https://rest.cosmoshub-main.ccvalidators.com/cosmwasm/wasm/v1/codes/params
curl -s 'https://rest.cosmoshub-main.ccvalidators.com/cosmwasm/wasm/v1/code?pagination.limit=3'
curl -s https://rest.cosmoshub-main.ccvalidators.com/cosmwasm/wasm/v1/wasm-limits-config
```

---

## 4. Version compatibility

| Layer | Component | Version | Source | Compatible with `cosmwasm-std 2.1.3`? |
|---|---|---|---|---|
| Source | `cosmwasm-std` | =2.1.3 | `contracts/vault/Cargo.toml` (workspace deps) | — (this is the contract's own version) |
| Source | `cw-storage-plus` / `cw2` | =2.0.0 | workspace deps | ✓ same 2.x line |
| Optimizer | `cosmwasm/optimizer` | **0.16.x** (package pins 0.16.1) | verification package | ✓ 0.16.x targets CosmWasm 2.x. **Must NOT use 0.17.0+** (produces artifacts requiring CosmWasm 3.0 on-chain). |
| On-chain VM | `wasmvm` | **v2.3.3** | Gaia v27.5.0 `go.mod` (`github.com/CosmWasm/wasmvm/v2 v2.3.3`) | ✓ see below |
| On-chain host | `wasmd` | v0.60.7 | Gaia v27.5.0 `go.mod` | ✓ |

**On-chain VM compatibility statement (authoritative):** the wasmd README "Compatibility" section states verbatim:
> "Since CosmWasm 1.0 the contract-host interface has not changed in a breaking way. Also CosmWasm 2.0 contracts remain compatible at the Wasm interface level."
URL: https://github.com/CosmWasm/wasmd#compatibility

`cosmwasm-std 2.1.3` is within the CosmWasm **2.x** line; the running `wasmvm v2.3.3` is also 2.x. Per the wasmd statement, a 2.x contract is accepted at the Wasm interface level by wasmvm 2.x. The `wasmvm` version is set by the chain (Gaia `go.mod`), not by the contract.

**Separation of compatibility concerns:**
- **Source-level:** the contract compiles cleanly against `cosmwasm-std =2.1.3` (verified: 45/45 unit tests pass). ✓
- **Optimizer/toolchain:** the canonical optimized artifact must be built with `cosmwasm/optimizer:0.16.1` (Rust 1.81). `0.17.0+` bumps Rust to 1.86 and its CHANGELOG explicitly says artifacts "require CosmWasm 3.0+ on the chain and cannot be uploaded to chains running lower versions" — **incompatible with cosmoshub-4** (wasmvm 2.3.3). The package's pin to 0.16.1 is correct. ✓
- **On-chain VM:** `wasmvm v2.3.3` accepts CosmWasm 2.x contracts per the wasmd compatibility statement. The authoritative runtime gate is wasmvm's `check_wasm` of the contract's embedded `contract_api_version` at `MsgStoreCode` upload time. `cosmwasm-check --version 2.1.3` (run by the verification package) reproduces this pre-upload. The actual `MsgStoreCode` on cosmoshub-4 is the final confirmation. ✓

> Compilation success is **not** claimed as deployment support; deployment support rests on the live params (§3) and the wasmd/wasmvm version compatibility statement above.

---

## 5. Address and denomination correctness

| Item | cosmoshub-4 (live/registry) | Contract assumption | Match |
|---|---|---|---|
| Account HRP | `cosmos` (chain-registry `bech32_prefix`) | `cosmos` — `NON_PRODUCTION_DEV_FUND_FIXTURE` is `cosmos1…`; address validation uses `deps.api.addr_validate` (chain HRP) | ✓ |
| Native denom | `uatom` (chain-registry `fee_tokens[0].denom`, `staking_tokens[0].denom`) | `NATIVE_BASE_DENOM = "uatom"` (`msg.rs:62`) | ✓ |
| Decimals | 6 (micro-ATOM; `uatom` = 10⁻⁶ ATOM) | "uatom (micro-ATOM, 6 decimals)" (`msg.rs:3`) | ✓ |
| `BankMsg::Send` of `uatom` | supported (native bank module) | fee routing (`contract.rs:235–238`) + release (`contract.rs:310–313`) both use `BankMsg::Send` of `uatom` | ✓ |
| Unsupported chain features required? | none beyond standard x/wasm + x/bank | contract uses only `BankMsg`, `Storage`, `api.addr_validate`/`addr_humanize`, `Event`; no IBC, no Stargate, no staking callbacks, no `Reply`/`Migrate`/`Sudo` | ✓ |

No unsupported chain feature is required. The contract's `requires_iterator` export (standard) is satisfied by wasmvm 2.3.3.

---

## 6. Deployment-admin semantics (from wasmd documentation)

- **`MsgInstantiateContract.admin`** is a field on the instantiate message carrying a bech32 address (or empty). It is supplied by the **sender** of the instantiate tx; it is **not** a property of the stored code or the wasm bytecode.
- **Instantiate with no administrator:** set `admin` to the empty string `""` (equivalently, omit/nil the field). With `admin = ""`, no account can later `Migrate` or `UpdateAdmin` the contract instance.
- **`QueryContractInfo` representation of an unset admin:** the `cosmwasm.wasm.v1.Query/ContractInfo` response includes an `admin` field that is the **empty string `""`** when no admin is set. An empty `admin` is the on-chain proof of "no administrator."
- **Independence of `migrate` entry point vs. chain-level `admin`:** these are orthogonal.
  - The `admin` field is a per-instance deployment parameter. It can be set even if the contract exposes no `migrate` entry point (in which case the admin has no useful migration action), and can be unset even if a `migrate` entry point exists.
  - The **absence of a `migrate` entry point** is a property of the compiled bytecode (verified on the unoptimized sandbox artifact: exports = `instantiate`, `execute`, `query`, `allocate`, `deallocate`, `interface_version_8`, `requires_iterator`; `migrate`/`sudo`/`reply` absent). It is **not** proof that the on-chain `admin` is unset.
  - Therefore the contract's no-admin design is completed only by **deploying with `admin: None`** and then **confirming on-chain** via `QueryContractInfo` that `admin == ""`.
- Source: wasmd `x/wasm` package documentation (https://pkg.go.dev/github.com/CosmWasm/wasmd/x/wasm) and the wasmd README; `QueryContractInfo` proto returns `admin` as a string that is empty when unset.

**Deployment requirement for this contract:** instantiate with `admin: ""` (None). After instantiation, run `cosmwasm.wasm.v1.Query/ContractInfo` (`GET /cosmwasm/wasm/v1/contract/{address}` on the correct LCD) and verify `admin == ""`. This is independent of the bytecode-level migrate/sudo/reply absence.

---

## 7. Chain assumptions in the repository (read-only; not modified)

All assumptions are consistent with cosmoshub-4. Exact references:

| Assumption | File:line | Value | Match to cosmoshub-4 |
|---|---|---|---|
| Source environment bound into every lock | `contract.rs:25` | `pub const SOURCE_ENVIRONMENT: &str = "cosmoshub-4";` | ✓ exact chain-id |
| Native base denom | `msg.rs:62` | `pub const NATIVE_BASE_DENOM: &str = "uatom";` | ✓ |
| Denom enforcement on funds | `contract.rs:116` | `if c.denom != cfg.native_base_denom { Err(WrongDenom) }` (single native uatom coin) | ✓ |
| Funds shape (exactly one native coin) | `contract.rs:113–131` | rejects 0 coins (`NoFunds`) and multiple coins (`WrongDenom "multiple coins"`) | ✓ |
| HRP for address validation | `contract.rs:36–39`, `contract.rs:199–202`, `contract.rs:338` | `deps.api.addr_validate(...)` uses the chain's configured bech32 HRP (cosmos on cosmoshub-4); the non-production fixture is a valid `cosmos1…` address (`msg.rs:17`) | ✓ |
| EVM Base recipient format | `msg.rs:65` + `contract.rs:381–389` | `BASE_RECIPIENT_LEN = 42`; `validate_base_recipient` requires `0x` + 40 hex | n/a (cross-chain field, not a cosmoshub-4 feature; validated as string only) |
| Mainnet fixture rejection (chain-id gate) | `contract.rs:43–46` | `if is_fixture && env.block.chain_id == SOURCE_ENVIRONMENT { Err(NonProductionFixture) }` | ✓ on cosmoshub-4 the non-production Dev Fund fixture is rejected; a real `dev_fund_address` must be supplied at instantiate |
| Fee routing to immutable Dev Fund | `contract.rs:235–238` | `BankMsg::Send` of `uatom` to `cfg.dev_fund_address` | ✓ (native bank send supported) |
| Permissionless principal release | `contract.rs:295–321` | `ReleasePrincipal` callable by anyone; `BankMsg::Send` of `uatom` to bound `release_destination` at maturity | ✓ (native bank send; no admin/relayer needed) |
| Required CosmWasm capabilities | exports `instantiate`/`execute`/`query`/`requires_iterator`; no `migrate`/`sudo`/`reply` (see `lib.rs`) | standard CosmWasm 2.x capabilities | ✓ wasmvm 2.3.3 supports all |

**No mismatches found.** The single explicit "mainnet gate" is the `cosmoshub-4` chain-id check rejecting the non-production Dev Fund fixture (`contract.rs:43–46`); on mainnet this forces the deployer to supply a real Dev Fund address — which is the intended deployment gate, not an incompatibility.

**Open (non-deployment) assumption, not a chain-compatibility issue:** the contract records `verified_gross_usd_micro` as a caller-supplied input (`msg.rs:88`, `contract.rs:101`) and does not verify it on-chain — by design it is verified off-chain by the proof path. This does not affect deployability.

---

## 8. Decision

**A. DIRECTLY DEPLOYABLE.**

An ordinary external account can upload and instantiate `vf-cosmos-hub-vault` on cosmoshub-4 under the current live parameters (`code_upload_access = Everybody`, `instantiate_default_permission = Everybody`), with `cosmwasm-std 2.1.3` compatible against the running `wasmvm v2.3.3`, and all chain assumptions matching cosmoshub-4.

**Required at instantiation (not a permission barrier, a contract design gate):** set `admin: ""` (None) and supply a real `dev_fund_address` (the non-production fixture is rejected on cosmoshub-4). After instantiation, confirm `QueryContractInfo.admin == ""`.

**Final runtime gate (not yet executed here):** the chain's `wasmvm check_wasm` at `MsgStoreCode`. The verification package's `cosmwasm-check --version 2.1.3` is the pre-upload equivalent; the actual on-chain `MsgStoreCode` is the authoritative confirmation.

---

## Reproducible live-query commands (read-only, safe to run)

```bash
# Running app version (Gaia)
curl -s https://cosmos-rpc.polkachu.com/abci_info | jq -r .result.response.version

# Network + height
curl -s https://cosmos-rpc.polkachu.com/status | jq -r '.result.node_info.network, .result.sync_info.latest_block_height, .result.sync_info.latest_block_time'

# Wasm module params (upload + instantiate permissions)
curl -s https://rest.cosmoshub-main.ccvalidators.com/cosmwasm/wasm/v1/codes/params

# Existing uploaded codes
curl -s 'https://rest.cosmoshub-main.ccvalidators.com/cosmwasm/wasm/v1/code?pagination.limit=5'

# Wasm limits config (max size defaults)
curl -s https://rest.cosmoshub-main.ccvalidators.com/cosmwasm/wasm/v1/wasm-limits-config
```

## Sources (direct URLs)

- Live RPC: https://cosmos-rpc.polkachu.com/abci_info , /status
- Live REST (wasm): https://rest.cosmoshub-main.ccvalidators.com/cosmwasm/wasm/v1/codes/params , /code , /wasm-limits-config
- Chain registry: https://raw.githubusercontent.com/cosmos/chain-registry/master/cosmoshub/chain.json
- Gaia v27.5.0 app.go: https://raw.githubusercontent.com/cosmos/gaia/v27.5.0/app/app.go
- Gaia v27.5.0 go.mod: https://raw.githubusercontent.com/cosmos/gaia/v27.5.0/go.mod
- Gaia CHANGELOG: https://raw.githubusercontent.com/cosmos/gaia/main/CHANGELOG.md
- wasmd v0.60.7 query.proto: https://raw.githubusercontent.com/CosmWasm/wasmd/v0.60.7/proto/cosmwasm/wasm/v1/query.proto
- wasmd README (compatibility): https://github.com/CosmWasm/wasmd#compatibility
- wasmd x/wasm docs (admin/ContractInfo): https://pkg.go.dev/github.com/CosmWasm/wasmd/x/wasm
- (Context only) Forum: https://forum.cosmos.network/t/cosmos-hub-adds-evm-but-what-about-cosmwasm/15698 ; rejected Proposal #69: https://forum.cosmos.network/t/proposal-69-rejected-include-cosmwasm-in-rho-upgrade/6243