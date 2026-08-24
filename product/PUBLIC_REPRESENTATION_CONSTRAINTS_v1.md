# Public Representation Constraints

**Version:** 1
**Status:** Proposed for acceptance
**Phase:** Product Architecture
**Derived from:** Master Specification Revision 6, §17 and requirements
VF-PUB-001, VF-PUB-002, VF-PUB-003
**Specification hash:**
`5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9`

> **Derivation artifact. It governs nothing and requires nothing.** Every
> constraint below originates in the Master Specification. Where this document
> conflicts with the specification, **the specification prevails and this
> document is defective.**

---

## Why this artifact exists

The Product Architecture Index recorded one derivation gap: neither accepted
Presentation Map cites §17 or any VF-PUB requirement.

That gap matters disproportionately. Both Presentation Maps derive sections
that constrain **protocol behaviour** — what the contracts do, what a
participant experiences, what the chain records. §17 is different in kind.

> **§17 contains the only requirements in the Master Specification that
> constrain product output directly.**

Every other section tells the product what is true. §17 tells the product what
it may say.

This artifact closes that gap. It is the last product architecture artifact
before implementation planning.

---

## What this artifact is, and is not

**It is** a specification-derived reference stating the standing constraints
that every public-facing product surface must satisfy, whenever it is built.

**It is not** a Presentation Map, a participant journey, a website
specification, a marketing guide, a copywriting guide, a UI specification, or a
product design document. It contains no page, no screen, no workflow, no
wording, and no visual decision.

**Where an accepted artifact already derives a matter correctly, this document
references it rather than restating it.** Restating a derivation invites the
two copies to diverge.

---

## Scope boundary

**Governed here:** the six statements of §17.1, the two statements of §17.2,
and requirements VF-PUB-001, VF-PUB-002 and VF-PUB-003. That is the whole of
the source material.

**Not governed here, and not to be imported into this artifact:** participant
lifecycle (Maps A and B), verification and traceability under §16 (Map A
overlay O3), deployment completeness under VF-EXT-002 and VF-EXT-003 (Map A
overlay O8), the protocol price reference lifecycle under §7 (Map A overlay
O7), and the philosophy of product decisions (Product Design Charter).

Several of those interact with §17. **Interaction is recorded; content is not
duplicated.**

---

## A derivation note on §17's structure

§17 contains **eight declarative statements** across §17.1 and §17.2 that carry
no requirement identifier, and **three numbered requirements** — VF-PUB-001
through VF-PUB-003 — placed at the end of §17.2.

All eleven are stated in the Master Specification and are therefore `[SPEC]`.
But only three carry an identifier a traceability instrument can reference.

**Consequence for independent review.** A reviewer tracing product surfaces
against numbered requirements will find three. The other eight are equally
specification-stated and equally binding, and are equally easy to overlook.
This artifact records all eleven at the same level of seriousness for exactly
that reason.

**This is an observation, not a criticism of the specification, and not a
proposal to renumber anything.** Renumbering is a specification matter and lies
entirely outside product authority.

---

## Labels used in this document

Constraints are labelled **PRC-01** through **PRC-11** for internal reference
only. These are **document-local labels, not requirement identifiers.** They
carry no specification authority and must never be cited as though they did.
Cite the specification section, or the VF-PUB identifier where one exists.

The precedent is Map A's overlays O1–O8 and Map B's P1–P3 — grouping labels for
a derived document.

| Marking | Meaning |
|---|---|
| `[SPEC]` | Stated in Master Specification Revision 6 |
| `[REV7]` | Proposed in `REVISION_7_CANDIDATE_AMENDMENTS.md`. Not governing. |
| `[DESIGN]` | A product decision |
| `[OPEN]` | A product decision deliberately not yet made |

---

# Part 1 · §17.1 — Machine-readable records

## PRC-01 · Specification preservation

**`[SPEC]` §17.1** — The repository preserves the current human-readable Master
Specification.

**Practical implication.** The governing document is a preserved public
artifact, not an internal reference. Any product surface that describes
protocol behaviour describes something a reader can go and read for themselves.

This is primarily a repository obligation. It becomes a product constraint at
one point: **no product surface may position itself as the authoritative
description of protocol behaviour**, because a more authoritative description
is preserved and available.

**Surface classes affected:** docs · public

**Required:** the specification remains preserved and human-readable.
**Free:** how, where, and whether product surfaces link to it; how prominently;
what reading guidance accompanies it.

**Interactions.** Product Architecture Index §1.1 requires hash verification
before the specification is relied on. That instruction is directed at
contributors. Whether the same verification is made available to the public is
not addressed by §17.

**`[OPEN]` 14** — Whether the Master Specification and its hash are published on
public product surfaces, and how prominently.

---

## PRC-02 · The machine-readable asset registry

**`[SPEC]` §17.1** — A machine-readable registry preserves every approved asset
identity, environment, classification, pricing identifier, and source metadata.

**Practical implication.** Five categories of asset data are preserved in
machine-readable form for every approved asset. The registry is a preservation
obligation.

**This must not be confused with PRC-05.** PRC-02 governs what the
machine-readable registry **preserves**. PRC-05 governs what the public
registry **may display**. They are different artifacts with different
obligations, and the enumerated field sets are not the same. Conflating them is
the most likely misreading of §17.1.

**Surface classes affected:** public · dashboard · developer

**Required:** all five categories preserved for every approved asset.
**Free:** file format, structure, endpoint design, update mechanism,
documentation.

**Interactions.** Appendix C of the specification is the complete Approved
Asset Registry and defines what "approved" means. VF-PUB-001 (PRC-09) requires
the machine-readable registry to remain consistent with the current
specification — so the registry is not merely published once, it is maintained
against Appendix C.

---

## PRC-03 · The deployment manifest

**`[SPEC]` §17.1** — The deployment manifest identifies every live address,
environment identifier, source commit, bytecode hash, dependency, and fixed Dev
Fund destination.

**Practical implication.** Six categories, each an instrument of independent
verification. Bytecode hash and source commit together let anyone confirm that
deployed code matches published source. Live addresses let anyone read
contract state directly. The fixed Dev Fund destination lets anyone confirm fee
routing.

**This is the specification's own answer to a participant asking "how do I
check for myself."** The manifest is the raw material for verification.

**Surface classes affected:** docs · developer · public · dashboard

**Required:** all six categories identified.
**Free:** whether and how the manifest is surfaced beyond the repository;
whether product surfaces present it, link to it, or build tooling on top of it.

**Interactions.** Map A overlay O3 governs verification and traceability under
§16. Map A overlay O8 governs deployment completeness under VF-EXT-002 and
VF-EXT-003, including the requirement that an unfinished deliverable be
reported as incomplete rather than replaced with an invented value.

Product Architecture Index §7.2 records that manifest content — live addresses,
contract code, registry immutability — is **unavailable before deployment.** No
public surface may promise a verification the manifest cannot yet support.

**`[OPEN]` 21** — Whether the deployment manifest is surfaced publicly beyond
the repository, and in what form.

---

## PRC-04 · Website language derives from the specification

**`[SPEC]` §17.1** — Public website language derives from the current
specification and does not add economic promises or protocol features.

**This is the single most operationally binding sentence in §17.**

**Practical implication.** One positive obligation and two prohibitions.

**The obligation:** website language *derives from* the specification. Not
merely "is consistent with" — derives from. Language originates in the
specification and is shaped for comprehension, not composed independently and
checked afterwards.

**Prohibition one — no economic promises.** Nothing about value, return,
appreciation, price, demand, liquidity, or financial outcome may be promised,
projected, or implied.

**Prohibition two — no protocol features.** No behaviour, capability,
mechanism, or future function may be described that the specification does not
contain. A feature that exists in a contract but not in the specification may
not be advertised. A feature that is planned but unspecified may not be
described as though it exists.

**The word "current" is load-bearing.** It binds website language to the
governing revision in force, which is what VF-PUB-001 restates as a standing
obligation. See PRC-09.

**Surface classes affected:** public — principally, and every publicly visible
surface in practice

**Required:** derivation from the specification; both prohibitions.
**Free:** vocabulary, tone, structure, reading order, depth, sequencing,
teaching method, metaphor, and every other expressive choice. **The constraint
governs claims, not craft.** §17 does not require the website to read like a
specification; it requires that nothing it says exceed one.

**Interactions.** Map B Stage 1 derives VF-TOK-015 — no exchange listing,
liquidity level, market price, redemption value, or appreciation is
guaranteed. That is the token-side statement of the same principle and should
be referenced rather than restated. Charter principle 8 — stay faithful to the
protocol — is the product-decision counterpart.

**`[OPEN]` 20** — What constitutes an economic promise at the margin. The
prohibition is unambiguous at its centre and undefined at its edges. Whether a
historical price series, an emission decay schedule, a supply projection, or a
worked reward example constitutes an implied economic promise is not settled by
§17 and is not settled here.

---

## PRC-05 · The public registry display set

**`[SPEC]` §17.1** — The public registry may display Symbol, Name, Environment,
Price, Price Source, Last Updated, Contract or native identity, and available
pricing metadata.

**Practical implication.** Eight enumerated fields, stated as a permission —
*may display* — rather than as a mandate.

Two of the eight, **Price Source** and **Last Updated**, are not merely
permitted. VF-PUB-002 requires them wherever a price is displayed. See PRC-10.

**An honest ambiguity, recorded and not resolved.** "May display" admits two
readings, and the specification does not distinguish them:

- **Permissive-closed** — these eight are the permitted set; anything else is
  outside what §17.1 authorises.
- **Permissive-open** — these eight are expressly authorised; the specification
  is silent on others, and VF-PUB-001 governs anything additional.

The distinction is not academic. It determines whether a public registry may
carry fields such as approval date, chain-specific decimals, verification
status, or asset classification — the last of which PRC-02 requires the
machine-readable registry to preserve.

**Surface classes affected:** public · dashboard

**Required:** any field displayed must be accurate and consistent with the
current specification (PRC-09). Price Source and Last Updated where price
appears (PRC-10).
**Free:** which of the eight to display, ordering, grouping, filtering,
sorting, labelling, and visual treatment.

**`[OPEN]` 15** — Whether the public registry display set is closed to the eight
enumerated fields, or permits additional fields consistent with VF-PUB-001.
**This decision should be made before any public registry surface is designed**,
because it determines what the surface may contain.

---

## PRC-06 · Twice-daily price refresh

**`[SPEC]` §17.1** — Website price data refreshes twice per day using the
established price-fetcher process.

**Practical implication.** Both the cadence and the process are specified.
Twice per day, by the established process — not on page load, not on demand,
not continuously, and not by an alternative mechanism.

**The consequence that must be surfaced honestly:** a displayed price may be
close to twelve hours old at the moment it is read. VF-PUB-002 requires the
last update time to appear alongside it, which is how the specification makes
that staleness visible rather than hidden.

**The distinction the product must not misrepresent.** The twice-daily website
price and the protocol's price reference are different objects, governed by
different sections at different cadences.

| | Website price display | Protocol price reference |
|---|---|---|
| Governed by | §17.1, VF-PUB-002 | §7, Map A overlay O7 |
| Role | Informational | Commitment valuation |
| Cadence | Twice per day | Per signed record |

**This is an accuracy obligation on the product, not a concept the participant
must be taught.** The constraint is that no surface represent the displayed
price as the figure that values a commitment. It is not a requirement that
participants be walked through the difference, and §17 does not ask for that.

A participant considering a commitment is evaluating one question: what this
commitment currently produces. The displayed price is an ingredient in that
answer, not a subject in its own right. In practice the constraint is satisfied
by presenting the commitment's own figures as the commitment's own figures —
which is Map A Step 2's preflight, already derived there and not redefined
here. Map A overlay O7 governs the protocol side in full and is likewise not
restated.

**Surface classes affected:** public · dashboard · app

**Required:** twice-daily cadence; the established price-fetcher process.
**Free:** display format, precision, rounding presentation, staleness
indication style, and how update time is expressed.

**Interactions.** Map A Step 1 names a "Price freshness (dashboard)" surface.
Map A Step 2 governs preflight, where a participant sees what a commitment
produces. Map A overlay O7 governs price reference lifecycle. `[REV7]`
VF-ORC-015 proposes a 48-hour validity bound on the **protocol price
reference** — it is not governing, and it does not concern the website refresh
cadence. That last caution is addressed to contributors reading the
specification, not to participants.

**`[OPEN]` 16** — How the product satisfies this accuracy obligation. The
constraint fixes what may not be represented; it does not determine whether the
matter is addressed explicitly, handled implicitly by presenting commitment
figures as the commitment's own, or left to documentation.

---

# Part 2 · §17.2 — External trading and listings

## PRC-07 · External trading does not change the protocol

**`[SPEC]` §17.2** — External users and venues may transfer or trade protocol
tokens without changing Vinculum Finalis.

**Practical implication.** Market activity is real, permitted, and
consequential to participants — and entirely without effect on protocol
behaviour. No product surface may present market activity as influencing
issuance, supply, rewards, weight, eligibility, or any protocol calculation.

**Surface classes affected:** public · app · dashboard · docs

**Required:** no representation of market activity as affecting protocol
behaviour.
**Free:** whether market information appears at all, and how it is presented if
it does.

**Interactions.** Map B Stage 1 derives VF-TOK-013 — no transfer tax,
allowlist, denylist, administrator freeze, or protocol-level trading
restriction — and VF-TOK-014 — an external market does not alter issuance,
supply, reward, activation, or lock rules. Those are the participant-side
derivations and are referenced, not restated.

Map B Stage 3 derives VF-RAC-005: rewards use the permanent $0.10 Reward
Reference Value, **not an oracle or market price.** That is the strongest
concrete instance of PRC-07 and PRC-11 in the protocol.

**`[OPEN]` 17** — Whether market or venue data appears on any public product
surface, and if so, how it is separated from protocol data so the two are not
read as one.

---

## PRC-08 · Listings are an objective, not a promise

**`[SPEC]` §17.2** — The protocol's intention to pursue exchange listings is a
development objective rather than a promise of availability or value.

**Practical implication.** Listing effort may be described as intent. It may
not be described as expectation, likelihood, timeline, or commitment. No
surface may imply that a listing will occur, when it might occur, or what it
would mean for value.

This constrains roadmap language, progress communication, and any
forward-looking public statement about venue availability.

**Surface classes affected:** public · docs

**Required:** listings characterised as objective, never as promise of
availability or value.
**Free:** whether listing intent is communicated publicly at all.

**Interactions.** Map B Stage 1's VF-TOK-015 states the guarantee-absence
directly. Charter principle 7 — tell the truth about limitations — is the
product-decision counterpart.

**`[OPEN]` 18** — Whether exchange-listing effort is communicated on public
surfaces at all, given that the safest treatment of a non-promise is often
silence.

---

# Part 3 · The numbered requirements

## PRC-09 · VF-PUB-001 — standing consistency

**`[SPEC]` VF-PUB-001** — Every public and machine-readable representation must
remain consistent with the current Master Specification.

**Practical implication.** Two properties make this the widest constraint in
§17.

**Scope.** "Every public and machine-readable representation" — not the website
alone. The public site, the machine-readable registry, the deployment manifest,
dashboards, documentation, published data files, and any machine-readable
artifact the product emits are all inside it.

**Duration.** *Remain* consistent, and consistent with the *current*
specification. This is a continuing obligation, not a launch check. **When the
Master Specification is revised, every public and machine-readable
representation falls due for review.**

**Surface classes affected:** all — public · app · dashboard · docs ·
developer

**Required:** consistency, maintained over time, across every public and
machine-readable representation.
**Free:** how consistency is achieved, reviewed, and evidenced.

**Interactions.** Product Architecture Index §9 states that a governing
specification revision — evidenced by a changed hash — is one of only two
grounds for reopening the accepted baseline. VF-PUB-001 makes the same event
consequential for published output. A specification revision therefore has two
downstream effects: the accepted product artifacts require re-derivation, and
every public representation requires review.

**`[OPEN]` 22** — Whether a public-surface consistency review is recorded as a
required step on specification revision, and where that obligation is written
down.

---

## PRC-10 · VF-PUB-002 — price display disclosure

**`[SPEC]` VF-PUB-002** — Public price displays must identify the selected
source and last update time without presenting the reference as a guaranteed
trading price.

**Practical implication.** Two mandatory data elements and one prohibition,
attaching wherever a price appears publicly.

**Selected source** must be identified — which source produced this figure.
**Last update time** must be identified — when it was produced. Both are among
the eight fields PRC-05 permits, but VF-PUB-002 elevates them from permitted to
required wherever a price is shown.

**The prohibition** is that the figure may not be presented as a guaranteed
trading price. It is a reference. What it is *not* — a price at which anything
can be bought, sold, or redeemed — must not be implied by presentation,
labelling, or context.

**The requirement is plural — "displays."** It attaches to the display, not to
a page. A price appearing in a registry, a dashboard, a preview, a summary, or
a chart carries the same two obligations each time it appears. There is no
"disclosed once elsewhere on the site" exemption in the text.

**Surface classes affected:** public · dashboard · app — wherever a price
appears

**Required:** selected source and last update time, wherever a public price is
displayed; no presentation as guaranteed trading price.
**Free:** placement, format, abbreviation, styling, and whether additional
context accompanies them.

**Interactions.** PRC-05 permits both fields in the registry; VF-PUB-002 makes
them mandatory wherever price appears. PRC-06 sets the cadence that makes
"last update time" meaningful. Map A overlay O7 governs the protocol price
reference, which is a different object — see PRC-06.

**`[OPEN]` 19** — Whether "public" under VF-PUB-002 extends to application
displays visible only after wallet connection. Map A Step 2's preflight and Map
B Stage 2's weight preview both display values to a connected user. The
specification does not define "public," and this artifact does not define it
either.

---

## PRC-11 · VF-PUB-003 — venue activity and protocol accounting

**`[SPEC]` VF-PUB-003** — Exchange or liquidity-venue activity cannot modify
protocol calculations or supply accounting.

**Practical implication.** A statement of protocol fact with a direct product
consequence: **no surface may display, imply, or invite the inference that
venue activity affects protocol state.**

The specific claims this forecloses include market price affecting reward
calculation, trading volume affecting issuance or capacity, liquidity affecting
weight or eligibility, and venue activity affecting supply accounting or
activation gates.

**Surface classes affected:** public · app · dashboard · docs

**Required:** no representation of venue activity as modifying calculations or
supply accounting.
**Free:** how independence is communicated, or whether it is communicated
explicitly at all.

**Interactions.** Map A overlay O4 governs supply accounting and activation
gates under §13. Map B Stage 3's VF-RAC-005 — the permanent $0.10 Reward
Reference Value, not an oracle or market price — is the concrete mechanism by
which reward calculation is insulated from market price. Both are referenced,
not restated.

---

# Part 4 · What §17 does not govern

Recorded so this artifact is not stretched beyond its source. §17 is silent on
each of the following, and silence here is not permission — it means the matter
is governed elsewhere or not yet governed at all.

- **Participant workflows and journeys.** Maps A and B.
- **Verification and traceability publication.** §16, Map A overlay O3, open
  decision 5.
- **The protocol price reference lifecycle.** §7, Map A overlay O7.
- **Deployment completeness and incomplete-deliverable reporting.** VF-EXT-002,
  VF-EXT-003, Map A overlay O8.
- **How product decisions are made.** Product Design Charter.
- **Educational structure, sequencing, and pedagogy.** Charter principle 2; no
  §17 content.
- **Accessibility, localisation, performance, and platform support.** Not
  addressed anywhere in the accepted baseline.
- **Any definition of "public."** See `[OPEN]` 19.

**§17 does not authorise anything that the rest of the specification forbids.**
A field permitted by PRC-05 that would misrepresent protocol behaviour is
forbidden by VF-PUB-001.

---

# Part 5 · Interactions with accepted artifacts

| This artifact | Interacts with | Nature |
|---|---|---|
| PRC-03 manifest | Map A O3 (§16), O8 (VF-EXT-002/003) | Manifest is verification raw material; O8 governs incompleteness |
| PRC-03 manifest | Index §7.2 evidence availability | Manifest content is post-deployment |
| PRC-04 no economic promises | Map B Stage 1, VF-TOK-015 | Token-side statement of the same principle |
| PRC-04 faithfulness | Charter principle 8 | Product-decision counterpart |
| PRC-06 refresh cadence | Map A O7 (§7) | Distinct objects. Accuracy obligation on the product, not a participant-facing distinction |
| PRC-06 commitment figures | Map A Step 2 preflight | Where a participant sees what a commitment produces |
| PRC-06 staleness | Charter principle 7 | Honest limitation disclosure |
| PRC-07 market independence | Map B Stage 1, VF-TOK-013/014 | Participant-side derivation |
| PRC-07, PRC-11 | Map B Stage 3, VF-RAC-005 | Fixed $0.10 reference is the concrete mechanism |
| PRC-08 listings | Charter principle 7 | Honest limitation disclosure |
| PRC-09 consistency | Index §9 baseline rule | Specification revision triggers both re-derivation and public review |
| PRC-11 accounting | Map A O4 (§13) | Supply accounting and activation gates |

**No accepted artifact is modified by this document.** Each interaction is a
reference.

---

# Part 6 · Standing constraint checklist

A review instrument. Every question restates a constraint derived above and
introduces nothing. Applied to any public-facing surface, at any time.

1. Does every claim on this surface derive from the current Master
   Specification? — PRC-04, PRC-09
2. Does this surface promise, project, or imply any economic outcome? — PRC-04
3. Does this surface describe any behaviour the specification does not contain?
   — PRC-04
4. Wherever a price appears, are the selected source and last update time
   identified? — PRC-10
5. Could any price on this surface be read as a guaranteed trading price? —
   PRC-10
6. Could the displayed price be mistaken for the protocol's valuation input? —
   PRC-06
7. Does anything here imply that market or venue activity affects protocol
   calculations or supply accounting? — PRC-07, PRC-11
8. Is any exchange listing presented as more than a development objective? —
   PRC-08
9. Do the registry fields shown fall within the resolution of `[OPEN]` 15? —
   PRC-05
10. Does this surface promise a verification that cannot yet be performed? —
    PRC-03, Index §7.2
11. Does this surface position itself as more authoritative than the preserved
    specification? — PRC-01
12. If the specification has been revised since this surface was written, has it
    been reviewed? — PRC-09

---

# Part 7 · Open product decisions arising

Numbered continuing the single sequence established by Map A (1–7), Map B
(8–13) and carried forward by the Product Architecture Index. **None is
resolved here.**

| # | Decision | Source | Note |
|---|---|---|---|
| 14 | Whether the Master Specification and its hash are published on public surfaces, and how prominently | PRC-01 | |
| 15 | Whether the public registry display set is closed to the eight enumerated fields, or permits additional fields consistent with VF-PUB-001 | PRC-05 | **Blocks public registry design.** Determines what the surface may contain. |
| 16 | How the product satisfies PRC-06's accuracy obligation — explicitly, implicitly, or in documentation | PRC-06 | |
| 17 | Whether market or venue data appears on any public surface, and how it is separated from protocol data | PRC-07 | |
| 18 | Whether exchange-listing effort is communicated publicly at all | PRC-08 | |
| 19 | Whether "public" under VF-PUB-002 extends to application displays visible only after wallet connection | PRC-10 | **Scope question.** Determines the reach of every price obligation. |
| 20 | What constitutes an economic promise at the margin | PRC-04 | Prohibition is clear at centre, undefined at edges |
| 21 | Whether the deployment manifest is surfaced publicly beyond the repository, and in what form | PRC-03 | Relates to open decision 5 |
| 22 | Whether a public-surface consistency review is a recorded required step on specification revision | PRC-09 | Process obligation |

**Two of these are structural rather than presentational.** Decisions 15 and 19
determine what public surfaces may contain and how far the price obligations
reach. Both should be resolved before public surface design begins; the
remaining seven can be resolved during it.

---

# Part 8 · Surface classes affected

Using the five classes both Presentation Maps already employ. **Every cell
marks a constraint that applies whenever such a surface exists** — none of these
surfaces is designed.

| | public | app | dashboard | docs | developer |
|---|:---:|:---:|:---:|:---:|:---:|
| PRC-01 specification preservation | ● | | | ● | |
| PRC-02 machine-readable registry | ● | | ● | | ● |
| PRC-03 deployment manifest | ● | | ● | ● | ● |
| PRC-04 language derivation | ● | ● | ● | ● | ● |
| PRC-05 registry display set | ● | | ● | | |
| PRC-06 twice-daily refresh | ● | ● | ● | | |
| PRC-07 market independence | ● | ● | ● | ● | |
| PRC-08 listings as objective | ● | | | ● | |
| PRC-09 standing consistency | ● | ● | ● | ● | ● |
| PRC-10 price display disclosure | ● | ● | ● | | |
| PRC-11 venue activity | ● | ● | ● | ● | |

**PRC-04 and PRC-09 apply everywhere.** They are the two constraints no
public-facing surface escapes, and they are the two most likely to be violated
by ordinary inattention rather than by intent — a phrase written for clarity
that adds a feature, or a page left unrevised after a specification change.

---

# Pre-acceptance revision record

This artifact was revised once before acceptance, in response to independent
review. Recorded visibly rather than applied silently.

| Location | Review finding | Change made |
|---|---|---|
| PRC-06 | The distinction between the informational price display and the protocol's valuation mechanism was correctly derived but given **disproportionate architectural weight**, framing an accuracy obligation as though it were a central participant concern | Constraint retained unchanged. Emphasis rebalanced: the obligation is stated as a limit on what the product may represent, not as a concept participants must be taught. The staleness-consequence row was removed from the comparison table. Map A Step 2 preflight added as the interaction where a participant sees what a commitment produces. |
| `[OPEN]` 16 | Framed the question as *whether to disclose the distinction*, which presupposed that disclosure was the mechanism | Reframed as *how the accuracy obligation is satisfied* — explicitly, implicitly, or in documentation. Still unresolved. |

**Version integer unchanged.** The artifact had not been accepted or committed
when the review was returned, so there was no baseline to correct. Had it been
committed, this would be version 2.

**One review observation was deliberately not incorporated.** The review
proposed specific participant-facing wording distinguishing informational price
from commitment preview. That wording is sound, but it is copy, and this
artifact contains no copy. It belongs to commitment preview design under Map A
Step 2, and is noted here so it is not lost.

---

# Revision policy

This artifact is a derivation. It changes when its source changes.

**Revise when:** §17 or any VF-PUB requirement is amended by a governing
specification revision · an open decision from 14–22 is resolved · a
derivation error is identified.

**Do not revise to:** record a design decision, which belongs in a design
artifact · resolve an open decision by assertion · import content from sections
of the specification that §17 does not govern.

**Corrections are recorded visibly**, in the manner of Map A v2's corrections
table, rather than applied silently.

**Version numbers are whole integers.**

---

*Derived solely from Master Specification Revision 6 §17 and requirements
VF-PUB-001, VF-PUB-002, VF-PUB-003, hash verified
`5a93506…f0bf9`. References to Presentation Map A v2, Presentation Map B v1,
Product Design Charter v1.0 and Product Architecture Index v1 are citations of
existing derivations, not restatements of them.*
