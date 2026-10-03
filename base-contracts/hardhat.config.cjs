require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");

module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      // CL-33: required. Without viaIR the Verifier fails "stack too deep"
      // at VinculumFinalisVerifier.sol:472. Do not remove.
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      // Equihash 200,9 checks 512 BLAKE2b-50 hashes per header. Eleven headers
      // exceed the default 30,000,000 block gas limit. Base includes the
      // EIP-152 precompile used by the checker.
      hardfork: "cancun",
      blockGasLimit: 200_000_000,
    },
  },
  mocha: { timeout: 300000 },
};
