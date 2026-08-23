# Presentation Map — §3.2 Protocol Flow

**Derived from:** Master Specification Revision 6, hash
`5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9`

> **This is an information architecture artifact, not a governing document.**
> It does not define protocol behaviour. It maps the journey §3.2 already
> defines onto what users see, what they can verify, and where each step
> appears.

## How to read the markings

| Marking | Meaning |
|---|---|
| **[SPEC]** | Stated in the Master Specification. Not a choice. |
| **[DESIGN]** | A product decision. Ours to make and to change. |
| **[OPEN]** | A product decision **not yet made**. Deliberately unresolved. |

**Nothing marked [SPEC] may be altered by product design. Nothing marked
[DESIGN] or [OPEN] may be presented as a specification requirement.**

## The rule this map exists to enforce

Every page, panel and document must answer:

> **Which step of the §3.2 flow does this help someone understand, perform,
> or verify?**

A page that supports no step for any audience does not belong.

---

## The design principle

**The protocol informs. The user decides.**

This is not a slogan chosen for the product — it is what the specification
already does. §12 makes principal release user-initiated rather than pushed.
VF-XCH-012 gives the relayer no authority. §2 removes all post-deployment
control. The application follows the same posture: **an instrument panel, not
an autopilot.**

Notifications, where they exist, are optional conveniences. The protocol never
depends on them and the journey is never notification-driven.

---

## Audiences

Six, with different goals through the same flow.

| Audience | Needs |
|---|---|
| First-time visitor | What is this? Why care? Is it legitimate? |
| Prospective participant | How does a commitment work? What do I lock? What are the risks? |
| Existing participant | What's happening with my commitments, staking, rewards? |
| **Verifier** | Can I independently verify every claim? |
| Developer | Contracts, architecture, documentation |
| **Skeptic** | What could go wrong? What has been disclosed? |

The verifier and the skeptic are **first-class audiences, not edge cases.**
§16 is an entire specification section on verification and traceability, and
VF-ORC-016 mandates disclosure of an accepted risk. The specification spends
real weight on being checkable.

---

# The eight steps

## Step 1 — Selection

**[SPEC] Protocol action.** The user selects an approved source asset, a
nonzero amount, a permitted duration, one currently available output token,
and one valid Base-chain recipient.

Constraints: §5.1 permits only the listed durations and multipliers, no
interpolation (VF-COM-001, VF-COM-002). §6 governs the 1,001-asset registry.
VF-ARC-006 permits the Base recipient to differ from the source wallet.

**[SPEC] User experience.** The one-hour duration is available *only* through
a qualifying Trust-Building Handshake (VF-COM-026).

**[DESIGN] User experience.** Asset browse and search; duration presented with
its multiplier; a preview of the calculated output.

**Evidence.** The Approved Asset Registry is published and immutable after
finalization. Any user can confirm an asset's presence, class and precision
independently.

**Surface.** Supported Assets (public) · Lock workflow (app) · Duration and
multiplier reference (docs) · Registry statistics (dashboard)

---

## Step 2 — Preflight, before assets move

**[SPEC] Protocol action.** Before assets move, the source application
performs every available registry, amount, price-reference,
output-availability, fee, and recipient preflight check. VF-ARC-004: a
known-invalid request must be rejected before fee or principal assets move.

**[SPEC] User experience — §5.2.2 specifies this step in detail.** The
application must check: the applicable Handshake allowance; an already-used
identity; an objectively pending attempt by the same identity; a recognized
attempt awaiting finality; duplicate submission; the approved asset and
identity; the qualifying value range; fee and principal calculations;
output-token availability; and recipient and release-destination binding.

**The interface must clearly warn** that an independently constructed or
broadcast source transaction can move or timelock assets without creating
Vinculum rights, and that any fee actually transferred to the Dev Fund is
non-refundable.

**[SPEC] Constraint.** VF-ORC-015 (Rev 7 candidate): a price record older than
forty-eight hours is invalid, measured from the publication timestamp inside
the signed record. An asset without a valid price cannot be valued, so the
operation fails closed.

**[DESIGN] User experience.** How failures are explained — particularly an
unavailable asset, which is a price-freshness condition rather than an error.

**Evidence.** The price record is signed and its publication timestamp is
readable. A user can confirm the valuation used and its age.

**Surface.** Lock workflow (app, primary) · Price freshness panel (dashboard)
· Non-refundable fee warning (app, required) · Fee and rounding rules (docs)

---

## Step 3 — Source transaction

**[SPEC] Protocol action.** The source mechanism transfers the actual rounded
fee to the fixed Dev Fund destination in the original asset, and places the
remaining principal into the source-chain Commitment Vault Lock.

Fee: 2.50% for a qualifying Handshake (VF-COM-004), 5.00% for standard
durations (VF-COM-009). VF-PRI-001: the fee is removed at creation; the
remaining principal is what matures. VF-FEE-013 (Rev 7 candidate): the Dev
Fund destination is a source-environment-native address.

**[SPEC] User experience.** **The source asset never leaves its chain.** §1:
"The source asset remains on its original blockchain for the entire Commitment
Vault Lock." VF-ARC-002 states it as a requirement.

**[DESIGN] User experience.** Transaction construction and signing; the
confirmation view; how the fee split is shown before signing.

**Evidence.** The source transaction is public on its own chain. The fee
transfer to the Dev Fund and the timelock holding the principal are both
independently verifiable in a block explorer.

**Surface.** Lock workflow (app) · Explorer links per environment (app,
dashboard) · "Your asset never moves" (public, trust cluster) · Fee routing
(docs)

---

## Step 4 — Finality

**[SPEC] Protocol action.** The Commitment Vault Lock reaches the
deterministic finality condition required for that source environment. §11.2;
per-environment rules in Architecture C.1–C.17.

**[SPEC] User experience — §5.2.3 constrains this hard.** Elapsed time,
mempool disappearance, failure to appear within an estimated window, and
application-local abandonment timers **are not proof** that a transaction can
no longer become recognized.

A pending attempt clears only on objective chain-native evidence: a consumed
account nonce; a consumed input by a finalized conflicting transaction; a
genuine chain-native expiry rule; or a finite validity bound that passes.

**This rules out the obvious interface pattern.** No spinner that gives up, no
"transaction expired" after an interval. The application must recheck
objective source-chain disposition and Base recognition state before
authorizing another submission.

**[DESIGN] User experience.** How a pending state is displayed honestly —
showing what is known, what is awaited, and what evidence would resolve it.

**Evidence.** Confirmation depth, block inclusion and finality status are all
readable from the source chain.

**Surface.** Commitment tracking (app) · Pending attempt disposition (app,
required behaviour) · Per-environment finality rules (docs) · Explorer links

---

## Step 5 — Proof

**[SPEC] Protocol action.** A normalized proof or attestation binds the
completed source event and all data required by §11. §11.3 governs acceptance.
VF-XCH-012: the relayer cannot alter contents, choose the output, redirect, or
approve — a signature does not establish truth. VF-SEC-005: the submitter
obtains no parameter or value authority.

**Submission is permissionless.** Anyone may submit, including the user, and
it changes nothing about the outcome.

**[OPEN] Product decision — the application's role in constructing or
assembling the proof is intentionally left open** until the application
workflow is designed.

Two alternatives, to be evaluated then, not now:
- the application assembles the proof and the user reviews and submits, or
- the user constructs the proof independently and the application documents
  and submits it.

Current preference — **the application assists the user rather than requiring
manual assembly of protocol artifacts; the application exists to simplify
interaction with the protocol, not to become the protocol** — is a product
preference and **not** a specification requirement. It remains open.

**Evidence.** The proof binds the VF-XCH-011 fact set. Every field is derived
from public chain data and independently reconstructible.

**Surface.** *Depends on the [OPEN] decision.* The evidence schema belongs in
documentation and on the verification page regardless.

---

## Step 6 — Base verification

**[SPEC] Protocol action.** The Base verification layer validates source
finality, registry identity, fee routing, price record, output eligibility,
lifetime capacity, recipient binding, and replay protection.

**[SPEC] User experience.** VF-ARC-005: proof submission or retry cannot
change the source event, output token, recipient, valuation, duration, or
maturity. A retry is a retry, never a revision.

**[DESIGN] User experience.** How a verification failure is explained, and
what the user can do next.

**Evidence — this is the verifier's step.** Every check is on-chain and
re-executable. The chain verifier for each environment is a published,
immutable contract. A skeptic can read the code that decides, and confirm the
verification transaction.

**Surface.** Mint status (app) · **AI verification (public, §16)** ·
Verification statistics (dashboard) · Verifier contracts (docs, developer)

---

## Step 7 — Issuance

**[SPEC] Protocol action.** After successful verification, the complete
calculated quantity of exactly one selected output token — VCLM or activated
CHONX — is issued to the bound Base-chain recipient. **The same Commitment
Vault Lock never produces both** (VF-ARC-003).

§13 governs lifetime capacity and activation gates. Issuance consumes lifetime
capacity permanently; burns do not restore it (VF-SUP-003). CHONX activates at
10,000,000 cumulative lifetime VCLM; SYNTH at 100,000,000 cumulative CHONX.

**[DESIGN] User experience.** Issuance confirmation; portfolio update;
Reward-Accounting Credit recording (§9).

**Evidence — the strongest transparency surface.** Cumulative lifetime
issuance, remaining capacity and activation progress are all public on-chain
state. §13 is the dashboard's spine.

**Surface.** **Protocol transparency dashboard (§13 — lifetime issuance,
remaining capacity, activation progress)** · Portfolio (app) · Token
statistics (public) · Issuance references and decay (docs)

---

## Step 8 — Maturity and release

**[SPEC] Protocol action.** At maturity, the user who created the Commitment
Vault Lock may reclaim the remaining source-chain principal **independently of
Base issuance or any external service.**

VF-PRI-002: released once only. VF-PRI-003: only to the destination bound at
creation. VF-PRI-004: no price reference or oracle call required.
VF-PRI-005: no Base issuance, epoch calculation, staking, registry update,
relayer or administrator required. VF-PRI-006: no early release path.

**[SPEC] The trust story, stated by the specification itself.** §12:

> *"If Base verification fails permanently and no output token is issued, the
> source-chain Commitment Vault Lock still matures and its principal remains
> releasable under the same fixed maturity rule."*

**The protocol can fail completely and the user still recovers their asset.**

**[SPEC] User experience.** Release is user-initiated, not automatically
pushed.

**[DESIGN] User experience.** Maturity dates, countdowns and claim
availability displayed prominently so users can schedule their own reminders.
**The user owns remembering.** Optional notifications may be added later as a
convenience and must never become a protocol assumption.

**Evidence.** The timelock and its maturity are readable on the source chain.
The release transaction is public.

**Surface.** Your commitments with countdowns (app) · **Principal safety
(public, trust cluster)** · Release workflow (app) · Maturity rules (docs)

---

# What falls out of the map

## The trust cluster

§2 (immutable control), §12 (principal safety), §14 (fail-closed) and §15
(deployment finalization) are scattered across the specification but form one
story: **no one controls this, and your asset comes back even if everything
else fails.**

In the product they should be one narrative, not four pages.

## The dashboard's spine

§13 — lifetime issuance, remaining capacity, CHONX and SYNTH activation
progress. A single specification section, and the surface where someone
watches the protocol work.

## A specification-mandated disclosure

**VF-ORC-016 (Rev 7 candidate) requires disclosure**, not merely permits it:
compromise of the price signing key can compromise valuation for the life of
the protocol; permanent loss halts issuance while principal release continues
unaffected. *"These consequences are accepted, and shall be disclosed under
VF-EXT-002."*

A page most projects would never write. Given the immutability position, it
earns trust rather than costing it.

## The entry experience is already designed

§5.2 — the Trust-Building Handshake. A one-hour lock at approximately one
dollar that walks the entire lifecycle. **The onboarding path exists in the
specification.** Three uses per identity where the source mechanism maintains
persistent state; one where it does not (VF-COM-006).

## Two protocol implementations, by design

Rev 7 Appendix A2: the Solidity contracts are the production target; a
JavaScript layer drives the live preview. **Divergence is expected. The
preview layer is not duplication.** A user can see what a lock would produce
before committing to one.

---

# Open product decisions

Recorded here so they are made deliberately rather than absorbed into a page.

| # | Decision | Affects |
|---|---|---|
| 1 | The application's role in proof construction | Step 5, and the app's overall thickness |
| 2 | Whether optional notifications are offered | Step 8 convenience only, never protocol |
| 3 | Which audience the home page primarily serves | Home page only; other paths serve other audiences |
| 4 | How much the trust cluster explains versus asserts | Public pages |
