# Product Surface Architecture

**Version:** 1
**Status:** Proposed for acceptance
**Phase:** Product Architecture → Implementation Planning bridge
**Derived from:** Master Specification Revision 6 (hash
`5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9`),
Presentation Map A v2, Presentation Map B v1, Product Design Charter v1.0,
Product Architecture Index v1, Public Representation Constraints v1

> **Derivation artifact. It governs nothing.** It identifies what must exist.
> It designs nothing that exists. Where this document conflicts with an
> accepted artifact, **the accepted artifact prevails and this document is
> defective.**

---

## What this document is

The accepted baseline describes a protocol, two participant lifecycles, a
decision philosophy, an authority structure, and a set of standing
representation constraints. It does not state what gets built.

This document derives that inventory. It answers one question for a
contributor about to plan implementation: **what surfaces must exist, and why.**

**It contains no page layout, navigation, menu, visual design, copy, branding,
colour, workflow design, or implementation detail.** A surface here is a
*required capability with an identified purpose*, not a screen.

## The derivation method

Every surface below originates in one of four places, and each entry names
which:

1. **Named in a Presentation Map's `Surface` line.** Maps A and B name
   surfaces at every step and stage. These are the primary source.
2. **Required by a Public Representation Constraint.** PRC-01, PRC-02 and
   PRC-03 each require a preserved or published artifact.
3. **Named in a Map A `[DESIGN]` grouping.** Trust cluster, dashboard spine,
   onboarding.
4. **Required by a Charter principle** where no artifact names a surface but a
   principle cannot be satisfied without one. **Used sparingly and marked**,
   because it is the weakest derivation and the easiest to abuse.

**Nothing appears here that cannot be traced to one of those four.** Surfaces a
contributor might expect from convention — a blog, a roadmap page, a
newsletter, a social presence, a support desk — are absent because no accepted
artifact requires them. Their absence is not a prohibition; it means they are
unjustified by the current baseline and would need justification before
inclusion.

## Labels

Surfaces are labelled **S01–S32** for internal reference. **Document-local
labels, not requirement identifiers**, following the precedent of Map A's
O1–O8, Map B's P1–P3 and PRC-01–PRC-11.

| Marking | Meaning |
|---|---|
| `[SPEC]` | Stated in Master Specification Revision 6 |
| `[REV7]` | Proposed in `REVISION_7_CANDIDATE_AMENDMENTS.md`. Not governing. |
| `[DESIGN]` | A product decision |
| `[OPEN]` | A product decision deliberately not yet made |

**Every surface in this document is `[DESIGN]`.** The specification requires
behaviour, not surfaces. What each surface must *not* misrepresent is `[SPEC]`,
and is cited per entry.

## Modes

Each surface is classified by what it primarily helps a person do. The five
modes are derived from Map A's corrected filter — *understand, perform, or
verify* — extended by two the accepted artifacts require but that filter does
not name: **observe** (Map A's dashboard spine grouping serves people who are
not acting) and **learn** (Charter principle 2's teach-before-acting, and
§5.2's specified Handshake path).

**Understand · Perform · Verify · Observe · Learn**

A surface may have a secondary mode. The primary mode is what it is *for*.

---

# Part 1 · Product areas

Seven areas. **Each grouping is justified from the architecture, not from
convention.** Where a conventional grouping and an architectural one disagree,
the architectural one is used and the disagreement is noted.

| Area | Surfaces | Why this grouping exists |
|---|---|---|
| **1 · Public Understanding** | S01–S05 | Charter principle 2 requires teaching before action. Map A names three audiences who have not acted — first-time visitor, prospective participant, skeptic. PRC-04 governs the language of all of them identically. |
| **2 · Commitment Application** | S06–S11 | Map A's step order is **specification-stated** (§3.2 enumerates it). These surfaces execute a sequence the protocol fixes, and they are grouped because that sequence is not ours to rearrange. |
| **3 · Participation Application** | S12–S19 | Map B covers §10 and the post-issuance capabilities. Grouped separately from Area 2 because **Map B's stage order is `[DESIGN]` derivation, not specification** — these surfaces must not imply a mandated sequence. |
| **4 · Observation** | S20–S23 | Map A's `[DESIGN]` dashboard spine grouping treats §13 as an organising principle, and overlay O4 spans steps rather than sitting in one. These serve people watching rather than acting — including the skeptic, who may never act. |
| **5 · Verification** | S24–S26 | Map A treats **verifier and skeptic as first-class audiences, not edge cases**, supported by §16 and VF-VER-006's preference for independent reproduction. PRC-02 and PRC-03 require the underlying artifacts. Charter principles 3 and 4, and the North Star, live here. |
| **6 · Reference Documentation** | S27–S30 | Every one of Map A's eight steps and most of Map B's stages names a `docs` surface. PRC-01 requires the specification itself be preserved. |
| **7 · Learning** | S31–S32 | Charter principle 2. §5.2's Trust-Building Handshake is a **specified onboarding path** — the protocol itself provides a teaching mechanism. |

## Two groupings that convention would get wrong

**Areas 2 and 3 are not one application area.** Convention would merge them —
same wallet, same session, same participant. The architecture separates them
because **Map A's ordering carries specification authority and Map B's does
not.** A contributor who merges them will eventually present Map B's stages as
a required sequence, which would misrepresent §10. The Product Architecture
Index calls this out as the difference between the two maps that must not be
lost.

**Areas 4 and 5 are not one transparency area.** Convention would merge
dashboards and verification into "transparency." The architecture separates
them because they answer different questions. Observation answers *what is
happening*. Verification answers *how do I check this myself without trusting
you*. The Charter's North Star is satisfied only by the second. Merging them
lets a dashboard stand in for verification, which is the specific failure the
North Star names.

---

# Part 2 · Surface inventory

## Area 1 · Public Understanding

### S01 · Protocol Introduction

**Purpose.** Present what Vinculum is to someone who has not encountered it.
**Derivation.** Map A `[DESIGN]` audiences; open decision 3 names a home page
directly.
**Audience.** First-time visitor · prospective participant · skeptic.
**Governing.** PRC-04, PRC-09 · Charter principles 2, 5, 7, 8.
**Supports.** Precedes Map A Step 1. No step; the entry point to all of them.
**Questions answered.** What is this? What does it do? What does it not do?
**Mode.** Understand.
**Depends on.** Nothing. Everything else depends on it.
**Evidence.** None inherent. It describes; it does not prove.
**Post-deployment.** None.
**Primary audience — decision 3, CLOSED.** The **Intelligent Newcomer**: a
thoughtful person curious enough to understand before acting, assumed to have
neither deep blockchain expertise nor complete unfamiliarity. **Teaches before
asking for action; does not optimise for speculation, urgency, or immediate
conversion.** All six audiences remain fully supported; the Intelligent
Newcomer establishes tone, pacing and depth. Canonical record: Index §6.2.

### S02 · Trust Cluster

**Purpose.** Present the four specification sections that tell one story — **no
one controls this, and your asset returns even if everything else fails.**
**Derivation.** Map A `[DESIGN]` grouping "Trust cluster," §2, §12, §14, §15.
Includes the Map A surfaces named "Your asset never moves" (Step 3) and
"Principal safety" (Step 8).
**Audience.** Skeptic — primarily · prospective participant.
**Governing.** Overlays O1, O2 · PRC-04, PRC-09 · Charter principles 3, 4, 7.
**Supports.** Map A Steps 3 and 8; overlays O1 and O2, which span all steps.
**Questions answered.** Who controls this? What happens if it breaks? Can
anyone take my asset? What happens if the protocol fails after I commit?
**Mode.** Understand, with a strong Verify secondary — Charter principle 4 says
the application should never ask someone to trust what they can instead
verify, and this is the surface most tempted to ask for trust.
**Depends on.** S24 deployment manifest and S27 preserved specification, for
the claims to be checkable rather than asserted.
**Evidence.** Deployed contract code; the finalization transaction; §12's
principal release path.
**Post-deployment.** Contract code and absence of control are **available only
post-deployment** (Map A overlay O1, Index §7.2). Before deployment this
surface can describe intent but cannot demonstrate it, and O8 / VF-EXT-002
governs saying so.
**Shaped by** `[OPEN]` **4** — how much it explains versus asserts. Non-blocking.

### S03 · Supported Assets

**Purpose.** Present which assets may be committed, in which environments.
**Derivation.** Map A Step 1 `Surface` line, "Supported Assets (public)"; PRC-05.
**Audience.** Prospective participant · existing participant.
**Governing.** §6, Appendix C · **PRC-05, PRC-09, PRC-10** · Charter principle 1.
**Supports.** Map A Step 1.
**Questions answered.** Is my asset supported? On which chain? What is it
currently priced at, from what source, as of when?
**Mode.** Understand, Observe secondary.
**Depends on.** S26 machine-readable registry — this is its public
presentation.
**Evidence.** Registry contents; price source and update time per PRC-10.
**Post-deployment.** **Registry immutability is provable only post-deployment**
(Index §7.2). Asset contents are available before.
**Decisions 15 and 19, CLOSED (Index §6.2).** The display set is
**permissive-open**: the eight enumerated fields are expressly authorised and
further fields are permitted subject to VF-PUB-001. **Price Source and Last
Updated accompany every price the product displays**, on this surface and
everywhere else.

### S04 · Token Statistics

**Purpose.** Present lifetime issuance, supply, and capacity for VCLM, CHONX
and SYNTH publicly.
**Derivation.** Map A Step 7 and Map B Stage 1 `Surface` lines, "Token
statistics (public)".
**Audience.** All six audiences.
**Governing.** §13, overlay O4 · PRC-04, PRC-09 · Charter principle 3.
**Supports.** Map A Step 7; Map B Stage 1.
**Questions answered.** How much has been issued? How much capacity remains?
Has CHONX activated? Is the Forge available yet?
**Mode.** Observe.
**Depends on.** S20 — this is the public subset of the supply dashboard.
**Evidence.** On-chain state, readable by anyone.
**Post-deployment.** **Entirely.** Lifetime issuance, capacity and activation
are available only post-deployment (Map A overlay O4).
**Decision 20, CLOSED (Index §6.2).** Specification-derived mechanics —
including the emission schedule and cumulative issuance against capacity — **are
facts and may be stated plainly.** Excluded is any projection or comparison
presented as indicative of what a participant will receive.

### S05 · Market and Listing Disclosures

**Purpose.** State what the protocol does not guarantee about markets, venues,
listings and value.
**Derivation.** Map B Stage 1 `Surface` line, "Market disclosures"; PRC-07,
PRC-08.
**Audience.** Prospective participant · skeptic.
**Governing.** §17.2, VF-TOK-015, VF-PUB-003 · **PRC-07, PRC-08, PRC-11** ·
Charter principle 7.
**Supports.** Map B Stage 1.
**Questions answered.** Is this worth something? Will it be listed? Does market
activity change what the protocol does?
**Mode.** Understand.
**Depends on.** S01, for context.
**Evidence.** The specification itself; VF-RAC-005's fixed $0.10 reward
reference as the concrete demonstration that rewards do not track market price.
**Post-deployment.** None.
**Decisions 17 and 18, CLOSED (Index §6.2).** This surface **exists
distinctly.** It carries the non-guarantees and **one factual statement that
listing pursuit is a development objective** — no timeline, no likelihood, no
repetition elsewhere. **No third-party market or venue data appears on it or on
any public surface.**

---

## Area 2 · Commitment Application

**Note on Map B's Stage 1.** Map B begins at *holding*, which Map A Step 7
produces. **S10 Portfolio sits on that seam and is claimed by both areas.** It
is listed here because Map A produces it first.

### S06 · Commitment Workflow

**Purpose.** Let a participant select an asset, environment, amount and
duration; see the preflight result; and submit the source transaction.
**Derivation.** Map A Steps 1, 2, 3 `Surface` lines — "Lock workflow (app)",
"Lock workflow (app, primary)", including **"Non-refundable fee warning (app,
required)"**.
**Audience.** Prospective participant · existing participant.
**Governing.** §3.2 Steps 1–3, §5, §7, §8 · overlays O2, O5, O6, O7 ·
**PRC-06, PRC-09, PRC-10** · Charter principles 1, 2, 6.
**Supports.** Map A Steps 1, 2, 3.
**Questions answered.** What will I get? What will it cost? What am I
committing to, and for how long? Can I change my mind?
**Mode.** Perform.
**Depends on.** S03 supported assets · S28 commitment rules reference · S26
registry.
**Evidence.** Source-chain transaction; signed price record; explorer links.
**Post-deployment.** Contract addresses required to transact.
**Carries a required obligation.** The **non-refundable fee warning is marked
`required` in Map A Step 2** — not a presentation choice. **PRC-10's price
source and update time attach to any price shown here**, subject to `[OPEN]`
19.
**Decision 16, CLOSED (Index §6.2).** Satisfied by presenting the commitment's
own figures as the commitment's own figures. **No explanatory apparatus about
price-object distinctions appears on any participant-facing surface.**

### S07 · Commitment Tracking

**Purpose.** Show the state of a submitted commitment through finality and
proof.
**Derivation.** Map A Step 4 `Surface` line — "Commitment tracking (app)",
including **"Pending disposition (app, required behaviour)"**.
**Audience.** Existing participant.
**Governing.** §3.2 Step 4, §11 · overlays O2, O6 · Charter principles 1, 6, 7.
**Supports.** Map A Steps 4, 5.
**Questions answered.** Where is my commitment now? What is it waiting for? Is
something wrong? What happens if it never completes?
**Mode.** Observe, Perform secondary.
**Depends on.** S06 · S28 per-environment finality rules.
**Evidence.** Source-chain confirmations; explorer links.
**Post-deployment.** Requires deployed contracts.
**Carries a required obligation.** **Pending disposition is marked `required
behaviour`** in Map A Step 4 — how a pending attempt is disposed of is
specification-governed, not a design choice.
**Decision 2, CLOSED — the Application remains intentionally thin.** A
notification is a convenience feature and is not adopted on that basis. The only
admitted test is **prevention of genuine operational mistakes**, which any
future proposal must meet rather than assume. Map A remains explicit: the
journey is never notification-driven; the application is an instrument panel,
not an autopilot. Canonical record: Index §6.2.

### S08 · Proof Surface

**Purpose.** Whatever role the application takes in proof construction and
submission.
**Derivation.** Map A Step 5 `Surface` line, which states outright that the
surface *depends on the open decision*.
**Audience.** Existing participant · developer · verifier.
**Governing.** §11, VF-XCH-012 · overlay O3 · Charter principles 1, 6.
**Supports.** Map A Step 5.
**Questions answered.** How does the proof get submitted? Must I do it? Can
someone else? Does it matter who?
**Mode.** Perform or Verify — **determined by the open decision.**
**Depends on.** S07 · S29 evidence schema.
**Evidence.** Proof submission transactions; permissionless submission is
demonstrable by anyone submitting.
**Post-deployment.** Entirely.
**Governed by decision 2, not blocked.** Decision 1 — the application's role in
proof construction — is **reclassified as an implementation and UX decision**
(Index §6.2). The accepted principle answers the architectural question: this
surface exists only insofar as it is **actually and defensibly necessary** for
successful participation, understanding, verification, or prevention of genuine
operational mistakes. Whether proof construction meets that test is determined
by operational fact. The **evidence schema belongs in documentation regardless** —
Map A says so explicitly, so S29 proceeds whatever is decided.

### S09 · Issuance Status

**Purpose.** Show Base-side verification and issuance outcome.
**Derivation.** Map A Step 6 `Surface` line "Mint status (app)"; Step 7.
**Audience.** Existing participant.
**Governing.** §3.2 Steps 6–7, §13 · overlays O2, O4 · Charter principles 3, 4.
**Supports.** Map A Steps 6, 7.
**Questions answered.** Did it verify? What was issued? Why that amount? What
if verification failed?
**Mode.** Observe, Verify secondary.
**Depends on.** S07 · S22 verification activity · S28.
**Evidence.** Verification transactions; issuance transactions; the calculation
reproducible from public data.
**Post-deployment.** **Verification transactions available only
post-deployment** (Index §7.2).
**Interacts with the RAC seam.** Product Architecture Index §3.2 records that
the Reward-Accounting Credit is created at fee verification **independently of
issuance** — it can exist where issuance does not. This surface must not
present RAC as a subordinate detail of issuance. Map A v2 corrected exactly
that error.

### S10 · Portfolio

**Purpose.** Show what a participant holds and what they have committed.
**Derivation.** Map A Step 7 and Map B Stage 1 `Surface` lines — named by both.
**Audience.** Existing participant.
**Governing.** §4, §13 · overlay O4 · PRC-09, PRC-10 · Charter principle 1.
**Supports.** Map A Step 7; Map B Stage 1. **The seam between the two maps.**
**Questions answered.** What do I hold? What have I committed? What is
outstanding?
**Mode.** Observe.
**Depends on.** S09 · S04.
**Evidence.** Token balances and transfers, public on-chain.
**Post-deployment.** Entirely.
**Architectural note.** This is the only surface both maps name at their
junction. **It is the handoff.** Map A Step 8 — maturity and release — runs on
the source chain and **does not enter Map B at all**; a participant can
complete Step 8 having never reached Map B. This surface must not couple them.

### S11 · Maturity and Release

**Purpose.** Show commitment maturity and let a participant release principal.
**Derivation.** Map A Step 8 `Surface` line — "Your commitments with countdowns
(app)", "Release workflow (app)".
**Audience.** Existing participant.
**Governing.** §12 · overlay O1 · Charter principles 1, 6, 7.
**Supports.** Map A Step 8.
**Questions answered.** When can I release? How do I? What if issuance never
happened?
**Mode.** Perform.
**Depends on.** S07 · S28 maturity rules.
**Evidence.** Source-chain timelock; release transaction.
**Post-deployment.** Requires deployed source-environment contracts.
**Architectural note.** §12 makes principal release **user-initiated**, and
Map A's design principle — the protocol informs, the user decides — derives
directly from it. **The user owns remembering.** Principal remains releasable
even where Base verification failed permanently and no token was ever issued;
this surface must work in that case.

---

## Area 3 · Participation Application

**Ordering caution that governs this entire area.** Map B's stage sequence is
`[DESIGN]` derivation from requirement dependencies. **§10 does not state a
participant order.** These surfaces must not imply that one exists.

### S12 · Stake Workflow

**Purpose.** Let a holder create a Treasury Reward Stake position.
**Derivation.** Map B Stage 2 `Surface` line — "Stake workflow (app)".
**Audience.** Existing participant.
**Governing.** §10.1, VF-STK-001–005, VF-STK-031 · overlay P3 · Charter
principles 2, 6.
**Supports.** Map B Stage 2.
**Questions answered.** What can I stake? For how long? What weight will I
have? How is it calculated?
**Mode.** Perform.
**Depends on.** S10 · S29 multiplier reference · S32 weight calculator.
**Evidence.** Multipliers fixed in an immutable contract; weight computable by
anyone from public position data.
**Post-deployment.** Entirely.
**Architectural note.** VF-STK-005 — **acquisition history never affects
weight.** A token earned as a reward stakes identically to one bought on an
exchange. Map B calls this a fairness property worth stating plainly.

### S13 · Position Status and Eligibility

**Purpose.** Show a position's state and its eligibility for each epoch.
**Derivation.** Map B Stage 3 `Surface` line — "Position status with
eligibility state (app)".
**Audience.** Existing participant.
**Governing.** §10.3, VF-STK-011, VF-STK-012 · overlay P1 · Charter principles
2, 5, 7.
**Supports.** Map B Stage 3.
**Questions answered.** Am I earning? For which epoch? Why not? When does that
change?
**Mode.** Understand — unusually, not Observe. The state is simple; the rule
producing it is not.
**Depends on.** S12 · S23 epoch dashboard · S29 eligibility rules.
**Evidence.** Epoch boundaries computable from T0; position timestamps
on-chain; eligibility independently determinable.
**Post-deployment.** Entirely.
**Carries the protocol's hardest presentation problem — and is its canonical
product treatment.** Per Index §6.2, **the rule's canonical `[SPEC]` source is
Presentation Map B Stage 3, and this entry is its canonical product
treatment.** Downstream artifacts point here rather than restating it.
`[OPEN]` **9** — the eligibility rule requires a position be active at the exact
beginning of epoch N, continuously through N, and still active at the scheduled
end of N+1. Map B names it **the least intuitive rule in the protocol and the
most likely to be misunderstood**. Combined with VF-STK-025, **a participant can
lose an already-earned entitlement by letting a position lapse one day early.**
**Also shaped by** `[OPEN]` **13** — whether terminal state is presented before
it is reached.

### S14 · Entitlements

**Purpose.** Show fixed epoch entitlements after allocation.
**Derivation.** Map B Stage 4 `Surface` line — "Your entitlements (app)".
**Audience.** Existing participant.
**Governing.** §10.4, VF-STK-013–015 · overlays P2, P3 · Charter principles 3, 7.
**Supports.** Map B Stage 4.
**Questions answered.** What did I earn? For which epoch? How was it
calculated? Why was it zero?
**Mode.** Verify — the full calculation is reproducible from public data, which
makes this a verification surface rather than a reporting one.
**Depends on.** S13 · S23.
**Evidence.** Finalization and minting transactions public; entitlement records
on-chain; **the full calculation reproducible from public data.**
**Post-deployment.** Entirely.
**Shaped by** `[OPEN]` **12** — how the inaccessible rounding remainder is
disclosed. Overlay P2 records it as a **disclosure, not a defect**: the
remainder is unreachable because no party has authority to reach it.

### S15 · Claim

**Purpose.** Let a participant claim accumulated VCLM.
**Derivation.** Map B Stage 5 `Surface` lines — "Claim workflow", "Accumulated
rewards", "Claim history".
**Audience.** Existing participant.
**Governing.** §10.4, VF-STK-016–019 · Charter principles 1, 6.
**Supports.** Map B Stage 5.
**Questions answered.** What can I claim? Does it expire? Where does it go?
**Mode.** Perform.
**Depends on.** S14.
**Evidence.** Claimable balances and claim transactions on-chain.
**Post-deployment.** Entirely.
**Architectural note.** Claimable VCLM **accumulates and never expires**
(VF-STK-016). Map B states that **the user owns remembering**, consistent with
Map A Step 8. Charter principle 6 forbids the product quietly deciding on the
participant's behalf.

### S16 · Extension

**Purpose.** Let a participant queue one future term and see the consequence of
not doing so.
**Derivation.** Map B Stage 6 `Surface` lines — "Extension workflow", "Position
timeline".
**Audience.** Existing participant.
**Governing.** §10.5, VF-STK-021–025, VF-STK-029 · overlay P3 · Charter
principles 6, 7.
**Supports.** Map B Stage 6.
**Questions answered.** Can I extend? What happens if I don't? Can I fix it
afterwards?
**Mode.** Perform, with a required Understand component.
**Depends on.** S13.
**Evidence.** Queued terms and position state on-chain.
**Post-deployment.** Entirely.
**Carries an irreversible consequence.** `[OPEN]` **10** — VF-STK-025: an
expired position **cannot retroactively cover an inactivity gap.** The
consequence arrives silently at maturity. Charter principles 6 and 7 pull the
same way here, and **neither permits the product to extend on the participant's
behalf.**

### S17 · Withdrawal

**Purpose.** Let a participant withdraw matured staked tokens.
**Derivation.** Map B Stage 7 `Surface` lines — "Withdrawal workflow",
"Position history".
**Audience.** Existing participant.
**Governing.** §10.6, VF-STK-020, VF-STK-030 · overlay P3 · Charter principle 5.
**Supports.** Map B Stage 7.
**Questions answered.** Can I withdraw? Do I lose unclaimed rewards if I do?
**Mode.** Perform.
**Depends on.** S12 · S15.
**Evidence.** Withdrawal transactions public; claimable balance readable before
and after.
**Post-deployment.** Entirely.
**Architectural note.** **Withdrawal does not erase accumulated claimable
VCLM** (VF-STK-020). The two are independent, and Map B flags making that
independence clear as the design problem here.

### S18 · SYNTH Forge

**Purpose.** Let a holder forge SYNTH by destroying VCLM and CHONX.
**Derivation.** Map B Stage 1 `Surface` line — "Forge (app, **gated**)".
**Audience.** Existing participant.
**Governing.** §4, VF-TOK-005 · Charter principles 5, 6, 7.
**Supports.** Map B Stage 1.
**Questions answered.** What does forging cost? Is it reversible? Is it
available yet?
**Mode.** Perform.
**Depends on.** S10 · S04 — cumulative CHONX issuance determines availability.
**Evidence.** Forge transactions public; cumulative CHONX issuance readable.
**Post-deployment.** Entirely, **and additionally gated**: available only after
100,000,000 cumulative lifetime CHONX issuance.
**Architectural note.** The Forge is **one-way, with no reversal, redemption or
administrative restoration path.** `[OPEN]` **11** — whether it is framed as a
conversion or a milestone.

### S19 · Portability

**Purpose.** Let a holder move an issued token to another chain.
**Derivation.** Map B Stage 1 `Surface` line — "Portability (app)".
**Audience.** Existing participant · developer.
**Governing.** §11.4, VF-XCH-019, VF-XCH-021 · Charter principle 5.
**Supports.** Map B Stage 1.
**Questions answered.** Can I move this? Does moving it create new supply?
**Mode.** Perform.
**Depends on.** S10.
**Evidence.** Interchain transfers public on-chain.
**Post-deployment.** Entirely.
**Architectural note.** **Transport is not issuance** (VF-XCH-021) — it does
not increase cumulative lifetime issuance or restore capacity, and no
independent supply may exist on another chain (VF-XCH-019). The surface must
not imply otherwise.

---

## Area 4 · Observation

### S20 · Supply and Capacity Dashboard

**Purpose.** Present lifetime issuance, remaining capacity and activation
progress.
**Derivation.** Map A `[DESIGN]` grouping "Dashboard spine" — a product
decision to treat §13 as a dashboard's organising principle. Named at Step 7 as
"Transparency dashboard (overlay O4)".
**Audience.** All six audiences.
**Governing.** §13 · overlay O4 · PRC-04, PRC-09 · Charter principles 3, 5.
**Supports.** Map A Step 7; overlay O4, which spans Steps 1, 2, 6, 7 and gates
post-issuance capabilities.
**Questions answered.** How much has been issued? What remains? Has CHONX
activated? What is gated on what?
**Mode.** Observe.
**Depends on.** S26 · S24.
**Evidence.** On-chain state, readable by anyone.
**Post-deployment.** **Entirely.**
**Shaped by** `[OPEN]` **13** — whether terminal state is presented before it is
reached. Overlay P3: the protocol has a defined end state at which **nothing is
stranded.**

### S21 · Registry and Price Status

**Purpose.** Present registry statistics and price freshness.
**Derivation.** Map A Step 1 "Registry statistics (dashboard)" and Step 2
"Price freshness (dashboard)".
**Audience.** Prospective participant · verifier · skeptic.
**Governing.** §6, §7 · overlay O7 · **PRC-05, PRC-06, PRC-09, PRC-10** ·
Charter principles 3, 7.
**Supports.** Map A Steps 1, 2.
**Questions answered.** How current is this price? From what source? How many
assets are supported, where?
**Mode.** Observe, Verify secondary.
**Depends on.** S26 · S03.
**Evidence.** Signed price records available on publication; registry contents.
**Post-deployment.** Registry immutability provable only post-deployment.
**Carries PRC-06 and PRC-10 most directly.** Twice-daily refresh means a
displayed figure may be close to twelve hours old; PRC-10 requires source and
update time wherever price appears. **`[REV7]` VF-ORC-015** proposes a 48-hour
validity bound on the **protocol price reference** — not governing, and a
different object from the website refresh cadence.

### S22 · Verification Activity

**Purpose.** Present Base-side verification statistics.
**Derivation.** Map A Step 6 `Surface` line — "Verification statistics
(dashboard)".
**Audience.** Verifier · skeptic · existing participant.
**Governing.** §11, §16 · overlays O2, O3 · Charter principles 3, 4.
**Supports.** Map A Step 6.
**Questions answered.** Is verification working? How often does it fail? What
happens when it does?
**Mode.** Observe, Verify secondary.
**Depends on.** S24 · S25.
**Evidence.** **Verification transactions — available only post-deployment.**
**Post-deployment.** Entirely.
**Failure reporting — accepted, no new requirement.** Truthful presentation of
both successful and unsuccessful verification outcomes **derives sufficiently
from Charter principles 3 and 7** — evidence over assertion, and honest
communication of limitations. **This is deliberately not elevated into a
protocol requirement.** A dashboard showing only successes is a Charter
violation, not a specification violation, and that is the correct classification.

### S23 · Epoch Dashboard

**Purpose.** Present the epoch schedule, finalization state and allocation
history.
**Derivation.** Map B Stage 3 "Epoch schedule (dashboard)", Stage 4 "Epoch
status (dashboard)" and "Allocation history (dashboard)".
**Audience.** Existing participant · verifier · observer.
**Governing.** §10.2, §10.4, VF-STK-006–010 · overlay P1 · Charter principles
3, 4.
**Supports.** Map B Stages 3, 4.
**Questions answered.** Which epoch are we in? Which are finalized? Who
finalized them? What was allocated?
**Mode.** Observe, Verify secondary.
**Depends on.** S20.
**Evidence.** **T0 and every boundary computable by anyone**; finalization
transactions public.
**Post-deployment.** Entirely — T0 is defined by protocol launch.
**Decision 8, RECLASSIFIED (Index §6.2).** Finalization is permissionless and
an epoch finalizes regardless of who acts, so offering it is **not necessary for
successful participation** under the accepted thin-Application principle.
Whether the Workspace offers it is implementation and UX. **This surface remains
an observation surface either way.** Overlay P1: finalization is permissionless, exactly
as proof submission is — **anyone may act, and it changes nothing about the
outcome.**

---

## Area 5 · Verification

**Why this area is first-class.** Map A treats **verifier and skeptic as
first-class audiences rather than edge cases**, a `[DESIGN]` judgement supported
by §16's weight on traceability and VF-VER-006's preference for independent
reproduction over self-reported pass counts. The Charter's North Star is
satisfied here or nowhere: *the product succeeds when a participant no longer
relies on the application to tell them the protocol is working.*

### S24 · Deployment Manifest

**Purpose.** Publish every live address, environment identifier, source commit,
bytecode hash, dependency and fixed Dev Fund destination.
**Derivation.** **PRC-03** — required by §17.1.
**Audience.** Verifier · developer · skeptic.
**Governing.** §17.1, VF-PUB-001 · overlays O3, O8 · **PRC-03, PRC-09** ·
Charter principles 3, 4.
**Supports.** Every Map A step indirectly; overlay O1's evidence claim
directly.
**Questions answered.** What is deployed, where? Does the deployed bytecode
match published source? Where do fees actually go?
**Mode.** Verify.
**Depends on.** Nothing product-side. Everything verification-related depends
on it.
**Evidence.** **This surface is evidence.** Bytecode hash plus source commit
lets anyone confirm deployed code matches published source.
**Post-deployment.** **Entirely** — Index §7.2 lists live addresses, contract
code and registry immutability as post-deployment. Before deployment, **O8 /
VF-EXT-002 requires unavailable entries be reported as incomplete rather than
replaced with an invented value.**
**Decision 21, CLOSED (Index §6.2).** The manifest is **published as a public
surface.** Form is implementation. Unavailable entries are reported as
incomplete per VF-EXT-002.

### S25 · Traceability Publication

**Purpose.** Publish the §16 traceability between numbered requirements and the
tests and checks that exercise them.
**Derivation.** Map A Step 6 `Surface` line — "Published traceability
(`[DESIGN]`, overlay O3)".
**Audience.** Verifier · skeptic · developer · independent reviewer.
**Governing.** §16, VF-VER-001, VF-VER-006–008 · overlay O3 · Charter
principles 3, 4.
**Supports.** Map A Step 6; overlay O3 across all steps.
**Questions answered.** Is this tested? Against what requirement? Can I
reproduce it?
**Mode.** Verify.
**Depends on.** S30 developer reference.
**Evidence.** **Traceability matrix, test suites and evidence artifacts are
available now** — among the few evidence classes not gated on deployment
(Index §7.2).
**Post-deployment.** None. **This is buildable today.**
**Blocked by** `[OPEN]` **5** — whether and how §16 traceability is published.
**Architectural note.** VF-VER-006 prefers **independent reproduction over
self-reported pass counts**; VF-VER-007: nothing is production-ready merely
because it compiles; VF-VER-008: code does not prevail over specification by
default. A surface reporting a pass count and nothing else would satisfy none
of these.

### S26 · Machine-Readable Registry

**Purpose.** Preserve every approved asset identity, environment,
classification, pricing identifier and source metadata in machine-readable
form.
**Derivation.** **PRC-02** — required by §17.1.
**Audience.** Developer · verifier · every other surface that consumes it.
**Governing.** §17.1, Appendix C, VF-PUB-001 · **PRC-02, PRC-09** · Charter
principle 3.
**Supports.** Map A Step 1.
**Questions answered.** What is the authoritative asset list? Where can I get
it as data?
**Mode.** Verify, with a strong infrastructure role.
**Depends on.** Nothing. **S03, S20 and S21 depend on it.**
**Evidence.** The registry is the reference against Appendix C.
**Post-deployment.** Contents available now; immutability provable only
post-deployment.
**Architectural note.** **PRC-02 and PRC-05 are different obligations.** This
surface *preserves* five categories; S03 *displays* a set of eight fields.
Classification is preserved here and is not among PRC-05's display fields —
which is precisely why `[OPEN]` 15 matters.

---

## Area 6 · Reference Documentation

**Why this is an area and not a feature of other surfaces.** **Every one of Map
A's eight steps names a `docs` surface**, and most of Map B's stages do.
Documentation is not an appendix to the product in this architecture; it is
where the rules live, and the application surfaces reference it rather than
restating it.

### S27 · Preserved Master Specification

**Purpose.** Preserve and make available the governing human-readable
specification.
**Derivation.** **PRC-01** — required by §17.1.
**Audience.** Verifier · skeptic · developer · independent reviewer.
**Governing.** §17.1, VF-PUB-001 · **PRC-01, PRC-09** · Charter principles 3, 8.
**Supports.** Everything. Every other surface derives its language from this.
**Questions answered.** What does the protocol actually say?
**Mode.** Verify.
**Depends on.** Nothing.
**Evidence.** The specification and its hash.
**Post-deployment.** None. **Available now.**
**Decision 14, CLOSED (Index §6.2).** The specification **is published, with
its hash alongside it.** Prominence is UX.
**Architectural note.** PRC-01's product consequence: **no product surface may
position itself as the authoritative description of protocol behaviour**,
because a more authoritative description is preserved and available.

### S28 · Commitment Rules Reference

**Purpose.** State the rules governing commitment — durations and multipliers,
fees and rounding, fee routing, per-environment finality, maturity.
**Derivation.** Map A `Surface` lines at Steps 1, 2, 3, 4, 8 — five distinct
`docs` surfaces, grouped here because they document one lifecycle.
**Audience.** Prospective participant · existing participant · verifier.
**Governing.** §5, §7, §8, §11, §12 · overlays O5, O6, O7 · PRC-04, PRC-09 ·
Charter principles 2, 5, 7.
**Supports.** Map A Steps 1, 2, 3, 4, 8.
**Questions answered.** How is the fee calculated? How does rounding work?
Where does the fee go? How long until finality on my chain? When can I release?
**Mode.** Understand.
**Depends on.** S27.
**Evidence.** The specification; §16 traceability.
**Post-deployment.** Fee destination confirmable only post-deployment via S24.
**Architectural note.** Includes §5.2's Handshake allowance lifecycle (overlay
O5): three uses per bound identity where the source mechanism maintains
persistent atomic state, one otherwise; **rejected attempts consume no
allowance.**

### S29 · Participation Rules Reference

**Purpose.** State the rules governing staking — multipliers, eligibility,
epochs, extensions, rounding, terminal state, and the evidence schema.
**Derivation.** Map B `Surface` lines at Stages 2, 3, 6 — three `docs` surfaces;
plus Map A Step 5's statement that **the evidence schema belongs in
documentation regardless** of open decision 1.
**Audience.** Existing participant · verifier · developer.
**Governing.** §10, §9 · overlays P1, P2, P3 · Charter principles 2, 5, 7.
**Supports.** Map B Stages 2, 3, 4, 6, 7; Map A Step 5.
**Questions answered.** How is weight calculated? When am I eligible? How long
is an epoch? What happens at the end?
**Mode.** Understand.
**Depends on.** S27.
**Evidence.** Multipliers fixed in an immutable contract; epoch boundaries
computable from T0.
**Post-deployment.** T0 known only at launch.
**Carries** `[OPEN]` **9, 10, 12, 13** — the eligibility rule, the gap rule, the
rounding remainder and terminal state. **All four of the hardest explanations
land here as well as in their application surfaces.**

### S30 · Developer and Verifier Reference

**Purpose.** Document verifier contracts, proof formats, interfaces and
reproduction procedures.
**Derivation.** Map A Step 6 `Surface` line — "Verifier contracts (docs,
developer)".
**Audience.** Developer · verifier.
**Governing.** §11, §16, §19 · overlays O3, O8 · Charter principles 3, 4.
**Supports.** Map A Steps 5, 6.
**Questions answered.** How do I verify a proof myself? How do I reproduce the
tests? What are the interfaces?
**Mode.** Verify.
**Depends on.** S24 · S27.
**Evidence.** Verifier contracts; test suites; **available now** except
deployed addresses.
**Post-deployment.** Addresses only.

---

## Area 7 · Learning

### S31 · Trust-Building Handshake

**Purpose.** Let a newcomer walk the entire commitment lifecycle at
approximately one dollar for one hour.
**Derivation.** Map A `[DESIGN]` grouping "Onboarding" — **the onboarding path
is specified** (§5.2); its presentation is `[DESIGN]`.
**Audience.** First-time visitor · prospective participant · **skeptic**.
**Governing.** §5.2, VF-COM-006, VF-COM-008 · overlay O5 · Charter principles
2, 4, 5.
**Supports.** Map A Steps 1–8 — **all of them, compressed into an hour.**
**Questions answered.** What actually happens if I do this? Can I try it
without risk?
**Mode.** **Learn** — the only surface where learning is primary.
**Depends on.** S06, S07, S09, S11 — **the full commitment application.**
**Evidence.** A complete real lifecycle on a real chain, produced by the
participant themselves.
**Post-deployment.** Entirely.
**Architectural note.** **This is the specification's own teaching mechanism**
and the strongest available instrument for the Charter's North Star: a
participant who has walked the whole lifecycle for a dollar has verified it
rather than been told about it. **It is also the natural first participant test
of the product**, which the implementation ordering below reflects.

### S32 · Weight and Outcome Calculators

**Purpose.** Let someone compute a result before committing to it.
**Derivation.** Map B Stage 2 `Surface` line — "Weight calculator
(`[DESIGN]`)"; Map A Step 2 preflight.
**Audience.** Prospective participant · existing participant.
**Governing.** §10.1, §8 · PRC-04, PRC-09, PRC-10 · Charter principles 1, 2, 6.
**Supports.** Map A Step 2; Map B Stage 2.
**Questions answered.** What would I get if I did this? What if I chose
differently?
**Mode.** Learn, Understand secondary.
**Depends on.** S26 · S28 · S29.
**Evidence.** Weight computable by anyone from public data; multipliers fixed
in an immutable contract.
**Post-deployment.** Live values require deployment; the arithmetic does not.
**Governed by** `[OPEN]` **20** — whether a projected outcome constitutes an
implied economic promise under PRC-04. **This surface sits closest to that
edge** of any in the inventory.
**`[REV7]`** Map A's "Live preview" grouping records Rev 7 Appendix A2: Solidity
contracts as production target with a JavaScript layer driving live preview,
**divergence expected, preview layer not duplication.** Not governing.

---

# Part 3 · Cross-cutting obligations

Four obligations attach to surfaces rather than being surfaces. **Recorded
separately so they are not lost inside any one entry.**

| Obligation | Source | Attaches to |
|---|---|---|
| **Explorer links** | Map A Steps 3, 4 `Surface` lines — "(app, dashboard)" | S06, S07, S09, S21, S22 — wherever a transaction is referenced |
| **Non-refundable fee warning — `required`** | Map A Step 2 | S06. **Not a presentation choice.** |
| **Pending disposition — `required behaviour`** | Map A Step 4 | S07. **Specification-governed.** |
| **Price source and last update time** | **PRC-10 / VF-PUB-002** | **Every surface where a price appears** — S03, S06, S21, S32 — subject to `[OPEN]` 19's scope question |

**A fifth obligation governs every surface without exception.** **PRC-04 and
PRC-09** apply everywhere: language derives from the current specification, adds
no economic promise and no unspecified feature, and remains consistent as the
specification changes. PRC-11 records that **these are the two constraints most
likely to be violated by ordinary inattention rather than intent** — a phrase
written for clarity that adds a feature, or a page left unrevised after a
specification revision.

---

# Part 4 · Implementation sequence

**Ordering objective, per the assignment:** minimise rework while allowing early
participant testing. Both are served by the same insight — **the specification
provides its own participant test**, and it costs a dollar.

**Every phase boundary is justified from an accepted artifact, not from
delivery convenience.**

## Phase 0 · Reference foundation

**Surfaces.** S27 preserved specification · S26 machine-readable registry ·
S30 developer and verifier reference · S25 traceability publication.

**Why first.** **PRC-04 requires that all public language derive from the
specification.** Every surface built before the specification is preserved and
the registry exists will need its language and data source rewritten. Rework is
maximal here and nowhere else.

**Justifying artifacts.** PRC-01, PRC-02 require S27 and S26 outright. Product
Architecture Index §7.2 records that **traceability matrices, test suites and
evidence artifacts are available now** — S25 and S30 are among the very few
surfaces that need no deployment at all.

**Unlocks.** S03, S20, S21 all consume S26. S02 and S24 depend on S27 for
checkable rather than asserted claims. **The verifier and skeptic audiences are
served from Phase 0**, which is unusual and deliberate: Map A treats them as
first-class.

**Blocked by.** `[OPEN]` 5 (S25) — the only remaining blocker in the product.

## Phase 1 · Public understanding

**Surfaces.** S01 introduction · S02 trust cluster · S03 supported assets ·
S05 market and listing disclosures.

**Why second.** **Charter principle 2 — teach before asking for action.** A
participant should not encounter the application before the material that
explains it. Building the application first inverts the Charter's own ordering.

**Justifying artifacts.** Charter principle 2; Map A's audiences, three of whom
have not acted; PRC-04 governing all four surfaces identically.

**Unlocks.** Everything participant-facing. S03 is the entry to S06.

**Not blocked.** Decisions 15, 17, 18 and 19 are closed (Index §6.2). **This
phase may begin immediately.**

## Phase 2 · Commitment application

**Surfaces.** S06 commitment workflow · S07 tracking · S08 proof surface ·
S09 issuance status · S10 portfolio · S11 maturity and release.

**Why third.** **Map A's step order is specification-stated.** These six
surfaces execute a sequence §3.2 fixes, and they cannot be usefully split
across phases without building a lifecycle that dead-ends. **S10 produces Map
B's input** — Area 3 cannot be participant-tested until this phase completes.

**Justifying artifacts.** Map A Steps 1–8; Product Architecture Index §3.2 on
the seams.

**Unlocks.** Phase 3 entirely. Area 3 entirely.

**Not blocked.** Decision 1 is reclassified as implementation and UX, governed
by the accepted thin-Application principle (Index §6.2). **Implementation scope
still varies with how it is answered**, but the answer is no longer an
architectural prerequisite to beginning the phase.

**Note.** S11 must work where issuance never occurred — §12 keeps principal
releasable even after permanent verification failure. That is not an edge case
to defer.

## Phase 3 · Handshake and observation spine

**Surfaces.** S31 Trust-Building Handshake · S20 supply and capacity dashboard ·
S21 registry and price status · S22 verification activity · S24 deployment
manifest.

**Why here, and why the Handshake is the pivot.** §5.2 specifies a **one-hour
commitment at approximately one dollar that walks the entire lifecycle.**
The protocol supplies the cheapest possible end-to-end participant test of the
product, and it becomes available the moment Phase 2 completes.

**Placing S31 immediately after Phase 2 is the single ordering decision that
most serves the assignment's twin objectives**: it is the earliest point real
participants can exercise real surfaces, and every defect it surfaces is found
before Area 3 is built on top.

**Justifying artifacts.** §5.2 and Map A's onboarding grouping; overlay O5;
Charter principles 2 and 4; Index §7.2, which makes the observation surfaces
possible only once deployment has occurred — which Phase 2 requires anyway.

**Unlocks.** Real participant feedback before the larger Area 3 build. S24
unlocks S02's claims moving from asserted to demonstrable.

**Not blocked.** Decision 21 is closed (Index §6.2).

## Phase 4 · Participation application

**Surfaces.** S12 stake · S13 position status and eligibility · S14
entitlements · S15 claim · S16 extension · S17 withdrawal · S23 epoch
dashboard · S32 calculators.

**Why fourth.** **Map B begins at holding, which Map A Step 7 produces.** No
participant can test any of these before Phase 2 has issued them a token.
Building them earlier means building against data that does not exist.

**Justifying artifacts.** Map B's scope boundary; Map B Stage 1's dependency on
Map A Step 7.

**Unlocks.** The full participation lifecycle.

**Not blocked.** Decision 8 is reclassified as implementation and UX (Index §6.2).

**Highest-risk content in the whole inventory.** S13 carries `[OPEN]` 9, the
eligibility rule Map B names as the least intuitive in the protocol; S16
carries `[OPEN]` 10, whose consequence is irreversible. **These two surfaces
warrant disproportionate design effort**, and the Handshake experience from
Phase 3 should inform them.

## Phase 5 · Gated and terminal surfaces

**Surfaces.** S18 SYNTH Forge · S19 portability · S04 token statistics ·
terminal-state presentation across S13 and S20.

**Why last.** **S18 is gated by the protocol itself** — unavailable until
100,000,000 cumulative lifetime CHONX issuance. Terminal state cannot be
reached for a long time and may never be during early operation.

**Justifying artifacts.** VF-TOK-005 and Map B Stage 1's gating; overlay P3.

**Blocked by.** `[OPEN]` 11 (S18 framing), `[OPEN]` 13 (whether terminal state
is presented before it is reached).

**Caution.** *Gated* does not mean *undesigned*. A participant who reaches the
Forge should not meet an unfinished surface, and **overlay O8 / VF-EXT-002
requires incompleteness be reported rather than papered over.**

## Sequence summary

| Phase | Surfaces | Gate |
|---|---|---|
| 0 · Reference foundation | S25, S26, S27, S30 | `[OPEN]` 5, 14 |
| 1 · Public understanding | S01, S02, S03, S05 | `[OPEN]` 15, 17, 18, 19 |
| 2 · Commitment application | S06–S11 | `[OPEN]` 1 · requires deployment |
| 3 · Handshake and observation | S20, S21, S22, S24, S31 | `[OPEN]` 21 · requires Phase 2 |
| 4 · Participation application | S12–S17, S23, S32 | `[OPEN]` 8 · requires Phase 2 |
| 5 · Gated and terminal | S04, S18, S19 | `[OPEN]` 11, 13 · protocol-gated |

---

# Part 5 · Unresolved product decisions

All twenty-two, from Map A (1–7), Map B (8–13) and Public Representation
Constraints (14–22). **None is resolved here.**

**Blocks implementation** means the surface cannot be built without the
decision, because the decision determines what the surface *is* rather than how
it looks.

| # | Decision | Surfaces affected | Blocks? | May proceed before resolution? |
|---|---|---|---|---|
| 1 | Application's role in proof construction | S08, S06, S07 | **No — reclassified** | Yes — implementation/UX governed by decision 2; Index §6.2 |
| 2 | ~~Optional notifications~~ | S07, S11 | — | **CLOSED** — Application remains intentionally thin; Index §6.2 |
| 3 | ~~Home page primary audience~~ | S01 | — | **CLOSED** — Intelligent Newcomer; Index §6.2 |
| 4 | Trust cluster explains vs asserts | S02 | No | Yes — affects depth, not existence |
| 5 | Whether and how §16 traceability is published | S25, S22, S30 | **Yes** | No — S25 exists only if published. **The only remaining blocker** |
| 6 | Signing-key risk disclosure | S02, S21, S05 | No | Yes — but resolve before public launch; VF-EXT-002 governs reporting |
| 7 | Presentation basis for post-issuance capabilities | S18, S19, S12–S17 | No | Yes — **appears discharged by Map B**; Index §6.1 flags closure as unrecorded |
| 8 | ~~Application offers epoch finalization or observes~~ | S23 | **No — reclassified** | Yes — implementation/UX under decision 2; §6.2 |
| 9 | Making the eligibility rule comprehensible | S13, S29 | No | Yes — but **highest misunderstanding risk in the protocol** |
| 10 | Communicating the extension gap rule | S16, S29 | No | Yes — but consequence is irreversible |
| 11 | Forge as conversion or milestone | S18 | No | Yes — framing, and protocol-gated regardless |
| 12 | Disclosing the rounding remainder | S14, S29 | No | Yes — overlay P2 is a disclosure, not a defect |
| 13 | Presenting terminal state before it is reached | S20, S13, S29 | No | Yes |
| 14 | ~~Publishing the specification and its hash~~ | S27, S02 | — | **CLOSED** — published with hash; §6.2 |
| 15 | ~~Registry display set closed or open~~ | S03, S21 | — | **CLOSED** — permissive-open; §6.2 |
| 16 | ~~How PRC-06's accuracy obligation is satisfied~~ | S06, S21, S32 | — | **CLOSED** — by presentation; §6.2 |
| 17 | ~~Market or venue data on public surfaces~~ | S05, S04 | — | **CLOSED** — none appears; §6.2 |
| 18 | ~~Communicating listing effort at all~~ | S05 | — | **CLOSED** — stated once, factually; §6.2 |
| 19 | ~~Scope of "public" under VF-PUB-002~~ | S03, S06, S21, S32 | — | **CLOSED** — applied uniformly; §6.2 |
| 20 | ~~What constitutes an economic promise at the margin~~ | S01–S05, S32 | — | **CLOSED** — future-value test; §6.2 |
| 21 | ~~Manifest surfaced publicly, and in what form~~ | S24, S02, S22 | — | **CLOSED** — published; §6.2 |
| 22 | ~~Consistency review on specification revision~~ | All | — | **CLOSED** — governed by VF-PUB-001; §6.2 |

## The one remaining blocking decision

| Phase | Blocking decision |
|---|---|
| 0 | 5 — whether and how §16 traceability is published |

**Every other phase is unblocked.** Decisions 14, 15, 16, 17, 18, 19, 20, 21 and
22 are closed at Index §6.2; decisions 1 and 8 are reclassified as
implementation and UX under the accepted thin-Application principle.

**Decision 5 blocks only S25's existence**, not any other surface and not the
architecture. It is a publish-or-not choice with the same shape as decision 21,
and Phase 0's other three surfaces proceed regardless.

**Decision 1 no longer blocks.** It is reclassified as an implementation and UX
decision governed by the accepted thin-Application principle. Phase 2's scope
still varies with how it is answered — but that is estimation, not architecture,
and the phase may begin.

---

# Part 6 · What this document does not contain

Recorded so its boundaries are testable.

**No page, screen, layout, navigation, menu, visual treatment, colour, brand,
copy, or wording.** No surface entry describes what anything looks like.

**No new protocol requirement.** Every `[SPEC]` citation traces to Master
Specification Revision 6.

**No resolved open decision.** All twenty-two remain open.

**No surface unjustified by an accepted artifact.** Each entry names its
derivation. Conventional surfaces absent for want of justification include a
blog, roadmap page, newsletter, social presence, support desk, community forum,
and status page. **Their absence is not a prohibition** — it means the current
baseline does not require them, and adding one would need justification rather
than assumption.

**No implementation detail.** No framework, hosting, data layer, or technology
choice appears, including where one might seem obvious.

---

# Revision policy

This document is a derivation. It changes when its sources change.

**Revise when:** an accepted artifact is revised · an open decision is resolved
in a way that changes what a surface is · a surface is found to lack
justification · a new surface is justified by a governing specification
revision.

**Do not revise to:** add a surface because it seems useful · record design
decisions, which belong in design artifacts · resolve an open decision by
assertion · reorder phases for delivery convenience rather than architectural
reason.

**Corrections are recorded visibly**, in the manner of Map A v2's corrections
table, rather than applied silently.

**Version numbers are whole integers.**

---

*Derived from Master Specification Revision 6 (hash verified), Presentation Map
A v2, Presentation Map B v1, Product Design Charter v1.0, Product Architecture
Index v1 and Public Representation Constraints v1. Surface labels S01–S32 are
document-local and carry no specification authority.*
