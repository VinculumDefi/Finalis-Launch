# Product Architecture Index

**Version:** 1
**Status:** Proposed for acceptance
**Phase:** Product Design
**Governing specification:** Master Specification Revision 6, hash
`5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9`

> **Synthesis document. It governs nothing.** It describes the accepted product
> baseline, states how its artifacts relate, and orients future contributors.
> It creates no protocol requirement and no product decision. Where this Index
> conflicts with an accepted artifact, **the accepted artifact prevails and
> this Index is defective.**

---

## Why this document exists

The protocol engineering phase has concluded. The product design phase has
begun. A contributor arriving now faces four accepted artifacts of different
authority, written at different times, in different registers, each referring
to the others.

Without an entry point, that contributor does one of two things: reads the
Master Specification and starts designing protocol behaviour that was settled
months ago, or reads a Presentation Map and mistakes a `[DESIGN]` judgement for
a specification requirement.

**This Index prevents both.** Read it first. It is the only document in the
product phase that is *about* the other documents.

---

# 1 · The accepted baseline

Exactly four artifacts. Nothing else carries product authority.

| # | Artifact | Kind | Authority |
|---|---|---|---|
| 1 | Master Specification Revision 6 | Governing | **Absolute.** Defines protocol behaviour. |
| 2 | Presentation Map A v2 — Commitment Lifecycle | Derived | Descriptive. Maps specification to experience. |
| 3 | Presentation Map B v1 — Participation Lifecycle | Derived | Descriptive. Maps specification to experience. |
| 4 | Product Design Charter v1.0 | Decisional | Governs *product* decisions only. |

## 1.1 Master Specification Revision 6

**Purpose.** Defines what Vinculum is and what it must do.

**Authority.** Governing. Every product artifact derives from it. No product
artifact may modify, extend, soften, or reinterpret it.

**Structure.** Sections 0–19 plus Appendices A–D. Section 0 states the
specification's own authority and revision discipline. Appendix C is the
complete Approved Asset Registry. Appendix D is revision control.

**Verify before use.** Version numbers and file names change. The hash does
not:

```
sha256sum Vinculum_Finalis_Master_Specification_Revision_6_2026-07-28.docx
```

Expected: `5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9`

A file that does not produce this hash is not the governing specification,
whatever it is named. Both Presentation Maps declare derivation from this hash;
if it changes, their derivation must be re-established before they can be
relied on.

**What it does not do.** It does not describe pages, workflows, screens, or
copy. It states behaviour and requirements. Turning that into an experience is
the product phase's work, not the specification's.

## 1.2 Presentation Map A v2 — Commitment Lifecycle

**Purpose.** Maps the §3.2 end-to-end Commitment Vault Lock flow onto what a
participant sees, does, and can verify.

**Authority.** Descriptive, not governing. It states in its own header that it
defines no protocol behaviour. Its `[SPEC]` citations carry the
specification's authority; its `[DESIGN]` content is ordinary product judgement
and may be changed by ordinary product decision.

**Coverage.** Eight steps — Selection · Preflight · Source transaction ·
Finality · Proof · Base verification · Issuance · Maturity and release.

**Eight cross-cutting overlays**, each a specification obligation that spans
multiple steps and belongs to no single one:

| Overlay | Subject | Specification source |
|---|---|---|
| O1 | Absence of control | §2, §15 |
| O2 | Fail-closed behaviour | §14 |
| O3 | Verification and traceability | §16 |
| O4 | Supply accounting and activation gates | §13 |
| O5 | Handshake allowance lifecycle | §5.2 |
| O6 | Pending attempt disposition | §5.2.3 |
| O7 | Price reference lifecycle | §7 |
| O8 | Deployment completeness | VF-EXT-002, VF-EXT-003 |

**Structural property that must be preserved.** §3.2 enumerates its steps
explicitly. **Map A's step order is specification-stated, not a product
choice.** It cannot be reordered by product design.

**Version discipline worth imitating.** Map A v2 records the four
classification errors it corrected from v1 in a visible table rather than
fixing them silently. Three requirements had been marked `[SPEC]` that were
actually Revision 7 candidates. Future artifacts should correct themselves the
same way.

## 1.3 Presentation Map B v1 — Participation Lifecycle

**Purpose.** Maps §10 Treasury Reward Stake and the post-issuance capabilities
onto participant experience. Begins where Map A's Step 7 leaves a participant:
holding an issued token.

**Authority.** Descriptive, not governing. Same marking discipline as Map A.

**Coverage.** Seven stages — Holding · Position creation · Earning across
epochs · Epoch finalization and allocation · Claiming · Extension ·
Withdrawal.

**Three additional overlays**, on top of O1–O4 which it inherits from Map A
unchanged:

| Overlay | Subject | Specification source |
|---|---|---|
| P1 | Epoch timing integrity | §10.2 |
| P2 | Rounding and inaccessible remainder | §10.6 |
| P3 | Terminal state | §10.6 |

**Structural property that must be preserved — this is the difference between
the two maps and it must not be lost.**

§10 is six topical subsections. **It does not state a participant sequence.**
Map B's stage ordering is therefore a `[DESIGN]` derivation from requirement
dependencies, while every requirement it cites is `[SPEC]`.

> **Map A's order is specification. Map B's order is derivation.**

Where the specification does fix order within §10, Map B marks it: VF-STK-010
requires epochs be finalized chronologically; VF-STK-013 fixes an entitlement
only after the scheduled end of the following epoch. Those are `[SPEC]`. The
arrangement around them is not.

A contributor who treats Map B's stage numbering as specification-mandated has
misread it.

## 1.4 Product Design Charter v1.0

**Purpose.** Defines how every product decision shall be made.

**Authority.** Governing **for product decisions only**. It cannot modify the
Master Specification and states so explicitly.

**North Star.**

> The product succeeds when a participant no longer relies on the application
> to tell them the protocol is working, because they have learned how to
> verify it themselves.

**Design acceptance test.** Every page, workflow, dashboard, visualization,
document, educational experience and feature is evaluated by one question:

> Does this help the participant become more capable of understanding and
> independently verifying the protocol?

If the answer is no, it does not belong.

**Eight design principles.** The protocol informs, the participant decides ·
Teach before asking for action · Replace uncertainty with evidence · Build
confidence through verification · Make complexity understandable, not
invisible · Preserve participant responsibility · Tell the truth about
limitations · Stay faithful to the protocol.

**Revision policy.** The Charter should evolve rarely. Revision requires
evidence that a principle no longer faithfully supports the Master
Specification, the accepted Presentation Maps, or the participant experience
they define.

---

# 2 · Recorded editorial corrections

Two statements in the accepted baseline are known to be inaccurate. They are
recorded here rather than silently amended, and are corrected by this Index
without any change to the artifacts themselves.

| Location | Statement | Correction |
|---|---|---|
| Charter §Origins | Implies the Product Architecture Index had already been accepted when the Charter was written | **Editorial error.** The Index did not exist. This document, version 1, is its first version. |
| Charter §Origins, §Relationship to Other Artifacts | Lists a "Product Information Architecture" as an accepted artifact | **Not a baseline.** It was an intermediate working artifact used during derivation of the Presentation Maps. It is not a standalone accepted document and no separate version should be expected or sought. |
| Map B, Stage 1 Surface line | "Market disclosures (Domain 10)" | The **surface** is authoritative; the **"Domain 10"** label is a dangling reference to the intermediate artifact's numbering and carries no authority. Do not reconstruct a domain scheme from it. |

**Governing rule for anything traceable to the intermediate artifact:** where a
concept originated there and is now represented in an accepted Presentation
Map, **the Presentation Map is the authoritative source.** Where it is not
represented in an accepted Map, it is not part of the baseline and must be
re-derived from the Master Specification if it is needed.

---

# 3 · How the artifacts relate

## 3.1 Artifact relationships

```
        MASTER SPECIFICATION REVISION 6
        governing · defines protocol behaviour
                        │
          derivation    │    (never the reverse)
                        ▼
    ┌───────────────────┴───────────────────┐
    │                                       │
PRESENTATION MAP A v2              PRESENTATION MAP B v1
Commitment Lifecycle               Participation Lifecycle
§3.2 · order is [SPEC]             §10 · order is [DESIGN]
    │                                       │
    └───────────────────┬───────────────────┘
                        │
                        ▼
            PRODUCT DESIGN CHARTER v1.0
            governs how product decisions are made
                        │
                        ▼
              ALL FUTURE PRODUCT WORK
```

**The ladder is one-directional.** A product decision never travels upward. No
Charter principle, no Map `[DESIGN]` judgement, and nothing in this Index may
become a protocol requirement.

## 3.2 The seams between the two maps

The maps meet at two distinct points. Both matter, and they are not the same
point.

**Seam 1 — issuance to holding.** Map A Step 7 issues exactly one output token
to the bound Base recipient. Map B Stage 1 begins with the participant holding
it. Clean handoff.

**Seam 2 — Reward-Accounting Credit to Epoch Reward Basis.** §9's
Reward-Accounting Credit is created **at fee verification, independently of
issuance** (VF-FEE-011, VF-RAC-002). It therefore belongs to Map A Step 7, not
to Map B. But the Epoch Reward Basis it produces is Map B Stage 3's input.

**Consequence for product design:** RAC is a participant-visible state that can
exist where issuance does not — at zero VCLM capacity, fees still reach the Dev
Fund and no RAC is recorded (VF-SUP-012). It cannot be presented as a
subordinate detail of issuance. Map A v2 corrected exactly this error from v1.

**What is not a seam.** Map A Step 8 — maturity and principal release — runs
entirely on the source chain and does not enter Map B at all. §12 is explicit
that principal remains releasable even where Base verification failed
permanently and no token was ever issued. **A participant can complete Map A
Step 8 having never reached Map B.** Any product surface that couples them
misrepresents the protocol.

## 3.3 One story told across both maps

Map B records that **permissionless epoch finalization (VF-STK-008) and
permissionless proof submission (VF-XCH-012) express the same principle**:
anyone may act, and no actor gains authority by acting. Map A's overlay O1
states the same absence of control from the immutability side.

This is a single narrative appearing at three points in two maps. It should
read as one story to the participant, not three coincidences.

---

# 4 · Reading order for future contributors

`[DESIGN]` — this ordering is a product decision recorded here, not a
specification requirement.

| # | Read | Why here |
|---|---|---|
| 1 | **This Index** | Orientation and authority. Prevents the two failure modes named at the top. |
| 2 | **Product Design Charter v1.0** | Short. Establishes what the product is *for* before any mechanism is encountered. |
| 3 | **Master Specification §0–§3** | Authority and revision discipline, protocol identity, immutable control model, end-to-end flow and separation of mechanisms. Verify the hash first. |
| 4 | **Presentation Map A v2** | In full, including the corrections table. The corrections teach the marking discipline better than the definitions do. |
| 5 | **Presentation Map B v1** | In full. Read its structural caveat before its stages. |
| 6 | **Master Specification, remainder** | As reference, by section, following the citations the maps make. |

**Do not read the specification cover to cover before the maps.** It is a
requirements document of nineteen sections and four appendices. The maps exist
so that a product contributor encounters it through the questions a participant
actually has.

---

# 5 · The marking discipline

Both maps use four markings. All future product artifacts shall continue them.

| Marking | Meaning | May product design change it? |
|---|---|---|
| `[SPEC]` | Stated in Master Specification Revision 6 | **No.** |
| `[REV7]` | Proposed in `REVISION_7_CANDIDATE_AMENDMENTS.md` | Not governing. Recorded so work anticipates it. **Never treated as binding.** |
| `[DESIGN]` | A product decision | Yes. Ours to make and change. |
| `[OPEN]` | A product decision deliberately not yet made | Yes, by making it. |

**The prohibition runs both ways.** Nothing marked `[SPEC]` may be altered by
product design. Nothing marked `[DESIGN]`, `[OPEN]` or `[REV7]` may be
presented to anyone — participant, reviewer, or contributor — as a
specification requirement.

## 5.1 Recorded `[REV7]` items

`REVISION_7_CANDIDATE_AMENDMENTS.md` **is not a baseline artifact.** These
items are recorded so that product work anticipates them and does not
accidentally foreclose them. None is binding.

| Item | Proposes | Appears in |
|---|---|---|
| VF-ORC-015 | 48-hour price validity bound from the publication timestamp inside the signed record | Map A, O7 |
| VF-ORC-016 | Disclosure of signing-key risk under VF-EXT-002 | Map A, O7 and open decision 6 |
| VF-FEE-013 | Dev Fund destination as a source-environment-native address | Map A, Step 3 |
| Rev 7 Appendix A2 | Solidity as production target with a JavaScript layer driving live preview | Map A, Groupings |

Map A v2 exists in part because three of these were wrongly marked `[SPEC]` in
v1. That is the specific error the `[REV7]` marking now prevents.

---

# 6 · Consolidated open product decisions

Thirteen, carried forward unchanged. Map A numbered 1–7; Map B continued at 8.
**Future decisions continue this single sequence.**

| # | Decision | Affects | Source | Status |
|---|---|---|---|---|
| 1 | The application's role in proof construction | Step 5 | Map A | **RECLASSIFIED** — implementation/UX, governed by decision 2; see §6.2 |
| 2 | ~~Whether optional notifications are offered~~ | Step 8 convenience only | Map A | **CLOSED** — see 6.2 |
| 3 | ~~Which audience the home page primarily serves~~ | Home page | Map A | **CLOSED** — see 6.2 |
| 4 | How much the trust cluster explains versus asserts | Public pages | Map A |
| 5 | Whether and how §16 traceability is published | Verification surface | Map A |
| 6 | Whether signing-key risk is publicly disclosed, and where | Governed by VF-EXT-002; anticipated by `[REV7]` VF-ORC-016 | Map A |
| 7 | Presentation basis for post-issuance capabilities | §9, §10, SYNTH Forge, §4.3, §11.4 | Map A |
| 8 | Whether the application offers epoch finalization or only observes it | Stage 4 | Map B |
| 9 | How the one-epoch-behind eligibility rule is made comprehensible | Stage 3 — **highest misunderstanding risk in the protocol** | Map B |
| 10 | How the extension gap rule is communicated before maturity | Stage 6 — irreversible consequence | Map B |
| 11 | Whether the SYNTH Forge is framed as a conversion or a milestone | Stage 1 | Map B |
| 12 | How the inaccessible rounding remainder is disclosed | Overlay P2 | Map B |
| 13 | Whether terminal state is presented before it is reached | Overlay P3 | Map B |

## 6.2 Closed product decisions

**This section is the canonical record of closure.** Downstream artifacts point
here rather than restating a resolution. A decision is closed only by an
operator decision recorded here, never by a derivation.

### Decision 2 — CLOSED · Workspace philosophy

**Resolution.** The Application remains **intentionally thin**. It exists only
to support participant-specific information, successful protocol participation,
participant understanding, participant verification, and prevention of genuine
operational mistakes. **It does not accumulate convenience features merely
because they are technically possible**, and becomes richer only where the
protocol genuinely requires additional participant functionality.

**Effect on the notification question.** A notification is a convenience feature
and is not adopted on that basis. The one admitted test is *prevention of
genuine operational mistakes* — which is the criterion any future proposal must
meet, not a standing permission.

**Governs decision 1, which is hereby reclassified.** Decision 1 asks what role
the application takes in proof construction. **It is no longer a major
architectural uncertainty.** The accepted philosophy answers the architectural
question: the Workspace contains only functionality **actually and defensibly
necessary** for successful protocol participation, participant understanding,
participant verification, or prevention of genuine operational mistakes.

Whether proof construction meets that test is an **implementation and UX
decision constrained by an accepted principle** — determined by operational
fact, not by architecture. It no longer blocks implementation and is no longer
counted among the blocking decisions.

**The same reclassification applies to every future question about individual
Workspace capabilities.** They are governed by this principle rather than
escalated to architecture.

### Decision 3 — CLOSED · Home page primary audience

**Resolution.** The primary audience is the **Intelligent Newcomer** — a
thoughtful person curious enough to understand before acting. The home page
assumes neither deep blockchain expertise nor complete unfamiliarity. **It
teaches before asking for action and does not optimise for speculation,
urgency, or immediate conversion.**

**All six audiences remain fully supported.** The Intelligent Newcomer
establishes tone, pacing and depth — not exclusivity of service.

### Product naming

**Internal architectural term: Application. Participant-facing name:
Workspace.**

A product naming decision only. **Protocol terminology is unchanged** —
Appendix B of the Master Specification holds the canonical terms, and
"Workspace" never describes protocol behaviour.

### Canonical explanation — the eligibility rule

The two-epoch eligibility rule accumulated restatements across seven locations
in six artifacts. **Canonical sources are hereby designated:**

- **The rule itself** — Presentation Map B, Stage 3. `[SPEC]`, accepted, frozen.
- **Its product treatment** — Product Surface Architecture, S13.

**Downstream artifacts point to these rather than restating the rule in full.**
Restatement is retained only where a reader of that surface needs the rule in
front of them — Participation Rules Reference and the Workspace position
surface. **Clarity is not reduced; duplication is.**

### §17 resolutions — decisions 14, 15, 16, 17, 18, 19, 20, 21, CLOSED

Closed together because they interlock on one question: how §17's permissions
and scope are read. **The governing standard is the Charter as accepted — tell
the truth, teach before asking for action, replace uncertainty with
understanding. No stricter standard is created here.**

**14 · The specification and its hash are published.** PRC-01 preserves the
human-readable specification; Charter principle 4 requires that a participant be
able to verify rather than trust. **A preserved copy nobody can reach verifies
nothing.** The hash is published alongside it, because the hash is what makes
the copy checkable. **Prominence is UX, not architecture.**

**15 · The registry display set is permissive-open.** §17.1 states a permission —
*may display* — not a closed enumeration, and **VF-PUB-001 is already sufficient
governance for anything additional**: every field must be accurate and
consistent with the current specification. Reading it as closed would forbid
displaying asset classification, which PRC-02 requires the machine-readable
registry to preserve and which aids understanding. **Inventing a restriction
§17 does not state is not caution; it is a defect.** The eight enumerated fields
are expressly authorised; further fields are permitted subject to VF-PUB-001,
and Price Source and Last Updated remain mandatory wherever price appears.

**16 · PRC-06's accuracy obligation is satisfied by presentation, not by
instruction.** Already resolved in substance at PRC-06: the commitment's own
figures are presented as the commitment's own figures. **No explanatory
apparatus about price-object distinctions is required on any participant-facing
surface.** Implementation guidance, not architecture.

**17 · No third-party market or venue data appears on public surfaces.** Venue
activity modifies no protocol calculation (VF-PUB-003). Displaying market data
would require continuous disambiguation from the protocol's own figures,
**adding confusion without adding understanding.** The protocol's independence
from market price is communicated once, factually, at the disclosures surface —
VF-RAC-005's permanent $0.10 reward reference is the concrete demonstration.

**18 · Listing intent is stated once, factually, and never again.** §17.2 makes
it a development objective. **Silence would conceal an intention that exists**,
which Charter principle 7 does not permit. It appears once at the disclosures
surface as an objective — **no timeline, no likelihood, no expectation, no
roadmap, and no repetition elsewhere.**

**Consequence for S05.** Decisions 17 and 18 together settle it: **S05 exists as
a distinct surface**, carrying the non-guarantees and the single listing
statement, and carrying no market data.

**19 · "Public" is resolved by applying the obligation uniformly.** Rather than
adjudicate whether VF-PUB-002 reaches behind wallet connection, **Price Source
and Last Updated accompany every price the product displays, in the Workspace as
on the website.** A participant deciding on a commitment needs that context more
than a browser does. This is two data elements beside a figure — **proportionate,
not a warning** — and it removes the ambiguity rather than ruling on it.

**20 · Economic promise, at the margin.** The test is whether a statement
asserts or implies a **future value outcome.** Specification-derived mechanics
do not: the emission schedule, a computed weight, a computed issuance amount,
cumulative issuance against capacity, and the fixed $0.10 reward reference are
all facts about how the protocol operates and **may be stated plainly.** What is
excluded is any projection, expectation, comparison, or historical price series
presented as indicative of what a participant will receive. **Editorial
guidance, not a new prohibition.**

**21 · The deployment manifest is published as a public surface.** PRC-03
requires it exist; the verifier and skeptic are first-class audiences; a manifest
reachable only by cloning a repository serves neither. **Form is
implementation.** Where an entry is unavailable, VF-EXT-002 already governs:
report it as incomplete rather than substitute a value.

**22 · Consistency review is governed, not architected.** VF-PUB-001 already
makes a specification revision a product event requiring review of every public
and machine-readable representation. **No further architectural treatment is
required**; recording the review is process.

### Decision 8 — RECLASSIFIED · epoch finalization

**Governed by decision 2, exactly as decision 1 is.** Finalization is
permissionless and an epoch finalizes regardless of who acts (VF-STK-008,
VF-STK-010). It is therefore **not necessary for successful protocol
participation** — the test the accepted thin-Application principle applies.
Whether the Workspace offers it is an **implementation and UX decision**, not an
architectural one. The epoch dashboard remains an observation surface either
way.

## 6.3 Status question on decision 7

Decision 7 asked for a presentation basis for §9, §10, the SYNTH Forge, §4.3
transferability and §11.4 portability. **Map B v1 subsequently supplied one for
all five** — §10 across Stages 2–7, the Forge and §4.3 and §11.4 within Stage
1, and §9's Epoch Reward Basis as Stage 3's input.

Decision 7 therefore **appears discharged by Map B**, but no closure was
recorded. This Index does not close it — closing an open decision is a product
decision, and this document makes none. **It is flagged for the operator's
determination.**

---

# 7 · Derivation gaps

Requirements the specification states, that no accepted Presentation Map
represents. Recorded because an omission that is not written down becomes an
omission nobody looks for.

## 7.1 §17 — Machine-Readable, Transfer, and Market Representations

**Neither map cites §17 or any VF-PUB requirement.** Confirmed by search of
both map files.

This matters more than its position in the specification suggests, because
**§17 contains the only requirements in the Master Specification that bind
product output directly.** Every other section constrains the protocol; §17
constrains the website, the public registry, and the price display.

| Requirement | Constrains |
|---|---|
| VF-PUB-001 | Every public and machine-readable representation must remain consistent with the current Master Specification |
| VF-PUB-002 | Public price displays must identify the selected source and last update time, without presenting the reference as a guaranteed trading price |
| VF-PUB-003 | Exchange or liquidity-venue activity cannot modify protocol calculations or supply accounting |

§17.1 further states that public website language derives from the current
specification and adds no economic promises or protocol features; that the
public registry may display Symbol, Name, Environment, Price, Price Source,
Last Updated, contract or native identity, and available pricing metadata; and
that website price data refreshes twice per day. §17.2 states that pursuit of
exchange listings is a development objective, not a promise of availability or
value.

**Why the gap is explicable and not a defect in the maps.** Both maps are
lifecycle maps. §17 is not a lifecycle — it is a standing constraint on
published output, closer in kind to an overlay than to a step.

**This Index does not fill the gap.** Deriving §17 into product form is future
work. It is named here so that no public surface is designed before its
governing requirements are on the table.

## 7.2 Evidence that is unavailable before deployment

Map A records which evidence claims depend on deployment. **No product surface
may promise a verification that cannot yet be performed.**

| Evidence | Available |
|---|---|
| Source-chain transactions, timelocks, finality | On use |
| Signed price records | On publication |
| Traceability matrix, test suites, evidence artifacts | Now |
| Registry immutability | **Post-deployment** |
| Contract code, absence of control | **Post-deployment** |
| Finalization transaction | **Post-deployment** |
| Lifetime issuance, capacity, activation | **Post-deployment** |
| Verification transactions | **Post-deployment** |

Overlay O8 governs how incompleteness is surfaced: VF-EXT-002 requires that an
unavailable external address or unfinished deliverable be **reported as
incomplete rather than replaced with an invented value or behaviour.** That is
a product obligation as much as an engineering one.

---

# 8 · What derives from this baseline

Future product work, and the artifact each derives from. **Nothing on this list
is designed yet.**

| Product domain | Derives principally from |
|---|---|
| Public website | Master Specification §17 (see gap 7.1) · Map A `[DESIGN]` groupings — trust cluster, onboarding · Charter principles 3, 5, 7 |
| Participant application — commitment | Map A Steps 1–8, overlays O1–O8 |
| Participant application — participation | Map B Stages 1–7, overlays P1–P3 |
| Dashboards | Map A `[DESIGN]` dashboard spine (§13) · Map B epoch and allocation surfaces |
| Documentation | Every `docs` surface named across both maps |
| Educational experiences | Charter principle 2 — teach before asking for action · Map A onboarding grouping (§5.2 Handshake) |
| Verification experiences | Map A overlay O3 · Charter principles 3 and 4 · open decision 5 |
| Supporting workflows | Both maps' `[DESIGN]` sections |

## 8.1 The surface classes both maps already use

Collated from the maps, not invented here. Every surface either map names falls
into one of five classes:

**public** · **app** · **dashboard** · **docs** · **developer**

Two surfaces carry an explicit obligation rather than a `[DESIGN]` freedom:
Map A Step 2's **non-refundable fee warning (required)** and Step 4's
**pending disposition (required behaviour)**. These are not presentation
choices.

## 8.2 The two hardest product problems, named in advance

Both maps identify the places where faithful presentation is hardest. They are
named here so they are not discovered late.

**The eligibility rule (open decision 9).** A position must be active at the
exact beginning of epoch N, remain continuously active through N, and remain
active through the scheduled end of N+1. Map B calls this the least intuitive
rule in the protocol and the most likely to be misunderstood. Combined with
VF-STK-025's prohibition on retroactively covering an inactivity gap, **a
participant can lose an already-earned entitlement by letting a position lapse
one day early.**

**The extension gap rule (open decision 10).** The consequence of not
extending is irreversible and arrives silently at maturity. Charter principle 7
— tell the truth about limitations — and principle 6 — preserve participant
responsibility — pull in the same direction here and neither permits the
product to quietly extend on the participant's behalf.

---

# 9 · The accepted baseline rule

**The four artifacts in Section 1 are settled. They are not reopened.**

Reopening requires one of exactly two things:

1. **New repository evidence** — a repository artifact demonstrating that an
   accepted artifact misstates what the specification requires; or
2. **A governing specification revision** — a Master Specification revision
   that changes what an accepted artifact derives from, evidenced by a changed
   hash.

**Not sufficient to reopen anything:** a preference; a fresh conversation
without the artifacts in hand; an aesthetic disagreement; an implementation
inconsistency; inability to locate an artifact. Inability to find something is
not evidence that it does not exist.

**Corollary — the specific failure this rule prevents.** Contributors who
reason from recollection rather than from artifacts rediscover finished work
and report it as missing. This happened repeatedly during the engineering
phase. It is the reason the product phase begins with an index rather than a
design.

## 9.1 What lies outside the product baseline

Present in the repository, carrying no product authority. Listed so it is not
mistaken for baseline on discovery.

| Artifact | Status in the product phase |
|---|---|
| `00_PROJECT_START_HERE.md` — Reviewer Startup Procedure | Engineering-phase orientation. Its working conventions remain sound practice; it is not product authority. |
| `Vinculum_Finalis_Architecture_Design.md` | Engineering artifact. Describes how the protocol is built, not how it is presented. |
| Findings Register · Component Implementation Inventory · Build Classification · Verifier Completion Standard · Requirement Traceability CSV | Engineering-phase authority. The traceability CSV remains the instrument that settles requirement ownership. |
| `REVISION_7_CANDIDATE_AMENDMENTS.md` | **Not governing.** Source of `[REV7]` markings only. |
| The intermediate Product Information Architecture | Working artifact from Map derivation. **Not a baseline. Not to be reconstructed.** Where its concepts survive, they survive inside the accepted Maps. |

---

# 10 · Independent review

Product architecture is independently reviewed. Every future major product
artifact should be written for a reviewer who has none of the conversational
history and only the repository.

That reviewer must be able to determine, for any statement in any product
artifact:

- which accepted artifact it derives from,
- whether it is `[SPEC]`, `[REV7]`, `[DESIGN]` or `[OPEN]`,
- and, where `[SPEC]`, which numbered requirement supports it.

A statement that cannot survive those three questions is not ready to be
committed.

---

# 11 · Revision policy for this Index

This Index is descriptive. It changes when the thing it describes changes.

**Revise when:** an accepted artifact is revised or added · an open decision is
closed · a derivation gap is filled · a new editorial correction is identified.

**Do not revise to:** record a product design decision that belongs in a design
artifact · argue a position · reopen a settled question.

**Version numbers are whole integers.** A revision that changes what a
contributor would do is a new version, not an amendment in place.

---

*Derived from Master Specification Revision 6
(`5a93506…f0bf9`, hash verified), Presentation Map A v2, Presentation Map B v1,
and Product Design Charter v1.0. No other source.*
