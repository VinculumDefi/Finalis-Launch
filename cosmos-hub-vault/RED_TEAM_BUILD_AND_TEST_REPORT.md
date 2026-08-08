# Cosmos Hub Vault — Red-Team Build & Test Report (KODA Strict)

**Date:** 2026-07-29
**Scope:** Reproducible build + test evidence for `vf-cosmos-hub-vault` (non-production clean-room).

---

## 1. Toolchain (pinned)

- **Rust:** `stable` (1.97.1), `RUSTUP_HOME=/tmp/rustup`, `CARGO_HOME=/tmp/cargo`
- **Target:** `wasm32-unknown-unknown`
- **Workspace:** `src/cosmos-hub-vault/` (Cargo.lock pinned; deps cosmwasm-std 2.1.3, cw-storage-plus 2.0.0, cw2 2.0.0)

## 2. Unit tests (45 / 45 pass)

**Command:**
```sh
cd src/cosmos-hub-vault
cargo clean -p vf-cosmos-hub-vault
cargo test --lib --tests
```
**Result:** exit `0` — `45 passed; 0 failed`.

Coverage: handshake boundaries (inclusive $0.95–$1.05, below/above rejected), standard lock floor ($10.00 inclusive), all 16 permitted durations accepted, adjacent unpermitted durations rejected, fee floor-rounding (2.5% and 5%, truncation proven), zero-fee/wrong-denom/multi-denom/zero-amount/no-funds rejected, duplicate/empty/whitespace lock_id rejected, malformed base_recipient rejected, CHONX before-activation/not_applicable rejected, CHONX with receipt accepted, three-then-fourth handshake atomic rejection (failed 4th consumes no allowance), exact fee routing to immutable fixture, principal retained before maturity, permissionless release at maturity by any sender, exact principal amount, exactly-once release, release independent of external services, u128 overflow → `ArithmeticOverflow` (no panic), configuration immutable (no setter), mainnet rejects non-production fixture, mainnet accepts real address, full immutable-fact lock record, distinct-identity allowances.

## 3. Release WASM build

**Command:**
```sh
cd src/cosmos-hub-vault
RUSTFLAGS='-C link-arg=--import-undefined' \
  cargo build --release --target wasm32-unknown-unknown --lib
```
**Result:** exit `0` — `Finished release profile [optimized] target(s) in 16.01s`.

**Artifact:** `target/wasm32-unknown-unknown/release/vf_cosmos_hub_vault.wasm` (299,242 bytes).

> **Note on `--import-undefined`:** cosmwasm-std 2.1.3 declares host imports as bare `extern "C"` (no `#[link(wasm_import_module)]`). Recent rust-lld (Rust 1.97.1) no longer auto-imports undefined `extern "C"` symbols for `wasm32-unknown-unknown`; the flag restores the historical behavior. The resulting imports are emitted under the `env` module (verified below), matching wasmd/CosmWasm expectations. This flag is the standard `RUSTFLAGS` addition for modern-toolchain CosmWasm builds.

## 4. Structural validation

**Command:** `wasm-tools validate target/wasm32-unknown-unknown/release/vf_cosmos_hub_vault.wasm`
**Result:** exit `0` (no diagnostics).

## 5. Import section (15 imports, all under `env`)

```
env.abort, env.db_next, env.addr_humanize, env.addr_validate, env.ed25519_verify,
env.secp256k1_verify, env.addr_canonicalize, env.ed25519_batch_verify,
env.secp256k1_recover_pubkey, env.debug, env.query_chain, env.db_read, env.db_write,
env.db_scan, env.db_remove
```
All imports resolve to the `env` module — the canonical CosmWasm host interface. No undefined symbols remain.

## 6. Export section — contract-level entry points (NOT a deployment-admin proof)

Exports observed on the sandbox-built (unoptimized) artifact: `instantiate`, `execute`, `query`, `allocate`, `deallocate`, `interface_version_8`, `requires_iterator`.

| Entry point | Present |
|---|---|
| `instantiate` | ✅ |
| `execute` | ✅ |
| `query` | ✅ |
| `migrate` | **absent** |
| `sudo` | **absent** |
| `reply` | **absent** |

**What this proves (contract level only):** the compiled contract exposes no `migrate`, `sudo`, or `reply` entry point, so there is no code path an administrator could invoke to upgrade the bytecode or run privileged sudo actions *through this contract's own interface*.

**What this does NOT prove (important):** the absence of these exports does **not**, by itself, prove that the chain-level contract administrator is unset. In CosmWasm, the contract **admin** is a **deployment parameter** set at instantiation (`MsgInstantiateContract.admin`), not a property of the wasm bytecode. A contract with no `migrate` entry point cannot be migrated regardless, but the admin field on-chain is independent and must be verified separately.

**Required deployment + verification obligations:**
- **Deployment must use `admin: None`** (no admin address) when instantiating via `MsgStoreCode` + `MsgInstantiateContract`. This is the deployment-gate expression of the no-admin requirement (VF-DEP-001/002/008).
- **On-chain confirmation required:** after deployment, the deployed contract information (e.g. `cosmos chain query wasm contract <addr>` / the wasmd `QueryContractInfo` response, which exposes the `admin` field) must **independently confirm** that the `admin` field is empty/`None`. The no-admin property is only fully attested by this on-chain evidence, never by the wasm exports alone.

## 7. SHA-256 manifest

```
15fbc114a641c43191cfedee3728d95a102ebd7bf4911c652acffc5d7bc8c060  vf_cosmos_hub_vault.wasm
```

## 8. Tooling unavailable in this sandbox (honest gaps)

The following were **not** run and are **not** claimed as evidence:

- **`cosmwasm-check`** — `cargo install cosmwasm-check` was attempted; the build terminated without producing a binary or an exit code (silent failure, likely OOM/network in the sandbox). Structural validity is instead attested by `wasm-tools validate` (exit 0) plus manual import/export inspection above.
- **`wasm-opt` (binaryen)** — not installed; `apt-get install -y binaryen` unavailable. The WASM is therefore the un-optimized `cargo build --release` artifact, not the deterministic `rust-optimizer` output. A reproducible optimized artifact requires a Docker-equipped environment running `cosmwasm/rust-optimizer:0.16.0`.
- **`docker` / `rust-optimizer`** — no Docker runtime in the sandbox.

## 9. Bech32 correction (defect history)

- The Node-side proof-adapter and Rust fixtures were regenerated against the **BIP-350** Bech32 generator constant `0x2a1462b3` (a prior typo `0x2a762b3` produced invalid checksums).
- `MockApi` in tests uses `MockApi::default().with_prefix("cosmos")` so bech32 validation uses the `cosmos` HRP (matching `cosmoshub-4`), not the `MockApi` default `cosmwasm`.
- Addresses (alice, bob, fixture) are valid `cosmos`-prefixed bech32 with correct checksums.

## 10. Verdict

- **Unit tests:** 45/45 pass (clean build). ✅
- **Unoptimized release WASM (sandbox artifact):** builds, `wasm-tools validate` exits 0, imports use the `env` module, and `instantiate`/`execute`/`query` are exported while `migrate`/`sudo`/`reply` are absent. ✅
  - This sandbox artifact is the **unoptimized** `cargo build --release` output (`--import-undefined` RUSTFLAGS). It is distinct from, and **not** a substitute for, the future **canonical optimized artifact** produced by `cosmwasm/optimizer:0.16.1`, which is the only artifact intended for deployment and whose SHA-256 is the authoritative fingerprint.
- **No-admin / immutability:** the absent `migrate`/`sudo`/`reply` exports prove only the **contract-level** absence of privileged entry points. They do **not** prove the on-chain **admin** is unset. Deployment must use `admin: None`, and the on-chain contract info must **independently confirm** an empty admin field. ⚠️ (evidence required at deployment)
- **Optimized/deterministic artifact:** **not produced in this sandbox** (Docker + `cosmwasm/optimizer:0.16.1` unavailable here). A portable verification package (`verify.sh` / `verify.ps1` + `RUN_FINAL_VERIFICATION.md`) is provided to produce it on a Docker-capable machine. ⏳
- **cosmwasm-check:** **not run in this sandbox** (tool unavailable). The portable package runs it via the pinned `cosmwasm/optimizer:0.16.1` image (version-matched to cosmwasm-std 2.1.3). ⏳

Per VF-VER-006/007, a passing test count is not, by itself, evidence of production readiness. The sandbox results above are **not** claimed as the optimized-build or cosmwasm-check outcome; those remain pending execution of the portable verification package on a Docker-capable machine.