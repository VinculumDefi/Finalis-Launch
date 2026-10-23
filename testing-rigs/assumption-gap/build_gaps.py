#!/usr/bin/env python3
"""Assumption-gap harness, step 2: pair the extracted checks with the assumption table.

Reads inputs.json (from extract_inputs.py) and assumptions.json (hand table).
For each assumption it collects every check the extractor found on the
selected inputs, then tests each required property against those checks.
A required property with no matching check is a gap. App-side rows scan the
named src/ file for what it trusts and for an independent check.

Writes gap_table.json and gap_table.md, and exits 1 if the known Oct 22
forged-header gap (AG-01) is not flagged, so a regression in the harness
itself is caught.

Usage (from the repo root):
  python3 testing-rigs/assumption-gap/build_gaps.py
"""
import csv
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SEV_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4, "none": 5}


def load():
    inputs = json.load(open(os.path.join(HERE, "inputs.json")))
    table = json.load(open(os.path.join(HERE, "assumptions.json")))
    return inputs, table


def index_entries(inputs):
    idx = {}
    for e in inputs["entries"]:
        idx.setdefault((e["contract"], e["function"]), []).append(e)
    return idx


def body_of(entry):
    path = os.path.join(ROOT, entry["file"])
    lines = open(path).read().split("\n")
    out, depth, started = [], 0, False
    for ln in lines[entry["line"] - 1:]:
        out.append(ln)
        depth += ln.count("{") - ln.count("}")
        if "{" in ln:
            started = True
        if started and depth <= 0:
            break
    return "\n".join(out)


def eval_contract_row(a, idx):
    checks, missing_sel = [], []
    fail_closed_ok = True
    for sel in a["select"]:
        entries = idx.get((sel["contract"], sel["function"]))
        if not entries:
            missing_sel.append("%s.%s" % (sel["contract"], sel["function"]))
            continue
        for e in entries:
            if a.get("fail_closed"):
                b = body_of(e)
                if not re.search(r"^\s*revert\s*\(", b, re.M):
                    fail_closed_ok = False
            for i in e["inputs"]:
                if sel["input"] == "*" or i["name"] == sel["input"]:
                    for c in i["checks"]:
                        item = {"at": c["at"], "check": c["check"], "on": "%s.%s(%s)" % (e["contract"], e["function"], i["name"])}
                        if not any(x["at"] == item["at"] and x["check"] == item["check"] for x in checks):
                            checks.append(item)
    results = []
    for req in a["required"]:
        rx = re.compile(req["evidence"], re.I)
        if req.get("in") == "body":
            hit = []
            for sel in a["select"]:
                for e in idx.get((sel["contract"], sel["function"]), []):
                    for n, ln in enumerate(body_of(e).split("\n")):
                        if rx.search(ln):
                            hit.append({"at": "%s:%d" % (e["file"], e["line"] + n)})
        else:
            hit = [c for c in checks if rx.search(c["check"])]
        results.append({"property": req["property"], "met": bool(hit), "by": [h["at"] for h in hit][:4]})
    gap = any(not r["met"] for r in results)
    if a.get("fail_closed"):
        gap = not fail_closed_ok
        results.append({"property": "always reverts (fail closed)", "met": fail_closed_ok, "by": []})
    return checks, results, gap, missing_sel


def eval_app_row(a):
    path = os.path.join(ROOT, a["app"]["file"])
    src = open(path).read().split("\n")
    trust = re.compile(a["app"]["trusts"])
    checks = [{"at": "%s:%d" % (a["app"]["file"], n + 1), "check": ln.strip()[:200], "on": "app"} for n, ln in enumerate(src) if trust.search(ln)]
    results = []
    for req in a["required"]:
        rx = re.compile(req["evidence"])
        hit = [n + 1 for n, ln in enumerate(src) if rx.search(ln)]
        results.append({"property": req["property"], "met": bool(hit), "by": ["%s:%d" % (a["app"]["file"], h) for h in hit][:4]})
    gap = bool(checks) and any(not r["met"] for r in results)
    return checks, results, gap, []


def main():
    inputs, table = load()
    idx = index_entries(inputs)
    csv_ids = {r[0] for r in csv.reader(open(os.path.join(ROOT, "Vinculum_Finalis_Requirement_Traceability.csv")))}
    rows, problems = [], []
    for a in table["assumptions"]:
        if "app" in a:
            checks, results, gap, missing = eval_app_row(a)
        else:
            checks, results, gap, missing = eval_contract_row(a, idx)
        if missing:
            problems.append("%s: selector not found: %s" % (a["id"], ", ".join(missing)))
        for s in a["spec"]:
            if s.startswith("VF-") and s.split(" ")[0] not in csv_ids and "code tag" not in s:
                problems.append("%s: spec id %s not in Rev 6 CSV" % (a["id"], s))
        # A hand-declared finding must be backed by a derived gap, except
        # documentation rows whose evidence is the never-matching pattern.
        if a.get("finding") and not gap:
            problems.append("%s (%s): table names a finding but no gap was derived" % (a["id"], a["finding"]))
        rows.append({
            "assumption": a["id"], "finding": a.get("finding"), "domain": a["domain"], "input": a["input"],
            "entry_point": a["location"], "assumed_property": a["assumed"],
            "checked_properties": [c["at"] + "  " + c["check"] for c in checks],
            "required_properties": results, "gap_flagged": gap,
            "gap": a["gap"] if gap else "none", "exploit_sketch": a.get("exploit", ""), "damage_potential": a.get("damage", ""),
            "severity": a["severity"] if gap else "none", "rank": a.get("rank") if gap else None,
            "spec": a["spec"], "rev_conflict": a.get("rev_conflict", ""), "poc": a.get("poc", ""),
        })
    rows.sort(key=lambda r: (r["rank"] is None, r["rank"] or 0, r["assumption"]))
    n_inputs = inputs["inputs"]
    summary = {
        "extractor_engine": inputs["engine"], "entry_points": inputs["entry_points"], "inputs_mapped": n_inputs,
        "inputs_with_no_check": inputs["inputs_with_no_check"], "assumptions": len(rows),
        "gaps_flagged": sum(1 for r in rows if r["gap_flagged"]),
        "forged_header_gap_AG01_flagged": any(r["finding"] == "AG-01" and r["gap_flagged"] for r in rows),
        "problems": problems,
    }
    json.dump({"summary": summary, "rows": rows}, open(os.path.join(HERE, "gap_table.json"), "w"), indent=1)
    write_md(summary, rows)
    print(json.dumps(summary, indent=1))
    if not summary["forged_header_gap_AG01_flagged"]:
        print("FAIL: the Oct 22 forged-header gap (AG-01) was not flagged", file=sys.stderr)
        sys.exit(1)


def cell(s):
    return str(s).replace("|", "\\|").replace("\n", " ")


def write_md(summary, rows):
    L = ["# Assumption-gap table", "",
         "Generated by build_gaps.py from inputs.json (%s engine) and assumptions.json. Do not edit by hand." % summary["extractor_engine"], "",
         "- Entry points scanned: %d" % summary["entry_points"],
         "- Inputs mapped (params, struct fields, env values, external call results): %d" % summary["inputs_mapped"],
         "- Inputs with no check at all: %d (full list in inputs.json)" % summary["inputs_with_no_check"],
         "- Assumptions in the hand table: %d; gaps flagged: %d" % (summary["assumptions"], summary["gaps_flagged"]),
         "- Oct 22 forged-header gap (AG-01) flagged: %s" % ("yes" if summary["forged_header_gap_AG01_flagged"] else "NO"), ""]
    if summary["problems"]:
        L += ["Harness warnings:", ""] + ["- " + p for p in summary["problems"]] + [""]
    L += ["| Rank | Finding | Severity | Input | Entry point (file:line) | Assumed property | Checked properties | Gap | Exploit sketch | Damage potential | Spec / revision conflict | PoC |",
          "|---|---|---|---|---|---|---|---|---|---|---|---|"]
    for r in rows:
        checked = "; ".join(sorted({c.split("  ")[0] for c in r["checked_properties"]})) or "none"
        unmet = [p["property"] for p in r["required_properties"] if not p["met"]]
        gap = r["gap"] + ((" Missing: " + "; ".join(unmet) + ".") if (r["gap_flagged"] and unmet) else "")
        spec = ", ".join(r["spec"]) + ((". " + r["rev_conflict"]) if r["rev_conflict"] else "")
        L.append("| %s |" % " | ".join(cell(x) for x in [r["rank"] or "-", r["finding"] or "-", r["severity"], r["input"], r["entry_point"], r["assumed_property"], checked, gap, r["exploit_sketch"] or "-", r["damage_potential"] or "-", spec, r["poc"] or "-"]))
    L.append("")
    open(os.path.join(HERE, "gap_table.md"), "w").write("\n".join(L))


if __name__ == "__main__":
    main()
