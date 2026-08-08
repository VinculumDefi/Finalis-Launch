# Vinculum Finalis — Master Specification
# REVISION 7 · INTEGRATED WORKING DRAFT

> ## ⚠️ PRE-RECONCILIATION ENGINEERING DRAFT — NOT A RELEASE
>
> **This document is not the Master Specification and must not be cited as one.**
>
> **Base text:** Revision 6, SHA-256 `5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9`.
> Revision 6 remains the governing authority until Revision 7 is released. Where
> this draft and Revision 6 differ in normative text, **Revision 6 governs.**
>
> **What is in here:**
> - Revision 6's requirement text, used as the authoritative base and not rewritten
> - Five agreed Revision 7 amendments, marked `[REV7-NEW]`
> - A status annotation on every requirement, marked `[REV7-DRAFT]`
>
> **The annotations are not normative.** They record what the remediation has
> verified. They were derived from the implementation and the Evidence Register;
> the requirements were not. That distinction is the point of this document.
>
> **169 of 209 requirements are marked NOT YET REVIEWED.** That is a statement
> about coverage, not about the implementation. Seventeen of eighteen requirement
> families have had no coverage analysis. A requirement with no implementation
> produces no failing test, because there is nothing to fail.
>
> **Annotations are removed before release.** The Revision 7 release candidate is
> a clean normative document. This draft exists to make the gap between
> specification and evidence visible while it is being closed.

---

## Draft status · 2026-08-07

| | |
|---|---|
| Requirements in Revision 6 | 209 across 18 families |
| Annotated with verified status | 40 |
| Not yet reviewed | 169 |
| Amendments inserted | 5 (VF-ORC-015, VF-ORC-016, VF-SEC-007, VF-REG-012, VF-FEE-013) |
| Amendments incomplete | 1 — VF-REG-012 awaits the asset precision dataset |
| Test suite at time of drafting | 116 passing, 0 failing |
| Known Critical findings open | 0 |

**Evidence levels used in annotations**

| | |
|---|---|
| **S** | Specification decision only. No code. |
| **U** | Unit-tested. Storage values, isolated functions, structural assertions. |
| **I** | Integration-tested. Exercised through a real production entry point. |
| **E** | End-to-end verified. Exercised through the path production uses. |
| **A** | Architectural argument. **Never stands alone** — valid only as a qualifier, with the argument written out. |

**Before this draft becomes a release candidate:**

1. Seventeen remaining requirement families reviewed, every requirement annotated
2. Findings from that review remediated and evidenced
3. VF-REG-012 completed with a derived precision bound
4. Annotations stripped; changelog written against requirement identifiers
5. New SHA-256 computed and recorded in the revision control appendix

---

**VINCULUM FINALIS**

**MASTER SPECIFICATION**

Current Master Specification \| 28 July 2026

  -----------------------------------------------------------------------
  **DOCUMENT STATUS**\
  Current Master Specification - Not Implementation-Complete. This
  document incorporates all presently settled and owner-approved protocol
  behavior. Remaining blockers are deployability evidence - including the
  Cosmos Hub chain-native feasibility analysis - and deferred external
  deployment inputs. No owner decision remains open. No AI, implementer,
  auditor, or contributor may interpret an unresolved or omitted
  implementation detail as authorization to invent behavior.
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------

*The complete plain-language expression of what the protocol is, what it
permits, and what every implementation must preserve.*

## Independent Review Record

The Claude and Grok/Team entries below concern an earlier specification
file. Their directed corrections were incorporated before this current
file. This current file additionally incorporates the owner-approved
Handshake, fee-treatment, canonical-release-public-key, and objective
pending-attempt rules. This is a document-preparation statement, not an
independent approval of the current file. No independent review is
recorded for this exact current file at creation. A later review must
identify the exact file reviewed in a separate evidence record. Review
is quality evidence; it is not authority to alter this specification.

  ---------------------------------------------------------------------------
  **Reviewer**   **Review     **Conclusion**    **Findings record**
                 date**                         
  -------------- ------------ ----------------- -----------------------------
  ChatGPT        Not          Document          Prepared the current file. No
                 applicable   preparation; not  independent review conclusion
                              independent       is recorded.
                              review            

  Claude         27 July 2026 Approved subject  Identified a historical
                              to two findings   registry-file provenance
                                                issue and the one-hour
                                                Trust-Building Handshake
                                                classification gap. The
                                                current semantic registry
                                                rule supersedes the former.

  Grok/Team      27 July 2026 Concurred after   Concurred with both findings
                              Claude\'s review  after reading Claude\'s
                                                analysis; the findings were
                                                not independently discovered.
  ---------------------------------------------------------------------------

# Table of Contents

> 0\. Authority, Interpretation, and Revision Philosophy
>
> 1\. Protocol Identity and Purpose
>
> 2\. Immutable Control Model
>
> 3\. System Architecture and End-to-End Flow
>
> 4\. Token System: VCLM, CHONX, and SYNTH
>
> 5\. Commitment Vault Locks
>
> 6\. Approved Asset Registry and Asset Classification
>
> 7\. Price Reference Process
>
> 8\. Fee Collection and Original-Form Routing
>
> 9\. Reward-Accounting Credit and Epoch Reward Basis
>
> 10\. Treasury Reward Stake
>
> 11\. Cross-Chain and Native-Lock Architecture
>
> 12\. Commitment Vault Principal Safety, Maturity, and Release
>
> 13\. Supply Accounting and Activation Gates
>
> 14\. Security Invariants and Fail-Closed Behavior
>
> 15\. Deployment, Immutability, and Configuration Finalization
>
> 16\. Verification, Testing, and Specification Traceability
>
> 17\. Machine-Readable, Transfer, and Market Representations
>
> 18\. Explicitly Superseded Concepts
>
> 19\. Required Architecture Deliverables and Deferred External Inputs
>
> Appendix A. Consolidated Formulas and Schedules
>
> Appendix B. Canonical Terminology
>
> Appendix C. Complete Approved Asset Registry
>
> Appendix D. Revision Control

# 0. Authority, Interpretation, and Revision Philosophy

  -----------------------------------------------------------------------
  **CONTROLLING PRINCIPLE**\
  This specification defines the required behavior of Vinculum Finalis.
  Implementations, tests, websites, diagrams, deployment packages, and AI
  explanations are correct only when they conform to it.
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------

## 0.1 The specification governs intended behavior

Vinculum Finalis exists first as a settled system of rules. Code and
tests demonstrate implementation behavior; they do not create protocol
intent. Historical documents remain useful evidence of prior work but
cannot restore behavior superseded by the current specification.

**VF-DOC-001:** The current Master Specification is the sole governing
expression of intended protocol behavior.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-DOC-002:** Code, tests, deployment scripts, websites, and
historical artifacts must conform to the specification; their existence
does not alter it.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-DOC-003:** A conversation, AI answer, issue, code comment, or prior
document does not change protocol behavior unless the change is
incorporated into a later Master Specification revision.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-DOC-004:** When the specification is silent or ambiguous, the
matter must be identified rather than resolved through an unstated
conventional assumption.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

## 0.2 Revision discipline

Each current revision is read as a complete document. Prior revisions
are historical records, not alternate authorities. Substantive changes
require deliberate incorporation into a later revision with an
explanation in Revision Control.

**VF-DOC-005:** The revision designation appears only in Appendix D,
Revision Control.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-DOC-006:** A later revision completely supersedes earlier revisions
as the operational statement of intent.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-DOC-007:** Every material mechanism must state its trigger, inputs,
outputs, success conditions, rejection conditions, relationships, and
permissible authority.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

## 0.3 Independent review

Independent AI or human review can expose contradictions, omissions, and
implementation risks. It is evidence of review quality, not a source of
protocol authority.

**VF-DOC-008:** A recorded independent review identifies the exact
reviewed file, review date, conclusion, and findings.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-DOC-009:** No AI reviewer may approve, amend, complete, or
reinterpret protocol behavior through agreement with another reviewer.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-DOC-010:** Independent implementations derived only from this
specification must be functionally equivalent in every defined
circumstance.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

# 1. Protocol Identity and Purpose

Vinculum Finalis is a permanently immutable, multi-chain commitment
protocol. A user may create a Commitment Vault Lock using an approved
asset on its supported source blockchain and receive a calculated
quantity of VCLM or, after activation, CHONX on Base. The source asset
remains on its original blockchain for the entire Commitment Vault Lock.

## 1.1 Intended outcomes

-   Connect many separate asset communities through one commitment
    system.

-   Allow users to retain their original assets rather than trade, wrap,
    or bridge them as part of the Commitment Vault Lock.

-   Recognize measurable time commitment through fixed issuance
    schedules.

-   Create a phased three-token economy in which VCLM precedes CHONX and
    SYNTH is forged from both.

-   Create fee-indexed VCLM rewards through deterministic
    Reward-Accounting Credits and Treasury Reward Stake Weight.

-   Eliminate post-deployment governance, upgrades, discretionary
    parameter changes, and value redirection.

## 1.2 Broad participation without asset disparagement

The 1,001-asset registry allows many communities to participate. The
higher S1 and S2 issuance multipliers recognize defined operational
advantages: stable-denominated value, clearer valuation, mature
infrastructure, simpler accounting and handling, and reduced operational
risk under immutable rules. S3 remains a complete standard participation
path. The classifications do not imply that S3 assets or their
communities are weaker, inferior, or less legitimate.

# 2. Immutable Control Model

Vinculum Finalis is deployed once and then operates only through fixed
rules. The absence of continuing control is a defining architectural
choice rather than an incomplete governance design.

**VF-IMM-001:** After deployment there is no governance, proposal
system, voting system, council, administrator, owner role, upgrade
authority, proxy administrator, pause authority, emergency role, rescue
role, or discretionary parameter-setting authority.

> `[REV7-DRAFT]` **Implemented** · evidence **U + I** · 01_findings.test.cjs — authority removal; 04 — finalization gate · findings: CL-02

**VF-IMM-002:** No person, multisignature wallet, organization, AI
agent, or implementer may alter protocol economics or redirect
protocol-controlled value after finalization.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-IMM-003:** Every permissible post-deployment movement of value must
arise from fixed and explicit deployed logic.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-IMM-004:** No temporary control may remain after finalization on
the theory that it will be removed later.

> `[REV7-DRAFT]` **Implemented** · evidence **U + I** · 01_findings.test.cjs — one-shot initialize, deployer zeroed · findings: CL-02

**VF-IMM-005:** Failure of an external dependency must prevent unsafe
new issuance without preventing release of matured Commitment Vault
principal.

> `[REV7-DRAFT]` **Implemented** · evidence **E + A** · 04_endtoend.test.cjs — stale price fails closed. A: principal release executes on the source chain; no Base contract holds principal · findings: CL-37

**VF-IMM-006:** The inability to repair a deployed defect is an accepted
consequence of eliminating post-deployment control.

> `[REV7-DRAFT]` **Governing principle** · evidence **A** · Not implementable as code. Drives the audit requirement

# 3. System Architecture and End-to-End Flow

## 3.1 Base and supported source environments

Base is the canonical issuance and accounting blockchain for VCLM,
CHONX, and SYNTH. Approved assets originate across the 17 supported
blockchain environments listed in Section 11. Source principal does not
move to Base. Verified information about a completed Commitment Vault
Lock authorizes the corresponding Base-chain issuance.

## 3.2 End-to-end Commitment Vault Lock flow

1.  The user selects an approved source asset, a nonzero amount, a
    permitted duration, one currently available output token, and one
    valid Base-chain recipient.

2.  Before assets move, the source application performs every available
    registry, amount, price-reference, output-availability, fee, and
    recipient preflight check.

3.  The source mechanism transfers the actual rounded fee to the fixed
    Dev Fund destination in the original asset and places the remaining
    principal into the source-chain Commitment Vault Lock.

4.  The Commitment Vault Lock reaches the deterministic finality
    condition required for that source environment.

5.  A normalized proof or attestation binds the completed source event
    and all data required by Section 11.

6.  The Base verification layer validates source finality, registry
    identity, fee routing, price record, output eligibility, lifetime
    capacity, recipient binding, and replay protection.

7.  After successful verification, the complete calculated quantity of
    exactly one selected output token - VCLM or activated CHONX - is
    issued to the bound Base-chain recipient. The same Commitment Vault
    Lock never produces both.

8.  At maturity, the user who created the Commitment Vault Lock may
    reclaim the remaining source-chain principal independently of Base
    issuance or any external service.

## 3.3 Separation of mechanisms

  ---------------------------------------------------------------------------
  **Mechanism**   **Accepted      **Purpose**                 **Renewable**
                  assets**                                    
  --------------- --------------- --------------------------- ---------------
  Commitment      Approved        Issue VCLM or activated     No
  Vault Lock      external assets CHONX                       

  Treasury Reward VCLM, CHONX,    Earn a proportional share   Manual future
  Stake           SYNTH           of VCLM rewards             terms may be
                                                              queued

  SYNTH Forge     VCLM and CHONX  Burn both inputs to forge   Not applicable
                                  SYNTH                       
  ---------------------------------------------------------------------------

**VF-ARC-001:** Base is the canonical issuance and accounting blockchain
for all three protocol tokens.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-ARC-002:** Commitment Vault principal remains on its supported
source blockchain.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-ARC-003:** One Commitment Vault Lock authorizes no more than one
selected protocol-token output.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-ARC-004:** A known-invalid Commitment Vault Lock request must be
rejected before fee or principal assets move whenever the source
environment can determine the invalidity.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-ARC-005:** Proof submission or retry cannot change the source
event, output token, recipient, valuation, duration, or maturity.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-ARC-006:** The Base-chain recipient may differ from the
source-chain wallet, but it must be a valid nonzero address authorized
by the source user and bound when the Commitment Vault Lock is created.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

# 4. Token System: VCLM, CHONX, and SYNTH

  --------------------------------------------------------------------------------
  **Token**   **Lifetime hard   **Availability**       **Authorized creation**
              cap**                                    
  ----------- ----------------- ---------------------- ---------------------------
  VCLM        10,000,000,000    Protocol launch        Verified Commitment Vault
                                                       Locks and Treasury Reward
                                                       Stake rewards

  CHONX       100,000,000,000   After 10,000,000       Verified Commitment Vault
                                cumulative lifetime    Locks after activation
                                VCLM issuance          

  SYNTH       10,000,000        After 100,000,000      Forge by burning 1,000 VCLM
                                cumulative lifetime    and 10,000 CHONX for each
                                CHONX issuance         SYNTH
  --------------------------------------------------------------------------------

## 4.1 Token roles and creation

VCLM is available from launch and is the sole Treasury Reward Stake
reward currency. CHONX is a separate Commitment Vault Lock output that
becomes available only after its VCLM activation threshold. SYNTH is
never a Commitment Vault Lock output and is forged only through the
one-way destruction of both lower-tier protocol tokens.

**VF-TOK-001:** VCLM, CHONX, and SYNTH each use 18 decimal places.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-TOK-002:** CHONX activation is permanent when cumulative lifetime
VCLM issuance reaches 10,000,000.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-TOK-003:** SYNTH activation is permanent when cumulative lifetime
CHONX issuance reaches 100,000,000.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-TOK-004:** Forging one SYNTH permanently destroys exactly 1,000
VCLM and 10,000 CHONX.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-TOK-005:** The SYNTH Forge is one-way and has no reversal,
redemption, or administrative restoration path.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-TOK-006:** SYNTH is never issued from a Commitment Vault Lock.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-TOK-007:** VCLM, CHONX, and SYNTH are prohibited Commitment Vault
Lock inputs.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

## 4.2 Issuance references and discrete decay

  -------------------------------------------------------------------------------
  **Output**   **Protocol    **Initial rate**  **30-day decay** **Permanent
               reference**                                      floor**
  ------------ ------------- ----------------- ---------------- -----------------
  VCLM         \$0.10        10 VCLM per       1.667%           1 VCLM per \$1.00
                             \$1.00            compounded       

  CHONX        \$0.01        100 CHONX per     1.667%           10 CHONX per
                             \$1.00            compounded       \$1.00
  -------------------------------------------------------------------------------

**Current rate = max(initial rate x (1 - 0.01667)\^n, permanent floor)**

For VCLM, n is the number of complete 30-day periods elapsed since
protocol launch. For CHONX, n is the number of complete 30-day periods
elapsed since CHONX activation. The clocks are independent. A partially
completed 30-day period does not advance either schedule.

**VF-TOK-008:** VCLM decay begins at protocol launch; CHONX decay begins
at CHONX activation.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-TOK-009:** Each decay schedule advances only after a complete fixed
30-day period.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-TOK-010:** Decay arithmetic rounds down at each 30-day calculation
step.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-TOK-011:** Asset and Commitment Vault Lock duration multipliers
apply after the applicable time-dependent emission rate and do not alter
the decay schedule.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-TOK-012:** Protocol reference values are issuance references, not
exchange prices, redemption promises, or guarantees of market value.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

## 4.3 Transferability and external markets

VCLM, CHONX, and SYNTH are transferable. Users may establish external
liquidity venues where technically and legally available. It is a goal
of Vinculum Finalis to pursue and obtain centralized and decentralized
exchange listings as resources, eligibility, and opportunity permit.

**VF-TOK-013:** The protocol imposes no transfer tax, allowlist,
denylist, administrator freeze, or protocol-level trading restriction on
VCLM, CHONX, or SYNTH.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-TOK-014:** An external market or liquidity venue does not alter
issuance, supply, reward, activation, or Commitment Vault Lock rules.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-TOK-015:** No exchange listing, liquidity level, market price,
redemption value, or appreciation is guaranteed.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

# 5. Commitment Vault Locks

A Commitment Vault Lock is a single, non-renewable source-chain timelock
of an approved external asset. It charges the applicable fee, isolates
the remaining principal until maturity, and authorizes exactly one VCLM
or activated CHONX output after successful Base verification.

## 5.1 Permitted durations and multipliers

  -------------------------------------------------------------------------
  **Duration**   **Role**                                    **Duration
                                                             multiplier**
  -------------- ------------------------------------------- --------------
  1 hour         Trust-Building Handshake                    1.0x

  7 days         Shortest standard Commitment Vault Lock     1.0x

  30 days        Short Commitment Vault Lock                 1.15x

  60 days        Short-to-medium Commitment Vault Lock       1.3x

  90 days        Medium Commitment Vault Lock                1.5x

  180 days       Six-month Commitment Vault Lock             2.0x

  365 days       One-year Commitment Vault Lock              2.5x

  730 days       Two-year Commitment Vault Lock              3.8x

  1,095 days     Three-year Commitment Vault Lock            5.0x

  1,460 days     Four-year Commitment Vault Lock             5.75x

  1,825 days     Five-year Commitment Vault Lock             6.5x

  2,190 days     Six-year Commitment Vault Lock              6.8x

  2,555 days     Seven-year Commitment Vault Lock            7.1x

  2,920 days     Eight-year Commitment Vault Lock            7.4x

  3,285 days     Nine-year Commitment Vault Lock             7.7x

  3,650 days     Ten-year Commitment Vault Lock              8.0x
  -------------------------------------------------------------------------

**VF-COM-001:** Only the durations and multipliers in Section 5.1 are
permitted.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-COM-002:** No intermediate duration or interpolated multiplier is
permitted.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

## 5.2 Trust-Building Handshake

The Trust-Building Handshake allows a user to experience the complete
Commitment Vault Lock lifecycle using an approximately one-dollar gross
value. It is deliberately limited so that it demonstrates the mechanism
without becoming the ordinary participation route. Its allowance is
applied per objectively bound source-chain identity and depends on the
selected source mechanism\'s actual chain-native state capability.

**VF-COM-003:** A qualifying Trust-Building Handshake is a one-hour
Commitment Vault Lock with Verified Gross USD Value from \$0.95 through
\$1.05 inclusive.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-COM-004:** Each successful qualifying Trust-Building Handshake
charges a 2.50% fee.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-COM-005:** The Handshake identity is the objectively recorded
source-chain identity deterministically bound into the recognized lock
evidence. For an account-model mechanism it is the source environment
combined with the source account. For every UTXO-family mechanism it is
exactly handshake_identity = (source_environment_id,
canonical_release_public_key), where the canonical release public key is
the single key authorizing the principal\'s maturity-release branch in
the chain\'s canonical serialization and is proved against the locking,
redeem/witness, or tapleaf evidence. An address, complete script, script
hash, or maturity value is not an alternative identity; ambiguous or
multi-key maturity-release paths are rejected for Handshake use. Each
newly created objectively distinct wallet, account, or release public
key receives its own applicable allowance. Creating one is permitted.
Person-level identification, wallet clustering, cross-address
association, detection of common control, and anti-Sybil enforcement are
neither required nor permitted.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-COM-006:** A selected source mechanism capable of atomically
maintaining persistent per-identity allowance state permits exactly
three successful qualifying Trust-Building Handshakes per bound
identity. A selected source mechanism without that capability permits
exactly one. The applicable allowance is determined by the actual
selected source mechanism, not by a broad chain label.

> `[REV7-DRAFT]` **Implemented** · evidence **E** · 04_endtoend.test.cjs — allowance from environment registry, not package · findings: CL-11

**VF-COM-007:** For a one-use mechanism, the first successful qualifying
Handshake consumes the identity\'s allowance and a second qualifying
attempt by that identity cannot become a recognized Commitment Vault
Lock or authorize issuance. For a three-use mechanism, the first three
successes consume the allowance and the fourth qualifying attempt is
rejected. The official application must refuse an additional one-use
Handshake before broadcast while the identity is used or has an
objectively pending attempt.

> `[REV7-DRAFT]` **Implemented** · evidence **E** · 04_endtoend.test.cjs — fourth rejected on three-use, second on one-use · findings: CL-11

**VF-COM-008:** A failed, reverted, invalid, or unrecognized attempt
consumes no Trust-Building Handshake allowance. Application-local
preventive state does not consume protocol allowance.

> `[REV7-DRAFT]` **Implemented** · evidence **E** · 04_endtoend.test.cjs — a late failure consumes no allowance · findings: CL-11

**VF-COM-026:** A one-hour Commitment Vault Lock that does not satisfy
the qualifying value range in VF-COM-003 is rejected. The one-hour
duration is available only through a qualifying Trust-Building
Handshake. An arbitrary or out-of-protocol source transaction does not
become a Commitment Vault Lock and creates no issuance right,
Reward-Accounting Credit, or Handshake-allowance consumption merely
because it moves or timelocks assets.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

### 5.2.1 Chain-equivalent qualification and enforcement

Preflight qualification and allowance enforcement may be placed at the
source, in a cryptographic authorization required by the source
mechanism, in the proof-verification path, or across a chain-native
combination, provided the resulting User-protection and security outcome
are demonstrated. An invalidity determinable only through the
proof-verification path is rejected before the event becomes a
recognized Commitment Vault Lock and authorizes no issuance, no
Reward-Accounting Credit, and consumes no Handshake allowance.

### 5.2.2 Prevention by the official application

The non-refundable fee rule is a fail-safe for an exceptional or
independently constructed transaction, not an acceptable ordinary User
experience. Before constructing, signing, or broadcasting a source
transaction, the official application must perform every technically
available check, including the applicable Handshake allowance; an
already-used identity; an objectively pending attempt by the same
identity; a recognized attempt awaiting finality; duplicate submission;
the approved asset and identity; the qualifying value range; fee and
principal calculations; output-token availability; and recipient and
release-destination binding. For a non-stateful one-use mechanism, it
must refuse another Handshake while the identity is used or has an
objectively pending attempt. The interface must clearly warn that an
independently constructed or broadcast source transaction can move or
timelock assets without creating Vinculum rights and that any fee
actually transferred to the Dev Fund is non-refundable.

### 5.2.3 Objective pending-attempt disposition

Elapsed time, mempool disappearance, failure to appear within an
estimated or finality window, and application-local abandonment timers
are not proof that a source transaction can no longer become recognized.
A pending Handshake attempt clears only when objective chain-native
evidence establishes a terminal source-chain disposition or that the
transaction can no longer validly become the recognized transaction: a
consumed account nonce; a consumed input by a finalized conflicting
transaction; a genuine chain-native expiry rule where the chain provides
one; or a finite validity bound that passes. A still-valid,
rebroadcastable UTXO transaction remains pending and is not cleared by
time, mempool eviction, or non-observation. Before authorizing another
official submission, the application must recheck objective source-chain
disposition and Base recognition state.

Mechanism-specific objective invalidation is: finalized same-nonce
replacement or cancellation on EVM; recent-blockhash expiry or finalized
durable-nonce advancement on Solana; a finalized conflicting input spend
on a UTXO-family chain, with no invented automatic cancellation; finite
LastLedgerSequence passage on XRP Ledger; and finite time-bound passage
or finalized source-account sequence consumption on Stellar. Cosmos Hub
criteria remain undefined pending the required chain-native feasibility
analysis. A transaction with no terminal disposition and no objective
invalidation remains pending.

## 5.3 Standard minimum, fee, and rounding

**VF-COM-009:** Every Commitment Vault Lock from 7 days through 3,650
days requires at least \$10.00 Verified Gross USD Value and charges a
5.00% fee.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-COM-010:** An actual zero asset amount is invalid for every
duration.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-COM-011:** Fee asset units equal floor(gross asset units x
applicable fee basis points / 10,000).

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-COM-012:** Commitment principal units equal gross asset units minus
actual rounded fee units.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-COM-013:** The request is rejected before assets move if rounding
produces a zero fee or zero principal.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-COM-014:** If an asset\'s decimal precision cannot represent a
qualifying Trust-Building Handshake with both nonzero fee and nonzero
principal, that asset cannot use the Handshake but remains eligible for
longer qualifying Commitment Vault Locks.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-COM-015:** A fee actually and irreversibly transferred to the fixed
Dev Fund destination is permanently non-refundable, even if the source
transaction is later rejected as unrecognized or over-limit. That
rejection creates no recognized Commitment Vault Lock, issuance,
Reward-Accounting Credit, Handshake-allowance consumption, or other
Vinculum rights; any principal timelocked by the transaction remains
deterministically releasable to its bound destination at maturity.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-COM-016:** There is no early release, cancellation, penalty exit,
administrative release, or emergency release for Commitment Vault
principal.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

## 5.4 Issuance basis, calculation order, and output

**Output = Verified Gross USD Value x current emission rate x asset
multiplier x Commitment Vault Lock duration multiplier**

The complete gross USD value is recognized for protocol-token issuance.
The fee is paid separately and does not reduce the issuance basis. All
issuance calculations use 18-decimal fixed-point arithmetic and convert
to the output token\'s smallest units only after applying the factors in
the required order.

**VF-COM-017:** Commitment Vault issuance begins with the full Verified
Gross USD Value before subtracting the fee.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-COM-018:** The required calculation order is Verified Gross USD
Value, time-dependent emission rate, asset multiplier, Commitment Vault
Lock duration multiplier, then smallest protocol-token units.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-COM-019:** Every integer division rounds down; factors may not be
reordered or rounded to the nearest unit.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-COM-020:** A Commitment Vault Lock creates exactly one selected
output token: VCLM or activated CHONX.

> `[REV7-DRAFT]` **Implemented** · evidence **E** · 09_registration.test.cjs — values outside {0,1} rejected before minting · findings: CL-44

**VF-COM-021:** The complete calculated output is issued to the
Base-chain recipient bound to the source Commitment Vault Lock.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-COM-022:** The asset classification and acquisition history do not
attach to fungible VCLM or CHONX after issuance.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-COM-023:** A Commitment Vault Lock is not renewable. After maturity
the user may reclaim principal and create a separate new Commitment
Vault Lock.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-COM-024:** A Commitment Vault Lock with any duration other than one
hour does not consume a Trust-Building Handshake allowance.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-COM-025:** CHONX must already be activated at the original
Commitment Vault Lock creation time to be selected as its output; later
activation cannot validate an earlier ineligible selection.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

# 6. Approved Asset Registry and Asset Classification

The fixed Approved Asset Registry contains exactly 1,001 entries across
the 17 supported blockchain environments. Appendix C incorporates the
complete registry snapshot used by this specification. Registry
membership and exact canonical identity are prerequisites for a
Commitment Vault Lock.

## 6.1 Classifications

  ------------------------------------------------------------------------------
  **Class**         **Multiplier**   **Exact definition**
  ----------------- ---------------- -------------------------------------------
  S1                1.5x             Canonical Ethereum USDC and canonical
                                     Ethereum USDT

  S2 - Selected     1.3x             Native Ethereum ETH; native Bitcoin BTC;
  Five Assets                        canonical Ethereum AAVE, LINK, and UNI

  S3                1.0x             Every other approved registry entry,
                                     exactly 994
  ------------------------------------------------------------------------------

**VF-REG-001:** The deployed registry contains exactly the 1,001 entries
incorporated in Appendix C.

> `[REV7-DRAFT]` **Implemented** · evidence **I** · 08_precision.test.cjs — registry lookup required before valuation · findings: CL-41

**VF-REG-002:** S1 consists only of the exact canonical Ethereum USDC
and USDT identities listed in Appendix C.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-REG-003:** S2 consists only of native Ethereum ETH, native Bitcoin
BTC, and canonical Ethereum AAVE, LINK, and UNI as listed in Appendix C.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-REG-004:** All remaining 994 entries are S3.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-REG-005:** Wrapped, bridged, derivative, and alternate-chain forms
remain S3 unless they are one of the exact seven elevated canonical
identities.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-REG-006:** S1 and S2 multipliers apply equally when the selected
Commitment Vault Lock output is VCLM or activated CHONX.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-REG-007:** Asset classification affects initial Commitment Vault
issuance only and never alters Treasury Reward Stake Weight.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-REG-008:** VCLM, CHONX, and SYNTH are excluded from the Approved
Asset Registry as Commitment Vault Lock inputs.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-REG-009:** The WETH contract reference stored with the native
Ethereum ETH registry entry is pricing metadata only; S2 applies to
native ETH and does not elevate WETH.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-REG-010:** No registry entry may be added, removed, reclassified,
or assigned a different canonical identity after deployment
finalization.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

## 6.2 Operational rationale

S1 recognizes the accounting simplicity of the two selected stablecoins.
S2 recognizes five exact canonical assets whose established
infrastructure and handling characteristics reduce valuation and
operational complexity for an immutable protocol. The distinction is
operational rather than a judgment about the legitimacy or strength of
any S3 asset or community.

## 6.3 Governing registry data

Appendix C is the governing expression of the approved asset registry.
It assigns registry row numbers from 1 through 1,001 in current source
order; those row numbers are registry references rather than market
rankings. A machine-readable registry is an implementation
representation of Appendix C, not a separately governing historical
file.

**VF-REG-011:** A machine-readable registry conforms when it contains
exactly the 1,001 Appendix C records with the same registry-row
identifiers, symbols, asset names, environments, contract or native
identifiers, S1/S2/S3 classifications, and pricing identifiers.
Filename, whitespace, object-key order, and formatting do not affect
conformity.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-REG-012:** The decimal precision of an approved asset shall lie within the
domain [0, **N**], where **N** is *[TO BE DETERMINED]*. Registration shall reject
any precision outside this domain. The domain shall be chosen such that every
asset in the Approved Asset Registry can be represented, and such that ten raised
to the precision remains within the unsigned 256-bit range.

> `[REV7-NEW]` ⚠️ **INCOMPLETE — BLOCKS RELEASE.** Origin CL-43.
>
> The implementation currently bounds precision at eighteen. **That bound is an
> EVM convention, not specification-derived, and must not be frozen.** Revision 6
> states that issuance calculations use eighteen-decimal fixed-point arithmetic —
> that is the protocol's internal arithmetic precision, not a constraint on an
> asset's decimals. The two were nearly collapsed into one.
>
> The authoritative registry contains no decimals field, so no maximum can be
> computed from it. The arithmetic ceiling is seventy-seven. Registration is
> immutable after finalization, so a bound set too tight permanently excludes a
> legitimate asset, and one set too loose permits registering an asset into a
> silently mispriced state.
>
> **Required:** the authoritative precision dataset for the 1,001 approved assets,
> or a deployment rule defining the permitted domain by policy.
>
> `[REV7-DRAFT]` **Partially implemented** · evidence **U** ·
> 09_registration.test.cjs — out-of-domain precision rejected at registration.
> Bound is provisional.

# 7. Price Reference Process

The protocol uses the established Universal Price Fetcher v9 process to
obtain an orderly USD reference for Commitment Vault calculations. The
reference exists to estimate issuance value; it is not a trading quote,
redemption promise, or continuous financial-market valuation.

## 7.1 Twice-daily first-valid-price cascade

  ---------------------------------------------------------------------------
  **Step**   **Lookup**
  ---------- ----------------------------------------------------------------
  1          CoinGecko batch lookup by configured pricing identifier

  2          DexScreener lookup by contract for unresolved assets

  3          DexScreener symbol search for remaining unresolved assets

  4          For designated community-token overrides: DexScreener followed
             by GeckoTerminal fallback
  ---------------------------------------------------------------------------

### 7.1.1 Existing community-token price-source overrides

The current v9 configuration uses the following exact price-source
overrides while preserving the displayed registry identity. These
overrides are part of the established price-reference process.

  ----------------------------------------------------------------------------
  **Registry      **Lookup        **Lookup contract**
  identity**      environment**   
  --------------- --------------- --------------------------------------------
  TigerOG on Base BNB Smart Chain 0xAC68931B666E086E9de380CFDb0Fb5704a35dc2D

  LionOG on Base  BNB Smart Chain 0xdA1689C5557564d06E2A546F8FD47350b9D44a73

  FrogOG on Base  BNB Smart Chain 0x64da67A12a46f1DDF337393e2dA12eD0A507Ad3D

  WKC on Ethereum Ethereum        0x6ec90334d89dbdc89e08a133271be3d104128edb
  ----------------------------------------------------------------------------

**VF-ORC-001:** The price process runs twice per day.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-ORC-002:** For each asset, the first valid price produced by the
applicable ordered cascade is accepted and later sources are not
consulted for that run.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-ORC-003:** The price process does not require two simultaneous
sources, a source-spread comparison, a median calculation, a TWAP
comparison, or a separate 10-minute freshness test.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-ORC-004:** No hardcoded asset price may substitute for a failed
lookup.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-ORC-005:** If no valid price is produced, the asset has no usable
Commitment Vault valuation until a later successful scheduled run.

> `[REV7-DRAFT]` **Implemented** · evidence **E** · 02_oracle.test.cjs — zero price marks unavailable; 04 — issuance blocked · findings: CL-01

**VF-ORC-006:** The four community-token overrides in Section 7.1.1 use
the exact lookup environments and contracts listed there; an implementer
may not silently replace them with the displayed registry contracts.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

## 7.2 Signed and batched delivery to Base

The selected price, source label, asset identity, and fetch timestamp
are carried to Base through the established signed and batched price
path. The concrete integration and production signing configuration are
architecture and deployment deliverables; they may not silently change
the twice-daily first-valid-price rule.

**VF-ORC-007:** The Base valuation path accepts only a valid signed and
batched price record for the exact approved asset identity.

> `[REV7-DRAFT]` **Implemented** · evidence **E** · 02_oracle.test.cjs — publisher signature required, tampering and replay rejected · findings: CL-01

**VF-ORC-008:** A successful scheduled price record remains applicable
until the next scheduled run; a scheduled run producing no valid price
marks that asset unavailable until a later successful run.

> `[REV7-DRAFT]` **Implemented** · evidence **I** · 02_oracle.test.cjs — run ordering; 11_temporal_domain.test.cjs — no reuse or wrap · findings: CL-39, CL-49

> `[REV7-XREF]` **See VF-ORC-015.** This requirement governs *which* record applies
> between scheduled runs. VF-ORC-015 bounds *how long* that record may continue to
> apply when the next scheduled run does not arrive. Read alone, "remains
> applicable until the next scheduled run" admits a reading in which a record never
> expires; VF-ORC-015 qualifies it. **Editorial cross-reference only — the
> normative text of VF-ORC-008 is unchanged.**

**VF-ORC-009:** The reference price applicable when the Commitment Vault
Lock is created is retained for that Commitment Vault Lock.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-ORC-010:** A proof delay or retry does not reprice the Commitment
Vault Lock using a later market observation.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-ORC-011:** The Valuation Timestamp is the timestamp of the
finalized source-chain block containing the Commitment Vault Lock.

> `[REV7-DRAFT]` **Implemented** · evidence **E** · Derived from pkg.valuationTimestamp, bounded both directions · findings: CL-10

**VF-ORC-012:** The same accepted reference price determines Verified
Gross USD Value and Verified USD Fee Value for the Commitment Vault
Lock.

> `[REV7-DRAFT]` **Implemented** · evidence **E** · 04_endtoend.test.cjs — fee USD from the same reference price · findings: CL-30

**VF-ORC-013:** The time-dependent emission rate is selected using the
Valuation Timestamp.

> `[REV7-DRAFT]` **Implemented** · evidence **E** · daysSinceLaunch derived from valuation timestamp, not caller-supplied · findings: CL-10

**VF-ORC-014:** Website display updates and signed/batched protocol
records may share the same fetcher output, but website presentation
cannot alter protocol calculations.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-ORC-015:** A price record is valid where the elapsed time since its
publication timestamp does not exceed forty-eight hours. Forty-eight hours is
four scheduled publication intervals at the twice-daily cadence established in
VF-ORC-001.

Any operation that derives or depends upon the current United States dollar
valuation of an asset shall fail closed where no valid price record exists.
Operations that do not require current market valuation, including Commitment
Vault principal release, shall continue to operate normally.

The elapsed time is measured from the publication timestamp carried within the
signed record, not from the block in which the record was delivered to Base. A
delayed delivery does not restore freshness to an aged observation.

This requirement prevents issuance using stale market data while ensuring
temporary publication outages cannot permanently affect existing commitments or
principal release.

> `[REV7-NEW]` Origin CL-37. Resolves the conflict between VF-ORC-008 and
> VF-IMM-005 by qualifying the former through the latter: VF-ORC-008 continues to
> govern which record applies between scheduled runs; VF-IMM-005 bounds how long
> that record may continue to apply when the next run does not arrive.
>
> `[REV7-DRAFT]` **Implemented** · evidence **E** · 04_endtoend.test.cjs — issuance
> fails closed past the bound; 11_temporal_domain.test.cjs — both directions bounded

**VF-ORC-016:** Production price signing uses a single hardware-backed signing
authority, fixed at deployment and not thereafter alterable.

A threshold arrangement requiring multiple independent signatures was considered
and rejected for this deployment, because five genuinely independent custody and
failure domains cannot be established. Implementing nominal threshold signing
without independent custody would represent resilience the deployment does not
possess.

Compromise of the production signing key can compromise valuation input for the
life of the protocol. Permanent loss of the key permanently halts all
issuance-dependent operations, while Commitment Vault principal release continues
unaffected under VF-PRI-004 and VF-SEC-006. These consequences are accepted, and
shall be disclosed under VF-PUB-004 and addressed by the deployment custody
procedure.

> `[REV7-NEW]` Origin CL-38. Accepted operational risk. No code change was made —
> the decision was to document the existing configuration rather than build an
> arrangement whose claimed property the deployment cannot supply.
>
> **Citation corrected 2026-08-07** following independent specification audit. This
> requirement originally cited VF-EXT-002 for the disclosure obligation. VF-EXT-002
> governs reporting of *unavailable or unfinished* deliverables; a deliberate,
> completed configuration carrying an accepted risk falls outside it. Section 17
> was also examined: VF-PUB-001 imposes consistency, not disclosure, and VF-PUB-002
> concerns price-display provenance rather than signing custody. Neither satisfies
> the obligation, so VF-PUB-004 is added as the minimal normative addition.
>
> `[REV7-DRAFT]` **Implemented** · evidence **S + U** · `pricePublisher` is
> immutable; 02_oracle.test.cjs asserts no setter exists

# 8. Fee Collection and Original-Form Routing

## 8.1 Uniform routing

The actual rounded fee collected from every S1, S2, or S3 Commitment
Vault Lock is transferred to the fixed Dev Fund destination for the
source environment in the same asset in which it was collected. The
remaining principal is isolated in the Commitment Vault Lock.

**VF-FEE-001:** The Dev Fund receives 100% of each actual Commitment
Vault fee.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-FEE-002:** A fee remains in its original asset; no swapping,
conversion, bridging, or division among destinations occurs.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-FEE-003:** Commitment Vault principal is never transferred to the
Dev Fund.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-FEE-004:** Each of the 17 supported environments has one fixed and
immutable Dev Fund destination.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-FEE-005:** Any asset-specific receiving account required by an
environment must remain deterministically bound to that environment\'s
fixed Dev Fund destination.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-FEE-006:** A user, relayer, implementer, or external message may
not substitute another fee destination.

> `[REV7-DRAFT]` **Implemented** · evidence **E** · 04_endtoend.test.cjs — substituted destination rejected · findings: CL-12

## 8.2 Evidence and deferred addresses

The actual Dev Fund addresses are intentionally not required during
specification or prototype design. They will be supplied only after the
prototype application has been reviewed and a decision has been made to
begin heavy testing.

**VF-FEE-007:** A Commitment Vault Lock is not valid for Base issuance
unless the proof establishes the exact actual fee and transfer to the
configured source-environment Dev Fund destination.

> `[REV7-DRAFT]` **DEFERRED** · evidence **S** · Conscious deferral to CL-27 chain-verifier work. See VF-FEE-013 · findings: CL-12

**VF-FEE-008:** Fee-routing evidence and principal-lock evidence must
both refer to the same completed Commitment Vault Lock.

> `[REV7-DRAFT]` **Implemented** · evidence **E** · 04_endtoend.test.cjs — zero evidence reference rejected · findings: CL-12

**VF-FEE-009:** Missing, zero, guessed, or substitute Dev Fund addresses
cannot complete a deployment package.

> `[REV7-DRAFT]` **Implemented** · evidence **E** · 04_endtoend.test.cjs — unconfigured environment cannot issue · findings: CL-12

**VF-FEE-010:** Prototype design must expose required destination
configuration fields without requesting or inventing production
addresses.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-FEE-011:** A fee actually and irreversibly transferred to the
configured Dev Fund destination remains permanently non-refundable even
if the source transaction is later unrecognized, over-limit, or
permanently unable to authorize Base issuance. No discretionary refund
mechanism exists.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-FEE-012:** Fee-routing failure prevents Base issuance and
Reward-Accounting Credit but never prevents release of matured
Commitment Vault principal.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-FEE-013:** Revision 7 validates that the Dev Fund destination named within
the proof package matches the destination registered for that source environment
during the deployment ceremony, satisfying VF-FEE-006. A fee transfer evidence
reference shall be present and non-zero.

Independent cryptographic verification that the fee transfer occurred on the
source chain, as contemplated by VF-FEE-007, is outside the scope of Revision 7
and is reserved for future chain verifier enhancements. That capability requires
the chain verifier interface to interpret transfer evidence in addition to lock
evidence, which expands the trust boundary of that interface and warrants its own
specification work, threat model and test plan.

A Dev Fund destination is a source-environment-native address. Eleven of the
seventeen supported environments are not EVM-compatible, and the destination
representation shall not assume otherwise.

This deferral is a deliberate scoping decision and shall not be construed as an
omission.

> `[REV7-NEW]` Origin CL-12. Draws the boundary between destination integrity
> (in scope) and transfer verification (deferred to CL-27). The final paragraph
> records a representation correction: the registry originally stored an EVM
> address and now stores a string.
>
> `[REV7-DRAFT]` **Implemented** · evidence **E** · 04_endtoend.test.cjs —
> substituted, empty and unconfigured destinations all rejected

# 9. Reward-Accounting Credit and Epoch Reward Basis

Each successfully verified Commitment Vault fee creates a one-time
numerical Reward-Accounting Credit. The credit is accounting state only:
it is not an asset balance, is not deposited into a treasury, cannot be
withdrawn, and creates no claim against Dev Fund assets.

**Reward-Accounting Credit = Verified USD Fee Value x 60%**

**Epoch Reward Basis = sum of Reward-Accounting Credits in the epoch**

**Epoch Reward VCLM = Epoch Reward Basis / \$0.10**

**VF-RAC-001:** Verified USD Fee Value is the accepted USD valuation of
the actual rounded fee collected.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-RAC-002:** Reward-Accounting Credit equals 60% of Verified USD Fee
Value.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-RAC-003:** A Reward-Accounting Credit is assigned to the 10-day
epoch in which it is successfully recorded on Base.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-RAC-004:** Epoch Reward Basis is the sum of all Reward-Accounting
Credits assigned to that epoch.

> `[REV7-DRAFT]` **Implemented** · evidence **E** · 05_staking_lifecycle.test.cjs — running per-epoch basis, additive · findings: CL-06

**VF-RAC-005:** Epoch Reward VCLM is calculated using the permanent
\$0.10 Reward Reference Value, not an oracle or market price.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-RAC-006:** When the epoch calculation and position allocation are
successfully and irreversibly recorded, every included credit becomes a
Used Reward-Accounting Credit and can never be included again.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-RAC-007:** Reward-Accounting Credit does not transfer, reserve,
collateralize, or encumber any Dev Fund asset.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-RAC-008:** After remaining lifetime VCLM issuance capacity reaches
zero, later fees do not create Reward-Accounting Credits.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

# 10. Treasury Reward Stake

Treasury Reward Stake is a mechanism separate from Commitment Vault
Locks. It is active from protocol launch. VCLM may be staked as soon as
a user acquires it. CHONX and SYNTH become eligible when those tokens
become available.

## 10.1 Weight

**Treasury Reward Stake Weight = staked amount x token multiplier x
staking-duration multiplier**

  -----------------------------------------------------------------------
  **Token**                          **Token multiplier**
  ---------------------------------- ------------------------------------
  VCLM                               1.0x

  CHONX                              2.0x

  SYNTH                              4.0x
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------
  **Duration**                       **Staking-duration multiplier**
  ---------------------------------- ------------------------------------
  30 days                            1.0x

  60 days                            1.4x

  90 days                            1.75x

  120 days                           2.0x
  -----------------------------------------------------------------------

**VF-STK-001:** Treasury Reward Stake is active from protocol launch and
does not depend on CHONX activation.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-STK-002:** Only VCLM, CHONX, and SYNTH may be placed in Treasury
Reward Stake.

> `[REV7-DRAFT]` **Implemented** · evidence **U** · 10_bps_domain.test.cjs — token discriminator closed · findings: CL-45

**VF-STK-003:** Only the token and duration multipliers listed in
Section 10.1 apply.

> `[REV7-DRAFT]` **Implemented** · evidence **U** · 10_bps_domain.test.cjs — only the four §10.1 terms accepted · findings: CL-04, CL-47

**VF-STK-004:** Rewards are paid only in newly minted VCLM.

> `[REV7-DRAFT]` **Implemented** · evidence **E** · 05_staking_lifecycle.test.cjs — reward is newly minted VCLM, supply rises · findings: CL-07

**VF-STK-005:** S1, S2, and S3 classifications and acquisition history
never affect Treasury Reward Stake Weight.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

## 10.2 Fixed 10-day epochs

Protocol launch defines T0. Epoch N is the half-open interval beginning
at T0 plus (N - 1) times 10 days and ending at T0 plus N times 10 days.
Activity at the exact ending timestamp belongs to the following epoch.

**VF-STK-006:** Every epoch has a fixed scheduled duration of exactly 10
days.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-STK-007:** A Reward-Accounting Credit belongs to the epoch in which
it is successfully recorded on Base and may not be added to an ended
epoch.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-STK-008:** Anyone may submit the transaction that finalizes an
epoch after its scheduled ending timestamp.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-STK-009:** Delayed finalization does not shift, lengthen, shorten,
or reset any epoch boundary.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-STK-010:** Pending epochs must be finalized in chronological order.

> `[REV7-DRAFT]` **Implemented** · evidence **E** · Stake.sol closeEpoch — epochN == lastClosedEpoch + 1; 07_differential · findings: CL-09

## 10.3 Position eligibility and delayed reward allocation

Rewards are processed one epoch behind. A position earning for epoch N
must be active at the exact beginning of N, remain continuously active
through N, and remain active through the scheduled end of N+1. The
scheduled timestamp controls eligibility even if finalization is
delayed.

**VF-STK-011:** A position that begins after an earning epoch starts
does not qualify for that earning epoch.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-STK-012:** A position that expires before the scheduled end of the
following epoch does not qualify for the earlier earning epoch\'s
reward.

> `[REV7-DRAFT]` **Implemented** · evidence **E** · 07_differential.test.cjs — epoch-start eligibility matches the oracle · findings: CL-09

**VF-STK-013:** An entitlement for epoch N becomes fixed and allocatable
after the scheduled end of epoch N+1.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-STK-014:** The complete Epoch Reward VCLM is minted once to the
immutable Treasury Reward Stake contract, and proportional position
entitlements are then recorded.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-STK-015:** If an epoch has zero eligible Treasury Reward Stake
Weight, it mints no VCLM, closes, marks its credits used, and carries no
value forward.

> `[REV7-DRAFT]` **Implemented** · evidence **E** · 05_staking_lifecycle.test.cjs — no stakers allocates nothing

## 10.4 Claims and withdrawals

**VF-STK-016:** Recorded claimable VCLM accumulates and never expires.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-STK-017:** A user may claim all currently accumulated VCLM in one
transaction.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-STK-018:** Claims transfer already-minted VCLM and do not mint
again, recalculate rewards, or consume additional lifetime capacity.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-STK-019:** Claims may be paid only to the position owner or the
reward destination bound to the position.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-STK-020:** Withdrawal of matured staked tokens does not erase
accumulated claimable VCLM.

> `[REV7-DRAFT]` **Implemented** · evidence **I** · Stake.sol _cancelFutureWeight — closed epochs keep their weight · findings: CL-09

## 10.5 Manual extensions

**VF-STK-021:** While a position is active, its user may queue one
future term of 30, 60, 90, or 120 days.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-STK-022:** The queued term begins at the scheduled end of the
current term; the current multiplier remains unchanged until then.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-STK-023:** Only one future term may be queued at a time. After it
begins, another future term may be queued.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-STK-024:** An extension adds or removes no tokens and charges no
fee.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-STK-025:** Without a queued extension, the position becomes
inactive at maturity; an expired position cannot retroactively cover an
inactivity gap.

> `[REV7-DRAFT]` **Implemented** · evidence **I** · 01_findings.test.cjs — expired position cannot backdate an extension · findings: CL-14

## 10.6 Distribution rounding and VCLM-cap terminal state

**VF-STK-026:** Each position\'s proportional reward share is calculated
at 18-decimal VCLM precision and rounds down to the nearest VCLM base
unit.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-STK-027:** A microscopic distribution remainder remains
inaccessible in the immutable Treasury Reward Stake contract and is not
carried, redirected, or reused.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-STK-028:** If a complete epoch reward exceeds remaining VCLM
lifetime capacity, the epoch mints nothing, closes, and marks its
credits used; partial epoch reward minting is prohibited.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-STK-029:** When remaining VCLM lifetime capacity reaches zero,
Treasury Reward Stake permanently closes to new positions and
extensions.

> `[REV7-DRAFT]` **Implemented** · evidence **U** · Terminal state blocks new positions · findings: CL-08

**VF-STK-030:** At that terminal state, all existing staked tokens
become immediately withdrawable while accumulated claimable rewards
remain available.

> `[REV7-DRAFT]` **Implemented** · evidence **U** · Terminal state permits immediate withdrawal · findings: CL-15

**VF-STK-031:** A Treasury Reward Stake position must contain a positive
nonzero token amount; no additional minimum staking amount applies.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

# 11. Cross-Chain and Native-Lock Architecture

Vinculum Finalis supports 17 blockchain environments. Commitment Vault
principal remains in its original native or canonical asset form on the
source environment. Each environment uses an appropriate deterministic
chain-native locking mechanism, while Base performs canonical
protocol-token issuance and accounting. Equivalent outcomes, security,
and economic performance are required across supported environments;
identical contracts, transaction structures, state models, or
implementation methods are not.

## 11.1 Supported environments

  ------------------------------------------------------------------------
  **Family**   **Environment**                         **Registry
                                                       entries**
  ------------ --------------------------------------- -------------------
  EVM          Ethereum                                495

  EVM          BNB Smart Chain                         156

  EVM          Avalanche                               91

  EVM          Polygon                                 78

  EVM          Arbitrum                                43

  EVM          Base                                    33

  EVM          Optimism                                18

  Non-EVM      Bitcoin                                 1

  Non-EVM      Bitcoin Cash                            1

  Non-EVM      Solana                                  78

  Non-EVM      XRP Ledger                              1

  Non-EVM      Stellar                                 1

  Non-EVM      Cosmos                                  1

  Non-EVM      Litecoin                                1

  Non-EVM      Dogecoin                                1

  Non-EVM      DigiByte                                1

  Non-EVM      Zcash                                   1
  ------------------------------------------------------------------------

**VF-XCH-001:** The supported environment set is exactly the 17
environments listed in Section 11.1.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-XCH-002:** No environment may be added, removed, or substituted
without a later specification decision.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-XCH-003:** The deployment package must record the exact canonical
network or chain identifier for each environment.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-XCH-004:** Commitment Vault principal remains on the source
environment and does not bridge as part of the Commitment Vault Lock.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-XCH-005:** The source mechanism binds the user, principal-release
destination, asset, amount, creation timestamp, and maturity.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

## 11.2 Source-environment finality requirement

Each environment requires a deterministic finality condition appropriate
to that environment. The specification fixes the required outcome and
allows the architecture to define the concrete chain-specific method.

**VF-XCH-006:** Base-chain issuance cannot occur until the source
Commitment Vault Lock satisfies its documented deterministic finality
condition.

> `[REV7-DRAFT]` **Implemented** · evidence **E** · 04_endtoend.test.cjs — unfinalized source event rejected

**VF-XCH-007:** Before implementation, the architecture must document
the exact finality condition for all 17 environments.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-XCH-008:** A relayer or human cannot shorten or waive the
applicable finality condition.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-XCH-009:** Confirmation and proof-delivery delays do not alter the
original Valuation Timestamp, Commitment Vault Lock timestamp, maturity,
selected output, recipient, or calculated issuance.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-XCH-010:** Tests must establish that premature, unconfirmed, and
later-reversed source events cannot authorize Base issuance.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

## 11.3 Cross-chain proof acceptance

The implementation may use a proof, attestation, or verified-message
architecture appropriate to each environment. Regardless of transport,
the evidence must establish the same normalized facts and permit no
discretionary approval or alteration. Qualification and allowance
enforcement may occur at the source, through required cryptographic
authorization, in the proof-verification path, or through a demonstrated
chain-native combination.

**VF-XCH-011:** Evidence binds the source environment, unique Commitment
Vault Lock identifier, canonical asset identity and precision, user,
gross amount, actual fee amount and asset, fixed Dev Fund destination
and fee-transfer evidence, principal, creation timestamp, maturity,
selected output, authorized Base-chain recipient, release destination,
applicable valuation record, immutable-facts Reward-Accounting Credit
identity, objectively bound Handshake identity, applicable Handshake
allowance count, and CHONX-activation receipt. For a UTXO-family
mechanism the Handshake identity field contains the canonical release
public key required by VF-COM-005.

> `[REV7-DRAFT]` **Implemented** · evidence **E** · 04_endtoend.test.cjs — package contradicting source facts rejected

**VF-XCH-012:** A relayer may transport evidence but cannot change its
contents, choose the output, redirect issuance, or exercise approval
authority.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-XCH-013:** The combination of source environment and unique
Commitment Vault Lock identifier may authorize Base issuance only once.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-XCH-014:** A failed or temporarily unverifiable proof does not
consume the unique identifier; corrected evidence may be resubmitted.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-XCH-015:** After successful issuance, every replay or duplicate
submission is rejected.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-XCH-016:** Proof failure prevents issuance but never prevents
release of matured Commitment Vault principal.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-XCH-017:** The selected architecture must document its trust
assumptions and demonstrate equivalent required outcomes, security, and
economic performance using the selected chain-native mechanism; it need
not resemble an EVM contract. It may not introduce a person with
discretionary power to approve, alter, redirect, or reverse issuance.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

## 11.4 Axelar Interchain Token Service

VCLM, CHONX, and SYNTH use Axelar Interchain Token Service, with Base
serving as their canonical issuance and accounting blockchain. This is a
binding architectural requirement rather than a prescribed low-level
integration design.

**VF-XCH-018:** The implementer may design the concrete Axelar ITS
integration but may not replace Axelar ITS with another bridging or
cross-chain token system.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-XCH-019:** No independent or separately issued VCLM, CHONX, or
SYNTH supply may be created on another blockchain.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-XCH-020:** Every Axelar ITS representation remains part of the
single globally reconciled supply for its protocol token.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-XCH-021:** Interchain transport does not constitute new protocol
issuance, increase cumulative lifetime issuance, restore consumed
hard-cap capacity, or create an independent destination-chain allowance.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

# 12. Commitment Vault Principal Safety, Maturity, and Release

Commitment Vault principal is separate from protocol fees,
protocol-token issuance, and Treasury Reward Stake. At maturity, the
user who created the Commitment Vault Lock may reclaim the remaining
principal from the source-chain mechanism. The release is user-initiated
rather than automatically pushed to a wallet.

**VF-PRI-001:** The actual fee is removed or irrevocably designated at
Commitment Vault Lock creation; the remaining principal is the amount
subject to maturity.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-PRI-002:** Commitment Vault principal may be released only once.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-PRI-003:** Principal may be released only to the user or release
destination bound when the Commitment Vault Lock was created.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-PRI-004:** No price reference or oracle call is required for
principal release.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-PRI-005:** No Base issuance, epoch calculation, Treasury Reward
Stake processing, registry update, relayer, or administrator is required
for principal release.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-PRI-006:** There is no early Commitment Vault principal release
path.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

If Base verification fails permanently and no output token is issued,
the source-chain Commitment Vault Lock still matures and its principal
remains releasable under the same fixed maturity rule.

# 13. Supply Accounting and Activation Gates

## 13.1 Cumulative lifetime issuance

**Remaining lifetime capacity = hard cap - cumulative lifetime protocol
issuance**

**VF-SUP-001:** Every authorized issuance path reconciles against the
applicable global lifetime hard cap.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-SUP-002:** Commitment Vault issuance and Treasury Reward Stake
rewards draw from the same VCLM lifetime hard cap.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-SUP-003:** Burning a protocol token reduces circulating supply but
does not reduce cumulative lifetime issuance or restore issuance
capacity.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-SUP-004:** Activation thresholds use cumulative lifetime issuance
rather than circulating supply, wallet balances, burned supply, elapsed
time, or governance action.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

## 13.2 Full-rejection cap behavior

**VF-SUP-005:** A Commitment Vault issuance whose complete calculated
output exceeds remaining lifetime capacity is rejected in full.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-SUP-006:** Partial Commitment Vault issuance is prohibited; no
substitute token, recipient, or reduced output is permitted.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-SUP-007:** A rejected issuance attempt reserves no capacity and
does not consume the source Commitment Vault Lock identifier.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-SUP-008:** A permanently impossible Base issuance produces no fee
refund or administrative reversal; Commitment Vault principal remains
releasable at maturity.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

## 13.3 Epoch rewards at the VCLM cap

**VF-SUP-009:** If a complete Epoch Reward VCLM amount does not fit
within remaining VCLM lifetime capacity, that epoch mints zero VCLM,
closes, and marks its Reward-Accounting Credits used.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-SUP-010:** A later smaller complete epoch reward may be issued if
it fits the unchanged remaining capacity.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-SUP-011:** At zero remaining VCLM lifetime capacity, Treasury
Reward Stake permanently enters the terminal state defined by Section
10.6.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-SUP-012:** At that terminal state, qualifying Commitment Vault fees
may still reach the Dev Fund for an otherwise valid CHONX output, but
they create no Reward-Accounting Credit.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

## 13.4 Axelar ITS supply reconciliation

Axelar ITS transport may use technical mint-and-burn mechanics as part
of interchain movement. Such transport is not economic issuance under
this specification. The implementation must preserve one globally
reconciled token system without granting new protocol issuance capacity.

**VF-SUP-013:** Only protocol-authorized issuance originating from the
Base protocol increases cumulative lifetime protocol issuance.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-SUP-014:** Axelar ITS transport cannot be counted as a new
Commitment Vault, Treasury Reward Stake, or Forge issuance event.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-SUP-015:** Preflight checks do not reserve lifetime capacity or
guarantee later Base issuance; the source application must communicate
that consequence before the user completes a Commitment Vault Lock.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

# 14. Security Invariants and Fail-Closed Behavior

  -----------------------------------------------------------------------
  **Risk or dependency**  **Required behavior**
  ----------------------- -----------------------------------------------
  No valid scheduled      Reject the Commitment Vault Lock before assets
  price reference         move

  Unrecognized asset      Reject the Commitment Vault Lock
  identity                

  Unconfirmed source      Reject Base issuance
  event                   

  Replay or duplicate     Reject Base issuance
  proof                   

  Incorrect output or     Reject Base issuance
  recipient binding       

  Lifetime hard-cap       Reject the complete issuance
  breach                  

  Fee-routing evidence    Do not issue a protocol token or record
  failure                 Reward-Accounting Credit; do not affect matured
                          principal release

  Epoch processing        Do not affect Commitment Vault principal
  failure                 release

  Cross-chain message     Do not affect source-chain maturity or
  failure                 principal release
  -----------------------------------------------------------------------

**VF-SEC-001:** An approved asset with fee-on-transfer, rebasing,
callback, malformed, or otherwise incompatible behavior must be rejected
unless its approved source-environment architecture explicitly handles
that behavior without violating this specification.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-SEC-002:** External calls and state transitions must prevent
reentrancy, duplicate issuance, and partial-accounting states.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-SEC-003:** No failure path may substitute a default asset, price,
environment, user, recipient, output, duration, multiplier, or Dev Fund
destination.

> `[REV7-DRAFT]` **Implemented** · evidence **U** · 09_registration.test.cjs — custody class/path bounded at registration · findings: CL-42

**VF-SEC-004:** The source Commitment Vault Lock identifier is consumed
only after successful Base issuance.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-SEC-005:** A relayer or price-batch submitter obtains no authority
to change protocol parameters or redirect user or Dev Fund value.

> `[REV7-DRAFT]` **Implemented** · evidence **E** · 02_oracle.test.cjs — any address may submit; submitter gains no authority · findings: CL-01

**VF-SEC-006:** Principal release remains independent of every
Base-chain and external dependency.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-SEC-007:** Signing-key redundancy and price-source redundancy are distinct
properties and shall not be conflated. A threshold signing arrangement, where
adopted, protects the ability to authenticate a price publication against key
compromise or loss. It does not establish an alternative source of truth for the
price itself.

VF-SEC-003 remains absolute regardless of signing configuration. Insufficient
valid signatures, stale data, missing data, or any other verification failure
results in no valuation and therefore no issuance-dependent operation. No
fallback price source, last-known-good substitution, or administrative override
shall be introduced to maintain availability.

> `[REV7-NEW]` Origin CL-38. Exists to close a specific future argument: that
> redundancy in signing licenses a fallback price source. It does not.
>
> `[REV7-DRAFT]` **Implemented** · evidence **E** · 02_oracle.test.cjs and
> 04_endtoend.test.cjs — no path substitutes a price on any failure

# 15. Deployment, Immutability, and Configuration Finalization

The specification defines binding behavior and architectural
constraints. The implementer may design concrete integration and
deployment methods only within those constraints. Prototype construction
is not deployment authorization.

**VF-DEP-001:** The implementation remains inactive until every required
registry entry, blockchain identifier, Dev Fund destination, Axelar ITS
dependency, proof-verification dependency, and fixed protocol parameter
has been populated and validated.

> `[REV7-DRAFT]` **Implemented** · evidence **I** · 01_findings.test.cjs — issuance inactive until finalization · findings: CL-35

**VF-DEP-002:** An incomplete, missing, provisional, guessed, zero, or
inconsistent configuration cannot be permanently finalized.

> `[REV7-DRAFT]` **Implemented** · evidence **U** · 02_oracle.test.cjs, 09_registration — zero and out-of-domain rejected · findings: CL-36, CL-42

**VF-DEP-003:** After successful finalization, configuration changes,
upgrades, administrator intervention, and replacement dependencies are
impossible.

> `[REV7-DRAFT]` **Implemented** · evidence **U** · 03_handshake.test.cjs — configuration closed after finalize · findings: CL-02

**VF-DEP-004:** The implementer may select the concrete initialization
procedure but must provide verifiable evidence that the deployed
configuration matches this specification.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-DEP-005:** The deployment package records contract addresses,
environment identifiers, configuration values, source hashes, compiler
settings, dependency lockfiles, and deployed bytecode hashes, and
preserves a copy of the exact machine-readable registry artifact used
for deployment. Registry conformity is evaluated under VF-REG-011.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-DEP-006:** Any temporary deployment authority must be demonstrably
and irreversibly terminated before finalization.

> `[REV7-DRAFT]` **Implemented** · evidence **U + I** · 01_findings.test.cjs — ceremony closes irreversibly · findings: CL-02

**VF-DEP-007:** The absence of proxy upgrade paths, pause paths, rescue
paths, and discretionary value routes must be independently verifiable.

> `[REV7-DRAFT]` **Implemented** · evidence **U** · configurationFinalized is publicly readable · findings: CL-02

**VF-DEP-008:** Prototype development does not require final external
addresses and does not authorize broadcasting a deployment.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

## 15.1 Required finalization evidence

1.  Freeze the current Master Specification and source commit.

2.  Freeze the complete 1,001-entry registry and its S1/S2/S3
    classifications.

3.  Freeze the 17 canonical environment identifiers and finality rules.

4.  Insert and verify all 17 fixed Dev Fund destinations.

5.  Freeze the price-fetcher, signed/batched path, proof architecture,
    and Axelar ITS integration configuration.

6.  Freeze compiler versions, dependency lockfiles, optimizer settings,
    deployment scripts, and bytecode.

7.  Deploy and complete required one-time initialization.

8.  Verify configuration counts, references, bytecode, authority
    termination, and permanent immutability.

9.  Publish the deployment manifest and verification evidence.

# 16. Verification, Testing, and Specification Traceability

A passing test proves that an implementation behaved as its test
expected. It does not prove that the expectation matched this
specification. Every meaningful test and deployment check must therefore
trace to one or more numbered requirements.

**VF-VER-001:** Each numbered requirement maps to applicable contracts,
source-environment programs, functions, tests, and deployment checks.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-VER-002:** Positive tests demonstrate every intended successful
lifecycle, including one-use and three-use Handshake allowances, each
new objectively distinct identity receiving its own applicable
allowance, source-state and proof-verification-path enforcement, and
recognized pending-attempt resolution.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-VER-003:** Negative tests demonstrate rejection of invalid amounts,
assets, prices, proofs, destinations, recipients, outputs, replays,
premature releases, cap breaches, unauthorized control, over-limit
Handshakes, arbitrary out-of-protocol transactions, ambiguous or
multi-key UTXO release paths, duplicate official submissions while
objectively pending, and any timer-, mempool-, or non-observation-based
clearing of a still-valid transaction. Tests also establish that failed,
reverted, invalid, objectively expired, replaced, and unrecognized
attempts consume no allowance.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-VER-004:** Boundary tests cover exact thresholds, timestamps, fee
rounding, one-use and three-use Handshake limits, canonical
release-public-key normalization across permitted encodings and script
wrappers, objective pending-attempt disposition and invalidation,
multiplier transitions, epoch boundaries, term expirations, and
lifetime-cap behavior.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-VER-005:** Principal-isolation tests demonstrate release after
maturity despite failure of Base issuance, price updates, relayers,
epoch processing, and external integrations.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-VER-006:** Independent reproduction is stronger evidence than
self-reported pass counts.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-VER-007:** No package may be described as production-ready or
deployment-ready merely because it compiles or has a high passing-test
count.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-VER-008:** A divergence between code and this specification is an
implementation defect or a newly identified specification matter; code
does not prevail by default.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

# 17. Machine-Readable, Transfer, and Market Representations

## 17.1 Machine-readable records

-   The repository preserves the current human-readable Master
    Specification.

-   A machine-readable registry preserves every approved asset identity,
    environment, classification, pricing identifier, and source
    metadata.

-   The deployment manifest identifies every live address, environment
    identifier, source commit, bytecode hash, dependency, and fixed Dev
    Fund destination.

-   Public website language derives from the current specification and
    does not add economic promises or protocol features.

-   The public registry may display Symbol, Name, Environment, Price,
    Price Source, Last Updated, Contract or native identity, and
    available pricing metadata.

-   Website price data refreshes twice per day using the established
    price-fetcher process.

## 17.2 External trading and listings

External users and venues may transfer or trade protocol tokens without
changing Vinculum Finalis. The protocol\'s intention to pursue exchange
listings is a development objective rather than a promise of
availability or value.

**VF-PUB-001:** Every public and machine-readable representation must
remain consistent with the current Master Specification.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-PUB-002:** Public price displays must identify the selected source
and last update time without presenting the reference as a guaranteed
trading price.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-PUB-003:** Exchange or liquidity-venue activity cannot modify
protocol calculations or supply accounting.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-PUB-004:** The production price signing configuration, and any operational
risk accepted in choosing it, shall be publicly disclosed before live deployment.
The disclosure shall state the number of signing authorities required, whether
their custody domains are independent, and the consequences of compromise or of
permanent loss of signing capability.

> `[REV7-NEW]` Origin CL-38, added following independent specification audit.
> This is the minimal addition: it creates a disclosure obligation that no existing
> requirement carries. VF-EXT-002 governs reporting of unavailable or unfinished
> deliverables and does not reach a completed configuration with an accepted risk.
> VF-PUB-001 requires consistency with the specification rather than disclosure of
> a trust model. VF-PUB-002 concerns the provenance of a displayed price, not the
> custody of the key that signs it.
>
> **No protocol behaviour changes.** The obligation falls on the deployment, not on
> the contracts.
>
> `[REV7-DRAFT]` **Not implemented** · evidence **S** · Deployment deliverable,
> satisfied by publication rather than by code.

# 18. Explicitly Superseded Concepts

The following concepts are rejected or superseded. Their presence in
historical code, documents, tests, or conversations does not authorize
their return.

-   Governance, voting seats, proposal deposits, councils,
    administrative treasury discretion, or governance staking.

-   Admin keys, upgradeability, pausing, rescue authority, or
    post-deployment parameter adjustment.

-   Fee splitting, fee conversion, fee swapping, preferred-stable
    routing, a value-holding protocol treasury, or multiple fee
    destinations.

-   Any Commitment Vault Lock that produces both VCLM and CHONX.

-   Using VCLM, CHONX, or SYNTH as Commitment Vault Lock input.

-   A preferential VCLM-to-CHONX Commitment Vault Lock route.

-   Delaying Treasury Reward Stake until CHONX activation.

-   A universal one-use or universal three-use Trust-Building Handshake
    allowance that ignores the selected source mechanism\'s state
    capability, a \$100 Handshake ceiling, or charging 5.00% for later
    one-hour attempts.

-   A 160-day Treasury Reward Stake term or a 120-day multiplier other
    than 2.0x.

-   Treating WETH, WBTC, or alternate-chain forms as S2.

-   A 14- or 16-environment architecture.

-   Two-source price consensus, a 5% source-spread rule, lower-median
    pricing, a 10-minute price-freshness rule, or a new reporter
    committee.

-   Market-price adjustment of the permanent \$0.10 Reward Reference
    Value.

-   Asset multipliers changing VCLM or CHONX decay.

-   Bridging or wrapping Commitment Vault principal.

-   Early release or renewal of a Commitment Vault Lock.

-   Independent protocol-token supplies or replacement of Axelar ITS
    with another cross-chain token system.

# 19. Required Architecture Deliverables and Deferred External Inputs

The behavioral decisions in this specification are binding and fully
incorporate the presently approved amendment set. The items below are
implementation, deployability-evidence, and deployment deliverables, not
permission to change behavior. Their absence prevents deployment but
does not require the specification to prescribe every low-level design
choice. No owner decision remains open.

  -----------------------------------------------------------------------
  **Deliverable**    **Required outcome**               **Stage**
  ------------------ ---------------------------------- -----------------
  17-environment     One deterministic finality         Architecture
  finality matrix    condition for every supported      before
                     environment                        implementation

  Cross-chain proof  Evidence and replay behavior       Architecture
  architecture       conforming to Section 11.3         before
                                                        implementation

  Axelar ITS         One globally reconciled            Architecture
  integration        protocol-token system governed     before
                     from Base                          implementation

  Dev Fund           One fixed destination for every    After prototype
  destinations       supported environment              review and before
                                                        heavy testing

  Production         All addresses, identifiers,        Before deployment
  dependencies       signers, and contract references   finalization
                     verified                           

  Deployment         Source, configuration, bytecode,   Before deployment
  evidence           hashes, and authority termination  is considered
                     recorded                           complete

  Handshake          Per-environment evidence for the   Architecture and
  identity,          one-versus-three allowance,        deployability
  allowance, and     canonical UTXO release-public-key  evidence before
  pending-attempt    identity, official-application     implementation
  verifier           prevention, and objective          
                     pending-attempt disposition        

  Cosmos Hub         Complete the required capability,  Architecture
  chain-native       candidate-mechanism,               before
  feasibility        deployability, and                 implementation
  analysis           invariant-failure analysis without 
                     inventing a fallback or changing   
                     protocol behavior                  
  -----------------------------------------------------------------------

**VF-EXT-001:** The implementer may design a chain-native architecture
only within the requirements and prohibitions of this specification. A
design is judged by equivalent required outcomes, security, and economic
performance rather than resemblance to an EVM contract.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

**VF-EXT-002:** An unavailable external address or unfinished
architecture deliverable must be reported as incomplete rather than
replaced with an invented value or behavior.

> `[REV7-DRAFT]` **PROCESS** · evidence **S** · Governs project conduct, not contract behaviour. See Rev 7 amendments

**VF-EXT-003:** No live deployment may be finalized until every
deliverable required for that deployment has been completed and
verified.

> `[REV7-DRAFT]` **NOT YET REVIEWED** — no coverage analysis has been performed. No claim is made either way.

# Appendix A. Consolidated Formulas and Schedules

## A.1 Commitment Vault issuance

**Output = Verified Gross USD Value x current emission rate x asset
multiplier x Commitment Vault Lock duration multiplier**

Apply the factors in the written order using 18-decimal fixed-point
arithmetic. Round down at every integer division and finally express the
result in the output token\'s smallest units.

## A.2 Asset multipliers

  ------------------------------------------------------------------------------
  **Class**   **Multiplier**   **Exact canonical assets**
  ----------- ---------------- -------------------------------------------------
  S1          1.5x             Ethereum USDC and Ethereum USDT

  S2          1.3x             Native Ethereum ETH, native Bitcoin BTC, Ethereum
                               AAVE, Ethereum LINK, Ethereum UNI

  S3          1.0x             Every other approved registry entry
  ------------------------------------------------------------------------------

## A.3 Treasury Reward Stake Weight

**Weight = staked amount x token multiplier x staking-duration
multiplier**

  -----------------------------------------------------------------------
  **Token**                           **Multiplier**
  ----------------------------------- -----------------------------------
  VCLM                                1.0x

  CHONX                               2.0x

  SYNTH                               4.0x
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------
  **Duration**                        **Multiplier**
  ----------------------------------- -----------------------------------
  30 days                             1.0x

  60 days                             1.4x

  90 days                             1.75x

  120 days                            2.0x
  -----------------------------------------------------------------------

## A.4 Fee Routing and Reward Accounting

The Dev Fund receives 100% of the actual rounded Commitment Vault fee in
the fee asset\'s original form. Commitment principal remains isolated in
the Commitment Vault Lock. No fee is swapped, converted, bridged, or
divided among destinations.

**Reward-Accounting Credit = Verified USD Fee Value x 60%**

**Epoch Reward Basis = sum of Reward-Accounting Credits**

**Epoch Reward VCLM = Epoch Reward Basis / \$0.10**

Reward-Accounting Credit is numerical state rather than an asset. When
an epoch calculation and allocation are irreversibly recorded, every
included credit becomes a Used Reward-Accounting Credit and cannot be
used again.

## A.5 Lifetime capacity and cap rejection

**Remaining lifetime capacity = hard cap - cumulative lifetime protocol
issuance**

A calculated Commitment Vault output or complete epoch reward must fit
within remaining capacity. Otherwise it is rejected in full. Burns and
Axelar ITS transport do not restore lifetime capacity.

# Appendix B. Canonical Terminology

## B.1 Users, Commitment Vault Locks, and fees

  -----------------------------------------------------------------------
  **Canonical       **Required meaning**
  term**            
  ----------------- -----------------------------------------------------
  User              A wallet-controlled actor using Vinculum Finalis.
                    This is the universal protocol-actor term.

  Commitment Vault  A non-renewable source-chain timelock of an approved
  Lock              external asset that authorizes exactly one selected
                    VCLM or activated CHONX output after successful Base
                    verification.

  Trust-Building    A one-hour Commitment Vault Lock from \$0.95 through
  Handshake         \$1.05 inclusive, charging 2.50%, with an allowance
                    of one or three successful qualifying uses per
                    objectively bound source-chain identity according to
                    the selected source mechanism\'s state capability.

  Verified Gross    The accepted USD reference value of the complete
  USD Value         gross asset amount used as the Commitment Vault
                    issuance basis.

  Commitment Vault  The actual rounded fee transferred separately to the
  fee               fixed Dev Fund destination in the original asset.

  Commitment Vault  The gross asset units remaining after the actual fee;
  principal         held until maturity and released independently of
                    Base systems.

  Original-form fee Transfer of 100% of the actual fee to the fixed Dev
  routing           Fund destination in the same asset, with no swap,
                    conversion, bridge, or division.

  Dev Fund          The recipient of all actual Commitment Vault fee
                    assets. It receives no Commitment Vault principal.

  Handshake         The objectively recorded source-chain identity
  identity          deterministically bound into recognized lock
                    evidence: a source account for account-model
                    mechanisms or one canonical release public key for
                    UTXO-family mechanisms.

  Canonical release For a UTXO-family mechanism, the single canonically
  public key        serialized public key authorizing the principal\'s
                    maturity-release branch; it is the only UTXO
                    Handshake identity and is proved against the
                    output\'s script evidence.

  Objectively       An official Handshake submission that has neither
  pending Handshake reached a terminal source-chain disposition nor
  attempt           become objectively invalid. It does not clear through
                    elapsed time, mempool disappearance, non-observation,
                    or an application-local timer.
  -----------------------------------------------------------------------

## B.2 Price and reward accounting

  -----------------------------------------------------------------------
  **Canonical term**  **Required meaning**
  ------------------- ---------------------------------------------------
  Signed and batched  The established method that carries the twice-daily
  price path          first-valid-price record to Base.

  Verified USD Fee    The accepted USD valuation of the actual rounded
  Value               Commitment Vault fee, using the same applicable
                      price record as the gross value.

  Reward-Accounting   Numerical state equal to 60% of Verified USD Fee
  Credit              Value. It is not an asset or claim against Dev Fund
                      assets.

  Epoch Reward Basis  The sum of Reward-Accounting Credits assigned to
                      one 10-day epoch.

  Permanent Reward    The fixed \$0.10 per VCLM value used only to
  Reference Value     convert Epoch Reward Basis into Epoch Reward VCLM.

  Epoch Reward VCLM   The complete newly minted VCLM reward calculated
                      for an epoch, subject to remaining lifetime
                      capacity.

  Used                A credit included in an irreversibly recorded epoch
  Reward-Accounting   calculation and allocation; it can never be used
  Credit              again.

  Fee-indexed reward  VCLM reward issuance calculated from fee activity
  issuance            without being funded, collateralized, or redeemable
                      from Dev Fund assets.
  -----------------------------------------------------------------------

## B.3 Treasury Reward Stake

  -----------------------------------------------------------------------
  **Canonical term**  **Required meaning**
  ------------------- ---------------------------------------------------
  Treasury Reward     The protocol mechanism through which eligible VCLM,
  Stake               CHONX, and SYNTH positions earn newly minted VCLM.

  Treasury Reward     One user-owned protocol-token position with one
  Stake position      active fixed term and no more than one queued
                      future term.

  Token multiplier    VCLM 1.0x, CHONX 2.0x, or SYNTH 4.0x.

  Staking-duration    30 days 1.0x, 60 days 1.4x, 90 days 1.75x, or 120
  multiplier          days 2.0x.

  Treasury Reward     Staked amount multiplied by token multiplier and
  Stake Weight        staking-duration multiplier.

  10-day epoch        One fixed half-open reward-accounting interval
                      measured from protocol launch.
  -----------------------------------------------------------------------

## B.4 Asset and interchain terminology

  -----------------------------------------------------------------------
  **Canonical term**  **Required meaning**
  ------------------- ---------------------------------------------------
  S1                  The two exact canonical Ethereum stablecoin
                      identities, USDC and USDT, using a 1.5x Commitment
                      Vault issuance multiplier.

  S2 - Selected Five  Native Ethereum ETH, native Bitcoin BTC, and
  Assets              canonical Ethereum AAVE, LINK, and UNI, using a
                      1.3x multiplier.

  S3                  Every other approved registry entry, using a 1.0x
                      multiplier.

  Axelar ITS protocol VCLM, CHONX, or SYNTH managed through Axelar
  token               Interchain Token Service, with Base as the
                      canonical issuance and accounting blockchain and
                      one globally reconciled supply.
  -----------------------------------------------------------------------

## B.5 Required formula language

**Commitment output = Verified Gross USD Value x emission rate x asset
multiplier x duration multiplier**

**Reward-Accounting Credit = Verified USD Fee Value x 60%**

**Epoch Reward Basis = sum of Reward-Accounting Credits**

**Epoch Reward VCLM = Epoch Reward Basis / \$0.10**

**Treasury Reward Stake Weight = staked amount x token multiplier x
staking-duration multiplier**

## B.6 Terminology and interpretations that are not current behavior

-   A fee-asset split between the Dev Fund and another destination.

-   A protocol treasury or reserve that receives or holds Commitment
    Vault fee assets.

-   Fee conversion, fee swapping, or preferred-stable routing.

-   A dual-output or dual-path Commitment Vault Lock.

-   A governance stake or governance-derived reward mechanism.

-   A generic collective-container label used in place of Treasury
    Reward Stake.

-   A universal one-use or universal three-use Handshake allowance that
    ignores the selected source mechanism\'s state capability, a \$100
    Handshake ceiling, or a later one-hour path charging 5.00%.

-   A price-consensus, source-spread, lower-median, or
    10-minute-freshness requirement.

-   An independent per-chain VCLM, CHONX, or SYNTH supply.

# Appendix C. Complete Approved Asset Registry

This appendix is the governing registry dataset and incorporates all
1,001 approved entries in registry-row order. Registry Row is a document
reference, not a market ranking. Dynamic prices, volumes, and update
times are intentionally excluded. Machine-readable representations
conform through exact field-level equality under VF-REG-011; filename,
whitespace, object-key order, and formatting are not protocol behavior.

  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Registry   **Symbol**     **Asset name**     **Environment**   **Contract or native identifier**                 **Class**   **Pricing identifier**
  Row**                                                                                                                          
  ------------ -------------- ------------------ ----------------- ------------------------------------------------- ----------- -------------------------------------------
  1            USDC           USD Coin           Ethereum          0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48        S1          usd-coin

  2            ETH            Ethereum           Ethereum          NATIVE ETH; pricing reference                     S2          ethereum
                                                                   WETH:0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2               

  3            BTC            Bitcoin            Bitcoin           NATIVE --- no EVM contract                        S2          bitcoin

  4            DOGE           Dogecoin           Dogecoin          NATIVE --- no EVM contract                        S3          dogecoin

  5            SOL            Solana             Solana            NATIVE                                            S3          solana
                                                                   (So11111111111111111111111111111111111111112                  
                                                                   wrapped)                                                      

  6            USDT           Tether             Ethereum          0xdAC17F958D2ee523a2206206994597C13D831ec7        S1          tether

  7            WBTC           Wrapped Bitcoin    Ethereum          0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599        S3          wrapped-bitcoin

  8            LINK           Chainlink          Ethereum          0x514910771AF9Ca656af840dff83E8264EcF986CA        S2          chainlink

  9            stETH          Lido Staked ETH    Ethereum          0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84        S3          staked-ether

  10           DAI            Dai                Ethereum          0x6B175474E89094C44Da98b954EedeAC495271d0F        S3          dai

  11           USDC_ARB       USDC (Arbitrum)    Arbitrum          0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8        S3          usd-coin

  12           XRP            XRP                XRP Ledger        NATIVE --- no EVM contract                        S3          ripple

  13           UNI            Uniswap            Ethereum          0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984        S2          uniswap

  14           AAVE           Aave               Ethereum          0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9        S2          aave

  15           LDO            Lido               Ethereum          0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32        S3          lido-dao

  16           USDC_SOL       USDC on Solana     Solana            EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v      S3          usd-coin

  17           SHIB           Shiba Inu          Ethereum          0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE        S3          shiba-inu

  18           BNB            BNB                BNB Smart Chain   0x0000000000000000000000000000000000000000        S3          binancecoin

  19           LTC            Litecoin           Litecoin          NATIVE --- no EVM contract                        S3          litecoin

  20           USDT_ARB       USDT (Arbitrum)    Arbitrum          0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9        S3          tether

  21           PEPE           Pepe               Ethereum          0x6982508145454Ce325dDbE47a25d4ec3d2311933        S3          pepe

  22           ARB            Arbitrum           Arbitrum          0x912CE59144191C1204E64559FE8253a0e49E6548        S3          arbitrum

  23           AVAX           Avalanche          Avalanche         0x0000000000000000000000000000000000000000        S3          avalanche-2

  24           wstETH         Wrapped Lido stETH Ethereum          0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0        S3          wrapped-steth

  25           CBETH          Coinbase Wrapped   Base              0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22        S3          coinbase-wrapped-staked-eth
                              ETH                                                                                                

  26           OP             Optimism           Optimism          0x4200000000000000000000000000000000000042        S3          optimism

  27           SKY            Sky Protocol       Ethereum          0x56072C95FAA701256059aa122697B133aDEd9279        S3          sky

  28           CBBTC          Coinbase BTC       Base              0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf        S3          coinbase-wrapped-btc

  29           USDS           Sky Dollar         Ethereum          0xdC035D45d973E3EC169d2276DDab16f1e407384F        S3          usds

  30           BONK           BONK               Solana            DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263      S3          bonk

  31           PENGU          Pudgy Penguins     Solana            2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv      S3          pudgy-penguins

  32           MKR            Maker              Ethereum          0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2        S3          maker

  33           WIF            Dogwifhat          Solana            EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm      S3          dogwifcoin

  34           AERO           Aerodrome          Base              0x940181a94A35A4569E4529A3CDfB74e38FD98631        S3          aerodrome-finance

  35           GRT            The Graph          Ethereum          0xc944E90C64B2c07662A292be6244BDf05Cda44a7        S3          the-graph

  36           ENS            ENS                Ethereum          0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72        S3          ethereum-name-service

  37           PAXG           Pax Gold           Ethereum          0x45804880De22913dAFE09f4980848ECE6EcbAf78        S3          pax-gold

  38           WBTC_ARB       WBTC (Arbitrum)    Arbitrum          0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f        S3          wrapped-bitcoin

  39           USDC_OP        USDC (Optimism)    Optimism          0x7F5c764cBc14f9669B88837ca1490cCa17c31607        S3          usd-coin

  40           USDC_POL       USDC (Polygon)     Polygon           0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174        S3          usd-coin

  41           USDC_BSC       USDC (BSC)         BNB Smart Chain   0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d        S3          usd-coin

  42           USDC_AVAX      USDC (Avalanche)   Avalanche         0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E        S3          usd-coin

  43           LINK_ARB       LINK (Arbitrum)    Arbitrum          0xf97f4df75117a78c1A5a0DBb814Af92458539FB4        S3          chainlink

  44           DAI_ARB        DAI (Arbitrum)     Arbitrum          0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1        S3          dai

  45           cbBTC          Coinbase BTC       Base              0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf        S3          coinbase-wrapped-btc

  46           IMX            Immutable          Ethereum          0xF57e7e7C23978C3cAEC3C3548E3D615c346e79fF        S3          immutable-x

  47           PENDLE         Pendle Finance     Ethereum          0x808507121B80c02388fAd14726482e061B8da827        S3          pendle

  48           EIGEN          EigenLayer         Ethereum          0xec53bF9167f50cDEB3Ae105f56099aaaB9061F83        S3          eigenlayer

  49           USDT_POL       USDT (Polygon)     Polygon           0xc2132D05D31c914a87C6611C10748AEb04B58e8F        S3          tether

  50           USDT_BSC       USDT (BSC)         BNB Smart Chain   0x55d398326f99059fF775485246999027B3197955        S3          tether

  51           GMX            GMX                Arbitrum          0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a        S3          gmx

  52           MATIC          Polygon (old)      Ethereum          0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0        S3          matic-network

  53           RNDR           Render             Ethereum          0x6De037ef9aD2725EB40118Bb1702EBb27e4Aeb24        S3          render-token

  54           BCH            Bitcoin Cash       Bitcoin Cash      NATIVE --- no EVM contract                        S3          bitcoin-cash

  55           SNX            Synthetix          Ethereum          0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F        S3          havven

  56           CRV            Curve              Ethereum          0xD533a949740bb3306d119CC777fa900bA034cd52        S3          curve-dao-token

  57           1INCH          1inch              Ethereum          0x111111111117dC0aa78b770fA6A738034120C302        S3          1inch

  58           RPL            Rocket Pool        Ethereum          0xD33526068D116cE69F19A9ee46F0bd304F21A51f        S3          rocket-pool

  59           rETH           Rocket Pool ETH    Ethereum          0xae78736Cd615f374D3085123A210448E74Fc6393        S3          rocket-pool-eth

  60           ENA            Ethena             Ethereum          0x57e114B691Db790C35207b2e685D4A43181e6061        S3          ethena

  61           RON            Ronin              Ethereum          0xEf7768Af3C0BcFcb37BcF7d0d6a5e72b9DE36F5F        S3          ronin

  62           CAKE           PancakeSwap        BNB Smart Chain   0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82        S3          pancakeswap-token

  63           CHZ            Chiliz             Ethereum          0x3506424F91fD33084466F402d5D97f05F8e3b4AF        S3          chiliz

  64           FET            Fetch.ai           Ethereum          0xaea46A60368A7bD060eec7DF8CBa43b7EF41Ad85        S3          fetch-ai

  65           USDe           Ethena USDe        Ethereum          0x4c9EDD5852cd905f086C759E8383e09bff1E68B3        S3          ethena-usde

  66           ONDO           Ondo Finance       Ethereum          0xfAbA6f8e4a5E8Ab82F62fe7C39859FA577269BE3        S3          ondo-finance

  67           OKB            OKB                Ethereum          0x75231F58b43240C9718Dd58B4967c5114342a86c        S3          okb

  68           GHO            Aave GHO           Ethereum          0x40D16FC0246aD3160Ccc09B8D0D3A2cD28aE6C2f        S3          gho

  69           COMP           Compound           Ethereum          0xc00e94Cb662C3520282E6f5717214004A7f26888        S3          compound-governance-token

  70           CBBTC_ETH      cbBTC (Ethereum)   Ethereum          0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf        S3          coinbase-wrapped-btc

  71           FLOKI          Floki              Ethereum          0xcf0C122c6b73ff809C693DB761e7BaeBe62b6a2E        S3          floki

  72           PYTH           Pyth Network       Solana            HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3      S3          pyth-network

  73           VIRTUAL        Virtuals Protocol  Base              0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b        S3          virtual-protocol

  74           BLUR           Blur               Ethereum          0x5283D291DBCF85356A21bA090E6db59121208b44        S3          blur

  75           BRETT          Brett              Base              0x532f27101965dd16442E59d40670FaF5eBB142E4        S3          brett

  76           PSG            PSG Fan Token      Ethereum          0x8A953CfE442c5E8855cc6c61b1293FA648BAE472        S3          paris-saint-germain-fan-token

  77           BAR            Barcelona Fan      Ethereum          0x340D2bdE5Eb28c1eed91B2f790723E3B160613B7        S3          fc-barcelona-fan-token
                              Token                                                                                              

  78           JTO            Jito               Solana            jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL       S3          jito-governance-token

  79           JUP            Jupiter            Solana            JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN       S3          jupiter-exchange-solana

  80           RAY            Raydium            Solana            4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R      S3          raydium

  81           PYUSD          PayPal USD         Ethereum          0x6c3ea9036406852006290770BEdFcAbA0e23A0e8        S3          paypal-usd

  82           AAVE_ARB       AAVE (Arbitrum)    Arbitrum          0xba5DdD1f9d7F570dc94a51479a000E3BCE967196        S3          aave

  83           AAVE_OP        AAVE (Optimism)    Optimism          0x76FB31fb4af56892A25e32cFC43De717950c9278        S3          aave

  84           AAVE_POL       AAVE (Polygon)     Polygon           0xD6DF932A45C0f255f85145f286eA0b292B21C90B        S3          aave

  85           UNI_ARB        UNI (Arbitrum)     Arbitrum          0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0        S3          uniswap

  86           UNI_OP         UNI (Optimism)     Optimism          0x6fd9d7AD17242c41f7131d257212c54A0e816691        S3          uniswap

  87           WBTC_OP        WBTC (Optimism)    Optimism          0x68f180fcCe6836688e9084f035309E29Bf0A2095        S3          wrapped-bitcoin

  88           WBTC_POL       WBTC (Polygon)     Polygon           0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6        S3          wrapped-bitcoin

  89           DAI_OP         DAI (Optimism)     Optimism          0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1        S3          dai

  90           DAI_POL        DAI (Polygon)      Polygon           0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063        S3          dai

  91           LINK_POL       LINK (Polygon)     Polygon           0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39        S3          chainlink

  92           LINK_BSC       LINK (BSC)         BNB Smart Chain   0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD        S3          chainlink

  93           LINK_AVAX      LINK (Avax)        Avalanche         0x5947BB275c521040051D82396192181b413227A3        S3          chainlink

  94           AAVE_AVAX      AAVE (Avax)        Avalanche         0x63a72806098Bd3D9520cC43356dD78afe5D386D9        S3          aave

  95           BAL            Balancer           Ethereum          0xba100000625a3754423978a60c9317c58a424e3D        S3          balancer

  96           DAI_BSC        DAI (BSC)          BNB Smart Chain   0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3        S3          dai

  97           SPX            SPX6900            Ethereum          0xE0f63A424a4439cBE457D80E4f4b51aD25b2c56C        S3          spx6900

  98           WLD            Worldcoin          Ethereum          0x163f8C2467924be0ae7B5347228CABF260318753        S3          worldcoin-wld

  99           DEGEN          Degen              Base              0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed        S3          degen-base

  100          DGB            DigiByte           DigiByte          NATIVE --- no EVM contract                        S3          digibyte

  101          BAT            Basic Attention    Ethereum          0x0D8775F648430679A709E98d2b0Cb6250d2887EF        S3          basic-attention-token
                              Token                                                                                              

  102          LUSD           Liquity LUSD       Ethereum          0x5f98805A4E8be255a32880FDeC7F6728C6568bA0        S3          liquity-usd

  103          PENDLE_ARB     Pendle (Arbitrum)  Arbitrum          0x0c880f6761F1af8d9Aa9C466984b80DAb9a8c9e8        S3          pendle

  104          RNDR           Render Network     Solana            0x6De037ef9aD2725EB40118Bb1702EBb27e4Aeb24        S3          render-token

  105          POPCAT         Popcat             Solana            7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr      S3          popcat

  106          FARTCOIN       Fartcoin           Solana            9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump      S3          fartcoin

  107          MEW            Cat in a Dogs      Solana            MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5       S3          cat-in-a-dogs-world
                              World                                                                                              

  108          COW            CoW Protocol       Ethereum          0xDEf1CA1fb7FBcDC777520aa7f396b4E015F497aB        S3          cow-protocol

  109          MNT            Mantle             Ethereum          0x3c3a81e81dc49A522A592e7622A7E711c06bf354        S3          mantle

  110          STRK           Starknet           Ethereum          0xCa14007Eff0dB1f8135f4C25B34De49AB0d42766        S3          starknet

  111          ZK             zkSync             Ethereum          0x5A7d6b2F92C77FAD6CCaBd7EE0624E64907Eaf3E        S3          zksync

  112          CRO            Cronos             Ethereum          0xA0b73E1Ff0B80914AB6fe0444E65848C4C34450b        S3          crypto-com-chain

  113          VELO           Velodrome          Optimism          0x3c8B650257cFb5f272f799F5e2b4e65093a11a05        S3          velodrome-finance

  114          POL            POL                Ethereum          0x455e53CBB86018Ac2B8092FdCd39d8444aFFC3F6        S3          matic-network

  115          YFI            Yearn              Ethereum          0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e        S3          yearn-finance

  116          FXS            Frax Share         Ethereum          0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0        S3          frax-share

  117          FRAX           Frax               Ethereum          0x853d955aCEf822Db058eb8505911ED77F175b99e        S3          frax

  118          CRVUSD         Curve crvUSD       Ethereum          0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E        S3          crvusd

  119          USDT_OP        USDT (Optimism)    Optimism          0x94b008aA00579c1307B0EF2c499aD98a8ce58e58        S3          tether

  120          CVX            Convex             Ethereum          0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B        S3          convex-finance

  121          USDT_AVAX      USDT (Avax)        Avalanche         0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7        S3          tether

  122          ai16Z          ai16z              Solana            HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC      S3          ai16z

  123          MOG            Mog Coin           Ethereum          0xaaee1a9723aadb7afa2810263653a34ba2c21c7a        S3          mog-coin

  124          APE            ApeCoin            Ethereum          0x4d224452801ACEd8B2F0aebE155379bb5D594381        S3          apecoin

  125          BLAST          Blast              Ethereum          0xb1a5700fA2358173Fe465e6eA4Ff52E36e88E2ad        S3          blast

  126          JOE            Trader Joe         Avalanche         0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd        S3          joe

  127          MANA           Decentraland       Ethereum          0x0F5D2fB29fb7d3CFeE444a200298f468908cC942        S3          decentraland

  128          SAND           The Sandbox        Ethereum          0x3845badAde8e6dFF049820680d1F14bD3903a5d0        S3          the-sandbox

  129          AXS            Axie Infinity      Ethereum          0xBB0E17EF65F82Ab018d8EDd776e8DD940327B28b        S3          axie-infinity

  130          OCEAN          Ocean Protocol     Ethereum          0x967da4048cD07aB37855c090aAF366e4ce1b9F48        S3          ocean-protocol

  131          ETHFI          ether.fi           Ethereum          0xFe0c30065B384F05761f15d0CC899D4F9F9Cc0eB        S3          ether-fi

  132          sUSDe          Ethena sUSDe       Ethereum          0x9D39A5DE30e57443BfF2A8307A4256c8797A3497        S3          ethena-staked-usde

  133          WEETH          Wrapped eETH       Ethereum          0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee        S3          wrapped-eeth

  134          eETH           ether.fi eETH      Ethereum          0x35fA164735182de50811E8e2E824cFb9B6118ac2        S3          ether-fi-staked-eth

  135          MORPHO         Morpho             Ethereum          0x58D97B57BB95320F9a05dC918Aef65434969c2B2        S3          morpho

  136          LQTY           Liquity            Ethereum          0x6DEA81C8171D0bA574754EF6F8b412F2Ed88c54D        S3          liquity

  137          DYDX           dYdX               Ethereum          0x92D6C1e31e14520e676a687F0a93788B716BEff5        S3          dydx

  138          TigerOG        TigerOG            Base              0xCF7Fc0De71238c9EC45EC2Fd24FDc8521345dbB5        S3          Not assigned

  139          WOO            WOO Network        Arbitrum          0xcAFcD85D8ca7Ad1e1C6F82F651fA15E33AEfD07b        S3          woo-network

  140          FRXETH         Frax Ether         Ethereum          0x5E8422345238F34275888049021821E8E08CAa1f        S3          frax-ether

  141          SNS            Synthetix v3 SNX   Optimism          0x8700dAec35aF8Ff88c16BdF0418774CB3D7599B4        S3          havven

  142          PNUT           Peanut             Solana            2qEHjDLDLbuBgRYvsxhc5D6uDWAivNFZGan56P1tpump      S3          peanut-the-squirrel

  143          BOME           Book of Meme       Solana            ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82       S3          book-of-meme

  144          TOSHI          Toshi              Base              0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4        S3          toshi

  145          PRIME          Echelon Prime      Ethereum          0xb23d80f5fefcddaa212212f028021b41ded428cf        S3          echelon-prime

  146          MAGIC          Magic (Treasure)   Arbitrum          0x539bdE0d7Dbd336b79148AA742883198BBF60342        S3          magic

  147          GMT            Green Metaverse    BNB Smart Chain   0x3019BF2a2eF8040C242C9a4c5c4BD4C81678b2A1        S3          stepn
                              Token                                                                                              

  148          sfrxETH        Staked Frax ETH    Ethereum          0xac3E018457B222d93114458476f3E3416Abbe38F        S3          staked-frax-ether

  149          TRUMP          Official Trump     Solana            6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN      S3          official-trump

  150          TNSR           Tensor             Solana            TNSRxcUxoT9xBG3de7PiJyTDYu7kskLqcpddxnEJAS6       S3          tensor

  151          JUV            Juventus Fan       Ethereum          0x41e3df7f716ab5af28c1497b354d79342923196a        S3          juventus-fan-token

  152          ACM            AC Milan Fan       Ethereum          0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2        S3          ac-milan-fan-token

  153          CITY           Man City Fan       Ethereum          0xd376df3ebf8d74ed4e0f4cdfff5b2d633ad80ba3        S3          manchester-city-fan-token

  154          AGIX           SingularityNET     Ethereum          0x5B7533812759B45C2B44C19e320ba2cD2681b542        S3          singularitynet

  155          SUSHI          SushiSwap          Ethereum          0x6B3595068778DD592e39A122f4f5a5cF09C90fE2        S3          sushi

  156          W              Wormhole           Ethereum          0xB0fFa8000886e57F86dd5264b9582b2Ad87b2b91        S3          wormhole

  157          AXL            Axelar             Ethereum          0x467719aD09025FcC6cF6F8311755809d45a5E5f3        S3          axelar

  158          FLUID          Fluid Protocol     Ethereum          0x6f40d4A6237C257fff2dB00FA0510DeEECd303eb        S3          instadapp

  159          STG            Stargate           Ethereum          0xAf5191B0De278C7286d6C7CC6ab6BB8A73bA2Cd6        S3          stargate-finance

  160          DAI_AVAX       DAI (Avax)         Avalanche         0xd586E7F844cEa2F87f50152665BCbc2C279D8d70        S3          dai

  161          PYUSD_ETH      PayPal USD         Ethereum          0x6c3ea9036406852006290770bedfcaba0e23a0e8        S3          paypal-usd

  162          BABYDOGE       Baby Doge          BNB Smart Chain   0xc748673057861a797275CD8A068AbB95A902e8de        S3          baby-doge-coin

  163          jitoSOL        JitoSOL            Solana            J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn      S3          jito-staked-sol

  164          NEIRO          Neiro              Ethereum          0xEE2a03Aa6Dacf51C18679C516ad5283d8E7C2637        S3          neiro-on-eth

  165          TURBO          Turbo              Ethereum          0xA35923162C49cF95e6BF26623385eb431ad920D3        S3          turbo

  166          ZEC            Zcash              Zcash             NATIVE --- no EVM contract                        S3          zcash

  167          BANANA         Banana Gun         Ethereum          0x38E68A37E401F7271568CecaAc63c6B1e19130B4        S3          banana-gun

  168          UNIBOT         Unibot             Ethereum          0xf819d9Cb1c2A819Fd991781A822dE3ca8607c3C9        S3          unibot

  169          KAITO          Kaito AI           Ethereum          0x98d0baa52b2d063e780de12f615f963fe8537553        S3          kaito

  170          HNT            Helium             Solana            hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux       S3          helium

  171          ORCA           Orca               Solana            orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE       S3          orca

  172          DRIFT          Drift Protocol     Solana            DriFtupJYLTosbwoN8koMbEYSx54aFAVLddWsbksjwg7      S3          drift-protocol

  173          GALA           Gala               Ethereum          0x15D4c048F83bd7e37d49eA4C83a07267Ec4203dA        S3          gala

  174          ARKM           Arkham             Ethereum          0x6e2a43be0b1d33b726f0ca3b8de60b3482b8b050        S3          arkham

  175          FIL            Filecoin           Ethereum          0x6e1A19F235bE7ED8E3369eF73b196C07257494DE        S3          filecoin

  176          KMNO           Kamino Finance     Solana            KMNo3nJsBXfcpJTVhZcXLW7RmTwTt4GVFE7suUBo9sS       S3          kamino

  177          mSOL           Marinade SOL       Solana            mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So       S3          msol

  178          SLP            Smooth Love Potion Ethereum          0xCC8Fa225D80b9c7D42F96e9570156c65D6cAAa25        S3          smooth-love-potion

  179          ELIZA          elizaOS            Solana            5voS9evDjxF589WuEub5i4ti7FWQmZCsAsyD5ucbuRqM      S3          eliza

  180          PONKE          Ponke              Solana            5z3EqYQo9HiCEs3R84RCDMu2n7anpDMxRhdK8PSWmrRC      S3          ponke

  181          MOODENG        Moo Deng           Solana            ED5nyyWEzpPPiWimP8vYm7sD7TD3LAt3Q3gRTWHzPJBY      S3          moo-deng

  182          BGB            Bitget Token       Ethereum          0x54d2252757e1672eead234d27b1270728ff90581        S3          bitget-token

  183          MUMU           Mumu the Bull      Solana            5LafQUrVco6o7KMz42eqVEJ9LW31StPyGjeeu5sKoMtA      S3          mumu-the-bull-3

  184          FDUSD          First Digital USD  BNB Smart Chain   0xc5f0f7b66764f6ec8c8dff7ba683102295e16409        S3          first-digital-usd

  185          GALXE          Galxe              BNB Smart Chain   0xe4cc45bb5dbda06db6183e8bf016569f40497aa5        S3          galxe

  186          sUSD           Synthetix sUSD     Ethereum          0x57Ab1ec28D129707052df4dF418D58a2D46d5f51        S3          synthetix-susd

  187          KCS            KuCoin Token       Ethereum          0xf34960d9d60be18cC1D5Afc1A6F012A723a28811        S3          kucoin-shares

  188          GT             Gate Token         Ethereum          0xD5CAa0dA00169686EA7b594582827043ad59639D        S3          gate

  189          USUAL          Usual Protocol     Ethereum          0xc4441c2be5d8fa8126822b9929ca0b81ea0de38e        S3          usual

  190          EUROC          Euro Coin          Ethereum          0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c        S3          euro-coin

  191          UNI_POL        UNI (Polygon)      Polygon           0xb33EaAd8d922B1083446DC23f610c2567fB5180f        S3          uniswap

  192          PIPPIN         Pippin             Solana            Dfh5DzRgSvvCFDoYc2ciTkMrbDfRKybA4SoFbPmApump      S3          pippin

  193          LUNC           Terra Classic      BNB Smart Chain   0x45b695F2594713c96B52468ED168A691986b858A        S3          terra-luna

  194          HIGHER         Higher             Base              0x0578d8a44db98b23bf096a382e016e29a5ce0ffe        S3          higher

  195          LINK_OP        LINK (Optimism)    Optimism          0x350a791Bfc2C21F9Ed5d10980Dad2e2638ffa7f6        S3          chainlink

  196          GOAT           Goat               Solana            CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump      S3          goatseus-maximus

  197          CHILLGUY       Chill Guy          Solana            Df6yfrKC8kZE3KNkrHERKzAetSxbrWeniQfyJY4Jpump      S3          chill-guy

  198          PEOPLE         ConstitutionDAO    Ethereum          0x7A58c0Be72BE218B41C608b7Fe7C5bB630736C71        S3          constitutiondao

  199          IO             io.net             Solana            BZLbGTNCSFfoth2GYDtwr7e4imWzpR5jqcUuGEwr646K      S3          io-net

  200          STEPN          GST (Solana)       Solana            AFbX8oGjGpmVFywbVouvhQSRmiW2aR1mohfahi4Y2AdB      S3          green-satoshi-token

  201          NMR            Numeraire          Ethereum          0x1776e1F26f98b1A5dF9cD347953a26dd3Cb46671        S3          numeraire

  202          API3           API3               Ethereum          0x0b38210ea11411557c13457D4dA7dC6ea731B88a        S3          api3

  203          TRB            Tellor             Ethereum          0x88dF592F8eb5D7Bd38bFeF7dEb0fBc02cf3778a0        S3          tellor

  204          UMA            UMA                Ethereum          0x04Fa0d235C4abf4BcF4787aF4CF447DE572eF828        S3          uma

  205          tBTC           Threshold tBTC     Ethereum          0x18084fbA666a33d37592fA2633fD49a74DD93a88        S3          tbtc

  206          LPT            Livepeer           Ethereum          0x58b6A8A3302369DAEc383334672404Ee733aB239        S3          livepeer

  207          GLM            Golem              Ethereum          0x7DD9c5Cba05E151C895FDe1CF355C9A1D5DA6429        S3          golem

  208          MILADY         Milady             Ethereum          0x12970e6868f88f6557b76120662c1b3e50a646bf        S3          milady-meme-coin

  209          WOJAK          Wojak              Ethereum          0x5026f006b85729a8b14553fae6af249ad16c9aab        S3          wojak

  210          GRASS          Grass              Solana            Grass7B4RdKfBCjTKgSqnXkqjwiGvQyFbuSCUJr3XXjs      S3          grass

  211          ETHX           Stader ETHx        Ethereum          0xa35b1b31ce002fbf2058d22f30f95d405200a15b        S3          stader-ethx

  212          ILV            Illuvium           Ethereum          0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E        S3          illuvium

  213          GODS           Gods Unchained     Ethereum          0xccC8cb5229B0ac8069C51fd58367Fd1e622aFD97        S3          gods-unchained

  214          PUFFER         Puffer Finance     Ethereum          0x4d1c297d39c5c1277964d0e3f8aa901493664530        S3          puffer-finance

  215          SWELL          Swell              Ethereum          0x0a6e7ba5042b38349e437ec6db6214aec7b35676        S3          swell-network

  216          METIS          Metis              Ethereum          0x9E32b13ce7f2E80A01932B42553652E053D6ed8e        S3          metis-token

  217          ANKR           Ankr               Ethereum          0x8290333ceF9e6D528dD5618Fb97a76f268f3EDD4        S3          ankr

  218          TRAC           OriginTrail        Ethereum          0xaA7a9CA87d3694B5755f213B5D04094b8d0F0A6F        S3          origintrail

  219          BIFI           Beefy Finance      Ethereum          0xb1f1ee126e9c96231cc3d3fad7c08b4cf873b1f1        S3          beefy-finance

  220          SYN            Synapse            Ethereum          0x0f2D719407FdBeFF09D87557AbB7232601FD9F29        S3          synapse-2

  221          GNS            Gains Network      Arbitrum          0x18c11fd286c5ec11c3b683caa813b77f5163a122        S3          gains-network

  222          sAVAX          Benqi sAVAX        Avalanche         0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE        S3          benqi-liquid-staked-avax

  223          BOLD           Liquity v2 BOLD    Ethereum          0x6440f144b7e50D6a8439336510312d2F54beB01D        S3          liquity-v2

  224          LRC            Loopring           Ethereum          0xBBbbCA6A901c926F240b89EacB641d8Aec7AEafD        S3          loopring

  225          TAIKO          Taiko              Ethereum          0x10dea67478c5f8c5e2d90e5e9b26dbe60c54d800        S3          taiko

  226          SCROLL         Scroll             Ethereum          0xd7d43ab7b365f0d0789ae83f4385fa1e8bc7ab2f        S3          scroll

  227          GRAIL          Camelot            Arbitrum          0x3d9907F9a368ad0a51Be60f7Da3b97cf940982D8        S3          camelot-token

  228          DIA            DIA                Ethereum          0x84cA8bc7997272c7CfB4D0Cd3D55cd942B3c9419        S3          dia-data

  229          OETH           Origin ETH         Ethereum          0x856c4efb76c1d1ae02e20ceb03a2a6a08b0b8dc3        S3          origin-ether

  230          GEARBOX        Gearbox            Ethereum          0xba3335588d9403515223f109edc4eb7269a9ab5d        S3          gearbox-protocol

  231          QI             BENQI              Avalanche         0x8729438EB15e2C8B576fCc6AeCdA6A148776C0F5        S3          benqi

  232          STORJ          Storj              Ethereum          0xB64ef51C888972c908CFacf59B47C1AfBC0Ab8aC        S3          storj

  233          QUICK          QuickSwap          Polygon           0x831753DD7087CaC61aB5644b308642cc1c33Dc13        S3          quick

  234          PENDLE_B       Pendle (Base)      Base              0xa99f6e6785da0f5d6fb42495fe424bce029eeb3e        S3          pendle

  235          GMT2           GMT (BSC)          BNB Smart Chain   0x3019BF2a2eF8040C242C9a4c5c4BD4C81678b2A1        S3          stepn

  236          NOT            Notcoin            Ethereum          0x4C22D1536FCc44a97d641f1662c99c41A358f9bd        S3          notcoin

  237          FLOKI2         FLOKI (BSC)        BNB Smart Chain   0xfb5B838b6cfEEdC2873aB27866079AC55363D37E        S3          floki

  238          MPLX           Metaplex           Solana            METAewgxyPbgwsseH8T16a39CQ5VyVxZi9zXiDPY18m       S3          metaplex

  239          MOBILE         Helium Mobile      Solana            mb1eu7TzEc71KxDpsmsKoucSSuuoGLv1drys1oP2jh6       S3          helium-mobile

  240          MNDE           Marinade Finance   Solana            MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey       S3          marinade

  241          BAND           Band Protocol      Ethereum          0xBA11D00c5f74255f56a5E366F4F77f5A186d7f55        S3          band-protocol

  242          LAYER3         Layer3             Ethereum          0x88909d489678dd17aa6d9609f89b0419bf78fd9a        S3          layer3

  243          XAUT           Tether Gold        Ethereum          0x68749665FF8D2d112Fa859AA293F07A622782F38        S3          tether-gold

  244          DODO           DODO               Ethereum          0x43Dfc4159D86F3A37A5A4B3D4580b888ad7d4DDd        S3          dodo

  245          GHST           Aavegotchi         Polygon           0x385Eeac5cB85A38A9a07A70c73e0a3271CfB54A7        S3          aavegotchi

  246          CLOUD          Sanctum            Solana            CLoUDKc4Ane7HeQcPpE3YHnznRxhMimJ4MyaUqyHFzAu      S3          sanctum-2

  247          MOCHI          Mochi              Base              0xf6e932ca12afa26665dc4dde7e27be02a7c02e50        S3          mochi-thecatcoin

  248          OHM            Olympus DAO        Ethereum          0x64aa3364F17a4D01c6f1751Fd97C2BD3D7e7f1D5        S3          olympus

  249          PIXEL          Pixels             Ethereum          0x3429d03c6f7521aec737a0bbf2e5ddcef2c3ae31        S3          pixels

  250          OLAS           Autonolas          Ethereum          0x0001a500a6b18995b03f44bb040a5ffc28e45cb0        S3          autonolas

  251          FLUX           Flux               Ethereum          0x469eda64aed3a3ad6f868c44564291aa415cb1d9        S3          zelcash

  252          ACH            Alchemy Pay        Ethereum          0xEd04915c23f00A313a544955524EB7DBD823143d        S3          alchemy-pay

  253          AKT            Akash Network      Ethereum          0x85a5b5d3e3440a05299C5FC1Da15BE355eb87051        S3          akash-network

  254          XVS            Venus Protocol     BNB Smart Chain   0xcF6BB5389c92Bdda8a3747Ddb454cB7a64626C63        S3          venus

  255          MPL            Maple Finance      Ethereum          0x33349B282065b0284d756F0577FB39c158F935e6        S3          maple

  256          MANTA          Manta Network      Ethereum          0x95cdF1f6306c1d6a8e4bF0bF0cFAb41c87E4f0CC        S3          manta-network

  257          ALT            AltLayer           Ethereum          0x8457ca5040ad67fdebbcc8edce889a335bc0fbfb        S3          altlayer

  258          CELO           Celo               Ethereum          0x3294395e62F4eB6aF3f1Fcf89f5602D90Fb3Ef69        S3          celo

  259          ZRC20          ZetaChain          Ethereum          0xf091867ec603a6628ed83d274e835539d82e9cc8        S3          zetachain

  260          IOTX           IoTeX              Ethereum          0x6fB3e0A217407EFFf7Ca062D46c26E5d60a14d69        S3          iotex

  261          rswETH         Swell rswETH       Ethereum          0xfae103dc9cf190ed75350761e95403b7b8afa6c0        S3          restaked-swell-eth

  262          USD0           Usual USD0         Ethereum          0x73A15FeD60Bf67631dC6cd7Bc5B6e8da8190aCF5        S3          usual-usd0

  263          ALPACA         Alpaca Finance     BNB Smart Chain   0x8F0528cE5eF7B51152A59745bEfDD91D97091d2F        S3          alpaca-finance

  264          CFG            Centrifuge         Ethereum          0x1ECF064cd4016aAE4C4cee1c2eCa660fdb3AA46F        S3          centrifuge

  265          AIXBT          AIXBT              Base              0x4F9Fd6Be4a90f2620860d680c0d4d5Fb53d1A825        S3          aixbt-by-virtuals

  266          CLANKER        Clanker            Base              0x1bc0c42215582d5A085795f4baDbaC3ff36d1Bcb        S3          clanker

  267          OG             OG Fan Token       Ethereum          0x0A5b6fF8B6b22a631D9945714331E59407CB23e4        S3          og-fan-token

  268          SWEAT          SWEAT Economy      Ethereum          0xB4b9DC1C77bdbb135eA907fd5a08094d98883A35        S3          sweat-economy

  269          RARE           SuperRare          Ethereum          0xba5BDe662c17e2aDFF1075610382B9B691296350        S3          superrare

  270          CARV           CARV               Ethereum          0xc08cd26474722ce93f4d0c34d16201461c10aa8c        S3          carv

  271          TLM            Alien Worlds       BNB Smart Chain   0x2222227E22102Fe3322098e4CBfE18cFebD57c95        S3          alien-worlds

  272          RDNT           Radiant Capital    Arbitrum          0x0C4681e6C0235179ec3D4F4fc4DF3d14FDD96017        S3          radiant-capital

  273          CRV_ARB        CRV (Arbitrum)     Arbitrum          0x11cDb42B0EB46D95f990BeDD4695A6e3fA034978        S3          curve-dao-token

  274          SNX_ARB        SNX (Arbitrum)     Arbitrum          0x8700daec35aF8Ff88c16BdF0418774CB3D7599B4        S3          havven

  275          SNS_OP         Synthetix (OP)     Optimism          0x8700dAec35aF8Ff88c16BdF0418774CB3D7599B4        S3          havven

  276          TNSR2          Tensor (defi)      Solana            TNSRxcUxoT9xBG3de7PiJyTDYu7kskLqcpddxnEJAS6       S3          tensor

  277          ZEREBRO        Zerebro            Solana            8x5VqbHA8D7NkD52uNuS5nnt3PwA8pLD34ymskeSo2Wn      S3          zerebro

  278          ARC            AI Rig Complex     Solana            61V8vBaqAGMpgDQi4JcAwo1dmBGHsyhzodcPqnEVpump      S3          ai-rig-complex

  279          ELON           Dogelon Mars       Ethereum          0x761D38e5ddf6ccf6Cf7c55759d5210750B5D60F3        S3          dogelon-mars

  280          HONEY_HM       Hivemapper Honey   Solana            4vMsoUT2BWatFweudnQM1xedRLfJgJ7hswhcpz4xgBTy      S3          hivemapper

  281          ATLAS          Star Atlas         Solana            ATLASXmbPQxBUYbxPsV97usA3fPQYEqzQBUHgiFCUsXx      S3          star-atlas

  282          INTER          Inter Milan Fan    Ethereum          0x5b2F0f13E35B36E2bDfC55D76fC2A8B3b8B9D41A        S3          inter-milan-fan-token

  283          LAZIO          Lazio Fan          BNB Smart Chain   0x77d547256A2cD95F32F67aE0313E450Ac200648d        S3          lazio-fan-token

  284          PORTO          Porto Fan          BNB Smart Chain   0x49f2145d6366099e13B10FbF80646C0F377eE7f6        S3          fc-porto

  285          ATM            Atletico Madrid    BNB Smart Chain   0x986058ec93756E57b4e55b406dD0BeE24bcD95e3        S3          atletico-madrid-fan-token
                              Fan                                                                                                

  286          MFER           mfer               Ethereum          0x2C91D908E9fab2dD2441532a04182d791e590f2d        S3          mfercoin

  287          NORMIE         Normie             Base              0x7F12d13B34F5F4f0a9449c16Bcd42f0da47AF200        S3          normie

  288          DEGENAI        Degen AI           Solana            Gu3LDkn7Vx3bmCzLafYNKcDxv2mH7YN44NJZFXnypump      S3          degen-ai

  289          MX             MEXC Token         Ethereum          0x11eef04c884e24d9b7b4760e7476d06ddf797f36        S3          mx-token

  290          ALICE          My Neighbor Alice  Ethereum          0xAC51066d7bEC65Dc4589368da368b212745d63E8        S3          my-neighbor-alice

  291          BEAM           Beam               Ethereum          0x62d0a8458ed7719fdaf978fe5929c6d342b0bfce        S3          beam-2

  292          YGG            Yield Guild        Ethereum          0x25f8087EAD173b73D6e8B84329989A8eEA16CF73        S3          yield-guild-games

  293          MC             Merit Circle       Ethereum          0x949D48EcA67b17269629c7194F4b727d4Ef9E5d6        S3          merit-circle

  294          SANTOS         Santos Fan         BNB Smart Chain   0xA64455a4553C9034236734FadDAddbb64aCE4Cc7        S3          santos-fc-fan-token

  295          ALPINE         Alpine F1 Fan      BNB Smart Chain   0x287880ea252b52b63cc5f40a2d3e5a44aa665a76        S3          alpine-f1-team-fan-token

  296          MASK           Mask Network       Ethereum          0x69af81e73A73B40adF4f3d4223Cd9b1ECE623074        S3          mask-network

  297          CYBER          CyberConnect       Ethereum          0x14778860e937f509e651192a90589de711fb88a9        S3          cyberconnect

  298          AIOZ           AIOZ Network       Ethereum          0x626E8036dEB333b408Be468F951bdB42433cBF18        S3          aioz-network

  299          ID             SPACE ID           BNB Smart Chain   0x2dff88a56767223a5529ea5960da7a3f5f766406        S3          space-id

  300          DOGE2          Dogecoin (Solana   Solana            A6aK89T94bVkknpFELSHqcm1axGvVqxbH3tnLPHDpump      S3          dogecoin
                              wrap)                                                                                              

  301          ACT            Act I              Solana            GJAFwWjJ3vnTsrQVabjBVK2TYB1YtRCQXRDfDgUnpump      S3          act-i-the-ai-prophecy

  302          MYRO           Myro               Solana            HhJpBhRRn4g56VsyLuT8DL5Bv31HkXqsrahTTUCZeZg4      S3          myro

  303          WEN            WEN                Solana            WENWENvqqNya429ubCdR81ZmD69brwQaaBYY6p3LCpk       S3          wen-4

  304          TYBG           Based God          Base              0x0d97F261b1e88845184f678e2d1e7a98D9FD38dE        S3          tybg

  305          ANDY           Andy               Ethereum          0x4F14cDAe8C6b07AA7BCfe4f5c3D19B53E7f0c0D8        S3          andyerc

  306          POOL           PoolTogether       Ethereum          0x0cEC1A9154Ff802e7934Fc916Ed7Ca50bDE6844e        S3          pooltogether

  307          EUROC_ETH      Euro Coin          Ethereum          0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c        S3          euro-coin

  308          TROLL          TROLL              Solana            5UUH9RTDiSpq6HKS6bp4NdU9PNJpXRXuiw6ShBTBhgH2      S3          troll-2

  309          GIGA           Gigachad           Solana            63LfDmNb3MQ8mw9MtZ2To9bEA2M71kZUUGq5tiJxcqj9      S3          gigachad-2

  310          MAGA           MAGA               Ethereum          0x6aa56e1d98b3805921c170eb4b3fe7d4fda6d89b        S3          maga

  311          ACROSS         Across Protocol    Ethereum          0x44108f0223A3C3028F5Fe7AEC7f9bb2E66beF82F        S3          across-protocol

  312          USDM           Mountain USDM      Ethereum          0x59d9356e565ab3a36dd77763fc0d87feaf85508c        S3          mountain-protocol-usdm

  313          agEUR          Angle agEUR        Ethereum          0x1a7e4e63778B4f12a199C062f3eFdD288afCBce8        S3          ageur

  314          T              Threshold Network  Ethereum          0xCdF7028ceAB81fA0C6971208e83fa7872994beE5        S3          threshold-network-token

  315          HOP            Hop Protocol       Ethereum          0xc5102fE9359FD9a28f877a67E36B0F050d81a3CC        S3          hop-protocol

  316          BIFI           Beefy (Polygon)    Polygon           0xFbdd194376de19a88118e84E279b977f165d01b8        S3          beefy-finance

  317          SHIB2          SHIB (BSC)         BNB Smart Chain   0x2859e4544C4bB03966803b044A93563Bd2D0DD4D        S3          shiba-inu

  318          TRUTH          Truth Terminal     Solana            8sgkCEdLpcNGqDsLDBgrqsbqFkRBJsbaHcQXjbpDpump      S3          truth-terminal

  319          MELANIA        Melania            Solana            FUAfBo2jgks6gB4Z4LfZkqSZgzNucisEHqnNebaRxM1P      S3          melania-meme

  320          JONES          Jones DAO          Arbitrum          0x10393c20975cF177a3513071bC110f7962CD67da        S3          jones-dao

  321          GHST2          Aavegotchi (ETH)   Ethereum          0x3F382DbD960E3a9bbCeaE22651E88158d2791550        S3          aavegotchi

  322          BUILD          Build on Base      Base              0x3C281A39944a2319aA653D81Cfd93Ca10983D234        S3          build-on-base

  323          MEMECORE       MemeCore           Ethereum          0x1b980e05943dE3dB3a459C72325338d327B6F5a9        S3          memecore

  324          RLC            iExec              Ethereum          0x607F4C5BB672230e8672085532f7e901544a7375        S3          iexec-rlc

  325          INDEX          Index Coop         Ethereum          0x0954906da0Bf32d5479e25f46056d22f08464cab        S3          index-coop

  326          BADGER         BadgerDAO          Ethereum          0x3472A5A71965499acd81997a54BBA8D852C6E53d        S3          badger-dao

  327          SPELL          Spell Token        Ethereum          0x090185f2135308BaD17527004364eBcC2D37e5F6        S3          spell-token

  328          REQ            Request Network    Ethereum          0x8f8221aFbB33998d8584A2B05749bA73c37a938a        S3          request-network

  329          PERP           Perpetual Protocol Optimism          0x9e1028F5F1D5eDE59748FFceE5532509976840E0        S3          perpetual-protocol

  330          INST           Instadapp          Ethereum          0x6f40d4A6237C257fff2dB00FA0510DeEECd303eb        S3          instadapp

  331          ALCX           Alchemix           Ethereum          0xdBdb4d16EdA451D0503b854CF79D55697F90c8DF        S3          alchemix

  332          PONKE          Ponke on Base      Base              0x4a0c64af541439898448659aedcec8e8e819fc53        S3          ponke

  333          ZEREBRO2       Zerebro v2         Ethereum          0x5b2f0f13e35b36e2bdfc55d76fc2a8b3b8b9d41a        S3          zerebro

  334          PUNCH          Punch              Solana            NV2RYH954cTJ3ckFUpvfqaQXU4ARqqDH3562nFSpump       S3          punch

  335          SLERF          Slerf              Solana            7BgBvyjrZX1YKz4oh9mjb8ZScatkkwb8DzFx7LoiVkM3      S3          slerf

  336          VVAIFU         VVaifu             Solana            FQ1tyso61AH1tzodyJfSwmzsD3GToybbRNoZxUBz21p8      S3          dasha

  337          HARAMBE        Harambe            Solana            Fch1oixTPri8zxBnmdCEADoJW2toyFHxqDZacQkwdvSP      S3          harambe

  338          FWOG           Fwog               Solana            A8C3xuqscfmyLrte3VmTqrAq8kgMASius9AFNANwpump      S3          fwog

  339          KNINE          K9 Finance         Solana            EKtMEENYmE4o6xyMbM3tAK7f4BkmKKNBY8dNRGBpump       S3          k9-finance-dao

  340          WKC            Wiki Cat           Ethereum          0x6ec90334d89dbdc89e08a133271be3d104128edb        S3          wiki-cat

  341          JPEG           JPEG\'d            Ethereum          0xE80C0cd204D654CEbe8dd64A4857cAb6Be8345a3        S3          jpeg-d

  342          OMNI           Omni Network       Ethereum          0x36E66fbBce51e4cD5bd3C62B637Eb411b18949D4        S3          omni-network

  343          XBORG          XBorg              Ethereum          0xeae00d6f9b16deb1bd584c7965e4c7d762f178a1        S3          xborg

  344          WILD           Wilder World       Ethereum          0x2a3bFF78B79A009976EeA096a51A948a3dC00e34        S3          wilder-world

  345          ASR            AS Roma Fan        Ethereum          0xfc82bb4ba86045af6f327323a46e80412b91b27d        S3          as-roma-fan-token

  346          XCAD           XCAD Network       Ethereum          0x7659CE147D0e714454073a5dd7003544234b6Aa0        S3          xcad-network

  347          HOOK           Hooked Protocol    BNB Smart Chain   0xa260e12d2b924cb899ae80bb58123ac3fee1e2f0        S3          hooked-protocol

  348          LISUSD         Lista USD          BNB Smart Chain   0x0782b6d8c4551B9760e74c0545a9bCD90bdc41E5        S3          lista-usd

  349          AURORA         Aurora             Ethereum          0xAaAAAA20D9E0e2461697782ef11675f668207961        S3          aurora-near

  350          SUPRA          Supra Oracles      Ethereum          0x2a718ba18498e26b16D4Ce1e6F61a3CC9aF6e4a1        S3          supra

  351          XYO            XYO Network        Ethereum          0x55296f69f40Ea6d20E478533C15A6B08B654E758        S3          xyo-network

  352          LUMIA          Lumia              Ethereum          0xd9343a049d5dbd89cd19dc6bca8c48fb3a0a42a7        S3          lumia

  353          SYRUP          Maple SYRUP        Ethereum          0xB850B9247410d693F44E9AC32f676a3043A13Ed4        S3          maple-finance

  354          LOOKS          LooksRare          Ethereum          0xf4d2888d29D722226FafA5d9B24F9164c092421E        S3          looksrare

  355          KWENTA         Kwenta             Optimism          0x920Cf626a271321C151D027030D5d08aF699456b        S3          kwenta

  356          BSW            Biswap             BNB Smart Chain   0x965F527D9159dCe6288a2219DB51fc6Eef120dD1        S3          biswap

  357          UNFI           Unifi Protocol     BNB Smart Chain   0x728C5baC3C3e370E372Fc4671f9ef6916b814d8B        S3          unifi-protocol-dao

  358          TKO            Tokocrypto         BNB Smart Chain   0x9f589e3eabe42ebC94A44727b3f3531C0c877809        S3          tokocrypto

  359          ggAVAX         GoGoPool ggAVAX    Avalanche         0x69260b9483f9871ca57f81a90d91e2f96c2cd11d        S3          gogopool

  360          PYR            Vulcan Forged      Ethereum          0x430ef9263e76dae63c84292c3409d61c598e9682        S3          vulcan-forged

  361          MODE           Mode Network       Ethereum          0x084382d1cc4f4dfd1769b1cc1ac2a9b1f8365e90        S3          mode

  362          FUEL           Fuel Network       Ethereum          0x675b68aa4d9c2d3bb3f0397048e62e6b7192079c        S3          fuel-network

  363          LSK            Lisk               Ethereum          0x6033f7f88332b8db6ad452b7c6d5bb643990ae3f        S3          lisk

  364          PLA            PlayDapp           Ethereum          0x3a4f40631a4f906c2BaD353Ed06De7A5D3fCb430        S3          playdapp

  365          HIGH           Highstreet         Ethereum          0x71Ab77b7dbB4fa7e017BC15090b2163221420282        S3          highstreet

  366          VOXEL          Voxies             Ethereum          0x3c4b6e6e1ea3d4863700d7f76b36b7f3d3f13e3d        S3          voxies

  367          BTRST          Braintrust         Ethereum          0x799ebfABE77a6E34311eeEe9825190B9ECe32824        S3          braintrust

  368          POWR           Power Ledger       Ethereum          0x595832F8FC6BF59c85C527fEC3740A1b7a361269        S3          power-ledger

  369          PROM           Prom               Ethereum          0xfc82bb4ba86045Af6F327323a46E80412b91b27d        S3          prom

  370          SUB            SubQuery           Ethereum          0x09395a2a58db45db0da254c7eaa5ac469d8bdc85        S3          subquery-network

  371          MOBY           Moby Trade         Arbitrum          0x93D6F85Dd4d3E679e5eD5c7dc6B71b98f1C6de8a        S3          moby

  372          NOTIONAL       Notional           Arbitrum          0x65aed01c7af795083f3fac38d56e3b1fae16e54a        S3          notional-finance

  373          TLM2           Alien Worlds (ETH) Ethereum          0x888888848B652B3E3a0f34c96E00EEC0F3a23F72        S3          alien-worlds

  374          SAMO           Samoyedcoin        Solana            7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU      S3          samoyedcoin

  375          HXRO           Hxro Network       Solana            HxhWkVpk5NS4Ltg5nij2G671CKXFRKPK8vy271Ub4uEK      S3          hxro

  376          POLIS          Star Atlas POLIS   Solana            poLisWXnNRwC6oBu1vHiuKQzFjGL4XDSu4g9qjz9qVk       S3          star-atlas-dao

  377          TSUKA          Dejitaru Tsuka     Ethereum          0xc5fb36dd2fb59d3b98deff88425a3f425ee469ed        S3          dejitaru-tsuka

  378          IOT            Helium IoT         Solana            iotEVVZLEywoTn1QdwNPddxPWszn3zFhEot3MfL9fns       S3          helium-iot

  379          DIMO           DIMO               Polygon           0xe261d618a959afffd53168cd07d12e37b26761db        S3          dimo

  380          HONEY_SOL      Hivemapper Honey   Solana            4vMsoUT2BWatFweudnQM1xedRLfJgJ7hswhcpz4xgBTy      S3          hivemapper

  381          GRIFFAIN       Griffain           Solana            KENJSUYLASHUMfHyy5o4Hp2FdNqZg1AsUPhfH2kYvEP       S3          griffain

  382          RETARDIO       Retardio           Solana            6ogzHhzdrQr9Pgv6hZ2MNze7UrzBMAFyBBWUYp1Fhitx      S3          retardio

  383          AKITA          Akita Inu          Ethereum          0x3301Ee63Fb29F863f2333Bd4466acb46CD8323E6        S3          akita-inu

  384          ANON           Anon (Clanker)     Base              0x79bbF4508B1391af3A0F4B30bb5FC4aa9ab0E07C        S3          anon

  385          PNG            Pangolin           Avalanche         0x60781C2586D68229fde47564546784ab3fACA982        S3          pangolin

  386          LUNA_AI        Luna AI agent      Solana            9se6kma7LeGcQWyRBNcYzyxZPE3r9t9qWZ8SnjnN3jJ7      S3          luna-by-virtuals

  387          ELON2          Dogelon (BSC)      BNB Smart Chain   0x7bd6FaBD64813c48545C9c0e312A0099d9be2540        S3          dogelon-mars

  388          TREMP          Tremp              Solana            FU1q8vJpZNUrmqsciSjp8bAKKidGsLmouB8CBdf8TKQv      S3          doland-tremp

  389          BODEN          Jeo Boden          Solana            3psH1Mj1f7yUfaD5gh6Zj7epE8hhrMkMETgv5TshQA4o      S3          jeo-boden

  390          BASED          Based              Base              0x32E0f9d26D1e33625742A52620cC76C1130efde6        S3          based-markets

  391          TBTC2          tBTC (Arbitrum)    Arbitrum          0x6c84a8f1c29108f47a79964b5fe888d4f4d0de40        S3          tbtc

  392          VIRTUAL2       Virtuals (Solana)  Solana            3iQL8BFS2vE7mww4ehAqQHAsbmRNCrPxizWAT2Zfyr9y      S3          virtual-protocol

  393          CULT           Cult DAO           Ethereum          0xf0f9d895aca5c8678f706fb8216fa22957685a13        S3          cult-dao

  394          GNON           Gnon               Solana            HeJUFDxfJSzYFUuHLxkMqCgytU31G6mjP4wKviwqpump      S3          gnon

  395          NORMIE2        Normie (ETH)       Ethereum          0x7F12d13B34F5F4f0a9449c16Bcd42f0da47AF200        S3          normie

  396          ANGLE          Angle Protocol     Ethereum          0x31429d1856aD1377A8A0079410B297e1a9e214c2        S3          angle-protocol

  397          COQ            Coq Inu            Avalanche         0x420fca0121dc28039145009570975747295f2329        S3          coq-inu

  398          AVAX_MEME      Avax Meme avg      Avalanche         0x0000000000000000000000000000000000000000        S3          avalanche-2

  399          FREYSA         Freysa             Ethereum          0x728b608a9e8FFF96fEF7e23FF7aE9B7eAfd07B09        S3          freysa-ai

  400          LUNA_AI        Luna (Virtuals)    Base              0x55cd6469f597452b5a7536e2cd98fde4c1247ee4        S3          luna-by-virtuals

  401          SKI            Ski Mask Dog       Base              0x768be13e1680b5ebe0024c42c896e3db59ec0149        S3          ski-mask-dog

  402          MIGGLES        Mr. Miggles        Base              0xb1a03eda10342529bbf8eb700a06c60441fef25d        S3          mister-miggles

  403          PAAL           PAAL AI            Ethereum          0x14fee680690900ba0cccfc76ad70fd1b95d10e16        S3          paal-ai

  404          rsETH          Kelp rsETH         Ethereum          0xa1290d69c65a6fe4df752f95823fae25cb99e5a7        S3          kelp-dao-restaked-eth

  405          WEN            WEN                Ethereum          0xEBA6145367b33e9FB683358E0421E8b7337D435f        S3          wen-4

  406          MENCHESTER     Man Utd Fan        Ethereum          0x3ebb4a4e91ad83be51f8d596533818b246f4bee1        S3          manchester-united-fan-token

  407          STEP           Step Finance       Solana            StepAscQoEioFxxWGnh2sLBDFp9d8rvKz2Yp39iDpyT       S3          step-finance

  408          ezETH          Renzo ezETH        Ethereum          0xbf5495Efe5DB9ce00f80364C8B423567e58d2110        S3          renzo-restaked-eth

  409          SIGMA          Sigma              Solana            5SVG3T9CNQsm2kEwzbRq6hASqh1oGfjqTtLXYUibpump      S3          sigma-sol

  410          IPOR           IPOR Protocol      Ethereum          0x1e4746dC744503b53b4A082cB3607B169a289090        S3          ipor

  411          SPECTRA        Spectra Finance    Ethereum          0x6a89228055c7c28430692e342f149f37462b478b        S3          spectra-finance

  412          MNGO           Mango (ETH)        Ethereum          0x472D4b61eA4558B3a6C0B0C5B1E0c5e2B4D7Bef1        S3          mango-markets

  413          KIMBO          Kimbo              Avalanche         0x184ff13b3ebcb25be44e860163a5d8391dd568c1        S3          kimbo

  414          NATIX          NATIX              Solana            FRySi8LPkuByB7VPSCCggxpewFUeeJiwEGRKKuhwpKcX      S3          natix-network

  415          GEOD           Geodnet            Polygon           0xac0f66379a6d7801d7726d5a943356a172549adb        S3          geodnet

  416          MNGO           Mango Markets      Solana            MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac       S3          mango-markets

  417          REVV           REVV Racing        Polygon           0x70c006878a5A50Ed185ac4C87d837633923De296        S3          revv

  418          LAYER          LayerZero          Ethereum          0x5FFd23b1B4f250b4c83Da97DBB7cB4614b5bBFeA        S3          layerzero

  419          FRAX_BSC       Frax (BSC)         BNB Smart Chain   0x90C97F71E18723b0Cf0dfa30ee176Ab653E89F40        S3          frax

  420          EULER          Euler Finance v2   Ethereum          0xd9Fcd98c322942075A5C3860693e9f4f03AAE07b        S3          euler

  421          RAIL           Railgun            Ethereum          0xe76C6c83af64e4C60245D8C7dE953DF673a7A33D        S3          railgun

  422          PRISMA         Prisma Finance     Ethereum          0xda47862a83dac0c112ba89c6abc2159b95afd71c        S3          prisma-finance

  423          BERA           Berachain          Ethereum          0x1dBE93F3BA0e764C620451E8F21AE32f51a055A3        S3          berachain-bera

  424          KEYCAT         Keyboard Cat       Base              0x9a26f5433671751c3276a065f57e5a02d2817973        S3          keyboard-cat-base

  425          WETH_ARB       WETH (Arbitrum)    Arbitrum          0x82aF49447D8a07e3bd95BD0d56f35241523fBab1        S3          weth

  426          WETH_OP        WETH (Optimism)    Optimism          0x4200000000000000000000000000000000000006        S3          weth

  427          WETH_POL       WETH (Polygon)     Polygon           0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619        S3          weth

  428          WETH_BSC       WETH (BSC)         BNB Smart Chain   0x2170Ed0880ac9A755fd29B2688956BD959F933F8        S3          weth

  429          WETH_AVAX      WETH (Avalanche)   Avalanche         0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB        S3          weth

  430          STETH_ETH      stETH (Ethereum)   Ethereum          0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84        S3          staked-ether

  431          OP_TOKEN       OP (native)        Optimism          0x4200000000000000000000000000000000000042        S3          optimism

  432          ARB_TOKEN      ARB (native)       Arbitrum          0x912CE59144191C1204E64559FE8253a0e49E6548        S3          arbitrum

  433          AVAX_NATIVE    AVAX (native)      Avalanche         0x0000000000000000000000000000000000000000        S3          avalanche-2

  434          GRT_ARB        GRT (Arbitrum)     Arbitrum          0x23A941036Ae778Ac51Ab04CEa08Ed6e2FE103614        S3          the-graph

  435          IMX_ETH        IMX (Ethereum)     Ethereum          0xF57e7e7C23978C3cAEC3C3548E3D615c346e79fF        S3          immutable-x

  436          RNDR_SOL       RNDR (Solana)      Solana            rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof       S3          render-token

  437          FET_ETH        FET (Ethereum)     Ethereum          0xaea46A60368A7bD060eec7DF8CBa43b7EF41Ad85        S3          fetch-ai

  438          AGIX_ETH       AGIX (Ethereum)    Ethereum          0x5B7533812759B45C2B44C19e320ba2cD2681b542        S3          singularitynet

  439          OCEAN_ETH      OCEAN (Ethereum)   Ethereum          0x967da4048cD07aB37855c090aAF366e4ce1b9F48        S3          ocean-protocol

  440          NMR_ETH        NMR (Ethereum)     Ethereum          0x1776e1F26f98b1A5dF9cD347953a26dd3Cb46671        S3          numeraire

  441          VIRTUAL_BASE   VIRTUAL (Base)     Base              0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b        S3          virtual-protocol

  442          BAT_ETH        BAT (Ethereum)     Ethereum          0x0D8775F648430679A709E98d2b0Cb6250d2887EF        S3          basic-attention-token

  443          CHZ_ETH        CHZ (Ethereum)     Ethereum          0x3506424F91fD33084466F402d5D97f05F8e3b4AF        S3          chiliz

  444          AXS_ETH        AXS (Ethereum)     Ethereum          0xBB0E17EF65F82Ab018d8EDd776e8DD940327B28b        S3          axie-infinity

  445          SAND_ETH       SAND (Ethereum)    Ethereum          0x3845badAde8e6dFF049820680d1F14bD3903a5d0        S3          the-sandbox

  446          MANA_ETH       MANA (Ethereum)    Ethereum          0x0F5D2fB29fb7d3CFeE444a200298f468908cC942        S3          decentraland

  447          SHIB_ETH       SHIB (Ethereum)    Ethereum          0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE        S3          shiba-inu

  448          LUNC_BSC       LUNC (BSC bridged) BNB Smart Chain   0x45b695F2594713c96B52468ED168A691986b858A        S3          terra-luna

  449          RLC_ETH        RLC (Ethereum)     Ethereum          0x607F4C5BB672230e8672085532f7e901544a7375        S3          iexec-rlc

  450          GLM_ETH        GLM (Ethereum)     Ethereum          0x7DD9c5Cba05E151C895FDe1CF355C9A1D5DA6429        S3          golem

  451          BAND_ETH       BAND (Ethereum)    Ethereum          0xBA11D00c5f74255f56a5E366F4F77f5A186d7f55        S3          band-protocol

  452          TRB_ETH        TRB (Ethereum)     Ethereum          0x88dF592F8eb5D7Bd38bFeF7dEb0fBc02cf3778a0        S3          tellor

  453          CBETH_BASE     CBETH (Base)       Base              0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22        S3          coinbase-wrapped-staked-eth

  454          USDC_BASE      USDC (Base)        Base              0x833589fcd6edb6e08f4c7c32d4f71b54bda02913        S3          usd-coin

  455          CAKE_BSC       CAKE (BSC)         BNB Smart Chain   0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82        S3          pancakeswap-token

  456          JOE_AVAX2      JOE (Avalanche)    Avalanche         0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd        S3          joe

  457          WBTC_ETH       WBTC (Ethereum)    Ethereum          0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599        S3          wrapped-bitcoin

  458          USDC_ETH       USDC (Ethereum)    Ethereum          0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48        S3          usd-coin

  459          USDT_ETH       USDT (Ethereum)    Ethereum          0xdAC17F958D2ee523a2206206994597C13D831ec7        S3          tether

  460          LINK_ETH       LINK (Ethereum)    Ethereum          0x514910771AF9Ca656af840dff83E8264EcF986CA        S3          chainlink

  461          UNI_ETH        UNI (Ethereum)     Ethereum          0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984        S3          uniswap

  462          MKR_ETH        MKR (Ethereum)     Ethereum          0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2        S3          maker

  463          SNX_ETH        SNX (Ethereum)     Ethereum          0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F        S3          havven

  464          COMP_ETH       COMP (Ethereum)    Ethereum          0xc00e94Cb662C3520282E6f5717214004A7f26888        S3          compound-governance-token

  465          CRV_ETH        CRV (Ethereum)     Ethereum          0xD533a949740bb3306d119CC777fa900bA034cd52        S3          curve-dao-token

  466          LDO_ETH        LDO (Ethereum)     Ethereum          0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32        S3          lido-dao

  467          RPL_ETH        RPL (Ethereum)     Ethereum          0xD33526068D116cE69F19A9ee46F0bd304F21A51f        S3          rocket-pool

  468          RETH_ETH       rETH (Ethereum)    Ethereum          0xae78736Cd615f374D3085123A210448E74Fc6393        S3          rocket-pool-eth

  469          FXS_ETH        FXS (Ethereum)     Ethereum          0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0        S3          frax-share

  470          CVX_ETH        CVX (Ethereum)     Ethereum          0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B        S3          convex-finance

  471          BAL_ETH        BAL (Ethereum)     Ethereum          0xba100000625a3754423978a60c9317c58a424e3D        S3          balancer

  472          YFI_ETH        YFI (Ethereum)     Ethereum          0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e        S3          yearn-finance

  473          GRT_ETH        GRT (Ethereum)     Ethereum          0xc944E90C64B2c07662A292be6244BDf05Cda44a7        S3          the-graph

  474          MATIC_ETH      MATIC (Ethereum)   Ethereum          0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0        S3          matic-network

  475          ARB_ETH        ARB (Ethereum)     Ethereum          0xb50721bcf8d664c30412cfbc6cf7a15145234ad1        S3          arbitrum

  476          OP_ETH         OP (Ethereum)      Ethereum          0x4200000000000000000000000000000000000042        S3          optimism

  477          2Z             DoubleZero         Solana            J6pQQ3FAcJQeWPPGppWRb4nM8jU3wLyYbRrLh7feMfvd      S3          doublezero

  478          ASTER          Aster              BNB Smart Chain   0x000ae314e2a2172a039b26378814c252734f556a        S3          aster-2

  479          ATOM           Cosmos Hub         Cosmos            NATIVE --- no EVM contract                        S3          cosmos

  480          AUSD           Agora AUSD         Ethereum          0x00000000efe302beaa2b3e6e1b18d08d69a9012a        S3          agora-dollar

  481          BMX            BitMart Token      Ethereum          0x986ee2b944c42d017f52af21c4c69b84dbea35d8        S3          bitmart-token

  482          BTSE           BTSE Token         Ethereum          0x666d875c600aa06ac1cf15641361dec3b00432ef        S3          btse-token

  483          CHEEMS         Cheems             BNB Smart Chain   0x0df0587216a4a1bb7d5082fdc491d93d2dd4b413        S3          cheems-token

  484          DEXE           DeXe               Ethereum          0xde4EE8057785A7e8e800Db58F9784845A5C2Cbd6        S3          dexe

  485          DOLA           Dola USD           Ethereum          0x865377367054516e17014CcdED1e7d814EDC9ce4        S3          dola-usd

  486          FTM            Fantom (ERC-20)    Ethereum          0x4E15361FD6b4BB609Fa63C81A2be19d873717870        S3          fantom

  487          FTT            FTX Token          Ethereum          0x50D1c9771902476076eCFc8B2A83Ad6b9355a4c9        S3          ftx-token

  488          GNO            Gnosis             Ethereum          0x6810e776880C02933D47DB1b9fc05908e5386b96        S3          gnosis

  489          GOMINING       GoMining           Ethereum          0x7ddc52c4de30e94be3a6a0a2b259b2850f421989        S3          gmt-token

  490          HEX            HEX                Ethereum          0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39        S3          hex

  491          INJ            Injective (ERC-20) Ethereum          0xe28b3B32B6c345A34Ff64674606124Dd5Aceca30        S3          injective-protocol

  492          JASMY          JasmyCoin          Ethereum          0x7420B4b9a0110cdC71fB720908340C03F9Bc03EC        S3          jasmycoin

  493          KTA            Keeta              Base              0xc0634090F2Fe6c6d75e61Be2b949464aBB498973        S3          keeta

  494          LEO            UNUS SED LEO       Ethereum          0x2AF5D2aD76741191D15Dfe7bF6aC92d4Bd912Ca3        S3          leo-token

  495          LSETH          Liquid Staked ETH  Ethereum          0x8c1bed5b9a0928467c9b1341da1d7bd5e10b6549        S3          liquid-staked-ethereum

  496          NEXO           Nexo               Ethereum          0xB62132e35a6c13ee1EE0f84dC5d40bad8d815206        S3          nexo

  497          NXPC           NEXPACE            Ethereum          0xeAcE4FBf1EB4Fc2571e87E8F28E7D0553e258B01        S3          nexpace

  498          QNT            Quant              Ethereum          0x4a220E6096B25EADb88358cb44068A3248254675        S3          quant-network

  499          RLB            Rollbit Coin       Ethereum          0x046eee2cc3188071c02bfc1745a6b17c656e3f3d        S3          rollbit-coin

  500          RLUSD          Ripple USD         Ethereum          0x8292bb45bf1ee4d140127049757c2e0ff06317ed        S3          ripple-usd

  501          RSR            Reserve Rights     Ethereum          0x320623b8E4fF03373931769A31Fc52A4E78B5d70        S3          reserve-rights-token

  502          SFP            SafePal            BNB Smart Chain   0xD41FDb03Ba84762dD66a0af1a6C8540FF1ba5dfb        S3          safepal

  503          SHFL           Shuffle            Ethereum          0x8881562783028f5c1bcb985d2283d5e170d88888        S3          shuffle-2

  504          SIREN          Siren              BNB Smart Chain   0x997A58129890bBdA032231A52eD1ddC845fc18e1        S3          siren-bsc

  505          SKYAI          SKYAI              BNB Smart Chain   0x92aa03137385f18539301349dcfc9ebc923ffb10        S3          skyai

  506          SOSO           SoSoValue          Base              0x624e2e7fDc8903165F64891672267AB0FCB98831        S3          sosovalue

  507          TEL            Telcoin            Polygon           0xdF7837DE1F2Fa4631D716CF2502f8b230F1dcc32        S3          telcoin

  508          TIBBIR         Ribbita by         Base              0xa4a2e2ca3fbfe21aed83471d28b6f65a233c6e00        S3          ribbita-by-virtuals
                              Virtuals                                                                                           

  509          TUSD           TrueUSD            Ethereum          0x0000000000085d4780B73119b644AE5ecd22b376        S3          true-usd

  510          TWT            Trust Wallet Token BNB Smart Chain   0x4B0F1812e5Df2A09796481Ff14017e6005508003        S3          trust-wallet-token

  511          USDD           USDD               Ethereum          0x0C10bF8FcB7Bf5412187A595ab97a3609160b5c6        S3          usdd

  512          USDG           Global Dollar      Ethereum          0xe343167631d89b6ffc58b88d6b7fb0228795491d        S3          global-dollar

  513          VVV            Venice Token       Base              0xacfE6019Ed1A7Dc6f7B508C02d1b04ec88cC21bf        S3          venice-token

  514          WBETH          Wrapped Beacon ETH BNB Smart Chain   0xa2e3356610840701bdf5611a53974510ae27e2e1        S3          wrapped-beacon-eth

  515          WBNB           Wrapped BNB        BNB Smart Chain   0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c        S3          wbnb

  516          WLFI           World Liberty      Ethereum          0x779073bd43F2E93dc09cC99210a048B65CDD66cD        S3          world-liberty-financial-wlfi
                              Financial                                                                                          

  517          XCN            Onyxcoin           Ethereum          0xA2cd3D43c775978A96BdBf12d733D5A1ED94fb18        S3          chain-2

  518          XLM            Stellar            Stellar           NATIVE --- no EVM contract                        S3          stellar

  519          YZY            YZY Money          Solana            DrZ26cKJDksVRWib3DVVsjo9eeXccc7hKhDJviiYEEZY      S3          yzy

  520          ZBCN           Zebec Network      Solana            ZBCNpuD7YMXzTHB2fhGkGi78MNsHGLRXUhRewNRm9RU       S3          zebec-network

  521          ZIG            Zignaly            Ethereum          0xb2617246d0c6c0087f18703d576831899ca94f01        S3          zignaly

  522          sUSDS          Savings USDS       Ethereum          0xa3931d71877c0e7a3148cb7eb4463524fec27fbd        S3          susds

  523          WMATIC         Wrapped Matic      Polygon           0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270        S3          wmatic

  524          MIM            Magic Internet     Avalanche         0x130966628846BFd36ff31a822705796e8cb8C18D        S3          magic-internet-money
                              Money                                                                                              

  525          MIMATIC        MAI                Polygon           0xa3Fa99A148fA48D14Ed51d610c367C61876997F1        S3          mimatic

  526          TIME           Wonderland TIME    Avalanche         0xb54f16fB19478766A268F172C9480f8da1a7c9C3        S3          wonderland

  527          USDTE          Tether Avalanche   Avalanche         0xc7198437980c041c805A1EDcbA50c1Ce5db95118        S3          tether-avalanche-bridged-usdt-e
                              Bridged USDT e                                                                                     

  528          WAVAX          Wrapped AVAX       Avalanche         0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7        S3          wrapped-avax

  529          BTCB           Binance Bitcoin    BNB Smart Chain   0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c        S3          binance-bitcoin

  530          BUSD           Binance USD        BNB Smart Chain   0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56        S3          binance-usd

  531          ENJ            Enjin Coin         Ethereum          0xF629cBd94d3791C9250152BD8dfBDF380E2a3B9c        S3          enjincoin

  532          FISH           Polycat Finance    Polygon           0x3a3Df212b7AA91Aa0402B9035b098891d276572B        S3          polycat-finance

  533          MELT           Defrost Finance    Avalanche         0x47EB6F7525C1aA999FBC9ee92715F5231eB1241D        S3          defrost-finance

  534          RAI            Rai Reflex Index   Ethereum          0x03ab458634910AaD20eF5f1C8ee96F1D6ac54919        S3          rai

  535          YAK            Yield Yak          Avalanche         0x59414b3089ce2AF0010e7523Dea7E2b35d776ec7        S3          yield-yak

  536          ZRX            0x                 Ethereum          0xE41d2489571d322189246DaFA5ebDe1F4699F498        S3          0x

  537          ADA            Binance Peg        BNB Smart Chain   0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47        S3          binance-peg-cardano
                              Cardano                                                                                            

  538          ADDY           Adamant            Polygon           0xc3FdbadC7c795EF1D6Ba111e06fF8F16A20Ea539        S3          adamant

  539          AMP            Amp                Ethereum          0xfF20817765cB7f73d4bde2e66e067E58D11095C2        S3          amp-token

  540          BNT            Bancor Network     Ethereum          0x1F573D6Fb3F13d689FF844B4cE37794d79a7FF1C        S3          bancor

  541          BOND           BarnBridge         Ethereum          0x0391D2021f89DC339F60Fff84546EA23E337750f        S3          barnbridge

  542          DOT            Binance Peg        BNB Smart Chain   0x7083609fCE4d1d8Dc0C979AAb8c869Ea2C873402        S3          binance-peg-polkadot
                              Polkadot                                                                                           

  543          DPX            Dopex              Arbitrum          0x6C2C06790b3E3E3c38e12Ee22F8183b37a13EE55        S3          dopex

  544          HELMET         Helmet Insure      BNB Smart Chain   0x948d2a81086A075b3130BAc19e4c6DEe1D2E3fE8        S3          helmet-insure

  545          KLO            Kalao              Avalanche         0xb27c8941a7Df8958A1778c0259f76D1F8B711C35        S3          kalao

  546          LTC            Binance Peg        BNB Smart Chain   0x4338665CBB7B2485A8855A139b75D5e34AB0DB94        S3          binance-peg-litecoin
                              Litecoin                                                                                           

  547          MBOX           Mobox              BNB Smart Chain   0x3203c9E46cA618C8C1cE5dC67e7e9D75f5da2377        S3          mobox

  548          PEFI           Penguin Finance    Avalanche         0xe896CDeaAC9615145c0cA09C8Cd5C25bced6384c        S3          penguin-finance

  549          PTP            Platypus Finance   Avalanche         0x22d4002028f537599bE9f666d1c4Fa138522f9c8        S3          platypus-finance

  550          REN            REN                Ethereum          0x408e41876cCCDC0F92210600ef50372656052a38        S3          republic-protocol

  551          RGT            Rari Governance    Ethereum          0xD291E7a03283640FDc51b121aC401383A46cC623        S3          rari-governance-token

  552          SNOB           Snowball           Avalanche         0xC38f41A296A4493Ff429F1238e030924A1542e50        S3          snowball-token

  553          SX             SX Network         Polygon           0x840195888Db4D6A99ED9F73FcD3B225Bb3cB1A79        S3          sx-network

  554          SXP            SXP                BNB Smart Chain   0x47BEAd2563dCBf3bF2c9407fEa4dC236fAbA485A        S3          swipe

  555          TUS            Treasure Under Sea Avalanche         0xf693248F96Fe03422FEa95aC0aFbBBc4a8FdD172        S3          treasure-under-sea

  556          USTC           Wrapped USTC       BNB Smart Chain   0x23396cF899Ca06c4472205fC903bDB4de249D6fC        S3          wrapped-ust

  557          VSO            Verso              Avalanche         0x846D50248BAf8b7ceAA9d9B53BFd12d7D7FBB25a        S3          verso

  558          XAVA           Avalaunch          Avalanche         0xd1c3f94DE7e5B45fa4eDBBA472491a9f4B166FC4        S3          avalaunch

  559          XRP            Binance Peg XRP    BNB Smart Chain   0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE        S3          binance-peg-xrp

  560          AGA            AGA                Polygon           0x033d942A6b495C4071083f4CDe1f17e986FE856c        S3          aga-token

  561          AGAR           AGA Rewards        Polygon           0xF84BD51eab957c2e7B7D646A3427C5A50848281D        S3          aga-rewards-2

  562          ALPHA          Alpha Venture DAO  BNB Smart Chain   0xa1faa113cbE53436Df28FF0aEe54275c13B40975        S3          alpha-finance

  563          AVE            Avaware            Avalanche         0x78ea17559B3D2CF85a7F9C2C704eda119Db5E6dE        S3          avaware

  564          BAKE           BakerySwap         BNB Smart Chain   0xE02dF9e3e622DeBdD69fb838bB799E3F168902c5        S3          bakerytoken

  565          BANANA         ApeSwap            BNB Smart Chain   0x603c7f932ED1fc6575303D8Fb018fDCBb0f39a95        S3          apeswap-finance

  566          BCH            Binance Peg        BNB Smart Chain   0x8fF795a6F4D97E7887C79beA79aba5cc76444aDf        S3          binance-peg-bitcoin-cash
                              Bitcoin Cash                                                                                       

  567          BSCX           BSCEX              BNB Smart Chain   0x5Ac52EE5b2a633895292Ff6d8A89bB9190451587        S3          bscex

  568          BTCST          BTC Standard       BNB Smart Chain   0x78650B139471520656b9E7aA7A5e9276814a38e9        S3          btc-standard-hashrate-token
                              Hashrate Token                                                                                     

  569          BURGER         BurgerCities       BNB Smart Chain   0xAe9269f27437f0fcBC232d39Ec814844a51d6b8f        S3          burger-swap

  570          CEL            Celsius Network    Ethereum          0xaaAEBE6Fe48E54f431b0C390CfaF0b017d09D42d        S3          celsius-degree-token

  571          CELR           Celer Network      Arbitrum          0x3a8B787f78D775AECFEEa15706D4221B40F345AB        S3          celer-network

  572          CRA            Crabada            Avalanche         0xA32608e873F9DdEF944B24798db69d80Bbb4d1ed        S3          crabada

  573          CRAFT          TaleCraft          Avalanche         0x8aE8be25C23833e0A01Aa200403e826F611f9CD2        S3          talecraft

  574          DCAU           Dragon Crypto      Avalanche         0x100Cc3a819Dd3e8573fD2E46D1E66ee866068f30        S3          dragon-crypto-aurum
                              Aurum                                                                                              

  575          DOGE           Binance Peg        BNB Smart Chain   0xbA2aE424d960c26247Dd6c32edC70B295c744C43        S3          binance-peg-dogecoin
                              Dogecoin                                                                                           

  576          DXD            DXdao              Arbitrum          0xC3Ae0333F0F34aa734D5493276223d95B8F9Cb37        S3          dxdao

  577          EOS            Binance Peg EOS    BNB Smart Chain   0x56b6fB708fC5732DEC1Afc8D8556423A2EDcCbD6        S3          binance-peg-eos

  578          EPS            Ellipsis OLD       BNB Smart Chain   0xA7f552078dcC247C2684336020c03648500C6d9F        S3          ellipsis

  579          FIL            Binance Peg        BNB Smart Chain   0x0D8Ce2A99Bb6e3B7Db580eD848240e4a0F9aE153        S3          binance-peg-filecoin
                              Filecoin                                                                                           

  580          FIRE           The Phoenix        Avalanche         0xfcc6CE74f4cd7eDEF0C5429bB99d38A3608043a5        S3          the-phoenix

  581          FRONT          Frontier           BNB Smart Chain   0x928e55daB735aa8260AF3cEDadA18B5f70C72f1b        S3          frontier-token

  582          FUEL           Jetfuel Finance    BNB Smart Chain   0x2090c8295769791ab7A3CF1CC6e0AA19F35e441A        S3          fuel-token

  583          GOHM           Governance OHM     Avalanche         0x321E7092a180BB43555132ec53AaA65a5bF84251        S3          governance-ohm

  584          HERO           Metahero           BNB Smart Chain   0xD40bEDb44C081D2935eebA6eF5a3c8A31A1bBE13        S3          metahero

  585          HUSKY          Husky AVAX         Avalanche         0x65378b697853568dA9ff8EaB60C13E1Ee9f4a654        S3          husky-avax

  586          IGG            IG Gold            Polygon           0xe6FC6C7CB6d2c31b359A49A33eF08aB87F4dE7CE        S3          ig-gold

  587          IME            Imperium Empires   Avalanche         0xF891214fdcF9cDaa5fdC42369eE4F27F226AdaD6        S3          imperium-empires

  588          KNCL           Kyber Network      Ethereum          0xdd974D5C2e2928deA5F71b9825b8b646686BD200        S3          kyber-network
                              Crystal Legacy                                                                                     

  589          LYD            Lydia Finance      Avalanche         0x4C9B4E1AC6F24CdE3660D5E4Ef1eBF77C710C084        S3          lydia-finance

  590          MATH           MATH               Arbitrum          0x99F40b01BA9C469193B360f72740E416B17Ac332        S3          math

  591          MCB            MUX Protocol       Arbitrum          0x4e352cF164E64ADCBad318C3a1e222E9EBa4Ce42        S3          mcdex

  592          MUST           Must               Polygon           0x9C78EE466D6Cb57A4d01Fd887D2b5dFb2D46288f        S3          must

  593          O3             O3 Swap            BNB Smart Chain   0xEe9801669C6138E84bD50dEB500827b776777d28        S3          o3-swap

  594          OM             MANTRA             Polygon           0xC3Ec80343D2bae2F8E680FDADDe7C17E71E114ea        S3          mantra-dao

  595          OMG            OMG Network        Ethereum          0xd26114cd6EE289AccF82350c8d8487fedB8A0C07        S3          omisego

  596          ORN            Orion Protocol     Ethereum          0x0258F474786DdFd37ABCE6df6BBb1Dd5dfC4434a        S3          orion-protocol

  597          PREMIA         Premia             Arbitrum          0x51fC0f6660482Ea73330E414eFd7808811a57Fa2        S3          premia

  598          QI             Qi Dao             Polygon           0x580A84C73811E1839F75d86d75d88cCa0c241fF4        S3          qi-dao

  599          RDPX           Dopex Rebate       Arbitrum          0x32Eb7902D4134bf98A28b963D26de779AF92A212        S3          dopex-rebate-token

  600          REEF           Reef               BNB Smart Chain   0xF21768cCBC73Ea5B6fd3C687208a7c2def2d966e        S3          reef

  601          SPORE          Spore              Avalanche         0x6e7f5C0b9f4432716bDd0a77a3601291b9D9e985        S3          spore

  602          THOR           Thor               Avalanche         0x8F47416CaE600bccF9530E9F3aeaA06bdD1Caa79        S3          thor

  603          TOKE           Tokemak            Ethereum          0x2e9d63788249371f1DFC918a52f8d799F4a38C94        S3          tokemak

  604          VAI            Vai                BNB Smart Chain   0x4BD17003473389A42DAF6a0a729f6Fdb328BbBd7        S3          vai

  605          WEGLD          Wrapped Elrond     BNB Smart Chain   0xbF7c81FFF98BbE61B40Ed186e4AfD6DDd01337fe        S3          wrapped-elrond

  606          WOLF           moonwolf io        Polygon           0x8f18dC399594b451EdA8c5da02d0563c0b2d0f16        S3          moonwolf-io

  607          0XBTC          0xBitcoin          Ethereum          0xB6eD7644C69416d67B522e20bC294A9a9B405B31        S3          oxbitcoin

  608          ADX            Ambire AdEx        Ethereum          0xADE00C28244d5CE17D72E40330B1c318cD12B7c3        S3          adex

  609          ALEPH          Aleph im           Ethereum          0x27702a26126e0B3702af63Ee09aC4d1A084EF628        S3          aleph

  610          AMPL           Ampleforth         Ethereum          0xD46bA6D942050d489DBd938a2C909A5d5039A161        S3          ampleforth

  611          ANY            Anyswap            Polygon           0x6aB6d61428fde76768D7b45D8BFeec19c6eF91A8        S3          anyswap

  612          ARV            Ariva              BNB Smart Chain   0x6679eB24F59dFe111864AEc72B443d1Da666B360        S3          ariva

  613          AUTO           Auto               BNB Smart Chain   0xa184088a740c695E156F91f5cC086a06bb78b827        S3          auto

  614          AVAI           Orca AVAI          Avalanche         0x346A59146b9b4a77100D369a3d18E8007A9F46a6        S3          orca-avai

  615          AVME           AVME               Avalanche         0x1ECd47FF4d9598f89721A2866BFEb99505a413Ed        S3          avme

  616          AVXT           Avaxtars           Avalanche         0x397bBd6A0E41bdF4C3F971731E180Db8Ad06eBc1        S3          avaxtars

  617          BAC            Basis Cash         Ethereum          0x3449FC1Cd036255BA1EB19d65fF4BA2b8903A69a        S3          basis-cash

  618          BDO            bDollar            BNB Smart Chain   0x190b589cf9Fb8DDEabBFeae36a813FFb2A702454        S3          bdollar

  619          BELT           Belt               BNB Smart Chain   0xE0e514c71282b6f4e823703a39374Cf58dc3eA4f        S3          belt

  620          BETH           Binance ETH        BNB Smart Chain   0x250632378E573c6Be1AC2f97Fcdf00515d0Aa91B        S3          binance-eth
                              staking                                                                                            

  621          BOOFI          Boo Finance        Avalanche         0xB00F1ad977a949a3CCc389Ca1D1282A2946963b0        S3          boo-finance

  622          BRY            Berry Data         BNB Smart Chain   0xf859Bf77cBe8699013d6Dbc7C2b926Aaf307F830        S3          berry-data

  623          BSCPAD         BSCPAD             BNB Smart Chain   0x5A3010d4d8D3B5fB49f8B6E57FB9E48063f16700        S3          bscpad

  624          BTCB           Bitcoin Avalanche  Avalanche         0x152b9d0FdC40C096757F570A51E494bd4b943E50        S3          bitcoin-avalanche-bridged-btc-b
                              Bridged BTC b                                                                                      

  625          BUNNY          Pancake Bunny      BNB Smart Chain   0xC9849E6fdB743d08fAeE3E34dd2D1bc69EA11a51        S3          pancake-bunny

  626          C98            Coin98             BNB Smart Chain   0xaEC945e04baF28b135Fa7c640f624f8D90F1C3a6        S3          coin98

  627          CAP            Cap                Arbitrum          0x031d35296154279DC1984dCD93E392b1f946737b        S3          cap

  628          CGG            Chain Guardians    BNB Smart Chain   0x1613957159E9B0ac6c80e824F7Eea748a32a0AE2        S3          chain-guardians

  629          CHESS          Tranchess          BNB Smart Chain   0x20de22029ab63cf9A7Cf5fEB2b737Ca1eE4c82A6        S3          tranchess

  630          COOK           Cook               Avalanche         0x637afeff75ca669fF92e4570B14D6399A658902f        S3          cook

  631          COTI           COTI               Ethereum          0xDDB3422497E61e13543BeA06989C0789117555c5        S3          coti

  632          CREAM          Cream              Ethereum          0x2ba592F78dB6436527729929AAf6c908497cB200        S3          cream-2

  633          CTSI           Cartesi            Ethereum          0x491604c0FDF08347Dd1fa4Ee062a822A5DD06B5D        S3          cartesi

  634          CTX            Cryptex Finance    Ethereum          0x321C2fE4446C7c963dc41Dd58879AF648838f98D        S3          cryptex-finance

  635          CWS            Seascape Crowns    BNB Smart Chain   0xbcf39F0EDDa668C58371E519AF37CA705f2bFcbd        S3          crowns

  636          DEXT           DexTools           Ethereum          0xfB7B4564402E5500dB5bB6d63Ae671302777C75a        S3          dextools

  637          DOG            The Doge NFT       Arbitrum          0x4425742F1EC8D98779690b5A3A6276Db85Ddc01A        S3          the-doge-nft

  638          DOME           Everdome           BNB Smart Chain   0x475bFaa1848591ae0E6aB69600f48d828f61a80E        S3          everdome

  639          DPI            DeFi Pulse Index   Ethereum          0x1494CA1F11D487c2bBe4543E90080AeBa4BA3C2b        S3          defipulse-index

  640          DYP            DeFi Yield         Avalanche         0x961C8c0B1aaD0c0b10a51FeF6a867E3091BCef17        S3          defi-yield-protocol
                              Protocol                                                                                           

  641          EDEN           EDEN               Ethereum          0x1559FA1b8F28238FD5D76D9f434ad86FD20D1559        S3          eden

  642          EGG            Chikn Egg          Avalanche         0x7761E2338B35bCEB6BdA6ce477EF012bde7aE611        S3          chikn-egg

  643          EZ             EasyFi V2          BNB Smart Chain   0x5512014efa6Cd57764Fa743756F7a6Ce3358cC83        S3          easyfi

  644          FARM           Harvest Finance    Ethereum          0xa0246c9032bC3A600820415aE600c6388619A14D        S3          harvest-finance

  645          FEI            Fei USD            Ethereum          0x956F47F50A910163D8BF957Cf5846D573E7f87CA        S3          fei-usd

  646          FINE           Refinable          BNB Smart Chain   0x4e6415a5727ea08aAE4580057187923aeC331227        S3          refinable

  647          FODL           Fodl Finance       Ethereum          0x4C2e59D098DF7b6cBaE0848d66DE2f8A4889b9C3        S3          fodl-finance

  648          FUSE           Fuse               Ethereum          0x970B9bB2C0444F5E81e9d0eFb84C8ccdcdcAf84d        S3          fuse-network-token

  649          GAJ            Gaj Finance        Polygon           0xF4B0903774532AEe5ee567C02aaB681a81539e92        S3          gaj

  650          GB             Good Bridging      Avalanche         0x90842eb834cFD2A1DB0b1512B254a18E4D396215        S3          good-bridging

  651          GUSD           Gemini Dollar      Ethereum          0x056Fd409E1d7A124BD7017459dFEa2F387b6d5Cd        S3          gemini-dollar

  652          H2O            Defrost Finance    Avalanche         0x026187BdbC6b751003517bcb30Ac7817D5B766f8        S3          defrost-finance-h2o
                              H2O                                                                                                

  653          IFARM          iFARM              Polygon           0xab0b2ddB9C7e440fAc8E140A89c0dbCBf2d7Bbff        S3          ifarm

  654          IOTX           Binance Peg IoTeX  BNB Smart Chain   0x9678E42ceBEb63F23197D726B29b1CB20d0064E5        S3          binance-peg-iotex

  655          ISA            Islander           Avalanche         0x3EeFb18003D033661f84e48360eBeCD181A84709        S3          islander

  656          JGN            Juggernaut         BNB Smart Chain   0xC13B7a43223BB9Bf4B69BD68Ab20ca1B79d81C75        S3          juggernaut

  657          KEEP           Keep Network       Ethereum          0x85Eee30c52B0b379b046Fb0F85F4f3Dc3009aFEC        S3          keep-network

  658          KP3R           Keep3rV1           Ethereum          0x1cEB5cB57C4D4E2b2433641b95Dd330A33185A44        S3          keep3rv1

  659          KRILL          Polywhale          Polygon           0x05089C9EBFFa4F0AcA269e32056b1b36B37ED71b        S3          polywhale

  660          KUN            Chemix Ecology     BNB Smart Chain   0x1A2fb0Af670D0234c2857FaD35b789F8Cb725584        S3          chemix-ecology-governance-token
                              Governance                                                                                         

  661          LINA           Linear             BNB Smart Chain   0x762539b45A1dCcE3D36d080F74d1AED37844b878        S3          linear

  662          LTO            LTO Network        BNB Smart Chain   0x857B222Fc79e1cBBf8Ca5f78CB133d1b7CF34BBd        S3          lto-network

  663          MCRN           MacaronSwap        BNB Smart Chain   0xacb2d47827C9813AE26De80965845D80935afd0B        S3          macaronswap

  664          MLN            Enzyme             Ethereum          0xec67005c4E498Ec7f55E092bd1d35cbC47C91892        S3          melon

  665          MONA           Monavale           Polygon           0x6968105460f67c3BF751bE7C15f92F5286Fd0CE5        S3          monavale

  666          MTA            mStable Governance Ethereum          0xa3BeD4E1c75D00fa6f4E5E6922DB7261B5E9AcD2        S3          meta
                              Meta                                                                                               

  667          NRV            Nerve Finance      BNB Smart Chain   0x42F6f551ae042cBe50C739158b4f0CAC0Edb9096        S3          nerve-finance

  668          NU             NuCypher           Ethereum          0x4fE83213D56308330EC302a8BD641f1d0113A4Cc        S3          nucypher

  669          OGN            Origin Protocol    Ethereum          0x8207c1FfC5B6804F6024322CcF34F29c3541Ae26        S3          origin-protocol

  670          ONT            Binance Peg        BNB Smart Chain   0xFd7B3A77848f1C2D67E05E54d78d174a0C850335        S3          binance-peg-ontology
                              Ontology                                                                                           

  671          PERL           PERL eco           BNB Smart Chain   0x0F9E4D49f25de22c2202aF916B681FBB3790497B        S3          perlin

  672          PLOT           PlotX              Polygon           0xe82808eaA78339b06a691fd92E1Be79671cAd8D3        S3          plotx

  673          PNK            Kleros             Ethereum          0x93ED3FBe21207Ec2E8f2d3c3de6e058Cb73Bc04d        S3          kleros

  674          POLY           Polymath           Ethereum          0x9992eC3cF6A55b00978cdDF2b27BC6882d88D1eC        S3          polymath

  675          POTS           Moonpot            BNB Smart Chain   0x3Fcca8648651E5b974DD6d3e50F61567779772A8        S3          moonpot

  676          RACA           Radio Caca         BNB Smart Chain   0x12BB890508c125661E03b09EC06E404bc9289040        S3          radio-caca

  677          RAMP           RAMP OLD           BNB Smart Chain   0x8519EA49c997f50cefFa444d240fB655e89248Aa        S3          ramp

  678          RARI           Rarible            Ethereum          0xFca59Cd816aB1eaD66534D82bc21E7515cE441CF        S3          rarible

  679          RENBTC         renBTC             Ethereum          0xEB4C2781e4ebA804CE9a9803C67d0893436bB27D        S3          renbtc

  680          REP            Augur              Ethereum          0x221657776846890989a759BA2973e427DfF5C9bB        S3          augur

  681          ROCO           Roco Finance       Avalanche         0xb2a85C5ECea99187A977aC34303b80AcbDdFa208        S3          roco-finance

  682          ROOK           Rook               Ethereum          0xfA5047c9c78B8877af97BDcb85Db743fD7313d4a        S3          rook

  683          ROUTE          Router Protocol    Polygon           0x16ECCfDbb4eE1A85A33f3A9B21175Cd7Ae753dB4        S3          route

  684          SDT            Stake DAO          Ethereum          0x73968b9a57c6E53d41345FD57a6E6ae27d6CDB2F        S3          stake-dao

  685          SFUND          Seedify fund       BNB Smart Chain   0x477bC8d23c634C154061869478bce96BE6045D12        S3          seedify-fund

  686          SHIBX          Shibavax           Avalanche         0x440aBbf18c54b2782A4917b80a1746d3A2c2Cce1        S3          shibavax

  687          SOS            OpenDAO            Ethereum          0x3b484b82567a09e2588A13D54D032153f0c0aEe0        S3          opendao

  688          SRM            Serum              Ethereum          0x476c5E26a75bd202a9683ffD34359C0CC15be0fF        S3          serum

  689          STARL          StarLink           Ethereum          0x8E6cd950Ad6ba651F6DD608Dc70e5886B1AA6B24        S3          starlink

  690          SUPER          SuperFarm          Ethereum          0xe53EC727dbDEB9E2d5456c3be40cFF031AB40A55        S3          superfarm

  691          SUSD           sUSD               Arbitrum          0xA970AF1a584579B618be4d69aD6F73459D112F95        S3          nusd

  692          SWPR           Swapr              Arbitrum          0xdE903E2712288A1dA82942DDdF2c20529565aC30        S3          swapr

  693          TITAN          IRON Titanium      Polygon           0xaAa5B9e6c589642f98a1cDA99B9D024B8407285A        S3          iron-titanium-token

  694          TPT            TokenPocket Token  BNB Smart Chain   0xECa41281c24451168a37211F0bc2b8645AF45092        S3          token-pocket

  695          TRADE          Unitrade           BNB Smart Chain   0x7af173F350D916358AF3e218Bdf2178494Beb748        S3          unitrade

  696          TRIBE          Tribe              Ethereum          0xc7283b66Eb1EB5FB86327f08e1B5816b0720212B        S3          tribe-2

  697          TRU            TrueFi             Ethereum          0x4C19596f5aAfF459fA38B0f7eD92F11AE6543784        S3          truefi

  698          TRX            TRON BSC           BNB Smart Chain   0x85EAC5Ac2F758618dFa09bDbe0cf174e7d574D5B        S3          tron-bsc

  699          TSD            Teddy Dollar       Avalanche         0x4fbf0429599460D327BD5F55625E30E4fC066095        S3          teddy-dollar

  700          UBT            Unibright          Ethereum          0x8400D94A5cb0fa0D041a3788e395285d61c9ee5e        S3          unibright

  701          UFO            UFO Gaming         Ethereum          0x249e38Ea4102D0cf8264d3701f1a0E39C4f2DC3B        S3          ufo-gaming

  702          USDP           Pax Dollar         Ethereum          0x8E870D67F660D95d5be530380D0eC0bd388289E1        S3          paxos-standard

  703          UST            TerraUSD Wormhole  Ethereum          0xa693B19d2931d498c5B318dF961919BB4aee87a5        S3          terrausd-wormhole

  704          VISION         APY vision         Polygon           0x034b2090b579228482520c589dbD397c53Fc51cC        S3          apy-vision

  705          VISR           Visor              Arbitrum          0x995C235521820f2637303Ca1970c7c044583df44        S3          visor

  706          WET            Weble Ecosystem    Avalanche         0xB1466d4cf0DCfC0bCdDcf3500F473cdACb88b56D        S3          weble-ecosystem-token

  707          WEX            WaultSwap          BNB Smart Chain   0xa9c41A46a6B3531d28d5c32F6633dd2fF05dFB90        S3          waultswap

  708          XFT            Offshift           Ethereum          0xABe580E7ee158dA464b51ee1a83Ac0289622e6be        S3          offshift

  709          ZIL            Zilliqa            BNB Smart Chain   0xb86AbCb37C3A4B64f74f59301AFF131a1BEcC787        S3          zilliqa

  710          8PAY           8Pay               BNB Smart Chain   0xFeea0bDd3D07eb6FE305938878C0caDBFa169042        S3          8pay

  711          ABNBC          Ankr Reward        BNB Smart Chain   0xE85aFCcDaFBE7F2B096f268e31ccE3da8dA2990A        S3          ankr-reward-bearing-stake
                              Bearing Stake BNB                                                                                  

  712          AELIN          Aelin              Optimism          0x61BAADcF22d2565B0F471b291C475db5555e0b76        S3          aelin

  713          AETHC          Ankr Reward        Ethereum          0xE95A203B1a91a908F9B9CE46459d101078c2c3cb        S3          ankreth
                              Bearing Staked ETH                                                                                 

  714          AKRO           Akropolis          Ethereum          0x8Ab7404063Ec4DBcfd4598215992DC3F8EC853d7        S3          akropolis

  715          ALGB           Algebra            Polygon           0x0169eC1f8f639B32Eec6D923e24C2A2ff45B9DD6        S3          algebra

  716          ALPA           Alpaca City        BNB Smart Chain   0xc5E6689C9c8B02be7C49912Ef19e79cF24977f03        S3          alpaca

  717          AMAAVE         Aave Polygon AAVE  Polygon           0x1d2a0E5EC8E5bBDCA5CB219e649B565d8e5c3360        S3          aave-polygon-aave

  718          ANRX           AnRKey X           Polygon           0x554f074d9cCda8F483d1812d4874cBebD682644E        S3          anrkey-x

  719          ANT            Aragon             Ethereum          0xa117000000f279D81A1D3cc75430fAA017FA5A2e        S3          aragon

  720          ARIA20         Arianee            Polygon           0x46F48FbdedAa6F5500993BEDE9539ef85F4BeE8e        S3          arianee

  721          ARPA           ARPA               BNB Smart Chain   0x6F769E65c14Ebd1f68817F5f1DcDb61Cfa2D6f7e        S3          arpa

  722          AST            AirSwap            Ethereum          0x27054b13b1B798B345b591a4d22e6562d47eA75a        S3          airswap

  723          AUC            Auctus             Ethereum          0xc12d099be31567add4e4e4d0D45691C3F58f5663        S3          auctus

  724          AUCTION        Bounce             Ethereum          0xA9B1Eb5908CfC3cdf91F9B8B3a74108598009096        S3          auction

  725          AUDIO          Audius             Ethereum          0x18aAA7115705e8be94bfFEBDE57Af9BFc265B998        S3          audius

  726          AXIAL          Axial Token        Avalanche         0xcF8419A615c57511807236751c0AF38Db4ba3351        S3          axial-token

  727          AZUKI          Azuki              Polygon           0x7CdC0421469398e0F3aA8890693d86c840Ac8931        S3          azuki

  728          BABYCAKE       Baby Cake          BNB Smart Chain   0xdB8D30b74bf098aF214e862C90E647bbB1fcC58c        S3          baby-cake

  729          BANK           Bankless DAO       Ethereum          0x2d94AA3e47d9D5024503Ca8491fcE9A2fB4DA198        S3          bankless-dao

  730          BAO            Bao Finance        Ethereum          0x374CB8C27130E2c9E04F44303f3c8351B9De61C1        S3          bao-finance

  731          BEL            Bella Protocol     BNB Smart Chain   0x8443f091997f06a61670B735ED92734F5628692F        S3          bella-protocol

  732          BFI            Bearn fi           BNB Smart Chain   0x81859801b01764D4f0Fa5E64729f5a6C3b91435b        S3          bearn-fi

  733          BICO           Biconomy           Ethereum          0xF17e65822b568B3903685a7c9F496CF7656Cc6C2        S3          biconomy

  734          BIT            BitDAO             Ethereum          0x1A4b46696b2bB4794Eb3D4c26f1c55F9170fa4C5        S3          bitdao

  735          BLZ            Bluzelle           Ethereum          0x5732046A883704404F284Ce41FfADd5b007FD668        S3          bluzelle

  736          BMON           Binamon            BNB Smart Chain   0x08ba0619b1e7A582E0BCe5BBE9843322C954C340        S3          binamon

  737          BONDLY         Forj               BNB Smart Chain   0x5D0158A5c3ddF47d4Ea4517d8DB0D76aA2e87563        S3          bondly

  738          BORING         BoringDAO          BNB Smart Chain   0xffEecbf8D7267757c2dc3d13D730E97E15BfdF7F        S3          boringdao

  739          BPT            Bold Point         Avalanche         0x1111111111182587795eF1098ac7da81a108C97a        S3          bold-point

  740          BSGG           Betswap gg         Avalanche         0x63682bDC5f875e9bF69E201550658492C9763F89        S3          betswap-gg

  741          BTTOLD         BitTorrent OLD     BNB Smart Chain   0x8595F9dA7b868b1822194fAEd312235E43007b49        S3          bittorrent-old

  742          BUX            BUX                BNB Smart Chain   0x211FfbE424b90e25a15531ca322adF1559779E45        S3          blockport

  743          BZRX           bZx Protocol       Ethereum          0x56d811088235F11C8920698a204A5010a788f4b3        S3          bzx-protocol

  744          CETH           cETH               Ethereum          0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5        S3          compound-ether

  745          CLY            Colony             Avalanche         0xec3492a2508DDf4FDc0cD76F31f340b30d1793e6        S3          colony

  746          COMBO          Furucombo          Ethereum          0xfFffFffF2ba8F66D4e51811C5190992176930278        S3          furucombo

  747          CORE           cVault finance     Ethereum          0x62359Ed7505Efc61FF1D56fEF82158CcaffA23D7        S3          cvault-finance

  748          COVAL          Circuits of Value  Ethereum          0x3D658390460295FB963f54dC0899cfb1c30776Df        S3          circuits-of-value

  749          CQT            Covalent           Ethereum          0xD417144312DbF50465b1C641d016962017Ef6240        S3          covalent

  750          CUSDC          cUSDC              Ethereum          0x39AA39c021dfbaE8faC545936693aC917d5E7563        S3          compound-usd-coin

  751          CVC            Civic              Ethereum          0x41e5560054824eA6B0732E656E3Ad64E20e94E45        S3          civic

  752          CVP            PowerPool          Ethereum          0x38e4adB44ef08F22F5B5b76A8f0c2d0dCbE7DcA1        S3          concentrated-voting-power
                              Concentrated                                                                                       
                              Voting Power                                                                                       

  753          CYC            Cyclone Protocol   BNB Smart Chain   0x810EE35443639348aDbbC467b33310d2AB43c168        S3          cyclone-protocol

  754          CYCLE          Cycle              Avalanche         0x81440C939f2C1E34fc7048E518a637205A632a74        S3          cycle-token

  755          DDX            DerivaDAO          Ethereum          0x3A880652F47bFaa771908C07Dd8673A787dAEd3A        S3          derivadao

  756          DEGEN          DEGEN Index        Ethereum          0x126c121f99e1E211dF2e5f8De2d96Fa36647c855        S3          degen-index

  757          DERC           DeRace             Ethereum          0x9fa69536d1cda4A04cFB50688294de75B505a9aE        S3          derace

  758          DEV            Dev Protocol       Ethereum          0x5cAf454Ba92e6F2c929DF14667Ee360eD9fD5b26        S3          dev-protocol

  759          DF             dForce             Ethereum          0x431ad2ff6a9C365805eBaD47Ee021148d6f7DBe0        S3          dforce-token

  760          DFX            DFX Finance        Polygon           0xE7804D91dfCDE7F776c90043E03eAa6Df87E6395        S3          dfx-finance

  761          DFYN           Dfyn Network       Polygon           0xC168E40227E4ebD8C1caE80F7a55a4F0e6D66C97        S3          dfyn-network

  762          DG             Decentral Games    Polygon           0x2a93172c8DCCbfBC60a39d56183B7279a2F647b4        S3          decentral-games-old
                              Old                                                                                                

  763          DHT            dHEDGE DAO         Ethereum          0xca1207647Ff814039530D7d35df0e1Dd2e91Fa84        S3          dhedge-dao

  764          DMT            Dark Matter        Polygon           0xd28449BB9bB659725aCcAd52947677ccE3719fD7        S3          dark-matter

  765          DNT            district0x         Ethereum          0x0AbdAce70D3790235af448C88547603b945604ea        S3          district0x

  766          DSLA           DSLA Protocol      Polygon           0xa0E390e9ceA0D0e8cd40048ced9fA9EA10D71639        S3          stacktical

  767          DUCK           Unit Protocol      Ethereum          0x92E187a03B6CD19CB6AF293ba17F2745Fd2357D5        S3          unit-protocol-duck

  768          DVF            Rhino fi           Ethereum          0xDDdddd4301A082e62E84e43F474f044423921918        S3          rhinofi

  769          ERSDL          unFederalReserve   Ethereum          0x5218E472cFCFE0b64A064F055B43b4cdC9EfD3A6        S3          unfederalreserve

  770          ETH2X-FLI-P    Index Coop ETH 2x  Polygon           0x3Ad707dA309f3845cd602059901E39C4dcd66473        S3          index-coop-eth-2x-flexible-leverage-index
                              Flexible Leverage                                                                                  
                              I                                                                                                  

  771          EXRD           e Radix            Ethereum          0x6468e79A80C0eaB0F9A2B574c8d5bC374Af59414        S3          e-radix

  772          FEED           chikn feed         Avalanche         0xab592d197ACc575D16C3346f4EB70C703F308D1E        S3          chikn-feed

  773          FOR            ForTube            BNB Smart Chain   0x658A109C5900BC6d2357c87549B651670E5b0539        S3          force-protocol

  774          FUN            FUN                Ethereum          0x419D0d8BdD9aF5e606Ae2232ed285Aff190E711b        S3          funfair

  775          GAME           GameCredits        Polygon           0x8d1566569d5b695d44a9a234540f68D393cDC40D        S3          gamecredits

  776          GDL            Gondola Finance    Avalanche         0xD606199557c8Ab6F4Cc70bD03FaCc96ca576f142        S3          gondola-finance

  777          GFARM2         Gains Farm         Polygon           0x7075cAB6bCCA06613e2d071bd918D1a0241379E2        S3          gains-farm

  778          GTC            Gitcoin            Ethereum          0xDe30da39c46104798bB5aA3fe8B9e0e1F348163F        S3          gitcoin

  779          GUM            Gourmet Galaxy     BNB Smart Chain   0xc53708664b99DF348dd27C3Ac0759d2DA9c40462        S3          gourmetgalaxy

  780          GYEN           GYEN               Ethereum          0xC08512927D12348F6620a698105e1BAac6EcD911        S3          gyen

  781          HAY            Destablecoin HAY   BNB Smart Chain   0x0782b6d8c4551B9760e74c0545a9bCD90bdc41E5        S3          helio-protocol-hay

  782          HEC            HeroesChained      Avalanche         0xC7f4debC8072e23fe9259A5C0398326d8EfB7f5c        S3          heroeschained

  783          HEZ            Hermez Network     Ethereum          0xEEF9f339514298C6A857EfCfC1A762aF84438dEE        S3          hermez-network-token

  784          HND            Hundred Finance    Arbitrum          0x10010078a54396F62c96dF8532dc2B4847d47ED3        S3          hundred-finance

  785          HON            Heroes of NFT      Avalanche         0xEd2b42D3C9c6E97e11755BB37df29B6375ede3EB        S3          heroes-of-nft

  786          HOT            Holo               Ethereum          0x6c6EE5e31d828De241282B9606C8e98Ea48526E2        S3          holotoken

  787          HT             Huobi              Ethereum          0x6f259637dcD74C767781E37Bc6133cd6A68aa161        S3          huobi-token

  788          HUSD           HUSD               Ethereum          0xdF574c24545E5FfEcb9a659c229253D4111d87e1        S3          husd

  789          ICE            Popsicle Finance   Ethereum          0xf16e81dce15B08F326220742020379B855B87DF9        S3          ice-token

  790          IF             Impossible Finance BNB Smart Chain   0xB0e1fc65C1a741b4662B813eB787d369b8614Af1        S3          impossible-finance

  791          INSUR          InsurAce           BNB Smart Chain   0x3192CCDdf1CDcE4Ff055EbC80f3F0231b86A7E30        S3          insurace

  792          INV            Inverse Finance    Ethereum          0x41D5D79431A913C4aE7d69a668ecdfE5fF9DFB68        S3          inverse-finance

  793          IRIS           Iris               Polygon           0xdaB35042e63E93Cc8556c9bAE482E5415B5Ac4B1        S3          iris-token-2

  794          IRON           Iron               Polygon           0xD86b5923F3AD7b585eD81B448170ae026c65ae9a        S3          iron-stablecoin

  795          JPYC           JPY Coin v1        Polygon           0x6AE7Dfc73E0dDE2aa99ac063DcF7e8A63265108c        S3          jpyc

  796          JRT            Jarvis Reward      Ethereum          0x8A9C67fee641579dEbA04928c4BC45F66e26343A        S3          jarvis-reward-token

  797          KISHU          Kishu Inu          Ethereum          0xA2b4C0Af19cC16a6CfAcCe81F192B024d625817D        S3          kishu-inu

  798          KLIMA          Klima DAO          Polygon           0x4e78011Ce80ee02d2c3e649Fb657E45898257815        S3          klima-dao

  799          KNC            Kyber Network      Polygon           0x1C954E8fe737F99f68Fa1CCda3e51ebDB291948C        S3          kyber-network-crystal
                              Crystal                                                                                            

  800          KOM            Kommunitas         Polygon           0xC004e2318722EA2b15499D6375905d75Ee5390B8        S3          kommunitas

  801          LCX            LCX                Ethereum          0x037A54AaB062628C9Bbae1FDB1583c195585fe41        S3          lcx

  802          LEND           Aave OLD           Ethereum          0x80fB784B7eD66730e8b1DBd9820aFD29931aab03        S3          ethlend

  803          LIEN           Lien               BNB Smart Chain   0x5d684ADaf3FcFe9CFb5ceDe3abf02F0Cdd1012E3        S3          lien

  804          LON            Tokenlon           Ethereum          0x0000000000095413afC295d19EDeb1Ad7B71c952        S3          tokenlon

  805          LOST           Lost World         Avalanche         0x449674B82F05d498E126Dd6615a1057A9c088f2C        S3          lost-world

  806          LUNC           Wrapped Terra      Ethereum          0xd2877702675e6cEb975b4A1dFf9fb7BAF4C91ea9        S3          wrapped-terra
                              Classic                                                                                            

  807          LYRA           Lyra Finance       Optimism          0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb        S3          lyra-finance

  808          MAHA           MahaDAO            Ethereum          0xB4d930279552397bbA2ee473229f89Ec245bc365        S3          mahadao

  809          MARSH          Unmarshal          BNB Smart Chain   0x2FA5dAF6Fe0708fBD63b1A7D1592577284f52256        S3          unmarshal

  810          MASQ           MASQ               Ethereum          0x06F3C323f0238c72BF35011071f2b5B7F43A054c        S3          masq

  811          MDT            Measurable Data    Ethereum          0x814e0908b12A99FeCf5BC101bB5d0b8B5cDf7d26        S3          measurable-data-token

  812          MIR            Mirror Protocol    Ethereum          0x09a3EcAFa817268f77BE1283176B946C4ff2E608        S3          mirror-protocol

  813          MIST           Alchemist          Ethereum          0x88ACDd2a6425c3FaAE4Bc9650Fd7E27e0Bebb7aB        S3          alchemist

  814          MOD            Modefi             Polygon           0x8346Ab8d5EA7A9Db0209aEd2d1806AFA0E2c4C21        S3          modefi

  815          MTL            Metal DAO          Ethereum          0xF433089366899D83a9f26A773D59ec7eCF30355e        S3          metal

  816          MULTI          Multichain         Ethereum          0x65Ef703f5594D2573eb71Aaf55BC0CB548492df4        S3          multichain

  817          MYST           Mysterium          Polygon           0x1379E8886A944d2D9d440b3d88DF536Aea08d9F3        S3          mysterium

  818          NCT            PolySwarm          Ethereum          0x9E46A38F5DaaBe8683E10793b06749EEF7D733d1        S3          polyswarm

  819          NDX            Indexed Finance    Ethereum          0x86772b1409b61c639EaAc9Ba0AcfBb6E238e5F83        S3          indexed-finance

  820          NFTX           NFTX               Ethereum          0x87d73E916D7057945c9BcD8cdd94e42A6F47f776        S3          nftx

  821          NYAN           ArbiNYAN           Arbitrum          0xeD3fB761414DA74b74F33e5c5a1f78104b188DfC        S3          arbinyan

  822          ODDZ           Oddz               BNB Smart Chain   0xCD40F2670CF58720b694968698A5514e924F742d        S3          oddz

  823          OMEN           Augury Finance     Polygon           0x76e63a3E7Ba1e2E61D3DA86a87479f983dE89a7E        S3          augury-finance

  824          OOE            OpenOcean          Avalanche         0x0ebd9537A25f56713E34c45b38F421A1e7191469        S3          openocean

  825          OPIUM          Opium              Ethereum          0x888888888889C00c67689029D7856AAC1065eC11        S3          opium

  826          ORBS           Orbs               BNB Smart Chain   0xeBd49b26169e1b52c04cFd19FCf289405dF55F80        S3          orbs

  827          ORCA           Orca DAO           Avalanche         0x8B1d98A91F853218ddbb066F20b8c63E782e2430        S3          orcadao

  828          OXT            Orchid Protocol    Ethereum          0x4575f41308EC1483f3d399aa9a2826d74Da13Deb        S3          orchid-protocol

  829          PBTC           pTokens BTC OLD    BNB Smart Chain   0xeD28A457A5A76596ac48d87C0f577020F6Ea1c4C        S3          ptokens-btc

  830          PECO           Amun Polygon       Polygon           0xA9536B9c75A9E0faE3B56a96AC8EdF76AbC91978        S3          polygon-ecosystem-index
                              Ecosystem Index                                                                                    

  831          PICKLE         Pickle Finance     Ethereum          0x429881672B9AE42b8EbA0E26cD9C73711b891Ca5        S3          pickle-finance

  832          PLU            Pluton             Ethereum          0xD8912C10681D8B21Fd3742244f44658dBA12264E        S3          pluton

  833          POLAR          POLAR              Avalanche         0x6C1c0319d8dDcb0ffE1a68C5b3829Fd361587DB4        S3          polar

  834          POLS           Polkastarter       Ethereum          0x83e6f1E41cdd28eAcEB20Cb649155049Fac3D5Aa        S3          polkastarter

  835          POLYBUNNY      Pancake Bunny      Polygon           0x4C16f69302CcB511c5Fac682c7626B9eF0Dc126a        S3          bunny-token-polygon
                              Polygon                                                                                            

  836          POND           Marlin             Ethereum          0x57B946008913B82E4dF85f501cbAeD910e58D26C        S3          marlin

  837          PPDEX          Pepedex            Polygon           0x127984b5E6d5c59f81DACc9F1C8b3Bdc8494572e        S3          pepedex

  838          PRE            Presearch          Ethereum          0xEC213F83defB583af3A000B1c0ada660b1902A0F        S3          presearch

  839          PROM           Prom               BNB Smart Chain   0xaF53d56ff99f1322515E54FdDE93FF8b3b7DAFd5        S3          prometeus

  840          PRQ            PARSIQ             Ethereum          0x362bc847A3a9637d3af6624EeC853618a43ed7D2        S3          parsiq

  841          PSP            ParaSwap           Ethereum          0xcAfE001067cDEF266AfB7Eb5A286dCFD277f3dE5        S3          paraswap

  842          QRDO           Qredo              Ethereum          0x4123a133ae3c521FD134D7b13A2dEC35b56c2463        S3          qredo

  843          RACEX          RaceX              Avalanche         0x7086e045b78E1e72F741F25231c08d238812CF8a        S3          racex

  844          RAD            Radicle            Ethereum          0x31c8EAcBFFdD875c74b94b077895Bd78CF1E64A3        S3          radicle

  845          RBC            Rubic              Ethereum          0xA4EED63db85311E22dF4473f87CcfC3DaDCFA3E3        S3          rubic

  846          RCN            Ripio Credit       Ethereum          0xF970b8E36e23F7fC3FD752EeA86f8Be8D83375A6        S3          ripio-credit-network
                              Network                                                                                            

  847          RENBCH         renBCH             Ethereum          0x459086F2376525BdCebA5bDDA135e4E9d3FeF5bf        S3          renbch

  848          RENZEC         renZEC             Ethereum          0x1C5db575E2Ff833E46a2E9864C22F4B22E0B37C2        S3          renzec

  849          RFG            Refugees           BNB Smart Chain   0x4477b28E8b797eBaebd2539bb24290Fdfcc27807        S3          refugees-token

  850          RFOX           RFOX               BNB Smart Chain   0x0a3A21356793B49154Fd3BbE91CBc2A16c0457f5        S3          redfox-labs-2

  851          RLY            Rally              Ethereum          0xf1f955016EcbCd7321c7266BccFB96c68ea5E49b        S3          rally-2

  852          RUNE           THORChain ERC20    Ethereum          0x3155BA85D5F96b2d030a4966AF206230e46849cb        S3          thorchain-erc20

  853          SAFLE          Safle              Polygon           0x04b33078Ea1aEf29bf3fB29c6aB7B200C58ea126        S3          safle

  854          SBDO           bDollar Share      BNB Smart Chain   0x0d9319565be7f53CeFE84Ad201Be3f40feAE2740        S3          bdollar-share

  855          SETH           sETH               Optimism          0xE405de8F52ba7559f9df3C368500B6E6ae6Cee49        S3          seth

  856          SETH2          sETH2              Ethereum          0xFe2e637202056d30016725477c5da089Ab0A043A        S3          seth2

  857          SFI            saffron finance    Ethereum          0xb753428af26E81097e7fD17f40c88aaA3E04902c        S3          saffron-finance

  858          SI             Siren              Ethereum          0xD23Ac27148aF6A2f339BD82D0e3CFF380b5093de        S3          siren

  859          SKILL          CryptoBlades       BNB Smart Chain   0x154A9F9cbd3449AD22FDaE23044319D6eF2a1Fab        S3          cryptoblades

  860          SKL            SKALE              Ethereum          0x00c83aeCC790e8a4453e5dD3B0B4b3680501a7A7        S3          skale

  861          SMRTR          SmarterCoin        Avalanche         0x6D923f688C7FF287dc3A5943CAeefc994F97b290        S3          smart-coin-smrtr

  862          SNT            Status             Ethereum          0x744d70FDBE2Ba4CF95131626614a1763DF805B9E        S3          status

  863          SPANK          SpankChain         Ethereum          0x42d6622deCe394b54999Fbd73D108123806f6a18        S3          spankchain

  864          SPS            Splintershards     BNB Smart Chain   0x1633b7157e7638C4d6593436111Bf125Ee74703F        S3          splinterlands

  865          STACK          StackOS            BNB Smart Chain   0x6855f7bb6287F94ddcC8915E37e73a3c9fEe5CF3        S3          stackos

  866          STAKE          STAKE              Ethereum          0x0Ae055097C6d159879521C384F1D2123D1f195e6        S3          xdai-stake

  867          STAX           StableXSwap        BNB Smart Chain   0x0Da6Ed8B13214Ff28e9Ca979Dd37439e8a88F6c4        S3          stablexswap

  868          STMATIC        Lido Staked Matic  Polygon           0x3A58a54C066FdC0f2D55FC9C89F0415C92eBf3C4        S3          lido-staked-matic

  869          STRONG         Strong             Ethereum          0x990f341946A3fdB507aE7e52d17851B87168017c        S3          strong

  870          STRP           Strips Finance     Arbitrum          0x326c33FD1113c1F29B35B4407F3d6312a8518431        S3          strips-finance

  871          SUKU           SUKU               Ethereum          0x0763fdCCF1aE541A5961815C0872A8c5Bc6DE4d7        S3          suku

  872          SWAP           Trustswap          Ethereum          0xCC4304A31d09258b0029eA7FE63d032f52e44EFe        S3          trustswap

  873          SWINGBY        Swingby            BNB Smart Chain   0x71DE20e0C4616E7fcBfDD3f875d568492cBE4739        S3          swingby

  874          TCR            Tracer DAO         Arbitrum          0xA72159FC390f0E3C6D415e658264c7c4051E9b87        S3          tracer-dao

  875          THG            Thetan Arena       BNB Smart Chain   0x9fD87aEfe02441B123c3c32466cD9dB4c578618f        S3          thetan-arena

  876          TIME           chrono tech        Ethereum          0x485d17A6f1B8780392d53D64751824253011A260        S3          chronobank

  877          TUNDRA         Tundra             Avalanche         0x21c5402C3B7d40C89Cc472C9dF5dD7E51BbAb1b1        S3          tundra-token

  878          TVK            The Virtua Kolect  Ethereum          0xd084B83C305daFD76AE3E1b4E1F1fe2eCcCb3988        S3          the-virtua-kolect

  879          TXL            Autobahn Network   BNB Smart Chain   0x1FFD0b47127fdd4097E54521C9E2c7f0D66AafC5        S3          autobahn-network

  880          UBXT           UpBots             BNB Smart Chain   0xBbEB90cFb6FAFa1F69AA130B7341089AbeEF5811        S3          upbots

  881          VTX            Vector Finance     Avalanche         0x5817D4F0b62A59b17f75207DA1848C2cE75e7AF4        S3          vector-finance

  882          WATCH          Yieldwatch         BNB Smart Chain   0x7A9f28EB62C791422Aa23CeAE1dA9C847cBeC9b0        S3          yieldwatch

  883          WMEMO          Wonderful Memories Avalanche         0x0da67235dD5787D67955420C84ca1cEcd4E5Bb3b        S3          wrapped-memory

  884          WNXM           Wrapped NXM        Ethereum          0x0d438F3b5175Bebc262bF23753C1E53d03432bDE        S3          wrapped-nxm

  885          WOM            Wombat Exchange    BNB Smart Chain   0xAD6742A35fB341A9Cc6ad674738Dd8da98b94Fb1        S3          wombat-exchange

  886          WONE           Wrapped One        BNB Smart Chain   0x03fF0ff224f904be3118461335064bB48Df47938        S3          wrapped-one

  887          WOOP           Woonkly Power      BNB Smart Chain   0x8b303d5BbfBbf46F1a4d9741E491e06986894e18        S3          woonkly-power

  888          WRX            WazirX             Polygon           0x72d6066F486bd0052eefB9114B66ae40e0A6031a        S3          wazirx

  889          X2Y2           X2Y2               Ethereum          0x1E4EDE388cbc9F4b5c79681B7f94d36a11ABEBC9        S3          x2y2

  890          XCHF           CryptoFranc        Ethereum          0xB4272071eCAdd69d933AdcD19cA99fe80664fc08        S3          cryptofranc

  891          XDEFI          XDEFI              Ethereum          0x72B886d09C117654aB7dA13A14d603001dE0B777        S3          xdefi

  892          XED            Exeedme            BNB Smart Chain   0x5621b5A3f4a8008c4CCDd1b942B121c8B1944F1f        S3          exeedme

  893          XEND           Xend Finance       BNB Smart Chain   0x4a080377f83D669D7bB83B3184a8A5E61B500608        S3          xend-finance

  894          XGEM           Exchange Genesis   Polygon           0x02649C1Ff4296038De4b9bA8F491b42b940A8252        S3          exchange-genesis-ethlas-medium
                              Ethlas Medium                                                                                      

  895          XMARK          xMARK              BNB Smart Chain   0x26A5dFab467d4f58fB266648CAe769503CEC9580        S3          xmark

  896          XOR            Sora               Ethereum          0x40FD72257597aA14C7231A7B1aaa29Fce868F677        S3          sora

  897          XPR            Proton             Ethereum          0xD7EFB00d12C2c13131FD319336Fdf952525dA2af        S3          proton

  898          XSUSHI         xSUSHI             Ethereum          0x8798249c2E607446EfB7Ad49eC89dD1865Ff4272        S3          xsushi

  899          YAY            YAY Games          Avalanche         0x01C2086faCFD7aA38f69A6Bd8C91BEF3BB5adFCa        S3          yay-games

  900          YFII           DFI money          Ethereum          0xa1d0E215a23d7030842FC67cE582a6aFa3CCaB83        S3          yfii-finance

  901          YTS            YetiSwap           Avalanche         0x488F73cddDA1DE3664775fFd91623637383D6404        S3          yetiswap

  902          YUSD           YUSD Stablecoin    Avalanche         0x111111111111ed1D73f860F57b2798b683f2d325        S3          yusd-stablecoin

  903          ZOO            ZooKeeper          Avalanche         0x1B88D7aD51626044Ec62eF9803EA264DA4442F32        S3          zookeeper

  904          aAVAXb         Ankr               Avalanche         0x6C6f910A79639dcC94b4feEF59Ff507c2E843929        S3          ankr-avalanche-reward-earning-bond
                              Reward-Earning                                                                                     
                              Staked AVAX                                                                                        

  905          0XMR           0xMonero           Ethereum          0x035dF12E0F3ac6671126525f1015E47D79dFEDDF        S3          0xmonero

  906          2KEY           2key network       Ethereum          0xE48972fCd82a274411c01834e2f031D4377Fa2c0        S3          2key

  907          ABAT           Aave BAT v1        Ethereum          0xE1BA0FB44CCb0D11b80F92f4f8Ed94CA3fF51D00        S3          aave-bat-v1

  908          ABI            Abachi             Polygon           0x6d5f5317308C6fE7D6CE16930353a8Dfd92Ba4D7        S3          abachi

  909          ABLOCK         ANY Blocknet       Avalanche         0xC931f61B1534EB21D8c11B24f3f5Ab2471d4aB50        S3          any-blocknet

  910          ABYSS          Abyss              Ethereum          0x0E8d6b471e332F140e7d9dbB99E5E3822F728DA6        S3          the-abyss

  911          ACAR           AGA Carbon Rewards Polygon           0xcBce9f77921C2E90522d438dF4C5582F4c617768        S3          aga-carbon-rewards

  912          ACRE           Arable Protocol    Avalanche         0x00EE200Df31b869a321B10400Da10b561F3ee60d        S3          arable-protocol

  913          ACS            ACryptoS           BNB Smart Chain   0x4197C6EF3879a08cD51e5560da5064B773aa1d29        S3          acryptos

  914          ACSI           ACryptoSI          BNB Smart Chain   0x5b17b4d5e4009B5C43e3e3d63A5229F794cBA389        S3          acryptosi

  915          ADAI           Aave DAI v1        Ethereum          0xfC1E690f61EFd961294b3e1Ce3313fBD8aa4f85d        S3          aave-dai-v1

  916          ADAI           Aave DAI           Avalanche         0x82E64f49Ed5EC1bC6e43DAD4FC8Af9bb3A2312EE        S3          aave-dai

  917          ADOGE          ArbiDoge           Arbitrum          0x155f0DD04424939368972f4e1838687d6a831151        S3          arbidoge

  918          ADS            Adshares           BNB Smart Chain   0xcfcEcFe2bD2FED07A9145222E8a7ad9Cf1Ccd22A        S3          adshares

  919          AERGO          Aergo              Ethereum          0x91Af0fBB28ABA7E31403Cb457106Ce79397FD4E6        S3          aergo

  920          AGAC           AGA Carbon Credit  Polygon           0x669ddc70273084Ea30e6cd4f28CA6e2C70735065        S3          aga-carbon-credit

  921          AGF            Augmented Finance  Avalanche         0xb67a9374Da03d4114a6FB8f0E7F2b82b5cB34ee3        S3          augmented-finance

  922          AGLD           Adventure Gold     Ethereum          0x32353A6C91143bfd6C7d363B546e62a9A2489A20        S3          adventure-gold

  923          AKITAX         Akitavax           Avalanche         0xE06fba763C2104dB5027F57f6A5Be0a0D86308af        S3          akitavax

  924          AKNC           Aave KNC v1        Ethereum          0x9D91BE44C06d373a8a226E1f3b146956083803eB        S3          aave-knc-v1

  925          ALBT           AllianceBlock      Avalanche         0x9E037dE681CaFA6E661e6108eD9c2bd1AA567Ecd        S3          allianceblock

  926          ALINK          Aave LINK          Avalanche         0x191c10Aa4AF7C30e871E70C95dB0E4eb77237530        S3          aave-link

  927          ALINK          Aave LINK v1       Ethereum          0xA64BD6C70Cb9051F6A9ba1F163Fdc07E0DfB5F84        S3          aave-link-v1

  928          ALU            Altura             BNB Smart Chain   0x8263CD1601FE73C066bf49cc09841f35348e3be0        S3          altura

  929          ALUSD          Alchemix USD       Ethereum          0xBC6DA0FE9aD5f3b0d58160288917AA56653660E9        S3          alchemix-usd

  930          AMANA          Aave MANA v1       Ethereum          0x6FCE4A401B6B80ACe52baAefE4421Bd188e76F6f        S3          aave-mana-v1

  931          AMATICC        Ankr Reward        Polygon           0x0E9b89007eEE9c958c0EDA24eF70723C2C93dD58        S3          ankr-reward-earning-matic
                              Earning MATIC                                                                                      

  932          AMDAI          Aave Polygon DAI   Polygon           0x27F8D03b3a2196956ED754baDc28D73be8830A6e        S3          aave-polygon-dai

  933          AMKR           Aave MKR v1        Ethereum          0x7deB5e830be29F91E298ba5FF1356BB7f8146998        S3          aave-mkr-v1

  934          AMUSDC         Aave Polygon USDC  Polygon           0x1a13F4Ca1d028320A707D99520AbFefca3998b7F        S3          aave-polygon-usdc

  935          AMUSDT         Aave Polygon USDT  Polygon           0x60D55F02A771d515e077c9C2403a1ef324885CeC        S3          aave-polygon-usdt

  936          AMWBTC         Aave Polygon WBTC  Polygon           0x5c2ed810328349100A66B82b78a1791B101C9D61        S3          aave-polygon-wbtc

  937          AMWETH         Aave Polygon WETH  Polygon           0x28424507fefb6f7f8E9D3860F56504E4e5f5f390        S3          aave-polygon-weth

  938          AMWMATIC       Aave Polygon       Polygon           0x8dF3aad3a84da6b69A4DA8aeC3eA40d9091B2Ac4        S3          aave-polygon-wmatic
                              WMATIC                                                                                             

  939          ANN            Annex Finance      BNB Smart Chain   0x98936Bde1CF1BFf1e7a8012Cee5e2583851f2067        S3          annex

  940          AOG            AgeOfGods          BNB Smart Chain   0x40C8225329Bd3e28A043B029E0D07a5344d2C27C        S3          ageofgods

  941          APEIN          Ape In             Avalanche         0x938FE3788222A74924E062120E7BFac829c719Fb        S3          ape-in

  942          APW            APWine             Ethereum          0x4104b135DBC9609Fc1A9490E61369036497660c8        S3          apwine

  943          APX            ApolloX            BNB Smart Chain   0x78F5d389F5CDCcFc41594aBaB4B0Ed02F31398b3        S3          apollox-2

  944          ARBIS          Arbis Finance      Arbitrum          0x9f20de1fc9b161b34089cbEAE888168B44b03461        S3          arbis-finance

  945          ARBYS          Arbys              Arbitrum          0x86A1012d437BBFf84fbDF62569D12d4FD3396F8c        S3          arbys

  946          ARCH           Archer DAO         Ethereum          0x1F3f9D3068568F8040775be2e8C03C103C61f3aF        S3          archer-dao-governance-token
                              Governance                                                                                         

  947          ARCX           ARC Governance     Ethereum          0x1321f1f1aa541A56C31682c57b80ECfCCd9bB288        S3          arc-governance

  948          ARMOR          ARMOR              Ethereum          0x1337DEF16F9B486fAEd0293eb623Dc8395dFE46a        S3          armor

  949          ARNXM          Armor NXM          Ethereum          0x1337DEF18C680aF1f9f45cBcab6309562975b1dD        S3          armor-nxm

  950          ASKO           Asko               Ethereum          0xeEEE2a622330E6d2036691e983DEe87330588603        S3          askobar-network

  951          ASNX           Aave SNX v1        Ethereum          0x328C4c80BC7aCa0834Db37e6600A6c49E12Da4DE        S3          aave-snx-v1

  952          ASUSD          Aave SUSD v1       Ethereum          0x625aE63000f46200499120B906716420bd059240        S3          aave-susd-v1

  953          ATA            Automata           BNB Smart Chain   0xA2120b9e674d3fC3875f415A7DF52e382F141225        S3          automata

  954          ATIS           Atlantis ATIS      Ethereum          0x821144518dfE9e7b44fCF4d0824e15e8390d4637        S3          atlantis-token

  955          ATUSD          Aave TUSD v1       Ethereum          0x4DA9b813057D04BAef4e5800E36083717b4a0341        S3          aave-tusd-v1

  956          AURUM          Raider Aurum       Polygon           0x34d4ab47Bee066F361fA52d792e69AC7bD05ee23        S3          raider-aurum

  957          AUSDC          Aave USDC          Avalanche         0x625E7708f30cA75bfd92586e17077590C60eb4cD        S3          aave-usdc

  958          AUSDC          Aave USDC v1       Ethereum          0x9bA00D6856a4eDF4665BcA2C2309936572473B7E        S3          aave-usdc-v1

  959          AUSDT          Aave USDT v1       Ethereum          0x71fc860F7D3A592A4a98740e39dB31d25db65ae8        S3          aave-usdt-v1

  960          AUSDT          Aave USDT          Avalanche         0x6ab707Aca953eDAeFBc4fD23bA73294241490620        S3          aave-usdt

  961          AWBTC          Aave WBTC v1       Ethereum          0xFC4B8ED459e00e5400be803A9BB3954234FD50e3        S3          aave-wbtc-v1

  962          AWBTC          Aave WBTC          Avalanche         0x078f358208685046a11C85e8ad32895DED33A249        S3          aave-wbtc

  963          AWETH          Aave WETH          Avalanche         0xe50fA9b3c56FfB159cB0FCA61F5c9D750e8128c8        S3          aave-weth

  964          AZRX           Aave ZRX v1        Ethereum          0x6Fb0855c404E09c47C3fBCA25f08d4E41f9F062f        S3          aave-zrx-v1

  965          BASE           Base Protocol      Ethereum          0x07150e919B4De5fD6a63DE1F9384828396f25fDC        S3          base-protocol

  966          BASK           BasketDAO          Ethereum          0x44564d0bd94343f72E3C8a0D22308B7Fa71DB0Bb        S3          basketdao

  967          BBTC           Binance Wrapped    Ethereum          0x9BE89D2a4cd102D8Fecc6BF9dA793be995C22541        S3          binance-wrapped-btc
                              BTC                                                                                                

  968          BCDT           EvidenZ            Ethereum          0xAcfa209Fb73bF3Dd5bBfb1101B9Bc999C49062a5        S3          blockchain-certified-data-token

  969          BCMC           Blockchain Monster Polygon           0xc10358f062663448a3489fC258139944534592ac        S3          blockchain-monster-hunt
                              Hunt                                                                                               

  970          BCOIN          BombCrypto         BNB Smart Chain   0x00e1656e45f18ec6747F5a8496Fd39B50b38396D        S3          bomber-coin

  971          BCT            Toucan Protocol    Polygon           0x2F800Db0fdb5223b3C3f354886d907A671414A7F        S3          toucan-protocol-base-carbon-tonne
                              Base Carbon Tonne                                                                                  

  972          BEPRO          BEPRO Network      Ethereum          0xCF3C8Be2e2C42331Da80EF210e9B1b307C03d36A        S3          bepro-network

  973          BETA           Beta Finance       BNB Smart Chain   0xBe1a001FE942f96Eea22bA08783140B9Dcc09D28        S3          beta-finance

  974          SUI            Sui                Ethereum          0x998abeb3e57409262ae5b751f60747921b33613e        S3          sui

  975          NEAR           NEAR Protocol      Ethereum          0x85f17cf997934a597031b2e18a9ab6ebd4b9f6a4        S3          near

  976          TAO            Bittensor          Ethereum          0x77e06c9eccf2e797fd462a92b6d7642ef85b0a44        S3          bittensor

  977          RENDER         Render             Ethereum          0x6de037ef9ad2725eb40118bb1702ebb27e4aeb24        S3          render-token

  978          APT            Aptos              Ethereum          0x14f8b8ba1e427dc1deb44f42e59cba84e6a1c67         S3          aptos

  979          THETA          Theta Network      Ethereum          0x3883f5e181fccaf8410fa61e12b59bad963fb645        S3          theta-token

  980          ALGO           ALGO               Ethereum          0x27702a26126e0b3702af63ee09ac4d1a084ef628        S3          algorand

  981          ICP            ICP                Ethereum          0x054b8f19843a8293b49a4e4d7b55d3982e7cf63f        S3          internet-computer

  982          VET            VeChain            Ethereum          0xd850942ef8811f2a866692a623011bde52a462c1        S3          vechain

  983          ZEN            Horizen            Ethereum          0xe7a6d3ff9f47e4e5d5e9e5f2d13b88e3a4e1b5c2        S3          zencash

  984          XTZ            Tezos              Ethereum          0x9ebb5d9f01f4c36e0d0f17bfb9ccf7012b0a3441        S3          tezos

  985          MINA           Mina Protocol      Ethereum          0x554f074d9ccda8f483d1812d4874cbeabcd54e12        S3          mina-protocol

  986          FLOW           Flow               Ethereum          0x5c147e74d63b1d31aa3fd78eb229b65161983b2b        S3          flow

  987          KAVA           Kava               Ethereum          0x0c356b7fd36a5357e5a017ef11887ba100c9ab76        S3          kava

  988          ONE            Harmony            Ethereum          0x799a4202c12ca952cb311598a024c80ed371a41e        S3          harmony

  989          HBAR           Hedera             Ethereum          0x14ab470682Bc045336B1df6262d538Cb6c35eA2         S3          hedera-hashgraph

  990          XDC            XDC Network        Ethereum          0x41ab1b6fcbb2fa9dced81acbdec13ea6315f2bf2        S3          xdce-crowd-sale

  991          DASH           Dash               Ethereum          0x57ab1ec28d129707052df4df418d58a2d46d5f51        S3          dash

  992          BTT            BitTorrent         BNB Smart Chain   0x352Cb5E19b12FC216548a2677bD0fce83BaE434B        S3          bittorrent

  993          WIN            WINkLink           BNB Smart Chain   0xaeF0d72a118ce24feE3cD1d43d383897D05B4e99        S3          wink

  994          CKB            Nervos Network     Ethereum          0x27986a0f3c22e0855db4b3e58acb97e79374e34c        S3          nervos-network

  995          STEEM          Steem              Ethereum          0x6406ef4c5cf83e34700ef3f5d6380afde4e46e08        S3          steem

  996          KSM            Kusama             Ethereum          0x69cf3091c91eb72db05e45c76e58225177dea742        S3          kusama

  997          ICX            ICON               Ethereum          0xb5a5f22694352c15b00323844ad545abb2b11028        S3          icon

  998          ZIL            Zilliqa            Ethereum          0x05f4a42e251f2d52b8ed15e9fedaacfcef1fad27        S3          zilliqa

  999          LionOG         LionOG             Base              0x6731F2d7ADF86cfba30d15c4D10113Ce98f3492A        S3          Not assigned

  1000         FrogOG         FrogOG             Base              0x0E3b564bdD09348840811C7e1106BbD0e98b5b4f        S3          Not assigned

  1001         KEKEC          The Balkan Dwarf   Ethereum          0x8c7ac134ed985367eadc6f727d79e8295e11435c        S3          the-balkan-dwarf
  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# Appendix D. Revision Control

  ------------------------------------------------------------------------------
  **Revision**   **Date**    **Status**        **Summary**
  -------------- ----------- ----------------- ---------------------------------
  **Revision 6** **28 July   **Current -       **Incorporates the owner-approved
                 2026**      deployability     chain-equivalent-outcome rule;
                             evidence and      Handshake allowance by the
                             deferred external selected source mechanism\'s
                             inputs remain**   state capability; objective
                                               per-source identity; permitted
                                               new identities and prohibition on
                                               person-level enforcement;
                                               failed-attempt, one-use,
                                               three-use, proof-path
                                               qualification, and
                                               out-of-protocol rules; settled
                                               non-refundable fee treatment;
                                               official-application prevention;
                                               the canonical UTXO
                                               release-public-key identity; and
                                               objective pending-attempt
                                               disposition. Revision 5\'s
                                               17-environment and 1,001-entry
                                               registry corrections remain
                                               unchanged.**

  Revision 5     28 July     Superseded        Owner-authorized correction:
                 2026                          retains native BCH; assigns
                                               Appendix C row 54 to the Bitcoin
                                               Cash environment; expands the
                                               supported set from 16 to 17;
                                               splits the former Bitcoin count
                                               of 2 into Bitcoin 1 and Bitcoin
                                               Cash 1; and updates the
                                               corresponding environment, Dev
                                               Fund, chain-identifier, finality,
                                               and deployment-count
                                               requirements. No asset is added
                                               or removed; the registry remains
                                               exactly 1,001 entries.

  Revision 4     27 July     Superseded        Replaces predetermined
                 2026                          registry-file byte identity with
                                               semantic conformity to Appendix
                                               C; adds VF-REG-011; removes the
                                               review-time file-hash
                                               requirement; clarifies deployment
                                               evidence; and replaces the
                                               registry companion guidance. No
                                               asset identity, environment,
                                               classification, pricing
                                               identifier, or other protocol
                                               behavior changes.

  Revision 3     27 July     Superseded        Adds VF-COM-026 to make the
                 2026                          one-hour duration exclusive to a
                                               qualifying Trust-Building
                                               Handshake; records the prior-file
                                               review evidence; and introduces a
                                               registry-file provenance control
                                               later superseded by the current
                                               semantic registry rule. No other
                                               protocol behavior changes.

  Revision 2     27 July     Superseded        Synchronizes all settled
                 2026                          behavior; replaces the prior
                                               Handshake, oracle, Treasury
                                               Reward Stake activation,
                                               environment, S2, cross-chain,
                                               Axelar ITS, cap, epoch, proof,
                                               fee-destination, terminology, and
                                               deployment language; incorporates
                                               the complete 1,001-entry
                                               registry.

  Revision 1     25 July     Superseded        First comprehensive current-state
                 2026                          specification and original-form
                                               fee-routing accounting revision.
  ------------------------------------------------------------------------------

  -----------------------------------------------------------------------
  **CURRENT STATUS**\
  Current - All presently approved specification amendments are
  incorporated. Implementation-blocking deployability evidence, including
  the Cosmos Hub chain-native feasibility analysis, and deferred external
  deployment inputs remain. No owner decision remains open.
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------
