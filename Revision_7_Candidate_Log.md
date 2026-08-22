# Revision 7 Candidate Log

**Scope.** This log records intentional implementation changes that are **not already reflected** in the approved Master Specification (Revision 6, 2026-07-28; governing source `227826f11_Vinculum_Finalis_Master_Specification_Revision_6_2026-07-28.docx`, SHA-256 `5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9`).

Per the review brief, the following were **excluded** and are not listed below:
- implementation defects (the Treasury Reward Stake duration multiplier example cited in the original sweep has since been **remediated** — `VinculumFinalisStake.sol:85-88` now carries 10000/14000/17500/20000 bps, i.e. 1.0/1.4/1.75/2.0, matching §10.1, with token multipliers 1.0/2.0/4.0 at `:91-93`; corrected under CL-03),
- deployment values (canonical chain identifiers, Dev Fund destinations, Solana handshake allowance, XRPL/Solana funded accounts),
- deferred requirements not yet implemented (UTXO PoW confirmation counts for Litecoin/Dogecoin/DigiByte/Bitcoin Cash; source-chain verification paths and on-chain preflight enforcement for non-same-chain environments; oracle on-chain signature verification),
- refactoring (fixed-point BigInt boundary checks; `skipCumulativeUpdate` mint/verify synchronization; SYNTH activation pre/post-state comparison),
- documentation improvements,
- code cleanup.

**Method.** Each intentional behavior in the implementation carries a provenance comment citing the governing Master Specification requirement (VF-COM-*, VF-RAC-*, VF-TOK-*, VF-SUP-*, VF-XCH-*, VF-ARC-*, VF-FEE-*, VF-REG-*). Every intentional behavior was traced to such a cited requirement and confirmed to match the specification's stated rule. No intentional behavior was found that extends, overrides, or contradicts the specification without a corresponding governing requirement.

**Result.**

No protocol changes requiring a new Master Specification revision were found.

---

## SCOPE CAVEAT — read before relying on the Result above

**Direction.** This Log sweeps **code to specification**: does any intentional
implementation behavior extend, override, or contradict Revision 6 without a
governing requirement? Within that direction the Result stands.

**It does not sweep the opposite direction.** It does not look for requirements
the specification fails to state. Those are recorded in Appendix A of the
Findings Register, and at least two name real gaps: **A6** (integer width at the
transfer boundary is unspecified) and **A10's corollary** (the canonical
cross-environment USD wire scale is unstated).

**Consequence.** A reader arriving at the freeze gate holding only this Log
would conclude Revision 7 is empty and skip the Appendix A selection entirely.
It is not empty. Select from Appendix A **entry by entry** at freeze — only
those entries naming an actual specification gap, never wholesale.

**The exclusion list above has been overtaken by implementation.** Two excluded
categories were excluded as *deferred and not yet implemented*, and both have
since been built:

| Excluded as deferred | Current state |
|---|---|
| Source-chain verification paths for non-same-chain environments | **Built** for Bitcoin, Bitcoin Cash, Ethereum, Polygon, Arbitrum, Optimism |
| On-chain preflight enforcement for non-same-chain environments | **Built** in `VinculumFinalisEvmVault` for six EVM environments |

**Therefore the Result above predates that code and has never been run against
it.** A fresh code-to-specification sweep covering the chain verifiers, the
light clients, the proof libraries and the EVM source vault is **owed before
freeze**. Until it runs, this Log's conclusion applies only to the components
that existed when it was written.
