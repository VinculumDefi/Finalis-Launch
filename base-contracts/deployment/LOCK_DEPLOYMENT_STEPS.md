# 5% lock deployment steps (Base-only launch, prepared, NOT broadcast)

Nothing in this document has been sent to any live chain. No keys are in the
repository and none were read. Addresses are shortened on purpose.

Founder directive t357u: the launch is Base-only. One lock is deployed: the
Base lock, inside the Base ceremony. No lock is deployed on any other chain.
`contracts/CommitmentVaultLock.sol` and the other lock contracts stay in the
source tree, with their tests, and are not deployed.

## Why a new lock is needed
The live locks charge 2.5% on the 1-hour Handshake. A deployed lock cannot be
changed, so a new Base lock is deployed. The old locks stay on-chain and are
not touched.

## The contract
`contracts/BaseCommitmentVaultLock.sol`, constructor
`(string environmentId, address devFund, address vclm, address chonx, address synth)`.
Built with solc 0.8.19, viaIR. It charges exactly 5% of gross on every
duration, including the 1-hour Handshake:

- line 62: `STANDARD_FEE_BPS = 500`, line 63: `BPS_DENOMINATOR = 10000`,
  line 64: `HANDSHAKE_DURATION = 1 hours`.
- line 390: `fee = (gross * STANDARD_FEE_BPS) / BPS_DENOMINATOR;` is the fee
  line. The Handshake only checks the $0.01 to $0.02 band; it does not change
  the fee.
- `devFund` and the three protocol token addresses are `immutable`. There is
  no owner and no setter. The lock refuses VCLM, CHONX and SYNTH as lock
  inputs before any fee is taken (VF-TOK-007).
- `release` needs `block.timestamp >= maturity`, not already released, and the
  caller must be the recorded destination. It pays the principal (95%) to that
  destination only.

Base Dev Fund: `0xFD21…3e9a` (`deployment/representativeBase.cjs`).

## Deploying it
The Base lock is deployed by `scripts/deploy-pages/base.html` as the 6th
prompt of the Base ceremony, right after VCLM, CHONX, the Verifier, Forge and
Stake (see `LIVE_DEPLOYMENT_ORDER.md`). There is no separate lock page,
because the ceremony binds its one reader (BaseLockRecordVerifier) to the lock
it just deployed and the lock needs the token addresses. The page logs
`Base lock 0x…` after the five token and core contract lines.

Before signing the 7th prompt run the read-only check:

```
node scripts/prepareLockDeploy.cjs --check Base <newBaseLockAddress> [probeFrom]
```

It must print `ALL CHECKS PASSED`. It reads the masked runtime code hash, the
environment id, the Dev Fund, the three token addresses (and that each is
refused), `STANDARD_FEE_BPS` = 500, `BPS_DENOMINATOR` = 10000,
`HANDSHAKE_DURATION` = 3600, a simulated lock (`eth_call`, nothing sent) on
each of the sixteen durations returning a fee of exactly 5%, and that a
duration not in the table is refused. Every environment other than Base is
refused by the tool, and `--broadcast` is refused. If any line says FAIL,
reject the 7th prompt and stop.

## Later steps (after the ceremony)
1. `scripts/applyCeremonyAddresses.cjs` writes `src/lib/vfDeployedAddresses.js`
   with the Base lock and the new Base contracts (see
   `DEPLOYMENT_DAY_RUNBOOK.md`). Base44 app changes are made in the Base44
   app (Base44 instructions, section 6).
2. Retire the 2.5% locks in the app: stop offering the old Base lock
   `0x968B…C946` and the old non-Base locks. They stay on-chain; existing
   locks there can still be released by their destinations at maturity.

## Order relative to the verifier
- The Base lock is deployed inside the ceremony after VCLM, CHONX, the
  Verifier, Forge and Stake, and before the Base reader.
- After `finalize()` no reader can be added.
- The live finalized verifier `0xb067…f47D` is not changed by any of this.
