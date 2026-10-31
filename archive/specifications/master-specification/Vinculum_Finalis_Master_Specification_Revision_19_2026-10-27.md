**ARCHIVED 2026-10-31, superseded by Revision 20 (t970u).**

# Vinculum Finalis Master Specification, Revision 19

**CURRENT GOVERNING EDITION. Revision 19, 2026-10-27. Revision 19 supersedes all prior revisions, including Revision 18.**

- Path: docs/Vinculum_Finalis_Master_Specification_Revision_19_2026-10-27.md
- Authority file: DOCUMENT_REGISTER.md records the SHA-256 of this file. That hash identifies the governing text.
- Base text: a full copy of Revision 18 (archive/specifications/master-specification/Vinculum_Finalis_Master_Specification_Revision_18_2026-10-24.md, SHA-256 487735227ea32aa6914d180d5aa8fd0ef5028e56a5ab4c328a63168072ca44bc) with the Revision 19 changes applied. In the inline markers below, "the Base-only replacement" means this Revision 19. Revision 18 was a full copy of Revision 17 (archive/specifications/master-specification/Vinculum_Finalis_Master_Specification_Revision_17_2026-10-24.md, SHA-256 3b45aeeb25881c7f2465b2bf78400bfd94626df9fe0e3456d72cbe9e1452dace). Revision 17 was a full copy of Revision 16, Revision 16 was a full copy of Revision 15, Revision 15 was a full copy of Revision 14, and Revision 14 carried forward the full text of Revision 6 with its section numbering and all 209 numbered requirements.
- Every rule is stated in this file. No rule is inherited from a prior revision by reference or by silence.
- Edits are marked inline with "(Changed in the Base-only replacement, source: ...)", "(Changed in Revision N, source: file)", "(Added in Revision N, source: ...)" or "(changed by operator decision ..., source: file)". These markers are change history. They do not make the cited file governing.

## Supersession

Revision 19 supersedes all prior revisions, including Revision 18. An earlier seven-chain proposal prepared on 2026-10-25, which also carried the number 19 in draft, was never adopted and is superseded by operator order t427u. (Changed in Revision 19, source: operator t427u, 2026-10-26.)

## Change history

| Edition | Date | Change | Source | Where in this edition |
|---|---|---|---|---|
| Revision 19 | 2026-10-27 | New governing edition. Full copy of Revision 18 with these changes only: VF-COM-009 standard minimum $0.01 with the 5.00% fee unchanged and Appendix E item E-8 resolved; S1 is Base USDC and Base USDT, S2 is native ETH on Base, S3 is every other approved Base asset, and the Ethereum-only S1 and S2 identities are removed; the symbol-only price lookup step is removed; Appendix C and the registry counts are the Base registry candidate (2893 approved Base entries: 1 S1, 1 S2, 2891 S3; BAR, ACM and ASR on Base excluded); registry Revision C is described as a historical record; Axelar ITS is removed from this launch and VCLM, CHONX and SYNTH are ordinary Base-native tokens. Under operator t430u: Appendix C is the Base subset of registry Revision D (2893 entries); registry admission has no liquidity-pool minimum (VF-REG-013); TigerOG is approved by founder override (VF-REG-012); TEL row 1082 is the upgraded TEL contract on Base; the existing $0.95 USDC/USDT rule is stated by exact identity (VF-ORC-015). Under operator t448u: Appendix C is the Base subset of registry Revision E (2893 entries: 1 S1, 1 S2, 2891 S3), every technically compatible Base token with no liquidity, volume, market-cap or freshness threshold (VF-REG-013, VF-REG-014); a token without a usable price is pending, not excluded; row 454 USDC is S1 and row 1086 bridged USDT is S3; scheduled prices have 30 decimals (VF-ORC-016); the Appendix C table is kept in a CSV file. Economics, the sixteen durations, staking, token supply and Base principal release are unchanged. | Operators t427u, t430u and t448u, 2026-10-26; adoption: operator t468u, 2026-10-27; operator orders t169u, t419u and t422u; decisions D-64 and D-77 | Header, Supersession, Sections 1.2, 5.3 (VF-COM-009), 6, 6.1 (VF-REG-001 to VF-REG-004, VF-REG-009, VF-REG-010), 6.2, 6.3 (VF-REG-011), 7.1, 11.1, 11.4, 11.4.1, 13.4, 15.1, 18, 19, Appendix A.2, A.5, B.4, C, D, E (E-4, E-8, E-9, E-10); new VF-REG-012, VF-REG-013, VF-REG-014, VF-ORC-015 and VF-ORC-016 |
| Revision 19 (amended t855u) | 2026-10-30 | Adds VF-REG-015: Shiba Inu (SHIB) developer override for Commitment Vault Lock on any chain where SHIB is listed in the registry; supersedes normal registry filters for SHIB only. Further named tokens may receive the same treatment by later operator decision. No economics change. No deploy or signing authorized. | Operator t855u, 2026-10-30 | Section 6.3 (VF-REG-015); Appendix C introduction |
| Revision 18 | 2026-10-24 | New governing edition. Full copy of Revision 17 with these changes only: S1 at 1.5x names Ethereum USDC, Ethereum USDT, Base USDC, Base USDT, and PYUSD; S1 and S2 identities are defined by registry identity, not by Appendix C listing; Base ETH (row 2 under Base) is stated as S2; Base USDC and Base USDT are S1 rather than alternate-chain S3; the Section 7.1.1 override row for an Ethereum token not in this release is removed; Sections 3.1 and 11.1 (Cosmos line) use Base-only wording; VF-REG-010 note added; Appendix C lists the 27 Base rows of registry Revision C (row 454 USDC_BASE is S1; S3 26 to 25). Revision B is not changed and stays pinned. Revision 18 supersedes all prior revisions. | Operator t361u, 2026-10-24 | Header, Supersession, Sections 3.1, 6, 6.1 (VF-REG-002, VF-REG-003, VF-REG-004, VF-REG-005, VF-REG-010), 6.2, 6.3, 7.1.1 (VF-ORC-006), 11.1, Appendix A.2, Appendix B.4, Appendix C, Appendix D, Appendix E (E-9) |
| Revision 17 | 2026-10-24 | New governing edition. Full copy of Revision 16 with these changes only: Appendix C now lists the 27 Base rows of Revision B in place of the 998-row Revision 6 table; the registry count statements describe that list; Section 11.1 counts this release's list; the VF-FIN-001 sentence on environments that cannot meet the bar is deleted. Revision B is not changed. Revision 17 supersedes all prior revisions. | Operator t358u/t359u, 2026-10-24 | Header, Supersession, Sections 1.2, 6, 6.1 (VF-REG-001, VF-REG-004), 6.3 (VF-REG-011), 11.1, 11.5.2 (VF-FIN-001), 15.1, Appendix C, Appendix D, Appendix E (E-9) |
| Revision 16 | 2026-10-24 | New governing edition. Full copy of Revision 15 with only the launch scope wording changed: this launch mints on Base and locks on Base; every environment must still meet the reader finality bar in Section 11.5, and that requirement is unchanged, but this release ships Base only. Revision 16 supersedes all prior revisions. | Founder directive t357u, 2026-10-24 | Header, Supersession, Document status, Sections 11.1, 11.5.2 (VF-FIN-001), 18, 19, Appendix D |
| Revision 15 | 2026-10-24 | New governing edition. Full copy of Revision 14 with changes applied. Revision 15 supersedes all prior revisions. Rules that Revision 14 held by reference to Revisions 6, 12 and 13 (precedence, Handshake, Axelar ITS timing) are written out in this file. The precedence statement is replaced by the Supersession section. | Operator directive t350u, 2026-10-24 | Header, Supersession, Sections 0.4, 5.2, 5.3, 11.4.1, Appendix D |
| Revision 15 | 2026-10-24 | Reader finality and proof requirements: purpose, per-environment finality bar, mandatory tests. Every environment must meet the bar; the protocol is not launchable until every environment meets the bar. The Revision 14 reader finality paragraph is replaced. This specification records no status; Appendix E item E-11 (per-environment classification) is withdrawn. | Operator Revision 15 text t349u, 2026-10-24 | Document status, Sections 11.1, 11.5, 19, Appendix D, Appendix E |
| Revision 15 | 2026-10-24 | Revision control rule: one live governing specification, prior revisions archived, hash per revision in the authority file, session start references only the live revision. | Operator Revision 15 text t349u, 2026-10-24 | Section 0.4, Appendix D |
| Revision 15 | 2026-10-24 | Handshake wording: retired figures and retired allowance wording removed from the text; the rule (1 hour, uniform 5.00% fee, $0.01 to $0.02 band with the native coin-unit bands, no allowance limit) is unchanged. | Operator session-start rule 2026-10-24 (t344u) | Sections 5.2, 5.3, 8.2, 11.3, 16, 18, Appendix B, Appendix D, Appendix E |
| Revision 15 | 2026-10-24 | Registry counts updated to match the 998-row Appendix C after the 2026-10-18 exclusion: total 1,001 to 998 (Sections 1.2, 6, 6.3, 15.1, Appendix C introduction; VF-REG-001, VF-REG-011); S3 994 to 991 (Section 6.1 table, VF-REG-004); Base 33 to 30 (Section 11.1); VF-ORC-006 four overrides to one; Section 6.3 notes removed rows 138, 999 and 1000. S1 (2), S2 (5) and every other environment count are unchanged. | Operator directive t352u, 2026-10-24; operator exclusion of 2026-10-18 | Sections 1.2, 6, 6.1, 6.3, 7.1.1 (VF-ORC-006), 11.1, 15.1, Appendix C |
| Revision 15 | 2026-10-24 | The Section 7.1.1 override table and the Appendix C registry table are written out as text in this file. The three rows for the community tokens excluded by the operator on 2026-10-18 were removed from each table to match that exclusion: Section 7.1.1 keeps 1 of 4 rows; Appendix C keeps 998 of 1,001 rows. No other entry is changed. | Operator directive t352u, 2026-10-24; operator exclusion of 2026-10-18 | Section 7.1.1, Appendix C |
| Revision 15 | 2026-10-24 | Appendix B.3 120-day staking-duration multiplier corrected to 2.1x to match Section 10.1 and Appendix A.3 (Revision 14 left 2.0x in B.3). | docs/TRS_CORRECTION_2026-10-17.md | Appendix B.3 |
| Revision 14 | 2026-10-24 | New governing edition. Full Revision 6 text carried forward. Header block, precedence statement, change history and Appendix E added. VF-DOC-005 allows the revision designation in the header block. The Section 7.1.1 and Appendix C tables are referenced in the archived Revision 6 file, not reproduced. | Operator document-control directive, 2026-10-24, recorded in VINCULUM_SESSION_START.md Revision 3 | Header, Section 0.2, Appendix D, Appendix E |
| Revision 14 | 2026-10-24 | Records the Cosmos drop. The supported set becomes the 16 environments in Section 11.1. VF-XCH-002 requires a later specification decision to remove an environment; this edition is that record. | Operator decisions t228u and t251u, 2026-10-20: src/tests/cosmos-removed.test.js:1; archive/specifications/session-start/VINCULUM_SESSION_START_Revision_2_2026-10-20.md ("Cosmos is dropped. It is not an environment, not a registry row in use, and not in the app.") | Document status, Sections 3.1, 5.2.3, 6, 8 (VF-FEE-004), 11, 11.1, 11.2, 15.1, 18, 19 |
| Revision 14 | 2026-10-24 | Non-Base reader finality is a launch blocker. All 16 environments need a required Base reader; readers may not be disabled. (Replaced in Revision 15 by Section 11.5.) | Operator directive 2026-10-24, recorded in VINCULUM_SESSION_START.md Revision 3 | Document status, Section 11.1, Section 19 |
| Revision 14 | 2026-10-24 | 120-day Treasury Reward Stake multiplier 2.1x (was 2.0x); other staking durations rejected. | Operator authorization 2026-10-17: docs/TRS_CORRECTION_2026-10-17.md | Section 10.1, Section 18, Appendix A.3 |
| Revision 13 | 2026-10-22 | Axelar ITS is not a launch or activation prerequisite; connected after launch under a required pattern. | docs/Vinculum_Finalis_Master_Specification_Revision_13_2026-10-22.md | Section 11.4.1, VF-DEP-001, Section 15.1, Section 19 |
| Revision 12 | 2026-10-16 | Handshake: 5% fee; no allowance limit; Handshake identity removed; 1 hour kept; $0.01 to $0.02 in the current deployment. | docs/Vinculum_Finalis_Master_Specification_Revision_12_2026-10-16.md; native coin-unit bands from archive/specifications/session-start/VINCULUM_SESSION_START_Revision_2_2026-10-20.md | Sections 5, 5.2, 5.2.1, 5.2.2, 5.3, 11.3, 16, 18, 19, Appendix B |
| Revisions 7 to 11 | 2026-10-03 to 2026-10-08 | Not adopted. Listed in Appendix E. | See Appendix E | Appendix E |
| Revision 6 | 2026-07-28 | Base text of Revision 14. | archive/specifications/master-specification/Vinculum_Finalis_Master_Specification_Revision_6_2026-07-28.docx | Whole document |

---

VINCULUM FINALIS

MASTER SPECIFICATION

Revision 19  |  27 October 2026

| DOCUMENT STATUS Current governing edition. Revision 19, 27 October 2026. It supersedes all prior revisions, including Revision 18. This document defines requirements only. It does not record implementation status, test results, or environment-by-environment progress; those are in the findings register (testing-rigs/MASTER_FINDINGS.md) and the gap report. The launch scope is Base only: this release mints on Base and locks on Base. (Changed in Revision 16, source: founder directive t357u, 2026-10-24.) (Scope wording corrected in draft 6, 2026-10-27.) Items not settled are listed in Appendix E and are not part of the governing text. No AI, implementer, auditor, or contributor may interpret an unresolved or omitted implementation detail as authorization to invent behavior. (Added in Revision 15, source: operator Revision 15 text t349u, 2026-10-24.) |
|---|

The complete plain-language expression of what the protocol is, what it permits, and what every implementation must preserve.

### Independent Review Record

The Claude and Grok/Team entries below concern an earlier specification file. Their directed corrections were incorporated before this current file. This current file additionally incorporates the owner-approved Handshake, fee-treatment, canonical-release-public-key, and objective pending-attempt rules. This is a document-preparation statement, not an independent approval of the current file. No independent review is recorded for this exact current file at creation. A later review must identify the exact file reviewed in a separate evidence record. Review is quality evidence; it is not authority to alter this specification.

| Reviewer | Review date | Conclusion | Findings record |
|---|---|---|---|
| ChatGPT | Not applicable | Document preparation; not independent review | Prepared the current file. No independent review conclusion is recorded. |
| Claude | 27 July 2026 | Approved subject to two findings | Identified a historical registry-file provenance issue and the one-hour Trust-Building Handshake classification gap. The current semantic registry rule supersedes the former. |
| Grok/Team | 27 July 2026 | Concurred after Claude's review | Concurred with both findings after reading Claude's analysis; the findings were not independently discovered. |

## Table of Contents

0. Authority, Interpretation, and Revision Philosophy

1. Protocol Identity and Purpose

2. Immutable Control Model

3. System Architecture and End-to-End Flow

4. Token System: VCLM, CHONX, and SYNTH

5. Commitment Vault Locks

6. Approved Asset Registry and Asset Classification

7. Price Reference Process

8. Fee Collection and Original-Form Routing

9. Reward-Accounting Credit and Epoch Reward Basis

10. Treasury Reward Stake

11. Cross-Chain and Native-Lock Architecture

12. Commitment Vault Principal Safety, Maturity, and Release

13. Supply Accounting and Activation Gates

14. Security Invariants and Fail-Closed Behavior

15. Deployment, Immutability, and Configuration Finalization

16. Verification, Testing, and Specification Traceability

17. Machine-Readable, Transfer, and Market Representations

18. Explicitly Superseded Concepts

19. Required Architecture Deliverables and Deferred External Inputs

Appendix A. Consolidated Formulas and Schedules

Appendix B. Canonical Terminology

Appendix C. Complete Approved Asset Registry

Appendix D. Revision Control

Appendix E. Not adopted / pending

## 0. Authority, Interpretation, and Revision Philosophy

| CONTROLLING PRINCIPLE This specification defines the required behavior of Vinculum Finalis. Implementations, tests, websites, diagrams, deployment packages, and AI explanations are correct only when they conform to it. |
|---|

### 0.1 The specification governs intended behavior

Vinculum Finalis exists first as a settled system of rules. Code and tests demonstrate implementation behavior; they do not create protocol intent. Historical documents remain useful evidence of prior work but cannot restore behavior superseded by the current specification.

- VF-DOC-001: The current Master Specification is the sole governing expression of intended protocol behavior.
- VF-DOC-002: Code, tests, deployment scripts, websites, and historical artifacts must conform to the specification; their existence does not alter it.
- VF-DOC-003: A conversation, AI answer, issue, code comment, or prior document does not change protocol behavior unless the change is incorporated into a later Master Specification revision.
- VF-DOC-004: When the specification is silent or ambiguous, the matter must be identified rather than resolved through an unstated conventional assumption.

### 0.2 Revision discipline

Each current revision is read as a complete document. Prior revisions are historical records, not alternate authorities. Substantive changes require deliberate incorporation into a later revision with an explanation in Revision Control.

- VF-DOC-005: The revision designation appears in the header block of this document and in Appendix D, Revision Control. (changed by operator decision 2026-10-24 (document control), incorporated in Revision 14, source: DOCUMENT_REGISTER.md.)
- VF-DOC-006: A later revision completely supersedes earlier revisions as the operational statement of intent.
- VF-DOC-007: Every material mechanism must state its trigger, inputs, outputs, success conditions, rejection conditions, relationships, and permissible authority.

### 0.3 Independent review

Independent AI or human review can expose contradictions, omissions, and implementation risks. It is evidence of review quality, not a source of protocol authority.

- VF-DOC-008: A recorded independent review identifies the exact reviewed file, review date, conclusion, and findings.
- VF-DOC-009: No AI reviewer may approve, amend, complete, or reinterpret protocol behavior through agreement with another reviewer.
- VF-DOC-010: Independent implementations derived only from this specification must be functionally equivalent in every defined circumstance.

### 0.4 Revision control

(Added in Revision 15, source: operator Revision 15 text t349u, 2026-10-24.)

There is one live governing specification. All prior revisions are moved to an archive folder. Each revision has its own hash recorded in the authority file. The session start document references only the live revision by number and hash. When a new revision is created, the prior live file is archived and the authority file is updated in the same commit.

- VF-DOC-011: Each revision is a full copy of the previous revision with its changes applied. A rule binds only when its text is in the live revision. No rule is inherited from a prior revision by reference or by silence. (Changed in Revision 15, source: operator directive t350u, 2026-10-24.)
- VF-DOC-012: The authority file is DOCUMENT_REGISTER.md. The archive folder is archive/specifications/. (Changed in Revision 15, source: operator directive t350u, 2026-10-24.)

## 1. Protocol Identity and Purpose

Vinculum Finalis is a permanently immutable, multi-chain commitment protocol. A user may create a Commitment Vault Lock using an approved asset on its supported source blockchain and receive a calculated quantity of VCLM or, after activation, CHONX on Base. The source asset remains on its original blockchain for the entire Commitment Vault Lock.

### 1.1 Intended outcomes

- Connect many separate asset communities through one commitment system.
- Allow users to retain their original assets rather than trade, wrap, or bridge them as part of the Commitment Vault Lock.
- Recognize measurable time commitment through fixed issuance schedules.
- Create a phased three-token economy in which VCLM precedes CHONX and SYNTH is forged from both.
- Create fee-indexed VCLM rewards through deterministic Reward-Accounting Credits and Treasury Reward Stake Weight.
- Eliminate post-deployment governance, upgrades, discretionary parameter changes, and value redirection.

### 1.2 Broad participation without asset disparagement

The 2893-entry registry in Appendix C allows many communities to participate. (Changed in Revision 17, source: operator t358u/t359u, 2026-10-24.) (Changed in the Base-only replacement, source: operators t427u, t430u, t438u and t448u, 2026-10-26; registry data from registry Revision E, base-contracts/deployment/assetRegistry.revE.json.) The higher S1 and S2 issuance multipliers recognize defined operational advantages: stable-denominated value, clearer valuation, mature infrastructure, simpler accounting and handling, and reduced operational risk under immutable rules. S3 remains a complete standard participation path. The classifications do not imply that S3 assets or their communities are weaker, inferior, or less legitimate.

## 2. Immutable Control Model

Vinculum Finalis is deployed once and then operates only through fixed rules. The absence of continuing control is a defining architectural choice rather than an incomplete governance design.

- VF-IMM-001: After deployment there is no governance, proposal system, voting system, council, administrator, owner role, upgrade authority, proxy administrator, pause authority, emergency role, rescue role, or discretionary parameter-setting authority.
- VF-IMM-002: No person, multisignature wallet, organization, AI agent, or implementer may alter protocol economics or redirect protocol-controlled value after finalization.
- VF-IMM-003: Every permissible post-deployment movement of value must arise from fixed and explicit deployed logic.
- VF-IMM-004: No temporary control may remain after finalization on the theory that it will be removed later.
- VF-IMM-005: Failure of an external dependency must prevent unsafe new issuance without preventing release of matured Commitment Vault principal.
- VF-IMM-006: The inability to repair a deployed defect is an accepted consequence of eliminating post-deployment control.

## 3. System Architecture and End-to-End Flow

### 3.1 Base and supported source environments

Base is the canonical issuance and accounting blockchain for VCLM, CHONX, and SYNTH. The supported environment set is the 16 blockchain environments listed in Section 11.1, and each must meet the reader finality bar in Section 11.5. This release mints on Base and locks on Base, and every approved asset for this release is a Base entry in Appendix C. (Changed in Revision 18, source: operator t361u, 2026-10-24.) (changed by operator decisions t228u and t251u, 2026-10-20, Cosmos dropped, incorporated in Revision 14, source: src/tests/cosmos-removed.test.js:1 and archive/specifications/session-start/VINCULUM_SESSION_START_Revision_2_2026-10-20.md.) Source principal does not move to Base. Verified information about a completed Commitment Vault Lock authorizes the corresponding Base-chain issuance.

### 3.2 End-to-end Commitment Vault Lock flow

1. The user selects an approved source asset, a nonzero amount, a permitted duration, one currently available output token, and one valid Base-chain recipient.
1. Before assets move, the source application performs every available registry, amount, price-reference, output-availability, fee, and recipient preflight check.
1. The source mechanism transfers the actual rounded fee to the fixed Dev Fund destination in the original asset and places the remaining principal into the source-chain Commitment Vault Lock.
1. The Commitment Vault Lock reaches the deterministic finality condition required for that source environment.
1. A normalized proof or attestation binds the completed source event and all data required by Section 11.
1. The Base verification layer validates source finality, registry identity, fee routing, price record, output eligibility, lifetime capacity, recipient binding, and replay protection.
1. After successful verification, the complete calculated quantity of exactly one selected output token - VCLM or activated CHONX - is issued to the bound Base-chain recipient. The same Commitment Vault Lock never produces both.
1. At maturity, the user who created the Commitment Vault Lock may reclaim the remaining source-chain principal independently of Base issuance or any external service.

### 3.3 Separation of mechanisms

| Mechanism | Accepted assets | Purpose | Renewable |
|---|---|---|---|
| Commitment Vault Lock | Approved external assets | Issue VCLM or activated CHONX | No |
| Treasury Reward Stake | VCLM, CHONX, SYNTH | Earn a proportional share of VCLM rewards | Manual future terms may be queued |
| SYNTH Forge | VCLM and CHONX | Burn both inputs to forge SYNTH | Not applicable |

- VF-ARC-001: Base is the canonical issuance and accounting blockchain for all three protocol tokens.
- VF-ARC-002: Commitment Vault principal remains on its supported source blockchain.
- VF-ARC-003: One Commitment Vault Lock authorizes no more than one selected protocol-token output.
- VF-ARC-004: A known-invalid Commitment Vault Lock request must be rejected before fee or principal assets move whenever the source environment can determine the invalidity.
- VF-ARC-005: Proof submission or retry cannot change the source event, output token, recipient, valuation, duration, or maturity.
- VF-ARC-006: The Base-chain recipient may differ from the source-chain wallet, but it must be a valid nonzero address authorized by the source user and bound when the Commitment Vault Lock is created.

## 4. Token System: VCLM, CHONX, and SYNTH

| Token | Lifetime hard cap | Availability | Authorized creation |
|---|---|---|---|
| VCLM | 10,000,000,000 | Protocol launch | Verified Commitment Vault Locks and Treasury Reward Stake rewards |
| CHONX | 100,000,000,000 | After 10,000,000 cumulative lifetime VCLM issuance | Verified Commitment Vault Locks after activation |
| SYNTH | 10,000,000 | After 100,000,000 cumulative lifetime CHONX issuance | Forge by burning 1,000 VCLM and 10,000 CHONX for each SYNTH |

### 4.1 Token roles and creation

VCLM is available from launch and is the sole Treasury Reward Stake reward currency. CHONX is a separate Commitment Vault Lock output that becomes available only after its VCLM activation threshold. SYNTH is never a Commitment Vault Lock output and is forged only through the one-way destruction of both lower-tier protocol tokens.

- VF-TOK-001: VCLM, CHONX, and SYNTH each use 18 decimal places.
- VF-TOK-002: CHONX activation is permanent when cumulative lifetime VCLM issuance reaches 10,000,000.
- VF-TOK-003: SYNTH activation is permanent when cumulative lifetime CHONX issuance reaches 100,000,000.
- VF-TOK-004: Forging one SYNTH permanently destroys exactly 1,000 VCLM and 10,000 CHONX.
- VF-TOK-005: The SYNTH Forge is one-way and has no reversal, redemption, or administrative restoration path.
- VF-TOK-006: SYNTH is never issued from a Commitment Vault Lock.
- VF-TOK-007: VCLM, CHONX, and SYNTH are prohibited Commitment Vault Lock inputs.

### 4.2 Issuance references and discrete decay

| Output | Protocol reference | Initial rate | 30-day decay | Permanent floor |
|---|---|---|---|---|
| VCLM | $0.10 | 10 VCLM per $1.00 | 1.667% compounded | 1 VCLM per $1.00 |
| CHONX | $0.01 | 100 CHONX per $1.00 | 1.667% compounded | 10 CHONX per $1.00 |

Current rate = max(initial rate x (1 - 0.01667)^n, permanent floor)

For VCLM, n is the number of complete 30-day periods elapsed since protocol launch. For CHONX, n is the number of complete 30-day periods elapsed since CHONX activation. The clocks are independent. A partially completed 30-day period does not advance either schedule.

- VF-TOK-008: VCLM decay begins at protocol launch; CHONX decay begins at CHONX activation.
- VF-TOK-009: Each decay schedule advances only after a complete fixed 30-day period.
- VF-TOK-010: Decay arithmetic rounds down at each 30-day calculation step.
- VF-TOK-011: Asset and Commitment Vault Lock duration multipliers apply after the applicable time-dependent emission rate and do not alter the decay schedule.
- VF-TOK-012: Protocol reference values are issuance references, not exchange prices, redemption promises, or guarantees of market value.

### 4.3 Transferability and external markets

VCLM, CHONX, and SYNTH are transferable. Users may establish external liquidity venues where technically and legally available. It is a goal of Vinculum Finalis to pursue and obtain centralized and decentralized exchange listings as resources, eligibility, and opportunity permit.

- VF-TOK-013: The protocol imposes no transfer tax, allowlist, denylist, administrator freeze, or protocol-level trading restriction on VCLM, CHONX, or SYNTH.
- VF-TOK-014: An external market or liquidity venue does not alter issuance, supply, reward, activation, or Commitment Vault Lock rules.
- VF-TOK-015: No exchange listing, liquidity level, market price, redemption value, or appreciation is guaranteed.

## 5. Commitment Vault Locks

A Commitment Vault Lock is a single, non-renewable source-chain timelock of an approved external asset. It charges the applicable fee, isolates the remaining principal until maturity, and authorizes exactly one VCLM or activated CHONX output after successful Base verification.

### 5.1 Permitted durations and multipliers

| Duration | Role | Duration multiplier |
|---|---|---|
| 1 hour | Trust-Building Handshake | 1.0x |
| 7 days | Shortest standard Commitment Vault Lock | 1.0x |
| 30 days | Short Commitment Vault Lock | 1.15x |
| 60 days | Short-to-medium Commitment Vault Lock | 1.3x |
| 90 days | Medium Commitment Vault Lock | 1.5x |
| 180 days | Six-month Commitment Vault Lock | 2.0x |
| 365 days | One-year Commitment Vault Lock | 2.5x |
| 730 days | Two-year Commitment Vault Lock | 3.8x |
| 1,095 days | Three-year Commitment Vault Lock | 5.0x |
| 1,460 days | Four-year Commitment Vault Lock | 5.75x |
| 1,825 days | Five-year Commitment Vault Lock | 6.5x |
| 2,190 days | Six-year Commitment Vault Lock | 6.8x |
| 2,555 days | Seven-year Commitment Vault Lock | 7.1x |
| 2,920 days | Eight-year Commitment Vault Lock | 7.4x |
| 3,285 days | Nine-year Commitment Vault Lock | 7.7x |
| 3,650 days | Ten-year Commitment Vault Lock | 8.0x |

- VF-COM-001: Only the durations and multipliers in Section 5.1 are permitted.
- VF-COM-002: No intermediate duration or interpolated multiplier is permitted.

### 5.2 Trust-Building Handshake

The Trust-Building Handshake allows a user to experience the complete Commitment Vault Lock lifecycle using a gross value within the band in VF-COM-003. It keeps its own one-hour duration. There is no allowance limit: a wallet may create any number of one-hour Handshakes. (Changed in Revision 12, source: docs/Vinculum_Finalis_Master_Specification_Revision_12_2026-10-16.md.)

- VF-COM-003: A qualifying Trust-Building Handshake is a one-hour Commitment Vault Lock with Verified Gross USD Value from $0.01 through $0.02 inclusive. Bitcoin, Bitcoin Cash and Litecoin native Handshakes use a coin-unit band instead: Bitcoin and Bitcoin Cash 11,000 to 22,000 sats; Litecoin 110,000 to 220,000 litoshis. Their value for VCLM and Reward-Accounting Credit is capped at $0.02. The $0.01 and $0.02 bounds are deployment constants of the current deployment. (Changed in Revision 12, source: docs/Vinculum_Finalis_Master_Specification_Revision_12_2026-10-16.md; coin-unit bands and the $0.02 cap: archive/specifications/session-start/VINCULUM_SESSION_START_Revision_2_2026-10-20.md.)
- VF-COM-004: Each successful qualifying Trust-Building Handshake charges a 5.00% fee, the same uniform rate used for every other duration and on every supported environment. (Changed in Revision 12, source: docs/Vinculum_Finalis_Master_Specification_Revision_12_2026-10-16.md.) (Changed in Revision 15, source: operator directive t350u, 2026-10-24.)
- VF-COM-005: Removed. No Handshake identity is bound, and the lock contract takes no Handshake identity parameter. Person-level identification, wallet clustering, cross-address association, detection of common control, and anti-Sybil enforcement are neither required nor permitted. (Changed in Revision 12, source: docs/Vinculum_Finalis_Master_Specification_Revision_12_2026-10-16.md.)
- VF-COM-006: Removed. There is no allowance limit. A wallet may create any number of one-hour Handshakes. (Changed in Revision 12, source: docs/Vinculum_Finalis_Master_Specification_Revision_12_2026-10-16.md.)
- VF-COM-007: Removed. (Changed in Revision 12, source: docs/Vinculum_Finalis_Master_Specification_Revision_12_2026-10-16.md.)
- VF-COM-008: Removed. (Changed in Revision 12, source: docs/Vinculum_Finalis_Master_Specification_Revision_12_2026-10-16.md.)
- VF-COM-026: A one-hour Commitment Vault Lock that does not satisfy the qualifying value range in VF-COM-003 is rejected. The one-hour duration is available only through a qualifying Trust-Building Handshake. An arbitrary or out-of-protocol source transaction does not become a Commitment Vault Lock and creates no issuance right or Reward-Accounting Credit merely because it moves or timelocks assets. (Changed in Revision 12, source: docs/Vinculum_Finalis_Master_Specification_Revision_12_2026-10-16.md.)

#### 5.2.1 Chain-equivalent qualification and enforcement

Preflight qualification may be placed at the source, in a cryptographic authorization required by the source mechanism, in the proof-verification path, or across a chain-native combination, provided the resulting User-protection and security outcome are demonstrated. An invalidity determinable only through the proof-verification path is rejected before the event becomes a recognized Commitment Vault Lock and authorizes no issuance and no Reward-Accounting Credit. (Changed in Revision 12, source: docs/Vinculum_Finalis_Master_Specification_Revision_12_2026-10-16.md.)

#### 5.2.2 Prevention by the official application

The non-refundable fee rule is a fail-safe for an exceptional or independently constructed transaction, not an acceptable ordinary User experience. Before constructing, signing, or broadcasting a source transaction, the official application must perform every technically available check, including an objectively pending attempt; a recognized attempt awaiting finality; duplicate submission; the approved asset; the qualifying value range; fee and principal calculations; output-token availability; and recipient and release-destination binding. The interface must clearly warn that an independently constructed or broadcast source transaction can move or timelock assets without creating Vinculum rights and that any fee actually transferred to the Dev Fund is non-refundable. (Changed in Revision 12, source: docs/Vinculum_Finalis_Master_Specification_Revision_12_2026-10-16.md.)

#### 5.2.3 Objective pending-attempt disposition

(Carried forward unchanged. How this section applies after the Revision 12 Handshake change is pending; see Appendix E, item E-7.)

Elapsed time, mempool disappearance, failure to appear within an estimated or finality window, and application-local abandonment timers are not proof that a source transaction can no longer become recognized. A pending Handshake attempt clears only when objective chain-native evidence establishes a terminal source-chain disposition or that the transaction can no longer validly become the recognized transaction: a consumed account nonce; a consumed input by a finalized conflicting transaction; a genuine chain-native expiry rule where the chain provides one; or a finite validity bound that passes. A still-valid, rebroadcastable UTXO transaction remains pending and is not cleared by time, mempool eviction, or non-observation. Before authorizing another official submission, the application must recheck objective source-chain disposition and Base recognition state.

Mechanism-specific objective invalidation is: finalized same-nonce replacement or cancellation on EVM; recent-blockhash expiry or finalized durable-nonce advancement on Solana; a finalized conflicting input spend on a UTXO-family chain, with no invented automatic cancellation; finite LastLedgerSequence passage on XRP Ledger; and finite time-bound passage or finalized source-account sequence consumption on Stellar. Cosmos Hub criteria are not required because Cosmos is dropped (changed by operator decisions t228u and t251u, 2026-10-20, Cosmos dropped, incorporated in Revision 14, source: src/tests/cosmos-removed.test.js:1 and archive/specifications/session-start/VINCULUM_SESSION_START_Revision_2_2026-10-20.md). A transaction with no terminal disposition and no objective invalidation remains pending.

### 5.3 Standard minimum, fee, and rounding

- VF-COM-009: Every Commitment Vault Lock from 7 days through 3,650 days requires at least $0.01 Verified Gross USD Value and charges a 5.00% fee. (Changed in the Base-only replacement, source: operator orders t169u, t419u and t422u; D-77.)
- VF-COM-010: An actual zero asset amount is invalid for every duration.
- VF-COM-011: Fee asset units equal floor(gross asset units x applicable fee basis points / 10,000).
- VF-COM-012: Commitment principal units equal gross asset units minus actual rounded fee units.
- VF-COM-013: The request is rejected before assets move if rounding produces a zero fee or zero principal.
- VF-COM-014: If an asset's decimal precision cannot represent a qualifying Trust-Building Handshake with both nonzero fee and nonzero principal, that asset cannot use the Handshake but remains eligible for longer qualifying Commitment Vault Locks.
- VF-COM-015: A fee actually and irreversibly transferred to the fixed Dev Fund destination is permanently non-refundable, even if the source transaction is later rejected as unrecognized. That rejection creates no recognized Commitment Vault Lock, issuance, Reward-Accounting Credit, or other Vinculum rights; any principal timelocked by the transaction remains deterministically releasable to its bound destination at maturity. (Changed in Revision 12, source: docs/Vinculum_Finalis_Master_Specification_Revision_12_2026-10-16.md.)
- VF-COM-016: There is no early release, cancellation, penalty exit, administrative release, or emergency release for Commitment Vault principal.

### 5.4 Issuance basis, calculation order, and output

Output = Verified Gross USD Value x current emission rate x asset multiplier x Commitment Vault Lock duration multiplier

The complete gross USD value is recognized for protocol-token issuance. The fee is paid separately and does not reduce the issuance basis. All issuance calculations use 18-decimal fixed-point arithmetic and convert to the output token's smallest units only after applying the factors in the required order.

- VF-COM-017: Commitment Vault issuance begins with the full Verified Gross USD Value before subtracting the fee.
- VF-COM-018: The required calculation order is Verified Gross USD Value, time-dependent emission rate, asset multiplier, Commitment Vault Lock duration multiplier, then smallest protocol-token units.
- VF-COM-019: Every integer division rounds down; factors may not be reordered or rounded to the nearest unit.
- VF-COM-020: A Commitment Vault Lock creates exactly one selected output token: VCLM or activated CHONX.
- VF-COM-021: The complete calculated output is issued to the Base-chain recipient bound to the source Commitment Vault Lock.
- VF-COM-022: The asset classification and acquisition history do not attach to fungible VCLM or CHONX after issuance.
- VF-COM-023: A Commitment Vault Lock is not renewable. After maturity the user may reclaim principal and create a separate new Commitment Vault Lock.
- VF-COM-024: Removed. (Changed in Revision 12, source: docs/Vinculum_Finalis_Master_Specification_Revision_12_2026-10-16.md.)
- VF-COM-025: CHONX must already be activated at the original Commitment Vault Lock creation time to be selected as its output; later activation cannot validate an earlier ineligible selection.

## 6. Approved Asset Registry and Asset Classification

The Approved Asset Registry in Appendix C contains exactly 2893 entries, all on Base. (Changed in the Base-only replacement, source: operators t427u, t430u, t438u and t448u, 2026-10-26; registry data from registry Revision E, base-contracts/deployment/assetRegistry.revE.json.) The supported set is the 16 environments in Section 11.1 (changed by operator decisions t228u and t251u, 2026-10-20, Cosmos dropped, incorporated in Revision 14, source: src/tests/cosmos-removed.test.js:1 and archive/specifications/session-start/VINCULUM_SESSION_START_Revision_2_2026-10-20.md). The registry written for this release is Revision E (base-contracts/deployment/assetRegistry.revE.json, SHA-256 af8a4fc62af5be7baf50e2fe164e23202de8e03f1f92103d27b490dcfb56e2e6); Appendix C incorporates its Base rows. Revision D (base-contracts/deployment/assetRegistry.revD.json, SHA-256 d8bb58d80d593f4e0e967ee82c239327055adb07cef8809fe48f7b95372903d4) stays pinned and unchanged. (Changed in the Base-only replacement, source: operator t448u, 2026-10-26.) Its rows for other environments are historical records and are not written to the Base Verifier. The registry written for the Revision 18 Base-only release is Revision C (base-contracts/deployment/assetRegistry.revC.json, SHA-256 5c3311eb4f7b59c34e7ccc8a6bd9e817b4f0bb02bdeff65c5cfed98f79cca581), a historical record that is not the governing registry of this release; Revision B (487 rows, SHA-256 1bdcb8346ab95abe5225adcffb9c5c3c7bb40c6cd5f1a851d3ed05bb2d77e2a9) remains pinned and unchanged; see Appendix E, item E-9. (Changed in Revision 18, source: operator t361u, 2026-10-24.) (Changed in the Base-only replacement, source: operator t427u, 2026-10-26.) (Changed in the Base-only replacement, source: operator t430u, 2026-10-26.) Registry membership and exact canonical identity are prerequisites for a Commitment Vault Lock.

### 6.1 Classifications

| Class | Multiplier | Exact definition |
|---|---|---|
| S1 | 1.5x | Base USDC (the USDC contract issued by Circle on Base) and Base USDT (the USDT contract issued by Tether on Base) (Changed in the Base-only replacement, source: operator t427u, 2026-10-26.) |
| S2 | 1.3x | Native ETH on Base (registry row 2 under Base) (Changed in the Base-only replacement, source: operator t427u, 2026-10-26.) |
| S3 | 1.0x | Every other approved Base registry entry, exactly 2891 in Appendix C (Changed in the Base-only replacement, source: operators t427u, t430u, t438u and t448u, 2026-10-26; registry data from registry Revision E, base-contracts/deployment/assetRegistry.revE.json.) |

- VF-REG-001: The registry for this release contains exactly the 2893 entries incorporated in Appendix C. (Changed in Revision 17, source: operator t358u/t359u, 2026-10-24.) (Changed in the Base-only replacement, source: operators t427u, t430u, t438u and t448u, 2026-10-26; registry data from registry Revision E, base-contracts/deployment/assetRegistry.revE.json.)
- VF-REG-002: S1 consists only of these exact canonical identities: Base USDC and Base USDT. Base USDC is the USDC contract issued by Circle on Base; Base USDT is the USDT contract issued by Tether on Base. Each S1 identity is defined by its registry identity (environment and contract identifier), not by whether Appendix C lists it; an S1 identity receives the 1.5x multiplier only when it is an approved registry entry under VF-REG-001. (Changed in Revision 18, source: operator t361u, 2026-10-24.) (Changed in the Base-only replacement, source: operator t427u, 2026-10-26.) In Appendix C, row 454 USDC (0x8335...2913) is the Base USDC identity and is S1. Row 1086 USDT (0xfde4...9bb2) is a bridged USDT on Base, not a USDT contract issued by Tether on Base, so it is S3. No other Appendix C entry is S1, whatever its name or ticker. (Changed in the Base-only replacement, source: operator t448u, 2026-10-26.)
- VF-REG-003: S2 consists only of native ETH on Base at registry row 2 under Base. The S2 identity is defined by its registry identity, not by whether Appendix C lists it; it receives the 1.3x multiplier only when it is an approved registry entry under VF-REG-001. (Changed in Revision 18, source: operator t361u, 2026-10-24.) (Changed in the Base-only replacement, source: operator t427u, 2026-10-26.)
- VF-REG-004: All remaining 2891 entries in Appendix C are S3. (Changed in Revision 18, source: operator t361u, 2026-10-24.) (Changed in the Base-only replacement, source: operators t427u, t430u, t438u and t448u, 2026-10-26; registry data from registry Revision E, base-contracts/deployment/assetRegistry.revE.json.)
- VF-REG-005: Wrapped, bridged, derivative, and alternate-chain forms remain S3 unless they are one of the exact elevated identities named in VF-REG-002 and VF-REG-003. Base USDC and Base USDT are S1 identities and Base ETH is an S2 identity; none of them is an alternate-chain form under this rule. A bridged or third-party USDC or USDT contract on Base, or on any other environment, remains S3. (Changed in Revision 18, source: operator t361u, 2026-10-24.)
- VF-REG-006: S1 and S2 multipliers apply equally when the selected Commitment Vault Lock output is VCLM or activated CHONX.
- VF-REG-007: Asset classification affects initial Commitment Vault issuance only and never alters Treasury Reward Stake Weight.
- VF-REG-008: VCLM, CHONX, and SYNTH are excluded from the Approved Asset Registry as Commitment Vault Lock inputs.
- VF-REG-009: The WETH contract reference stored with the native ETH registry entry (row 2 under Base) is pricing metadata only; S2 applies to native ETH and does not elevate WETH. (Changed in the Base-only replacement, source: operator t427u, 2026-10-26.)
- VF-REG-010: No registry entry may be added, removed, reclassified, or assigned a different canonical identity after deployment finalization. Note: Revision 18 supersedes all prior finalized specification text, including the S1 classification in Revision 17. The registry written for this release is Revision E (Section 6); Revision D stays pinned and unchanged. The registry written for the Revision 18 Base-only release is Revision C, a historical record that is not the governing registry of this release; Revision B (487 rows, SHA-256 1bdcb8346ab95abe5225adcffb9c5c3c7bb40c6cd5f1a851d3ed05bb2d77e2a9) stays pinned and unchanged. (Added in Revision 18, source: operator t361u, 2026-10-24.) (Changed in the Base-only replacement, source: operator t427u, 2026-10-26.) (Changed in the Base-only replacement, source: operator t430u, 2026-10-26.)

### 6.2 Operational rationale

S1 recognizes the accounting simplicity of the selected stablecoins named in VF-REG-002. (Changed in Revision 18, source: operator t361u, 2026-10-24.) S2 recognizes native ETH on Base, whose established infrastructure and handling characteristics reduce valuation and operational complexity for an immutable protocol. (Changed in the Base-only replacement, source: operator t427u, 2026-10-26.) The distinction is operational rather than a judgment about the legitimacy or strength of any S3 asset or community.

### 6.3 Governing registry data

Appendix C is the governing expression of the approved asset registry. It uses the registry Revision E row numbers; those row numbers are registry references rather than market rankings. Entries with a Base row in Revision C keep that row number; rows 1002 to 1103 were assigned in Revision D, and rows 1104 and above in Revision E, to Base entries that had no Base registry row before. Base ETH uses row 2 under Base. Row 1082 TEL is the upgraded TEL contract on Base (0x7E13...0731); the earlier Base TEL contract (0x09bE...aDB1) is not in the registry. This is an asset-contract migration, not a new protocol rule. Row 138 TigerOG, removed from the registry in Revision 15, is an approved Base entry again under VF-REG-012. (Changed in Revision 18, source: operator t361u, 2026-10-24.) (Changed in the Base-only replacement, source: operators t427u, t430u, t438u and t448u, 2026-10-26; registry data from registry Revision E, base-contracts/deployment/assetRegistry.revE.json.) A machine-readable registry is an implementation representation of Appendix C, not a separately governing historical file.

- VF-REG-011: A machine-readable registry conforms when it contains exactly the 2893 Appendix C records with the same registry-row identifiers, symbols, environments, contract or native identifiers, S1/S2/S3 classifications, and pricing identifiers. Filename, whitespace, object-key order, and formatting do not affect conformity. (Changed in Revision 17, source: operator t358u/t359u, 2026-10-24.) (Changed in the Base-only replacement, source: operators t427u, t430u, t438u and t448u, 2026-10-26; registry data from registry Revision E, base-contracts/deployment/assetRegistry.revE.json.)
- VF-REG-012: Registry row 138 TigerOG is an approved Base entry by founder override. No registry screening, liquidity, market, listing or pricing-source restriction removes or blocks it. Its price is looked up under Section 7.1 step 2 by its exact registry contract only. For this row alone, a DexScreener pool for that exact contract on any chain may give the price, not only a pool on Base. When more than one such pool has a USD price, the pool with the highest liquidity gives the price, read from the side of that exact contract. Its price is accepted without any market-activity, trading-volume or trading-recency requirement and without any pool-age requirement. No different lookup contract and no other price source is used for it, so it is not a community-token price-source override under VF-ORC-006. The founder override never creates a price: while no valid price is produced it has no usable valuation under VF-ORC-005. (Changed in the Base-only replacement, source: operators t430u and t436u, 2026-10-26.)
- VF-REG-013: Registry admission has no liquidity-pool minimum. An approved Base entry is valued under the scheduled price rules of Section 7; no liquidity, volume or market-cap screen applies to registry membership. (Changed in the Base-only replacement, source: operator t430u, 2026-10-26.) No freshness or trading-recency threshold applies either. (Changed in the Base-only replacement, source: operator t448u, 2026-10-26.)
- VF-REG-014: Every Base token that is technically compatible with the Base Commitment Vault Lock is an approved Base entry, unless the operator excludes it by name (Appendix C.1). A token is technically compatible when, at one recorded Base block, its contract has code, decimals() returns a value of at most 65 and balanceOf() answers, and a lock and release of the real Base Commitment Vault Lock bytecode on a local copy of Base delivers exactly the amounts sent: the vault and the Dev Fund receive the exact amounts, and release returns the exact principal. A token whose simulation could not be funded on the local copy is admitted on its static checks alone and is marked compatible_static_only. A token that fails any check (transfers restricted, fee on transfer, transferFrom into the vault reverts, approve restricted, release short or overpaid) is not admitted and is listed with its reason (Appendix C.2). Compatibility is decided by these automated tests, not by per-token approval. A token without a usable price is still admitted; it is pending and has no usable valuation until a valid scheduled price exists (VF-ORC-005). (Changed in the Base-only replacement, source: operator t448u, 2026-10-26.)
- VF-REG-015: Shiba Inu (SHIB) is allowed for a Commitment Vault Lock on any chain where it is listed in that chain's Approved Asset Registry. This is an explicit developer override (operator t855u, 2026-10-30). It supersedes normal registry filters for this asset only, including liquidity-pool minimums, lookalike screens, fee-on-transfer or rebasing compatibility refusals, and any other registry exclusion rule that would otherwise keep SHIB out or block a lock. The override covers only genuine Shiba Inu, matched by the exact verified contract on that chain (and by an official CoinGecko coin id such as shiba-inu or binance-peg-shib when used for identity), never by the ticker SHIB alone; lookalike tokens are not covered. It does not change S1/S2/S3 class, price rules (no usable price means no valuation under VF-ORC-005), fee rules, or the refusal of VCLM, CHONX and SYNTH as lock inputs (VF-REG-008). Further tokens receive the same treatment only when the operator names them in his own words. This requirement does not authorize any on-chain change, deploy, broadcast, register, finalize, or signing. (Added by operator decision t855u, 2026-10-30.)


## 7. Price Reference Process

The protocol uses the established Universal Price Fetcher v9 process to obtain an orderly USD reference for Commitment Vault calculations. The reference exists to estimate issuance value; it is not a trading quote, redemption promise, or continuous financial-market valuation.

### 7.1 Twice-daily first-valid-price cascade

| Step | Lookup |
|---|---|
| 1 | CoinGecko batch lookup by configured pricing identifier |
| 2 | DexScreener lookup by contract for unresolved assets. A pool for the asset's own environment is used, except row 138 TigerOG, which may use a pool for its exact contract on any chain (VF-REG-012). (Changed in the Base-only replacement, source: operators t430u and t436u, 2026-10-26.) |
| 3 | Removed. A lookup by symbol alone is never used. (Changed in the Base-only replacement, source: decision D-64 (symbol-only lookup removed); operator t427u, 2026-10-26.) |
| 4 | For designated community-token overrides: DexScreener followed by GeckoTerminal fallback |

#### 7.1.1 Existing community-token price-source overrides

A community-token price-source override preserves the displayed registry identity and is part of the established price-reference process. No community-token price-source override applies to this release. The one override row carried in Revision 17 named an Ethereum token that is not in this release's Appendix C and is removed. (Changed in Revision 18, source: operator t361u, 2026-10-24.)

- VF-ORC-001: The price process runs twice per day.
- VF-ORC-002: For each asset, the first valid price produced by the applicable ordered cascade is accepted and later sources are not consulted for that run.
- VF-ORC-003: The price process does not require two simultaneous sources, a source-spread comparison, a median calculation, a TWAP comparison, or a separate 10-minute freshness test.
- VF-ORC-004: No hardcoded asset price may substitute for a failed lookup.
- VF-ORC-005: If no valid price is produced, the asset has no usable Commitment Vault valuation until a later successful scheduled run.
- VF-ORC-006: No community-token price-source override applies to this release (Section 7.1.1). An implementer may not silently replace a displayed registry contract with a different lookup contract. (Changed in Revision 18, source: operator t361u, 2026-10-24.)

### 7.2 Signed and batched delivery to Base

The selected price, source label, asset identity, and fetch timestamp are carried to Base through the established signed and batched price path. The concrete integration and production signing configuration are architecture and deployment deliverables; they may not silently change the twice-daily first-valid-price rule.

- VF-ORC-007: The Base valuation path accepts only a valid signed and batched price record for the exact approved asset identity.
- VF-ORC-008: A successful scheduled price record remains applicable until the next scheduled run; a scheduled run producing no valid price marks that asset unavailable until a later successful run.
- VF-ORC-009: The reference price applicable when the Commitment Vault Lock is created is retained for that Commitment Vault Lock.
- VF-ORC-010: A proof delay or retry does not reprice the Commitment Vault Lock using a later market observation.
- VF-ORC-011: The Valuation Timestamp is the timestamp of the finalized source-chain block containing the Commitment Vault Lock.
- VF-ORC-012: The same accepted reference price determines Verified Gross USD Value and Verified USD Fee Value for the Commitment Vault Lock.
- VF-ORC-013: The time-dependent emission rate is selected using the Valuation Timestamp.
- VF-ORC-014: Website display updates and signed/batched protocol records may share the same fetcher output, but website presentation cannot alter protocol calculations.
- VF-ORC-015: The $0.95 USDC/USDT rule applies only to the exact stablecoin identities, matched by environment and contract and never by ticker text. On Base these are Base USDC (row 454, 0x8335...2913) and the bridged Base USDT (row 1086, 0xfde4...9bb2). While the last successful scheduled price of such an identity is below $0.95, it has no usable valuation for a new Commitment Vault Lock; exactly $0.95 is allowed. A Commitment Vault Lock already created keeps its creation price (VF-ORC-009). A token that only carries a USDC or USDT ticker is not a stablecoin identity. The rule is the existing implemented threshold and scope, written out here; it is not a new price rule. (Changed in the Base-only replacement, source: operator t430u, 2026-10-26.)
- VF-ORC-016: Every scheduled price is USD per whole token with 30 decimal places (an unsigned 128-bit value). A valuation is floor(gross amount in smallest units x price / 10^(token decimals + 12)), which gives USD with 18 decimals and rounds down once, at the end. A row with more than 65 decimals, or a valuation beyond the range of an unsigned 256-bit value, has no usable valuation and is refused. A price above the largest 128-bit value (about $340 million per whole token) cannot be recorded, so that asset has no usable price. The $0.95 rule of VF-ORC-015 is the same threshold at 30 decimals. This precision keeps very low per-token prices, such as row 138 TigerOG, from rounding to zero. Economics are unchanged. (Changed in the Base-only replacement, source: operator t448u, 2026-10-26.)

## 8. Fee Collection and Original-Form Routing

### 8.1 Uniform routing

The actual rounded fee collected from every S1, S2, or S3 Commitment Vault Lock is transferred to the fixed Dev Fund destination for the source environment in the same asset in which it was collected. The remaining principal is isolated in the Commitment Vault Lock.

- VF-FEE-001: The Dev Fund receives 100% of each actual Commitment Vault fee.
- VF-FEE-002: A fee remains in its original asset; no swapping, conversion, bridging, or division among destinations occurs.
- VF-FEE-003: Commitment Vault principal is never transferred to the Dev Fund.
- VF-FEE-004: Each of the 16 supported environments in Section 11.1 has one fixed and immutable Dev Fund destination. (changed by operator decisions t228u and t251u, 2026-10-20, Cosmos dropped, incorporated in Revision 14, source: src/tests/cosmos-removed.test.js:1 and archive/specifications/session-start/VINCULUM_SESSION_START_Revision_2_2026-10-20.md.)
- VF-FEE-005: Any asset-specific receiving account required by an environment must remain deterministically bound to that environment's fixed Dev Fund destination.
- VF-FEE-006: A user, relayer, implementer, or external message may not substitute another fee destination.

### 8.2 Evidence and deferred addresses

The actual Dev Fund addresses are intentionally not required during specification or prototype design. They will be supplied only after the prototype application has been reviewed and a decision has been made to begin heavy testing.

- VF-FEE-007: A Commitment Vault Lock is not valid for Base issuance unless the proof establishes the exact actual fee and transfer to the configured source-environment Dev Fund destination.
- VF-FEE-008: Fee-routing evidence and principal-lock evidence must both refer to the same completed Commitment Vault Lock.
- VF-FEE-009: Missing, zero, guessed, or substitute Dev Fund addresses cannot complete a deployment package.
- VF-FEE-010: Prototype design must expose required destination configuration fields without requesting or inventing production addresses.
- VF-FEE-011: A fee actually and irreversibly transferred to the configured Dev Fund destination remains permanently non-refundable even if the source transaction is later unrecognized or permanently unable to authorize Base issuance. No discretionary refund mechanism exists. (Changed in Revision 15 to remove a case that no longer exists because the Handshake has no allowance limit; source: VF-COM-006.)
- VF-FEE-012: Fee-routing failure prevents Base issuance and Reward-Accounting Credit but never prevents release of matured Commitment Vault principal.

## 9. Reward-Accounting Credit and Epoch Reward Basis

Each successfully verified Commitment Vault fee creates a one-time numerical Reward-Accounting Credit. The credit is accounting state only: it is not an asset balance, is not deposited into a treasury, cannot be withdrawn, and creates no claim against Dev Fund assets.

Reward-Accounting Credit = Verified USD Fee Value x 60%

Epoch Reward Basis = sum of Reward-Accounting Credits in the epoch

Epoch Reward VCLM = Epoch Reward Basis / $0.10

- VF-RAC-001: Verified USD Fee Value is the accepted USD valuation of the actual rounded fee collected.
- VF-RAC-002: Reward-Accounting Credit equals 60% of Verified USD Fee Value.
- VF-RAC-003: A Reward-Accounting Credit is assigned to the 10-day epoch in which it is successfully recorded on Base.
- VF-RAC-004: Epoch Reward Basis is the sum of all Reward-Accounting Credits assigned to that epoch.
- VF-RAC-005: Epoch Reward VCLM is calculated using the permanent $0.10 Reward Reference Value, not an oracle or market price.
- VF-RAC-006: When the epoch calculation and position allocation are successfully and irreversibly recorded, every included credit becomes a Used Reward-Accounting Credit and can never be included again.
- VF-RAC-007: Reward-Accounting Credit does not transfer, reserve, collateralize, or encumber any Dev Fund asset.
- VF-RAC-008: After remaining lifetime VCLM issuance capacity reaches zero, later fees do not create Reward-Accounting Credits.

## 10. Treasury Reward Stake

Treasury Reward Stake is a mechanism separate from Commitment Vault Locks. It is active from protocol launch. VCLM may be staked as soon as a user acquires it. CHONX and SYNTH become eligible when those tokens become available.

### 10.1 Weight

Treasury Reward Stake Weight = staked amount x token multiplier x staking-duration multiplier

| Token | Token multiplier |
|---|---|
| VCLM | 1.0x |
| CHONX | 2.0x |
| SYNTH | 4.0x |

| Duration | Staking-duration multiplier |
|---|---|
| 30 days | 1.0x |
| 60 days | 1.4x |
| 90 days | 1.75x |
| 120 days | 2.1x |

(120-day staking-duration multiplier changed by operator decision 2026-10-17, incorporated in Revision 14, source: docs/TRS_CORRECTION_2026-10-17.md. Any other staking duration is rejected.)

- VF-STK-001: Treasury Reward Stake is active from protocol launch and does not depend on CHONX activation.
- VF-STK-002: Only VCLM, CHONX, and SYNTH may be placed in Treasury Reward Stake.
- VF-STK-003: Only the token and duration multipliers listed in Section 10.1 apply.
- VF-STK-004: Rewards are paid only in newly minted VCLM.
- VF-STK-005: S1, S2, and S3 classifications and acquisition history never affect Treasury Reward Stake Weight.

### 10.2 Fixed 10-day epochs

Protocol launch defines T0. Epoch N is the half-open interval beginning at T0 plus (N - 1) times 10 days and ending at T0 plus N times 10 days. Activity at the exact ending timestamp belongs to the following epoch.

- VF-STK-006: Every epoch has a fixed scheduled duration of exactly 10 days.
- VF-STK-007: A Reward-Accounting Credit belongs to the epoch in which it is successfully recorded on Base and may not be added to an ended epoch.
- VF-STK-008: Anyone may submit the transaction that finalizes an epoch after its scheduled ending timestamp.
- VF-STK-009: Delayed finalization does not shift, lengthen, shorten, or reset any epoch boundary.
- VF-STK-010: Pending epochs must be finalized in chronological order.

### 10.3 Position eligibility and delayed reward allocation

Rewards are processed one epoch behind. A position earning for epoch N must be active at the exact beginning of N, remain continuously active through N, and remain active through the scheduled end of N+1. The scheduled timestamp controls eligibility even if finalization is delayed.

- VF-STK-011: A position that begins after an earning epoch starts does not qualify for that earning epoch.
- VF-STK-012: A position that expires before the scheduled end of the following epoch does not qualify for the earlier earning epoch's reward.
- VF-STK-013: An entitlement for epoch N becomes fixed and allocatable after the scheduled end of epoch N+1.
- VF-STK-014: The complete Epoch Reward VCLM is minted once to the immutable Treasury Reward Stake contract, and proportional position entitlements are then recorded.
- VF-STK-015: If an epoch has zero eligible Treasury Reward Stake Weight, it mints no VCLM, closes, marks its credits used, and carries no value forward.

### 10.4 Claims and withdrawals

- VF-STK-016: Recorded claimable VCLM accumulates and never expires.
- VF-STK-017: A user may claim all currently accumulated VCLM in one transaction.
- VF-STK-018: Claims transfer already-minted VCLM and do not mint again, recalculate rewards, or consume additional lifetime capacity.
- VF-STK-019: Claims may be paid only to the position owner or the reward destination bound to the position.
- VF-STK-020: Withdrawal of matured staked tokens does not erase accumulated claimable VCLM.

### 10.5 Manual extensions

- VF-STK-021: While a position is active, its user may queue one future term of 30, 60, 90, or 120 days.
- VF-STK-022: The queued term begins at the scheduled end of the current term; the current multiplier remains unchanged until then.
- VF-STK-023: Only one future term may be queued at a time. After it begins, another future term may be queued.
- VF-STK-024: An extension adds or removes no tokens and charges no fee.
- VF-STK-025: Without a queued extension, the position becomes inactive at maturity; an expired position cannot retroactively cover an inactivity gap.

### 10.6 Distribution rounding and VCLM-cap terminal state

- VF-STK-026: Each position's proportional reward share is calculated at 18-decimal VCLM precision and rounds down to the nearest VCLM base unit.
- VF-STK-027: A microscopic distribution remainder remains inaccessible in the immutable Treasury Reward Stake contract and is not carried, redirected, or reused.
- VF-STK-028: If a complete epoch reward exceeds remaining VCLM lifetime capacity, the epoch mints nothing, closes, and marks its credits used; partial epoch reward minting is prohibited.
- VF-STK-029: When remaining VCLM lifetime capacity reaches zero, Treasury Reward Stake permanently closes to new positions and extensions.
- VF-STK-030: At that terminal state, all existing staked tokens become immediately withdrawable while accumulated claimable rewards remain available.
- VF-STK-031: A Treasury Reward Stake position must contain a positive nonzero token amount; no additional minimum staking amount applies.

## 11. Cross-Chain and Native-Lock Architecture

Vinculum Finalis supports 16 blockchain environments. (changed by operator decisions t228u and t251u, 2026-10-20, Cosmos dropped, incorporated in Revision 14, source: src/tests/cosmos-removed.test.js:1 and archive/specifications/session-start/VINCULUM_SESSION_START_Revision_2_2026-10-20.md.) Commitment Vault principal remains in its original native or canonical asset form on the source environment. Each environment uses an appropriate deterministic chain-native locking mechanism, while Base performs canonical protocol-token issuance and accounting. Equivalent outcomes, security, and economic performance are required across supported environments; identical contracts, transaction structures, state models, or implementation methods are not.

### 11.1 Supported environments

| Family | Environment | Registry entries (this release, Appendix C) |
|---|---|---|
| EVM | Ethereum | 0 |
| EVM | BNB Smart Chain | 0 |
| EVM | Avalanche | 0 |
| EVM | Polygon | 0 |
| EVM | Arbitrum | 0 |
| EVM | Base | 2893 |
| EVM | Optimism | 0 |
| Non-EVM | Bitcoin | 0 |
| Non-EVM | Bitcoin Cash | 0 |
| Non-EVM | Solana | 0 |
| Non-EVM | XRP Ledger | 0 |
| Non-EVM | Stellar | 0 |
| Non-EVM | Litecoin | 0 |
| Non-EVM | Dogecoin | 0 |
| Non-EVM | DigiByte | 0 |
| Non-EVM | Zcash | 0 |

(Registry entries column changed in Revision 17 to count this release's Appendix C list, source: operator t358u/t359u, 2026-10-24.) (Changed in the Base-only replacement, source: operators t427u, t430u, t438u and t448u, 2026-10-26; registry data from registry Revision E, base-contracts/deployment/assetRegistry.revE.json.)

Cosmos (Cosmos Hub) is dropped. It is not a supported environment, it has no entry in this release's registry (Appendix C lists only Base entries), and it is not in the app. (changed by operator decisions t228u and t251u, 2026-10-20, Cosmos dropped, incorporated in Revision 14, source: src/tests/cosmos-removed.test.js:1 and archive/specifications/session-start/VINCULUM_SESSION_START_Revision_2_2026-10-20.md.) (Changed in Revision 18, source: operator t361u, 2026-10-24.)

The launch scope is Base only: this release mints on Base and locks on Base. The other environments in this table are outside this release. Each of them remains defined by the same finality bar in Section 11.5, and that bar is unchanged. (Changed in Revision 16, source: founder directive t357u, 2026-10-24.) (Scope wording corrected in draft 6, 2026-10-27.) Disabling a reader is not an acceptable substitute for meeting the proof requirements. (Added in Revision 15, source: operator Revision 15 text t349u, 2026-10-24.)

- VF-XCH-001: The supported environment set is exactly the 16 environments listed in Section 11.1. (changed by operator decisions t228u and t251u, 2026-10-20, Cosmos dropped, incorporated in Revision 14, source: src/tests/cosmos-removed.test.js:1 and archive/specifications/session-start/VINCULUM_SESSION_START_Revision_2_2026-10-20.md.)
- VF-XCH-002: No environment may be added, removed, or substituted without a later specification decision.
- VF-XCH-003: The deployment package must record the exact canonical network or chain identifier for each environment.
- VF-XCH-004: Commitment Vault principal remains on the source environment and does not bridge as part of the Commitment Vault Lock.
- VF-XCH-005: The source mechanism binds the user, principal-release destination, asset, amount, creation timestamp, and maturity.

### 11.2 Source-environment finality requirement

Each environment requires a deterministic finality condition appropriate to that environment. The specification fixes the required outcome and allows the architecture to define the concrete chain-specific method.

- VF-XCH-006: Base-chain issuance cannot occur until the source Commitment Vault Lock satisfies its documented deterministic finality condition.
- VF-XCH-007: Before implementation, the architecture must document the exact finality condition for all 16 environments. (changed by operator decisions t228u and t251u, 2026-10-20, Cosmos dropped, incorporated in Revision 14, source: src/tests/cosmos-removed.test.js:1 and archive/specifications/session-start/VINCULUM_SESSION_START_Revision_2_2026-10-20.md.)
- VF-XCH-008: A relayer or human cannot shorten or waive the applicable finality condition.
- VF-XCH-009: Confirmation and proof-delivery delays do not alter the original Valuation Timestamp, Commitment Vault Lock timestamp, maturity, selected output, recipient, or calculated issuance.
- VF-XCH-010: Tests must establish that premature, unconfirmed, and later-reversed source events cannot authorize Base issuance.

### 11.3 Cross-chain proof acceptance

The implementation may use a proof, attestation, or verified-message architecture appropriate to each environment. Regardless of transport, the evidence must establish the same normalized facts and permit no discretionary approval or alteration. Qualification may occur at the source, through required cryptographic authorization, in the proof-verification path, or through a demonstrated chain-native combination.

- VF-XCH-011: Evidence binds the source environment, unique Commitment Vault Lock identifier, canonical asset identity and precision, user, gross amount, actual fee amount and asset, fixed Dev Fund destination and fee-transfer evidence, principal, creation timestamp, maturity, selected output, authorized Base-chain recipient, release destination, applicable valuation record, immutable-facts Reward-Accounting Credit identity, and CHONX-activation receipt. (Changed in Revision 12, source: docs/Vinculum_Finalis_Master_Specification_Revision_12_2026-10-16.md: the Handshake identity is no longer a bound fact. The current proof format still carries a legacy Handshake field, which the Verifier ignores and never checks; source: testing-rigs/MASTER_FINDINGS.md, Fix status row 35, AG-20.)
- VF-XCH-012: A relayer may transport evidence but cannot change its contents, choose the output, redirect issuance, or exercise approval authority.
- VF-XCH-013: The combination of source environment and unique Commitment Vault Lock identifier may authorize Base issuance only once.
- VF-XCH-014: A failed or temporarily unverifiable proof does not consume the unique identifier; corrected evidence may be resubmitted.
- VF-XCH-015: After successful issuance, every replay or duplicate submission is rejected.
- VF-XCH-016: Proof failure prevents issuance but never prevents release of matured Commitment Vault principal.
- VF-XCH-017: The selected architecture must document its trust assumptions and demonstrate equivalent required outcomes, security, and economic performance using the selected chain-native mechanism; it need not resemble an EVM contract. It may not introduce a person with discretionary power to approve, alter, redirect, or reverse issuance.

### 11.4 Base-native protocol tokens

VCLM, CHONX, and SYNTH are ordinary Base-native tokens, with Base serving as their canonical issuance and accounting blockchain. Axelar Interchain Token Service is not part of this launch. (Changed in the Base-only replacement, source: operator t427u, 2026-10-26.)

- VF-XCH-018: Removed. Axelar ITS is not part of this launch; VCLM, CHONX, and SYNTH are ordinary Base-native tokens. (Changed in the Base-only replacement, source: operator t427u, 2026-10-26.)
- VF-XCH-019: No independent or separately issued VCLM, CHONX, or SYNTH supply may be created on another blockchain.
- VF-XCH-020: Removed. Axelar ITS is not part of this launch. (Changed in the Base-only replacement, source: operator t427u, 2026-10-26.)
- VF-XCH-021: Interchain transport does not constitute new protocol issuance, increase cumulative lifetime issuance, restore consumed hard-cap capacity, or create an independent destination-chain allowance.

#### 11.4.1 Axelar ITS timing

Removed. Revision 18 allowed Axelar ITS to be connected after launch (founder decision t295u, written out from docs/Vinculum_Finalis_Master_Specification_Revision_13_2026-10-22.md). Operator order t427u removes Axelar ITS from this launch. The removed text is preserved in the Revision 18 file. (Changed in the Base-only replacement, source: operator t427u, 2026-10-26.)

### 11.5 Reader finality and proof requirements

(Added in Revision 15, source: operator Revision 15 text t349u, 2026-10-24.) This section defines requirements and does not record status. Implementation status, test results, and environment-by-environment progress are in the findings register (testing-rigs/MASTER_FINDINGS.md) and the gap report.

#### 11.5.1 Purpose

The sixteen commitment environments exist so that a user can lock an approved asset on any of them and, after the lock is proven, receive VCLM or activated CHONX on Base. The locks and the readers are required functions of the protocol. Disabling a reader is not an acceptable substitute for meeting the proof requirements in this section.

#### 11.5.2 Per-environment finality bar

- VF-FIN-001: The launch scope is Base only: this release mints on Base and locks on Base, and Base must meet the bar. Any other environment must meet the same bar before it is added to a later release. (Changed in Revision 16, source: founder directive t357u, 2026-10-24.) (Scope wording corrected in draft 6, 2026-10-27.)

For an environment to meet the bar, its reader must:

- VF-FIN-002: Anchor its proof to the chain's settled history in a way the Base Verifier can check on-chain.
- VF-FIN-003: Refuse any header that is not provably part of that settled history.
- VF-FIN-004: Refuse a proof that refers to the wrong lock contract, the wrong asset, the wrong chain, or a replay of a prior proof.
- VF-FIN-005: Refuse a proof that uses a non-EVM identity where an EVM identity is required, or the reverse.
- VF-FIN-006: The Base Verifier must independently check the anchor and the refusal conditions. A reader's claim is not sufficient.

#### 11.5.3 Mandatory tests

Every environment must have tests that:

- VF-FIN-007: Accept a real, anchored lock and produce a mint on Base.
- VF-FIN-008: Reject a correctly formatted header that is not part of the chain's settled history.
- VF-FIN-009: Reject a header that contains a transaction that never created a Vinculum lock.
- VF-FIN-010: Reject a proof that names the wrong lock contract or the wrong asset.
- VF-FIN-011: Reject a proof that is a replay of a previously used proof.
- VF-FIN-012: Reject a proof that confuses an address or identity across chains.
- VF-FIN-013: A test that cannot be written because the anchor does not exist is evidence that the environment does not meet the bar. It is not evidence that the requirement is waived.

## 12. Commitment Vault Principal Safety, Maturity, and Release

Commitment Vault principal is separate from protocol fees, protocol-token issuance, and Treasury Reward Stake. At maturity, the user who created the Commitment Vault Lock may reclaim the remaining principal from the source-chain mechanism. The release is user-initiated rather than automatically pushed to a wallet.

- VF-PRI-001: The actual fee is removed or irrevocably designated at Commitment Vault Lock creation; the remaining principal is the amount subject to maturity.
- VF-PRI-002: Commitment Vault principal may be released only once.
- VF-PRI-003: Principal may be released only to the user or release destination bound when the Commitment Vault Lock was created.
- VF-PRI-004: No price reference or oracle call is required for principal release.
- VF-PRI-005: No Base issuance, epoch calculation, Treasury Reward Stake processing, registry update, relayer, or administrator is required for principal release.
- VF-PRI-006: There is no early Commitment Vault principal release path.
If Base verification fails permanently and no output token is issued, the source-chain Commitment Vault Lock still matures and its principal remains releasable under the same fixed maturity rule.

## 13. Supply Accounting and Activation Gates

### 13.1 Cumulative lifetime issuance

Remaining lifetime capacity = hard cap - cumulative lifetime protocol issuance

- VF-SUP-001: Every authorized issuance path reconciles against the applicable global lifetime hard cap.
- VF-SUP-002: Commitment Vault issuance and Treasury Reward Stake rewards draw from the same VCLM lifetime hard cap.
- VF-SUP-003: Burning a protocol token reduces circulating supply but does not reduce cumulative lifetime issuance or restore issuance capacity.
- VF-SUP-004: Activation thresholds use cumulative lifetime issuance rather than circulating supply, wallet balances, burned supply, elapsed time, or governance action.

### 13.2 Full-rejection cap behavior

- VF-SUP-005: A Commitment Vault issuance whose complete calculated output exceeds remaining lifetime capacity is rejected in full.
- VF-SUP-006: Partial Commitment Vault issuance is prohibited; no substitute token, recipient, or reduced output is permitted.
- VF-SUP-007: A rejected issuance attempt reserves no capacity and does not consume the source Commitment Vault Lock identifier.
- VF-SUP-008: A permanently impossible Base issuance produces no fee refund or administrative reversal; Commitment Vault principal remains releasable at maturity.

### 13.3 Epoch rewards at the VCLM cap

- VF-SUP-009: If a complete Epoch Reward VCLM amount does not fit within remaining VCLM lifetime capacity, that epoch mints zero VCLM, closes, and marks its Reward-Accounting Credits used.
- VF-SUP-010: A later smaller complete epoch reward may be issued if it fits the unchanged remaining capacity.
- VF-SUP-011: At zero remaining VCLM lifetime capacity, Treasury Reward Stake permanently enters the terminal state defined by Section 10.6.
- VF-SUP-012: At that terminal state, qualifying Commitment Vault fees may still reach the Dev Fund for an otherwise valid CHONX output, but they create no Reward-Accounting Credit.

### 13.4 Single Base supply

VCLM, CHONX, and SYNTH are ordinary Base-native tokens with one supply each, issued on Base. The implementation must preserve one token system for each protocol token without granting new protocol issuance capacity. (Changed in the Base-only replacement, source: operator t427u, 2026-10-26.)

- VF-SUP-013: Only protocol-authorized issuance originating from the Base protocol increases cumulative lifetime protocol issuance.
- VF-SUP-014: Removed. Axelar ITS is not part of this launch. (Changed in the Base-only replacement, source: operator t427u, 2026-10-26.)
- VF-SUP-015: Preflight checks do not reserve lifetime capacity or guarantee later Base issuance; the source application must communicate that consequence before the user completes a Commitment Vault Lock.

## 14. Security Invariants and Fail-Closed Behavior

| Risk or dependency | Required behavior |
|---|---|
| No valid scheduled price reference | Reject the Commitment Vault Lock before assets move |
| Unrecognized asset identity | Reject the Commitment Vault Lock |
| Unconfirmed source event | Reject Base issuance |
| Replay or duplicate proof | Reject Base issuance |
| Incorrect output or recipient binding | Reject Base issuance |
| Lifetime hard-cap breach | Reject the complete issuance |
| Fee-routing evidence failure | Do not issue a protocol token or record Reward-Accounting Credit; do not affect matured principal release |
| Epoch processing failure | Do not affect Commitment Vault principal release |
| Cross-chain message failure | Do not affect source-chain maturity or principal release |

- VF-SEC-001: An approved asset with fee-on-transfer, rebasing, callback, malformed, or otherwise incompatible behavior must be rejected unless its approved source-environment architecture explicitly handles that behavior without violating this specification.
- VF-SEC-002: External calls and state transitions must prevent reentrancy, duplicate issuance, and partial-accounting states.
- VF-SEC-003: No failure path may substitute a default asset, price, environment, user, recipient, output, duration, multiplier, or Dev Fund destination.
- VF-SEC-004: The source Commitment Vault Lock identifier is consumed only after successful Base issuance.
- VF-SEC-005: A relayer or price-batch submitter obtains no authority to change protocol parameters or redirect user or Dev Fund value.
- VF-SEC-006: Principal release remains independent of every Base-chain and external dependency.

## 15. Deployment, Immutability, and Configuration Finalization

The specification defines binding behavior and architectural constraints. The implementer may design concrete integration and deployment methods only within those constraints. Prototype construction is not deployment authorization.

- VF-DEP-001: The implementation remains inactive until every required registry entry, blockchain identifier, Dev Fund destination, proof-verification dependency, and fixed protocol parameter has been populated and validated. (Changed in Revision 13, source: docs/Vinculum_Finalis_Master_Specification_Revision_13_2026-10-22.md: the Axelar ITS dependency is no longer an activation prerequisite.)
- VF-DEP-002: An incomplete, missing, provisional, guessed, zero, or inconsistent configuration cannot be permanently finalized.
- VF-DEP-003: After successful finalization, configuration changes, upgrades, administrator intervention, and replacement dependencies are impossible.
- VF-DEP-004: The implementer may select the concrete initialization procedure but must provide verifiable evidence that the deployed configuration matches this specification.
- VF-DEP-005: The deployment package records contract addresses, environment identifiers, configuration values, source hashes, compiler settings, dependency lockfiles, and deployed bytecode hashes, and preserves a copy of the exact machine-readable registry artifact used for deployment. Registry conformity is evaluated under VF-REG-011.
- VF-DEP-006: Any temporary deployment authority must be demonstrably and irreversibly terminated before finalization.
- VF-DEP-007: The absence of proxy upgrade paths, pause paths, rescue paths, and discretionary value routes must be independently verifiable.
- VF-DEP-008: Prototype development does not require final external addresses and does not authorize broadcasting a deployment.

### 15.1 Required finalization evidence

1. Freeze the current Master Specification and source commit.
1. Freeze the 2893-entry registry in Appendix C and its S1/S2/S3 classifications. (Changed in Revision 17, source: operator t358u/t359u, 2026-10-24.) (Changed in the Base-only replacement, source: operators t427u, t430u, t438u and t448u, 2026-10-26; registry data from registry Revision E, base-contracts/deployment/assetRegistry.revE.json.)
1. Freeze the 16 canonical environment identifiers and finality rules. (changed by operator decisions t228u and t251u, 2026-10-20, Cosmos dropped, incorporated in Revision 14, source: src/tests/cosmos-removed.test.js:1 and archive/specifications/session-start/VINCULUM_SESSION_START_Revision_2_2026-10-20.md.)
1. Insert and verify all 16 fixed Dev Fund destinations. (changed by operator decisions t228u and t251u, 2026-10-20, Cosmos dropped, incorporated in Revision 14, source: src/tests/cosmos-removed.test.js:1 and archive/specifications/session-start/VINCULUM_SESSION_START_Revision_2_2026-10-20.md.)
1. Freeze the price-fetcher, signed/batched path, and proof architecture. (Changed in Revision 13, source: docs/Vinculum_Finalis_Master_Specification_Revision_13_2026-10-22.md: the Axelar ITS integration configuration is not frozen at finalization.)
1. Freeze compiler versions, dependency lockfiles, optimizer settings, deployment scripts, and bytecode.
1. Deploy and complete required one-time initialization.
1. Verify configuration counts, references, bytecode, authority termination, and permanent immutability.
1. Publish the deployment manifest and verification evidence.

## 16. Verification, Testing, and Specification Traceability

A passing test proves that an implementation behaved as its test expected. It does not prove that the expectation matched this specification. Every meaningful test and deployment check must therefore trace to one or more numbered requirements.

- VF-VER-001: Each numbered requirement maps to applicable contracts, source-environment programs, functions, tests, and deployment checks.
- VF-VER-002: Positive tests demonstrate every intended successful lifecycle, including the one-hour Handshake with no allowance limit, the reader finality tests in Section 11.5.3 for every environment, source-state and proof-verification-path enforcement, and recognized pending-attempt resolution. (Changed in Revision 12, source: docs/Vinculum_Finalis_Master_Specification_Revision_12_2026-10-16.md.)
- VF-VER-003: Negative tests demonstrate rejection of invalid amounts, assets, prices, proofs, destinations, recipients, outputs, replays, premature releases, cap breaches, unauthorized control, arbitrary out-of-protocol transactions, ambiguous or multi-key UTXO release paths, duplicate official submissions while objectively pending, and any timer-, mempool-, or non-observation-based clearing of a still-valid transaction. Tests also establish that failed, reverted, invalid, objectively expired, replaced, and unrecognized attempts create no Vinculum rights. (Changed in Revision 12, source: docs/Vinculum_Finalis_Master_Specification_Revision_12_2026-10-16.md. The UTXO release-path item is pending; see Appendix E, item E-7.)
- VF-VER-004: Boundary tests cover exact thresholds, timestamps, fee rounding, canonical release-public-key normalization across permitted encodings and script wrappers, objective pending-attempt disposition and invalidation, multiplier transitions, epoch boundaries, term expirations, and lifetime-cap behavior. (Changed in Revision 12, source: docs/Vinculum_Finalis_Master_Specification_Revision_12_2026-10-16.md. The release-public-key item is pending; see Appendix E, item E-7.)
- VF-VER-005: Principal-isolation tests demonstrate release after maturity despite failure of Base issuance, price updates, relayers, epoch processing, and external integrations.
- VF-VER-006: Independent reproduction is stronger evidence than self-reported pass counts.
- VF-VER-007: No package may be described as production-ready or deployment-ready merely because it compiles or has a high passing-test count.
- VF-VER-008: A divergence between code and this specification is an implementation defect or a newly identified specification matter; code does not prevail by default.

## 17. Machine-Readable, Transfer, and Market Representations

### 17.1 Machine-readable records

- The repository preserves the current human-readable Master Specification.
- A machine-readable registry preserves every approved asset identity, environment, classification, pricing identifier, and source metadata.
- The deployment manifest identifies every live address, environment identifier, source commit, bytecode hash, dependency, and fixed Dev Fund destination.
- Public website language derives from the current specification and does not add economic promises or protocol features.
- The public registry may display Symbol, Name, Environment, Price, Price Source, Last Updated, Contract or native identity, and available pricing metadata.
- Website price data refreshes twice per day using the established price-fetcher process.

### 17.2 External trading and listings

External users and venues may transfer or trade protocol tokens without changing Vinculum Finalis. The protocol's intention to pursue exchange listings is a development objective rather than a promise of availability or value.

- VF-PUB-001: Every public and machine-readable representation must remain consistent with the current Master Specification.
- VF-PUB-002: Public price displays must identify the selected source and last update time without presenting the reference as a guaranteed trading price.
- VF-PUB-003: Exchange or liquidity-venue activity cannot modify protocol calculations or supply accounting.

## 18. Explicitly Superseded Concepts

The following concepts are rejected or superseded. Their presence in historical code, documents, tests, or conversations does not authorize their return.

- Governance, voting seats, proposal deposits, councils, administrative treasury discretion, or governance staking.
- Admin keys, upgradeability, pausing, rescue authority, or post-deployment parameter adjustment.
- Fee splitting, fee conversion, fee swapping, preferred-stable routing, a value-holding protocol treasury, or multiple fee destinations.
- Any Commitment Vault Lock that produces both VCLM and CHONX.
- Using VCLM, CHONX, or SYNTH as Commitment Vault Lock input.
- A preferential VCLM-to-CHONX Commitment Vault Lock route.
- Delaying Treasury Reward Stake until CHONX activation.
- Any Trust-Building Handshake allowance limit; a Handshake identity; any Handshake fee other than the uniform 5.00%; or any Handshake value band other than the one in VF-COM-003. (Changed in Revision 12, source: docs/Vinculum_Finalis_Master_Specification_Revision_12_2026-10-16.md.) (Changed in Revision 15, source: operator directive t350u, 2026-10-24.)
- A 160-day Treasury Reward Stake term or a 120-day multiplier other than 2.1x. (changed by operator decision 2026-10-17, incorporated in Revision 14, source: docs/TRS_CORRECTION_2026-10-17.md.)
- Treating WETH, WBTC, or alternate-chain forms as S2.
- A 14-environment architecture, or any environment set other than the 16 in Section 11.1. (changed by operator decisions t228u and t251u, 2026-10-20, Cosmos dropped, incorporated in Revision 14, source: src/tests/cosmos-removed.test.js:1 and archive/specifications/session-start/VINCULUM_SESSION_START_Revision_2_2026-10-20.md.)
- Disabling a required reader, or Base issuance from an environment before that environment meets the reader finality bar in Section 11.5. (Changed in Revision 16, source: founder directive t357u, 2026-10-24.) (Added in Revision 15, source: operator Revision 15 text t349u, 2026-10-24.)
- Two-source price consensus, a 5% source-spread rule, lower-median pricing, a 10-minute price-freshness rule, or a new reporter committee.
- Market-price adjustment of the permanent $0.10 Reward Reference Value.
- Asset multipliers changing VCLM or CHONX decay.
- Bridging or wrapping Commitment Vault principal.
- Early release or renewal of a Commitment Vault Lock.
- Independent protocol-token supplies. (Changed in the Base-only replacement, source: operator t427u, 2026-10-26.)

## 19. Required Architecture Deliverables and Deferred External Inputs

The behavioral decisions in this specification are binding and fully incorporate the presently approved amendment set. The items below are implementation, deployability-evidence, and deployment deliverables, not permission to change behavior. Their absence prevents deployment but does not require the specification to prescribe every low-level design choice. Items not settled are listed in Appendix E. (Changed in Revision 15, source: operator directive t350u, 2026-10-24.)

| Deliverable | Required outcome | Stage |
|---|---|---|
| 16-environment finality matrix | One deterministic finality condition for every supported environment, anchored and checked as Section 11.5 requires, with the Section 11.5.3 tests for each environment | Architecture before implementation; required for each environment before Base issuance from it under VF-FIN-001; this release ships Base only (Changed in Revision 16, source: founder directive t357u, 2026-10-24.) (changed by operator decisions t228u and t251u, 2026-10-20, Cosmos dropped, incorporated in Revision 14; Added in Revision 15, source: operator Revision 15 text t349u, 2026-10-24.) |
| Cross-chain proof architecture | Evidence and replay behavior conforming to Section 11.3 | Architecture before implementation |
| Axelar ITS integration | Not applicable: Axelar ITS is not part of this launch (Section 11.4) | Not applicable (Changed in the Base-only replacement, source: operator t427u, 2026-10-26.) |
| Dev Fund destinations | One fixed destination for every supported environment | After prototype review and before heavy testing |
| Production dependencies | All addresses, identifiers, signers, and contract references verified | Before deployment finalization |
| Deployment evidence | Source, configuration, bytecode, hashes, and authority termination recorded | Before deployment is considered complete |
| Handshake qualification and pending-attempt verifier | Per-environment evidence for official-application prevention and objective pending-attempt disposition (changed in Revision 12, source: docs/Vinculum_Finalis_Master_Specification_Revision_12_2026-10-16.md: allowance and identity evidence removed) | Architecture and deployability evidence before implementation |
| Cosmos Hub chain-native feasibility analysis | Not required: Cosmos is dropped | Not applicable (changed by operator decisions t228u and t251u, 2026-10-20, Cosmos dropped, incorporated in Revision 14, source: src/tests/cosmos-removed.test.js:1 and archive/specifications/session-start/VINCULUM_SESSION_START_Revision_2_2026-10-20.md) |

- VF-EXT-001: The implementer may design a chain-native architecture only within the requirements and prohibitions of this specification. A design is judged by equivalent required outcomes, security, and economic performance rather than resemblance to an EVM contract.
- VF-EXT-002: An unavailable external address or unfinished architecture deliverable must be reported as incomplete rather than replaced with an invented value or behavior.
- VF-EXT-003: No live deployment may be finalized until every deliverable required for that deployment has been completed and verified.

## Appendix A. Consolidated Formulas and Schedules

### A.1 Commitment Vault issuance

Output = Verified Gross USD Value x current emission rate x asset multiplier x Commitment Vault Lock duration multiplier

Apply the factors in the written order using 18-decimal fixed-point arithmetic. Round down at every integer division and finally express the result in the output token's smallest units.

### A.2 Asset multipliers

| Class | Multiplier | Exact canonical assets |
|---|---|---|
| S1 | 1.5x | Base USDC and Base USDT (Changed in the Base-only replacement, source: operator t427u, 2026-10-26.) |
| S2 | 1.3x | Native ETH on Base (Changed in the Base-only replacement, source: operator t427u, 2026-10-26.) |
| S3 | 1.0x | Every other approved Base registry entry (Changed in the Base-only replacement, source: operator t427u, 2026-10-26.) |

### A.3 Treasury Reward Stake Weight

Weight = staked amount x token multiplier x staking-duration multiplier

| Token | Multiplier |
|---|---|
| VCLM | 1.0x |
| CHONX | 2.0x |
| SYNTH | 4.0x |

| Duration | Multiplier |
|---|---|
| 30 days | 1.0x |
| 60 days | 1.4x |
| 90 days | 1.75x |
| 120 days | 2.1x |

(120-day multiplier changed by operator decision 2026-10-17, incorporated in Revision 14, source: docs/TRS_CORRECTION_2026-10-17.md.)

### A.4 Fee Routing and Reward Accounting

The Dev Fund receives 100% of the actual rounded Commitment Vault fee in the fee asset's original form. Commitment principal remains isolated in the Commitment Vault Lock. No fee is swapped, converted, bridged, or divided among destinations.

Reward-Accounting Credit = Verified USD Fee Value x 60%

Epoch Reward Basis = sum of Reward-Accounting Credits

Epoch Reward VCLM = Epoch Reward Basis / $0.10

Reward-Accounting Credit is numerical state rather than an asset. When an epoch calculation and allocation are irreversibly recorded, every included credit becomes a Used Reward-Accounting Credit and cannot be used again.

### A.5 Lifetime capacity and cap rejection

Remaining lifetime capacity = hard cap - cumulative lifetime protocol issuance

A calculated Commitment Vault output or complete epoch reward must fit within remaining capacity. Otherwise it is rejected in full. Burns do not restore lifetime capacity. (Changed in the Base-only replacement, source: operator t427u, 2026-10-26.)

## Appendix B. Canonical Terminology

### B.1 Users, Commitment Vault Locks, and fees

| Canonical term | Required meaning |
|---|---|
| User | A wallet-controlled actor using Vinculum Finalis. This is the universal protocol-actor term. |
| Commitment Vault Lock | A non-renewable source-chain timelock of an approved external asset that authorizes exactly one selected VCLM or activated CHONX output after successful Base verification. |
| Trust-Building Handshake | A one-hour Commitment Vault Lock from $0.01 through $0.02 inclusive (with the native coin-unit bands in VF-COM-003), charging 5.00%, with no allowance limit. (Changed in Revision 12, source: docs/Vinculum_Finalis_Master_Specification_Revision_12_2026-10-16.md.) |
| Verified Gross USD Value | The accepted USD reference value of the complete gross asset amount used as the Commitment Vault issuance basis. |
| Commitment Vault fee | The actual rounded fee transferred separately to the fixed Dev Fund destination in the original asset. |
| Commitment Vault principal | The gross asset units remaining after the actual fee; held until maturity and released independently of Base systems. |
| Original-form fee routing | Transfer of 100% of the actual fee to the fixed Dev Fund destination in the same asset, with no swap, conversion, bridge, or division. |
| Dev Fund | The recipient of all actual Commitment Vault fee assets. It receives no Commitment Vault principal. |
| Handshake identity | Removed. No Handshake identity is bound. (Changed in Revision 12, source: docs/Vinculum_Finalis_Master_Specification_Revision_12_2026-10-16.md.) |
| Canonical release public key | For a UTXO-family mechanism, the single canonically serialized public key authorizing the principal's maturity-release branch, proved against the output's script evidence. It is not a Handshake identity (changed in Revision 12). How it now applies is pending; see Appendix E, item E-7. (Changed in Revision 15, source: operator directive t350u, 2026-10-24.) |
| Objectively pending Handshake attempt | An official Handshake submission that has neither reached a terminal source-chain disposition nor become objectively invalid. It does not clear through elapsed time, mempool disappearance, non-observation, or an application-local timer. |

### B.2 Price and reward accounting

| Canonical term | Required meaning |
|---|---|
| Signed and batched price path | The established method that carries the twice-daily first-valid-price record to Base. |
| Verified USD Fee Value | The accepted USD valuation of the actual rounded Commitment Vault fee, using the same applicable price record as the gross value. |
| Reward-Accounting Credit | Numerical state equal to 60% of Verified USD Fee Value. It is not an asset or claim against Dev Fund assets. |
| Epoch Reward Basis | The sum of Reward-Accounting Credits assigned to one 10-day epoch. |
| Permanent Reward Reference Value | The fixed $0.10 per VCLM value used only to convert Epoch Reward Basis into Epoch Reward VCLM. |
| Epoch Reward VCLM | The complete newly minted VCLM reward calculated for an epoch, subject to remaining lifetime capacity. |
| Used Reward-Accounting Credit | A credit included in an irreversibly recorded epoch calculation and allocation; it can never be used again. |
| Fee-indexed reward issuance | VCLM reward issuance calculated from fee activity without being funded, collateralized, or redeemable from Dev Fund assets. |

### B.3 Treasury Reward Stake

| Canonical term | Required meaning |
|---|---|
| Treasury Reward Stake | The protocol mechanism through which eligible VCLM, CHONX, and SYNTH positions earn newly minted VCLM. |
| Treasury Reward Stake position | One user-owned protocol-token position with one active fixed term and no more than one queued future term. |
| Token multiplier | VCLM 1.0x, CHONX 2.0x, or SYNTH 4.0x. |
| Staking-duration multiplier | 30 days 1.0x, 60 days 1.4x, 90 days 1.75x, or 120 days 2.1x. (Corrected in Revision 15 to match Section 10.1, source: docs/TRS_CORRECTION_2026-10-17.md.) |
| Treasury Reward Stake Weight | Staked amount multiplied by token multiplier and staking-duration multiplier. |
| 10-day epoch | One fixed half-open reward-accounting interval measured from protocol launch. |

### B.4 Asset and protocol-token terminology

| Canonical term | Required meaning |
|---|---|
| S1 | The exact canonical stablecoin identities Base USDC and Base USDT (VF-REG-002), using a 1.5x Commitment Vault issuance multiplier. (Changed in the Base-only replacement, source: operator t427u, 2026-10-26.) |
| S2 | Native ETH on Base at registry row 2 under Base (VF-REG-003), using a 1.3x multiplier. (Changed in the Base-only replacement, source: operator t427u, 2026-10-26.) |
| S3 | Every other approved Base registry entry, using a 1.0x multiplier. (Changed in the Base-only replacement, source: operator t427u, 2026-10-26.) |
| Base-native protocol token | VCLM, CHONX, or SYNTH: an ordinary token issued on Base, with Base as the canonical issuance and accounting blockchain and one supply. (Changed in the Base-only replacement, source: operator t427u, 2026-10-26.) |

### B.5 Required formula language

Commitment output = Verified Gross USD Value x emission rate x asset multiplier x duration multiplier

Reward-Accounting Credit = Verified USD Fee Value x 60%

Epoch Reward Basis = sum of Reward-Accounting Credits

Epoch Reward VCLM = Epoch Reward Basis / $0.10

Treasury Reward Stake Weight = staked amount x token multiplier x staking-duration multiplier

### B.6 Terminology and interpretations that are not current behavior

- A fee-asset split between the Dev Fund and another destination.
- A protocol treasury or reserve that receives or holds Commitment Vault fee assets.
- Fee conversion, fee swapping, or preferred-stable routing.
- A dual-output or dual-path Commitment Vault Lock.
- A governance stake or governance-derived reward mechanism.
- A generic collective-container label used in place of Treasury Reward Stake.
- Any Handshake allowance limit, a Handshake identity, a Handshake fee other than the uniform 5.00%, or a Handshake value band other than the one in VF-COM-003. (Changed in Revision 12, source: docs/Vinculum_Finalis_Master_Specification_Revision_12_2026-10-16.md.) (Changed in Revision 15, source: operator directive t350u, 2026-10-24.)
- A price-consensus, source-spread, lower-median, or 10-minute-freshness requirement.
- An independent per-chain VCLM, CHONX, or SYNTH supply.

## Appendix C. Complete Approved Asset Registry

This appendix is derived from, and subordinate to, the registry file base-contracts/deployment/assetRegistry.revE.json, identified by its full SHA-256 af8a4fc62af5be7baf50e2fe164e23202de8e03f1f92103d27b490dcfb56e2e6. If this appendix, its CSV file or any other copy differs from the file with that hash, the file with that hash governs. It incorporates all 2893 Base entries of registry Revision E: 1 S1, 1 S2 and 2891 S3. (Derivation statement added in draft 6, 2026-10-27.) Because of its size, the entry table is kept in a separate CSV file, APPENDIX_C_BASE_REGISTRY_REVISION_E_2026-10-26.csv (SHA-256 15a8d0a7be9142b8926645549ee8fbe09bad21a69dd5bc0cdeee6d9027dddc6c), which forms part of this appendix. Each CSV line gives the registry row, symbol, environment (Base), contract or native identifier, class, pricing identifier, decimals and admission basis. Entries are listed in registry row order; Registry Row is the row number, a document reference, not a market ranking. Rows 1104 and above were assigned in Revision E to Base tokens that had no Base registry row before. Revision D (SHA-256 d8bb58d80d593f4e0e967ee82c239327055adb07cef8809fe48f7b95372903d4) stays pinned and unchanged, as do Revisions C and B. (Changed in the Base-only replacement, source: operators t427u, t430u, t438u and t448u, 2026-10-26; registry data from registry Revision E, base-contracts/deployment/assetRegistry.revE.json.)

Admission follows VF-REG-013 and VF-REG-014: every technically compatible Base token is admitted, with no liquidity, volume, market-cap or freshness threshold. Row 138 TigerOG is admitted by founder override (VF-REG-012). Shiba Inu (SHIB), when listed in a chain's registry, is allowed for Commitment Vault Lock by developer override VF-REG-015 (operator t855u), which supersedes normal registry filters for that asset only. An entry without a usable price stays in the registry and is pending; it is not valued until a valid scheduled price exists (VF-ORC-005). Dynamic prices, volumes, liquidity, update times and pricing status are intentionally excluded. Machine-readable representations conform through exact field-level equality under VF-REG-011; filename, whitespace, object-key order, and formatting are not protocol behavior.

### C.1 Explicit exclusions

These Base records are excluded by operator decision and are not in Appendix C:

| Record | Reason |
|---|---|
| BAR, ACM, ASR (Base copies) | Excluded by operator t427u, item 6 |
| XCN on Base | Cancelled token record (OD-18) |
| FrogOG, LionOG | Removed by operator t431u |
| TEL, earlier Base contract 0x09bE...aDB1 | Replaced by the upgraded TEL contract at row 1082 (asset-contract migration) |

### C.2 Not technically compatible

52 candidate Base tokens are not in Appendix C because they failed the compatibility test of VF-REG-014. They are listed with their reasons in registry Revision E under notTechnicallyCompatible. By reason:

| Reason | Count |
|---|---|
| FEE_ON_TRANSFER | 23 |
| TRANSFERS_RESTRICTED | 23 |
| APPROVE_RESTRICTED | 3 |
| RELEASE_OVERPAID | 1 |
| RELEASE_SHORT | 1 |
| TRANSFERFROM_INTO_VAULT_REVERTS | 1 |

(Revision 18 carried the 27 Base rows of registry Revision C here; that table is in the Revision 18 file. All 27 are in Appendix C except Revision 18 row 45 cbBTC, which is the same contract as row 28 CBBTC and is entered once, at row 28. (Changed in the Base-only replacement, source: operator t427u, 2026-10-26.))

## Appendix D. Revision Control

| Revision | Date | Status | Summary |
|---|---|---|---|
| Revision 19 | 27 October 2026 | Current governing edition. Supersedes all prior revisions, including Revision 18 | Full copy of Revision 18 with the changes in the change history: VF-COM-009 $0.01; Base S1, S2 and S3 classes; symbol-only lookup removed; Base registry in Appendix C (registry Revision E under t448u: every technically compatible Base token, with no liquidity, volume, market-cap or freshness threshold, the founder override for TigerOG, and the upgraded TEL contract); $0.95 USDC/USDT rule stated by exact identity; 30-decimal scheduled prices; Axelar ITS removed from this launch. Economics unchanged. Sources: operators t427u, t430u and t448u. |
| Seven-chain proposal (earlier draft also numbered 19) | 25 October 2026 (prepared) | Proposed; never adopted. Superseded by operator order t427u (Base-only launch) | Seven-chain proposal. Not incorporated, except that this edition carries its VF-COM-009 $0.01 wording and its removal of the symbol-only lookup step. Prepared text: reports/VINCULUM_MASTER_SPECIFICATION_Revision_19_PROPOSED_FINAL.md (never committed). |
| Revision 18 | 24 October 2026 | Superseded by Revision 19 | Full copy of Revision 17. S1 at 1.5x names Ethereum USDC, Ethereum USDT, Base USDC, Base USDT, and PYUSD; Base ETH stated as S2; Section 7.1.1 override row removed; Base-only wording in Sections 3.1 and 11.1; Appendix C lists the 27 Base rows of registry Revision C. Supersedes all prior revisions. Source: this file. |
| Revision 17 | 24 October 2026 | Superseded by Revision 18. Archived at archive/specifications/master-specification/Vinculum_Finalis_Master_Specification_Revision_17_2026-10-24.md (SHA-256 3b45aeeb25881c7f2465b2bf78400bfd94626df9fe0e3456d72cbe9e1452dace) | Full copy of Revision 16. Appendix C lists the 27 Base rows of Revision B; registry counts describe that list; one VF-FIN-001 sentence deleted. Supersedes all prior revisions. |
| Revision 16 | 24 October 2026 | Superseded by Revision 17. Archived at archive/specifications/master-specification/Vinculum_Finalis_Master_Specification_Revision_16_2026-10-24.md (SHA-256 ae61bddd9e8a136b11607a6a4bfc13d479ef707b56e87d0a2987c5d7786ff72d) | Full copy of Revision 15 with only the launch scope wording changed (this release ships Base only; every environment must still meet the bar in Section 11.5). Supersedes all prior revisions. |
| Revision 15 | 24 October 2026 | Superseded by Revision 16. Archived at archive/specifications/master-specification/Vinculum_Finalis_Master_Specification_Revision_15_2026-10-24.md (SHA-256 74080a46598c3664e24aa7b6a924b8aaf1316b3a18fac9a9be9b77b3ad3050fb) | Full copy of Revision 14 with changes applied. Supersedes all prior revisions. Writes out every rule Revision 14 held by reference; adds the reader finality and proof requirements (Section 11.5) and the revision control rule (Section 0.4); records no status. |
| Revision 14 | 24 October 2026 | Superseded by Revision 15. Archived at archive/specifications/master-specification/Vinculum_Finalis_Master_Specification_Revision_14_2026-10-24.md | Carries forward the full text of Revision 6 and edits only the parts changed by Revision 12 (Handshake), Revision 13 (Axelar ITS timing) and recorded operator decisions (Cosmos dropped; 120-day stake multiplier 2.1x; reader finality as a launch blocker; document control). Unsettled items are listed in Appendix E. Source: this file. |
| Revision 13 | 22 October 2026 | Superseded | Axelar ITS timing only (founder decision t295u). Its rule is written out in Section 11.4.1. Archived at archive/specifications/master-specification/Vinculum_Finalis_Master_Specification_Revision_13_2026-10-22.md. |
| Revision 12 | 16 October 2026 | Superseded | Handshake: 5% fee, no allowance limit, Handshake identity removed, 1 hour, $0.01 to $0.02 in the current deployment. Its rule is written out in Section 5.2. Archived at archive/specifications/master-specification/Vinculum_Finalis_Master_Specification_Revision_12_2026-10-16.md. |
| Revision 11 | 8 October 2026 | Superseded; expansion record, never governing | Expansion record of what was built, not reviewed; never governing. Archived at archive/specifications/master-specification/. Not incorporated; see Appendix E. |
| Revision 10 | 6 October 2026 | Superseded; not adopted | Duration display addendum to Revision 9. Archived at archive/specifications/master-specification/. Not incorporated; see Appendix E. |
| Revision 9 | 5 October 2026 | Superseded; not adopted | Stablecoin valuation rule. Archived at archive/specifications/master-specification/. Not incorporated; see Appendix E. |
| Revision 8 | 3 October 2026 | Superseded; not adopted | Change of authority and launch-set rule restated as a requirement. Archived at archive/specifications/master-specification/. Not incorporated; see Appendix E. |
| Revision 7 | 3 October 2026 | Superseded; not adopted; never committed to this repository | Known here only through the Revision 8 text. See Appendix E. |
| Revision 6 | 28 July 2026 | Superseded | Base text of Revision 14. Archived at archive/specifications/master-specification/Vinculum_Finalis_Master_Specification_Revision_6_2026-07-28.docx (SHA-256 5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9). Its Handshake rules are retired; the current Handshake rule is in Section 5.2. Revision 5's 17-environment and 1,001-entry registry corrections were carried forward; the environment set is now the 16 in Section 11.1. (Changed in Revision 15, source: operator directive t350u, 2026-10-24.) |
| Revision 5 | 28 July 2026 | Superseded | Owner-authorized correction: retains native BCH; assigns Appendix C row 54 to the Bitcoin Cash environment; expands the supported set from 16 to 17; splits the former Bitcoin count of 2 into Bitcoin 1 and Bitcoin Cash 1; and updates the corresponding environment, Dev Fund, chain-identifier, finality, and deployment-count requirements. No asset is added or removed; the registry remains exactly 1,001 entries. |
| Revision 4 | 27 July 2026 | Superseded | Replaces predetermined registry-file byte identity with semantic conformity to Appendix C; adds VF-REG-011; removes the review-time file-hash requirement; clarifies deployment evidence; and replaces the registry companion guidance. No asset identity, environment, classification, pricing identifier, or other protocol behavior changes. |
| Revision 3 | 27 July 2026 | Superseded | Adds VF-COM-026 to make the one-hour duration exclusive to a qualifying Trust-Building Handshake; records the prior-file review evidence; and introduces a registry-file provenance control later superseded by the current semantic registry rule. No other protocol behavior changes. |
| Revision 2 | 27 July 2026 | Superseded | Synchronizes all settled behavior; replaces the prior Handshake, oracle, Treasury Reward Stake activation, environment, S2, cross-chain, Axelar ITS, cap, epoch, proof, fee-destination, terminology, and deployment language; incorporates the complete 1,001-entry registry. |
| Revision 1 | 25 July 2026 | Superseded | First comprehensive current-state specification and original-form fee-routing accounting revision. |

| STATUS Revision 19 is the current governing edition. It supersedes all prior revisions, including Revision 18. (Changed in Revision 19, source: operator t427u, 2026-10-26.) Every rule is stated in this file. Items whose adoption is not settled are listed in Appendix E and are not part of the governing text. This specification records no implementation status; status is in testing-rigs/MASTER_FINDINGS.md and the gap report. (Changed in Revision 15, source: operator directive t350u, 2026-10-24.) |
|---|

## Appendix E. Not adopted / pending

(Added in Revision 14; carried forward in Revision 15.) Nothing in this appendix is part of the governing text. Each item stays here until a later revision or a recorded operator decision settles it.

| Item | What it says | Source | Why it is not in the governing text |
|---|---|---|---|
| E-1 | Revision 7 (3 October 2026): launch-set rule, a 117-byte binding payload in the order VF-XCH-032 states, its SHA-256 fingerprint, and the Stellar memo. | Known only through the Revision 8 text: archive/specifications/master-specification/Vinculum_Finalis_Master_Specification_Revision_8_2026-10-03.docx. Revision 7 itself was never committed to this repository. | Not adopted. |
| E-2 | Revision 8 (3 October 2026): change of authority; Revision 6 called obsolete; the launch-set rule restated as a requirement (source transaction, finality condition with its number, Base check). | archive/specifications/master-specification/Vinculum_Finalis_Master_Specification_Revision_8_2026-10-03.docx | Not adopted. The lock contracts and lock tests cite "Revision 8" in comments; that does not adopt it. |
| E-3 | UTXO confirmation counts: Litecoin 24, Dogecoin 60, DigiByte 10, Bitcoin Cash 15, described as exchange deposit counts, not chain law. Arbitrum challenge window 45,818 L1 blocks. Dogecoin fee details. | archive/specifications/master-specification/LOCK_REPORT_REV8.md; the code (base-contracts/contracts/checkers/ArbitrumFinalityChecker.sol and the UTXO readers). Vinculum_Finalis_Architecture_Design.md marks the finality rules as design defined. | Appear only in a Revision 8 report and the code. Not folded as rules. Bitcoin six confirmations and Zcash ten confirmations are not affected by this item. |
| E-4 | Revision 9 (5 October 2026): Ethereum USDC and USDT valued at the registry's last successful scheduled price with no dollar assumption; a Handshake-only value floor; standard locks have no floor and keep the $10 minimum; a bound lock keeps its creation price. | archive/specifications/master-specification/Vinculum_Finalis_Master_Specification_Revision_9_2026-10-05.docx | Not adopted. Its Handshake floor is in any case replaced by the VF-COM-003 band. Its $10 standard minimum is replaced by VF-COM-009 at $0.01. (Changed in the Base-only replacement, source: operator orders t169u, t419u and t422u; D-77.) |
| E-5 | Revision 10 (6 October 2026): the app shows the sixteen durations as 1 hour, 7, 30, 60, 90 and 180 days, then 1 to 10 years. Contract values unchanged. | archive/specifications/master-specification/Vinculum_Finalis_Master_Specification_Revision_10_2026-10-06.md (committed to main 2026-10-06, cf7e577) | No adoption record. It is an addendum to Revision 9, which is not adopted, and the app labels still show days (src/lib/vfRevision6Authority.js:81-96). Section 5.1 is unchanged. |
| E-6 | Revision 11 (8 October 2026): expansion record of what was built. | archive/specifications/master-specification/Vinculum_Finalis_Master_Specification_Revision_11_2026-10-08.md | Not reviewed; never adopted (archive/specifications/session-start/VINCULUM_SESSION_START_Revision_1_2026-10-12.md). |
| E-7 | After Revision 12 removed the Handshake identity: how Section 5.2.3 (pending-attempt disposition), the canonical release public key (Appendix B), and the UTXO release-path and release-key items in VF-VER-003 and VF-VER-004 now apply. | docs/Vinculum_Finalis_Master_Specification_Revision_12_2026-10-16.md; Revision 6 Sections 5.2.3, 16, Appendix B | Revision 12 does not address them. They are carried forward unchanged as text. |
| E-8 | Minimum value for durations other than one hour: the deployed contract minimum is $0.01. Revision 18 VF-COM-009 said $10.00. | archive/specifications/session-start/VINCULUM_SESSION_START_Revision_2_2026-10-20.md; VF-COM-009; operator orders t169u (2026-10-15), t419u and t422u (2026-10-25); D-77 | Resolved: corrected in the Base-only replacement. VF-COM-009 sets the standard minimum at $0.01, matching the deployed contract minimum (operator orders t169u and t422u). No code change. (Changed in the Base-only replacement, source: operator orders t169u, t419u and t422u; D-77.) |
| E-9 | The registry written for the Revision 18 Base-only release is Revision C (base-contracts/deployment/assetRegistry.revC.json, 487 rows, SHA-256 5c3311eb4f7b59c34e7ccc8a6bd9e817b4f0bb02bdeff65c5cfed98f79cca581), a full copy of Revision B with row 454 USDC_BASE set to class 1. Revision B (487 rows, SHA-256 1bdcb8346ab95abe5225adcffb9c5c3c7bb40c6cd5f1a851d3ed05bb2d77e2a9) stays pinned, with its hash lock and registry pin unchanged. | base-contracts/deployment/assetRegistry.revC.json; base-contracts/deployment/ASSET_REGISTRY_REVISION_B.md | It is a historical deployment registry, not a specification amendment and not the governing registry of this release. Revision 18's Appendix C listed its 27 Base rows; this replacement's Appendix C lists the Base rows of registry Revision E. (Changed in Revision 18, source: operator t361u, 2026-10-24.) (Changed in the Base-only replacement, source: operator t427u, 2026-10-26.) |
| E-10 | Revision 13 follow-ups: optionally make non-Base locks refuse VCLM, CHONX and SYNTH copies; correct src/lib/vfComplianceData.js, which marks VF-XCH-018 to VF-XCH-021 and VF-SUP-014 as implemented; write an ITS build and test plan when ITS is connected. | docs/Vinculum_Finalis_Master_Specification_Revision_13_2026-10-22.md, Section 5 | Withdrawn. Axelar ITS is not part of this launch (Section 11.4). (Changed in the Base-only replacement, source: operator t427u, 2026-10-26.) |
| E-11 | Withdrawn in Revision 15. Revision 14 recorded a per-environment reader finality classification here. This specification records no status. | Operator Revision 15 text t349u, 2026-10-24 | The requirement is Section 11.5. Status is in testing-rigs/MASTER_FINDINGS.md and the gap report. |
