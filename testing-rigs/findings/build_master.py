#!/usr/bin/env python3
"""Build testing-rigs/findings/master.json and testing-rigs/MASTER_FINDINGS.md.

Inputs (all in testing-rigs/findings/):
  recorder_status.json  hand-maintained rig status, scope (live/latent), merges,
                        related cross-refs and per-row recorder notes
  <rig>.json            every per-rig findings file (anything else ending .json
                        that has a "findings" list)
Run from anywhere: python3 testing-rigs/findings/build_master.py
"""
import glob
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SKIP = {"recorder_status.json", "master.json"}
SEV = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
CLS = {"CONFIRMED VULNERABILITY": 0, "SPEC CONFLICT": 1, "UNVERIFIED ASSUMPTION": 2, "INCOMPLETE TESTING": 3}


def as_list(x):
    if x is None:
        return []
    return x if isinstance(x, list) else [x]


def strongest(c):
    # a rig may list several classes for one finding; keep the strongest
    return min(as_list(c), key=lambda x: CLS[x])


def norm_sev(s):
    # "LOW-MEDIUM" style ranges take the higher severity (stronger view)
    parts = [x.strip() for x in str(s or "info").lower().split("-")]
    return min(parts, key=lambda x: SEV[x])


def classify(f, src, st):
    if f.get("classification"):
        return strongest(f["classification"])
    if f.get("class"):
        return strongest(f["class"])
    if f["id"] in st.get("ag_class_overrides", {}):
        return st["ag_class_overrides"][f["id"]]
    if src == "assumption_gap.json":
        return "CONFIRMED VULNERABILITY" if f.get("poc") else "UNVERIFIED ASSUMPTION"
    return "UNVERIFIED ASSUMPTION"


def scope_of(f, cls, st):
    if f.get("scope"):
        return f["scope"]
    if f["id"] in st["scope"]:
        return st["scope"][f["id"]]
    return "N/A (tooling coverage)" if cls == "INCOMPLETE TESTING" else "UNSET"


def main():
    st = json.load(open(os.path.join(HERE, "recorder_status.json")))
    raw = []
    for p in sorted(glob.glob(os.path.join(HERE, "*.json"))):
        name = os.path.basename(p)
        if name in SKIP:
            continue
        d = json.load(open(p))
        for f in d.get("findings", []):
            cls = classify(f, name, st)
            spec = f.get("spec_refs") or []
            raw.append({
                "ids": [f["id"]], "source": "testing-rigs/findings/" + name, "class": cls,
                "severity": norm_sev(f.get("severity")), "scope": scope_of(f, cls, st),
                "file_line": as_list(f.get("file_line")), "description": f.get("description", ""),
                "damage_potential": f.get("damage_potential", ""),
                "evidence": [f.get("poc") or f.get("evidence", "")],
                "spec": as_list(spec) + ([f["rev_conflict"]] if f.get("rev_conflict") else []),
                "rank_hint": f.get("rank", 99),
            })
    by_id = {r["ids"][0]: r for r in raw}
    merged_away = set()
    for m in st.get("merge", []):
        rows = [by_id[i] for i in m["ids"] if i in by_id]
        if len(rows) < 2:
            continue
        keep = rows[0]
        for o in rows[1:]:
            keep["ids"] += o["ids"]
            keep["source"] += ", " + o["source"]
            keep["file_line"] += [x for x in o["file_line"] if x not in keep["file_line"]]
            keep["evidence"] += o["evidence"]
            keep["spec"] += [x for x in o["spec"] if x not in keep["spec"]]
            keep.setdefault("rig_views", {})[o["ids"][0]] = {"class": o["class"], "severity": o["severity"]}
            if SEV[o["severity"]] < SEV[keep["severity"]]:
                keep["severity"] = o["severity"]
            if CLS[o["class"]] < CLS[keep["class"]]:
                keep["class"] = o["class"]
            merged_away.add(id(o))
    rows = [r for r in raw if id(r) not in merged_away]
    for r in rows:
        if r["ids"][0] in st.get("related", {}):
            r["related"] = st["related"][r["ids"][0]]
        if r["ids"][0] in st.get("notes", {}):
            r["note"] = st["notes"][r["ids"][0]]
    rows.sort(key=lambda r: (SEV[r["severity"]], CLS[r["class"]], 0 if r["scope"].startswith("LIVE") else 1, r["rank_hint"], r["ids"][0]))
    for i, r in enumerate(rows, 1):
        r["rank"] = i
    rigs = st["rigs"]
    present = {os.path.basename(p) for p in glob.glob(os.path.join(HERE, "*.json"))}
    for g in rigs:
        if g.get("findings_file") and g["findings_file"] not in present:
            g["status"] = "RUNNING"
            g["note"] = "findings file not on main yet"
    counts = {}
    for r in rows:
        counts.setdefault(r["class"], 0)
        counts[r["class"]] += 1
    out = {"as_of": st["as_of"], "header_notes": st.get("header_notes", []), "class_rule": st["class_rule"], "scope_rule": st["scope_rule"],
           "rigs": rigs, "counts_by_class": counts, "unscoped": [r["ids"] for r in rows if r["scope"] == "UNSET"],
           "findings": rows}
    json.dump(out, open(os.path.join(HERE, "master.json"), "w"), indent=1)
    write_md(out)
    print(json.dumps({"findings": len(rows), "counts_by_class": counts, "unscoped": out["unscoped"]}, indent=1))


def c(s):
    return str(s).replace("|", "\\|").replace("\n", " ")


def short(s, n=260):
    s = " ".join(str(s).split())
    return s if len(s) <= n else s[:n - 3].rstrip() + "..."


def write_md(out):
    L = ["# Master findings", "",
         "Generated by testing-rigs/findings/build_master.py from the per-rig findings JSONs and recorder_status.json. Do not edit by hand; edit the inputs and rerun.", "",
         "Status as of %s. Findings only: nothing here has been fixed, deployed or signed." % out["as_of"], ""]
    L += ["- " + x for x in out.get("header_notes", [])] + ([""] if out.get("header_notes") else [])
    L += [
         "## Rig status", "",
         "| Rig | Name | Status | Branch | Commit | Raw output | Notes |", "|---|---|---|---|---|---|---|"]
    for g in out["rigs"]:
        note = " ".join(x for x in [g.get("incomplete", ""), g.get("note", "")] if x) or "-"
        L.append("| %s |" % " | ".join(c(x) for x in [g["n"], g["name"], g["status"], g["branch"], g["commit"], g["raw_output"], note]))
    L += ["", "## Classes and scope", "", "- " + out["class_rule"], "- " + out["scope_rule"], "",
          "Counts by class: " + ", ".join("%s %d" % (k, v) for k, v in sorted(out["counts_by_class"].items(), key=lambda kv: CLS[kv[0]])), "",
          "## Findings, ranked by severity, then class, then live before latent, then the rig's own damage rank", "",
          "| # | Id | Class | Severity | Live Base set or latent | File:line | Short description | Evidence path | Spec cross-ref |",
          "|---|---|---|---|---|---|---|---|---|"]
    for r in out["findings"]:
        ids = " = ".join(r["ids"])
        desc = short(r["description"])
        if r.get("rig_views"):
            desc += " (Also reported as " + ", ".join("%s: %s, %s" % (k, v["class"].lower(), v["severity"]) for k, v in r["rig_views"].items()) + ".)"
        if r.get("related"):
            desc += " Related: " + r["related"] + "."
        if r.get("note"):
            desc += " Recorder note: " + r["note"]
        ev = "; ".join(short(e, 160) for e in r["evidence"] if e) + " [" + r["source"] + "]"
        L.append("| %s |" % " | ".join(c(x) for x in [r["rank"], ids, r["class"], r["severity"], r["scope"], "; ".join(r["file_line"][:4]) + (" (+%d more)" % (len(r["file_line"]) - 4) if len(r["file_line"]) > 4 else ""), desc, ev, short("; ".join(r["spec"]), 220) or "-"]))
    L.append("")
    open(os.path.join(os.path.dirname(HERE), "MASTER_FINDINGS.md"), "w").write("\n".join(L))


if __name__ == "__main__":
    main()
