# CL-53 — Source-Chain Test Suite Execution
## Evidence investigation · 2026-08-07

**Question:** can the Cosmos Hub and Solana test suites be executed from this workspace? If not, why specifically?

**Outcome:** **both blocked. Neither executed. The blockers are identified and specific.**

CL-53 now reads *execution deferred because of a named toolchain constraint*, not *execution unknown*.

---

## COSMOS HUB — `vf/src/cosmos-hub-vault/`

### What was attempted

| Step | Command | Result |
|---|---|---|
| 1 | `cargo --version` | **ABSENT** — no Rust toolchain in the environment |
| 2 | `apt-get install -y rustc cargo` | **SUCCEEDED.** Rust 1.75.0 installed from `archive.ubuntu.com` (permitted mirror) |
| 3 | `cargo test --offline` | Failed — `lock file version 4 requires -Znext-lockfile-bump` |
| 4 | Removed `Cargo.lock`, `cargo test` | Failed — see blocker below |
| 5 | `cargo update -p zeroize_derive --precise 1.4.2` | Failed — the dependency graph pins the version |

### The blocker, exactly

```
error: failed to parse manifest at
  .../zeroize_derive-1.5.0/Cargo.toml
Caused by:
  feature `edition2024` is required
  The package requires the Cargo feature called `edition2024`, but that
  feature is not stabilized in this version of Cargo (1.75.0).
```

`zeroize_derive 1.5.0` is a transitive dependency reached through
`vf-cosmos-hub-vault → cosmwasm-std 2.1.3 → cosmwasm-crypto 2.3.4 → ark-ec 0.4.2 → …`.
It requires Rust edition 2024, which requires **rustc ≥ 1.85**.

### Why a newer toolchain could not be obtained

| Source | Result |
|---|---|
| `apt-cache policy rustc` | Candidate is **1.75.0**. Ubuntu 24.04 noble ships no newer package |
| `static.rust-lang.org` | `HTTP/2 403 · x-deny-reason: host_not_allowed` |
| `sh.rustup.rs` | Not in the network allowlist |

The project's own `rust-toolchain.toml` pins **1.97.1**, which is consistent with this finding — the package expects a toolchain roughly twenty minor versions newer than the one obtainable here.

### Why the constrained-dependency workaround was rejected

Pinning `zeroize_derive` to a pre-edition-2024 release would alter the dependency graph away from the one the artifact actually builds against. A passing result under a modified graph is **evidence about a variant, not about the deliverable.** The attempt was made and failed regardless, but it would not have been accepted as evidence had it succeeded.

### Prior claim — recorded, not adopted

`RED_TEAM_BUILD_AND_TEST_REPORT.md` states: exit `0`, **`45 passed; 0 failed`**.

That document also records its own limitation honestly, noting that a passing count is not by itself evidence of production readiness and that optimized-build and `cosmwasm-check` outcomes remain pending on a Docker-capable machine.

**This is a reported result, not an observed one.** Under the standing verification rule, it does not close CL-53. It is meaningful evidence that the suite has run somewhere, and it should be reconciled — the report claims 45 tests; a direct count of `fn` definitions in `tests.rs` gives **34**. That discrepancy is worth resolving, and may simply reflect counting parametrised or nested cases differently.

---

## SOLANA — `vf/src/solana-vault/`

### What was attempted

| Check | Result |
|---|---|
| `anchor --version` | **ABSENT** |
| `solana --version` | **ABSENT** |
| `package.json` test script | `anchor test` |
| `release.solana.com` | `HTTP/2 403 · x-deny-reason: host_not_allowed` |

### The blocker, exactly

`anchor test` requires the Anchor CLI, the Solana CLI, and a **local validator process**. None are present, and the distribution host is outside the network allowlist. The Rust toolchain obtained above is also insufficient — Anchor builds target `sbf-solana-solana`, which requires Solana's own platform-tools.

### The test file states this itself

`tests/vault.ts`, lines 5–8, carries a provenance header:

> These tests run via `anchor test` (requires Solana CLI, Anchor CLI, and a local validator). They have **NOT** been executed in the Base44 environment (no Rust toolchain or Solana CLI available). They serve as the verification specification — each test maps to protocol requirement IDs.

**The authors recorded the same constraint this investigation reached independently.** Direct count: **10 `it(...)` cases.**

**Precision on the claim.** The evidence supports: the suite was not executed in the Base44 environment (per its header), and could not be executed here (per the attempt above). It does **not** establish that the suite has never been executed anywhere — no evidence either way exists on that question. The narrower claim is the one recorded.

That header is a good example of VF-EXT-002 being honoured in practice — an unfinished deliverable reported as incomplete rather than presented as working.

---

## CONCLUSION

**CL-53 — Source-chain test suites unexecuted. Severity: Minor. Type: evidence gap. Status: execution deferred, blocker identified.**

| Suite | Cases | Status | Specific blocker |
|---|---|---|---|
| Cosmos Hub | 34 counted (45 claimed in prior report) | **Never executed under observation** | Requires rustc ≥1.85 for `zeroize_derive 1.5.0` edition2024; maximum obtainable here is 1.75.0. `static.rust-lang.org` outside network allowlist |
| Solana | 10 | **Not observed to execute by this investigation.** Its own header states it had not been executed in the Base44 environment | Requires Anchor CLI, Solana CLI and a local validator; `release.solana.com` outside network allowlist |

**Neither blocker indicates a defect in the implementations.** Both are environment constraints of this workspace.

### What would resolve it

Both suites are executable on an ordinary developer machine:

**Cosmos** — install Rust via rustup, which honours the pinned `rust-toolchain.toml` (1.97.1) automatically, then:
```
cd cosmos-hub-vault
cargo test
```
Capture the full output including the `test result:` line. The repository also carries `verify.sh` and `RUN_FINAL_VERIFICATION.md`, which appear to encode the intended procedure and should be followed in preference to a bare `cargo test`.

**Solana** — install the Solana CLI and Anchor, then:
```
cd solana-vault
anchor test
```
This starts a local validator; no network deployment occurs.

**Both take minutes on a machine with the toolchains.** This is not blocked work — it is work blocked *here*.

### Priority

Given VF-PRI's finding that the entire principal-safety family sits at evidence level **A**, and that principal release is implemented on these chains rather than on Base, **executing these two suites is the single highest-value verification action available outside this environment.**

The Solana suite in particular exercises `release_principal.rs`, which carries VF-PRI-002 (release only once) and VF-PRI-003 (release only to the bound destination). Those are the requirements protecting user funds, and they currently rest on code inspection alone.

---

## METHOD NOTE

Three things this investigation did that the finding's original phrasing would not have:

**It distinguished unobserved from unavailable.** The Cosmos suite has a documented prior run recorded in a report. The Solana suite has no such record, and its header states it was not executed in the Base44 environment. Both were "unexecuted" before this investigation; they are not the same state, and neither is the same as "never run anywhere" — a claim the evidence does not reach.

**It attempted rather than assumed.** Rust was absent, and the reasonable assumption was that it could not be obtained. It could — from a permitted mirror — and the real blocker turned out to be two layers further in, at a transitive dependency's edition requirement. Had the investigation stopped at "no Rust toolchain," the recorded blocker would have been wrong.

**It rejected a workaround that would have produced a misleading pass.** Constraining the dependency graph to make the build succeed would have tested a variant of the artifact rather than the artifact.
