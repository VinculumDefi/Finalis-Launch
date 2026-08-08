# Artifact Inventory — what exists here, what to do with each
## 2026-08-08 · read before syncing anything to the repo

**Read this first.** Every hash below is the first 12 characters of the SHA-256 of the file as it exists in my workspace right now. Compare against your machine before overwriting anything. Where a hash differs, my copy is newer — but confirm rather than assume, because the CL-54 divergence went undetected for days precisely because nobody compared.

**Nothing in this list has been committed to Finalis-Launch.** That is the gap this document exists to close.

---

## PRIORITY 1 — replaces something stale on your machine

| Hash | File | Action |
|---|---|---|
| `20b3667a3525` | **cosmos-hub-vault-current.tar.gz** | **Replace your local `cosmos-hub-vault/` entirely.** Your copy is missing `tests.rs` and pins the yanked `cw-storage-plus =2.0.2`. This one has `tests.rs` (26,621 bytes, 41 fn defs) and pins `=2.0.0` with the yank documented in-file. `target/` excluded |

**Do this before rerunning any Cosmos test.** Yesterday's two failures were both artifacts of the stale copy, not defects.

**Then check the repo separately:** `git log --oneline -- cosmos-hub-vault/Cargo.toml`. If the `=2.0.0` fix was never committed, the repo also holds a non-building version, and that is a real finding rather than a local mishap.

---

## PRIORITY 2 — contract sources, current versions

| Hash | File | Note |
|---|---|---|
| `16dfb884d145` | VinculumFinalisVerifier.sol | ~900 lines. All Critical remediations through CL-49 |
| `f72630c59d06` | VinculumFinalisStake.sol | Includes the CL-09 difference-array rewrite |
| `cf8a002cfaa0` | MockChainVerifier.sol | **TEST ONLY — never deploy.** Decodes facts from the proof so tests control source-chain evidence |
| `d99d08159648` | VinculumFinalisToken.sol | Unchanged since Aug 3 |
| `80c8aaa270ce` | VinculumFinalisSynth.sol | Unchanged since Aug 3 |

**Do not overwrite `src/base-verifier/contracts/` in the repo with these.** Those originals are retained deliberately as evidence that the contracts never compiled before this project. These belong alongside, in `base-contracts/`.

---

## PRIORITY 3 — the test harness (12 files, 116 passing tests)

All from yesterday. Nothing equivalent exists in the repo.

| Hash | File |
|---|---|
| `3cd9f81fd228` | 00_smoke.test.cjs |
| `73c133d25396` | 01_findings.test.cjs |
| `074c562c2c00` | 02_oracle.test.cjs |
| `ab70d47de580` | 03_handshake.test.cjs |
| `270e58e6f898` | 04_endtoend.test.cjs |
| `70646aa71bd7` | 05_staking_lifecycle.test.cjs |
| `1dde86dd7d82` | 06_scaling.test.cjs |
| `a0c042b87d55` | 07_differential.test.cjs |
| `1a84743ab465` | 08_precision.test.cjs |
| `dbf84cb36b96` | 09_registration.test.cjs |
| `9f1681bea732` | 10_bps_domain.test.cjs |
| `97bfdb51bcf6` | 11_temporal_domain.test.cjs |
| `11c6ad6bfd60` | hardhat.config.cjs |
| `6c99fa8b3a02` | BASELINE_85_tests.txt |
| `545f21d6a3fc` | vf-harness-W0.tar.gz |

`viaIR: true` is required in the Hardhat config — without it, CL-33 stack-too-deep. `npm install --legacy-peer-deps`.

---

## PRIORITY 4 — specification work (the largest gap)

| Hash | File | Note |
|---|---|---|
| `ba75615b2e5e` | **Vinculum_Finalis_Revision_7_WORKING_DRAFT.md** | 273 KB. Rev 6 text verified byte-identical, 7 amendments inserted, every requirement annotated. 216 requirements |
| `9cf25c0c6032` | REVISION_7_CANDIDATE_AMENDMENTS.md | Standalone amendment text + Engineering Decisions appendix |

**Rev 6 itself is unchanged** at `5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9`. The working draft does not replace it and has no normative authority.

---

## PRIORITY 5 — evidence and investigation records

| Hash | File | What it establishes |
|---|---|---|
| `54e4c399c0c1` | CL-50_COVERAGE_INVESTIGATION.md | 4 of 17 environments located; found the traceability CSV; CL-52 status-vocabulary finding |
| `8ece07237c6b` | CL-53_EXECUTION_INVESTIGATION.md | Cosmos/Solana blockers named specifically |
| `03521fd1b770` | FAMILY_REVIEW_01_VF-PRI.md | Family 1 of 18. All 6 requirements at evidence level A |
| `6f0b637d360f` | IMPLEMENTATION_DOMAIN_AUDIT.md | 1 Critical, 1 config defect, 1 open question, 6 examined-clean |
| `11f84a236e0c` | CL-09_EVIDENCE_RECORD.md | Difference-array gas measurements and acceptance criteria |
| `a3d55150cfcf` | CL-38_DECISION_BRIEF.md | Single-key acceptance rationale |
| `0cdcc15b4883` | VERIFICATION_LEVEL_AUDIT.md | Evidence-level definitions S/U/I/E/A |
| `589772dafcb7` | REMAINING_CRITICALS_MAPPING.md | Finding-to-requirement mapping |
| `045002bee4d9` | RUNBOOK_source_chain_tests.md | Today's laptop procedure |

---

## PRIORITY 6 — reviewer materials

| Hash | File | Note |
|---|---|---|
| `72d7bf634a24` | **GROK_SPECIFICATION_AUDIT_PROMPT_v2.md** | **Use this one.** Frozen version |
| `7b9f87636419` | GROK_SPECIFICATION_AUDIT_PROMPT.md | Superseded by v2 |
| `8155f220ff37` | **REQUIREMENT_COVERAGE_REVIEW_STANDARD_v3.md** | **Use this one** |
| `d84f2984695d` | REVIEWER_BRIEFING_AND_PROMPTS.md | Earlier briefing material |

---

## SUPERSEDED — do not sync, retain locally only if you want the history

`REQUIREMENT_COVERAGE_REVIEW_STANDARD_v1.md`, `v1.1`, `v2` — superseded by v3.
`Vinculum_Finalis_Findings_Register_v2/v3/v4.md` — superseded by the Evidence Register work; v4 (`a8410808f2a2`) is the newest.
`BUNDLE_A/B/C`, `VF_Review_Bundle_1/2` — reviewer snapshots from Aug 2–3, now stale.
`vinculum-finalis-contracts-fixed.tar.gz`, `base-contracts.tar.gz` — earlier contract packages; the loose `.sol` files above are newer.

---

## ⚠️ What this inventory cannot tell you

**I do not know what is currently in the Finalis-Launch repository.** I have no access to it. Every "action" above assumes the repo lacks these files, which is my understanding but not something I have verified.

**Before syncing, produce the other half of this comparison:**

```
cd <repo>
git log --oneline -15
git ls-files | head -60
```

Paste that back and I will diff it against this inventory properly. Otherwise we risk the mirror image of the CL-54 problem — overwriting something newer in the repo with something older from here.
