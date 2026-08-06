# Vinculum Finalis — Base Contracts and Test Harness

**Status: PRE-DEPLOYMENT. Not audited. Not deployed. Do not deploy.**

Governing authority: `Vinculum_Finalis_Master_Specification_Revision_6_2026-07-28.docx`
SHA-256 `5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9`

Where this code and the specification disagree, the specification governs.

---

## Run it

```
npm install --legacy-peer-deps
npx hardhat compile
npx hardhat test
```

Expected: 10 Solidity files compiled, **32 tests passing, 0 failing.**

`viaIR: true` in `hardhat.config.cjs` is required. Without it `VinculumFinalisVerifier.sol` fails to compile with "stack too deep." Recorded as finding CL-33.

Node 22, Hardhat 2.22.17, solc 0.8.19, optimizer 200 runs. The optimizer and `viaIR` settings must match at audit and at deployment; record them in the deployment evidence.

---

## What changed from the original package

The contracts as originally delivered **did not compile.** Three independent hard errors, meaning they had never been built, run, or tested by anyone. Fixed here:

| ID | Fix |
|---|---|
| CL-31 | Non-ASCII em dash inside a string literal, `VinculumFinalisSynth.sol` |
| CL-32 | `uint16` return type could not hold five Commitment Vault multipliers (68000–80000 bps, the 6–10 year tiers). Widened to `uint32`. |
| CL-33 | `viaIR: true` required |

Then, with a working test harness:

| ID | Fix | Spec |
|---|---|---|
| CL-02 | All post-deployment authority removed from all four contracts. Token uses a one-shot `initialize()`; Verifier uses a deployment ceremony closed by `finalize()`; Synth setters deleted and references made `immutable`; Stake's unused authority removed. `deployer` is zeroed in every case. | VF-IMM-001/002/004, VF-DEP-006/007 |
| CL-03 | Stake weight now applies the token multiplier (VCLM 1.0x, CHONX 2.0x, SYNTH 4.0x) in addition to duration | §10.1, VF-STK-003 |
| CL-04 | Staking duration multipliers corrected to 1.0x / 1.4x / 1.75x / 2.0x. The previous values were the §5.1 Commitment Vault table, transcribed into the wrong mechanism. | §10.1 |
| CL-05 | Epochs are launch-relative and 1-indexed against an immutable T0 | §10.2 |
| CL-07 | Two permanent minters: Verifier for issuance, Stake for epoch rewards | VF-STK-004/014 |
| CL-08 | Terminal state is actually entered at zero VCLM capacity | VF-STK-029 |
| CL-14 | Expired positions can no longer queue an extension that backdates over an inactivity gap | VF-STK-025 |
| CL-15 | Terminal state permits immediate withdrawal | VF-STK-030 |
| CL-21–26 | Epoch and type-safety hardening: unset T0 rejected rather than defaulted, epoch 0 rejected explicitly, no pre-launch underflow, `launchTimestamp` immutable, unknown token reverts rather than defaulting to VCLM weight | §10.2 |
| CL-34 | `getPositionWeight()` added — §10.1 was previously unobservable from outside the contract | §10.1 |
| CL-35 | VF-DEP-001 enforced: issuance reverts until finalization. Previously the contract would issue against an empty registry. | VF-DEP-001 |
| CL-36 | `registerChainVerifier` rejects the zero address | VF-DEP-002 |

---

## What is NOT fixed

**Six Critical findings remain open.** This code is not ready for deployment.

| ID | Summary |
|---|---|
| CL-01 | `verifiedGrossUsdMicro` is caller-supplied with no signature or batch verification — permits arbitrary issuance |
| CL-06 | `rewardBasis` is never assigned; epoch allocation always sees zero eligible |
| CL-09 | Unbounded loops in `closeEpoch` and `allocateEpoch` iterate every position ever created. Past the block gas limit both become uncallable and rewards freeze permanently, with no repair path. |
| CL-10 | `daysSinceLaunch` is caller-supplied rather than derived from the valuation timestamp |
| CL-11 | Handshake allowance read from a caller-controlled package field |
| CL-12 | Dev Fund enforcement exists only as a commented-out `require` |

CL-01, CL-10, CL-11 and CL-12 are one workstream: **no quantity that determines issuance may be supplied by the party requesting issuance.** They are a single rewrite of the `verifyAndMint` entry path.

See the Findings Register for the full set, including resolved and rejected items.

---

## Testing standard

Two rules, both learned the hard way:

**Test vectors come from the specification, never from an implementation.** Findings CL-03 and CL-04 were present in two layers simultaneously and passed an 85-assertion suite, because the suite had been built to match the code rather than the spec. A test derived from the code under test cannot detect a defect in that code.

**A finding is Resolved only when a named test asserts it against the file in the repository.** Not when a diff is reviewed, not when a tool reports success. Three Critical findings were once marked resolved on the strength of a reported diff; the file was later compiled and found unchanged.

`test/01_findings.test.cjs` names each test after the finding it enforces.

---

## Immutability note

Section 2 of the specification eliminates all post-deployment control. VF-IMM-006 states plainly that the inability to repair a deployed defect is an accepted consequence.

There is no upgrade path, no proxy, no pause. **An independent paid audit is therefore not optional — it is the only error-correction mechanism the design permits.**

---

Vinculum Protocol DAO LLC
