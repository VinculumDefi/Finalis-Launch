// Read-only public RPCs for Rig 10 token-code checks (publicnode answered 403
// mid-run on 2026-10-23 for Ethereum; drpc is used there). Read calls only.
const URLS = {
  Base: "https://mainnet.base.org", // eth_getLogs over the ceremony range: base.gateway.tenderly.co (mainnet.base.org rate-limits getLogs)
  Ethereum: "https://eth.drpc.org",
  Arbitrum: "https://arb1.arbitrum.io/rpc",
  Optimism: "https://mainnet.optimism.io",
  Polygon: "https://polygon-bor-rpc.publicnode.com",
  "BNB Smart Chain": "https://bsc-dataseed.bnbchain.org",
  Avalanche: "https://api.avax.network/ext/bc/C/rpc",
};
const IDS = { Base: 8453, Ethereum: 1, Arbitrum: 42161, Optimism: 10, Polygon: 137, "BNB Smart Chain": 56, Avalanche: 43114 };
function providers(ethers, only) {
  const out = {};
  for (const env of Object.keys(URLS)) if (!only || only.includes(env)) out[env] = new ethers.JsonRpcProvider(URLS[env], IDS[env], { staticNetwork: true, batchMaxCount: 1 });
  return out;
}
module.exports = { URLS, IDS, providers };
