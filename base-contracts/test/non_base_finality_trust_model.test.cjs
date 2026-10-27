// Non-Base reader trust model, after fix 2026-10-23 (AG-01, t301u).
// Before the fix, SimpleEthereumLockReader (and the same EvmReceiptLockReader
// base used by Arbitrum, Optimism, Polygon, BNB Smart Chain and Avalanche)
// accepted a self-consistent local block as "finalized": it checked only that
// the claimed hash equals keccak of the supplied header, never that the header
// is part of the chain's settled history, and the Verifier minted.
// Safe behavior now: the reader refuses finality (VF-XCH-006, environment
// disabled), the Verifier records no fee or RAC and mints nothing. The block
// binding check is still available as headerClaimMatches. Base is different:
// the Base reader reads live Base storage and still mints (checked below).
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { ethLockEvidence, encodeEvidence } = require("./lib/ethProof.cjs");
// VF-ORC-016: posted prices are USD per whole token with 30 decimals.
const P30 = (usd18) => BigInt(usd18) * 10n ** 12n;
const SCALE = 10n ** 18n, DAY7 = 604800n;
const ETH_ID = "0xde7085290190e1f2f7f2f83d26fa72e411f9d765ddd608a77e8a7c388113943b";
const coder = ethers.AbiCoder.defaultAbiCoder();

describe("non-Base finality trust model (t301u), fixed 2026-10-23", function () {
  it("SimpleEthereumLockReader refuses a self-consistent local block; the Verifier records and mints nothing", async () => {
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
      { environmentId: "Base", canonicalAssetId: ETH_ID, priceUsd30: P30(2392n * SCALE), success: true },
      { environmentId: "Ethereum", canonicalAssetId: ETH_ID, priceUsd30: P30(2392n * SCALE), success: true },
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
    const REFUSED = "VF-XCH-006: Ethereum settled-history anchor not enforced on-chain; environment disabled";
    // The block binding itself still checks out...
    const [h, n] = await reader.headerClaimMatches(p.lockEventProof, p.sourceFinalityProof);
    expect(h).to.equal(ev.block.hash);
    expect(n).to.equal(BigInt(ev.block.number));
    // ...but finality is refused, in both phases.
    await expect(reader.verifyFinality(p.lockEventProof, p.sourceFinalityProof)).to.be.revertedWith(REFUSED);
    await expect(verifier.recordFeeAndRac(p)).to.be.revertedWith(REFUSED);
    await expect(verifier.verifyAndMint(p, 0)).to.be.revertedWith("VF-FEE-011: call recordFeeAndRac() first");
    expect(await verifier.isLockRacRecorded("Ethereum", lockId)).to.equal(false);
    expect(await vclm.balanceOf(recipient.address)).to.equal(0n);

    // Base still works: a real Base lock record is proven and mints.
    const baseId = ethers.hexlify(ethers.randomBytes(32));
    await baseLock.connect(other).createNativeLock(
      baseId, recipient.address, 0, ETH_ID, ethers.ZeroHash, dest.address, DAY7, 2392n * SCALE / 100n,
      { value: SCALE / 100n }
    );
    const br = await baseLock.lockRecord(baseId);
    const bp = {
      ...p, sourceEnvironmentId: "Base", commitmentVaultLockId: baseId,
      grossAmountSmallestUnits: br.gross, actualFeeAmountSmallestUnits: br.fee, principalAmountSmallestUnits: br.principal,
      valuationTimestamp: br.createdAt, maturityTimestamp: br.maturity, durationSecs: br.duration,
      sourceFinalityProof: "0x",
      lockEventProof: coder.encode(["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
        [baseId, br.gross, br.fee, br.principal, br.duration, br.createdAt, br.maturity]),
    };
    await verifier.recordFeeAndRac(bp);
    await verifier.verifyAndMint(bp, 0);
    expect(await vclm.balanceOf(recipient.address)).to.be.gt(0n);
  });
});
