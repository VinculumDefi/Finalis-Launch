# Vinculum session start

Revision 11, 2026-10-27 (ET). Read this first in every new session. It says
what governs, what the launch scope is, and the rules. It replaces Revision 10
of 2026-10-27 (see History at the end).

The operator is not a programmer. One step at a time. Plain English. Do not
build, commit, change, deploy or send anything until the operator asks.

## Repository
https://github.com/VinculumDefi/Finalis-Launch, branch main.

Revision 19 of the Master Specification (2026-10-27) is the governing edition.
The active asset registry is Revision E (2,893 Base entries), recorded in
`DOCUMENT_REGISTER.md`. This session start is Revision 11. Check
`git log -1 origin/main` for the newest commit.

Start with these files:
1. `DOCUMENT_REGISTER.md` (every controlled document, its current revision,
   its path and its SHA-256; the single source of truth for which copy
   governs)
2. `docs/Vinculum_Finalis_Master_Specification_Revision_19_2026-10-27.md`
   (Revision 19, the current governing specification)
3. `base-contracts/deployment/assetRegistry.revE.json` (the active registry,
   Revision E, 2,893 Base entries; its SHA-256 is in `DOCUMENT_REGISTER.md`)
4. `deployment/BASE44_LIVE_CONFIG_2026-10-22.md` (record of the earlier Base
   deployments, which are retired; see "Retired locks: release only")
5. `testing-rigs/MASTER_FINDINGS.md` and `testing-rigs/FIX_LOG_2026-10-23.md`
   (open findings and recorded operator decisions)
6. `src/lib/vfLiveRules.js` (the contract values the app uses)

If a file is missing, list the folder. Do not invent the file.

## Governing specification
- Revision 19 governs:
  `docs/Vinculum_Finalis_Master_Specification_Revision_19_2026-10-27.md`.
- Its SHA-256 is
  `0d2d56cb37dbf11d7986a731b305a14c418273c5786a4c0db8c5ee9b38aabcad`.
  The same hash is in `DOCUMENT_REGISTER.md`. If the file's hash does not
  match, stop and tell the operator.
- Every rule is stated in that file. No rule comes from an earlier revision
  by reference. Earlier revisions are in `archive/specifications/` and do
  not govern.
- Changes whose adoption is unclear are not in the governing text. They are
  in Revision 19, Appendix E ("Not adopted / pending").

## Revision control
- To make a new revision: copy the current revision, edit the copy, and save
  it as the next revision number. Move the old file to
  `archive/specifications/`. Update the authority file,
  `DOCUMENT_REGISTER.md`, with the new file's SHA-256. The new file, the
  archive move and the register update go in the same commit.
- This session start always names only the live revision, by number and
  SHA-256.
- One live copy per document. It is the copy listed in `DOCUMENT_REGISTER.md`.
  Nothing is deleted.
- Each new edition bumps the revision number and adds a row to its history
  table.

## Launch scope
- The launch scope is Base only: this release mints on Base and locks on Base
  (Revision 19, Sections 3.1 and 11.1). Every approved asset is a Base entry in
  Appendix C: 2,893 entries (registry Revision E).
- Base is the canonical issuance and accounting blockchain for VCLM, CHONX and
  SYNTH. They are ordinary Base-native tokens, with one supply each, issued on
  Base (Sections 11.4 and 13.4). Axelar ITS is not part of this launch.
- No independent or separately issued VCLM, CHONX or SYNTH supply may be
  created on another blockchain (VF-XCH-019).
- Base verification authorizes every mint (Section 3.2).
- The launch is final. After finalize there are no controls (Section 2,
  VF-IMM-001 to VF-IMM-004).
- Readers are required. They must not be disabled.

## Governing rules
- The Handshake is one hour. Its fee is 5%, the same uniform 5% on every
  chain and every duration. It is worth $0.01 to $0.02. There is no
  allowance limit. (Revision 19, VF-COM-003, VF-COM-004 and VF-COM-006.)
- Revision 19 VF-COM-003 also sets coin-unit bands for Bitcoin, Bitcoin Cash
  and Litecoin native Handshakes. Those chains are not in this launch.
- Every other duration needs at least $0.01 (Revision 19, VF-COM-009).
- Only the sixteen durations are permitted. Ten years is 8.0x.
- The 120-day stake multiplier is 2.1x (Revision 19, Section 10.1).
- A lock issues one token, VCLM or activated CHONX, to its Base recipient after
  Base verification. Maturity returns the principal only.
- A lock keeps the reference price that applied when it was created
  (VF-ORC-009). With no usable scheduled price there is no valuation (fail
  closed). No hardcoded or substitute price (VF-ORC-004, VF-ORC-005).
- A successful scheduled price stays in effect until the next scheduled run.
  A scheduled run that produces no valid price makes that asset unavailable
  until a later successful run (VF-ORC-008).
- CHONX output activates when cumulative lifetime VCLM issuance reaches
  10,000,000 (VF-TOK-002).
- Cosmos is dropped. It is not an environment, not a registry row in use, and
  not in the app.

## Retired locks: release only
- Retired locks are never used for a new lock. A lock already on them can
  still be released by its recorded destination at or after maturity.
- The 2026-10-12 set: Base lock `0x968B…C946`, non-Base lock `0x4eDE…3b1a`
  (Ethereum, Arbitrum, Optimism, Polygon, BNB Smart Chain, Avalanche), and its
  Verifier `0xb067…f47D` (finalized, stays on-chain, not used).
- The Oct 21 set listed in `deployment/BASE44_LIVE_CONFIG_2026-10-22.md` is
  retired and is never used.
- The saved apps in `app/base44-lock-2026-10-12/` and
  `app/base44-lock-2026-10-13/` are history.

## Standing operator rules
- No deploy, broadcast, register or finalize without the operator's explicit
  go-ahead for that exact step. Never ask for or read keys.
- Fail closed. Do not invent prices, labels or addresses.
- Do not read full addresses back to the operator. Shorten them, for example
  `0x6001…0DB4`.
- Plain English. No em-dashes. No analogies.
- Whole-file edits. One file per commit, except a new revision: the new file,
  the archive move and the register update go in one commit. Secret-scan
  before every commit.
- Push to main only after the tests pass: app tests, lint, build, Python tests
  and the full Hardhat suite run alone
  (`cd base-contracts && NODE_OPTIONS=--max-old-space-size=12288 npx hardhat test`).
- Do not change Solidity, verifier contracts or Rust programs unless the
  operator asks.
- Keep the historical registry (`deployment/assetRegistry.resolved.json`, 961
  written rows). It is not the active list. Do not delete or rewrite it.
- Do not touch the live Base44 app; write instructions for it instead.
- Report times in ET.

## Echo rule
Every new session must open by quoting the standing rules and the governing
rules from this document verbatim before any other work. If the session
cannot quote them, it must stop and ask.

Minimum list (operator wording, verbatim):

(1) master spec is the sole governing document — check it before proposing anything new;
(2) no status updates in the spec, only requirements;
(3) freshness is Revision 7 Section 7 only — no new freshness policies;
(4) no deploy, broadcast, register, or finalize without explicit operator go-ahead;
(5) the operator is not a programmer — one step at a time, plain English, whole files not line edits.

Do not reopen settled decisions. Do not invent new rules that contradict the master spec.

## Gap-escalation rule
When the governing specification does not explicitly cover a proposed action
or design choice, raise the gap against the spirit and existing requirements
of the specification and ask the operator before building or assuming a
rule. Do not invent new rules that contradict or extend settled policy
without explicit operator approval.

## Settled architecture decisions (Revision 19)
Base only. Base is the canonical issuance and accounting blockchain. VCLM,
CHONX and SYNTH are ordinary Base-native tokens with one supply each, issued on
Base. Axelar ITS is not part of this launch. Commitment Vault principal stays
on its source blockchain, and its release at maturity does not depend on Base
issuance. One verified Commitment Vault Lock authorizes one selected output
token, VCLM or activated CHONX. The registry is the 2,893-entry Base list in
Appendix C. After finalization there is no governance, upgrade, pause or
discretionary control.

## History
| Revision | Date | Change | Archived copy |
|---|---|---|---|
| 11 | 2026-10-27 | Operator minimum list and the instruction not to reopen settled decisions added verbatim (operator t470u, wording from t407u). Nothing else changed. | This file (current) |
| 10 | 2026-10-27 | Launch scope, governing rules and settled decisions rewritten to match Revision 19 (Base only, Revision E registry of 2,893 entries, minimum $0.01, no Axelar ITS). Standing operator rules, Echo rule and Gap-escalation rule unchanged. | `archive/specifications/session-start/VINCULUM_SESSION_START_Revision_10_2026-10-27.md` |
| 9 | 2026-10-27 | Revision 19 governs, named by number and SHA-256. Only the governing-specification reference changed. | `archive/specifications/session-start/VINCULUM_SESSION_START_Revision_9_2026-10-27.md` |
| 8 | 2026-10-25 | Launch scope rewritten for the seven-chain simultaneous launch (operator t418u). | `archive/specifications/session-start/VINCULUM_SESSION_START_Revision_8_2026-10-25.md` |
| 7 | 2026-10-25 | Base-only launch scope line and future-work line removed. Live deployment section removed. Echo rule, Gap-escalation rule and Settled architecture decisions (2026-10-25) added. Revision 3 history wording updated. | `archive/specifications/session-start/VINCULUM_SESSION_START_Revision_7_2026-10-25.md` |
| 6 | 2026-10-24 | Revision 18 governs, named by number and SHA-256. Registry Revision C identifier and pin added. | `archive/specifications/session-start/VINCULUM_SESSION_START_Revision_6_2026-10-24.md` |
| 5 | 2026-10-24 | Revision 17 governs, named by number and SHA-256. | `archive/specifications/session-start/VINCULUM_SESSION_START_Revision_5_2026-10-24.md` |
| 4 | 2026-10-24 | Revision 16 governs, named by number and SHA-256. Revision control rule. Launch scope: Base only. Finality status lines and old precedence lines removed. | `archive/specifications/session-start/VINCULUM_SESSION_START_Revision_4_2026-10-24.md` |
| 3 | 2026-10-24 | Revision 14 governs. Reader finality rule. Document control. Revision B, cbETH hide. Planned-deployment section removed. | `archive/specifications/session-start/VINCULUM_SESSION_START_Revision_3_2026-10-24.md` |
| 2 | 2026-10-20 | Revision 12 Handshake. Cosmos dropped. Plan for the 2026-10-21 deployment. | `archive/specifications/session-start/VINCULUM_SESSION_START_Revision_2_2026-10-20.md` |
| 1 | 2026-10-12 | Orientation reading list. The 2026-10-12 contracts and mint proof. | `archive/specifications/session-start/VINCULUM_SESSION_START_Revision_1_2026-10-12.md` |
