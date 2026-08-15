# Vinculum Finalis — Project Review Status

**Last updated:** 2026-08-15
**Branch:** `redteam/prep`
**Head commit at time of writing:** `220a115`
**Audience:** any reviewer, human or AI. No prior conversation context required.

---

## Evidence Rule 1

Statements in this document SHALL be supported by repository artifacts — code,
tests, commits, evidence files, findings, specifications, or architecture
documents. If support cannot be verified from the repository, the statement
SHALL be identified as unverified or omitted.

**Three levels of evidence, in descending authority:**

1. **Repository artifacts** — evidence files, test output, build logs, code,
   specifications. Highest authority. Records *what the outcome was*.
2. **Git history** — proves *that* work happened. Does **not** establish what
   the outcome was. A commit fixing a build is not evidence the build succeeded.
3. **Conversation and recollection** — useful for directing investigation.
   Never the final authority, and never promoted into this document.

---

## Branch state

All red-team review work exists **only on `redteam/prep`**.

`origin/main` is at `22dacbc`, twelve commits behind. A reviewer who clones this
repository and remains on `main` will see none of the findings, evidence, tests,
or remediation described below. **Check out `redteam/prep` before reviewing.**

---

## Current status by component

### Base contracts — PARTIALLY REMEDIATED, VERIFICATION LAYER ABSENT

| Item | Status | Evidence |
|---|---|---|
| Build | ✅ Compiles | `evidence/BASE_HARNESS_RUN_2026-08-09.txt` |
| Test suite (pre-remediation) | ✅ 116 passing | `evidence/BASE_HARNESS_RUN_2026-08-09.txt` |
| Test suite (post-remediation) | ⚠️ 116 passing / 3 failing | **No artifact committed — see Evidence Gaps** |
| Cross-chain verification | ❌ Absent | CL-76, Register v10 |

Node v24.15.0. Suite runtime 31s.

The three post-remediation failures are `base-contracts/test/10_cl76_forged_package.test.cjs`
and are **expected**. That test demonstrates CL-76 and must fail while the
verifiers are non-operational. Do not "repair" it into passing.

### Chain verifiers — FAIL-CLOSED, NOT IMPLEMENTED

Commit `220a115`.

| Verifier | State |
|---|---|
| `UtxoChainVerifier` | Non-operational — reverts `VerifierNotImplemented("utxo")` |
| `SolanaChainVerifier` | Non-operational — reverts `VerifierNotImplemented("solana")` |
| `StellarChainVerifier` | Non-operational — reverts `VerifierNotImplemented("stellar")` |
| `XrplChainVerifier` | Non-operational — reverts `VerifierNotImplemented("xrpl")` |
| `EvmChainVerifier` | **Unmodified.** Placeholder success path still present. Next work item. |
| Cosmos verifier | **Does not exist** in `base-contracts/contracts/chain-verifiers/` |

Per-chain finality taxonomy and implementation requirements are preserved in
each file's header comments.

### Cosmos vault — VERIFIED

`evidence/COSMOS_TEST_RUN_2026-08-09.txt`, lines 4 and 51: **45 tests run,
45 passed, 0 failed.** Committed in `63f3a82`.

> **Evidence note.** Rust `cargo test` logs contain multiple test targets. In
> this artifact the final lines report the `schema.rs` and documentation targets
> (0 tests each), while the primary unit-test result appears earlier in the file.
> Reviewers must inspect **all** test-result blocks rather than the file tail.

Note: Cosmos is a Rev 6 §11.1 environment but has **no Base-side verifier**.

### Solana vault — WORK COMMITTED, OUTCOME UNVERIFIED

Commits `30c709a` (u64 transfer widths, PDA signer-seed lifetimes, `Cargo.lock`
added, invalid `rust-toolchain.toml` removed) and `33941da` (placeholder program
ID replaced with the built keypair address).

**No build or test artifact has been committed under `evidence/`.** The commits
establish that the fixes were made; they do not establish that the build
succeeded. Level-2 evidence only. Closing this gap requires committing the
`cargo build` output.

---

## Open findings — highest priority first

Full detail: `reviewers/Vinculum_Finalis_Findings_Register_v10.md`.

| ID | Severity | Status | Summary |
|---|---|---|---|
| CL-76 | Critical | **Open — Pre-deployment** | Cross-chain proof system authenticates nothing. Mint path removed by fail-closed; verification still absent. |
| CL-77 | High | Open | No test exercised any production chain verifier. `04_endtoend` uses `MockChainVerifier` and passes `"0x"` as the finality proof. |
| CL-02 | Critical | **Status questioned** | Register entry cites line numbers from a superseded contract. Requires full re-verification against current source. |
| CL-78 | Medium | Resolved by remediation | `setMinConfirmations` had no access control. Removed. Must not return without an explicit authority. |
| CL-27 | — | Answered | No Bitcoin-family locking script exists in the repository. Producer absent, consumer present. |

**CL-76 is classified Pre-deployment on this evidence:** a repo-wide search for
`registerChainVerifier|finalizeConfiguration` returned no deployment script of
any language, and no `deployments/` or `broadcast/` directory exists.
`configurationFinalized` has never been set true outside a test harness.

---

## Deployment gate

**DG-07 — No non-Base environment may be deployed until its verifier
authenticates source evidence and passes an environment verification suite
demonstrating that forged proofs are rejected.**

---

## Engineering policy (pending formal adoption in Revision 7)

**Fail-closed policy.** A security-critical component may exist in only one of
two states: (1) fully implemented and evidenced, or (2) explicitly
non-operational, reverting with an explicit not-implemented error. Placeholder
implementations that appear operational are prohibited.

**Evidence artifact policy.** Every successful build or test run that resolves
or bears on a finding SHALL produce a committed artifact under `evidence/`
before the branch is considered complete.

---

## Evidence inventory

All paths relative to repository root.

```
evidence/
  ARTIFACT_INVENTORY_2026-08-08.md
  BASE_HARNESS_RUN_2026-08-09.txt          116 passing (pre-remediation)
  CL-09_EVIDENCE_RECORD.md
  CL-38_DECISION_BRIEF.md
  CL-50_COVERAGE_INVESTIGATION.md
  CL-53_EXECUTION_INVESTIGATION.md
  COSMOS_TEST_RUN_2026-08-09.txt           45 passed, 0 failed
  FAMILY_REVIEW_01_VF-PRI.md
  IMPLEMENTATION_DOMAIN_AUDIT.md
  NATIVE_TO_BASE_CONNECTION_STATUS.md
  REMAINING_CRITICALS_MAPPING.md
  RUNBOOK_source_chain_tests.md
  VERIFICATION_LEVEL_AUDIT.md

base-contracts/test/
  10_cl76_forged_package.test.cjs          CL-76 exploit / regression test

reviewers/
  Vinculum_Finalis_Findings_Register_v10.md
  Vinculum_Finalis_Session_Handoff_Brief_v1.md
  REQUIREMENT_COVERAGE_REVIEW_STANDARD_v3.md
  REVIEWER_BRIEFING_AND_PROMPTS.md
  GROK_SPECIFICATION_AUDIT_PROMPT_v2.md
```

### Evidence gaps — known and specific

| Gap | What would close it |
|---|---|
| Post-remediation Base run | Commit `evidence/BASE_TEST_2026-08-15.txt` (116 passing / 3 failing) |
| Solana build outcome | Commit `cargo build` output under `evidence/` |
| Section O of the Architecture Design document | Has not been read in the Claude review column. Its contents are UNRESOLVED. |
| Cosmos Base-side verifier | Does not exist. `cosmos-hub-proof-adapter` directory unexamined. |
| Session Handoff Brief | `reviewers/` holds v1. v4 exists outside the repository and requires a §4 correction before committing. |

---

## Specification

**Revision 6** is the hash-locked North Star:
`5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9` (SHA-256).
209 unique `VF-***` requirements. Revision 7 is a working draft at
`spec/Vinculum_Finalis_Revision_7_WORKING_DRAFT.md` and is **non-normative**.

Scope: **17 environments** — 7 EVM (Ethereum, BNB, Avalanche, Polygon,
Arbitrum, Base, Optimism; 914 assets) and 10 non-EVM (Bitcoin, Bitcoin Cash,
Solana, XRP Ledger, Stellar, Cosmos, Litecoin, Dogecoin, DigiByte, Zcash).
Registry: 1,001 assets. Cardano and Algorand are **wrapped registry assets, not
environments.**

Cross-chain transport requirements verified verbatim against the hash-locked
Rev 6 specification: **VF-XCH-018** (Axelar ITS mandatory, not replaceable by
another bridging system), **VF-XCH-021** and **VF-SUP-014** (interchain
transport does not constitute issuance).

---

## Next engineering priorities

1. **Verifier Completion Standard** — define what "complete" means for any
   verifier, before building one. Becomes Revision 7 policy.
2. **`EvmChainVerifier` Base same-chain implementation** — the only verifier
   implementable without a trust-model decision. Reads Base vault state
   directly. Becomes the reference implementation.
3. **Trust model for the remaining sixteen environments** — operator-owned
   decision. Constrained by VF-XCH-012 (transport may not alter or redirect)
   and VF-XCH-017 (no discretionary human authority over issuance; trust
   assumptions must be documented). An attestation quorum has been eliminated
   by operator decision.
4. **Close the evidence gaps** listed above.
5. **Re-verify CL-02** against current source.
