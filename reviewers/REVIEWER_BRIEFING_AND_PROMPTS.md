# Vinculum Finalis — Reviewer Briefing and Prompts
## Phase 2 · Compliance Review · 2026-08-03

**This document is for Alex.** It contains what to upload to each reviewer and what to say. The prompts are written to be pasted directly.

---

## THE SEQUENCING DECISION

**This phase is COMPLIANCE, not red team.**

Compliance asks: *does the code do what the specification requires?*
Red team asks: *given what the code does, how do I break it?*

Running them together produces reviewers reporting elaborate attacks against requirements that simply aren't implemented yet — noise that costs time to triage. Red team comes after the protocol is functionally intact, when an attack finding is genuinely about an adversary rather than an absence.

**Tell both reviewers this explicitly.** Both models will otherwise drift toward red-teaming, because it is more interesting and it is what "security review" usually means. The prompts below say so; do not remove that paragraph.

---

## WHAT EACH REVIEWER GETS

Both get the same files. The prompts differ, and the scopes are deliberately split so they are not duplicating each other or re-treading finished work.

| File | ChatGPT | Grok |
|---|---|---|
| `BUNDLE_A_Solidity_current.txt` | yes | yes |
| `BUNDLE_B_JavaScript_live.txt` | — | yes |
| `BUNDLE_C_tests_current.txt` | yes | yes |
| `Vinculum_Finalis_Findings_Register_v4.md` | yes | yes |
| Master Specification Rev 6 (.docx) | yes | yes |

If a reviewer cannot accept the `.docx`, they must say so and confine themselves to findings supportable from code alone. **Do not let either of them paraphrase specification requirements from memory.** Neither has seen this document in training. Invented requirement IDs are the single most likely failure mode here.

---

## SCOPE SPLIT — why each gets what

**Claude has already reviewed** (do not re-assign): the four main Solidity contracts for the 36 findings in Register v4; all authority surfaces; §10.1 staking arithmetic; the epoch model.

**Genuinely uncovered, and where the value is:**

- **Requirement coverage as a gap analysis.** Which numbered VF-XXX requirements have *no implementation anywhere*? Claude found defects in code that exists. Nobody has yet asked which requirements produced no code at all. This is ChatGPT's assignment — it is patient, systematic, and good at exhaustive enumeration against a document.

- **The six chain-verifier contracts and the live JS layer.** Barely reviewed. The chain verifiers are where forged-lock acceptance would live, and the JS layer is *running in the preview right now* and still carries four findings fixed only in Solidity. This is Grok's assignment — it is aggressive and good at noticing what is missing rather than what is wrong.

---
---

# PROMPT FOR CHATGPT

Paste everything below the line.

---

You are one of three independent reviewers on a pre-deployment smart contract protocol. Two others (Claude, Grok) are reviewing in parallel with different scopes. Do not assume prior reviewers were correct, and do not assume they were wrong.

**Your assignment: requirement coverage gap analysis.**

The other reviewers are looking for defects in code that exists. Your job is different and it is the one nobody has done: **find the numbered requirements in the specification that produced no implementation at all.** A requirement with no code is invisible to defect-hunting review, because there is nothing to find a defect in. That is exactly why it needs a separate pass.

Work through the specification requirement by requirement — VF-TOK, VF-SUP, VF-ORC, VF-FEE, VF-RAC, VF-STK, VF-COM, VF-XCH, VF-IMM, VF-DEP, and any others present. For each, determine whether an implementation exists in the code.

**Critical context you will otherwise get wrong:**

1. **Nothing is deployed.** No contract is live on any chain. This is a pre-deployment review. There is no emergency.
2. **The specification forbids all post-deployment administrative authority, and states that deployed defects cannot be repaired.** No proxy, no upgrade, no pause. Weigh everything with that in mind.
3. **The JavaScript files are a live preview implementation, not dead code and not a duplicate to be deleted.** Another reviewer already made that error.
4. **The contracts require `viaIR: true` to compile.** This is known and accepted.
5. **36 findings are already logged** in the attached register. Do not re-report them. If you disagree with a status, say so explicitly with evidence.

**This is a compliance review, not a red team exercise.** Do not report attack scenarios. The protocol is not yet functionally complete, and adversarial review is scheduled as a separate later phase. If you notice something alarming, note it in one line under UNSCHEDULED and move on — do not develop it.

**Arbitration rule.** A finding counts as CONFIRMED only if it cites BOTH (a) a specific numbered requirement from the specification and (b) a file and line number a reader can open and check in under a minute. Anything you believe but cannot evidence that way is NEEDS-VERIFICATION. Agreement with another reviewer is not evidence.

**Never invent a requirement ID or section number.** If you do not have the specification text for something, say "not verifiable from what I was given." An invented VF-XXX reference is worse than no finding, because it will be trusted and acted upon.

**Return format** — one block per finding, nothing else:

```
ID:         GP-01, GP-02, ...
TYPE:       MISSING (no implementation) | PARTIAL (implemented incompletely) | CONTRADICTS (implemented contrary to requirement)
SEVERITY:   Critical | High | Medium | Low
REQUIREMENT: the VF-XXX ID and a short restatement in your own words
EXPECTED:   what the requirement obliges the implementation to do
FOUND:      what exists, with file:line — or "no implementation located"
SEARCHED:   where you looked before concluding it is absent
TEST:       name of a test that would fail now and pass once implemented
```

The SEARCHED field is not optional. "I could not find it" and "it is not there" are different claims, and the difference matters.

**End with a coverage summary:** total requirements examined, count implemented, count missing, count partial. If you could not examine all of them, say which ranges you covered.

---
---

# PROMPT FOR GROK

Paste everything below the line.

---

You are one of three independent reviewers on a pre-deployment smart contract protocol. Two others (Claude, ChatGPT) are reviewing in parallel with different scopes. Do not assume prior reviewers were correct, and do not assume they were wrong.

**Your assignment: the code nobody has looked at.**

Two areas have had almost no review, and both are load-bearing:

**1. The six chain-verifier contracts** (`IChainVerifier.sol`, `EvmChainVerifier.sol`, `SolanaChainVerifier.sol`, `StellarChainVerifier.sol`, `UtxoChainVerifier.sol`, `XrplChainVerifier.sol`). These decide whether a lock on a foreign chain actually happened. If one of them accepts a forged proof, the entire protocol mints tokens against nothing. They are short files. Read every line. Several accept a `lockEventProof` parameter and never use it — determine for each whether that is a stub, an oversight, or intended.

**2. The JavaScript layer** (`BUNDLE_B`). This is the **live preview implementation and it is running right now.** It is not dead code, not a duplicate, and not to be deleted — another reviewer already made that mistake. Four findings (CL-14, CL-21, CL-22, CL-26 in the register) were fixed in Solidity and **not** in this layer. CL-14 in particular is an economically exploitable backdating attack that is live. Confirm which fixes are missing here, and find what else this layer does that the Solidity does not, or vice versa. Divergence between the two layers is itself the finding.

**Critical context you will otherwise get wrong:**

1. **Nothing is deployed.** No contract is live on any chain. Pre-deployment review.
2. **The specification forbids all post-deployment administrative authority and states deployed defects cannot be repaired.** No proxy, upgrade, or pause exists. A defect shipped is permanent.
3. **The contracts require `viaIR: true` to compile.** Known and accepted.
4. **36 findings are already logged** in the attached register. Do not re-report them. If you disagree with a status, say so with evidence.

**This is a compliance review, not a red team exercise.** I know that is the less interesting half and I am asking for it anyway. The protocol is not yet functionally complete, and adversarial review is a scheduled later phase where your instincts will be exactly what is wanted. Reporting attacks now against requirements that are not yet implemented produces findings nobody can action. If something alarming jumps out, give it one line under UNSCHEDULED and move on.

**Arbitration rule.** A finding counts as CONFIRMED only if it cites BOTH (a) a specific numbered requirement from the specification and (b) a file and line number a reader can open and check in under a minute. Anything else is NEEDS-VERIFICATION. Another reviewer agreeing with you is not evidence.

**Never invent a requirement ID or section number.** If you lack the specification text for something, say "not verifiable from what I was given."

**Return format** — one block per finding, nothing else:

```
ID:         GK-01, GK-02, ...
SEVERITY:   Critical | High | Medium | Low
SCOPE:      CHAIN-VERIFIER | JS-LIVE | BOTH-LAYER-DIVERGENCE
FINDING:    one sentence
EVIDENCE:   file:line, plus the code that proves it
SPEC:       requirement ID
IMPACT:     what actually goes wrong, concretely
TEST:       name of a test that fails now and passes after the fix
DEPENDS-ON: other finding IDs, or none
```

---
---

## AFTER BOTH RESPOND

Send both sets of findings to Claude. They will be merged into Register v5 with GP- and GK- prefixed columns, deduplicated against the existing 36, and any conflicts arbitrated by the rule above — spec reference plus checkable file:line, or it does not get confirmed.

**Watch for these failure modes when the responses come back:**

- **Invented requirement IDs.** Check any VF-XXX reference you do not recognize against the actual specification before acting on it.
- **Re-reporting resolved findings.** Both were given the register; some duplication will still happen.
- **Red-teaming despite instruction.** Expect some. It is not wasted — bank it for the later phase rather than actioning it now.
- **Confident claims with no file:line.** Under the arbitration rule these are NEEDS-VERIFICATION regardless of how certain they sound. This rule has already caught two errors by Claude and one by Base44.
