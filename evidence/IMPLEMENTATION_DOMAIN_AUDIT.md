# Implementation-Domain Narrowing Audit
## Vinculum Finalis · 2026-08-07 · 116 passing tests

**Defect class examined:** *implementation-domain narrowing* — a value whose permitted domain is defined by the specification, represented by a primitive type chosen against the simplest case the author had in mind rather than against the domain actually specified. The consequence is either silent truncation, a silent default substituted for an unrecognized value, or a configuration that arithmetic cannot execute.

**Why it earned a gate.** Two instances had already been found incidentally before the audit began — `uint16` on Commitment Vault multipliers (CL-32, values to 80000) and an EVM `address` on source-chain Dev Fund destinations (CL-12, eleven of seventeen environments are non-EVM). Two instances of one class, found by accident, justified looking for the rest deliberately.

**Method.** Every non-`uint256` numeric and every discriminator in the production contracts was enumerated mechanically, then each was compared against its specification-defined domain. Each was tested at boundary representatives, not sampled.

---

## RESULT

| ID | Quantity | Finding | Disposition |
|---|---|---|---|
| **CL-41** | `pkg.assetPrecision` | **CRITICAL — exploitable.** Caller-supplied divisor in every USD derivation, unvalidated in `recordFeeAndRac` | **Fixed.** Divisor now read from the immutable registry; package field economically inert |
| **CL-42** | `custodyClass`, `custodyPath` | Unrecognized class fell through a ternary to the S3 multiplier (VF-SEC-003 forbids substituting a default multiplier) | **Fixed.** Bounded at registration |
| **CL-43** | `decimals` domain | Unbounded `uint8` used as an exponent; values above 77 cannot execute, 19–77 silently misprice | **Partially resolved — see below** |
| CL-44 | `selectedOutputToken` | Examined. Guard at line 728 precedes use at line 819 | **Clean** |
| CL-45 | `token` (Stake) | Examined. Guarded twice — `<= 2` at entry and a reverting lookup | **Clean** |
| CL-46 | BPS products | Examined. Max product 40000 × 20000 = 800,000,000 exceeds `uint16`; safe only because `pos.amount` is uint256 and leftmost | **Clean, with ordering now a tested invariant** |
| CL-47 | `durationSecs` | Examined. Only the four §10.1 terms accepted | **Clean** |
| CL-48 | `fetchTimestamp` | Examined in both temporal directions | **Clean** |
| CL-49 | `runId` | Examined for wraparound, reuse and skip | **Clean** |

**One Critical, one configuration defect, one open question, six examined-clean.**

The examined-clean results are part of the audit's value, not padding. "We checked this and it holds, here is the test" is evidence. An audit reporting only its defects leaves a reader unable to tell what was covered.

---

## CL-41 — the Critical, in detail

`recordFeeAndRac` used `pkg.assetPrecision` — a caller-supplied field — as the divisor in every USD derivation, and never validated it. The equality check `entry.decimals == pkg.assetPrecision` existed, but only inside `verifyAndMint`. `recordFeeAndRac` is an independently callable external function.

**Measured, not argued:**

| Declared precision | Resulting RAC credit |
|---|---|
| 18 (true value) | 600000000000000000 |
| 12 (understated) | 600000000000000000000000 |

**1,000,000× inflation.** Declaring 0 would give 10¹⁸×. The inflated credit entered `epochRewardBasis`, which drives `totalReward` in `allocateEpoch`, which mints VCLM to stakers.

**Causal note, stated precisely.** CL-06 did not create this defect. CL-06 restored the specified reward pipeline, which made a pre-existing defect in that pipeline economically effective. The chronology must not be read as "the CL-06 remediation introduced CL-41." It made previously dead code consequential — which is exactly why a newly activated path requires renewed adversarial testing.

**Repair class.** Not another equality check that some future entry point might omit. Precision is now read from the immutable registry and the package field is not consulted anywhere. Same principle as CL-01: a quantity that determines issuance is never caller-supplied.

**Inertness proven, not merely the exploit closed.** Credits at declared precision 0, 6, 12, 18 and 255 are identical: `600000000000000000`. The field has no economic influence at any value.

---

## ⚠️ CL-43 — OPEN. Do not freeze the bound.

`decimals` is now bounded to ≤ 18 at registration. **That bound is EVM convention, not specification-derived, and must not be frozen as permanent.**

The specification says issuance calculations *use 18-decimal fixed-point arithmetic*. That is the internal arithmetic precision. It is **not** a statement that approved assets may have at most 18 decimals. Those are different claims and were nearly collapsed into one.

- The authoritative registry (`vinculum_finalis_approved_asset_registry.json`) carries identity, environment, class and pricing identifier — **no decimals field**. No maximum can be computed from it.
- The arithmetic-safety ceiling is 77; above that `10 ** decimals` exceeds `uint256`.
- The implementation-side precision table shows 18 for native EVM assets and 6 for USDC, which is evidence about some assets, not all 1,001.

**Risk runs both ways, and registration is immutable after finalization.** Too tight and a legitimate approved asset can never be registered. Too loose and the poisoning risk partially returns.

**Required before freeze:** either the authoritative precision dataset for the 1,001 assets, from which the true maximum is computed, or a specification rule that explicitly defines the permitted precision domain. Until one exists, 18 is provisional.

---

## CL-46 — a note for whoever maintains this next

`_getWeight` computes `pos.amount * tokenBps * durationBps / 1e8`.

Arithmetic safety depends on the uint256 `pos.amount` participating **before** the two uint16 BPS operands multiply each other. Reordering can introduce a checked-arithmetic overflow without changing the apparent mathematical expression: 40000 × 20000 = 800,000,000 exceeds `uint16`, so `tokenBps * durBps * amount` reverts where `amount * tokenBps * durBps` succeeds.

The two forms are algebraically identical and operationally different. A test now asserts the ordering, with that rationale recorded in the test file itself so a later "simplification" fails loudly.

---

## WHAT THIS AUDIT DOES NOT COVER

It is **horizontal** — one defect class across the whole implementation. It says nothing about whether each specification requirement has an implementation at all.

That is the **vertical** question, and it is the next gate: 17 of 18 requirement families remain unreviewed, roughly 200 requirements. **116 passing tests do not imply coverage.** A requirement with no implementation produces no failing test, because there is nothing to fail.

That gate is where genuinely surprising findings are most likely, if any remain.
