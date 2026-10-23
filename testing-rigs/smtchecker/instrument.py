#!/usr/bin/env python3
"""Build instrumented copies of production contracts for the SMTChecker.

Every added line ends with "// HARNESS" and every modified function header
gains the token " harnessGuard". verify() strips both and checks that the
result is byte-identical to the production file, so the harness cannot drift
from the code under test.

Ghost state and the guard modifier encode three properties:
  P1 only a minter can mint: totalSupply never rises unless msg.sender was a
     minter before the call (Token) or the forge path ran with activation (Synth)
  P2 supply conservation: ghostSum (sum of every balance credit minus every
     balance debit) always equals totalSupply, and totalSupply <= cap
  P3 no unauthorized state change: after finalization the minters, deployer
     and finalized flag never change (Token); synthActivated never goes back
     to false (Synth)
"""
import re, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "..", "base-contracts", "contracts")

TOKEN_GUARD = """
    uint256 internal ghostSum; // HARNESS
    modifier harnessGuard() { // HARNESS
        uint256 hS = totalSupply; address hV = minterVerifier; address hSt = minterStake; // HARNESS
        bool hF = finalized; address hD = deployer; // HARNESS
        _; // HARNESS
        assert(ghostSum == totalSupply); // HARNESS P2 conservation
        assert(totalSupply <= hardCap); // HARNESS P2 cap
        if (totalSupply > hS) assert(msg.sender == hV || msg.sender == hSt); // HARNESS P1 minter only
        if (totalSupply > hS) assert(hF); // HARNESS P1 no mint before finalization
        if (hF) assert(finalized && minterVerifier == hV && minterStake == hSt && deployer == address(0)); // HARNESS P3 frozen
        if (!hF && msg.sender != hD) assert(minterVerifier == hV && minterStake == hSt && finalized == hF); // HARNESS P3 only deployer configures
    } // HARNESS
"""

SYNTH_GUARD = """
    uint256 internal ghostSum; // HARNESS
    modifier harnessGuard() { // HARNESS
        uint256 hS = totalSupply; bool hA = synthActivated; // HARNESS
        _; // HARNESS
        assert(ghostSum == totalSupply); // HARNESS P2 conservation
        assert(totalSupply <= HARD_CAP); // HARNESS P2 cap
        if (totalSupply > hS) assert(synthActivated); // HARNESS P1 mint only when activated
        if (totalSupply > hS) assert((totalSupply - hS) % 1e18 == 0); // HARNESS P1 whole units only
        if (hA) assert(synthActivated); // HARNESS P3 activation is one-way
    } // HARNESS
"""

JOBS = [
    ("VinculumFinalisToken.sol", "TokenInstrumented.sol", TOKEN_GUARD),
    ("VinculumFinalisSynth.sol", "SynthInstrumented.sol", SYNTH_GUARD),
]

BAL = re.compile(r"^(\s*)balanceOf\[[^\]]+\]\s*([+-])=\s*([^;]+);\s*$")
HDR = re.compile(r"^(\s*function\s+\w+\([^)]*\)\s+(?:external|public))(?![^{]*\b(?:view|pure)\b)(.*\{\s*)$")


def instrument(text, guard):
    out = []
    lines = text.split("\n")
    # insert ghost and guard just before the final closing brace of the main contract
    last_brace = max(i for i, l in enumerate(lines) if l.strip() == "}")
    for i, l in enumerate(lines):
        if i == last_brace:
            out.extend(guard.strip("\n").split("\n"))
        m = HDR.match(l)
        if m:
            l = m.group(1) + " harnessGuard" + m.group(2)
        out.append(l)
        b = BAL.match(l)
        if b:
            op = "+=" if b.group(2) == "+" else "-="
            out.append("%sghostSum %s %s; // HARNESS" % (b.group(1), op, b.group(3).strip()))
    return "\n".join(out)


def strip(text):
    kept = [l for l in text.split("\n") if not l.rstrip().endswith("// HARNESS")
            and not re.search(r"// HARNESS P\d", l)]
    return "\n".join(kept).replace(" harnessGuard", "")


def main():
    ok = True
    for src, dst, guard in JOBS:
        prod = open(os.path.join(SRC, src)).read()
        inst = instrument(prod, guard)
        open(os.path.join(HERE, "harness", dst), "w").write(inst)
        same = strip(inst) == prod
        guarded = inst.count(" harnessGuard") - 1
        print("%s -> harness/%s: %d functions guarded, strip-check %s" % (src, dst, guarded, "OK" if same else "FAILED"))
        ok = ok and same
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
