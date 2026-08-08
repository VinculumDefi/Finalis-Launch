# CL-50 — Source-Chain Implementation Coverage
## Evidence investigation · 2026-08-07

**Question:** where is each requirement implemented, and does that implementation exist?

**Method rule applied:** no conclusion here rests on anyone's recollection. Every statement cites a file that can be opened and checked. Where evidence is absent, this document says *unlocated* rather than *missing* — those are different claims and only one of them is supported.

---

## PRIMARY EVIDENCE FOUND

### 1. `Vinculum_Finalis_Requirement_Traceability.csv` — 209 rows, one per requirement

This artifact was in the package throughout and had not been consulted. It carries, for every requirement: specification section, architecture component, **planned implementation location**, positive and negative test obligations, deployment verification obligation, external dependency, and current status.

**It substantially answers the question this investigation was opened to ask.**

### 2. `NATIVE_TO_BASE_CONNECTION_STATUS.md` — 152 lines

An earlier evidence-based workspace inventory. **It describes a prior workspace state, not the current one**, and must not be read as current: it reports zero Solidity files present, while the current package contains ten under `src/base-verifier/contracts/`. Its value is historical — it records that at the time of writing, the Cosmos Hub vault source existed but was undeployed, no Base minting contract existed, and no 1,001-asset registry data file was present in that workspace.

---

## WHERE REQUIREMENTS ARE IMPLEMENTED

From the traceability matrix, 209 requirements distribute as:

| Planned location | Count | Share |
|---|---|---|
| **Base** | 95 | 45% |
| **Source chain** | 32 | 15% |
| **Source/Base** (both) | 14 | 7% |
| **Base/Source, Base/remote, Off-chain/Base** | 10 | 5% |
| Deployment / deployment finalization | 15 | 7% |
| Governance process | 10 | 5% |
| Off-chain | 8 | 4% |
| Tests | 8 | 4% |
| Public app | 7 | 3% |
| All / all components | 3 | 1% |
| Other single-instance locations | 7 | 3% |

**Roughly 46 of 209 requirements (22%) depend wholly or partly on source-chain implementations.** VF-PRI is one family among several.

**This bounds every remaining family review.** A family whose requirements are Base-located can be verified against the 116-test harness. A family that is source-located cannot, and the VF-PRI conclusion — *implemented somewhere we have not tested* — will recur.

---

## ⚠️ THE MORE SIGNIFICANT FINDING

The status column reports:

| Status claimed | Count |
|---|---|
| **RESOLVED — ARCHITECTURE DEFINED** | 188 |
| DESIGN DEFINED — DEPLOYABILITY EVIDENCE REQUIRED | 16 |
| DEFERRED EXTERNAL INPUT | 4 |
| PARTIAL — EVIDENCE REQUIRED | 1 |

**"RESOLVED — ARCHITECTURE DEFINED" is not an implementation claim, and it is certainly not an evidence claim.**

It states that the architecture for the requirement has been decided. It does not state that code exists, that the code is correct, or that any test exercises it. 188 of 209 requirements — 90% — carry that status.

**This is the same failure the Evidence Register was built to correct, at a different layer.** The register distinguishes S / U / I / E precisely because "resolved" collapses several very different states into one word. The traceability matrix uses a single label for architecture-decided, and a reader scanning it would reasonably conclude the protocol is 90% resolved.

Concretely: VF-PRI-002 — *principal may be released only once* — would carry "RESOLVED — ARCHITECTURE DEFINED." Today's family review graded it **A**: implemented in the environments located, with no test execution ever observed. Those are the same requirement described two ways, and only one of the descriptions would survive an auditor's follow-up question.

**Recommendation:** the traceability matrix should carry the Evidence Register's levels rather than a single resolution status. That is a mechanical merge — the matrix has the requirement IDs, the register has the evidence — and it produces one artifact instead of two that disagree in tone.

---

## SOURCE-CHAIN IMPLEMENTATIONS — CURRENT PACKAGE

Verified by direct file inventory of `/home/claude/vf/src/`:

| Environment | Artifacts | Status |
|---|---|---|
| Base (EVM) | 10 `.sol` under `base-verifier/contracts/` | Present. Compiled and tested — 116 passing |
| Cosmos Hub | 7 `.rs` under `cosmos-hub-vault/contracts/vault/` | Present. 45 test functions. **No run output ever observed** |
| Solana | 9 `.rs`, 2 `.ts` under `solana-vault/` | Present, includes `release_principal.rs`. **No run output ever observed** |
| XRPL | 1 `.js`, plus `migrations/` and `tests/` | Scaffolding present. Implementation depth unverified |
| Cosmos proof adapter | 2 `.js` | Present |
| **Remaining 13 environments** | **none found in this package** | **UNLOCATED — see below** |

## What "unlocated" means, and does not mean

**It does not mean not implemented.** A prior forensic audit independently verified native lock packages for XRPL, Stellar, DigiByte, Algorand and Cardano — that audit is referenced in project history but its artifacts are not in the package under review. Two of those five (Stellar, Cardano) have no directory here at all.

The possible states are materially different and the evidence does not currently distinguish them:

1. Implemented, present in another repository or archived deliverable
2. Implemented, present but not included in this package
3. Specified, intentionally not yet implemented
4. Never implemented

**Resolution required before freeze:** for each of the seventeen environments, record which of these four states applies, and cite the artifact establishing it. Not recollection — a repository, a commit, an archive hash, or an explicit statement of non-implementation.

---

## FINDINGS

**CL-50 — Source-chain implementation coverage unestablished. Severity: Major. Type: coverage finding.**

Four of seventeen environments have located implementations in this package. Thirteen are unlocated. Approximately 46 requirements depend wholly or partly on source-chain code. Until the inventory above is completed, no family containing source-located requirements can be graded above **A** for those environments.

**CL-52 — Traceability matrix status vocabulary overstates completion. Severity: Minor. Type: documentation defect.**

"RESOLVED — ARCHITECTURE DEFINED" applied to 188 of 209 requirements conflates architecture decided with implemented and with evidenced. The matrix and the Evidence Register describe the same protocol in incompatible terms.

**Resolution:** merge the register's evidence levels into the matrix. Mechanical, and it removes a document that would mislead an auditor reading it alone.

**CL-53 — Cosmos and Solana test suites have never been executed under observation. Severity: Minor. Type: evidence gap.**

45 Cosmos test functions and a Solana test file exist. No run output has been produced in any session. Their passing status is assumed, not observed — precisely the condition that made CL-01's "closed" status unreliable.

**Resolution:** run both suites and capture output. If a toolchain is unavailable, record that as the reason rather than leaving the status ambiguous.

---

## METHOD NOTE

The traceability matrix was in the package for the entire remediation and was not opened until this investigation. It maps every requirement to a planned implementation location — information that would have shaped the review method from the start, and that would have prevented the VF-PRI review's initial wrong turn.

**Amendment for the remaining seventeen families:** consult the traceability matrix row for each requirement *before* assessing it. It states where the implementation is expected to live. Treat its status column as a claim to be verified, never as evidence.
