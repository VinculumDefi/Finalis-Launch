# Requirement Family Review — VF-PRI
## Commitment Vault Principal Safety · 1 of 18 families · 2026-08-07

**Family size:** 6 requirements. **Prior coverage:** none.

**Why this family first:** it governs user principal. If any requirement here is unmet, users lose funds. It is also entirely unreviewed, so it tests the review process on real ground rather than on governance text.

---

## THE STRUCTURAL FINDING — read this before the table

**Not one VF-PRI requirement is implemented in the Base contracts.**

Principal release executes on the source chain. Assets never leave it. The Base Verifier observes and attests facts about a lock; it does not hold, move, or release principal. That is the architecture working as designed — VF-PRI-004 and VF-PRI-005 exist precisely to guarantee it.

The consequence for this review is significant: **the 116-test harness we have spent two days building cannot verify this family at all.** It tests the Base contracts. VF-PRI lives elsewhere.

**Where it lives, and what exists:**

| Environment | Implementation present | Tests present |
|---|---|---|
| Solana | `solana-vault/` — `release_principal.rs` | `tests/vault.ts` — **run output never seen** |
| Cosmos Hub | `cosmos-hub-vault/` — CosmWasm | 45 test functions — **run output never seen** |
| XRPL | `xrpl-lock/` — scaffolding, `tests/` directory | **unknown** |
| Remaining 14 environments | **none located** | — |

**Three of seventeen environments have a located implementation. Fourteen do not.**

This is finding **CL-50** below. It is not a VF-PRI defect — the requirements are sound and the Solana implementation appears to satisfy them — it is a coverage finding about the protocol as a whole, and it is the largest one this project has produced.

---

## REQUIREMENT-BY-REQUIREMENT

### VF-PRI-001 — fee removed or irrevocably designated at lock creation; the remainder is the principal subject to maturity

**Status:** Implemented (Solana, Cosmos) · **Evidence: A** · **no test evidence held**

Solana `release_principal.rs:64` checks maturity against the `Clock` sysvar before permitting release, and the lock record carries the principal separately from the fee. The Base Verifier independently cross-checks the fee arithmetic at step 4 and rejects a package whose fee, principal and gross do not reconcile — `04_endtoend.test.cjs` proves that path at level E.

**But the Base check is a consistency check on an attestation, not a verification that the source chain actually removed the fee.** Those are different claims. The requirement is about lock creation on the source chain.

**Finding:** none against the requirement. Evidence level A pending source-chain test execution.

---

### VF-PRI-002 — principal may be released only once

**Status:** Implemented (Solana, Cosmos) · **Evidence: A** · **no test evidence held**

Solana enforces this with a stored flag: `release_principal.rs:40` constrains on `!lock_record.released`, and line 89 sets it. Both the standard and the second release path (lines 119, 186) carry the same guard, which is the correct pattern — a single guarded path and an unguarded sibling is a common way this requirement fails.

**Finding:** none against the requirement. Double-release is the highest-consequence failure in this family and it currently rests on an **architectural argument, not a test run we have seen.** This should be the first thing exercised when source-chain test output is obtained.

---

### VF-PRI-003 — principal released only to the destination bound at lock creation

**Status:** Implemented (Solana) · **Evidence: A** · **no test evidence held**

Enforced structurally rather than procedurally, which is stronger: `release_principal.rs:49` constrains the passed account to equal `lock_record.release_destination`. A caller supplying any other destination cannot construct a valid transaction. The comment at line 29 records the intent explicitly — the caller "receives nothing; principal always goes to the bound destination."

This also satisfies VF-SEC-006's courier model on the source side: anyone may trigger release, and no one may redirect it.

**Finding:** none. Note this is the same design principle as CL-01 and CL-41 on the Base side — a value that determines where assets go is not accepted from the caller.

---

### VF-PRI-004 — no price reference or oracle call is required for principal release

**Status:** Implemented · **Evidence: A** — and the argument is sound

`release_principal.rs` contains no price, oracle, or valuation reference of any kind. The release path reads the lock record and the clock. Nothing else.

This is the requirement that makes CL-37's fail-closed staleness rule safe. When the price publisher goes dark and every USD-dependent operation halts, **principal release is untouched** — because it never consults a price. The two requirements are load-bearing for each other.

**Finding:** none. This is a case where an architectural argument is legitimate and complete: the mechanism does not exist, so there is nothing to test. Recorded as **A** with the argument written out, per the standing rule that A never stands alone as an unexplained letter.

---

### VF-PRI-005 — no Base issuance, epoch calculation, Treasury Reward Stake processing, registry update, relayer, or administrator is required for release

**Status:** Implemented · **Evidence: A**

Same basis as VF-PRI-004. The Solana release path has no cross-program invocation to any Base-related account and no authority check beyond the destination constraint. The header comment at line 7 states the requirement directly.

**Finding:** none against the requirement.

**Observation worth recording:** VF-PRI-004 and VF-PRI-005 together are what make the protocol's failure mode *acceptable*. Every fail-closed decision taken during this remediation — CL-37's staleness bound, CL-38's accepted key-loss consequence, VF-SEC-003's prohibition on fallback pricing — is tolerable **only because these two requirements hold.** If either were violated, an oracle outage would trap user funds permanently under VF-IMM-006, and several decisions taken this week would need revisiting.

**They therefore deserve the strongest evidence in the protocol, and currently carry the weakest.** That is the sharpest thing this review found.

---

### VF-PRI-006 — no early release path; if Base verification fails permanently, the lock still matures and principal remains releasable

**Status:** Implemented (Solana) · **Evidence: A** · **untested, and the negative case is untestable from Base**

The maturity check at `release_principal.rs:64–66` has no bypass, no administrative override, and no early-exit branch. The second release path applies the same check at line 161.

The requirement has two halves and only the first is structurally evident:

1. *No early release path* — verifiable by inspection. No such path exists.
2. *If Base verification fails permanently, principal remains releasable* — this is a **cross-system behavioural claim.** It requires demonstrating that a lock whose Base attestation never succeeds still matures and releases on the source chain. No test in any harness we hold exercises it.

**Finding: CL-51, Minor.** The second half of VF-PRI-006 is the protocol's user-facing safety promise — *if our infrastructure fails, your money still comes back* — and it has no test anywhere. It is not a defect; the implementation appears correct. It is the single most important untested claim in the protocol.

---

## FINDINGS

### CL-50 — Source-chain implementations located for 3 of 17 environments

**Severity: Major.** **Type: coverage finding, not a specification defect.**

Implementations located: Solana, Cosmos Hub, and XRPL scaffolding. Fourteen environments have no located implementation in the package under review.

**Why it matters.** The entire VF-PRI family — everything protecting user principal — is implemented per environment. A verifier proven correct on Base says nothing about whether a Bitcoin, Cardano, Algorand, Stellar or Aptos lock releases principal correctly. There are seventeen implementations of this family, not one.

**This does not mean the implementations do not exist.** A prior forensic audit independently verified native lock packages for XRPL, Stellar, DigiByte, Algorand and Cardano. They are not in the package this review has access to.

**Resolution:** locate and inventory every source-chain implementation, then apply this family review to each. Until then, VF-PRI is verified for at most three of seventeen environments.

---

### CL-51 — VF-PRI-006's failure-resilience half is untested

**Severity: Minor.** **Type: evidence gap.**

That a lock whose Base attestation permanently fails still matures and releases is the protocol's core user-safety promise. It is structurally plausible — release consults only the lock record and the clock — but no test demonstrates it.

**Resolution:** a source-chain test that creates a lock, never attests it on Base, advances past maturity, and releases principal successfully. This is achievable on Solana today with the existing test scaffolding.

---

### No finding against any VF-PRI requirement itself

All six requirements are internally consistent, implementable, and implemented in the environments where an implementation was located. **The gap is entirely evidentiary, not specificational.**

---

## DRAFT ANNOTATIONS

| ID | Status | Evidence | Source |
|---|---|---|---|
| VF-PRI-001 | Implemented (3 of 17 envs) | **A** | `release_principal.rs:64`; Base cross-check at E |
| VF-PRI-002 | Implemented (3 of 17 envs) | **A** | `release_principal.rs:40, 89, 119, 186` |
| VF-PRI-003 | Implemented (3 of 17 envs) | **A** | `release_principal.rs:49` — structural constraint |
| VF-PRI-004 | Implemented | **A** | No price, oracle or valuation reference exists in the release path |
| VF-PRI-005 | Implemented | **A** | No Base-related CPI or authority check in the release path |
| VF-PRI-006 | Implemented (first half) | **A** | `release_principal.rs:64–66, 161`. Second half untested — CL-51 |

**Every requirement in this family sits at level A.** Under the standing rule, A never stands alone — each argument is written out above rather than asserted. But six of six at A is a weak position for the family that protects user funds, and it should not be allowed to persist to freeze.

---

## PROCESS NOTE — what this family taught about the review itself

**Reviewing a family against the Base harness is not sufficient.** I began by checking VF-PRI against the 116-test suite and found nothing, because nothing in that suite touches principal release. Had the review stopped there, the honest conclusion — "this family is implemented somewhere we have not tested" — would have been missed entirely, and the family might have been marked unimplemented.

**Amendment to the review method for the remaining 17 families:** before assessing a family, first establish *where* it is implemented. Base, source chain, the JavaScript preview layer, or deployment procedure. Several families will not live in the contracts we have been testing.
