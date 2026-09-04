# 00 · START HERE — Reviewer Startup Procedure

**Vinculum Finalis spans Solidity, Rust, CosmWasm, JavaScript, Python and
serverless functions across a dozen directories. No reviewer — human or AI —
can hold it in working memory. Do not try. Orient instead.**

---

## The constraint that shapes everything below

**An AI reviewer cannot inspect this repository.** It reads only what is pasted
or attached in the session. Every orientation step therefore names a command
whose output must be supplied before analysis begins.

A reviewer who skips this and reasons from recollection will rediscover
finished work and report it as missing. **That has happened repeatedly and it
is the specific failure this document prevents.**

---

## Step 1 — Establish repository state (paste this first)

```
cd /path/to/Finalis-Launch && git log --oneline -8 && git status --short && ls -1 reviewers/ standards/
```

This gives: recent commits, uncommitted work, and the current version of every
governing document. **Version numbers change — never assume the one you
remember is current.**

## Step 2 — Read the orientation package, in order

| # | Document | Answers |
|---|---|---|
| 0 | `LAST_SESSION_STATE.md` | **Read this before anything else, and paste it into a new chat.** Where the last session ended: HEAD commit, deployment status, confirmed and retracted findings, tests executed, specification discoveries, process corrections, and the single named next task. Written for reviewers who arrive with no history. |
| 1 | `PROJECT_EVIDENCE_INDEX.md` | **What has been established, and where the evidence lives.** Read this first after the latch — it is a derived index and establishes nothing itself, but it points at everything below. |
| 2 | `reviewers/Vinculum_Finalis_Session_Handoff_Brief_v*.md` | How to work here; operator profile; standing rules |
| 3 | `standards/COMPONENT_IMPLEMENTATION_INVENTORY_v*.md` | **What is built, in every language** |
| 4 | `standards/BUILD_CLASSIFICATION_FROZEN_v*.md` | Which environments need code and which are architecturally blocked |
| 5 | `reviewers/Vinculum_Finalis_Findings_Register_v*.md` | Every finding, its status, its evidence |
| 6 | `reviewers/red-team/Wave_*/` | Adversarial review by wave, with reproductions |
| 7 | `standards/VERIFIER_COMPLETION_STANDARD.md` | When a component is complete; which suites are evidence |

**Do not inspect source code before completing this.**

## Step 3 — Confirm the governing specification

Master Specification Revision 6 is the North Star. Verify its hash before
treating it as authoritative:

```
5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9
```

---

## STOP — the construction gate

**Before proposing that anything be built, answer all three. A reviewer who skips this gate will build phantoms.**

Answer all three:

1. **Which requirement in Revision 6 requires this?**
2. **Which protocol invariant depends on it?**
3. **Is this implementing Vinculum, or accommodating external infrastructure?**

If the answer to (3) is "external infrastructure," it is configuration or
tooling — not protocol construction. Axelar ITS looked like code for an entire
session and was configuration all along.

---

---

## Which artifact answers which question

| Question | Artifact |
|---|---|
| What must the protocol do? | Master Specification Rev 6 |
| Which component owns a requirement? | `spec/Vinculum_Finalis_Requirement_Traceability.csv` |
| How is it architected? | `Vinculum_Finalis_Architecture_Design.md` |
| What is implemented, and where? | Component Implementation Inventory |
| Is an environment blocked by code or by architecture? | Build Classification |
| What findings exist? | Findings Register — **search it before opening a new one; see the gate in `reviewers/red-team/README.md`** |
| How do I start a new chat about this project? | `LAST_SESSION_STATE.md` — paste it first |
| What is the one next task? | `LAST_SESSION_STATE.md` → Immediate Next Task |
| What mistakes has this project already made? | `LAST_SESSION_STATE.md` → Process Corrections |
| What is established, and where is the proof? | `PROJECT_EVIDENCE_INDEX.md` (derived — follow its citations) |
| Which defects are confirmed and reproduced? | `reviewers/red-team/Wave_*/` |
| When is a component complete? | Verifier Completion Standard |

**The traceability CSV settles ownership disputes.** It is the instrument that
resolved CL-84 when two plausible remediations were both wrong.

---

## The rules

**Repository First.** Read the governing artifacts before reasoning. Read the
artifact before asserting its absence.

**Project axioms are not reopened.** Settled architecture stands unless a
governing artifact changes.

**Architecture ownership.** An implementation inconsistency does not create an
architectural decision.

**Repository silence.** Inability to locate an assignment is not evidence that
none exists. Distinguish a documented omission, an unavailable artifact, and a
genuinely silent specification.

**Defect before design.** A defect is established from the **specification**.
Ownership of its correction is established from the **architecture**. Separate
questions, evaluated separately.

**Evidence exhaustion.** Exhaust the repository before concluding a question is
unresolved. Exhausting it is evidence; failing to find an answer is not
permission to redesign.

**Implementation is not synonymous with Solidity.** A component is implemented
if the repository contains it in the form the governing artifacts require —
Solidity, Rust, CosmWasm, JavaScript, Python, a web service, or external
configuration. **Check `src/lib/`, `scripts/`, `base44/` and the native vault
directories before concluding anything is missing.**

**Correct behavior does not establish architectural correctness.** An
implementation may satisfy its observable behavior while violating the
governing architecture.

**A document is not delivered until it appears in a commit.** Two registers
were written, reported as delivered, and never reached the repository.

**The Evidence Index is derived, never authoritative.** If a row in
`PROJECT_EVIDENCE_INDEX.md` disagrees with the source it cites, the source
wins and the row is stale. Never upgrade a row's status without executing or
reading the evidence it names.

**`LAST_SESSION_STATE.md` replaces the former `SESSION_LATCH.md`,** removed at
the same commit that introduced it. If a document references the old filename,
that document is stale.

**If a requirement is in Rev 6, it is not an owner decision.** Open the
specification and quote the VF- identifier. The owner sets design appetite and
priority; he is not a verification source and must not be asked to confirm a
technical claim or pick between protocol mechanics. This rule exists because it
was broken: W1-05 was presented to him as an A/B choice when VF-ORC-010 already
answered it.

## Classification and construction do not overlap

```
Classify everything  →  Freeze  →  Build the Case 1 queue  →  Queue empty  →  Stop
```

Do not reclassify while building. Do not promote a blocked item without new
repository evidence. Interleaving these two phases is why the finish line kept
moving.

---

## Working conventions

Whole files, not line edits. Multi-line edits fail when pasted — deliver them
as a downloadable script. Check the download timestamp with `ls -lat` before
every `cp`; stale downloads have caused repeated silent failures. State the
destination path before a download. One terminal command at a time with the
expected output stated. GitHub Desktop is the canonical push workflow.

An empty attachment is not an empty file. **Say "the attachment is empty" and
stop** — do not generate plausible content for a document you could not read.
