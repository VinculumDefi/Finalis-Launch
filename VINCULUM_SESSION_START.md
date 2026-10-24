# Vinculum session start

Revision 3, current as of Saturday 2026-10-24 (ET). Read this first in every
new session. It says what is live, what governs, and the rules. It replaces
Revision 2 of 2026-10-20 (see History at the end).

The operator is not a programmer. One step at a time. Plain English. Do not
build, commit, change, deploy or send anything until the operator asks.

## Repository
https://github.com/VinculumDefi/Finalis-Launch, branch main.

The document control pass merged to main at 69e069a. Main at 50851dd has the
Handshake cleanup and the full Hardhat suite at 849 passing, 0 failing. Check
`git log -1 origin/main` for the newest commit.

Start with these files:
1. `DOCUMENT_REGISTER.md` (every controlled document, its current revision
   and its path; the single source of truth for which copy governs)
2. `docs/Vinculum_Finalis_Master_Specification_Revision_14_2026-10-24.md`
   (Revision 14, the current governing specification)
3. `deployment/BASE44_LIVE_CONFIG_2026-10-22.md` (the live Base set)
4. `testing-rigs/MASTER_FINDINGS.md` and `testing-rigs/FIX_LOG_2026-10-23.md`
   (open findings and recorded operator decisions)
5. `src/lib/vfLiveRules.js` (the contract values the app uses)

If a file is missing, list the folder. Do not invent the file.

## Governing specification
- Revision 14 governs:
  `docs/Vinculum_Finalis_Master_Specification_Revision_14_2026-10-24.md`.
- It carries forward the full text of Revision 6 and folds in only adopted
  changes: Revision 12 (the Handshake), Revision 13 (ITS timing only), the
  Cosmos drop, the 120-day stake multiplier of 2.1x, and the 2026-10-24
  reader finality rule. Each change is marked with its source.
- Precedence is settled. Revision 6 governs everything except the Handshake
  (Revision 12) and ITS timing (Revision 13). The Revision 8 and 9 wording
  that calls Revision 6 obsolete is not adopted.
- Changes whose adoption is unclear are not in the governing text. They are in
  Revision 14, Appendix E ("Not adopted / pending").
- The Revision 6 original is archived unchanged at
  `archive/specifications/master-specification/Vinculum_Finalis_Master_Specification_Revision_6_2026-07-28.docx`.
  Its SHA-256 is
  `5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9`
  (computed on the archived file in this pass).

## Governing rules
- The Handshake is one hour. Its fee is 5%, the same uniform 5% on every
  chain and every duration. It is worth $0.01 to $0.02. Bitcoin, Bitcoin Cash
  and Litecoin native Handshakes use a coin unit band instead (Bitcoin and
  Bitcoin Cash 11,000 to 22,000 sats; Litecoin 110,000 to 220,000 litoshis),
  and their value for VCLM and RAC is capped at $0.02.
- Every other duration needs at least $0.01 (the contract minimum). Revision 6
  VF-COM-009 still says $10.00. This difference is pending (Revision 14,
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

## Reader finality (operator directive, 2026-10-24)
All sixteen environments are required. Each needs a Base reader that proves
the lock is part of that chain's settled history before any Base issuance:
1. Ethereum
2. BNB Smart Chain
3. Avalanche
4. Polygon
5. Arbitrum
6. Base
7. Optimism
8. Bitcoin
9. Bitcoin Cash
10. Solana
11. XRP Ledger
12. Stellar
13. Litecoin
14. Dogecoin
15. DigiByte
16. Zcash

- Readers are required. They must not be disabled.
- Nothing is signed until each environment's finality gap is closed or scoped
  out by the governing specification.
- Solana is now required like every other environment. It is not in the live
  Base set, so the app still refuses Solana locks.
- The finality plan is in progress. It classifies 9 environments as closable
  (Base, Ethereum, Arbitrum, Optimism, Polygon, BNB Smart Chain, Bitcoin,
  Bitcoin Cash, Zcash) and 7 as not closable today (Avalanche, Solana,
  Litecoin, Dogecoin, DigiByte, XRP Ledger, Stellar). This is pending operator
  review. Nothing is implemented.

## Current live deployment (Base ceremony of 2026-10-22)
- The Oct 22 Base live set is finalized and immutable. Base lock
  `0xa1bE…3558`, Verifier `0xfA8A…6328`. Details are in
  `deployment/BASE44_LIVE_CONFIG_2026-10-22.md`.
- A finalized contract cannot be changed. Any fix needs a new deployment that
  the operator signs.
- The app offers new locks and mints on Base only. Every other network is
  refused until its reader finality gap is closed.
- Revision B has 487 rows. The registry pin and the hash lock are unchanged.
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

## Document control
- One live copy per document. It is the copy listed in `DOCUMENT_REGISTER.md`.
- Superseded editions go to `archive/specifications/`. Nothing is deleted.
- Each new edition bumps the revision number and adds a row to its history
  table.
- A file that code, a test or a script reads by path stays where it is. It
  gets a superseded header instead and is listed in the register.
- `DOCUMENT_REGISTER.md` is the single source of truth for which edition
  governs.

## Standing operator rules
- No deploy, broadcast, register or finalize without the operator's explicit
  go-ahead for that exact step. Never ask for or read keys.
- Fail closed. Do not invent prices, labels or addresses.
- Do not read full addresses back to the operator. Shorten them, for example
  `0x6001…0DB4`.
- Plain English. No em-dashes. No analogies.
- Whole-file edits. One file per commit. Secret-scan before every commit.
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
| 3 | 2026-10-24 | Revision 14 governs. Reader finality rule. Document control. Oct 22 live set, Revision B, cbETH hide. Planned-deployment section removed. | This file (current) |
| 2 | 2026-10-20 | Revision 12 Handshake. Cosmos dropped. Plan for the 2026-10-21 deployment. | `archive/specifications/session-start/VINCULUM_SESSION_START_Revision_2_2026-10-20.md` |
| 1 | 2026-10-12 | Orientation reading list. The 2026-10-12 contracts and mint proof. | `archive/specifications/session-start/VINCULUM_SESSION_START_Revision_1_2026-10-12.md` |
