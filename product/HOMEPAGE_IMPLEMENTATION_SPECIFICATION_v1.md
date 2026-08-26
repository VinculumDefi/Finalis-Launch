# Homepage Implementation Specification

**Version:** 1
**Status:** Proposed for independent review
**Phase:** Product Design — implementation contract, Phase 1
**Surface:** S01 · P-01 · Home
**Derived from:** Homepage Product Specification v1, Homepage Visual Design
Specification v1, Homepage Copy Specification v1, and the ten accepted baseline
artifacts, governed by Master Specification Revision 6, hash
`5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9`

> **Implementation specification. It governs how one surface is built.** It
> introduces no product behaviour, no interaction, no content, and modifies no
> canonical copy. Where it conflicts with an accepted artifact, **the accepted
> artifact prevails and this document is defective.**

---

## Markings

| Marking | Meaning |
|---|---|
| `[SPEC]` | Master Specification Revision 6 |
| `[ARCH]` | Homepage Product Specification v1 or an earlier accepted architecture artifact |
| `[VISUAL]` | Homepage Visual Design Specification v1 |
| `[COPY]` | Homepage Copy Specification v1 |
| `[IMPL]` | An implementation decision made here, with its derivation stated |
| `[OPEN]` | Conditional on an unresolved product decision |

**Precedence, where two accepted documents differ:** Master Specification →
architecture artifacts → Homepage Product Specification → Copy Specification →
Visual Design Specification → this document. Three genuine conflicts were found
during this derivation and are recorded at Part 12 rather than silently resolved.

**No code appears in this document.** Contracts are stated as outcomes and
constraints. Element names appear where the requirement *is* the element —
`main`, `h1`, `nav` — because semantic HTML is a specification of meaning, not a
technology choice.

---

# Part 1 · Implementation philosophy

## 1.1 The governing sentence

`[IMPL]` **The homepage is a document that has been published, not an
application that has been deployed.**

**`[VISUAL]`** §1.1 fixes the visual thesis — *the site should look like it knows
it is not the authority.* Its implementation counterpart is that the artifact
delivered to the browser should be, as nearly as possible, **the document
itself**: markup that means what it says, with presentation applied on top and
nothing required to run before the content exists.

Every principle below is that sentence applied to one dimension.

## 1.2 Semantic correctness

`[IMPL]` **Every element is chosen for what it means, never for how it renders.**

Derivation: **`[ARCH]`** Charter principle 5 — complexity is made understandable,
not invisible. A page whose structure exists only in CSS has made its structure
invisible to every consumer that is not a rendering browser: assistive
technology, reader modes, print, translation tools, search indexers, and the
reader who disables styles.

Concretely: a heading is a heading because it heads a section, not because it is
large — **`[VISUAL]`** §3.5 makes headings barely larger than body text, so the
usual visual cue is deliberately absent and semantics carry the whole load. The
non-promises are a list because **`[ARCH]`** §4.2 requires assistive technology to
announce their count. The lifecycle is an ordered list because **`[ARCH]`** Map
A's step order is specification-stated.

## 1.3 Progressive enhancement and graceful degradation

`[IMPL]` **The page is complete before any enhancement is applied, and every
enhancement is removable without loss.**

**`[ARCH]`** §10.7 requires the page to be fully readable and navigable with
JavaScript unavailable, on the derivation that **`[ARCH]`** PEA §7.4 makes
verification *ungated by derivation, not by choice* — and the homepage carries
the routes to it.

The layering is fixed:

| Layer | Delivers | Removable? |
|---|---|---|
| **HTML alone** | All copy, all routes, correct order, correct semantics, the hash as selectable text | No — this is the page |
| **+ CSS** | Measure, register parity, the overbar, the citation margin, dark appearance | Yes. Without CSS the page reads correctly in DOM order |
| **+ fonts** | The specified faces | Yes. Fallback metrics prevent shift |
| **+ JavaScript** | One optional control (§6.3) | Yes. Nothing else depends on it |

**`[ARCH]`** §10.7 adds the diagnostic that makes this enforceable: *if it ever
becomes expensive to satisfy, that is evidence the page has acquired behaviour it
should not have.*

## 1.4 JavaScript philosophy

`[IMPL]` **The homepage requires zero JavaScript. One optional enhancement is
permitted. Everything else is prohibited.** Part 6 states the full inventory.

## 1.5 Accessibility philosophy

`[IMPL]` **Accessibility is a content-parity requirement, not an overlay.**

**`[ARCH]`** §10.4: no content is removed at any viewport; the page reflows, it
does not reduce. **`[IMPL]`** The same rule extended to modality: **no content is
removed for any consumer.** A limitation unavailable to a screen-reader user has
been concealed from that user, and **`[ARCH]`** Charter principle 7 does not have
a visual scope.

Target is **WCAG 2.2 Level AA**, with the two AAA additions **`[ARCH]`** §10.7
requires on Charter grounds (link purpose from link text alone; JavaScript-free
operation). Part 4 is the full specification.

## 1.6 Performance philosophy

`[IMPL]` **Performance is a diagnostic, not a target.**

**`[VISUAL]`** §10.9: the homepage is static text with no figures, no live data,
no client state and no motion; **it should be among the lightest pages on the
public internet, and if it is not, something has been added that the
specification excludes.**

So the budgets at Part 7 are not aspirations to be traded against features. **A
budget breach is a content review trigger**, and is routed to Homepage Product
Specification §11.3 rather than to an optimisation pass.

## 1.7 Maintainability

`[IMPL]` **The build must make an unfaithful change harder than a faithful one.**

Two consequences:

**Copy lives in one place, addressed by identifier.** Every string carries its
**`[COPY]`** Part 2 identifier in the source, so that a change to canonical copy
is a single traceable edit and an untraceable string is visible as an anomaly.

**The design system contains no component the specification excludes.** No alert,
no callout, no card, no badge, no tooltip, no disclaimer style, no status colour.
**`[VISUAL]`** §5.2: *if a design file contains one, it will eventually be used,
and the first thing it will be used on is H-02.* The same is true of a component
library. **Absence is the enforcement mechanism.**

## 1.8 Traceability

`[IMPL]` **Every implementation requirement in this document carries a marking,
and every `[IMPL]` marking carries a derivation.** Part 9 is the index. A
requirement that traces only to this document is a defect in this document.

---

# Part 2 · DOM architecture

## 2.1 Canonical document order

`[IMPL]` The order below is normative. **`[ARCH]`** §10.5 makes DOM order a
tested property, not an implementation detail.

```
document
├─ head
│   ├─ title                      D-1
│   ├─ meta description           D-2
│   ├─ meta viewport
│   └─ link: preloaded fonts, stylesheet
└─ body
    ├─ a  → skip link             D-3        (first focusable element)
    ├─ header  [banner]
    │   └─ nav  [navigation, named]
    │       └─ ul → li × 5        N-1 … N-5
    ├─ main  [main]  id=main
    │   ├─ section  id=identification
    │   │   ├─ h1                 H-01.0
    │   │   └─ p × 3              H-01.1 – H-01.3
    │   ├─ section  id=not-promised
    │   │   ├─ h2                 H-02.0
    │   │   ├─ ul → li × 3        H-02.1 – H-02.3   + citations
    │   │   └─ p                  H-02.4  route R-01
    │   ├─ section  id=what-the-protocol-does
    │   │   ├─ h2                 H-03.0
    │   │   ├─ p                  H-03.1
    │   │   ├─ ol → li × 5        H-03.2            + citation
    │   │   ├─ p × 3              H-03.3 – H-03.5   + citations
    │   │   └─ p                  H-03.6  routes R-02, R-03
    │   ├─ section  id=no-one-controls-this
    │   │   ├─ h2                 H-04.0
    │   │   └─ p × 4              H-04.1 – H-04.4   + citations
    │   ├─ section  id=what-you-can-check
    │   │   ├─ h2                 H-05.0
    │   │   ├─ p                  H-05.1
    │   │   ├─ dl                 H-05.2, H-05.4 – H-05.7
    │   │   │   └─ dt / dd pairs                    + citations
    │   │   └─ figure             H-05.3  hash block
    │   └─ section  id=where-to-go
    │       ├─ h2                 H-06.0
    │       └─ ul → li × 4        H-06.1  routes R-11 … R-14
    └─ footer  [contentinfo]
        ├─ p                      H-07.1
        ├─ nav  [navigation, named]
        │   └─ ul → li × 3        F-1 … F-3
        └─ p                      H-07.3
```

**Every element above exists for a stated reason. Nothing else appears.** A
wrapper element added purely for layout is permitted only where the layout model
at §5.2 cannot be satisfied without it, and carries no semantics.

## 2.2 Landmarks

`[IMPL]`

| Landmark | Element | Accessible name |
|---|---|---|
| `banner` | `header` | — |
| `navigation` (primary) | `nav` inside `header` | Named, distinguishing it from the other two |
| `main` | `main` | — |
| `navigation` (page routes) | not applicable — see below | — |
| `navigation` (footer) | `nav` inside `footer` | Named, distinguishing it |
| `contentinfo` | `footer` | — |

**Three navigation landmarks would be two too many.** **`[ARCH]`** §4.6 requires
H-06 to be *marked up as a navigation landmark distinct from the site's primary
navigation, with an accessible name distinguishing it.* This document implements
that requirement — H-06's route list is a named `nav` inside its `section` — and
records that the total is then three named navigation landmarks on a page with
fourteen routes. That is correct: a screen-reader user cycling landmarks reaches
*site navigation*, *where to go from here*, and *footer* as three distinct
destinations, which is what the three regions actually are.

**Landmark names are structural labels, not copy.** They are accessible names
only, never rendered, and are therefore `[IMPL]` rather than `[COPY]`. They must
name the region as **`[COPY]`** Part 2 names it.

## 2.3 Heading hierarchy

`[IMPL]`

| Level | Count | Content |
|---|---|---|
| `h1` | 1 | H-01.0 |
| `h2` | 6 | H-02.0 through H-07 — **see below** |
| `h3` | 0 | — |

**H-07 has no visible heading**, but a `contentinfo` landmark does not require
one. **`[ARCH]`** §10.7 requires *H-02 through H-07 are `h2`*; the footer's
landmark discharges the navigational requirement that heading would serve, and
adding a visually hidden `h2` reading "Footer" would be an invented string.
**Implemented as: five visible `h2` elements (H-02.0 through H-06.0), and no
heading in the footer.** Recorded at §12.3 as a departure from a literal reading.

**No heading level is skipped. No heading is used for sizing.** **`[VISUAL]`**
§3.5 makes all headings within 1.37× of body text, so the temptation to promote
a paragraph to a heading for weight does not arise — and if it arises, it is the
failure §1.2 describes.

**Critical constraint — H-04 carries no intervening heading.** **`[ARCH]`** §4.4:
*a screen-reader user must not be able to navigate past the cost by heading, and
a scanning sighted reader must not be able to either.* H-04.1 through H-04.4 are
four paragraphs under one `h2`. Introducing an `h3` before H-04.3 would satisfy
every other rule in this document and violate OC-3.

## 2.4 Citation structure

`[IMPL]` **This is the page's only structurally unusual construction and is
specified completely.**

**DOM contract.** A citation follows the claim it supports, inside the same block
container. Order is **claim → citation**, always.

**Grouping contract.** A claim is a **paragraph or a list**, not a sentence and
not a clause. Where **`[COPY]`** Part 2 assigns two citations to one block
(H-03.4's `§12 · VF-SUP-008`), they form **one citation entry**, separated by a
middot per **`[VISUAL]`** §9.12. **Where Part 2 assigns citations to distinct
list items (H-02.1 – H-02.3), each list item is a claim and carries its own
entry.**

**Visual contract.** At the Apparatus breakpoint the citation renders in the left
margin column, its first line baseline-aligned with the first line of its claim.
Below that breakpoint it renders inline, immediately after the claim's last
sentence, in the same paragraph flow.

**Alignment contract.** Baseline alignment, not top alignment. A citation is one
line; its claim may be six. The apparatus reads correctly only if the reference
sits level with the claim's opening line.

**Focus contract.** A citation is a route (**`[VISUAL]`** §9.12) and is
focusable. Its tab position is **after** its claim, matching DOM order. **This is
a documented exception to `[VISUAL]` §10.5 test 5** and is recorded at §12.1.

**Empty margins are rendered as empty.** **`[VISUAL]`** §2.2: a paragraph with no
specification source has an empty margin and the emptiness is information. No
placeholder, no dash, no "—".

## 2.5 Route implementation

`[IMPL]`

- **Every route is an anchor element.** There are no buttons on this page.
  **`[ARCH]`** §7.1: every call to action is a route and none changes state.
- **Link text is the full label from `[COPY]` Part 2**, verbatim, with no
  appended chevron, arrow, or icon.
- **No `title` attribute anywhere.** **`[COPY]`** §3.1.
- **No `target="_blank"`** on any route. Opening a new context is a decision made
  on the reader's behalf, which **`[ARCH]`** Charter principle 6 reserves to
  them; it is also a known accessibility hazard.
- **External routes** (F-3 Repository, and any explorer link elsewhere in the
  product) carry the single permitted glyph from **`[VISUAL]`** §9.5, marked
  `aria-hidden`, with the external destination stated in the link's accessible
  name.
- **No route is disabled.** Where a destination's evidence does not yet exist,
  **`[COPY]`** §3.6's availability wording applies to the *item*, and the route
  remains live and full-contrast. **`[ARCH]`** §9.5: greying out an unavailable
  route violates §4.4 and §10.7 simultaneously.

## 2.6 Workspace entry

`[IMPL]` **N-5, in the primary navigation list, in fifth position, after N-3
Verification.** A plain anchor with the label `Workspace`.

Implementation prohibitions, each from **`[ARCH]`** §5.6 and **`[VISUAL]`** §8.3:
no button element, no distinct class, no fill, no border, no accent, no arrow, no
tracking parameter, no wallet-state detection, no conditional rendering, and no
appearance anywhere in `main`.

**`[VISUAL]`** §8.3's review test is implementable as a code review question: **if
the Workspace anchor's rendered styles differ in any property from N-1's, the
implementation is defective.**

## 2.7 Verification routes

`[IMPL]` Six routes reach verification material: N-3, R-04 and R-05 inline in
H-04.4, and R-06 through R-09 in H-05, plus R-10 conditionally.

**Ordering requirement, tested:** every one of them precedes the first route to a
participation surface in DOM order. **`[ARCH]`** OC-2. Part 10, test A-3.

## 2.8 The hash block

`[IMPL]` H-05.3 is a `figure` with a `figcaption` carrying the label.

- The hash value is **plain selectable text**, not a link, not an input, not a
  code editor.
- Marked up as code so that assistive technology may apply character-level
  reading (**`[ARCH]`** §4.5), with the caption programmatically associated.
- **Wraps.** Never inside a horizontally scrolling container, never truncated
  with an ellipsis, never abbreviated in the DOM even if abbreviated visually —
  and it is not abbreviated visually either.
- The copy control, if present, is injected by script and is not in the served
  HTML. §6.3.

## 2.9 Anchor identifiers

`[IMPL]` Fixed here because they become public URLs and three teams would
otherwise choose three sets.

`#identification` · `#not-promised` · `#what-the-protocol-does` ·
`#no-one-controls-this` · `#what-you-can-check` · `#where-to-go` · `#main`

**`[VISUAL]`** §8.6: arriving at an anchor places the region's overbar at the top
of the viewport with 24px clearance, **instantly**, with no highlight on the
arrived-at region.

## 2.10 What does not appear in the DOM

`[IMPL]` Recorded because their absence must survive future edits.

No wordmark or logo element in the navigation — **`[COPY]`** §2.8 defines five
navigation labels and none of them is a home link, and H-01.0 is the page title
at the top of `main`. *(Site-wide navigation for other pages is out of scope.)*
No breadcrumb. No search. No language selector. No connect-wallet control. No
theme toggle (§12.2). No cookie banner unless legally required, and then subject
to **`[ARCH]`** §10.8. No analytics tag by default (§7.6). No `noscript` fallback
content, because there is nothing to fall back from. No hidden preloaded content.
No duplicate mobile markup — **one DOM, reflowed.**

---

# Part 3 · Responsive layout

## 3.1 The three named breakpoints

`[IMPL]` **`[VISUAL]`** §7.2, implemented.

| Name | Range | Layout |
|---|---|---|
| **Apparatus** | ≥ 1080px | Two columns: citation margin, then prose |
| **Column** | 640 – 1079px | Single column; citations inline |
| **Narrow** | < 640px | Single column; citations inline; type scale steps down |

**Named by what changes, not by device.** There is no "tablet" or "phone"
breakpoint, because **`[VISUAL]`** §7.1 states that the responsive strategy has
one axis — the citation apparatus — and everything else is the same page at a
different measure.

## 3.2 What changes across the range

`[IMPL]` **Exactly four things.**

1. **Citation position** — margin at Apparatus, inline below it. §2.4.
2. **Prose measure** — 660px until the viewport cannot afford it, then viewport
   minus padding. **Never wider than 660px at any width.**
3. **Side padding** — 48 / 32 / 20px.
4. **Type scale** — body 19/32 at Apparatus and Column, 17/28 at Narrow;
   headings and labels proportionally. **`[VISUAL]`** §3.5.

## 3.3 What must never change

`[IMPL]` **Any implementation that changes one of these at any viewport is
defective.**

- **DOM order.** One DOM at every width. No duplicated markup, no conditional
  rendering, no reordering.
- **Content.** **`[ARCH]`** §10.4: nothing removed, truncated, collapsed, or
  placed behind a control. This includes citations (§2.4) and the hash (§2.8).
- **Ordering constraints OC-1, OC-2, OC-3, OC-6**, in DOM *and* visual order.
- **Register parity.** **`[VISUAL]`** §10.6. Limitation and capability content
  share every typographic property at every viewport. A breakpoint that reduces
  a limitation's size while leaving body text alone is the single most likely way
  to violate this without noticing.
- **The number of interactive elements.** No control appears or disappears with
  viewport width.

## 3.4 Desktop and laptop

`[IMPL]` Both are Apparatus. Shell 1180px, prose 660px, citation margin 180px,
gutter 32px, side padding 48px. Navigation fully expanded on one line.

**The prose column is not centred in the shell.** **`[VISUAL]`** §6.3: with the
citation margin to its left, the text block sits left of centre, and that
off-centre position is structural and is preserved at every width above the
Apparatus breakpoint.

## 3.5 Tablet

`[IMPL]` Column layout. **`[ARCH]`** §10.2: navigation remains fully expanded;
it collapses only below the width at which the entries cannot fit without
truncation, never merely because a breakpoint was crossed. §3.7 resolves what
"collapse" means here.

## 3.6 Mobile and narrow viewport

`[IMPL]` Narrow layout. Reflow to **320 CSS pixels without horizontal
scrolling** (WCAG 2.2 1.4.10) is a hard floor. Every region fully expanded. The
overbar spans the full text column. The hash wraps across as many lines as it
needs.

## 3.7 Navigation at narrow widths — resolved

`[IMPL]` **The primary navigation does not collapse. It wraps.**

Derivation, and this resolves a latent JavaScript dependency:

**`[VISUAL]`** §8.5 permits a collapse to a single labelled control *only when the
five entries cannot fit without truncation.* **Wrapping is not truncation.** Five
short text labels wrapping to two or three lines at 320px satisfies the
constraint completely, removes the only mechanism on the page that would have
required JavaScript, and preserves **`[ARCH]`** §10.7's JavaScript-free
requirement without a `details`-element workaround.

**Consequence:** controls X-1 (`Menu`) and X-2 (`Close`) from **`[COPY]`** §3.4
**are not used on this surface.** They remain specified for surfaces elsewhere in
the product whose navigation may be longer. Recorded rather than deleted, because
the copy is canonical and this document does not modify it.

**The trade being made:** three lines of small structural-label type at the top of
a 320px viewport, instead of one control. It is less conventional and it costs
vertical space. It is also JavaScript-free, keyboard-operable with no focus
management, immune to the entire class of menu bugs, and visible rather than
hidden — which is the same argument **`[ARCH]`** §4.2 makes about disclosure
controls generally.

## 3.8 Wide and ultra-wide viewport

`[IMPL]` **`[VISUAL]`** §7.7: **the page does not grow.** At 2560px and beyond
the shell remains 1180px, the prose measure remains 660px, and the additional
width becomes margin. No second column, no sidebar, no background treatment
introduced to fill the space, and **no re-centring of the prose column.**

## 3.9 Zoom and text spacing

`[IMPL]`
- **200% zoom** without loss of content or function (WCAG 1.4.4). At 200% a
  1280px viewport behaves as 640px and enters Column layout — citations go
  inline, which is correct and is the same behaviour a 640px viewport receives.
- **Text spacing overrides** (WCAG 1.4.12) applied at the specified maxima must
  not clip or overlap content. The citation margin is the element most at risk;
  it must grow with its content rather than clip.

---

# Part 4 · Accessibility

**Target: WCAG 2.2 Level AA**, plus two AAA criteria **`[ARCH]`** §10.7 requires
on Charter grounds. Where this document exceeds AA it says so.

## 4.1 Heading semantics

`[IMPL]` §2.3. One `h1`; five `h2`; no `h3`; no level skipped; no heading used
for sizing; **no heading inside H-04** beyond its single `h2` (OC-3).

## 4.2 Landmark navigation

`[IMPL]` §2.2. Six landmarks, three of them navigation, each named. Every piece
of content on the page is inside a landmark — no orphan content between
`header` and `main` or after `footer`.

## 4.3 Keyboard navigation and focus order

`[IMPL]`

- **Every route is reachable and operable by keyboard**, in DOM order.
- **No `tabindex` above 0 anywhere.** Manual tab-order manipulation is prohibited.
- **No keyboard traps.** The page has no dialog, no menu, no focus management,
  and nothing to trap in.
- **Focus order equals DOM order equals reading order**, with the single
  documented exception at §2.4: a citation's visual position at Apparatus is to
  the left of its claim's first line while its focus position is after the claim.
  WCAG 2.4.3 is satisfied because the order preserves meaning and operability —
  the source is read after the statement it sources. §12.1.

**Full tab sequence at Apparatus**, normative:

```
skip link → N-1 … N-5 → R-01 → [H-02 citations ×3] → R-02 → R-03
→ [H-03 citations ×4] → R-04 → R-05 → [H-04 citations ×4]
→ R-06 → R-07 → R-09 → R-08 → (R-10) → [H-05 citations]
→ R-11 … R-14 → F-1 → F-2 → F-3
```

*R-09 precedes R-08 because `[COPY]` §2.6 orders Registry data before the
Developer and verifier reference in the rendered list; route numbering follows
`[ARCH]` §7.2's inventory, not the visual order.*

## 4.4 Focus indication

`[IMPL]` **`[VISUAL]`** §10.7:
- 2px solid indicator in Ink (Paper in dark appearance), offset 2px, **no glow,
  no blur, no colour transition, no animation** (0ms — **`[VISUAL]`** §10.2).
- Visible on every focusable element, including the skip link when it receives
  focus.
- Meets AA non-text contrast (3:1) against both adjacent colours.
- **`:focus-visible` is permitted; `:focus { outline: none }` without a
  replacement is prohibited** and is a build-blocking defect.

## 4.5 Screen reader behaviour

`[IMPL]`

- **H-02's non-promises are announced as a list of three.** **`[ARCH]`** §4.2
  requires the count to be available.
- **H-03's lifecycle is announced as an ordered list of five**, in specification
  order.
- **H-05's items are a description list**: each route is a `dt`, its description
  a `dd`. `[IMPL]` Chosen over headings (which would fragment H-05 and add five
  `h3` elements the heading hierarchy does not want) and over an unordered list
  (which would flatten the label/description relationship the copy depends on).
- **The hash is announced as code**, with its caption associated, so that
  character-level reading modes engage.
- **Availability statements are in the accessible name or an associated
  description of the affected item** — never conveyed by styling alone.
  **`[ARCH]`** §4.5.
- **No content is visually hidden except the skip link's resting state and
  landmark names.** No `sr-only` explanatory text, no hidden instructions, no
  descriptions written for assistive technology that sighted readers do not get.
  Content parity, §1.5.

## 4.6 ARIA usage

`[IMPL]` **The page uses almost no ARIA, and that is the requirement, not an
omission.**

Permitted, and exhaustive:
- Accessible names on the three `nav` landmarks.
- `aria-hidden` on the external-route glyph.
- `aria-describedby` associating an availability statement with its item.
- A live region for the copy control's success announcement — **only if the
  control is implemented.** §6.3.

Prohibited: `role` attributes duplicating native semantics; `aria-label` on
elements with visible text (it would create a second, divergent copy of canonical
strings); `aria-current`; `aria-expanded`; `aria-live` on anything static; any
ARIA that describes a widget the page does not contain.

**Derivation:** every ARIA attribute is a second source of truth about what an
element means. **`[COPY]`** §2 is canonical and singular; ARIA that restates it
creates a copy that will drift, which is the failure the whole reference-layer
architecture exists to prevent.

## 4.7 Skip navigation

`[IMPL]` D-3 (`Skip to main content`) is the first focusable element in the DOM,
visually hidden until focused, and targets `#main`. On activation focus moves to
`main`, which is programmatically focusable for this purpose.

## 4.8 Reduced motion

`[IMPL]` **`[VISUAL]`** §10.4: `prefers-reduced-motion: reduce` removes all
motion, including the link underline transition. Since the page's only motion is
a 90ms underline change (**`[VISUAL]`** §10.2), **no information is lost** —
which is the correct relationship and is only achievable because stillness is the
default.

**Implementation note:** the reduced-motion rule must not be the only place
motion is bounded. If a future change introduces motion that reduced-motion
removes but nothing else bounds, the change has failed **`[VISUAL]`** §10.1
rather than passed §10.4.

## 4.9 Print

`[IMPL]` **The brief for print is derived, not conventional: a printed page must
preserve every claim's route to its source.**

**`[ARCH]`** Acceptance criterion 3 requires every claim to be reachable in one
step from where it can be checked. On paper a link is not followable, so the
requirement is satisfied only if the destination is printed.

| Element | Print behaviour |
|---|---|
| Route links | **URL printed after the link text**, in the mono face at citation size |
| Citations | Inline after their claim, as at Column layout |
| Hash | Printed in full, wrapped, never truncated |
| Primary navigation | Not printed — its routes are not claims, and all five destinations appear as printed URLs elsewhere on the page except N-2, which is recorded at §12.4 |
| Footer | Printed in full, including H-07.1 and the entity attribution |
| Dark appearance | Not printed. Print is always Ink on white |
| Backgrounds | Paper-recessed backgrounds are dropped; the hash block keeps its hairline |
| Page breaks | No region is broken between its overbar and its heading. **H-04.1 through H-04.3 do not break across pages** — OC-3's adjacency requirement applies to paper |

---

# Part 5 · CSS architecture

**Contracts, not code.** Every item states an outcome that can be verified in a
rendered page.

## 5.1 Layout model

`[IMPL]` **A single two-column grid at Apparatus, collapsing to one column
below.** No floats, no absolute positioning for layout, no negative margins to
achieve the margin column.

**Requirement on the mechanism, not the mechanism itself:** whatever produces the
two-column apparatus must (a) leave DOM order unchanged, (b) permit baseline
alignment between a citation and its claim's first line, (c) allow the citation
cell to grow with content under text-spacing overrides, and (d) collapse to a
single column without any DOM change.

**Prohibited:** any use of a visual-reorder mechanism (`order`, `grid-row`
placement, `direction`, `flex-direction: reverse`) **that changes the relative
visual order of two elements from their DOM order.** This is the mechanism by
which OC-1, OC-2 and OC-3 are most likely to be broken silently, and it is
prohibited outright rather than reviewed case by case.

## 5.2 Spacing system

`[IMPL]` **`[VISUAL]`** §6.2. Base 4px. The permitted set is closed: **4, 8, 12,
16, 24, 32, 48, 64, 96, 144.**

- **No intermediate values.** A spacing value outside the set is a defect.
- **No value above 144 anywhere**, including region gaps at ultra-wide.
- Region separations from **`[VISUAL]`** §6.1's table, implemented as stated.
- **Spacing is applied in one direction** (top margins or bottom margins,
  consistently) so that two adjacent components cannot produce an unspecified
  combined gap.

## 5.3 Typography implementation

`[IMPL]`

- **Absolute line heights on a 4px baseline**, per **`[VISUAL]`** §3.5. Unitless
  line-height multipliers that produce fractional pixel values are prohibited —
  they break the baseline the overbar and citation alignment depend on.
- **Two families, loaded as two families.** No third family, no icon font, no
  system-UI fallback used as a design choice.
- **Fallback stacks are metric-matched** using font-metric overrides so that the
  swap from fallback to webfont produces **no visible reflow**. §7.2.
- **Font size steps down once**, at Narrow. No fluid/clamped type scaling —
  **`[VISUAL]`** §3.5 specifies discrete values, and fluid scaling would make the
  headline-to-body ratio vary continuously, which is the ratio §2.3 of the Visual
  Specification identifies as the deliberate risk.
- **Numerals: lining, tabular in tables and in every mono string.**

## 5.4 Design tokens

`[IMPL]` **Tokens are the enforcement surface for register parity**, so their
naming is specified.

**Tokens are named for their role, never for their appearance or sentiment.**
`ink`, `paper`, `rule`, `route` — never `text-muted`, `text-secondary`,
`warning`, `danger`, `success`, `subtle`, `disclaimer`.

Derivation: **`[VISUAL]`** §4.4 warns that a designer looking for hierarchy will
reach for a lighter grey and the first thing it will land on is a caveat. A token
named `text-secondary` **invites** that use; a token named `ink-quiet` documented
as *chrome only* resists it. **The token name is the review comment, delivered at
the moment of use.**

**Complete token set** — no token exists outside this list:

`paper` · `paper-recessed` · `ink` · `ink-quiet` · `rule` · `rule-structural` ·
`route` · `route-visited`

**Prohibited tokens:** any status colour, any elevation or shadow token, any
radius token above 2px, any opacity token used to de-emphasise text, any
gradient, any blur.

## 5.5 Colour token implementation

`[IMPL]`
- Values from **`[VISUAL]`** §4.2 and §4.3.
- **Dark appearance follows `prefers-color-scheme` and nothing else.** §12.2.
- **Contrast is verified as a build step, not asserted.** Part 10, test A-6.
- **`ink-quiet` usage is enumerated in the source**, so that a review can list
  every element using it and apply **`[VISUAL]`** §4.4's test: *would removing it
  change what the visitor knows?*

## 5.6 Overbar implementation

`[IMPL]` **`[VISUAL]`** §2.1.

- Rendered as a border on the **top** edge of the group it binds — not a
  separate element, not a bottom border on the preceding group.
- **1px, `rule-structural`, spanning the group's measure**, which at Apparatus is
  the prose measure plus the citation margin plus the gutter, not the prose
  measure alone. The bar binds the whole region including its apparatus.
- Two weights only: `rule-structural` for the six regions, `rule` for subordinate
  groups.
- **A rule appears nowhere else.** No dividers between paragraphs, no rule above
  the footer routes, no decorative lines. Test A-8 enumerates every rule in the
  rendered page and requires each to sit above a group.

## 5.7 Citation margin implementation

`[IMPL]` §2.4's contracts, plus:
- The margin column is **180px fixed** at Apparatus; it does not scale with
  viewport.
- Below Apparatus the column does not exist — the citation is inline flow, not a
  hidden column, not a repositioned absolute element.
- **The transition between the two is a media query, not a script.**

## 5.8 Responsive scaling

`[IMPL]` **Discrete, not fluid.** Three breakpoints, four changing properties
(§3.2), no `clamp()` on type, no viewport-unit-based sizing for anything that
affects reading measure or type scale.

Derivation: fluid scaling makes every ratio in **`[VISUAL]`** §3.5 a function of
viewport width. The document specifies ratios, and a ratio that varies
continuously cannot be specified.

## 5.9 Cascade discipline

`[IMPL]`
- **No `!important`** in authored styles.
- **Specificity kept flat.** A single class per component; no descendant
  selectors deeper than two levels.
- **No utility classes that encode appearance** (`.text-sm`, `.text-gray-500`).
  A utility named for a size is a token by another name, outside the token set,
  and it is how a limitation ends up smaller than a capability in a diff nobody
  flags.

---

# Part 6 · JavaScript

## 6.1 The inventory

`[IMPL]` **Complete. Nothing outside this list may ship on the homepage.**

| # | Script | Status |
|---|---|---|
| 1 | Copy-hash control (§6.3) | **Optional enhancement.** May be omitted entirely |

**That is the entire inventory.** The homepage ships zero required JavaScript.

## 6.2 What is prohibited

`[IMPL]` Each with its source.

| Prohibited | Source |
|---|---|
| Any framework runtime, hydration, or client-side router | §1.3; nothing on the page has state |
| `localStorage`, `sessionStorage`, cookies set by page code, IndexedDB | **`[ARCH]`** §7.1: no writes of any kind |
| Scroll listeners, IntersectionObserver, scroll-triggered reveal, parallax | **`[ARCH]`** §4.1; **`[VISUAL]`** §10.1, §11.2 |
| Smooth-scroll on anchor navigation | **`[VISUAL]`** §8.6: the jump is instant |
| Wallet or provider detection of any kind, including passive probing | **`[ARCH]`** §5.7 |
| Analytics that profile behaviour, or any event tied to intent to act | **`[ARCH]`** §10.8 |
| Third-party embeds, tag managers, chat widgets, consent platforms with remote configuration | **`[ARCH]`** §9.6; §7.6 |
| Lazy loading, skeletons, shimmer, spinners | **`[VISUAL]`** §9.13 |
| Any navigation menu script | §3.7 removed the need |
| Exit-intent, `beforeunload`, re-engagement, or any behaviour differing for a returning visitor | **`[ARCH]`** §7.4 |
| Feature-flagged or A/B-tested variants of any region | Ordering constraints are not testable if the page varies |

## 6.3 The one permitted enhancement

`[IMPL]` **Copy-hash control (X-3).**

- **Not present in the served HTML.** Injected by script after load, adjacent to
  the hash block.
- **Supplements selectable text; never replaces it.** **`[ARCH]`** §4.5.
- Labels are **`[COPY]`** X-3 verbatim: `Copy hash` → `Hash copied`.
- Success is announced via a polite live region **and** as a visible text change.
  **`[ARCH]`** §4.5: the success state does not rely on a transient visual toast
  alone.
- **Feature detection before injection.** If the clipboard API is unavailable or
  denied, the control is **not rendered at all** — it is never rendered in a
  broken or disabled state, which would violate **`[VISUAL]`** §5.4's prohibition
  on disabled-looking elements.
- **Injection must not cause layout shift.** Space for the control is reserved in
  CSS, or the control is placed where reflow is invisible. §7.4.

## 6.4 Failure behaviour

`[IMPL]` **Script failure is invisible.**

If the script fails to parse, fails to load, or is blocked, the page is exactly
the page it would have been without it: the hash is still present, still
selectable, still complete. **No error is shown, no fallback message appears, and
nothing is logged to the user.**

Derivation: **`[ARCH]`** §7.1 and §10.7 together mean the enhancement carries no
obligation. An error message about a failed convenience would be the page
apologising for something the reader did not need.

## 6.5 Progressive enhancement contract

`[IMPL]` **Testable statement:** with JavaScript disabled, the rendered page
differs from the enhanced page **only** by the absence of the copy control.
Every string, every route, every citation, every semantic and the entire layout
are identical. Part 10, test A-11.

---

# Part 7 · Performance

## 7.1 Budgets

`[IMPL]` **A breach is a content review trigger, not an optimisation task.**
§1.6.

| Resource | Budget |
|---|---|
| HTML document, uncompressed | **≤ 20 KB** |
| CSS, uncompressed | **≤ 12 KB** |
| Fonts, total, woff2 | **≤ 120 KB** |
| JavaScript | **≤ 2 KB**, or zero |
| Images | **0 bytes** — **`[VISUAL]`** §9.6 |
| Third-party requests on first render | **0** |
| Total transferred, first visit | **≤ 160 KB** |
| Requests, first visit | **≤ 6** |

## 7.2 Font loading

`[IMPL]`
- **Self-hosted.** No third-party font service. **`[VISUAL]`** §3.2 selects an
  open, self-hostable face partly for this reason, and a third-party font request
  is also a third-party request on a page that permits none.
- **Subset to the characters the page uses**, plus the Latin ranges the
  specification's terminology requires. The hash requires only `[0-9a-f]` in the
  mono face, but the mono face also sets citations and code, so it is subset to
  Latin.
- **Preloaded**, both faces, in the document head.
- **`font-display: swap`, with metric-matched fallbacks** such that the swap
  produces **no visible reflow**. §5.3.
- **Two weights of the serif (400, 600) and one of the mono (400).** No italic
  file unless the italic use at **`[VISUAL]`** §3.6 appears on this page — it
  does not, so **no italic file ships on the homepage.**

## 7.3 Rendering strategy

`[IMPL]` **Static HTML, served as HTML.** No server-side rendering step at
request time, no client-side rendering, no hydration, no partial rendering, no
streaming. The document that leaves the origin is the document the reader
receives.

**Caching:** the HTML is immutable between deployments and may be cached
aggressively; the CSS and fonts are fingerprinted and cached for a year.

**The hash string is part of the static document.** It is not fetched, not
computed at runtime, and not injected. **`[SPEC]`** VF-PUB-001 makes its
correctness a deployment-time obligation, and Part 10 test A-10 verifies it.

## 7.4 Layout stability

`[IMPL]` **Cumulative Layout Shift target: 0.00.** Not "good", not under 0.1 —
zero.

The page has no images, no ads, no embeds, no async content and no injected
markup except the optional control at §6.3, which reserves its own space. **The
only remaining source of shift is font swap**, which §7.2's metric matching
eliminates. A measured CLS above 0.02 indicates one of the excluded categories
has entered the page.

## 7.5 Interaction latency and animation budget

`[IMPL]`
- **Animation budget: 90ms of transition on one property (link underline
  thickness), and 0ms everywhere else.** **`[VISUAL]`** §10.2. There is no
  panel transition on this surface because there is no panel (§3.7).
- **No animation of a property that triggers layout.** Underline thickness is
  rendered without reflow, or the effect is achieved by a decoration that does
  not affect layout.
- **Interaction latency:** the page has no scripted interactions except the
  optional copy control; its response target is under 50ms.
- **Largest Contentful Paint** is a text element. Target **under 1.0s on a
  4G-class connection**, which the budgets at §7.1 make achievable without
  technique.

## 7.6 Resource loading and third parties

`[IMPL]` **Zero third-party requests.** No font CDN, no analytics host, no
consent platform, no error reporter, no preconnect to anything.

Derivation: **`[ARCH]`** §10.8 permits route-click measurement and prohibits
behavioural profiling. Any measurement implemented must therefore be **first-party
and non-blocking**, and it is out of this document's scope to specify it beyond
that constraint. **`[VISUAL]`** §10.9's diagnostic applies: a third-party request
on this page is evidence that something the specification excludes has been
added.

## 7.7 Constrained conditions

`[IMPL]` **On a slow connection the page degrades in the right order.**

HTML arrives first and is readable unstyled in correct DOM order. CSS arrives and
applies the apparatus. Fonts arrive and swap without reflow. The optional script
arrives or does not. **At every point in that sequence the reader has the
complete content**, which is the whole of §1.3 expressed as a network behaviour.

---

# Part 8 · Component inventory

**Complete. No component exists outside this list.** Adding one requires an
accepted artifact that requires it.

Every component's prohibited states are stated, because **`[VISUAL]`** §5.2
establishes that an unused component eventually gets used.

| ID | Component | Responsibility | Required states | Prohibited states | Interaction | Depends on |
|---|---|---|---|---|---|---|
| **C-01** | Page shell | Measure, side padding, ultra-wide containment | Apparatus · Column · Narrow | — | None | §5.1 |
| **C-02** | Primary navigation | Five routes, persistent | Default | Sticky-with-shadow · collapsed · current-page highlight · badge | None | C-08 |
| **C-03** | Region | Overbar + heading + content | Default | Expanded/collapsed · highlighted-on-anchor · alternating ground | None | C-07, C-04 |
| **C-04** | Prose block | A paragraph and its citation slot | Default | Truncated · clamped · "read more" | None | C-07 |
| **C-05** | Ordered list | The lifecycle, all steps visible | Default | Stepped · revealed · numbered-with-icons | None | — |
| **C-06** | Marked list | The non-promises, count announced | Default | Collapsed · boxed · tinted | None | — |
| **C-07** | Citation reference | Source, level with its claim | Margin · Inline | Hidden · footnoted · tooltip · placeholder-when-empty | Link | C-08 |
| **C-08** | Route link | Navigate | Default · hover · focus · visited | Disabled · loading · pressed · button-styled · new-tab | Activate | — |
| **C-09** | External route link | Navigate off-site | Default · hover · focus · visited | As C-08, plus icon-only | Activate | C-08 |
| **C-10** | Evidence block | The hash, selectable and complete | Default · (enhanced with C-16) | Truncated · scrolling · masked · linked | Select | — |
| **C-11** | Description list | H-05's five items | Default · with-availability | Collapsed · reordered · headings-instead | None | C-07, C-08, C-15 |
| **C-12** | Route list | H-06's four routes | Default | Ranked · card grid · recommended-highlight | None | C-08 |
| **C-13** | Footer | Subordination statement, three routes, attribution | Default | Disclaimer zone · sitemap · low-contrast | None | C-08 |
| **C-14** | Skip link | Bypass navigation | Hidden · focused | Always-visible · absent | Activate | — |
| **C-15** | Availability marker | Tag + statement, `[SPEC]` VF-EXT-002 | Not-yet-available | Greyed · badged · coloured · dated · "coming soon" | None | — |
| **C-16** | Copy control | Optional enhancement | Default · success · absent | Disabled · error · replaces-selectable-text | Activate | §6.3 |

**Components deliberately absent**, recorded so their absence survives:
button (non-navigational), card, panel, accordion, tabs, modal, dialog, tooltip,
alert, callout, badge, chip, pill, avatar, carousel, stepper, progress bar,
spinner, skeleton, toast, banner, breadcrumb, search, pagination, icon set,
status dot, theme toggle (§12.2), menu control (§3.7).

---

# Part 9 · Traceability

## 9.1 Requirement sources by part

| Part | Predominantly | `[IMPL]` decisions requiring derivation |
|---|---|---|
| 1 Philosophy | `[ARCH]` §10.7, Charter | §1.1, §1.6, §1.7 |
| 2 DOM | `[ARCH]` §4, §10.7; `[COPY]` Part 2 | §2.2 (three nav landmarks), §2.3 (footer heading), §2.4 (citation grouping), §2.9 (anchor ids), §2.10 (no wordmark) |
| 3 Responsive | `[ARCH]` §10; `[VISUAL]` §7 | §3.7 (navigation wraps) |
| 4 Accessibility | `[ARCH]` §10.7 | §4.5 (description list), §4.6 (ARIA minimalism), §4.9 (print) |
| 5 CSS | `[VISUAL]` §3–§10 | §5.4 (token naming), §5.6 (overbar span), §5.8 (no fluid scaling), §5.9 |
| 6 JavaScript | `[ARCH]` §7.1, §10.7 | §6.3, §6.4 |
| 7 Performance | `[VISUAL]` §10.9 | §7.1 (budget values), §7.2, §7.4 |
| 8 Components | `[VISUAL]` §9 | Prohibited-state column |
| 10 Tests | All | Test construction |

## 9.2 The `[IMPL]` decisions, indexed

Each is listed with the requirement it discharges. **No `[IMPL]` decision below
lacks a source; a decision that did would be a defect in this document.**

| Decision | Discharges |
|---|---|
| Three named navigation landmarks (§2.2) | **`[ARCH]`** §4.6's distinct-landmark requirement |
| Footer carries no heading (§2.3) | **`[ARCH]`** §10.7's landmark requirement, without inventing a string — §12.3 |
| Citation grouped per paragraph or list item (§2.4) | **`[VISUAL]`** §2.2's alignment requirement, made unambiguous |
| Citation focus follows its claim (§2.4) | WCAG 2.4.3; conflicts with **`[VISUAL]`** §10.5 test 5 — §12.1 |
| Fixed anchor identifiers (§2.9) | **`[VISUAL]`** §8.6's stable-identifier requirement |
| No wordmark in navigation (§2.10) | **`[COPY]`** §2.8 defines five labels and no home link |
| Navigation wraps rather than collapses (§3.7) | **`[ARCH]`** §10.7's JavaScript-free requirement; **`[VISUAL]`** §8.5's truncation condition |
| Discrete rather than fluid type scaling (§5.8) | **`[VISUAL]`** §3.5 specifies ratios |
| Role-named tokens only (§5.4) | **`[VISUAL]`** §4.4's Ink-quiet warning |
| Overbar spans measure plus apparatus (§5.6) | **`[VISUAL]`** §2.1: the bar binds the group |
| Copy control injected, never served (§6.3) | **`[ARCH]`** §10.7 |
| Print renders URLs after link text (§4.9) | **`[ARCH]`** acceptance criterion 3 |
| CLS target 0.00 (§7.4) | **`[VISUAL]`** §10.9's diagnostic |
| No italic font file ships (§7.2) | **`[VISUAL]`** §3.6 — italic use does not occur on this page |

---

# Part 10 · Acceptance tests

**Objectively verifiable against a built page.** All must pass. Tests marked
**automatable** should run in the build.

## A-1 · DOM order — automatable
Assert the served HTML's element order matches §2.1 exactly. **Any deviation
fails**, including an added wrapper with semantics.

## A-2 · Constraint OC-1 — automatable, all viewports
`#not-promised` precedes `#what-the-protocol-does` in DOM **and** in computed
visual position (bounding-box top) at 320, 375, 640, 768, 1079, 1080, 1180, 1440
and 2560px, and at ±1px of every breakpoint.

## A-3 · Constraint OC-2 — automatable, all viewports
`#what-you-can-check` precedes `#where-to-go`, **and** the first anchor in `main`
resolving to P-03, P-14, P-17, P-18 or the Workspace appears after every anchor
resolving to P-10, P-11, P-12, P-13 or P-16. Same viewport set.

## A-4 · Constraint OC-3 — automatable
Within `#no-one-controls-this`: exactly one heading; H-04.1 through H-04.3 are
consecutive siblings; **their computed font-family, font-size, font-weight,
line-height and colour are identical**; no element between them has a background,
border, or padding differing from its siblings.

## A-5 · Constraint OC-6 and OC-4 — automatable
`main` contains zero anchors resolving to the Workspace. The rendered text of
`main`, `header` and `footer` contains zero occurrences of the participation-
mechanic term list at **`[COPY]`** Part 6.

## A-6 · Register parity — automatable
Collect computed styles for every text node in `main`. Assert that the set of
distinct (family, size, weight, colour, line-height) tuples has **exactly the
cardinality the type scale defines** — no more. An unexpected tuple is an
unauthorised register and fails. Separately assert `ink-quiet` appears on no
element inside `main`.

## A-7 · Citation behaviour — automatable
At ≥1080px every citation's first-line baseline equals its claim's first-line
baseline within 1px. At <1080px every citation is inline within its claim's
block. At **every** viewport the citation count equals the count in **`[COPY]`**
Part 2, and no citation has `display: none`, `visibility: hidden`,
`aria-hidden`, or zero computed size.

## A-8 · Overbar behaviour — automatable
Enumerate every element in the page with a non-zero border or a rule-like
pseudo-element. Assert each sits on the **top** edge of a group, and that the
total count equals six structural overbars plus the enumerated subordinate rules.
**Any rule that is not above a group fails.**

## A-9 · Semantic HTML — automatable
One `h1`; five `h2`; zero `h3`; no skipped level. Six landmarks, three navigation
landmarks each with a distinct accessible name. Non-promises are a list of three;
lifecycle is an ordered list of five; H-05's items are a description list. Zero
`tabindex` > 0. Zero `title` attributes. Zero `target="_blank"`. Automated axe or
equivalent returns zero violations.

## A-10 · Copy integrity — automatable
Extract all rendered text from `header`, `main` and `footer`. Assert
**byte-for-byte equality** with **`[COPY]`** Part 2 and §2.8, in order. **No
string may be added, removed, reworded, re-cased, or re-punctuated.** Separately
assert the rendered hash equals the governing specification hash — **`[SPEC]`**
VF-PUB-001. Word count of body copy ≤ 750 — **`[COPY]`** T-11.

## A-11 · JavaScript-disabled behaviour — automatable
Render with scripting disabled. Assert the extracted text, route set, citation
count, heading structure and computed layout are identical to the scripted
render, **differing only by the absence of C-16.**

## A-12 · Keyboard navigation — manual, scripted where possible
Tab through the page. Assert the sequence matches §4.3; focus is visible at every
stop; no trap; the skip link is first and moves focus to `main`. Assert no
element receives focus that is not in the sequence.

## A-13 · Responsive behaviour — automatable
At the viewport set from A-2: no horizontal scroll at 320px; prose measure never
exceeds 660px; shell never exceeds 1180px at any width up to 3840px; exactly four
properties differ across breakpoints (§3.2); the DOM is byte-identical at all
widths.

## A-14 · Reduced motion — automatable
With `prefers-reduced-motion: reduce`, assert zero elements have a non-zero
`transition-duration` or `animation-duration`.

## A-15 · Performance — automatable
Budgets at §7.1, enforced in the build. CLS ≤ 0.02. Zero third-party origins in
the request log. Zero image requests.

## A-16 · Print rendering — manual
Print to PDF. Assert every route's URL is printed; citations appear inline; the
hash is complete; H-04.1 through H-04.3 are not split across pages; the footer
prints; no dark ground.

## A-17 · Colour and contrast — automatable
Every text/background pair meets 4.5:1 (3:1 for large text and non-text
indicators), in **both** appearances. Assert zero elements use a colour outside
the token set at §5.4. Assert no red, green or amber hue appears anywhere in the
computed styles — **`[VISUAL]`** §4.5.

## A-18 · Availability states — automatable, pre-deployment builds
Where **`[SPEC]`** VF-EXT-002 applies, assert the C-15 marker is present as text,
is in the accessible name or an associated description, and that the affected
route is **not** disabled, greyed, or reduced in contrast. Assert the rendered
text contains no date and none of the prohibited schedule phrases at
**`[COPY]`** §3.6.

---

# Part 11 · Explicit non-requirements

`[IMPL]` **The homepage requires none of the following. Adopting any of them is
permitted; depending on any of them is not.**

| Not required | Note |
|---|---|
| React, Vue, Svelte, Angular, or any component framework | The page has no state and no interactivity to manage |
| Any static site generator | Permitted; the output must satisfy §7.3 |
| Tailwind, Bootstrap, or any CSS framework | **Actively discouraged**: a utility or component framework ships the excluded components (§8) and the appearance-named utilities §5.9 prohibits |
| A design-token pipeline | Eight tokens (§5.4) |
| A package manager, bundler, or build step | Permitted; the page can be authored as static files |
| TypeScript | There is at most 2 KB of optional script |
| A CMS | The copy is canonical and changes only by specification revision |
| A CDN, edge runtime, or serverless platform | Any static host satisfies §7.3 |
| A cookie or consent platform | The page sets nothing (§6.2) |
| An analytics platform | §7.6 |
| An icon library | One glyph (**`[VISUAL]`** §9.5) |
| A font service | Self-hosted (§7.2) |
| An accessibility overlay | **Prohibited**, not merely unrequired: an overlay is a second source of truth about the page's semantics and violates §4.6's reasoning |
| Server-side rendering, hydration, islands, or partial hydration | Nothing to hydrate |
| A testing framework of any particular kind | Part 10 specifies assertions, not tooling |

**The specification defines outcomes.** Two teams using different stacks must both
pass Part 10; a team whose stack makes a Part 10 test hard to satisfy has chosen a
stack whose defaults conflict with the architecture, and the stack is the thing
to reconsider.

---

# Part 12 · Conflicts found during derivation

**Recorded, not silently resolved.** Each is a genuine conflict between two
accepted documents, discovered by building the implementation contract.

## 12.1 · Citation focus order versus tab-order parity

**`[VISUAL]`** §10.5 test 5 requires *tab order matches visual order throughout*.
**`[VISUAL]`** §2.2 and §6.3 place the citation margin to the **left** of the
prose. A citation is a route and therefore focusable. At Apparatus these cannot
both hold: a citation is visually left of (before) its claim's first line, and its
DOM and tab position is after the claim.

**Three resolutions were available.** Move the margin to the right — rejected,
because **`[VISUAL]`** §6.3's off-centre prose column is identified as the
layout's most recognisable property. Make citations non-focusable plain text —
rejected, because **`[VISUAL]`** §9.12 states *a reference is always a route*.
Scope the tab-order test — **adopted.**

**Resolution as implemented:** within a citation row, claim precedes citation in
DOM and in tab order; the citation's visual position at Apparatus is a documented
exception. WCAG 2.4.3 is satisfied because focus order preserves meaning and
operability. **The Visual Design Specification should carry this exception
explicitly at v2**; until it does, this document's §2.4 governs and §10.5 test 5
is read as applying to everything except the citation apparatus.

## 12.2 · The appearance toggle versus the no-writes rule

**`[VISUAL]`** §4.3 permits a dark-appearance toggle in the footer.
**`[COPY]`** §3.4 specifies its strings (X-4). **`[ARCH]`** §7.1 prohibits **all
client-side writes, naming `localStorage` explicitly.**

A toggle that cannot persist forgets the reader's choice on every navigation,
which is worse than no toggle and would be the product making a decision-shaped
control that does not work.

**Resolution as implemented: no appearance toggle ships on the homepage.
Appearance follows `prefers-color-scheme` and nothing else.** X-4's strings
remain specified and unused, as X-1 and X-2 do (§3.7).

**This is the resolution a conservative reading requires, and it may not be the
one the operator wants.** If a persisted toggle is desired, **`[ARCH]`** §7.1
must be amended to permit one narrowly scoped write — which is a Homepage
Product Specification revision, not an implementation decision. Flagged for the
operator.

## 12.3 · The footer heading

**`[ARCH]`** §10.7 states *H-02 through H-07 are `h2`*. H-07 is the footer, and
**`[COPY]`** Part 2 supplies no footer heading string. Implementing the letter
would require inventing a string, which **`[COPY]`**'s canonical status forbids.

**Resolution as implemented:** five visible `h2` elements; the `contentinfo`
landmark discharges the navigational function. §2.3. **The Homepage Product
Specification should read "H-02 through H-06" at v2.**

## 12.4 · Route label consistency

**`[COPY]`** §2.8 fixes one label per destination. **`[COPY]`** Part 2 renders
P-10 as *deployment manifest* (lower case, mid-sentence) at H-04.4 and as *The
deployment manifest* at H-05.4, and renders P-13 as *the specification*,
*[The specification]* and *[the specification]* in three places.

**Resolution as implemented: Part 2 is verbatim and governs rendered text; §2.8
governs standalone labels.** No implementation change is made. **Recorded as a
defect for the Copy Specification at v2** — either §2.8 should state that inline
occurrences take sentence case, or Part 2 should be normalised. Test A-10
compares against Part 2, so the build is unaffected either way.

**One consequence worth noting:** N-2 *Supported assets* is the only navigation
destination whose URL appears nowhere in the printed page (§4.9), because no body
route points to P-03 except R-12, which does print. **No consequence; recorded
because the print audit surfaced it and a future copy change could make it
matter.**

---

# The final question

> **If this document, together with the Product, Visual and Copy Specifications,
> were handed to three independent senior frontend teams, would they build
> materially the same homepage?**

**Yes on everything that matters, and the ways they would differ are now
enumerable rather than open-ended.** That is a real answer and it is worth being
precise about both halves.

## What would be identical

**Every word**, to the byte — **`[COPY]`** Part 2 is verbatim and test A-10
enforces it. **Every route and its destination.** **The DOM order**, fixed at
§2.1 and tested at A-1. **The heading and landmark structure.** **The citation
apparatus**, including its grouping, alignment and focus behaviour. **The type
scale, spacing scale, and the complete eight-token palette**, to the hex value.
**The overbar's placement and weights.** **The absence** of every excluded
component, of motion, of colour semantics, of JavaScript, of images, and of
third-party requests. **The three breakpoints and the four properties that change
across them.** **The accessibility contract.**

A reviewer placing the three builds side by side would find them
indistinguishable at reading distance, and identical under every test in Part 10.

## What would differ, completely enumerated

**Nine items. None affects a claim, an ordering constraint, a register, or a
word.**

**1 · The stack.** Static files, a generator, or a framework rendered to static
output. Invisible in the artifact; §11 makes it explicitly free.

**2 · Rag and line breaking.** Ragged-right setting at a fixed measure produces
different line endings under different rendering engines and hyphenation
settings. **`[VISUAL]`** §3.6 fixes hyphenation off and alignment left, which
bounds this to sub-line variation.

**3 · The exact serif and mono files.** **`[VISUAL]`** §3.2 names Source Serif 4
and §3.3 names IBM Plex Mono, but both sections state substitution criteria and
name acceptable alternates. A team choosing Spectral over Source Serif 4 builds a
recognisably different-feeling page **within** the specification. **This is the
largest remaining variance and it is deliberate** — the criteria matter more than
the file, and a face can become unavailable.

**4 · The lifecycle diagram's existence.** **`[ARCH]`** §9.3 lists it as
*permitted*, not required. One team ships H-03 as prose and list only; another
adds the line diagram under **`[VISUAL]`** §9.4's rules. **The page differs
visibly.** Resolving this would require the Homepage Product Specification to
promote or exclude it, and this document has no authority to do so. **Flagged as
the one genuine open item affecting appearance.**

**5 · The optional copy control.** §6.3 permits omission. Two builds differ by
one small control beside the hash.

**6 · Rule and glyph micro-detail.** The external-route glyph's exact form,
the citation column's optional hairline (**`[VISUAL]`** §9.2 permits it, §2.1
does not require it), and the focus indicator's precise offset within the
specified 2px.

**7 · Print pagination.** §4.9 fixes what prints and which blocks must not
break; where the remaining page breaks fall is engine-dependent.

**8 · Accessible names of the three navigation landmarks.** §2.2 requires them to
be distinct and to name the region as **`[COPY]`** Part 2 does, but does not fix
the strings — they are not rendered, so they are not canonical copy. Three teams
would write three near-identical sets.

**9 · Build, test and deployment tooling.** Free by §11, invisible in the
artifact.

## Ambiguities this derivation removed

Recorded because they were open before this document and would otherwise have
produced three different builds: the citation's grouping unit and alignment
mechanism (§2.4); the citation's focus order (§12.1); whether the navigation
collapses, and therefore whether the page requires JavaScript at all (§3.7);
whether an appearance toggle ships (§12.2); H-05's list semantics (§4.5); the
footer's heading (§12.3); the anchor identifiers, which are public URLs (§2.9);
whether a wordmark appears in navigation (§2.10); the overbar's span (§5.6);
whether type scaling is fluid or discrete (§5.8); print behaviour in its entirety
(§4.9); and the performance budgets (§7.1).

## The honest summary

**Three teams would produce three builds that pass the same eighteen tests, carry
the same 608 words, and read as the same document.** The visible differences
reduce to two decisions the accepted artifacts deliberately left open — **which
serif, and whether the lifecycle diagram exists** — and to detail below the
threshold at which a reader would notice.

**Item 4 is the one worth resolving before build.** The other eight are variance
the architecture can absorb; a diagram present in one build and absent in another
is the difference between two homepages, and the decision belongs to the Homepage
Product Specification rather than to whichever team builds first.

---

# Revision policy

**Revise when:** an accepted artifact is revised · a conflict at Part 12 is
resolved upstream · an acceptance test is shown to be unverifiable · a budget at
§7.1 is shown to be wrong rather than breached.

**Do not revise to:** accommodate a framework's defaults · relax a budget to fit
an addition · permit a component because a future page might need one · resolve
an upstream conflict by assertion · admit a write, a script, or a third-party
request for convenience.

**Corrections are recorded visibly.** **Version numbers are whole integers.**

---

*Derived from Homepage Product Specification v1, Homepage Visual Design
Specification v1, Homepage Copy Specification v1, and the ten accepted baseline
artifacts, governed by Master Specification Revision 6, hash
`5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9`. Region
labels H-01–H-07, ordering constraints OC-1–OC-6, route identifiers R-01–R-14,
navigation identifiers N-1–N-5, control identifiers X-1–X-4 and copy block
identifiers originate in prior artifacts and are used without modification.
Component identifiers C-01–C-16 and test identifiers A-1–A-18 are document-local
and carry no specification authority. Attribution: Vinculum Protocol DAO LLC.*
