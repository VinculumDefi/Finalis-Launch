# Vinculum Finalis — Native Solana Commitment Vault Lock

## Provenance

- **Revision:** 6 (2026-07-28)
- **Governing source:** `227826f11_Vinculum_Finalis_Master_Specification_Revision_6_2026-07-28.docx`
- **Governing source SHA-256:** `5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9`
- **Requirements count:** 209
- **Approved assets (Solana):** 78 (all class S3)

This program is built **directly from the Revision 6 protocol constants and requirements**. No prior
implementation, Cosmos code, or earlier revision was used as a reference.

## What This Is

A Solana Anchor program that implements the Commitment Vault Lock mechanism for the Solana
environment. It is the **source-chain half** of the cross-chain lock → proof → mint lifecycle:

1. User locks SOL or SPL tokens → fee routes to Dev Fund, principal retained in vault
2. Lock record PDA stores immutable facts (VF-XCH-011)
3. Block finalized → relayer extracts evidence
4. Base proof-verifier verifies + mints output token (Base contract is a **deferred** component)
5. Maturity → permissionless principal release (no Base dependency)

## Build & Test

**Prerequisites:** Rust 1.18+, Solana CLI v1.18+, Anchor CLI 0.30+, Node.js 18+.

```bash
# Install Anchor CLI
cargo install --git https://github.com/coral-xyz/anchor anchor-cli --tag v0.30.1

# Build the program
anchor build

# Run tests (starts a local validator automatically)
anchor test

# Deploy to localnet
anchor deploy --provider.cluster localnet
```

**NOTE:** The build and tests have **not been executed** in the Base44 development environment.
The Base44 sandbox is a Node.js/Vite environment without a Rust toolchain or Solana CLI. Build
and test results must be verified in a proper Solana development environment.

## File Layout

```
src/solana-vault/
├── Cargo.toml                              # workspace
├── Anchor.toml                             # Anchor config
├── rust-toolchain.toml                     # pinned toolchain
├── package.json                            # test dependencies
├── tsconfig.json                           # TypeScript config
├── programs/vf-solana-vault/
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs                          # program entry, instruction dispatch
│       ├── constants.rs                    # Revision 6 constants (transcribed verbatim)
│       ├── state.rs                        # Config, LockRecord, HandshakeAllowance, params
│       ├── error.rs                        # error enum (every variant traces to a requirement)
│       ├── events.rs                       # event definitions (evidence trail)
│       └── instructions/
│           ├── mod.rs
│           ├── initialize.rs              # VF-DEP-001/002
│           ├── commit_vault_lock.rs        # VF-COM-001..026, VF-ARC-004..006
│           └── release_principal.rs        # VF-PRI-001..006
├── tests/
│   └── vault.ts                            # integration tests (10 tests)
└── migrations/
    └── deploy.ts                           # deployment script
```

## Instructions

| Instruction | Purpose | Requirements |
|---|---|---|
| `initialize` | One-time config (Dev Fund destination) | VF-DEP-001/002 |
| `commit_vault_lock_native` | Lock native SOL | VF-COM-001..026 |
| `commit_vault_lock_spl` | Lock SPL tokens | VF-COM-001..026 |
| `release_principal_native` | Release native SOL at maturity | VF-PRI-001..006 |
| `release_principal_spl` | Release SPL tokens at maturity | VF-PRI-001..006 |

## PDA Design

| PDA | Seeds | Purpose |
|---|---|---|
| Config | `[b"vf_config"]` | singleton global config |
| Lock Record | `[b"vf_lock", sha256(lock_id)]` | per-lock VF-XCH-011 facts |
| Handshake Allowance | `[b"vf_handshake", source_account]` | per-identity usage |
| Vault (SPL) | `[b"vf_vault", mint]` | principal custody per token |

## Architecture Decisions

1. **Anchor framework** — ecosystem standard for Solana programs.
2. **SHA-256 for lock_id hashing** — available in both Solana SDK and browser Web Crypto API, enabling off-chain PDA derivation without extra dependencies.
3. **Output calculation is off-chain** — the program records inputs (verified_gross_usd, output_token, duration, asset class). The Base-side verifier computes the output using the same formula. This keeps the source-chain program minimal.
4. **Three-use Handshake allowance** — Solana PDAs maintain atomic persistent per-identity state, qualifying for three qualifying Handshakes (VF-COM-006).
5. **Clock sysvar for maturity** — standard on-chain time source (VF-PRI-001).
6. **"finalized" confirmation level** for Solana finality (VF-XCH-010).
7. **Native SOL + SPL token support** — two instruction paths sharing the same validation logic.

## Assumptions (items not defined in Revision 6 documents)

1. **Program ID** — placeholder `Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS`. Must be replaced with the real deployed address.
2. **Dev Fund destination** — deferred external input (VF-DEP-001). Must be supplied at `initialize`.
3. **Canonical chain identifier** — Solana mainnet-beta genesis hash. Deferred external input (VF-XCH-003).
4. **Lock ID max length** — 128 bytes (Revision 6 does not specify a maximum).
5. **Price oracle** — `verified_gross_usd_micro` is an instruction parameter provided off-chain. The program records it as-is; price verification is a Base-side concern.

## Known Limitations

1. **Build not executed** — no Rust toolchain in Base44 environment.
2. **Tests not executed** — no Anchor CLI / Solana CLI in Base44 environment.
3. **Not deployed** — program ID is a placeholder.
4. **Base-chain proof verifier** — not built (known issue). The Solana program emits all evidence needed for future Base verification.
5. **Asset registry check** — VF-REG-001 is enforced off-chain (preflight). The on-chain program does not embed the 78-entry registry; it accepts any valid SPL mint. Full registry embedding is a future enhancement.
6. **Protocol token rejection** — VF-TOK-007 (rejecting VCLM/CHONX/SYNTH as inputs) cannot be fully enforced on-chain because protocol token mints are not yet deployed.