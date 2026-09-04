# Vinculum Finalis — Independent Review Findings Register
## Reviewer column: CLAUDE · v17 · 2026-09-03

**Governing authority:** `Vinculum_Finalis_Master_Specification_Revision_6_2026-07-28.docx`
**Hash verified:** SHA-256 `5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9` — re-verified 2026-08-03, unchanged.
**Supersedes:** Register v9 (2026-08-13). v10 records the CL-76 exploit test result, the fail-closed remediation, three reviewer-error corrections, and three new findings., v6 (2026-08-13) and v5 (2026-08-12 evening). v4 was never committed to the repository and remains superseded; see Corrections to v4.

**Scope change since v16.** No new finding. v17 records what CL-85 (commit `0ccf94d`, red-team Wave 3) did and did not do to CL-76, and adds a **production-configuration reproduction** of CL-76's surviving half that v16 did not have. The minting path and the accounting path are separated for the first time. The finding remains **OPEN** and its resolution remains the operator's design decision, unchanged. v17 also records a weakness in CL-76's own regression test.

**Method change since v2.** Every status below is now backed by a compiled contract and an executed test, not by reading. Toolchain: Hardhat 2.22.17, solc 0.8.19, optimizer 200 runs, `viaIR: true`.

**Scope change since v3.** v3 covered the Base/Solidity layer only; Solana and Cosmos were listed as not reviewed. v4 adds the Solana vault (CL-55 through CL-61) and closes the Cosmos test-results request.

**Scope change since v4.** v4 recorded the Solana build session. v5 records the first whole-program read of the Solana vault — every source file examined as a system rather than at the sites the compiler complained about. Ten findings, CL-63 through CL-73. **Three of them mean the program cannot perform its function at all.** One fix applied and verified (CL-72, commit `33941da`).

**Scope change since v7.** v8 records **CL-76**, a Critical affecting all seventeen environments, found by reading the five chain-verifier contracts and their consumer. It also corrects the environment accounting against §11.1 of the specification, which does not match what the handoff documents have been carrying. The CLTV question that opened the session is answered — not as originally framed.

**Scope change since v6.** No new code was examined. v7 records three things: a reviewer error in the Session Handoff Brief corrected, **Appendix A's disposition rule rewritten** after its wholesale-inclusion instruction was found to be wrong, and **A6 and A10's corollary verified directly against the Revision 6 document** rather than resting on the register's own assertion. It also records a standing instruction from the operator that changes how findings may be verified. No finding changed severity.

**Scope change since v5.** v5 recorded the first whole-program read of the Solana vault. v6 records a **test-vector provenance audit** — the first examination of whether the passing tests are entitled to be believed. It produced the project's first cleanly arbitrated fix (CL-74, commit `7bd2db6`), one downgrade after a reviewer error (CL-75), and one reframing (CL-69 is protocol-wide, not Solana-specific).

**What the provenance audit is, and why it was run before more code.** Forty-five passing Cosmos tests tell a reader nothing until the reader knows where the expected values came from. A test whose expected value was read off the implementation certifies only that the implementation agrees with itself — the CL-03/CL-04 failure class, which survived an 85-assertion suite. Eight Cosmos tests were sampled across families. One was exemplary. One was a tautology, and the tautology was concealing a Critical defect in a table that governs every lock the chain will ever accept.

**Numbering correction made while compiling v4.** The new Solana findings were first drafted as CL-35 onward, which collided: **CL-35 through CL-54 were already assigned** after v3 was cut, and live only in standalone documents — `REMAINING_CRITICALS_MAPPING.md`, `IMPLEMENTATION_DOMAIN_AUDIT.md`, `CL-38_DECISION_BRIEF.md`, `CL-50_COVERAGE_INVESTIGATION.md`, `CL-53_EXECUTION_INVESTIGATION.md`, `FAMILY_REVIEW_01_VF-PRI.md`, `VERIFICATION_LEVEL_AUDIT.md`. Renumbered to CL-55–CL-62. **See the reconciliation notice below: this register is twenty findings behind, and that gap is itself the finding.**

**Current test state.**

| Layer | Tests | Status |
|---|---|---|
| Base (Solidity) | 116 | passing, observed |
| Cosmos (CosmWasm) | 46 | passing, observed. Was 45; CL-74 replaced one tautological test with two spec-derived ones |
| Solana (Anchor) | 10 | **never executed** — blocked by CL-60, which v5 concludes is a dead end by the current method |

A finding is marked Resolved only where a named test asserts it. **Four Solana findings below are marked Fixed-Unverified, not Resolved** (CL-56, CL-57, CL-58, CL-59), because no Solana test has ever run. Compilation is evidence that the defect no longer blocks a build; it is not evidence that the behavior is correct.

---

## SESSION CARRY-FORWARD — read this first

**Why this section exists.** This work is conducted across chat sessions that do not share memory. Anything recorded only in a conversation is lost when that conversation ends; anything recorded here and committed survives. This section is the handoff. It is not a summary of the register — it is the state a new reader needs before the register makes sense.

**Where the work stands.**

| Layer | Built | Tests | Trustworthy? |
|---|---|---|---|
| Base (Solidity) | yes | 116 passing | **Provenance unaudited.** Same question CL-74 answered for Cosmos has not been asked here |
| Cosmos (CosmWasm) | yes | 46 passing | Partially. 8 of 46 sampled for provenance; 38 unexamined |
| Solana (Anchor) | yes | 10, **never executed** | No. Blocked by CL-60 |

**The three findings that mean the Solana program has never worked**, for any asset, by any path: CL-64 (no native lock can complete), CL-63 (no second SPL lock of any asset can complete), CL-66 (no Handshake can ever succeed). These are not degradations. They are total.

**Decisions already made, so they are not re-litigated:**
- CL-63's remedy is **vault-per-lock**, derived from §11 latitude constrained by the per-lock release guarantees and decided by VF-IMM-006. It overturns a documented architecture decision in the Solana README and must be argued in writing, not applied silently.
- CL-60's pinning ladder is a **dead end** — four dependency layers deep with no bounded end. The real remedy is an Anchor 0.31 upgrade, which is a deliberate change to an immutable protocol's build and deserves its own session.
- CL-75's remedy is **two changes that must not be conflated**: correct Cosmos's scale to 18-decimal, and correct the name "micro" protocol-wide. Renaming Cosmos to match the wrong convention would propagate the error.
- Documentation correction is scheduled **after** code freeze, not before. See Documentation Debt.

**Standing instruction, issued 2026-08-13 — the operator is not a verification source.** He is not a reviewer and cannot verify technical claims. He must not be asked to sanity-check, confirm, or cross-check analysis; his agreement carries no information and converting it into a recorded fact is the CL-03/CL-04 failure class with a human standing in for a test. His recollection is a hypothesis to be checked against a source, never a fact to be recorded. Where a question cannot be settled from the specification, the register, an uploaded file, or a terminal command, **it is recorded here as unresolved.** Unresolved is a legitimate status. Design intent, business direction, risk appetite, priorities and scope are his and are brought to him plainly; everything else the reviewer owns. Recorded in full at Handoff Brief v4 §3.7.

**Companion brief is now v4.** v2 was wrong about Appendix A (see Corrections to Brief v2 below); v3 fixed that; v4 adds the standing instruction above. Any session holding v2 or v3 is holding a superseded document.

**CL-76 supersedes the priority question below.** The operator chose the CLTV grep; it ran; it led here. The provenance-audit-versus-CLTV choice is now moot — CL-76 outranks both, and its resolution is a design decision, not a verification task.

**The next single task — SUPERSEDED, retained for the record. Was a priorities question for the operator, not a technical one.** Two governing documents disagree. This register's v6 carry-forward said: continue the provenance audit (38 Cosmos tests, 116 Base tests, sweeping for the A11 signature). Handoff Brief §10 item 5 said: run the CLTV grep first, because five of seventeen advertised environments may have no lock implementation in the repository at all. **The grep has still never been executed.** The two are not rankable on technical grounds — one deepens confidence in code known to exist, the other tests whether claimed code exists. Both are legitimate. The choice is the operator's and is recorded as open until he makes it.

---

## CORRECTIONS TO SESSION HANDOFF BRIEF v2 — errors by this reviewer

**Brief v2 §1.4 mischaracterized Appendix A of this register.** It described these notes as "Revision 7 candidate amendments" living in two places, and it separately reproduced A8–A11 in its §7 as "the derived axioms" without stating they were the same series. A reader could reasonably conclude two A-series existed. Neither claim survives opening the appendix.

**What is actually true.** One series, A1 through A11, titled **"Rationale Notes for Revision 7."** Most entries are review methodology and carry no specification change of any kind.

**Why the error was not cosmetic.** Brief v2 also instructed that Rev 7 be incorporated at the freeze gate, and Appendix A's own header instructed that these notes go into Rev 7 wholesale when it is cut. Followed together, the two would have imported audit methodology — how to read a README, how to sequence a build, how to write a test — into a protocol specification governing an immutable deployment. That is a category error, and it would have been committed at the single point in the process where the document is hardest to unwind.

**The corrected rule, and it now governs.** Only the subset of Appendix A entries that names an actual **gap in the specification** enters Rev 7, and that subset is selected **entry by entry at freeze.** Never wholesale. Appendix A's header is corrected below to say so. Handoff Brief v3 §1.4 carries the same rule.

**Second error, same session.** Having classified the entries, this reviewer asked the operator to "sanity-check against your own read" and to confirm a conclusion "when you get there." He cannot do either — he is not a reviewer — and the request invited exactly the false verification this register exists to prevent. Both questions were answerable from documents already in hand and were subsequently answered that way. See the standing instruction in the carry-forward block.

**Also corrected.** Brief v2 named a repository file `REVISION_7_CANDIDATE_AMENDMENTS.md`. The document in hand is `Revision_7_Candidate_Log.md`. Whether both exist is untested and unimportant; what matters is below.

---

## `Revision_7_Candidate_Log.md` — SCOPE CAVEAT OWED

The Log sweeps **code to specification**: does any intentional implementation behavior extend, override, or contradict Rev 6 without a governing requirement? Its answer is no, and within that scope the answer stands. Its stated exclusions are explicit and include deferred requirements.

**Its closing line — "No protocol changes requiring a new Master Specification revision were found" — reads as global and is not.** It sweeps the direction that finds unauthorized code. It does not sweep the direction that finds missing specification, and A6 and A10 both name gaps it never looked for.

**Consequence.** A reader arriving at the freeze gate holding only the Log would conclude Rev 7 is empty and skip the Appendix A selection entirely. **Owed before freeze:** one sentence in the Log stating its direction and pointing at Appendix A. Recorded as open.

---

## CORRECTIONS TO v5 — errors by this reviewer

**CL-75 was asserted Critical on a one-sided read.** The finding was that Cosmos and Solana carry the same field name, `HANDSHAKE_USD_MIN_MICRO`, at scales twelve orders of magnitude apart — Cosmos in true micro (10^6), Solana in 18-decimal fixed point. From that I concluded a cross-chain issuance break: Base could only be right about one of them.

**Base is right about neither, because Base never reads the field.** `VinculumFinalisVerifier.sol:225` states it categorically — no caller-supplied USD value is accepted anywhere in the contract. `_verifiedGrossUsdMicro()` (`:485-500`) derives the value itself from the committed amount, the signed price record, and the **registry's** precision divisor. The source chain's USD field has no path into Base's arithmetic. Two commands disproved the severity.

**Severity corrected Critical → Medium**, and the finding reclassified: not a break in the issuance path, an evidence-consistency and naming defect. The substance survives — see CL-75 below — but the consequence I stated was wrong.

**The generalizable error, and the rule it produces.** I reported a cross-chain finding having read one chain. The other side was reachable in two commands and I did not spend them. **A cross-chain finding is not a finding until both sides have been read; one side is a hypothesis.** Recorded as A10. This is the same error class as A5 — accepting a claim without exercising it — committed by the reviewer, inside an audit whose central lesson is that unverified claims propagate.

**Cost of the error had it stood.** A Critical entry in a register cited at a freeze gate, aimed at the wrong chain, prescribing a change to Cosmos that would have converted the only correctly-named field in the protocol into the incorrectly-named convention used everywhere else.

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
| CL-69 | Medium | PRE-DEPLOY | **Open (reframed)** | "Micro" names an 18-decimal quantity — protocol-wide, not Solana-only |
| CL-70 | Low | PRE-DEPLOY | **Open** | Handshake allowance justified by chain label, contrary to VF-COM-006 |
| CL-71 | High | PRE-DEPLOY | **Open (severity disputed)** | No on-chain registry check; non-refundable fee makes preflight-only enforcement lossy |
| CL-72 | Critical | build | **Resolved** | Program ID was the Anchor placeholder, in three places |
| CL-73 | Low | tooling | **Open** | Test validator cloning URL points at mainnet-beta |
| CL-74 | Critical | PRE-DEPLOY | **Resolved** | Cosmos permitted-duration table wrong in seven places, behind a tautological test |
| CL-75 | Medium | PRE-DEPLOY | **Open** | Cosmos USD bound is 10^12 off the protocol's canonical scale (severity corrected from Critical) |

**Open Critical: 12.** (Unchanged from v5. CL-74 was raised and resolved within one session and never counted as open; CL-75 was corrected downward before it counted.)

**The twelve:** CL-01, CL-02, CL-06, CL-09, CL-10, CL-11, CL-12, CL-55, CL-63, CL-64, CL-66, and CL-43 (recovered from the reconciliation list below). (v3 stated 6 while listing 7; the count was wrong, the list was right.)

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

### CL-76 · Critical · **OPEN** — the cross-chain proof system authenticates nothing, on all seventeen environments

**Evidence.** Five verifier contracts read in full, plus `IChainVerifier.sol` (49 lines) and the consuming path in `VinculumFinalisVerifier.sol`. File hashes recorded: `UtxoChainVerifier.sol` `a1fe9fd408650464b175276ff83ba52302f6865144a7cdaff47c0ba3abd39680`, identical at `base-contracts/contracts/chain-verifiers/` and `src/base-verifier/contracts/chain-verifiers/`.

**The finding.** All five verifiers — `EvmChainVerifier` (108 lines), `UtxoChainVerifier` (62), `SolanaChainVerifier` (48), `StellarChainVerifier` (41), `XrplChainVerifier` (41) — carry a **byte-identical `extractFacts`**: a bare `abi.decode` of `lockEventProof`. Every `verifyFinality` decodes a caller-supplied assertion and requires it to be favourable:

| Verifier | The gate | Who supplies the value |
|---|---|---|
| Stellar | `require(closed)` | caller |
| XRPL | `require(validated)` | caller |
| Solana | `require(commitment == 1)` | caller |
| EVM | status codes / `l1Finalized` / `challengePassed` | caller; **`sameChain` returns `true` with no check** |
| UTXO | `require(confirmations >= 6)` | caller |

`UtxoChainVerifier.verifyFinality` additionally accepts `lockEventProof` and **never reads it** — nothing binds the finality claim to the lock it finalizes. None of the five has a light client, a merkle proof, or an attestation signature.

**Why the consumer does not save it.** `VinculumFinalisVerifier.verifyAndMint` is `external onlyWhenFinalized` — permissionless by design under VF-SEC-005. Step 11 cross-checks `extractFacts` output against the normalized package, and its comment states the intent correctly: extraction is meant to come from the chain-specific event rather than normalized fields, defeating relayer tampering. **Both sides originate from the same caller.** `extGross == pkg.grossAmountSmallestUnits` compares the caller's number to the caller's other number. This is A11's signature appearing in a contract rather than a test — the same witness testifying twice.

**Why the CL-01/CL-75 derivation does not save it either, and this is the part that inverts a settled conclusion.** Line 682 asserts that the quantities determining issuance are derived, not accepted. That is true for the USD price (signed publisher record, VF-ORC-007 — the only `ecrecover` in the contract) and true for the emission rate. **Issuance is price times quantity, and the quantity is not derived.** `_verifiedGrossUsdMicro` returns `pkg.grossAmountSmallestUnits * pr.priceUsdMicro * 1e12 / 10**_registeredPrecision(pkg)`. Authenticated price, registry divisor, **caller-supplied amount**. There is no signature over the ProofPackage anywhere in the contract. An authenticated price multiplied by an unauthenticated amount yields an unauthenticated result.

**Exploit path.** On any of the seventeen environments, any address calls `recordFeeAndRac` then `verifyAndMint` with a self-consistent fabricated package and mints VCLM or CHONX up to the hard cap, with no lock existing on any chain. Replay protection, the RAC precondition, the USD floor and the caps shape the attack; none prevent it.

**Classification (A8).** Bucket 1 — undisclosed defect. Lines 762–775 disclose a conscious deferral of VF-FEE-007, cryptographic verification that the *fee transfer* occurred. That disclosure is honest and does **not** extend to lock-event authenticity. This was not on the author's list.

**What is correct and must not be discarded in the fix.** The dispatch architecture is sound and `IChainVerifier` is the right seam. The per-chain finality taxonomy is correct and reflects real domain knowledge — Ethereum PoS finalized, Avalanche Snowman accepted, Polygon Heimdall v2 checkpoint, Solana max-rooted, Stellar SCP closed, XRPL validated ledger, UTXO confirmation depth. Step 11's cross-check design is right. The missing element is a mechanism establishing that an asserted fact is true. **One layer, not seventeen defects.**

**Consequence for every green suite.** 116 Base tests and the 24/24 mainnet solo test all passed with this in place, and necessarily would: a suite constructing its own proof packages always satisfies a cross-check between two caller-supplied fields. No existing test result is evidence about the proof path. This is the register's own lesson at maximum scale.

**Resolution is a DESIGN DECISION, not a fix, and it belongs to the operator.** Attestation quorum, per-chain light clients, or an existing proof protocol. They differ in cost, decentralization, and disclosed trust assumptions. **§2 immutability makes the choice permanent**, and an attestation quorum is a set of people holding power — the thing §2 exists to eliminate, and in tension with the operator's published pause-button position. **Recorded as unresolved pending his decision. No reviewer recommendation is recorded here.**

**CLASSIFICATION (v10): CRITICAL — PRE-DEPLOYMENT.** Blocks release. Not a production incident.

Deployment evidence, repo-wide grep for `registerChainVerifier|finalizeConfiguration` excluding `.md`, 12 results: two copies of `VinculumFinalisVerifier.sol`, one Hardhat build artifact, six test files, `BASELINE_85_tests.txt`, `evidence/BASE_HARNESS_RUN_2026-08-09.txt`. **No deployment script of any language or extension. No `deployments/` or `broadcast/` directory.** No finalized deployment of these contracts exists; `configurationFinalized` has never been set true outside a test harness. Verifier replacement therefore remained possible, and the fail-closed remediation below was available.

**VERIFIED BY TEST — the standing verification rule is satisfied for this finding.**

`base-contracts/test/10_cl76_forged_package.test.cjs`, run against the production `UtxoChainVerifier` (constructor `("bitcoin", 6)`), NOT `MockChainVerifier`:

- Pre-remediation, 3 passing: an unprivileged caller (signer #5, `0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc`, no deployer role, no lock on any chain) minted **15.003 VCLM** from a fabricated package. `verifyFinality` returned `true` for an invented block hash. A second distinct phantom lock minted again.
- Post-remediation, 3 failing: `VerifierNotImplemented("utxo")` raised at `UtxoChainVerifier.sol:58`, propagating through `VinculumFinalisVerifier.verifyAndMint` at `:792` — the same call site identified in the original analysis.
- Full suite post-remediation: **116 passing, 3 failing**, the three being CL-76 by design. No other test depended on placeholder success.

**REMEDIATION APPLIED (partial).** `UtxoChainVerifier`, `SolanaChainVerifier`, `StellarChainVerifier`, `XrplChainVerifier` replaced with explicit non-operational implementations reverting `VerifierNotImplemented` from both `verifyFinality` and `extractFacts`. Per-chain finality taxonomy and Section O requirements preserved as comments. `setMinConfirmations` removed. `EvmChainVerifier` deliberately untouched: its same-chain Base path is implementable without a trust-model decision and is the next work item. **CL-76 remains OPEN** — fail-closed removes the mint path; it does not supply verification.

**REVIEWER ERROR — CORRECTED (v10).** v9 stated a forged package could mint "to the hard cap" in a single call. **This is false.** `VF-COM-003` bounds each handshake to $0.95–$1.05 USD, enforced at `VinculumFinalisVerifier.sol:615` inside `recordFeeAndRac`, upstream of the verifier call. The observed mint was 15.003 VCLM. The defect is unchanged in kind — minting against a nonexistent lock breaks the supply invariant, and repetition is unbounded — but the per-transaction severity was overstated. Found by the test, not by reading; the reading missed VF-COM-003 entirely.

**HYPOTHESIS DISPROVED (v10).** The reviewer hypothesised Axelar might already be a lock-authentication trust dependency, making its use for proof transport additive-free. Repo-wide grep for `axelar|wormhole|layerzero|hyperlane|ccip`, 15 results, **zero `.sol` files**. Hits were documentation, traceability CSVs, Rust build artifacts, and the price fetcher. No contract references any cross-chain messaging protocol. Axelar is mandated by VF-XCH-018 and excluded from issuance by VF-XCH-021 and VF-SUP-014 (all three verified verbatim against the hash-locked Rev 6 spec). Its role is transport of minted tokens, not evidence of locks.

**CHALLENGED AND UPHELD — the CL-02 hypothesis, raised by the operator and disproved from source.**

The hypothesis: `registerChainVerifier` allows installing a verifier that validates forged locks; that is CL-02, already open and Critical; therefore the architecture was chosen and the open question is access control, not design intent; therefore CL-76 should be withdrawn or rewritten.

Disproved on three independent points:

1. **The cited evidence does not say that.** Register v6 line 261 is CL-63 — the Solana SPL vault's per-lock token-authority coupling. It concerns neither verifier registration nor forged locks.
2. **The registration surface cannot reach a mint.** `registerChainVerifier` is `onlyDuringDeployment` (`!configurationFinalized` AND `msg.sender == deployer`, `:561`). `verifyAndMint` is `onlyWhenFinalized` (`configurationFinalized == true`). `configurationFinalized` is written once, at `:594`, to `true`, with no reversing path. The states are **mutually exclusive**; no moment exists in which a verifier is installable and a mint is possible. `chainVerifiers` has exactly one write site, `:564`, behind that modifier. **This is evidence in CL-02's favour on this surface and should be reflected when CL-02 is next assessed.**
3. **CL-76 installs nothing.** CL-02 governs *who may install a verifier*; CL-76 concerns *what the correctly installed verifier does*. The exploit uses the honestly registered verifier, deployed as intended. Perfect access control on registration is orthogonal.

**On the architecture claim.** `IChainVerifier` existing establishes that a **seam** was chosen, not a trust model. Its signature returns `bool finalized` and is silent on how that boolean is established; all five implementations establish it by asking the caller. The interface is equally compatible with a light client, an attestation quorum, or a proof protocol — and nothing in the codebase selects one. **The trust model remains undecided. Finding upheld without modification.**

**Consequence for Brief §4.** The recorded calibration — invention finished, only verification remains — is **false in one specific respect**. The cross-chain trust model is undecided. Brief correction owed.

---

### CL-76 · UPDATE v17 (2026-09-03) — the two halves separated

**The finding is narrowed, not closed.** v16 treated CL-76 as one defect. It has two halves, and only one of them has been addressed.

**Half one — the minting path. Closed, and NOT by CL-85 alone.** v16's mechanism was that *"both sides originate from the same caller"*: `extractFacts` derived its facts from the caller's own proof, so the cross-check compared the caller's number to the caller's other number. That ceased to be true when real verifiers replaced placeholders. `BaseSameChainVerifier` reads `VinculumFinalisBaseVault` storage; the four remote EVM verifiers read a receipt proven against an authenticated header. The numeric cross-check (`extGross`, `extFee`, `extPrincipal`, `extDuration`) was therefore already comparing a derived quantity against the package **before CL-85**.

What CL-85 contributed is narrower and should not be overstated: it added `canonicalAssetId`, `baseRecipient`, `releaseDestination` and `outputToken` to the independently-derived set, and moved the cross-check ahead of the registry lookup and valuation. That closed identity substitution against a **genuine** lock — Wave 1's W1-01, W1-02, W1-05 and W1-09 — which is a different attack from v16's fabricated package.

Blocking mechanism, verified per family rather than assumed:

| Family | What blocks a fabricated package | Introduced by |
|---|---|---|
| Base | `BaseSameChainVerifier` reverts `LockNotFound` — vault storage has no such lock | pre-CL-85 |
| Ethereum, Polygon, Arbitrum, Optimism | receipt proof chain against an authenticated L1 header | pre-CL-85 |
| Identity substitution on a genuine lock, all five above | CL-85 cross-check at step 2b | **CL-85** |
| Solana, Stellar, XRPL, remote-EVM stub | `VerifierNotImplemented` | v10 fail-closed remediation |
| Six UTXO environments | low-level revert inside `BitcoinTx` decoding of the forged transaction | pre-CL-85 |

**Half two — the accounting path. OPEN, and now reproduced under production configuration.** v16 wrote: *"fail-closed removes the mint path; it does not supply verification."* That is exactly where the finding stands.

`recordFeeAndRac` is `external onlyWhenFinalized`, callable by any address, and **consults no chain verifier at any point**. Its first line calls `_verifiedGrossUsdMicro(pkg)` — the function v16 identified as multiplying an authenticated price by a caller-supplied amount. It then writes `epochRewardBasis[epoch] += racCredit`, the figure `VinculumFinalisStake.closeEpoch` mints rewards from at `VinculumFinalisStake.sol:344`.

Reproduced against the **production** stack — full deployment ceremony completed, real `BaseSameChainVerifier` registered, price batch published, called by an unprivileged relayer, for a lock that was never created:

```
ceremony finalized  : true
verifier registered : 0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0
basis before        : 0
basis after         : 3000000000000000000
verifyAndMint       : LockNotFound("0xef1633e5...")
credit persisted    : true
```

`verifyAndMint` refuses correctly. The credit was already written, in a separate transaction, and stays. This answers the question v16 could not: the exposure is not an artifact of incomplete deployment. Filling in every address changes nothing, because the registered verifier — visible in that output — is never consulted.

**No settlement step exists.** `epochRewardBasis` is written in exactly one place, `+=` at `VinculumFinalisVerifier.sol:690`, and is never decremented, reversed or confirmed. `racCredits` and `racEpoch` are written once and never read by any contract. `VinculumFinalisStake` **declares** `racCredits(bytes32)` and `racEpoch(bytes32)` in its verifier interface at lines 60–61 and calls neither — the per-credit accessors a settlement step would require exist and are unused. `verifyAndMint` checks only that the credit exists (`:717`), never that it was justified.

**Specification position.** §9: *"Each **successfully verified** Commitment Vault fee creates a one-time numerical Reward-Accounting Credit."* VF-FEE-007 requires the proof to establish the actual fee and transfer. VF-FEE-008 requires fee-routing evidence and principal-lock evidence to refer to the same completed lock. VF-RAC-001 defines the credit against the fee *collected*. Where the specification permits fees and credits to diverge it does so by **denying** the credit — VF-FEE-012, VF-RAC-008, VF-SUP-012 — never by granting it in advance.

The implementation comment justifies the split with VF-FEE-011, which governs the **non-refundability of fees**, not the persistence of credits. VF-FEE-012 governs the credit and states the opposite.

**Recorded as sound.** Phase one correctly implements VF-RAC-008 capacity gating (`cap.cumulativeVclmIssued() < VCLM_HARD_CAP`), VF-RAC-004 accumulation, and the launch-relative epoch derivation. VF-COM-003's $0.95–$1.05 handshake bound still applies at `:615`, so per-call magnitude remains bounded as the v10 correction established.

**Regression weakness in CL-76's own test.** `base-contracts/test/10_cl76_forged_package.test.cjs` asserts `.to.be.reverted` at lines 172 and 216 — bare, with no reason — and its header still states *"EXPECTED AFTER FAIL-CLOSED FIX: reverts with VerifierNotImplemented"*, which is stale: `UtxoChainVerifier` is now implemented and the observed revert carries no reason string at all. The test cannot distinguish which mechanism blocks the mint, and would report the hole closed if the blocking mechanism silently changed. This is the register's own standing rule — assert on revert reasons, not on the fact of a revert — violated in the test that certifies its most severe finding.

**STATUS: CRITICAL — PRE-DEPLOYMENT — OPEN.** Narrowed to the accounting path. Resolution remains the operator's design decision as recorded in v10; nothing in this update proposes one.

---

### CL-27 · **ANSWERED, and the original framing was wrong**

Three independent searches — `cltv|checklocktime`, then `nlocktime|redeemscript|scriptpubkey|p2sh|bitcoinjs|bip65`, then a filename sweep for the chain names — found **no Bitcoin-family locking script anywhere in the repository.** The CLTV hits were confined to `.git` pack objects, three `reviewers/` documents discussing the gap, `src/lib/vfProofNormalizer.js`, and `Vinculum_Finalis_Architecture_Design.md`. The second sweep returned neither of those last two, meaning the design document describes CLTV without ever using implementation vocabulary — the §12 pattern precisely.

The filename sweep did return `UtxoChainVerifier.sol` and its twin, which is the **consumer**, not the producer. **Producer absent, consumer present-but-inert (CL-76).** CL-27's remainder is not "verify a built pattern"; it is "the pattern was never built."

**Correction to CL-27's scope: it is SIX chains, not five.** DigiByte is a Bitcoin fork, `UtxoChainVerifier`'s header lists it correctly, and §11.1 confirms it. The register and brief both grouped DigiByte separately. **DigiByte's recorded clearance — three passing tests — requires re-examination**, since a DigiByte lock would use the script vocabulary three searches failed to find.

---

### ENVIRONMENT ACCOUNTING — corrected against §11.1

Rev 6 §11.1's table is authoritative and its registry column **sums to exactly 1,001**, which independently confirms it is the real list. VF-XCH-001 makes the set exactly these; VF-XCH-002 forbids addition or substitution without a specification decision.

**Seven EVM:** Ethereum, BNB Smart Chain, Avalanche, Polygon, Arbitrum, Base, Optimism (registry entries sum to 914).
**Ten non-EVM:** Bitcoin, Bitcoin Cash, Solana, XRP Ledger, Stellar, Cosmos, Litecoin, Dogecoin, DigiByte, Zcash.

**Three corrections:**

1. **The handoff documents say "8 EVM / 8 non-EVM plus Solana."** Both counts are wrong; the asset totals they carry (914 EVM, 78 Solana) are right, because those came from the spec while the groupings were reconstructed later.
2. **Cardano and Algorand are NOT Vinculum Finalis environments.** They appear in Rev 6 exactly twice, as wrapped registry assets — Binance-Peg Cardano on BNB Smart Chain (row 537) and ALGO on Ethereum (row 980). The register nonetheless carries "Algorand TEAL confirmed genuine" and a clean-compiling Cardano validator as clearances. Effort was spent on two chains the protocol does not support, and those entries inflate apparent coverage by sitting beside real ones. Under VF-XCH-002 they cannot be admitted by discovering someone built them.
3. **Cosmos is one of the seventeen and has no verifier in `base-contracts/contracts/chain-verifiers/`.** The five verifiers cover sixteen. A `cosmos-hub-proof-adapter` directory exists elsewhere in the repo and has **not** been examined. **Open — do not assume either way.**

---

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

**CL-69** · Medium · **Reframed by v6 — this is protocol-wide, not a Solana defect.** `verified_gross_usd_micro` carries 18-decimal fixed-point values (`$0.95 × 10^18`); "micro" denotes 10^6. v5 recorded this as a Solana naming error. Reading Base disproved that scoping: `VinculumFinalisVerifier.sol` holds an 18-decimal value in a variable named `verifiedGrossUsdMicro`, and the `× 1e12` at `:499` exists precisely to lift 6-decimal published prices into it. Base, Solana, and the CL-40 comment all attach "micro" to 18-decimal quantities. **Cosmos is the only place in the protocol where the name matches the value** — which is why it reads as the outlier when it is the honest one. An off-chain reader trusting any of these field names is wrong by twelve orders of magnitude. Same defect class as CL-56 and CL-43: an implementation convention that governs behavior and lives outside the specification. Fix travels with CL-75 and must not be conflated with it.

**CL-70** · Low · `constants.rs` justifies the three-use allowance as "Account-model mechanism — Solana PDAs maintain atomic persistent per-identity state". VF-COM-006's closing sentence forbids exactly this route: *the applicable allowance is determined by the actual selected source mechanism, not by a broad chain label.* The value is correct; the justification is a chain-label argument. **Live trap for the five Bitcoin-family UTXO environments**, where the same reasoning yields a wrong number. Raised by the owner, not this reviewer.

**CL-71** · High, **severity disputed** · The program embeds no registry and accepts any valid SPL mint. README Known Limitation 5 discloses this and treats it as benign because VF-REG-001 is enforced by off-chain preflight. **The disclosure does not reckon with VF-ARC-004 plus the non-refundable fee rule (§5.2):** a known-invalid request must be rejected before assets move wherever the source environment can determine the invalidity, and registry membership is determinable at source. Today a user who reaches the program with an unapproved asset has 5% of it moved irrevocably to the Dev Fund, and Base then refuses issuance. **Fee taken, no rights created, no recourse.** §5.2.2 makes the application responsible for preflight; the on-chain program is the fail-safe behind it, and the fail-safe is absent. Also: the `commit_vault_lock.rs` header claims it enforces VF-REG-001, and `AssetNotInRegistry` is defined and never constructed.

**CL-73** · Low · `Anchor.toml` `[test.validator] url` points at `api.mainnet-beta.solana.com`. Inert with no clone entries, but test infrastructure aimed at mainnet is a foot-gun before anyone writes tests that lean on it.

**Also noted:** eight error variants are defined and never constructed — `InvalidOutputToken`, `ChonxNotActivated`, `ProtocolTokenProhibited`, `LockAlreadyExists`, `ConfigNotInitialized`, `Unauthorized`, `InvalidPda`, `AssetNotInRegistry`. Two are disclosed with reasons (VF-TOK-007, VF-REG-001). The remaining six are a fair map of requirements someone intended to enforce and did not.

---

## COSMOS — PROVENANCE AUDIT AND ITS FINDINGS

### CL-74 · Critical · **RESOLVED** — permitted-duration table wrong in seven places, concealed by a tautological test

- **Evidence:** `cosmos-hub-vault/contracts/vault/src/msg.rs:26`, constant `PERMITTED_DURATIONS_SECS`.
- **Spec:** Rev 6 §5.1 · **Commit:** `7bd2db6` on `redteam/prep` · **Tests:** `all_16_permitted_durations_accepted` (rewritten), `durations_outside_section_5_1_rejected` (new)

**What was wrong.** §5.1 defines sixteen permitted commitment durations: 1 hour, then 7, 30, 60, 90, 180, 365, 730, 1095, 1460, 1825, 2190, 2555, 2920, 3285, 3650 days. The Cosmos table matched twelve of them.

| Defect | Detail |
|---|---|
| **Three impermissible durations accepted** | 14 days · 120 days · 2592 days |
| **Four permitted durations rejected** | 1460 · 2190 · 2920 · 3285 days |
| **One duplicate** | 3650 days appeared twice, as `10*365*86_400` and as `3650*86_400` — so sixteen entries held fifteen distinct values, twelve of them correct |

**Two of the three wrong values name their own origin.** 120 days is a §10.1 staking term — the CL-04 signature exactly, §10.1 bleeding into §5.1 a second time in a different language on a different chain. 2592 days is a units transposition: 2,592,000 **seconds** is thirty days, and the number was carried into a slot that multiplies by 86,400.

**Why forty-five passing tests did not catch it.** The test named `all_16_permitted_durations_accepted` iterated `PERMITTED_DURATIONS_SECS` — the implementation's own constant — and asserted the implementation accepted each entry. It certifies whatever the array happens to contain. It would pass on an empty array. **A test that iterates a constant the implementation owns is structurally incapable of detecting a wrong constant**, and its name asserted §5.1 conformance it never checked.

**Base and Solana were both correct.** `VinculumFinalisVerifier.sol:910-936` carries both the durations and the multipliers conforming to §5.1; the Solana `constants.rs` table is correct. **The outlier was the chain with the passing test suite** — which is the entire argument for provenance auditing.

**Fix method, which is the part worth reusing.** The instrument was repaired before the code. The tautology was replaced with sixteen literals transcribed from §5.1, carrying the specification hash in a comment, checked for set equality in **both** directions and asserted to be exactly sixteen; a negative guard was added for the three impermissible values. The suite was then run **before** touching `msg.rs` and produced exactly two failures — proof the new instrument could see the defect. Only then was the table corrected, expressed as explicit `days × 86_400` with no year arithmetic. Result: **46 passed, 0 failed.**

**CL-74 is the first finding in this project to satisfy the arbitration rule cleanly** — a named test that failed before the fix and passes after, through the path production uses.

### CL-75 · Medium · **Open** — Cosmos USD bound sits 10^12 off the protocol's canonical scale

- **Evidence:** Cosmos `HANDSHAKE_USD_MIN_MICRO = 950_000` · Solana `HANDSHAKE_USD_MIN_MICRO = 950_000_000_000_000_000` · Base `HANDSHAKE_USD_MIN = 0.95e18`, `HANDSHAKE_USD_MAX = 1.05e18`, `STANDARD_USD_MIN = 10e18` (`VinculumFinalisVerifier.sol:184-186`)
- **Spec:** VF-COM-003, VF-COM-017/018, §6 · **Severity corrected Critical → Medium; see Corrections to v5**

**What is true.** Rev 6 is silent on wire scale — §11 grants topology latitude — but §6 and VF-COM-017/018 mandate 18-decimal fixed point at the point the value is consumed. Base's constants confirm it. **18-decimal is canonical, and Cosmos is the chain that diverges.**

**What is not true, and what I claimed in v5.** This is not a cross-chain issuance break. Base derives its own USD value and accepts none from a caller, so the divergent field never enters the arithmetic that issues tokens.

**What survives.** The field still travels in the evidence Cosmos emits under VF-XCH-011. Anything reconciling source-chain events against Base issuance — the relayer, the planned Proof of Lock dashboard, an independent auditor — sees two environments reporting one field 10^12 apart with no on-chain contradiction to alert anyone. That is a defect in the evidence layer, not the value layer.

**Remedy — two changes, and conflating them causes harm.**
1. **Scale:** correct Cosmos to 18-decimal fixed point, matching Base and Solana.
2. **Name:** correct "micro" protocol-wide, per CL-69. Base's own `verifiedGrossUsdMicro` holds an 18-decimal value.

Doing (1) alone and renaming to match the existing convention would take the one accurately-named field in the protocol and make it inaccurate. Spec-first work; it touches the Base contract, which carries twelve open Criticals of its own.

### Provenance audit — coverage and what remains

Eight of forty-six Cosmos tests were sampled, spanning families. Two results are worth recording as opposite poles:

- `fee_floor_rounding_5pct` — **exemplary.** Literals `500_000` and `9_500_001` were computed from the Rev 6 formula and verified independently before the test was trusted. This is what spec-derived means.
- `all_16_permitted_durations_accepted` — **tautology**, and it was hiding a Critical. See CL-74.

**Outstanding:** thirty-eight Cosmos tests unexamined · **all 116 Base tests unexamined by this method** · a mechanical sweep for any test that iterates implementation-owned state, which is the detectable signature of the tautology class · confirmation that Base's `_isPermittedDuration` is actually invoked on every accepting path, which v5 did not establish — the table was verified to exist, not to gate entry.

---

## DOCUMENTATION DEBT

**Recorded because the code has moved and the documents have not.** Each item below is a document that currently asserts something the repository contradicts. None is scheduled yet, and the scheduling decision is deliberate.

| Document | Wrong how | Source |
|---|---|---|
| `solana-vault/README.md`, Architecture Decision 4 | Asserts a working three-use Handshake allowance. The allowance is never initialized; no Handshake can succeed | CL-66 |
| `solana-vault/README.md`, Architecture Decision — vault topology | Documents per-mint vaults. The remedy for CL-63 is vault-per-lock, which overturns it | CL-63 |
| `solana-vault/README.md`, Known Limitation 5 | Treats absent registry enforcement as benign; does not reckon with the non-refundable fee | CL-71 |
| `state.rs` doc comment | Says keccak256; code, `constants.rs` and README all say SHA-256 | CL-68 |
| `commit_vault_lock.rs` header | Claims VF-REG-001 enforcement that does not exist | CL-71 |
| `msg.rs` duration comment | Said "all 16" over a table holding fifteen distinct values — **corrected in `7bd2db6`** | CL-74 |
| Cosmos and Base READMEs | Carry **no** Known Limitations section at all. Absence is not cleanliness; it means the A8 shortcut is unavailable for those layers | A8 |

**Sequencing decision: documentation is corrected after code freeze, not before.** Until the code stops moving, every document rewritten to match it is rewritten twice. The register carries the drift in the interim, which is what this section is for. The one exception is documentation that **asserts working behavior** — per A9 that is the dangerous kind, and where it is cheap to correct in the same commit as the code it describes, it should be.

**Revision levels are part of this debt.** Component READMEs and the traceability matrix carry revision markers that have not been advanced as findings closed. Correcting them before freeze would produce revision numbers that are themselves stale by the freeze. They advance once, at freeze, against the frozen code.

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
| CL-74 | §5.1 duration table transcribed from the specification; tautological test replaced | `all_16_permitted_durations_accepted`, `durations_outside_section_5_1_rejected` |

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
8. **Finish the provenance audit.** Thirty-eight Cosmos tests and all 116 Base tests have not been asked where their expected values came from. Includes the mechanical sweep for tests that iterate implementation-owned state, and confirming `_isPermittedDuration` gates every accepting path on Base.
9. **CL-75 + CL-69 together** — Cosmos scale to 18-decimal, and the "micro" naming corrected protocol-wide. Two changes, specified before either is written.
10. **Fold CL-35 through CL-54 into this register** from their originating documents, per the reconciliation notice.
11. **Documentation and revision levels**, per Documentation Debt — after freeze, once.
12. **Independent paid audit.**

**On the audit.** §2 makes this code unpatchable after deployment; VF-IMM-006 accepts unrepairable defects as a consequence. The audit is the only error-correction mechanism the design permits.

---

## SCOPE NOT REVIEWED

Base44 backend functions · `vinculum_price_fetcher_v9.py` · 98 JSX components · Architecture Design document · 209-row traceability CSV · the five Bitcoin-family UTXO lock scripts (CL-27 remainder) · **17 of 18 requirement families** — only VF-PRI has had a family-level review; VF-COM is partially covered through CL-56.

**Removed from this list since v3:** Cosmos vault (45 tests observed passing) · Solana lock program (now compiled and reviewed; CL-55 through CL-61) · XRPL, Stellar, DigiByte, Algorand, Cardano lock programs (reproduced or compiled).

---
---

# APPENDIX A — RATIONALE NOTES FOR REVISION 7

**Why these exist.** Each records reasoning that was reconstructed from scratch in a working session, cost real time, and would otherwise be reconstructed again by the next reader — human or AI — starting with fresh eyes. Each names the wrong path explicitly so it is recognized as already-walked rather than newly-clever.

**Do not edit Revision 6 to add these.** Rev 6 is hash-locked and that hash is cited throughout this register. Editing it breaks the chain of custody.

**DISPOSITION RULE — corrected in v7. The earlier instruction was wrong.** This header previously read that these notes belong in the Style & Terminology Guide now "and in Rev 7 when it is cut," which reads as wholesale inclusion. It is not wholesale.

**All eleven belong in the Style & Terminology Guide.** That is their home and most of them have no other one.

**Only entries that name an actual gap in the specification enter Rev 7, and they are selected entry by entry at freeze.** Folding this appendix into a revision as a block would write review methodology — how to read a README, how to order a build, how to shape a test — into a protocol specification. The specification governs the protocol's behavior. It does not govern the auditor's technique, and an immutable deployment is the worst possible place to blur that.

**Qualifying entries as of v7, both verified against the Revision 6 document itself:**

| Entry | What it names | Verified how |
|---|---|---|
| **A6** | Integer width at the transfer boundary is unspecified | Rev 6 text extracted from the hash-verified `.docx`; **209** unique `VF-***-***` requirements present; grep for `u64`, `u128`, `64-bit`, `128-bit`, `overflow`, `saturate`, `truncate` returns **zero hits in the entire document**, not merely zero in the requirements. VF-COM-011/012/013 confirmed present and confirmed silent on domain. |
| **A10 — corollary only** | Canonical wire scale for USD values crossing an environment boundary is unstated | `18-decimal fixed-point` occurs twice, both at the **consumption** site — the issuance arithmetic Base performs. VF-XCH-011 enumerates the evidence that must bind across a boundary, including gross amount, fee amount and asset precision, and never states the scale those values carry on the wire. |

**A10's rule** — read both sides before assigning severity — is methodology and does not qualify. Only the corollary does.

**Probable consolidation at freeze, recorded as a hypothesis and not a decision.** A6 names its own defect class and points at **CL-43** and **VF-REG-012**: an implementation convention that governs behavior while living outside the specification, so every implementer re-derives it and any two may derive differently. A6, A10's corollary and CL-43 may therefore be **one Rev 7 section rather than three.** Untested. It is drafting work for the freeze gate, and it is recorded here so the next reader does not re-derive it.

**A1 and A2 do not qualify.** Both state that Rev 6 is correct and was misread. A misreading is not a gap. **A3, A4, A5, A7, A8, A9, A11 and A10's rule do not qualify** — all are review method.

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

## A10 — A cross-chain finding is not a finding until both sides have been read

**The wrong path, walked in v5.** Two chains carried the same field name at scales twelve orders of magnitude apart. From that one observation the reviewer concluded a cross-chain issuance break and recorded it Critical. The consuming chain was never opened. Two commands would have shown that Base accepts no caller-supplied USD value at all and derives its own — the divergence never reaches the arithmetic.

**The rule.** Multi-environment protocols invite a specific error: a real discrepancy observed at the producing end, and a consequence *assumed* at the consuming end. The discrepancy is evidence. The consequence is a hypothesis, and it is testable at the cost of reading the consumer. **Read the consumer before assigning severity.**

**Why this is worth a permanent note.** The protocol spans seventeen environments. Every finding that crosses a boundary presents this trap, and the cost of the shortcut scales with the number of pairs, not the number of chains. It also inverts cleanly: the same read that downgraded CL-75 revealed CL-69's true scope, which was larger than recorded, not smaller. Reading both sides moves severity in both directions.

**Corollary for the specification.** The wire scale of cross-environment USD values is not stated in Rev 6. §11 grants topology latitude and §6 mandates 18-decimal at consumption, and an implementer can satisfy both while disagreeing with every other environment. Revision 7 candidate: state the canonical scale for values that cross an environment boundary, and state it once.

## A11 — A test that iterates implementation-owned state certifies nothing

**The wrong path, and it was already in the repository.** `all_16_permitted_durations_accepted` looped over the implementation's own constant array and asserted the implementation accepted each member. It passed. It would have passed on an empty array, a wrong array, or an array of one. It passed on an array with three impermissible values, four missing values and a duplicate — and its name claimed §5.1 conformance.

**The signature to sweep for.** Any test whose iteration source is a constant, map, or enumeration that the code under test also owns. The test and the code are then the same witness testifying twice. A4 already requires that test vectors come from the specification; A11 is the detectable *shape* that A4's violation takes, and it is greppable in a way that intent is not.

**The correct form, demonstrated by the CL-74 fix.** Transcribe the literals from the specification, carry the specification's hash in the comment so the transcription's provenance is checkable, assert set equality in **both** directions — the implementation accepts everything permitted *and* nothing else — and assert the count. Then add a negative test naming the specific values that must be refused. Both together make the omission detectable, which one alone does not.

**Repair the instrument before the code.** The suite was run after the tests were rewritten and before `msg.rs` was touched, and produced exactly the two predicted failures. That step converts a hope that the new test works into evidence that it does, and it costs one command. Without it, a green suite after the fix cannot distinguish a repaired table from a test that never checked anything.

---

## v10 ADDENDUM — NEW FINDINGS, WITHDRAWALS, AND REPORTED-BUT-UNVERIFIED ITEMS

### CL-77 · HIGH · OPEN · No test exercised any production chain verifier
`base-contracts/test/04_endtoend.test.cjs:52` deploys `MockChainVerifier`; the describe block is titled "full verification pipeline via MockChainVerifier." Its `buildPackage` helper sets `sourceFinalityProof: "0x"` — empty bytes — and the suite passes. The production verifiers would revert on `abi.decode` of empty bytes. **The 116-test suite never supplied a finality proof at all.** This is why CL-76 survived every green test, and it generalises: a passing suite that exercises only mocks is not evidence about production code paths. Remediation: production-verifier coverage required before any environment is considered complete.

### CL-78 · MEDIUM · RESOLVED BY REMEDIATION · `setMinConfirmations` had no access control
Former `UtxoChainVerifier.sol:35`, `external`, no modifier, in-file comment: "Only callable by authority in production (access control omitted for clarity)." Anyone could lower the confirmation threshold on a deployed verifier. Removed in the fail-closed rewrite. **Must not be reintroduced without an explicit authority** when the verifier is implemented.

### CL-02 · STATUS QUESTIONED (v10) · entry cites a superseded contract
The CL-02 entry cites `VinculumFinalisVerifier.sol:296,314,318` and describes `registerChainVerifier` as "permanently open" and able to "install a verifier that validates forged locks." **Current source contradicts this:** `registerChainVerifier` is at `:561`, guarded by `onlyDuringDeployment` (`!configurationFinalized` AND `msg.sender == deployer`); `configurationFinalized` is written once at `:594` to `true` with no reversing path; `chainVerifiers` has one write site at `:564`. The entry describes an earlier revision of the contract. **CL-02 requires full re-verification against current source before its status is trusted.** Note this is the entry that prompted a challenge to CL-76; the challenge was reasonable given the entry text.

### WITHDRAWN — reviewer statements made from attachments that never arrived
Three uploads in the 2026-08-14/15 session rendered as empty documents; the reviewer generated detailed content for them instead of reporting the failure. **All statements below are withdrawn and must not be carried forward:**
- All characterisations of Architecture Design document **Section O** — the thirteen required elements, the per-environment status table, Base marked "RESOLVED — DEPLOYABLE MECHANISM ESTABLISHED", the Bitcoin light-client checkpoint specification, and the two stated Section O prohibitions.
- Architecture Design document **line numbers 228, 257, 271** and their described contents.
- **Git history** for `UtxoChainVerifier.sol`, including commit `d5352ec`, its date, and its message.
- `src/lib/vfComplianceData.js` VF-XCH-018 status "IMPLEMENTED" and its stated trace.

Section O may well contain material relevant to CL-76. It has not been read in this column. **UNRESOLVED — requires the document text.**

### REPORTED — NOT VERIFIED IN THIS COLUMN
The following were reported by the operator or a second AI reviewer. No artifact supporting them has been seen in this column. They are recorded as claims, not findings, per Evidence Rule 1:
- Cosmos vault compiles; Cosmos test suite passes (count reported as 45).
- Solana vault compiles following transfer-width (u64) fixes.

Settling evidence would be the build/test output committed under `evidence/`. Uncommitted artifacts `VF_SOLANA_FIX_v2.zip`, `solana-vault/VF_SOLANA_u64_FIX (1).zip`, and `solana-vault/build_errors.txt` were present in the working tree and were not opened.

### CARRY-FORWARD — next artifacts
1. `PROJECT_REVIEW_STATUS.md` — facts-only baseline, governed by Evidence Rule 1. Then commit to freeze the baseline.
2. Verifier Completion Standard — Rev 7 policy defining what "complete" means for any verifier.
3. `EvmChainVerifier` Base same-chain implementation — the reference verifier; requires no trust-model decision.
4. Trust model for the remaining sixteen environments — operator-owned; attestation quorum eliminated by operator decision.

---

## v11 ADDENDUM — BASE SOURCE MECHANISM AND EVM VERIFIER SCOPE

### CL-79 · CRITICAL · OPEN · No Base-native commitment lock mechanism exists
**Classification: missing implementation of a specified component.** Not a design question. Design intent is settled and is not reopened by this finding.

**What the specification requires.** Rev 6 §11.1 lists `EVM | Base | 33` — Base is one of the 17 approved source environments with 33 approved assets in the 1,001-entry registry. Rev 6 line 277: each environment "uses an appropriate deterministic chain-native locking mechanism, while Base performs canonical protocol-token issuance and accounting" — both roles, simultaneously. Line 78: the source mechanism transfers the rounded fee to the Dev Fund destination and places principal into the lock. VF-XCH-005: the source mechanism binds user, principal-release destination, asset, amount, creation timestamp, and maturity. The Rev 7 working draft carries §3.1 forward unchanged; nothing supersedes the requirement.

**What the repository contains.** `base-contracts/contracts/` holds four contracts — Verifier, Stake, Synth, Token — plus `interfaces/` and `chain-verifiers/`. Searches: `find -iname "*vault*" -name "*.sol"` → empty. `grep -rln "createLock|CommitmentVaultLock|createCommitment|lockAsset|LockCreated" --include=*.sol` → empty. `VinculumFinalisVerifier.sol` storage records issuance state only — `consumedLocks` (`:285`) marks lock IDs already spent; no mapping records a lock having been created.

**Why it was never found.** Every prior lock-implementation audit targeted non-EVM environments (CL-27, Bitcoin-family CLTV). Base was treated throughout as the issuance destination, so its source-mechanism obligation was never examined by any review pass.

**Relationship to CL-76.** Distinct and more fundamental. CL-76: the protocol cannot authenticate locks it is told about. CL-79: for one environment the lock mechanism itself is absent. CL-79 also explains `EvmChainVerifier`'s `sameChain` shortcut — with no Base lock state in existence, there was nothing for a same-chain verifier to read.

**Consequence for planning.** Base was designated the reference verifier implementation because same-chain verification requires no trust model. That remains true, but the implementation cannot be built or evidenced until the Base source mechanism exists. Per the Verifier Completion Standard, the Base verifier's interface, expected inputs, failure behaviour, and evidence requirements can be specified now; the implementation waits.

### CL-80 · CRITICAL · OPEN · `EvmChainVerifier` unremediated across seven EVM environments
Excluded from the `220a115` fail-closed change by reviewer decision, on the reasoning that its same-chain Base path was implementable. CL-79 shows it is not, and the file's scope is wider than that path.

`EvmChainVerifier.sol` serves all seven EVM environments — Ethereum (PoS finalized), BNB (FFF), Avalanche (Snowman), Polygon, Arbitrum, Base, Optimism — dispatching on a `finalityModel` string. Every branch decodes `sourceFinalityProof` supplied by the caller and tests the decoded values. This is the CL-76 defect across seven environments rather than one.

The `sameChain` branch (`:63-66`) decodes the caller's bytes and returns `(true, blockHash, blockHeight)` — **caller-derived values rather than independently derived Base chain state** — despite `block.number` and `blockhash()` being directly available on Base.

**Remediation:** fail-closed under the same policy as the other four, pending both CL-79 and the trust-model decision.

### REVIEWER ERROR — CORRECTED (v11)
The reviewer presented "is Base a source environment, or issuance-only?" to the operator as an open design decision. **It is not.** Rev 6 §11.1, the Approved Asset Registry, and the Rev 7 draft all settle it. Reporting what the artifacts require was the correct action; asking the operator to re-decide a settled requirement was not.

**Rule refined:** a decision is open only if no artifact settles it. Operator ownership of design intent does not convert an already-specified requirement into a question. Project axioms are now recorded in `PROJECT_REVIEW_STATUS.md` §Project axioms to prevent recurrence across fresh sessions.

---

## v12 ADDENDUM — BASE ENVIRONMENT COMPLETE; SECTION O READ

### Section O — WITHDRAWAL LIFTED
Register v11 withdrew all statements about Architecture Design Section O as unverified (generated from an attachment that never arrived). **Section O has now been read from source**, lines 427–452 of `Vinculum_Finalis_Architecture_Design.md`.

Confirmed: it requires twelve elements per environment; every non-Base row is marked "not established"; the Base row is marked **RESOLVED — DEPLOYABLE MECHANISM ESTABLISHED** with proof "none (same-chain)"; Bitcoin is specified as a Base-resident light client with trusted checkpoint header and PoW header sync; a relayer signature is never treated as proof.

**Note on method.** The withdrawn statements turned out substantially accurate. This does not validate them — they were unsupported when made, and no way existed to know which parts were wrong. Accuracy by inference is not evidence.

### Section O settles the proof mechanism — NO ROW NAMES AXELAR
Every verifier row in Section O specifies native verification: Merkle-Patricia receipt proofs, SPV proofs, signed headers, IBC proofs; verifiers are "Base-resident light client," "header auth on Base," "IBC client on Base," "verify via Ethereum L1". **Axelar appears in no verifier row.** Axelar's role is Section F, ITS, token transport (VF-XCH-018, VF-XCH-021, VF-SUP-014).

The architecture's answer to CL-76 is therefore per-environment light clients and native proof verification — already specified, sixteen of them, all currently "not established." **This was never an open design question; the reviewer repeatedly presented it as one.**

### CL-79 · RESOLVED — Base commitment vault implemented and tested
`VinculumFinalisBaseVault.sol` + `CommitmentLock.sol`. Per-lock isolation via EIP-1167 clones (VF-IMM-006); release depends on no external contract (VF-SEC-006); Verified Gross USD derived from the oracle-signed price record, never caller-supplied (VF-ORC-007/012); registry membership enforced before value moves (VF-ARC-004, avoiding CL-71's failure); fee-on-transfer assets fail closed. 22 tests. Evidence: `evidence/BASE_VAULT_TEST_2026-08-15.txt`.

### CL-80 · RESOLVED — `EvmChainVerifier` fail-closed
Six remote EVM environments revert `VerifierNotImplemented`. The `sameChain` branch and its constructor parameter are deleted, so no configuration can route Base there. Per-chain finality vocabulary preserved as comments. Evidence: `evidence/EVM_FAILCLOSED_TEST_2026-08-15.txt`.

### CL-81 · RESOLVED — `IChainVerifier.extractFacts` was `pure`
A `pure` function cannot read storage or call another contract. **No implementation of `extractFacts` could ever establish anything beyond decoding its own argument** — caller-trust was mandated by the interface, not merely chosen by implementers. Changed to `view`. Existing verifiers compile unchanged (more-restrictive overrides are permitted).

### CL-76 · Base path REMEDIATED; sixteen environments remain OPEN
`BaseSameChainVerifier.sol` reads every returned fact from vault storage; `sourceFinalityProof` is ignored entirely. The consumer's VF-XCH-011 cross-check now compares independent sources.

**End-to-end verified:** a genuine 100 MUSD lock minted 1,725 VCLM through the production verifier, called by an unprivileged relayer. Gas: 222,795. Evidence: `evidence/BASE_E2E_TEST_2026-08-15.txt`.

Section O Base row: **twelve of twelve elements satisfied.** Element 7 (reorg) is satisfied structurally — the verifier reads live storage, so a reorg removing the lock causes any re-executed mint to revert; there is no state where issued tokens survive without their lock. Elements 8/9/10 closed by test.

### REVIEWER ERROR — CORRECTED (v12): invented protocol rule
`BaseSameChainVerifier.verifyFinality` was written to refuse a lock whose principal had already been released. **Rev 6 §3.2 orders issuance before maturity and release after it**, so the scenario falls outside the specified lifecycle; VF-XCH-013 replay protection belongs to the consumer. The rule was invented, not transcribed. Removed; a SCOPE note in the source records why release state is not consulted.

**Rule:** read the Master Specification before reasoning about protocol behavior, not after being challenged.

### CARRY-FORWARD
1. **Sixteen verifiers remain.** UTXO family (6, one SPV pattern, per-chain depth), remote EVM (6), Solana, XRPL, Stellar, Cosmos. Mechanism specified per row in Section O.
2. **CL-27 still open** — no Bitcoin-family CLTV locking script exists. A UTXO verifier verifies proofs of a lock no source mechanism currently creates.
3. **Cosmos has no Base-side verifier**; `cosmos-hub-proof-adapter` unexamined.
4. **Solana build evidence gap** — commits exist, no artifact under `evidence/`.
5. **`core.autocrlf` unset** — produces phantom whole-file modifications on Windows. A `.gitattributes` would make `git status` trustworthy.
6. **CL-02 re-verification** against current source still owed.

---

## v13 ADDENDUM — IMPLEMENTATION STATUS FROM REPOSITORY EVIDENCE

**Basis.** `git log` through `cebbb94`; `evidence/` directory listing; `reviewers/` directory listing; `contracts/` tree; Architecture Design C.1–C.7 and Section O; Master Specification Revision 6 (SHA-256 `5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9`, re-verified against the uploaded document this session). Nothing below is recorded without a committed artifact.

### DOCUMENT CONTROL DEFECT — v11 and v12 were never committed
`reviewers/` contains **Register v10** only. The last register change in the commit history is the v9→v10 rename in `8dddc04`. Registers v11 and v12 were produced but never reached the repository, so **CL-79, CL-80 and CL-81 exist in no committed artifact.** This addendum carries that content forward; v13 supersedes v10 on disk directly.

`PROJECT_REVIEW_STATUS.md` on disk is **v1**, header reading "Head commit at time of writing: `220a115`" — eleven commits stale. The v2 revision adding Project Axioms was never committed. **Both documents require committing.**

### COMPLETED AND VERIFIED BY COMMITTED EVIDENCE

| Item | Commit | Evidence artifact |
|---|---|---|
| Base commitment vault (CL-79) | `afa3bd7` | `evidence/BASE_VAULT_TEST_2026-08-15.txt` |
| BaseSameChainVerifier (CL-76 Base path, CL-81) | `de5f633` | `evidence/BASE_VERIFIER_TEST_2026-08-15.txt` |
| Base end-to-end issuance | `ba18cdd` | `evidence/BASE_E2E_TEST_2026-08-15.txt` |
| EvmChainVerifier fail-closed (CL-80) | `cc59904` | `evidence/EVM_FAILCLOSED_TEST_2026-08-15.txt` |
| Released-lock rule removed | `e067337` | `evidence/BASE_COMPLETE_2026-08-15.txt` |
| SHA256d SPV header chain; UtxoChainVerifier finality | `55a26ee` | `evidence/SPV_HEADER_CHAIN_2026-08-15.txt`, `evidence/UTXO_SPV_2026-08-15.txt`, `evidence/CL76_REGRESSION_GREEN_2026-08-15.txt` |
| Merkle-Patricia proof library | `cebbb94` | `evidence/MPT_LIBRARY_2026-08-16.txt` |

**Suite state at `cebbb94`: 189 passing, 0 failing** (`evidence/MPT_LIBRARY_2026-08-16.txt`).

### CL-76 · Base path RESOLVED; SHA256d UTXO finality RESOLVED; twelve environments OPEN
The forged-package regression tests are **green**: a fabricated package that previously minted 15.003 VCLM now mints 0.0 and reverts (`evidence/CL76_REGRESSION_GREEN_2026-08-15.txt`).

- **Base** — resolved. Facts read from vault storage; `sourceFinalityProof` ignored.
- **Bitcoin, Bitcoin Cash** — `verifyFinality` resolved. Merkle inclusion verified against a header whose proof of work was validated on Base; depth read from header-chain state.
- **Remaining twelve environments** — open.

### BLOCKED BY REPOSITORY EVIDENCE

**B-1 · On-Base header authentication, six remote EVM environments.** Architecture C.1–C.7 mark the Base verification path **DESIGN DEFINED — DEPLOYABILITY EVIDENCE REQUIRED** for Ethereum, BNB, Avalanche, Polygon, Arbitrum and Optimism. C.1 states the requirement precisely: a receipt proof "authenticated against a finalized Ethereum header that Base obtains; concrete on-Base Ethereum header-authentication mechanism — DESIGN DEFINED." The receipt-proof half is implemented (`cebbb94`); the header-authentication half is undefined in the architecture. Polygon, Arbitrum and Optimism route through Ethereum L1, so Ethereum header authentication unblocks four environments.

**B-2 · `extractFacts` on all non-Base verifiers (CL-27).** Recovering lock facts requires a source-side lock format. CL-27 established by three independent searches that no CLTV script, `nLockTime`, `redeemScript`, `scriptPubKey`, P2SH, or BIP65 reference exists in any source file. Fails closed with the blocker named in `UtxoChainVerifier.sol`.

**B-3 · Signature-based finality: Solana, Cosmos, Stellar, XRPL.** Architecture Section O specifies signed-header and IBC-proof paths. All rest on ed25519 or BLS verification; Base provides no precompile for either. Section O marks each "not established."

### DEFERRED

**D-1 · Litecoin, Dogecoin, DigiByte, Zcash.** `Sha256dHeaderChain` serves SHA256d chains only. These use scrypt, rotating algorithms, and Equihash respectively — memory-hard by construction, not verifiable within EVM gas limits. Recorded in `UtxoChainVerifier.sol` and `Sha256dHeaderChain.sol` headers.

**D-2 · Cosmos Base-side verifier.** No contract exists in `contracts/chain-verifiers/`. `cosmos-hub-proof-adapter` remains unexamined.

**D-3 · `core.autocrlf` unset.** Produces whole-file phantom modifications in `git status` on Windows. A `.gitattributes` would resolve it.

**D-4 · Solana build evidence.** Commits `30c709a` and `33941da` exist; no build artifact under `evidence/`. Level-2 evidence only.

**D-5 · CL-02 re-verification** against current source, still owed.

### REMAINING WORK
1. Commit Register v13 and `PROJECT_REVIEW_STATUS.md` v2.
2. Resolve B-1 — on-Base header authentication. Largest single unblocker.
3. Resolve B-2 — specify the source-side CLTV lock format (CL-27), a protocol decision.
4. Resolve B-3 — signature-verification approach for four environments.
5. Address D-1 through D-5.

### REVIEWER NOTE — implementation defect found by testing against real chain data
`Sha256dHeaderChain._reverseUint` compared the block hash in the wrong byte order, accepting no valid header. It was found because the tests use real Bitcoin mainnet headers; synthetic data constructed to match the implementation's assumptions would have passed. Recorded as a methodological point: proof-verification code must be tested against data the implementation cannot influence.

---

## v14 ADDENDUM — TWO BLOCKERS RESOLVED; THREE VERIFICATION PATHS COMPLETE

**Basis.** `git log` through `133a4e5`; `evidence/` listing; Architecture Design C.1, C.8, C.13–C.17, Section O; Master Specification Revision 6 (hash re-verified). Nothing recorded without a committed artifact.

### B-2 / CL-27 · RESOLVED — the CLTV lock format was specified all along
v13 recorded B-2 as a blocker on the grounds that no CLTV lock script format existed. **Architecture C.8 specifies it completely:** "single Commitment Vault transaction, inputs = User UTXOs, outputs in the same tx: (1) fee output → Dev Fund (P2WPKH/P2TR), (2) principal output → `P2WSH`/Taproot `OP_CHECKLOCKTIMEVERIFY <maturity_T>` + owner signature, (3) change. Native asset only (BTC)." Replay id: env + txid + principal output index. Handshake identity: the canonical release public key.

**Reviewer error.** CL-27 established that no *implementation* existed, which was correct. The register generalized that to no *format being specified*, which C.8 disproves. The reviewer had requested C.8 and, not receiving it, asserted the blocker without reading it — the same pattern as the Base source-environment error recorded in v11.

**Implemented** (`a3f746e`): `BitcoinTx.sol` parses the transaction — varints, inputs, outputs, values, scripts; txid as double-SHA256 of the non-witness serialization; P2WSH verification against the committed `sha256(witnessScript)`; CLTV script parsing rejecting block-height maturities and, per C.8, ambiguous or multi-key release paths. `UtxoChainVerifier.extractFacts` now derives every fact from proven transaction bytes. 15 tests. Evidence: `evidence/BITCOIN_C8_COMPLETE_2026-08-16.txt`.

### B-1 · RESOLVED for Ethereum — approach named by Section O, now built
Section O's Ethereum row names three candidates: "L1Block predeploy vs light client vs L1-header oracle."

- **L1-header oracle** — excluded by Section O ("a relayer signature is never treated as proof") and VF-XCH-017.
- **Light client** — requires BLS12-381 verification over the sync committee; Base provides no precompile. No deployable path identified from the governing artifacts.
- **L1Block predeploy** — selected. Written by the OP Stack derivation pipeline that defines Base's own state, so it introduces **no new trust party**.

**Implemented** (`f44c993`, `133a4e5`): `L1BlockRegistry.sol` — permissionless `record()` reads the predeploy directly; `receiptsRootOf()` verifies a supplied RLP header against the recorded hash. `EvmReceipt.sol` — receipt and log parsing. `EthereumChainVerifier.sol` — the full chain: header authenticated, receipt proven against `receiptsRoot`, lock event read from the proven receipt. Source vault address and event topic immutable; the proven trie value is compared against the caller's receipt bytes. 25 tests across both. Evidence: `evidence/L1_HEADER_AUTH_2026-08-16.txt`, `evidence/ETHEREUM_C1_2026-08-16.txt`.

**Suite at `133a4e5`: 219 passing, 0 failing.**

### CL-82 · HIGH · OPEN · No EVM source vault contracts exist
C.1 specifies the Ethereum source mechanism as "vault contract `createLock()` atomic. Native ETH path: `payable` with `msg.value`; Token path: ERC-20 `transferFrom` with actual-received verification" — the same pattern as `VinculumFinalisBaseVault`. C.2–C.5 and C.7 specify the same mechanism for BNB, Avalanche, Polygon, Arbitrum and Optimism.

**No such contract exists in this repository for any of the six.** Same class as CL-79 for Base. The Base-side verifier is built and tested against the event format the Base vault defines; the source contracts are a separate deliverable.

### CORRECTION — overstated impossibility claim
v13's carry-forward and this reviewer's analysis stated that no component for scrypt, multi-algorithm, or Equihash proof-of-work verification "exists or can." **The second half was not demonstrated.** The supportable statement: no Base-resident implementation exists in the repository, and no practical direct EVM implementation has been identified from the governing artifacts. Optimistic constructions, fraud proofs, and succinct proofs of the header chain were not examined.

### IMPLEMENTATION CLASSES — current state
| Class | Component | State |
|---|---|---|
| Bitcoin-derived tx parsing | `BitcoinTx` | ✅ Serves all six UTXO chains |
| SHA256d header chain | `Sha256dHeaderChain` | ✅ Serves Bitcoin, Bitcoin Cash |
| Non-SHA256d PoW | — | ❌ None; Litecoin, Dogecoin, DigiByte, Zcash |
| EVM receipt proof | `MerklePatriciaProof`, `EvmReceipt` | ✅ Serves all seven EVM chains |
| EVM header authentication | `L1BlockRegistry` | ✅ Ethereum; routes Polygon, Arbitrum, Optimism |
| Same-chain | `BaseSameChainVerifier` | ✅ Base |
| Independent EVM header auth | — | ❌ None; BNB, Avalanche |
| Signature-based finality | — | ❌ None; Solana, XRPL, Stellar, Cosmos |

### VERIFICATION PATHS COMPLETE
Base (`de5f633`), Bitcoin and Bitcoin Cash (`a3f746e`), Ethereum (`133a4e5`). Bitcoin Cash is code-complete but **parameter-blocked**: C.17 marks its confirmation count DESIGN DEFINED, and Verifier Completion Standard §3.3 forbids defaulting the parameter. Litecoin, Dogecoin and DigiByte share that gap and add the proof-of-work problem.

### REMAINING
1. Polygon, Arbitrum, Optimism — verifier wiring plus the extra hop each row specifies (Heimdall checkpoint proof; output-root proof). No new cryptography.
2. **CL-82** — EVM source vault contracts, six environments.
3. BNB, Avalanche — independent header authentication.
4. Solana, XRPL, Stellar, Cosmos — signature-based finality. XRPL and Cosmos are additionally blocked at the source mechanism (C.10, C.12).
5. Confirmation counts for Bitcoin Cash, Litecoin, Dogecoin, DigiByte.
6. Deployment evidence from Base for the `L1Block` predeploy integration.
7. Carry-forward from v13: CL-02 re-verification; Solana build evidence; Cosmos Base-side verifier; Session Handoff Brief still at v1.

---

## v15 ADDENDUM — L1-ANCHORED FAMILY COMPLETE

**Basis.** `git log` through `0855fd6`; `evidence/` listing; Architecture C.4, C.5, C.7, Section O. Nothing recorded without a committed artifact.

### THREE VERIFICATION PATHS ADDED

| Environment | Commit | Evidence | Chain |
|---|---|---|---|
| Optimism (C.7) | `8d5f1a8` | `evidence/OPSTACK_C7_2026-08-16.txt` | 5 links |
| Polygon (C.4) | `3243f4c` | `evidence/POLYGON_C4_2026-08-16.txt` | 4 links |
| Arbitrum (C.5) | `0855fd6` | `evidence/ARBITRUM_C5_2026-08-16.txt` | 4 links |

**Suite at `0855fd6`: 260 passing, 0 failing.**

All three chain from a block hash Base's own derivation pipeline recorded, through the environment's L1 anchor, to the vault's lock event. Each proven trie value is compared against the caller's supplied bytes at every level. Oracle, checkpoint, rollup, vault addresses and all event topics are immutable constructor arguments.

**Optimism** — L1 header → `OutputProposed` from the output oracle → output-root preimage recomputed → L2 header → lock receipt.

**Polygon** — L1 header → `NewHeaderBlock` from the checkpoint contract → Bor block range check and leaf Merkle path → lock receipt. The leaf commits to the Bor `receiptRoot` directly, so no separate L2 header step exists. C.4's finality rule is enforced structurally: a Bor block outside a posted checkpoint cannot be proven.

**Arbitrum** — L1 header → confirmed-assertion event from the rollup contract → L2 header → lock receipt. The confirmation carries the L2 block hash directly.

### OBSERVATION — C.5's challenge-window parameter may be unnecessary
C.5 marks "exact Arbitrum assertion-challenge duration on the intended chain" as DESIGN DEFINED — DEPLOYABILITY EVIDENCE REQUIRED. The implementation does not use it: Arbitrum's rollup contract emits the confirmation event only after the window elapses, so requiring that event delegates enforcement to Arbitrum rather than measuring elapsed time on Base. The parameter would be needed only if Base computed the window independently.

**Recorded as an implementation observation.** Whether C.5's requirement is therefore satisfied is an architecture decision, not one made here.

### EXTERNAL DEPENDENCIES REQUIRING VERIFICATION (Standard 5)
Three protocol details are used that the governing artifacts do not state. Each is exposed publicly or bound at deployment so it can be checked against real chain data before use:

| Detail | Environment | Exposure |
|---|---|---|
| Output-root preimage formula | Optimism | `computeOutputRoot` public |
| Checkpoint leaf preimage; `NewHeaderBlock` data layout | Polygon | `computeLeaf`, `verifyCheckpointPath` public |
| Confirmation event identity; its data layout | Arbitrum | topic is a constructor argument |

None has been verified against mainnet. Tests prove each chain's logic against the assumed construction; they cannot prove the construction is correct.

### VERIFICATION PATHS — CURRENT STATE
Complete: **Base**, **Bitcoin / Bitcoin Cash**, **Ethereum**, **Optimism**, **Polygon**, **Arbitrum**. This exhausts the environments the L1-anchored and SHA256d machinery reaches.

### REMAINING — corrected statement
v14 and prior reviewer statements described the remaining environments as needing cryptography Base "can't perform." **That overstates the evidence.** The supportable statement:

> The remaining environments require consensus-authentication mechanisms not implemented in this repository. BNB and Avalanche require validator-signature verification (C.2 fast-finality votes; C.3 Snowman membership). Solana, Stellar, XRPL and Cosmos require signature-based finality per Section O. Litecoin, Dogecoin, DigiByte and Zcash use proof-of-work algorithms for which no implementation exists here. Whether deployable implementations are achievable on Base has not been established either way from the governing artifacts.

Additionally blocked at the source mechanism, not the verifier: **XRPL** (C.10, atomic batch availability DESIGN DEFINED) and **Cosmos** (C.12, EVIDENCE REQUIRED — CHAIN-NATIVE FEASIBILITY ANALYSIS INCOMPLETE).

Parameter-blocked: **Bitcoin Cash, Litecoin, Dogecoin, DigiByte** — confirmation counts DESIGN DEFINED per C.13–C.15, C.17.

### NEXT — CL-82 is unblocked implementation work
No EVM source vault contracts exist for Ethereum, BNB, Avalanche, Polygon, Arbitrum or Optimism, though C.1–C.5 and C.7 specify the same `createLock()` mechanism as the Base vault. Nothing blocks building them, and the Base-side verifiers for four of the six are already tested against the event format.

### CARRY-FORWARD (from v14, unchanged)
Deployment evidence from Base for the `L1Block` predeploy; CL-02 re-verification; Solana build evidence; Cosmos Base-side verifier; Session Handoff Brief still at v1.

---

## v16 ADDENDUM — CL-84 · BASE-CAP IMPLEMENTED

**Basis.** Master Specification Revision 6 (hash `5a935061…4ef0bf9`, re-verified this session); `spec/Vinculum_Finalis_Requirement_Traceability.csv`; Architecture Design A.12; commits through `a086746`. Nothing recorded without an artifact.

### CL-84 · CRITICAL · RESOLVED · Epoch rewards did not consume lifetime issuance capacity

**Established from the specification.** Rev 6 §13.1 defines the invariant: *"Remaining lifetime capacity = hard cap − cumulative lifetime protocol issuance."*
- **VF-SUP-001** — every authorized issuance path reconciles against the applicable global lifetime hard cap.
- **VF-SUP-002** — *"Commitment Vault issuance and Treasury Reward Stake rewards draw from the same VCLM lifetime hard cap."*
- **VF-SUP-003** — burning reduces circulating supply and does **not** reduce cumulative lifetime issuance or restore issuance capacity.

**The defect.** `VinculumFinalisStake` read remaining capacity (`:375`), refused an epoch reward exceeding it (`:383`), and minted (`:411`) — but nothing incremented the counter. The only writes to `cumulativeVclmIssued` and `cumulativeChonxIssued` were inside `verifyAndMint` at `VinculumFinalisVerifier:839` and `:849`. **Every epoch measured against an unchanged number.**

Secondary: the token's cap check read `totalSupply`, which falls on every burn. The SYNTH forge burns VCLM and CHONX by design, so that check permitted burn-then-mint — contradicting VF-SUP-003 directly. It was not exploitable while the verifier's counter was the tighter constraint, but it was wrong in kind.

Consequence beyond supply: **CHONX activation** is driven by the same counter (`:843`). With stake issuance invisible to it, activation was gated on vault issuance alone and would arrive later than VF-SUP-004 intends.

**Ownership established from the architecture, not chosen.** The Requirement Traceability Matrix assigns the invariant to **`BASE-CAP`**:

| Requirement | Traced component |
|---|---|
| VF-SUP-001, VF-SUP-002, VF-SUP-003, VF-SUP-013 | `BASE-CAP` alone |
| VF-SUP-005 | `BASE-CAP + BASE-ISSUE` |
| VF-SUP-009, VF-STK-028 | `BASE-EPOCH + BASE-CAP` |
| VF-STK-029 | `BASE-STAKE + BASE-CAP` |
| VF-XCH-021 | `AXELAR-ITS + BASE-CAP` |

Every path touching lifetime capacity traces as *that component **plus** `BASE-CAP`*. It is a participant each reconciles against, not a responsibility folded inside any one of them. Architecture A.12 names it: *Global lifetime-cap accounting — `BASE-CAP` [BASE-CHAIN]*.

**`BASE-CAP` did not exist.** Its state lived inside `BASE-VERIFY`, reachable only from one issuance path — which is precisely why `BASE-STAKE` could read the figure but never move it. The defect was a symptom of the missing component.

**Two reviewer proposals the architecture ruled out.** Before consulting the matrix the reviewer proposed (a) adding `recordStakeIssuance` to the verifier, or (b) moving accounting into the token. **Both would have worked and both were wrong** — (a) makes `BASE-VERIFY` the owner, (b) makes `BASE-TOK` the owner, and the matrix assigns neither. Recorded because it demonstrates the failure mode: an implementation can satisfy its observable behavior while violating the governing architecture.

**Remediation (`a086746`).** `VinculumFinalisCap.sol` implements A.12.
- Counters are **monotonic by construction** — no burn path, no decrement, no setter. VF-SUP-003 holds structurally, and no route restores capacity including future Axelar ITS transport (VF-XCH-021, VF-SUP-014).
- Recorders fixed at initialization; deployment authority destroyed in the same call, mirroring the token's one-shot pattern.
- `BASE-VERIFY` (`:842`, `:856`) and `BASE-STAKE` (`:392`, `:431`) both reconcile against it.
- The stake path records **`distributed`**, the amount actually minted. It rounds down and can be less than the `totalReward` checked. VF-SUP-001 requires reconciliation against what was issued.
- **Activation logic deliberately remains in `BASE-ACT`.** VF-SUP-004, VF-TOK-002 and VF-TOK-003 trace to `BASE-ACT`; none names `BASE-CAP`. The verifier evaluates the threshold using the figure `recordVclmIssuance` returns.

**Known consequence, recorded not fixed.** Activation is evaluated only in the vault path. A stake mint crossing the 10,000,000 VCLM threshold would activate CHONX on the next vault mint rather than at the crossing. This is a `BASE-ACT` concern; folding it into `BASE-CAP` would take responsibility the matrix did not assign.

**Evidence.** `evidence/CL84_BASE_CAP_2026-08-22.txt` — **292 passing, 0 failing.** `test/24_cl84_lifetime_cap.test.cjs` establishes the invariant directly, including an ABI inspection asserting no function name matches burn, decrease, reduce, reset, restore or set — VF-SUP-003 is the absence of a path, so the interface is the proof.

### TECHNICAL DEBT — not a finding
The protocol-stack deployment sequence is duplicated across twenty-plus test suites; only four import `deploySystem` from `00_smoke`. Integrating `BASE-CAP` therefore required editing sixteen files. **This violates no specification, architecture, standard or engineering policy, and is recorded here as debt rather than entered as a finding.** A consolidation pass would reduce drift on the next cross-cutting change.

### MILESTONE
`BASE-CAP` is the first of the architecture's **named components** to be implemented as such. A.12 existed on paper with nothing behind it. Lifetime-cap accounting is now enforced by the dedicated component rather than by individual issuance paths remembering to report.

