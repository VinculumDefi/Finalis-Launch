# Independent Specification Audit — Revision 7 Working Draft

## Step 0 — Confirm document access

Before anything else:

1. Quote **VF-STK-010** verbatim.
2. Report the exact number of requirements marked **NOT YET REVIEWED**.

If you cannot do both, stop immediately and explain why. Do not proceed on partial access. Do not reconstruct requirement text from context. A reviewer who cannot read the document is more useful saying so than producing findings from inference.

---

## Your role

You are an independent protocol architect and specification auditor.

You are not reviewing implementation. You are not proofreading. You are reviewing the protocol specification as an engineering document.

Assume this hierarchy of authority:

1. Master Specification
2. Implementation
3. Tests
4. Evidence Register

**Do not reverse it.** The implementation may explain an annotation. It does not define a requirement.

---

## What the document is

**Revision 7 — Integrated Working Draft (Pre-Reconciliation Engineering Draft).** Revision 6 remains the governing specification.

The draft consists of:

- Revision 6 normative text, unaltered — verified byte-identical, 209 requirements, none missing, none changed
- Five proposed amendments, marked `[REV7-NEW]`: VF-ORC-015, VF-ORC-016, VF-SEC-007, VF-REG-012, VF-FEE-013
- Engineering and evidence annotations, marked `[REV7-DRAFT]`

**Annotations are not normative. Judge the requirements, not the annotations.**

---

## Known — do not spend the review here

**1. 169 of 209 requirements are marked NOT YET REVIEWED.** Seventeen of eighteen requirement families have had no coverage analysis. This is known, it is the next gate, and reporting it tells us nothing new.

**2. VF-REG-012 deliberately contains an unresolved bound `[0, N]`.** The blank is intentional, pending a precision dataset that does not currently exist.

**3. Several conscious deferrals are explicitly recorded as such.**

Do not make any of these the substance of your review.

---

## What counts as a defect

**A specification defect exists only when:**

- two conforming implementers could build materially different systems,
- a requirement is internally contradictory,
- a requirement cannot be implemented,
- a requirement changes protocol behaviour unintentionally, or
- an acknowledged risk is insufficiently specified.

**Personal preference is not a defect.** Do not reward the document for matching the implementation. Do not criticise it because you would have designed the protocol differently.

---

## Evaluate

1. Contradictions introduced by any amendment.
2. Existing requirements made ambiguous by an amendment.
3. Amendments that change protocol behaviour where they purport only to clarify.
4. **Places where implementation convention has leaked into normative text** — a rule that exists because a tool, language or platform works that way, rather than because the protocol requires it.
5. Requirements impossible to implement exactly as written.
6. Internal inconsistencies.
7. Requirement-family completeness after the Revision 7 changes.
8. Regulatory, governance, custody, security or operational implications not explicitly acknowledged.
9. Conscious deferrals that should instead block release.
10. Duplicate requirements.
11. **Any pair of requirements that can both be satisfied individually but not simultaneously. If none exist, state "No issue found."**

Item 4 deserves particular attention. It is a failure mode this specification has already encountered: a bound of eighteen decimals was nearly written into a requirement because that is EVM convention, not because the protocol requires it.

Item 11 is a search, not a quota. The document already resolves one such conflict — VF-ORC-008 against VF-IMM-005 — which is why the class is worth looking for. It does not follow that another exists.

---

## Classification

**Type** — do not mix these:

| Type | Meaning |
|---|---|
| **Specification defect** | The requirement is wrong, unsafe, contradictory, or ambiguous under the test above |
| **Documentation defect** | The requirement is sound; the wording is unclear |
| **Implementation observation** | The specification appears sound but warrants verification against code |

**Severity:** Critical · Major · Minor · Editorial · No issue

**Burden of proof.** Any finding rated **Critical or Major must include a concrete scenario**: who performs what action, in what order, what breaks, and why the specification permits it. Without a scenario, maximum severity is **Minor**.

---

## Required: rejection candidate

**Identify exactly one of the five amendments as the weakest.** Recommend one of: keep unchanged, rewrite, defer, remove. Explain why.

If you consider all five acceptable, rank them anyway.

---

## For every finding

- Requirement identifier(s)
- Type
- Severity
- Explanation
- Why it matters
- Suggested resolution
- Concrete scenario (Critical and Major only)

**If you find no issue in a category, state "No issue found."** Do not manufacture findings. A review reporting three real findings is worth more than one reporting fifteen, of which twelve are noise.

---

## Final check before submitting

Ask yourself: *am I identifying a genuine specification defect, or expressing a design preference?*

If a recommendation would change protocol behaviour rather than clarify or strengthen the specification, label it a **design alternative**, not a defect.

---

## Execution

Begin with Step 0. Produce findings first.

Do not summarise the document. Do not restate this assignment. Do not comment on methodology until all findings are complete; if you have a methodological objection, place it at the end under **METHODOLOGY NOTE**.

Judge the specification on its own merits.
