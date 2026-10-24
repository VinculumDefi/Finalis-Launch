> **SUPERSEDED. Revision 12 is superseded by Revision 14, the current governing edition: `docs/Vinculum_Finalis_Master_Specification_Revision_14_2026-10-24.md`. Its rules are carried into Revision 14. This file stays at this path because `testing-rigs/assumption-gap/assumptions.json` line 5 names it. See `DOCUMENT_REGISTER.md`.**

# Vinculum Finalis Master Specification
## Revision 12
### 2026-10-16

This revision changes one rule. All other rules from Revision 6 remain in force unless a later revision has already modified them.

**Handshake (1-hour duration)**

- Fee is 5%, the same rate used for every other duration.
- There is no allowance limit. A wallet may create any number of 1-hour Handshakes.
- The handshakeIdentity parameter and the allowance counter are removed from the lock contract.
- The Handshake retains its own duration (1 hour) and, in the current test deployment, the $0.01–$0.02 valuation range. Those bounds are deployment constants, not a change to this rule.

**Superseded language**

Revision 6 defined the Handshake as a 2.50% fee with an allowance of three (or one if the mechanism could not remember an identity). That language is superseded by this revision.

**Contract alignment**

The changes are present in CommitmentVaultLock on main at commit ba50755. The verifier changes in the same commit (finalize gate and pre-finalize price write) are configuration rules, not changes to the Handshake policy.

This revision is the governing statement of the Handshake rule as of 2026-10-16.
