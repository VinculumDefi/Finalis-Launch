#!/usr/bin/env python3
"""Merge per-worker mutant result lines into one summary with a score per contract.
Score = killed / (killed + survived). Stillborn (does not compile under viaIR),
equivalent (identical deployed bytecode) and not_applied are excluded. A kill that came
only from the per-phase timeout is reported as status "timeout" (INCOMPLETE TESTING), not as killed,
and is excluded from the score; so are pin_only (killed only by a bytecode/code-hash pin) and error."""
import glob, json, sys, collections
src, out = sys.argv[1], sys.argv[2]
rows = []
for f in sorted(glob.glob(src + "/mutants_w*.jsonl")):
    rows += [json.loads(l) for l in open(f)]
for r in rows:
    if r["status"] == "killed" and str(r.get("killed_by", "")).startswith("timeout"):
        r["status"] = "timeout"
per = collections.defaultdict(collections.Counter)
for r in rows:
    per[r["contract"]][r["status"]] += 1
score = {}
for c, k in sorted(per.items()):
    d = k["killed"] + k["survived"]
    score[c] = {**k, "score": round(k["killed"] / d, 3) if d else None}
tot = collections.Counter(r["status"] for r in rows)
d = tot["killed"] + tot["survived"]
surv = sorted([r for r in rows if r["status"] == "survived"], key=lambda r: (r["contract"], r["line"] or 0))
json.dump({"total": {**tot, "score": round(tot["killed"] / d, 3) if d else None}, "per_contract": score,
           "survivors": surv, "all": sorted(rows, key=lambda r: r["id"])}, open(out, "w"), indent=1)
print(json.dumps({"total": dict(tot), "per_contract": score}, indent=1))
for r in surv:
    print(r["id"], "%s:%s" % (r["file"], r["line"]), r["what"][:120])
