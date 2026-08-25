# Homepage Copy Specification

**Version:** 1
**Status:** Proposed for independent review
**Phase:** Product Design — canonical language, Phase 1
**Surface:** S01 · P-01 · Home
**Derived from:** Homepage Product Specification v1, Homepage Visual Design
Specification v1, and the ten accepted baseline artifacts, governed by Master
Specification Revision 6, hash
`5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9`

> **Language specification. It governs the words on one surface.** It introduces
> no product behaviour, no concept, no page, and no architecture. Where it
> conflicts with an accepted artifact, **the accepted artifact prevails and this
> document is defective.**

---

## How to use this document

**Part 2 is the copy.** It is written to be taken verbatim. Every string an
implementer needs is there, with an identifier. Nothing in Part 2 is an example,
a placeholder, or a suggestion.

**Everything else is the reasoning**, kept separate so that the copy can be read
as a page rather than as an argument about a page.

**Markings** continue the baseline discipline:

| Marking | Meaning |
|---|---|
| `[SPEC]` | The statement is Master Specification Revision 6 content, restated or plainly derived |
| `[ARCH]` | Required by an accepted product architecture artifact |
| `[COPY]` | A wording decision made here, with its derivation stated |
| `[OPEN]` | Conditional on an unresolved product decision |

**Total canonical body copy: 608 words** — body paragraphs and list items only,
excluding headings (32 words), route labels and the hash string (27 words). The
count is a discipline, not a target. **`[ARCH]`** §8.4: *an orientation surface
that runs long has usually started arguing.*

---

# Part 1 · Language principles

## 1.1 Voice

`[COPY]` **The page speaks in the third person about the protocol, and in the
second person only about what the reader may do.**

**No first-person plural anywhere.** **`[ARCH]`** Website Specification Phase 1
Part 9: the product may say what the protocol does; it may not say *we ensure*,
*we guarantee*, *we've made sure* — **there is no one to ensure anything.**

This is stricter than it first appears. It removes not only guarantees but the
entire register of a company addressing a customer: *we built*, *our mission*,
*we believe*, *let us*, *here at Vinculum*. **`[SPEC]`** VF-IMM-001 means there
is no continuing "we" with standing to speak. Every sentence on the page must
survive the removal of a speaker.

**Second person is permitted and preferred where the reader is the actor** —
*you release the principal*, *what you can check* — because the protocol makes
the participant the actor in exactly those places (**`[SPEC]`** §12: release is
user-initiated) and using the passive there would conceal responsibility.

## 1.2 Tone

`[COPY]` **Declarative. Unhurried. Not warm, not cold, not clever.**

**`[ARCH]`** Part 9: *it states what is true and what is not known. It does not
build to a point.*

Practical consequences:
- **No sentence sets up another sentence.** No "But here is the interesting
  part." No "That raises a question." No paragraph exists to create anticipation
  for the next one.
- **No rhetorical questions.** A question the page answers itself is a
  persuasive device with the shape of an inquiry.
- **No sentence describes the page's own virtue.** *We tell you the hard things
  first*, *unlike other protocols*, *radical transparency* — all excluded. The
  page's honesty must be inferred from its content, never asserted by it.
  §8.10's test.
- **No emphasis for effect.** Bold falls on structural clauses, not on the
  clause the writer wants remembered.

## 1.3 Vocabulary

`[COPY]` **Exact nouns, plain verbs.**

**`[SPEC]`** §17.1: public website language *derives from* the current
specification. **`[ARCH]`** Part 9: terms mean what Appendix B says they mean,
and **the product does not coin friendlier synonyms for precise things.**

The rule that follows, and it is the hardest one in this document:

> **Protocol objects are named by their canonical term. Everything else is said
> in the plainest available English.**

So the page says *Commitment Vault Lock*, *Commitment Vault principal*,
*maturity*, *approved asset*, *Dev Fund* — the Appendix B names, unsoftened —
and then explains around them in sentences a general reader can follow without a
glossary. It never invents *vault*, *deposit*, *position*, *stake*, or *unlock*
as a friendlier stand-in, and it never uses an industry term the specification
does not use.

**The Intelligent Newcomer is served by sentence construction, not by
vocabulary substitution.** **`[ARCH]`** Decision 3: the page assumes neither deep
expertise nor complete unfamiliarity; **`[ARCH]`** Charter principle 5: complexity
is made understandable, not invisible. Renaming a precise thing makes it
invisible.

## 1.4 Sentence length, rhythm and reading level

`[COPY]`

| Property | Specification |
|---|---|
| Average sentence length | **14–18 words** |
| Maximum sentence length | **28 words**, and only where a `[SPEC]` enumeration requires it |
| Paragraph length | **1–4 sentences** |
| Reading level | Broadly **grade 9–11**. Long words appear only where they are canonical terms. |
| Subordinate clauses | At most one per sentence |
| Rhythm | **No parallel triads.** *Faster, safer, simpler* is a persuasive cadence, and cadence is a form of emphasis. |

**One long sentence is permitted and required:** the enumeration of absent
authorities at H-04.1, which restates **`[SPEC]`** VF-IMM-001. **`[ARCH]`** §4.4
forbids substituting a vaguer phrase that would let a reader imagine one of them
remains, so the list is stated in full and the sentence runs long.

## 1.5 Precision

`[COPY]` Three rules that do most of the work.

**Say the mechanism, not the effect on the reader.** *One token issuance is
authorized* rather than *you receive tokens*. The first is a protocol fact; the
second frames the protocol as a provider of benefits, which is where **`[SPEC]`**
§17.1's economic-promise prohibition is violated by tone rather than by claim.

**Never use a quantifier the specification does not use.** No *most*, *usually*,
*typically*, *up to*, *as little as*, *in minutes*. Every one of these is either
a projection or a softening.

**Never state a future outcome.** The page contains no future tense about value,
availability, listing, or what a participant will have. Future tense appears only
where the protocol's own sequence requires it — *the lock matures at the end of
the duration* — and is a statement of a fixed rule rather than a forecast.

## 1.6 Treatment of limitations

`[COPY]` **A limitation is written exactly like a capability: same voice, same
sentence structure, same length, same position in the paragraph.**

**`[ARCH]`** Part 9: *a limitation delivered in a smaller, softer, later voice
than a capability has been concealed by tone.* The visual system enforces the
typographic half (**`[ARCH]`** Visual §5.2); this document enforces the
grammatical half.

Prohibited constructions, each of which softens without changing the fact:
- **The concessive pair.** *There is no administrator, but the rules are fixed.*
  The *but* converts a limitation into a setup for reassurance.
- **The pre-emptive frame.** *One thing to be aware of…*, *It's worth noting
  that…*, *Please note.* A frame that announces a caveat is a request to weigh
  it lightly.
- **The managed risk.** *This risk is mitigated by…* Nothing on this page
  mitigates anything.
- **The hedged adverb.** *Currently*, *at this stage*, *for now*. Each implies a
  future change no artifact supports.
- **Passive concealment of the actor.** *No intervention is possible* hides who
  cannot intervene. **`[SPEC]`** VF-IMM-006's consequence is that *nobody* can,
  and the sentence should say so.

## 1.7 Treatment of uncertainty

`[COPY]` **`[SPEC]`** VF-EXT-002 requires that an unavailable deliverable be
reported as incomplete rather than replaced with an invented value.

The language of unavailability is fixed at §3.6 and has three properties: it
names the artifact, states that it is not yet available, and states the reason as
a fact rather than a schedule. **No date, no "soon", no "shortly", no
"expected".** **`[ARCH]`** §9.5 excludes them as schedule claims.

## 1.8 Treatment of evidence

`[COPY]` **The page never says a thing is verified. It says what may be
checked, and by whom.**

**`[ARCH]`** Charter principle 4: the application should never ask someone to
trust what they can instead verify. In language this becomes a grammatical rule:

> **Evidence appears as an available action, never as a completed verdict.**

*Bytecode hash and source commit together let anyone confirm that deployed code
matches published source* is permitted. *Our code is verified* is not — it
reports a conclusion and asks the reader to accept it, which is **`[ARCH]`** V0.

**No count is offered as evidence.** **`[SPEC]`** VF-VER-006 prefers independent
reproduction over self-reported passes; **`[SPEC]`** VF-VER-007: nothing is
production-ready merely because it compiles. The page publishes no test count,
audit count, or coverage figure, and where the traceability publication is
described it says so explicitly.

## 1.9 The deletion rule

`[COPY]` **Every sentence in Part 2 has survived this test: remove it, and
something the reader needs to answer one of the four questions is lost.**

**`[ARCH]`** §1.2 fixes the page at four questions. A sentence that serves none
of them is not neutral filler — it is the page beginning to speak in its own
voice about itself, which §1.2 above excludes. Sentences cut under this rule are
recorded at Part 4 rather than silently dropped.

---

# Part 2 · Canonical copy

**Verbatim. Take these strings as written.**

Route labels appear in `[brackets]` and are links; their exact label text is
fixed at §2.8. Line breaks between paragraphs are paragraph breaks.

---

## 2.1 Document-level strings

| ID | String | Marking |
|---|---|---|
| **D-1** · Document title | `Vinculum Finalis` | `[COPY]` |
| **D-2** · Meta description | `Vinculum Finalis is a protocol. An approved asset is locked on the blockchain it already lives on, for a fixed duration. The asset does not move.` | `[COPY]` |
| **D-3** · Skip link | `Skip to main content` | `[COPY]` |

**D-1 carries no tagline.** A title of the form *Vinculum — the protocol that…*
is a positioning statement in the browser tab and in every search result, and it
would be the one piece of homepage language written to be read out of context —
which is where **`[SPEC]`** §17.1 is hardest to satisfy and easiest to violate.

**D-2 is not an SEO asset.** It is public website language and **`[SPEC]`**
§17.1 governs it identically to the page body. It is the first two facts of
H-01, unchanged.

---

## 2.2 H-01 · Identification

**H-01.0** — page title (`h1`)

> Vinculum Finalis

**H-01.1** — body

> Vinculum Finalis is a protocol. It is not a company, a fund, a platform, or a
> service. After it is deployed, no one operates it.

**H-01.2** — body

> An approved asset is locked on the blockchain it already lives on, for a
> duration fixed when the lock is created. That lock is a Commitment Vault Lock.
> Evidence of the lock is verified on Base, and that verification authorizes one
> token issuance on Base.

**H-01.3** — body

> The asset does not move to Base. It stays on its own chain, under that chain's
> rules, until the lock reaches maturity and its principal is released.

*No routes in this region.* **`[ARCH]`** §4.1.

---

## 2.3 H-02 · What is not promised

**H-02.0** — region heading (`h2`)

> What is not promised

**H-02.1** — body

> No exchange listing, liquidity level, market price, redemption value, or
> appreciation is guaranteed.

**H-02.2** — body

> The protocol issues tokens. It makes no statement about what a token will be
> worth, and nothing on this site should be read as one.

**H-02.3** — body

> Activity on exchanges and liquidity venues cannot change any protocol rule.
> Trading does not alter issuance, supply, reward, activation, or lock rules, and
> it cannot modify protocol calculations or supply accounting.

**H-02.4** — route (R-01)

> [Disclosures and limitations]

*Citation margin:* `VF-TOK-015` beside H-02.1 · `§17.1` beside H-02.2 ·
`VF-TOK-014 · VF-PUB-003` beside H-02.3.

---

## 2.4 H-03 · What the protocol does

**H-03.0** — region heading (`h2`)

> What the protocol does

**H-03.1** — body

> A commitment runs in a fixed sequence.

**H-03.2** — ordered list

> 1. An approved asset is locked on its own chain, for a duration fixed when the
>    lock is created.
> 2. Evidence of the lock is verified on Base.
> 3. One token issuance is authorized on Base.
> 4. The lock reaches maturity at the end of the duration.
> 5. The Commitment Vault principal is released by the person who created the
>    lock, on the chain it has been on throughout.

**H-03.3** — body

> The duration cannot be shortened after the lock is created. There is no early
> release path.

**H-03.4** — body

> The principal returns at maturity regardless of what else happens. If
> verification on Base fails permanently and no token is ever issued, the lock
> still matures and the principal remains releasable under the same fixed rule.

**H-03.5** — body

> Release is user-initiated. It is not pushed to a wallet, nothing performs it on
> your behalf, and nothing reminds you.

**H-03.6** — routes (R-02, R-03)

> [The commitment] · [Commitment rules]

*Citation margin:* `§3.1` beside H-03.2 · `VF-PRI-006` beside H-03.3 ·
`§12 · VF-SUP-008` beside H-03.4 · `§12 · VF-PRI-005` beside H-03.5.

---

## 2.5 H-04 · The absence of control, and its cost

**H-04.0** — region heading (`h2`)

> No one controls this. No one can repair it either.

**H-04.1** — body

> Vinculum Finalis is deployed once and then operates only through fixed rules.
> After deployment there is no governance, proposal system, voting system,
> council, administrator, owner role, upgrade authority, proxy administrator,
> pause authority, emergency role, rescue role, or discretionary
> parameter-setting authority.

**H-04.2** — body

> The absence of continuing control is a defining architectural choice rather
> than an incomplete governance design.

**H-04.3** — body

> The specification states the cost of that choice rather than leaving it to be
> discovered: the inability to repair a deployed defect is an accepted
> consequence of eliminating post-deployment control. Nobody can intervene when
> something goes wrong, and that includes intervening in your favour.

**H-04.4** — body

> Two things make this checkable rather than a claim. The [deployment manifest]
> identifies the deployed addresses and lets anyone match deployed bytecode to
> published source. The [specification] states the control model in Sections 2
> and 15.

*Citation margin:* `§2 · VF-IMM-001` beside H-04.1 · `§2` beside H-04.2 ·
`VF-IMM-006` beside H-04.3 · `§17.1` beside H-04.4.

*Routes R-04, R-05 are inline in H-04.4.*

---

## 2.6 H-05 · What can be checked

**H-05.0** — region heading (`h2`)

> What you can check, without asking anyone

**H-05.1** — body

> None of the following requires a wallet, an account, a connection, a
> registration, or anyone's permission.

**H-05.2** — item (R-06)

> **[The specification]** — The governing document, preserved and published in
> full. Its hash is published with it, so you can confirm that the copy you are
> reading is the copy that governs.

**H-05.3** — hash block

> Label: `Master Specification Revision 6 · SHA-256`
> Value: `5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9`

**H-05.4** — item (R-07)

> **[The deployment manifest]** — Every live address, environment identifier,
> source commit, bytecode hash, dependency, and the fixed Dev Fund destination.
> Bytecode hash and source commit together let anyone confirm that deployed code
> matches published source.

**H-05.5** — item (R-09)

> **[Registry data]** — Every approved asset's identity, environment,
> classification, pricing identifier, and source metadata, published as data
> rather than only as a page.

**H-05.6** — item (R-08)

> **[Developer and verifier reference]** — Interfaces, proof formats, verifier
> contracts, and the procedures for reproducing a verification without
> contacting anyone.

**H-05.7** — item (R-10) — **`[OPEN]` 5. Present only if traceability is
published.**

> **[Traceability]** — Each meaningful test and deployment check traced to the
> numbered requirement it exercises, with procedures for reproducing it. A pass
> count is not published as evidence that anything is sufficient.

*Citation margin:* `§17.1 · PRC-01` beside H-05.2 · `§17.1` beside H-05.4 and
H-05.5 · `§16 · VF-VER-006` beside H-05.7.

---

## 2.7 H-06 · Where to go from here

**H-06.0** — region heading (`h2`)

> Where to go from here

**H-06.1** — route list (R-11, R-12, R-13, R-14)

> [The commitment]
> [Supported assets]
> [Tokens and supply]
> [Supply and capacity]

**No other text appears in this region.** **`[ARCH]`** §4.6: *the routes, named
by destination. Nothing else.*

---

## 2.8 Navigation labels

`[COPY]` Every label names its destination. **`[ARCH]`** §5.9.

| ID | Label | Destination |
|---|---|---|
| **N-1** | `The commitment` | P-02 |
| **N-2** | `Supported assets` | P-03 |
| **N-3** | `Verification` | P-10 |
| **N-4** | `Specification` | P-13 |
| **N-5** | `Workspace` | W-01 |

**Route labels used in the page body**, fixed so that a destination carries one
string everywhere on the site:

| Destination | Label |
|---|---|
| P-02 | `The commitment` |
| P-03 | `Supported assets` |
| P-04 | `Tokens and supply` |
| P-05 | `Disclosures and limitations` |
| P-06 | `Supply and capacity` |
| P-10 | `Deployment manifest` |
| P-11 | `Traceability` |
| P-12 | `Registry data` |
| P-13 | `The specification` |
| P-14 | `Commitment rules` |
| P-16 | `Developer and verifier reference` |
| Repository | `Repository` |

**N-5 `Workspace` carries no modifier.** Not *Open Workspace*, not *Enter the
Workspace*, not *Launch app*, not *Sign in*. **`[ARCH]`** §5.6: a door, not an
invitation. A verb in the label is the invitation.

**N-3 is `Verification`, not `Verify`.** The illustrative label in Homepage
Product Specification §5.2 was explicitly non-normative. *Verify* is an
imperative addressed to the reader — an instruction about what to do — and
**`[ARCH]`** §5.9 requires a label to name a destination. The destination is the
verification material.

---

## 2.9 H-07 · Footer

**H-07.1** — body

> The Master Specification governs. Every page on this site, including this one,
> is subordinate to it. Where this site and the specification differ, the
> specification is correct and this site is defective.

**H-07.2** — routes (F-1, F-2, F-3)

> [The specification] · [Deployment manifest] · [Repository]

**H-07.3** — attribution

> Vinculum Protocol DAO LLC

**H-07.4** — appearance control (§3.4)

*The footer contains no disclaimer.* **`[ARCH]`** Visual §4.7: the non-promises
are H-02's, in body type, in full register. Repeating them quietly at the foot
would teach the reader which version is the real one.

---

# Part 3 · Interaction copy

**`[ARCH]`** §7.1: the homepage has no state-changing controls. The interactions
below are the complete set the frozen specification permits, and **no interaction
is invented here.**

## 3.1 Hover text — none

`[COPY]` **No `title` attributes, no tooltips, no hover-revealed text anywhere on
the page.** **`[ARCH]`** Visual §9.10 excludes tooltips from the system;
**`[ARCH]`** §7.3 excludes content behind hover. The only hover behaviour on the
page is the link underline thickening, which carries no text.

## 3.2 Expandable section labels — none

`[COPY]` **No region of the homepage is expandable.** **`[ARCH]`** §10.3: every
region fully expanded at every viewport. There are therefore no disclosure
labels, no *show more*, no *read less*, and no accordion headers.

## 3.3 Confirmation language — none

`[COPY]` No action on the page changes state, so nothing is confirmed. There is
no dialog, no modal, no *are you sure*, and no toast except §3.4's copy
acknowledgement.

## 3.4 Controls

`[COPY]` Four, all chrome.

| ID | Control | Copy |
|---|---|---|
| **X-1** | Mobile navigation, closed | `Menu` |
| **X-2** | Mobile navigation, open | `Close` |
| **X-3** | Hash copy control | `Copy hash` → on success: `Hash copied` |
| **X-4** | Appearance control | `Use dark appearance` / `Use light appearance` |

**X-1 is a word, not a glyph.** **`[ARCH]`** Visual §8.5: the system contains one
glyph and it is not a hamburger.

**X-3's success string is flat.** No checkmark, no *Copied!*, no exclamation.
**`[ARCH]`** Visual §9.13: a completed action is reported in the same voice as a
failed one. The string is announced to assistive technology and is not a
transient visual only.

**X-3 supplements selectable text and does not replace it.** **`[ARCH]`** §4.5.

## 3.5 Loading text — none required

`[COPY]` The page is static. **`[ARCH]`** §7.1: no client state, no writes, no
fetches.

Recorded for the rest of the product so it is not invented per-surface: **a
loading state is a sentence naming what is being fetched** — `Loading the
deployment manifest.` — in body type. **No spinner over content, no skeleton
shimmer.** **`[ARCH]`** Visual §9.13.

## 3.6 Unavailable-state wording

`[COPY]` **`[SPEC]`** VF-EXT-002. Applies pre-deployment to H-04.4, H-05.4 and,
where relevant, H-05.7.

**U-1** — availability tag, set in mono immediately after the item name:

> `not yet available`

**U-2** — the accompanying sentence, in body type, in the same register as the
item it follows:

> This is not yet available. The protocol is not deployed, so there are no
> deployed addresses and no bytecode to compare.

**U-3** — where a claim rests on evidence that does not yet exist, as at H-04.4:

> Until deployment, this is what the specification states rather than something
> that can be observed on-chain.

**Prohibited in every unavailable state:** `coming soon`, `launching soon`,
`shortly`, `expected`, `in progress`, `stay tuned`, any date, any placeholder
value, and any greyed-out treatment. **`[ARCH]`** §9.5, Visual §5.4.

**Post-deployment, U-1 through U-3 are removed and no other copy changes.**
**`[ARCH]`** §9.5, item 5.

---

# Part 4 · Information discipline

For each block: why the wording exists, which requirement it satisfies, and what
the obvious alternative was and why it was rejected.

## 4.1 H-01 · Identification

**Why.** A reader cannot evaluate a non-promise about a thing they cannot name.
H-01 supplies the referent and nothing else.

**Satisfies.** **`[ARCH]`** §4.1's required information, items 1–3; Q1.

**Rejected — the category sentence.** *Vinculum Finalis is a DeFi protocol for
unlocking liquidity from idle assets.* Three violations in eleven words:
*unlocking* and *liquidity* are economic promise vocabulary (**`[SPEC]`** §17.1),
*idle assets* is a judgement about the reader's holdings, and the category label
imports properties the specification does not contain.

**Rejected — the benefit inversion.** *Keep your assets where they are and still
put them to work.* States a benefit above the non-promises, violating
**`[ARCH]`** OC-1 outright.

**Rejected — softening the canonical term.** *That lock is called a vault.* The
Appendix B term is Commitment Vault Lock. **`[ARCH]`** Part 9: the product does
not coin friendlier synonyms for precise things.

**Note on H-01.1's negative definition.** Opening by saying what Vinculum is not
is unusual and was tested against §1.2's prohibition on self-description. It
survives because *company, fund, platform, service* are the four things a reader
will otherwise assume, and each carries an implied operator that **`[SPEC]`**
VF-IMM-001 excludes. The sentence corrects a default, it does not praise the
page.

## 4.2 H-02 · What is not promised

**Why.** **`[ARCH]`** Trust moment 1: the visitor learns the product will not
oversell, and everything after is read differently.

**Satisfies.** **`[SPEC]`** VF-TOK-015, VF-TOK-014, VF-PUB-003; **`[ARCH]`**
OC-1; §4.2's required information.

**Rejected — the announcing frame.** *Before we tell you what Vinculum does,
here is what it doesn't promise.* This was drafted, kept for a while, and cut. It
is the page congratulating itself on its own ordering — §1.2's exclusion — and it
also introduces a *we*. The ordering is a structural fact the reader experiences;
narrating it converts honesty into a claim of honesty.

**Rejected — the disclaimer register.** *Please note that no returns are
guaranteed.* *Please note* asks the reader to weigh the statement lightly, and
*returns* is forbidden vocabulary (§5).

**Rejected — the compensating clause.** *No appreciation is guaranteed, but the
supply is fixed and the emission schedule is public.* A true second half attached
to a limitation converts it into a setup. §1.6.

**On H-02.2's second half.** *…and nothing on this site should be read as one*
does double duty: it is a statement about the whole site's language, which
**`[SPEC]`** §17.1 makes true, and it forecloses the reading that silence
elsewhere implies a promise.

## 4.3 H-03 · What the protocol does

**Why.** Answers Q2 as mechanism. **`[ARCH]`** Map A's step order is
specification-stated and may not be reordered for presentation.

**Satisfies.** **`[ARCH]`** §4.3's required information, items 1–5; **`[SPEC]`**
§3.1, §12, VF-SUP-008.

**Rejected — the effortless framing.** *Simply lock your assets and receive
tokens.* *Simply* is forbidden (**`[ARCH]`** Part 9, Charter principle 5) and
*receive* frames issuance as a benefit conferred rather than a mechanism.

**Rejected — the productivity metaphor.** *Your assets keep working for you.*
Describes behaviour the specification does not contain — the asset does nothing;
it is timelocked.

**Rejected — omitting H-03.5.** Dropping *nothing reminds you* shortens the
region and reads better. It also conceals the single most consequential
operational fact for a participant: **`[ARCH]`** decision 2 CLOSED means no
notification exists, and **`[ARCH]`** *the user owns remembering.* A page that
implied otherwise would be inviting a mistake.

**Recorded addition — H-03.3.** *There is no early release path* restates
**`[SPEC]`** VF-PRI-006 and is not among §4.3's enumerated required information.
It was added because *duration fixed at creation* is genuinely ambiguous to a
newcomer — it can be read as "cannot be extended" rather than "cannot be exited"
— and leaving the sharper reading unstated is closer to concealment than to
scope discipline. **Marked `[COPY]`, recorded here rather than absorbed, and a
reviewer may strike it without violating any baseline.**

## 4.4 H-04 · The absence of control, and its cost

**Why.** **`[ARCH]`** PEA §5 assigns the concept *no one controls this* to S01 as
its introduction point. **`[ARCH]`** OC-3 requires the cost adjacent, sequential,
and in the same register.

**Satisfies.** **`[SPEC]`** VF-IMM-001, VF-IMM-006, §2; **`[ARCH]`** §4.4.

**Rejected — the property alone.** *Fully immutable. No admin keys. No
upgradeability.* Badge language: three fragments, each a boast, none with a cost
attached. **`[ARCH]`** Website Specification Phase 1 Part 2: this **must not read
as a boast.**

**Rejected — the safety inference.** *No one can touch your funds.* *Safe* and
its family are forbidden (§5), and the sentence is also false-adjacent: nobody
can touch the principal, and nobody can help either, which is the half the
framing drops.

**Rejected — `trustless`.** An industry term the specification does not use, and
a claim about a property rather than a description of a mechanism. §5.

**On the heading.** *No one controls this. No one can repair it either.* puts
OC-3's pair into the heading itself, so that a reader scanning headings meets the
cost at the same moment as the property. A heading of *No one controls this*
alone would satisfy the letter of OC-3 — the cost is two paragraphs below — and
fail its purpose.

**On H-04.3's construction.** The cost is attributed to the specification, not
volunteered by the page. *The specification states the cost of that choice rather
than leaving it to be discovered* is a factual attribution: **`[SPEC]`**
VF-IMM-006 exists. This matters because the page is not being generous; it is
quoting. **`[ARCH]`** Visual §5.6 makes the same point typographically.

## 4.5 H-05 · What can be checked

**Why.** **`[ARCH]`** Acceptance criterion 4 and the skeptic's route.

**Satisfies.** **`[ARCH]`** §4.5's required information; decisions 14 and 21,
CLOSED; PEA §7.4.

**Rejected — the slogan.** *Don't trust. Verify.* It is an imperative telling the
reader how to feel about the product, it is a borrowed piece of movement
vocabulary the specification does not contain, and it is a claim of alignment
rather than a description of an artifact.

**Rejected — the evidence of rigour.** *Audited · 128 tests passing · 100%
requirement coverage.* **`[SPEC]`** VF-VER-006 prefers independent reproduction
over self-reported passes; **`[ARCH]`** §4.5 excludes any count. H-05.7 states
the exclusion in the copy itself so a reader who came looking for a number learns
why there isn't one.

**Rejected — describing the destinations' quality.** *Our comprehensive
deployment manifest.* Every adjective of quality applied to the product's own
artifacts is excluded by §8.2's test.

**On H-05.1.** The list of five things not required is longer than *no wallet
needed* and is kept at that length deliberately. **`[ARCH]`** §4.5: stated
explicitly rather than left to be inferred, because *the visitor cannot observe an
absence until they have already committed to clicking.*

**On H-05.3.** The hash label names the document and the algorithm and stops.
**`[ARCH]`** §4.5: *the same string, in two positions, is either an ornament or
an instrument.* The instrument is H-05.2's sentence saying what it lets the
reader do; the label is only identification.

## 4.6 H-06 · Where to go from here

**Why.** Q4. **`[ARCH]`** §4.6: the routes, named by destination, nothing else.

**Rejected — the closing invitation.** *Ready to get started?* A call to act,
placed after the reader has met three of the eight commitment prerequisites.
**`[ARCH]`** §7.3.

**Rejected — route descriptions.** *Supported assets — see which assets qualify
and where.* One line each would help. §4.6's required information is explicit:
**nothing else.** The line was cut, and the loss is real and accepted: a reader
must click to find out what a destination holds, which is a small cost against
the certainty that no route is being sold.

**Rejected — the departure sentence.** *You're welcome to leave; nothing here
will chase you.* True, and excluded. **`[ARCH]`** §7.4 makes departure a
structural property — no capture, no exit intent, nothing that behaves
differently for a returning visitor. Saying it out loud is the page describing
its own virtue. §1.2.

## 4.7 H-07 · Footer

**Why.** **`[ARCH]`** PRC-01's consequence: no product surface may position
itself as the authoritative description of protocol behaviour.

**Rejected — the standard footer disclaimer.** *Nothing on this site constitutes
financial advice. Cryptocurrency involves risk.* Generic, unsourced, and set in
the quiet voice §1.6 forbids. The site's actual disclosures are H-02 and P-05,
in full register.

**Rejected — the copyright assertion.** The specification is a preserved public
artifact; asserting rights over it would contradict **`[SPEC]`** §17.1's purpose.
Attribution is the entity name and nothing more.

**On H-07.1's third sentence.** *Where this site and the specification differ,
the specification is correct and this site is defective* is unusually blunt for a
footer. It is the exact sentence every derivation artifact in the baseline
carries about itself, applied to the public surface. It is also the strongest
single sentence available for §1.8's purpose: it tells the reader where to go
when they doubt the page.

---

# Part 5 · Vocabulary register

Classifications follow the Product Design Charter, **`[SPEC]`** §17.1, and
**`[ARCH]`** Website Specification Phase 1 Part 9. **Part 9 records its own
table as `[DESIGN]` editorial guidance derived from Charter principles 4, 5 and 6
— only the economic-promise rows restate an actual `[SPEC]` prohibition.** That
distinction is preserved below rather than flattened.

## 5.1 Preferred

| Term | Why |
|---|---|
| **Commitment Vault Lock** · **Commitment Vault principal** · **approved asset** · **Dev Fund** · **maturity** | Appendix B canonical terms. `[SPEC]` |
| **lock**, as a verb | Plain English for what happens, and consistent with the canonical noun |
| **issued** / **issuance** | The specification's own verb for what happens on Base |
| **release** | `[SPEC]` §12's verb; user-initiated is implied by it |
| **verified** / **verification** | Names the protocol step, not a marketing state, when applied to the lock evidence |
| **check** | The reader's action. Preferred over *verify* in second person, which reads as an instruction |
| **evidence** | What the reader is given. Neutral, and it is the architecture's own word |
| **not yet available** | The fixed unavailability phrase. `[SPEC]` VF-EXT-002 |
| **cannot** / **does not** / **no one** | Direct negation. Preferred over passive constructions that hide the actor |
| **environment** or **chain** | Both appear in the specification; either is exact |

## 5.2 Discouraged — permitted only where exact

| Term | Why discouraged | Where permitted |
|---|---|---|
| **trust** | Charter principle 4 makes trust the thing the product declines to request | Only inside the canonical term **Trust-Building Handshake**, and that term does not appear on the homepage (OC-5) |
| **secure** | Reads as reassurance; not a property the specification claims | Never on the homepage. Elsewhere only in the exact sense of cryptographic security of a named mechanism |
| **verify**, imperative | An instruction about how to feel about the product | As a verb describing the protocol's step, or a developer's action — not addressed to the reader as a slogan |
| **position** | Canonical for Treasury Reward Stake only; ambiguous elsewhere | Participation surfaces |
| **support** / **supported** | *Supported assets* is the accepted page name; the word otherwise implies an operator providing support | The page name P-03 only |
| **users** | Canonical in Appendix B, but *you* is clearer in second-person sentences | Where the specification is being restated |

## 5.3 Forbidden

**No sentence on any public Vinculum surface contains these.**

| Term | Classification source |
|---|---|
| **investment**, **invest**, **investor** | `[SPEC]` §17.1 — an economic promise by category |
| **earn**, **yield**, **APY**, **APR**, **returns**, **profit**, **gains**, **passive income** | `[SPEC]` §17.1; `[ARCH]` Part 9. Each asserts a future value outcome, which `[ARCH]` decision 20 defines as the test |
| **guaranteed**, **assured** | `[SPEC]` VF-TOK-015 guarantees nothing. Permitted only in the negative construction *is guaranteed* following *no*, as at H-02.1 |
| **safe**, **risk-free**, **protected**, **insured** | `[SPEC]` VF-TOK-015; `[ARCH]` Part 9. Also false: `[SPEC]` VF-IMM-006 states a defect cannot be repaired |
| **simple**, **simply**, **just**, **easy**, **effortless**, **seamless** | `[ARCH]` Part 9, from Charter principle 5. *Simply stake* conceals the rule that costs entitlements. `[DESIGN]`-class, and stricter than `[SPEC]` requires — recorded as such |
| **trust us**, **rest assured**, **you don't need to worry** | `[ARCH]` Part 9, from Charter principle 4, directly |
| **we've handled that for you**, **automatically**, **hands-free**, **set and forget** | `[ARCH]` Part 9, from Charter principle 6. Also false: `[SPEC]` §12 makes release user-initiated |
| **revolutionary**, **next-generation**, **cutting-edge**, **unlocking**, **empowering**, **game-changing** | `[ARCH]` Part 9 — adds features the specification does not contain |
| **don't miss**, **limited**, **act now**, **early**, **before it's gone**, **spots remaining** | `[ARCH]` Part 9, Part 2 — urgency the protocol does not contain |
| **trustless**, **non-custodial**, **battle-tested**, **audited** *(as an adjective on the product)* | Industry vocabulary the specification does not use, each asserting a property rather than describing a mechanism. `[SPEC]` §17.1's second prohibition |
| **deposit**, **bridge**, **transfer to**, **custody** | Materially false. `[SPEC]` §3.1: source principal does not move to Base |
| **TVL**, **total value locked**, **community**, **ecosystem**, **roadmap**, **journey** | `[ARCH]` §9.6's exclusions expressed as vocabulary; each names a thing the product does not have |

**Two notes on the classifications.**

**`Guaranteed` is forbidden as an assertion and required as a negation.**
**`[SPEC]`** VF-TOK-015's own sentence contains it. The distinction is
grammatical: *X is guaranteed* is prohibited; *no X is guaranteed* is the
specification.

**`Simply` and its family sit at `[DESIGN]`, not `[SPEC]`.** **`[ARCH]`**
Website Specification Phase 1 Finding 7 records that Part 9's table is stricter
than any accepted artifact requires, and that a reviewer may reject the extension
without violating a baseline. Recorded so this document does not present editorial
guidance as a requirement.

---

# Part 6 · Reading order verification

The completed copy is checked against each frozen ordering constraint.

| Constraint | Requirement | How the copy satisfies it |
|---|---|---|
| **OC-1** | No statement of what the protocol offers may appear above the non-promises | H-01.1–H-01.3 are definitional: they name what Vinculum is and state that the asset does not move. **No sentence in H-01 states a benefit, an outcome, or a reason to participate.** The first sentence describing what the protocol does for anyone is H-03.2, which is below all of H-02. |
| **OC-2** | No participation invitation above the verification route | H-05 contains every verification route (R-06 through R-10). The first route toward participation surfaces is R-11/R-12 in H-06, below it. H-03.6's routes go to P-02 and P-14, which are explanatory reference pages, not participation surfaces. |
| **OC-3** | No claim about the absence of control without its cost, in the same register | The pair is in the heading (H-04.0), then in prose: property at H-04.1–H-04.2, cost at H-04.3, with no intervening heading and no transition device. Both halves are body copy of the same construction and length class. |
| **OC-4** | No participation mechanics anywhere | Scan for *stake, staking, weight, multiplier, epoch, eligibility, entitlement, claim, extend, withdraw, forge, portability* returns **zero** across Part 2 and Part 3, including navigation labels and the footer. |
| **OC-5** | No Trust-Building Handshake content | Scan returns **zero**. §5.2 records the one place the word *trust* would be permitted and confirms it does not appear on this surface. |
| **OC-6** | No Workspace route in the page body | The string `Workspace` appears once in Part 2, at N-5, in persistent navigation. It appears nowhere in H-01 through H-07. |

**Limitations receive equal dignity — checked as language.** H-02.1, H-03.3,
H-03.5, H-04.3 are the page's four limitation statements. Each is: a complete
declarative sentence; in the same voice as its neighbours; not preceded by a
frame; not followed by a compensating clause; not hedged by an adverb; and not
attributed to caution. Test T-6.

**Workspace remains a door.** N-5 is a bare noun. It carries no verb, no
modifier, no adjacent sentence, and no presence in the body. §2.8.

---

# Part 7 · Traceability index

Every block, with its marking. `[COPY]` entries carry their derivation in Part 4
at the section noted.

| Block | Marking | Source |
|---|---|---|
| D-1, D-2, D-3 | `[COPY]` | §4.1; `[SPEC]` §17.1 governs D-2 as public language |
| H-01.1 | `[COPY]` from `[SPEC]` VF-IMM-001 | §4.1 |
| H-01.2 | `[SPEC]` §3.1, Appendix B | — |
| H-01.3 | `[SPEC]` §3.1 | — |
| H-02.0 | `[ARCH]` §3.1 region name | — |
| H-02.1 | `[SPEC]` VF-TOK-015 | Restated, not paraphrased |
| H-02.2 | `[COPY]` from `[SPEC]` §17.1 | §4.2 |
| H-02.3 | `[SPEC]` VF-TOK-014, VF-PUB-003 | — |
| H-03.1, H-03.2 | `[SPEC]` §3.1, §3.2; `[ARCH]` Map A step order | — |
| H-03.3 | `[COPY]` from `[SPEC]` VF-PRI-006 | §4.3, recorded addition |
| H-03.4 | `[SPEC]` §12, VF-SUP-008 | — |
| H-03.5 | `[SPEC]` §12, VF-PRI-005; `[ARCH]` decision 2 | §4.3 |
| H-04.0 | `[COPY]` | §4.4 |
| H-04.1 | `[SPEC]` VF-IMM-001 | Restated in full |
| H-04.2 | `[SPEC]` §2 | — |
| H-04.3 | `[SPEC]` VF-IMM-006 | §4.4 |
| H-04.4 | `[COPY]` from `[ARCH]` decisions 14, 21 | §4.5 |
| H-05.0, H-05.1 | `[COPY]` from `[ARCH]` PEA §7.4 | §4.5 |
| H-05.2, H-05.3 | `[ARCH]` decision 14 | — |
| H-05.4 | `[SPEC]` §17.1 | — |
| H-05.5 | `[SPEC]` §17.1 | — |
| H-05.6 | `[ARCH]` P-16 | — |
| H-05.7 | `[OPEN]` 5 | §12.2 of the Homepage Product Specification |
| H-06.0, H-06.1 | `[ARCH]` §4.6 | — |
| N-1 – N-5 | `[COPY]` | §2.8 |
| H-07.1 | `[SPEC]` §17.1; `[ARCH]` PRC-01 | §4.7 |
| H-07.2, H-07.3 | `[ARCH]` §4.7 | — |
| X-1 – X-4 | `[COPY]` | §3.4 |
| U-1 – U-3 | `[SPEC]` VF-EXT-002 | §3.6 |

**No block traces only to this document.** Every `[COPY]` entry above resolves
to a `[SPEC]` requirement or an `[ARCH]` obligation; the `[COPY]` marking records
that the *wording* was chosen here, not that the *content* originates here.

---

# Part 8 · Acceptance tests

Objective, applied to Part 2 and Part 3 as written. **All must pass.**

**T-1 · Source test.** Every sentence resolves to a `[SPEC]` requirement, an
`[ARCH]` obligation, or a structural function (a heading, a route label). A
sentence that resolves to none is removed. **Method:** Part 7's index must
account for every block, and every block must contain only sentences its source
supports.

**T-2 · Evaluative adjective test.** Scan for adjectives of quality applied to
the protocol, the product, or its artifacts: *powerful, robust, comprehensive,
elegant, seamless, innovative, secure, safe, simple, easy, advanced, best,
leading*. **Expected result: zero.**

**T-3 · Imperative test.** Scan for imperative verbs addressed to the reader.
**Expected result: zero outside control labels** (X-1 through X-4, D-3), which
name what the control does. *Get started*, *Verify*, *Join*, *Discover*,
*Explore* all fail.

**T-4 · Forbidden-term scan.** §5.3's list. **Expected result: zero**, with the
single permitted exception of *guaranteed* in the negation at H-02.1.

**T-5 · Deletion test.** Remove each sentence in turn. If the page still answers
all four questions and still satisfies every required-information item in
Homepage Product Specification §4, the sentence is unnecessary and is cut.
**Applied; cuts recorded at Part 4.**

**T-6 · Limitation register test.** For each of the four limitation statements:
no preceding frame, no following compensating clause, no hedging adverb, no
attribution to caution, and sentence length within one standard deviation of the
page's mean. **Expected result: four passes.**

**T-7 · Certainty test.** Scan for future-tense claims about value, availability,
listing, timing, or what a participant will have. **Expected result: zero.** The
only future-tense constructions permitted are statements of fixed protocol rules
(*the lock reaches maturity at the end of the duration*).

**T-8 · First-person test.** Count of *we, our, us, ours*. **Expected result:
zero.**

**T-9 · Self-description test.** Scan for any sentence describing the page's own
honesty, transparency, rigour, or difference from alternatives. **Expected
result: zero.** This test catches the failure §1.2 exists to prevent and is the
one most likely to fail on revision.

**T-10 · Ordering test.** Part 6's six checks. **Expected result: six passes at
every viewport**, since inline citations and route order change with layout.

**T-11 · Word-count ceiling.** Canonical body copy — body paragraphs and list
items only, excluding headings, route labels and the hash string — **must not
exceed 750 words. Currently 608.** A revision that pushes past the ceiling is
evidence the page has begun explaining rather than orienting, and must be
reviewed against Homepage Product Specification §11.3 rather than simply trimmed.

**T-12 · Defensibility test.** For each claim, a reviewer holding only the ten
baseline artifacts must be able to name the artifact that supports it, without
consulting this document. **A claim defensible only by reference to this
document's reasoning is not defensible.**

---

# Part 9 · Recorded notes

**9.1 · The one addition beyond required information.** H-03.3's *There is no
early release path*. Derivation, reasoning and the reviewer's option to strike it
are at §4.3.

**9.2 · `[OPEN]` 5 is the only decision that changes this copy.** If traceability
is not published, H-05.7 is absent and no other string changes. **`[ARCH]`**
Homepage Product Specification §12.2.

**9.3 · Terminology tension, recorded not resolved.** *Commitment Vault Lock* is
a five-syllable canonical term appearing in a page written for a reader assumed
to have no blockchain fluency. §1.3 resolves this in favour of the canonical term
and against a friendlier synonym, on **`[ARCH]`** Part 9's authority. **A
reviewer should test whether the surrounding sentences carry the term
successfully for the Intelligent Newcomer.** If they do not, the correction is
better sentences, not a different noun.

**9.4 · The copy is shorter than the page's regions might suggest.** Six of the
seven regions run three to five sentences. This is deliberate and follows from
**`[ARCH]`** §1.4: the homepage does not attempt E2 Understanding, and every
region routes onward for depth rather than supplying it.

**9.5 · Pre-deployment and post-deployment copy are the same copy.** Only U-1
through U-3 are added and removed. **`[ARCH]`** §9.5 item 5 requires it: *no copy
is rewritten; only the availability treatment changes.* This is a constraint on
future revisions as much as on launch.

---

# Revision policy

**Revise when:** an accepted artifact is revised · the governing specification
hash changes, which changes H-05.3 · `[OPEN]` 5 is resolved · a term's canonical
meaning changes in Appendix B · an acceptance test fails.

**Do not revise to:** improve engagement · add a sentence because a region looks
short · soften a limitation · adopt an industry term because readers expect it ·
add a route description · resolve an open decision by assertion.

**`[SPEC]`** VF-PUB-001 makes a specification revision a product event. **This
page carries `[SPEC]`-derived statements in four regions and publishes the
governing hash. It is the surface where a stale specification becomes publicly
visible**, and it falls due for review before anything else on the site.

**Corrections are recorded visibly.** **Version numbers are whole integers.**

---

*Derived from Homepage Product Specification v1, Homepage Visual Design
Specification v1, and the ten accepted baseline artifacts, governed by Master
Specification Revision 6, hash
`5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9`. Region
labels H-01–H-07, ordering constraints OC-1–OC-6, route identifiers R-01–R-14 and
navigation identifiers N-1–N-5 originate in prior artifacts and are used without
modification. Copy block identifiers, control identifiers X-1–X-4, unavailability
strings U-1–U-3 and test identifiers T-1–T-12 are document-local and carry no
specification authority. Attribution: Vinculum Protocol DAO LLC.*
