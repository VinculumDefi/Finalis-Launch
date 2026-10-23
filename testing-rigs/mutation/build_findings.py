import json, sys
S = json.load(open(sys.argv[1]))
V = "base-contracts/contracts/VinculumFinalisVerifier.sol"
CV = "base-contracts/contracts/chain-verifiers/"
F = []
def add(**k): F.append(k)
add(id="FZ-01", rig="rig3-fuzzing+echidna", cls="CONFIRMED VULNERABILITY", severity="High",
    damage_potential="Extra RAC credit (and so extra Stake reward basis) from one lock: each new racIdentity for the same lock records another fee credit.",
    file_line=V+":654 (require(!recordedRacs[racIdentity])), 692; function recordFeeAndRac 646-703",
    description="recordFeeAndRac enforces exactly-once on racIdentity only. It does not key on the lock (sourceEnvironmentId, commitmentVaultLockId) and does not check consumedLocks, so the same lock can be recorded many times under different racIdentity values.",
    evidence="forge testFuzz_PROP_oneRacPerLock FAIL at seed 0x5646525a5a3230323631303233 (fuzzing/results/forge_test_10k_runs.log). Echidna echidna_one_rac_per_lock FALSIFIED, shrunk to openLock(0,0,false), recordRac(0,66420565), recordRac(0,0) (echidna/results/echidna_run.log).",
    rev_conflict="Rev 6: one RAC per verified lock. Code allows more.")
add(id="FZ-01b", rig="rig3-fuzzing", cls="CONFIRMED VULNERABILITY", severity="Medium",
    damage_potential="RAC credit and reward basis keep growing after the lock was already minted.",
    file_line=V+":646-703 (no consumedLocks check in recordFeeAndRac); verifyAndMint checks consumedLocks at "+V+":770",
    description="After verifyAndMint consumes a lock, recordFeeAndRac still accepts a new racIdentity for that lock and adds credit.",
    evidence="forge testFuzz_PROP_noRacAfterMint FAIL: reward basis grew after the lock was consumed (27181302754420000821600 != 4530217125736666803600).",
    rev_conflict="Rev 6 (same as FZ-01).")
add(id="FZ-02", rig="rig3-fuzzing", cls="CONFIRMED VULNERABILITY", severity="High",
    damage_potential="A caller picks the emission day. An early valuationTimestamp gets a higher (less decayed) issuance rate than the lock's real day.",
    file_line=V+":844 (_daysSinceLaunchFromValuation(pkg.valuationTimestamp)), 1023-1028",
    description="Emission decay is computed from pkg.valuationTimestamp, which is supplied in the proof package, not from the proven lock creation time.",
    evidence="forge testFuzz_PROP_issuanceIndependentOfCallerValuationTs FAIL: issuance follows caller-supplied valuationTimestamp, 393034748862721713670000 != 367475259334517385341795.",
    rev_conflict="Rev 6 emission schedule is by day of the lock. Conflict candidate noted, not re-asked.")
add(id="FZ-03", rig="rig3-fuzzing", cls="SPEC CONFLICT", severity="Info",
    damage_potential="None by itself. A later valuation of the same asset row reuses the first bound price.",
    file_line=V+":991-1009 (binding.bound reused at 991-993, set at 1008)",
    description="The USD price binds at the first valuation and is reused. Documented only.",
    evidence="Observed in FuzzMinting price paths; not a failing test.",
    rev_conflict="Rev 6 price-at-valuation wording is a conflict candidate.")
add(id="FZ-04", rig="rig3-fuzzing", cls="CONFIRMED VULNERABILITY", severity="Info",
    damage_potential="None, fails closed. Gross amounts near uint256 max revert with Panic 0x11 instead of a VF error code.",
    file_line=V+":676 and "+V+":790 (gross * STANDARD_FEE_BPS)",
    description="gross * 500 overflows for gross > max/500 and reverts with an arithmetic panic rather than a coded error.",
    evidence="FuzzFeeMath bounds at max (passes, asserting the revert).", rev_conflict=None)
add(id="FZ-LOCK-01", rig="rig3-fuzzing", cls="UNVERIFIED ASSUMPTION", severity="Low",
    damage_potential="Funds sit in a lock that can never mint until maturity release; user annoyance, no loss.",
    file_line="base-contracts/contracts/BaseCommitmentVaultLock.sol:341-350; CommitmentVaultLock.sol:363-370",
    description="The lock checks the Handshake band and the minimum on the USD figure stated at lock time. The Verifier re-checks against its own price and refuses (VF-COM-009 / VF-COM-003). The design assumes the user can always release at maturity.",
    evidence="FuzzLocking passes across all 16 durations and the $0.01-$0.02 band at 10k runs.",
    rev_conflict="Rev 12 governs the Handshake band; code matches Rev 12 bounds.")
add(id="FZ-05", rig="rig3-fuzzing", cls="UNVERIFIED ASSUMPTION", severity="High",
    damage_potential="If nothing else binds a source header to the real chain, a self-made block mints against a lock that never existed.",
    file_line=CV+"UtxoLockReader.sol:156-172 (_openBlock), "+V+":716 (_verifySource reads only `finalized`, ignores the returned hash)",
    description="Shape class. A self-made coinbase plus an 80-byte Bitcoin header with no proof of work passes BitcoinLockReader.verifyFinality and returns height 900000. EVM readers accept a self-consistent local block (already pinned by test/non_base_finality_trust_model.test.cjs). XRPL and Stellar verifyFinality check only self-consistency (read in code, not demonstrated). assetCustodyClass and maturityTimestamp are not used. Fuzzing cannot judge this: the inputs are valid in shape and false in fact. Routed to the adversarial / assumption-gap tier.",
    evidence="forge test_SHAPE_selfMadeBitcoinBlockPassesFinality PASS (the pass is the finding).",
    rev_conflict="Rev 6 non-Base trust model: whether operator attestation closes this is a settled-spec question, noted not re-asked.")
add(id="FZ-06", rig="rig3-fuzzing", cls="CONFIRMED VULNERABILITY", severity="Low",
    damage_potential="None, fails closed. Malformed EVM headers or receipts revert with Panic 0x32 instead of a coded error.",
    file_line="base-contracts/contracts/checkers/ExecutionHeader.sol:68 (payloadLen), 102 (bounds), 110 (spanEnd), 119 (readLen)",
    description="RLP helpers index without bounds checks and do not validate declared lengths against the buffer.",
    evidence="FuzzReaders testFuzz_evmParsingHelpers and testFuzz_shapedStructAllReaders FAIL with Panic 0x32 on Ethereum, Arbitrum, Optimism, Polygon, BNB, Avalanche and the light-client EthereumLockReader.",
    rev_conflict=None)
add(id="FZ-07", rig="rig3-fuzzing", cls="CONFIRMED VULNERABILITY", severity="Low",
    damage_potential="None, fails closed. A large compactSize input count reverts with Panic 0x41 (memory) and burns the caller's gas.",
    file_line=CV+"UtxoLockReader.sol:298 (new bytes(n * 36))",
    description="The tx input count is used to allocate memory before it is checked against the tx length.",
    evidence="FuzzReaders testFuzz_utxoHeaderSized FAIL with Panic 0x41 on Bitcoin, BCH, LTC, DOGE and DGB.", rev_conflict=None)
add(id="IT-ECH-01", rig="rig3-echidna", cls="INCOMPLETE TESTING", severity="Info",
    damage_potential="n/a", file_line="base-contracts/contracts/VinculumFinalisStake.sol:479",
    description="Echidna never reached the Stake epoch reward mint in 20,000 calls, and the harness uses only Base ETH at $2000 with stand-in source proofs. stake_solvent passing is weak evidence for the reward path. Readers were not in the Echidna scope (covered by forge FuzzReaders).",
    evidence="echidna corpus coverage: Stake.sol:479 unmarked; :275 and :390 reached.", rev_conflict=None)
add(id="IT-MUT-00", rig="rig8-mutation", cls="INCOMPLETE TESTING", severity="Info", damage_potential="n/a",
    file_line="base-contracts/contracts/HandshakeCapability.sol",
    description="Gambit produced 0 mutants for HandshakeCapability, and gambit 0.2.1 has no relational-to-relational operator (Python ROR mutants added instead). Only a seeded sample of gambit mutants was run (Verifier 30 of 1744, Stake 20 of 1590, Token 12 of 270, Synth 8 of 228, BaseCVL 12 of 505, CVL 10 of 575, Durations 6 of 128). Scores are sample scores.",
    evidence="mutation/results/mutation_summary.json", rev_conflict=None)
BLIND = {"tx.origin": "contract-caller paths: no test calls restricted functions through a contract, so msg.sender vs tx.origin is invisible",
         "cap": "hard-cap boundary: no test mints to within 1 token of the cap",
         "activation": "activation threshold boundary: no test lands exactly on the threshold",
         "decay": "decay constant precision: tests check decay direction, not the exact rate",
         "ror": "comparison boundary: no test hits the equality case"}
def blind(r):
    w = (r.get("blind_class") or "") + " " + r.get("what", "")
    if "tx.origin" in w: return BLIND["tx.origin"]
    if "cap" in w.lower(): return BLIND["cap"]
    if "activation" in w.lower() or "ACTIVATION" in w: return BLIND["activation"]
    if "decay" in w: return BLIND["decay"]
    if r["kind"] == "ROR": return BLIND["ror"]
    return r.get("blind_class") or "unmapped: " + r["kind"]
n = 0
for r in S["survivors"] + [x for x in S["all"] if x["status"] in ("pin_only", "error", "timeout")]:
    n += 1
    st = r["status"]
    add(id="MUT-%02d" % n, rig="rig8-mutation", cls="INCOMPLETE TESTING", severity="Low" if st == "survived" else "Info",
        damage_potential="A real bug of this shape would ship unnoticed by the Hardhat suite.",
        file_line="base-contracts/%s:%s" % (r["file"], r["line"]),
        description="%s mutant %s (%s): %s. Blind class: %s." % (st.upper(), r["id"], r["kind"], r["what"], blind(r)),
        evidence=r.get("killed_by") or r.get("note") or "all mapped fast and slow tests passed",
        rev_conflict="Rev 12 Handshake" if "Handshake" in r.get("what", "") else None)
# Live / latent. LIVE = the same code shape is in the deployed Base build (7dee25d per
# deployment/LIVE_BASE_VERIFY_2026-10-21.md: lock, VCLM, CHONX, Verifier, Base reader; no Stake,
# no Synth, no non-Base readers). Checked by reading 7dee25d source, NOT by re-running the fuzzers
# against the live bytecode. LATENT = only on main b0e38a9 or in undeployed contracts, or a test gap.
LIVE_NOTE = {
 "FZ-01": "LIVE (shape): deployed Verifier 7dee25d recordFeeAndRac also keys only on racIdentity and, unlike main, does not verify the source at all. No Stake is attached to the live tokens and none can be, so no reward is paid from this credit today.",
 "FZ-01b": "LIVE (shape): same as FZ-01 in 7dee25d; no Stake to pay it.",
 "FZ-02": "LIVE: deployed Verifier 7dee25d line 687 also takes emission days from pkg.valuationTimestamp, and VCLM minting is live.",
 "FZ-03": "LIVE (shape): 7dee25d binds the reference price at first valuation (lines 790-818).",
 "FZ-04": "LIVE (shape): 7dee25d lines 547 and 613 use the same gross * STANDARD_FEE_BPS; fails closed.",
 "FZ-LOCK-01": "LIVE for CommitmentVaultLock (the deployed Base lock); LATENT for BaseCommitmentVaultLock (not deployed).",
 "FZ-05": "LATENT: non-Base readers are not deployed or registered on the live Verifier (only the Base reader).",
 "FZ-06": "LATENT: EVM non-Base readers are not deployed.",
 "FZ-07": "LATENT: UTXO readers are not deployed.",
 "IT-ECH-01": "LATENT: Stake is not deployed.",
 "IT-MUT-00": "LATENT: test-suite gap on main b0e38a9.",
}
for f in F:
    f["exposure"] = LIVE_NOTE.get(f["id"], "LATENT: test-suite gap on main b0e38a9 (a mutant the suite does not detect, not a demonstrated bug).")
out = {"rig3_rig8": "fuzzing, echidna, mutation", "base_commit": "b0e38a9", "branch": "rigs/foundry",
       "classes": ["CONFIRMED VULNERABILITY", "SPEC CONFLICT", "UNVERIFIED ASSUMPTION", "INCOMPLETE TESTING"],
       "mutation_score": {"total": S["total"], "per_contract": S["per_contract"]},
       "exposure_rule": "LIVE = same code shape in the deployed Base build 7dee25d (source read, not re-fuzzed against live bytecode). LATENT = main-only, undeployed contract, or test gap.",
       "note": "Fuzzing does not catch valid-shaped-but-false inputs (forged well-formed headers). Those belong to the adversarial / assumption-gap tier (see FZ-05).",
       "findings": [{"id": f["id"], "rig": f["rig"], "class": f["cls"], "severity": f["severity"], "damage_potential": f["damage_potential"],
                     "file_line": f["file_line"], "description": f["description"], "evidence": f["evidence"], "rev_conflict": f["rev_conflict"], "exposure": f["exposure"]} for f in F]}
json.dump(out, open(sys.argv[2], "w"), indent=1, ensure_ascii=False)
print(len(F), "findings")
