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
};
