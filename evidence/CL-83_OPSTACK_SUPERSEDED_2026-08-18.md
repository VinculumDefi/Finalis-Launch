# CL-83 · CRITICAL · OPEN
## OpStackChainVerifier targets a contract Optimism has removed

**Found:** 2026-08-18, during the external verification of the three protocol
constructions listed in `PROJECT_REVIEW_STATUS.md` as unverified against mainnet.

## The finding

`OpStackChainVerifier` proves an output root by finding an `OutputProposed`
event emitted by an `L2OutputOracle` on Ethereum L1.

Optimism's documentation states that the L2OutputOracle "has been removed from
the OP Stack contracts" and that "output proposals are made through the
DisputeGameFactory instead". The replacement shipped with the Fault Proofs
upgrade.

The verifier would find no such event on current OP Mainnet.

## Why this is a design defect, not a configuration error

The oracle address and event topic are constructor arguments, so re-pointing
them is trivial. That is not sufficient.

Under fault proofs, an output root is proposed by **creating a dispute game**.
The proposal exists from creation, but the claim is only trustworthy once the
game has **resolved**, is of the portal's **respected game type**, and has not
been **blacklisted**. This contract treats a single event as proof of finality
— correct under the superseded design, false under the current one.

Remediation therefore requires querying `DisputeGameFactory`, reading the
game's status and type, and confirming resolution.

## What is confirmed correct

The output-root preimage formula. The OP Stack specification computes the root
from the state root, block hash and withdrawals storage root — the construction
`computeOutputRoot` implements. **The formula is right; the source of the root
is wrong.**

## Evidence status

`19_opstack_verifier.test.cjs` — 13 tests, all passing, all against the
superseded construction. Removed from the completion-evidence register
(Verifier Completion Standard §8). `evidence/OPSTACK_C7_2026-08-16.txt` records
a passing run and is retained, but is not evidence about current OP Mainnet.

## Consequences

- **Optimism is not a completed verification path.** Six remain: Base, Bitcoin,
  Bitcoin Cash, Ethereum, Polygon, Arbitrum.
- **Architecture C.7** names "Optimism batch/output root on Ethereum L1". The
  shape holds; the named mechanism is superseded. Worth an operator decision on
  whether C.7 needs a Revision 7 amendment.
- **Arbitrum warrants the same scrutiny.** `ArbitrumChainVerifier` makes the
  same class of assumption — that a single L1 event establishes finality. Its
  confirmation event has not been verified against Arbitrum's current contracts.
- **Polygon likewise unverified.**

## Method note

This was found by checking an implementation against its chain's current
documentation rather than against the repository. **No amount of internal
testing would have surfaced it**: the tests and the implementation shared the
same superseded assumption, so they agreed with each other perfectly.

This is axiom A14 — test against data the implementation cannot influence —
applied to a protocol interface rather than a data format.
