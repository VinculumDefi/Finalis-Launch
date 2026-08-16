# Vinculum Finalis — Project Review Status

**Status document version:** 3
**Last updated:** 2026-08-16
**Evidence last verified against repository:** 2026-08-16
**Branch:** `redteam/prep`
**Head commit at time of writing:** `0855fd6`
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

## Project axioms

Settled foundational design decisions, fixed by the Master Specification and the
Approved Asset Registry. **Not findings, not hypotheses, not open questions.** A
reviewer encountering something that appears to contradict an axiom has found an
implementation gap or a reviewer error — not a reason to reopen the decision.
Only an explicit revision to the Master Specification changes an axiom.

1. **Base is the home chain.** VCLM, CHONX and SYNTH are minted on Base
   (VF-ARC-001).
2. **Base is also one of the 17 approved source environments.** Rev 6 §11.1
   lists `EVM | Base | 33`. Both roles hold simultaneously.
3. **The Approved Asset Registry is authoritative.** 1,001 assets across 17
   environments. Membership is never inferred from code.
4. **Axelar ITS is the mandatory cross-chain transport layer** and may not be
   replaced (VF-XCH-018). Transport is not issuance (VF-XCH-021, VF-SUP-014).
   Architecture Section O specifies native verification per environment; **no
   Section O verifier row names Axelar.**
5. **The Master Specification governs implementation, never the reverse.**
6. **The protocol is immutable across all 17 environments.** No pause, no
   upgrade path.

**Repository First Rule.** Before presenting a design question to the architect,
exhaust the Master Specification, Architecture Design, this document, the
Findings Register, and the relevant implementation. A question answered by an
authoritative artifact is not an open question. Reviewer uncertainty is not
evidence that a decision is open.

**Delivery Rule.** A document is not delivered until it appears in a commit.
Registers v11 and v12 were written and never committed; their findings existed
in no repository artifact until v13.

---

## Branch state

All red-team review work exists **only on `redteam/prep`**.

`origin/main` is at `22dacbc`, twelve commits behind. A reviewer who clones this
repository and remains on `main` will see none of the findings, evidence, tests,
or remediation described below. **Check out `redteam/prep` before reviewing.**

---

## Current status by component

**"Complete" means** the implementation satisfies the Verifier Completion
Standard (`standards/VERIFIER_COMPLETION_STANDARD.md`) and has committed
evidence under `evidence/`. It does not mean deployed, and it does not mean
audited.

### Base environment — COMPLETE

| Item | Status | Evidence |
|---|---|---|
| Build | ✅ Compiles | `evidence/ARBITRUM_C5_2026-08-16.txt` |
| Full suite | ✅ **260 passing, 0 failing at `0855fd6`** | `evidence/ARBITRUM_C5_2026-08-16.txt` |
| Commitment vault | ✅ Implemented, 22 tests | `evidence/BASE_VAULT_TEST_2026-08-15.txt` |
| Same-chain verifier | ✅ Implemented, 8 tests | `evidence/BASE_VERIFIER_TEST_2026-08-15.txt` |
| End-to-end issuance | ✅ Verified, 222,795 gas | `evidence/BASE_E2E_TEST_2026-08-15.txt` |
| CL-76 regression | ✅ Green — forged package mints 0.0 | `evidence/CL76_REGRESSION_GREEN_2026-08-15.txt` |

`VinculumFinalisBaseVault` + `CommitmentLock` (`afa3bd7`) implement the Base
source mechanism required by Rev 6 §11.1 and architecture C.6. Per-lock
isolation via EIP-1167 clones; release depends on nothing external; Verified
Gross USD derived from the oracle-signed price record; registry membership
enforced before value moves.

`BaseSameChainVerifier` (`de5f633`, `e067337`) reads every returned fact from
vault storage and ignores `sourceFinalityProof` entirely. Base was reviewed against
Section O's twelve design elements and found consistent with each.

### Chain verifiers

| Verifier | Environment | State |
|---|---|---|
| `BaseSameChainVerifier` | Base | ✅ Reads vault storage directly |
| `UtxoChainVerifier` | Bitcoin, Bitcoin Cash | ✅ SPV inclusion + CLTV lock parsing |
| `EthereumChainVerifier` | Ethereum | ✅ L1 header → receipt proof → lock event |
| `OpStackChainVerifier` | Optimism | ✅ L1 → output root → L2 header → receipt |
| `PolygonChainVerifier` | Polygon | ✅ L1 → checkpoint → leaf path → receipt |
| `ArbitrumChainVerifier` | Arbitrum | ✅ L1 → confirmed assertion → L2 header → receipt |
| `EvmChainVerifier` | BNB, Avalanche | ❌ Non-operational |
| `SolanaChainVerifier` | Solana | ❌ Non-operational |
| `StellarChainVerifier` | Stellar | ❌ Non-operational |
| `XrplChainVerifier` | XRP Ledger | ❌ Non-operational |
| Cosmos verifier | Cosmos Hub | ❌ Does not exist |

Every implemented verifier derives its facts from a chain-recorded commitment
rather than a caller assertion, and compares proven trie values against the
caller's supplied bytes at each level. Addresses and event topics are immutable
constructor arguments.

Verifiers marked ❌ are **explicitly non-operational**, reverting with a named
not-implemented error under the fail-closed policy below — not placeholders that
appear to work.

Bitcoin Cash is code-complete but **parameter-blocked**: C.17 marks its
confirmation count DESIGN DEFINED, and Verifier Completion Standard §3.3 forbids
defaulting it.

### Light clients and proof libraries

| Component | Serves | Evidence |
|---|---|---|
| `Sha256dHeaderChain` | Bitcoin, Bitcoin Cash | `evidence/SPV_HEADER_CHAIN_2026-08-15.txt` |
| `BitcoinTx` | All six UTXO chains | `evidence/BITCOIN_C8_COMPLETE_2026-08-16.txt` |
| `MerklePatriciaProof` | All seven EVM chains | `evidence/MPT_LIBRARY_2026-08-16.txt` |
| `EvmReceipt` | All seven EVM chains | `evidence/ETHEREUM_C1_2026-08-16.txt` |
| `L1BlockRegistry` | Ethereum, Optimism, Polygon, Arbitrum | `evidence/L1_HEADER_AUTH_2026-08-16.txt` |

`L1BlockRegistry` reads the OP Stack `L1Block` predeploy, which Base's own
derivation pipeline writes. It introduces no new trust party — the same L1
dependency Base's security already rests on.

`Sha256dHeaderChain` validates proof of work on-chain and was tested against real
Bitcoin mainnet headers. It serves SHA256d chains only.

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

Full detail: `reviewers/Vinculum_Finalis_Findings_Register_v15.md`.

| ID | Severity | Status | Summary |
|---|---|---|---|
| CL-76 | Critical | **7 environments resolved; 10 open** | Proof system authenticated nothing. Regression test green and permanent. |
| CL-82 | High | **Open** | No EVM source vault contracts exist for the six remote EVM environments. |
| CL-77 | High | Open | `04_endtoend` exercises `MockChainVerifier`, not production verifiers. |
| CL-02 | Critical | Status questioned | Entry cites line numbers from a superseded contract. |
| CL-27 | — | **Resolved as specified; implementation environment-specific** | The Bitcoin-family transaction format **is** specified in Architecture C.8 and C.13–C.17. What was absent was implementation, now present for Bitcoin and Bitcoin Cash. Source lock mechanisms remain unimplemented for other environments. |
| CL-79 | Critical | **Resolved** | Base source mechanism built (`afa3bd7`). |
| CL-80 | Critical | **Resolved** | `EvmChainVerifier` fail-closed (`cc59904`). |
| CL-81 | — | **Resolved** | `IChainVerifier.extractFacts` was `pure`, forbidding any verification. |
| CL-78 | Medium | Resolved | `setMinConfirmations` had no access control. |

**On CL-76's regression test.** The original exploit — a fabricated package that
minted 15.003 VCLM from a lock that existed nowhere — has been **retained as a
permanent regression test with its assertion inverted**. It now asserts the mint
is refused, and will fail the moment the vulnerability returns. The test is not
to be deleted.

## Blockers — established from governing artifacts

**B-3 · Consensus authentication not implemented for six environments.**
BNB and Avalanche require validator-signature verification (C.2 fast-finality
votes; C.3 Snowman membership). Solana, Stellar, XRPL and Cosmos require
signature-based finality per Section O. No implementation exists in this
repository. **Whether deployable implementations are achievable on Base has not
been established either way from the governing artifacts.**

**B-4 · Non-SHA256d proof of work not implemented.**
Litecoin and Dogecoin use scrypt, DigiByte rotates five algorithms, Zcash uses
Equihash. `Sha256dHeaderChain` does not serve them and no alternative exists
here. As above, impossibility has not been demonstrated — only absence.

**B-5 · Source mechanisms unsettled, independent of any verifier.**
XRPL (C.10) — the atomic batch's mainnet availability is DESIGN DEFINED.
Cosmos Hub (C.12) — EVIDENCE REQUIRED — CHAIN-NATIVE FEASIBILITY ANALYSIS
INCOMPLETE, pending a five-part evidence package.

**B-6 · Confirmation counts undefined.**
Bitcoin Cash, Litecoin, Dogecoin, DigiByte — C.13 through C.15 and C.17 mark
the exact depth-N rule DESIGN DEFINED.

**External protocol details used but not verified against mainnet.**
Each is exposed so it can be checked before deployment: Optimism's output-root
preimage (`computeOutputRoot`), Polygon's checkpoint leaf and tree
(`computeLeaf`, `verifyCheckpointPath`), Arbitrum's confirmation event (topic is
a constructor argument). None is stated in the governing artifacts.

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

```
evidence/
  ARTIFACT_INVENTORY_2026-08-08.md
  BASE_HARNESS_RUN_2026-08-09.txt          116 passing (pre-remediation)
  BASE_TEST_2026-08-15.txt                 116 passing / 3 failing
  BASE_VAULT_TEST_2026-08-15.txt           vault suite
  BASE_VERIFIER_TEST_2026-08-15.txt        verifier suite
  BASE_E2E_TEST_2026-08-15.txt             end-to-end, 222,795 gas
  BASE_COMPLETE_2026-08-15.txt             151 passing / 3 failing
  EVM_FAILCLOSED_TEST_2026-08-15.txt       CL-80
  SPV_HEADER_CHAIN_2026-08-15.txt          166 passing / 3 failing
  UTXO_SPV_2026-08-15.txt                  176 passing / 3 failing
  CL76_REGRESSION_GREEN_2026-08-15.txt     179 passing / 0 failing
  MPT_LIBRARY_2026-08-16.txt               189 passing / 0 failing  <- current
  COSMOS_TEST_RUN_2026-08-09.txt           45 passed, 0 failed
  CL-09_EVIDENCE_RECORD.md
  CL-38_DECISION_BRIEF.md
  CL-50_COVERAGE_INVESTIGATION.md
  CL-53_EXECUTION_INVESTIGATION.md
  FAMILY_REVIEW_01_VF-PRI.md
  IMPLEMENTATION_DOMAIN_AUDIT.md
  NATIVE_TO_BASE_CONNECTION_STATUS.md
  REMAINING_CRITICALS_MAPPING.md
  RUNBOOK_source_chain_tests.md
  VERIFICATION_LEVEL_AUDIT.md

base-contracts/test/
  10_cl76_forged_package.test.cjs          CL-76 regression (green)
  11_base_vault.test.cjs                   22 tests
  12_base_verifier.test.cjs                8 tests
  13_base_e2e.test.cjs                     5 tests
  14_header_chain.test.cjs                 15 tests
  15_utxo_verifier.test.cjs                10 tests
  16_mpt.test.cjs                          10 tests

reviewers/
  Vinculum_Finalis_Findings_Register_v13.md
  Vinculum_Finalis_Session_Handoff_Brief_v1.md
  REQUIREMENT_COVERAGE_REVIEW_STANDARD_v3.md
  REVIEWER_BRIEFING_AND_PROMPTS.md
  GROK_SPECIFICATION_AUDIT_PROMPT_v2.md

standards/
  VERIFIER_COMPLETION_STANDARD.md
  BASE_COMMITMENT_VAULT_DESIGN_BRIEF.md
```

### Evidence gaps — known and specific

| Gap | What would close it |
|---|---|
| Solana build outcome | Commit `cargo build` output under `evidence/` |
| Cosmos Base-side verifier | Contract does not exist; `cosmos-hub-proof-adapter` unexamined |
| Session Handoff Brief | `reviewers/` holds v1; v4 exists outside the repository and needs a §4 correction |
| `core.autocrlf` unset | A `.gitattributes` would stop phantom whole-file modifications in `git status` |
| CL-02 re-verification | Re-read against current source |

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

1. **CL-82 — EVM source vault contracts.** Six environments, unblocked. C.1
   through C.5 and C.7 specify the same `createLock()` mechanism as the Base
   vault, and Base-side verifiers for four of the six are already tested against
   the event format.
2. **Verify the three external protocol details** against real chain data before
   any deployment relies on them.
3. **Deployment evidence from Base** for the `L1Block` predeploy integration.
4. **B-6 confirmation counts** — evidence-gathering, not implementation.
5. **B-3, B-4, B-5** — require establishing whether deployable mechanisms exist.
6. **Carry-forward:** CL-02 re-verification; Solana build evidence; Session
   Handoff Brief still at v1.
