// Documents the current non-Base reader trust model on main (5996ba1 / live
// ceremony): SimpleEthereumLockReader (and the same EvmReceiptLockReader base
// used by Arb/OP/Polygon/BNB/Avalanche) accepts a self-consistent local block
// as "finalized". verifyFinality checks that the claimed hash equals keccak of
// the supplied header RLP; it does not check that the header is part of that
// chain's settled history. The Verifier then mints. Base is different: the
// Base reader reads live Base storage. This test pins the current behaviour so
// a settled-history checker, when added, is a deliberate change.
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { ethLockEvidence, encodeEvidence } = require("./lib/ethProof.cjs");
const SCALE = 10n ** 18n, DAY7 = 604800n;
const ETH_ID = "0xde7085290190e1f2f7f2f83d26fa72e411f9d765ddd608a77e8a7c388113943b";
const coder = ethers.AbiCoder.defaultAbiCoder();

describe("non-Base finality trust model (t301u)", function () {
  it("SimpleEthereumLockReader accepts a self-consistent local block and the Verifier mints", async () => {
    const [deployer, recipient, other, dest, devFund] = await ethers.getSigners();
    const T = await ethers.getContractFactory("VinculumFinalisToken");
    const vclm = await T.deploy("Vinculum", "VCLM", 10_000_000_000n * SCALE);
    const chonx = await T.deploy("Chonx", "CHONX", 100_000_000_000n * SCALE);
    const verifier = await (await ethers.getContractFactory("VinculumFinalisVerifier")).deploy(
      await vclm.getAddress(), await chonx.getAddress()
    );
    const stake = await (await ethers.getContractFactory("VinculumFinalisStake")).deploy(
      await vclm.getAddress(), await chonx.getAddress(), await vclm.getAddress(), await verifier.getAddress()
    );
    await vclm.initialize(await verifier.getAddress(), await stake.getAddress());
    await chonx.initialize(await verifier.getAddress(), ethers.ZeroAddress);
    const baseLock = await (await ethers.getContractFactory("BaseCommitmentVaultLock")).deploy(
      "Base", devFund.address, await vclm.getAddress(), await chonx.getAddress(), await vclm.getAddress()
    );
    const baseReader = await (await ethers.getContractFactory("BaseLockRecordVerifier")).deploy(await baseLock.getAddress());
    await verifier.registerChainVerifier("Base", await baseReader.getAddress());
    await verifier.registerAssetPrecision("Base", ETH_ID, "ETH", 18, 2, 0);
    await verifier.configureDevFund("Base", devFund.address);
    const lock = await (await ethers.getContractFactory("CommitmentVaultLock")).deploy("Ethereum", devFund.address);
    const reader = await (await ethers.getContractFactory("SimpleEthereumLockReader")).deploy(await lock.getAddress());
    await verifier.registerChainVerifier("Ethereum", await reader.getAddress());
    await verifier.registerAssetPrecision("Ethereum", ETH_ID, "ETH", 18, 2, 0);
    await verifier.configureDevFund("Ethereum", devFund.address);
    await verifier.setScheduledPricePoster(deployer.address);
    await verifier.applyScheduledPriceRun(1n, [
      { environmentId: "Base", canonicalAssetId: ETH_ID, priceUsd18: 2392n * SCALE, success: true },
      { environmentId: "Ethereum", canonicalAssetId: ETH_ID, priceUsd18: 2392n * SCALE, success: true },
    ]);
    await verifier.finalize();
    const lockId = ethers.hexlify(ethers.randomBytes(32));
    const tx = await lock.connect(other).createNativeLock(
      lockId, recipient.address, 0, ETH_ID, ethers.ZeroHash, dest.address, DAY7, 2392n * SCALE / 100n,
      { value: SCALE / 100n }
    );
    const rc = await tx.wait();
    const ev = await ethLockEvidence(await lock.getAddress(), rc.hash, lockId);
    const rec = await lock.lockRecord(lockId);
    const p = {
      sourceEnvironmentId: "Ethereum", commitmentVaultLockId: lockId, handshakeAllowanceCount: 3,
      canonicalAssetId: ETH_ID, assetPrecision: 18, assetCustodyClass: 2,
      grossAmountSmallestUnits: rec.gross, actualFeeAmountSmallestUnits: rec.fee,
      principalAmountSmallestUnits: rec.principal, feeAssetId: ETH_ID, devFundDestination: "dev",
      feeTransferEvidence: ethers.id("fee"), valuationTimestamp: rec.createdAt, maturityTimestamp: rec.maturity,
      durationSecs: rec.duration, selectedOutputToken: 0, baseRecipient: recipient.address,
      releaseDestination: "release", chonxActivationReceipt: "0x",
      racIdentity: ethers.hexlify(ethers.randomBytes(32)), priceRecord: "0x",
      sourceFinalityProof: coder.encode(["uint256", "bytes32", "uint256"], [1, ev.block.hash, ev.block.number]),
      lockEventProof: encodeEvidence(ev),
    };
    await verifier.recordFeeAndRac(p);
    await verifier.verifyAndMint(p, 0);
    expect(await vclm.balanceOf(recipient.address)).to.be.gt(0n);
  });
});
