// Hardhat config for the testing rigs. Reuses base-contracts/hardhat.config.cjs
// (same compiler, viaIR, prague, 200M gas) and the same artifacts. Forks are
// local only: RIG_FORK=base|eth forks a public RPC into the in-process Hardhat
// network. Nothing is broadcast and no key is used.
const path = require("path");
const BC = path.resolve(__dirname, "../base-contracts");
const base = require(path.join(BC, "hardhat.config.cjs"));

const FORKS = {
  base: { chainId: 8453, url: process.env.RIG_BASE_RPC || "https://base-rpc.publicnode.com" },
  eth: { chainId: 1, url: process.env.RIG_ETH_RPC || "https://ethereum-rpc.publicnode.com" },
};
const which = process.env.RIG_FORK;
const hardhat = { ...base.networks.hardhat };
if (which) {
  const f = FORKS[which];
  if (!f) throw new Error("RIG_FORK must be base or eth");
  hardhat.chainId = f.chainId;
  hardhat.chains = { [f.chainId]: { hardforkHistory: { prague: 0 } } };
  hardhat.forking = { url: f.url };
  if (process.env.RIG_FORK_BLOCK) hardhat.forking.blockNumber = Number(process.env.RIG_FORK_BLOCK);
}
// The ceremony dry-run uses the real Base block gas limit instead of 200M.
if (process.env.RIG_BLOCK_GAS) hardhat.blockGasLimit = Number(process.env.RIG_BLOCK_GAS);

module.exports = {
  ...base,
  networks: { hardhat },
  paths: {
    root: BC,
    sources: path.join(BC, "contracts"),
    artifacts: path.join(BC, "artifacts"),
    cache: path.join(BC, "cache"),
    tests: __dirname,
  },
  mocha: { timeout: 1800000 },
};
