#!/usr/bin/env python3
"""Assumption-gap harness, step 1: extract every external input and the checks that touch it.

For each production contract (contracts/*.sol and contracts/chain-verifiers/*.sol)
this lists every external or public entry point, each parameter, each external
call result, and the environment inputs (msg.sender, block.timestamp,
block.number, blockhash). For each input it records every require, assert,
revert-guarded if, and custom-error revert that reads a value derived from it,
following internal calls, with file:line.

Primary engine: the Slither Python API (data dependency over SlithIR).
Fallback: a regex scan of the Solidity text (used when Slither is not
installed or fails to compile). The engine used is written into the output.

Usage (from the repo root):
  python3 testing-rigs/assumption-gap/extract_inputs.py [--regex] [--out PATH]
Output: testing-rigs/assumption-gap/inputs.json
"""
import argparse
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
CONTRACTS = os.path.join(ROOT, "base-contracts")
SCOPE_DIRS = ["contracts", os.path.join("contracts", "chain-verifiers")]
ENV_VARS = {"msg.sender", "block.timestamp", "block.number", "tx.origin", "msg.value"}


def in_scope(path):
    rel = os.path.relpath(path, CONTRACTS)
    return os.path.dirname(rel) in SCOPE_DIRS


def rel(path):
    return os.path.relpath(path, ROOT)


# ---------------------------------------------------------------- Slither engine
def slither_extract():
    from slither import Slither
    from slither.analyses.data_dependency.data_dependency import is_dependent
    from slither.core.declarations import SolidityVariableComposed, SolidityFunction
    from slither.core.cfg.node import NodeType
    from slither.slithir.operations import HighLevelCall, LowLevelCall, SolidityCall, LibraryCall
    from slither.core.solidity_types import UserDefinedType
    from slither.core.declarations import Structure
    from slither.slithir.operations.internal_call import InternalCall

    sl = Slither(CONTRACTS, hardhat_ignore_compile=True)
    out = []
    seen = set()
    for c in sl.contracts:
        f0 = c.source_mapping.filename.absolute
        if not in_scope(f0) or c.is_interface or c.is_library:
            continue
        if c.name in seen:
            continue
        seen.add(c.name)
        for fn in c.functions_entry_points:
            entry = {
                "contract": c.name,
                "function": fn.name,
                "signature": fn.solidity_signature,
                "file": rel(fn.source_mapping.filename.absolute),
                "line": fn.source_mapping.lines[0] if fn.source_mapping.lines else 0,
                "visibility": fn.visibility,
                "view": bool(fn.view or fn.pure),
                "modifiers": [m.name for m in fn.modifiers],
                "inputs": [],
            }
            # All functions reachable (entry + internal callees + modifiers).
            reach = [fn] + [m for m in fn.modifiers]
            stack = list(reach)
            visited = set()
            while stack:
                g = stack.pop()
                if g in visited:
                    continue
                visited.add(g)
                for ic in g.internal_calls:
                    callee = ic.function if hasattr(ic, "function") else ic
                    if hasattr(callee, "nodes") and callee not in visited:
                        stack.append(callee)
            # Guard nodes: require/assert, if-branches leading to revert, revert with custom error.
            guards = []
            for g in visited:
                for n in g.nodes:
                    is_guard = n.contains_require_or_assert()
                    if not is_guard and n.type == NodeType.IF:
                        # if (...) revert ...;  -> a guard
                        for s in n.sons:
                            for ir in s.irs:
                                if isinstance(ir, SolidityCall) and ir.function.name.startswith("revert"):
                                    is_guard = True
                    if not is_guard:
                        continue
                    lines = n.source_mapping.lines
                    guards.append({
                        "fn": g,
                        "node": n,
                        "where": "%s:%s" % (rel(n.source_mapping.filename.absolute), lines[0] if lines else 0),
                        "text": str(n.expression)[:220] if n.expression else str(n),
                        "reads": list(n.variables_read) + list(n.solidity_variables_read),
                    })

            def checks_for(var, ctx):
                hits = []
                for gd in guards:
                    for r in gd["reads"]:
                        try:
                            dep = (r == var) or is_dependent(r, var, gd["fn"]) or is_dependent(r, var, ctx)
                        except Exception:
                            dep = r == var
                        if dep:
                            hits.append({"at": gd["where"], "check": gd["text"]})
                            break
                # de-duplicate
                uniq, keys = [], set()
                for h in hits:
                    k = (h["at"], h["check"])
                    if k not in keys:
                        keys.add(k)
                        uniq.append(h)
                return uniq

            for p in fn.parameters:
                pchecks = checks_for(p, c)
                entry["inputs"].append({
                    "kind": "param",
                    "name": p.name or "(unnamed)",
                    "type": str(p.type),
                    "checks": pchecks,
                })
                # Struct parameters: one input per field. Field-level checks are
                # matched by text (guard mentions name.field), because SlithIR
                # data dependency is tracked per variable, not per field.
                t = p.type
                if isinstance(t, UserDefinedType) and isinstance(t.type, Structure) and p.name:
                    for el in t.type.elems_ordered:
                        pat = re.compile(r"\b" + re.escape(p.name) + r"\." + re.escape(el.name) + r"\b")
                        fchecks = [g for g in pchecks if pat.search(g["check"])]
                        entry["inputs"].append({
                            "kind": "param_field",
                            "name": "%s.%s" % (p.name, el.name),
                            "type": str(el.type),
                            "checks": fchecks,
                        })
            # environment inputs
            env_seen = set()
            for g in visited:
                for v in g.solidity_variables_read:
                    if v.name in ENV_VARS and v.name not in env_seen:
                        env_seen.add(v.name)
            for name in sorted(env_seen):
                var = SolidityVariableComposed(name)
                entry["inputs"].append({"kind": "env", "name": name, "type": "env", "checks": checks_for(var, c)})
            # external call results (library calls are code, not inputs)
            ext_seen = set()
            for g in visited:
                for n in g.nodes:
                    for ir in n.irs:
                        if isinstance(ir, (HighLevelCall, LowLevelCall)) and not isinstance(ir, (InternalCall, LibraryCall)):
                            fname = str(getattr(ir, "function_name", "?"))
                            dest = str(getattr(ir, "destination", "?"))
                            lv = ir.lvalue
                            lines = n.source_mapping.lines
                            key = (dest, fname, lines[0] if lines else 0)
                            if key in ext_seen:
                                continue
                            ext_seen.add(key)
                            entry["inputs"].append({
                                "kind": "external_call_result",
                                "name": "%s.%s()" % (dest, fname),
                                "type": str(getattr(lv, "type", "")) if lv is not None else "none",
                                "at": "%s:%s" % (rel(n.source_mapping.filename.absolute), lines[0] if lines else 0),
                                "checks": checks_for(lv, c) if lv is not None else [],
                            })
            out.append(entry)
    return out


# ---------------------------------------------------------------- regex fallback
FN_RE = re.compile(r"function\s+(\w+)\s*\(([^)]*)\)([^{;]*)\{", re.S)
GUARD_RE = re.compile(r"(require\s*\(|assert\s*\(|revert\s+\w+\s*\(|revert\s*\(|if\s*\(.*\)\s*revert)")


def regex_extract():
    out = []
    for d in SCOPE_DIRS:
        base = os.path.join(CONTRACTS, d)
        for fn in sorted(os.listdir(base)):
            if not fn.endswith(".sol"):
                continue
            path = os.path.join(base, fn)
            src = open(path).read()
            contract = (re.search(r"\bcontract\s+(\w+)", src) or [None, fn[:-4]])[1]
            for m in FN_RE.finditer(src):
                name, params, tail = m.group(1), m.group(2), m.group(3)
                if not re.search(r"\b(external|public)\b", tail):
                    continue
                start_line = src[: m.start()].count("\n") + 1
                # body up to matching brace
                depth, i = 0, m.end() - 1
                while i < len(src):
                    if src[i] == "{":
                        depth += 1
                    elif src[i] == "}":
                        depth -= 1
                        if depth == 0:
                            break
                    i += 1
                body = src[m.end() - 1 : i + 1]
                body_lines = body.split("\n")
                entry = {"contract": contract, "function": name, "file": rel(path), "line": start_line,
                         "visibility": "external" if "external" in tail else "public",
                         "view": bool(re.search(r"\b(view|pure)\b", tail)), "inputs": []}
                pnames = []
                for p in [x.strip() for x in params.split(",") if x.strip()]:
                    toks = p.split()
                    pnames.append((toks[-1] if len(toks) > 1 else "(unnamed)", toks[0]))
                for pn, pt in pnames + [(e, "env") for e in sorted(ENV_VARS) if e in body]:
                    checks = []
                    for k, ln in enumerate(body_lines):
                        if GUARD_RE.search(ln) and re.search(r"(?<![\w.])" + re.escape(pn) + r"(?!\w)", ln):
                            checks.append({"at": "%s:%d" % (rel(path), start_line + k), "check": ln.strip()[:220]})
                    entry["inputs"].append({"kind": "env" if pt == "env" else "param", "name": pn, "type": pt, "checks": checks})
                out.append(entry)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--regex", action="store_true", help="force the regex fallback")
    ap.add_argument("--out", default=os.path.join(HERE, "inputs.json"))
    a = ap.parse_args()
    engine = "regex"
    if not a.regex:
        try:
            data = slither_extract()
            engine = "slither"
        except Exception as e:  # fall back, but say so
            print("slither unavailable or failed (%s); using regex fallback" % e, file=sys.stderr)
            data = regex_extract()
    else:
        data = regex_extract()
    n_inputs = sum(len(e["inputs"]) for e in data)
    unchecked = sum(1 for e in data for i in e["inputs"] if not i["checks"])
    doc = {"engine": engine, "entry_points": len(data), "inputs": n_inputs, "inputs_with_no_check": unchecked,
           "scope": [os.path.join("base-contracts", d) for d in SCOPE_DIRS], "entries": data}
    with open(a.out, "w") as f:
        json.dump(doc, f, indent=1, sort_keys=False)
    print("engine=%s entry_points=%d inputs=%d inputs_with_no_check=%d -> %s" % (engine, len(data), n_inputs, unchecked, rel(a.out)))


if __name__ == "__main__":
    main()
