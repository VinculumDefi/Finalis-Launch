# Presentation Map — v2

**Derived from:** Master Specification Revision 6, hash
`5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9`

> **Information architecture artifact, not a governing document.** It defines
> no protocol behaviour. It maps what the specification already states onto
> what users see, what they can verify, and where each obligation appears.

## Markings

| Marking | Meaning |
|---|---|
| **[SPEC]** | Stated in Master Specification Revision 6. Not a choice. |
| **[REV7]** | Proposed in `REVISION_7_CANDIDATE_AMENDMENTS.md`. **Not governing.** Recorded so product work anticipates it, never treated as binding. |
| **[DESIGN]** | A product decision. Ours to make and change. |
| **[OPEN]** | A product decision deliberately not yet made. |

**Nothing marked [SPEC] may be altered by product design. Nothing marked
[DESIGN], [OPEN] or [REV7] may be presented as a specification requirement.**

## Corrections applied in v2

v1 contained four classification errors, each recorded here rather than
silently fixed.

| v1 claim | Correction |
|---|---|
| VF-ORC-015, VF-FEE-013, VF-ORC-016 marked `[SPEC]` | **Rev 7 candidates.** Not in Rev 6. Now `[REV7]`. |
| "VF-ORC-016 mandates a public disclosure page" | VF-EXT-002 requires unfinished deliverables be *reported as incomplete rather than replaced with invented values*. A documentation obligation. The public surface is `[DESIGN]`. |
| "AI verification (public, §16)" | §16 is test-and-traceability discipline (VF-VER-001 to 008), not a page requirement. Publishing traceability is `[DESIGN]`. |
| Audiences, design principle, trust cluster, dashboard spine presented as observations | All four are `[DESIGN]`. |

---

## Scope of this map — corrected in v2

**§3.2 is the Commitment Vault Lock journey. It is not the whole product.**

v1's filter — *which step of §3.2 does this help someone understand, perform,
or verify?* — would exclude Treasury Reward Stake (§10), the SYNTH forge,
epoch claiming (§9), transferability (§4.3) and Axelar portability (§11.4).
Those are real capabilities and the filter must not exclude them.

**Corrected filter:**

> Every product element must help one or more audiences **understand, perform,
> or verify** either (a) a step of the §3.2 flow, or (b) a named
> post-issuance capability defined by the specification.

Post-issuance capabilities requiring their own presentation basis, not yet
mapped: **§9 epoch reward claiming · §10 Treasury Reward Stake · SYNTH forge ·
§4.3 transferability · §11.4 Axelar portability.**

---

## [DESIGN] Design principle

**The protocol informs. The user decides.**

A product decision, supported by specification behaviour: §12 makes principal
release user-initiated; VF-XCH-012 gives the relayer no authority; §2 removes
post-deployment control. The application is an instrument panel, not an
autopilot. Notifications are optional conveniences; the journey is never
notification-driven.

## [DESIGN] Audiences

First-time visitor · prospective participant · existing participant ·
**verifier** · developer · **skeptic**.

Verifier and skeptic are treated as first-class rather than edge cases —
a `[DESIGN]` judgement supported by §16's weight on traceability and
VF-VER-006's preference for independent reproduction.

---

# Cross-cutting overlays

**New in v2.** Several specification obligations span multiple steps and
belong nowhere in particular in a linear flow. Placing them inside one step
misrepresents them; omitting them loses them. They are overlays.

## O1 · Absence of control — §2, §15

**[SPEC]** No governance, no admin, no upgrade path, no pause authority
(VF-IMM-001 to 006). VF-IMM-004: no temporary control may remain on the theory
it will be removed later. §15's finalization ceremony is one-way.

**Spans:** every step. It is the precondition under which all eight occur.

**Evidence:** deployed contract code; the finalization transaction.
**Available only post-deployment.**

## O2 · Fail-closed behaviour — §14

**[SPEC]** VF-SEC-003 is load-bearing: no failure path may substitute a
default asset, price, environment, user, recipient, output, duration,
multiplier, or Dev Fund destination. VF-SEC-002 prevents reentrancy, duplicate
issuance and partial-accounting states. VF-SEC-004: the lock identifier is
consumed only after successful issuance.

**Spans:** steps 1, 2, 4, 5, 6, 7.

**Evidence:** contract code; reverted transactions produce no state change.

## O3 · Verification and traceability — §16

**[SPEC]** Every meaningful test and deployment check traces to numbered
requirements (VF-VER-001). Independent reproduction outranks self-reported
pass counts (VF-VER-006). Nothing is production-ready merely because it
compiles (VF-VER-007). Code does not prevail over specification by default
(VF-VER-008).

**Spans:** every step.

**[SPEC] The requirement is independent verification.** VF-VER-006: independent reproduction is stronger evidence than self-reported pass counts. The specification obliges the protocol to be independently verifiable.

**[DESIGN] Any concrete verification surface is a product choice.** An AI Verification page, a published traceability matrix, an explorer-linked audit view — each is one implementation of that requirement; none is mandated by it. Retagged per independent review, 2026-08-23.

**Evidence:** the traceability matrix; the test suites; evidence artifacts.

## O4 · Supply accounting and activation gates — §13

**[SPEC]** Cumulative lifetime issuance is monotonic; burns do not restore
capacity (VF-SUP-003). Activation uses cumulative lifetime issuance
(VF-SUP-004). CHONX activates at 10,000,000 cumulative VCLM; SYNTH at
100,000,000 cumulative CHONX.

**Spans:** constrains step 1 (which outputs are selectable), decides steps 6
and 7 (capacity), and gates post-issuance capabilities.

**Evidence:** on-chain state, readable by anyone. **Available only
post-deployment.**

## O5 · Handshake allowance lifecycle — §5.2

**[SPEC]** Three uses per bound identity where the source mechanism maintains
persistent atomic state; one otherwise (VF-COM-006). Rejected attempts consume
no allowance (VF-COM-008). The one-hour duration is available only through a
qualifying Handshake (VF-COM-026).

**Spans:** steps 1, 2, 3.

**Evidence:** allowance state on Base; source-chain attempt history.

## O6 · Pending attempt disposition — §5.2.3

**[SPEC]** Elapsed time, mempool disappearance and application timers are not
proof. Clearing requires objective chain-native evidence: consumed nonce,
consumed input by a finalized conflicting transaction, chain-native expiry, or
a passed validity bound.

**Spans:** steps 3, 4, 5.

**Evidence:** source-chain state, directly readable.

## O7 · Price reference lifecycle — §7

**[SPEC]** Twice-daily runs; first valid price accepted; no fallback price;
no valid price means the asset is unavailable until a later run
(VF-ORC-001 to 005).

**[REV7]** VF-ORC-015 proposes a 48-hour validity bound measured from the
publication timestamp inside the signed record. VF-ORC-016 proposes disclosure
of signing-key risk under VF-EXT-002.

**Spans:** steps 1, 2, 6.

**Evidence:** signed price records with publication timestamps.

## O8 · Deployment completeness — VF-EXT-002, VF-EXT-003

**[SPEC]** An unavailable external address or unfinished deliverable must be
**reported as incomplete rather than replaced with an invented value or
behavior** (VF-EXT-002). No live deployment may be finalized until every
required deliverable is completed and verified (VF-EXT-003).

**Spans:** precondition to the entire product being live.

**[DESIGN]** How incompleteness is surfaced to users.

---

# The eight steps

Each step lists only what is specific to it. Overlay obligations are not
repeated.

## Step 1 — Selection

**[SPEC]** The user selects an approved source asset, a nonzero amount, a
permitted duration, one currently available output token, and one valid
Base-chain recipient. §5.1 permits only listed durations and multipliers, no
interpolation (VF-COM-001, VF-COM-002). §6 governs the registry. VF-ARC-006
permits the Base recipient to differ from the source wallet.

**[SPEC] — added in v2.** VF-COM-025: selecting CHONX requires a causal
activation receipt establishing CHONX was active **at lock creation**. This
constrains selection, not only issuance.

**[DESIGN]** Asset browse and search; duration shown with multiplier; output
preview.

**Evidence.** The Approved Asset Registry is published and immutable after
finalization. Asset presence, class and precision independently confirmable.
**Immutability verifiable only post-deployment.**

**Surface.** Supported Assets (public) · Lock workflow (app) · Duration and
multiplier reference (docs) · Registry statistics (dashboard)

## Step 2 — Preflight, before assets move

**[SPEC]** VF-ARC-004: a known-invalid request must be rejected before fee or
principal assets move.

**[SPEC] §5.2.2 specifies this step in detail.** The application must check
the applicable Handshake allowance; an already-used identity; an objectively
pending attempt by the same identity; a recognized attempt awaiting finality;
duplicate submission; approved asset and identity; qualifying value range; fee
and principal calculations; output-token availability; recipient and
release-destination binding.

**The interface must clearly warn** that an independently constructed or
broadcast source transaction can move or timelock assets without creating
Vinculum rights, and that any fee actually transferred to the Dev Fund is
non-refundable.

**[DESIGN]** How failures are explained — particularly an unavailable asset,
which is a price condition rather than an error.

**Evidence.** The signed price record and its publication timestamp.

**Surface.** Lock workflow (app, primary) · Price freshness (dashboard) ·
Non-refundable fee warning (app, **required**) · Fee and rounding rules (docs)

## Step 3 — Source transaction

**[SPEC]** The source mechanism transfers the rounded fee to the fixed Dev
Fund destination in the original asset and places the remaining principal into
the source-chain Commitment Vault Lock. 2.50% for a qualifying Handshake
(VF-COM-004); 5.00% standard (VF-COM-009). VF-PRI-001: the fee is removed at
creation; the remaining principal is what matures.

**[REV7]** VF-FEE-013 proposes that the Dev Fund destination be a
source-environment-native address.

**[SPEC]** §1 and VF-ARC-002: **the source asset remains on its original
blockchain for the entire lock.**

**[DESIGN]** Transaction construction and signing; confirmation view; how the
fee split is shown before signing.

**Evidence.** The source transaction is public on its own chain. Both the fee
transfer and the timelock are independently verifiable in a block explorer.

**Surface.** Lock workflow (app) · Explorer links (app, dashboard) ·
"Your asset never moves" (public, trust cluster) · Fee routing (docs)

## Step 4 — Finality

**[SPEC]** The lock reaches the deterministic finality condition required for
that source environment (§11.2; per-environment rules in Architecture
C.1–C.17).

**[DESIGN]** How a pending state is displayed honestly — what is known, what
is awaited, what evidence would resolve it. Constrained by overlay O6.

**Evidence.** Confirmation depth, block inclusion and finality status, all
readable from the source chain.

**Surface.** Commitment tracking (app) · Pending disposition (app, **required
behaviour**) · Per-environment finality rules (docs) · Explorer links

## Step 5 — Proof

**[SPEC]** A normalized proof or attestation binds the completed source event
and all data required by §11. VF-XCH-012: the relayer cannot alter contents,
choose the output, redirect, or approve — a signature does not establish
truth. VF-SEC-005: the submitter obtains no parameter or value authority.
**Submission is permissionless**, including by the user.

**[OPEN]** The application's role in constructing or assembling the proof
remains undecided. Two alternatives, to be evaluated at workflow design:
the application assembles and the user reviews and submits; or the user
constructs independently and the application documents and submits.

*Current preference — the application assists rather than requiring manual
assembly — is a preference, **not** a specification requirement.*

**Evidence.** The proof binds the VF-XCH-011 fact set. Every field derives
from public chain data and is independently reconstructible.

**Surface.** *Depends on the [OPEN] decision.* The evidence schema belongs in
documentation regardless.

## Step 6 — Base verification

**[SPEC]** The Base verification layer validates source finality, registry
identity, fee routing, price record, output eligibility, lifetime capacity,
recipient binding, and replay protection. VF-ARC-005: proof submission or
retry cannot change the source event, output token, recipient, valuation,
duration, or maturity. **A retry is a retry, never a revision.**

**[DESIGN]** How a verification failure is explained and what the user can do
next.

**Evidence — the verifier's step.** Every check is on-chain and re-executable.
Each chain verifier is a published immutable contract. A skeptic can read the
code that decides and confirm the verification transaction. **Available only
post-deployment.**

**Surface.** Mint status (app) · Verification statistics (dashboard) ·
Verifier contracts (docs, developer) · AI Verification page and published traceability (**[DESIGN]** — one implementation of VF-VER-006, not mandated;
overlay O3)

## Step 7 — Issuance

**[SPEC]** After successful verification, the complete calculated quantity of
exactly one selected output token — VCLM or activated CHONX — is issued to the
bound Base-chain recipient. **The same lock never produces both**
(VF-ARC-003).

**[SPEC] — added in v2.** Reward-Accounting Credit is recorded **on fee
verification, independently of issuance** (VF-FEE-011, VF-RAC-002). At zero
VCLM capacity, fees still reach the Dev Fund but no RAC is recorded
(VF-SUP-012). RAC is therefore a distinct user-visible state that can exist
where issuance does not — v1 wrongly subordinated it to issuance.

**[DESIGN]** Issuance confirmation; portfolio update; how RAC is presented
distinctly from issuance.

**Evidence.** Cumulative lifetime issuance, remaining capacity and activation
progress are public on-chain state. **Available only post-deployment.**

**Surface.** Transparency dashboard (overlay O4) · Portfolio (app) · Token
statistics (public) · Issuance references and decay (docs)

## Step 8 — Maturity and release

**[SPEC]** At maturity the user may reclaim the remaining source-chain
principal **independently of Base issuance or any external service**.
VF-PRI-002: released once only. VF-PRI-003: only to the destination bound at
creation. VF-PRI-004: no price reference or oracle call. VF-PRI-005: no Base
issuance, epoch calculation, staking, registry update, relayer or
administrator. VF-PRI-006: no early release path.

**[SPEC]** §12: *"If Base verification fails permanently and no output token
is issued, the source-chain Commitment Vault Lock still matures and its
principal remains releasable under the same fixed maturity rule."*

Release is user-initiated, not pushed.

**[DESIGN]** Maturity dates, countdowns and claim availability displayed
prominently so users can schedule their own reminders. **The user owns
remembering.** Optional notifications may be added as a convenience and must
never become a protocol assumption.

**Evidence.** The timelock and its maturity are readable on the source chain.
The release transaction is public.

**Surface.** Your commitments with countdowns (app) · Principal safety
(public, trust cluster) · Release workflow (app) · Maturity rules (docs)

---

# [DESIGN] Groupings

## Trust cluster

§2, §12, §14 and §15 are scattered across the specification but tell one
story: **no one controls this, and your asset returns even if everything else
fails.** Grouping them is a product decision; the underlying requirements are
`[SPEC]`.

## Dashboard spine

§13 — lifetime issuance, remaining capacity, activation progress. A product
decision to treat one specification section as a dashboard's organising
principle.

## Onboarding

§5.2's Trust-Building Handshake — a one-hour lock at approximately one dollar
walking the entire lifecycle. **The onboarding path is specified**; its
presentation is `[DESIGN]`.

## Live preview

Rev 7 Appendix A2: the Solidity contracts are the production target; a
JavaScript layer drives the live preview. Divergence is expected; the preview
layer is not duplication. **[REV7]** — recorded in a candidate document, not
Rev 6.

---

# Evidence availability

Several evidence claims depend on deployment. Marked here so no page promises
verification that cannot yet be performed.

| Evidence | Available |
|---|---|
| Source-chain transactions, timelocks, finality | On use |
| Signed price records | On publication |
| Registry immutability | **Post-deployment** |
| Contract code, absence of control | **Post-deployment** |
| Finalization transaction | **Post-deployment** |
| Lifetime issuance, capacity, activation | **Post-deployment** |
| Verification transactions | **Post-deployment** |
| Traceability matrix, test suites, evidence artifacts | Now |

---

# Open product decisions

| # | Decision | Affects |
|---|---|---|
| 1 | The application's role in proof construction | Step 5; the app's thickness |
| 2 | Whether optional notifications are offered | Step 8 convenience only |
| 3 | Which audience the home page primarily serves | Home page only |
| 4 | How much the trust cluster explains versus asserts | Public pages |
| 5 | **Whether and how §16 traceability is published** | Verification surface |
| 6 | **Whether signing-key risk is publicly disclosed, and where** | `[REV7]` VF-ORC-016 anticipates it; VF-EXT-002 governs reporting |
| 7 | **Presentation basis for post-issuance capabilities** | §9, §10, SYNTH forge, §4.3, §11.4 |
