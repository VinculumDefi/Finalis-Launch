# Vinculum session start

Revision 6, current as of Saturday 2026-10-24 (ET). Read this first in every
new session. It says what is live, what governs, and the rules. It replaces
Revision 5 of 2026-10-24 (see History at the end).

The operator is not a programmer. One step at a time. Plain English. Do not
build, commit, change, deploy or send anything until the operator asks.

## Repository
https://github.com/VinculumDefi/Finalis-Launch, branch main.

Revision 18 of the Master Specification was added to main at e96d102.
Registry Revision C was added to main at 90ac322. This session start
(Revision 6) was added to main at (recorded in the next commit). Check
`git log -1 origin/main` for the newest commit.

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
- This launch is Base only: mint on Base, lock on Base.
- The sixteen environments in Revision 18, Section 11.1 stay defined in the
  specification. The other fifteen stay in the repository as future work.
  Each one is held to the same reader finality bar (Revision 18, Section
  11.5) before any Base issuance from it.
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

## Current live deployment (Base ceremony of 2026-10-22)
- The Oct 22 Base live set is finalized and immutable. Base lock
  `0xa1bE…3558`, Verifier `0xfA8A…6328`. Details are in
  `deployment/BASE44_LIVE_CONFIG_2026-10-22.md`.
- A finalized contract cannot be changed. Any fix needs a new deployment that
  the operator signs.
- A Base-only ceremony is being prepared. Nothing from it is deployed or
  signed.
- The app offers new locks and mints on Base only. Every other network is
  refused.
- Revision B has 487 rows. The registry pin and the hash lock are unchanged.
- Registry Revision C (`base-contracts/deployment/assetRegistry.revC.json`,
  SHA-256 `5c3311eb4f7b59c34e7ccc8a6bd9e817b4f0bb02bdeff65c5cfed98f79cca581`)
  is the registry written for the deployment under Revision 18. It is a full
  copy of Revision B with row 454 USDC_BASE set to S1. It is not wired into
  the live path; Revision B stays pinned.
- cbETH on Base is hidden at the app level only (HH-013, mitigated). It stays
  hidden until the label fix or a permanent drop
  (`testing-rigs/FIX_LOG_2026-10-23.md`, operator decision 2026-10-24).

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

## History
| Revision | Date | Change | Archived copy |
|---|---|---|---|
| 6 | 2026-10-24 | Revision 18 governs, named by number and SHA-256. Registry Revision C identifier and pin added. | This file (current) |
| 5 | 2026-10-24 | Revision 17 governs, named by number and SHA-256. | `archive/specifications/session-start/VINCULUM_SESSION_START_Revision_5_2026-10-24.md` |
| 4 | 2026-10-24 | Revision 16 governs, named by number and SHA-256. Revision control rule. Launch scope: Base only. Finality status lines and old precedence lines removed. | `archive/specifications/session-start/VINCULUM_SESSION_START_Revision_4_2026-10-24.md` |
| 3 | 2026-10-24 | Revision 14 governs. Reader finality rule. Document control. Oct 22 live set, Revision B, cbETH hide. Planned-deployment section removed. | `archive/specifications/session-start/VINCULUM_SESSION_START_Revision_3_2026-10-24.md` |
| 2 | 2026-10-20 | Revision 12 Handshake. Cosmos dropped. Plan for the 2026-10-21 deployment. | `archive/specifications/session-start/VINCULUM_SESSION_START_Revision_2_2026-10-20.md` |
| 1 | 2026-10-12 | Orientation reading list. The 2026-10-12 contracts and mint proof. | `archive/specifications/session-start/VINCULUM_SESSION_START_Revision_1_2026-10-12.md` |
