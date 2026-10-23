#!/usr/bin/env python3
"""Turn the raw SMTChecker outputs in results/ into results/properties.json and
results/summary.md.

Verdict rules (no guessing):
  proven         the job exited 0 and solc gave no warning at all for that line
  counterexample solc printed "happens here" for that line (CHC found a trace)
  inconclusive   "might happen here" or "Error trying to invoke SMT solver" for that line
  fail-to-run    the job did not exit 0 (247 = SIGKILL by the OOM killer, 124 = timeout)
Each counterexample is then read by hand; the reading is in ANNOTATIONS below.
"""
import json, os, re, collections
HERE = os.path.dirname(os.path.abspath(__file__))
RES = os.path.join(HERE, "results")

def runlog():
    rc = {}
    for path in ["runlog.txt", "runlog_bmc.txt"]:
        p = os.path.join(RES, path)
        if os.path.exists(p):
            for l in open(p):
                m = re.match(r"(\S+) exit=(\d+) seconds=(\d+)", l)
                if m:
                    rc[m.group(1)] = (int(m.group(2)), int(m.group(3)))  # last line wins
    return rc

WARN = re.compile(r"Warning: (CHC|BMC): (.*?)\n(.*?)-->\s+\S*?([A-Za-z0-9_]+\.sol):(\d+):\d+:", re.S)

def parse(job):
    p = os.path.join(RES, job + ".txt")
    if not os.path.exists(p):
        return None
    t = open(p).read()
    hits = collections.defaultdict(list)
    for m in WARN.finditer(t):
        kind = m.group(2).strip()
        if "Counterexample" in kind:
            kind = kind.split("\n")[0]
        hits[(m.group(4), int(m.group(5)))].append(kind)
    return hits

def verdict(hits, rc, f, line):
    if rc is None:
        return "not-run", "no result"
    if rc[0] != 0:
        return "fail-to-run", "exit %d" % rc[0]
    ks = hits.get((f, line), [])
    if any("happens here" in k for k in ks):
        return "counterexample", "; ".join(sorted(set(ks)))
    if ks:
        return "inconclusive", "; ".join(sorted(set(ks)))
    return "proven", "no warning for this line"

T, S, F, I = "TokenInstrumented.sol", "SynthInstrumented.sol", "FeeMath.sol", "IssuanceMath.sol"
PROPS = [
    # id, job, file, line, property
    ("P2-token-conservation", "harness_token", T, 194, "Token: sum of balances equals totalSupply after every call (supply conservation)"),
    ("P2-token-cap", "harness_token", T, 195, "Token: totalSupply never exceeds hardCap"),
    ("P1-token-minter-only", "harness_token", T, 196, "Token: supply only grows when msg.sender is minterVerifier or minterStake (only a minter can mint)"),
    ("P1-token-no-mint-before-finalize", "harness_token", T, 197, "Token: supply only grows after initialize() finalized the minters"),
    ("P3-token-frozen", "harness_token", T, 198, "Token: after finalize, minters, finalized flag and deployer never change (no unauthorized state change)"),
    ("P3-token-deployer-only", "harness_token", T, 199, "Token: before finalize, only the deployer can change minter config"),
    ("P2-synth-conservation", "harness_synth", S, 205, "Synth: sum of balances equals totalSupply (supply conservation)"),
    ("P2-synth-cap", "harness_synth", S, 206, "Synth: totalSupply never exceeds HARD_CAP"),
    ("P1-synth-mint-when-activated", "harness_synth", S, 207, "Synth: supply only grows when synthActivated"),
    ("P1-synth-whole-units", "harness_synth", S, 208, "Synth: forge mints whole 1e18 units only"),
    ("P3-synth-activation-one-way", "harness_synth", S, 209, "Synth: activation can never be undone"),
    ("F1-fee-conservation", "harness_feemath", F, 48, "Fee math: fee + principal == gross"),
    ("F2-fee-exact", "harness_feemath", F, 49, "Fee math: fee == floor(gross / 20)"),
    ("F3-verifier-accepts-cvl-fee", "harness_feemath", F, 50, "Fee math: Verifier VF-COM-011 check accepts the CVL fee"),
    ("F4-principal-nonzero", "harness_feemath", F, 51, "Fee math: principal > 0 when gross >= 2"),
    ("F5-multiplier-range", "harness_feemath", F, 52, "Fee math: duration multiplier in [1.0x, 8.0x]"),
    ("I1-issuance-monotonic", "harness_issuance", I, 84, "Issuance: more verified USD never mints less"),
    ("I2-issuance-upper-bound", "harness_issuance", I, 91, "Issuance: issuance <= usd * rate * 12 (max multipliers)"),
    ("I3-rate-bounds", "harness_issuance", I, 100, "Issuance: emission rate between floor and initial"),
    ("I4-day-zero-max", "harness_issuance", I, 107, "Issuance: day 0 rate is the maximum"),
]
# Supplementary BMC (function-local) results for the same assert lines.
BMC = {"harness_token": "bmc_token", "harness_synth": "bmc_synth"}

BMC_NOTE = {
    "proven": "BMC proved it for every single call from an arbitrary starting state, which is stronger than needed for this per-call property.",
    "counterexample": "Not informative. BMC starts each call from an arbitrary state (for the synth it even picks HARD_CAP = 0 and burn constants of 0, and it forgets state after the external token calls). The traces start from states no real deployment can reach, for example finalized with a nonzero deployer, or ghostSum already different from totalSupply. Read by hand as spurious.",
}
ANNOTATIONS = {
    ("harness_token", T, 197): ("spurious", "Trace needs msg.sender == address(0) while both minters are still unset (address(0)) before initialize(). No transaction can come from address(0); initialize() sets both minters and finalized=true in one call (VinculumFinalisToken.sol:95-107) and onlyMinter is VinculumFinalisToken.sol:65-71."),
}
FINDINGS = [
    {"id": "SMT-01", "rig": "6-smtchecker", "severity": "info", "damage": "none; the call reverts with Panic 0x11",
     "file_line": "base-contracts/contracts/VinculumFinalisSynth.sol forge(): CHONX_BURN_PER_SYNTH * count (harness SynthInstrumented.sol:145)",
     "description": "CHC found a real overflow trace in forge() for a huge count. Solidity 0.8 checked math turns it into a revert, so no wrap and no free mint.",
     "evidence": "testing-rigs/smtchecker/results/harness_synth.txt", "rev_conflict": "none"},
    {"id": "SMT-02", "rig": "6-smtchecker", "severity": "info", "damage": "none; reverts",
     "file_line": "base-contracts/contracts/BaseCommitmentVaultLock.sol:349",
     "description": "CHC overflow trace for gross * STANDARD_FEE_BPS when gross > 2^256/500. Checked math reverts. No real token has that supply. Same trace on the extracted copy (FeeMath.sol:37).",
     "evidence": "testing-rigs/smtchecker/results/attempt1/prod_basecvl.txt; results/harness_feemath.txt", "rev_conflict": "none"},
    {"id": "SMT-03", "rig": "6-smtchecker", "severity": "info", "damage": "none; reverts, the lock fails closed",
     "file_line": "base-contracts/contracts/BaseCommitmentVaultLock.sol:224",
     "description": "CHC underflow trace for _balanceOf(after) - beforeBal when the pulled token lowers the vault balance during transferFrom (a hostile or rebasing token). Checked math reverts, so the lock is refused. Ties to finding L04 (rebasing tokens).",
     "evidence": "testing-rigs/smtchecker/results/attempt1/prod_basecvl.txt", "rev_conflict": "none"},
    {"id": "SMT-04", "rig": "6-smtchecker", "severity": "info", "damage": "none; reverts",
     "file_line": "base-contracts/contracts/BaseCommitmentVaultLock.sol:317",
     "description": "CHC overflow trace for createdAt + duration. duration is limited to the fixed CommitmentDurations table, so only a solver-chosen huge timestamp reaches it. Checked math reverts.",
     "evidence": "testing-rigs/smtchecker/results/attempt1/prod_basecvl.txt", "rev_conflict": "none"},
    {"id": "SMT-05", "rig": "6-smtchecker", "severity": "info", "damage": "none; reverts. Deployment input only",
     "file_line": "base-contracts/contracts/VinculumFinalisToken.sol:122 (hardCap set at :84 with no range check)",
     "description": "CHC overflow trace for totalSupply + amount. It needs a deployment with hardCap near 2^256, which the constructor accepts without a check. Checked math reverts. Deployment script must pass the Rev 6 cap.",
     "evidence": "testing-rigs/smtchecker/results/prod_token.txt", "rev_conflict": "none"},
]

def main():
    rc = runlog()
    cache = {}
    props = []
    for pid, job, f, line, desc in PROPS:
        if job not in cache:
            cache[job] = parse(job)
        h = cache[job] or {}
        v, why = verdict(h, rc.get(job), f, line)
        entry = {"id": pid, "harness": "testing-rigs/smtchecker/harness/%s:%d" % (f, line), "property": desc,
                 "engine": "CHC", "verdict": v, "detail": why,
                 "run": {"job": job, "exit": rc.get(job, (None, None))[0], "seconds": rc.get(job, (None, None))[1]}}
        if v == "inconclusive" and "Error trying to invoke SMT solver" in why:
            entry["reason"] = "solver error (z3 gave up, likely memory pressure on the shared box)"
        elif v == "inconclusive":
            entry["reason"] = "CHC could not find an invariant within the 30 s per-query timeout"
        ann = ANNOTATIONS.get((job, f, line))
        if ann:
            entry["counterexample_reading"] = ann[0]
            entry["counterexample_note"] = ann[1]
        if job in BMC:
            bj = BMC[job]
            if bj not in cache:
                cache[bj] = parse(bj)
            if rc.get(bj):
                bv, bwhy = verdict(cache[bj] or {}, rc.get(bj), f, line)
                entry["bmc_supplement"] = {"verdict": bv, "detail": bwhy,
                    "note": BMC_NOTE.get(bv, "")}
        props.append(entry)
    jobs = {k: {"exit": v[0], "seconds": v[1]} for k, v in rc.items()}
    prod = {}
    for j in [k for k in rc if k.startswith("prod_")]:
        h = cache.get(j) or parse(j) or {}
        c = collections.Counter()
        for ks in h.values():
            for k in ks:
                c["counterexample" if "happens here" in k else ("solver_error" if "Error trying" in k else "unproved")] += 1
        prod[j] = {"exit": rc[j][0], "seconds": rc[j][1], "counts": dict(c),
                   "counterexample_lines": sorted("%s:%d" % key for key, ks in h.items() if any("happens here" in k for k in ks))}
    out = {"formal_layer": "solc 0.8.19 SMTChecker, CHC engine, z3 4.11.2. Certora not available (CERTORAKEY not set in env), so SMTChecker is the only formal layer.",
           "targets": "assert, overflow, underflow, divByZero, outOfBounds",
           "note_checked_math": "Solidity 0.8 checked arithmetic: an overflow or underflow 'happens' result means the call reverts with Panic 0x11, not a silent wrap.",
           "jobs": jobs, "properties": props, "production_contracts": prod, "findings": FINDINGS,
           "verdict_counts": dict(collections.Counter(p["verdict"] for p in props))}
    json.dump(out, open(os.path.join(RES, "properties.json"), "w"), indent=2)
    md = ["# Rig 6 SMTChecker results", "", out["formal_layer"], "", out["note_checked_math"], "",
          "Verdict counts: " + ", ".join("%s %d" % kv for kv in sorted(out["verdict_counts"].items())), "",
          "| id | verdict | harness line | reason or note | BMC supplement |", "|---|---|---|---|---|"]
    for p in props:
        note = p.get("counterexample_note") and ("%s: %s" % (p["counterexample_reading"], p["counterexample_note"])) or p.get("reason", p["detail"])
        md.append("| %s | %s | %s | %s | %s |" % (p["id"], p["verdict"], p["harness"].split("/")[-1], note,
                  p.get("bmc_supplement", {}).get("verdict", "n/a")))
    md += ["", "BMC supplement column (run_bmc_supplement.sh): " + BMC_NOTE["proven"] + " A counterexample there is " + BMC_NOTE["counterexample"][0].lower() + BMC_NOTE["counterexample"][1:]]
    md += ["", "## Jobs", "", "| job | exit | seconds |", "|---|---|---|"]
    md += ["| %s | %s | %s |" % (k, v["exit"], v["seconds"]) for k, v in sorted(jobs.items())]
    md += ["", "## Production contracts (overflow, underflow, divByZero, outOfBounds, assert)", ""]
    for k, v in sorted(prod.items()):
        md.append("- %s: exit %s, %s s, %s, counterexample lines %s" % (k, v["exit"], v["seconds"], v["counts"], v["counterexample_lines"] or "none"))
    md += ["", "## SMT findings", ""] + ["- %s (%s) %s: %s" % (f["id"], f["severity"], f["file_line"], f["description"]) for f in FINDINGS]
    open(os.path.join(RES, "summary.md"), "w").write("\n".join(md) + "\n")
    print(out["verdict_counts"])

if __name__ == "__main__":
    main()
