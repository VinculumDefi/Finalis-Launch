// Hardhat config for the --simulate-non-base-locks dry-run mode only.
// ceremony_dryrun.cjs starts one LOCAL `hardhat node` per non-Base EVM chain
// with this config: SIM_FORK_URL is a public read-only RPC of that chain and
// SIM_CHAIN_ID its real chain id. The fork is local; nothing is broadcast to
// any real chain and no real key is used. No sources are compiled.
const os = require("os");
const path = require("path");
const fs = require("fs");

const url = process.env.SIM_FORK_URL;
const chainId = Number(process.env.SIM_CHAIN_ID);
if (!url || !chainId) throw new Error("SIM_FORK_URL and SIM_CHAIN_ID are required");
// Pinned fork block (a couple of blocks behind the tip). Pruned public nodes,
// BNB Smart Chain in particular, keep state for only about 100 recent blocks,
// so Hardhat's default reorg-safety offset would ask for state they no longer hold.
const blockNumber = process.env.SIM_FORK_BLOCK ? Number(process.env.SIM_FORK_BLOCK) : undefined;
const root = fs.mkdtempSync(path.join(os.tmpdir(), "simfork-"));
fs.mkdirSync(path.join(root, "contracts"));

module.exports = {
  solidity: "0.8.19",
  networks: {
    hardhat: {
      chainId,
      hardfork: "cancun",
      chains: { [chainId]: { hardforkHistory: { cancun: 0 } } },
      forking: blockNumber ? { url, blockNumber } : { url },
      mining: { auto: true },
      allowUnlimitedContractSize: false,
    },
  },
  paths: {
    root,
    sources: path.join(root, "contracts"),
    artifacts: path.join(root, "artifacts"),
    cache: path.join(root, "cache"),
  },
};
