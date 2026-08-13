# VINCULUM FINALIS — SESSION HANDOFF BRIEF v1

**Purpose:** This document exists to reconstitute an assistant's *working awareness* at the
start of a new chat. It is deliberately not a findings list — the Findings Register carries
that. This brief carries everything else: how the project is governed, how the operator works,
what has already been decided, what the environment does, and what has been learned the hard
way. Read it before doing anything.

**Author:** Alex, on behalf of Vinculum Protocol DAO LLC
**Companion documents (all three are uploaded together at the start of a session):**

1. `Vinculum_Finalis_Master_Specification_Revision_6_2026-07-28.docx` — the North Star
2. `Vinculum_Finalis_Findings_Register_v6.md` — the audit record
3. This brief

**Order of reading:** this brief first, then the register's SESSION CARRY-FORWARD block, then
the specification as needed for whatever the session's task is.

---

## 1. THE MASTER SPECIFICATION — HOW IT IS TREATED

This section is first because misunderstanding it corrupts everything downstream.

**The governing document is `Vinculum_Finalis_Master_Specification_Revision_6_2026-07-28.docx`.**

SHA-256: `5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9`

### 1.1 It is hash-locked and immutable

The file is **never edited. Never re-saved. Never opened in a program that might rewrite it.**
Even opening and closing a `.docx` in Word can alter bytes and break the hash. The hash is the
document's identity. If the hash changes, the specification is no longer the specification.

If a session needs to read the spec, it reads it — extracting text is fine. What is forbidden is
producing a modified copy, "cleaning it up," fixing a typo in it, or generating a Revision 6.1.
There is no such thing as Revision 6.1.

### 1.2 It is the North Star, not a reference

This is the part that matters most and is easiest to get subtly wrong.

Every finding in the audit is a statement that **the implementation disagrees with the
specification**. The specification is the arbiter. The implementation is the thing on trial.
When code and spec disagree, the default conclusion is that the *code* is wrong.

This has a hard consequence that must never be relaxed:

> **Test vectors come from the specification, never from the implementation.**

If a test's expected values were derived by reading the code, that test proves only that the code
agrees with itself. It certifies nothing. This is the single most productive lens in the entire
audit and it has caught real Criticals. See §7.

The corollary: when a finding is raised, the first question is always "what does Rev 6 say?" —
not "what does the other chain do?" and not "what seems reasonable?"

### 1.3 The spec can be wrong — but it is corrected through a defined process

The specification is not infallible. When the audit determines that the spec itself is defective
or ambiguous, that does **not** license editing Rev 6. It creates a **Revision 7 candidate
amendment**, which is recorded and held.

### 1.4 Revision 7 is NON-NORMATIVE

There exist Revision 7 candidate amendments and rationale notes. **They are pending, not
authoritative.** They do not govern anything. Rev 6 governs.

Rev 7 candidates live in two places:
- **Appendix A of the Findings Register** — currently A1 through A11
- **`REVISION_7_CANDIDATE_AMENDMENTS.md`** — standalone file in the repo

A fresh session must not audit against Rev 7 candidates, must not treat them as decided, and must
not quietly fold them into reasoning about what the protocol "should" do. They are proposals.

Rev 7 is incorporated only at the very end of the freeze-gate sequence (§10), after the code is
frozen and audited — at which point the annotations are stripped, a clean release candidate is
produced, a new hash is taken, and a changelog is written. Not before.

### 1.5 Why this discipline exists

Vinculum Finalis deploys **immutable**. §2 of the specification guarantees no upgrade path. There
is no patch, no pause, no admin key, no second chance. The operator's own framing, which he has
confirmed for public use:

> "Pausing without an upgrade path isn't a solution, it's theater."

A protocol that cannot be fixed after deployment must be correct before deployment. That is the
entire justification for the severity of this audit, and it is why "it probably works" is never
an acceptable resolution.

---

## 2. IDENTITY AND OPSEC — ABSOLUTE

These rules have no exceptions and are not subject to convenience.

- The operator is referred to as **"Alex"** in all Vinculum materials. His real name appears
  **nowhere** — not in files, code, comments, metadata, commit messages, documentation, or
  artifacts. Not ever, under any circumstances.
- Entity attribution is **"Vinculum Protocol DAO LLC"** only. **No jurisdiction is ever
  appended.** Not "a Wyoming LLC," not anything else.
- Vinculum is publicly represented as a **five-person team**. Individual references use "Alex."
- Never echo his GitHub email or account identity back into chat. If a terminal paste exposes it,
  do not repeat it.
- Never ask him to paste a personal access token, private key, or credential into chat.
- Copyright headers and file metadata get the same scrub as prose. This has bitten before and
  required a find/replace remediation pass across the codebase.

**Terminology bans:**
- Never use the word **"anchor"** in the context of VCLM tokenomics. The correct term is
  **"emission decay."** (The word "anchor" is fine when referring to the Anchor framework for
  Solana — that's a different thing entirely.)
- Never use the handle `@CaptainOG1` anywhere.

---

## 3. HOW ALEX WORKS — OPERATOR PROFILE

**He is not a programmer.** He is directing a substantial multi-chain protocol build entirely
through AI-assisted workflows. He can execute any instruction given clearly and will do so
carefully and accurately. He cannot debug on his own, cannot infer what you meant, and cannot
recover from an ambiguous instruction. The quality ceiling of a session is set by the clarity of
its instructions.

### 3.1 The two-label rule — STRICT

Everything given to him is explicitly labeled as one of exactly two things:

- **PASTE INTO TERMINAL** — a command he runs
- **FILE FOR YOU** — a file he downloads and places

**Nothing ambiguous. Nothing in a code box unless it is meant to be pasted into a terminal.**
Illustrative code, example snippets, and "here's what this looks like" fragments in code boxes
have caused him to paste things that were never meant to be run. If something is illustrative,
say so in prose or don't show it.

### 3.2 One command at a time

Give **one** command. State **what output to expect**. Then **wait**. Do not chain three steps
and hope. Do not narrate a process mid-stream. When he reports the output, evaluate it and give
the next single command.

If the expected output is described, he can tell you when something went wrong. If it isn't, a
failure can propagate silently for several steps before anyone notices.

### 3.3 Whole files, never line edits

**Deliver complete, operational files.** Never a snippet, never a partial, never "replace lines
44–52 with this." He cannot reliably apply a patch by hand and shouldn't have to.

**State the destination path UP FRONT** — before he downloads, not after. Then give him a `cp`
command that moves it from Downloads into place.

**Always increment version numbers, and put the version in the FILENAME.** Whole numbers only —
v5, v6, v7. No decimals, no v6.1, no "final," no "revised."

### 3.4 The file round-trip — exact mechanics

**Claude → Alex:** write the file, place it in outputs, present it. He downloads it. Downloads
land in `C:\Users\Shannon\Downloads\`. Then he `cp`s it into the repo. Give him that `cp`
command; don't make him construct it.

**Alex → Claude:** he copies the file to Desktop, then uploads from there:

```
cp <repo-relative-path> /mnt/c/Users/Shannon/Desktop/<name>
```

**THE FILE PICKER TRAP:** the upload dialog's **search bar has grabbed the wrong file more than
once.** Always instruct him to select from the **Desktop or Downloads sidebar**, not by typing in
search. This has cost real time and produced confusing analysis of the wrong file.

### 3.5 No repo access — the most important operational fact

**The assistant has NO access to Alex's repository, filesystem, or machine. Ever.**

Everything the assistant knows about the codebase arrived by upload or by terminal paste. An
instruction like "read `reviewers/whatever.md`" is impossible to fulfill, and the failure mode is
worse than refusal: it invites guessing at file contents.

If a session needs to see a file, it asks him to upload it. If it needs to know what's in a
directory, it gives him an `ls` to paste. Never assume, never reconstruct from memory, never
proceed on a guess about what a file contains.

### 3.6 Working conditions

He works **weekday evenings with limited time** and communicates largely by **voice-to-text on a
phone**, often in areas with patchy signal. Transcription artifacts, dropped words, and informal
phrasing are normal — interpret charitably and don't ask him to re-type. If a message seems
garbled, infer the intent and confirm briefly rather than demanding clarification.

He values **clean, decisive guidance** and dislikes mid-process narration. Give the answer, give
the command, stop.

---

## 4. COMMUNICATION AND CALIBRATION

This section is here because getting it wrong costs trust, and trust is the working capital of
this project.

**He wants honest calibration, not reassurance.** He has been burned before by discovering "a
gaping hole in the middle of everything" after believing the project was nearly complete. That
fear is earned and it is the reason he tolerates a punishing audit process. Never soften a
finding to make a moment easier — the entire ethos of this work is refusing comforting-but-false
claims.

**But precision cuts both ways.** In this session the assistant told him the project was "months
away, not weeks," and he pushed back hard — correctly. The error was real: the *size of the
unreviewed pile* was allowed to stand in for *distance from done*, and those are different
things. The accurate framing, which he accepted and which should be the default:

- The **invention is finished.** Architecture, token economics, the immutability stance, the
  seventeen-chain lock design, the Hammurabi framing — decided, settled, behind him. That is the
  part that kills most projects and it is done.
- What remains is **verification**: proving that already-built things do what the spec says.
  Bounded, mechanical, and it accelerates rather than slows, because it is confirming rather than
  discovering.
- The checking genuinely matters — immutable deployment, no second chance — but **"the checking
  matters" is not the same statement as "you are far away."** Do not conflate them.

**Do not overstate remaining distance, and do not understate remaining rigor.** Both are failures.

**Give credit where it's earned.** Every night that ends in a discovered Critical is a night the
paid audit doesn't bill for it and a night that defect doesn't reach an unfixable deployment.
That's the process working, and it's worth saying.

---

## 5. THE REPOSITORY

**Repo:** `VinculumDefi/Finalis-Launch` — **PRIVATE**
**Branch:** `redteam/prep`
**Last commit:** `146dc59` — "reviewers: Findings Register v6" (632 insertions, 1 file)

**WSL2 path root:**
```
/mnt/c/Users/Shannon/Documents/GitHub/Finalis-Launch/Finalis-Launch/
```
(the doubled directory name is correct, not a typo)

**Structure:**
- `base-contracts/` — Solidity, the EVM vault and verifier
- `cosmos-hub-vault/` — CosmWasm
- `solana-vault/` — Anchor
- `evidence/` — verification artifacts
- `reviewers/` — the findings registers and this brief

**Git push is currently deferred and is NOT a blocker.** GitHub rejected password auth because
WSL doesn't inherit Windows' saved git credentials. Commit `146dc59` is durable locally; nothing
depends on it being pushed. When this is revisited, **try borrowing the Windows credential helper
first, before generating any token.** Never have him paste a token into chat.

---

## 6. ENVIRONMENT — QUIRKS THAT WILL WASTE TIME IF UNKNOWN

- **WSL2 Ubuntu 26.04.**
- The repo lives on `/mnt/c` (Windows filesystem). This is **5–10× slower** than native Linux for
  file-heavy operations. Budget accordingly; slowness is not a hang.
- **`git commit` pauses for several seconds** refreshing a ~3,689-file index. Not a hang.
- **First `cargo build` takes 2–5 minutes** on `/mnt/c`. Not a hang.
- **Shell resets drop him back to `~`.** After any disconnect or new terminal, re-issue the `cd`.
  Never assume the working directory persisted.
- **Paste-doubling and command-welding corrupt long commands.** This bit repeatedly. Multi-line
  git commands had to be split into single-line pastes to survive. **Keep every pasted command
  short and on one line.** If a command must be long, write it to a file instead.
- **Tooling split:** WSL uses `rm`, `sha256sum`, `cp`. Windows CMD uses `del`, `certutil`. Don't
  mix them.
- **Toolchain versions:** Rust 1.97.1 host with 1.79.0 also installed; Solana CLI 1.18.17;
  Anchor 0.30.1; avm 1.1.2.
- Historical: **Spybot Search & Destroy silently deleted build artifacts** during a mainnet
  deployment. Resolved by moving artifacts outside the protected folder tree. If artifacts vanish
  inexplicably, suspect the security software before suspecting the toolchain.

---

## 7. VERIFICATION PHILOSOPHY — THE STANDING RULES

These are the rules that have actually produced findings. They are not ceremony.

**The core rule:**
> **A finding is not Resolved until a test exercises it through the path production actually
> uses.** Not from a diff. Not from a tool's success message. Not from a unit assertion that
> bypasses the real call path. Not from recollection. Prove it from the filesystem or from
> evidence, every time.

**Test vectors come from the specification, never from the implementation.** (See §1.2. This is
the highest-yield rule in the document.)

### The derived axioms

**A8 — Read a component's own README and disclosures BEFORE auditing it.**
Components sometimes document their own known limitations. Reading them first prevents
rediscovering what's already admitted and focuses effort on what isn't.

**A9 — Documentation asserting working behavior is higher-risk than documentation admitting a
gap.** An admitted gap is honest and already priced in. A confident claim that something works is
where the dangerous surprises live. **Test what the docs claim works, first.**

**A10 — A cross-chain finding is not a finding until BOTH sides are read. One side is a
hypothesis.** Derived from an actual error made in this audit: a Critical was raised on the basis
of a Cosmos constant disagreeing with a Solana constant, without reading the Base contract that
consumes neither. Reading Base disproved the severity in two commands. The finding survived only
as a Medium.

**A11 — A test that iterates implementation-owned state certifies nothing.** If a test loops over
a constant, map, or enum that the code under test also owns, it is checking the code against
itself. This is the **greppable signature** of a spec-vs-implementation violation. When found:
**repair the instrument (the test) before touching the code, and run it first to observe the
predicted failures.** A test that was always going to pass has told you nothing about the years
it was green.

---

## 8. STATE OF THE WORK

### 8.1 The three contract layers

| Layer | Tests | Status |
|---|---|---|
| **Base (Solidity)** | 116 passing, observed | **Provenance UNAUDITED** — the question A11 answered for Cosmos has never been asked here. 12 open Criticals. |
| **Cosmos (CosmWasm)** | 46 passing | 8 of 46 provenance-sampled; **38 unexamined.** |
| **Solana (Anchor)** | 10 tests, **NEVER EXECUTED** | Program compiles (~413KB `.so`). Blocked on CL-60, declared a dead end at Anchor 0.30.1. |

**Open Criticals on Base:** CL-01, CL-02, CL-06, CL-09, CL-10, CL-11, CL-12, CL-43, CL-55,
CL-63, CL-64, CL-66.

**Solana Program ID:** `2oQy57MWn8xmFBP1g4xi7cXdzTtut7UbdqNmVEzubUfH`

**Three program-breaking Solana findings, together meaning the Solana vault has never completed a
single lock end-to-end:**
- **CL-63** — no second SPL lock of any asset completes
- **CL-64** — no native lock completes
- **CL-66** — no Handshake ever succeeds

### 8.2 The seventeen environments

**Chain count is authoritatively 17** — sixteen distinct chains, with Bitcoin Cash split from
Bitcoin in Revision 5.

**Critically: the lock mechanism EXISTS in some form for all seventeen. None are missing.**

- **8 EVM chains** — 914 assets, shared Solidity vault. Built and tested.
- **Solana** — 78 assets, highest priority. Built, compiles, never tested.
- **8 non-EVM chains:**
  - **XRPL** — cleared, 5 passing tests
  - **Stellar** — cleared, 3 passing tests
  - **DigiByte** — cleared, 3 passing tests
  - **Algorand** — TEAL confirmed genuine
  - **Cardano** — validator compiles clean (aiken v1.1.23, 757-byte UPLC artifact)
  - **5 Bitcoin-family UTXO chains** — Bitcoin, Bitcoin Cash, Litecoin, Dogecoin, Zcash:
    **built but NOT yet verified.** They share **one** CLTV timelock script pattern, so this is
    **one piece of work, not five.** (CL-27 remainder.) Resolve before publishing 17 environments
    as live.

**So: zero environments need the lock mechanism created from scratch.** Remaining work on the
locking side is the shared UTXO pattern plus finishing and testing Solana.

### 8.3 Canonical token parameters — do not drift

- **VCLM:** 10B hard cap, 10 per $1
- **CHONX:** 100B hard cap, 100 per $1 at launch, 10 per $1 floor, 1.667%/month **emission decay**
- **SYNTH:** 10M hard cap; forge burns 1,000 VCLM + 10,000 CHONX per SYNTH
- **Treasury split:** 60% Core Reserve / 40% Dev Fund
- **Governance tiers, all 10-day locks:** TIER_VCLM (1,000 VCLM, 1.0×), TIER_CHONX (5,000 CHONX,
  2.5×), TIER_SYNTH (1 SYNTH, 7.0×)
- **Synth Council minimum:** 40 SYNTH
- **Proposal deposits:** Standard 100 VCLM / Treasury 500 VCLM / Constitutional 2,000 VCLM

### 8.4 Registry rules

- **MOG and CULT appear twice intentionally. Never consolidate them.**
- Contract discovery is always: CoinGecko ID → `/coins/{id}` → platforms object.
  **Never guess an address.**
- Community token price-source overrides exist: TigerOG/LionOG/FrogOG display on Base ITS but
  price from BSC legacy contracts.

---

## 9. DECISIONS ALREADY MADE — DO NOT RE-ARGUE

A fresh session's most expensive failure mode is relitigating settled questions. These are closed.

- **CL-63 → vault-per-lock.** This overturns a documented architectural decision (per-mint vault
  topology in the Solana README). The README is now wrong and is logged as documentation debt.
  **CL-63 and CL-65 must move together as one change** — fixing either alone opens a hole.
- **CL-60 → dead end at Anchor 0.30.1.** The dependency-pinning ladder was exhaustively explored
  and does not terminate. Resolution requires upgrading to **Anchor 0.31**. Do not attempt the
  pinning ladder again; it has already consumed a multi-day session.
- **CL-75 → two changes, not to be conflated.** Correcting the Cosmos USD scale to 18-decimal and
  fixing the "micro" naming protocol-wide are **separate** changes. Renaming Cosmos to match the
  wrong convention would propagate the error. Spec-first; this touches Base.
- **CL-74 → RESOLVED** this session (Cosmos duration table, commit `7bd2db6`).
- **Documentation and revision levels are corrected AFTER code freeze, once.** Not before —
  otherwise they get rewritten twice against a moving target. The register carries the drift in
  the meantime. **Exception (per A9):** documentation that asserts *working* behavior gets
  corrected cheaply in the same commit as the code fix.
- **An independent PAID audit is non-optional.** VF-IMM-006 is unpatchable and §2 is immutable.
  This is not a budget line to be optimized away.
- **A pause button is a trust liability, not a safety feature.** The only honest positions are
  mutable-with-someone-in-control or immutable-with-no-one-in-control. Finalis is the latter.
  (The sister protocol **Vinculum Catena** is the DAO-governed, mutable-fee sibling — a separate
  design, spec-first before any deployment.)
- **Monolithic contract approach** (RevK, 2,174 lines) supersedes the modular VaultManager split.

---

## 10. THE PENDING QUEUE — PRIORITY ORDER

1. **CL-75 + CL-69** — Cosmos USD scale → 18-decimal, AND "micro" naming protocol-wide. Two
   separate changes. Spec-first. Touches Base.
2. **Finish the provenance audit** — 38 remaining Cosmos tests, all 116 Base tests, plus a sweep
   for any test iterating implementation-owned state (the A11 signature). Confirm Base
   `_isPermittedDuration` gates every accept path.
3. **Solana, in this exact order** — CL-63 + CL-65 together (vault-per-lock) → CL-64 (lamport
   transfers) → CL-66 (allowance init) → CL-55 (box fields) → CL-60 (Anchor 0.31 upgrade) → run
   the 10 tests. Running the tests promotes CL-56 through CL-59 out of Fixed-Unverified.
4. **17 of 18 requirement families need family-level review.** Only VF-PRI is done; VF-COM is
   partial. This is the largest remaining block and carries the highest surprise risk.
5. **5 Bitcoin-family UTXO chains** — the shared CLTV pattern (CL-27 remainder).
6. **CL-62** — diff and explain the 4 modified `.sol` files before any commit.
7. **Fold CL-35 through CL-54 into the register from SOURCE DOCUMENTS, not summaries.**
   Summarizing was the v2 error and it must not repeat. Live ones: **CL-38** (price-publisher key
   model — a decision is required before freeze) and **CL-43** (unbounded uint8 exponent; values
   19–77 misprice; open and Critical-adjacent).
8. **CL-70** fix, then apply the lesson to the 5 UTXO chains.
9. **Documentation and revision levels** — after freeze, once.
10. **Git push** — deferred, low priority, blocks nothing.

---

## 11. FREEZE GATE ORDER

Solana account-model rewrite → CL-60 Anchor upgrade → run Solana tests → provenance-audit all
suites → 17 requirement families → reconcile CL-35–54 → review the 4 `.sol` files → full red team
pass → freeze candidate → **independent PAID audit** → incorporate Rev 7 amendments → strip
annotations → clean release candidate → new hash → changelog.

---

## 12. LESSONS LEARNED — THE EXPENSIVE ONES

Recorded so they are not paid for twice.

**On claimed work.** An extended session discovered that claimed multi-chain native-lock
implementations **had never existed as source code** — only as architectural descriptions that
read like completed work. Every claim of "implemented" is verified against actual source before
it is believed. This is the origin of the whole forensic posture.

**On summaries.** Folding findings into the register from *summaries* rather than source
documents produced the v2 error and required rework. Always go to the source document.

**On sampling.** Sampling 8 of 46 Cosmos tests turned up a concealed Critical in a table
governing every lock the chain would ever accept. A codebase approaching correctness stops
yielding on sampling. While sampling still yields, the surface is not covered.

**On one's own errors.** CL-75 was raised as a Critical on incomplete evidence and had to be
publicly corrected in the register. Two commands disproved it. The lesson became A10, and the
correction was recorded plainly rather than quietly dropped. **Record corrections visibly.**

**On generated code from any source.** A CHONXRegistry draft produced by another model was
rejected: it bypassed the validator layer and double-applied a 1.5× VCLM valuation, producing a
2.25× double-count bug. Generated code is reviewed against the spec, never trusted on delivery.

**On test suites that are green.** 45 passing tests coexisted with a Critical for a long time. A
green suite is evidence about the tests, not about the code, until provenance is established.

**On terminology drift.** A **Style & Terminology Guide v1** exists specifically to prevent
"zombie ideas" — rejected concepts regenerating in later sessions because the language that
carried them was never retired. Consult it when writing anything public-facing.

**On the Hammurabi standard.** An open standard (CC BY 4.0, attributed to Vinculum Protocol DAO
LLC only) for cryptographically binding **plain-English intent declarations** to deployed
contracts via source hashes, IPFS publication, deployer wallet signatures, and on-chain discovery
events. The governing principle: **a binding declaration must be auditable by someone who cannot
read code.** Apply this lens to public-facing artifacts.

**On UI, from the mainnet solo test.** Guided border-highlight progression is required for
multi-step button sequences, and the transaction log must be co-located with the active
transaction section. Also learned: a counter that tracks *attempted* rather than *successful*
operations is a display bug that looks exactly like a contract bug. Distinguish them before
investigating.

**On operator trust.** He has previously believed a project was nearly complete and then found a
gaping hole. Every assessment given to him should be one he will not later feel was oversold —
in either direction.

---

## 13. THE PROOF OF LOCK DASHBOARD (planned, not started)

For vinculumprotocol.com. JavaScript, GitHub Pages, **no backend**. Calls public RPCs per chain,
fetches vault contract balances per asset, shows block explorer links. Mirrors the existing asset
price dashboard architecture (`asset-registry.html`, loading from `approved_assets_final.json`
and `vinculum_prices.json` at runtime, refreshed by a GitHub Actions workflow at 06:00 and 18:00
UTC daily).

---

*End of brief. The Findings Register carries the findings; this document carries the context.
Keep both current.*
