# Vinculum session start

Current as of 2026-10-20 (ET). Read this first in every new session. It says
what is live, what is planned, and the rules. It replaces the 2026-10-12
version of this file (see History at the end).

The operator is not a programmer. One step at a time. Plain English. Do not
build, commit, change, deploy or send anything until the operator asks.

## Repository
https://github.com/VinculumDefi/Finalis-Launch, branch main.

Start with these files:
1. `base-contracts/deployment/DEPLOYMENT_DAY_RUNBOOK.md` (the deployment day)
2. `base-contracts/deployment/LIVE_DEPLOYMENT_ORDER.md`
3. `base-contracts/deployment/LOCK_DEPLOYMENT_STEPS.md`
4. `docs/Vinculum_Finalis_Master_Specification_Revision_12_2026-10-16.md`
   (governs the Handshake)
5. `src/lib/vfRevision6Authority.js` (the Revision 6 record; governs
   everything else)
6. `src/lib/vfLiveRules.js` (the contract values the app uses)

If a file is missing, list the folder. Do not invent the file.

## Governing rules
- Revision 12 governs the Handshake: one hour, 5% fee (the same 5% as every
  other duration), worth $0.01 to $0.02. Bitcoin, Bitcoin Cash and Litecoin
  native Handshakes use a coin unit band instead (Bitcoin and Bitcoin Cash
  11,000 to 22,000 sats; Litecoin 110,000 to 220,000 litoshis), and their
  value for VCLM and RAC is capped at $0.02.
- Revision 6 governs everything else.
- Every other duration needs at least $0.01 (the contract minimum).
- Only the sixteen durations are permitted. Ten years is 8.0x.
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
- Solana is not part of this deployment. No Solana reader is registered and the
  app does not build or submit Solana locks. The Solana code is kept for later.

## Prior live deployment (2026-10-12): retired for new locks
The Base ceremony of 2026-10-12 is the prior live deployment. Its Verifier
(`0xb067…f47D`) is finalized and stays on-chain. Its locks charge 2.5% on the
Handshake, so they are retired:
- `0x968B…C946` on Base and `0x4eDE…3b1a` on Ethereum, Arbitrum, Optimism,
  Polygon, BNB Smart Chain and Avalanche.
- They are never used for a new lock.
- A lock already on them can still be released by its recorded destination at
  or after maturity (release only).
- Its VCLM, CHONX, Forge, Stake and Base reader are not used by the new
  deployment.

The saved app that minted on 2026-10-12 is at `app/base44-lock-2026-10-12/`
and `app/base44-lock-2026-10-13/`. They are history. The live Base44 app is
changed only through the Base44 instructions (sections 1 to 5 before the
ceremony, section 6 after it).

## Fresh deployment planned for 2026-10-21
Follow `base-contracts/deployment/DEPLOYMENT_DAY_RUNBOOK.md`. In short:
- Seven new 5% CommitmentVaultLock contracts: six lock pages (Ethereum,
  Arbitrum, Optimism, Polygon, BNB Smart Chain, Avalanche), then the Base lock
  inside the Base ceremony.
- The Base ceremony (`base.html`) deploys new VCLM, CHONX, Verifier, Forge and
  Stake, runs `VCLM.initialize(Verifier, Stake)` and
  `CHONX.initialize(Verifier, 0)`, registers 15 readers (Base, the six EVM
  chains, Bitcoin, Bitcoin Cash, Litecoin, Dogecoin, DigiByte, Zcash, Stellar,
  XRP Ledger; not Solana),
  writes Revision B (487 rows: 486 plus Base ETH), the token address index (475
  addresses) and three native aliases, sets the Dev Funds, writes price run 1,
  hands the price poster to `0x6001…0DB4`, and finalizes.
- After the ceremony: `scripts/applyCeremonyAddresses.cjs` writes the app's
  address file; Base44 section 6; the poster's price runs start at run 2.
- Use only the deploy pages. The old broadcast scripts and pages are retired.

Until the operator reports the ceremony finished, treat the new contracts as
not deployed.

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
The 2026-10-12 version of this file (orientation reading list on branch
redteam/prep, the 2026-10-12 contracts as then current, the 2026-10-12 mint
proof and Handshake counts) is in git history:
`git show 31c237a:VINCULUM_SESSION_START.md`.
