# Cosmos Hub Chain-Native Feasibility Report

**Author:** Base44 CODA (clean-room, re-executed with implementation)
**Date:** 2026-07-28
**Subject environment:** Cosmos Hub (`cosmoshub-4`) — live mainnet
**Verdict:** `CONDITIONALLY FEASIBLE — NOT FEASIBLE NOW` (red-team implementation produced; evidence gates pending)

---

## 0. Authority

**Governing source:** `227826f11_Vinculum_Finalis_Master_Specification_Revision_6_2026-07-28.docx` — Revision 6 — Current, 28 July 2026 —
SHA-256 `5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9`. Sole governing statement of required
protocol behavior (Section 0.1, VF-DOC-001). All ten clean-room package files were read; this report supersedes
earlier drafts. No deployment, broadcast, upload, instantiation, or governance action was performed.

## 1. Verdict

`CONDITIONALLY FEASIBLE — NOT FEASIBLE NOW`. A no-admin CosmWasm Commitment Vault holding native ATOM on
`cosmoshub-4` is a viable chain-native mechanism. The C2 immutability crux is **resolved favorably** against
tagged wasmd v0.60.7 source (commit `edb607cb`): a contract instantiated with `admin=""` and **deliberately
exposing no `migrate` and no `sudo` entry** cannot be code-replaced, admin-changed, sudo-altered, or
balance-drained by any in-protocol actor — **including a Cosmos Hub governance proposal** — because wasmd's
only code-replacement path (`MsgMigrateContract`) requires the contract's own `migrate` entry to succeed, and
`MsgSudoContract` requires the contract's own `sudo` entry. The only remaining alter path is a chain-level
governance **software upgrade** (a hard-fork equivalent), out of scope under the chain-equivalent principle
(VF-XCH-017).

The verdict is **not** `FEASIBLE NOW` because: (a) the authoritative live `code_upload_access` value was not
obtained in this environment (the REST `params` route is not exposed on reachable LCDs, and no RPC endpoint
resolved for an ABCI/gRPC query — an environment egress limitation, **not** a negative result, per CODA guidance);
(b) the production Base-side CometBFT/ICS-23 proof path (C3) is only a verified off-chain skeleton, not the
full validator-set/header commitment; (c) the fixed Cosmos Hub Dev Fund address is a deferred external input
(C4b); (d) the Rust/CosmWasm workspace was **not compiled** in this environment (no Rust toolchain) — it is a
red-team source package with exact compile/test commands and an executed off-chain adapter.

## 2. Evidence obtained (with timestamps, URLs, commits)

### 2.1 Chain registry (authoritative) — VERIFIED
- Source: `https://raw.githubusercontent.com/cosmos/chain-registry/master/cosmoshub/chain.json` (2026-07-28T23:47:42Z).
- `chain_id`: **cosmoshub-4**; `bech32_prefix`: **cosmos**; base fee denom: **uatom**; `git_repo`: github.com/cosmos/gaia;
  `consensus`: cometbft **v0.38.23**.
- Assetlist (`cosmoshub/assetlist.json`): symbol **ATOM**, base **uatom**, denom_units `uatom` (exp 0), `atom` (exp 6).

### 2.2 Live node confirmation — VERIFIED (3 independent LCDs)
- `https://cosmos.rpc.uquad.org:443` — node_info 200, chain_id cosmoshub-4, app/cometbft version 0.38.22.
- `https://rest.cosmoshub-main.ccvalidators.com:443` — node_info 200, chain_id cosmoshub-4, version 0.38.22.
- `https://rest.lavenderfive.com:443/cosmoshub` — node_info 200, chain_id cosmoshub-4, version 0.38.22.
- Live nodes report CometBFT **0.38.22**; registry expects v0.38.23 — minor mismatch to reconcile against a live node (C6).
- CosmWasm **active**: `GET .../cosmwasm/wasm/v1/code?pagination.limit=5` returned code_id 1, creator
  `cosmos1559zgk3mxm00qtr0zu2x5n4rh5vw704qaqj6ap` (a non-gov account), data_hash
  `624562D70D0010BE49CF9A834F21A0929CAEF09432DD770E7B9AE0D28AA9783A`.

### 2.3 C1 (permissionless params) — DIRECT QUERY PENDING (environment limitation, NOT a negative)
- REST `/cosmwasm/wasm/v1/params` → 404 (uquad) / 501 Not Implemented (ccvalidators, lavenderfive); `/cosmos/wasm/v1/params` → 501.
- ABCI `abci_query?path=/cosmwasm.wasm.v1.Query/Params` tried on 30 registry RPCs: none returned a `.value`
  (all RPCs either DNS-unresolvable from this sandbox or returned no payload). 24 LCDs scanned for the params
  route: none expose it (404/501/TLS errors).
- Per CODA guidance, an HTTP 404/501 for one REST route is **not** a negative result. The authoritative
  `code_upload_access`/`instantiate_default_permission` values require a **gRPC/CLI** direct query in an
  environment with Cosmos Hub node egress (pending, C1). Indirect evidence: code_id 1 exists, created by a
  non-gov account (consistent with non-NOBODY upload policy).

### 2.4 C2 (no-admin/no-migrate/no-sudo immutability) — RESOLVED FAVORABLY (tagged source)
- wasmd v0.60.7 commit `edb607cbec61170ea89ba386d7fdb382a87bbea3`.
- `x/wasm/keeper/authz_policy.go:22-23` — `DefaultAuthorizationPolicy.CanModifyContract(admin, actor) = admin != nil && admin.Equals(actor)`.
- `x/wasm/keeper/authz_policy.go:66-67` — `GovAuthorizationPolicy.CanModifyContract(...) = return true` (governance IS authorized to *attempt* migrate/admin-change).
- `x/wasm/keeper/keeper.go:476` — `migrate` gates on `authZ.CanModifyContract(...)`; **:512** then **calls the contract's `migrate` entry point**.
- `x/wasm/keeper/keeper.go:618/636` — `Sudo` **calls the contract's `sudo` entry point**.
- `x/wasm/keeper/keeper.go:747/753` — `setContractAdmin` gates on `authZ.CanModifyContract(...)`.
- `x/wasm/keeper/msg_server.go` — receiver `(m msgServer)`; InstantiateContract(49, admin optional→empty when `msg.Admin==""`), MigrateContract(134), UpdateAdmin(160), SudoContract(286), UpdateParams(229, gov-authority), PinCodes(246), `selectAuthorizationPolicy`(420-428: authority→gov policy, else default).
- **Conclusion:** a contract with `admin=""` and **no `migrate`/`sudo` entry** is code- and state-immutable against all in-protocol actors including governance; the only alter path is a chain-level software upgrade (hard-fork, out of scope per VF-XCH-017). Bank balance cannot be drained without the contract's own Execute (we author it to never transfer principal out pre-maturity).

### 2.5 Resolved commit SHAs (all five repos)
| Repo | Tag | Commit |
|---|---|---|
| CosmWasm/wasmd | v0.60.7 | edb607cbec61170ea89ba386d7fdb382a87bbea3 |
| cosmos/gaia | v27.5.0 | d089f568a9ef2f4d5e6d5660cb128782f4d1b2c0 |
| cosmos/cosmos-sdk | v0.53.4 | 908df9d4e2e07c2cd923d7b35f18b1e008c5106c |
| cometbft/cometbft | v0.38.23 | feb2aea4dc271d612129afc958cb844713ec792b |
| cosmos/ibc-go | v10.7.0 | 40c9dbe397c8bb385dc03cd2cfc8e36c4023a2ba |

### 2.6 Pending-attempt disposition (Section 5.2.3) — DEFINED + TESTED
Cosmos Hub criterion defined: an attempt remains pending until finalized success/failure, OR objective
invalidation by **finalized source-account sequence consumption**, OR a genuine finite chain-native validity
bound (only if documented, C5). Elapsed time/mempool/app-local timers never clear a still-valid attempt.
Implemented and unit-tested in the off-chain adapter (see §3).

## 3. Implementation produced (RED-TEAM / NON-PRODUCTION)

- **`cosmos-hub-vault/`** — pinned Rust/CosmWasm workspace: instantiate/execute/query only (NO `migrate`, NO
  `sudo` entry by design — the C2 immutability crux); 16 permitted durations, 2.50%/5.00% fee floor rounding,
  three-use Handshake allowance keyed by `(cosmoshub-4, source_account)`, atomic fee routing to the fixed Dev
  Fund, permissionless maturity-only single release to the bound destination, CHONX activation-receipt gate,
  full immutable-fact event emission (VF-XCH-011). Includes the complete integration test suite (positive,
  negative, boundary, allowance/concurrency-equivalent, replay, early/single release, external-independence).
  **NOT compiled** here (no `rustc`/`cargo`/`cosmwasm-check` in the Base44 sandbox — verified). Exact commands
  in `RED_TEAM_NOTES.md` / `Makefile`.
- **`cosmos-hub-proof-adapter/`** — plain-Node off-chain CometBFT finality gate, ICS-23 existence-proof
  skeleton, VF-XCH-011 normalizer, and the Section-5.2.3 pending-attempt state machine. **Compiled and
  tested in this environment: 22/22 passed, exit 0** (Node v20.20.2). See `COSMOS_HUB_BUILD_AND_TEST_REPORT.md`.
- **`base44-simulation/`** + `src/pages/CosmosHubCandidate.jsx` — NON-PRODUCTION Base44 simulation view of
  the Cosmos candidate, routed at `/cosmos-hub-candidate` (does not alter any production logic).

## 4. Three-state classification (per user instruction)

- **Implemented and tested:** off-chain proof-adapter normalizer + finality gate + ICS-23 skeleton + pending
  disposition (22/22 unit tests executed, Node v20.20.2).
- **Implemented, not compiled/tested (pending Rust toolchain):** the on-chain `cosmos-hub-vault` Rust/CosmWasm
  workspace + its Rust integration tests. Source complete; commands provided; not executed here.
- **Evidence still pending:** C1 authoritative live `code_upload_access` (needs gRPC/CLI egress); live-node
  version reconciliation (CometBFT 0.38.22 vs 0.38.23); full production ICS-23 validator-set/header commitment
  (C3); Cosmos Hub finality + pending-attempt criteria verified against the live tx-validity model (C5);
  exact version pins against a live node (C6); pinned local Gaia/wasmd build+test reproduction (C7).
- **Production deployment inputs still pending:** fixed Cosmos Hub Dev Fund destination address (C4b); the
  deployment gate rejects the non-production fixture on mainnet (VF-FEE-009/VF-DEP-001/002/008).

## 5. Exact unblock conditions (C1–C7)

1. **C1** — direct gRPC/CLI query of `code_upload_access`/`instantiate_default_permission` (≥2 endpoints).
2. **C2** — confirm empty-admin + no-migrate/no-sudo behavior against the running Gaia v27.5.0 binary (source-verified here).
3. **C3** — build the full Base-side ICS-23/CometBFT verifier incl. validator-set/trusted-header commitment; the off-chain skeleton here is a starting point.
4. **C4** — confirm `uatom` canonical base denom live (registry-verified); provision the fixed Hub Dev Fund address (deferred, Section 8.2).
5. **C5** — verify CometBFT commit finality + finalized-sequence-consumption invalidation against the live Cosmos SDK tx-validity model; document any genuine finite validity bound.
6. **C6** — pin exact Gaia/SDK/wasmd/wasmvm/CometBFT/IBC-Go/ICS-23 versions against a live node (reconcile 0.38.22↔0.38.23).
7. **C7** — reproduce the full Rust test suite in a pinned local Gaia/wasmd environment (source/command/result/artifact preserved; VF-VER-006).

## 6. Final response

1. **Verdict:** `CONDITIONALLY FEASIBLE — NOT FEASIBLE NOW`.
2. **Five most important facts:** (a) C2 resolved favorably — empty-admin + no-migrate/no-sudo contract is
   immutable against all in-protocol actors including governance (wasmd v0.60.7 source-verified); (b) Cosmos
   Hub is one of 17 supported envs, approved asset native ATOM/uatom, S3 (registry row 479, verified live);
   (c) chain-equivalent + three-use Handshake allowance confirmed governing (VF-XCH-017/VF-EXT-001/VF-COM-006);
   (d) CosmWasm is live on cosmoshub-4 with uploaded code; authoritative permissionless params pending a
   gRPC/CLI query (environment egress limitation, not a negative); (e) red-team implementation produced —
   off-chain adapter tested 22/22; Rust workspace source-complete but not compiled (no toolchain here).
3. **Unsatisfied/conditional IDs:** see `COSMOS_HUB_REQUIREMENT_MATRIX.csv`. Headline: VF-IMM-001..006,
   VF-ARC-004..006, VF-COM-004..008/011..016/025/026, VF-XCH-006/007/010/011, VF-DEP-003/007,
   VF-VER-002..004 now **CONDITIONALLY SATISFIED with C2 resolved** (remaining gates C1-direct/C3-prod/C4b/C5/C6/C7);
   VF-XCH-007 finality criterion defined (CometBFT commit) pending live verification (C5).
4. **Remaining blockers:** C1–C7 above.
5. **Single download:** `public/vinculum-finalis-cosmos-hub-clean-room.zip` (the only download).
6. **Next action:** run C1 (gRPC/CLI params) + C6 (version pins) in an environment with Cosmos Hub node egress;
   reproduce the Rust suite under the pinned toolchain (C7); build the full ICS-23 verifier (C3); provision
   the fixed Dev Fund address (C4b).

*Technically honest feasibility assessment + red-team implementation, not a production-readiness claim.*