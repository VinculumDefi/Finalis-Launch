# Final Verification — How to Run on a Docker-Capable Machine

This package lets you independently reproduce the canonical optimized
CosmWasm artifact for `vf-cosmos-hub-vault` and verify it, on your own
Docker-capable computer. Nothing in this package deploys, uploads,
instantiates, or spends funds.

## Prerequisites

- **Docker** running locally:
  - Linux: Docker Engine (`docker` + `dockerd`).
  - macOS: Docker Desktop.
  - Windows: Docker Desktop with WSL2 backend.
- ~3 GB free disk for image + volume caches (one-time).
- Internet access on first run (to pull images and crates; cached afterward).
- No host Rust toolchain required — all builds run in pinned containers.

## Pinned images (reproducibility)

| Component | Image | Why |
|---|---|---|
| Optimizer | `cosmwasm/optimizer:0.16.1` | CosmWasm **2.1.x** era, Rust 1.81. **Do NOT use 0.17.0+** — it produces artifacts that require CosmWasm 3.0 on-chain (incompatible with cosmoshub-4 / wasmd 2.x). |
| Tests | `rust:slim-bookworm` | Honors `rust-toolchain.toml` (channel `1.97.1`); rustup installs the pinned toolchain (cached in a volume). |
| cosmwasm-check | bundled in `cosmwasm/optimizer:0.16.1`; fallback installs `cosmwasm-check --version 2.1.3 --locked` | Version-matched to cosmwasm-std 2.1.3. |

The workspace pins `cosmwasm-std =2.1.3`, `cw-storage-plus =2.0.0`, `cw2 =2.0.0`
in `Cargo.toml`, and `Cargo.lock` makes the dependency graph fully reproducible.

## Exact commands to run

### Linux / macOS

```sh
cd vf-cosmos-hub-vault-verification
chmod +x verify.sh
./verify.sh
```

### Windows (PowerShell)

```powershell
cd vf-cosmos-hub-vault-verification
pwsh -File .\verify.ps1      # or: powershell -File .\verify.ps1
```

The script fails immediately if any required step fails.

## What the script does

1. Confirms Docker is available and prints `docker version`.
2. Runs `cargo test --workspace --release` (clean) in the pinned test container — the complete Rust test suite.
3. Builds the canonical optimized artifact via `cosmwasm/optimizer:0.16.1` (workspace mode) → `artifacts/vf_cosmos_hub_vault.wasm` + `artifacts/checksums.txt`.
4. Runs `cosmwasm-check` on the optimized artifact.
5. Structural validation: `wasm-tools validate` if present in the image, else `wasm-opt --validate`.
6. Records imports, exports, artifact path, byte size, and SHA-256; cross-checks the SHA-256 against the optimizer's `checksums.txt`.
7. Writes everything to a timestamped `verification-results/<UTC-stamp>/` directory.

## Expected output files

After a successful run you will have:

```
artifacts/
  vf_cosmos_hub_vault.wasm     <- the canonical optimized artifact
  checksums.txt                <- SHA-256 produced by the optimizer
verification-results/<stamp>/
  verify.log                   <- full combined log
  SUMMARY.md                   <- human-readable summary (path/size/SHA-256/exports/imports)
  wasm_sexpr.txt               <- wasm-opt --print output (full module s-expression)
  exports.txt                  <- unique export entries
  imports.txt                  <- unique import entries
```

A successful run ends with:

```
VERIFICATION COMPLETE. Results: verification-results/<stamp>
  Artifact : .../artifacts/vf_cosmos_hub_vault.wasm
  Size    : <N> bytes
  SHA-256 : <64 hex chars>
  Summary : verification-results/<stamp>/SUMMARY.md
No deployment, upload, instantiation, or fund transfer was performed.
```

## How to return the optimized WASM and logs for review

Send back these two items (do not send the `target/` or volume caches):

1. `artifacts/vf_cosmos_hub_vault.wasm`
2. The entire `verification-results/<stamp>/` directory (zip it if convenient)

Optionally include `artifacts/checksums.txt`. The SHA-256 in `SUMMARY.md`
is the authoritative artifact fingerprint.

## Troubleshooting (limited to realistic Docker issues)

- **`docker: permission denied` (Linux):** add your user to the `docker`
  group (`sudo usermod -aG docker $USER`), log out/in, or run with `sudo`.
  The script itself needs no privileges beyond Docker access.

- **Architecture mismatch (Apple Silicon / ARM):** `cosmwasm/optimizer:0.16.1`
  is amd64. On Apple Silicon Docker Desktop runs it via emulation
  (Settings → "Use Rosetta for x86/amd64 emulation" or enable qemu). ARM
  builds produce **different bytes** than amd64 and are not the canonical
  artifact — for the authoritative result, run on an amd64 host (or amd64
  emulation). This is a known CosmWasm reproducibility constraint, not a
  script bug.

- **Slow first run:** images and the Rust toolchain/crates are downloaded
  once and cached in named Docker volumes (`vfcosmoshubvault_*`). Later
  runs reuse them.

- **`artifacts/` files owned by root (Linux):** the optimizer runs as root
  and writes `artifacts/` into the host bind-mount. On Linux, remove them
  with `sudo rm -rf artifacts`. macOS/Windows Docker Desktop bridge
  ownership, so no issue there.

- **Path-mount issues (Windows):** ensure you run from the package
  directory (where `verify.ps1` lives). Docker Desktop on Windows expects
  drives to be shared; if a mount fails, in Docker Desktop → Settings →
  Resources → File Sharing, enable the drive holding this package.

- **`cargo test` fails with "toolchain 1.97.1 not found":** rustup could not
  download the pinned toolchain (offline, or the pin predates your rustup
  index). Either connect to the network, or update the `channel` line in
  `rust-toolchain.toml` to a released version available to your rustup.

- **optimizer fails with undefined-symbol linker errors:** unlikely with
  `0.16.1` (Rust 1.81), but if it happens, the project may need
  `RUSTFLAGS='-C link-arg=--import-undefined'`. This is a known workaround
  for very new Rust toolchains compiling cosmwasm-std 2.x bare `extern "C"`
  imports; the pinned 0.16.1 image should not need it.

- **Do not** edit the contract source, `Cargo.toml`, `Cargo.lock`, or
  `rust-toolchain.toml` to make the build pass — any change alters the
  artifact hash. If the build does not reproduce, report the exact error.