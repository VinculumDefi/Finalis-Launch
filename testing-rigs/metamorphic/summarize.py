#!/usr/bin/env python3
"""Summarize metamorphic results/relations.jsonl into results/summary.json (discovery only)."""
import json, collections, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "results", "relations.jsonl")
dst = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "results", "summary.json")
rows = [json.loads(l) for l in open(src) if l.strip()]
by = collections.defaultdict(collections.Counter)
viol = []
for r in rows:
    by[r.get("mr", "?")][r.get("verdict") or "n/a"] += 1
    if r.get("verdict") and r["verdict"] != "PASS":
        viol.append({k: v for k, v in r.items() if k != "lock"})
out = {"relations": len(rows), "by_relation": {k: dict(v) for k, v in sorted(by.items())}, "violations": viol}
json.dump(out, open(dst, "w"), indent=1)
print(json.dumps({"relations": len(rows), "violations": len(viol)}))
