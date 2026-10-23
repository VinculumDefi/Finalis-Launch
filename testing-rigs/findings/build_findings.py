#!/usr/bin/env python3
"""Build testing-rigs/findings/static.json for rigs 5 (Mythril), 6 (SMTChecker), 7 (Slither).

Manual findings are written out below. Tool roll-ups are read from the
committed raw results so the counts always match the artifacts.
Run from the repo root: python3 testing-rigs/findings/build_findings.py
"""
import json, os, re, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V = "base-contracts/contracts/VinculumFinalisVerifier.sol"
S = "base-contracts/contracts/VinculumFinalisStake.sol"
C = "base-contracts/contracts/BaseCommitmentVaultLock.sol"
POC = "testing-rigs/static-poc/verifier_input_gaps.test.cjs (output in poc_output.txt)"

FINDINGS = [
    {
        "id": "STATIC-C01", "rig": "7 (manual triage next to Slither, confirmed by PoC)",
        "severity": "critical",
        "damage_potential": "Unbounded reward VCLM minted to stakers, up to the VCLM hard cap, from one real lock. "
                            "The same gap can also be used to inflate an epoch basis past remaining capacity so honest stakers get nothing.",
        "file_line": [V + ":654", V + ":692-702", V + ":774", S + ":415", S + ":428-487"],
        "description": "racIdentity is supplied by the caller of the permissionless recordFeeAndRac and is not bound to the lock, "
                       "transaction, log index or fee. One real lock can be recorded many times under different racIdentity values; "
                       "each adds a full RAC credit to epochRewardBasis, which Stake.allocateEpoch later mints against. "
                       "The app derives racIdentity from (env, lockId, txhash, logIndex, asset, fee) but the contract does not enforce it.",
        "evidence": "PoC STATIC-C01: 5 racIdentity values for one lock, one credit 30e18, basis reached 150e18. "
                    "PoC STATIC-C01b: 20 duplicate RACs for one 1000 USD lock; Stake minted 6000 VCLM for the epoch against an honest 300 VCLM (20x). " + POC,
        "rev_conflict": "Rev 6 VF-RAC-001 (RAC exact-once): exact-once is enforced per caller-chosen id, not per lock or fee event.",
    },
    {
        "id": "STATIC-H02", "rig": "7 (Slither incorrect-equality SL-016, confirmed by PoC)",
        "severity": "high",
        "damage_potential": "Any minter can take the day-0 emission rate forever, up to 10x the floor rate (SMTChecker I4 shows day 0 is the maximum rate).",
        "file_line": [V + ":844", V + ":1023-1029", V + ":744", V + ":826", V + ":839"],
        "description": "verifyAndMint computes emission days from pkg.valuationTimestamp, which the caller chooses. "
                       "It is never compared with the reader-proven creation time extCreated (createdAt), which is only used for the CHONX activation check. "
                       "valuationTimestamp=0 (or any time before launch) returns day 0.",
        "evidence": "PoC STATIC-H02: lock one year after launch, honest mint 106.25 VCLM, same lock with valuationTimestamp=0 mints 130.0 VCLM. " + POC,
        "rev_conflict": "Rev 6 VF-ORC-011/013 (emission rate from the Valuation Timestamp, which is the source block time, not a caller value).",
    },
    {
        "id": "STATIC-M01", "rig": "7 (manual triage, confirmed by PoC)",
        "severity": "medium",
        "damage_potential": "Free option for the user: wait for a better scheduled price, then submit the first proof. Over-issuance scales with price moves during the wait.",
        "file_line": [V + ":981-1010"],
        "description": "The scheduled price is bound to a lock on the first proof submission (_resolveVerifiedGrossUsd), not at lock creation.",
        "evidence": "PoC STATIC-M01: price 1000 at lock creation, poster moves to 2000, first proof binds 2000. " + POC,
        "rev_conflict": "Rev 6 VF-ORC-009/010 and the rule that existing locks keep their creation price.",
    },
    {
        "id": "STATIC-L01", "rig": "7 (manual triage)",
        "severity": "low",
        "damage_potential": "If the poster key is lost, prices stop and all valuation stops. If it is compromised, any price can be posted (no bound or deviation check), which drives issuance directly.",
        "file_line": [V + ":543-547", V + ":596-628"],
        "description": "scheduledPricePoster is a single address. applyScheduledPriceRun accepts any positive price with no bounds, deviation limit or staleness rule. "
                       "This is a trust assumption, rated low because the poster is an operator role by design.",
        "evidence": "Code review: only checks are msg.sender == poster, runId increases, asset is registered, price > 0.",
        "rev_conflict": "none found",
    },
    {
        "id": "STATIC-L02", "rig": "7 (manual triage)",
        "severity": "low",
        "damage_potential": "Fees for an environment with no Dev Fund destination are not caught at verify time.",
        "file_line": [V + ":821-823"],
        "description": "Step 10 Dev Fund destination check (VF-FEE-009) is commented out with a note that it is skipped in simulation.",
        "evidence": "Source lines 821-823 are comments only.",
        "rev_conflict": "Rev 6 VF-FEE-009 (check is required in production).",
    },
    {
        "id": "STATIC-L03", "rig": "7 (manual triage)",
        "severity": "low",
        "damage_potential": "Griefing: a watcher can take a pending lockId first so the victim's lock call reverts. No funds lost.",
        "file_line": [C + ":291"],
        "description": "lockId is chosen by the caller and must be unused; a front-runner can use it first.",
        "evidence": "require(!_locks[lockId].exists) with a caller-supplied lockId.",
        "rev_conflict": "none found",
    },
    {
        "id": "STATIC-L04", "rig": "7 (manual triage)",
        "severity": "low",
        "damage_potential": "A token that rebases down after deposit leaves the CVL short at release.",
        "file_line": [C + ":219-224"],
        "description": "The CVL measures the received amount by balance delta (good for fee-on-transfer tokens) but stores a fixed amount. "
                       "A negative rebase later makes the stored amount larger than the balance. Rated low because the asset list is allowlisted.",
        "evidence": "Code review.",
        "rev_conflict": "none found",
    },
    {
        "id": "STATIC-L05", "rig": "7 (Slither reentrancy-no-eth)",
        "severity": "low",
        "damage_potential": "None today with the allowlisted tokens; would matter if a hook token were ever added.",
        "file_line": [V + ":763", "base-contracts/contracts/VinculumFinalisSynth.sol:138"],
        "description": "verifyAndMint and the Synth forge path write state after external calls (CEI not followed). "
                       "Calls go to trusted tokens and readers, so the Slither entries are triaged FP for exploitability; kept here as a hardening note.",
        "evidence": "testing-rigs/slither/triage.json SL-020, SL-021, SL-022.",
        "rev_conflict": "none found",
    },
    {
        "id": "STATIC-L06", "rig": "7 (Slither calls-loop)",
        "severity": "low",
        "damage_potential": "One reverting or gas-heavy external call in a loop blocks the whole call.",
        "file_line": [S + ":231", S + ":496", V + ":512"],
        "description": "External calls inside loops. Targets are protocol contracts, so the risk is liveness only.",
        "evidence": "testing-rigs/slither/triage.json SL-061 to SL-064.",
        "rev_conflict": "none found",
    },
    {
        "id": "STATIC-I01", "rig": "7 (Slither redundant-statements)",
        "severity": "info",
        "damage_potential": "None. Callers may think daysSinceLaunch affects the mint.",
        "file_line": [V + ":846"],
        "description": "The daysSinceLaunch parameter of verifyAndMint is ignored.",
        "evidence": "Statement 'daysSinceLaunch;' at line 846.",
        "rev_conflict": "none found",
    },
    {
        "id": "STATIC-I02", "rig": "7 (manual triage)",
        "severity": "info",
        "damage_potential": "A lock can be made with a false USD claim; the Verifier prices it again, so the effect is a lock that later fails to mint.",
        "file_line": [C + ":170", C + ":208", C + ":335-348"],
        "description": "The CVL Handshake and standard USD band gate uses verifiedGrossUsd as passed by the caller.",
        "evidence": "Code review.",
        "rev_conflict": "none found (Rev 12 band is re-checked by the Verifier on the priced value)",
    },
    {
        "id": "STATIC-I03", "rig": "7 (Slither unused-return)",
        "severity": "info",
        "damage_potential": "See STATIC-H02.",
        "file_line": [V + ":713"],
        "description": "extCreated from _verifySource is not used to bind valuationTimestamp.",
        "evidence": "testing-rigs/slither/triage.json override.",
        "rev_conflict": "Rev 6 VF-ORC-011/013 (same root as STATIC-H02).",
    },
]


def slither_rollup():
    t = json.load(open(os.path.join(ROOT, "slither/triage.json")))
    c = collections.Counter("%s/%s" % (i["verdict"], i["severity"]) for i in t)
    return {"results": len(t), "by_verdict_severity": dict(sorted(c.items())),
            "triage": "testing-rigs/slither/triage.json and triage.md"}


def mythril_rollup():
    d = os.path.join(ROOT, "mythril/results")
    runs = [l.split() for l in open(os.path.join(d, "runlog.txt")) if l.strip()]
    summ = open(os.path.join(d, "summary.md")).read()
    m = re.search(r"Verdict counts: (\{.*\})", summ)
    return {"targets_run": len(set(r[0] for r in runs)), "runlog_lines": len(runs), "verdicts": m.group(1) if m else "see summary.md",
            "summary": "testing-rigs/mythril/results/summary.md",
            "true_positive_issues": len(re.findall(r"Verdict TP", summ)),
            "untriaged_issues": len(re.findall(r"Verdict untriaged", summ))}



# Founder classification for every finding. A tool that could not analyze a
# contract, or timed out, is INCOMPLETE TESTING, never evidence of safety.
CLASSES = ("CONFIRMED VULNERABILITY", "SPEC CONFLICT", "UNVERIFIED ASSUMPTION", "INCOMPLETE TESTING")
CLASSIFICATION = {
    "STATIC-C01": ("CONFIRMED VULNERABILITY", "Reproduced by PoC; also breaks Rev 6 VF-RAC-001."),
    "STATIC-H02": ("CONFIRMED VULNERABILITY", "Reproduced by PoC; also breaks Rev 6 VF-ORC-011/013."),
    "STATIC-M01": ("CONFIRMED VULNERABILITY", "Reproduced by PoC; also breaks Rev 6 VF-ORC-009/010."),
    "STATIC-L01": ("UNVERIFIED ASSUMPTION", "Safety rests on the single poster key posting correct prices; nothing on chain checks it."),
    "STATIC-L02": ("SPEC CONFLICT", "Rev 6 VF-FEE-009 requires the Dev Fund destination check; the code has it commented out."),
    "STATIC-L03": ("UNVERIFIED ASSUMPTION", "Assumes nobody front-runs a chosen lockId. Not reproduced in a PoC."),
    "STATIC-L04": ("UNVERIFIED ASSUMPTION", "Assumes no rebasing token is ever on the asset list."),
    "STATIC-L05": ("UNVERIFIED ASSUMPTION", "Safe only while every called token and reader is trusted and non-reentrant."),
    "STATIC-L06": ("UNVERIFIED ASSUMPTION", "Assumes loop targets are protocol contracts that never revert or run out of gas."),
    "STATIC-I01": ("UNVERIFIED ASSUMPTION", "Assumes no caller or off-chain tool relies on the ignored daysSinceLaunch value."),
    "STATIC-I02": ("UNVERIFIED ASSUMPTION", "The CVL trusts the caller-supplied USD value; safety rests on the Verifier re-check of the Rev 12 band."),
    "STATIC-I03": ("SPEC CONFLICT", "Same root as STATIC-H02; Rev 6 VF-ORC-011/013 says the valuation time is the source block time."),
    "SMT-01": ("UNVERIFIED ASSUMPTION", "Reverts, no damage. Assumes callers never need counts that large."),
    "SMT-02": ("UNVERIFIED ASSUMPTION", "Reverts, no damage. Assumes no listed token has a supply above 2^256/500."),
    "SMT-03": ("UNVERIFIED ASSUMPTION", "Reverts (fails closed). Assumes listed tokens do not lower the vault balance on transferFrom."),
    "SMT-04": ("UNVERIFIED ASSUMPTION", "Reverts, no damage. Assumes sane block timestamps."),
    "SMT-05": ("UNVERIFIED ASSUMPTION", "Reverts, no damage. Assumes the deployment passes the Rev 6 hard cap; the constructor does not check it."),
}


def mythril_rows():
    rows = []
    for l in open(os.path.join(ROOT, "mythril/results/summary.md")):
        c = [x.strip() for x in l.strip().strip("|").split("|")]
        if len(c) == 6 and c[1].lstrip("-").isdigit():
            rows.append({"contract": c[0], "exit": int(c[1]), "seconds": c[2], "issues": c[3], "coverage": c[4], "note": c[5]})
    return rows


def incomplete_findings(smt):
    inc = []
    def add(i, sev, fl, desc, ev, dmg="Unknown. The code paths were not fully analysed, so no safety claim is made for them."):
        inc.append({"id": i, "rig": i.split("-")[1].lower(), "severity": sev, "damage_potential": dmg,
                    "file_line": fl, "description": desc, "evidence": ev, "rev_conflict": "none",
                    "classification": "INCOMPLETE TESTING",
                    "classification_note": "A tool that could not finish is not evidence of safety."})
    rows = mythril_rows()
    t_out = [r for r in rows if "timeout" in r["note"]]
    errs = [r for r in rows if "internal error" in r["note"] or "no valid JSON" in r["note"] or r["exit"] not in (0, 1)]
    done_low = [r for r in rows if not r["note"] and "%" in r["coverage"] and float(r["coverage"].split("(")[1].rstrip("%)")) < 90]
    if t_out:
        add("INC-MYTHRIL-01", "info", ["base-contracts/contracts (bytecode of %d contracts)" % len(t_out)],
            "Mythril hit its execution timeout on %d contracts, so their symbolic search is incomplete: %s." % (
                len(t_out), "; ".join("%s %s" % (r["contract"], r["coverage"]) for r in t_out)),
            "testing-rigs/mythril/results/summary.md, settings.txt")
    if errs:
        add("INC-MYTHRIL-02", "info", ["base-contracts/contracts (bytecode)"],
            "Mythril logged an internal error or produced no result on: %s. Paths after the error were dropped." % (
                "; ".join("%s (exit %d, %s)" % (r["contract"], r["exit"], r["note"]) for r in errs)),
            "testing-rigs/mythril/results/*.stderr.txt")
    if done_low:
        add("INC-MYTHRIL-03", "info", ["base-contracts/contracts (bytecode)"],
            "Mythril finished before the timeout but only reached part of the code within 2 transactions and depth 128: %s." % (
                "; ".join("%s %s" % (r["contract"], r["coverage"]) for r in done_low)),
            "testing-rigs/mythril/results/summary.md")
    bad = [p for p in smt["properties"] if p["verdict"] != "proven"]
    if bad:
        add("INC-SMT-01", "info", sorted(set(p["harness"] for p in bad)),
            "SMTChecker CHC did not prove %d of %d properties: %s." % (len(bad), len(smt["properties"]), "; ".join(
                "%s %s%s" % (p["id"], p["verdict"], " (spurious trace)" if p.get("counterexample_reading") == "spurious" else "") for p in bad)),
            "testing-rigs/smtchecker/results/properties.json, summary.md")
    prod = smt.get("production_contracts", {})
    crashed = [k for k, v in prod.items() if v["exit"] != 0]
    if crashed:
        add("INC-SMT-02", "info", ["base-contracts/contracts/VinculumFinalisSynth.sol"],
            "SMTChecker could not analyse the production Synth contract: solc/libz3 crashed (SIGSEGV) on every attempt (%s)." % ", ".join(
                "%s exit %d" % (k, prod[k]["exit"]) for k in sorted(crashed)),
            "testing-rigs/smtchecker/results/runlog.txt")
    errd = [k for k, v in prod.items() if v["exit"] == 0 and v["counts"].get("solver_error", 0)]
    if errd:
        add("INC-SMT-03", "info", ["base-contracts/contracts/VinculumFinalisStake.sol", "base-contracts/contracts/VinculumFinalisVerifier.sol"],
            "SMTChecker ran on %s but the solver failed on most targets: %s." % (", ".join(sorted(errd)), "; ".join(
                "%s %d solver errors, %d unproved" % (k, prod[k]["counts"]["solver_error"], prod[k]["counts"].get("unproved", 0)) for k in sorted(errd))),
            "testing-rigs/smtchecker/results/prod_stake.txt, prod_verifier.txt")
    add("INC-FORMAL-01", "info", ["all contracts"],
        "Certora was not available (CERTORAKEY not set in env). SMTChecker CHC was the only formal layer, so no Certora rules were checked.",
        "environment check")
    return inc


FINDINGS_FILE = os.path.join(ROOT, "findings/static.json")
if __name__ == "__main__":
    smt = json.load(open(os.path.join(ROOT, "smtchecker/results/properties.json")))
    allf = []
    for f in FINDINGS + smt.get("findings", []):
        f = dict(f)
        f["classification"], f["classification_note"] = CLASSIFICATION[f["id"]]
        allf.append(f)
    allf += incomplete_findings(smt)
    assert all(f["classification"] in CLASSES for f in allf)
    out = {
        "scope": "base-contracts at origin/main b0e38a9; rigs 5 (Mythril), 6 (SMTChecker), 7 (Slither)",
        "tools": {"slither": open(os.path.join(ROOT, "slither/slither_version.txt")).read().strip(),
                  "mythril": "v0.24.8", "solc": "0.8.19+commit.7dd6d404", "z3": "4.11.2",
                  "certora": "not available (CERTORAKEY not set); SMTChecker CHC was the formal layer"},
        "classification_rule": "Every finding is CONFIRMED VULNERABILITY, SPEC CONFLICT, UNVERIFIED ASSUMPTION or INCOMPLETE TESTING. A tool that cannot analyse a contract or times out is INCOMPLETE TESTING, not evidence of safety.",
        "counts_by_severity": dict(collections.Counter(f["severity"] for f in allf)),
        "counts_by_classification": dict(collections.Counter(f["classification"] for f in allf)),
        "findings": allf,
        "slither": slither_rollup(),
        "mythril": mythril_rollup(),
        "smtchecker": smt,
    }
    json.dump(out, open(FINDINGS_FILE, "w"), indent=2)
    md = ["# Rigs 5, 6, 7 findings (static, symbolic, formal)", "", out["scope"], "", out["classification_rule"], "",
          "Counts by severity: " + ", ".join("%s %d" % kv for kv in sorted(out["counts_by_severity"].items())),
          "Counts by classification: " + ", ".join("%s %d" % kv for kv in sorted(out["counts_by_classification"].items())), "",
          "| id | severity | classification | file:line | description |", "|---|---|---|---|---|"]
    for f in allf:
        fl = f["file_line"] if isinstance(f["file_line"], str) else ", ".join(f["file_line"])
        md.append("| %s | %s | %s | %s | %s |" % (f["id"], f["severity"], f["classification"], fl.replace("base-contracts/contracts/", ""), f["description"].replace("|", "/")))
    open(os.path.join(ROOT, "findings/report.md"), "w").write("\n".join(md) + "\n")
    print("wrote", FINDINGS_FILE, out["counts_by_severity"], out["counts_by_classification"])
