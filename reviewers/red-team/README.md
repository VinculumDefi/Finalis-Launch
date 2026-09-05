# Red-team review

Adversarial review of Vinculum Finalis, by wave. Each wave answers one question
and stops. Later waves may narrow or retract earlier conclusions; earlier
documents are not amended to match, because the record of how a conclusion was
reached is part of the evidence.

Read in order. Where waves differ, the later one governs.

---

## THE GATE — Evidence Reconciliation

**No new finding identifier may be issued until all six questions below are
answered "no", in writing, naming what was searched.**

*A new reproduction of an existing finding is valuable. A duplicate finding is
not. Prefer strengthening existing evidence over creating new identifiers.*

This gate exists because it has already failed. In Wave 4 a reviewer produced a
specification citation, a code trace, and two reproductions — one under full
production configuration — for a defect the Findings Register already carried as
**CL-76, open, CRITICAL, resolution recorded as an operator design decision**.
The register also already noted the duplicate contract tree the same wave
reported as new. About an hour was spent rediscovering what the repository had
written down weeks earlier.

The startup document already required this. `00_PROJECT_START_HERE.md` states
*Repository First* and *Evidence exhaustion*, and its artifact table maps "What
findings exist?" to the Findings Register. The rule was not missing. It was read
once at the start of a session and not applied at the moment a finding was
opened. Hence a gate here, at the point of action, rather than another principle
in a list.

Before issuing an identifier, answer:

1. **Is this already in the Findings Register?** Search for the affected
   function, mechanism, requirement identifier and invariant — not for your
   description of the symptom. CL-76 was found by searching `recordFeeAndRac`,
   not by searching "reward basis".
2. **Is this already in `PROJECT_EVIDENCE_INDEX.md`?**
3. **Was it superseded** by a later wave or register revision?
4. **Was it partially remediated?** A closed mint path does not close an
   accounting path. Ask which half was fixed.
5. **Was it intentionally accepted**, with the acceptance recorded?
6. **Was it retracted**, and for what reason?

If any answer is "yes", **extend the existing finding**. Do not issue a new
identifier. A fresh reproduction, a narrowed scope, or a newly exposed residue
belongs on the finding it strengthens, so that the history of how the conclusion
was reached stays in one place.

**Ask before escalating.** When behaviour is simple, consistent, and looks
deliberate, ask the owner whether it is intended before treating a code comment
as evidence against the code. Comments describe intent unreliably; the owner
describes it accurately. This rule exists because a reviewer read *"withdrawal
does not erase entitlement already earned"* in `withdrawPosition`, found the
code did not match that reading, and escalated a deliberate protocol rule to a
specification violation. Asking costs one sentence. Not asking cost an afternoon.

**And before asking at all, find the governing requirement.** The
withdrawal question was settled by VF-STK-020 — *"does not erase **accumulated**
claimable VCLM"* — which was available the whole time. Instead the reviewer
argued from a code comment, escalated, was corrected, reopened the same question,
misread the correction, and changed the contract before reverting it. The owner
should never be asked to adjudicate what the specification already states. See the forfeit-on-early-withdrawal entry in the Findings Register.

**Deployment state is not a finding.** Zero addresses in `config.js`, stubbed
verifiers, unregistered handshake entries, placeholder Dev Fund and publisher
keys, and uncompiled native vaults are the deliberate pre-deployment posture.
Ask: *would this still exist if every address were filled in tomorrow?* If no,
it is deployment state. Record it as status, not as a defect.

---

## Wave 1 — Base defect discovery

**Question:** If I ignore the website copy and talk only to the chain, what can
I steal, freeze, mint, or trick someone into signing?

**Outcome:** Four confirmed defects, three reproduced by executed tests on two
machines. One finding half-retracted. Six checks recorded as sound. Coverage gap
identified: the suite held adversarial tests, but none for a real lock plus a
package disagreeing with it on an identity field.

**Status:** Closed as a review. Superseded architecturally by Wave 2.

`Wave_1/REDTEAM_WAVE1_BASE.md`

---

## Wave 2 — Architectural assessment

**Question:** Is the interface expansion proposed by Wave 1 the architecturally
correct remedy?

**Outcome:** The reviewed evidence supports the direction. Scope narrowed twice —
six returned facts rather than seven plus a Base-side valuation rule, and
applicable to the EVM family and Solana but not the six UTXO environments. The
four Wave 1 findings resolve into evidence of one architectural deficiency. One
incompleteness identified in `Vinculum_Finalis_Architecture_Design.md` C.8,
requiring no Master Specification revision.

**Status:** Closed. No implementation, no patch, no finding closed.

`Wave_2/WAVE_2_ARCHITECTURAL_ASSESSMENT.md`

---

## Wave 3 — Implementation verification

**Question:** Can the assessed remedy be implemented safely, tests first?

**Outcome:** CL-85. `IChainVerifier.extractFacts` returns four identity fields;
`BaseSameChainVerifier` returns them from the lock record it already loaded; the
four remote EVM verifiers read them from `CommitVaultLockDetail`, which the vault
had always emitted and no verifier opened. The consumer cross-check moved from
step 11 to step 2b, ahead of the registry lookup and valuation that previously
consumed unvalidated identity. Suite 294/12 to 310/0. `22_evm_vault` passed
unmodified, which was the stop condition. Reproduced independently from a clean
clone before commit.

**Status:** Closed. Commit `0ccf94d`.

---

## Wave 4 — Environment conformance

**Question:** Did every implemented environment actually receive the CL-85
architecture?

**Outcome:** No new protocol defect. The wave's lead candidate was retracted at
the gate above and reclassified as CL-76 residue — CL-85 closed the mint path and
left the accounting path exactly where the register predicted: *"fail-closed
removes the mint path; it does not supply verification."* Genuinely new: a
production-configuration reproduction CL-76 never had, three missing
per-environment assertions, a UTXO verifier returning zero where the CL-85
interface requires a revert, a false status document at the repository root, and
an uncompiled Solana vault that nothing records.

**Status:** open.

---

## Standing rules

- **The gate above is mandatory.** No identifier without evidence reconciliation.
- A finding that cannot name a file is not a finding.
- Every finding names the regression test that would catch it returning.
- Every finding must be allowed to die. Before recording one, check whether an
  existing test already disproves it.
- Record what was checked and found sound, not only what broke.
- Assert on revert reasons, not on the fact of a revert.
- State what a wave did not cover.
- If a requirement is in Rev 6, quote the VF identifier. It is not an owner
  decision.
- A claim about one file is not a claim about an environment. Trace every layer —
  native vault, lock mechanics, proof generation, transport, Base verifier,
  tests — and classify each independently before summarising. Reading a single
  stubbed verifier nearly produced "Solana is not implemented" for an environment
  whose source mechanism binds every identity field Rev 6 requires.
