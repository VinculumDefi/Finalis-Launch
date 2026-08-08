# Verification Level Audit — Resolved Findings
## 2026-08-07 · 72 passing tests · applied retroactively

**Principle:** the evidence must be at least as strong as the claim.

| Level | Meaning |
|---|---|
| **S** | Specification decision only. No code. |
| **U** | Unit-tested. Storage values, isolated functions, structural assertions. |
| **I** | Integration-tested. Exercised through a real production entry point, but not the full pipeline. |
| **E** | End-to-end verified. Exercised through the path production actually uses, start to finish. |
| **A** | Architectural argument. **Never stands alone** — a claim that no test is needed is the shape of reasoning that produced this project's worst errors. Valid only as a qualifier, with the argument written out. |

---

## GRADED

| ID | Claimed | Level | Evidence source | Note |
|---|---|---|---|---|
| CL-01 | Resolved | **E** | `04_endtoend.test.cjs` — issuance without a published price | Runs `recordFeeAndRac` → `verifyAndMint` |
| CL-02 | Resolved | **U + I** | `01_findings.test.cjs` — authority block; `04` — finalization gate | Removal unit-asserted; gate exercised end-to-end |
| CL-03 | Resolved | **U** | `01_findings.test.cjs` — token multipliers | **No production consumer reads the weight** — rewards blocked by CL-06 |
| CL-04 | Resolved | **U** | `01_findings.test.cjs` — four duration assertions | Read from storage after a real `createPosition`, never consumed |
| CL-05 | Resolved | **U** | `00_smoke.test.cjs` — deploy; constructor guards | **No epoch has ever been closed or allocated in any test** |
| CL-07 | Resolved | **U** | `01_findings.test.cjs` — `minterStake` address | ⚠️ See below |
| CL-08 | Resolved | **U** | Constructor/state assertions | Terminal state has never been reached in a test |
| CL-11 | Resolved | **E** | `04_endtoend.test.cjs` — allowance lifecycle | Consumption, per-identity tracking, caller claim ignored |
| CL-14 | Resolved | **I** | `01_findings.test.cjs` — expired `queueExtension` | Genuine entry point; full staking lifecycle not exercised |
| CL-15 | Resolved | **U** | Withdrawal guard | Depends on terminal state, never reached |
| CL-18 | Resolved | **E** | The harness itself | Exists and runs |
| CL-21–26 | Resolved | **U** | `00`/`01` — constructor guards, type safety | Compile- and storage-level |
| CL-30 | Resolved | **E** | `04_endtoend.test.cjs` — fee path | Fee derivation runs in the pipeline |
| CL-31–33 | Resolved | **E** | `npx hardhat compile` | Compilation is the production path for a compile defect |
| CL-34 | Resolved | **U** | `01_findings.test.cjs` — `getPositionWeight` | Accessor exists, returns correct values |
| CL-35 | Resolved | **I** | `01_findings.test.cjs` — pre-finalization revert | Asserted structurally |
| CL-36 | Resolved | **U** | `02_oracle.test.cjs` — zero verifier | Rejection at registration |
| CL-37 | Resolved | **E + A** | `04_endtoend.test.cjs` — stale price; `02_oracle.test.cjs` — boundaries | **A:** principal release unaffected — release executes on the source chain and no Base contract holds principal |
| CL-39 | Resolved | **I** | `02_oracle.test.cjs` — run advance | Real entry point; brick scenario not simulated |
| CL-40 | Resolved | **E** | `04_endtoend.test.cjs` — valid handshake mints | Found by, and fixed under, end-to-end coverage |

---

## ⚠️ THE ONE THAT NEEDS RESTATING

**CL-07 — "Stake contract is an authorized minter of VCLM."**

The test asserts `vclm.minterStake() == stake.address`. That is a storage read.

**The Stake contract has never minted a single token in any test**, because `rewardBasis` is never assigned (CL-06), so `allocateEpoch` always takes the zero-eligible branch and no reward is ever paid.

So the claim "Stake can mint epoch rewards" rests entirely on an address matching. Whether the mint call actually succeeds through the production path is unproven.

**This is CL-01's situation exactly** — marked Resolved while its path was unrunnable. The difference is that this time we found it before an auditor did.

**Restated:** CL-07 is **Resolved at level U**, and cannot reach E until CL-06 is fixed. They should be tracked as a pair. When CL-06 lands, the acceptance criterion is a test in which the Stake contract mints a real reward to a real staker through `closeEpoch` → `allocateEpoch`.

---

## SECONDARY OBSERVATION

**The entire staking subsystem sits at level U.** CL-03, CL-04, CL-05, CL-07, CL-08, CL-15 — every one is asserted through storage reads or isolated calls. No test has ever closed an epoch, allocated a reward, or paid a staker.

That is not a defect claim. The arithmetic is correct and the tests are real. But the staking contract has the same profile the Verifier had this morning: individually correct pieces, never exercised together.

**Recommendation:** after CL-06 and CL-09, build the staking equivalent of `MockChainVerifier` — a test that runs a full epoch lifecycle with multiple stakers across a boundary.

Experience on this project suggests full lifecycle tests reveal integration defects not observable through unit tests: the Verifier's end-to-end harness uncovered CL-40, a 10^12 unit mismatch, within an hour of its introduction. That makes the same approach appropriate for the staking subsystem. It does not establish that a defect is present.

---

## NET POSITION

- **End-to-end (E):** 8 findings
- **Integration (I):** 4
- **Unit (U):** 12
- **Specification only (S):** CL-38 pending decision

Nothing here is wrong. But "43 findings resolved" and "8 findings resolved with end-to-end evidence" are different sentences, and only the second one is what an auditor will ask for.
