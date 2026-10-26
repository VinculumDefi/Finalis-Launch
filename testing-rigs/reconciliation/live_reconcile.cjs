// Rig 10 (live): reconcile the LIVE Base set deployed on 2026-10-22 against
// the compiled ceremony artifacts and ceremony-data, READ ONLY.
// Target reads go to a public Base RPC (eth_getCode, eth_call, eth_getLogs,
// eth_getTransactionByHash, eth_getTransactionReceipt). Expected runtime code
// is derived by deploying the same artifacts on the LOCAL in-process Hardhat
// network (no fork). Nothing is signed or sent to any real network.
// Run: testing-rigs/reconciliation/live.sh
//
// Base-only launch (t357u): reconcile.cjs now expects exactly one reader
// (Base) and the 130-row Base subset (Revision D, t430u). The 2026-10-22 set in live_set.cjs has
// fifteen readers and the full registry, so it is expected to MISMATCH;
// it is kept as a record. Point live_set.cjs at the new Base-only set after
// the founder's ceremony. Not run by the Base-only gate.
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const hre = require("hardhat");
const { ethers } = hre;
const BC = path.resolve(__dirname, "../../base-contracts");
const art = require(path.join(BC, "scripts/deploy-pages/ceremony.json"));
const DATA = require(path.join(BC, "scripts/deploy-pages/ceremony-data.json"));
const RECON = require("./reconcile.cjs");
const RPCS = require("./rpcs.cjs");
const LIVE = require("./live_set.cjs");
const err = (...a) => process.stderr.write(RECON.scrub(a.join(" ")) + "\n");

async function main() {
  if (hre.network.config.forking && hre.network.config.forking.url) throw new Error("run without RIG_FORK: the local network only holds reference deployments");
  const P = new ethers.JsonRpcProvider(process.env.RIG_BASE_RPC || RPCS.URLS.Base, 8453, { staticNetwork: true, batchMaxCount: 10 });
  const head = await P.getBlockNumber();
  err(`live Base head ${head}`);
  // Addresses must be the ones the main-branch config document records.
  let doc = "";
  try { doc = execSync("git show origin/main:deployment/BASE44_LIVE_CONFIG_2026-10-22.md", { cwd: BC, encoding: "utf8" }); } catch (_) {}
  const addrs = [...Object.values(LIVE.base), ...Object.values(LIVE.readers).map((x) => x[1])];
  const notInDoc = doc ? addrs.filter((a) => !doc.toLowerCase().includes(a.toLowerCase())) : addrs;
  const set = {
    vclm: LIVE.base.TokenVCLM, chonx: LIVE.base.TokenCHONX, verifier: LIVE.base.VinculumFinalisVerifier, forge: LIVE.base.VinculumFinalisSynth,
    stake: LIVE.base.VinculumFinalisStake, lock: LIVE.base.BaseCommitmentVaultLock,
    readers: Object.fromEntries(Object.entries(LIVE.readers).map(([e, [, a]]) => [e, a])),
  };
  const V = new ethers.Contract(set.verifier, art.VinculumFinalisVerifier.abi, P);
  // deployer() reads zero after finalize (Verifier 578); the operator is the
  // sender of the transaction that created the Verifier.
  // The operator's transactions: hashes from the t301u capture, each re-fetched from the chain.
  const cap = JSON.parse(fs.readFileSync("/workspace/t301u/txs.json", "utf8"));
  const txs = [];
  for (const c of cap) {
    const t = await P.getTransaction(c.hash);
    const rc = await P.getTransactionReceipt(c.hash);
    if (!t || !rc) throw new Error("tx not found on chain: " + c.hash.slice(0, 10));
    txs.push({ hash: t.hash, nonce: t.nonce, from: t.from, to: t.to, data: t.data, value: t.value, status: rc.status, created: rc.contractAddress, block: rc.blockNumber, logs: rc.logs });
  }
  const vCreate = txs.find((t) => t.created && ethers.getAddress(t.created) === ethers.getAddress(set.verifier));
  if (!vCreate) throw new Error("Verifier creation tx not in the capture");
  const operator = ethers.getAddress(vCreate.from);
  const opTxs = txs.filter((t) => ethers.getAddress(t.from) === ethers.getAddress(operator));
  const firstCreate = opTxs.findIndex((t) => t.created && ethers.getAddress(t.created) === ethers.getAddress(set.vclm));
  const finSel = V.interface.getFunction("finalize").selector;
  const finIdx = opTxs.findIndex((t) => t.to && ethers.getAddress(t.to) === ethers.getAddress(set.verifier) && t.data.startsWith(finSel));
  const cer = opTxs.slice(firstCreate, finIdx + 1);
  const pre = opTxs.slice(0, firstCreate);
  const contiguous = cer.every((t, i) => i === 0 || t.nonce === cer[i - 1].nonce + 1);
  err(`operator ${RECON.short(operator)}: ${cer.length} ceremony txs, nonces ${cer[0].nonce}..${cer[cer.length - 1].nonce}, blocks ${cer[0].block}..${cer[cer.length - 1].block}; ${pre.length} earlier txs to ${[...new Set(pre.map((t) => RECON.short(t.to)))].join(",")}`);
  const bal = async (a) => P.getBalance(a);
  const simFrom = (await bal(DATA.devFund)) >= 10n ** 16n ? DATA.devFund : operator;
  const tokenProviders = { Base: P };
  const rec = await RECON.reconcile({
    hre, P, set, DATA, art, mode: "live", operator, txs: cer,
    fromBlock: cer[0].block, simFrom, tokenProviders, logPaceMs: 1000, logChunk: 1000, logP: new ethers.JsonRpcProvider(process.env.RIG_LOGS_RPC || "https://base.gateway.tenderly.co", 8453, { staticNetwork: true, batchMaxCount: 1 }), receiptLogs: cer.flatMap((t) => t.logs),
    txListComplete: { ok: contiguous, detail: `nonces ${cer[0].nonce}..${cer[cer.length - 1].nonce} contiguous=${contiguous}; finalize at block ${cer[cer.length - 1].block}` },
    log: err,
  });
  rec.checks.unshift({ area: "inputs", name: "every live address is recorded in deployment/BASE44_LIVE_CONFIG_2026-10-22.md on main", status: doc && notInDoc.length === 0 ? "PASS" : doc ? "MISMATCH" : "INCOMPLETE", detail: notInDoc.map(RECON.short).join(",") });
  rec.liveHead = head;
  rec.operator = RECON.short(operator);
  rec.preCeremonyTxs = pre.map((t) => ({ nonce: t.nonce, to: RECON.short(t.to), selector: t.data.slice(0, 10), block: t.block }));
  rec.simFrom = RECON.short(simFrom);
  const first = rec.checks.find((c) => c.status === "MISMATCH");
  const inc = rec.checks.filter((c) => c.status === "INCOMPLETE");
  rec.verdict = first ? `reconciliation MISMATCH at [${first.area}] ${first.name}: ${first.detail}` : inc.length ? `reconciliation INCOMPLETE: ${inc.length} checks could not be evaluated, first [${inc[0].area}] ${inc[0].name}: ${inc[0].detail}` : "reconciliation PASS";
  rec.counts = rec.checks.reduce((m, c) => ((m[c.status] = (m[c.status] || 0) + 1), m), {});
  fs.writeFileSync(path.join(__dirname, "reconciliation_live.json"), JSON.stringify(rec, null, 1));
  err("counts " + JSON.stringify(rec.counts));
  process.stdout.write(rec.verdict + "\n");
  process.exitCode = rec.verdict === "reconciliation PASS" ? 0 : 2;
}
main().then(() => process.exit(process.exitCode || 0)).catch((e) => { process.stdout.write("live reconciliation did not reach a verdict: " + RECON.scrub(e.shortMessage || e.message) + "\n"); process.stderr.write(RECON.scrub(e.stack) + "\n"); process.exit(1); });
