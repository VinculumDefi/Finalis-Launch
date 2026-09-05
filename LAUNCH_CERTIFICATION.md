# Launch Certification — Rev 6 §16

**Tree:** `github.com/VinculumDefi/Finalis-Launch` @ `redteam/prep`
**Bound to:** `<FINAL COMMIT>`
**Authority:** Master Specification Revision 6, SHA-256
`5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9`
**Date:** 2026-09-03

**Expiry.** VF-VER-006 makes evidence commit-bound. This document describes
that commit and nothing else. Any change to contracts or tests invalidates it and
requires re-issue against the new commit. Suite at this commit: **320 passing,
0 failing**, reproduced on a Linux sandbox and on the owner's Windows machine.

**VF-VER-007 constrains what this document may claim.** It does not state that
the protocol is production-ready. It states, for each verification requirement,
whether the repository demonstrates it, with evidence. A passing-test count is
evidence for individual items and is never a conclusion.

---

## Summary

| Requirement | Disposition |
|---|---|
| VF-VER-001 · Requirement traceability | **DEMONSTRATED** |
| VF-VER-002 · Positive lifecycle tests | **PARTIALLY DEMONSTRATED** |
| VF-VER-003 · Negative tests | **PARTIALLY DEMONSTRATED** |
| VF-VER-004 · Boundary tests | **PARTIALLY DEMONSTRATED** |
| VF-VER-005 · Principal isolation | **DEMONSTRATED** |
| VF-VER-006 · Independent reproduction | **DEMONSTRATED** |
| VF-VER-007 · No readiness claim from test counts | **DEMONSTRATED** |
| VF-VER-008 · Code does not prevail | **DEMONSTRATED** |

Four of eight demonstrated, four partial. Details below.

---

## VF-VER-001 · Requirement traceability — DEMONSTRATED

> Each numbered requirement maps to applicable contracts, source-environment
> programs, functions, tests, and deployment checks.

**Artifact:** `spec/Vinculum_Finalis_Requirement_Traceability_GENERATED.csv`,
produced by `tools/generate_traceability_matrix.cjs` v1.0.0.

**Two halves, deliberately.** The authored columns — specification section,
architecture component, positive and negative test obligations — come from
`spec/Vinculum_Finalis_Requirement_Traceability.csv`, committed since `86d5fd1`.
They are judgement and cannot be generated. The generated columns — implementing
contract and function, naming test, source-environment program — are derived
from the repository at the certified commit.

An earlier revision of this document stated that no traceability matrix existed.
That was false; the authored CSV had been committed for a month. The claim came
from searching contracts and tests for VF citations without searching `spec/`.
Recorded rather than silently corrected.

**Reproducible by an independent reviewer**, which is the point (VF-VER-006).
Output is sorted, carries no timestamp, and records both the commit and the tool
version. Two consecutive runs produce byte-identical files, verified by hash. A
reviewer regenerates and diffs rather than trusting the artifact.

**Coverage at the certified commit:**

| | Count |
|---|---|
| Requirements | 209 |
| Traced — implementation and a named test | 51 |
| Implemented, no test names the requirement | 73 |
| Not traced in code | 85 |

**The third row is expected and is not a gap.** It covers governance, process,
oracle-operations and website requirements that no contract implements —
VF-DOC-001, for instance, states that the Master Specification is the sole
governing expression. Marking them is correct: it shows they were considered
rather than missed.

**The second row is a coverage gap, not a defect.** A requirement may be tested
without a test naming it. The matrix measures citation, which is the auditable
proxy; it does not measure behaviour. Closing it is test-authoring work, and per
the standing rule in `reviewers/red-team/README.md` a coverage gap is not a
Findings Register entry.

**Disposition: DEMONSTRATED.** Every requirement maps to a row, every row states
its traceability status, and the mapping regenerates from the repository.

## VF-VER-002 · Positive lifecycle tests — PARTIALLY DEMONSTRATED

The requirement enumerates five specific behaviours.

| Named behaviour | Evidence |
|---|---|
| One-use Handshake allowance | `04_endtoend` — *a one-use mechanism permits exactly one, rejects the second* |
| Three-use Handshake allowance | `04_endtoend` — *permits exactly three, rejects the fourth* |
| Each distinct identity its own allowance | `04_endtoend` — *allowance is per identity, not global* |
| Source-state and proof-verification-path enforcement | `13_base_e2e`, `18/20/21/23`, `26_w2` — five environments |
| Recognized pending-attempt resolution | **Not located.** `vfPendingAttemptLifecycle.js` exists off-chain; no on-chain regression found |

**Disposition: PARTIAL.** Four of five demonstrated. Pending-attempt resolution is
unevidenced on-chain.

---

## VF-VER-003 · Negative tests — PARTIALLY DEMONSTRATED

Demonstrated: invalid amounts, assets, prices, proofs, destinations, recipients,
outputs, replays, premature releases, cap breaches, unauthorized control,
over-limit Handshakes. Named tests exist for each — `10_cl76`, `11_base_vault`,
`12_base_verifier`, `24_cl84`, `25_w1`, `27_cl86`, and the five verifier suites.

Also demonstrated, explicitly required by the closing sentence: *failed,
reverted, invalid attempts consume no allowance* — `04_endtoend`,
*VF-COM-008: a rejected attempt consumes no allowance*.

**Not demonstrated:** ambiguous or multi-key UTXO release paths; duplicate
official submissions while objectively pending; timer-, mempool-, or
non-observation-based clearing of a still-valid transaction; objectively expired
and replaced attempts.

**Disposition: PARTIAL.** The gaps cluster in the pending-attempt and UTXO
release areas.

---

## VF-VER-004 · Boundary tests — PARTIALLY DEMONSTRATED

Demonstrated: exact thresholds (`11_base_vault` — $10.00 standard, $0.95–$1.05
handshake); fee rounding (`CL-41`); one-use and three-use limits (`04_endtoend`);
multiplier transitions (`CL-04`, `CL-03`); term expirations (`CL-14`);
lifetime-cap behaviour (`24_cl84`); timestamps (`CL-48` — 48-hour staleness in
both directions).

**Not demonstrated:** canonical release-public-key normalization across permitted
encodings and script wrappers; objective pending-attempt disposition and
invalidation.

**Epoch boundaries — demonstrated but with a caveat that must be recorded.**
`06_scaling` measures epoch processing, and its `allocateEpoch` case does not
enter the loop it claims to measure: `deployStakeOnly` produces a zero reward
basis, so gas is identical at 5 and 60 positions by construction. Verified
directly. Wave 5B's harness, using a real basis and qualifying positions, measured
216,932 / 1,012,947 / 2,315,517 gas at 5 / 60 / 150 positions. **CL-09 is open on
that evidence.**

**Disposition: PARTIAL.**

---

## VF-VER-005 · Principal isolation — DEMONSTRATED

> Principal-isolation tests demonstrate release after maturity despite failure of
> Base issuance, price updates, relayers, epoch processing, and external
> integrations.

- `11_base_vault` — *releases at maturity to the bound destination when called by
  a stranger*
- `11_base_vault` — *releases without consulting the verifier, the price feed, or
  the factory*
- `11_base_vault` — *releasing one lock leaves every other lock untouched*
- `11_base_vault` — *refuses to release before maturity*, *refuses a second
  release*
- `22_evm_vault` — same properties for the remote EVM vault

The second test is the requirement stated directly: release does not consult the
verifier, the price feed, or the factory.

**Disposition: DEMONSTRATED.**

---

## VF-VER-006 · Independent reproduction — DEMONSTRATED

> Independent reproduction is stronger evidence than self-reported pass counts.

- **CL-85.** Reproduced on a Linux sandbox, then rebuilt from a clean clone of
  `38d3b77` with changes rewritten rather than copied, then verified on the
  owner's Windows machine. Same 21 files, same 63 deletions.
- **Wave 1 defects.** Reproduced on two machines, identical to 18 decimals.
- **CL-76 accounting path.** Reproduced twice — mock configuration, then full
  production configuration with the real verifier registered.
- **CL-86.** The four new properties were run against the *unpatched* contract:
  two fail, two pass. Recorded rather than assumed.

**Disposition: DEMONSTRATED.** This is the requirement the project satisfies most
strongly.

---

## VF-VER-007 · No readiness claim from test counts — DEMONSTRATED

> No package may be described as production-ready or deployment-ready merely
> because it compiles or has a high passing-test count.

- The public site carries no readiness claim; `status.html` states the protocol is
  not implementation-complete and that contracts are written and not deployed.
- The earlier site claim *"93 tests passing"* was removed in `de8a0f0`.
- This document states three of eight requirements demonstrated. It makes no
  readiness claim.

**Disposition: DEMONSTRATED.**

---

## VF-VER-008 · Code does not prevail — DEMONSTRATED

> A divergence between code and this specification is an implementation defect or
> a newly identified specification matter; code does not prevail by default.

Applied repeatedly, in both directions:

- **CL-85** — the interface returned seven facts where VF-XCH-011 required
  nineteen to be bound. The code changed.
- **CL-86** — `recordFeeAndRac` wrote a credit with no verification, against §9.
  The code changed.
- **CL-09** — the implementation scans every position. Rev 6 was checked and
  **permits** a bounded strategy, so this was reclassified from specification
  violation to implementation limitation.
- **W2-05** — the UTXO gap was traced to architecture C.8, not to Rev 6, because
  §11.2 delegates chain-specific mechanism to the architecture.
- **CL-76 minting path** — a claim that CL-85 closed it was corrected against the
  evidence; three other mechanisms close it, only one of which is CL-85.

**Disposition: DEMONSTRATED.**

---

## Finding dispositions

**Remediated — verified against current code, index in the register is stale:**
CL-01, CL-02, CL-06, CL-10, CL-11, CL-12, CL-17, CL-29, CL-30, CL-43.
Every one cites `Verifier.sol`, a filename that no longer exists.

**Remediated:** CL-76 accounting path, by CL-86 at `b1ae4b7`. Regression
`27_cl86_verify_before_credit.test.cjs`, four properties. Two of the four fail
against the immediately preceding commit `7465eb6` — verified by running them
against the unpatched tree — and two are non-regression guards that pass on both
sides.

**Accepted implementation limitation:** CL-13 — replay flag written after
`chonxToken.mint`; `VinculumFinalisToken` has zero transfer hooks, so no
reentrancy vector exists.

**Open — requires remediation before launch:**
- **CL-09** · `allocateEpoch` unbounded. ≈14,473 gas per lifetime position,
  ceiling ≈2,062. Rev 6 permits a bounded strategy; the implementation has not
  adopted one. VF-IMM-006 forecloses repair after deployment.
**CL-16 — CLOSED** by owner decision 2026-09-03 and CL-87 at `f193e8a`. The
complete Epoch Reward is now minted; the undistributable remainder is stranded
permanently and unreachable by construction. Regression `28_cl87`; fails against
`b1ae4b7`.

**Deferred — environment not issuing:** CL-55, CL-60, CL-63–CL-73 (Solana; vault
does not compile, six errors in `build_errors.txt`), CL-75 (Cosmos), CL-27
producer half. All behind fail-closed Base verifiers.

**Repository divergences, no protocol effect:** `NATIVE_TO_BASE_CONNECTION_STATUS.md`
asserts three things false of this repository; `src/base-verifier/contracts/` is
an unpatched duplicate tree, never built or tested; the Findings Register index
contradicts its own entries; `PROJECT_EVIDENCE_INDEX.md` v7 predates CL-85;
`LAST_SESSION_STATE.md` claims HEAD `33a9c4b`; the red-team README on HEAD
predates the promoted principle.

---

## What certification does not assert

That the protocol is correct. That no undiscovered defect exists. That the
repository is deployment-ready.

It asserts that for the commit named above, these eight requirements have the
dispositions recorded, with evidence a reviewer can re-run.

**No protocol defect remains open.** CL-09 closed by CL-89, CL-76's accounting
path by CL-86, CL-16 by CL-87. CL-13 accepted with no exploitable path. Solana
and Cosmos deferred behind fail-closed verifiers.

**Remaining partials are test-authoring work**, not defects: 73 requirements are
implemented without a test naming them, and VF-VER-002/003/004 name specific
behaviours — pending-attempt resolution, UTXO multi-key release paths,
release-public-key normalization — with no named regression. None is a
specification violation.

**Not blocking, but recorded:** `06_scaling`'s `allocateEpoch` case still reports
`5=53293, 60=53293, ratio=1.00x` at this commit. That measurement is vacuous —
the harness produces a zero reward basis, so the loop is never entered. It is
left untouched deliberately: CL-86 changed nothing about it, and altering a test
outside the change under certification would break the commit binding.
