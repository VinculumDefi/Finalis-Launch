# Homepage Visual Design Specification

**Version:** 1
**Status:** Proposed for independent review
**Phase:** Product Design — visual language, Phase 1
**Surface:** S01 · P-01 · Home, and the visual language every future public page inherits
**Derived from:** Homepage Product Specification v1, the ten accepted baseline
artifacts, and Master Specification Revision 6, hash
`5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9`

> **Visual design specification. It governs appearance and nothing else.** It
> introduces no content, removes no required content, changes no page structure,
> and reopens no accepted decision. Where it conflicts with the Homepage Product
> Specification or any accepted artifact, **the accepted artifact prevails and
> this document is defective.**

---

## What this document is for

The Homepage Product Specification §13 states what it deliberately does not
specify: *colour, typeface, scale, spacing system, imagery style, logo
treatment, iconography.* It constrains the **relationship** between visual
registers without specifying the registers themselves.

This document specifies them. It is the missing half.

It is written so that an elite designer can execute the homepage — and every
page after it — **without inventing Vinculum's visual philosophy**, and without
having to guess which conventions the architecture forbids.

**Markings continue the baseline discipline.** `[SPEC]` and `[ARCH]` are cited
from frozen sources; `[VD]` marks a visual decision made here and open to
revision. **Everything in this document is `[VD]` unless marked otherwise** —
the accepted baseline is silent on appearance, and this document does not
disguise its own authorship as inherited authority.

**No CSS, no code, no component library, no Figma, no image.** Token values
appear as named specification values because a design system without values is
an essay. How they are implemented is out of scope.

---

# Part 1 · Visual philosophy

## 1.1 The single sentence

> **The site should look like it knows it is not the authority.**

Everything below is an implementation of that sentence.

**`[ARCH]`** PRC-01's product consequence — *no product surface may position
itself as the authoritative description of protocol behaviour, because a more
authoritative one is preserved and available* — is usually read as a content
constraint. It is also the strongest available visual brief. A page that
outranks nothing should not be dressed as though it outranks something.

Almost every convention of contemporary product design exists to make a page
feel like the destination: the full-bleed hero, the oversized headline, the
elevated card, the ambient gradient, the number that counts up. Each is a claim
of primacy. Vinculum's homepage makes the opposite claim, and it must make it in
the medium the visitor actually perceives first, which is not the copy.

## 1.2 The reference class

`[VD]` **The homepage's reference class is the printed technical document, not
the landing page.**

Specifically: the first page of a specification, a critical edition, a standards
document, a legal instrument. Objects whose visual authority comes from
*apparatus* — citation, numbering, rule, margin, consistent measure — rather
than from *presentation*.

The derivation is not aesthetic preference. The homepage has, by frozen
specification, **no figures (§9.4), no motion (§4.1, §4.3), no imagery of people,
no logos, no badges, no social proof, and no state-changing controls (§7.1).**
Strip those from a conventional landing page and nothing remains. Strip them from
a document and the document is intact, because a document was never using them.

**The visual language must therefore generate its entire interest from
typography, measure, rule, and space.** That is a constraint, and it is also the
opportunity: it is the only register in which this product could look like
itself.

**What the reference class is not.** Not a "broadsheet aesthetic," not
newspaper pastiche, not typewriter nostalgia, and not the terminal. Those are
costumes worn to signal rigour. §1.5 explains why signalling rigour is
prohibited here on exactly the same grounds as signalling excitement.

## 1.3 What emotions naturally emerge

**`[ARCH]`** Decision 4, ACCEPTED, and Website Specification Phase 1 Part 2
settle the question before it is asked:

> The product does not produce calm. **It removes the conditions that produce
> pressure.** What a visitor experiences as calm is the absence of those, not the
> presence of a designed feeling.

`[VD]` The visual system's job is therefore **subtraction, and the emotions are
residue.** What is left over when the pressure devices are gone:

**Being taken seriously.** The page is dense with real sentences, set at a
comfortable measure, with nothing simplified for the reader's benefit. The
emergent feeling is that the visitor was assumed to be capable.

**Not being sold to.** No element on the page is trying to move the visitor. The
emergent feeling is unfamiliar and slightly disorienting, and that is correct —
**`[ARCH]`** *she notices that, because nothing else she has opened this month
began that way.*

**Relief at being told the truth early.** **`[ARCH]`** The only emotion Website
Specification Phase 1 permits the page to produce, and it is *a byproduct of
principle 7 rather than a design goal.* Visually it is produced by one thing:
the limitation being set in the same type as everything else. §5.

**A small, honest austerity.** The page is plain. Not stark, not brutalist, not
performing severity — plain, in the way a well-set document is plain.

## 1.4 What must never be manufactured

`[VD]` Six. Each is a visual device with a name, so that it can be caught in
review rather than argued about.

**Excitement.** No gradient, no glow, no accent that arrives at high chroma, no
motion on load, no counting figure, no colour that reads as energy.

**Reassurance.** No green, no checkmark, no shield, no lock, no badge, no seal,
no "audited by," no soft rounded warmth deployed to make a limitation feel
manageable.

**Urgency.** No countdown, no progress bar toward a threshold, no capacity meter,
no element whose appearance changes with the passage of time. **`[ARCH]`**
*Nothing counts down. Nothing is scarce.*

**Prestige.** No luxury-brand vocabulary: no hairline display serif at enormous
size, no wide letterspaced all-caps wordmark floating in white space, no
editorial "atmosphere." Prestige is persuasion aimed at a different appetite.

**Intimidation.** No wall of monospace, no terminal green, no matrix, no
deliberately forbidding density. A page that performs technical difficulty is
manufacturing credibility, which is **`[ARCH]`** the assertion Charter principle
3 forbids — merely in a costume that flatters engineers rather than investors.

**Warmth as friendliness.** No conversational illustration, no mascot, no
rounded-everything softness, no colour temperature deployed to make the reader
feel accompanied. **`[ARCH]`** *There is no one to ensure anything*, and the page
should not imply a companion.

## 1.5 The rigour trap

`[VD]` **The most likely failure of this design system is that it starts
performing the thing it is supposed to be.**

Monospace is the tell. Monospace reads as verifiable, technical, exact — which
is precisely why it must be rationed. A page set largely in monospace has not
become more checkable; it has become a costume of checkability, and it is
manufacturing the same trust that a green checkmark manufactures.

**Rule (binding, §3.4): monospace appears only on strings the visitor could
actually check** — hashes, addresses, commits, requirement identifiers, section
references, code. Never on headings, never on navigation, never on prose, never
for texture.

The same trap has three other doors: hairline rules used as generic decoration
rather than as the binding mark they mean (§4.2); citation apparatus applied to
claims that have no citation (§5.3); and density pursued as an aesthetic rather
than as a consequence of having a lot to say.

---

# Part 2 · The signature

`[VD]` Two elements carry the identity. Everything else is quiet.

## 2.1 The vinculum

**A vinculum is a typographic mark: a horizontal bar drawn *over* a group of
symbols to bind them into one term.** It is the product's name, and it is
already a rule on a page.

**Decision: the overbar is Vinculum's sole structural mark.**

- **A rule appears above a bound group, never below it, and never merely between
  things.** A region begins with a rule spanning its measure; the heading sits
  beneath the rule; the content sits beneath the heading. The rule is not a
  divider closing what came before — it is a bar binding what follows.
- **A rule always spans a real group.** If the content beneath a rule is not one
  thing, the rule is wrong. This is the discipline that keeps the system from
  becoming ruled-everything broadsheet furniture.
- **Two weights only.** A structural overbar at 1px in Ink for the seven page
  regions; a hairline at 1px in Rule for subordinate groups (table rows,
  citation blocks, footer). No third weight, no double rules, no decorative
  flourishes at rule ends.
- **Nothing else divides.** No dotted lines, no vertical rules except the
  citation column's optional hairline (§5.3), no section dividers, no ornaments.

Why it is not decoration: the mark is the name, and the name means *bond*. The
protocol's core mechanic is that an asset is **bound in place** while evidence
about it travels. The page's structural device is a bar that binds a group
without moving it. That is the one place where this product's visual language can
say something true about the product without saying anything at all.

## 2.2 The citation margin

**Decision: every claim on the page carries its source in an adjacent margin
column, set at the same weight as the claim.**

**`[ARCH]`** Homepage Product Specification acceptance criterion 3: *every claim
on the page is reachable in one step from a page where it can be checked, or is
marked as not yet checkable per VF-EXT-002.* That is stated as a routing
obligation. Rendered, it becomes an apparatus.

- On wide viewports the page is set in two columns: a **prose measure** and a
  narrower **citation margin** to its left. The margin carries specification
  references (`§12`, `VF-IMM-006`), aligned to the first line of the claim they
  support, in mono at small size.
- **A footnote would be a violation.** A source set smaller, later, and at the
  bottom is **`[ARCH]`** *a limitation delivered in a smaller, softer, later
  voice* — the same concealment §10.6 forbids, applied to evidence instead of to
  caveats. The margin is level with the claim, not beneath the page.
- **The margin is not decoration and must not be padded out.** A paragraph with
  no specification source has an empty margin, and the emptiness is information:
  it says the sentence is the product's own framing rather than derived content.
  **The reviewer's test is whether the empty margins are honest, not whether they
  are rare.**
- **On narrow viewports the reference follows the claim inline**, in mono, in the
  same paragraph, same colour, same weight — never collapsed, never a tooltip,
  never dropped. §7.3.

This is what the page will be remembered by. It is also the most direct visual
statement of the North Star available: the page shows its working in the margin,
the way a document expecting to be checked does.

## 2.3 The risk being taken, and its justification

`[VD]` **The homepage has no large type.**

The `h1` is 26px. Body is 19px. The entire scale spans 13px to 26px — a ratio of
2.0 from smallest to largest, and **1.37 from body to headline.** No element on
the page is set at display size. There is no hero.

This is the deliberate aesthetic risk, and three frozen constraints require it:

**One.** **`[ARCH]`** §3.3: *the homepage has no above-the-fold optimisation*,
because the page has no desired action and departure is legitimate. A display
headline exists to hold a viewport against departure. There is nothing for it to
do here.

**Two.** **`[ARCH]`** §10.6: emphasis may not correlate with whether a statement
is favourable. A 64px headline stating what the protocol is, above 16px body text
stating what it does not promise, has encoded a preference in point size — and it
would do so even if the words were perfect.

**Three.** **`[ARCH]`** OC-1 requires that no statement of what the protocol
offers appear above the non-promises. A hero is a statement of offer occupying
the first viewport by definition.

**What replaces size.** Headings are distinguished by **the overbar above them,
weight, letterspacing, and the space they are given** — four devices, none of
which is volume. A reader always knows where they are; nothing ever shouts to
tell them.

**The honest cost.** The page will look, at first glance, like a document rather
than a website, and some visitors will read that as unfinished. That is the trade
being made, deliberately, in exchange for a page whose typography cannot lie about
what it prefers.

---

# Part 3 · Typography

## 3.1 Two families, two jobs

`[VD]` **A serif for everything a person reads. A monospace for everything a
person could check. No third family.**

The two-family scheme is semantic, not decorative. Family is the one typographic
dimension permitted to carry meaning, because the meaning it carries —
*checkable / not checkable* — is a structural fact rather than a sentiment, and
§10.6's prohibition is on sentiment.

**A sans-serif is deliberately absent.** A UI sans would create a third register
whose implicit meaning is "interface" — and the page is not an interface, it is
a document with routes. Navigation, labels, and captions are set in the serif at
small size with letterspacing.

## 3.2 Text face

`[VD]` **Source Serif 4.**

Selection criteria, stated so the face can be substituted without losing the
system:
- **A text serif, not a display serif.** Designed for extended reading at body
  size, with stroke contrast low enough to hold at 13px and at reduced screen
  contrast.
- **A technical rather than literary lineage.** Source Serif descends from
  Fournier; it reads as a document face, not a book face and not a fashion face.
- **A genuine weight range in a single optical family**, so that heading weight
  is available without introducing a display cut.
- **Open licence, variable, and self-hostable**, so that the page has no
  third-party font dependency — consistent with **`[ARCH]`** §10.7's requirement
  that the page work with JavaScript unavailable and §10.9's requirement that it
  be exceptionally light.

**Acceptable substitutes:** Spectral, Newsreader, Charter. **Not acceptable:**
any high-contrast display serif (Playfair, Cormorant, Canela), any slab, any
face whose 300 weight is its characteristic setting.

## 3.3 Mono face

`[VD]` **IBM Plex Mono.**

Criteria: unambiguous `0/O`, `1/l/I`, `5/S`, `8/B` at 14px — a hash is only
checkable if it can be read character by character; a regular weight that sits
beside the serif without dominating; open licence; and no terminal affectation.

**Upgrade path:** Berkeley Mono, if a licence is acquired. It is the better face
for this job and the difference is visible in exactly the place it matters — long
hexadecimal strings.

## 3.4 Where monospace is permitted

`[VD]` **Binding list. Monospace appears on:**
1. Cryptographic hashes and their fragments.
2. Chain addresses, transaction identifiers, block heights, source commits.
3. Requirement identifiers (`VF-IMM-006`) and specification section references
   (`§12`, `§17.1`).
4. Content of a code block.
5. Machine-readable field names and file paths where they are named as artifacts.
6. Availability tags under §5.5.

**Monospace never appears on:** headings, navigation, buttons, links whose
destination is a page, body prose, region labels, the footer, numbers that are
not identifiers, or anything chosen for texture.

The list is exhaustive. An addition to it requires a stated reason and is a
revision to this document, not a designer's judgement call.

## 3.5 Scale

`[VD]` Desktop. All sizes in CSS pixels; line heights absolute, on a 4px
baseline.

| Role | Size / Line | Family | Weight | Tracking |
|---|---|---|---|---|
| **Page title** (`h1`, H-01) | 26 / 36 | Serif | 600 | −0.01em |
| **Region heading** (`h2`, H-02–H-07) | 22 / 32 | Serif | 600 | −0.005em |
| **Subheading** (`h3`, rare) | 19 / 28 | Serif | 600 | 0 |
| **Body** | 19 / 32 | Serif | 400 | 0 |
| **Body emphasis** | 19 / 32 | Serif | 600 | 0 |
| **List item** | 19 / 32 | Serif | 400 | 0 |
| **Structural label** (region eyebrow, table header, nav) | 14 / 20 | Serif | 600 | +0.08em, uppercase |
| **Citation / margin** | 14 / 20 | Mono | 400 | 0 |
| **Evidence string** (inline) | 0.92em of parent | Mono | 400 | 0 |
| **Code block** | 15 / 24 | Mono | 400 | 0 |
| **Footer** | 15 / 24 | Serif | 400 | 0 |

**Mobile:** body 17/28; `h1` 23/32; `h2` 20/28; labels and citations 13/20;
everything else scales proportionally. Nothing drops below 13px anywhere,
ever.

**Ratios worth stating explicitly**, because they are the risk:
- Largest to smallest: **2.0×**
- Headline to body: **1.37×**
- No step in the scale exceeds **1.19×** its neighbour.

## 3.6 Measure and setting

`[VD]`
- **Prose measure: 660px**, ≈ 66–70 characters at 19px. Never wider on any
  viewport, including ultra-wide.
- **Alignment: left, ragged right.** Never justified — justification produces
  rivers at this measure and, more relevantly, it is a device for making text
  look authoritative.
- **Hyphenation: off.**
- **Paragraph separation: space, not indent.** 16px between paragraphs; no first-
  line indent.
- **Widows and orphans:** headings never sit alone at the foot of a viewport
  where layout can prevent it; no other typographic fussing.
- **Italics** are reserved for the titles of referenced documents (*Master
  Specification*, *Product Design Charter*). **Italics are never a hedge**, never
  a softener, and never applied to a limitation. §5.2.
- **Bold** carries structural emphasis within a sentence. It may fall on a
  limitation as readily as on a capability, and in H-02 and H-04 it should.
- **All-caps** appears only at the structural-label size with tracking. Never in
  prose, never in a heading.
- **No underline except on routes.** §8.1.

## 3.7 Numerals

`[VD]` Lining numerals throughout; tabular figures in tables and in any mono
string. Old-style figures are a book convention and would make identifiers harder
to read character by character.

---

# Part 4 · Colour

## 4.1 Philosophy

`[VD]` **Colour carries no meaning that text does not also carry.**

Two derivations, one from each side of the architecture.

**`[ARCH]`** §10.7: *no information conveyed by colour alone* — including
availability status and any distinction between lifecycle steps. This makes
colour redundant by requirement.

**`[ARCH]`** §10.6: emphasis may not correlate with favourability. Colour is the
strongest emphasis device there is, and the conventional palette is built
entirely out of sentiment: green means good, red means bad, blue means trust,
amber means caution. **A product that must give a limitation the same dignity as
a capability cannot use a palette that grades them.**

The consequence is a near-monochrome page with one restrained hue, and the hue's
only job is wayfinding.

## 4.2 Light tokens

`[VD]`

| Token | Value | Use |
|---|---|---|
| **Paper** | `#FAFAF8` | Page ground. Warm near-white; not paper-cream, not pure white. |
| **Paper-recessed** | `#F2F1EC` | Ground of code blocks and evidence strings only. |
| **Ink** | `#191814` | **All content text.** Headings, body, lists, limitations, tables. |
| **Ink-quiet** | `#5C594F` | **Chrome only** — inactive navigation, footer attribution, table header labels. **Never content.** §4.4. |
| **Rule** | `#D9D6CC` | Hairline. Subordinate groups, table rows, citation column edge. |
| **Rule-structural** | `#191814` | The region overbar. Ink at 1px. |
| **Route** | `#2E3159` | Links, and nothing else. |
| **Route-visited** | `#4A4560` | Visited links. Distinguishable, not decorative. |

**Route is deliberately close to Ink.** It reads as an ink of a different batch
rather than as a highlight — visible in a paragraph, invisible from across the
room. The underline does the work of signalling a route (§8.1); the colour only
confirms it. A high-chroma link colour would make every route on the page a
small attention claim, and there are fourteen of them.

**There is no accent beyond Route.** No secondary, no tertiary, no brand colour,
no highlight, no tint fill anywhere on the page.

## 4.3 Dark tokens

`[VD]` **Dark mode is the same document under different light — not an
inversion, and not a different mood.**

| Token | Value |
|---|---|
| **Paper** | `#141310` |
| **Paper-recessed** | `#1C1B17` |
| **Ink** | `#E9E6DD` |
| **Ink-quiet** | `#96917F` |
| **Rule** | `#33312A` |
| **Rule-structural** | `#E9E6DD` |
| **Route** | `#A8AEDC` |
| **Route-visited** | `#BFB6D0` |

Rules:
- **Ink is not pure white on pure black.** Maximum contrast is a drama device and
  it fatigues at this reading length.
- **Contrast ratios in dark mode are within 15% of their light-mode
  equivalents.** Dark mode must not be *more* emphatic; register parity is a
  relationship, and inverting the ground must not change it.
- **Follows the system preference by default.** A toggle is permitted; it is
  chrome, sits in the footer, and is never a floating control.
- **No dark-mode-only effects** — no glow, no elevated surface, no coloured
  ambient light.

## 4.4 The Ink-quiet rule

`[VD]` **Ink-quiet may never carry content.**

This is the single token most likely to destroy the system. A designer looking
for hierarchy will reach for a lighter grey, and the first thing that grey lands
on will be a caveat — because caveats are what look heavy in a layout.

**Permitted:** inactive navigation entries, footer entity attribution, table
column headers, the citation column's own label if one exists.

**Forbidden:** any sentence, any limitation, any non-promise, any availability
statement, any list item, any figure caption that says something.

**Review test:** select every element set in Ink-quiet and ask whether removing
it would change what the visitor knows. If yes, it is content and it is in the
wrong colour.

## 4.5 Status colour — there is none

`[VD]` **No red. No green. No amber. Anywhere in the system.**

This is not squeamishness; it is the most consequential colour decision in the
document, and it comes from the architecture's most distinctive requirement.

**`[ARCH]`** P-08 Verification Activity must display **failures**, and *a
verification dashboard showing only successes is an assertion surface.* The
architecture treats a visible failure as evidence of integrity — the strongest
thing the product can show.

Colouring that failure red would frame the product's proudest disclosure as an
alarm. Colouring the successes green would make the honest page look mostly
broken. **A palette that grades outcomes would invert the meaning of the surface
the whole verification argument rests on.**

**Status is therefore conveyed by label**, in Ink, in the same type as
everything else: *verified*, *failed*, *pending*, *not yet available*. The word
is the indicator. If a designer needs a visual differentiator in a dense table,
the permitted device is **weight or a hairline, never hue.**

The same rule governs error and success states throughout the product. §9.13.

---

# Part 5 · Trust language

**This part is the reason the document exists.** Everything before it is
craft; this is where the visual system either implements the Charter or quietly
routes around it.

## 5.1 The governing rule

**`[ARCH]`** Homepage Product Specification §10.6, binding and inherited:

> Limitation content and capability content are typographically identical. Same
> family, same size, same weight, same colour, same contrast, same line height,
> same spacing, same container treatment.

`[VD]` Its generalisation, which every future page inherits:

> **Emphasis may encode structure. Emphasis may never encode sentiment.**

Size, weight, colour, position and space may all say *this is a heading*, *this
is a group*, *this is a route*. **None of them may say *this is the good part* or
*this is the small print*.**

## 5.2 The prohibited softenings

`[VD]` A limitation may not be set with any of the following. The list is
binding and is written as devices rather than as principles so that it can be
enforced in review.

| Device | Why it is a violation |
|---|---|
| Smaller type | Volume grading. §10.6 directly. |
| Lighter weight or Ink-quiet | §4.4. |
| Italics | Italics read as parenthetical — a hedge in typographic form. §3.6. |
| A bordered "notice" or "warning" box | A box says *this belongs to a different class of statement.* It does not. |
| A tinted panel | Same, plus colour grading. §4.1. |
| A warning icon, exclamation mark, or triangle | An alarm glyph manufactures fear. §1.4. |
| Placement at the foot of the page | Later is quieter. §10.6's "later voice." |
| A collapsed panel, accordion, "read more", or tooltip | **`[ARCH]`** §4.2: a limitation one interaction away from visible is invisible to the visitor who does not perform the interaction — and that visitor is precisely the one it exists to protect. |
| A softening clause set alongside it | **`[ARCH]`** §4.2 forbids the *content*; the visual counterpart is a two-column layout that pairs each limitation with a reassurance. |

**Corollary, and it is a hard one:** **the design system contains no alert
component, no callout component, no disclaimer style, and no fine print.** If a
design file contains one, it will eventually be used, and the first thing it will
be used on is H-02.

## 5.3 How evidence is emphasised

`[VD]` **Evidence is emphasised by proximity to its source, never by weight.**

Three devices, all structural:

**The citation margin (§2.2).** A claim's source sits level with it. Nothing is
made bigger; the apparatus simply exists.

**Monospace as a semantic (§3.4).** A string set in mono is a string the visitor
could check. The family change is the emphasis, and it is a statement of kind
rather than of importance.

**Adjacency of source and figure.** Wherever a figure appears anywhere in the
product — never on the homepage (**`[ARCH]`** §9.4), but everywhere in the
dashboards — its source and update time sit **immediately beside it, in the same
type block, at the same size**. **`[SPEC]`** VF-PUB-002 requires their presence;
this document requires their *dignity*. A source rendered as a grey subscript is
a compliance artefact, not a disclosure.

**The specification hash gets no special treatment beyond mono.** **`[ARCH]`**
§4.5 already decided its placement: adjacent to the route into P-13, with one
line stating what it lets the reader check. Visually it is a mono string on
Paper-recessed with a hairline. **No badge, no seal, no lock glyph, no "verified"
chip.** *The same string, in two positions, is either an ornament or an
instrument* — and an ornamented instrument is an ornament.

## 5.4 How uncertainty is presented

`[VD]` **`[SPEC]`** VF-EXT-002 requires that an unavailable deliverable be
reported as incomplete rather than replaced with an invented value.

Visual implementation:

- **A mono availability tag** — the word, in mono, at citation size, in Ink — set
  immediately after the item's name. Never a badge, never a pill, never
  coloured, never a dot.
- **The item remains at full contrast.** **`[ARCH]`** §9.5: unavailability is
  stated *in text, in the same register*, and is available to assistive
  technology. **Greying out an unavailable route is a §4.4 violation and a
  §10.7 violation simultaneously** — it de-emphasises content and conveys
  information by colour alone.
- **No spinner, no skeleton, no shimmer, no progress indication.** These imply
  the thing is arriving. It is not arriving; it does not exist yet.
- **No "coming soon", no estimated date** — **`[ARCH]`** §9.5 excludes them as
  schedule claims. The visual system has no component that could express one.

## 5.5 Warning language versus marketing language

The brief asks how the two differ visually. `[VD]` **The honest answer is that
this product has neither, and the visual system must contain neither.**

There is no marketing language, because **`[SPEC]`** §17.1 requires website
language to derive from the specification and forbids adding economic promises
or protocol features. There is therefore no persuasive register for a warning
register to contrast against.

And there is no warning language, because a warning is an instruction about how
to feel. **`[ARCH]`** §8.3: the page never suggests that not participating
carries a cost, and never frames a limitation as consequence-of-inaction.
**`[SPEC]`** VF-IMM-006 — *the inability to repair a deployed defect is an
accepted consequence of eliminating post-deployment control* — is a statement of
fact set in body type, once, without amplification and without a remedy attached.

**Consequence:** the page has **one register**. There is no second voice for
either selling or warning, which is why §5.2's prohibition on alert components is
absolute rather than situational.

## 5.6 The H-04 pair

`[VD]` H-04 states the absence of control and its cost, and **`[ARCH]`** OC-3
requires them adjacent, sequential, and typographically identical. Because this
is the page's hardest visual moment, its treatment is specified rather than left
to judgement:

- **One overbar, one heading, one continuous prose block.** The property and the
  cost are not two blocks with a gap; they are one passage.
- **No visual device marks the transition** — no rule, no space larger than a
  paragraph break, no change of any kind.
- **The citation margin carries `§2` and `VF-IMM-001` beside the property, and
  `VF-IMM-006` beside the cost.** Both citations at identical treatment. This is
  the apparatus doing its most important work on the page: the cost is not the
  product being candid, it is the product quoting the specification.
- **`[ARCH]`** §4.4's accessibility requirement — no intervening heading — means
  no visual heading either. A screen-reader user must not be able to navigate
  past the cost by heading, and a scanning sighted reader must not be able to
  either.

---

# Part 6 · Layout, space and rhythm

## 6.1 How information breathes

`[VD]` **Space separates arguments. Space never creates atmosphere.**

The distinction is operational. Atmospheric white space is space added to make a
page feel calm, premium, or considered — space in proportion to how important the
designer wants the content to seem. Argumentative white space is space in
proportion to *how much of a break in the reasoning has occurred*.

Consequence: **space is quantised to the structure**, and the quantities are
fixed:

| Break | Desktop | Mobile |
|---|---|---|
| Between paragraphs | 16 | 16 |
| Between a heading and its first paragraph | 16 | 16 |
| Between sub-groups within a region | 32 | 24 |
| Above a region overbar | 96 | 64 |
| Between the overbar and its heading | 12 | 12 |
| Page top to first content | 64 | 40 |
| Last region to footer | 96 | 64 |

**Nothing gets extra space because it matters more.** A region containing a
limitation and a region containing the lifecycle receive identical treatment.
This is §5.1 expressed in the spacing scale.

## 6.2 Spacing scale

`[VD]` 4px base. Permitted values: **4, 8, 12, 16, 24, 32, 48, 64, 96, 144.**
No intermediate values. No value above 144 anywhere on the page.

The ceiling matters: a 200px+ region gap is the signature of an atmospheric
landing page, and it is the easiest way to make this document accidentally read
as one.

## 6.3 Grid and shell

`[VD]`

| Element | Value |
|---|---|
| Shell maximum | **1180px** |
| Prose measure | **660px**, fixed |
| Citation margin column | **180px** |
| Gutter between margin and prose | **32px** |
| Page side padding | 48px desktop · 32px tablet · 20px mobile |

**The two-column apparatus** (citation margin + prose) engages at viewport
widths ≥ 1080px. Below that, the page is single-column and citations render
inline (§7.3).

**The prose column is not centred in the shell.** With the citation margin to its
left, the text block sits left of centre — which is what a document with a margin
apparatus does, and it is the layout's most recognisable property at a glance.

## 6.4 Density

`[VD]` **Text-forward and comfortable. Neither sparse nor cramped.**

The homepage should be a page a person reads, not a page a person scans. Its
density target is that of a well-set report: 19/32 at 66–70 characters, with
paragraphs of three to six lines and regions of three to eight paragraphs.

**A homepage that fits in two viewports has been trimmed; a homepage that runs
past six has started arguing.** **`[ARCH]`** §8.4: *length is itself a signal —
an orientation surface that runs long has usually started arguing.*

## 6.5 Reading rhythm and visual pacing

`[VD]` The page has one rhythm and it repeats seven times:

> **rule → label → heading → prose → routes**

Every region is built identically. There is no alternation, no zigzag, no
alternating-background sections, no "breaking up the page." Regions differ in
length and in what they say; they never differ in form.

Why: **`[ARCH]`** §2.4 requires that no route be styled as the recommended one
and that no region be emphasised over another. A layout that varies its treatment
between regions is grading them, and the grading will inevitably favour the
regions that are easiest to make attractive — which are never the limitations.

**The predictability is the point.** A reader who has read H-02 knows exactly what
H-04 will look like, and therefore reads it for what it says.

## 6.6 How important information gains attention without shouting

`[VD]` Four permitted devices, in order of preference. **None is volume.**

**Position.** Earlier is more prominent. The page's entire hierarchy of
importance is expressed in **`[ARCH]`** OC-1 through OC-6 — the ordering
constraints — and the layout's job is to render that order faithfully and add
nothing to it.

**Isolation.** A short paragraph surrounded by the standard 32px group gap is
more prominent than the same sentence inside a long paragraph. Space around, not
size within.

**Structural bold.** Weight 600 on a clause inside body text. Available equally
to limitations and capabilities, and in H-02 and H-04 it should fall on
limitations.

**The overbar.** A group that begins with a structural rule is announced as a
group. That is the strongest signal on the page and there are exactly seven of
them.

**Explicitly unavailable:** size increase, colour, background tint, elevation,
border, badge, icon, motion, or any container that separates the content from the
document.

---

# Part 7 · Responsive philosophy

## 7.1 The governing inheritance

**`[ARCH]`** §10.4, binding: **no content is removed at any viewport.** The page
reflows; it does not reduce. **`[ARCH]`** §10.5: ordering constraints OC-1, OC-2,
OC-3 and OC-6 hold in DOM order and visual order at every viewport, and a layout
that passes on desktop and fails at one breakpoint is a defective implementation.

`[VD]` The visual consequence: **the responsive strategy has one axis — the
citation apparatus — and everything else is the same page at a different
measure.** No layout mode changes, no components appear or disappear, no region
reorders.

## 7.2 Breakpoints

`[VD]` Three, named by what changes rather than by device.

| Name | Range | What changes |
|---|---|---|
| **Apparatus** | ≥ 1080px | Two-column: citation margin + prose |
| **Column** | 640–1079px | Single column; citations inline; navigation still expanded |
| **Narrow** | < 640px | Single column; citations inline; navigation may collapse to one control |

## 7.3 Citation behaviour below the apparatus breakpoint

`[VD]` The reference moves from the margin into the flow, set in mono at citation
size, immediately following the sentence it supports, in Ink, at full contrast.

**It is never:** hidden, collapsed, moved to a footnote, moved to the end of the
region, turned into a tooltip, or reduced in contrast. §5.4's reasoning applies —
the apparatus is evidence, and evidence that disappears on a phone has been
concealed from most visitors.

## 7.4 Desktop

`[VD]` Apparatus layout. Shell 1180, prose 660, margin 180, gutter 32, side
padding 48. Navigation fully expanded, five entries. Footer three routes, one
line where it fits.

## 7.5 Tablet

`[VD]` Column layout. Prose measure holds at 660 until the viewport cannot
afford it, then shrinks to viewport minus padding — **never grows.** Navigation
remains fully expanded; **`[ARCH]`** §10.2: five entries collapse to a menu
control only below the width at which they cannot fit without truncation, never
merely because a breakpoint was crossed.

## 7.6 Mobile

`[VD]` Narrow layout. Body 17/28. All seven regions fully expanded — no
accordion, no truncation, nothing behind a control, at any region. The overbar
spans the full text column. The specification hash wraps across lines and is
never inside a horizontally scrolling container.

## 7.7 Ultra-wide

`[VD]` **The page does not grow.**

At 2560px and beyond, the shell remains 1180px, the prose measure remains 660px,
and the additional width becomes margin. There is no second column, no
sidebar, no expanded illustration, no background treatment introduced to "fill"
the space, and no re-centring of the prose column — the citation margin's
off-centre position is preserved, because it is structural.

Derivation: **`[ARCH]`** §10.4's content-parity rule cuts both ways. A layout
that adds material at wide viewports has made the page's content conditional on
the visitor's monitor.

---

# Part 8 · Navigation language

## 8.1 Routes

`[VD]` **Every route on the page is a link. There are no buttons**, because
**`[ARCH]`** §7.1: every call to action is a route and none changes state.

| Property | Specification |
|---|---|
| Colour | Route |
| Underline | **Always present.** 1px, offset 3px, never appearing on hover |
| Hover | Underline thickens to 2px. No colour change, no background, no motion |
| Focus | §8.7 |
| Visited | Route-visited |
| Weight | Inherited from context — never bolded to attract |

**The always-underlined rule is derived, not conventional.** **`[ARCH]`** §5.9
requires that link purpose be clear from link text alone (WCAG 2.4.9, AAA) on
Charter principle 1 grounds — *a visitor cannot decide whether to follow a route
whose destination is withheld.* A route whose *existence* is withheld until hover
fails the same principle, and fails it entirely on touch devices.

**External routes** (block explorers, the repository) carry a small directional
mark after the text. §9.5. This is the only glyph in the system.

## 8.2 Persistent navigation

`[VD]`

- Five entries, structural-label type (14/20, serif 600, +0.08em, uppercase),
  Ink-quiet inactive, Ink on hover and focus.
- **Beneath a hairline rule spanning the shell** — the overbar binding the
  navigation as a group, consistent with §2.1.
- Left-aligned with the shell; the wordmark, if one exists, sits at the same
  size and weight as the entries and is not larger.
- **`[ARCH]`** §5.2: Verify precedes Workspace, in DOM and visual order.
- **Never sticky by default.** Optional stickiness is permitted at Column and
  Narrow; if sticky, it is Paper with a hairline and **no shadow, no blur, no
  translucency** (§9.2).
- **`[ARCH]`** §5.5: no entry changes with scroll depth, session count, wallet
  state, or visitor behaviour. No badge, dot, counter, or notification indicator.

## 8.3 Workspace entry

`[VD]` **`[ARCH]`** §5.6: a door, not an invitation. The visual expression of
that distinction is total absence of promotion:

- Same type, same colour, same weight, same size as the other four entries.
- **No button treatment, no fill, no border, no accent, no arrow, no "→".**
- Last of the five, after Verify.

**Review test:** if a visitor can tell from styling alone which navigation entry
the operator would prefer them to click, the entry has been promoted and the
implementation is defective.

## 8.4 Verification entry

`[VD]` Identical treatment. The verification entry is **not** given extra
prominence to signal integrity — that would be manufacturing reassurance (§1.4),
and the architecture's protection of the skeptic is expressed in **order**
(OC-2), not in emphasis.

## 8.5 Mobile navigation

`[VD]`

- Collapses to a single labelled control only when the five entries cannot fit
  without truncation.
- **Labelled with a word, not a hamburger glyph** — §9.5 permits one glyph in the
  system and this is not it.
- Opens as a **panel that pushes content down or occupies the full viewport in
  Paper** — not an overlay, not a drawer with a shadow, not a translucent sheet.
- All five entries visible in the same order; nothing nested.
- Dismiss control is a word. Focus returns to the opening control on close.

## 8.6 Scrolling, section transitions, and anchors

`[VD]`
- **No scroll-triggered behaviour of any kind.** No reveal, no fade-in, no
  parallax, no scroll-snap, no scroll-jacking, no progress bar, no sticky region
  headings, no "back to top" control (**`[ARCH]`** §7.3 excludes the last).
- **Section transitions are the overbar and the 96px gap.** Nothing else marks a
  boundary — no alternating grounds, no full-bleed bands, no wave, no divider
  graphic.
- **Anchors:** regions carry stable identifiers so they can be linked to
  directly. Arriving at an anchor places the region's overbar at the top of the
  viewport with 24px clearance. **The jump is instant** — smooth-scroll is motion
  in service of nothing and is excluded by §11.
- **No highlight on the arrived-at region.** A flash or tint would grade it.

---

# Part 9 · Component philosophy

## 9.1 The component principle

`[VD]` **A component may organise content. A component may never contain content
in a way that says something about it.**

A card, a callout, a panel and a badge all make a claim by their existence: *this
material is a unit of a particular kind*. On this page every claim must be
traceable, and a claim made by a container is untraceable by construction.

## 9.2 Depth, shadow, glass, light

`[VD]` **The page has one plane.**

- **No shadow.** Not on cards, not on navigation, not on the mobile panel, not
  at any elevation, not at any opacity.
- **No glass, no blur, no translucency, no backdrop filter.**
- **No gradient.** Not in backgrounds, not in rules, not in text, not at low
  opacity.
- **No glow, no vignette, no ambient light, no coloured wash.**
- **Separation is achieved by rule and space, exclusively.**

Derivation: elevation is a hierarchy encoded in Z. An element that floats above
the page is asserting primacy over the elements it floats above — which is
§5.1's prohibition expressed in a third dimension. And **`[ARCH]`** §1.2's
reference class has no z-axis: a document's authority comes from its apparatus,
and a specification that needed a drop shadow to be taken seriously would be a
poor specification.

## 9.3 Corners and borders

`[VD]`
- **Corner radius: 0** for all containers, rules, and blocks.
- **2px** permitted on interactive controls only (the mobile navigation control,
  the dark-mode toggle) — the minimum that reads as affordance.
- **Borders: 1px, Rule, on one edge or four.** No 2px borders except the
  hover-state underline. No dashed, no dotted, no double.

Rounded corners are a softening device, and softening is the visual form of the
reassurance §1.4 prohibits.

## 9.4 Illustration

`[VD]` **Exactly one illustration is permitted in the entire product:** the
commitment lifecycle diagram, which **`[ARCH]`** §9.3 permits at H-03.

Its rules:
- **Line and type only.** 1px Rule strokes, Ink labels at structural-label size.
- **No colour, no fill, no icon, no elevation, no motion.**
- **No metaphor.** No vault, no padlock, no chain, no shield, no coin, no bridge,
  no globe, no abstract network. A metaphor is a claim about what the mechanic is
  *like*, and **`[SPEC]`** §17.1 forbids describing behaviour the specification
  does not contain — which a metaphor does by nature.
- **A labelled sequence, not a picture.** Each step named in words; the
  relationship between steps expressed by position and a plain connector.
- **`[ARCH]`** §10.4: an equivalent text sequence exists in the document at every
  viewport, not only in an `alt` attribute.
- **All steps visible simultaneously** (**`[ARCH]`** §4.3) — no stepper, no
  reveal.

## 9.5 Iconography

`[VD]` **The system contains one glyph: a small directional mark indicating that
a route leaves the site.** Nothing else.

No icon set is adopted. No icon accompanies a heading, a route, a status, a
navigation entry, a limitation, or a list item.

Derivation: an icon compresses meaning into a mark the reader must decode, and
**`[ARCH]`** Charter principle 5 requires complexity to be understandable rather
than invisible. Icons are also the fastest route back to sentiment — the
checkmark, the shield, the warning triangle — and §4.5 and §5.2 have already
excluded all three.

## 9.6 Photography

`[VD]` **None. Ever. On any page.**

There is nothing to photograph. There is no team page, no testimonial, no office,
no event (**`[ARCH]`** §9.6). Abstract or stock imagery would be pure atmosphere,
which §1.3 identifies as the one thing the page must not manufacture. A product
whose homepage carries no photograph is unusual, and the unusualness is a true
signal about the product rather than a stylistic pose.

## 9.7 Buttons

`[VD]` **The homepage has none.** Globally: a button exists only where a control
changes state, which on the public site is nowhere and in the Workspace is
common.

When one is required (Workspace surfaces), its treatment is defined here so it is
never invented: **Ink 1px border, Paper ground, Ink label at body size, 2px
radius, 12/20 padding.** No fill, no shadow, no gradient, no colour. Hover
thickens the border to 2px. **A destructive or irreversible action is not
coloured red** (§4.5); it is labelled with what it does.

## 9.8 Cards

`[VD]` **No cards on the homepage.**

**`[ARCH]`** §2.4 requires that no route be styled as recommended and that
routes be presented once, unranked. A grid of cards is a menu of parallel
options, and a menu invites comparison by appearance — which on a card grid means
comparison by whichever card has the most attractive content. The six routes in
H-06 are a **list**: text, one per line, in DOM order, at identical treatment.

Where a card-like grouping is genuinely required elsewhere in the product, it is
a **ruled block**: a hairline above, content beneath, no border on other edges,
no ground, no radius, no shadow.

## 9.9 Tables

`[VD]` **The workhorse of the reference layer, and the system's most important
component after the citation margin.**

- Column headers in structural-label type, Ink-quiet (chrome, §4.4), above a
  hairline.
- Rows separated by hairlines. **No zebra striping** — an alternating ground is a
  tint applied to alternate content and is one step from a tint applied to
  meaningful content.
- Tabular figures; numeric columns right-aligned; identifier columns in mono.
- **No status colour in any cell** (§4.5). Status is the word.
- **Wherever a price appears in a table, its source and update time occupy
  adjacent columns of equal weight** — **`[SPEC]`** VF-PUB-002, **`[ARCH]`**
  decision 19, and §5.3's dignity requirement.
- On narrow viewports a table becomes **stacked label/value pairs**, never a
  horizontally scrolling region, and never a truncated set of columns.

## 9.10 Disclosure panels and accordions

`[VD]` **Not present on the homepage, at any viewport, for any content.**

Globally: a disclosure control may never conceal
- a limitation or non-promise,
- an availability statement,
- a fee, an irreversibility, or a cost,
- anything a visitor needs in order to answer one of the four questions.

Which leaves it permitted only for **long reference material a reader is
navigating by choice** — a specification section list, a per-asset expansion in a
registry of a thousand entries. In those cases the control's label states what is
inside, and the panel is open by default when a reader arrives at it by anchor.

**Tooltips are excluded from the system entirely.** Content behind hover is
unavailable to touch, to keyboard in many implementations, and to anyone who does
not know to hover. **`[ARCH]`** §7.3 and §5.2 both apply.

## 9.11 Lists

`[VD]`
- Body type, 19/32, with 8px between items and 16px above and below the list.
- **Markers are a small Ink dash**, not a bullet, not a custom glyph, not an
  icon. Ordered lists use lining numerals followed by a period.
- **`[ARCH]`** §4.2 requires H-02's five non-promises to be a marked-up list so
  assistive technology announces the count. It is not compressed into prose at
  any viewport.
- No list is ever nested more than one level on a public page.

## 9.12 Code blocks, evidence strings, and specification references

`[VD]` **Evidence string (inline).** Mono at 0.92em, Ink, on Paper-recessed with
2px horizontal padding, no radius, no border. Selectable. Wraps; never clipped;
never inside a horizontally scrolling container.

**Code block.** Mono 15/24, Paper-recessed, hairline on all four edges, 16px
padding, wraps rather than scrolls. **No syntax colour** on the public site —
syntax highlighting is a colour semantic and §4.1 forbids colour semantics. If a
copy control is offered it is a text label, and **`[ARCH]`** §4.5 requires that
selectable text remain available beside it.

**Specification reference — the citation style.** This is a signature element and
it is fixed so that it is identical on every page of the product, forever:

> **`§12`** for a specification section · **`VF-IMM-006`** for a requirement ·
> **`§17.1 · VF-PUB-002`** where both are cited, separated by a middot.

Mono, citation size, Ink, no brackets, no parentheses, no "see", no "source:".
In the citation margin on Apparatus layouts; inline immediately after the claim
below it. **A reference is always a route** to the relevant surface, carrying the
standard underline (§8.1).

## 9.13 Status, loading, error and success states

`[VD]`

**Status indicators.** The word, in Ink, in body or citation type. **No dot, no
pill, no badge, no colour, no icon.** *verified* · *failed* · *pending* · *not
yet available*.

**Loading.** The homepage has none — it is static (**`[ARCH]`** §7.1). Globally:
**no skeleton shimmer** (motion, plus an implied claim that the arriving content
will match the placeholder's shape), **no spinner over content**. A loading state
is a line of text saying what is being fetched, in the same type as everything
else.

**Error.** Body type, Ink, no red, no icon, no box. States what happened and what
the reader can do. **`[ARCH]`** Errors do not apologise and are never vague.
Where an error means evidence is unavailable, **`[SPEC]`** VF-EXT-002's treatment
applies (§5.4) rather than an error treatment.

**Success.** Body type, Ink, no green, no checkmark, no animation, no
celebration. A completed action is reported in the same voice as a failed one.
**`[ARCH]`** Charter principle 4: confidence emerges from verification, not from
the product congratulating the participant.

**Verification widgets.** Anywhere the product displays the result of a check:
**it displays the inputs and the result, never a verdict.** No green tick, no
"✓ Verified" chip, no trust score. The permitted form is a labelled pair — the
published value and the observed value, in mono, adjacent — leaving the
comparison to the reader. **A widget that concludes on the reader's behalf has
made them dependent on it**, which is **`[ARCH]`** the North Star inverted.

---

# Part 10 · Motion philosophy

## 10.1 When nothing moves

`[VD]` **Stillness is the default state of every Vinculum page.**

**`[ARCH]`** §4.1 and §4.3 forbid animation, reveal-on-scroll, typewriter
effects, parallax, autoplaying media, carousels, steppers and sequential
reveals — region by region, throughout the frozen specification.

The generalisation: **motion on this page would have to be motion in service of
attention, because there is no state to transition between.** The page is static
text with no client state (**`[ARCH]`** §7.1). Any animation added to it is, by
elimination, decorative — and decoration that moves is the strongest attention
device available, deployed by a product that has forsworn attention devices.

## 10.2 When something moves

`[VD]` **Three permitted movements. Each is feedback for an action the visitor
took, and none exceeds 120ms.**

| Movement | Duration | Easing |
|---|---|---|
| Link underline thickening on hover | 90ms | linear |
| Focus indicator appearing | 0ms — instant | — |
| Mobile navigation panel opening/closing | 120ms | ease-out |

Nothing else. No page transitions, no anchor smooth-scroll, no fade on load, no
hover lift, no colour transitions, no staggered anything.

## 10.3 Transition timing and purpose

`[VD]` A transition exists to make a state change legible — to show that the
thing the visitor just touched is the thing that changed. It never exists to make
an arrival feel considered.

**Test:** if a movement would still be there when no one had interacted, it is
decoration and is excluded.

## 10.4 Reduced motion

`[VD]` `prefers-reduced-motion: reduce` removes all three permitted movements,
including the panel transition, which becomes instantaneous. **No information
depends on motion**, so nothing is lost — which is the correct relationship and
is only achievable because §10.1 is the default.

---

# Part 11 · Inheritance from the existing build

`[VD]` The current vinculum-web build predates the frozen architecture. Recorded
here rather than left to be discovered, so that the transition is a decision
rather than a drift.

## 11.1 What is inherited

**The warm near-white ground.** `#FAFAF8` carries forward unchanged as **Paper**.
It is the right ground for a document, it is already the product's, and continuity
costs nothing.

**The restraint.** The existing build's instinct — light weights, generous space,
no chrome — is compatible in spirit. What changes is its purpose: the same
quietness, redirected from atmosphere to apparatus.

## 11.2 What must be retired, and why

Each conflicts with a frozen requirement rather than with a preference.

| Element | Conflict |
|---|---|
| **Animated orbs** | **`[ARCH]`** §4.1: no animation, no parallax, no autoplaying media. Ambient motion is atmosphere, which §1.3 identifies as manufactured feeling. |
| **Custom cursor** | A custom cursor is an attention device with an accessibility cost and no informational content. §10.1. |
| **IntersectionObserver scroll-reveal** | **`[ARCH]`** §4.1 and §4.3 forbid reveal-on-scroll explicitly. It also breaks **`[ARCH]`** §10.5's ordering test — content not yet revealed has no position in visual order — and it fails **`[ARCH]`** §10.7's JavaScript-unavailable requirement. |
| **Hero gradient** | **`[ARCH]`** §3.3: the page has no above-the-fold optimisation. §9.2: no gradient. A hero is a statement of offer in the first viewport, which OC-1 forbids. |
| **Cormorant Garamond 300 headings** | A display serif at 300 is a tone device, and its stroke contrast at heading weight grades headings as *refined* — sentiment encoded in a typeface. §3.2 excludes high-contrast display serifs by name. The 300 weight also sits below comfortable rendering contrast at small sizes. |
| **DM Sans body** | The two-family scheme is **serif for prose, mono for checkable** (§3.1). A sans body face would leave no register for evidence without introducing a third family, and would make the page read as an interface rather than a document. |

## 11.3 The migration is not urgent, and the order matters

`[VD]` The retirements are ranked by how much each one contradicts the
architecture, so that partial migration still improves faithfulness:

1. **Scroll-reveal** — it breaks a testable requirement (§10.5) and a
   functional one (JavaScript-unavailable), not only an aesthetic one.
2. **Animated orbs and custom cursor** — ambient motion, directly excluded.
3. **Hero gradient and hero structure** — requires the homepage restructure
   anyway, so it lands with the content work.
4. **Typography** — the largest visible change and the least urgent; the page can
   be architecturally faithful in Cormorant and DM Sans while looking like a
   different product than it should.

**The honest cost of item 4** is that it changes the site's recognisable
appearance after launch. That is a real cost and it is the operator's call, not
this document's. What this document records is that the current pairing serves a
philosophy the product has since replaced.

---

# Part 12 · Governing visual principles

`[VD]` Eight, one per Charter principle, in the Charter's order. **Every future
Vinculum page inherits these.** Everything else in this document is their
application to one surface.

## 1 · The page informs. The reader ranks.
Position and order carry the hierarchy the architecture defined; the visual
system adds none of its own. Nothing is styled to be chosen.
*From Charter principle 1.*

## 2 · Space separates arguments, never creates atmosphere.
Every gap is proportional to a break in the reasoning. No element is given room
because it deserves admiration.
*From Charter principle 2.*

## 3 · Two families, two jobs.
The serif states. The monospace is checkable. Family is the only typographic
dimension permitted to carry meaning, and the meaning it carries is a kind, not a
value.
*From Charter principle 3.*

## 4 · Evidence is emphasised by proximity to its source, never by weight.
The citation sits level with the claim. The source sits beside the figure.
Nothing is made larger to seem more true.
*From Charter principle 4.*

## 5 · Nothing is behind an interaction.
No accordion, no tooltip, no hover-revealed content, no collapsed limitation.
Complexity is sequenced, never concealed — and a thing one gesture away is
concealed from whoever does not make the gesture.
*From Charter principle 5.*

## 6 · One plane.
No elevation, no shadow, no glass, no gradient. Separation by rule and space.
Depth is a hierarchy asserted in a dimension the reader cannot check.
*From Charter principle 6.*

## 7 · Emphasis encodes structure, never sentiment.
Size, weight, colour and position may say *heading*, *group*, *route*. They may
never say *good part* or *fine print*. The design system contains no alert, no
callout, no disclaimer style, and no red or green.
*From Charter principle 7 — and this is the one that, if broken, breaks all the
others.*

## 8 · The page looks subordinate to the document it cites.
Nothing is set at display size. Nothing floats. Nothing moves. The apparatus is
visible and the presentation is not, because a more authoritative description is
preserved and available.
*From Charter principle 8 and PRC-01.*

---

# Part 13 · Review instrument

`[VD]` Applied to any Vinculum page before it ships. Each question restates a
constraint above and introduces nothing.

1. Can a visitor tell, from styling alone, which route the operator prefers?
2. Is any limitation set smaller, lighter, later, boxed, tinted, italicised,
   iconed, or collapsed relative to a capability?
3. Does any colour carry meaning that the text does not also carry?
4. Is there red, green, or amber anywhere?
5. Does anything move that was not touched?
6. Is anything the visitor needs behind a hover, a tap, or a scroll position?
7. Does any element cast a shadow, blur a background, or sit on a gradient?
8. Is monospace on anything the visitor could not check?
9. Does any rule sit anywhere other than above a group it binds?
10. Is any content set in Ink-quiet?
11. Does a widget conclude on the reader's behalf?
12. Would this page look like a document if the copy were replaced with lorem
    ipsum — or would it look like a landing page?

**Question 12 is the summary test.** A landing page is recognisable by its
structure alone: hero, benefits, social proof, call to action. If the shape
survives the removal of the words, the shape is doing persuasion the words were
forbidden from doing.

---

# Revision policy

**Revise when:** the Homepage Product Specification or an accepted artifact is
revised · a token proves inaccessible in measured use · a device on a prohibited
list is shown to be required by a frozen requirement · a face becomes
unavailable.

**Do not revise to:** add a component because a page seems to need one · admit a
colour semantic for convenience · introduce motion because the page feels static
· soften a limitation's treatment · match a convention because other sites use
it.

**Corrections are recorded visibly.** **Version numbers are whole integers.**

---

*Derived from Homepage Product Specification v1 and the ten accepted baseline
artifacts, governed by Master Specification Revision 6, hash
`5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9`. Region
labels H-01–H-07 and ordering constraints OC-1–OC-6 originate in the Homepage
Product Specification and are used without modification. All token values,
typeface selections, scales and component rules in this document are `[VD]` and
carry no specification authority. Attribution: Vinculum Protocol DAO LLC.*
