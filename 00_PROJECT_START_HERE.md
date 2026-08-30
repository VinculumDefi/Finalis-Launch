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
| 1 | `reviewers/Vinculum_Finalis_Session_Handoff_Brief_v*.md` | How to work here; operator profile; standing rules |
| 2 | `standards/COMPONENT_IMPLEMENTATION_INVENTORY_v*.md` | **What is built, in every language** |
| 3 | `standards/BUILD_CLASSIFICATION_FROZEN_v*.md` | Which environments need code and which are architecturally blocked |
| 4 | `reviewers/Vinculum_Finalis_Findings_Register_v*.md` | Every finding, its status, its evidence |
| 5 | `standards/VERIFIER_COMPLETION_STANDARD.md` | When a component is complete; which suites are evidence |

**Do not inspect source code before completing this.**

## Step 3 — Confirm the governing specification

Master Specification Revision 6 is the North Star. Verify its hash before
treating it as authoritative:

```
5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9
```

---

## Which artifact answers which question

| Question | Artifact |
|---|---|
| What must the protocol do? | Master Specification Rev 6 |
| Which component owns a requirement? | `spec/Vinculum_Finalis_Requirement_Traceability.csv` |
| How is it architected? | `Vinculum_Finalis_Architecture_Design.md` |
| What is implemented, and where? | Component Implementation Inventory |
| Is an environment blocked by code or by architecture? | Build Classification |
| What findings exist? | Findings Register |
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

---

## Before proposing any new construction

Answer all three:

1. **Which requirement in Revision 6 requires this?**
2. **Which protocol invariant depends on it?**
3. **Is this implementing Vinculum, or accommodating external infrastructure?**

If the answer to (3) is "external infrastructure," it is configuration or
tooling — not protocol construction. Axelar ITS looked like code for an entire
session and was configuration all along.

---

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
