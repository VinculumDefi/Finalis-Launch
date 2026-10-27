// Revision E compatibility evidence tool (operator order t448u, 2026-10-26).
// Run from a work directory that holds cand.json (the recommendation rows as
// JSON), block.txt (the pinned Base block) and, for the simulations,
// static_facts.json. Read-only against public Base RPCs; every transaction
// runs only inside a local anvil fork. Nothing is signed or broadcast.
// READ-ONLY static facts for every candidate token at one Base block.
const { ethers } = require("ethers");
const fs = require("fs");
const RPC = process.env.RPC || "https://mainnet.base.org";
const cand = JSON.parse(fs.readFileSync("cand.json")).filter((r) => r.contract.startsWith("0x"));
const MC = "0xcA11bde05977b3631167028862bE2a173976CA11";
const mc = new ethers.Interface(["function aggregate3((address target,bool allowFailure,bytes callData)[] calls) view returns ((bool success,bytes returnData)[])"]);
const erc = new ethers.Interface(["function name() view returns (string)", "function symbol() view returns (string)", "function decimals() view returns (uint8)", "function totalSupply() view returns (uint256)", "function balanceOf(address) view returns (uint256)", "function paused() view returns (bool)", "function owner() view returns (address)"]);
const PROBE = "0x000000000000000000000000000000000000dEaD";
async function rpc(method, params) {
  for (let i = 0; i < 6; i++) {
    try {
      const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
      const j = await r.json();
      if (j.error || j.result === undefined) throw new Error(JSON.stringify(j));
      return j.result;
    } catch (e) { if (i === 5) throw e; await new Promise((s) => setTimeout(s, 1500 * (i + 1))); }
  }
}
function decStr(data) { // string or bytes32
  try { return erc.decodeFunctionResult("symbol", data)[0]; } catch (_) {}
  if (data && data.length === 66) { try { return ethers.decodeBytes32String(data); } catch (_) { return "bytes32:" + data; } }
  return null;
}
(async () => {
  const block = Number(process.env.BLOCK || (await rpc("eth_blockNumber", [])));
  const tag = "0x" + block.toString(16);
  const out = { chain: "Base", chainId: 8453, rpc: RPC, block, readAt: new Date().toISOString(), tokens: {} };
  const fns = [["name", []], ["symbol", []], ["decimals", []], ["totalSupply", []], ["balanceOf", [PROBE]], ["paused", []], ["owner", []]];
  for (let i = 0; i < cand.length; i += 60) {
    const part = cand.slice(i, i + 60);
    const calls = [];
    for (const r of part) for (const [f, a] of fns) calls.push({ target: r.contract, allowFailure: true, callData: erc.encodeFunctionData(f, a) });
    const res = mc.decodeFunctionResult("aggregate3", await rpc("eth_call", [{ to: MC, data: mc.encodeFunctionData("aggregate3", [calls]) }, tag]))[0];
    await Promise.all(part.map(async (r, k) => {
      const a = r.contract.toLowerCase();
      const g = (j) => res[k * fns.length + j];
      const code = await rpc("eth_getCode", [r.contract, tag]);
      const impl = await rpc("eth_getStorageAt", [r.contract, "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc", tag]);
      const t = { id: r.row_or_proposed_id, codeBytes: (code.length - 2) / 2, eip1967Impl: BigInt(impl) === 0n ? null : "0x" + impl.slice(26) };
      t.eip1167 = code.length < 120 && code.toLowerCase().includes("363d3d373d3d3d363d73");
      t.name = g(0).success ? decStr(g(0).returnData) : null;
      t.symbol = g(1).success ? decStr(g(1).returnData) : null;
      try { t.decimals = g(2).success ? Number(erc.decodeFunctionResult("decimals", g(2).returnData)[0]) : null; } catch (_) { t.decimals = null; t.decimalsRaw = g(2).returnData; }
      try { t.totalSupply = g(3).success ? erc.decodeFunctionResult("totalSupply", g(3).returnData)[0].toString() : null; } catch (_) { t.totalSupply = null; }
      try { t.balanceOfOk = g(4).success && g(4).returnData.length >= 66; } catch (_) { t.balanceOfOk = false; }
      try { t.paused = g(5).success && g(5).returnData.length === 66 ? erc.decodeFunctionResult("paused", g(5).returnData)[0] : null; } catch (_) { t.paused = null; }
      try { t.owner = g(6).success && g(6).returnData.length === 66 ? erc.decodeFunctionResult("owner", g(6).returnData)[0] : null; } catch (_) { t.owner = null; }
      out.tokens[a] = t;
    }));
    process.stderr.write(`${i + part.length} `);
  }
  fs.writeFileSync("static_facts.json", JSON.stringify(out, null, 1));
  console.error("\ndone block", block, Object.keys(out.tokens).length);
})().catch((e) => { console.error(e); process.exit(1); });
