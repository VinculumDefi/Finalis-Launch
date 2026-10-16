// Satisfies finalize() prerequisites (VF-DEP-010..014) in test fixtures, then
// finalizes. Fills only what is missing: a Base reader, the Base native-ETH
// registry row, the Base Dev Fund, the price poster, and a usable Base ETH
// price written as run 1. Tests that write their own runs start at run 2.
const { ethers } = require("hardhat");

const SCALE = 10n ** 18n;
const BASE_ETH_ID = "0xde7085290190e1f2f7f2f83d26fa72e411f9d765ddd608a77e8a7c388113943b";
const BASE_ETH_PRICE = 1000n * SCALE;

async function finalizeCeremony(verifier) {
  const [deployer] = await ethers.getSigners();
  if ((await verifier.chainVerifiers("Base")) === ethers.ZeroAddress) {
    const reader = await (await ethers.getContractFactory("BaseLockRecordVerifier")).deploy(deployer.address);
    await (await verifier.registerChainVerifier("Base", await reader.getAddress())).wait();
  }
  const key = ethers.solidityPackedKeccak256(["string", "bytes32"], ["Base", BASE_ETH_ID]);
  if ((await verifier.assetPrecisionTable(key)).canonicalAssetId === ethers.ZeroHash) {
    await (await verifier.registerAssetPrecision("Base", BASE_ETH_ID, "ETH", 18, 2, 0)).wait();
  }
  if ((await verifier.devFundDestinations("Base")) === ethers.ZeroAddress) {
    await (await verifier.configureDevFund("Base", deployer.address)).wait();
  }
  if ((await verifier.scheduledPricePoster()) === ethers.ZeroAddress) {
    await (await verifier.setScheduledPricePoster(deployer.address)).wait();
  }
  const sp = await verifier.scheduledPrices(key);
  if (!sp.usable) {
    const run = (await verifier.lastScheduledRunId()) + 1n;
    await (await verifier.applyScheduledPriceRun(run, [
      { environmentId: "Base", canonicalAssetId: BASE_ETH_ID, priceUsd18: BASE_ETH_PRICE, success: true },
    ])).wait();
  }
  await (await verifier.finalize()).wait();
}

module.exports = { finalizeCeremony, BASE_ETH_ID, BASE_ETH_PRICE };
