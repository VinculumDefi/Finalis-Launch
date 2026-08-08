# Runbook — Source-Chain Test Execution
## For tomorrow, on your laptop · closes CL-53

**Goal:** convert CL-53 from *execution deferred* into *observed evidence*, and lift VF-PRI's principal-safety requirements off evidence level A.

**Working method:** run one command, paste the complete output back, wait for interpretation before the next. Do not summarise output or report "it worked" — paste it. The distinction between a reported result and an observed one is the whole point.

**Time:** roughly 30–45 minutes, most of it toolchain installation.

---

## Before starting

You need the `vf/src/cosmos-hub-vault/` and `vf/src/solana-vault/` directories on the laptop. If they are in the Finalis-Launch repo, clone it. If they are only in the original package zip, extract that.

**First command — confirm what you have:**

```
dir cosmos-hub-vault
dir solana-vault
```

Expect `Cargo.toml`, `contracts/`, `rust-toolchain.toml`, `verify.sh` in the first; `Anchor.toml`, `programs/`, `tests/` in the second.

---

# Part 1 — Cosmos Hub

Higher value and more likely to succeed. Do this first.

### 1.1 Install Rust via rustup

Windows: download and run `https://win.rustup.rs/x86_64` (rustup-init.exe), accept defaults.
Mac or Linux: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`

Then open a **new terminal** and:

```
rustc --version
cargo --version
```

**Paste the output.** Anything ≥1.85 works. Rustup will honour the project's pin to 1.97.1 automatically when you enter the directory.

### 1.2 Confirm the pinned toolchain activates

```
cd cosmos-hub-vault
rustc --version
```

**Paste it.** If this reports 1.97.1 rather than whatever rustup installed as default, the pin is working. Rustup may download 1.97.1 at this point — that is expected.

### 1.3 Check for an intended procedure first

```
type RUN_FINAL_VERIFICATION.md
```

(`cat` on Mac/Linux.) **Paste it.** The repo carries `verify.sh` and `verify.ps1`, which likely encode the intended verification procedure. If they do, we follow those in preference to a bare `cargo test` — the project's own procedure is better evidence than my improvised one.

### 1.4 Run the suite

```
cargo test
```

**Paste the complete output**, especially the final `test result:` line.

What we are looking for: the count, and whether it reconciles with the 45 claimed in `RED_TEAM_BUILD_AND_TEST_REPORT.md` against the 34 `fn` definitions I counted in `tests.rs`.

**If it fails to build**, paste the error. A build failure on the pinned toolchain would itself be a significant finding — the package would not build as specified.

### 1.5 Capture evidence

```
cargo test > cosmos_test_output.txt 2>&1
rustc --version >> cosmos_test_output.txt
```

Keep that file. It is the artifact that closes CL-53's Cosmos half.

---

# Part 2 — Solana

Heavier: Anchor needs the Solana platform tools and starts a local validator.

### 2.1 Install the Solana CLI

Windows: `cmd /c "curl https://release.anza.xyz/stable/solana-install-init-x86_64-pc-windows-msvc.exe --output solana-install-init.exe && solana-install-init.exe stable"`
Mac or Linux: `sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"`

New terminal, then:

```
solana --version
```

**Paste it.**

### 2.2 Install Anchor

```
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install latest
avm use latest
anchor --version
```

**Paste it.** This step compiles from source and can take ten minutes or more. That is normal.

### 2.3 Create a local wallet if you have none

`Anchor.toml` points at `~/.config/solana/id.json`.

```
solana-keygen new --no-bip39-passphrase
```

**This is a throwaway local test key.** It never touches mainnet and holds no value. Do not use any existing wallet, and do not reuse this key for anything.

### 2.4 Run the suite

```
cd solana-vault
anchor test
```

**Paste the complete output.** This builds the program, starts a local validator, runs 10 tests, and shuts down. No network deployment occurs.

### 2.5 Capture evidence

```
anchor test > solana_test_output.txt 2>&1
```

---

# What each result means

| Outcome | Interpretation |
|---|---|
| Cosmos passes | CL-53 Cosmos half closes. VF-PRI-001/002/006 gain execution evidence for the Cosmos environment |
| Solana passes | CL-53 Solana half closes. **VF-PRI-002 and VF-PRI-003 move from A toward E** — the requirements protecting user principal |
| Either fails to build | Significant finding. The package does not build on its own pinned toolchain |
| Either fails a test | The most valuable outcome of all. A real defect in principal-safety code, found before deployment |

**A failing test tomorrow is a better result than a passing one**, because it would be a defect caught while it is still free to fix. Under VF-IMM-006 there is no second chance.

---

# What this does not close

Executing these two suites gives evidence for **two of seventeen environments.** CL-50 remains open: thirteen environments have no located implementation in the package under review.

It also does not fully close VF-PRI-006. Its second half — that a lock whose Base attestation permanently fails still matures and releases — is a cross-system claim. The Solana suite may or may not exercise it; we will know when we see the test names. That is CL-51.

---

# If something goes wrong

Paste the error rather than working around it. Two things I would specifically not do:

**Do not pin or downgrade a dependency to make a build succeed.** That produces a passing result for a variant of the artifact rather than the artifact. It is what I declined to do in the sandbox tonight, and the reasoning does not change on a different machine.

**Do not skip a failing test to get a clean run.** The failure is the finding.

If a toolchain install fails outright, that is a recordable outcome too — CL-53 stays open with a more specific blocker than it has now, which is still progress.
