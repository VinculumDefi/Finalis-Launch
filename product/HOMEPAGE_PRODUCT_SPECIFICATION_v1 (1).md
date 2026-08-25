# Homepage Product Specification

**Version:** 1
**Status:** Proposed for independent review
**Phase:** Product Design — first implementation-quality design document
**Surface:** S01 · P-01 · Home
**Derived from:** the ten accepted baseline artifacts, governed by Master
Specification Revision 6, hash
`5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9`

> **Design specification. It governs visual design and frontend implementation
> of the homepage, and nothing else.** Where it conflicts with an accepted
> artifact, **the accepted artifact prevails and this document is defective.**
> It creates no protocol requirement, resolves no open decision, and adds no
> architecture.

---

## How to read this document

**Markings are continued from the accepted baseline** and are used here exactly
as the Product Architecture Index §5 defines them.

| Marking | Meaning | May design change it? |
|---|---|---|
| `[SPEC]` | Stated in Master Specification Revision 6 | **No.** |
| `[ARCH]` | Stated in an accepted product architecture artifact | **No.** Reopening it is out of scope for this phase. |
| `[DESIGN]` | A design decision made by this document | Yes. Ours to make and change. |
| `[OPEN]` | A product decision deliberately not yet made | Yes, by making it — and not here. |

**`[ARCH]` is new to this document and carries no new authority.** It exists so
a reviewer can tell at a glance whether a statement is being *cited* from the
frozen architecture or *decided* here. Everything a designer or engineer is free
to change is marked `[DESIGN]`; everything else is inherited.

**Section labels H-01 through H-07 are document-local.** They are not surface
identifiers, not requirement identifiers, and carry no specification authority.
The homepage is one surface — S01 — throughout. The labels name regions of that
one surface so that ordering constraints can be written down and tested.

**Four document-local label families are used**, all carrying no specification
authority and none of them interchangeable:

| Family | Names | Defined at |
|---|---|---|
| **H-01 – H-07** | Regions of the homepage | §3.1 |
| **OC-1 – OC-6** | Ordering constraints — what must never appear above what | §3.2 |
| **R-01 – R-14** | Routes (every call to action on the page) | §7.2 |
| **N-1 – N-5** | Primary navigation entries | §5.2 |
| **T-1 – T-14** | Acceptance tests | §11.2 |

**This document contains no copy.** Content requirements are stated as
*informational obligations* — what a region must convey. The words are
editorial, governed by Website Specification Phase 1 Part 9. Where an example
string appears it is explicitly marked **non-normative** and exists only to
disambiguate a requirement.

**This document contains no colour, typeface, spacing value, grid, or component
library choice.** It states the constraints visual design must satisfy, which is
a different thing, and several of those constraints are load-bearing.

---

# 1 · Purpose

## 1.1 What the homepage exists to accomplish

**`[ARCH]`** Website Specification Phase 1 Part 2 states the purpose without
ambiguity, and this document does not restate it in other words:

> **To let a stranger decide, on accurate information, whether to keep reading.**

Everything below is an implementation of that sentence.

Three properties of it govern the whole design.

**"A stranger."** The page assumes no prior contact, no referral context, no
knowledge of the entity, and no blockchain fluency. **`[ARCH]`** The primary
audience is the **Intelligent Newcomer** — decision 3, CLOSED, Index §6.2 — a
thoughtful person curious enough to understand before acting, assumed to have
neither deep expertise nor complete unfamiliarity.

**"Decide."** **`[ARCH]`** Charter principle 1: the protocol informs, the
participant decides. The decision belongs to the visitor. The page supplies the
inputs to it and takes no position on the outcome.

**"Whether to keep reading."** The homepage's output is a routing intent and
nothing else. **`[ARCH]`** Website Specification Phase 1 P-01: *Inputs: none.
Outputs: routing intent only.*

## 1.2 The four questions, and only four

**`[ARCH]`** Website Specification Phase 1 Part 2 fixes the scope of the page at
four questions. No fifth question is admitted by this document.

| # | Question | Answered at |
|---|---|---|
| Q1 | What is this? | H-01 |
| Q2 | What does it do for me? | H-03 |
| Q3 | What does it not promise? | H-02 |
| Q4 | Where do I go next? | H-05, H-06, and persistent navigation |

**Q3 is answered before Q2.** See §3.2 — this is the single most consequential
ordering constraint on the page and it is derived, not stylistic.

## 1.3 What must be understood before leaving

**`[ARCH]`** Website Specification Phase 1 Part 2 states four things. The
homepage is responsible for all four being available to a visitor who reads the
page and leaves without clicking anything.

1. **The asset never moves off its native chain.** The core mechanic; nothing
   else is intelligible without it. — H-01, H-03
2. **The protocol has no administrator.** No governance, no upgrade path, no
   pause authority, no one who can intervene — including in a participant's
   favour. `[SPEC]` VF-IMM-001 through VF-IMM-006. — H-04
3. **Principal returns at maturity regardless of what else fails.** `[SPEC]`
   §12; principal remains releasable where Base verification failed permanently
   and no token was ever issued. — H-03
4. **Nothing about value is promised.** `[SPEC]` VF-TOK-015. — H-02

## 1.4 What the homepage deliberately does not attempt

Each entry states what is excluded and the artifact that excludes it. **None of
these is a stylistic preference.**

**It does not attempt to convert.** **`[ARCH]`** *A homepage that treats leaving
as failure has already violated* Charter principle 1. Leaving is a legitimate
outcome of the page working correctly.

**It does not attempt to explain the protocol.** Explanation is P-02, P-03,
P-05, P-14, P-15 and P-13. The homepage is an E1 Discovery surface; **`[ARCH]`**
PEA E1's exit condition is only that *the participant understands what the
protocol claims to do and what it explicitly does not.* Attempting E2 on the
homepage would duplicate the reference layer and create the two drifting copies
the architecture exists to prevent.

**It does not attempt to establish trust.** **`[ARCH]`** The trust cluster is
P-02 / S02, and its four claims become checkable at P-10 and P-13, not here.
**`[ARCH]`** Charter principle 4: confidence emerges as participants
successfully verify. A homepage that produced confidence would have produced it
before any verification occurred, which is the persuasion the Charter forbids.

**It does not attempt to produce an emotion.** **`[ARCH]`** Decision 4,
ACCEPTED: the homepage does not attempt to manufacture emotional responses; it
removes unnecessary pressure, ambiguity and uncertainty through truthful
explanation, evidence and verification. What a visitor experiences as calm is
the absence of pressure devices, not the presence of a designed feeling.

**It does not attempt to introduce participation mechanics.** No staking,
weight, multiplier, epoch, eligibility, entitlement, claim, extension,
withdrawal, Forge or portability content appears. **`[ARCH]`** Website
Specification Phase 1 Part 6: *nothing about staking before commitment is
understood*; **`[ARCH]`** PEA §7.2 lists seven concepts required before staking,
none of which a homepage reader holds. Introducing any of them here would put a
concept before its prerequisite, which Charter principle 2 forbids.

**It does not attempt to display protocol state.** See §9.4 — no figure, no
price, no count, no metric appears on the homepage. `[DESIGN]`, derived in full
at §9.4.

**It does not attempt to be authoritative.** **`[SPEC]`** §17.1 preserves the
human-readable Master Specification; **`[ARCH]`** PRC-01's product consequence is
that no product surface may position itself as the authoritative description of
protocol behaviour. The homepage is the least authoritative surface in the
product and its design must not disguise that.

## 1.5 Acceptance criteria for the page

**`[ARCH]`** Website Specification Phase 1 Part 2 states five. They are the
acceptance criteria for this document's implementation and are reproduced
because they are testable.

1. A visitor can state what the protocol does and does not promise.
2. No sentence promises, projects or implies value. **`[SPEC]` PRC-04 /
   §17.1.**
3. Every claim on the page is reachable in one step from a page where it can be
   checked, or is marked as not yet checkable per **`[SPEC]` VF-EXT-002.**
4. The skeptic's route to independent evidence is available **without scrolling
   past a participation invitation.**
5. **Leaving is not treated as failure.**

§11 converts these into pass/fail tests and adds the failure conditions.

---

# 2 · Audience priorities

## 2.1 The structural fact that makes this section necessary

**`[ARCH]`** Website Specification Phase 1 Part 2: *six audiences, six exits,
and one of them is off the site.* **`[ARCH]`** Part 5: navigation **must not
converge** — three of six audiences never need the Workspace, and two of those
reach the deepest verification level the product offers without ever committing
anything.

A single funnel would mis-serve exactly the audiences who most test the
protocol's honesty. The homepage therefore has no single desired outcome, and
this is the source of the design problem: **how does one page serve six exits
without becoming a menu of six equal options that orients nobody?**

## 2.2 The resolution: one pace, six doors

`[DESIGN]` The page is written at **one comprehension pace — the Intelligent
Newcomer's** — and offers **six routes, unranked by prominence except where an
ordering constraint applies.**

This is the derivation, stated so a reviewer can test it:

**`[ARCH]`** Decision 3's closure establishes that the Intelligent Newcomer sets
**tone, pacing and depth — not exclusivity of service.** All six audiences
remain fully supported. Therefore the *prose* is calibrated to one audience and
the *routes* are calibrated to all six. Nothing else needs to vary.

Audiences are not detected, asked, segmented, or offered a "choose your path"
control. `[DESIGN]` Rationale: **`[ARCH]`** Charter principle 1 leaves authority
with the participant, and a self-identification gate makes the product's
subsequent behaviour conditional on a claim the visitor made about themselves
before they knew what the options meant. It also invents an interaction the
architecture does not contain.

## 2.3 How each audience is served

**`[ARCH]`** Columns 2 and 3 are Website Specification Phase 1 Part 2 and Part 5.
Column 4 is `[DESIGN]` — this document's account of how the single page
discharges the obligation.

| Audience | What they need from this page | Where they go | How this page serves them |
|---|---|---|---|
| **First-time visitor** *(the Intelligent Newcomer — primary)* | Orientation and permission to leave | P-02 The Commitment, or away | The page is written for them end to end. H-01 → H-04 read in sequence answer all four questions. H-06 offers P-02 as the next step and does not treat departure as an outcome to be prevented. |
| **Skeptic** | The fastest route to something checkable | Straight to P-10 manifest or P-13 specification | H-05 exists solely for this audience and is positioned so it is **never below a participation invitation**. It routes to evidence, not to more prose. **`[ARCH]`** Part 5: *they came to check, not to learn* — so H-05 must be reachable without reading H-01 through H-04. |
| **Prospective participant** | Enough to know whether their asset qualifies | P-03 Supported Assets | H-06 routes to P-03 directly. The homepage does not attempt to answer the qualification question itself — the registry does, and it is one step away. |
| **Existing participant** | A way past this page entirely | The Workspace | **`[ARCH]`** Part 5: *returning must not route through orientation.* Persistent navigation carries the Workspace entry at the top of every viewport. See §5.6. |
| **Verifier** | Evidence that verification is taken seriously here | P-11 traceability, P-10 manifest | H-05 states what is checkable and what is not yet checkable. **`[SPEC]`** VF-EXT-002 handling at §9.5 is what demonstrates seriousness to this audience — an honest incompleteness is more persuasive to a verifier than a complete-looking page. |
| **Developer** | A route to interfaces and data | P-16 Developer and Verifier Reference | Persistent navigation and H-06 both carry the developer entry. **`[ARCH]`** Part 5: *must never be forced through anything explanatory.* |
| **General visitor** *(no intent)* | To find out what this is and leave | Anywhere, including away | H-01 and H-02 alone discharge the page's obligation to this visitor. **`[ARCH]`** Charter principle 1. |

## 2.4 Why this does not become confusing

Four properties, each `[DESIGN]`, each derived.

**One prose voice, not six.** Only the routes multiply. A visitor reads one
document, not a switchboard.

**Routes are named by destination, not by audience.** `[DESIGN]` The page never
labels a route *"For developers"* or *"For skeptics."* It labels the
destination — the specification, the deployment manifest, the developer
reference, the supported assets registry. Rationale: audience labels require the
visitor to classify themselves correctly before they know what the destinations
contain, and they misfire — a prospective participant may want the manifest
first. Destination labels never misfire, because the visitor is choosing a
thing rather than an identity. This also satisfies the accessibility
requirement at §5.9 that link text be self-describing.

**No route is styled as the recommended one.** `[DESIGN]` Visual weight is
equal across the routes in H-06. Rationale: **`[ARCH]`** Charter principle 1
leaves the decision with the participant, and a visually dominant route is the
product deciding. The single ordering constraint that does apply (§3.2) is a
constraint on *sequence*, not on *emphasis*.

**Six routes, presented once.** `[DESIGN]` The routes are not repeated at
intervals down the page. Rationale: repetition of an invitation is a persuasion
device, and the page's own inventory (§9) admits nothing that exists to increase
the chance of a click.

---

# 3 · Information hierarchy

## 3.1 The order, and why

**`[DESIGN]`** The homepage presents seven regions in fixed order. Derivations
are stated per region; the full specification of each is §4.

| Order | Region | Answers | Why here |
|---|---|---|---|
| 1 | **H-01 Identification** | Q1 | A visitor cannot evaluate a non-promise about a thing they cannot name. H-01 is definitional, not persuasive — it supplies the referent that H-02 then constrains. |
| 2 | **H-02 What is not promised** | Q3 | **`[ARCH]`** Website Specification Phase 1 Part 7, trust moment 1: *the homepage states what is not promised, before stating what is* — and **everything after is read differently.** |
| 3 | **H-03 What the protocol does** | Q2 | The mechanic and the lifecycle in outline, read against the boundary H-02 has already set. |
| 4 | **H-04 The absence of control, and its cost** | Q1, Q3 | **`[ARCH]`** PEA §5 concept ownership: *No one controls this* is **introduced at S01**. It follows H-03 because the absence of an administrator is only meaningful once there is a mechanism it might have intervened in. |
| 5 | **H-05 What can be checked, without asking anyone** | Q4 | The verification route. **Must never appear below a participation invitation** — §3.2, constraint OC-2. |
| 6 | **H-06 Where to go from here** | Q4 | The remaining routes, including the one that leads to participation surfaces. |
| 7 | **H-07 Standing footer** | — | Persistent obligations and the low-traffic entries. §4.7. |

## 3.2 Ordering constraints — what must never appear above what

**These are hard constraints.** A layout that violates one is defective
regardless of how it reads. Each is testable by inspection of the rendered DOM
order at every viewport (§10.5).

**OC-1 · No statement of what the protocol offers may appear above the statement
of what it is not promising.**
**`[ARCH]`** Website Specification Phase 1 Part 7, trust moment 1. This is the
page's first and largest structural commitment. It is what makes the rest of the
page legible as disclosure rather than pitch.
*Scope:* H-02 precedes H-03 in DOM order and in visual order at every viewport.
No summary, hero line, or above-the-fold element may state a benefit, capability
or outcome ahead of H-02.

**OC-2 · No participation invitation may appear above the verification route.**
**`[ARCH]`** Website Specification Phase 1 Part 2, acceptance criterion 4: *the
skeptic's route to independent evidence is available without scrolling past a
participation invitation.*
*Scope:* H-05 precedes H-06 in DOM order and visual order at every viewport. A
"participation invitation" means any route to P-03, P-14, P-17, P-18 or the
Workspace presented as an invitation to act. See §5.6 for the one entry this
constraint interacts with and how it is resolved.

**OC-3 · No claim about the absence of control may appear without its cost, in
the same register.**
**`[SPEC]`** VF-IMM-006: *the inability to repair a deployed defect is an
accepted consequence of eliminating post-deployment control.* **`[ARCH]`**
Website Specification Phase 1 Part 2: **this must not read as a boast** — it is
a limitation as much as a property, and Charter principle 7 requires it be told
as both. **`[ARCH]`** Part 9: *a limitation delivered in a smaller, softer, later
voice than a capability has been concealed by tone.*
*Scope:* within H-04, the property and its cost are adjacent, sequential, and
typographically identical. See §10.6, which makes this a binding visual
constraint rather than an editorial preference.

**OC-4 · Nothing about participation mechanics appears anywhere on the page.**
**`[ARCH]`** Website Specification Phase 1 Part 6; PEA §7.2.
*Scope:* staking, weight, multipliers, epochs, eligibility, entitlements,
claiming, extension, withdrawal, the Forge and portability are absent from every
region including navigation labels and the footer. Routes to P-15 Participation
Rules are not carried by the homepage.

**OC-5 · Nothing about the Trust-Building Handshake appears on the page.**
**`[SPEC]`** §5.2; **`[ARCH]`** PEA §9: *S31 requires everything in Layer 2* —
that is, the commitment concepts, which a homepage reader does not hold.
**`[ARCH]`** `[OPEN]` 24 records that rehearsal is optional and **`[ARCH]`** Part
5 states rehearsal is **never a gate**. Placing it on the homepage risks
presenting it as the first step of a sequence.
*Scope:* the Handshake is reached from P-14, P-17 or P-03, not from S01.
Recorded as a derivation note at §12.3 because it is the one exclusion in this
document a reviewer is most likely to challenge.

**OC-6 · No route to a Workspace action may appear above orientation content in
the page body.**
**`[ARCH]`** Part 5: *returning must not route through orientation* — which is
an obligation to make the Workspace reachable, not an obligation to invite
anyone into it. The reachability obligation is discharged by persistent
navigation (§5.6); the page body carries no Workspace invitation at all.

## 3.3 What "above the fold" means here, and why the page does not optimise for it

`[DESIGN]` **The homepage has no above-the-fold optimisation.**

Rationale: the conventional purpose of above-the-fold treatment is to maximise
the probability of a desired action before the visitor departs. **`[ARCH]`** The
page has no desired action — its output is routing intent only, and departure is
a legitimate outcome. Optimising the first viewport would therefore be
optimising for a goal the architecture does not contain.

What the first viewport must contain is fixed instead by obligation: **H-01 in
full, and the beginning of H-02.** A visitor who reads only the first viewport
must leave knowing what Vinculum is and that they are about to be told what it
does not promise. `[DESIGN]`

---

# 4 · Section-by-section specification

Every region is specified against ten headings. Where a heading is *none* for a
region, that is a requirement — it means the region has no such behaviour and
adding one is a defect.

Throughout: **`[SPEC]`** VF-EXT-002 governs every evidence reference on this
page. Where a referenced artifact does not yet exist, the reference is presented
as incomplete rather than replaced with an invented value or a placeholder that
implies completeness. The mechanism is specified once at §9.5 and applies to
H-04 and H-05.

---

## 4.1 · H-01 Identification

### Purpose
To supply the referent for everything else on the page: what Vinculum is, stated
once, in terms a visitor who has never encountered the protocol can hold.

### Architectural derivation
**`[ARCH]`** Website Specification Phase 1 Part 2, Q1: *a protocol where
committing an asset issues tokens, and the asset never leaves the chain it is
on.* **`[ARCH]`** Website & Application Derivation 4.1, S01 Protocol
Introduction. **`[ARCH]`** PEA E1: the participant *has encountered Vinculum,
knows nothing, may be hostile.*

### Participant questions answered
Q1 — *What is this?*

### Required information
1. **That Vinculum Finalis is a protocol**, not a service, company, platform,
   fund, exchange or product with an operator. `[DESIGN]` — derived from
   **`[SPEC]`** VF-IMM-001/002, whose consequence is that there is no operator to
   name.
2. **The commitment mechanic in one statement:** an asset is committed for a
   fixed time on the chain it already lives on; tokens are issued on Base
   against that commitment; the asset does not move to Base. **`[ARCH]`** Part 2,
   Q1; **`[SPEC]`** §3.1: *source principal does not move to Base.*
3. **That the asset never leaves its native chain** — stated here, not merely
   implied. **`[ARCH]`** Part 2: *this is the core mechanic and nothing else is
   intelligible without it.* See derivation note §12.1 on the relationship
   between this statement and S02's ownership of the concept.

### What must not appear
- Any benefit, outcome, opportunity or invitation. **OC-1.**
- Any figure. §9.4.
- Any claim about who built it, how long it took, or how many people are
  involved. `[DESIGN]` — no accepted artifact justifies a team page or its
  fragments, and **`[ARCH]`** Part 3 lists team pages among what the public
  website must never contain.
- Any comparison to another protocol, product or category. `[DESIGN]` — a
  comparison is a claim about a third party the specification does not contain,
  and **`[SPEC]`** §17.1 requires website language to derive from the current
  specification.

### Interaction behaviour
**None.** H-01 is static text. No animation, no reveal-on-scroll, no typewriter
effect, no parallax, no video, no autoplaying media.

`[DESIGN]` Rationale: **`[ARCH]`** the product is *unhurried — nothing counts
down, nothing is scarce, no figure moves to create urgency.* Motion in a first
viewport is a device for holding attention, and holding attention is not among
the page's obligations.

### Transitions
None into H-01 — it is the page's opening. Transition out of H-01 into H-02 is a
plain document flow. No scroll-jacking, no snap-scroll, no section-locking.
`[DESIGN]` Rationale: scroll-hijacking removes the visitor's control over pace,
which is Charter principle 1 expressed in an input device.

### Navigation destinations
**None from within H-01.** `[DESIGN]` The identification statement carries no
links. Rationale: a link inside the page's only definitional statement invites
departure before the definition is complete, and every destination H-01 could
offer is offered at H-05 or H-06 within one screen's reach.

### Verification opportunities
**None, and this is correct.** V0 in **`[ARCH]`** PEA §8's ladder is *where
people arrive* — not a state the product endorses, and no surface may be
designed to leave someone in it. H-01 leaves the visitor at V0 for the duration
of one region, and H-05 is the page's discharge of that obligation. Recorded so
that the absence is deliberate and checkable.

### Mobile behaviour
Full text at all viewports. **Never truncated, never collapsed, never placed
behind a "read more" control.** No text is removed at narrow viewports; the
region reflows. See §10.4.

### Accessibility considerations
- The page's single `h1` lives here. `[DESIGN]`
- The identification statement is body text, not an image, not text baked into
  an SVG, and not a CSS pseudo-element. `[DESIGN]` — it must be selectable,
  translatable by user agents, and available to assistive technology.
- If a decorative visual accompanies the region it carries an empty accessible
  name and conveys no information the text does not. `[DESIGN]`
- No content in this region depends on colour, hover, or pointer capability.

---

## 4.2 · H-02 What is not promised

### Purpose
To state, before the page describes anything the protocol does, the complete set
of things it does not promise — so that everything the visitor reads afterwards
is read against a boundary that has already been drawn.

### Architectural derivation
**`[ARCH]`** Website & Application Derivation 4.1, S01: *never omit what the
protocol does not do and does not promise. Charter principle 7 — a first
encounter that omits limitations is a persuasion surface.*
**`[ARCH]`** Website Specification Phase 1 Part 7, trust moment 1: *the visitor
learns the product will not oversell. Everything after is read differently.*
**`[SPEC]`** VF-TOK-015; **`[SPEC]`** §17.1 (PRC-04).
**`[ARCH]`** Part 8: *the first thing she reads is what the protocol does not
promise. She notices that, because nothing else she has opened this month began
that way.*

### Participant questions answered
Q3 — *What does it not promise?*

### Required information
1. **No exchange listing, liquidity level, market price, redemption value or
   appreciation is guaranteed.** **`[SPEC]`** VF-TOK-015 — stated in full, not
   summarised into a shorter list. Each of the five is a distinct non-promise
   and a visitor may care about exactly one of them.
2. **That the protocol issues tokens and makes no statement about what they will
   be worth.** `[DESIGN]` — this is the plain-language consequence of
   VF-TOK-015 for the Intelligent Newcomer, and stating the consequence is
   permitted by **`[ARCH]`** decision 20's standard: specification-derived
   mechanics may be stated plainly; projections may not.
3. **That external market activity alters no protocol rule.** **`[SPEC]`**
   VF-TOK-014, VF-PUB-003. Stated as a single fact, not developed — development
   belongs to P-05.
4. **A route to P-05 Disclosures and Limitations**, where the complete
   disclosure set lives. See *Navigation destinations*.

### What must not appear
- **Any softening of a non-promise.** `[DESIGN]` No non-promise is followed by a
  compensating statement in the same breath — no *"but"*, no *"however"*, no
  reassurance appended to a limitation. **`[ARCH]`** Part 9: a limitation
  delivered in a softer voice than a capability has been concealed by tone; a
  limitation immediately neutralised has been concealed by structure.
- **Any listing timeline, likelihood or expectation.** **`[SPEC]`** §17.2;
  **`[ARCH]`** decision 18: listing intent appears **once**, at the disclosures
  surface, and **nowhere else.** It therefore does not appear on the homepage at
  all. This is a hard exclusion, recorded at §9.6.
- **Any market or venue data.** **`[ARCH]`** Decision 17, CLOSED: no third-party
  market or venue data appears on public surfaces.
- **Any risk-disclaimer styling** — small type, grey text, a bordered box, an
  expandable panel, or a footnote. §10.6 makes this a binding visual constraint.

### Interaction behaviour
**None.** Static text, fully expanded, at every viewport.

`[DESIGN]` **The non-promise content may never be placed behind a disclosure
control** — no accordion, no tabs, no tooltip, no "read more", no modal, at any
viewport. Rationale: **`[ARCH]`** Charter principle 5 requires complexity to be
understandable rather than invisible; a limitation one interaction away from
visible is invisible to the visitor who does not perform the interaction, and
the visitor who does not perform it is precisely the one the disclosure exists
to protect.

### Transitions
Plain document flow from H-01 and into H-03. No transition effect marks the
boundary between the non-promises and what follows. `[DESIGN]` Rationale: a
visual transition that separates H-02 from H-03 invites the reading that H-02
was a preamble to be got through.

### Navigation destinations
| Route | Destination | Derivation |
|---|---|---|
| **R-01** *(see §7)* | **P-05 Disclosures and Limitations** | **`[ARCH]`** S05 carries the complete non-guarantee set, the market-independence statement, and the single listing statement. **`[ARCH]`** Acceptance criterion 3: every claim on the page is reachable in one step from a page where it can be checked. |

`[DESIGN]` One route only. The non-promises resolve to one place, and adding a
second destination here would fragment a disclosure that S05 owns whole.

### Verification opportunities
**Indirect, and honestly so.** A non-promise is not verifiable in the sense
H-05's routes are — there is no transaction that demonstrates the absence of a
guarantee. What is verifiable is that the specification says so: the route from
H-02 → P-05 → P-13 §4 and VF-TOK-015 terminates in preserved specification text
whose hash is published. `[DESIGN]`

The homepage does not claim more than that. **`[ARCH]`** Part 7: *a number
without a source* is what destroys trust; a non-promise without a source is the
same failure in a different grammar.

### Mobile behaviour
- Full text at all viewports, expanded, never truncated.
- The five VF-TOK-015 items remain a legible list at narrow widths; they are not
  compressed into a single run-on sentence to save vertical space. `[DESIGN]`
- **`[ARCH]`** OC-1 holds: H-02 precedes H-03 in visual order at every viewport,
  including any layout where columns collapse. §10.5.

### Accessibility considerations
- Marked up as a heading plus a list, not as a paragraph with visual bullets.
  `[DESIGN]` — assistive technology should announce the count of non-promises.
- Not marked up with any element that implies de-emphasis (`small`, `aside`).
  `[DESIGN]` — the semantics must match the register requirement at §10.6.
- Text contrast identical to H-03's, not reduced. `[DESIGN]`
- Route to P-05 is a self-describing link naming the destination, not "learn
  more". `[DESIGN]`

---

## 4.3 · H-03 What the protocol does

### Purpose
To describe the commitment lifecycle in outline — enough that a visitor can
predict the shape of what would happen, and no more — and to state the property
that bounds the worst case.

### Architectural derivation
**`[ARCH]`** Website Specification Phase 1 Part 2, Q2: *it issues tokens against
a time-bound commitment, and returns the principal at maturity.*
**`[ARCH]`** Part 2, *what must be understood before leaving*, items 1 and 3.
**`[SPEC]`** §3.2 end-to-end flow; **`[SPEC]`** §12; **`[SPEC]`** VF-SUP-008.
**`[ARCH]`** PEA E1 exit condition — *understands what the protocol claims to
do.*

### Participant questions answered
Q2 — *What does it do for me?* — answered as mechanism, not as benefit.

### Required information
1. **The lifecycle in outline, in order:** an asset is committed on its own
   chain for a fixed duration → the commitment is verified → tokens are issued
   on Base → the commitment matures → the principal is released on its own
   chain. **`[ARCH]`** Map A's step order is **specification-stated** and may not
   be reordered for presentation. **`[ARCH]`** PEA principle 8: *the experience
   may reorder explanation; it may never reorder the protocol.*
2. **That the duration is fixed at creation.** **`[ARCH]`** PEA §7.1 — a
   commitment prerequisite, introduced here so that "time-bound" is not left
   vague.
3. **That principal returns at maturity regardless of what else fails** —
   including where verification failed permanently and no token was ever issued.
   **`[SPEC]`** §12; VF-SUP-008. **`[ARCH]`** Part 2 lists this among the four
   things that must be understood before leaving.
4. **That release is initiated by the participant.** **`[SPEC]`** §12 makes
   principal release user-initiated. `[DESIGN]` Included here because the outline
   would otherwise imply the principal returns on its own, which is a convenience
   the protocol does not provide and **`[ARCH]`** Charter principle 6 forbids the
   product from implying.
5. **A route to P-02 The Commitment**, where the mechanic becomes checkable.

### What must not appear
- **Any amount, rate, multiplier, duration option, or fee figure.** §9.4.
  `[DESIGN]` — durations and multipliers are P-14's; a fee figure without the
  non-refundability warning is a disclosure failure, and the warning is
  **`[SPEC]`**-`required` at Map A Step 2, which is a Workspace surface, not
  this one.
- **Any statement of what a participant would receive.** **`[SPEC]`** PRC-04 /
  §17.1; **`[ARCH]`** decision 20: a projection presented as indicative of what a
  participant will receive is excluded.
- **Any suggestion that committing is the expected next action.** **OC-2.**
- **The word "simply" and its family**, and any construction that presents the
  lifecycle as effortless. **`[ARCH]`** Part 9's prohibited-language table —
  recorded there as `[DESIGN]` editorial guidance derived from Charter principle
  5, not as a `[SPEC]` prohibition, and adopted here on that basis.

### Interaction behaviour
**Static presentation of the lifecycle.** `[DESIGN]`

If the lifecycle is presented as a sequence of steps, **all steps are visible
simultaneously.** No stepper, no carousel, no autoplaying sequence, no
click-to-advance, no scroll-triggered reveal that shows one step at a time.

Rationale: a sequential reveal makes the visitor perform an interaction to
receive information, which converts reading into progression and progression
into implied commitment. It also fails **`[ARCH]`** the ordering constraints at
§10.5, because a step not yet revealed has no position in visual order. And a
visitor who reads the whole lifecycle at once can compare its beginning to its
end, which is what "predicting what would happen" requires.

### Transitions
Plain document flow. No transition effect. The boundary from H-02 into H-03 is
unmarked (see H-02 *Transitions*).

### Navigation destinations
| Route | Destination | Derivation |
|---|---|---|
| **R-02** | **P-02 The Commitment** | **`[ARCH]`** Part 5: the first-time visitor's path is P-01 → P-02 → P-05. **`[ARCH]`** P-02 presents the four trust-cluster claims and makes each checkable — it is where the mechanic H-03 outlines becomes evidence. |
| **R-03** | **P-14 Commitment Rules** | **`[ARCH]`** Part 5: the prospective participant's path passes through P-14. `[DESIGN]` Carried here rather than in H-06 because the rules are the direct continuation of the outline, and a visitor who wants the fee, rounding, routing and finality detail should not have to scroll past the verification section to find it. |

### Verification opportunities
**One, and it is a route rather than an act.** `[DESIGN]` H-03 states that the
asset does not move; the visitor cannot check that from this page. The route to
P-02 leads to the surface where the claim resolves to deployed contract code and
a finalization transaction — **`[ARCH]`** available only post-deployment, and
until then **`[SPEC]`** VF-EXT-002 requires it be stated as not yet demonstrable.

`[DESIGN]` H-03 therefore makes **no evidentiary claim in its own voice.** It
describes; P-02 demonstrates. This is the homepage's discharge of **`[ARCH]`**
Charter principle 4 — never asking someone to trust what they can instead
verify — under the constraint that the homepage itself holds no evidence.

### Mobile behaviour
- The lifecycle remains a single readable sequence at narrow viewports. If it is
  presented horizontally on wide viewports it becomes vertical, **in the same
  order**, at narrow ones. `[DESIGN]`
- No step is dropped, abbreviated, or collapsed at any viewport. `[DESIGN]`
- If the lifecycle is presented in a diagram, an equivalent text sequence is
  present in the document for every viewport, not only for assistive technology.
  `[DESIGN]` — see §10.4.

### Accessibility considerations
- The lifecycle is an ordered list in markup when it is presented as a sequence.
  `[DESIGN]`
- Any diagram carries a text alternative conveying the same sequence and the
  same relationships, and the diagram is not the only presentation of the
  sequence. `[DESIGN]`
- No step is distinguished from another by colour alone. `[DESIGN]`
- Chain and environment names, where they appear, are plain text — not icons
  alone. `[DESIGN]`

---

## 4.4 · H-04 The absence of control, and its cost

### Purpose
To introduce the protocol's control model — that after deployment no one can
intervene — and to state, in the same register and immediately adjacent, what
that costs.

### Architectural derivation
**`[ARCH]`** PEA §5, concept ownership: *No one controls this* — **Introduces:
S01.** This is the one protocol concept the accepted architecture assigns to the
homepage as its introduction point.
**`[SPEC]`** §2, VF-IMM-001 through VF-IMM-006.
**`[ARCH]`** Website Specification Phase 1 Part 2: *there is no administrator.
This must not read as a boast — it is a limitation as much as a property, and
Charter principle 7 requires it be told as both.*
**`[ARCH]`** Part 10: *that no one is in charge, and that this is a constraint
rather than a boast — they would notice that the absence of an administrator is
described alongside its costs.*

### Participant questions answered
Q1, and part of Q3 — *who is in charge, and what happens when something goes
wrong?*

### Required information
**Stated as a matched pair. Neither half may appear without the other.**

**The property:**
1. **After deployment there is no governance, proposal system, voting system,
   council, administrator, owner role, upgrade authority, proxy administrator,
   pause authority, emergency role, rescue role, or discretionary
   parameter-setting authority.** **`[SPEC]`** VF-IMM-001. The homepage need not
   enumerate all thirteen, but it may not substitute a vaguer phrase that
   permits a reader to imagine one of them remains. `[DESIGN]`
2. **That the absence of continuing control is a deliberate architectural choice,
   not an incomplete governance design.** **`[SPEC]`** §2.

**The cost:**
3. **That no one can intervene — including in a participant's favour.**
   **`[ARCH]`** Part 2, stated in those terms.
4. **That a deployed defect cannot be repaired.** **`[SPEC]`** VF-IMM-006: *the
   inability to repair a deployed defect is an accepted consequence of
   eliminating post-deployment control.* This is the strongest available
   demonstration that the page is telling the truth about limitations, and it is
   specification-stated rather than editorial.

**And:**
5. **A route to where the claim becomes checkable** — P-10 Deployment Manifest
   and P-13 The Specification, subject to §9.5's availability handling.

### What must not appear
- **Any framing of immutability as a safety feature, guarantee, or advantage
  over alternatives.** `[DESIGN]` — **`[SPEC]`** PRC-04 forbids adding
  protocol features; a comparative advantage claim adds a property the
  specification does not contain. **`[ARCH]`** Part 9 forbids *guaranteed,
  assured, safe, risk-free.*
- **Any reassurance following the cost.** **OC-3.** The cost statement is not
  followed by mitigation, context-setting, or a return to the property. It ends
  the pair.
- **Any first-person-plural claim of authority.** **`[ARCH]`** Part 9: the
  product may say what the protocol does; it may not say *we ensure*, *we
  guarantee*, *we've made sure* — **there is no one to ensure anything.** In this
  region the prohibition is not stylistic: a first-person guarantee here would
  contradict the region's own content.
- **Any statement about who deployed it, or who will maintain it.** `[DESIGN]` —
  after finalization there is no maintainer role for the protocol
  (**`[SPEC]`** VF-IMM-001), and naming one would describe a capability the
  specification excludes.

### Interaction behaviour
**None.** Static text.

`[DESIGN]` The property and the cost are rendered as continuous prose or as two
adjacent blocks of identical treatment. They may not be separated by an
interaction, a control, a divider that implies subordination, or any element
that could be dismissed independently.

### Transitions
Plain document flow. **The cost does not arrive by reveal.** `[DESIGN]` — a cost
that appears on interaction has been disclosed only to the visitor who asked for
it.

### Navigation destinations
| Route | Destination | Derivation |
|---|---|---|
| **R-04** | **P-13 The Specification** | **`[ARCH]`** Decision 14, CLOSED: the specification and its hash are published. §2 and §15 are the sections that state the control model; a visitor who wants to confirm the claim reads them directly. **`[ARCH]`** PRC-01: no surface is more authoritative than this one. |
| **R-05** | **P-10 Deployment Manifest** | **`[ARCH]`** Decision 21, CLOSED: the manifest is published as a public surface. **`[SPEC]`** §17.1's six categories are how the absence of control becomes checkable rather than asserted — live addresses and bytecode hash against source commit. **`[ARCH]`** Overlay O1: confirmation of the absence of control is **post-deployment**; §9.5 governs the pre-deployment presentation of this route. |

### Verification opportunities
**This is the page's first genuine verification opportunity**, and it is the
reason H-04 sits where it does.

| Level | What is available here | Source |
|---|---|---|
| **V2 · Evidence located** | The visitor follows R-04 to the preserved specification and reads §2 themselves. | **`[ARCH]`** PEA §8; **`[ARCH]`** decision 14 |
| **V4 · Independent verification** | The visitor follows R-05 to the manifest and confirms deployed bytecode matches published source — **post-deployment**. | **`[SPEC]`** §17.1; **`[ARCH]`** PEA §8, V4 |

`[DESIGN]` The homepage does not name these levels. **`[ARCH]`** `[OPEN]` 25 asks
whether the verification levels are ever named to participants and is
unresolved; this document does not resolve it and does not depend on either
resolution.

### Mobile behaviour
- **The property and the cost remain adjacent and in the same order at every
  viewport.** No layout may place them in separate columns that reorder, or in
  separate cards that a narrow viewport stacks with other content between them.
  `[DESIGN]`
- Neither half is truncated, collapsed, or moved behind a control at any
  viewport. `[DESIGN]`

### Accessibility considerations
- The property and the cost sit under one heading, in one landmark region, with
  no intervening heading that would let a screen-reader user navigate past the
  cost by heading. `[DESIGN]` — this is OC-3 expressed in the accessibility tree.
- The two halves have identical semantic weight: neither is `small`, `aside`,
  `footer`, or a `note` role. `[DESIGN]`
- Enumerated absent roles (VF-IMM-001's list), if presented as a list, are marked
  up as one. `[DESIGN]`

---

## 4.5 · H-05 What can be checked, without asking anyone

### Purpose
To make the product's verification path visible and reachable from the homepage,
to state that it requires nothing, and to be honest about which parts of it do
not exist yet.

### Architectural derivation
**`[ARCH]`** Website Specification Phase 1 Part 2, acceptance criterion 4: *the
skeptic's route to independent evidence is available without scrolling past a
participation invitation.*
**`[ARCH]`** Part 2, audience table: the skeptic needs *the fastest route to
something checkable*; the verifier needs *evidence that verification is taken
seriously here.*
**`[ARCH]`** PEA §7.4: verification concepts are **ungated by derivation, not by
choice** — S24, S25, S26, S27, S30 are available to anyone including someone who
never commits.
**`[ARCH]`** Website & Application Derivation Part 2: a surface belongs to the
public website if it can be used without a wallet; verification is **entirely
public**.
**`[ARCH]`** Part 5: *the verification path is reachable from every page* —
Charter principle 4 expressed as navigation.

### Participant questions answered
Q4, for the skeptic, verifier and developer — *where do I go to check this
myself?* And implicitly: *what does this product expect of me — belief, or
checking?*

### Required information
1. **That verification requires no wallet, no account, no connection, no
   registration and no permission.** **`[ARCH]`** Website & Application
   Derivation Part 2. `[DESIGN]` Stated explicitly rather than left to be
   inferred from the absence of a gate, because the visitor cannot observe an
   absence until they have already committed to clicking.
2. **What can be checked, named as objects rather than as a claim about
   rigour:** the preserved Master Specification and its hash; the deployment
   manifest; the machine-readable registry; the developer and verifier
   reference; and, subject to §12.2, the traceability publication.
   **`[ARCH]`** Decisions 14 and 21, CLOSED.
3. **The specification hash, adjacent to the route into P-13.** `[DESIGN]` —
   see §4.5, *Design decision: where the hash appears*, below.
4. **Which of these do not yet exist.** **`[SPEC]`** VF-EXT-002; §9.5.

### Design decision: where the hash appears
`[DESIGN]` **The specification hash appears once on the homepage, immediately
adjacent to the route into P-13, accompanied by one statement of what it lets
the visitor check.** It does not appear in the footer, in a badge, in a
monospace ribbon, or anywhere it is not immediately actionable.

Derivation: **`[ARCH]`** decision 14 publishes the specification and its hash and
records that **prominence is UX, not architecture** — so this is a design
decision to make, and the standard for making it is the North Star. A hash
presented without an adjacent account of what it verifies is decoration: it
signals rigour without conferring capability, which is the persuasion Charter
principle 4 forbids. A hash presented at the point of departure into the
specification, with one line stating that it lets the reader confirm the copy
they are about to read is the governing one, confers the capability. **The same
string, in two positions, is either an ornament or an instrument.**

### What must not appear
- **Any pass count, test count, audit count, or coverage figure.** **`[SPEC]`**
  VF-VER-006 prefers independent reproduction over self-reported passes;
  **`[SPEC]`** VF-VER-007: nothing is production-ready merely because it
  compiles. **`[ARCH]`** P-11's acceptance criterion: *no pass count is presented
  as sufficient.* A count on the homepage would be a pass count presented
  without even the trace that makes it meaningful. **This is the most likely
  well-intentioned defect in this region.**
- **Any audit-firm logo, security badge, or third-party endorsement.**
  `[DESIGN]` — **`[ARCH]`** Part 3 lists partner logos among what the public
  website must never contain; an endorsement is an assertion the visitor is
  asked to accept, which is V0.
- **Any claim that the protocol has been verified**, as distinct from a
  statement of what is available for the visitor to verify. `[DESIGN]` —
  **`[ARCH]`** Charter principle 3: evidence over assertion. The distinction is
  the region's whole point.
- **Any figure.** §9.4. The hash is not a figure in this sense; it is an
  identifier of a document, carries no magnitude, and is required by decision 14.

### Interaction behaviour
`[DESIGN]` Static list of destinations. **The hash is selectable text** and, if a
copy control is offered, the control is an addition to selectable text rather
than a replacement for it — a hash that can only be copied by pressing a button
is unavailable to anyone the button fails for.

No verification is performed on the visitor's behalf, and no result of any such
check is displayed. **`[ARCH]`** Website & Application Derivation Part 7,
Charter principle 6: *verification is offered, never performed on their behalf
and reported as done.*

### Transitions
Plain document flow. **H-05 precedes H-06 at every viewport — constraint OC-2.**

### Navigation destinations
| Route | Destination | Derivation |
|---|---|---|
| **R-06** | **P-13 The Specification** *(with hash)* | **`[ARCH]`** Decision 14, CLOSED. **`[ARCH]`** PRC-01: the governing document is public and no surface outranks it. |
| **R-07** | **P-10 Deployment Manifest** | **`[ARCH]`** Decision 21, CLOSED. **`[SPEC]`** §17.1's six categories. **`[ARCH]`** Part 5: the skeptic's path is P-10 → P-13 → P-11. |
| **R-08** | **P-16 Developer and Verifier Reference** | **`[ARCH]`** Part 5: the developer's natural beginning, and *must never be forced through anything explanatory* — so the route exists here, high on the page, and not only in the footer. **`[ARCH]`** P-16's acceptance: *a developer can reproduce a verification without contacting anyone.* |
| **R-09** | **P-12 Registry Data** | **`[SPEC]`** §17.1's machine-readable registry; **`[ARCH]`** P-12: *consumable as data and not only as a page.* Serves the developer and the verifier. |
| **R-10** *(conditional)* | **P-11 Traceability** | **`[ARCH]`** `[OPEN]` 5 — whether and how §16 traceability is published — is recorded as **the only remaining blocker in the product**. §12.2 specifies the behaviour under both resolutions. |

### Verification opportunities
**This region is the verification opportunity.** It offers no verification of
its own and claims none; it is the page's transfer of the visitor from V0 to the
surfaces where V2 and V4 are available. **`[ARCH]`** PEA §8: *a skeptic may reach
V4 without ever committing.*

`[DESIGN]` The region states that the routes require nothing. It does not state
how far they go, does not rank them by depth, and does not describe what the
visitor will find — descriptions of destinations are the destinations' business,
and a homepage summary of the manifest would be a restatement that can drift.

### Mobile behaviour
- **OC-2 holds absolutely: no route to P-03, P-14, P-17, P-18 or the Workspace
  may precede this region in visual order at any viewport.** This is the
  constraint most likely to be broken by a responsive reflow and is a required
  test at §10.5.
- The hash is presented so it can be selected on a touch device without
  horizontal scrolling — wrapped rather than clipped, and never inside a
  horizontally scrolling container. `[DESIGN]`
- Destination list remains fully expanded; not collapsed into a disclosure
  control. `[DESIGN]`

### Accessibility considerations
- The hash is announced as a string, not as prose. `[DESIGN]` — it is marked up
  as code so assistive technology may apply character-level reading, and it
  carries a programmatically associated label naming what it is a hash of.
- Each route is a self-describing link naming its destination. **No "learn
  more", "click here", or "explore".** `[DESIGN]`
- Where §9.5's unavailability treatment applies, the unavailable status is in
  the accessible name or an associated description of the affected item — never
  conveyed by styling alone. `[DESIGN]`
- If a copy control is offered for the hash, its success state is announced to
  assistive technology and does not rely on a transient visual toast alone.
  `[DESIGN]`

---

## 4.6 · H-06 Where to go from here

### Purpose
To present the remaining routes — the ones that lead toward participation and
toward the reference layer — and to make departure from the site a legitimate,
unpunished outcome.

### Architectural derivation
**`[ARCH]`** Website Specification Phase 1 Part 2: *six audiences, six exits, and
one of them is off the site.*
**`[ARCH]`** Part 5, the intent table: each audience's natural next surface.
**`[ARCH]`** Charter principle 1; Part 2: *a homepage that treats leaving as
failure has already violated it.*

### Participant questions answered
Q4 — *Where do I go next?*

### Required information
1. **The routes**, named by destination. See *Navigation destinations*.
2. **Nothing else.** `[DESIGN]` No summary of the page, no recapitulation, no
   closing statement, no invitation, no encouragement, no "ready to begin".

### What must not appear
- **Any newsletter, email capture, notification signup, waitlist, or contact
  form.** `[DESIGN]` — **`[ARCH]`** Part 3 lists newsletters among what the
  public website must never contain, and **`[ARCH]`** Website Specification Phase
  1 Part 11, Finding 1 records that **no acquisition mechanism exists anywhere in
  the product and that this is correct by derivation.** A capture form on the
  homepage would be the product's first acquisition mechanism and would arrive
  without any accepted artifact supporting it.
- **Any social media link, feed, follower count, or community route.**
  `[DESIGN]` — **`[ARCH]`** Part 3: no community forum, no social feed. Recorded
  at §12.4 as a derivation note, because the operator maintains public channels
  and their exclusion from this surface is a decision a reviewer should see
  stated rather than discover.
- **Any urgency device**: countdown, deadline, remaining-capacity indicator,
  cohort, phase, "early", or launch timer. **`[ARCH]`** Part 3; Part 9's
  prohibited-language table; Part 2: *nothing counts down, nothing is scarce.*
- **Any social proof**: participant counts, testimonials, quotes, press mentions,
  logos, "trusted by". **`[ARCH]`** Part 2: *no social proof.* **`[ARCH]`** Part
  3 lists testimonials and press sections among what must never appear.
- **Any exit-intent modal, scroll-triggered overlay, or interstitial.**
  `[DESIGN]` — an exit-intent device exists to prevent a departure the Charter
  treats as legitimate. This is the clearest possible instance of treating
  leaving as failure.

### Interaction behaviour
`[DESIGN]` A list of routes, all visible, equal in visual weight, presented once.
No hover-expansion that reveals additional persuasive content. No route is
pre-selected, highlighted, or marked "recommended", "popular", or "start here".

### Transitions
Plain document flow into H-07. The page ends without a closing device.
`[DESIGN]` — **`[ARCH]`** Part 8: *nothing chased her.*

### Navigation destinations
| Route | Destination | Audience served | Derivation |
|---|---|---|---|
| **R-11** | **P-02 The Commitment** | First-time visitor | **`[ARCH]`** Part 5: P-01 → P-02 → P-05. The primary audience's next step. |
| **R-12** | **P-03 Supported Assets** | Prospective participant | **`[ARCH]`** Part 2: *enough to know whether their asset qualifies.* **`[ARCH]`** Part 5: the prospective participant begins at P-01 **or P-03**. |
| **R-13** | **P-04 Tokens and Supply** | All | **`[ARCH]`** P-04's audience is *all six*. `[DESIGN]` Carried here because a visitor who has read H-01–H-04 knows tokens are issued and does not yet know there are three of them or that capacity is finite. |
| **R-14** | **P-06 Supply and Capacity** *(dashboard)* | Skeptic, verifier, prospective participant | **`[ARCH]`** All four dashboards are public and require no wallet. `[DESIGN]` One dashboard route is carried from the homepage rather than four; see §9.3. |

**No route to the Workspace appears in H-06.** Constraint OC-6. The Workspace
entry is persistent navigation only — §5.6.

### Verification opportunities
None directly. R-14 leads to a dashboard, which is observation rather than
verification — **`[ARCH]`** Website & Application Derivation Part 6: *a dashboard
that satisfies the question "how do I check this myself without trusting you"
has been misdesigned.* The homepage must not present R-14 as a verification
route; H-05 owns those and this region does not duplicate them. `[DESIGN]`

### Mobile behaviour
- All routes remain visible; none is moved into an overflow menu or a "more"
  control at narrow viewports. `[DESIGN]`
- Touch targets meet the size requirement at §10.7.
- **OC-2 holds:** this region remains below H-05 at every viewport.

### Accessibility considerations
- Marked up as a navigation landmark distinct from the site's primary
  navigation, with an accessible name distinguishing it. `[DESIGN]`
- Each route's link text names its destination. `[DESIGN]`
- Route order in the DOM matches visual order. `[DESIGN]`

---

## 4.7 · H-07 Standing footer

### Purpose
To carry the persistent obligations and the low-traffic entries that belong on
every public page, without becoming a second navigation surface or a disclaimer
zone.

### Architectural derivation
**`[ARCH]`** PRC-01's consequence: no surface is more authoritative than the
preserved specification — which is a standing statement, not a page-specific
one.
**`[ARCH]`** Part 5: *the verification path is reachable from every page.*
**`[ARCH]`** Charter principle 8: presentation may improve understanding;
presentation must never change protocol meaning.

### Required information
1. **A statement that the Master Specification is the governing document and
   that any product surface, including this one, is subordinate to it.**
   **`[ARCH]`** PRC-01. `[DESIGN]` This is the one place on the page where the
   product speaks about itself, and what it says is that it is not the
   authority.
2. **Routes to P-13 and P-10**, repeated. **`[ARCH]`** Part 5's every-page
   requirement.
3. **Entity attribution: Vinculum Protocol DAO LLC.** `[DESIGN]` No individual is
   named, no jurisdiction is appended, and no team is described.
4. **The repository route**, where the specification, registry and manifest are
   preserved. **`[SPEC]`** §17.1 makes the repository the preservation location.

### What must not appear
- **A risk disclaimer.** `[DESIGN]` — the non-promises are H-02's, in body text,
  in full register. A footer disclaimer would be the same content in a smaller
  voice, which **`[ARCH]`** Part 9 identifies as concealment by tone. Stating it
  twice, once loudly and once quietly, teaches the visitor that the quiet
  version is the real one.
- **A sitemap of all eighteen public pages.** `[DESIGN]` — **`[ARCH]`** Part 5's
  requirement is that the verification path be reachable from every page, *not*
  that every page be reachable from every page. An eighteen-link footer would
  present the reference layer as a directory to be browsed rather than a
  destination to be routed to with intent.
- **Copyright language asserting rights over protocol content**, beyond entity
  attribution. `[DESIGN]` — the specification is a preserved public artifact;
  presenting it as restricted would contradict PRC-01's purpose.
- **Anything excluded from H-06** — social, newsletter, community. The footer is
  not an exemption from §9.6.

### Interaction behaviour
None. Static.

### Navigation destinations
P-13, P-10, and the repository. `[DESIGN]` Three, matching the footer's stated
purpose.

### Verification opportunities
The footer's subordination statement is itself checkable: it routes to the
document that outranks the page making the claim. `[DESIGN]`

### Mobile behaviour
Stacked, fully expanded, no accordion.

### Accessibility considerations
- `contentinfo` landmark. `[DESIGN]`
- Contrast meets the same threshold as body content; the footer is not
  low-contrast by convention. `[DESIGN]`

---

# 5 · Navigation

## 5.1 The governing principle

**`[ARCH]`** Website Specification Phase 1 Part 5: **Not menus. Intent.** And:
**navigation must not converge.** A single funnel would mis-serve the audiences
who most test the protocol's honesty.

**`[ARCH]`** Part 5 also fixes two structural facts this section implements:
**two entry points, not one** — the public site and the Workspace are separate
front doors — and **the verification path is reachable from every page.**

## 5.2 Primary navigation

`[DESIGN]` **Five entries, persistent at the top of every public page.**

| # | Entry | Destination | Derivation |
|---|---|---|---|
| N-1 | **Protocol** | P-02 The Commitment | **`[ARCH]`** Part 5: the first-time visitor's path. The orientation group's substantive surface. |
| N-2 | **Assets** | P-03 Supported Assets | **`[ARCH]`** Part 5: the prospective participant may begin here. Also the entry the existing participant uses to check coverage. |
| N-3 | **Verify** | P-10 Deployment Manifest | **`[ARCH]`** Part 5: *the verification path is reachable from every page.* The manifest is the skeptic's and verifier's stated entry. |
| N-4 | **Specification** | P-13 The Specification | **`[ARCH]`** PRC-01; decision 14, CLOSED. The document that outranks every surface is reachable from every surface. |
| N-5 | **Workspace** | W-01 Portfolio | **`[ARCH]`** Part 5: *returning must not route through orientation.* §5.6. |

**Entry labels above are non-normative illustrations of scope, not approved
copy.** Each label must name its destination and may not name an audience.
Editorial approval is governed by Website Specification Phase 1 Part 9.

### Ordering within primary navigation
`[DESIGN]` **N-3 Verify precedes N-5 Workspace in DOM order and in visual order
at every viewport.**

Derivation: constraint OC-2 requires that the skeptic's route to independent
evidence not sit below a participation invitation. The Workspace entry is a
return route rather than an invitation (§5.6) and so does not by itself trigger
OC-2 — but ordering verification ahead of it costs nothing, removes the ambiguity
rather than arguing about it, and matches the treatment decision 19 applied to a
structurally similar question. The reverse ordering would need a justification
this document cannot derive.

### What primary navigation must not contain
`[DESIGN]`
- A "Connect wallet" control. §5.7.
- A search field. **`[ARCH]`** No accepted artifact contains one, and the public
  site is eighteen pages with an intent-based structure; a search box invites
  keyword entry against a body of material organised by dependency.
- A language selector, until localisation exists. **`[ARCH]`** PRC Part 4 records
  localisation as unaddressed by the baseline.
- A dropdown mega-menu exposing all eighteen pages. `[DESIGN]` — see §4.7 on
  directories versus intent.
- Any badge, counter, dot, or notification indicator. `[DESIGN]` — **`[ARCH]`**
  decision 2, CLOSED: notification is a convenience feature and is not adopted on
  that basis; **`[ARCH]`** *the journey is never notification-driven.*

## 5.3 Secondary navigation

`[DESIGN]` **The homepage has no secondary navigation.**

There is no in-page table of contents, no sticky section index, no breadcrumb
(the homepage is the root), and no sidebar.

Derivation: secondary navigation exists to help a reader traverse a long document
non-linearly. The homepage's regions are ordered by two hard constraints (OC-1,
OC-2) whose entire purpose is that the visitor meets them in sequence. A section
index would offer to defeat the ordering the page's derivation depends on.

**Reference pages elsewhere in the product may require secondary navigation.**
That is out of scope for this document and its absence here is a statement about
S01 only.

## 5.4 Footer navigation

Specified at §4.7. Three routes: P-13, P-10, the repository.

## 5.5 Persistent navigation behaviour

`[DESIGN]`
- Primary navigation is present at the top of the document at every viewport.
- Whether it is sticky is an implementation choice; if sticky, it must not
  obscure content on focus navigation, and it must collapse no entries.
- **It never changes based on visitor behaviour, session count, or scroll
  depth.** No entry appears, disappears, or changes emphasis as the visitor
  proceeds. Derivation: a navigation that changes in response to engagement is
  the product responding to the visitor's likelihood of acting, which is a
  conversion mechanism.
- **It never changes based on wallet connection state**, because the homepage
  never observes wallet connection state. §5.7.

## 5.6 Workspace entry — the one interaction between two constraints

**The obligation.** **`[ARCH]`** Part 5: the existing participant *must never be
forced through* the public site; *returning must not route through orientation.*
**`[ARCH]`** Two entry points, not one.

**The constraint.** OC-2: no participation invitation above the verification
route.

**The resolution.** `[DESIGN]` **The Workspace entry exists in primary
navigation, ordered after Verify, and nowhere in the page body.**

The derivation turns on a distinction the accepted artifacts support: **a door
is not an invitation.** Part 5's requirement is *reachability for someone who
already participates* — it does not ask the homepage to invite anyone into the
Workspace, and **`[ARCH]`** Website Specification Phase 1 Part 11, Finding 3
records that *how a participant reaches the Workspace without passing the public
site is not specified*, because specifying it would require navigation design
that document was not authorised to produce.

This document is authorised to produce that navigation design, and produces the
minimum that discharges the obligation: **one persistent entry, named by
destination, unstyled as a call to action, positioned after the verification
entry, repeated nowhere.** A returning participant reaches their own state in one
click from the root without reading orientation content. A stranger encounters a
door they have no reason to open, rather than an invitation to open it.

**What this resolution does not do:** it does not specify how a returning
participant reaches the Workspace *without loading the homepage at all* — a
bookmark, a direct URL, or a separate host. That remains **`[ARCH]`** Finding 3's
open ground and is out of scope here. Recorded at §12.5.

## 5.7 Wallet connection — not on this page

`[DESIGN]` **The homepage never initiates, requests, detects, or displays wallet
connection state.** No connect control, no auto-detect, no address display, no
network-switch prompt, no injected-provider probe.

Derivation: **`[ARCH]`** Website & Application Derivation Part 2 places a surface
on the public website **if it can be used without a wallet**, and the homepage
is the most public surface in the product. **`[ARCH]`** Charter principle 2 —
teach before asking for action — is the rule that boundary was derived from: *if
understanding required connecting a wallet, the product would ask for an action
before teaching, inverting the principle.*

A homepage that probes for a provider has asked before teaching even if it never
displays the result.

Connection is the Workspace's business, at the point where a participant's own
state is required.

## 5.8 Registry, specification, developer and verification entries — consolidated

Required by the assignment as distinct entries; consolidated here so a reader can
confirm each has a home.

| Entry | Primary nav | Homepage body | Footer |
|---|---|---|---|
| **Verification** (P-10) | N-3 | R-05, R-07 | ● |
| **Specification** (P-13) | N-4 | R-04, R-06 *(with hash)* | ● |
| **Registry — display** (P-03) | N-2 | R-12 | — |
| **Registry — data** (P-12) | — | R-09 | — |
| **Developer** (P-16) | — | R-08 | — |
| **Workspace** (W-01) | N-5 | **none, by OC-6** | — |
| **Traceability** (P-11) | — | R-10, conditional | — |

`[DESIGN]` P-12 and P-16 are not carried in primary navigation. Derivation:
**`[ARCH]`** Part 5 records that the developer *naturally begins at P-16* — that
is, arrives there directly rather than through the homepage — and that neither
the developer nor the verifier should be *forced through anything explanatory*.
Their homepage routes exist in H-05, high on the page and adjacent to the other
verification destinations, which serves the developer who did arrive at the root
without spending a persistent navigation slot on the audience least likely to
need it.

## 5.9 Link text discipline

`[DESIGN]` Every route on this page, in every region and in navigation:
- **Names its destination.** Never "learn more", "read more", "click here",
  "explore", "discover", "get started", "continue".
- **Names it the same way everywhere.** The label for P-13 is the same string in
  N-4, R-04, R-06 and the footer.
- **Is a link, not a button**, when it navigates. Buttons are reserved for
  controls that change state, and the homepage has none.

Derivation: self-describing link text is an accessibility requirement (WCAG 2.2
2.4.4 / 2.4.9) and independently a Charter requirement — **`[ARCH]`** principle
1 leaves the decision with the participant, and a visitor cannot decide whether
to follow a route whose destination is withheld until they arrive.

---

# 6 · Educational progression

## 6.1 What the homepage can and cannot teach

**`[ARCH]`** The homepage is an **E1 Discovery** surface. PEA's exit condition
for E1 is the whole of what the page must achieve:

> The participant understands what the protocol claims to do and what it
> explicitly does not.

**`[ARCH]`** E2 Understanding — whose exit condition is that *the participant can
state, unprompted, what a commitment costs, what it returns, and what it risks* —
belongs to P-03, P-05, P-14, P-13, P-17 and P-06. The homepage does not attempt
it. **`[ARCH]`** PEA Finding 2 additionally records that E2's exit condition is
unmeasurable as written, which is a further reason not to build a homepage that
claims to reach it.

## 6.2 Understanding after each region

`[DESIGN]` What a visitor should be able to state after reading each region, and
what they still cannot state. **The second column is as important as the first:
it is where the homepage's restraint is testable.**

| After | The visitor can state | The visitor still cannot state | Governing |
|---|---|---|---|
| **H-01** | That Vinculum is a protocol; that committing an asset issues tokens; that the asset stays on the chain it is already on. | Anything about value, duration, cost, or who runs it. | **`[ARCH]`** Part 2, Q1 |
| **H-02** | The five things that are not guaranteed; that market activity changes no protocol rule. | What is guaranteed — because the page has not said yet, and this is deliberate. | **`[SPEC]`** VF-TOK-015; **OC-1** |
| **H-03** | The lifecycle in order; that duration is fixed at creation; that principal returns at maturity even if everything else fails; that release is initiated by them. | Any figure — fee, multiplier, duration options, issuance amount. Those are P-14's and P-17's. | **`[SPEC]`** §12; **`[ARCH]`** Map A step order |
| **H-04** | That after deployment no one can intervene, including in their favour; that a deployed defect cannot be repaired. | Whether that is true — the page has told them, and told them where to check. | **`[SPEC]`** VF-IMM-001–006 |
| **H-05** | That checking requires nothing; which artifacts exist to check against; which do not exist yet. | The contents of any of them. | **`[ARCH]`** PEA §7.4; **`[SPEC]`** VF-EXT-002 |
| **H-06** | Where each remaining question is answered. | Any answer to those questions. | **`[ARCH]`** Part 2, Q4 |

## 6.3 The progression's shape

`[DESIGN]` Stated so a designer can see what the sequence is doing rather than
inferring it from the region list.

**Referent → boundary → mechanism → control model → the offer to check → the
routes.**

The visitor acquires, in order: something to think about; the limits of what may
be claimed about it; how it works; who could interfere and cannot; and the means
to stop taking the page's word for any of it.

**`[ARCH]`** PEA §6 maps this against the Charter's four states. The homepage
moves a visitor from **uncertainty** toward **understanding** and no further:
*evidence* requires seeing it happen on-chain, which no homepage region does, and
*independent verification* requires the destinations H-05 routes to.

**`[ARCH]`** PEA §6 also states the prohibition that governs this progression:
at the uncertainty state the product **must not resolve it with reassurance** —
principle 3, evidence over assertion. Every region above resolves uncertainty by
narrowing what may be claimed or by routing to something checkable. **No region
resolves uncertainty by asserting that the visitor may rely on the product.**

## 6.4 What the progression must never do

**`[ARCH]`** Website & Application Derivation Part 8:

**Simplify by concealment.** Charter principle 5. The homepage's brevity is
achieved by **scope** — four questions — not by **omission within scope**. Every
region states its content completely and routes onward for depth. A region that
stated half a mechanic to keep the page short would be concealment; a region
that states a mechanic completely and does not state the next one is sequence.

**Substitute reassurance for evidence.** Charter principle 3. *An explanation
that ends in "you can trust that this works" has failed where one ending in
"here is how to check" would have succeeded.* H-05 is the page's structural
commitment to the second ending.

---

# 7 · Calls to action

## 7.1 The defining property

**`[ARCH]`** Website Specification Phase 1, P-01: *Inputs: none. Outputs: routing
intent only.*

**Every call to action on the homepage is a route. None changes state.** There is
no form, no submission, no transaction, no connection, no subscription, no
selection persisted, and no preference recorded.

`[DESIGN]` Consequence for implementation: **the homepage has no `button`
elements that act, no client-side state, and no writes of any kind** — no
`localStorage`, no cookie set by the page's own code, no analytics event tied to
an intent to act. Whether a consent banner is legally required is out of scope;
if present, §10.8 constrains it.

## 7.2 The complete CTA inventory

Every route on the page, with its justification. **A route not in this table does
not belong on the page.**

| ID | Region | Destination | Serves | Justification |
|---|---|---|---|---|
| **R-01** | H-02 | P-05 Disclosures and Limitations | All | **`[ARCH]`** Acceptance criterion 3 — every claim reachable in one step from where it can be checked. S05 owns the complete non-guarantee set. |
| **R-02** | H-03 | P-02 The Commitment | First-time visitor | **`[ARCH]`** Part 5: P-01 → P-02 is the primary audience's derived path. |
| **R-03** | H-03 | P-14 Commitment Rules | Prospective participant | **`[ARCH]`** Part 5: the prospective participant's path passes P-03 → P-14 → P-17. The rules are the direct continuation of H-03's outline. |
| **R-04** | H-04 | P-13 The Specification | Skeptic, verifier | **`[SPEC]`** §2 and §15 are where the control model is stated. **`[ARCH]`** PRC-01. |
| **R-05** | H-04 | P-10 Deployment Manifest | Skeptic, verifier | **`[SPEC]`** §17.1's six categories make the control-model claim checkable. **`[ARCH]`** Decision 21. |
| **R-06** | H-05 | P-13 The Specification *(with hash)* | Skeptic, verifier | **`[ARCH]`** Decision 14, CLOSED — published with its hash. §4.5's hash placement decision. |
| **R-07** | H-05 | P-10 Deployment Manifest | Skeptic, verifier | **`[ARCH]`** Part 5: the skeptic's path begins P-10 → P-13 → P-11. |
| **R-08** | H-05 | P-16 Developer and Verifier Reference | Developer | **`[ARCH]`** Part 5: the developer's natural entry; must not be forced through anything explanatory. |
| **R-09** | H-05 | P-12 Registry Data | Developer, verifier | **`[SPEC]`** §17.1's machine-readable registry; **`[ARCH]`** P-12 is consumable as data. |
| **R-10** | H-05 | P-11 Traceability *(conditional)* | Verifier | **`[ARCH]`** `[OPEN]` 5. Behaviour under both resolutions at §12.2. |
| **R-11** | H-06 | P-02 The Commitment | First-time visitor | As R-02; H-06 carries it for a visitor who reached the routes without following R-02. |
| **R-12** | H-06 | P-03 Supported Assets | Prospective participant | **`[ARCH]`** Part 2: *enough to know whether their asset qualifies.* |
| **R-13** | H-06 | P-04 Tokens and Supply | All | **`[ARCH]`** P-04's audience is all six; H-01 established that tokens are issued without establishing that there are three. |
| **R-14** | H-06 | P-06 Supply and Capacity | Skeptic, verifier, prospective participant | **`[ARCH]`** All dashboards public, no wallet. §9.3 on why one dashboard rather than four. |
| **N-1..N-5** | Nav | P-02, P-03, P-10, P-13, W-01 | All | §5.2. |
| **F-1..F-3** | Footer | P-13, P-10, repository | All | §4.7. |

**R-02 and R-11 are the same destination reached twice**, and this is the only
repetition on the page. `[DESIGN]` Justification: P-02 is the primary audience's
derived next step, and a visitor who read H-03 and a visitor who skimmed to H-06
are the same audience arriving by different routes. The repetition is
structural, not persuasive: the second instance carries no additional emphasis,
no different label, and no encouragement.

## 7.3 Why no other CTA exists

Stated per excluded CTA, because "we chose not to" is not a justification the
baseline accepts.

**No "Get started", "Commit now", "Launch app" or equivalent.** **`[ARCH]`** PEA
§7.1 lists **eight concepts required before any commitment** — including that the
fee is non-refundable and that a pending attempt has a defined disposition — and
a homepage reader holds at most three of them. A CTA to commit from this page
would ask for action before teaching, which **`[ARCH]`** Charter principle 2
forbids in its plainest form.

**No "Connect wallet".** §5.7.

**No newsletter, waitlist, or notification signup.** **`[ARCH]`** Part 3 excludes
newsletters; **`[ARCH]`** decision 2, CLOSED, declines notification as a
convenience feature; **`[ARCH]`** Finding 1 records that the absence of any
acquisition mechanism is **correct by derivation**.

**No "Try the Handshake".** Constraint OC-5; **`[ARCH]`** `[OPEN]` 24; **`[ARCH]`**
Part 5: *rehearsal is never a gate.* A homepage CTA would present it as the
first step of a sequence, which is exactly the misreading `[OPEN]` 24 exists to
prevent.

**No "Calculate what you'd receive".** **`[ARCH]`** P-17 is public and ungated
and a visitor may reach it — but not from the homepage. `[DESIGN]` Derivation:
**`[ARCH]`** P-17 *sits closest to `[OPEN]` 20's edge of any surface in the
inventory*, and **`[ARCH]`** decision 20 excludes any projection presented as
indicative of what a participant will receive. A homepage CTA phrased around
what the visitor would receive is that projection in the label. The calculator is
reached from P-14 and P-03, where the surrounding material establishes that a
computed value is computed rather than promised.

**No "Share", "Follow", or social route.** **`[ARCH]`** Part 3 excludes social
feeds and community forums. §12.4.

**No "Contact us" or support route.** `[DESIGN]` — **`[SPEC]`** VF-IMM-001: there
is no administrator, owner role, or emergency role. A support CTA would describe
a capability the specification excludes, which **`[SPEC]`** §17.1's second
prohibition forbids. **`[ARCH]`** Part 8 states the honest position: the
developer *integrates without ever speaking to anyone, which is the only
integration story a protocol with no administrator can honestly offer.* The same
is true for participants, and the homepage must not imply otherwise.

**No "Back to top".** `[DESIGN]` Trivial, but excluded on the same principle as
§5.3: the page's regions are ordered by constraint and a return control invites
re-reading out of sequence. A visitor may scroll.

## 7.4 The absent CTA that is the point

**Departure.** `[DESIGN]` The page offers no route that keeps a visitor on the
site when they are done. **`[ARCH]`** Part 2, acceptance criterion 5: leaving is
not treated as failure. **`[ARCH]`** Part 8: *nothing chased her. If she returns
in three weeks, nothing will have changed to punish the delay.*

Implementation consequence: no exit-intent handler, no beforeunload prompt, no
re-engagement mechanism, and nothing on the page whose behaviour differs for a
returning visitor.

---

# 8 · Trust architecture

## 8.1 The form of trust this page is permitted to earn

**`[ARCH]`** Website Specification Phase 1 Part 10 states it exactly, and this
document does not extend it:

> That it told them the truth early, including the unflattering parts. **This is
> the only form of trust the architecture permits the product to earn**, and it
> is earned by disclosure rather than assurance.

**`[ARCH]`** Part 7 adds the distinction the page must not blur: **confidence
increases only at verification.** Every other moment reduces uncertainty, which
is a different thing — *the absence of doubt is not the presence of confidence,
and the product must not confuse them.*

**Consequence for the homepage: the homepage cannot create confidence and must
not try.** It reduces uncertainty. Confidence is produced downstream, by the
visitor, at P-10 and P-13 and beyond. `[DESIGN]`

## 8.2 The homepage's four trust mechanisms

`[DESIGN]` Each is a structural property of the page rather than a claim the page
makes.

**Mechanism 1 — the non-promises come first.** **`[ARCH]`** Trust moment 1: *the
visitor learns the product will not oversell. Everything after is read
differently.* This is OC-1, and it is the page's largest single trust
contribution. It costs the page its most persuasive position and spends it on a
disclosure.

**Mechanism 2 — the limitation is stated in the same register as the property.**
OC-3 and §10.6. **`[ARCH]`** Part 9: a limitation delivered in a smaller, softer,
later voice than a capability has been concealed by tone. **`[SPEC]`**
VF-IMM-006 supplies the unflattering half in the specification's own words, which
means the page is not being generous — it is being accurate.

**Mechanism 3 — incompleteness is reported rather than filled in.** §9.5.
**`[SPEC]`** VF-EXT-002. **`[ARCH]`** Part 8: the skeptic *finds three entries in
the manifest marked unavailable, reported as incomplete rather than filled in.*
Before deployment, the homepage's verification section is partly a list of things
that do not exist yet, and it says so.

**Mechanism 4 — the verification route requires nothing and precedes the
participation routes.** OC-2. **`[ARCH]`** The product *expects to be verified
rather than believed.* A page that placed the check after the invitation would
have ordered them by which it preferred.

## 8.3 How the page avoids each named failure

The assignment names five. Each is addressed by a structural property, not by
tone.

| Failure | How the page avoids it | Derivation |
|---|---|---|
| **Hype** | No superlative, no comparison, no category claim, no figure (§9.4), no social proof. **`[ARCH]`** Part 9's prohibited-language table applies to every region. The page makes no claim about its own significance. | **`[ARCH]`** Part 9; **`[SPEC]`** §17.1 |
| **Fear** | No warning framed as consequence-of-inaction. No scarcity. **`[SPEC]`** VF-IMM-006's cost statement is a fact about the protocol, stated once, without amplification and without a remedy attached. The page never suggests that not participating carries a cost. | **`[ARCH]`** Charter 7; Part 2 |
| **Urgency** | No countdown, deadline, phase, cohort, capacity indicator, or launch timer. **`[ARCH]`** *There is no version of the product where acting today beats acting next year, and the voice reflects that.* No element on the page changes over time except by specification revision. | **`[ARCH]`** Part 2, Part 9 |
| **Persuasion** | No route is emphasised over another (§2.4). No CTA repeats for effect (§7.2). No region builds to a point — **`[ARCH]`** Part 9: *it states what is true and what is not known; it does not build to a point.* The page's own summary of itself, in the footer, is that it is not the authority. | **`[ARCH]`** Charter 1; Part 9 |
| **False certainty** | The page makes no evidentiary claim in its own voice (§4.3). Every claim routes to where it is checkable or is marked not yet checkable. No pass count, no audit badge, no endorsement (§4.5). The specification outranks the page and the footer says so. | **`[SPEC]`** VF-EXT-002; **`[ARCH]`** PRC-01, Charter 3 |

## 8.4 How the page avoids becoming defensive

`[DESIGN]` This is the harder half, and the failure mode is real: a page composed
of disclosures, limitations and caveats can read as a document written by someone
expecting an accusation. Four properties prevent it.

**Limitations are stated, not justified.** VF-IMM-006's cost is stated once and
not argued for. A defence would be the page trying to make the visitor accept a
limitation; a statement leaves acceptance to the visitor, which is **`[ARCH]`**
Charter principle 1.

**Nothing is pre-rebutted.** The page anticipates no objection, addresses no
criticism, and includes no FAQ. **`[ARCH]`** Part 3 excludes an FAQ that restates
rules the reference layer owns; the deeper reason is that a rebuttal is a
persuasive form and its presence would mean the page had a position to defend.

**Disclosures are in the same voice as descriptions.** §10.6 makes this
typographic. The page has one register throughout, so no region reads as the
legal one.

**The page is short.** `[DESIGN]` Length is itself a signal: an orientation
surface that runs long has usually started arguing. The scope discipline of four
questions is what keeps it short, and it is also what keeps it calm.

## 8.5 What would destroy the homepage's trust

**`[ARCH]`** Part 7's failure table, applied to this surface.

| Failure | Why it is fatal here |
|---|---|
| **A number without a source** | *The product becomes the authority. The North Star inverts.* §9.4's exclusion of all figures removes the failure mode from this surface entirely. |
| **A claim that cannot be checked anywhere** | H-04's control-model claim is the page's largest, and R-04/R-05 exist so it is not the page's word. Without them H-04 is an assertion. |
| **Convenience that removes a decision** | **`[ARCH]`** *An auto-extend would end the product's credibility permanently.* The homepage's version is smaller and easier to miss: a pre-selected route, a recommended path, a "most people start here". Each removes a decision the visitor was supposed to make. |
| **A stale page after a specification revision** | **`[SPEC]`** VF-PUB-001 makes a revision a product event. §9.7. |

## 8.6 The eleventh small helpfulness

**`[ARCH]`** Website Specification Phase 1's closing warning is the standing risk
for this document's implementation and is recorded here rather than paraphrased
away:

> The risk is not that someone decides to make the product indispensable. It is
> that someone makes it slightly more helpful, eleven times.

`[DESIGN]` For the homepage specifically, the eleven small helpfulnesses are
predictable, and each is individually reasonable: a "quick start" summary; a
recommended path; a live supply figure to show the protocol is real; an audit
badge to reassure; an email capture for people who are not ready yet; a
testimonial from an early participant; a countdown to a deployment date; a
collapsed disclosures panel to shorten the page; a "most visitors read this next"
hint; a wallet-detect that greets a returning participant; a chat widget.

**Every one of them is excluded by a named constraint above.** §11.3 makes the
list a review instrument.

---

# 9 · Content priorities

## 9.1 Essential — the page fails without it

| Content | Region | Why essential |
|---|---|---|
| The commitment mechanic, including that the asset never leaves its chain | H-01, H-03 | **`[ARCH]`** *The core mechanic; nothing else is intelligible without it.* |
| The complete VF-TOK-015 non-promise set | H-02 | **`[SPEC]`** VF-TOK-015; **`[ARCH]`** trust moment 1 |
| Principal returns at maturity regardless of what else fails | H-03 | **`[SPEC]`** §12; **`[ARCH]`** Part 2 |
| The absence of an administrator **and** its cost | H-04 | **`[SPEC]`** VF-IMM-001–006; **`[ARCH]`** Charter 7 |
| The verification routes, and that they require nothing | H-05 | **`[ARCH]`** Acceptance criterion 4; PEA §7.4 |
| The specification hash, adjacent to its route | H-05 | **`[ARCH]`** Decision 14, CLOSED |
| Statement that the specification outranks this page | H-07 | **`[ARCH]`** PRC-01 |
| Routes for all six audiences | H-05, H-06, nav | **`[ARCH]`** Part 2: six audiences, six exits |

## 9.2 Important — the page is worse without it, and still valid

| Content | Region | Why important, not essential |
|---|---|---|
| That duration is fixed at creation | H-03 | Prevents a vague reading of "time-bound", but P-14 owns it and the page remains truthful without it. |
| That release is user-initiated | H-03 | Prevents an implied convenience. **`[ARCH]`** Charter 6. P-14 and W-05 own it. |
| That external market activity alters no protocol rule | H-02 | **`[SPEC]`** VF-TOK-014. P-05 owns the full statement. |
| That Vinculum is a protocol rather than a company | H-01 | Sets the frame for H-04. H-04 would still land without it. |
| Route to P-04 Tokens and Supply | H-06 | Serves all six audiences; not required by any acceptance criterion. |
| Route to P-06 Supply and Capacity | H-06 | One live-evidence entry from the root. §9.3. |

## 9.3 Optional — permitted, and requiring justification each time

**`[DESIGN]` The default for everything in this class is exclusion.** Nothing may
be added on the grounds that it seems useful; **`[ARCH]`** Website Specification
Phase 1's revision policy states it directly: *do not revise to add a page
because it seems useful.* The same standard applies to page content.

| Content | Status | Condition |
|---|---|---|
| **Routes to the other three dashboards** (P-07, P-08, P-09) | Excluded by default; permitted on evidence | `[DESIGN]` One dashboard route is carried (R-14) because a visitor at the root has no participation state and the supply/capacity view is the only one whose subject — finite capacity, defined end state — was raised on the page. P-07 requires the price-status frame, P-08 requires understanding what verification is for, and P-09 requires the epoch model, none of which the homepage supplies. Adding them would route a visitor to material whose prerequisites they lack. |
| **A diagram of the commitment lifecycle** | Permitted | Must satisfy §4.3's static requirement, §10.4's text-equivalent requirement, and carry no figure. |
| **A visual identity element in H-01** | Permitted | Decorative only; empty accessible name; conveys no information the text does not; no motion. |
| **A one-line statement of the protocol's defined end state** | Excluded pending `[OPEN]` 13 | **`[ARCH]`** `[OPEN]` 13 asks whether terminal state is presented before it is reached. Unresolved. The homepage does not pre-empt it. §12.6. |
| **A statement of signing-key risk** | Excluded pending `[OPEN]` 6 | **`[ARCH]`** `[OPEN]` 6, governed by **`[SPEC]`** VF-EXT-002 and anticipated by `[REV7]` VF-ORC-016. Not governing; not resolved here. §12.6. |

## 9.4 Excluded — figures

`[DESIGN]` **No figure appears on the homepage.** No price, no supply number, no
issuance total, no capacity remaining, no asset count, no chain count, no
participant count, no fee percentage, no multiplier, no duration option, no
date, no percentage of anything.

This is the largest single design decision in this document and it is derived
rather than preferred. Five reasons, each independently sufficient:

**One.** **`[SPEC]`** VF-PUB-002 requires that every public price display carry
its selected source and last update time, and **`[ARCH]`** decision 19 applies
that obligation to **every price the product displays, everywhere**. A price on
the homepage would drag two supporting data elements and a staleness
explanation onto an orientation surface, or it would violate a specification
requirement. Excluding price removes the choice.

**Two.** **`[ARCH]`** Part 5: *every displayed figure must lead to its source in
one step* — Charter principle 4 expressed as navigation. A figure on the homepage
must therefore carry its source link, which makes the homepage a dashboard
fragment. The dashboards are P-06 through P-09 and they are one click away.

**Three.** **`[ARCH]`** Part 7: *a number without a source — the product becomes
the authority. The North Star inverts.* The homepage is the surface with the
weakest ability to supply sources, because it is the surface furthest from the
evidence layer.

**Four.** A live-updating figure is a motion device on a page that
**`[ARCH]`** requires *nothing to move to create urgency*, and a growth figure is
social proof, which **`[ARCH]`** Part 2 excludes.

**Five.** Pre-deployment, nearly every figure the homepage might display is
**`[ARCH]`** unavailable — Index §7.2: lifetime issuance, capacity, activation,
verification transactions and contract state are all post-deployment. A homepage
built around figures would launch either empty or dishonest.

**This is not concealment.** **`[ARCH]`** Charter principle 5 forbids hiding
mechanics, not deferring quantities. Every figure lives one route away, on a
surface that can supply its source. §12.7 records this as the derivation a
reviewer is most likely to test.

**The specification hash is not a figure** under this rule: it identifies a
document, carries no magnitude, cannot become stale without the document
changing, and is required by **`[ARCH]`** decision 14.

## 9.5 Excluded — evidence that does not exist yet

**`[SPEC]`** VF-EXT-002: *an unavailable external address or unfinished
architecture deliverable must be reported as incomplete rather than replaced with
an invented value or behavior.*

**`[ARCH]`** Index §7.2 lists what is unavailable before deployment: registry
immutability, contract code, absence of control, finalization transaction,
lifetime issuance, capacity, activation, and verification transactions.

`[DESIGN]` **Required homepage behaviour, pre-deployment:**

1. **A route to a surface whose evidence does not yet exist is presented as a
   route to a surface whose evidence does not yet exist.** It is not hidden, not
   disabled without explanation, and not presented as though it were complete.
2. **The unavailability is stated in text**, in the same register as the rest of
   H-05, and is available to assistive technology. Not conveyed by styling,
   opacity, or a disabled attribute alone.
3. **No placeholder value, no "coming soon", no estimated date.** `[DESIGN]` —
   "coming soon" is a schedule claim, and a schedule claim about a deliverable is
   the forward-looking statement **`[SPEC]`** §17.1's second prohibition
   excludes.
4. **H-04's claim about the absence of control is stated as specification content
   pre-deployment**, not as an observed property. **`[ARCH]`** Overlay O1:
   confirmation is post-deployment. The claim does not change; the basis for it
   does, and the page says which basis it is on.
5. **Post-deployment the same regions carry the same text with the availability
   statements removed.** No copy is rewritten; only the availability treatment
   changes.

**`[ARCH]`** Website Specification Phase 1, acceptance criterion 3 permits
exactly this: every claim is *reachable in one step from a page where it can be
checked, or is marked as not yet checkable per VF-EXT-002.*

## 9.6 Excluded — everything else, with its exclusion source

| Excluded | Source |
|---|---|
| Blog, roadmap, milestone tracker | **`[ARCH]`** Part 3 |
| Newsletter, email capture, waitlist | **`[ARCH]`** Part 3; Finding 1 |
| Team page, founder bio, headshot, individual attribution | **`[ARCH]`** Part 3; `[DESIGN]` entity-only attribution |
| Testimonials, quotes, case studies | **`[ARCH]`** Part 3; Part 2 (no social proof) |
| Partner logos, audit badges, security seals | **`[ARCH]`** Part 3 |
| Press section, media mentions | **`[ARCH]`** Part 3 |
| Community forum, Discord/Telegram route, social feed | **`[ARCH]`** Part 3; §12.4 |
| FAQ restating rules the reference layer owns | **`[ARCH]`** Part 3 |
| Countdown, launch timer, phase indicator | **`[ARCH]`** Part 3; Part 2 |
| Any listing timeline, likelihood or expectation | **`[SPEC]`** §17.2; **`[ARCH]`** decision 18 — the single listing statement appears **only** at P-05 |
| Any market or venue data | **`[ARCH]`** Decision 17, CLOSED |
| Any price presented as a guaranteed trading price | **`[SPEC]`** VF-PUB-002 |
| Any supply projection or decay schedule | **`[ARCH]`** P-04's acceptance criterion, pending `[OPEN]` 20's treatment; excluded from the homepage under §9.4 regardless |
| Participation mechanics of any kind | **OC-4**; **`[ARCH]`** Part 6; PEA §7.2 |
| The Trust-Building Handshake | **OC-5**; **`[ARCH]`** `[OPEN]` 24; §12.3 |
| A calculator or any computed value | §7.3; **`[ARCH]`** decision 20 |
| Chat widget, support route, contact form | §7.3; **`[SPEC]`** VF-IMM-001 |

## 9.7 Standing content obligation

**`[SPEC]`** VF-PUB-001: every public representation must **remain** consistent
with the **current** Master Specification.

`[DESIGN]` Implementation consequence for the homepage: **when the governing
specification hash changes, this page is due for review before it is due for
anything else** — it carries `[SPEC]`-derived statements in H-02, H-03 and H-04
and publishes the hash in H-05. The published hash is the most visibly wrong
thing on the site if it is not updated.

**`[ARCH]`** `[OPEN]` 22 asks whether that review is a recorded required step and
where the obligation is written down. Unresolved, and not resolved here. What
this document does record is that **the homepage is the surface where a stale
hash is publicly visible**, which is an argument for the review being recorded
somewhere, not an attempt to record it.

---

# 10 · Responsive behaviour and accessibility

**`[ARCH]`** PRC Part 4 records that **accessibility, localisation, performance
and platform support are not addressed anywhere in the accepted baseline.**
Everything in this section is therefore `[DESIGN]`, and is derived from the
Charter rather than cited from a requirement. A reviewer may reject any of it
without violating a baseline. This is stated plainly rather than presented as
inherited authority.

The Charter derivation is short: **`[ARCH]`** principle 1 leaves the decision
with the participant, which presupposes the participant can read the inputs; and
principle 5 requires complexity to be understandable rather than invisible, and
content that a user agent cannot render is invisible. A surface that cannot be
read cannot teach, and a product whose destination is participant competence
cannot be indifferent to who can reach it.

## 10.1 Desktop

`[DESIGN]`
- Single-column reading measure for all prose regions. Multi-column layout is
  permitted only where it cannot reorder content (§10.5) and only outside H-02
  and H-04.
- Maximum measure constrained for readability; the page does not expand text to
  fill wide viewports.
- Primary navigation fully expanded — five entries, no overflow.
- No horizontal scrolling at any width.

## 10.2 Tablet

`[DESIGN]`
- Same single-column structure; measure adjusts.
- Primary navigation remains fully expanded at tablet widths. **Five entries
  collapse to a menu control only below the width at which they cannot fit
  without truncation**, and never merely because a breakpoint was crossed.
- Any lifecycle diagram in H-03 reflows vertically, in the same order.

## 10.3 Mobile

`[DESIGN]`
- Single column throughout.
- **Every region fully expanded.** No accordion, no tabs, no "read more", no
  truncation, at any region. This is the mobile expression of OC-1, OC-3 and the
  interaction prohibitions in §4.2 and §4.4.
- If primary navigation collapses to a menu control, **N-3 Verify and N-5
  Workspace are both inside it, in the same order**, and the control is labelled
  and operable by keyboard and assistive technology.
- The specification hash wraps; it is never inside a horizontally scrolling
  container.

## 10.4 The content-parity rule

`[DESIGN]` **No content is removed at any viewport.** The page reflows; it does
not reduce.

Derivation: a mobile page that omits a limitation present on desktop has
concealed it from the majority of visitors, which is **`[ARCH]`** concealment
under Charter principle 5 and 7 regardless of the intention. A responsive
strategy that treats disclosure content as the first thing to cut is the
specific failure this rule exists to prevent.

**Corollary — the diagram rule.** Where information is presented visually
(a lifecycle diagram), an equivalent text presentation exists in the document at
every viewport — not only in an `alt` attribute, and not only at narrow widths.
Derivation: **`[ARCH]`** Charter principle 5 — the mechanic must be
understandable, and a mechanic available only as a picture is unavailable to a
reader who cannot resolve the picture.

## 10.5 Ordering under reflow — a required test

`[DESIGN]` **Constraints OC-1, OC-2, OC-3 and OC-6 hold in DOM order and in visual
order at every viewport.**

This is the constraint most likely to be broken accidentally, because CSS can
reorder visual presentation independently of the DOM (`order`, `grid-area`,
`direction`, absolute positioning, and column collapse).

**Required test, at minimum three viewports and at the two widths either side of
every breakpoint:**
1. H-02 renders before H-03. *(OC-1)*
2. H-05 renders before H-06 and before any route to P-03, P-14, P-17, P-18 or
   the Workspace in the page body. *(OC-2)*
3. H-04's property and cost render adjacently, in that order, with no
   intervening region. *(OC-3)*
4. No Workspace route exists in the page body. *(OC-6)*
5. Tab order matches visual order throughout.

A layout that passes on desktop and fails at one breakpoint is a defective
implementation of this specification, not a minor visual issue.

## 10.6 Register parity — a binding visual constraint

`[DESIGN]` **Limitation content and capability content are typographically
identical.**

Same family, same size, same weight, same colour, same contrast, same line
height, same spacing, same container treatment. No limitation is set in smaller
type, lighter weight, reduced contrast, italics-as-hedge, a bordered "notice"
box, a tinted panel, or a footnote.

Derivation, and it is not a preference: **`[ARCH]`** Website Specification Phase
1 Part 9 — *a limitation delivered in a smaller, softer, later voice than a
capability has been concealed by tone.* Typography is voice. This makes the
Charter principle 7 requirement testable by measuring computed styles rather than
by editorial judgement.

**Applies to:** all of H-02; the cost half of H-04; every unavailability
statement under §9.5; and any statement of what the protocol does not do,
wherever it appears.

**Consequence for visual design:** the page has **one text register**. Emphasis
is available — a heading is larger than body text — but emphasis may not
correlate with whether a statement is favourable. A design system for this page
that includes a "disclaimer" or "fine print" style has already failed the
constraint.

## 10.7 Accessibility requirements

`[DESIGN]` **Target: WCAG 2.2 Level AA**, with the additions below where the
Charter asks for more than AA requires.

**Structure**
- One `h1` (H-01); H-02 through H-07 are `h2`; no heading level is skipped; no
  heading is used for visual sizing.
- Landmarks: `banner` (navigation), `main` (H-01–H-06), `contentinfo` (H-07),
  and a distinctly named `navigation` for H-06's route list.
- Skip link to `main` as the first focusable element.
- `lang` set on the document.

**Operation**
- Every route reachable and operable by keyboard, in DOM order.
- Visible focus indicator on every focusable element, meeting AA non-text
  contrast.
- No keyboard trap; no focus management surprises, because the page has no
  dynamic content.
- Touch targets at least 24×24 CSS pixels with adequate spacing (WCAG 2.2
  2.5.8); the page's low interaction count makes a larger target trivial to
  afford and it should be taken.

**Perception**
- Text contrast at least 4.5:1; large text 3:1; UI and focus indicators 3:1.
- **No information conveyed by colour alone** — including availability status
  under §9.5 and any distinction between lifecycle steps.
- Content reflows to 320 CSS pixels without horizontal scrolling (WCAG 2.2
  1.4.10).
- Text spacing overrides do not clip content (1.4.12).
- Zoom to 200% without loss of content or function.

**Motion**
- The page has no motion by specification (§4.1, §4.3). Where an implementation
  introduces any transition, `prefers-reduced-motion: reduce` removes it
  entirely, and no information depends on it.

**Beyond AA, on Charter grounds**
- **Link purpose is clear from link text alone** (WCAG 2.4.9, AAA) — §5.9.
  Derivation: **`[ARCH]`** Charter principle 1. A visitor cannot decide whether
  to follow a route whose destination is withheld.
- **The page is fully readable and fully navigable with JavaScript unavailable.**
  Derivation: **`[ARCH]`** PEA §7.4 — verification is *ungated by derivation, not
  by choice*, and the homepage carries the routes to it. The page has no
  dynamic behaviour to lose, so this costs nothing and removes a category of
  gate. If it ever becomes expensive to satisfy, that is evidence the page has
  acquired behaviour it should not have.

## 10.8 Consent, analytics and interstitials

`[DESIGN]` Out of the baseline's scope, constrained here only where they would
break a derived requirement.

- **No interstitial, modal, or overlay may obscure H-01 or H-02**, or delay
  their availability. A visitor's first encounter is the non-promises, and an
  overlay that precedes them defeats trust mechanism 1.
- **No content is gated behind consent.** Refusing consent must leave the entire
  page readable and every route operable.
- **No analytics event may be attached to an intent to act**, because the page
  contains no act. Route-click measurement is permissible; behavioural profiling
  to optimise routing is not — it would make the page's behaviour conditional on
  what the operator wanted the visitor to do.

## 10.9 Performance, stated as a requirement rather than a target

`[DESIGN]` The homepage is static text with no figures, no live data, no client
state and no motion. **It should be among the lightest pages on the public
internet, and if it is not, something has been added that this specification
excludes.**

Performance is therefore specified here as a **diagnostic**: an unexpectedly
heavy homepage is evidence of a content violation, not merely a slow page.

---

# 11 · Success criteria

## 11.1 What is not a success measure

`[DESIGN]` Stated first, because the conventional measures would actively
misdirect this page.

**Not conversion rate.** **`[ARCH]`** Website Specification Phase 1, Finding 1:
*no acquisition mechanism exists anywhere in the product, and this is correct by
derivation.* There is nothing to convert to.

**Not bounce rate.** **`[ARCH]`** Acceptance criterion 5: leaving is not treated
as failure. A visitor who reads H-01 and H-02, decides this is not for them, and
leaves has been served correctly. Optimising against bounce would optimise
against Charter principle 1.

**Not time on page.** A page that holds attention longer than the four questions
require has probably started arguing.

**Not clicks to the Workspace.** **`[ARCH]`** Three of six audiences never need
the Workspace, and two of those reach the deepest verification level available.
Routing pressure toward W-01 would mis-serve the audiences the architecture
treats as first-class.

**Not comprehension self-report.** **`[ARCH]`** PEA Finding 2 records that E2's
exit condition *describes a state no surface can observe. It is useful as a
design target and useless as a gate.* The same honesty applies here: the page
cannot measure understanding and must not pretend to.

## 11.2 How we know it succeeds — artifact tests

Testable by inspection of the built page, without users. `[DESIGN]` **All must
pass.**

| # | Test | Source |
|---|---|---|
| T-1 | A reader of the page alone can state what the protocol does and what it does not promise. | **`[ARCH]`** Acceptance criterion 1 |
| T-2 | No sentence on the page promises, projects or implies value. | **`[SPEC]`** §17.1 / PRC-04; acceptance criterion 2 |
| T-3 | Every claim resolves in one route to a surface where it is checkable, **or** is marked not yet checkable per VF-EXT-002. | **`[SPEC]`** VF-EXT-002; acceptance criterion 3 |
| T-4 | H-05 precedes every participation route in DOM and visual order, at every viewport. | Acceptance criterion 4; **OC-2** |
| T-5 | The page contains no mechanism whose purpose is to prevent or delay departure. | Acceptance criterion 5 |
| T-6 | H-02 precedes H-03 at every viewport. | **OC-1** |
| T-7 | H-04's cost is adjacent to its property and typographically identical to it. | **OC-3**; §10.6 |
| T-8 | No participation mechanic appears anywhere, including in navigation labels. | **OC-4** |
| T-9 | No figure appears anywhere. | §9.4 |
| T-10 | Every route in the rendered page appears in §7.2's inventory. **A route not in the table is a defect.** | §7.2 |
| T-11 | Every claim traces to `[SPEC]` or `[ARCH]`; no claim traces only to this document. | Index §5 marking discipline |
| T-12 | The published hash matches the governing specification. | **`[SPEC]`** VF-PUB-001 |
| T-13 | The page is fully readable and navigable with JavaScript unavailable, and with CSS unavailable, in correct order. | §10.7 |
| T-14 | The prohibited-language table (Website Spec Part 9) returns no hits. | **`[ARCH]`** Part 9 |

## 11.3 The eleven-helpfulnesses review

`[DESIGN]` Run against every proposed change to the homepage, forever. Each
question restates a constraint above and introduces nothing.

1. Does this addition make it more likely the visitor acts, rather than more
   likely they understand?
2. Does it place any statement of benefit above any non-promise? *(OC-1)*
3. Does it place any participation route above the verification route? *(OC-2)*
4. Does it state a property whose cost is not stated beside it, in the same
   register? *(OC-3, §10.6)*
5. Does it introduce a figure? *(§9.4)*
6. Does it introduce a claim the page cannot route to a check for? *(T-3)*
7. Does it make a decision on the visitor's behalf — a recommended route, a
   default, a pre-selection? *(Charter 6)*
8. Does it treat departure as something to prevent? *(Acceptance criterion 5)*
9. Does it add a protocol feature, capability or future function the
   specification does not contain? *(§17.1, second prohibition)*
10. Does it introduce content that becomes stale independently of a
    specification revision? *(§9.4, §9.7)*
11. **Would the page be worse without it, or merely shorter?** *(§9.3's default
    of exclusion)*

## 11.4 How we know it fails

`[DESIGN]` Observable failure conditions. Any one of these means the homepage has
failed regardless of how it performs on any metric.

**It fails if a visitor cannot say what is not promised.** The page's first
structural commitment has produced nothing.

**It fails if a skeptic has to scroll past an invitation to reach evidence.**
Acceptance criterion 4, violated.

**It fails if the absence of an administrator reads as a selling point.** OC-3 and
§10.6 exist to prevent it; if the rendered page still reads that way, the
implementation is defective even if it satisfies the letter of both.

**It fails if it makes anyone feel they should act now.** **`[ARCH]`** There is
no version of the product where acting today beats acting next year, and a page
that produced urgency would have produced it from nothing.

**It fails if a visitor concludes the product is the authority.** **`[ARCH]`**
Part 7: *the North Star inverts.* A homepage that leaves a visitor believing the
site is where the truth lives — rather than a route to where the truth lives —
has failed at the one thing the whole architecture is organised around.

**It fails if it needed a disclaimer.** If the rendered page requires a
small-print zone to be honest, the body content was not honest and §10.6 has been
routed around rather than satisfied.

---

# 12 · Derivation notes and recorded findings

**Recorded, not silently resolved**, in the manner the accepted artifacts
require. Each is a place where this document made a judgement a reviewer should
test.

## 12.1 The homepage states a mechanic that PEA assigns to S02

**`[ARCH]`** PEA §5's concept-ownership table lists *Your asset never moves* as
**introduced at S02**. **`[ARCH]`** Website Specification Phase 1 Part 2 requires
that *the asset never moves off its native chain* be understood before a visitor
leaves the homepage, and answers Q1 with a sentence containing it.

The two are reconcilable and this document reconciles them as follows: **the
homepage states the mechanic; S02 introduces it as a claim and makes it
checkable.** H-01 and H-03 assert nothing evidentiary about it and route to P-02,
where it becomes one of the four trust-cluster claims resolving to deployed
contract code.

**`[ARCH]`** PEA Finding 9 supports this reading — it records that the
concept-ownership table *assigns single owners to concepts that have several*,
that several concepts are genuinely introduced in more than one place depending
on the path taken, and that this was **not fixed** because assigning multiple
owners would assert more precision than the accepted artifacts support.

**A reviewer should test this specifically.** If the reconciliation is wrong, the
correction is that H-01 and H-03 state the mechanic more thinly and lean harder
on R-02 — the page structure is otherwise unaffected.

## 12.2 `[OPEN]` 5 is the only open decision that changes this page's content

**`[ARCH]`** `[OPEN]` 5 — whether and how §16 traceability is published — is
recorded as **the only remaining blocker in the product** and it affects P-11's
existence.

`[DESIGN]` Behaviour under both resolutions:

**If P-11 is published:** R-10 exists in H-05, alongside R-07 and R-08. No other
region changes.

**If P-11 is not published:** R-10 does not exist, and H-05 makes no reference to
traceability — it does not mention an artifact that will not be produced, and it
does not mark it unavailable under §9.5, because §9.5 governs artifacts that are
unbuilt rather than undecided.

**Everything else in this document is implementable now.** No other open decision
gates any region, and §9.3 records the two whose *optional* content is deferred.

## 12.3 The Handshake's exclusion is the exclusion most likely to be challenged

Constraint OC-5 keeps **`[SPEC]`** §5.2's Trust-Building Handshake off the
homepage entirely. The counter-argument is strong and should be stated: the
Handshake is **`[ARCH]`** *the fastest route to holding the post-commitment
concepts*, it costs approximately one dollar, and **`[ARCH]`** Part 8's
prospective participant reaches it and finds that *nothing she was told turned
out to be different from what happened.* A homepage that mentions it might reach
more people with the product's single most honest experience.

The derivation against is: **`[ARCH]`** PEA §9 — *S31 requires everything in
Layer 2* — and Layer 2 is P-02, P-05, P-06, P-14 and P-17, none of which a
homepage reader has met. Presenting a lifecycle rehearsal to someone who does not
yet hold the commitment concepts asks for an action before teaching. And a
homepage route to it, positioned among the other routes, would read as the first
step of a sequence — which **`[ARCH]`** `[OPEN]` 24 and Part 5's *rehearsal is
never a gate* exist to prevent.

**Recorded so the exclusion is deliberate and checkable.** If a reviewer rejects
it, the Handshake route belongs in H-06 with R-12 and R-13 and must carry an
explicit statement that it is optional and not a prerequisite.

## 12.4 The operator maintains public channels that this page does not link

The entity operates public channels outside this product. **`[ARCH]`** Website
Specification Phase 1 Part 3 excludes social feeds and community forums from the
public website, and §9.6 applies that exclusion to the homepage.

`[DESIGN]` **This document does not decide whether the site links to those
channels from anywhere.** It decides only that the homepage does not, on the
grounds that a social route on an orientation surface is an invitation to
community rather than a route to understanding, and the page's four questions do
not include one that a channel answers.

**Recorded because a reviewer will notice the absence** and should see that it
was decided rather than overlooked. If the operator determines that a public
channel route belongs somewhere on the public site, that is a decision about a
different surface and does not reopen this one.

## 12.5 The returning participant's route without the homepage remains unspecified

§5.6 discharges **`[ARCH]`** Part 5's obligation that returning must not route
through orientation, for a participant who loads the root. It does not specify
how a participant reaches the Workspace **without loading the root at all** —
separate host, subdomain, direct path, or bookmark convention.

**`[ARCH]`** Website Specification Phase 1 Finding 3 recorded this as
underspecified. It remains so. It is a site-architecture decision rather than a
homepage decision, and this document does not make it by side effect.

## 12.6 Two contents are deferred to open decisions rather than excluded on merit

**Terminal state** (`[OPEN]` 13) and **signing-key risk** (`[OPEN]` 6) are both
excluded from the homepage at §9.3, and in both cases the exclusion is *pending*
rather than *derived*.

`[DESIGN]` The reasoning is the same for both: each is a candidate for H-02 or
H-04 on Charter principle 7 grounds — they are limitations, and the page's whole
posture is that limitations are stated early. But **`[ARCH]`** the disclosure
point for each is an open decision, and choosing one here would resolve it by
side effect, which the marking discipline forbids.

**If either is resolved in favour of early disclosure, H-02 or H-04 is where it
lands on this page**, in the same register as everything around it, and this
document is revised rather than worked around.

## 12.7 The no-figures decision is the largest `[DESIGN]` call in this document

§9.4 excludes every quantity from the homepage. The five supporting derivations
are stated there and each is independently sufficient, but the decision itself is
`[DESIGN]` and no accepted artifact requires it.

**The counter-argument a reviewer should weigh:** a protocol with a live
deployment, a public registry of assets across seventeen environments and four
public dashboards has a great deal of true, sourced, specification-consistent
information it is permitted to display, and a homepage that displays none of it
may read as thinner than the protocol is. **`[ARCH]`** Decision 20 explicitly
permits stating specification-derived mechanics plainly — cumulative issuance
against capacity is named as permissible.

**The reason this document holds the line anyway:** permission is not obligation,
and every figure admitted to this page brings **`[SPEC]`** VF-PUB-002's
obligations, **`[ARCH]`** Part 5's one-step-to-source obligation, a staleness
story, and a pre-deployment empty state. The four dashboards exist precisely so
that this material has a home that can carry those obligations properly. **The
homepage's job is to route there, not to preview it.**

If a reviewer rejects §9.4, the correct correction is **not** to admit figures
generally but to name exactly one, in exactly one region, with its source and
update time attached, and to say which accepted artifact requires it.

---

# 13 · What this document does not specify

Recorded so the document is not stretched beyond its authority, and so a
designer knows where their judgement begins.

**Visual identity.** Colour, typeface, scale, spacing system, imagery style,
logo treatment, iconography. §10.6 constrains the *relationship* between
registers, not the registers themselves.

**Copy.** Every content requirement above is an informational obligation. The
words are editorial and governed by Website Specification Phase 1 Part 9.

**Technology.** Framework, static-site generator, hosting, build pipeline, CSS
methodology, component library. §10.7's no-JavaScript requirement and §7.1's
no-client-state requirement constrain outcomes, not tools.

**The other seventeen public pages.** This document specifies S01. Where it names
a destination it names it as a destination only, and states nothing about what
that surface contains beyond what an accepted artifact already states.

**Site architecture.** URL structure, subdomain strategy, the Workspace's host,
redirects. §12.5.

**Localisation and internationalisation.** **`[ARCH]`** Unaddressed by the
baseline; not invented here.

**Measurement implementation.** §11 states what success is and is not. Whether
and how anything is instrumented is out of scope, subject to §10.8.

---

# 14 · Revision policy

**Revise when:** an accepted artifact is revised · the governing specification
hash changes · `[OPEN]` 5, 6 or 13 is resolved in a way that changes a region ·
a review finding at §12 is addressed · a derivation is shown unsupported.

**Do not revise to:** add content because it seems useful · resolve an open
decision by assertion · adopt a convention because other sites use it · improve a
metric §11.1 excludes · shorten the page by moving disclosure content behind a
control.

**Corrections are recorded visibly**, in the manner of Map A v2's corrections
table, rather than applied silently.

**Version numbers are whole integers.**

---

*Derived from the ten accepted baseline artifacts, governed by Master
Specification Revision 6, hash
`5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9`. Surface
labels S01–S32, page labels P-01–P-18, Workspace labels W-01–W-14, phases E1–E8,
verification levels V0–V4, overlays O1–O8 and P1–P3, and constraints PRC-01–PRC-11
originate in prior artifacts and are used without modification. Region labels
H-01–H-07, ordering constraints OC-1–OC-6, route identifiers R-01–R-14, navigation
identifiers N-1–N-5 and test identifiers T-1–T-14 are document-local and carry no
specification authority. Attribution: Vinculum Protocol DAO LLC.*
