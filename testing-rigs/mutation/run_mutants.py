#!/usr/bin/env python3
"""Rig 8: mutation testing for the Vinculum Finalis production contracts.

Mutant sources:
  1. Gambit v0.2.1 mutants (generated with --skip_validate because gambit has no
     via-IR switch). A seeded, stratified sample is taken per contract, with
     relational, require, delete and if mutations first.
  2. Targeted Python mutants for the protocol constants and caller checks named
     in the rig brief (fee bps, 10M / 100M thresholds, 0.95e18 floor, decay,
     RAC rate, Handshake band, msg.sender swaps).

Each mutant is applied inside a scratch copy of base-contracts (never the repo
checkout), compiled with Hardhat (viaIR), compared against the baseline
bytecode (identical bytecode = equivalent, excluded), then the mapped Hardhat
tests run with --bail and a timeout. Survivors of the fast set are re-run
against the slow mapped tests before being reported as surviving.

Usage:
  run_mutants.py --workdir <scratch root>/base-contracts --gambit <dir with gambit_*>
                 --out results/ [--worker N --workers M]
No network, no keys, no deployment.
"""
import argparse, hashlib, json, os, random, re, shutil, subprocess, sys, time

SEED = 20261023
TIMEOUT = 900

C = "contracts/"
FILES = {
    "Token": C + "VinculumFinalisToken.sol",
    "Verifier": C + "VinculumFinalisVerifier.sol",
    "Stake": C + "VinculumFinalisStake.sol",
    "Synth": C + "VinculumFinalisSynth.sol",
    "BaseCVL": C + "BaseCommitmentVaultLock.sol",
    "CVL": C + "CommitmentVaultLock.sol",
    "Durations": C + "CommitmentDurations.sol",
}
GAMBIT_DIR = {
    "Token": "gambit_VinculumFinalisToken", "Verifier": "gambit_VinculumFinalisVerifier",
    "Stake": "gambit_VinculumFinalisStake", "Synth": "gambit_VinculumFinalisSynth",
    "BaseCVL": "gambit_BaseCommitmentVaultLock", "CVL": "gambit_CommitmentVaultLock",
    "Durations": "gambit_CommitmentDurations",
}
SAMPLE = {"Verifier": 30, "Stake": 20, "Token": 12, "Synth": 8, "BaseCVL": 12, "CVL": 10, "Durations": 6}

# Mapped tests (fast set first, slow set only for survivors). Excluded on purpose:
# ceremony_artifacts_match_compile (bytecode pin, kills every mutant trivially),
# live_config (needs a git checkout), retired_scripts (scripts only).
T = lambda *n: ["test/%s.test.cjs" % x for x in n]
FAST = {
    "Token": T("00_smoke", "01_findings", "cl01_cl11_verifier", "lock_5pct_native_erc20_7chains",
               "lock_exists_and_asset_match", "mint_path_ceremony", "non_base_finality_trust_model",
               "non_base_lock_protocol_token_refusal", "predeploy_suite", "representativeRules",
               "stake_claim_full_entitlement", "token_locks", "token_substitution_adversarial",
               "utxo_handshake_unit_band", "protocol_tokens_chonx_synth_e2e", "vclm_row_488_chonx",
               "trs_rewards_e2e"),
    "Verifier": T("00_smoke", "01_findings", "base44_app_chonx_output", "base44_app_mint_rev_b",
                  "ceremony_registry_guard", "cl01_cl11_verifier", "lock_5pct_native_erc20_7chains",
                  "lock_exists_and_asset_match", "mint_path_ceremony", "non_base_finality_trust_model",
                  "predeploy_suite", "token_locks", "token_substitution_adversarial", "trs_rewards_e2e",
                  "utxo_handshake_unit_band", "vclm_row_488_chonx", "protocol_tokens_chonx_synth_e2e"),
    "Stake": T("00_smoke", "cl01_cl11_verifier", "lock_exists_and_asset_match", "mint_path_ceremony",
               "predeploy_suite", "stake_claim_full_entitlement", "stake_t272_eligibility", "token_locks",
               "token_substitution_adversarial", "trs_rewards_e2e", "utxo_handshake_unit_band",
               "app_stake_simulator_matches_contract", "stake_bounded_gas_differential"),
    "Synth": T("00_smoke", "ceremony_registry_guard", "lock_5pct_native_erc20_7chains", "mint_path_ceremony",
               "non_base_lock_protocol_token_refusal", "predeploy_suite", "protocol_tokens_chonx_synth_e2e",
               "representativeRules", "token_substitution_adversarial", "trs_rewards_e2e",
               "protocol_tokens_cvl_trs_forge"),
    "BaseCVL": T("base44_app_chonx_output", "ceremony_registry_guard", "lock_5pct_native_erc20_7chains",
                 "non_base_finality_trust_model", "non_base_lock_protocol_token_refusal",
                 "protocol_tokens_cvl_trs_forge", "token_substitution_adversarial", "trs_rewards_e2e",
                 "base_ceremony_flow", "test_chain_ceremony"),
    "CVL": T("CommitmentVaultLock", "lock_5pct_native_erc20_7chains", "lock_exists_and_asset_match",
             "non_base_finality_trust_model", "non_base_lock_guard", "non_base_lock_protocol_token_refusal",
             "predeploy_suite", "representativeRules", "token_locks"),
    "Durations": T("cl01_cl11_verifier", "lock_5pct_native_erc20_7chains", "CommitmentVaultLock",
                   "utxo_handshake_unit_band", "token_locks", "representativeRules"),
}
# 2026-10-23 batch fix: the new behaviour tests run first for every contract.
for _c in FAST:
    FAST[_c] = T("batch_fix_2026_10_23", "mutant_kills_2026_10_23") + FAST[_c]
SLOW = {
    "Stake": T("stake_scheduled_weight_eval", "stake_scheduled_weight_gas", "stake_t272_long_claims",
               "stake_t272_allocation_scale", "stake_t276_claim_planner", "stake_t277_claim_display"),
    "CVL": T("arbitrum_lock_reader", "ethereum_lock_reader", "evm_lock_readers"),
    "Verifier": T("utxo_lock_readers", "xrpl_lock_reader", "stellar_lock_reader"),
    "BaseCVL": T("01_findings", "token_locks"),
}

# lock_5pct_native_erc20_7chains also checks the lock runtime code hash through
# scripts/prepareLockDeploy.cjs, which fails for any lock bytecode change. It runs last;
# a kill that only comes from that hash pin is reported as pin_only (the behaviour tests
# did not see the mutant) and is NOT counted as killed.
PIN_PRONE = set(T("lock_5pct_native_erc20_7chains"))
PIN_RE = re.compile(r"code hash|codehash|bytecode", re.I)

# Targeted mutants: (id, contract, line, old, new, what, blind_class_if_survives)
TARGETED = [
    ("T-VF-01", "Verifier", 206, "STANDARD_FEE_BPS = 500;", "STANDARD_FEE_BPS = 499;", "fee bps 500 -> 499", "fee constant"),
    ("T-VF-02", "Verifier", 203, "10_000_000 * 1e18", "9_999_999 * 1e18", "CHONX activation 10M -> 9,999,999", "activation threshold boundary"),
    ("T-VF-03", "Verifier", 1130, ">= CHONX_ACTIVATION_THRESHOLD", "> CHONX_ACTIVATION_THRESHOLD", "CHONX activation >= -> >", "activation threshold boundary"),
    ("T-VF-04", "Verifier", 240, "0.95e18", "0.94e18", "USD stable floor 0.95 -> 0.94", "stablecoin depeg floor"),
    ("T-VF-05", "Verifier", 1003, ">= USD_STABLE_MIN_PRICE", "> USD_STABLE_MIN_PRICE", "stable floor >= -> >", "stablecoin depeg floor boundary"),
    ("T-VF-06", "Verifier", 243, "983330000000000000", "983340000000000000", "decay 0.98333 -> 0.98334", "emission decay constant"),
    ("T-VF-07", "Verifier", 263, "RAC_CREDIT_RATE_BPS = 6000", "RAC_CREDIT_RATE_BPS = 5999", "RAC rate 6000 -> 5999 bps", "RAC credit constant"),
    ("T-VF-08", "Verifier", 600, "msg.sender == scheduledPricePoster", "msg.sender == deployer", "price poster check swapped to deployer", "oracle caller check"),
    ("T-VF-09", "Verifier", 600, "msg.sender == scheduledPricePoster", "tx.origin == scheduledPricePoster", "price poster msg.sender -> tx.origin", "contract-caller / tx.origin"),
    ("T-VF-10", "Verifier", 396, "msg.sender == deployer", "tx.origin == deployer", "deployer msg.sender -> tx.origin", "contract-caller / tx.origin"),
    ("T-VF-11", "Verifier", 210, "HANDSHAKE_USD_MIN = 0.01e18", "HANDSHAKE_USD_MIN = 0.009e18", "Handshake min $0.01 -> $0.009", "Handshake band (Rev 12)"),
    ("T-VF-12", "Verifier", 211, "HANDSHAKE_USD_MAX = 0.02e18", "HANDSHAKE_USD_MAX = 0.021e18", "Handshake max $0.02 -> $0.021", "Handshake band (Rev 12)"),
    ("T-VF-13", "Verifier", 919, ">= HANDSHAKE_USD_MIN", "> HANDSHAKE_USD_MIN", "Handshake min >= -> >", "Handshake band boundary (Rev 12)"),
    ("T-VF-14", "Verifier", 919, "<= HANDSHAKE_USD_MAX", "< HANDSHAKE_USD_MAX", "Handshake max <= -> <", "Handshake band boundary (Rev 12)"),
    ("T-VF-15", "Verifier", 200, "100_000_000_000 * 1e18", "100_000_000_001 * 1e18", "CHONX hard cap +1 token", "hard cap constant"),
    ("T-VF-16", "Verifier", 199, "10_000_000_000 * 1e18", "10_000_000_001 * 1e18", "VCLM hard cap +1 token", "hard cap constant"),
    ("T-VF-17", "Verifier", 212, "STANDARD_USD_MIN = 0.01e18", "STANDARD_USD_MIN = 0.009e18", "standard minimum $0.01 -> $0.009", "minimum lock value"),
    ("T-SY-01", "Synth", 61, "100_000_000 * 1e18", "99_999_999 * 1e18", "SYNTH activation 100M -> 99,999,999", "activation threshold boundary"),
    ("T-SY-02", "Synth", 117, ">= SYNTH_ACTIVATION_THRESHOLD", "> SYNTH_ACTIVATION_THRESHOLD", "SYNTH activation >= -> > (checkActivation)", "activation threshold boundary"),
    ("T-SY-03", "Synth", 129, ">= SYNTH_ACTIVATION_THRESHOLD", "> SYNTH_ACTIVATION_THRESHOLD", "SYNTH activation >= -> > (view)", "activation threshold boundary"),
    ("T-SY-04", "Synth", 54, "HARD_CAP = 10_000_000 * 1e18", "HARD_CAP = 10_000_001 * 1e18", "SYNTH hard cap +1 token", "hard cap constant"),
    ("T-TK-01", "Token", 67, "msg.sender == minterVerifier || msg.sender == minterStake", "msg.sender == minterVerifier || msg.sender == deployer", "minter check: Stake swapped for deployer", "minter caller check"),
    ("T-TK-02", "Token", 67, "msg.sender == minterVerifier || msg.sender == minterStake", "tx.origin == minterVerifier || msg.sender == minterStake", "minter msg.sender -> tx.origin", "contract-caller / tx.origin"),
    ("T-TK-03", "Token", 97, "msg.sender == deployer", "tx.origin == deployer", "deployer msg.sender -> tx.origin", "contract-caller / tx.origin"),
    ("T-ST-01", "Stake", 306, "pos.owner == msg.sender", "pos.owner == tx.origin", "position owner msg.sender -> tx.origin (line 306)", "contract-caller / tx.origin"),
    ("T-ST-02", "Stake", 499, "pos.owner == msg.sender", "pos.owner != address(0)", "claim owner check removed (line 499)", "position owner check"),
    ("T-ST-03", "Stake", 343, "pos.owner == msg.sender", "pos.owner != address(0)", "owner check removed (line 343)", "position owner check"),
    ("T-ST-04", "Stake", 363, "pos.owner == msg.sender", "pos.owner != address(0)", "owner check removed (line 363)", "position owner check"),
    ("T-ST-05", "Stake", 114, "STAKE_90D_BPS  = 17500", "STAKE_90D_BPS  = 17501", "stake 90d multiplier +1 bps", "stake weight constant"),
    ("T-BC-01", "BaseCVL", 51, "STANDARD_FEE_BPS = 500;", "STANDARD_FEE_BPS = 499;", "Base CVL fee bps 500 -> 499", "fee constant"),
    ("T-BC-02", "BaseCVL", 55, "HANDSHAKE_USD_MIN = 0.01e18", "HANDSHAKE_USD_MIN = 0.009e18", "Base CVL Handshake min -> $0.009", "Handshake band (Rev 12)"),
    ("T-BC-03", "BaseCVL", 56, "HANDSHAKE_USD_MAX = 0.02e18", "HANDSHAKE_USD_MAX = 0.021e18", "Base CVL Handshake max -> $0.021", "Handshake band (Rev 12)"),
    ("T-BC-04", "BaseCVL", 343, "verifiedGrossUsd < HANDSHAKE_USD_MIN", "verifiedGrossUsd <= HANDSHAKE_USD_MIN", "Base CVL Handshake min < -> <=", "Handshake band boundary (Rev 12)"),
    ("T-BC-05", "BaseCVL", 257, "msg.sender == record.releaseDestination", "tx.origin == record.releaseDestination", "release msg.sender -> tx.origin", "contract-caller / tx.origin"),
    ("T-CV-01", "CVL", 56, "STANDARD_FEE_BPS = 500;", "STANDARD_FEE_BPS = 499;", "CVL fee bps 500 -> 499", "fee constant"),
    ("T-CV-02", "CVL", 60, "HANDSHAKE_USD_MIN = 0.01e18", "HANDSHAKE_USD_MIN = 0.009e18", "CVL Handshake min -> $0.009", "Handshake band (Rev 12)"),
    ("T-CV-03", "CVL", 278, "msg.sender == record.releaseDestination", "tx.origin == record.releaseDestination", "release msg.sender -> tx.origin", "contract-caller / tx.origin"),
    ("T-DU-01", "Durations", 19, "return 11500;", "return 11501;", "30 day multiplier +1 bps", "duration multiplier constant"),
    ("T-DU-02", "Durations", 19, "secs == 2592000", "secs == 2592001", "30 day duration +1 s", "permitted duration constant"),
]

GAMBIT_PRIORITY = ["RequireMutation", "BinaryOpRelational", "IfStatementMutation", "DeleteExpressionMutation",
                   "AssignmentMutation", "BinaryOpMutation", "UnaryOperatorMutation", "SwapArgumentsOperatorMutation"]
REL = re.compile(r"`(<=|>=|<|>|==|!=)` \|==> `(<=|>=|<|>|==|!=)`")
ARITH = re.compile(r"`(\+|-|\*|/|%|\*\*)` \|==> `(\+|-|\*|/|%|\*\*)`")


def gambit_line(diff):
    """Original line number of the first removed line in a gambit diff."""
    lines = diff.splitlines()
    for i, l in enumerate(lines):
        m = re.match(r"@@ -(\d+)", l)
        if m:
            n = int(m.group(1))
            for l2 in lines[i + 1:]:
                if l2.startswith("-"):
                    return n, l2[1:].strip()
                if not l2.startswith("+"):
                    n += 1
    return None, ""


def gambit_what(diff):
    for l in diff.splitlines():
        if l.startswith("+") and "///" in l:
            return l.split("///", 1)[1].strip()
    return ""


def sample_gambit(gdir):
    rng = random.Random(SEED)
    out = []
    for c, d in GAMBIT_DIR.items():
        if SAMPLE[c] == 0:
            continue  # --contracts filter: not sampled in this run
        res = json.load(open(os.path.join(gdir, d, "gambit_results.json")))
        buckets = {k: [] for k in GAMBIT_PRIORITY}
        for m in res:
            k = m["description"]
            if k == "BinaryOpMutation":
                if REL.search(m["diff"]):
                    k = "BinaryOpRelational"
                elif not ARITH.search(m["diff"]):
                    continue  # operator class change (== -> +): type error, never compiles
            buckets.setdefault(k, []).append(m)
        for b in buckets.values():
            rng.shuffle(b)
        picked = []
        while len(picked) < SAMPLE[c] and any(buckets.values()):
            for k in GAMBIT_PRIORITY:
                if buckets.get(k) and len(picked) < SAMPLE[c]:
                    picked.append(buckets[k].pop())
        for m in picked:
            line, orig = gambit_line(m["diff"])
            out.append({"id": "G-%s-%s" % (c, m["id"]), "contract": c, "file": FILES[c], "line": line,
                        "kind": m["description"], "what": gambit_what(m["diff"]), "original": orig,
                        "src": os.path.join(gdir, d, m["name"])})
    return out


ROR_SAMPLE = {"Verifier": 15, "Stake": 10, "Token": 4, "Synth": 3, "BaseCVL": 6, "CVL": 5, "Durations": 3}
ROR_FLIP = {"<": "<=", "<=": "<", ">": ">=", ">=": ">", "==": "!=", "!=": "=="}
ROR_RE = re.compile(r"(?<![<>=!])(<=|>=|==|!=|<|>)(?![<>=])")


def ror(srcroot):
    """Relational operator replacement (gambit 0.2.1 has no relational-to-relational
    operator). Boundary flips on comparisons inside require / if / return / ternary lines."""
    rng = random.Random(SEED + 1)
    out = []
    for c, f in FILES.items():
        L = open(os.path.join(srcroot, f)).read().split("\n")
        cands = []
        for i, l in enumerate(L):
            t = l.strip()
            if t.startswith("//") or t.startswith("*") or t.startswith("/*") or "mapping(" in t or "pragma" in t:
                continue
            if not re.search(r"\b(require|if|return|while|for)\b|\?", t):
                continue
            code = l.split("//")[0]
            code = re.sub(r'"[^"]*"', lambda m: " " * len(m.group(0)), code)
            for m in ROR_RE.finditer(code):
                cands.append((i + 1, m.start(), m.group(1)))
        bnd = [x for x in cands if x[2] in ("<", "<=", ">", ">=")]
        eq = [x for x in cands if x[2] in ("==", "!=")]
        rng.shuffle(bnd); rng.shuffle(eq)
        nb = min(len(bnd), -(-2 * ROR_SAMPLE[c] // 3))
        pick = bnd[:nb] + eq[:ROR_SAMPLE[c] - nb]
        for (ln, pos, op) in pick:
            old = L[ln - 1]
            new = old[:pos] + ROR_FLIP[op] + old[pos + len(op):]
            out.append({"id": "R-%s-%d-%d" % (c, ln, pos), "contract": c, "file": f, "line": ln, "kind": "ROR",
                        "what": "`%s` -> `%s` in: %s" % (op, ROR_FLIP[op], old.strip()[:140]),
                        "old": old, "new": new})
    return out


def targeted():
    return [{"id": i, "contract": c, "file": FILES[c], "line": ln, "kind": "Targeted", "what": w,
             "old": o, "new": n, "blind_class": b} for (i, c, ln, o, n, w, b) in TARGETED]


def run(cmd, cwd, timeout):
    t = time.time()
    try:
        p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout)
        return p.returncode, p.stdout + p.stderr, time.time() - t
    except subprocess.TimeoutExpired as e:
        return "timeout", (e.stdout or b"").decode(errors="ignore") if isinstance(e.stdout, bytes) else (e.stdout or ""), time.time() - t


def bytecode_hash(work, c):
    name = os.path.basename(FILES[c])
    d = os.path.join(work, "artifacts", FILES[c])
    h = hashlib.sha256()
    for f in sorted(os.listdir(d)):
        if f.endswith(".json") and not f.endswith(".dbg.json"):
            h.update(json.load(open(os.path.join(d, f))).get("deployedBytecode", "").encode())
    return h.hexdigest()


def first_failure(out):
    m = re.search(r"\n\s*1\) (.+)\n\s+(.+?):\n", out)
    if m:
        return (m.group(1).strip() + " / " + m.group(2).strip())[:200]
    m = re.search(r"\n\s*1\) (.+?)\n(?:.*\n){0,3}?\s*((?:Assertion)?Error[^\n]*)", out)
    if m:
        return (m.group(1).strip() + " / " + m.group(2).strip())[:200]
    m = re.search(r"(\d+ failing)", out)
    return m.group(1) if m else "nonzero exit, no mocha failure line"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workdir", required=True)
    ap.add_argument("--gambit", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--worker", type=int, default=0)
    ap.add_argument("--workers", type=int, default=1)
    ap.add_argument("--only", default="", help="comma-separated mutant ids to (re)run")
    ap.add_argument("--resfile", default="", help="result file name (default mutants_w<N>.jsonl)")
    ap.add_argument("--split", action="store_true", help="run each test file on its own (lower peak memory)")
    ap.add_argument("--contracts", default="", help="comma-separated contracts to sample (default all)")
    ap.add_argument("--replay", default="", help="old mutation_summary.json: re-run its records (with --only) on unchanged contracts")
    a = ap.parse_args()
    work = os.path.abspath(a.workdir)
    os.makedirs(a.out, exist_ok=True)
    if a.contracts:
        keep = set(a.contracts.split(","))
        # Keep the full tables (targeted() names every contract); zero the
        # sample sizes of the others and drop their mutants below.
        for d in (SAMPLE, ROR_SAMPLE):
            for k in list(d):
                if k not in keep:
                    d[k] = 0
    if a.replay:
        allm = []
        for r in json.load(open(a.replay))["all"]:
            r = {k: v for k, v in r.items() if k not in ("status", "killed_by", "note", "compile_s", "retried_rc", "retry")
                 and not k.startswith("test_")}
            if r["id"].startswith("G-"):
                gid = r["id"].rsplit("-", 1)[1]
                d = os.path.join(a.gambit, GAMBIT_DIR[r["contract"]])
                g = [x for x in json.load(open(os.path.join(d, "gambit_results.json"))) if str(x["id"]) == gid][0]
                r["src"] = os.path.join(d, g["name"])
            allm.append(r)
    else:
        allm = targeted() + ror(work) + sample_gambit(a.gambit)
        if a.contracts:
            allm = [m for m in allm if m["contract"] in keep]
    mine = [m for i, m in enumerate(allm) if i % a.workers == a.worker]
    if a.only:
        ids = a.only.split(",")
        mine = [m for m in allm if m["id"] in ids]
    resf = os.path.join(a.out, a.resfile or "mutants_w%d.jsonl" % a.worker)
    done = set()
    if os.path.exists(resf):
        done = {json.loads(l)["id"] for l in open(resf)}
    env = dict(os.environ)
    env.setdefault("NODE_OPTIONS", "--max-old-space-size=4096")
    base_hash = {}
    for m in mine:
        if m["id"] in done:
            continue
        c, f = m["contract"], os.path.join(work, m["file"])
        orig = open(f).read()
        if c not in base_hash:
            rc, out, _ = run(["npx", "hardhat", "compile", "--quiet"], work, TIMEOUT)
            base_hash[c] = bytecode_hash(work, c)
        rec = dict(m)
        rec.pop("src", None)
        try:
            if m["kind"] in ("Targeted", "ROR"):
                L = orig.split("\n")
                if m["kind"] == "Targeted" and m["old"] not in L[m["line"] - 1]:
                    # The 2026-10-23 fixes moved lines: use the nearest line holding the same text.
                    hits = [i + 1 for i, l in enumerate(L) if m["old"] in l]
                    if hits:
                        m["line"] = min(hits, key=lambda n: abs(n - m["line"]))
                        rec["line"] = m["line"]
                if m["old"] not in L[m["line"] - 1]:
                    rec.update(status="not_applied", note="pattern not on line")
                    raise StopIteration
                L[m["line"] - 1] = L[m["line"] - 1].replace(m["old"], m["new"], 1)
                open(f, "w").write("\n".join(L))
            else:
                shutil.copyfile(m["src"], f)
            rc, out, dt = run(["npx", "hardhat", "compile", "--quiet"], work, TIMEOUT)
            rec["compile_s"] = round(dt, 1)
            if rc != 0:
                rec.update(status="stillborn", note=out.strip().splitlines()[-1][:200] if out.strip() else "")
                raise StopIteration
            if bytecode_hash(work, c) == base_hash[c]:
                rec.update(status="equivalent", note="deployed bytecode identical to baseline")
                raise StopIteration
            status = None
            fast = [x for x in FAST[c] if x not in PIN_PRONE]
            pinned = [x for x in FAST[c] if x in PIN_PRONE]
            phases = (("fast", fast), ("slow", SLOW.get(c, [])), ("pinned", pinned))
            if a.split:
                phases = [(ph, [x]) for ph, fs in phases for x in fs]
            for phase, files in phases:
                if not files:
                    continue
                rc, out, dt = run(["npx", "hardhat", "test", "--no-compile", "--bail"] + files, work, TIMEOUT)
                if rc not in (0, "timeout") and not re.search(r"\d+ failing", out):
                    # crash without a mocha failure (for example OOM on the shared box): retry once
                    rec["retried_rc"] = rc
                    rc, out, dt = run(["npx", "hardhat", "test", "--no-compile", "--bail"] + files, work, TIMEOUT)
                    if rc not in (0, "timeout") and not re.search(r"\d+ failing", out):
                        status = "error"; rec["note"] = "test run crashed twice, rc=%s: %s" % (rc, out.strip()[-200:]); break
                rec["test_%s_s" % phase] = round(dt, 1)
                if rc == "timeout":
                    status = "killed"; rec["killed_by"] = "timeout (%s set)" % phase; break
                if rc != 0:
                    why = first_failure(out)
                    status = "pin_only" if (phase == "pinned" and PIN_RE.search(why)) else "killed"
                    rec["killed_by"] = ("%s set: " % phase) + why; break
            rec["status"] = status or "survived"
        except StopIteration:
            pass
        finally:
            open(f, "w").write(orig)
        with open(resf, "a") as fh:
            fh.write(json.dumps(rec) + "\n")
        print(time.strftime("%H:%M:%S"), rec["id"], rec.get("status"), rec.get("killed_by", rec.get("note", ""))[:120], flush=True)
    # leave the scratch tree compiled at baseline
    run(["npx", "hardhat", "compile", "--quiet"], work, TIMEOUT)


if __name__ == "__main__":
    main()
