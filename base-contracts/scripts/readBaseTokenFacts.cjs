// Reads name(), symbol(), decimals(), totalSupply() and code size for every
// token contract of the Base registry candidate (Revision D input), at one
// recorded Base block. READ-ONLY: eth_call and eth_getCode only. No key, no
// transaction.
//
// CLI: node scripts/readBaseTokenFacts.cjs --out deployment/revD_onchain_<date>.json [--rpc URL]
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const { candidateTokenAddresses } = require("./buildRevisionD.cjs");

const ABI = ["function name() view returns (string)", "function symbol() view returns (string)",
  "function decimals() view returns (uint8)", "function totalSupply() view returns (uint256)"];

async function readFacts(rpc, addresses) {
  const p = new ethers.JsonRpcProvider(rpc, 8453, { staticNetwork: true });
  const block = await p.getBlockNumber();
  const out = { chain: "Base", chainId: 8453, rpc, block, readAt: new Date().toISOString(), tokens: {} };
  for (const a of addresses) {
    const c = new ethers.Contract(a, ABI, p);
    const r = { address: ethers.getAddress(a) };
    for (let i = 0; i < 4; i++) {
      try {
        r.codeBytes = (await p.getCode(a, block)).length / 2 - 1;
        for (const f of ["name", "symbol", "decimals", "totalSupply"]) {
          try { r[f] = (await c[f]({ blockTag: block })).toString(); } catch (e) { r[f] = null; r[f + "Error"] = e.shortMessage || e.message; }
        }
        break;
      } catch (e) { if (i === 3) throw e; await new Promise((s) => setTimeout(s, 2000 * (i + 1))); }
    }
    out.tokens[a.toLowerCase()] = r;
  }
  return out;
}

if (require.main === module) {
  const a = process.argv.slice(2);
  const outFile = a[a.indexOf("--out") + 1];
  const rpc = a.includes("--rpc") ? a[a.indexOf("--rpc") + 1] : "https://mainnet.base.org";
  if (!a.includes("--out")) { console.error("usage: node scripts/readBaseTokenFacts.cjs --out <file> [--rpc URL]"); process.exit(1); }
  readFacts(rpc, candidateTokenAddresses()).then((o) => {
    fs.writeFileSync(path.resolve(outFile), JSON.stringify(o, null, 1) + "\n");
    console.error("read", Object.keys(o.tokens).length, "contracts at Base block", o.block);
  }).catch((e) => { console.error(e); process.exit(1); });
}
module.exports = { readFacts };
