# Product Experience Architecture

**Version:** 1 — first draft
**Status:** Proposed for independent review
**Phase:** Product Architecture → Design bridge
**Derived from:** Master Specification Revision 6 (hash
`5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9`),
Presentation Map A v2, Presentation Map B v1, Product Design Charter v1.0,
Product Architecture Index v1, Public Representation Constraints v1, Product
Surface Architecture v1

> **Derivation artifact. It governs nothing.** Where this document conflicts
> with an accepted artifact, **the accepted artifact prevails and this document
> is defective.**

---

# 1 · Purpose

## What this document is

The Product Surface Architecture answers *what exists*. This document answers
*how a person moves through what exists*.

It describes the participant's path from first encounter to independent
competence: which phases that path has, which surfaces serve each, which
concepts must be understood before which others, and how verification deepens
along the way.

## What this document is not

**No page layout, navigation, menu, component, wireframe, visual design,
branding, colour, copy, or implementation detail.** Movement is described in
terms of *concepts and surfaces*, never in terms of screens.

It is also **not a new architecture**. It introduces no surface the Product
Surface Architecture does not contain, no principle the Charter does not state,
and no protocol behaviour the Master Specification does not define.

## Relationship to the accepted architecture

| Artifact | Supplies |
|---|---|
| Master Specification Rev 6 | What is true. Every `[SPEC]` citation. |
| Presentation Map A v2 | The commitment sequence — **order is specification-stated** |
| Presentation Map B v1 | The participation stages — **order is `[DESIGN]` derivation** |
| Product Design Charter v1.0 | The destination and the principles governing movement |
| Product Architecture Index v1 | Authority, seams between maps, the marking discipline |
| Public Representation Constraints v1 | What may be said at every point on the path |
| Product Surface Architecture v1 | The thirty-two surfaces (S01–S32) being moved through |

**Every phase, ladder rung and dependency below is `[DESIGN]`.** What each
must not misrepresent is `[SPEC]` and is cited.

## Labels

Experience phases are labelled **E1–E8**, verification levels **V0–V4**.
**Document-local labels, not requirement identifiers** — following O1–O8,
P1–P3, PRC-01–PRC-11 and S01–S32.

---

# 2 · Experience principles

**No new principles.** The Charter's eight, restated only as they govern
*movement*.

| Charter principle | What it means for movement |
|---|---|
| 1 · The protocol informs. The participant decides. | No phase advances on the participant's behalf. Map A's design principle — **the application is an instrument panel, not an autopilot** — governs every transition. |
| 2 · Teach before asking for action. | **This principle produces the ordering of Section 7.** A concept must be available before the action requiring it, not alongside it. |
| 3 · Replace uncertainty with evidence. | The direction of travel through every phase. Section 8's ladder is this principle applied over time. |
| 4 · Build confidence through verification. | Confidence is an *output* of movement, never an input the product requests. **The product never asks for trust it could instead let someone verify.** |
| 5 · Make complexity understandable, not invisible. | Governs *when* a concept appears — progressively, when relevant — never *whether*. Nothing is withheld permanently. |
| 6 · Preserve participant responsibility. | Certain transitions are the participant's alone. Map A Step 8 and Map B Stage 5 both state that **the user owns remembering.** |
| 7 · Tell the truth about limitations. | Waiting, failure, staleness, irreversibility and terminal state are all parts of the path and none may be smoothed over. |
| 8 · Stay faithful to the protocol. | The experience may reorder explanation. **It may never reorder the protocol.** Map A's step order is specification-stated. |

## The one tension the Charter does not resolve

**Principle 2 says teach before asking for action. Principle 5 says introduce
complexity progressively, when it becomes relevant.**

For most concepts these agree. For one they do not: **the Treasury Reward Stake
eligibility rule.** It is relevant only after staking, which principle 5 would
place late — but its consequence, under VF-STK-025, is that a participant can
lose an already-earned entitlement, which principle 2 would place early.

**This is open decision 9 and it is not resolved here.** It is named because
the tension is structural, not incidental, and any experience design will meet
it.

---

# 3 · Overall experience model

## The model is not linear, and the accepted architecture is the reason

A linear model — discovery, understanding, commitment, waiting, issuance,
participation, ownership, verification — is the natural first guess. **The
accepted artifacts do not support it, for three specific reasons.**

**Reason one — issuance forks the path.** Product Architecture Index §3.2
records that Map A Step 8, maturity and principal release, **runs entirely on
the source chain and does not enter Map B at all.** A participant can complete
Step 8 having never reached Map B. After issuance, a participant is in *two
concurrent tracks*: a commitment maturing on its source chain, and a token
that may be held, staked, forged or moved on Base.

**Reason two — verification is an overlay, not a destination.** Charter
principle 4 states confidence emerges *as* participants verify. Map A's
overlays O1–O4 span every step. Placing verification last would make it a
final exam rather than a continuous property, and would contradict the
principle that produced it.

**Reason three — participation is cyclical.** Map B Stages 3 through 6 —
earning, allocation, claiming, extension — recur every epoch. They are not
traversed once.

## The derived model

```
  E1 Discovery
       │
  E2 Understanding
       │
  E3 Rehearsal ····· optional, specified by §5.2
       │
  E4 Commitment ······ Map A Steps 1-3
       │
  E5 Waiting ········· Map A Steps 4-5
       │
  E6 Issuance ········ Map A Steps 6-7
       │
       ├──────────────────────────┐
       │                          │
  E7 Custody              E8 Participation
  Map A Step 8            Map B Stages 1-7
  source chain            Base · cyclical
  │                          ↺ epochs recur
  └──────────┬───────────────┘
             │
      terminal state · overlay P3

  V · Verification deepens continuously across E1-E8
```

## Phase derivations

### E1 · Discovery

**Derived from.** Map A `[DESIGN]` audiences — first-time visitor, skeptic.
Product Surface Architecture Area 1.
**The participant's state.** Has encountered Vinculum. Knows nothing. May be
hostile.
**Question being asked.** *What is this, and why should I keep reading?*
**Surfaces.** S01 · S02.
**Governing.** PRC-04, PRC-09 — no economic promise, no unspecified feature,
from the first sentence onward. Charter principle 7.
**Exit condition.** The participant understands what the protocol claims to do
and what it explicitly does not.

### E2 · Understanding

**Derived from.** Charter principle 2 — **teach before asking for action** —
which requires a phase between discovery and action.
**The participant's state.** Interested. Evaluating.
**Question being asked.** *What would happen if I did this?*
**Surfaces.** S03 · S05 · S28 · S27 · S32 · S20.
**Governing.** Charter principles 2, 5, 7. PRC-04. The concepts of Section 7.1
must all be available by the end of this phase.
**Exit condition.** The participant can state, unprompted, what a commitment
costs, what it returns, and what it risks.

### E3 · Rehearsal

**Derived from.** §5.2's Trust-Building Handshake — **a one-hour commitment at
approximately one dollar that traverses the entire lifecycle.** Map A's
`[DESIGN]` onboarding grouping: *the onboarding path is specified; its
presentation is `[DESIGN]`.*
**The participant's state.** Willing to try, unwilling to risk.
**Question being asked.** *What actually happens — not what am I told
happens?*
**Surfaces.** S31, which depends on S06, S07, S09, S11.
**Governing.** Overlay O5 — three uses per bound identity where the source
mechanism maintains persistent atomic state, one otherwise; **rejected attempts
consume no allowance** (VF-COM-008). Charter principles 2 and 4.

**Why this is a phase and not merely a surface.** The specification provides a
complete lifecycle traversal at trivial cost. That is not a feature of the
commitment phase; it is a distinct participant state — **having verified the
whole path before committing meaningfully to any of it.** No other phase
produces that state.

**`[OPEN]` 24 — this phase is optional and must not be presented as
mandatory.** Nothing in the specification requires a participant to rehearse
before committing. A participant may proceed from E2 directly to E4, including
at scale. Any experience design that treats rehearsal as a gate would impose a
sequence the protocol does not.

### E4 · Commitment

**Derived from.** Map A Steps 1, 2, 3. **Order is specification-stated.**
**The participant's state.** Acting. Assets about to move on their own chain.
**Question being asked.** *Do I want this deal?*
**Surfaces.** S06 · S03 · S28.
**Governing.** The **non-refundable fee warning is `required`** at Step 2 — not
a presentation choice. Overlays O2, O5, O6, O7. PRC-10 wherever price appears.
Charter principles 1, 6.
**Exit condition.** A source-chain transaction exists.

### E5 · Waiting

**Derived from.** Map A Steps 4 and 5. Separated from E4 because **the
participant's role changes**: they have acted and now cannot act further until
the protocol does.
**The participant's state.** Committed. Waiting. Possibly anxious.
**Question being asked.** *Is this working? What if it isn't?*
**Surfaces.** S07 · S08 · S28 · S21.
**Governing.** **Pending disposition is `required behaviour`** at Step 4.
Overlay O6. Charter principle 7 — the honest treatment of delay and failure
belongs here or nowhere.
**Note.** `[OPEN]` 1, the application's role in proof construction, determines
whether this phase contains an action or only an observation.

### E6 · Issuance

**Derived from.** Map A Steps 6 and 7.
**The participant's state.** Receiving an outcome.
**Question being asked.** *What did I get, and why that amount?*
**Surfaces.** S09 · S10 · S22 · S04.
**Governing.** Overlays O2, O4. Charter principles 3, 4 — the amount should be
reproducible, not merely reported.
**The RAC caution.** Index §3.2: the Reward-Accounting Credit is created **at
fee verification, independently of issuance**, and can exist where issuance
does not. This phase must not present it as a subordinate detail. Map A v2
corrected exactly that error.

### E7 · Custody — parallel track

**Derived from.** Map A Step 8, and Index §3.2's statement that Step 8 **does
not enter Map B at all.**
**The participant's state.** Holding a maturing commitment on its source chain,
concurrently with whatever E8 contains.
**Question being asked.** *When do I get my asset back, and what if everything
else failed?*
**Surfaces.** S11 · S02 · S28.
**Governing.** §12 — principal release is **user-initiated** and remains
available even where Base verification failed permanently and no token was ever
issued. Charter principles 1, 6, 7.
**Structural requirement.** **This track must remain legible to a participant
who never entered E8** — including one whose issuance never occurred.

### E8 · Participation — parallel track, cyclical

**Derived from.** Map B Stages 1–7, entered from Map A Step 7 via S10.
**The participant's state.** Holding an issued token. Optionally staking,
earning, claiming, extending, withdrawing, forging, moving.
**Question being asked.** *What can I do with this, and what am I earning?*
**Surfaces.** S10 · S12–S19 · S23 · S29 · S32.
**Governing.** Overlays P1, P2, P3. Charter principles 2, 5, 6, 7.
**The cycle.** Stages 3–6 recur every epoch: earn, allocate, claim, extend.
**Every epoch is exactly 10 days** (VF-STK-006) and **activity at the exact
ending timestamp belongs to the following epoch** (overlay P1).
**Ordering caution.** **Map B's stage order is `[DESIGN]` derivation, not
specification.** §10 states no participant sequence. This phase must not imply
one exists.

### Terminal state

**Derived from.** Overlay P3, §10.6.
**Not a phase.** A condition E8 may reach. At zero remaining capacity Treasury
Reward Stake **permanently closes to new positions and extensions**
(VF-STK-029); all staked tokens become **immediately withdrawable** and
accumulated claimable rewards remain available (VF-STK-030).
**`[OPEN]` 13** — whether terminal state is presented before it is reached.
**Not resolved here.** Overlay P3's note stands: the protocol has a defined end
state, and **nothing is stranded.**

---

# 4 · Experience areas by phase

Which Product Surface Architecture areas participate in each phase. **This is
experience flow, not navigation.**

| Phase | A1 Public | A2 Commitment | A3 Participation | A4 Observation | A5 Verification | A6 Docs | A7 Learning |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| E1 Discovery | ● | | | | ○ | | |
| E2 Understanding | ● | | | ○ | ○ | ● | ● |
| E3 Rehearsal | | ● | | ○ | ○ | ○ | ● |
| E4 Commitment | ○ | ● | | ○ | | ● | ○ |
| E5 Waiting | | ● | | ○ | ○ | ● | |
| E6 Issuance | ○ | ● | | ● | ● | ○ | |
| E7 Custody | ○ | ● | | | ○ | ● | |
| E8 Participation | ○ | ○ | ● | ● | ● | ● | ● |

● primary · ○ supporting

## What the distribution shows

**Area 6 documentation participates in seven of eight phases.** In this
architecture documentation is not an appendix — **every one of Map A's eight
steps names a `docs` surface.** The rules live there and the application
references them.

**Area 5 verification participates in every phase including discovery.** That
follows directly from Map A treating **verifier and skeptic as first-class
audiences rather than edge cases**, a `[DESIGN]` judgement supported by §16 and
VF-VER-006's preference for independent reproduction. A skeptic who never
commits still has a complete path through the product.

**Area 1 never disappears.** PRC-04 and PRC-09 apply to every public-facing
surface at every phase; there is no point at which language stops deriving from
the specification.

---

# 5 · Surface relationships

Four roles a surface plays relative to a concept. **A surface may hold
different roles for different concepts.**

| Role | Meaning |
|---|---|
| **Introduces** | Where a participant first meets a concept |
| **Reinforces** | Where the concept recurs in a concrete instance |
| **Verifies** | Where the concept becomes independently checkable |
| **Requires** | Cannot be understood without a prior concept |

## Concept ownership

| Concept | Introduces | Reinforces | Verifies |
|---|---|---|---|
| No one controls this | S01 | S02 | S24, S27 |
| Your asset never moves | S02 | S06, S07 | S28, explorer links |
| Principal returns regardless | S02 | S11 | S27 §12, S24 |
| Non-refundable fee | **S06 (required)** | S28 | S24 fee destination |
| Price source and freshness | S03 | S06, S21 | S26, S21 |
| Finality varies by chain | S28 | S07 | explorer links |
| Failure is fail-closed | S02 | S07 | S27 §14, S22 |
| Issued amount and how computed | S32 | S09 | S09, S26, S28 |
| Supply and capacity | S04 | S20 | S20, S26 |
| Weight and multipliers | S29 | S12, S32 | S12, S29 |
| Epochs and boundaries | S29 | S23 | **S23 — T0 computable by anyone** |
| Eligibility and the two-epoch rule | S29 | S13 | S13, S23 |
| Rewards are minted VCLM only | S29 | S14, S15 | S14 |
| The gap rule's irreversibility | S29 | S16 | S16 |
| Rounding remainder | S29 | S14 | S27 §10.6 |
| Forge is one-way | S29 | S18 | S18, S04 |
| Transport is not issuance | S29 | S19 | S04, S19 |
| Terminal state | S29 | S20, S13 | S20 |

## Structural relationships

**S27 is upstream of everything.** PRC-01's product consequence: **no product
surface may position itself as the authoritative description of protocol
behaviour**, because a more authoritative one is preserved and available. Every
concept in the table above terminates at S27 if followed far enough.

**S26 is upstream of all asset and price surfaces.** S03, S20 and S21 all
consume it. **PRC-02 and PRC-05 are different obligations** — S26 preserves
five categories, S03 displays a permitted set of eight fields, and
classification is preserved without being among the display fields. This is why
`[OPEN]` 15 matters to the experience and not merely the data layer.

**S10 is the seam.** The only surface both maps name, at their junction. It
must not couple E7 to E8: **a participant can complete Map A Step 8 having
never reached Map B.**

**S31 compresses every commitment concept into one hour.** It reinforces
everything E2 introduced and verifies most of it, which is what makes it a
phase rather than a feature.

**S24 and S25 convert assertion into evidence for the whole product.** Without
them, S02's claims are statements. With them, they are checkable. That is the
difference Charter principle 4 turns on.

---

# 6 · Psychological progression

**The destination is not rewritten. It is the Charter's, used as given:**

> The product succeeds when a participant no longer relies on the application to
> tell them the protocol is working, because they have learned how to verify it
> themselves.

**Competence — not dependence — is the destination.**

The Charter also states the route, in one sentence that this section does no
more than expand:

> The product exists to progressively replace uncertainty with understanding,
> understanding with evidence, and evidence with independent verification.

**Three substitutions. Four states.** They map onto the phases as follows.

| State | Phases | What changed |
|---|---|---|
| **Uncertainty** | E1 | Encounter without knowledge |
| **Understanding** | E2, E3 | The participant can predict what will happen |
| **Evidence** | E4, E5, E6 | The participant sees it happen, on-chain |
| **Independent verification** | E7, E8, and V throughout | The participant confirms it happened without the product's help |

**The substitutions are cumulative, not sequential replacements.** A
participant at the evidence state has not stopped understanding. Each state
adds a capability.

## What the product must not do at each state

Derived from Charter principles, stated as prohibitions because prohibitions
are testable.

| State | The product must not |
|---|---|
| Uncertainty | Resolve it with reassurance. **Principle 3: evidence over assertion.** |
| Understanding | Simplify by concealment. **Principle 5: understandable, not invisible.** |
| Evidence | Present its own report as the evidence. The chain is the evidence. |
| Independent verification | Remain necessary. **Principle: the product's purpose is not to become indispensable.** |

## The states a participant may occupy simultaneously

Because E7 and E8 run concurrently and verification runs continuously, a
participant may be at *evidence* regarding their commitment and at
*understanding* regarding staking at the same moment. **The progression is per
concept, not per person.** An experience design that treats a participant as
occupying one state globally will mis-serve them.

**`[OPEN]` 23** — how the two concurrent tracks after issuance are held in a
participant's mental model. The architecture establishes that they *are*
concurrent and independent; it does not establish how a participant is helped
to hold both. **Not resolved here.**

---

# 7 · Progressive disclosure

**Educational dependency only.** No layout, no timing, no UI. The question
answered is: *what must a participant already understand before this concept is
comprehensible or this action is safe?*

**Governed by Charter principle 2** — teach before asking for action — **and
principle 5** — complexity introduced progressively, when relevant, never
hidden.

## 7.1 · Concepts required before any commitment

Derived from Map A Steps 1–3 and their overlays. **A participant who does not
hold these cannot give informed consent to a commitment.**

| Concept | Source | Why it must precede action |
|---|---|---|
| The asset never leaves its native chain | Map A Step 3, trust cluster | The core mechanic. Everything else is unintelligible without it. |
| The fee is non-refundable | **Map A Step 2, `required`** | The one irreversible cost at the moment of commitment |
| Principal returns even if everything else fails | §12, Map A Step 8 | Bounds the worst case. Charter principle 7. |
| Commitment duration is fixed at creation | Map A Step 1 | Determines the multiplier and the lock period |
| Price has a source and an age | PRC-10, Map A Step 2 | Required wherever price appears |
| Finality time varies by source environment | Map A Step 4 | Sets the expectation E5 depends on |
| Failure is fail-closed; nothing is substituted | Overlay O2, §14 VF-SEC-003 | Determines what a failure means |
| A pending attempt has a defined disposition | **Map A Step 4, `required behaviour`** | The participant's worst moment |

## 7.2 · Concepts required before staking

Derived from Map B Stages 2, 3 and 6.

| Concept | Source | Why it must precede action |
|---|---|---|
| Weight = amount × token multiplier × duration multiplier | VF-STK-003 | The whole basis of participation |
| Acquisition history never affects weight | VF-STK-005 | A fairness property Map B says is worth stating plainly |
| Rewards are paid only in newly minted VCLM | VF-STK-004 | Regardless of which token is staked |
| An epoch is exactly 10 days from T0 | VF-STK-006, overlay P1 | Prerequisite to eligibility |
| **The two-epoch eligibility rule** | VF-STK-011, VF-STK-012 | **See below** |
| **An expired position cannot cover a gap retroactively** | VF-STK-025 | **See below** |
| Rewards use a permanent $0.10 reference, not market price | VF-RAC-005 | Removes an assumption most participants arrive with |

**The two rules requiring special handling.** Map B names the eligibility rule
**the least intuitive in the protocol and the most likely to be
misunderstood**: active at the exact beginning of epoch N, continuously through
N, and still active at the scheduled end of N+1. Combined with VF-STK-025, **a
participant can lose an already-earned entitlement by letting a position lapse
one day early.**

**Canonical sources: Presentation Map B Stage 3 for the rule; Product Surface
Architecture S13 for its product treatment** (Index §6.2). **These are open
decisions 9 and 10 and this document resolves neither.** It
establishes only the dependency: **both must be understood before a position is
created**, not at the moment they bite. That is principle 2 applied, and it is
where the tension named in Section 2 lands.

## 7.3 · Concepts that appear only after issuance

Not withheld — **not yet relevant.** Principle 5 governs.

| Concept | First relevant at | Source |
|---|---|---|
| Portfolio and holdings | E6 | Map A Step 7, S10 |
| Transferability without restriction | E8 | VF-TOK-013, Map B Stage 1 |
| Portability across chains; transport is not issuance | E8 | VF-XCH-019, VF-XCH-021 |
| Claiming, and that claims never expire | E8 | VF-STK-016 |
| Withdrawal does not erase claimable rewards | E8 | VF-STK-020 |
| The SYNTH Forge | E8, **and protocol-gated** | VF-TOK-005; 100,000,000 cumulative CHONX |

## 7.4 · Concepts with no gate

**Available at every phase, to anyone, including someone who never commits.**

Verification concepts — S24, S25, S26, S27, S30 — are ungated by derivation,
not by choice. Map A treats **verifier and skeptic as first-class audiences**;
gating verification behind participation would contradict that and would defeat
the North Star, which describes a capability the product is trying to give
away.

## 7.5 · Concepts whose disclosure point is an open decision

**Recorded, not resolved.**

| Concept | Open decision |
|---|---|
| The inaccessible rounding remainder | 12 |
| Terminal state | 13 |
| Signing-key risk | 6 |
| Whether displayed price is distinguished from valuation input | 16 |
| The specification and its hash | 14 |

---

# 8 · The verification journey

**Derived from** Charter principles 3 and 4, the North Star, Map A overlay O3
(§16), VF-VER-006's preference for **independent reproduction over
self-reported pass counts**, and the permissionless properties both maps name.

Five levels. **V0 is a starting condition, not a level the product offers.**

## V0 · Assertion accepted

The participant believes because they were told.

**The product's position on V0 is stated by Charter principle 4: the
application should never ask someone to trust what they can instead verify.**
V0 is where people arrive. It is not a state the product endorses, and no
surface may be designed to leave someone in it.

## V1 · Evidence shown

The product displays on-chain evidence rather than its own conclusion.

**Surfaces.** S09 · S20 · S04 · S22 · S23.
**Available from.** E6, and E2 for anyone observing.
**What changed.** The participant is looking at chain state instead of a
product claim.

## V2 · Evidence located

The participant follows a reference to the source and reads it themselves.

**Surfaces.** Explorer links across S06, S07, S09, S21, S22 · S24.
**Available from.** E4, first substantively in E5.
**What changed.** The participant no longer needs the product present to see
the fact.

## V3 · Evidence reproduced

The participant recomputes a result the product reported.

**What is reproducible, per the accepted maps:**

| Reproducible | Source |
|---|---|
| Every epoch boundary, from T0 | Overlay P1 — **computable by anyone** |
| Position weight, from public position data | Map B Stage 2 |
| Eligibility for any epoch | Map B Stage 3 — **independently determinable** |
| The full entitlement allocation | Map B Stage 4 — **reproducible from public data** |
| Issued amount, from price record and duration | Map A Step 7 |

**Surfaces.** S29 · S32 · S23 · S14 · S28.
**Available from.** E8 primarily; E2 for the arithmetic.
**What changed.** **The participant can detect a discrepancy.** This is the
first level at which the product could be caught being wrong.

## V4 · Independent verification

The participant checks the system itself, or acts within it without permission.

| Capability | Source |
|---|---|
| Confirm deployed bytecode matches published source | PRC-03, S24 — bytecode hash plus source commit |
| Confirm the absence of control | Overlay O1, §2, §15 — **post-deployment** |
| Confirm requirement-to-test traceability | Overlay O3, §16, VF-VER-001 — S25 |
| **Submit a proof** — anyone may | VF-XCH-012, Map A Step 5 |
| **Finalize an epoch** — anyone may, in chronological order | VF-STK-008, VF-STK-010 |

**Surfaces.** S24 · S25 · S26 · S27 · S30 · S08 · S23.
**Available from.** Ungated. **A skeptic may reach V4 without ever
committing.**
**What changed.** The participant no longer requires the product at all. **This
is the North Star.**

## The permissionless rung

Map B records that **permissionless finalization and permissionless proof
submission express the same principle**: anyone may act, and **no actor gains
authority by acting.** Overlay P1 states it directly.

This makes V4 unusual. In most systems the deepest verification is *reading*.
Here it is *doing* — and the doing changes nothing about the outcome, which is
exactly the point. A participant who finalizes an epoch has learned something
about the protocol's control model that no explanation conveys as well.

**`[OPEN]` 8** determines whether the application offers epoch finalization or
only observes it — and therefore whether the product provides this rung or
leaves it to independent tooling. **Not resolved here.**

**`[OPEN]` 25** — whether the product ever names these levels to participants,
or whether the ladder remains an internal design instrument. **Not resolved
here.**

---

# 9 · Surface dependency graph — learning dependencies

**These are not the implementation dependencies in Product Surface Architecture
Part 4.** They differ, and the difference matters: **S25 traceability is
buildable in implementation Phase 0 but is a late learning dependency**, at V4.
Buildable early, needed late. Building order and learning order are not the
same graph.

## Foundation — no prerequisites

```
S27 preserved specification
S26 machine-readable registry
```

Everything terminates here. **S27 is upstream of every concept in the product**
by PRC-01's consequence.

## Layer 1 — depends only on the foundation

```
S27 → S28 commitment rules      S27 → S29 participation rules
S27 → S30 developer reference   S26 → S03 supported assets
S27 → S01 introduction          S26 → S21 registry and price status
```

## Layer 2 — depends on Layer 1 comprehension

```
S01 + S27      → S02 trust cluster
S01            → S05 market disclosures
S28 + S03      → S06 commitment workflow
S26 + S24      → S20 supply and capacity
S28 + S29      → S32 calculators
```

## Layer 3 — depends on having acted

```
S06 → S07 tracking → S08 proof → S09 issuance → S10 portfolio
S07 → S11 maturity and release          [E7 track]
S10 → S12 stake → S13 eligibility → S14 entitlements → S15 claim
S13 → S16 extension        S12 + S15 → S17 withdrawal
S10 + S04 → S18 forge (gated)          S10 → S19 portability
S13 → S23 epoch dashboard
```

## Layer 4 — depends on wanting to check

```
S24 deployment manifest  ← requires S27 to be meaningful
S25 traceability         ← requires S30
S22 verification activity ← requires S24 + S25
```

**Ungated by phase.** Layer 4 has learning prerequisites but no participation
prerequisite. Someone may enter at Layer 4 directly — the skeptic's path.

## Three dependencies worth stating explicitly

**S13 requires S29 and S23 together.** Eligibility cannot be understood from
position state alone; it requires the epoch model. This is why open decision 9
is hard: the concept has two prerequisites and a consequence that arrives
before either becomes salient.

**S11 requires S02, not S09.** Principal release depends on understanding that
**principal returns regardless** — not on understanding issuance. §12 keeps
principal releasable where issuance never occurred. Wiring S11's comprehension
to S09 would break for the participant who most needs it.

**S31 requires everything in Layer 2 and reinforces all of Layer 3.** The
Handshake is only meaningful to someone who has the commitment concepts, and
it is the fastest route to holding the post-commitment ones.

---

# 10 · Acceptance criteria

This artifact may be accepted when all of the following are true. **Each is
testable against an accepted artifact.**

1. **Every phase, level and dependency traces to an accepted artifact**, and the
   trace is stated in the entry rather than implied.
2. **No new protocol behaviour appears.** Every `[SPEC]` citation resolves to
   Master Specification Revision 6.
3. **No open decision is resolved.** All twenty-two prior decisions remain
   open; the three added here — 23, 24, 25 — are stated as open.
4. **No surface appears that is not in Product Surface Architecture v1**, and
   none is renamed or renumbered.
5. **No page, screen, layout, navigation, component, wireframe, copy, colour or
   brand element appears.**
6. **Map A's step order is preserved as specification-stated** and Map B's stage
   order is preserved as `[DESIGN]` derivation. Neither is presented as the
   other.
7. **The E7/E8 fork is preserved.** No statement implies principal release
   depends on issuance or on participation.
8. **The Charter's destination is used, not rewritten.** Section 6 quotes it
   and expands the Charter's own route sentence without substituting another.
9. **Verification is treated as continuous, not terminal**, consistent with
   Charter principle 4 and overlays O1–O4.
10. **The rehearsal phase is marked optional**, since no specification
    requirement makes the Handshake a precondition of commitment.
11. **Every claim about what the product may say is consistent with PRC-01
    through PRC-11.**
12. **An independent reviewer can determine, for any statement, which accepted
    artifact supports it and whether it is `[SPEC]`, `[REV7]`, `[DESIGN]` or
    `[OPEN]`.**

---

# 11 · Independent review of this draft

Reviewed through five lenses before submission. **Genuine defects only — no
redesign, no optimisation, no invention.** Findings are recorded, not fixed
silently.

## Product Strategist

**Finding 1 — the rehearsal phase risks being read as a funnel stage.**
E3 sits between understanding and commitment in the diagram, which invites
reading it as a step everyone takes. Nothing in the specification requires it.
**Recorded as `[OPEN]` 24 and marked optional in the phase entry.** The defect
would be an experience design that gates E4 behind E3.

**Finding 2 — E2's exit condition is unmeasurable as written.** "Can state,
unprompted, what a commitment costs, returns and risks" describes a state no
surface can observe. It is useful as a design target and useless as a gate.
**Not fixed** — the alternative is inventing a measurement the architecture
does not support.

## UX Architect

**Finding 3 — the concurrent-track problem is identified but unaddressed.**
After E6 a participant is in E7 and E8 simultaneously, with independent
timelines on different chains. This document establishes the independence and
offers nothing on how a participant holds both. **Recorded as `[OPEN]` 23.**
Addressing it requires design decisions outside this artifact's scope.

**Finding 4 — the phase model has no re-entry account.** A participant who
commits a second time re-enters E4 while already in E7 and E8. The model is
drawn as a single traversal. **Real limitation.** Not fixed here, because
correcting it means either drawing a state model — which risks becoming design
— or restating that phases describe concept progression rather than sessions.
**The latter is stated in Section 6: the progression is per concept, not per
person.**

## Trust & Security Reviewer

**Finding 5 — V0 could be misread as an endorsed entry level.** A five-level
ladder beginning at "assertion accepted" implies the product supplies V0.
**Corrected in Section 8** by an explicit statement that V0 is where people
arrive, not a state the product endorses, citing Charter principle 4.

**Finding 6 — Section 7.3 could be misread as permission to withhold.**
Listing concepts that "appear only after issuance" is one wording away from
concealment, which Charter principle 5 forbids. **Corrected** by stating not
withheld — not yet relevant, and by 7.4's ungated set.

**Finding 7 — the `[REV7]` boundary is not restated in this document.**
`REVISION_7_CANDIDATE_AMENDMENTS.md` is not a baseline, and no candidate
amendment appears here. **This is correct behaviour but invisible**, and a
reviewer cannot confirm an absence. Recorded so the absence is deliberate and
checkable.

## Technical Communicator

**Finding 8 — the principle 2 / principle 5 tension is real and structural.**
Named in Section 2 and again in 7.2, both now pointing to the canonical sources
designated in Index §6.2. **It is open decision 9 and is not
resolvable by this artifact**; naming it twice is deliberate, since a
contributor reading only Section 7 would otherwise meet it without warning.

**Finding 9 — Section 5's concept table assigns single owners to concepts that
have several.** "Introduces" implies one surface introduces each concept.
Several are genuinely introduced in more than one place depending on the path
taken — a skeptic entering at Layer 4 meets the control model at S24, not S01.
**Not fixed**, because assigning multiple owners per concept would produce a
table that asserts more precision than the accepted artifacts support.

## Independent Skeptic

**Finding 10 — promoting a surface to a phase is the document's most
questionable derivation.** S31 is one surface in Product Surface Architecture;
E3 makes it a phase of the participant journey. **The justification is that
§5.2 specifies the path and Map A's onboarding grouping names it**, and that it
produces a participant state no other phase produces. **A reviewer should test
this specifically.** If it fails, E3 collapses into E2 or E4 and the model is
otherwise unaffected.

**Finding 11 — the four-state psychological progression is the Charter's, but
the mapping onto eight phases is this document's.** The Charter states the
substitutions; it does not assign them to phases. The assignment is `[DESIGN]`
and is not marked as such in the Section 6 table. **Genuine marking defect.**
Stated here rather than silently corrected: **the phase-to-state mapping in
Section 6 is `[DESIGN]`; the four states and their order are `[SPEC]`-adjacent
Charter content.**

**Finding 12 — Section 4's matrix asserts primary/supporting distinctions the
accepted artifacts do not state.** The ● and ○ assignments are this document's
judgement. **`[DESIGN]`, and a reviewer should treat the matrix as the weakest
derivation in the artifact.**

---

# 12 · Open decisions added by this artifact

Continuing the single sequence. Prior: 1–22. **None resolved here.**

| # | Decision | Affects | Source |
|---|---|---|---|
| 23 | How the two concurrent tracks after issuance are held in a participant's mental model | E7, E8, S10, S11 | §6, Finding 3 |
| 24 | Whether rehearsal is offered as a distinct path, embedded in commitment, or merely available | E3, S31 | §3, Finding 1 |
| 25 | Whether the verification levels are ever named to participants, or remain an internal design instrument | §8, S24, S25 | §8 |

**Running total: twenty-five open product decisions.**

---

# Revision policy

This document is a derivation. It changes when its sources change.

**Revise when:** an accepted artifact is revised · an open decision is resolved
in a way that changes a phase, level or dependency · a review finding is
addressed · a derivation is shown to be unsupported.

**Do not revise to:** add a phase because it seems intuitive · resolve an open
decision by assertion · introduce design under architectural language ·
reconcile the model to a page structure.

**Corrections are recorded visibly**, in the manner of Map A v2's corrections
table.

**Version numbers are whole integers.**

---

*Derived from Master Specification Revision 6 (hash verified), Presentation Map
A v2, Presentation Map B v1, Product Design Charter v1.0, Product Architecture
Index v1, Public Representation Constraints v1 and Product Surface Architecture
v1. Labels E1–E8 and V0–V4 are document-local and carry no specification
authority.*
