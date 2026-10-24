> **SUPERSEDED. Revision 13 is superseded by Revision 14, the current governing edition: `docs/Vinculum_Finalis_Master_Specification_Revision_14_2026-10-24.md`. Its rules are carried into Revision 14. This file stays at this path because `testing-rigs/assumption-gap/assumptions.json` line 6 names it. See `DOCUMENT_REGISTER.md`.**

# Vinculum Finalis Master Specification
## Revision 13
### 2026-10-22

**Decision:** founder decision t295u, 2026-10-22, 3:54 PM ET.

**Scope:** the timing of Axelar Interchain Token Service (ITS) only. Revision 6 remains the governing specification. Revision 12 still governs the Handshake. All other rules are unchanged.

## 1. Clauses amended

Revision 6, Section 11.4 (Axelar Interchain Token Service):

> "VCLM, CHONX, and SYNTH use Axelar Interchain Token Service, with Base serving as their canonical issuance and accounting blockchain. This is a binding architectural requirement rather than a prescribed low-level integration design."

Revision 6, VF-DEP-001:

> "The implementation remains inactive until every required registry entry, blockchain identifier, Dev Fund destination, Axelar ITS dependency, proof-verification dependency, and fixed protocol parameter has been populated and validated."

Revision 6, Section 15.1 (Required finalization evidence):

> "Freeze the price-fetcher, signed/batched path, proof architecture, and Axelar ITS integration configuration."

**Amendment:**

1. Axelar ITS is no longer a launch prerequisite or an activation prerequisite.
2. VF-DEP-001 no longer requires an Axelar ITS dependency to be populated and validated before activation. Every other item in VF-DEP-001 still applies.
3. Section 15.1 no longer requires the Axelar ITS integration configuration to be frozen at finalization. Every other item in Section 15.1 still applies.
4. The protocol may activate and finalize without ITS. ITS may be connected after launch, for example as a "Move tokens" option in the app.
5. Section 11.4 still requires that VCLM, CHONX, and SYNTH use Axelar ITS for cross-chain movement. This revision changes only when that connection happens, not whether it is the permitted system.

## 2. What still binds, unchanged

- **Base** remains the canonical issuance and accounting blockchain for VCLM, CHONX, and SYNTH.
- **VF-XCH-018:** "The implementer may design the concrete Axelar ITS integration but may not replace Axelar ITS with another bridging or cross-chain token system." Axelar ITS is the only permitted cross-chain token system for VCLM, CHONX, and SYNTH. No other bridge may be used.
- **VF-XCH-019:** "No independent or separately issued VCLM, CHONX, or SYNTH supply may be created on another blockchain."
- **VF-XCH-020:** "Every Axelar ITS representation remains part of the single globally reconciled supply for its protocol token."
- **VF-XCH-021:** "Interchain transport does not constitute new protocol issuance, increase cumulative lifetime issuance, restore consumed hard-cap capacity, or create an independent destination-chain allowance."
- **VF-SUP-013:** "Only protocol-authorized issuance originating from the Base protocol increases cumulative lifetime protocol issuance."
- **VF-SUP-014:** "Axelar ITS transport cannot be counted as a new Commitment Vault, Treasury Reward Stake, or Forge issuance event."
- Transport never counts toward lifetime issuance, the 10,000,000 VCLM threshold that activates CHONX, or the 100,000,000 CHONX threshold that activates SYNTH.

## 3. Required post-launch pattern

When ITS is connected, it must follow this pattern unless a later revision decides otherwise:

- On Base, VCLM, CHONX, and SYNTH use a LOCK_UNLOCK token manager. Tokens moved off Base are held in escrow on Base.
- On remote chains, each token is a mint-and-burn copy backed by that Base escrow.
- The Base VCLM, CHONX, and SYNTH contracts do not change. No new minter is added. Finalize is unchanged. The Verifier and the Treasury Reward Stake remain the only sources of new supply.
- There is no ITS operator and no flow-limit administrator.
- Forging and staking stay on Base. Remote copies must be moved back to Base before they can be forged or staked.

## 4. Known consequences

- Until ITS is connected and the remote locks refuse copies, a remote copy cannot mint anything, because the Verifier rejects tokens that are not indexed in the registry. A person who locks a remote copy would still pay the source-chain fee.
- Axelar's ITS contracts are upgradeable and pausable by Axelar governance. Marketing must not describe cross-chain transport as fully immutable. The immutability claims apply to the Vinculum Finalis contracts only.
- Participants pay their own gas plus the Axelar fee for every cross-chain transfer. There is no sponsorship.

## 5. Follow-ups (not done in this revision)

- Optional: make the non-Base Commitment Vault Lock refuse VCLM, CHONX, and SYNTH copies, in addition to the existing Verifier rejection.
- Correct src/lib/vfComplianceData.js, which wrongly marks VF-XCH-018, VF-XCH-019, VF-XCH-020, VF-XCH-021, and VF-SUP-014 as IMPLEMENTED. No ITS integration exists in the code.
- Write a build and test plan when ITS is connected.

This revision is the governing statement of Axelar ITS timing as of 2026-10-22.
