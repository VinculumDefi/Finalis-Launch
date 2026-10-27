// Revision E compatibility evidence tool (operator order t448u, 2026-10-26).
// Run from a work directory that holds cand.json (the recommendation rows as
// JSON), block.txt (the pinned Base block) and, for the simulations,
// static_facts.json. Read-only against public Base RPCs; every transaction
// runs only inside a local anvil fork. Nothing is signed or broadcast.
// Local anvil fork simulation (Base block pinned). Nothing is broadcast:
// every transaction runs only inside the local anvil fork.
// Per token: fund a fresh local test account (storage write found by
// eth_createAccessList, else impersonate a recent Transfer recipient),
// approve, createErc20Lock on the real BaseCommitmentVaultLock bytecode,
// advance 1 hour, release, and record exact balance deltas.
const { ethers } = require("ethers");
const fs = require("fs");
const [port, listFile, outName, upstream] = process.argv.slice(2);
// Retry pass: holder funding first (a real transfer from a recent holder), then the storage write; deeper Transfer-log search in 10,000-block windows.
const P = new ethers.JsonRpcProvider("http://127.0.0.1:" + port, undefined, { staticNetwork: true, batchMaxCount: 1 });
const art = JSON.parse(fs.readFileSync(require("path").join(__dirname, "..", "..", "artifacts", "contracts", "BaseCommitmentVaultLock.sol", "BaseCommitmentVaultLock.json")));
const facts = JSON.parse(fs.readFileSync("static_facts.json")).tokens;
const BLOCK = Number(fs.readFileSync("block.txt", "utf8").trim());
const erc = new ethers.Interface(["function balanceOf(address) view returns (uint256)", "function approve(address,uint256) returns (bool)", "function transfer(address,uint256) returns (bool)", "event Transfer(address indexed from, address indexed to, uint256 value)"]);
const vI = new ethers.Interface(art.abi);
const USER = "0x00000000000000000000000000000000000A11CE";
const DEV = "0x0000000000000000000000000000000000De7F00";
const DEPLOYER = "0x0000000000000000000000000000000000D3910Y".replace("Y", "0");
const outFile = outName;
// Rows whose latest result is ERROR (RPC trouble, not a token verdict) are retried.
const latest = new Map();
if (fs.existsSync(outFile)) for (const l of fs.readFileSync(outFile, "utf8").trim().split("\n").filter(Boolean)) { const j = JSON.parse(l); latest.set(j.address, j.result); }
const done = new Set([...latest].filter(([, r]) => r !== "ERROR").map(([a]) => a));
let consecutiveErrors = 0;
const send = (m, p) => P.send(m, p);
async function receipt(h) { for (let i = 0; i < 600; i++) { const r = await send("eth_getTransactionReceipt", [h]); if (r) return r; await new Promise((s) => setTimeout(s, 100)); } throw new Error("no receipt"); }
async function bal(t, a) { const r = await send("eth_call", [{ to: t, data: erc.encodeFunctionData("balanceOf", [a]) }, "latest"]); return BigInt(r); }
async function tx(from, to, data, gas = "0x7a1200") {
  const h = await send("eth_sendTransaction", [{ from, to, data, gas }]);
  const r = await receipt(h);
  if (r.status === "0x1") return { ok: true, gas: Number(r.gasUsed) };
  let reason = "revert";
  try { await send("eth_call", [{ from, to, data, gas }, "latest"]); } catch (e) { reason = (e.info && e.info.error && e.info.error.message) || e.shortMessage || e.message; }
  return { ok: false, reason: String(reason).slice(0, 200), gas: Number(r.gasUsed) };
}
async function upstreamLogs(token) {
  // recent Transfer recipients, newest first (read-only upstream eth_getLogs)
  const topic = erc.getEvent("Transfer").topicHash;
  const found = [];
  const LOGS = "https://base-rpc.publicnode.com"; // read-only; allows 50,000-block eth_getLogs windows
  for (let w = 0; w < 20 && found.length < 12; w++) {
    const to = BLOCK - w * 50000, from = to - 49999;
    try {
      const r = await fetch(LOGS, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getLogs", params: [{ address: token, topics: [topic], fromBlock: "0x" + from.toString(16), toBlock: "0x" + to.toString(16) }] }) });
      const j = await r.json();
      if (j.result) for (const l of j.result.reverse()) { if (l.topics.length > 2) { const a = "0x" + l.topics[2].slice(26); if (!found.includes(a)) found.push(a); } }
    } catch (_) {}
  }
  return found.slice(0, 12);
}
async function fund(token, amount) {
  const target = amount * 4n;
  for (const h of await upstreamLogs(token)) {
    if (h === "0x0000000000000000000000000000000000000000") continue;
    let hb = 0n; try { hb = await bal(token, h); } catch (_) { continue; }
    if (hb === 0n) continue;
    const amt = hb >= target ? target : hb;
    await send("anvil_impersonateAccount", [h]);
    await send("anvil_setBalance", [h, "0x56BC75E2D63100000"]);
    const r = await tx(h, token, erc.encodeFunctionData("transfer", [USER, amt]));
    await send("anvil_stopImpersonatingAccount", [h]);
    const b = await bal(token, USER);
    if (r.ok && b > 0n) return { how: "holder " + h, balance: b };
  }
  const al = await send("eth_createAccessList", [{ from: USER, to: token, data: erc.encodeFunctionData("balanceOf", [USER]) }, "latest"]);
  for (const e of al.accessList || []) {
    for (const k of e.storageKeys) {
      const orig = await send("eth_getStorageAt", [e.address, k, "latest"]);
      await send("anvil_setStorageAt", [e.address, k, ethers.toBeHex(target, 32)]);
      let b = 0n; try { b = await bal(token, USER); } catch (_) {}
      if (b >= amount * 2n) return { how: "storage", balance: b };
      await send("anvil_setStorageAt", [e.address, k, orig]);
    }
  }
  return null;
}
async function simOne(addr, f, vault) {
  const res = { address: addr, id: f.id, decimals: f.decimals };
  const snap = await send("evm_snapshot", []);
  try {
    let amount = 10n ** BigInt(f.decimals);
    const ts = BigInt(f.totalSupply || "0");
    if (ts > 0n && amount > ts / 1000n) amount = ts / 1000n;
    if (amount < 100000n) amount = 100000n;
    const fu = await fund(addr, amount);
    if (!fu) { res.result = "NOT_SIMULATED"; res.reason = "could not fund a local test account"; return res; }
    res.fund = fu.how;
    if (fu.balance < amount * 2n) amount = fu.balance / 2n;
    res.amount = amount.toString();
    const ap = await tx(USER, addr, erc.encodeFunctionData("approve", [vault, amount]));
    if (!ap.ok) { res.result = "FAIL"; res.stage = "approve"; res.reason = ap.reason; return res; }
    const u0 = await bal(addr, USER), v0 = await bal(addr, vault), d0 = await bal(addr, DEV);
    const lockId = ethers.keccak256(ethers.toUtf8Bytes("sim:" + addr));
    const lk = await tx(USER, vault, vI.encodeFunctionData("createErc20Lock", [lockId, USER, 0, ethers.ZeroHash, ethers.ZeroHash, USER, 3600, addr, amount, 10n ** 16n]));
    if (!lk.ok) {
      res.result = "FAIL"; res.stage = "lock"; res.reason = lk.reason;
      // Diagnostic: does a plain transfer to an ordinary address work for this funded account?
      const t = await tx(USER, addr, erc.encodeFunctionData("transfer", ["0x000000000000000000000000000000000000bEEF", amount / 2n]));
      res.plainTransferOk = t.ok; if (!t.ok) res.plainTransferReason = t.reason;
      return res;
    }
    res.lockGas = lk.gas;
    const u1 = await bal(addr, USER), v1 = await bal(addr, vault), d1 = await bal(addr, DEV);
    const rec = vI.decodeFunctionResult("lockRecord", await send("eth_call", [{ to: vault, data: vI.encodeFunctionData("lockRecord", [lockId]) }, "latest"]))[0];
    res.userSent = (u0 - u1).toString(); res.gross = rec.gross.toString(); res.fee = rec.fee.toString(); res.principal = rec.principal.toString();
    res.devFundGot = (d1 - d0).toString(); res.vaultHeld = (v1 - v0).toString();
    res.inboundShortfall = (amount - BigInt(rec.gross)).toString();
    await send("evm_increaseTime", [3601]); await send("evm_mine", []);
    const rl = await tx(USER, vault, vI.encodeFunctionData("release", [lockId]));
    if (!rl.ok) { res.result = "FAIL"; res.stage = "release"; res.reason = rl.reason; return res; }
    res.releaseGas = rl.gas;
    const u2 = await bal(addr, USER);
    res.userReceived = (u2 - u1).toString();
    if (u2 - u1 < BigInt(rec.principal)) { res.result = "FAIL"; res.stage = "release"; res.reason = "release recipient received less than principal"; return res; }
    res.result = "PASS";
    return res;
  } catch (e) {
    res.result = "ERROR"; res.reason = String(e.shortMessage || e.message).slice(0, 200); return res;
  } finally { await send("evm_revert", [snap]); }
}
(async () => {
  await send("anvil_impersonateAccount", [USER]); await send("anvil_setBalance", [USER, "0x56BC75E2D63100000"]);
  await send("anvil_impersonateAccount", [DEPLOYER]); await send("anvil_setBalance", [DEPLOYER, "0x56BC75E2D63100000"]);
  const deployData = art.bytecode + vI.encodeDeploy(["Base", DEV, "0x0000000000000000000000000000000000000001", "0x0000000000000000000000000000000000000002", "0x0000000000000000000000000000000000000003"]).slice(2);
  const h = await send("eth_sendTransaction", [{ from: DEPLOYER, data: deployData, gas: "0x7a1200" }]);
  const vault = (await receipt(h)).contractAddress;
  const addrs = fs.readFileSync(listFile, "utf8").trim().split("\n").filter(Boolean);
  for (const a of addrs) {
    if (done.has(a)) continue;
    let r = await Promise.race([simOne(a, facts[a], vault), new Promise((s) => setTimeout(() => s({ address: a, id: facts[a].id, result: "ERROR", reason: "timeout 600s" }), 600000))]);
    fs.appendFileSync(outFile, JSON.stringify(r) + "\n");
    consecutiveErrors = r.result === "ERROR" ? consecutiveErrors + 1 : 0;
    if (consecutiveErrors >= 3) { console.error("3 consecutive RPC errors; rotating upstream"); process.exit(2); }
  }
  console.error("retry done", outName); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
