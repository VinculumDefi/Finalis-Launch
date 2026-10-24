require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");

module.exports = {
  solidity: {
    // One compiler entry, same settings as before; the compilers form is
    // needed because Hardhat ignores overrides next to a bare version.
    compilers: [{
      version: "0.8.19",
      settings: {
        optimizer: { enabled: true, runs: 200 },
        // CL-33: required. Without viaIR the Verifier fails "stack too deep"
        // at VinculumFinalisVerifier.sol:472. Do not remove.
        viaIR: true,
      },
    }],
    // Ethereum finality anchor (2026-10-24). These files compile in their own
    // job. With viaIR, adding sources to the main job renumbers the AST and
    // changes the bytecode of unrelated readers, which would break the t272u
    // pin of scripts/deploy-pages/ceremony.json. The settings are the same as
    // above; the explicit metadata hash (the solc default) only keeps the job
    // separate.
    overrides: Object.fromEntries([
      "contracts/checkers/EvmStorageProof.sol",
      "contracts/checkers/BaseBeaconRootAnchor.sol",
      "contracts/chain-verifiers/EthereumStorageLockReader.sol",
    ].map((f) => [f, {
      version: "0.8.19",
      settings: { optimizer: { enabled: true, runs: 200 }, viaIR: true, metadata: { bytecodeHash: "ipfs" } },
    }])),
  },
  networks: {
    hardhat: {
      // Equihash 200,9 checks 512 BLAKE2b-50 hashes per header. Eleven headers
      // exceed the default 30,000,000 block gas limit. Base includes the
      // EIP-152 precompile used by the checker.
      // Prague: EIP-2537 BLS12-381 precompiles used by EthereumBeaconLightClient.
      hardfork: "prague",
      blockGasLimit: 200_000_000,
    },
  },
  mocha: { timeout: 300000 },
};
