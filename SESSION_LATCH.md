# Session latch — paste this at the top of a new chat

Read these before speaking. Do not reconstruct the project from memory.

## Where the work is
- Repo: `github.com/VinculumDefi/Finalis-Launch`
- Branch: **`redteam/prep` only.** Do not review `main`.
- Head at last latch: see `PROJECT_EVIDENCE_INDEX.md` (derived; source files win if they disagree).

## Authority order
1. Master Specification Rev 6 (`5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9`)
2. Named tests that have been executed
3. Findings Register + Wave 1 report on this branch
4. Contracts and site on this branch
5. Nobody’s recollection. Not the owner. Not an AI.

If a requirement is in Rev 6, it is not an “owner decision.” Open the spec. Quote the VF- id.

## Operator
The owner is not a verification source. Do not ask him to pick A/B on protocol mechanics. Design appetite and priorities only. Technical claims need a file or a test.

## What Wave 1 already closed as fact
- W1-01 / W1-02 **Confirmed · reproduced** (recipient and asset id not bound; issuance theft / inflation).
- Root cause: `IChainVerifier.extractFacts` returns 7 fields. **VF-XCH-011** requires evidence to bind 19.
- W1-05 is **VF-ORC-009 / VF-ORC-010 / VF-XCH-009**: lock keeps creation-time price. Verifier must not reprice at mint.
- Do not put addresses in `config.js` while a confirmed critical is open.

## Site
Public pages live in the `vinculum-site` pack (blue theme). Product-week markdown under `product/` is not the live look.

## Next work (do not reopen)
Interface + implementers must return the VF-XCH-011 field set. Read the four written EVM verifiers and `VinculumFinalisEvmVault` before patching. Fail-closed stubs stay off the site.

## Forbidden
- Reconstructing completeness from commit titles
- Asking the owner to confirm a finding
- Treating `base-contracts/README.md` as current (stale vs later commits)
- Shipping seventeen mint doors
