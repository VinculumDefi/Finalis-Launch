# Assumption-gap rig

Maps every external input the protocol treats as proven to the checks the code
actually makes, and flags the gaps. Findings only: no contract or app code is changed.

## Files

- `extract_inputs.py`: parses base-contracts with Slither (regex fallback with `--regex`).
  Lists every external/public entry point, each parameter, struct field, env value
  (msg.sender, block.timestamp, block.number, chainid) and external call result, and the
  require/assert/if-revert checks (including in internal callees and modifiers) that
  depend on each one. Writes `inputs.json`.
- `assumptions.json`: hand-written assumption table built from Rev 6 (the traceability
  CSV, since the Rev 6 docx is not in the repo), Rev 12 (Handshake) and Rev 13 (ITS timing).
  Each row names the inputs, the property the protocol assumes, and the checks that would
  prove it (as regex evidence).
- `build_gaps.py`: joins the two and writes `gap_table.md` and `gap_table.json`
  (input, entry point file:line, assumed property, checked properties, gap, exploit
  sketch, damage potential, rank). Exits 1 if the Oct 22 forged-header gap (AG-01) is not flagged.
- `poc/assumption_gap_poc.test.cjs`: local-chain PoCs for the top gaps, skipped by default.
- `../findings/assumption_gap.json`: findings with ids AG-01 to AG-20.

## Run

```
python3 -m venv venv && venv/bin/pip install slither-analyzer solc-select
venv/bin/solc-select install 0.8.19 && venv/bin/solc-select use 0.8.19
(cd base-contracts && npx hardhat compile)
venv/bin/python testing-rigs/assumption-gap/extract_inputs.py
python3 testing-rigs/assumption-gap/build_gaps.py
cd base-contracts && GAP_POC=1 npx hardhat test ../testing-rigs/assumption-gap/poc/assumption_gap_poc.test.cjs
```

Hardhat local network only. Nothing is deployed, broadcast or signed.

## Caveats

- Struct field checks are matched by text (`pkg.field` in the check), so a check made
  through a local copy of a field may be missed. Gap rows are hand-reviewed against source.
- A check matching the evidence regex counts as meeting the property; the regex does not
  prove the check is correct. Control rows (A-04, A-05, A-12, A-22, A-23, A-26) show the
  rules pass code that does have the check.
- The live config is Base-only (commit 5a21665), so the non-Base reader gaps are latent
  until those readers are registered.
