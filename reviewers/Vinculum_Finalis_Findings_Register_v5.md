# Vinculum Finalis — Independent Review Findings Register
## Reviewer column: CLAUDE · v5 · 2026-08-12 (evening)

**Governing authority:** `Vinculum_Finalis_Master_Specification_Revision_6_2026-07-28.docx`
**Hash verified:** SHA-256 `5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9` — re-verified 2026-08-03, unchanged.
**Supersedes:** Register v4, published earlier the same day. v4 was never committed to the repository; see Corrections to v4.

**Method change since v2.** Every status below is now backed by a compiled contract and an executed test, not by reading. Toolchain: Hardhat 2.22.17, solc 0.8.19, optimizer 200 runs, `viaIR: true`.

**Scope change since v3.** v3 covered the Base/Solidity layer only; Solana and Cosmos were listed as not reviewed. v4 adds the Solana vault (CL-55 through CL-61) and closes the Cosmos test-results request.

**Scope change since v4.** v4 recorded the Solana build session. v5 records the first whole-program read of the Solana vault — every source file examined as a system rather than at the sites the compiler complained about. Ten findings, CL-63 through CL-73. **Three of them mean the program cannot perform its function at all.** One fix applied and verified (CL-72, commit `33941da`).

**Numbering correction made while compiling v4.** The new Solana findings were first drafted as CL-35 onward, which collided: **CL-35 through CL-54 were already assigned** after v3 was cut, and live only in standalone documents — `REMAINING_CRITICALS_MAPPING.md`, `IMPLEMENTATION_DOMAIN_AUDIT.md`, `CL-38_DECISION_BRIEF.md`, `CL-50_COVERAGE_INVESTIGATION.md`, `CL-53_EXECUTION_INVESTIGATION.md`, `FAMILY_REVIEW_01_VF-PRI.md`, `VERIFICATION_LEVEL_AUDIT.md`. Renumbered to CL-55–CL-62. **See the reconciliation notice below: this register is twenty findings behind, and that gap is itself the finding.**

**Current test state.**

| Layer | Tests | Status |
|---|---|---|
| Base (Solidity) | 116 | passing, observed |
| Cosmos (CosmWasm) | 45 | passing, observed — closes the v3 request |
| Solana (Anchor) | 10 | **never executed** — blocked by CL-60, which v5 concludes is a dead end by the current method |

A finding is marked Resolved only where a named test asserts it. **Four Solana findings below are marked Fixed-Unverified, not Resolved** (CL-56, CL-57, CL-58, CL-59), because no Solana test has ever run. Compilation is evidence that the defect no longer blocks a build; it is not evidence that the behavior is correct.

---

## CORRECTIONS TO v4 — errors by this reviewer

**I audited the Solana program without reading its own README.** `solana-vault/README.md` carries an *Architecture Decisions* section, an *Assumptions* section, and a *Known Limitations* section. Several items I recorded as findings were already disclosed there by the author. The severity of each is unchanged; the **credit** is wrong, and a register that claims discovery of documented items will be corrected by the paid auditor at cost.

| Recorded as | Actually | Where disclosed |
|---|---|---|
| CL-61 — "the Solana vault had never been compiled", **Resolved**, presented as proven by layered defect discovery | **Disclosed limitation.** Known Limitations 1–3 state the build was never executed, tests were never executed, and it was never deployed — with a reason (no Rust toolchain in the authoring environment) | README Known Limitations 1–3 |
| CL-71 — "VF-REG-001 claimed in the header and does not exist", called the largest finding of the night | **Disclosed design position**, and it is wrong on the code: the header comment is the only thing that overclaims | README Known Limitation 5 |
| CL-72 — placeholder program ID, recorded as a discovery | **Disclosed assumption**, explicitly flagged as requiring replacement | README Assumption 1 |
| Unused `ProtocolTokenProhibited` variant, offered as evidence of an unenforced requirement | **Disclosed, with a reason** — protocol token mints do not exist yet, so VF-TOK-007 cannot be enforced on-chain today | README Known Limitation 6 |
| CL-68 — "keccak256 vs SHA-256 disagreement across three sources" | Narrower: README and `constants.rs` and the code all say SHA-256. Only the `state.rs` doc comment is stale | README Architecture Decision 2 |

**What CL-61's correction costs.** A7 in the v4 appendix was built on CL-61 and still holds as a review lesson — unbuilt code does surface defects in layers, and that was observed directly. What does not hold is the claim that the layering *proved* something nobody knew. It confirmed something the author had written down.

**The generalizable error.** Ten findings in roughly ninety minutes, of which about a third were on a list the author had already published in the same directory. **Read the component's own disclosures before auditing it**, and separate three categories in the write-up: undisclosed defects, disclosed limitations whose severity is understated, and disclosed limitations correctly assessed. Only the first is a finding. This applies to the remaining sixteen environments, where the same mistake would be repeated sixteen times.

**Not committed.** v4 exists in the workspace as `reviewers/Vinculum_Finalis_Findings_Register_v4.md` and is deliberately untracked. It should not enter the repository; v5 supersedes it.

---

## RECONCILIATION NOTICE — twenty findings are not in this register

**CL-35 through CL-54 do not appear below.** They were raised between 2026-08-03 and 2026-08-08, after v3 was cut, and were recorded in whichever working document produced them rather than in the register. Recovered index, by document:

| ID | Substance | Recorded in |
|---|---|---|
| CL-35 | Issuance reverts until finalization (VF-DEP-001) — Resolved | remediation mapping |
| CL-36 | `registerChainVerifier` rejects zero address (VF-DEP-002) — Resolved | remediation mapping |
| CL-37 | 48-hour price staleness bound; fail-closed behavior | decision brief |
| CL-38 | Price publisher key model — **decision required before freeze** | `CL-38_DECISION_BRIEF.md` |
| CL-39 | Verifier item, trivial remediation | remediation mapping |
| CL-40 | 10^12 unit mismatch, found by end-to-end coverage — Resolved | remediation mapping |
| CL-41 | **Critical, exploitable** — caller-supplied `assetPrecision` divisor — Fixed | domain audit |
| CL-42 | `custodyClass`/`custodyPath` fell through to S3 multiplier — Fixed | domain audit |
| CL-43 | `decimals` domain: unbounded `uint8` exponent, 19–77 silently misprices — **OPEN** | domain audit |
| CL-44–CL-49 | Six domains examined and found clean | domain audit |
| CL-50 | Source-chain implementation coverage investigation | `CL-50_COVERAGE_INVESTIGATION.md` |
| CL-51 | VF-PRI-006's failure-resilience half is untested — the most important untested claim in the protocol | `FAMILY_REVIEW_01_VF-PRI.md` |
| CL-52 | Traceability matrix status vocabulary overstates completion | coverage investigation |
| CL-53 | Cosmos and Solana suites never executed under observation | `CL-53_EXECUTION_INVESTIGATION.md` |
| CL-54 | Workspace/repo file divergence undetected for days | artifact inventory |

**CL-53 is now half closed.** Cosmos: 45 tests observed passing. Solana: still never executed — blocked by CL-60.

**Why this is a finding and not bookkeeping.** A findings register whose authority is cited in a freeze decision must be the single place a reader looks. Twenty findings living in seven documents means no reader — human or auditor — can answer *what is open* from one source, and at least one of them (CL-38) is a decision the freeze is gated on. **CL-43 is Open and Critical-adjacent and would not have been visible to anyone reading v3.**

**Owed before the freeze gate:** fold CL-35 through CL-54 into the register body with current status, tested or not. Not done here — doing it from the summaries above rather than from the source documents would repeat the v2 error of recording a finding from a description of it. Each needs its originating document reopened.

---

## ARBITRATION RULE

CONFIRMED requires (a) a numbered requirement and (b) a file:line any reader can check in under a minute. Reviewer agreement is not evidence.

RESOLVED requires a named test that failed before the fix and passes after. Code that looks correct is not Resolved. This rule exists because CL-03 and CL-04 passed an 85-assertion suite while wrong.

**Scope tags:** LIVE (`src/lib/*.js`, running preview) · PRE-DEPLOY (`*.sol`, `*.rs`, undeployed) · BOTH · build · tooling · packaging.

---

## INDEX

| ID | Sev | Scope | Status | Title |
|---|---|---|---|---|
| CL-01 | Critical | PRE-DEPLOY | **Open** | Unauthenticated USD value permits arbitrary issuance |
| CL-03 | Critical | BOTH | **Resolved** | Stake weight omits token multiplier |
| CL-04 | Critical | BOTH | **Resolved** | Stake duration multipliers non-conforming |
| CL-05 | Critical | BOTH | **Resolved** | Epoch origin not launch-relative |
| CL-06 | Critical | PRE-DEPLOY | **Open** | `rewardBasis` never assigned |
| CL-07 | Critical | PRE-DEPLOY | **Resolved** | Stake contract not an authorized minter |
| CL-08 | High | PRE-DEPLOY | **Resolved** | `terminalState` never set |
| CL-09 | Critical | PRE-DEPLOY | **Open** | Unbounded loops brick epoch processing |
| CL-10 | Critical | BOTH | **Open** | `daysSinceLaunch` caller-supplied; JS defaults to 0 |
| CL-11 | Critical | PRE-DEPLOY | **Open** | Handshake allowance bypassed via package field |
| CL-12 | Critical | PRE-DEPLOY | **Open** | Dev Fund enforcement commented out |
| CL-13 | High | PRE-DEPLOY | **Open** | Replay flag written after external call |
| CL-14 | High | BOTH | **Resolved (Solidity)** | Expired position backdates over gap |
| CL-15 | Medium | PRE-DEPLOY | **Resolved** | Terminal-state withdrawal blocked |
| CL-16 | Medium | PRE-DEPLOY | **Open** | Incomplete mint leaves no remainder |
| CL-17 | Medium | PRE-DEPLOY | **Open** | Timestamp facts discarded |
| CL-18 | Critical | PRE-DEPLOY | **Resolved** | No contract-level tests |
| CL-19 | — | — | Rejected | ~~Tests exercise a parallel reimplementation~~ |
| CL-20 | — | — | Rejected | ~~Delete the JS protocol engines~~ |
| CL-21 | High | BOTH | **Resolved (Solidity)** | T0 default of 0 preserves epoch brick |
| CL-22 | Medium | BOTH | **Resolved (Solidity)** | Epoch 0 diverges between layers |
| CL-23 | Low | PRE-DEPLOY | **Resolved** | `getCurrentEpoch()` underflows pre-launch |
| CL-24 | Low | PRE-DEPLOY | **Resolved** | `launchTimestamp` not `immutable` |
| CL-25 | Low | PRE-DEPLOY | **Resolved** | Constructor arity change breaks callers |
| CL-26 | Low | BOTH | **Resolved (Solidity)** | Token multiplier lookup fails open |
| CL-27 | High | — | Needs-Verification | Seven environments lack native lock programs |
| CL-28 | Low | packaging | **Open** | Build artifacts shipped in release |
| CL-29 | Low | PRE-DEPLOY | **Open (partial)** | Dead code: unused event, unused modifier |
| CL-30 | Low | PRE-DEPLOY | **Open** | RAC fee USD derived proportionally |
| CL-31 | Critical | PRE-DEPLOY | **Resolved** | Non-ASCII in string literal halts compilation |
| CL-32 | Critical | PRE-DEPLOY | **Resolved** | Commitment multipliers overflow `uint16` |
| CL-33 | High | PRE-DEPLOY | **Resolved** | Verifier exceeds stack without IR pipeline |
| CL-34 | Medium | PRE-DEPLOY | **Resolved** | Position weight had no external accessor |
| CL-55 | Critical | PRE-DEPLOY | **Open** | SPL commit path overruns the 4KB stack frame |
| CL-56 | Critical | PRE-DEPLOY | **Fixed-Unverified** | u128 fee arithmetic truncates at the u64 transfer boundary |
| CL-57 | Critical | PRE-DEPLOY | **Fixed-Unverified** | PDA signer seeds freed while borrowed — four sites |
| CL-58 | Critical | build | **Fixed-Unverified** | `rust-toolchain.toml` pinned a 2017 compiler |
| CL-59 | Medium | build | **Fixed-Unverified** | No `Cargo.lock` — dependency graph unreproducible |
| CL-60 | High | tooling | **Open** | IDL generation impossible on this toolchain; blocks all Solana tests |
| CL-61 | Critical | PRE-DEPLOY | **Resolved** | Solana vault had never been compiled |
| CL-62 | — | PRE-DEPLOY | Needs-Verification | Four Solidity contracts modified, provenance unknown |
| CL-63 | Critical | PRE-DEPLOY | **Open** | SPL vault is per-mint, its token authority is per-lock |
| CL-64 | Critical | PRE-DEPLOY | **Open** | Native path cannot move lamports out of the lock PDA |
| CL-65 | High | PRE-DEPLOY | **Open** | `vault_mint` unchecked against the lock record |
| CL-66 | Critical | PRE-DEPLOY | **Open** | Handshake allowance never initialized; no Handshake can succeed |
| CL-67 | Low | PRE-DEPLOY | **Open** | Every account over-allocated by 8 bytes |
| CL-68 | Low | PRE-DEPLOY | **Open** | `state.rs` doc comment says keccak256; code and README say SHA-256 |
| CL-69 | Medium | PRE-DEPLOY | **Open** | `verified_gross_usd_micro` is 18-decimal, not micro |
| CL-70 | Low | PRE-DEPLOY | **Open** | Handshake allowance justified by chain label, contrary to VF-COM-006 |
| CL-71 | High | PRE-DEPLOY | **Open (severity disputed)** | No on-chain registry check; non-refundable fee makes preflight-only enforcement lossy |
| CL-72 | Critical | build | **Resolved** | Program ID was the Anchor placeholder, in three places |
| CL-73 | Low | tooling | **Open** | Test validator cloning URL points at mainnet-beta |

**Open Critical: 12.** CL-01, CL-02, CL-06, CL-09, CL-10, CL-11, CL-12, CL-55, CL-63, CL-64, CL-66, and CL-43 (recovered from the reconciliation list below). (v3 stated 6 while listing 7; the count was wrong, the list was right.)

**The three that stop the program working:** CL-64 (no native lock can complete), CL-63 (no second SPL lock of any asset can complete), CL-66 (no Handshake can ever succeed). Together they mean the Solana vault has never been capable of completing a single Commitment Vault Lock end to end, for any asset, by any path.

---

## CORRECTIONS TO v2 — errors by this reviewer

**Three findings were wrongly marked Resolved in v2.** CL-03, CL-04 and CL-05 were recorded as fixed on the strength of a diff Base44 reported. On 2026-08-03 the actual `VinculumFinalisStake.sol` was compiled and tested: it was byte-identical to the original package. **The fix had never been applied to any file.** I verified the arithmetic in a reported diff instead of verifying the file. Same error class as accepting conversation summaries as source.

They are now genuinely Resolved, by edits made and tested in this session.

**CL-04 root-cause note was wrong.** v2 stated §5.1 was "implemented correctly at `Verifier.sol:598-616`, all sixteen entries." The values are correct; the return type could not hold five of them and the file did not compile. Corrected by CL-32.

**The contracts had never been compiled.** Three independent hard errors (CL-31, CL-32, CL-33). This is not a question of testing depth. Nothing was ever built.

## CORRECTIONS TO v3

**CL-27 is narrowed, not closed.** v3 recorded seven environments as lacking native lock programs. Subsequent forensic audit reproduced XRPL (5 tests), Stellar (3), DigiByte (3), confirmed Algorand TEAL genuine, and compiled the Cardano validator cleanly. CL-27 no longer applies to those environments.

**Cosmos test results have been provided.** v3's standing request is closed: 45 tests passing, observed directly. Removed from Scope Not Reviewed.

**"Solana and XRPL lock programs (inventoried only)" understated the problem.** Inventory implied source existed and was merely unread. For Solana, source existed but had never been built by anyone — see CL-61. The distinction matters: unread code carries unknown defects, unbuilt code carries *guaranteed* defects, discovered in layers as each blocker clears.

---

## OPEN — CRITICAL

### CL-01 · Unauthenticated USD value permits arbitrary issuance
- **Evidence:** `VinculumFinalisVerifier.sol:397-401`, `:340-343`. `verifiedGrossUsdMicro` is caller-supplied; no signature check, no batch lookup.
- **Spec:** VF-ORC-007 · **Test:** `verifier_rejects_unsigned_price_record()` · **Workstream:** W2

### CL-02 · Discretionary post-deployment authority — PARTIALLY RESOLVED
- **Token: FIXED.** `setMinter` deleted. One-shot `initialize()` sets two permanent minters and zeroes `deployer` in the same call. Six passing tests, including that the original deployer retains no minting power.
- **Still open in three contracts:**
  - `VinculumFinalisVerifier.sol:296,314,318` — `registerAssetPrecision`, `registerChainVerifier`, `configureDevFund` permanently open.
  - `VinculumFinalisSynth.sol:106,110` — `setVerifier`, `setTokenContracts`.
  - `VinculumFinalisStake.sol:153` — `onlyAuthority` modifier retained.
- **`registerChainVerifier` is the severe one:** it can install a verifier that validates forged locks.
- **Spec:** VF-IMM-001/002/004, VF-DEP-006/007 · **Workstream:** W1 remainder

### CL-06 · `rewardBasis` never assigned
- **Evidence:** `VinculumFinalisStake.sol` closeEpoch — comment only, no assignment. Solidity only; JS assigns correctly.
- **Spec:** VF-RAC-004 · **Depends-on:** Verifier RAC storage · **Workstream:** W4

### CL-09 · Unbounded loops brick epoch processing
- **Evidence:** `VinculumFinalisStake.sol` closeEpoch and allocateEpoch iterate every position ever created.
- **Impact:** once past the block gas limit both are uncallable; chronological ordering then freezes rewards permanently, and VF-IMM-006 forecloses repair. Fails in proportion to adoption.
- **Requires a design change** (running totals or pagination), not a patch. · **Workstream:** W4

### CL-10 · `daysSinceLaunch` caller-supplied
- **Evidence:** `Verifier.sol:400`; `vfVerifierEngine.js:443` defaults it to **0**, the highest emission rate.
- **Spec:** VF-ORC-013 · **Workstream:** W2

### CL-11 · Handshake allowance bypassed
- **Evidence:** `Verifier.sol:454` reads `pkg.handshakeAllowanceCount` from the caller. Three-use branch unimplemented.
- **Spec:** VF-COM-006/007 · **Workstream:** W2

### CL-12 · Dev Fund enforcement commented out
- **Evidence:** `Verifier.sol:465-467`, `require` present only as commented text.
- **Spec:** VF-FEE-009 · **Workstream:** W2

### CL-55 · SPL commit path overruns the 4KB stack frame
- **Evidence:** `anchor build`, 2026-08-11: `Stack offset of 5592 exceeded max offset of 4096 by 1496 bytes` in `CommitVaultLockSpl::try_accounts`.
- **Mechanism:** Solana imposes a 4KB per-frame stack limit. The SPL account-validation struct requires 5,592 bytes. The linker emits the `.so` regardless — this is a warning at build time and a fault at **runtime**.
- **Blast radius:** of 78 registered Solana assets, native SOL is one. Every other asset commits through the SPL path. This is the majority path, not an edge case.
- **Remedy:** box the oversized account fields to move them from stack to heap. A real code change, not a flag.
- **Why this ranks above CL-60:** CL-60 blocks testing; CL-55 breaks the product. · **Workstream:** W6 (Solana)

### CL-63 · SPL vault is per-mint, its token authority is per-lock
- **Evidence:** `commit_vault_lock.rs` — `vault_token_account` at `seeds = [SEED_VAULT, mint.key().as_ref()]`, created with `token::authority = lock_record`; `lock_record` at `seeds = [SEED_LOCK, &params.lock_id_hash]`.
- **Mechanism:** the first lock of a mint creates the shared vault and installs *its own* lock record as permanent token authority. The second lock of that mint reaches `init_if_needed`, finds the account existing, and Anchor re-checks the authority constraint against lock #2's record. Mismatch, revert. **Every SPL asset is lockable exactly once, protocol-lifetime.** Not fund loss — the second lock never executes.
- **Disclosure status:** the per-mint topology is documented (README PDA table, "principal custody per token"). The authority coupling that makes it single-use is **not** disclosed and is a defect, not a design position.
- **Specification derivation — not a judgement call.** §11 grants the topology explicitly: equivalent outcomes, security and economic performance are required; identical contracts, transaction structures, state models and implementation methods are not. The spec then fixes per-lock release outcomes that constrain the choice — §3.2 step 8 (reclaim independently of Base issuance or any external service), VF-PRI-005 (no registry update, relayer or administrator required), VF-SEC-006 (independent of every Base-chain and external dependency), VF-PRI-006 second half (releasable even if Base verification fails permanently). Any topology qualifies **iff** each lock's principal is releasable at its own maturity with no dependency outside that lock. Vault-per-lock satisfies this by construction; vault-per-mint satisfies it only through per-lock accounting that must itself be proven, and creates a shared balance where one lock's accounting defect reaches another lock's funds. **VF-IMM-006 decides it:** where a deployed defect cannot be repaired, a guarantee enforced by structure beats one enforced by arithmetic, because only one of them can be wrong.
- **Position:** vault-per-lock, seeded on `lock_id_hash`. This **overturns a documented architecture decision** and must be argued as such, not applied silently. · **Workstream:** W6

### CL-64 · Native path cannot move lamports out of the lock PDA
- **Evidence:** `commit_vault_lock.rs` fee transfer and `release_principal.rs` native release both call `system_program::transfer` with `from: lock_record`.
- **Mechanism:** the System Program refuses to transfer lamports from an account that is program-owned and carries data. `lock_record` is both. **Every native SOL commit fails at the fee transfer; every native release fails unconditionally.**
- **Correct approach:** direct lamport manipulation on the account, not a System Program CPI. Rent exemption must be preserved on the record after principal leaves.
- **Not disclosed anywhere.** · **Workstream:** W6

### CL-66 · Handshake allowance never initialized — no Handshake can ever succeed
- **Evidence:** `state.rs` defines `impl Default for HandshakeAllowance` setting `remaining` and `allowance` to `HANDSHAKE_ALLOWANCE` (3), with a comment stating `init_if_needed` uses it. **Anchor never calls `Default`** — it allocates, writes the discriminator, and deserializes zeroed bytes. `consume_handshake` sets `identity`, `source_account` and `bump` on first use and **never assigns `allowance`**. The next statement is `require!(ha.remaining > 0)`.
- **Consequence:** every Handshake reverts with `HandshakeAllowanceExhausted`, for every identity, permanently. The $1 Trust-Building Handshake is the protocol's on-ramp; it is closed.
- **Worse than an undisclosed gap:** README Architecture Decision 4 asserts the three-use allowance as working behavior. Documentation claiming a feature the code defeats is more dangerous than a disclosed limitation, because no reader is prompted to check it.
- **Fix:** assign `allowance` and `remaining` from `HANDSHAKE_ALLOWANCE` in the first-initialization branch; delete the `Default` impl rather than leave a second thing that reads like an initializer. · **Workstream:** W6

---

## OPEN — SOLANA, LOWER SEVERITY

**CL-65** · High · `ReleasePrincipalSpl.vault_mint` is documented as "verified to match the lock record's canonical_asset". Nothing compares them. Currently contained by CL-63's authority coupling — **so fixing CL-63 removes the accidental protection.** The two must be fixed together or the fix opens a hole.

**CL-67** · Low · `Config::LEN`, `LockRecord::LEN` and `HandshakeAllowance::LEN` each include `8 // discriminator`, and every `#[account(init)]` allocates `space = 8 + Self::LEN`. The discriminator is paid for twice on every account the protocol creates.

**CL-68** · Low · `state.rs` documents `lock_id_hash` as keccak256; the code computes `solana_program::hash::hashv` (SHA-256) and both `constants.rs` and the README say SHA-256. Stale comment. Matters because VF-XCH-013 global uniqueness requires the EVM side to agree.

**CL-69** · Medium · `verified_gross_usd_micro` carries 18-decimal fixed-point values (`$0.95 × 10^18`). "Micro" denotes 10^6. An off-chain caller trusting the field name is wrong by twelve orders of magnitude. Same defect class as CL-56 and CL-43: an implementation convention that governs behavior and lives outside the specification.

**CL-70** · Low · `constants.rs` justifies the three-use allowance as "Account-model mechanism — Solana PDAs maintain atomic persistent per-identity state". VF-COM-006's closing sentence forbids exactly this route: *the applicable allowance is determined by the actual selected source mechanism, not by a broad chain label.* The value is correct; the justification is a chain-label argument. **Live trap for the five Bitcoin-family UTXO environments**, where the same reasoning yields a wrong number. Raised by the owner, not this reviewer.

**CL-71** · High, **severity disputed** · The program embeds no registry and accepts any valid SPL mint. README Known Limitation 5 discloses this and treats it as benign because VF-REG-001 is enforced by off-chain preflight. **The disclosure does not reckon with VF-ARC-004 plus the non-refundable fee rule (§5.2):** a known-invalid request must be rejected before assets move wherever the source environment can determine the invalidity, and registry membership is determinable at source. Today a user who reaches the program with an unapproved asset has 5% of it moved irrevocably to the Dev Fund, and Base then refuses issuance. **Fee taken, no rights created, no recourse.** §5.2.2 makes the application responsible for preflight; the on-chain program is the fail-safe behind it, and the fail-safe is absent. Also: the `commit_vault_lock.rs` header claims it enforces VF-REG-001, and `AssetNotInRegistry` is defined and never constructed.

**CL-73** · Low · `Anchor.toml` `[test.validator] url` points at `api.mainnet-beta.solana.com`. Inert with no clone entries, but test infrastructure aimed at mainnet is a foot-gun before anyone writes tests that lean on it.

**Also noted:** eight error variants are defined and never constructed — `InvalidOutputToken`, `ChonxNotActivated`, `ProtocolTokenProhibited`, `LockAlreadyExists`, `ConfigNotInitialized`, `Unauthorized`, `InvalidPda`, `AssetNotInRegistry`. Two are disclosed with reasons (VF-TOK-007, VF-REG-001). The remaining six are a fair map of requirements someone intended to enforce and did not.

---

## FIXED-UNVERIFIED — Solana vault

**Status definition.** The defect is corrected in the repository and the program now compiles. No test has executed the corrected path, because no Solana test has ever run (CL-60). Under the arbitration rule these are **not Resolved**. They move to Resolved when a named test asserts them.

Committed as `30c709a` on branch `redteam/prep`, 2026-08-11.

### CL-56 · u128 fee arithmetic truncates at the u64 transfer boundary
- **Evidence:** six `E0308` type mismatches at transfer call sites in `commit_vault_lock.rs` and `release_principal.rs`.
- **Mechanism:** fee math is carried in `u128` — correctly, since `gross × bps` overflows `u64`. SPL token amounts are `u64`. The narrowing at the transfer boundary was unhandled.
- **Specification finding:** Rev 6 governs the arithmetic (VF-COM-011 fee = floor(gross × bps / 10000), VF-COM-012 principal = gross − fee, VF-COM-013 reject before assets move) but is **silent on integer width** — grep-verified: zero occurrences of u64, u128, 64-bit, 128-bit, overflow, saturate, or truncate across all 209 requirements.
- **Fix:** checked conversion returning the existing `ErrorCode::MathOverflow`. No new error variant, no invented requirement. In `commit_vault_lock.rs` the conversions are hoisted ahead of any transfer, matching VF-COM-013's fail-before-assets-move ordering; in `release_principal.rs` they are inline.
- **Rejected alternative — do not revisit:** `.try_into().unwrap()`. A panic inside `release_principal` traps user funds permanently, which VF-IMM-006 makes unrepairable. Rejected 2026-08-11.
- **Rejected method — do not revisit:** selecting the integer width by what satisfies the compiler. The width was chosen against the specification; the compiler only reported that a choice was required.
- **Rev 7 candidate:** see A6. · **Verification owed:** a test asserting that an amount exceeding `u64::MAX` is rejected rather than truncated.

### CL-57 · PDA signer seeds freed while still borrowed
- **Evidence:** four `E0716` errors, one at each PDA-signed transfer site — both fee transfers in `commit_vault_lock.rs`, both principal releases in `release_principal.rs`.
- **Mechanism:** `&[signer_seeds]` constructs an unnamed temporary that is dropped at the end of the statement while `CpiContext` still holds a borrow of it.
- **Not reviewer-introduced:** the pattern is byte-identical in the untouched original files. Verified before editing.
- **Fix:** bind to a named local, then borrow the binding. Pure Rust lifetime mechanics — one correct answer, no design latitude.
- **Verification owed:** any test that executes a PDA-signed transfer.

### CL-58 · `rust-toolchain.toml` pinned a 2017 compiler
- **Evidence:** the file specified `channel = "1.18.0"`. That is Rust 1.18, released 2017. The intended value was the Solana CLI version — a version number transposed into the wrong field.
- **Corollary finding:** the program had therefore never been built from its own committed configuration by anyone.
- **Fix:** file deleted. · **Verification owed:** build reproduced on a second machine.

### CL-59 · No `Cargo.lock` — dependency graph unreproducible
- **Evidence:** absent from the repository; Anchor 0.30.1 ships none.
- **Impact:** every build resolved 146 transitive dependencies independently. Two builds of the same commit were not guaranteed to be the same program. For a protocol whose deployed bytecode is permanent, an unpinned dependency graph is a supply-chain exposure, not a convenience issue.
- **Fix:** `Cargo.lock` generated and committed.

### CL-72 · Program ID was the Anchor placeholder — RESOLVED
- **Evidence:** `declare_id!` and both `Anchor.toml` program sections carried `Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS`, the Anchor template default. The keypair built on 2026-08-11 is `2oQy57MWn8xmFBP1g4xi7cXdzTtut7UbdqNmVEzubUfH`.
- **Consequence had it shipped:** every PDA — config, lock records, handshake allowances, vaults — derives from the declared program ID. The program could not sign for its own accounts. Nothing would have worked on a validator even with the IDL resolved.
- **Disclosed** as README Assumption 1; corrected here rather than discovered.
- **Resolved 2026-08-12,** commit `33941da`, three occurrences in two files. Verified: program compiles under Rust 1.79.0 in 9.91s carrying the new ID, and `grep` returns the placeholder only in the README's own disclosure text.
- **Owed before deployment:** the keypair was auto-generated into `target/deploy/`, which is gitignored and is destroyed by `cargo clean`. Under §2 the program address is permanent once deployed. It should be a key generated deliberately and backed up, not a build artifact inherited from a first compile.

---

## OPEN — LOWER SEVERITY

**CL-13** replay flag after external call (`Verifier.sol:534`) · VF-XCH-013 · W5
**CL-16** mints `distributed` not `totalReward`; VF-STK-027 remainder unreachable · W4
**CL-17** `creationTimestamp`/`maturityTimestamp` extracted and discarded (`Verifier.sol:479-486`) · VF-XCH-011 · W2
**CL-28** `src/cosmos-hub-vault/target/` ships ~3,000 build artifacts · add to `.gitignore`
**CL-29** partially fixed — `MinterChanged` and Token's `onlyAuthority` removed; `VerificationRejected` (Verifier) and `onlyAuthority` (Stake, Synth) remain
**CL-30** `Verifier.sol:380` derives fee USD proportionally · VF-ORC-012
**CL-28 addendum** three untracked artifacts at the Solana tree — two fix archives and `build_errors.txt`. Delete or gitignore; do not commit.

### CL-60 · IDL generation impossible on this toolchain
- **Evidence:** `target/idl/` empty after a successful program build.
- **Mechanism — a three-way version vise, none of whose constraints can be relaxed independently:**
  - `anchor-syn` 0.30.1 calls `proc_macro2::Span::source_file()`.
  - `proc-macro2` ≥ 1.0.95 removed that method — `anchor-syn` will not compile.
  - `proc-macro2` ≤ 1.0.94 references `proc_macro::SourceFile` inside rustc itself — deleted in host Rust 1.97.1.
  - No `proc-macro2` version satisfies both against a 1.97.1 host.
- **Attempted:** pin to 1.0.94 → lockfile v4 rejected by Anchor's bundled cargo 1.75 → downgraded lockfile to v3 → `E0425`/`E0599` inside proc-macro2 against the host compiler.
- **2026-08-12 — remedy attempted and abandoned.** Under `rustup run 1.79.0 anchor build` the program compiled in 9.91s and proc-macro2 ceased to be the blocker, confirming the diagnosis. The IDL step then failed one layer deeper on `rayon` (requires rustc 1.80+); pinning `rayon` 1.10.0 and `rayon-core` 1.12.1 cleared that; host cargo rewrote `Cargo.lock` to version 4, which Anchor's bundled cargo 1.75 cannot read; downgrading the lockfile to version 3 cleared that; the build then failed inside `ark-bn254` 0.4.0, where the `MontFp!` macro could not parse its own literals — 53 errors.
- **Conclusion: the pinning ladder is a dead end.** Four layers, each fix revealing the next, with no bounded end visible. Continuing means a dependency graph nobody can explain underneath a program whose bytecode is permanent.
- **The decision to make instead:** Anchor 0.30.1's IDL generator depends on a rustc API that no longer exists. Anchor 0.31 replaced that mechanism. Upgrading is a deliberate change to the build of an immutable protocol and belongs in its own session with verification — not appended to a long one.
- **Lockfile churn from this attempt was reverted** (`git checkout -- Cargo.lock`); the repository carries none of it.
- **Not a defect in this codebase** — a documented Anchor 0.30.1 ecosystem issue. Recorded because it blocks all ten Solana tests, and an untested vault cannot pass a freeze gate.

### CL-61 · The Solana vault had never been compiled — RESOLVED
- **Evidence:** four independent blockers surfaced strictly in sequence, each invisible until the prior one cleared: type mismatches (CL-56), then lifetime errors (CL-57), then the toolchain pin (CL-58), then the missing lockfile (CL-59). Rust type-checks before it borrow-checks, so CL-56 masked CL-57 entirely.
- **Why the layering is itself the evidence:** a program that had ever compiled anywhere could not hold a first-layer type error. The sequence proves no build had ever been attempted, by anyone, at any point in the project's history.
- **Resolved 2026-08-11:** `target/deploy/vf_solana_vault.so`, 413,144 bytes. First successful compile in project history.
- **Same class as the v2 Solidity finding.** Twice now, code has been carried as complete on the strength of its appearance. The general remedy is not more careful reading; it is that nothing counts as existing until it builds.

### CL-62 · Four Solidity contracts modified, provenance unknown — NEEDS-VERIFICATION
- **Evidence:** `git status` shows `VinculumFinalisStake.sol`, `VinculumFinalisSynth.sol`, `VinculumFinalisToken.sol`, `VinculumFinalisVerifier.sol` and `package-lock.json` as modified. Not touched in the 2026-08-11 session.
- **Probable cause:** residue from an earlier overlay extraction. Unverified.
- **Deliberately excluded from `30c709a`.** Diff and explain each change before any commit. Contract source does not get committed on a probable cause.

---

## RESOLVED — each with a passing test

| ID | Fix | Test |
|---|---|---|
| CL-02 | Critical | PRE-DEPLOY | **Open (partial)** | Discretionary post-deployment authority |
| CL-03 | `_getWeight` = amount x token x duration, single division | `chonx_weight_twice_vclm`, `synth_weight_four_times_vclm` |
| CL-04 | 10000 / 14000 / 17500 / 20000 bps per §10.1 | four duration assertions |
| CL-05 | T0-relative, 1-indexed epochs both layers | smoke deploy + epoch guards |
| CL-07 | Two permanent minters; Stake authorized for VCLM | `stake_is_authorized_vclm_minter` |
| CL-08 | `terminalState` set at zero VCLM capacity | terminal-state entry |
| CL-14 | `queueExtension` reverts on expired position | `queueExtension_reverts_once_expired` |
| CL-15 | Terminal state permits immediate withdrawal | terminal withdrawal |
| CL-18 | Hardhat harness, 19 tests | the harness |
| CL-21 | `require(_launchTimestamp > 0)` — no silent default | constructor revert |
| CL-22 | `require(epochN >= 1)` in both paths | epoch-zero rejection |
| CL-23 | Returns 0 before launch, no underflow | pre-launch guard |
| CL-24 | `immutable launchTimestamp` | compile-enforced |
| CL-25 | Constructor takes T0; callers updated | smoke deploy |
| CL-26 | Unknown token reverts, no VCLM default | `_getTokenMultiplier` revert |
| CL-31 | Em dash → ASCII hyphen, `Synth.sol:157` | compiles |
| CL-32 | `uint16` → `uint32`, `Verifier.sol:565,598` | compiles |
| CL-33 | `viaIR: true` | compiles |
| CL-34 | `getPositionWeight()` external view | made CL-03 testable |

**Note on CL-14/21/22/26:** resolved in Solidity only. The JS layer at `src/lib/` still carries these and remains **live**. CL-14 in particular is an economically exploitable backdating attack in the running preview.

---

## NEEDS-VERIFICATION

**CL-27 — narrowed.** Stellar and DigiByte are cleared: both reproduced with passing tests (3 each). XRPL cleared separately (5 tests). Algorand TEAL confirmed genuine; Cardano validator compiles clean. **Still outstanding:** Bitcoin, Bitcoin Cash, Litecoin, Dogecoin, Zcash — the five Bitcoin-family UTXO chains, which share one CLTV timelock script pattern. Resolve before publishing 17 environments as live.

**CL-62** — see above.

---

## SEQUENCE

0. **W6 (Solana), now first, and reordered by v5.** The account-model rewrite comes before everything else: **CL-63 + CL-65 together** (vault-per-lock; they must move as one or the fix opens a hole), then **CL-64** (direct lamport manipulation on the native path), then **CL-66** (assign the allowance; delete the dead `Default`). **CL-55 is now downstream** — boxing account fields measures a struct the CL-63 fix redesigns, so measuring first wastes the measurement. Then the Anchor upgrade decision for CL-60, then execute the ten tests, which promotes CL-56–CL-59 out of Fixed-Unverified.

   **Why this order changed.** The session opened intending to fix CL-55. Reading `commit_vault_lock.rs` to do so surfaced CL-63; reading `release_principal.rs` to confirm it surfaced CL-64 and CL-65; reading `state.rs` for the account definitions surfaced CL-66. The stack overflow went from first to eighth without anyone changing their mind about its severity.
1. **W1 remainder** — CL-02 in Verifier, Synth, Stake. `registerChainVerifier` first.
2. **W2** — CL-01, 10, 11, 12, 17, 30. One rewrite of the `verifyAndMint` entry path; six findings, one pass.
3. **W4** — CL-06, 09, 16. CL-09 is a design change.
4. **W5** — CL-13.
5. **JS parity** — port CL-14, 21, 22, 26 to `src/lib/`.
6. **Hygiene** — CL-28, 29.
7. **CL-62** — diff and explain the four modified contracts before they enter any commit.
8. **Fold CL-35 through CL-54 into this register** from their originating documents, per the reconciliation notice.
9. **Independent paid audit.**

**On the audit.** §2 makes this code unpatchable after deployment; VF-IMM-006 accepts unrepairable defects as a consequence. The audit is the only error-correction mechanism the design permits.

---

## SCOPE NOT REVIEWED

Base44 backend functions · `vinculum_price_fetcher_v9.py` · 98 JSX components · Architecture Design document · 209-row traceability CSV · the five Bitcoin-family UTXO lock scripts (CL-27 remainder) · **17 of 18 requirement families** — only VF-PRI has had a family-level review; VF-COM is partially covered through CL-56.

**Removed from this list since v3:** Cosmos vault (45 tests observed passing) · Solana lock program (now compiled and reviewed; CL-55 through CL-61) · XRPL, Stellar, DigiByte, Algorand, Cardano lock programs (reproduced or compiled).

---
---

# APPENDIX A — RATIONALE NOTES FOR REVISION 7

**Why these exist.** Each records reasoning that was reconstructed from scratch in a working session, cost real time, and would otherwise be reconstructed again by the next reader — human or AI — starting with fresh eyes. Each names the wrong path explicitly so it is recognized as already-walked rather than newly-clever.

**Do not edit Revision 6 to add these.** Rev 6 is hash-locked and that hash is cited throughout this register. Editing it breaks the chain of custody. These belong in the Style & Terminology Guide now, and in Rev 7 when it is cut.

## A1 — Deployment authority is governed by §15, not §2 alone

VF-IMM-004 ("no temporary control may remain after finalization on the theory that it will be removed later") is routinely misread in isolation as forbidding any deployment-time authority. It does not.

VF-DEP-006 presupposes temporary deployment authority and governs its termination: it must be *demonstrably and irreversibly terminated before finalization*. VF-DEP-004 grants the implementer discretion over the initialization procedure.

Read together: authority existing during the deployment ceremony and then irreversibly burned is **compliant**. Authority surviving finalization is **forbidden**. VF-IMM-004 addresses only the second case.

**Consequence.** A one-shot initializer that permanently self-disables satisfies §2 and §15. Precomputed-address schemes are permitted but not required, and carry unrecoverable bricking risk under VF-IMM-006.

**Rejected reasoning — do not revisit:** "VF-IMM-004 forbids the initializer pattern, therefore addresses must be precomputed." Misreads §2 by not reading §15. Raised and rejected 2026-08-03.

## A2 — §5.1 and §10.1 multipliers are different tables

Commitment Vault duration multipliers (§5.1: 30d=1.15x, 60d=1.3x, 90d=1.5x, up to 8.0x at ten years) and Treasury Reward Stake duration multipliers (§10.1: 30d=1.0x, 60d=1.4x, 90d=1.75x, 120d=2.0x) are unrelated tables serving unrelated mechanisms.

**This is the confirmed root cause of CL-04.** The §5.1 table was transcribed into the staking contract. Because every value in it is a real protocol number, the error survived reading-based review and was caught only by a test asserting §10.1 directly.

**Rejected reasoning — do not revisit:** "1.15x appears in the specification, therefore 1.15x is correct for a 30-day stake." A value being real does not make it correctly located.

**Implementation consequence.** §10.1 weight is `amount x token multiplier x staking-duration multiplier`. Token multipliers (VCLM 1.0x, CHONX 2.0x, SYNTH 4.0x) apply *in addition to* duration. Omitting the token term is CL-03. VF-STK-003 requires both.

## A3 — A preview implementation is not drift

Where a build carries both a JavaScript and a Solidity implementation of the same logic, and the handoff designates the JavaScript as the live preview implementation, the JavaScript is **the product**, not an unauthorized copy.

**Rejected reasoning — do not revisit:** "Two implementations of the same math coexist, therefore one is shadow code and should be deleted." Raised and rejected 2026-08-03. Deleting it would have removed the running system.

**The valid residual concern.** Two hand-maintained implementations can carry the *same* wrong constant — exactly CL-03 and CL-04, where the suite was green because it agreed with the bug. Remedy: generate constants for both layers from `Vinculum_Finalis_Protocol_Constants.json` rather than transcribing.

## A4 — Test vectors come from the specification, never from the code

Expected values must be read from specification tables, never obtained by running an existing implementation and recording its output.

**Rationale.** CL-03 and CL-04 were present in two layers simultaneously and passed an 85-assertion suite, because the suite matched the implementation rather than the specification. A test derived from the code under test cannot detect a defect in that code.

**In-repo standard.** `src/cosmos-hub-vault/contracts/vault/src/tests.rs` — tests named after the requirement they enforce, boundary cases on both sides, negative cases present.

## A5 — A reported fix is not an applied fix

CL-03, CL-04 and CL-05 were marked Resolved in Register v2 on the strength of a reported diff. The file was later compiled and found byte-identical to the original. The fix existed only as a description.

**Standing rule.** A finding moves to Resolved only when a test asserts it against the file in the repository. Not when a diff is reviewed, not when a tool reports success, not when the arithmetic in a proposed change is verified correct.

## A6 — Integer width at the transfer boundary is unspecified

Revision 6 governs the fee arithmetic completely — VF-COM-011, 012 and 013 fix the formula, the subtraction and the ordering — and says nothing about the integers that carry it. Grep across all 209 requirements returns zero occurrences of u64, u128, 64-bit, 128-bit, overflow, saturate or truncate.

**Why that is a gap and not an omission by design.** Every target chain imposes its own native width. SPL token amounts are `u64`. A specification that fixes the arithmetic but not the domain leaves each implementer to decide independently what happens when a correct intermediate value cannot be represented at the boundary — and the available answers differ in kind, not degree: truncate silently, saturate, panic, or reject. Truncation misappropriates funds. A panic inside `release_principal` traps them permanently, which VF-IMM-006 makes unrepairable.

**Position taken for Rev 7.** Reject, returning a defined error. This follows VF-COM-013's existing pattern — refuse before assets move — and is the only option that neither loses value nor strands it.

**Defect class.** Same as CL-43 and VF-REG-012: an implementation convention that governs behavior while living outside the specification, so that every implementer re-derives it and any two may derive differently.

**Rejected reasoning — do not revisit:** "the compiler requires a conversion here, therefore use whichever conversion compiles." The compiler establishes that a choice exists. It has no view on which choice the protocol owes its users. Raised and rejected 2026-08-11.

## A7 — Unbuilt is worse than unread, and the difference is the discovery pattern

Reviewing a package that has never been compiled does not surface defects in a list. It surfaces them in **layers**, one per pass, because each blocker hides everything behind it. Rust type-checks before it borrow-checks, so six type errors concealed four lifetime errors completely; those in turn concealed an invalid toolchain pin; that concealed a missing lockfile. Four passes, four disjoint defect classes, no way to see pass three from pass one.

**Consequence for estimation.** After the first successful compile of any component, treat the defect count as unknown rather than nearly exhausted. CL-55 appeared only *after* the build succeeded, and it is more severe than any of the four blockers that preceded it.

**Consequence for review order.** Build first, read second. Reading a file that has never compiled spends attention on logic that the compiler would have rejected before logic mattered.

## A8 — Read the component's own disclosures before auditing it

A well-documented component states what it does not do. `solana-vault/README.md` carries *Architecture Decisions*, *Assumptions* and *Known Limitations* sections, and the last of those lists the missing registry, the placeholder program ID, the never-executed build and the unenforceable VF-TOK-007. Auditing the source without reading it produced ten findings of which roughly a third were already on the author's list.

**Cost of the omission.** Not wasted effort — the disclosed items still needed fixing, and CL-72 was fixed tonight. The cost is credibility: a register claiming discovery of documented limitations will be corrected by the paid auditor, at their hourly rate, and every genuine finding beside it is read more sceptically afterwards.

**Standing rule.** Before reviewing any component, read its README, its architecture notes, and any limitations file, and classify every finding into one of three buckets:

1. **Undisclosed defect** — the author did not know. A finding.
2. **Disclosed limitation, severity understated** — the author knew and mis-assessed the consequence. A finding, argued against the disclosure rather than against the code. CL-71 is the example: the missing registry is disclosed, but the disclosure does not reckon with VF-ARC-004 and the non-refundable fee.
3. **Disclosed limitation, correctly assessed** — not a finding. Track it as outstanding work.

**Rejected reasoning — do not revisit:** "the code does not do what its header comment claims, therefore this is an undiscovered defect." A header comment is not the project's disclosure surface. Raised and rejected 2026-08-12.

**Sixteen environments remain.** Making this mistake once cost a corrections section. Making it sixteen times would cost the register's authority at exactly the moment it is being handed to an auditor.

## A9 — Documentation that asserts working behavior is more dangerous than documentation that admits a gap

CL-71 and CL-66 are the same protocol at two extremes. The missing registry is disclosed in Known Limitations, so any reader is warned and can weigh it. The Handshake allowance is asserted in Architecture Decisions as a working three-use mechanism, and the code can never grant more than zero — so no reader is prompted to check, and the assertion actively suppresses the question.

**Consequence for review method.** Treat a component's *claims* as the highest-risk surface, not its *admissions*. An admission has already been reasoned about. A claim has been reasoned about once, at writing time, and never revisited — and where the claim is wrong, its confidence is what keeps it wrong.

**Consequence for the remaining environments.** For each one, extract the list of behaviors its documentation asserts as working, and test those first. The gaps are already written down; the false claims are not.
