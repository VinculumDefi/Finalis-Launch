# Website Specification — Phase 1

**Version:** 1
**Status:** Proposed for independent review
**Phase:** Product Definition → Build
**Derived from:** the nine accepted baseline artifacts, governed by Master
Specification Revision 6, hash
`5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9`

> **Functional specification. It governs nothing.** Where it conflicts with an
> accepted artifact, **the accepted artifact prevails and this document is
> defective.**

---

## Two notes before the specification begins

**"Workspace" is an operator-supplied name, not a derivation.** No accepted
artifact names the participant application. The name arrived with this
assignment and is recorded as `[DESIGN]`, adopted, not derived. **It is a
product name and not protocol terminology** — Appendix B of the Master
Specification holds the canonical terms, and "Workspace" must never be used to
describe protocol behaviour.

**One open decision blocks any part of this specification** — decision 5,
whether §16 traceability is published, which affects only P-11's existence.
Every §17-related decision is closed at Index §6.2, and decisions 1 and 8 are
implementation and UX under the accepted thin-Application principle. **A UX team
can begin on everything else immediately.**

---

# Part 1 · The finished product

## What a participant would say it is

*A place that explains something complicated, shows you it is true, and then
teaches you how to check without it.*

Not a platform. Not a dashboard. Not an app with a marketing site attached. A
body of material with a working instrument inside it, where the material is the
larger part and the instrument is deliberately small.

## What it feels like to use

**Unhurried.** Nothing counts down. Nothing is scarce. No figure moves to
create urgency. The protocol has a fixed supply, a fixed emission schedule and a
defined end state, and none of those facts becomes a reason to act today rather
than next month.

**Quiet about itself.** The product rarely makes a claim in its own voice.
It says what the specification says, then shows where to see it happening.
When it must assert something it cannot yet demonstrate, it says so plainly —
because **VF-EXT-002 requires an unavailable thing be reported as incomplete
rather than replaced with an invented value**, and that requirement shapes the
tone of the whole product.

**Answerable.** Every number has a source that can be reached in one step. Every
rule has a document. Every document resolves to the specification, whose hash is
verifiable. There is no layer at which the answer becomes *because we say so.*

**Slightly harder than it needs to be, on purpose.** The product does not extend
a staking position for you, remind you to release your principal, or decide
which duration suits you. **Charter principle 6**: convenience must never
replace informed participation. Some of what a participant would call friction
is the product declining to make a decision on their behalf.

## What makes it different

Three things, all derived rather than chosen.

**The verification path is public and requires nothing.** No wallet, no account,
no participation. A skeptic can reach the deepest level of verification the
product offers without ever committing anything. This follows from Map A
treating **verifier and skeptic as first-class audiences rather than edge
cases.**

**The application is small.** Fourteen surfaces, none of which explain anything.
Explanation lives in the public material, and the Workspace references it rather
than restating it — which is what stops the two copies drifting apart.

**The product is built to become unnecessary.** Not modestly — structurally. The
two layers that survive a participant's graduation are the evidence layer and
the reference layer, and both are public.

## The experience it creates

A participant arrives uncertain and leaves competent, and the product's role
shrinks at every step. That is not a side effect. It is the stated destination.

---

# Part 2 · The homepage

## Purpose

**To let a stranger decide, on accurate information, whether to keep reading.**

Not to convert. Not to explain everything. **Charter principle 1**: the protocol
informs, the participant decides. A homepage that treats leaving as failure has
already violated it.

## The questions it answers

Four, and only four:

1. **What is this?** A protocol where committing an asset issues tokens, and the
   asset never leaves the chain it is on.
2. **What does it do for me?** It issues tokens against a time-bound commitment,
   and returns the principal at maturity.
3. **What does it not promise?** No value, no listing, no liquidity, no
   appreciation, no redemption.
4. **Where do I go next?** Different answers for different people — see below.

## What must be understood before leaving

**The asset never moves off its native chain.** This is the core mechanic and
nothing else is intelligible without it.

**The protocol has no administrator.** No governance, no upgrade path, no pause
authority, no one who can intervene — including in a participant's favour.

**Principal returns at maturity regardless of what else fails.** §12 keeps it
releasable even where Base verification failed permanently and no token was ever
issued.

**Nothing about value is promised.** VF-TOK-015.

## What must never be misunderstood

| Misunderstanding | Why it is fatal |
|---|---|
| That this is an investment with an expected return | PRC-04 forbids economic promises; VF-TOK-015 guarantees nothing |
| That someone can help if something goes wrong | There is no administrator. **This must not read as a boast** — it is a limitation as much as a property, and Charter principle 7 requires it be told as both |
| That the asset is transferred, custodied or bridged | It is locked on its own chain |
| That the fee is refundable if the commitment fails | It is not, and the warning is `required` at Map A Step 2 |
| That a displayed price is a price anything trades at | **VF-PUB-002 forbids presenting the reference as a guaranteed trading price** |

## The emotional question, answered carefully

The assignment asks what emotions the homepage should create. **The Charter does
not permit engineering emotion, and the honest derivation inverts the
question.**

The product does not produce calm. **It removes the conditions that produce
pressure** — no countdown, no scarcity, no urgency, no fear of missing
something, no social proof. What a visitor experiences as calm is the absence of
those, not the presence of a designed feeling.

Likewise it does not produce confidence. **Charter principle 4: confidence
emerges naturally as participants successfully verify the protocol for
themselves.** Confidence is an output of the verification path, and any attempt
to produce it earlier is the persuasion the Charter forbids.

What the homepage may legitimately create is **relief at being told the truth
early**, which is a byproduct of principle 7 rather than a design goal.

## How each audience experiences it

| Audience | What they need from this page | Where they go |
|---|---|---|
| First-time visitor | Orientation and permission to leave | The trust page, or away |
| Skeptic | The fastest route to something checkable | Straight to the manifest or the specification |
| Prospective participant | Enough to know whether their asset qualifies | Supported assets |
| Existing participant | A way past this page entirely | The Workspace |
| Verifier | Evidence that verification is taken seriously here | Traceability, manifest |
| Developer | A route to interfaces and data | Developer reference |

**Six audiences, six exits, and one of them is off the site.** The page must
serve the skeptic's route to disconfirmation as well as it serves anyone else's
route to participation.

## The primary audience — decision 3, CLOSED

**The Intelligent Newcomer.** A thoughtful person curious enough to understand
before acting. The page assumes **neither deep blockchain expertise nor complete
unfamiliarity** — it explains without condescending and without presuming
fluency.

**This establishes tone, pacing and depth**, not exclusivity of service. All six
audiences remain fully supported, and all six exits above remain present. What
the decision settles is whose comprehension sets the pace: **the page teaches
before asking for action, and does not optimise for speculation, urgency, or
immediate conversion.**

Canonical record: Product Architecture Index §6.2.

## The homepage's philosophy, stated explicitly — decision 4, ACCEPTED

**The homepage does not attempt to manufacture emotional responses.** It removes
unnecessary pressure, ambiguity and uncertainty through truthful explanation,
evidence and verification.

**Confidence is earned by the participant, not produced by the product.** This
follows from Charter principle 4 — confidence emerges naturally as participants
successfully verify — and it is why the emotional brief is answered by
subtraction rather than by design.

## Acceptance criteria

- A visitor can state what the protocol does and does not promise.
- No sentence promises, projects or implies value. **PRC-04.**
- Every claim on the page is reachable in one step from a page where it can be
  checked, or is marked as not yet checkable per **VF-EXT-002.**
- The skeptic's route to independent evidence is available without scrolling
  past a participation invitation.
- Leaving is not treated as failure.

---

# Part 3 · The public website

**Eighteen pages, one per public surface.** The 1:1 mapping is a result, not a
choice: no surface required splitting and none merged. Grouping is `[DESIGN]`;
every page is required by an accepted artifact.

Per-page purpose, audience and evidence are established in **Product Surface
Architecture Part 2** and are cited rather than restated. What follows is the
functional detail that document does not carry.

## Group A · Orientation

### P-01 Home — S01

Specified in full in Part 2.
**Requires:** Map A audiences; PSA S01. **Inputs:** none. **Outputs:** routing
intent only. **Primary audience: the Intelligent Newcomer** (decision 3, closed; Index §6.2).

### P-02 The Commitment — S02

**Purpose.** Present the four trust-cluster claims and make each checkable.
**Audience.** Skeptic, prospective participant.
**Required information.** No one controls this (§2, §15) · your asset never
moves (Map A Step 3) · principal returns even if everything else fails (§12) ·
failure substitutes nothing (§14, VF-SEC-003).
**Required evidence.** Deployed contract code and the finalization transaction —
**available only post-deployment**; until then, **stated as not yet
demonstrable** per VF-EXT-002.
**Required links.** P-13 specification, P-10 manifest.
**Inputs.** None. **Outputs.** None.
**Relationship.** Downstream of P-01; upstream of P-14.
**Requires:** Map A `[DESIGN]` trust cluster grouping; PSA S02.
**Acceptance.** Every one of the four claims resolves to a checkable artifact or
is marked unavailable. **No claim rests on the product's own assurance.**
**Shaped by** `[OPEN]` 4.

### P-05 Disclosures and Limitations — S05

**Purpose.** State what is not promised.
**Audience.** Prospective participant, skeptic.
**Required information.** No listing, liquidity, price, redemption value or
appreciation is guaranteed (VF-TOK-015) · external markets alter no protocol
rule (VF-TOK-014) · venue activity cannot modify calculations or supply
accounting (VF-PUB-003) · listing pursuit is a development objective, not a
promise (§17.2).
**Required evidence.** VF-RAC-005's permanent $0.10 reward reference — the
concrete demonstration that rewards do not track market price.
**Inputs/Outputs.** None.
**Requires:** PRC-07, PRC-08, PRC-11; PSA S05.
**Acceptance.** No timeline, likelihood or expectation regarding any listing
appears.
**Decisions 17 and 18, CLOSED (Index §6.2).** This page exists distinctly. It carries **one factual statement** that listing pursuit is a development objective — no timeline, no likelihood, no repetition — and **no third-party market data.**

## Group B · Assets and supply

### P-03 Supported Assets — S03

**Purpose.** Show which assets may be committed, where.
**Audience.** Prospective and existing participants.
**Required information.** The permitted display fields under PRC-05 — Symbol,
Name, Environment, Price, Price Source, Last Updated, contract or native
identity, available pricing metadata.
**Required evidence. Price source and last update time wherever price appears —
mandatory under VF-PUB-002, not merely permitted.**
**Required links.** P-12 registry data, P-07 price status, P-14 rules.
**Inputs.** Filter and search intent. **Outputs.** Asset selection carried to
the Workspace.
**Requires:** §6, Appendix C; PRC-05, PRC-10; PSA S03.
**Acceptance.** No field appears outside `[OPEN]` 15's resolution. No price is
presented as a guaranteed trading price.
**Decisions 15 and 19, CLOSED (Index §6.2).** Display set is **permissive-open** — the eight enumerated fields plus any field accurate and consistent with the current specification. **Price Source and Last Updated accompany every price the product displays, here and everywhere.**

### P-04 Tokens and Supply — S04

**Purpose.** Present VCLM, CHONX and SYNTH — what each is, how each is issued,
and cumulative lifetime issuance against capacity.
**Audience.** All six.
**Required information.** Three tokens and their distinct issuance paths ·
capacity is finite · **the Forge is one-way with no reversal, redemption or
administrative restoration path** (VF-TOK-005) · Forge availability requires
100,000,000 cumulative lifetime CHONX issuance.
**Required evidence.** On-chain state. **Post-deployment entirely.**
**Required links.** P-06 supply dashboard, P-15 participation rules.
**Requires:** §4, §13, overlay O4; PSA S04.
**Acceptance.** No supply projection or decay schedule appears until `[OPEN]` 20
determines whether such a projection is an implied economic promise.

## Group C · Live evidence

Four dashboards. **All public, all requiring no wallet.** Placing them behind
connection would make observation conditional on participation, contradicting
Map A's treatment of the skeptic.

### P-06 Supply and Capacity — S20

**Required information.** Lifetime issuance, remaining capacity, activation
progress (§13). **Required evidence.** On-chain state, recomputable.
**Requires:** Map A dashboard spine grouping, overlay O4; PSA S20.
**Acceptance.** Every figure recomputable from public data. **Terminal state
handled per `[OPEN]` 13** — the protocol has a defined end at which nothing is
stranded.

### P-07 Registry and Price Status — S21

**Required information.** Twice-daily refresh cadence · per-asset source and
update time · asset counts by environment.
**Required evidence.** Signed price records.
**Requires:** §6, §7, overlay O7; PRC-05, PRC-06, PRC-09, PRC-10; PSA S21.
**Acceptance. A displayed figure may be close to twelve hours old and the page
says so.** No implication that this price values a commitment — the protocol
price reference is a different object under §7.
**`[REV7]`** VF-ORC-015 proposes a 48-hour validity bound on the **protocol
price reference.** Not governing; not the website cadence.

### P-08 Verification Activity — S22

**Required information.** Verification outcomes, **including failures.**
**Required evidence.** Verification transactions. **Post-deployment entirely.**
**Requires:** §11, §16, overlays O2, O3; PSA S22.
**Acceptance. Failures are displayed.** A verification dashboard showing only
successes is an assertion surface. **Decision 6, ACCEPTED: this derives
sufficiently from Charter principles 3 and 7 and is deliberately not elevated
into a protocol requirement.** Showing only successes is a Charter violation,
not a specification violation, and that is the correct classification.

### P-09 Epochs — S23

**Required information.** T0 · current epoch · finalization state per epoch ·
allocation history · **every epoch is exactly 10 days** (VF-STK-006) ·
**activity at the exact ending timestamp belongs to the following epoch**
(overlay P1).
**Required evidence. T0 and every boundary computable by anyone.** Finalization
transactions public.
**Requires:** §10.2, §10.4, overlay P1; PSA S23.
**Acceptance.** Finalization shown as permissionless — **anyone may act, and no
actor gains authority by acting.**
**Decision 8, RECLASSIFIED (Index §6.2).** Remains an observation surface; whether the Workspace offers finalization is implementation and UX.

## Group D · Verification

### P-10 Deployment Manifest — S24

**Required information.** All six PRC-03 categories: live address, environment
identifier, source commit, bytecode hash, dependency, fixed Dev Fund
destination.
**Required evidence. This page is evidence.** Bytecode hash plus source commit
lets anyone confirm deployed code matches published source.
**Acceptance.** Where an entry is unavailable, **it is reported as incomplete
rather than replaced with an invented value** (VF-EXT-002).
**Decision 21, CLOSED (Index §6.2).** Published as a public surface; form is implementation.

### P-11 Traceability — S25

**Required information.** Each meaningful test and deployment check traced to
its numbered requirement (VF-VER-001), with reproduction procedures.
**Requires:** §16, overlay O3; PSA S25.
**Acceptance. No pass count is presented as sufficient.** VF-VER-006 prefers
independent reproduction; VF-VER-007: nothing is production-ready merely
because it compiles; VF-VER-008: code does not prevail over specification by
default.
**Buildable now** — traceability matrices and test suites are among the few
evidence classes not gated on deployment. **Blocked by** `[OPEN]` 5 — **the only remaining blocker in the product.**

### P-12 Registry Data — S26

**Required information.** All five PRC-02 categories: asset identity,
environment, classification, pricing identifier, source metadata.
**Outputs.** Machine-readable data, consumable as data and not only as a page.
**Acceptance. Not conflated with P-03's display set.** Classification is
preserved here without being among PRC-05's eight display fields.

## Group E · Reference

### P-13 The Specification — S27

**Required information.** The preserved human-readable Master Specification.
**Required evidence.** Its hash, published alongside it — decision 14, closed; Index §6.2.
**Acceptance. No other page positions itself as more authoritative than this
one** (PRC-01's consequence).

### P-14 Commitment Rules — S28

**Required information.** Duration and multiplier reference · fee calculation
and rounding · fee routing · per-environment finality · maturity and release ·
§5.2 handshake allowance lifecycle, including that **rejected attempts consume
no allowance** (VF-COM-008).
**Requires:** §5, §7, §8, §11, §12; overlays O5, O6, O7; PSA S28.

### P-15 Participation Rules — S29

**Required information.** Weight formula and multipliers · epochs · **the
two-epoch eligibility rule** · **the gap rule** · rewards paid only in newly
minted VCLM · the permanent $0.10 reference · rounding remainder · terminal
state · the evidence schema.
**Requires:** §9, §10; overlays P1, P2, P3; PSA S29.
**Carries `[OPEN]` 9, 10, 12, 13.** All four of the hardest explanations land
here as well as in their Workspace surfaces. **This page is the participant-
facing home of the eligibility rule**; its canonical architectural sources are
Map B Stage 3 and PSA S13 (Index §6.2).

### P-16 Developer and Verifier Reference — S30

**Required information.** Verifier contracts · proof formats · interfaces ·
reproduction procedures.
**Acceptance.** A developer can reproduce a verification without contacting
anyone.

## Group F · Learning

### P-17 Calculators — S32

**Purpose.** Let anyone compute a result before committing to it.
**Inputs.** Asset, amount, duration, token — hypothetical, no wallet.
**Outputs.** Computed weight, computed issuance.
**Acceptance. Computed values are shown as computed, not promised.** Decision 20, closed: a computed weight or issuance amount is a **fact about how the protocol operates and may be stated plainly**; a projection presented as indicative of what a participant will receive may not.

### P-18 The Handshake — S31, explanatory half

**Purpose.** Explain the one-hour, approximately one-dollar commitment that
traverses the entire lifecycle.
**Acceptance. Stated as a real commitment on a real chain**, with a
non-refundable fee like any other — never as a simulation, demo or trial.
**Never presented as a prerequisite to committing.** `[OPEN]` 24 records that
rehearsal is optional.
**`[OPEN]` 26** — whether this and its Workspace execution are one surface or
two.

## What the public website must never contain

No accepted artifact justifies: blog, roadmap, newsletter, team page,
testimonials, partner logos, press section, community forum, social feed,
countdown, milestone tracker, or an FAQ restating rules the reference pages own.

**Two are closer to forbidden than merely unjustified:** anything presenting a
listing as expected (§17.2, PRC-08), and anything presenting a price as a
guaranteed trading price (VF-PUB-002).

---

# Part 4 · The Workspace

Fourteen surfaces. **Nothing explanatory lives here** — the Workspace references
the public reference pages rather than restating them.

## The governing constraint

**Decision 2, CLOSED — the Application remains intentionally thin.** It exists
only to support participant-specific information, successful protocol
participation, participant understanding, participant verification, and
**prevention of genuine operational mistakes.** It does not accumulate
convenience features merely because they are technically possible, and becomes
richer only where the protocol genuinely requires additional participant
functionality. Canonical record: Index §6.2.

**The application is an instrument panel, not an autopilot.** §12 makes
principal release user-initiated; VF-XCH-012 gives the relayer no authority; §2
removes post-deployment control. **The journey is never notification-driven.**

Concretely, the Workspace **never**: extends a position, releases principal,
claims rewards, selects a duration, chooses a default asset, or acts on a
schedule. **VF-SEC-003 forbids substituting a default asset, price, environment,
user, recipient, output, duration, multiplier or Dev Fund destination on any
failure path** — and Charter principle 6 extends the same discipline to
convenience.

## W-01 Portfolio — S10

**The entry point, and the seam between both maps.**
**Sees.** Holdings · open commitments · positions · claimable balance.
**Does.** Routes. **Verifies.** Balances against chain state.
**Constraint. Never couples the custody track to the participation track.** A
participant can complete Map A Step 8 having never reached Map B.

## W-02 New Commitment — S06

**Sees.** Asset, environment, amount, duration; preflight result; fee.
**Does.** Selects; submits the source transaction.
**Verifies.** Price source and update time; the preflight computation against
P-17.
**Required, not optional. The non-refundable fee warning** (Map A Step 2) —
before the transaction, not after.
**Learns.** Nothing new here. Prerequisites belong to P-14.
**Decision 16, CLOSED (Index §6.2).** Satisfied by presenting the commitment's
own figures as the commitment's own figures. **No explanatory apparatus about
price-object distinctions appears here.**

## W-03 Commitment Tracking — S07, S08

**Sees.** State through finality and proof; per-environment finality
expectation.
**Does.** Whatever is **actually and defensibly necessary** for the commitment
to complete — decision 1 reclassified as implementation and UX, governed by the
thin-Application principle (Index §6.2).
**Verifies.** Explorer links to source-chain confirmations.
**Required behaviour. Pending disposition** (Map A Step 4).
**Constraint.** Honest about delay and failure. **Charter principle 7 lands here
or nowhere.**

## W-04 Issuance — S09

**Sees.** Verification outcome; issued amount **and its derivation.**
**Verifies.** Verification and issuance transactions; the amount recomputable
from the price record and duration.
**Constraint. The Reward-Accounting Credit is never presented as a subordinate
detail of issuance.** It is created at fee verification independently of
issuance and can exist where issuance does not.

## W-05 Maturity and Release — S11

**Sees.** Maturity countdown; release availability.
**Does.** Releases principal — **user-initiated, always.**
**Constraint. Never conditional on issuance having occurred.** §12 keeps
principal releasable after permanent verification failure. **The participant who
most needs this surface is the one for whom issuance never happened.**
**The user owns remembering.**

## W-06 Stake — S12

**Sees.** Stakeable tokens; durations; computed weight.
**Verifies.** Multipliers fixed in an immutable contract; weight computable by
anyone from public position data.
**Constraint.** Acquisition history never affects weight (VF-STK-005). Rewards
paid only in newly minted VCLM regardless of token staked (VF-STK-004).

## W-07 Positions and Eligibility — S13

**Sees.** Position state; eligibility per epoch; **why not, when not.**
**Verifies.** Eligibility independently determinable from on-chain timestamps
and computable epoch boundaries.
**Carries the hardest rule in the protocol.** Active at the exact beginning of
epoch N, continuously through N, still active at the scheduled end of N+1.
Retained here in full because a participant reading this surface needs it in
front of them. **Canonical sources: Presentation Map B Stage 3 for the rule;
Product Surface Architecture S13 for its product treatment** (Index §6.2).
**`[OPEN]` 9, unresolved.**

## W-08 Entitlements — S14

**Sees.** Fixed entitlements per epoch; zero-weight and capacity-exceeded
outcomes.
**Verifies. The full allocation is reproducible from public data.**
**Constraint.** A zero-weight or capacity-exceeded epoch **mints nothing,
closes, marks its credits used and carries nothing forward.** Partial epoch
minting is prohibited. **Rounding remainder disclosed per `[OPEN]` 12** — a
disclosure, not a defect.

## W-09 Claim — S15

**Sees.** Accumulated claimable VCLM.
**Does.** Claims all accumulated in one transaction.
**Constraint.** Claims **never expire** (VF-STK-016); transfer already-minted
VCLM without minting again or consuming capacity (VF-STK-018); pay only the
owner or the bound destination (VF-STK-019). **Never claims automatically.**

## W-10 Extend — S16

**Sees.** Current term; the single queueable future term; **what happens if
nothing is queued.**
**Does.** Queues one future term. No tokens added or removed; no fee.
**Constraint. An expired position cannot retroactively cover a gap**
(VF-STK-025). The consequence arrives silently at maturity. **The Workspace does
not extend on the participant's behalf** — Charter principles 6 and 7 both
forbid it. **`[OPEN]` 10, unresolved.**

## W-11 Withdraw — S17

**Constraint. Withdrawal does not erase accumulated claimable VCLM**
(VF-STK-020). The two are independent and the surface makes that plain.

## W-12 Forge — S18, gated

**Constraint. One-way, with no reversal, redemption or administrative
restoration path** (VF-TOK-005). Gated until 100,000,000 cumulative lifetime
CHONX. **Gated does not mean undesigned**; a participant who reaches it must not
meet an unfinished surface. `[OPEN]` 11 — conversion or milestone.

## W-13 Portability — S19

**Constraint. Transport is not issuance** (VF-XCH-021) — it does not increase
cumulative lifetime issuance or restore capacity, and no independent supply may
exist on another chain (VF-XCH-019).

## W-14 Handshake — S31, executing half

**A real commitment**: one hour, approximately one dollar, the entire lifecycle.
Overlay O5 governs the allowance — three uses per bound identity where the
source mechanism maintains persistent atomic state, one otherwise; **rejected
attempts consume no allowance.**

## Participant settings — does not exist

**No accepted artifact requires one.** Reward destination is bound to the
position at creation (VF-STK-019). Duration and multiplier are fixed at
commitment. The protocol has no admin, no upgrade path, no pause authority, and
correspondingly few knobs.

**Decision 7, ACCEPTED: no Settings surface is invented.** Decision 2's closure
removes the only candidate — a notification preference — since a notification is
a convenience feature and is not adopted on that basis. **If future protocol
functionality genuinely requires participant preferences, that surface may
emerge naturally. Until then, no Settings page exists**, and that is the
faithful outcome rather than a gap.

---

# Part 5 · Navigation, derived from intent

**Not menus. Intent.**

| Audience | Trying to accomplish | Naturally begins | Encounters next | Must never be forced through |
|---|---|---|---|---|
| First-time visitor | Decide whether to care | P-01 | P-02, then P-05 | Any participation surface |
| Skeptic | Find the flaw | P-01, or arrives at P-10 | P-10 → P-13 → P-11 | Any explanatory page. **They came to check, not to learn** |
| Prospective participant | Decide whether to commit | P-01 or P-03 | P-03 → P-14 → P-17 → P-18 or Workspace | The Handshake — **rehearsal is never a gate** |
| Existing participant | Operate | W-01 | Their own state | The public site. **Returning must not route through orientation** |
| Verifier | Confirm the system | P-10 or P-11 | P-13 → P-16 → P-12 | Any participation surface |
| Developer | Integrate | P-16 | P-12 → P-10 | Anything explanatory |

## What this implies structurally

**Three of six audiences never need the Workspace**, and two of those reach the
deepest verification level available. **Navigation must therefore not converge.**
A single funnel would mis-serve the audiences who most test the protocol's
honesty.

**Two entry points, not one.** The public site and the Workspace are separate
front doors. A returning participant should not pass through orientation to
reach their own state.

**The verification path is reachable from every page.** Not as a footer
obligation but because **every displayed figure must lead to its source in one
step.** That is Charter principle 4 expressed as navigation.

---

# Part 6 · Information architecture

**How information unfolds mentally.** Fully derived in Product Experience
Architecture Section 7; the prerequisite sets are cited, not restated.

## Learned first

The commitment mechanic — the asset stays where it is — followed by the absence
of control, followed by the return of principal. **In that order**, because the
second is only meaningful once the first is understood, and the third only
matters once someone believes the second.

## Never before its prerequisite

**Nothing about staking before commitment is understood.** Map B begins at
holding, which Map A Step 7 produces.

**Nothing about eligibility before epochs.** The rule is unintelligible without
the ten-day boundary and T0.

**Nothing about claiming before entitlement.** Claims transfer already-minted
VCLM; the minting happened at allocation.

**The eight commitment prerequisites, complete, before any commitment
surface.** Listed in PEA §7.1.

**The seven staking prerequisites, complete, before any position is created.**
Listed in PEA §7.2 — including the two-epoch eligibility rule and the gap rule,
which is where **`[OPEN]` 9's tension between Charter principles 2 and 5 lands.**

## Where curiosity naturally leads

From a figure to its source. From a source to the rule that produced it. From a
rule to the specification section that states it. **Four steps from any number
in the product to §-level text, and the fourth step is always the same
destination.**

## Where verification naturally deepens

Shown → located → reproduced → independent. A participant who follows a single
explorer link has moved from the first to the second without being asked to.
**The path from second to third is the product's hardest teaching problem**,
because reproduction requires the participant to want to check.

**Nothing gates verification.** PEA §7.4: ungated by derivation, not by choice.

---

# Part 7 · Trust architecture

**Not how trust is described. How it is earned, moment by moment.**

## The moments uncertainty reduces

| Moment | What changed |
|---|---|
| The homepage states what is not promised, before stating what is | The visitor learns the product will not oversell. **Everything after is read differently.** |
| A claim on P-02 links to the manifest rather than to more prose | The claim becomes checkable. Assertion becomes evidence. |
| A price shows its source and age unprompted | The product volunteers a weakness — the figure may be twelve hours old. |
| The fee warning appears before the transaction | The one irreversible cost is disclosed at the moment of decision, not after. |
| A commitment is pending and the product says what happens if it never completes | **The worst moment is pre-answered.** |
| The Handshake completes for a dollar | **The whole lifecycle has been observed rather than described.** |
| An issued amount arrives with its derivation | The participant can check the product's arithmetic. |
| A recomputed number matches | **The first moment the product could have been caught being wrong, and wasn't.** |
| An epoch is finalized by a stranger and nothing changes | The control model is understood by observation rather than explanation. |

## The moments confidence increases

**Confidence increases only at verification.** Charter principle 4: it emerges
naturally as participants successfully verify. Every other moment reduces
uncertainty, which is a different thing — the absence of doubt is not the
presence of confidence, and the product must not confuse them.

## When independent verification becomes natural

**When checking is easier than asking.** Concretely: when every figure is one
step from its source, when the specification is preserved and hashed, when the
manifest lets anyone match bytecode to source commit, and when finalization and
proof submission are open to anyone.

It becomes *habitual* only after the third rung — reproduction. A participant
who has recomputed one entitlement will recompute others.

## What destroys trust

| Failure | Why it is fatal |
|---|---|
| A number without a source | The product becomes the authority. **The North Star inverts.** |
| A promise, however hedged | PRC-04. One economic implication contaminates every other claim. |
| A dashboard shown only when healthy | **P-08 must show failures.** Selective evidence is assertion. |
| Silence about a limitation later discovered | **Charter principle 7: concealment destroys trust.** |
| Convenience that removes a decision | Charter principle 6. An auto-extend would end the product's credibility permanently — it would prove the product acts on the participant's behalf when it judges best. |
| A stale page after a specification revision | **VF-PUB-001 makes a revision a product event.** `[OPEN]` 22. |

## What strengthens it

Volunteering weaknesses before they are found. Reporting incompleteness rather
than substituting a value (**VF-EXT-002**). Declining to decide for the
participant. Making the product's own arithmetic checkable. **Making the product
leaveable.**

---

# Part 8 · The living experience

## The first-time visitor

She arrives from a link, expecting the usual — a promise, a token, a countdown.
The first thing she reads is what the protocol does not promise. She notices
that, because nothing else she has opened this month began that way.

She learns one mechanic: the asset stays where it is. She reads that no one can
intervene, and understands within a sentence that this cuts both ways. She
leaves.

**Nothing chased her.** The product treated her leaving as a legitimate outcome,
which is what Charter principle 1 requires. If she returns in three weeks,
nothing will have changed to punish the delay.

## The skeptic

He is looking for the lie. He skips the explanation and goes for the manifest.

He finds live addresses, a source commit, a bytecode hash. He checks one. It
matches. He goes to the specification, finds its hash published, verifies the
copy he is reading. He finds the traceability publication and looks for the pass
count — and finds instead a requirement-by-requirement trace and a statement
that **independent reproduction outranks self-reported passes.**

He looks for the seam. He finds three entries in the manifest marked
unavailable, reported as incomplete rather than filled in.

**He does not commit anything, and he has reached the deepest level of
verification the product offers.** What changed inside him is not belief but
something narrower and more durable: he now knows what he would check, and he
knows checking works.

## The prospective participant

She has an asset and a question: *do I want this deal?*

She finds her asset supported, with a price, a source, and a timestamp saying
the figure is nine hours old. She opens the calculator and computes what a
twelve-month commitment produces. She reads the fee rules and learns it is
non-refundable, before any surface offers her a transaction.

She finds the Handshake: one hour, one dollar, the entire lifecycle. She does
it. She watches her asset lock on its own chain, watches the proof, watches the
tokens arrive, releases her principal an hour later.

**Nothing she was told turned out to be different from what happened.** That is
what changed inside her — not trust in the product, but a verified match between
description and behaviour.

## The participant

He returns to the Workspace, not the homepage. He holds two things on two
chains: a commitment maturing where his asset lives, and tokens on Base.

He stakes. Ten days later he checks eligibility and finds his position not
earning for the epoch he expected, because it began three hours after that epoch
started. **The rule was in front of him before he staked, and it still surprised
him** — which is why the rule is open decision 9 and why nobody has decided how
to teach it.

A week later he recomputes an entitlement by hand from public data. It matches.
**That is the moment the product's role begins to shrink** — he has confirmed he
could catch it being wrong.

## The verifier

She works from the manifest and the traceability publication. She reproduces a
verification independently, using the developer reference, without contacting
anyone.

Then she does something no dashboard could have taught her: she finalizes an
epoch. Anyone may. It costs her a transaction fee and **it changes nothing about
the outcome** — the allocation is exactly what it would have been. She has
learned the control model by exercising it.

**She has never held a Vinculum token.**

## The developer

He arrives at the reference, finds the registry as data rather than as a page,
and builds against it. He notices the registry preserves classification that the
public asset page does not display, and understands the two are different
obligations.

He finds interfaces, proof formats and reproduction procedures. Nothing requires
him to register, connect or ask. **He integrates without ever speaking to
anyone**, which is the only integration story a protocol with no administrator
can honestly offer.

---

# Part 9 · The voice of Vinculum

**Derived from the Charter. Not branding.**

## How it speaks

**Declaratively.** It states what is true and what is not known. It does not
build to a point.

**In the specification's vocabulary.** PRC-04: website language *derives from*
the current specification. Terms mean what Appendix B says they mean, and the
product does not coin friendlier synonyms for precise things.

**Without a first person plural that claims authority.** The product may say
what the protocol does. It should not say *we ensure*, *we guarantee*, *we've
made sure* — **there is no one to ensure anything.** The absence of an
administrator is a fact about the voice as much as about the architecture.

**Limitations first, in the same register.** Charter principle 7. A limitation
delivered in a smaller, softer, later voice than a capability has been
concealed by tone.

## Language that never appears

**Decision 5, ACCEPTED — this guidance is `[DESIGN]` editorial guidance derived
from the Product Design Charter. It is not a protocol requirement.** It exists
to preserve the product's voice, and a future editorial decision may amend it
without touching any baseline. Only the first two rows restate an actual `[SPEC]`
prohibition (PRC-04, VF-TOK-015); the remainder derive from Charter principles 4,
5 and 6.

| Never | Why |
|---|---|
| Guaranteed, assured, safe, risk-free, secure returns | PRC-04, VF-TOK-015 |
| Earn, yield, APY, returns, profit | Economic promise |
| Don't miss, limited, act now, early, before it's gone | Urgency the protocol does not contain |
| Simply, just, easy, effortless | **Charter principle 5**: complexity is made understandable, not invisible. "Simply stake" conceals the rule that costs entitlements. |
| Trust us, rest assured, you don't need to worry | **Charter principle 4**, directly |
| Revolutionary, next-generation, unlocking, empowering | Adds features the specification does not contain |
| We've handled that for you | **Charter principle 6**, directly |

## The tone that emerges

**Calm, because nothing is urgent.** Fixed supply, fixed schedule, defined end
state. There is no version of the product where acting today beats acting next
year, and the voice reflects that.

**Precise, because vagueness would be a promise.** The margin between a
description and an implication is where PRC-04 is violated.

**Unhurried with complexity.** The eligibility rule is stated fully, more than
once, in more than one place — not simplified.

## Rigorous without intimidating

**Sequence, not simplification.** Charter principle 5 forbids hiding mechanics;
principle 2 permits ordering them. The product introduces one idea at a time,
completely, rather than several partially.

**Reference rather than restatement.** The Workspace stays short because the
rules live in the reference pages. Depth is available, not imposed.

**Worked instances over abstractions.** A computed weight teaches the formula
better than the formula teaches itself — and it teaches verification at the same
time, because a computed number invites recomputation.

---

# Part 10 · The philosophy a participant would infer

*After a week, without reading the Charter.*

**That it does not want anything from them.** Nothing hurries, nothing counts
down, nothing rewards speed. They would conclude that the product's makers
either have no urgency or have deliberately removed it.

**That it expects them to check.** Every number has a source; every rule has a
document; the specification is published with a hash. They would conclude the
product expects to be verified rather than believed — and eventually, that it
was built assuming someone hostile would look.

**That no one is in charge, and that this is a constraint rather than a
boast.** They would notice that the absence of an administrator is described
alongside its costs.

**That it will not decide for them.** It will not extend a position, claim
rewards or release principal. **They would conclude that the friction is
deliberate** — and that the product treats their responsibility as something to
preserve rather than remove.

**That it does not mind being left.** Everything durable — the specification,
the manifest, the registry, the chain — is public and needs nothing from the
product. They would conclude it was built to be outgrown.

**That it told them the truth early, including the unflattering parts.** They
would conclude that where it had a chance to oversell and did not, it probably
did not oversell elsewhere either. **This is the only form of trust the
architecture permits the product to earn**, and it is earned by disclosure
rather than assurance.

---

# Part 11 · Product readiness review

**Genuine defects only.** Recorded, not silently fixed.

## Product Strategist

**Finding 1 — no acquisition mechanism exists anywhere in the product, and the
document does not say whether that is intended.** Six audiences, five journeys
that end without commitment, no funnel, no capture, no follow-up. **Correct by
derivation.** Whether it is correct commercially is a question the accepted
artifacts do not answer, and this document declines to answer it.

**Finding 2 — Part 8's narratives assign emotional outcomes that no artifact
guarantees.** "Nothing chased her," "what changed inside him." **Derived from
what the surfaces do, but stated as though the effect were assured.** A reviewer
should treat Part 8 as illustration, not specification.

## UX Architect

**Finding 3 — two front doors is derived, but the returning-participant case is
underspecified.** Part 5 states the Workspace is a separate entry and that
returning must not route through orientation. **How a participant reaches it
without passing the public site is not specified**, and specifying it would
require navigation design this document is not authorised to produce.

**Finding 4 — `[OPEN]` 23 remains unaddressed and now has a concrete cost.**
W-01 must show two concurrent tracks on two chains with independent timelines,
and must not couple them. **Part 4 states the prohibition and offers nothing
constructive**, because the accepted artifacts offer nothing to derive from.

**Finding 5 — the calculator is split across the boundary.** P-17 is public;
W-02's preflight is the same computation with the participant's own inputs.
**One concept, two surfaces.** Carried forward unresolved from Website &
Application Derivation Finding 3.

## Trust & Security Reviewer

**Finding 6 — CLOSED by decision 6.** P-08's failure-display requirement rests
on Charter principles 3 and 7, deliberately. No numbered requirement compels a verification dashboard to
show its failures. **A genuine gap in the artifact chain**, now load-bearing in
a functional specification. Recorded a second time because it has become more
consequential.

**Finding 7 — Part 9's prohibited-language table is stricter than any accepted
artifact requires.** PRC-04 forbids economic promises and unspecified features.
It does not forbid "simply" or "easy." **The extension is derived from Charter
principle 5 and is `[DESIGN]`, not `[SPEC]`** — a reviewer may reject it without
violating any baseline.

**Finding 8 — Part 7's trust moments are ordered as though every participant
encounters them in sequence.** Most do not. The skeptic encounters the last
before the first.

## Technical Communicator

**Finding 9 — RESOLVED by decision 8.** The eligibility rule had accumulated
restatements across seven locations in six artifacts. **Canonical sources are now
designated** — Map B Stage 3 for the rule, PSA S13 for its product treatment
(Index §6.2) — and downstream references point there. **Full restatement is
retained only at P-15 and W-07**, where a reader of those surfaces needs the rule
in front of them. `[OPEN]` 9 — how it is made comprehensible — **remains open**,
and is now referenced from one canonical place rather than seven.

**Finding 10 — Part 3 compresses page specifications heavily by citing prior
artifacts.** A UX team with all nine baselines has everything; a team with only
this document does not. **Deliberate, per Index §1.3 on divergence, and a real
usability cost.**

## Independent Skeptic

**Finding 11 — Part 2 answers the emotional brief by declining it.** The
assignment asked what emotions the homepage should create; the document argues
the Charter inverts the question. **That reframing is a derivation and should be
tested.** If wrong, Part 2's emotional section is evasion rather than
discipline.

**Finding 12 — ADDRESSED by decision 3 (naming).** **Internal architectural
term: Application. Participant-facing name: Workspace.** A product naming
decision only; protocol terminology is unchanged. The concern stands as a design
caution rather than a defect: *workspace* suggests persistence and
configuration, and the surface has no Settings by decision 7.

**Finding 13 — nine open decisions block parts of this specification, and it was
written anyway.** The justification is that invariants can be specified
separately from variants. **If a reviewer finds a place where the invariant
quietly assumed a resolution, that is a defect** and this document should be
corrected rather than defended.

---

# The final question

> *If Vinculum were launched exactly as described here, would participants
> become more dependent on the product — or more capable without it?*

**More capable without it.**

The structural reason is that **everything durable is public and ungated.** The
specification, the manifest, the registry, the traceability publication, all four
dashboards, and every verification path require no wallet, no account and no
permission. **A participant who abandons the Workspace tomorrow keeps every
capability that matters**, because those capabilities were never inside it.

The Workspace holds fourteen surfaces, none of which explain anything and none
of which act unasked. It cannot become the thing a participant depends on for
understanding, because it does not contain understanding — the reference layer
does, and the reference layer is public.

**The single thing that would reverse this answer** is convenience: an
auto-extend, an auto-claim, a notification-driven journey, a dashboard that
answers *is it working* so well that no one follows the link beneath it. Each
would be a Charter violation, and each would be individually reasonable. **The
risk is not that someone decides to make the product indispensable. It is that
someone makes it slightly more helpful, eleven times.**

Stopping here.

---

# Revision policy

**Revise when:** an accepted artifact is revised · a blocking open decision is
resolved · a review finding is addressed · a derivation is shown unsupported.

**Do not revise to:** add a page because it seems useful · resolve an open
decision by assertion · introduce visual, brand or implementation content ·
optimise for convention.

**Corrections are recorded visibly.** **Version numbers are whole integers.**

---

*Derived from the nine accepted baseline artifacts. Surface labels S01–S32,
phases E1–E8 and verification levels V0–V4 originate in prior artifacts and are
used without modification. Page labels P-01–P-18 and Workspace labels W-01–W-14
are document-local and carry no specification authority. "Workspace" is an
operator-supplied product name, not protocol terminology.*
