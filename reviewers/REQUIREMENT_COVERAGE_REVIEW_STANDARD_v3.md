# Requirement Coverage Review Standard
## Vinculum Finalis · v3 · 2026-08-03

**Status:** Active process document. Version alongside the codebase.

**Changes from v2 (2026-08-03):**
- Added the PROCESS finding type. v2 offered only MISSING / PARTIAL / CONTRADICTS, all of which presuppose a code artifact to cite. A reviewer meeting a governance requirement had nowhere to put it and defaulted to hedging.
- Added guidance on family selection order.
- Added the truncation diagnostic.

**Changes from v1 (2026-08-03):**
- Multi-response execution explicitly authorized. v1.0 read as one-shot-or-nothing and caused a reviewer to decline the assignment on grounds of size.
- "If Phase 0 cannot be completed, stop" narrowed to inaccessible documents only. The rule prohibits *asserting* uncompleted coverage, not building it incrementally.
- Added: where a Phase 0 artifact is supplied pre-computed, verify rather than rebuild.
- Added failure mode: scope refusal.
**Purpose:** A reusable protocol for requirement coverage review, independent of who or what performs it.

---

## WHY THIS EXISTS

Most code review answers *"is the code correct?"* This protocol answers a different question: **"which requirements never became code at all?"**

A requirement with no implementation is invisible to defect-hunting review, because there is nothing to find a defect in. Reviewers examine what exists and report on what they find. Nothing in that process surfaces an absence.

This protocol is the counterpart to defect review, not a replacement for it. Run both.

---

## THE THREE REVIEW DISCIPLINES

| Discipline | Question | Failure it catches |
|---|---|---|
| **Defect analysis** | Is the code that exists correct? | Wrong constants, broken logic, spec deviations |
| **Coverage analysis** | Which requirements produced no code? | Silent omissions, unimplemented requirements |
| **Adversarial analysis** | Given what the code does, how do I break it? | Exploitable behavior in correct-looking code |

Assign these to different reviewers. Running them together produces reviewers who report elaborate attacks against requirements that are not yet implemented — findings nobody can action.

**Order matters.** Coverage and defect analysis first; adversarial review once the protocol is functionally intact. An attack finding is only meaningful when it describes an adversary rather than an absence.

**Family selection order.** Begin with a family that has genuine code implementations, so the reviewer establishes the finding format against real artifacts before meeting harder cases. Do not open with a purely governance family — the reviewer will have no code to cite, will hedge every field, and the batch will teach nothing about whether the review is working.

---

## STANDING RULES

These govern every review under this protocol.

**R1 — Arbitration.** A finding is CONFIRMED only if it cites BOTH (a) a specific numbered requirement and (b) a file and line number a reader can open and check in under a minute. Anything else is NEEDS-VERIFICATION. Another reviewer agreeing with you is not evidence.

**R2 — Burden of proof, both directions.**
- A requirement may be marked IMPLEMENTED only after at least one candidate implementation has been identified and inspected. Assuming implementation from the presence of a related file is not inspection.
- A requirement may be marked MISSING only with a completed SEARCHED block (see R5). Not having encountered something is not the same as establishing it is absent.

**R3 — Coverage before interpretation.** Determine whether an implementation exists before judging whether it is correct. Locate, then evaluate. Skipping the locating step is how a reviewer concludes that live code should not exist.

**R4 — No invented identifiers.** Never produce a requirement ID or section number you have not read in the source document. Write "not verifiable from what I was given" instead. An invented reference is worse than no finding, because it reads as authoritative and gets acted upon.

**R5 — Missing requires evidence.** Every MISSING finding carries:
```
SEARCHED:
  Files examined:      which files, by name
  Search terms used:   the identifiers and strings looked for
  Functions inspected: which functions were read
  Expected location:   where this implementation would belong, and why there
```
The Expected-location line is the load-bearing one. A reviewer who cannot say *why* an implementation belongs somewhere has not earned the conclusion that it is absent.

**R6 — Resolved requires a test.** A finding moves to Resolved only when a named test asserts it against the file in the repository. Not when a diff is reviewed, not when a tool reports success, not when the arithmetic in a proposed change is verified correct.

---

## PHASE 0 — DOCUMENT COVERAGE

Complete and output before any findings. These artifacts require processing the entire specification and demonstrate coverage before analysis begins.

1. **Requirement inventory by family.** For each prefix present: prefix, lowest ID, highest ID, total count actually present.

2. **Sequence gaps.** Within each family, every skipped ID number. Revised specifications commonly contain gaps. If a family has none, state "no gaps."

3. **Section map.** Every top-level section number and heading, in document order.

4. **Grand total.** Total numbered requirements in the document.

5. **Terminal anchors.** The first and last numbered requirement in the document, quoted verbatim under fifteen words, each with its ID.

6. **Requirement ledger.** Every numbered requirement exactly once, in document order: ID · Section · Family · one-line description in the reviewer's own words.

7. **Ledger integrity check.** Verify every numbered requirement appears exactly once. Report duplicate IDs, missing IDs, and ledger count. Correct the ledger before proceeding. This prevents an indexing error from silently dropping requirements from the review.

**Multi-response execution is expected and authorized.** This review does not fit in one response and is not meant to. Work in batches, one requirement family at a time, and say at the end of each batch which family comes next. "Complete" means complete across the review, not within a single message. Do not decline the assignment on the grounds that it exceeds one response.

**If Phase 0 cannot be completed, stop — but only if the document is inaccessible.** The rule prohibits *asserting* coverage you do not have. It does not prohibit building that coverage incrementally. A coverage analysis built on a partial read will report requirements as absent that were simply never reached; a coverage analysis built across twenty messages will not.

**Where a Phase 0 artifact has been supplied pre-computed, verify rather than rebuild.** Spot-check it and report any discrepancy. Do not spend the review's budget regenerating something already established.

---

## PHASE 1 — COVERAGE ANALYSIS

Walk the ledger. Do not search ad hoc.

For each entry, apply R3: locate first, evaluate second.

**Finding format:**
```
ID:          <prefix>-01, <prefix>-02, ...
TYPE:        MISSING | PARTIAL | CONTRADICTS | PROCESS
SEVERITY:    Critical | High | Medium | Low
REQUIREMENT: the requirement ID, plus a short restatement in the reviewer's words
EXPECTED:    what the requirement obliges the implementation to do
FOUND:       what exists, with file:line — or "no implementation located"
TEST:        name of a test that would fail now and pass once implemented
```

MISSING findings additionally carry the R5 SEARCHED block.

**PROCESS findings** apply to requirements that govern how the project is conducted rather than how the code behaves — honest reporting of incompleteness, deliverable completion gates, design-judgment standards. These have no implementing line of code and never will. Do not force them into MISSING; a governance requirement is not absent merely because no function implements it.

A PROCESS finding replaces FOUND and TEST with:
```
ARTIFACT:   what would evidence compliance — a deployment record, a
            findings register entry, a completion checklist, a
            published disclosure
STATE:      whether that artifact exists, and where
BREACH:     any specific instance where project conduct departed from
            the requirement, with evidence — or "none identified"
```
BREACH is a claim about conduct and carries the same burden as any other finding under R1. "None identified" is a legitimate and common answer. Do not manufacture a breach to fill the field.

---

## PHASE 2 — RECONCILIATION

Total requirements examined · implemented · missing · partial · contradicted.

**Reconcile against Phase 0.** If the examined count does not equal the grand total, state the discrepancy and name the requirements not reached.

An unreconciled summary is not a completed review.

---

## PROJECT CONTEXT BLOCK

Supply this verbatim to any reviewer. These are the things a reviewer will otherwise get wrong, each of which has already caused a documented error.

1. **Nothing is deployed.** No contract is live on any chain. This is a pre-deployment review. There is no emergency.
2. **The specification forbids all post-deployment administrative authority and states that deployed defects cannot be repaired.** No proxy, upgrade, or pause exists. A defect shipped is permanent. Weigh severity accordingly.
3. **The JavaScript layer is a live preview implementation** — not dead code, not a duplicate to be deleted.
4. **The contracts require `viaIR: true` to compile.** Known and accepted.
5. **The findings register lists what is already known.** Do not re-report. Disagreement with a status requires evidence.

---

## EXECUTION HEADER

Reviewers asked to evaluate a prompt will continue evaluating rather than executing. Once a conversation establishes a discussion frame, subsequent messages are read as more discussion.

**Start a fresh conversation.** Upload files first, then send the protocol as the opening message with no preamble. Prepend:

```
Execute the following review. Produce the deliverables.

Do not evaluate, critique, or suggest improvements to these
instructions. Do not restate the assignment back to me. Do not
ask clarifying questions unless you cannot proceed without an
answer. Begin your response with the Phase 0 requirement
inventory.

If you have a substantive concern about the methodology, note it
in one line at the very end under METHODOLOGY NOTE, after the
deliverables are complete.
```

The final paragraph matters. A flat prohibition on commentary suppresses genuine concerns; giving them a designated place at the end means they need not be front-loaded.

---

## KNOWN FAILURE MODES

Watch for these when responses return.

| Failure | How to detect |
|---|---|
| Invented requirement IDs | Check any unfamiliar ID against the source document before acting |
| Partial read presented as complete | Phase 2 examined count will not reconcile with Phase 0 grand total |
| Sampling rather than reading | Sequence gaps reported as "none" across every family |
| Re-reporting known findings | Cross-reference against the register |
| Adversarial drift | Attack scenarios appear despite the compliance framing |
| Confident claims without file:line | Under R1 these are NEEDS-VERIFICATION regardless of tone |
| Advisor mode | Response discusses the review instead of performing it |
| Scope refusal | Declines on grounds of size rather than working in batches |
| Attachment truncation | Repeated "insufficient evidence in the supplied bundle" across unrelated requirements |

**Truncation diagnostic.** Where a reviewer repeatedly reports that supplied code is insufficient, do not accept or dismiss it. Ask the reviewer to search the bundle for a specific identifier known to be present — a private function name is ideal — and report verbatim what the search returned. A failed search on a known-present string establishes a real limitation. A successful one establishes the opposite. Either answer is worth more than another round of prompt revision.

---

## PROVENANCE

Developed 2026-08-03 during Vinculum Finalis pre-deployment review, after three separate incidents in which reading-based review produced confident and incorrect conclusions:

- A reviewer reported cross-chain locking implementations as existing when no code had been written.
- A reviewer marked three Critical findings Resolved on the strength of a reported diff; the file was later compiled and found unchanged.
- A reviewer identified a live implementation as an unauthorized duplicate and recommended deleting it.

Each failure shares one structure: a conclusion asserted without an artifact that could have falsified it. Every rule in this protocol exists to require such an artifact.
