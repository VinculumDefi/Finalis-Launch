#!/usr/bin/env python3
"""Triage Slither results into TP / FP / info with severity and file:line.

Verdicts are set per detector after manual review of every instance in
base-contracts at b0e38a9. Reasons are recorded per detector; specific
instances that differ from the detector default are listed in OVERRIDES.
"""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))

# detector -> (verdict, severity, reason)
RULES = {
 "encode-packed-collision": ("FP", "info", "XrplLockReader: every variable field is preceded by its XRPL VL length prefix (_vl), so two inputs cannot produce the same packed bytes. UtxoLockReader constructor: keccak(env string, nativeAsset bytes) is computed once at deploy from ceremony constants, not from user input."),
 "reentrancy-balance": ("FP", "info", "Stake.createPosition measures balanceOf before and after transferFrom. The stake token is VCLM, CHONX or SYNTH (protocol tokens with no hooks or callbacks), so no reentrant call can run between the reads."),
 "boolean-cst": ("FP", "info", "foreignHeaderFinalityNotDecided returns a constant false by design (this CVL does not decide foreign header finality)."),
 "divide-before-multiply": ("TP", "info", "Rounding at each step is intended: VF-COM-019 floors after every multiplier. Precision loss is at most a few wei per step and always rounds against the minter. Sha512 instance is word packing, not money math."),
 "incorrect-equality": ("FP", "info", "Strict equalities are on sentinel values (zero launch time, enum ids, zero weight), not on balances an attacker can nudge."),
 "reentrancy-no-eth": ("FP", "low", "State is written after calls only to protocol tokens (VCLM, CHONX, SYNTH mint and burnFrom) that have no callbacks. consumedLocks in verifyAndMint is written after mint; if a token with hooks were ever wired in, this would become exploitable. Checks-effects-interactions is not followed."),
 "uninitialized-local": ("FP", "info", "Counters and accumulators that rely on the Solidity default of zero."),
 "unused-return": ("FP", "info", "Tuple fields deliberately skipped: maturityTimestamp (duration is checked instead), source block hash and height from verifyFinality, and unused parts of the reader parse in extractAssetId."),
 "shadowing-builtin": ("TP", "info", "Local variables named tx shadow the tx builtin. No tx.origin use, so no effect."),
 "calls-loop": ("TP", "low", "claimPositions loops over positions with one transfer each; a long array only hurts the caller. registerTokenAddressBatch is ceremony-only and already closed."),
 "reentrancy-benign": ("FP", "info", "Same pattern as reentrancy-no-eth; callees are protocol tokens or guarded by nonReentrant (CVL createErc20Lock)."),
 "reentrancy-events": ("FP", "info", "Events emitted after calls to trusted protocol tokens; ordering only."),
 "timestamp": ("TP", "info", "Epochs, maturities and price schedules depend on block.timestamp by design. A block producer can shift time by seconds, not enough to cross daily or epoch boundaries in a useful way except at the exact edge."),
 "assembly": ("TP", "info", "Inline assembly in proof parsers and hash code. Reviewed by the reader rigs, not here."),
 "costly-loop": ("TP", "info", "Storage writes inside loops in ceremony or batch paths."),
 "cyclomatic-complexity": ("TP", "info", "One very complex function; review aid only."),
 "dead-code": ("TP", "info", "Unused internal function."),
 "low-level-calls": ("TP", "info", "Low-level calls in CVL token handling and precompile calls in checkers; return values are checked."),
 "missing-inheritance": ("TP", "info", "Contracts implement an interface without declaring it."),
 "naming-convention": ("TP", "info", "Style only."),
 "redundant-statements": ("TP", "info", "No-op statements."),
 "too-many-digits": ("TP", "info", "Long literals; style only."),
 "unindexed-event-address": ("TP", "info", "Address fields in events are not indexed; off-chain filtering cost only."),
 "immutable-states": ("TP", "info", "State variables that could be immutable; gas only."),
}
OVERRIDES = {
 "incorrect-equality@contracts/VinculumFinalisVerifier.sol:1023": ("TP", "high", "The equality itself is fine, but this is the branch STATIC-H02 abuses: a caller-chosen valuationTimestamp at or below launch returns day 0, the maximum emission rate. See findings/static.json STATIC-H02."),
 "unused-return@contracts/VinculumFinalisVerifier.sol:713": ("TP", "info", "Skipped tuple fields are safe (maturityTimestamp, block hash, height). Related: _verifySource returns the reader creation time but verifyAndMint uses it only for the CHONX activation check, never to bind pkg.valuationTimestamp (STATIC-H02)."),
}

def main():
    raw = json.load(open(os.path.join(HERE, "slither_raw.json")))
    dets = raw["results"]["detectors"]
    rows = []
    for n, r in enumerate(dets, 1):
        e = r["elements"][0] if r["elements"] else {}
        sm = e.get("source_mapping", {})
        f = sm.get("filename_relative", "")
        line = (sm.get("lines") or [0])[0]
        # prefer the first concrete statement line in the description when present
        desc = r["description"].strip().split("\n")
        verdict, sev, reason = RULES.get(r["check"], ("UNTRIAGED", "info", "No rule; review manually."))
        key = "%s@%s:%s" % (r["check"], f, line)
        if key in OVERRIDES:
            verdict, sev, reason = OVERRIDES[key]
        rows.append({"id": "SL-%03d" % n, "detector": r["check"], "slither_impact": r["impact"],
                     "slither_confidence": r["confidence"], "verdict": verdict, "severity": sev,
                     "file_line": "base-contracts/%s:%s" % (f, line), "summary": desc[0][:240],
                     "reason": reason})
    json.dump(rows, open(os.path.join(HERE, "triage.json"), "w"), indent=1)
    by = {}
    for x in rows:
        by.setdefault((x["detector"], x["slither_impact"], x["verdict"], x["severity"]), []).append(x)
    with open(os.path.join(HERE, "triage.md"), "w") as o:
        o.write("# Slither triage (Rig 7)\n\n%d results. Verdict TP means the pattern is really present; FP means the detector pattern does not apply. Severity is ours, not Slither's.\n\n" % len(rows))
        o.write("| Detector | Slither impact | Count | Verdict | Our severity | Locations |\n|---|---|---|---|---|---|\n")
        for (d, imp, v, s), xs in sorted(by.items(), key=lambda kv: ["High","Medium","Low","Informational","Optimization"].index(kv[0][1])):
            locs = ", ".join(x["file_line"].replace("base-contracts/contracts/", "") for x in xs[:8]) + (" and %d more" % (len(xs) - 8) if len(xs) > 8 else "")
            o.write("| %s | %s | %d | %s | %s | %s |\n" % (d, imp, len(xs), v, s, locs))
        o.write("\n## Reasons\n\n")
        for d, (v, s, r) in RULES.items():
            if any(x["detector"] == d for x in rows):
                o.write("- **%s** (%s, %s): %s\n" % (d, v, s, r))
        o.write("\n## What Slither cannot see\n\nSlither does not model protocol semantics. The manual review in this rig found three issues no detector flags (STATIC-C01, STATIC-H02, STATIC-M01 in findings/static.json), all proven by the PoC in testing-rigs/static-poc/.\n")
    unt = [x for x in rows if x["verdict"] == "UNTRIAGED"]
    print("triaged %d results, %d untriaged" % (len(rows), len(unt)))
    for x in unt: print("UNTRIAGED", x["detector"], x["file_line"])

if __name__ == "__main__":
    main()
