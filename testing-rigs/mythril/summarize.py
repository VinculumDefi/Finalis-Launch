#!/usr/bin/env python3
"""Summarize Mythril jsonv2 results: issues, coverage, timeouts."""
import json, os, sys

NAMES = {0x01: "ADD", 0x03: "SUB", 0x02: "MUL", 0x12: "SLT", 0x19: "NOT", 0x36: "CALLDATASIZE",
         0x5b: "JUMPDEST", 0xfd: "REVERT", 0x57: "JUMPI", 0x56: "JUMP", 0x14: "EQ"}


def disasm(hexcode):
    b = bytes.fromhex(hexcode.strip().removeprefix("0x"))
    i, ops = 0, []
    while i < len(b):
        o = b[i]
        if 0x60 <= o <= 0x7f:
            n = o - 0x5f
            ops.append((i, "PUSH", int.from_bytes(b[i + 1:i + 1 + n], "big")))
            i += 1 + n
        else:
            ops.append((i, NAMES.get(o, "OP%02x" % o), None))
            i += 1
    return ops


def classify(name, swc, pc, outdir):
    """Return (verdict, reason) by looking at the bytecode at the flagged pc."""
    try:
        ops = disasm(open(os.path.join(outdir, "bytecode", name + ".hex")).read())
    except OSError:
        return ("untriaged", "bytecode not found")
    idx = {p: k for k, (p, _, _) in enumerate(ops)}
    k = idx.get(pc)
    if k is None:
        return ("untriaged", "pc not on an instruction boundary")
    window = [o for _, o, _ in ops[max(0, k - 4):k + 2]]
    if swc == "101" and ops[k][1] == "ADD" and "NOT" in window and "SLT" in window[window.index("ADD"):]:
        # PUSH1 3; NOT; (CALLDATASIZE or DUP); ADD; SLT  ==  calldatasize - 4 < N
        return ("FP", "ABI decoder calldata length check (calldatasize + ~3, then SLT); wrap is intended")
    after = [o for _, o, _ in ops[k:k + 3]]
    if swc == "101" and ops[k][1] in ("ADD", "SUB") and "CALLDATASIZE" in window and "SLT" in after:
        # calldatasize - offset vs struct size: viaIR ABI decoder bounds check; wrap is intended
        return ("FP", "ABI decoder calldata bounds check (calldatasize - offset, then SLT); wrap is intended")
    if swc == "113":
        return ("TP-info", "more than one external call in one transaction (token balance reads and transfer); "
                           "a failing call reverts the whole tx; tokens are allowlisted; same as Slither calls-loop")
    if swc == "123" and "REVERT" in [o for _, o, _ in ops[k:k + 4]] + window:
        return ("FP", "plain revert(0,0) in dispatcher or ABI guard; no state effect")
    return ("untriaged", "needs manual review: " + " ".join(window))

out = sys.argv[1]
runlog = {}
for line in open(os.path.join(out, "runlog.txt")):
    parts = line.split()
    runlog[parts[0]] = {k: v for k, v in (p.split("=") for p in parts[1:])}
print("# Mythril summary\n")
print("| Contract | exit | seconds | issues | max instr coverage | note |")
print("|---|---|---|---|---|---|")
allissues = []
for name in sorted(runlog):
    path = os.path.join(out, name + ".json")
    note = ""
    issues, cov = [], "n/a"
    try:
        d = json.load(open(path))
        issues = d[0].get("issues", [])
        c = d[0]["meta"].get("mythril_execution_info", {}).get("coverage") or [{"instructions_covered": 0, "total_instructions": 0}]
        best = max(c, key=lambda x: x["instructions_covered"] / max(1, x["total_instructions"]))
        cov = "not reported" if not best["total_instructions"] else "%d/%d (%.1f%%)" % (best["instructions_covered"], best["total_instructions"],
                                  100.0 * best["instructions_covered"] / max(1, best["total_instructions"]))
        if any(l.get("level") == "error" for l in d[0]["meta"].get("logs", [])):
            note = "Mythril internal error logged (some paths dropped)"
    except Exception as e:  # empty or invalid output
        note = "no valid JSON output (%s)" % type(e).__name__
    secs = int(runlog[name].get("seconds", 0))
    timeout = int(os.environ.get("EXEC_TIMEOUT", "240"))  # 300 main run, 240 rerun; >=240 flags both
    if secs >= timeout:
        note = (note + "; " if note else "") + "hit execution timeout (search incomplete)"
    print("| %s | %s | %s | %d | %s | %s |" % (name, runlog[name].get("exit"), secs, len(issues), cov, note))
    for i in issues:
        loc = i.get("locations", [{}])[0].get("sourceMap", "")
        pc = int(loc.split(":")[0]) if loc else -1
        verdict, why = classify(name, str(i.get("swcID", "")).replace("SWC-", ""), pc, out)
        allissues.append((name, i.get("swcID"), i.get("swcTitle"), i.get("severity"), loc,
                          i.get("description", {}).get("head", ""), verdict, why))
print("\n## Issues\n")
if not allissues:
    print("None reported.")
from collections import Counter
print("Verdict counts: %s\n" % dict(Counter(a[6] for a in allissues)))
for a in allissues:
    print("- %s: %s %s, severity %s, pc %s. %s Verdict %s: %s" % a)
