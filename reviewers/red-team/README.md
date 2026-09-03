# Red-team review

Adversarial review of Vinculum Finalis, by wave. Each wave answers one question
and stops. Later waves may narrow or retract earlier conclusions; earlier
documents are not amended to match, because the record of how a conclusion was
reached is part of the evidence.

Read in order. Where waves differ, the later one governs.

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

**Question:** not yet opened.

**Expected first act:** regression tests for the remote EVM path that fail
against the current tree, before any interface change.

**Status:** not started.

---

## Standing rules

- A finding that cannot name a file is not a finding.
- Every finding names the regression test that would catch it returning.
- Every finding must be allowed to die. Before recording one, check whether an
  existing test already disproves it.
- Record what was checked and found sound, not only what broke.
- Assert on revert reasons, not on the fact of a revert.
- State what a wave did not cover.
- If a requirement is in Rev 6, quote the VF identifier. It is not an owner
  decision.
