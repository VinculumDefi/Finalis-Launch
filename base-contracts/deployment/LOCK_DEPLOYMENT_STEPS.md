# 5% lock deployment steps (prepared, NOT broadcast)

Prepared 2026-10-20 (ET). Nothing in this document has been sent to any live
chain. No keys are in the repository and none were read. Addresses are
shortened on purpose.

## Why new locks are needed
The live locks charge 2.5% on the 1-hour Handshake. A deployed lock cannot be
changed, so a new lock is deployed on each of the seven EVM chains. The old
locks stay on-chain and are not touched.

## The contract
`contracts/CommitmentVaultLock.sol`, one deployment per chain, constructor
`(string environmentId, address devFund)`. Built with solc 0.8.19, optimizer
200 runs, viaIR. The source already charges exactly 5% on every duration, so
it was not changed:

- line 45: `STANDARD_FEE_BPS = 500`, line 46: `BPS_DENOMINATOR = 10000`.
- line 327: `fee = (gross * STANDARD_FEE_BPS) / BPS_DENOMINATOR;` is the only
  fee line. Line 328: `principal = gross - fee;`.
- line 320: the Handshake branch only checks the $0.01 to $0.02 band. It does
  not change the fee.
- line 61: `devFund` is `immutable`. There is no owner and no setter. The only
  state-changing functions are `createNativeLock`, `createErc20Lock` and
  `release`.
- lines 170 and 222: the fee goes to `devFund` (native and ERC-20).
- lines 233 to 246: `release` needs `block.timestamp >= maturity`, not already
  released, and the caller must be the recorded destination. It pays the
  principal (95%) to that destination only.

Dev Fund on all seven chains: `0xFD21…3e9a` (`deployment/representativeBase.cjs`).

## Prepared values
From `node scripts/prepareLockDeploy.cjs` (writes
`deployment/lockDeploy.prepared.json`). Gas was read from one public RPC per
chain with `eth_estimateGas` on 2026-10-20 at 2:37 PM ET. Read only.

- Creation bytecode hash (same on all chains): `0x2daadaf6…80bd99`
- Expected runtime code hash after deploy (same on all chains, because the
  environment id is kept in storage and the Dev Fund is the same):
  `0x883ef245…91b305` (6,923 bytes)

| Order | Chain | Chain id | Constructor args | Init code hash | Gas estimate | Cost at read time |
|---|---|---|---|---|---|---|
| 1 | Ethereum | 1 | ("Ethereum", 0xFD21…3e9a) | 0x8bfa556b… | 1,596,454 | about 0.00037 ETH at 0.23 gwei |
| 2 | Arbitrum | 42161 | ("Arbitrum", 0xFD21…3e9a) | 0x94931b17… | 1,612,610 | about 0.000032 ETH at 0.02 gwei |
| 3 | Optimism | 10 | ("Optimism", 0xFD21…3e9a) | 0x9ab278d9… | 1,596,454 | about 0.0000016 ETH at 0.001 gwei, plus L1 data fee |
| 4 | Polygon | 137 | ("Polygon", 0xFD21…3e9a) | 0xbe8dc86e… | 1,599,828 | about 0.44 POL at 275 gwei |
| 5 | BNB Smart Chain | 56 | ("BNB Smart Chain", 0xFD21…3e9a) | 0xe6df23e8… | 1,596,538 | about 0.00008 BNB at 0.05 gwei |
| 6 | Avalanche | 43114 | ("Avalanche", 0xFD21…3e9a) | 0x84059865… | 1,596,466 | about 0.004 AVAX at 2.5 gwei |
| 7 | Base | 8453 | ("Base", 0xFD21…3e9a) | 0xdd44a7c2… | 1,596,405 | about 0.0000096 ETH at 0.006 gwei, plus L1 data fee |

Gas prices move. On Optimism and Base the wallet also charges an L1 data fee
for the 7,804-byte creation data, which `eth_estimateGas` does not include.
Keep a margin of at least 3 times the figure above in the deployer wallet.
Run the script again on the day to refresh the numbers.

## Operator steps, in order
Do these only after you approve the live deployment. Each step is a MetaMask
signature you make yourself.

### Stage 1: six non-Base locks (any order)
For each of Ethereum, Arbitrum, Optimism, Polygon, BNB Smart Chain, Avalanche:
1. Run `node scripts/prepareLockDeploy.cjs` to refresh gas. Check the chain
   line shows a gas figure, not an RPC error.
2. Open `scripts/deploy-pages/<chain>.html` in the browser with MetaMask.
3. Connect the deployer wallet. The page checks the chain id (table above) and
   refuses the wrong chain. Switch network if asked.
4. Sign the one deploy transaction. The page has the environment id and the
   Dev Fund `0xFD21…3e9a` built in; step 6 confirms both on-chain.
5. Write down the new lock address.
6. Run the read-only post-deploy check:
   `node scripts/prepareLockDeploy.cjs --check "<Chain>" <newLockAddress>`.
   It must print `ALL CHECKS PASSED`. It reads:
   - the runtime code hash equals `0x883ef245…91b305`;
   - `environmentId` equals the chain name;
   - `devFund` equals `0xFD21…3e9a`;
   - `STANDARD_FEE_BPS` = 500, `BPS_DENOMINATOR` = 10000, `HANDSHAKE_DURATION` = 3600;
   - a simulated lock (`eth_call`, nothing sent) on each of the sixteen
     durations returns a fee of exactly 5%;
   - a duration that is not in the table is refused.
   The simulated sender is the Dev Fund. If the Dev Fund holds less than
   0.00000001 of the chain's coin, add any funded public address as a third
   argument.
   If any line says FAIL, stop. Do not use that lock.

### Stage 2: Base lock (inside the Base ceremony)
The new Base lock is `BaseCommitmentVaultLock("Base", Dev Fund, VCLM, CHONX,
Forge)`, deployed by `scripts/deploy-pages/base.html` as the 6th prompt of the
Base ceremony, right after VCLM, CHONX, the Verifier, Forge and Stake (see
`LIVE_DEPLOYMENT_ORDER.md`). It holds the three protocol token addresses as
fixed constructor values (no setter) and refuses them as lock inputs before any
fee is taken (VF-TOK-007). There is no separate Base lock page, because the
ceremony must bind its Base reader to the lock it just deployed and the lock
needs the token addresses. The page logs `Base lock 0x…` after the five token
and core contract lines. Run
`node scripts/prepareLockDeploy.cjs --check Base <newBaseLockAddress>` before
signing the 7th prompt; if it fails, reject the prompt and stop. The six
non-Base locks stay plain `CommitmentVaultLock` (unchanged code, creation code
hash `0x2daadaf6…80bd99`): VCLM, CHONX and SYNTH exist only on Base.

## Later steps (separate, NOT done now)
These come after all seven locks pass the check. Each needs its own approval.
1. Register the new lock addresses in the Revision B verifier. This is done by
   the rest of the Base ceremony (`base.html`): deploy the readers bound to the
   seven new locks, register them, write the registry, set the Dev Funds, the
   first price, the poster `0x6001…0DB4`, then `finalize()`. Finalize is
   permanent. The page refuses an old 2.5% lock address.
2. Update the app config with the seven new lock addresses and the new Base
   contracts in one step: `scripts/applyCeremonyAddresses.cjs` writes
   `src/lib/vfDeployedAddresses.js`, which `src/lib/vfIntegrationConfig.js`
   reads (see `DEPLOYMENT_DAY_RUNBOOK.md`). Base44 app changes are made in the
   Base44 app, not here (Base44 instructions, section 6).
3. Retire the 2.5% locks in the app: stop offering the old Base lock
   `0x968B…C946` and the old non-Base locks. They stay on-chain; existing
   locks there can still be released by their destinations at maturity.

## Order relative to the verifier
- The six non-Base locks must exist before the Base ceremony starts, because
  `base.html` asks for their addresses and binds readers to them before
  `finalize()`.
- The Base lock is deployed inside the ceremony after VCLM, CHONX, the
  Verifier, Forge and Stake, and before the readers.
- After `finalize()` no reader can be added, so a lock missed before finalize
  cannot be added later. Do not start the ceremony until all six checks pass.
- The live finalized verifier `0xb067…f47D` is not changed by any of this.

## Resolved: BTC, BCH and LTC Handshakes (commit b1ef1f5)
Before: the verifier accepted a Handshake only when the lock was worth $0.01
to $0.02. On Bitcoin, Bitcoin Cash and Litecoin a 5% fee output that small is
below dust, so every Handshake on these chains was refused.

What changed, in the Revision B verifier only (`contracts/VinculumFinalisVerifier.sol`,
not yet deployed; the live finalized verifier `0xb067…f47D` is unchanged):
- For a Bitcoin, Bitcoin Cash or Litecoin native Handshake (3600 s), the gross
  must be inside a band in coin units, inclusive: Bitcoin and Bitcoin Cash
  11,000 to 22,000 sats, Litecoin 110,000 to 220,000 litoshis. Outside it the
  verifier refuses with "VF-COM-003: handshake gross below unit band" or
  "above unit band". The three chains are found by their proven native asset
  id and environment together.
- The USD used for that Handshake's VCLM and RAC is capped at $0.02.
- The fee must still be exactly 5% of the real gross.
- Every other chain keeps the $0.01 to $0.02 USD Handshake band, unchanged.
- No lock contract changed. `ceremony.json` carries the new verifier
  (creation code hash `0x63128c66…572263` at that commit; replaced in t262u,
  see `DEPLOYMENT_DAY_RUNBOOK.md` 1.5 for the current hash). `scripts/broadcast.html` is retired
  (t251u) and embeds no contract.
- `utxo-locks/lock.py`, its regtest and the app use the same band (t239u).
