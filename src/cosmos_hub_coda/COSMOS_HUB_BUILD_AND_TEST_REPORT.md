# Cosmos Hub Build and Test Report

**Author:** Base44 CODA (clean-room, re-executed with implementation)
**Date:** 2026-07-28

## 1. Status summary

| Package | Language | Compiled | Tested | Result |
|---|---|---|---|---|
| cosmos-hub-proof-adapter | Node.js (plain JS) | yes | yes | **22/22 passed, exit 0** |
| cosmos-hub-vault | Rust/CosmWasm | **no** | **no** | source complete; no Rust toolchain in this environment |
| Base44 simulation (CosmosHubCandidate.jsx) | React/JS | n/a (app) | n/a | non-production view |

This report distinguishes **implemented-and-tested** from **implemented-not-compiled** and from
**evidence/production-inputs pending**, per user instruction. It does **not** represent unexecuted tests as
passed (VF-VER-006/007).

## 2. cosmos-hub-proof-adapter — EXECUTED

- **Engine:** Node v20.20.2 (verified in the Base44 sandbox: `rustc: not found`, `cargo: not found`,
  `node --version`: v20.20.2, Linux x86_64 gvisor).
- **Command:** `node cosmos-hub-proof-adapter/test.js`
- **Result:** total **22**, passed **22**, failed **0**, exit code **0**.
- **Test categories covered:**
  - VF-XCH-011 normalizer: valid binds all facts; missing field rejected; wrong source_environment
    rejected; handshake_identity mismatch rejected (VF-COM-005); principal != gross − fee rejected; zero
    fee rejected (VF-COM-013); CHONX without activation receipt rejected (VF-COM-025); CHONX with receipt
    accepted; fee destination != fee-transfer evidence rejected (VF-FEE-001/006).
  - CometBFT finality gate (VF-XCH-006/010): finalized block authorizes; non-finalized rejected; missing
    meta rejected.
  - ICS-23 existence proof skeleton: constructed valid proof verifies; tampered value rejected; tampered
    key rejected.
  - Pending-attempt disposition (Section 5.2.3): elapsed time NEVER clears; finalized success/failure
    terminates; objective invalidation by account-sequence consumption (Cosmos Hub criterion); expiry
    requires a genuine finite validity bound (C5); second submission blocked while objectively pending;
    failed/invalid consumes no allowance (VF-COM-008).
- **Honest caveat:** the ICS-23 verifier is a **skeleton** of the standard leaf/inner hash chain (SHA-256).
  The full proofs.io domain separation and the validator-set/trusted-header commitment are production inputs
  pending the C3 build. The skeleton correctly rejects tampered keys/values and validates a constructed
  proof; it is not a substitute for the production verifier.

## 3. cosmos-hub-vault (Rust/CosmWasm) — NOT COMPILED / NOT TESTED

- **Reason:** the Base44 build environment has **no Rust toolchain**. Verified: `rustc: not found`,
  `cargo: not found`, `cosmwasm-check: not found`, `go: not found` (only Node v20.20.2 is available).
- **Source written (complete):** `Cargo.toml` (workspace), `contracts/vault/Cargo.toml`, `src/lib.rs`
  (instantiate/execute/query only — **no `migrate`, no `sudo` entry by design**), `src/contract.rs`,
  `src/msg.rs`, `src/state.rs`, `src/error.rs`, `src/bin/schema.rs`, `tests/integration.rs` (positive,
  negative, boundary, allowance/concurrency-equivalent, replay, early/single release, external-independence),
  `Makefile`, `RED_TEAM_NOTES.md`, `README.md`.
- **Exact commands to compile/test** (run in an environment with the pinned Rust/CosmWasm toolchain):

```sh
rustup target add wasm32-unknown-unknown
cargo fmt --all
cargo clippy --all-targets -- --deny warnings
cargo test --workspace --release
cargo build --release --target wasm32-unknown-unknown --lib
docker run --rm -v "$(pwd)/target/wasm32-unknown-unknown/release:/code" cosmwasm/rust-optimizer:0.16.0
cargo run --bin schema
```

- **Pinned versions to verify against a live node before compiling:** Gaia v27.5.0 (d089f568),
  wasmd v0.60.7 (edb607cb), Cosmos SDK v0.53.4 (908df9d4), CometBFT v0.38.23 (feb2aea4) — live nodes report
  0.38.22 — IBC-Go v10.7.0 (40c9dbe3).
- **Status:** source is a RED-TEAM / NON-PRODUCTION package. It is **not** reported as passing any test.
  Independent reproduction under the pinned toolchain is required (VF-VER-006/007).

## 4. Integration tests blocked (CODA Section 8)

The full on-chain test obligations (exact Handshake value boundaries, all 16 duration boundaries, fee floor
rounding, three-use allowance + fourth-rejected-atomically, concurrent same-account cannot exceed, duplicate
submission while objectively pending prevented, account-sequence conflict disposition, fee-to-fixed-Dev-Fund
only, no early release, single release at maturity, release with all external dependencies unavailable,
immutability/no-admin/no-migrate/no-sudo) are encoded in `tests/integration.rs` but **not executed** here.
They require the pinned Rust toolchain and a local Gaia/wasmd node (C7).

## 5. Production inputs pending

- Fixed Cosmos Hub Dev Fund destination address (C4b, deferred per Section 8.2). The contract uses a
  conspicuous non-production fixture by default; the deployment gate rejects it on mainnet (VF-FEE-009).
- Live `code_upload_access` confirmation (C1) via gRPC/CLI.
- Full Base-side ICS-23/CometBFT verifier (C3).
- Live tx-validity verification of the Cosmos Hub finality + pending-attempt criteria (C5).

## 6. Conclusion

The off-chain adapter is implemented and tested (22/22). The on-chain Rust vault is implemented as source
but not compiled/tested in this environment (no Rust toolchain). No package is described as
production-ready or deployment-ready (VF-VER-007). This report is technically honest: it does not represent
unexecuted tests as passed.