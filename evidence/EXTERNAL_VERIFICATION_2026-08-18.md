# External protocol verification — 2026-08-18

`PROJECT_REVIEW_STATUS.md` listed three protocol constructions as used but never
verified against their chains. All three were checked against current vendor
documentation. **One is a defect; two are substantially confirmed.**

---

## Optimism — DEFECT (CL-83)

`OpStackChainVerifier` proves an output root via an `OutputProposed` event from
an `L2OutputOracle`.

Optimism's documentation states the L2OutputOracle "has been removed from the OP
Stack contracts" and that "output proposals are made through the
DisputeGameFactory instead". The replacement shipped with Fault Proofs.

**Deeper than an address change.** Under fault proofs an output root is proposed
by creating a dispute game; the claim is trustworthy only once the game has
resolved, is of the portal's respected game type, and is not blacklisted. The
verifier treats a single event as proof of finality — true of the superseded
design, false of the current one.

**Confirmed correct:** the output-root preimage formula. The OP Stack
specification computes the root from state root, block hash and withdrawals
storage root — the construction `computeOutputRoot` implements. The formula is
right; the source of the root is wrong.

Full finding: `evidence/CL-83_OPSTACK_SUPERSEDED_2026-08-18.md`.

---

## Arbitrum — DESIGN CONFIRMED, layout outstanding

Arbitrum's BoLD documentation: "the new events emitted are AssertionCreated
(which should appear every time an assertion is posted, by default this is one
hour) and **AssertionConfirmed (which should only appear after a challenge
period has elapsed, by default this is seven days)**."

Three things follow.

1. `AssertionConfirmed` is the current event under BoLD. The verifier takes the
   event topic as a constructor argument, so the deployment names which event it
   relies on — the right call, given Arbitrum revised it from `NodeConfirmed`.
2. The contract is `RollupCore.sol`, also a constructor argument.
3. **The C.5 observation is confirmed.** Register v15 recorded that the DESIGN
   DEFINED challenge-window parameter may be unnecessary because Arbitrum emits
   the confirmation only after the window elapses. Arbitrum's own documentation
   says exactly that. Requiring the event delegates enforcement to Arbitrum;
   Base never measures the window. **Whether C.5's requirement is thereby
   satisfied remains an architecture decision.**

**STILL UNVERIFIED:** whether the L2 block hash occupies data word 0 of
`AssertionConfirmed`. The verifier reads `EvmReceipt.word(confirmed, 0)`. A
parameter-layout check against a real confirmation is required before
deployment. This is not an architectural defect.

---

## Polygon — EVENT LAYOUT CONFIRMED, leaf preimage outstanding

The Heimdall RootChain contract binding gives the signature verbatim:

```
event NewHeaderBlock(
    address indexed proposer,
    uint256 indexed headerBlockId,
    uint256 indexed reward,
    uint256 start,
    uint256 end,
    bytes32 root
)
```

Three indexed parameters, then `start`, `end`, `root` as data words 0, 1 and 2 —
**exactly what `PolygonChainVerifier` reads.** Event topic hash
`0xba5de06d22af2685c6c7765f60067f7d2b08c2d29f53cdf14d67f6d1c9bfb527`.

**STILL UNVERIFIED:** the checkpoint leaf preimage,
`keccak256(abi.encodePacked(blockNumber, time, txRoot, receiptRoot))`, and the
tree's sibling ordering. `computeLeaf` and `verifyCheckpointPath` are public so
both can be checked against a real checkpoint.

Note Heimdall v2 shipped in 2025. The event signature above is from the Heimdall
contract bindings and should be reconfirmed against the currently deployed
RootChain contract on Ethereum before deployment.

---

## Method note

Optimism's defect was found in a single documentation search. **No amount of
internal testing would have surfaced it** — the tests and the implementation
shared the same superseded assumption, so they agreed with each other
perfectly and 13 tests passed.

This is axiom A14 (test against data the implementation cannot influence)
applied to a protocol interface rather than a data format. **Where an
implementation depends on another chain's contracts, verify against that
chain's current documentation, not against the repository.**

## Remaining

| Item | Status |
|---|---|
| Optimism output-root source | **DEFECT — CL-83** |
| Optimism preimage formula | Confirmed |
| Arbitrum event identity and timing | Confirmed |
| Arbitrum data-word layout | Unverified |
| Polygon event signature and data layout | Confirmed |
| Polygon checkpoint leaf preimage | Unverified |
| Polygon tree sibling ordering | Unverified |
| RootChain address on current Ethereum mainnet | Unverified |
