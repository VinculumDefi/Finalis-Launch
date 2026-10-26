# Vinculum session start

Revision 7, current as of Sunday 2026-10-25 (ET). Read this first in every
new session. It says what is live, what governs, and the rules. It replaces
Revision 6 of 2026-10-24 (see History at the end).

The operator is not a programmer. One step at a time. Plain English. Do not
build, commit, change, deploy or send anything until the operator asks.

## Repository
https://github.com/VinculumDefi/Finalis-Launch, branch main.

Revision 18 of the Master Specification was added to main at e96d102.
Registry Revision C was added to main at 90ac322. This session start
is Revision 7. Check `git log -1 origin/main` for the newest commit.

Start with these files:
1. `DOCUMENT_REGISTER.md` (every controlled document, its current revision,
   its path and its SHA-256; the single source of truth for which copy
   governs)
2. `docs/Vinculum_Finalis_Master_Specification_Revision_18_2026-10-24.md`
   (Revision 18, the current governing specification)
3. `deployment/BASE44_LIVE_CONFIG_2026-10-22.md` (the live Base set)
4. `testing-rigs/MASTER_FINDINGS.md` and `testing-rigs/FIX_LOG_2026-10-23.md`
   (open findings and recorded operator decisions)
5. `src/lib/vfLiveRules.js` (the contract values the app uses)

If a file is missing, list the folder. Do not invent the file.

## Governing specification
- Revision 18 governs:
  `docs/Vinculum_Finalis_Master_Specification_Revision_18_2026-10-24.md`.
- Its SHA-256 is
  `487735227ea32aa6914d180d5aa8fd0ef5028e56a5ab4c328a63168072ca44bc`.
  The same hash is in `DOCUMENT_REGISTER.md`. If the file's hash does not
  match, stop and tell the operator.
- Every rule is stated in that file. No rule comes from an earlier revision
  by reference. Earlier revisions are in `archive/specifications/` and do
  not govern.
- Changes whose adoption is unclear are not in the governing text. They are
  in Revision 18, Appendix E ("Not adopted / pending").

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
- Readers are required. They must not be disabled.

## Governing rules
- The Handshake is one hour. Its fee is 5%, the same uniform 5% on every
  chain and every duration. It is worth $0.01 to $0.02. There is no
  allowance limit. (Adopted in Revision 12, stated in Revision 18.)
- Revision 18 VF-COM-003 also sets coin-unit bands for Bitcoin, Bitcoin Cash
  and Litecoin native Handshakes. Those chains are not in this launch.
- Every other duration needs at least $0.01 (the contract minimum). Revision
  18 VF-COM-009 says $10.00. This difference is pending (Revision 18,
  Appendix E, item E-8).
- Only the sixteen durations are permitted. Ten years is 8.0x.
- The 120-day stake multiplier is 2.1x (`docs/TRS_CORRECTION_2026-10-17.md`).
- A lock issues one token, VCLM or activated CHONX, to its Base recipient after
  Base verification. Maturity returns the principal only.
- A lock's price is fixed the first time its fee is recorded. With no usable
  scheduled price the Verifier refuses (fail closed). No substitute price.
- The last successful scheduled price stays usable until the next successful
  run.
- `CHONX.initialize(Verifier, 0)` is the start state. CHONX output activates at
  10,000,000 lifetime VCLM.
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

## Gap-escalation rule
When the governing specification does not explicitly cover a proposed action
or design choice, raise the gap against the spirit and existing requirements
of the specification and ask the operator before building or assuming a
rule. Do not invent new rules that contradict or extend settled policy
without explicit operator approval.

## Settled architecture decisions (2026-10-25)
Seven chains: Ethereum, Base, Arbitrum, BNB Smart Chain, Polygon, Avalanche
C-Chain, and Optimism. One worldwide lifetime supply for each Vinculum token.
No permanent or temporary supply allocations to individual chains. One global
issuance authorization ledger on Base. Locally independent commitment vault
locks and principal releases. SYNTH forging on all seven chains. One Base44
application supporting all seven environments. Current Base token contracts
will not be reused in the new seven-chain token system.

## History
| Revision | Date | Change | Archived copy |
|---|---|---|---|
| 7 | 2026-10-25 | Base-only launch scope line and future-work line removed. Live deployment section removed. Echo rule, Gap-escalation rule and Settled architecture decisions (2026-10-25) added. Revision 3 history wording updated. | This file (current) |
| 6 | 2026-10-24 | Revision 18 governs, named by number and SHA-256. Registry Revision C identifier and pin added. | `archive/specifications/session-start/VINCULUM_SESSION_START_Revision_6_2026-10-24.md` |
| 5 | 2026-10-24 | Revision 17 governs, named by number and SHA-256. | `archive/specifications/session-start/VINCULUM_SESSION_START_Revision_5_2026-10-24.md` |
| 4 | 2026-10-24 | Revision 16 governs, named by number and SHA-256. Revision control rule. Launch scope: Base only. Finality status lines and old precedence lines removed. | `archive/specifications/session-start/VINCULUM_SESSION_START_Revision_4_2026-10-24.md` |
| 3 | 2026-10-24 | Revision 14 governs. Reader finality rule. Document control. Revision B, cbETH hide. Planned-deployment section removed. | `archive/specifications/session-start/VINCULUM_SESSION_START_Revision_3_2026-10-24.md` |
| 2 | 2026-10-20 | Revision 12 Handshake. Cosmos dropped. Plan for the 2026-10-21 deployment. | `archive/specifications/session-start/VINCULUM_SESSION_START_Revision_2_2026-10-20.md` |
| 1 | 2026-10-12 | Orientation reading list. The 2026-10-12 contracts and mint proof. | `archive/specifications/session-start/VINCULUM_SESSION_START_Revision_1_2026-10-12.md` |
