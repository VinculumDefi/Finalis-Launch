# Website and Application Derivation

**Version:** 1
**Status:** Proposed for independent review
**Phase:** Product Definition → Build
**Derived from:** Master Specification Revision 6 (hash
`5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9`),
Presentation Map A v2, Presentation Map B v1, Product Design Charter v1.0,
Product Architecture Index v1, Public Representation Constraints v1, Product
Surface Architecture v1, Product Experience Architecture v1

> **Derivation artifact. It governs nothing.** Where this document conflicts
> with an accepted artifact, **the accepted artifact prevails and this document
> is defective.**

---

## How this document relates to the two artifacts nearest it

Product Surface Architecture v1 derived **what surfaces exist** — S01 through
S32. Product Experience Architecture v1 derived **how a participant moves
through them** — E1 through E8, V0 through V4.

Neither derived **where those surfaces live.** S03 Supported Assets exists; no
accepted artifact says whether it is a page on the public website or a view
inside the application. That allocation is the work this document does, together
with the journeys, structures and build order that follow from it.

**This document therefore references the prior two rather than restating them.**
Product Architecture Index Section 1.3 warns that restating a derivation invites
the two copies to diverge. Where a surface's purpose, audience, governing
artifacts, evidence and post-deployment dependencies are already stated in
Product Surface Architecture v1, they are **cited, not repeated.** What appears
here is what is new: allocation, structure, journeys, and the consequences of
both.

**Nothing below introduces a surface not in S01–S32, a phase not in E1–E8, a
principle not in the Charter, or a protocol behaviour not in the Master
Specification.**

---

# Part 1 · Product overview

## The product is one thing, not four

It is natural to describe Vinculum as a website, an application, a set of
dashboards and a documentation site. **The accepted architecture does not
support that division**, for a reason worth stating precisely.

Product Surface Architecture Part 1 records that documentation participates in
**seven of eight experience phases**, because every one of Map A's eight steps
names a `docs` surface. The rules live in documentation and the application
references them rather than restating them. A product where the documentation
is a separate property is a product where the application must restate the
rules — and where the two copies diverge.

The same is true of verification. Product Surface Architecture Area 5 exists as
a first-class area because Map A treats **verifier and skeptic as first-class
audiences rather than edge cases.** Verification that is a page rather than a
property of the whole product would let a dashboard stand in for it, which is
precisely the failure the Charter's North Star names.

## What the product is

**A single body of material that lets a person progress from having never heard
of Vinculum to being able to confirm, without the product's help, that the
protocol did what it says.**

Four things compose it, and they are not peers:

**The explanatory layer** teaches. It is public, requires nothing of the
visitor, and is governed end to end by PRC-04 and PRC-09 — language derives from
the current specification and adds no economic promise and no unspecified
feature.

**The evidence layer** shows. It is public, reads chain state and published
artifacts, and requires no participant identity. Dashboards live here, and so
do the deployment manifest and the machine-readable registry.

**The instrument layer** acts. It is the application. It requires a wallet
because it requires the participant's own state. Map A's design principle
governs it: **the application is an instrument panel, not an autopilot.**

**The reference layer** governs. The preserved specification and the rules
derived from it. PRC-01's consequence: **no product surface may position itself
as the authoritative description of protocol behaviour**, because a more
authoritative one is preserved and available.

## How they work together

A visitor meets the explanatory layer. It teaches by pointing at the evidence
layer rather than by asserting. When the visitor acts, the instrument layer
performs what the explanatory layer described, and reports outcomes by pointing
at the evidence layer again. Every claim in all three resolves to the reference
layer.

**The product succeeds when the participant stops needing the first and third
layers.** That is not a failure mode. It is the North Star, stated as a
structural property: the explanatory and instrument layers exist to make
themselves unnecessary, and the evidence and reference layers are what remain.

---

# Part 2 · The website / application boundary

**This is the central derivation of this document.** Everything in Parts 4
through 6 follows from it.

## The rule, and where it comes from

> **A surface belongs to the public website if it can be used without a wallet.
> It belongs to the application if it requires the participant's own state.**

**Derived from Charter principle 2** — teach before asking for action. If
understanding required connecting a wallet, the product would ask for an action
before teaching, inverting the principle. **Reinforced by Map A's audiences**:
first-time visitor, prospective participant and skeptic have all not acted, and
the skeptic may never act. A product that gates understanding behind connection
serves three of six audiences not at all.

**Reinforced again by the North Star.** The destination is a participant who no
longer relies on the application. Everything that survives that transition must
therefore be reachable without the application.

## The critical distinction this rule does not make

**This boundary is not an answer to open decision 19.** Decision 19 asks whether
"public" under VF-PUB-002 extends to application displays visible only after
wallet connection — that is, how far the **price-disclosure obligations** reach.

This rule allocates surfaces to properties. Decision 19 governs obligations.
**A surface placed in the application by this rule may still carry every
VF-PUB-002 obligation**, depending on how 19 resolves. Conflating the two would
resolve an open decision by side effect. **Decision 19 remains open.**

## The resulting allocation

**Public website — 18 surfaces**

S01 · S02 · S03 · S04 · S05 · S20 · S21 · S22 · S23 · S24 · S25 · S26 · S27 ·
S28 · S29 · S30 · S32 · and the explanatory half of S31

**Application — 14 surfaces**

S06 · S07 · S08 · S09 · S10 · S11 · S12 · S13 · S14 · S15 · S16 · S17 · S18 ·
S19 · and the executing half of S31

## What the allocation reveals

**Every dashboard is public.** S20, S21, S22 and S23 read chain state, not
participant state. Nothing in them requires a wallet. Placing them behind
connection would make observation conditional on participation, which
contradicts Map A's treatment of the skeptic as a first-class audience — a
skeptic must be able to watch the protocol operate without ever touching it.

**Verification is entirely public.** S24 through S27 and S30 require nothing.
Product Experience Architecture Section 7.4 derives this as ungated: **a
skeptic may reach V4 without ever committing.**

**Calculators are public.** S32's arithmetic needs no wallet; multipliers are
fixed in an immutable contract and weight is computable by anyone from public
data. Only live participant-specific preview requires connection.

**The application is smaller than expected.** Fourteen surfaces, all of which
either act on the participant's behalf or display their own state. **Nothing
explanatory lives inside it.** The application references the reference layer
rather than embedding it — which is what stops the two copies diverging.

**S31 spans the boundary.** The Handshake's explanation is public; its execution
is a real commitment requiring a wallet. **`[OPEN]` 26** — whether these are one
surface presented across both properties or two surfaces. **Not resolved here.**

---

# Part 3 · Visitor journeys

Six audiences, from Map A's `[DESIGN]` audiences list. **They do not share a
path**, and forcing them to would serve none of them.

Phases referenced are Product Experience Architecture's E1–E8; verification
levels are V0–V4.

## First-time visitor

**Entry.** S01.
**Path.** E1 → E2. S01 → S02 → S05 → S03.
**What they are doing.** Deciding whether this is worth further attention.
**Where they exit.** Most leave at S01 or S02. That is not a failure —
**Charter principle 1: the protocol informs, the participant decides.**
**Verification level reached.** V1 at most.
**What must be true.** They can state what the protocol does and does not
promise before any action is available to them.

## Skeptic

**Entry.** S01, or directly at S24 or S27 if they arrived from a technical
source.
**Path.** E1 → verification, bypassing E2 through E8 entirely.
S01 → S02 → S24 → S27 → S25 → S22 → S20.
**What they are doing.** Looking for the lie.
**Where they exit.** Anywhere. **They may never commit and the product must
still serve them completely.**
**Verification level reached.** **V4 — the highest of any audience, without
ever acting.**
**What must be true.** Every claim S02 makes is checkable at S24 or S27 without
a wallet, without an account, and without asking anyone. Map A's `[DESIGN]`
judgement treating the skeptic as first-class, supported by §16 and VF-VER-006's
preference for **independent reproduction over self-reported pass counts**, is
tested by exactly this path.

## Prospective participant

**Entry.** S01 or S03.
**Path.** E1 → E2 → E3 or E4. S01 → S02 → S03 → S28 → S32 → S31 or S06.
**What they are doing.** Answering *do I want this deal?*
**Verification level reached.** V1, V2 during rehearsal.
**What must be true.** Every concept in Product Experience Architecture Section
7.1 is available before S06 becomes reachable — including the non-refundable
fee, which is a `required` warning at Map A Step 2, and principal returning
regardless, which bounds the worst case.

## Existing participant

**Entry.** The application, at S10.
**Path.** E6 → E7 and E8 concurrently. S10 → S11 on the custody track; S10 →
S12 → S13 → S14 → S15 → S16 → S17 on the participation track, cycling every
epoch.
**What they are doing.** Operating. Returning repeatedly.
**Verification level reached.** V2 routinely, V3 when they check a number.
**What must be true.** **The two tracks remain independent.** A participant can
complete Map A Step 8 having never reached Map B; principal remains releasable
where verification failed permanently and no token was ever issued. `[OPEN]` 23
governs how both are held in mind and is unresolved.

## Verifier

**Entry.** S24 or S25.
**Path.** Verification only, at any time, participant or not.
S24 → S27 → S25 → S30 → S26 → S22 → S23.
**What they are doing.** Confirming the system is what it says.
**Verification level reached.** V4, including the permissionless rung —
**submitting a proof (VF-XCH-012) or finalizing an epoch (VF-STK-008), where
anyone may act and no actor gains authority by acting.**
**What must be true.** S24 carries every category PRC-03 requires — live
address, environment identifier, source commit, bytecode hash, dependency,
fixed Dev Fund destination — and where an entry is unavailable, **VF-EXT-002
requires it be reported as incomplete rather than replaced with an invented
value.**

## Developer

**Entry.** S30.
**Path.** S30 → S26 → S24 → S27 → S25.
**What they are doing.** Building against, integrating with, or reproducing the
protocol.
**Verification level reached.** V4.
**What must be true.** S26 is consumable as data, not only as a page. PRC-02
requires preservation of asset identity, environment, classification, pricing
identifier and source metadata — **classification is preserved here without
being among PRC-05's eight display fields**, which is why open decision 15
matters to developers as well as to the registry page.

## What the six journeys show

**Three of six audiences never need the application.** Skeptic, verifier and
developer complete their entire journey on the public website. **Two of the
three reach V4, the deepest verification level, while the participant journeys
typically reach V2 or V3.**

This is an unconventional result and it is derived, not chosen. It follows from
Map A treating verifier and skeptic as first-class rather than edge cases. A
product built to a conventional funnel — where every path converges on
conversion — would serve the audiences who most test the protocol's honesty
least well.

---

# Part 4 · Website structure

Eighteen public surfaces, grouped by function. **Groupings are `[DESIGN]`;
every surface is required by an accepted artifact.**

Per-surface purpose, audience, governing artifacts, evidence and
post-deployment dependencies are stated in **Product Surface Architecture Part
2** and are not repeated. What follows is what that document does not state:
**what must never be omitted, and what must never appear.**

## 4.1 Landing and orientation

**S01 Protocol Introduction**
*Never omit:* what the protocol does not do and does not promise. **Charter
principle 7** — a first encounter that omits limitations is a persuasion
surface.
*Never include:* any economic projection, return figure, or forward value
statement. PRC-04's first prohibition.
*Blocked by* `[OPEN]` 3 — which audience it primarily serves. **This determines
what the surface is, not how it reads.**

**S02 Trust Cluster**
*Never omit:* the four claims of Map A's grouping — no one controls this
(§2, §15); your asset never moves (Step 3); principal returns even if everything
else fails (§12); failure is fail-closed and substitutes nothing (§14,
VF-SEC-003).
*Never include:* an assurance not checkable at S24 or S27. **Charter principle
4: the application should never ask someone to trust what they can instead
verify.**
*Shaped by* `[OPEN]` 4 — how much it explains versus asserts.

## 4.2 Asset and protocol information

**S03 Supported Assets**
*Never omit:* price source and last update time wherever price appears —
**VF-PUB-002, mandatory, not merely permitted.**
*Never include:* fields outside PRC-05's resolution. **Blocked by `[OPEN]` 15**,
which determines whether the eight enumerated fields are a closed set.

**S04 Token Statistics**
*Never omit:* that issuance figures are cumulative lifetime figures and that
capacity is finite.
*Never include:* a supply projection or decay schedule until **`[OPEN]` 20**
determines whether such a projection constitutes an implied economic promise
under PRC-04.

**S05 Market and Listing Disclosures**
*Never omit:* that no exchange listing, liquidity level, market price,
redemption value or appreciation is guaranteed (VF-TOK-015); that external
market activity alters no protocol rule (VF-TOK-014); that listing pursuit is a
development objective, not a promise (§17.2).
*Never include:* a timeline, likelihood or expectation regarding any listing.
*Blocked by* `[OPEN]` 17 and 18 — which together determine whether this surface
exists distinctly or is absorbed into S01 and S02.

## 4.3 Evidence and observation

Four dashboards, all public. Their purpose, audience and evidence are stated in
Product Surface Architecture entries S20–S23.

**S20 Supply and Capacity** — *never omit* that capacity is finite and the
protocol has a defined end state at which **nothing is stranded** (overlay P3),
subject to `[OPEN]` 13.
**S21 Registry and Price Status** — *never omit* that refresh is twice daily,
so a displayed figure may be close to twelve hours old, and that source and
update time accompany every price.
**S22 Verification Activity** — *never omit* failures. A verification dashboard
showing only successes is an assertion surface.
**S23 Epoch Dashboard** — *never omit* that **T0 and every boundary are
computable by anyone** and that finalization is permissionless. *Blocked by*
`[OPEN]` 8, which determines whether this surface also performs.

## 4.4 Verification

**S24 Deployment Manifest** — *never omit* any of PRC-03's six categories;
where one is unavailable, **VF-EXT-002 requires reporting it as incomplete
rather than substituting a value.** *Blocked by* `[OPEN]` 21.
**S25 Traceability Publication** — *never omit* the requirement each test
traces to (VF-VER-001). *Never include* a pass count presented as sufficient —
**VF-VER-006 prefers independent reproduction; VF-VER-007: nothing is
production-ready merely because it compiles.** *Blocked by* `[OPEN]` 5.
**S26 Machine-Readable Registry** — *never omit* the five PRC-02 categories.
*Never* conflate with S03's display set.

## 4.5 Reference

**S27 Preserved Master Specification** — *never omit* the hash, if published at
all; *blocked by* `[OPEN]` 14.
**S28 Commitment Rules Reference** — *never omit* fee calculation, rounding,
fee routing, per-environment finality, maturity, and §5.2's handshake allowance
lifecycle including that **rejected attempts consume no allowance**
(VF-COM-008).
**S29 Participation Rules Reference** — *never omit* the two-epoch eligibility
rule and the gap rule. **Carries `[OPEN]` 9, 10, 12 and 13** — all four of the
hardest explanations land here as well as in their application surfaces.
**S30 Developer and Verifier Reference** — *never omit* reproduction
procedures. Independent reproduction is the point (VF-VER-006).

## 4.6 Learning

**S32 Calculators** — *never omit* that computed values are computed, not
promised. **Sits closest to `[OPEN]` 20's edge** of any surface in the
inventory.
**S31 explanatory half** — *never omit* that the Handshake is a **real
commitment on a real chain**, not a simulation, and that its fee is
non-refundable like any other.

## What the website must never contain

Derived by absence: **no accepted artifact justifies** a blog, roadmap page,
newsletter, team page, testimonials, partner logos, press section, community
forum, social feed, FAQ that restates rules the reference layer owns, or any
countdown, milestone or launch-hype surface.

**Their absence is not a prohibition.** It means the current baseline does not
require them, and adding one would need justification rather than assumption.
**Two are closer to prohibited than merely unjustified:** anything presenting a
listing as expected (§17.2, PRC-08) and anything presenting a price as a
guaranteed trading price (VF-PUB-002).

---

# Part 5 · Application structure

Fourteen surfaces. Per-surface detail is in Product Surface Architecture
entries S06–S19 and S31.

**Governing principle for the whole application**, from Map A: **the
application is an instrument panel, not an autopilot.** §12 makes principal
release user-initiated; VF-XCH-012 gives the relayer no authority; §2 removes
post-deployment control. **Notifications are optional conveniences; the journey
is never notification-driven.**

## 5.1 Commitment and preflight — S06

Map A Steps 1–3. Selection, preflight, source transaction.
*Never omit:* the **non-refundable fee warning — `required` at Map A Step 2**,
not a presentation choice. Price source and update time on any displayed price.
*Never include:* a default that substitutes for a participant choice —
**VF-SEC-003: no failure path may substitute a default asset, price,
environment, user, recipient, output, duration, multiplier or Dev Fund
destination.**
*Shaped by* `[OPEN]` 16 — expected to be satisfied by presenting the
commitment's own figures as the commitment's own figures.

## 5.2 Commitment management — S07, S08

Map A Steps 4–5. Tracking through finality and proof.
*Never omit:* **pending disposition — `required behaviour` at Map A Step 4.**
*Blocked by* `[OPEN]` 1 — the application's role in proof construction, which
Map A frames as determining **the application's thickness.** This is the
largest scope uncertainty in the product and it sits mid-critical-path.

## 5.3 Issuance — S09

Map A Steps 6–7.
*Never omit:* the derivation of the issued amount. **Charter principle 3 —
evidence over assertion** — makes a reported number without its derivation
insufficient.
*Never* present the Reward-Accounting Credit as a subordinate detail of
issuance. Index §3.2: **RAC is created at fee verification independently of
issuance and can exist where issuance does not.** Map A v2 corrected exactly
that error.

## 5.4 Portfolio — S10

The seam between both maps. Map A Step 7 and Map B Stage 1.
*Never* couple the custody track to the participation track. **A participant
can complete Map A Step 8 having never reached Map B.**

## 5.5 Maturity and principal release — S11

Map A Step 8, source chain, parallel track.
*Never omit:* that release is user-initiated and that **the user owns
remembering.**
*Never* make this surface conditional on issuance having occurred. §12 keeps
principal releasable after permanent verification failure — **the participant
who most needs this surface is the one for whom issuance never happened.**

## 5.6 Participation — S12, S13, S16, S17

Map B Stages 2, 3, 6, 7.
*Never* imply a mandated sequence. **Map B's stage order is `[DESIGN]`
derivation; §10 states no participant order.**
*Never omit:* at S13, the two-epoch eligibility rule — **the least intuitive
rule in the protocol** (`[OPEN]` 9). At S16, that **an expired position cannot
retroactively cover a gap** (VF-STK-025, `[OPEN]` 10). At S17, that
**withdrawal does not erase accumulated claimable VCLM** (VF-STK-020).
*Never* extend a position on a participant's behalf. **Charter principle 6.**

## 5.7 Rewards — S14, S15

Map B Stages 4, 5.
*Never omit:* that claimable VCLM **accumulates and never expires**
(VF-STK-016); that rewards are paid **only in newly minted VCLM** (VF-STK-004);
that the reward pool uses the **permanent $0.10 Reward Reference Value, not an
oracle or market price** (VF-RAC-005).
*Never* imply a zero-weight or capacity-exceeded epoch carries value forward.
**VF-STK-015 and VF-STK-028: it mints nothing, closes, marks its credits used,
and carries nothing forward. Partial epoch minting is prohibited.**

## 5.8 Gated capabilities — S18, S19

*Never* present the Forge as reversible. **One-way, with no reversal,
redemption or administrative restoration path** (VF-TOK-005).
*Never* present portability as issuance. **Transport is not issuance**
(VF-XCH-021); no independent supply may exist on another chain (VF-XCH-019).

## 5.9 Verification inside the application

**Limited by derivation.** The application's verification role is to point
outward: explorer links at S06, S07, S09; the reproducible entitlement
calculation at S14; the reproducible weight at S12. **Everything deeper lives on
the public website**, because V3 and V4 must remain reachable by someone who
never connects a wallet.

## 5.10 Participant settings — not derivable

**The assignment lists participant settings. No accepted artifact requires
them, and this document does not invent them.**

Examined and rejected: reward destination is **bound to the position** at
creation (VF-STK-019), not a global setting. Duration and multiplier are fixed
at commitment (Map A Step 1). Nothing in §10 or §12 is user-configurable after
the fact — the protocol has **no admin, no upgrade path, no pause authority**,
and correspondingly few knobs.

**The single candidate is `[OPEN]` 2 — optional notifications.** If that
resolves toward offering them, a minimal preference surface follows from it. If
it resolves against, **no settings surface exists at all**, and that is the
faithful outcome rather than a gap.

---

# Part 6 · Dashboards

Four, all public, all derived. Purpose, evidence and post-deployment
dependencies are stated in Product Surface Architecture entries S20–S23.

| Dashboard | Why it exists | Serves | Required by | Decisions it enables |
|---|---|---|---|---|
| **S20 Supply and Capacity** | Map A's `[DESIGN]` dashboard spine — a decision to treat §13 as a dashboard's organising principle | All six audiences | §13, overlay O4 | Whether to commit now; whether CHONX has activated; whether the Forge is available |
| **S21 Registry and Price Status** | Map A Steps 1 and 2 name both as dashboard surfaces | Prospective participant, verifier, skeptic | §6, §7, overlay O7, PRC-05/06/10 | Whether a price is current enough to act on |
| **S22 Verification Activity** | Map A Step 6 names it | Verifier, skeptic, existing participant | §11, §16, overlays O2, O3 | Whether the verification path is operating; what failure looks like |
| **S23 Epoch Dashboard** | Map B Stages 3 and 4 name three dashboard surfaces | Existing participant, verifier, observer | §10.2, §10.4, overlay P1 | Whether to stake now; whether to extend before an epoch boundary |

## What every dashboard must present

**Evidence, not conclusions.** Charter principle 3 prefers evidence over
assertion, and a dashboard is the surface most tempted to present a computed
summary as a fact. Each of the four presents figures that are independently
recomputable: **T0 and every epoch boundary computable by anyone; weight
computable from public position data; the full entitlement allocation
reproducible from public data.**

## What no dashboard may do

**Stand in for verification.** Product Surface Architecture Part 1 separates
Areas 4 and 5 for this reason: observation answers *what is happening*;
verification answers *how do I check this myself without trusting you*. **A
dashboard that satisfies the second question has been misdesigned**, because it
has made the participant dependent on it — the opposite of the North Star.

---

# Part 7 · Verification experience

Fully derived in **Product Experience Architecture Section 8** as levels V0–V4.
Not restated. What follows is what that section does not state: **how the
levels attach to the six things a participant might verify.**

| What is verified | V1 shown | V2 located | V3 reproduced | V4 independent |
|---|---|---|---|---|
| **Protocol state** | S20, S04 | S24 addresses | — | Bytecode hash vs source commit (PRC-03) |
| **Commitments** | S07 | Explorer links | — | Source-chain timelock read directly |
| **Issuance** | S09 | Explorer links | Amount from price record and duration | Verifier contracts (S30) |
| **Participation** | S13 | S23 | Weight; eligibility for any epoch | — |
| **Rewards** | S14 | S23 | **Full allocation from public data** | **Finalize an epoch — VF-STK-008** |
| **Principal release** | S11 | Explorer links | — | §12 read directly at S27 |

## Why this cannot be reduced to dashboards

Two of the V4 cells are **actions, not readings.** Map B records that
**permissionless finalization and permissionless proof submission express the
same principle: anyone may act, and no actor gains authority by acting.**

A participant who finalizes an epoch learns something about the control model
that no dashboard conveys — they have exercised a capability the protocol grants
everyone equally and observed that it changed nothing about the outcome. **This
is the deepest verification the product can offer, and it is a verb.**

`[OPEN]` 8 determines whether the application offers it or leaves it to
independent tooling. **Unresolved.**

## How the verification experience embodies the Charter

**Principle 4** — the application should never ask someone to trust what they
can instead verify. Every V1 cell above must lead to its V2 cell; a shown figure
with no path to its source is an assertion.
**Principle 3** — evidence over assertion. The ladder's direction of travel.
**Principle 6** — the participant retains responsibility. Verification is
offered, never performed on their behalf and reported as done.
**The final principle** — the product's purpose is not to become indispensable.
**V4 is the level at which the product becomes unnecessary, and the product is
built to get people there.**

---

# Part 8 · Educational experience

Fully derived in **Product Experience Architecture Section 7** as educational
dependency. Not restated. The prerequisite sets are:

| Before | Prerequisites | Where stated |
|---|---|---|
| **Committing** | Eight concepts — asset never moves; fee non-refundable; principal returns regardless; duration fixed at creation; price has a source and an age; finality varies by chain; failure is fail-closed; pending attempts have a defined disposition | PEA §7.1 |
| **Staking** | Seven concepts — weight formula; acquisition history irrelevant; rewards are minted VCLM only; epochs are exactly 10 days; **the two-epoch eligibility rule**; **the gap rule**; the permanent $0.10 reference | PEA §7.2 |
| **Claiming** | Claims never expire; claims transfer already-minted VCLM and do not mint again or consume capacity (VF-STK-018); claims pay only the position owner or bound destination (VF-STK-019) | PEA §7.3 |
| **Releasing** | Release is user-initiated; principal returns even where issuance never occurred; **the user owns remembering** | PEA §7.1, §7.3 |
| **Independently verifying** | **None.** Ungated by derivation | PEA §7.4 |

## The one structural tension, restated because it governs the build

**Charter principle 2** says teach before asking for action. **Principle 5** says
introduce complexity progressively, when relevant. For the eligibility rule they
conflict: it is relevant only after staking, but its consequence — losing an
already-earned entitlement by lapsing one day early — argues for teaching it
before.

**This is `[OPEN]` 9 and no part of this document resolves it.** It is named
here because it is the single hardest content problem in the product and it
determines how S13 and S29 relate.

## What education must never do

**Simplify by concealment.** Charter principle 5: complexity should be
understandable, not invisible. **The protocol should never be oversimplified by
hiding important mechanics.**

**Substitute reassurance for evidence.** Principle 3. An explanation that ends
in "you can trust that this works" has failed where one ending in "here is how
to check" would have succeeded.

---

# Part 9 · Cross-cutting experiences

Six properties that belong to no single surface. **Four are already derived as
cross-cutting obligations in Product Surface Architecture Part 3** and are cited
here rather than restated.

| Property | How it appears throughout | Source |
|---|---|---|
| **Trust** | Not a page. The trust cluster (S02) states the four claims; **S24 and S27 make them checkable.** Trust that cannot be discharged into evidence is persuasion. | Map A grouping; Charter 4 |
| **Verification** | Every V1 surface must lead to its V2 source. **Explorer links attach to S06, S07, S09, S21, S22** — wherever a transaction is referenced. | PSA Part 3; PEA §8 |
| **Transparency** | The evidence layer is public and ungated. Dashboards require no wallet; the manifest and registry require nothing at all. | PSA Areas 4, 5 |
| **Education** | Documentation participates in **seven of eight phases**. The application references the reference layer rather than embedding it. | PEA §4 |
| **Disclosure** | **Two `required` behaviours** — the non-refundable fee warning (Map A Step 2) and pending disposition (Map A Step 4) — plus **price source and update time wherever price appears** (VF-PUB-002), subject to `[OPEN]` 19. | PSA Part 3 |
| **Technical reference** | S27 is upstream of every concept. **No surface may position itself as more authoritative than the preserved specification.** | PRC-01 |

## The two that govern everything without exception

**PRC-04 and PRC-09.** Language derives from the current specification, adds no
economic promise and no unspecified feature, and **remains consistent as the
specification changes.** Public Representation Constraints records these as the
two constraints **most likely to be violated by ordinary inattention rather than
intent** — a phrase written for clarity that adds a feature, or a page left
unrevised after a specification revision.

**Consequence for the build:** a specification revision is not only an
engineering event. **VF-PUB-001 makes it a product event**, and `[OPEN]` 22 asks
whether that review is a recorded required step. Unresolved.

---

# Part 10 · Product flow

Derived from **Product Experience Architecture Section 3**. The phase model is
not restated; what follows is the human experience it describes.

**"I've never heard of Vinculum."**
E1. S01 says what it is and what it does not promise. Nothing asks for anything.

**"I think I understand what it claims."**
E2. S02 makes four claims and points at where each is checkable. S03 shows what
is supported and, beside every price, where the price came from and when.

**"I don't believe it."**
The skeptic's fork. S24, S27, S25. **The claims either survive independent
checking or they do not, and nothing on the path asks for patience or good
faith.** This branch may end the journey — and the product has still done its
work.

**"I'd like to see it happen without risking anything."**
E3. The Handshake — a real commitment on a real chain, one hour, about a dollar.
**Optional, never a gate.**

**"I want this deal."**
E4. S06. The fee warning is required and appears before the transaction, not
after.

**"Is it working?"**
E5. S07. Finality varies by chain; a pending attempt has a defined disposition.
**Charter principle 7 — the honest treatment of delay and failure belongs here
or nowhere.**

**"I have it, and I can see why that amount."**
E6. S09 shows the issuance and its derivation. S10 shows what is held.

**Then the path forks, and stays forked.**
E7 on the source chain — principal maturing, releasable by the participant
alone, releasable even if everything on Base failed. E8 on Base — holding,
staking, earning across ten-day epochs, claiming, extending, withdrawing.
**Cyclical. The epochs recur.**

**"I checked the number myself and it matched."**
V3. The first moment the participant could have caught the product being wrong.

**"I no longer need the application to tell me the protocol is working."**
V4. The manifest, the specification, the chain. **The participant can confirm
what happened without the product present** — and, if they choose, act within
the protocol without asking anyone's permission.

**That is the destination, and it is the Charter's, unchanged:**

> The product succeeds when a participant no longer relies on the application to
> tell them the protocol is working, because they have learned how to verify it
> themselves.

---

# Part 11 · Build order

**Product Surface Architecture Part 4 derives six implementation phases.** That
sequence is accepted and is not re-derived. What this document adds is the cut
that matters for scheduling: **which surfaces can be built before deployment,
and which cannot.**

## The pre-deployment set

From Product Architecture Index §7.2's evidence availability table. **These
require no deployed contract and can be built now, in full:**

S25 traceability · S27 preserved specification · S30 developer reference ·
S26 registry contents · S28 commitment rules · S29 participation rules ·
S01 introduction · S05 disclosures · S32 calculator arithmetic

**Partially buildable now:** S02 trust cluster — it can state the claims, but
**contract code and absence of control are provable only post-deployment**, and
until then **VF-EXT-002 requires the gap be reported as incomplete rather than
papered over.** S03 supported assets — contents now, **registry immutability
only post-deployment.**

**Not buildable before deployment:** S04, S06–S24 excepting the above, S31.
Every one depends on chain state that does not yet exist.

## Ordering, with the website/application cut applied

| Order | What | Property | Why here |
|---|---|---|---|
| **1** | S27, S26, S30, S25 | Website | **PRC-04 requires all language derive from the specification.** Anything built first must be rewritten. Also the entire verifier and developer journey — two of six audiences served completely, pre-deployment. |
| **2** | S28, S29, S32, S01, S05, S02 | Website | **Charter principle 2 — teach before asking for action.** Building the application first inverts the Charter's own ordering. Buildable now. |
| **3** | S06–S11 | Application | Map A's step order is **specification-stated**; the six cannot be split without building a lifecycle that dead-ends. **Requires deployment.** |
| **4** | S31, S20, S21, S22, S24, S03, S04 | Both | **The Handshake is the protocol's own participant test** — one hour, one dollar, the whole lifecycle. Available the moment order 3 completes. Earliest real feedback. |
| **5** | S12–S17, S23 | Application | **Map B begins at holding, which Map A Step 7 produces.** Cannot be participant-tested before order 3. |
| **6** | S18, S19 | Application | **Protocol-gated** — the Forge requires 100,000,000 cumulative CHONX. *Gated does not mean undesigned.* |

## Implementation risk, ranked

**Highest — `[OPEN]` 1.** The application's role in proof construction
determines **the application's thickness** and sits mid-critical-path in order
3. Nothing about order 3's size can be estimated until it is settled.

**High — the Phase 1 decision cluster.** `[OPEN]` 3, 15, 17, 18 and 19 all
block order 2, and four of the five turn on how §17's permissions and scope are
read. **Resolving them as one set is likely cheaper than one surface at a
time.**

**High — S13 and S16 content.** `[OPEN]` 9 and 10 carry the protocol's least
intuitive rule and its only silently-arriving irreversible consequence. **These
two surfaces warrant disproportionate design effort**, informed by order 4's
Handshake feedback.

**Moderate — `[OPEN]` 8.** Determines whether S23 performs or only observes,
which changes its nature.

## What this ordering deliberately does not optimise for

**Launch marketing.** No surface is sequenced to support an announcement. The
sequence follows dependency, Charter ordering, and the availability of evidence.

**Familiarity.** Building the verifier and developer path first is
unconventional. It is derived from Map A treating those audiences as
first-class and from the fact that theirs is the only complete journey available
pre-deployment.

---

# Part 12 · Acceptance criteria

## For this document

1. Every surface, journey, structure and ordering traces to an accepted
   artifact, and the trace is stated rather than implied.
2. No surface appears that is not S01–S32; none is renamed or renumbered.
3. No new protocol behaviour, product principle, phase or verification level
   appears.
4. **No open decision is resolved.** Twenty-five prior remain open; the one
   added — 26 — is stated as open.
5. No colour, typography, brand, logo, layout, component, wireframe, CSS, HTML,
   React or implementation detail appears.
6. The website/application boundary is derived from Charter principle 2 and
   **explicitly distinguished from `[OPEN]` 19**, which it does not resolve.
7. Map A's step order is preserved as specification-stated; Map B's stage order
   as `[DESIGN]` derivation.
8. The E7/E8 fork is preserved: **no statement implies principal release depends
   on issuance or participation.**
9. Verification is treated as continuous and public, reachable without a wallet.
10. The Charter's destination is used, not rewritten.
11. Where the assignment named a surface that cannot be derived — participant
    settings — **the absence is stated with reasons rather than filled.**

## The final question, answered honestly

> *If a world-class product design team received only this document and the
> accepted baselines, could they faithfully build Vinculum without inventing
> anything important?*

**Not yet — and the obstruction is not this document.**

They could build **orders 1 and 2 of Part 11 completely**: the reference layer,
the verification layer, the calculators, the disclosures — nine surfaces, the
entire verifier and developer journey, and most of the skeptic's. That work is
fully specified by the accepted baselines and requires no invention.

**They could not build order 2's public-facing surfaces without inventing
answers to five blocking open decisions** — 3, 15, 17, 18 and 19 — which
determine what S01 *is*, what S03 *may contain*, whether S05 exists distinctly,
and how far the price obligations reach. **They could not scope order 3 without
`[OPEN]` 1.**

**Nine of twenty-six open decisions block implementation.** No amount of further
refinement of this document resolves them, because they are product decisions
reserved to the operator, not derivations available from the artifacts. **A
document that answered them would be inventing exactly what this phase has
spent its discipline avoiding.**

**The blueprint is therefore complete as a derivation and conditionally
sufficient for build.** The condition is the decision set, not more architecture.

---

# Part 13 · Independent review

Five lenses. **Genuine defects only.** Findings recorded, not silently fixed.

## Product Strategist

**Finding 1 — three of six audiences never enter the application, and the
document does not say what that means commercially.** The derivation is sound
and follows from Map A's audience list. **The strategic consequence is
unaddressed** because addressing it would require goals no accepted artifact
states. Recorded as a real gap in the artifact set, not a defect in this
derivation.

**Finding 2 — Part 11's ordering builds the verifier path before anything a
prospective participant can act on.** Correct by derivation and **uncomfortable
in practice**: months of work serving audiences who may never commit. The
justification is that it is the only complete journey available pre-deployment.
A reviewer should test whether that justification is sufficient.

## UX Architect

**Finding 3 — the wallet-connection boundary is clean but not obviously
correct at S32.** Calculators are placed public because the arithmetic needs no
wallet, yet Map A Step 2's preflight is the same computation with the
participant's own inputs. **The boundary splits one concept across two
properties.** Recorded; not fixed, because fixing it means either duplicating
the calculator or gating it, and both have costs the accepted artifacts do not
adjudicate.

**Finding 4 — `[OPEN]` 23 remains the largest unaddressed experience problem.**
After issuance a participant holds two concurrent tracks on two chains with
independent timelines. Part 5.4 forbids coupling them; nothing states how a
participant is helped to hold both.

## Trust & Security Reviewer

**Finding 5 — Part 4's "never include" lists are not exhaustive and could be
read as such.** They state what the accepted artifacts forbid. **A reviewer
should not treat them as a complete prohibition list**, and PRC-04's edge —
`[OPEN]` 20, what constitutes an economic promise at the margin — remains
undefined.

**Finding 6 — S22 must show failures, and nothing enforces that.** Part 4.3
states it. It rests on Charter principle 7 rather than on a numbered
requirement. **A genuine weakness in the artifact chain**, not in this document:
no `[SPEC]` requirement compels a verification dashboard to display its
failures.

## Technical Communicator

**Finding 7 — Parts 7, 8 and 10 cite prior artifacts heavily rather than
restating them.** Deliberate, per Index §1.3 on divergence. **The cost is that
this document is not self-contained**, contrary to how a blueprint is usually
read. A team receiving only this and the baselines has everything; a team
receiving only this does not.

**Finding 8 — the eligibility rule appears in five places across the artifact
set.** PSA S13 and S29, PEA §2 and §7.2, and here in Parts 5.6 and 8.
Repetition is deliberate — it is the protocol's hardest rule — but **five
statements of an unresolved problem is a signal that `[OPEN]` 9 should be
resolved before more artifacts reference it.**

## Independent Skeptic

**Finding 9 — the website/application boundary is this document's largest
original derivation and rests on one Charter principle.** Principle 2 supports
it; Map A's audiences reinforce it; the North Star reinforces it again.
**But no accepted artifact states the boundary**, and a reviewer should test it
directly. If it fails, Parts 4, 5 and 6 are re-cut and Parts 1, 3, 7–10 are
largely unaffected.

**Finding 10 — Part 5.10 declines to derive participant settings, and that
refusal should be checked rather than accepted.** The assignment named it. The
document argues no artifact requires it. **If a reviewer finds a requirement
that does, the refusal is a defect rather than discipline.**

**Finding 11 — Part 12's answer to the final question is "not yet," which the
assignment's instruction treats as a signal to continue refining.** This
document does not continue, on the grounds that the obstruction is a decision
set rather than a derivation gap. **That reasoning should be examined**: if
wrong, the document stopped early.

---

# Open decision added

| # | Decision | Affects | Source |
|---|---|---|---|
| 26 | Whether the Handshake's public explanation and its application execution are one surface presented across both properties or two surfaces | S31, Parts 2, 4.6, 5 | Part 2 |

**Running total: twenty-six open product decisions. Nine block implementation.**

---

# Revision policy

**Revise when:** an accepted artifact is revised · a blocking open decision is
resolved · the website/application boundary is rejected or amended · a review
finding is addressed.

**Do not revise to:** add a surface because it seems useful · resolve an open
decision by assertion · introduce visual or implementation content · optimise
for familiarity over fidelity.

**Corrections are recorded visibly.** **Version numbers are whole integers.**

---

*Derived from the eight accepted baseline artifacts. Surface labels S01–S32,
phase labels E1–E8 and verification levels V0–V4 originate in Product Surface
Architecture v1 and Product Experience Architecture v1 and are used here without
modification.*
