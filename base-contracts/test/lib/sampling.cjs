// Deterministic token sample for the CVL/TRS sampled tests (t204u/t205u).
// Few (<= 20 indexed tokens on a chain): all of them. Many: ceil(10%) picked by
// ascending keccak256(SEED | environment | lowercased address), plus the
// always-included well-known tokens and the native coin. Reproducible.
const { ethers } = require("ethers");
const { buildTokenAddressIndex } = require("../../scripts/buildTokenAddressIndex.cjs");

const SEED = "t204u-cvl-trs-sample-v1";
const FEW = 20;
const CHAINS = ["Ethereum", "Arbitrum", "Base", "Optimism", "Polygon", "BNB Smart Chain", "Avalanche"];
// Well-known tokens, by the registry's own row labels on each chain.
const ALWAYS = {
  Ethereum: ["USDC", "USDT", "WBTC", "DAI", "CBBTC_ETH"],
  Arbitrum: ["USDC_ARB", "USDT_ARB", "WBTC_ARB", "DAI_ARB", "WETH_ARB"],
  Base: ["USDC_BASE", "cbBTC", "AERO"],
  Optimism: ["USDC_OP", "USDT_OP", "WBTC_OP", "DAI_OP", "WETH_OP"],
  Polygon: ["USDC_POL", "USDT_POL", "WBTC_POL", "DAI_POL", "WETH_POL", "WMATIC"],
  "BNB Smart Chain": ["USDC_BSC", "USDT_BSC", "DAI_BSC", "WETH_BSC", "WBNB", "BTCB"],
  Avalanche: ["USDC_AVAX", "USDT_AVAX", "DAI_AVAX", "WETH_AVAX", "WAVAX", "BTCB"],
};

function sampleTokens() {
  const { entries } = buildTokenAddressIndex();
  const out = {};
  for (const env of CHAINS) {
    const all = entries.filter((e) => e.environmentId === env);
    const always = ALWAYS[env].map((s) => {
      const e = all.find((x) => x.symbol === s);
      if (!e) throw new Error("always-included token not in registry: " + env + " " + s);
      return e;
    });
    let picked;
    if (all.length <= FEW) picked = all;
    else {
      const n = Math.ceil(all.length / 10);
      const rank = (e) => ethers.solidityPackedKeccak256(["string"], [SEED + "|" + env + "|" + e.token.toLowerCase()]);
      const random = all.filter((e) => !always.includes(e)).sort((a, b) => (rank(a) < rank(b) ? -1 : 1)).slice(0, n);
      picked = [...always, ...random];
    }
    out[env] = { total: all.length, few: all.length <= FEW, tokens: picked.sort((a, b) => a.row - b.row) };
  }
  return out;
}
module.exports = { sampleTokens, SEED, FEW, ALWAYS, CHAINS };
