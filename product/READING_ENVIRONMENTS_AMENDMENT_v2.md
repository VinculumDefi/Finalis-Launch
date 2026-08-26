# Reading Environments — Amendment Record

**Version:** 2
**Status:** **Determined by the operator. Active.**
**Phase:** Product Design — amendment to accepted artifacts
**Supersedes:** Reading Environments Amendment Record v1 (proposed)
**Amends:** Homepage Product Specification v1 · Homepage Visual Design
Specification v1 · Homepage Copy Specification v1 · Homepage Implementation
Specification v1
**Governed by:** Master Specification Revision 6, hash
`5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9`
**Upstream authority:** *Independent Product Architecture Review — Appearance
Preferences (Reading Environment)*, conditionally accepted, seven binding
constraints

> **Amendment record. It changes named sections of four accepted documents and
> nothing else.** It introduces no architectural layer, no page, and no protocol
> behaviour. Where it conflicts with an accepted artifact other than in the
> sections it names, **the accepted artifact prevails and this document is
> defective.**

---

# Part 1 · Determination record

**Recorded visibly rather than applied silently**, in the manner Map A v2's
corrections table established.

## 1.1 The determination

**The operator has determined that Warm Paper is activated in the initial
implementation**, and with it the bounded storage exception at §6.

**Stated grounds:** Warm Paper satisfies the admitted reading-condition criteria;
it preserves every architectural constraint; it introduces no additional visual
semantics; and it materially improves long-form readability for some
participants. **The bounded storage exception remains limited exclusively to
Reading Environment selection and does not generalise to any other client-side
state.**

## 1.2 What this supersedes

**v1 §6.5 recommended specifying the exception and deferring its activation.**
That recommendation is superseded. The reasoning behind it was arithmetic —
three of four environments arrive free on operating-system signals, so the
exception buys one environment at the cost of the product's first client-side
write — and the operator has weighed that trade and determined otherwise, on
grounds the admission tests support.

**The recommendation is recorded rather than deleted**, so that a future reader
can see the trade that was made and by whom. A decision that leaves no trace of
its alternative is harder to revisit when evidence changes.

## 1.3 What the determination does not change

The determination activates an exception. **It does not relax one.** Every
constraint in this record applies with full force from the initial
implementation:

- The uniformity test (§2.3) and the admission test (§3.3).
- The non-generalisation clause (§6.2), which the operator has restated
  explicitly and which is now doubly recorded.
- The homepage's exclusion from carrying a selector (§5, §9.4).
- The rejection of Cool Paper and Reading Lamp (§4.6, §4.7).
- The four-environment ceiling, which is **`[REVIEW]`** binding constraint 7 plus
  one admitted optional variant, and which is now **spent**. A fifth environment
  requires a new review, not a determination.

## 1.4 One consequence the determination surfaces

Activation makes the selector a launch artifact rather than a future one, and the
selector has no specified home in the initial release. **Part 8 states the
finding and the resolution.** It is the only open question this determination
creates, and it is a sequencing question rather than an architectural one.

## 1.5 Markings

`[SPEC]` · `[ARCH]` · `[VISUAL]` · `[COPY]` · `[IMPL]` · `[REVIEW]` for the
accepted panel review · `[AMEND]` for a decision made in this record ·
`[DETERMINED]` for the operator determination at §1.1 and its direct
consequences.

---

# Part 2 · The governing principle

## 2.1 The principle

`[AMEND]` **Governing constraint for the feature, in all four amended
documents:**

> **Reading Environments exist solely to change the optical conditions under
> which the participant reads. They never change the information being
> presented, its hierarchy, its relationships, or its meaning.**

It is a better boundary than a count of permitted environments, because a count
is arbitrary and invites the argument *why not one more*, while a condition is a
category and answers it. It converges with what **`[REVIEW]`** binding constraint
2 already required — ground and ink token substitution only — and supplies the
reason that constraint is right rather than merely restrictive.

## 2.2 Why the principle needs a test

`[AMEND]` As stated it is an intention, and every future proposal will claim to
satisfy it sincerely. A designer adding a fifth environment will say it changes
only optical conditions. A designer lightening a limitation's colour in Night
will say the same, and will be wrong in a way the sentence does not catch.

## 2.3 The uniformity test — binding

`[AMEND]`

> **A Reading Environment substitutes the values of the eight design tokens and
> nothing else. The substitution is uniform: every element bound to a token in
> the canonical environment is bound to the same token in every environment.**

Three mechanically verifiable properties follow.

**No element changes its token.** A paragraph using `ink` in Paper uses `ink` in
Night, in High Contrast and in Warm Paper. No environment may move a limitation
from `ink` to `ink-quiet`, move chrome from `ink-quiet` to `ink`, or introduce a
binding that does not exist in Paper. **Test A-20.**

**No token name is added.** The set at **`[VISUAL]`** §5.4 is closed: `paper`,
`paper-recessed`, `ink`, `ink-quiet`, `rule`, `rule-structural`, `route`,
`route-visited`. An environment needing a ninth token is not an optical
condition; it is a design.

**Nothing outside colour varies.** Type family, size, weight, tracking, line
height, measure, spacing, DOM, copy, routes, citations and ordering are
byte-identical across environments. **Test A-19.**

## 2.4 What the test permits

`[AMEND]` Recorded because the premise behind this amendment — that restraint was
being confused with minimalism — is correct and worth honouring precisely.

The test permits **High Contrast**, which a minimalist reading would have
resisted and which **`[REVIEW]`** finding 4 identifies as *closer to an
accessibility requirement than a preference*. It permits **Warm Paper** on its
low-blue condition. It permits a future environment justified by a reading
condition nobody has raised yet.

It forbids what should be forbidden, by mechanism rather than taste: an accent
colour fails because it needs a ninth token; a softer Night fails because it
rebinds limitation text; a mood variant fails because it cannot name a reading
condition.

---

# Part 3 · Accessibility, not personalization

## 3.1 The statement — normative

`[AMEND]`

> **Reading Environments are accessibility accommodations, readability
> accommodations, and long-form reading accommodations.**
>
> **They are not themes, branding, personalization, self-expression, or product
> customization.**

**`[REVIEW]`** binding constraint 1 requires the feature to be framed and tested
as an accommodation. This makes the framing explicit rather than implied.

## 3.2 Naming

`[AMEND]` **Reading Environment**, per **`[REVIEW]`**'s naming recommendation,
without variation. **The word *theme* is prohibited** in code, in copy, in token
names, in class names, in attribute values, in commit messages and in the
selector. A CSS class named `theme-night` is the drift the review warned about,
arriving through the source rather than through the interface.

## 3.3 The admission test — binding

`[AMEND]` A statement of category does not prevent a fifth environment.
**`[REVIEW]`** finding 6 names the risk: *once a preference system exists,
pressure will grow to add more options.*

**An environment is admitted only if all four hold:**

1. **It names a reading condition, not an appearance.** The condition must be
   stateable as a property of the reader's circumstance — ambient light, contrast
   need, light sensitivity — not as a property of the result.
2. **The condition is not already served by an admitted environment.** Two
   environments serving one condition are two aesthetics.
3. **It passes the uniformity test at §2.3.**
4. **Its name is the condition or the ground, never an object, a mood or a
   place.** *Night* and *High contrast* name conditions. *Reading Lamp*,
   *Midnight*, *Sepia*, *Focus*, *Calm* name atmospheres, and a name describing
   how a page feels is a claim about feeling — the manufactured emotion
   **`[VISUAL]`** §1.4 excludes.

**The four-environment set is now closed.** §1.3.

## 3.4 The selector is bound by the same statement

`[AMEND]` A control can reintroduce personalization that the environments
themselves avoid. Part 7 specifies the selector in full; the governing rules are:

- **Named in text, listed vertically, in the surface's own type.** No colour
  swatches, no thumbnails, no live-preview tiles. **A swatch grid is a theme
  picker regardless of what the options are called.**
- **Footer chrome**, at `ink-quiet`.
- **No emphasis on the current selection beyond a plain textual indication.**
- **Never announced, never onboarded, never badged as new, never linked from
  prose.**

---

# Part 4 · The admitted set

**Four environments, all active in the initial implementation.**
`[DETERMINED]` for Warm Paper; `[AMEND]` for the other three.

## 4.1 Paper — canonical default

**Condition:** ordinary reading, ordinary light.
**Reached by:** default, and by explicit selection.

| Token | Value |
|---|---|
| `paper` | `#FAFAF8` |
| `paper-recessed` | `#F2F1EC` |
| `ink` | `#191814` |
| `ink-quiet` | `#5C594F` |
| `rule` | `#D9D6CC` |
| `rule-structural` | `#191814` |
| `route` | `#2E3159` |
| `route-visited` | `#4A4560` |

Unchanged from **`[VISUAL]`** §4.2.

## 4.2 Night

**Condition:** low ambient light — reading at night, in a dark room, where a
bright ground is itself the source of strain.
**Reached by:** `prefers-color-scheme: dark`, or explicit selection.

| Token | Value |
|---|---|
| `paper` | `#141310` |
| `paper-recessed` | `#1C1B17` |
| `ink` | `#E9E6DD` |
| `ink-quiet` | `#96917F` |
| `rule` | `#33312A` |
| `rule-structural` | `#E9E6DD` |
| `route` | `#A8AEDC` |
| `route-visited` | `#BFB6D0` |

**This is a rename of the accepted dark appearance, not a new environment.** No
value moves. **`[VISUAL]`** §4.3's binding rules carry over intact: not an
inversion; ink is not pure white on pure black; no glow, no elevated surface, no
coloured ambient light. **`[REVIEW]`** finding 3 applies here more than anywhere
— *Night mode in particular can easily tip into atmospheric or cinematic
territory.*

## 4.3 High contrast

**Condition:** reduced acuity, low-contrast sensitivity, glare, bright ambient
light.
**Justification:** **`[REVIEW]`** finding 4 — closer to a requirement than a
preference.
**Reached by:** `prefers-contrast: more`, or explicit selection.

| Token | Value |
|---|---|
| `paper` | `#FFFFFF` |
| `paper-recessed` | `#FFFFFF` (edge carried by the hairline) |
| `ink` | `#000000` |
| `ink-quiet` | `#000000` |
| `rule` | `#000000` |
| `rule-structural` | `#000000` |
| `route` | `#0000CC` |
| `route-visited` | `#551A8B` |

**`ink-quiet` equals `ink` here, and that is correct.** `ink-quiet` exists to keep
chrome from competing with content; in an environment whose purpose is maximum
separation from ground, a de-emphasised chrome value works against the reader it
serves. **`[VISUAL]`** §4.4's rule — content never uses `ink-quiet` — is
unaffected, because the constraint is on binding, not on value.

**Contrast targets:** body text ≥ **7:1** (WCAG 1.4.6, AAA); non-text and focus
indicators ≥ 4.5:1.

**Achieved by colour value alone.** Not by weight, not by size, not by added
borders. **`[VISUAL]`** §3.5's scale ratios are the deliberate risk the visual
system rests on, and an environment that thickened type to gain legibility would
change the one thing §2.3 forbids changing.

## 4.4 Warm paper — `[DETERMINED]`

**Condition:** light sensitivity and photophobia; extended sessions where
short-wavelength emission is the reported source of strain.

**Definition, binding:** **Warm paper is a low-blue environment.** Its values are
constrained by a measurable optical property — reduced short-wavelength output
relative to Paper — not by a hue preference. **The name describes the ground; the
definition describes the condition.**

| Token | Value |
|---|---|
| `paper` | `#FBF6EA` |
| `paper-recessed` | `#F4EEDE` |
| `ink` | `#1C1813` |
| `ink-quiet` | `#5E5949` |
| `rule` | `#DED5BF` |
| `rule-structural` | `#1C1813` |
| `route` | `#2F3156` |
| `route-visited` | `#4B4459` |

**All Paper contrast targets are met or exceeded.** `ink` on `paper` measures
above Paper's own ratio, so Warm paper is not a legibility trade — it is a
spectral one.

**Reached by explicit selection only.** No operating-system signal exists for
low-blue preference, which is why activation required §6's exception and why the
determination at §1.1 was necessary rather than optional.

## 4.5 Precedence

`[AMEND]` Where signals and selection conflict:

1. **An explicit selection wins over everything.** It is the most direct
   statement available.
2. **`prefers-contrast: more` wins over `prefers-color-scheme: dark`.** A reader
   who has asked their system for more contrast has stated a *need*; a reader
   whose system reports dark preference has stated a *condition*. **A need
   outranks a condition.**
3. **Otherwise Paper.**

## 4.6 Cool paper — not admitted

Fails admission test 1. *Cool* names an appearance, and no reading condition
survives the question: low ambient light is Night's, contrast need is High
contrast's, light sensitivity is Warm paper's — and the accommodation for it is
reduced blue, not increased.

**The counterargument, recorded at its strongest.** Readers with visual stress or
Irlen-type symptoms report benefit from coloured overlays, and for some the
beneficial tint is cool. That is documented accommodation, not preference.

**Why it does not carry.** The evidence supports a *spectrum* of tints selected
per individual, because the finding itself is that the optimum varies. Admitting
one cool option serves only the fraction whose optimum lands near it, while
admitting the principle that tints are chosen to suit the individual — which is
personalization, and is what §3.1 states the feature is not. **If visual-stress
accommodation is pursued later, its architecturally honest form is a documented
accessibility feature with its own justification and its own review, not a fifth
entry on this list.**

## 4.7 Reading Lamp — not admitted

Fails test 4 on its name and test 2 on its condition. It names an object and
through it an atmosphere — the clearest instance of **`[REVIEW]`** finding 3's
cinematic warning and of **`[VISUAL]`** §1.4's prohibition on manufactured
warmth. Its condition decomposes into low ambient light (Night) and low blue
(Warm paper), both served.

**A warm Night as an orthogonal modifier is recorded and not recommended:**
modifiers multiply combinations, a combinatorial set cannot be enumerated in a
specification, and an unenumerable set is personalization by construction.

---

# Part 5 · Homepage scope

## 5.1 The resolution

`[AMEND]`

1. **Paper remains the homepage's canonical default presentation.**
2. **The homepage honours Night and High contrast from operating-system
   signals**, always, with no control and no stored state. This requires no
   exception and no script.
3. **The homepage honours a stored Reading Environment**, including Warm paper.
   Honouring is a read, authorised by §6.2.
4. **The homepage carries no selector.** **`[REVIEW]`**'s preferred scope holds:
   the selector lives on long-form and reference surfaces.
5. **The homepage never mentions, advertises, links to, onboards or badges the
   feature.**

## 5.2 Why the homepage carries no selector, given that this is an accommodation

The objection deserves a direct answer: an accessibility control absent from the
entry page could fail a reader who needs it and lands there first.

It does not, because **every environment the homepage can deliver without a
selector is delivered without a selector.** A reader with a contrast or
low-light need receives the accommodation automatically from their own system
settings. The only environment a selector would add on the homepage is Warm
paper, on a 608-word page. **`[ARCH]`** §7.1's no-controls property and
**`[REVIEW]`**'s finding that homepage benefit is low both hold, and **no reader
is denied an accommodation by their holding** — only deferred to the first
long-form surface, where the accommodation is worth most.

## 5.3 Continuity

`[AMEND]` A reader who selects an environment on a reference surface and then
follows a route to the homepage **must not be returned to Paper.** Being reset by
the product is the product overriding an accessibility decision the participant
made, which **`[ARCH]`** Charter principle 1 does not permit.

**Continuity is honouring, not offering.** The homepage renders in the stored
environment and says nothing about it.

---

# Part 6 · The storage exception — active

## 6.1 Status

`[DETERMINED]` **§7.1a is active from the initial implementation.**

## 6.2 Amendment text — verbatim, for Homepage Product Specification §7.1

> **§7.1a · Reading Environment exception.**
>
> §7.1's prohibition on client-side writes is amended to permit exactly one
> write and exactly one read, both bounded as follows.
>
> **The write.** A public surface that presents the Reading Environment selector
> may store, on the participant's device, a single value identifying the selected
> Reading Environment. The value is drawn from the enumerated environment set and
> may take no other form.
>
> **The read.** Any public surface may read that value in order to render in the
> selected environment. Reading it is permitted on surfaces that do not present
> the selector, including the homepage.
>
> **What the value may affect.** The value may determine the applied colour token
> values and nothing else. It may not affect the document structure, the content,
> the copy, the ordering of any region, the presence or destination of any route,
> the type scale, the spacing, or any other property. **Two participants in
> different Reading Environments receive byte-identical documents.**
>
> **What the value may never do.** It is never transmitted, synchronized,
> uploaded, logged, or read by any process other than presentation. It is never
> used as an identifier, as a fingerprinting input, as an analytics dimension, or
> as a means of recognising a returning visitor. It never varies what any
> participant is told.
>
> **Absence is normal.** No value is written unless the participant makes a
> selection. Its absence is not an error, is never repaired, and resolves under
> §4.5's precedence. The participant may clear it through ordinary browser
> controls or by selecting *Follow device settings*, and the product neither
> detects nor responds to its removal.
>
> **This exception does not generalise.** It authorises no other write, no other
> read of stored state, and no storage of any other preference, setting,
> dismissal, visit count, or state of any kind. **A future proposal citing this
> exception as precedent is citing it wrongly.**

## 6.3 Why the last clause is load-bearing

`[AMEND]` **`[REVIEW]`** finding 6: *any exception must be narrow, explicitly
justified, and hard to expand.* **`[ARCH]`** §8.6 names the same risk in the form
it arrives: *the risk is not that someone decides to make the product
indispensable. It is that someone makes it slightly more helpful, eleven times.*

The first write is the expensive one, because after it exists every later
proposal argues from precedent rather than principle: *we already store the
reading environment, so storing the dismissed-notice flag is the same class of
thing.* **The non-generalisation clause makes that argument fail on its face**,
and it is why the exception is written as a numbered sub-section rather than as a
relaxation of §7.1.

The operator's determination restates this limit independently. **It is now
recorded twice, in two documents, by two authorities.**

## 6.4 Storage contract

`[IMPL]` `[AMEND]`

| Property | Contract |
|---|---|
| Keys written | **Exactly one** |
| Value domain | `paper` · `night` · `high-contrast` · `warm-paper` — nothing else |
| Written when | Only on explicit selection of one of the four |
| Removed when | *Follow device settings* is selected — **the key is deleted, not overwritten with a sentinel** |
| Written on first visit | **Never** |
| Transmitted | Never. No request carries it, including as a header, a query parameter, or a beacon |
| Readable by | Presentation only |
| Malformed or unknown value | Treated as absent; **not** repaired, **not** overwritten |

**The deletion behaviour is deliberate.** Selecting *Follow device settings*
returns the participant to a state with **no stored value at all** — the product
provides a route back to zero client-side state from inside the product, without
requiring browser-level intervention.

---

# Part 7 · The Reading Environment selector

**New specification, required by the determination.** The selector is now a
launch artifact.

## 7.1 Where it appears

`[AMEND]` **Footer chrome, on public surfaces designated as long-form or
reference.** Not on the homepage (§5.1). Not in primary navigation. Not floating,
not sticky, not in a corner, not in a drawer.

## 7.2 Canonical copy

`[COPY]` **Verbatim. Amends Homepage Copy Specification §3.4.**

| ID | String |
|---|---|
| **X-5** · group label | `Reading environment` |
| **X-6** · option | `Follow device settings` |
| **X-7** · option | `Paper` |
| **X-8** · option | `Night` |
| **X-9** · option | `High contrast` |
| **X-10** · option | `Warm paper` |

**X-4 is retired.** Copy Specification §3.4's appearance-control strings (*Use
dark appearance* / *Use light appearance*) are superseded by X-5 through X-10 and
are removed at Copy Specification v2. Recorded rather than deleted silently.

**Option order is fixed as listed** — device settings first, then the four
environments in the order Paper, Night, High contrast, Warm paper. **The order is
not a ranking**; it runs from the least explicit statement to the most specific
condition, and it never changes based on what is selected.

**No description text accompanies any option.** No *recommended*, no *best for
night reading*, no *reduces eye strain*, no explanatory sentence beneath the
group. A description would be the product recommending a reading condition,
which is a decision **`[ARCH]`** Charter principle 6 leaves with the participant.
The condition each name denotes is the name.

## 7.3 Form and states

`[IMPL]` `[AMEND]`

- **A radio group.** Five mutually exclusive options, **all visible
  simultaneously.** Not a dropdown, not a cycle button, not a toggle. A dropdown
  places options behind an interaction, which is the concealment
  **`[ARCH]`** §4.2 reasons against; a cycle button hides the option set
  entirely.
- **States:** unselected · selected · focused. **Nothing else.** No hover
  preview, no disabled state, no loading state, no transition.
- **The current selection is indicated by the radio's native selected state and
  nothing more.** No bold label, no colour, no checkmark, no *(current)* suffix.
- **Selection applies immediately.** No apply button, no confirmation, no toast.
  Applying is not a state change worth announcing; the page simply is in the new
  environment.
- **No motion on application.** The environment changes between frames. A
  cross-fade would be motion **`[VISUAL]`** §10.1 excludes, and would also draw
  attention to a chrome control.

## 7.4 Accessibility

`[IMPL]` `[AMEND]`

- Rendered as a `fieldset` with a `legend` carrying X-5. Native radio semantics;
  **no ARIA replacing them.**
- Arrow-key navigation within the group and a single tab stop, per native radio
  behaviour.
- Focus indicator per **`[VISUAL]`** §10.7 — 2px solid, offset 2px, no glow, no
  transition.
- Target size ≥ 24×24 CSS px with adequate spacing (WCAG 2.5.8).
- **The change is not announced to assistive technology.** No live region. A
  radio's own selected state is the announcement, and an added announcement would
  be the product narrating a change the participant made deliberately.
- **Labels are the visible text**, never `aria-label` — a second copy of a
  canonical string is a copy that will drift.

## 7.5 Progressive enhancement

`[IMPL]` `[AMEND]`

- **The selector is injected by script and is not present in the served HTML.**
  Without scripting it does not render, because a radio group that cannot apply
  its selection is a control that does nothing — worse than absent, and a
  violation of **`[VISUAL]`** §5.4's prohibition on rendering elements in a
  non-functional state.
- **Without scripting the participant receives the environment their
  operating-system signals select.** Night and High contrast remain fully
  available. Warm paper is unavailable, which is stated here rather than
  discovered: **it is the one accommodation in the set that depends on
  scripting**, and no operating-system signal exists that could provide it.
- **The stored value is applied by a synchronous inline script in `head`, before
  first paint**, setting a single attribute on the document element. **Inline,
  first-party, no external request, ≤ 1 KB.** Applied after paint it would produce
  a visible flash, which is motion.
- **`[IMPL]`** §6.5's contract is restated: with scripting disabled the page
  differs only by the absence of the copy control and the selector, and by
  resolving the environment from signals rather than from a stored value.
  **Every word, route, citation and structural property is identical.**

## 7.6 Budgets

`[IMPL]` `[AMEND]` Amends **`[IMPL]`** §7.1.

| Surface | JavaScript budget |
|---|---|
| Homepage | **≤ 3 KB** — inline application script, plus the optional copy control |
| Surfaces presenting the selector | **≤ 5 KB** — the above plus selector injection and its handler |

**Recorded as a specified change, not a breach.** **`[IMPL]`** §1.6 treats a
budget breach as a content review trigger; this is a budget revision with its
reason stated, which is the other thing §1.6 permits.

**CLS target remains 0.00.** The environment is applied before paint and changes
only colour. The selector is injected into footer chrome below the fold, in
reserved space.

---

# Part 8 · Sequencing finding

## 8.1 The finding

`[AMEND]` **The determination makes the selector a launch artifact, and the
selector has no specified home.**

The selector lives on long-form and reference surfaces (§7.1). **The homepage is
the only surface specified to implementation depth.** P-13 The Specification,
P-14 Commitment rules, P-15 Participation rules and P-16 Developer reference are
architecturally defined but have no product, visual, copy or implementation
specification yet.

**If the initial release is homepage-only, Warm paper is reachable from
nowhere.** Its tokens exist, its read path works, and no participant can select
it.

**This is a sequencing consequence, not an architectural defect.** Nothing in the
determination is wrong; the determination simply lands ahead of the surface that
carries its control.

## 8.2 Three resolutions

`[AMEND]` Stated so the operator chooses rather than discovers.

**A · Sequence P-13 into the initial release.** The specification page is the
longest-form surface in the product, is where a reading accommodation is worth
most, and is buildable now — the specification and its hash exist. **The selector
lands with the surface that most justifies it.** Recommended.

**B · Ship the homepage first; Warm paper is inert until P-13.** Paper, Night and
High contrast all work from day one on operating-system signals. Warm paper is
specified, tokenised, tested and unreachable until a selector surface ships.
**Nothing is broken and nothing is advertised**, so no participant encounters a
missing feature. Acceptable.

**C · Place the selector on the homepage.** **Not recommended.** It contradicts
§5.1, **`[REVIEW]`**'s preferred scope, and **`[ARCH]`** §7.1's property that the
homepage has no controls — to deliver one environment on a 608-word page. If
chosen it requires a further determination and a revision to §5, not an
implementation decision.

## 8.3 Recommendation

`[AMEND]` **A, with B as the fallback if release timing does not permit it.**
Either satisfies the determination; **C would spend an architectural property to
buy a small convenience**, which is the eleventh-helpfulness pattern
**`[ARCH]`** §8.6 names.

---

# Part 9 · Preserved constraints and scoping clarifications

## 9.1 What every environment preserves

`[AMEND]` Identical information hierarchy · register parity · typography scale
ratios · citation apparatus and its alignment behaviour · ordering constraints
OC-1 through OC-6 · protocol terminology · canonical copy byte-for-byte ·
semantic structure and DOM order · route set and destinations · spacing scale ·
measure · motion budget.

**Only the values of the eight colour tokens change.**

## 9.2 Clarification one — the dark-mode contrast band

**`[VISUAL]`** §4.3 requires dark-mode contrast ratios within 15% of their
light-mode equivalents, so that inverting the ground does not change the
relationship register parity protects. **High contrast exceeds this band by
design.**

`[AMEND]` **Scoped, not weakened:**

> The 15% band applies to Night, whose purpose is the same document under
> different light, and to Warm paper, whose purpose is a spectral shift at
> equivalent legibility. It does not apply to High contrast, whose purpose is
> greater separation between ink and ground. **In High contrast the relationship
> the band protects is preserved more strictly, not less: every content element
> resolves to a single ink value, so no differential between content classes can
> exist.**

Paper, Night and Warm paper preserve parity by proportion. High contrast
preserves it by identity.

## 9.3 Clarification two — colour semantics

`[AMEND]` **`[VISUAL]`** §4.1 and §4.5 unchanged, extended:

> A Reading Environment applies a uniform transformation to ground and ink. It
> introduces no hue carrying meaning, no status colour, and no differential hue
> between content classes. **A warm ground shift is a property of the ground, not
> a signal**, and no element's hue may differ from another's on the basis of what
> it says.

High contrast's `route` value (`#0000CC`) is the nearest approach to a
meaning-bearing hue. It survives because the underline carries the route
affordance independently (**`[VISUAL]`** §8.1), so colour remains redundant, and
because the value is chosen for contrast against white rather than for
connotation.

## 9.4 Clarification three — the homepage's no-controls property

`[AMEND]`

> The homepage presents no Reading Environment selector, in any DOM state, at
> any viewport, under any amendment. **`[IMPL]`** §12.2's resolution is narrowed
> only in that the homepage additionally honours `prefers-contrast: more` and
> reads a stored Reading Environment value. **The homepage never writes one and
> never offers one.**

---

# Part 10 · Changes to accepted documents

`[AMEND]` Exact, so each v2 can be produced mechanically.

## 10.1 Homepage Product Specification → v2

| Section | Change |
|---|---|
| **§7.1** | Append **§7.1a** verbatim from §6.2. **Active.** |
| **§9.6** | Add to exclusions: any mention, promotion, onboarding or route to Reading Environments on the homepage. |
| **§10.7** | Add: the page honours `prefers-contrast: more` in addition to `prefers-color-scheme`. |
| **§11.3** | Add question 13: *Does this addition store, read, or vary on any client-side state beyond §7.1a's single bounded value?* |
| **§13** | Add to what is not specified: the Reading Environment selector's host surfaces, pending §8. |

## 10.2 Homepage Visual Design Specification → v2

| Section | Change |
|---|---|
| **New §4.6 · Reading Environments** | §2.1, §2.3, §3.1, §3.3, and Part 4's four token tables and precedence rule. |
| **§4.3** | Retitle *dark appearance* to **Night**; values unchanged; apply §9.2's scoping. |
| **§4.5** | Extend with §9.3. |
| **Token set** | The eight names are fixed across all environments; an environment substitutes values only. |
| **§9.13** | The selector's states per §7.3 — three states, no others. |
| **Part 12, principle 7** | Add: *an environment that rebinds any element's token has encoded sentiment in an optical change.* |

## 10.3 Homepage Copy Specification → v2

| Section | Change |
|---|---|
| **§3.4** | Retire X-4. Add X-5 through X-10 verbatim from §7.2, with the fixed option order and the prohibition on description text. |
| **Part 5 vocabulary** | Add **theme** to the forbidden list, with §3.2 as its source. Add the four environment names to preferred terms as canonical product names. |
| **Part 7 traceability** | Index X-5 – X-10 as `[COPY]`, deriving from this record. |

## 10.4 Homepage Implementation Specification → v2

| Section | Change |
|---|---|
| **§2.10** | Amend per §9.4: no selector ever; honours signals; reads the stored value. |
| **§5.5** | Colour tokens resolve per Reading Environment; the environment is applied as a single attribute on the document element before first paint. |
| **§6.1** | Inventory: **two scripts on the homepage** — the inline application script (required) and the copy control (optional). Selector injection on surfaces that present it. |
| **§6.2** | Amend the storage prohibition to except §7.1a, quoting its bounds. |
| **§6.5** | Restate per §7.5. |
| **§7.1** | Budgets per §7.6. |
| **§8** | Add **C-17 Reading Environment selector** with §7.3's states and prohibited states. |
| **§12.2** | Mark **resolved and superseded**. The conflict it identified is closed by §6.2's bounded exception and the operator determination at §1.1. |
| **Part 10** | Add tests A-19 through A-23. |

---

# Part 11 · Acceptance tests

`[AMEND]` All automatable. **A-19 through A-22 run once per admitted
environment**, four times each.

**A-19 · Environment uniformity.** For each environment, collect computed styles
for every element in `header`, `main` and `footer`. Assert the set of (family,
size, weight, tracking, line-height, margin, padding) tuples is **identical to
Paper's**. Any non-colour difference fails.

**A-20 · Token binding stability.** For each environment, assert every element
resolves to the **same token name** as in Paper. An element bound to `ink` in
Paper and `ink-quiet` in Night fails. **This is the test that catches a softened
limitation.**

**A-21 · Per-environment parity and contrast.** Re-run **A-6** and **A-17** in
each environment. In High contrast assert body text ≥ 7:1. In every environment
assert no red, green or amber hue and no colour outside that environment's eight
values.

**A-22 · DOM invariance and copy integrity.** Assert the served and rendered DOM
is byte-identical in every environment and that **A-10** passes in each. A single
differing character fails.

**A-23 · Storage bounds.** Assert: at most one key is written; its value is a
member of the four-value domain; **nothing is written before a selection is
made**; selecting *Follow device settings* **deletes** the key rather than
storing a sentinel; no network request carries the value in any form; a malformed
value is treated as absent and is not repaired; and **the homepage writes nothing
under any interaction at any viewport.**

**A-24 · Selector conformance** *(surfaces presenting it).* Assert: five options,
all visible, in the fixed order; native radio semantics with no substituting
ARIA; no description text; no hover preview; no motion on application; the
selector is absent from the served HTML and absent with scripting disabled; and
**the selector is absent from the homepage in every rendering.**

---

# Part 12 · Summary

`[AMEND]`

**Active from the initial implementation:** four Reading Environments — Paper,
Night, High contrast, Warm paper; the uniformity and admission tests; §7.1a's
bounded storage exception; the selector on long-form and reference surfaces; the
homepage honouring all four while offering none; six new canonical strings; six
new acceptance tests; the three scoping clarifications.

**Open, and requiring an operator choice:** which surface carries the selector in
the initial release. §8, recommendation A.

**Not adopted, and now closed:** Cool paper; Reading Lamp; a homepage selector; a
modifier system; any fifth environment, which would require a new review rather
than a determination.

**Unchanged, and stated because this is the kind of feature that erodes things
quietly:** every word of canonical copy; every route; every ordering constraint;
the type scale and its ratios; the spacing scale; the citation apparatus;
register parity; the motion budget; the component inventory beyond one addition;
and the homepage's property of having no controls.

---

# Revision policy

**Revise when:** an accepted artifact is revised · §8's sequencing question is
determined · a participant need is evidenced that no admitted environment serves
· an admitted environment fails a test at Part 11.

**Do not revise to:** add an environment that cannot name an unserved reading
condition · rename an environment for feel · relax the uniformity test for a
particular surface · **generalise §7.1a's exception** · introduce a modifier
system · place a selector on the homepage · add description text to the selector.

**Corrections are recorded visibly.** **Version numbers are whole integers.**

---

*Amends Homepage Product Specification v1 §7.1, §9.6, §10.7, §11.3, §13; Homepage
Visual Design Specification v1 §4.3, §4.5, §9.13, token set and Part 12; Homepage
Copy Specification v1 §3.4, Part 5 and Part 7; Homepage Implementation
Specification v1 §2.10, §5.5, §6.1, §6.2, §6.5, §7.1, §8, §12.2 and Part 10.
Derived from the accepted Independent Product Architecture Review on Appearance
Preferences, the operator determination recorded at Part 1, and the eleven
accepted baseline artifacts, governed by Master Specification Revision 6, hash
`5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9`. Control
identifiers X-5–X-10, component identifier C-17 and test identifiers A-19–A-24
continue the sequences established in prior artifacts. Attribution: Vinculum
Protocol DAO LLC.*
