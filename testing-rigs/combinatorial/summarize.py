#!/usr/bin/env python3
"""Summarize combinatorial results/cells.jsonl into results/summary.json (discovery only)."""
import json, collections, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "results", "cells.jsonl")
dst = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "results", "summary.json")
cells = [json.loads(l) for l in open(src) if l.strip()]
by_verdict = collections.Counter(c["verdict"] for c in cells)
by_group = collections.Counter()
examples = {}
for c in cells:
    by_group["|".join([c["env"], c["cls"], "bound" if c["bound"] else "unbound", c["verdict"]])] += 1
    if c["verdict"] != "PASS":
        examples.setdefault(c["verdict"], {k: c[k] for k in c if k != "lock"})
refusals = collections.Counter(c.get("lock_err") or c.get("record_err") or c.get("mint_err") for c in cells
                               if c["observed"].startswith("refuse"))
accepted = [c for c in cells if c.get("lock_ok")]
out = {
    "cells": len(cells),
    "grid_cells_expected": 2688 + 8,
    "verdicts": dict(by_verdict),
    "by_env_class_binding_verdict": dict(sorted(by_group.items())),
    "refusal_reasons": {str(k): v for k, v in refusals.most_common()},
    "fee_rule": {
        "accepted_locks": len(accepted),
        "fee_not_5pct_floor": sum(1 for c in accepted if not c.get("fee_is_floor5pct")),
        "devfund_delta_ne_fee": sum(1 for c in accepted if c.get("devfund_received") != c.get("fee")),
    },
    "deviation_examples": examples,
}
json.dump(out, open(dst, "w"), indent=1)
print(json.dumps({k: out[k] for k in ("cells", "verdicts", "fee_rule")}, indent=1))
