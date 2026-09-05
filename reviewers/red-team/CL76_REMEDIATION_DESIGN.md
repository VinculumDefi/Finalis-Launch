# CL-76 · Remediation Design

**Tree:** `github.com/VinculumDefi/Finalis-Launch` @ `redteam/prep` (`7465eb6`)
**Status:** Design note. No implementation, no patch, no code proposed.
**Finding:** CL-76, accounting path. Register v17.

This note answers one question: what changes if source verification happens
before the Reward-Accounting Credit is written, rather than after. It does not
choose an implementation.

---

## 1 · Current execution order

Two external entry points, called in sequence by any address.

**Phase one — `recordFeeAndRac(pkg)`**, `external onlyWhenFinalized`:

1. Derive `verifiedGrossUsdMicro` from the signed price record and the
   caller-supplied `pkg.grossAmountSmallestUnits`.
2. Validate fee arithmetic, USD bounds, asset registration, Dev Fund
   destination, and that `feeTransferEvidence` is non-empty.
3. Write `racCredits[pkg.racIdentity]`, `racEpoch[...]`, `recordedRacs[...]`,
   and `epochRewardBasis[epoch] += racCredit`.

No chain verifier is consulted at any point in phase one.

**Phase two — `verifyAndMint(pkg)`:**

1. Replay protection.
2. **Require the RAC already recorded** (`:717`).
3. *(2b)* Resolve the chain verifier, verify source finality, extract facts,
   cross-check identity and amounts.
4. Registry, fee, duration, USD bounds, output eligibility, allowance,
   recipient, Dev Fund, issuance, cap, mint.

**Consequence.** The credit is written by step 3 of phase one. The evidence that
would justify it is examined at step 3 of phase two, in a later transaction that
may never occur. Nothing revisits the credit.

---

## 2 · Proposed execution order

Move the verification that already exists in phase two so that it also gates
phase one. The credit is written only after the source event has been verified.

```
recordFeeAndRac(pkg)
  ├─ resolve chain verifier for pkg.sourceEnvironmentId
  ├─ verify source finality
  ├─ extract facts; cross-check identity and amounts against pkg
  ├─ existing fee / bounds / registry / Dev Fund validation
  └─ write the credit
```

Phase two is unchanged. Its step 2 gate still holds: a recorded RAC now implies
verification already passed once.

**Governing invariant.** *A Reward-Accounting Credit may be created only after
the protocol has successfully verified the Commitment Vault Lock that generated
it.* §9 requires it, VF-FEE-007 and VF-FEE-008 require the proof to establish the
fee and tie it to the same completed lock, VF-FEE-012 anticipates a fee that
yields no credit, and §10.3 supplies the slack that makes retry harmless.

**What is not proposed.** No new interface, no new state, no change to
`verifyAndMint`'s ordering, no change to the two-call shape of the public API,
and no change to how the credit is calculated.

---

## 3 · Why Rev 6 permits the change

**No requirement mandates the current order.** Searched for an ordering
dependency across every VF-RAC, VF-FEE and VF-XCH requirement.

**VF-RAC-003** is the only requirement that could plausibly create one:

> A Reward-Accounting Credit is assigned to the 10-day epoch in which it is
> **successfully recorded on Base.**

The epoch is defined by recording time. If recording moves later, the credit is
assigned to whatever epoch it is then recorded in, and the requirement is
satisfied on its own terms. It cannot be violated by a change in when recording
succeeds.

**The specification argues for the proposed order, not merely permitting it:**

- **§9** — *"Each **successfully verified** Commitment Vault fee creates a
  one-time numerical Reward-Accounting Credit."*
- **VF-RAC-001** — the credit is valued against the fee **collected**.
- **VF-FEE-007** — the **proof must establish** the actual fee and its transfer.
- **VF-FEE-008** — fee-routing evidence and principal-lock evidence must refer to
  **the same completed lock**.

**The outcome the current design exists to avoid is expressly contemplated.**
**VF-FEE-012** states that fee-routing failure prevents Base issuance *and* the
Reward-Accounting Credit. A fee that yields no credit is an anticipated state.

**The implementation cites the wrong requirement.** The comment above phase two's
gate justifies persistence with **VF-FEE-011**, which governs the
non-refundability of fees, not the persistence of credits.

**No technical constraint.** `recordFeeAndRac` already receives the same
`ProofPackage` that `verifyAndMint` receives, carrying `sourceFinalityProof` and
`lockEventProof` (`:163–164`). Phase one is handed everything it would need.

---

## 4 · Every affected regression test

Eight suites call `recordFeeAndRac` across forty call sites.

**Unaffected — packages that verify.** `05_staking_lifecycle` (1),
`08_precision` (4), `09_registration` (2), `13_base_e2e` (4, real Base locks),
and the valid cases in `04_endtoend`. These submit genuine packages; phase one
verifies and proceeds.

**Unaffected — no execution.** `02_oracle` (2) inspects the ABI signature only.

**Affected — packages deliberately built to fail.** Every one follows the same
shape: record, then expect the rejection at `verifyAndMint`.

| Suite | Sites | Change required |
|---|---|---|
| `25_w1_identity_binding` | 11 | Move the expected rejection from `verifyAndMint` to `recordFeeAndRac` |
| `10_cl76_forged_package` | 2 | Same. Also replace bare `.to.be.reverted` — see §7 |
| `04_endtoend` | 1 (`VF-XCH-011` case) | Same |

The rejection still occurs, with the same reason string, produced by the same
cross-check code — one call earlier. Nothing these suites assert about the
protocol becomes false.

---

## 5 · Every affected requirement

| Requirement | Effect |
|---|---|
| §9, VF-RAC-001 | Satisfied rather than violated |
| VF-FEE-007, VF-FEE-008 | Satisfied rather than violated |
| VF-RAC-003 | Unchanged; epoch follows recording time, whenever that is |
| VF-RAC-002, 004, 006, 007, 008 | Untouched; all operate after assignment |
| §10.3, VF-STK-011/012/013 | Rewards processed one epoch behind; scheduled timestamps control eligibility even if finalization is delayed. Supplies the slack that makes retry harmless |
| VF-FEE-012 | Already anticipates fee-without-credit |
| VF-FEE-011 | Unchanged; fees remain non-refundable. Miscited at `:717` |
| VF-ORC-007/009/010 | Untouched |
| VF-IMM-006 | Reason the change must precede deployment |

---

## 6 · Backward compatibility

**Nothing is deployed.** No migration, no state to reconcile, no existing
credits.

**The public API shape is unchanged.** Two calls, same names, same argument, same
order. An honest caller submitting a verifiable package sees no difference.

**One behavioural change, intended.** A caller who previously succeeded at phase
one with an unverifiable package now fails there. That is the defect being
removed.

**Downstream consumers unchanged.** `epochRewardBasis` is read at exactly one
place outside the verifier — `VinculumFinalisStake.sol:344` — and it reads a
total; it cannot observe how that total was assembled. `racCredits` and
`racEpoch` are declared in Stake's verifier interface at lines 60–61 and called
by nothing.

---

## 7 · Remaining risks

**Verification cost is paid twice.** The largest genuine consequence. Phase one
would verify, and phase two verifies again. Same-chain `verifyAndMint` is
measured at 224,817 gas (`13_base_e2e`); remote EVM environments carry
Merkle-Patricia receipt proofs and cost more. The two-call flow roughly doubles
its verification cost. Two mitigations exist and neither is proposed here: verify
in phase one only and let phase two rely on the recorded RAC, or merge the phases
entirely. Both change more than ordering and are out of scope for this note.

**Retry timing is already absorbed by the specification — risk withdrawn.** An
earlier draft of this note raised credits shifting epochs as a genuine
behavioural change. That was written from the general form of VF-RAC-003 without
reading §10.3, which governs precisely this case and is titled *Position
eligibility and delayed reward allocation*:

> **Rewards are processed one epoch behind.** A position earning for epoch N must
> be active at the exact beginning of N, remain continuously active through N,
> and remain active through the scheduled end of N+1. **The scheduled timestamp
> controls eligibility even if finalization is delayed.**

**VF-STK-013** fixes an entitlement for epoch N only after the scheduled end of
epoch N+1. Eligibility is therefore determined by scheduled timestamps, not by
when anything finalizes. A verification delay cannot change who qualifies, and a
full epoch of slack exists before any basis pays out. The buffer that makes
retry harmless was designed in from the start.

**No griefing vector introduced.** Any address may submit; the honest locker does
not depend on a particular relayer. The source lock persists indefinitely, so
resubmission is always possible. The fee remains non-refundable either way.

**A weak regression must be strengthened, not merely relocated.**
`10_cl76_forged_package` asserts `.to.be.reverted` with no reason at lines 172
and 216, and its header still expects `VerifierNotImplemented`, which can no
longer fire. If those assertions are moved without being tightened, the suite
will continue to be unable to distinguish which mechanism blocked execution — the
condition that let this finding survive as long as it did.

**Miscitation to correct.** The revert message at `:717` cites VF-FEE-011. It
should cite the requirement that actually governs the gate.

**Not addressed by this change.** CL-76's minting half is already closed by real
verifiers and CL-85. CL-09's `allocateEpoch` bound is independent. Neither
interacts with this ordering.

---

## 8 · Two decisions, deliberately separated

Keeping these apart matters: the invariant should not be arguable on the strength
of a preference about the second question.

### Decision A — the protocol invariant

> *A Reward-Accounting Credit may be created only after the protocol has
> successfully verified the Commitment Vault Lock that generated it.*

Supported by §9, VF-RAC-001, VF-FEE-007 and VF-FEE-008. Nothing in Rev 6 requires
the current order, no technical constraint prevents the change, and §10.3 supplies
the slack that makes retry harmless. No protocol behaviour depends on the present
behaviour.

### Decision B — where verification physically lives

Open, and narrower. §7's measured cost is the evidence.

**Should the two external entry points remain at all?** Yes, and the
specification is the reason — not habit.

Verification is not the only thing that can fail. `VF-COM-025: CHONX not
activated` fires at step 7 of `verifyAndMint`, **after** verification at step 2b.
A genuine, fully verified lock that selects CHONX before activation therefore
reaches a state where **verification succeeded and issuance failed**.

§9 ties the credit to the fee — *"Each **successfully verified** Commitment Vault
fee creates a one-time numerical Reward-Accounting Credit"* — not to successful
issuance. VF-RAC-008 excludes only the capacity-exhausted case. So a verified fee
whose issuance is blocked by the activation gate should still create a credit.

**Merging the phases would revert the whole call and destroy that credit.** That
is a §9 violation, and it means merge should be struck from the options rather
than weighed.

This partially vindicates the original design. Its comment justified the split
with *"hard cap exceeded, finality not yet achieved."* Finality is a verification
failure, not an issuance failure, so that half was wrong; hard cap is excluded by
VF-RAC-008. But the activation gate is a genuine issuance failure after
successful verification, and the instinct behind the split survives.

**Remaining options, merge excluded:**

1. Verify in phase one and again in phase two. Smallest change; pays §7's cost
   twice.
2. Verify in phase one only, phase two relying on the recorded RAC. Cheaper;
   widens the change and requires care that the RAC gate cannot be satisfied by
   an unverified path.

This note does not choose.

---

**Conclusion.** No protocol behaviour depends on writing the credit before
verifying the lock. The change removes a code path rather than adding one. The
remaining cost is duplicated verification work, and the remaining risk is that
the affected regressions are relocated without being strengthened.
