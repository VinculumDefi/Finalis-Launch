// Read-only check of the live Base Verifier (eth_call only; no keys, no transactions).
// Run from the repo root: node testing-rigs/live_read/read_live_verifier.cjs
// The Verifier address is taken from deployment/BASE44_LIVE_CONFIG_2026-10-22.md.
const path = require("path"), fs = require("fs");
const ROOT = path.resolve(__dirname, "../..");
const { ethers } = require(path.join(ROOT, "base-contracts/node_modules/ethers"));
const cfg = fs.readFileSync(path.join(ROOT, "deployment/BASE44_LIVE_CONFIG_2026-10-22.md"), "utf8");
const p = new ethers.JsonRpcProvider("https://mainnet.base.org", 8453, { staticNetwork: true });
const V = cfg.match(/verifier:\s*"(0x[0-9a-fA-F]{40})"/)[1];
const v = new ethers.Contract(V, [
 "function configurationFinalized() view returns (bool)","function deployer() view returns (address)",
 "function chainVerifiers(string) view returns (address)","function scheduledPrices(bytes32) view returns (uint256,bool)",
 "function assetRowAlias(bytes32) view returns (bytes32)","function scheduledPricePoster() view returns (address)",
 "function lastScheduledRunId() view returns (uint64)"], p);
const R = ["function environmentId() view returns (string)","function ENVIRONMENT_ID() view returns (string)","function nativeAssetId() view returns (bytes32)",
 "function TOLERANCE_SECS() view returns (uint256)","function chainId() view returns (uint256)","function ARBITRUM_ONE_CHAIN_ID() view returns (uint256)"];
const envs = ["Base","Ethereum","Arbitrum","Optimism","Polygon","BNB Smart Chain","Avalanche","Bitcoin","Bitcoin Cash","Litecoin","Dogecoin","DigiByte","Zcash","Stellar","XRP Ledger","Solana"];
const t = async f => { try { return await f(); } catch (e) { return null; } };
(async () => {
  const out = { verifier: V.slice(0,10)+"...", block: await p.getBlockNumber(), finalized: await v.configurationFinalized(),
    deployerZero: (await v.deployer()) === ethers.ZeroAddress, posterSet: (await v.scheduledPricePoster()) !== ethers.ZeroAddress,
    lastRun: String(await v.lastScheduledRunId()), envs: {} };
  for (const e of envs) {
    const a = await v.chainVerifiers(e); const row = { registered: a !== ethers.ZeroAddress, reader: a.slice(0,10)+"..." };
    if (row.registered) {
      const r = new ethers.Contract(a, R, p);
      row.envName = (await t(() => r.environmentId())) ?? (await t(() => r.ENVIRONMENT_ID()));
      row.tolerance = String(await t(() => r.TOLERANCE_SECS()));
      row.chainId = String((await t(() => r.chainId())) ?? (await t(() => r.ARBITRUM_ONE_CHAIN_ID())));
      const nid = await t(() => r.nativeAssetId());
      if (nid) {
        const k = ethers.solidityPackedKeccak256(["string","bytes32"], [e, nid]);
        const al = await v.assetRowAlias(k); const key = al === ethers.ZeroHash ? k : al;
        const [px, ok] = await v.scheduledPrices(key);
        row.native = { aliased: al !== ethers.ZeroHash, usable: ok, priceUsd: Number(px) / 1e18 };
      }
    }
    out.envs[e] = row;
  }
  console.log(JSON.stringify(out, null, 1));
})().catch(e => { console.error(e.message); process.exit(1); });
