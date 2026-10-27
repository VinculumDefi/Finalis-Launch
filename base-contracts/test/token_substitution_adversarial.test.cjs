// t284u: adversarial token substitution against main's Verifier + Base lock/reader.
// Deploys a worthless ERC-20, locks it labelled as Base ETH or as a registered
// asset, and asserts the Verifier refuses the mint. No production Solidity edits.
const { expect } = require("chai");
const { ethers } = require("hardhat");
// VF-ORC-016: posted prices are USD per whole token with 30 decimals.
const P30 = (usd18) => BigInt(usd18) * 10n ** 12n;

const SCALE = 10n ** 18n;
const PRICE = 1000n * SCALE;
const DAY7 = 604800n;
const ETH_ID = "0xde7085290190e1f2f7f2f83d26fa72e411f9d765ddd608a77e8a7c388113943b";
const USDC_ID = ethers.solidityPackedKeccak256(["string", "string"], ["Ethereum", "USDC"]);
const coder = ethers.AbiCoder.defaultAbiCoder();

async function deployBasePath() {
  const [deployer, recipient, other, dest, devFund] = await ethers.getSigners();
  const T = await ethers.getContractFactory("VinculumFinalisToken");
  const vclm = await T.deploy("Vinculum", "VCLM", 10_000_000_000n * SCALE);
  const chonx = await T.deploy("Chonx", "CHONX", 100_000_000_000n * SCALE);
  const verifier = await (await ethers.getContractFactory("VinculumFinalisVerifier")).deploy(
    await vclm.getAddress(), await chonx.getAddress()
  );
  const forge = await (await ethers.getContractFactory("VinculumFinalisSynth")).deploy(
    await verifier.getAddress(), await vclm.getAddress(), await chonx.getAddress()
  );
  const stake = await (await ethers.getContractFactory("VinculumFinalisStake")).deploy(
    await vclm.getAddress(), await chonx.getAddress(), await forge.getAddress(), await verifier.getAddress()
  );
  await vclm.initialize(await verifier.getAddress(), await stake.getAddress());
  await chonx.initialize(await verifier.getAddress(), ethers.ZeroAddress);
  // Main Base path: BaseCommitmentVaultLock + BaseLockRecordVerifier.
  const lock = await (await ethers.getContractFactory("BaseCommitmentVaultLock")).deploy(
    "Base",
    devFund.address,
    await vclm.getAddress(),
    await chonx.getAddress(),
    await forge.getAddress()
  );
  const reader = await (await ethers.getContractFactory("BaseLockRecordVerifier")).deploy(await lock.getAddress());
  await verifier.registerChainVerifier("Base", await reader.getAddress());
  await verifier.registerAssetPrecision("Base", ETH_ID, "ETH", 18, 2, 0);
  await verifier.registerAssetPrecision("Base", USDC_ID, "USDC", 6, 2, 1);
  // Index a real (registered) token address so a worthless token is clearly unindexed.
  const realUsdc = await (await ethers.getContractFactory("TestFixtureERC20")).deploy(0);
  await verifier.registerTokenAddressBatch([{
    environmentId: "Base",
    token: await realUsdc.getAddress(),
    canonicalAssetId: USDC_ID,
  }]);
  await verifier.setScheduledPricePoster(deployer.address);
  await verifier.configureDevFund("Base", devFund.address);
  await verifier.applyScheduledPriceRun(1n, [
    { environmentId: "Base", canonicalAssetId: ETH_ID, priceUsd30: P30(PRICE), success: true },
    { environmentId: "Base", canonicalAssetId: USDC_ID, priceUsd30: P30(SCALE), success: true },
  ]);
  await verifier.finalize();
  return { deployer, recipient, other, dest, devFund, vclm, chonx, forge, verifier, lock, reader, realUsdc };
}

function pkg(lockId, rec, assetId, recipient) {
  return {
    sourceEnvironmentId: "Base",
    commitmentVaultLockId: lockId,
    handshakeAllowanceCount: 3,
    canonicalAssetId: assetId,
    assetPrecision: assetId === USDC_ID ? 6 : 18,
    assetCustodyClass: 2,
    grossAmountSmallestUnits: rec.gross,
    actualFeeAmountSmallestUnits: rec.fee,
    principalAmountSmallestUnits: rec.principal,
    feeAssetId: assetId,
    devFundDestination: "dev",
    feeTransferEvidence: ethers.id("fee"),
    valuationTimestamp: rec.createdAt,
    maturityTimestamp: rec.maturity,
    durationSecs: rec.duration,
    selectedOutputToken: rec.outputToken,
    baseRecipient: recipient,
    releaseDestination: "release",
    chonxActivationReceipt: "0x",
    racIdentity: ethers.hexlify(ethers.randomBytes(32)),
    priceRecord: "0x",
    sourceFinalityProof: "0x",
    lockEventProof: coder.encode(
      ["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
      [lockId, rec.gross, rec.fee, rec.principal, rec.duration, rec.createdAt, rec.maturity]
    ),
  };
}

describe("adversarial token substitution (main Verifier + Base lock/reader)", function () {
  it("worthless ERC-20 locked labelled as Base ETH is refused (VF-XCH-011: asset mismatch)", async function () {
    const c = await deployBasePath();
    const junk = await (await ethers.getContractFactory("TestFixtureERC20")).deploy(0);
    await junk.mint(c.other.address, 10n ** 24n);
    await junk.connect(c.other).approve(await c.lock.getAddress(), 10n ** 24n);
    const lockId = ethers.hexlify(ethers.randomBytes(32));
    // Caller labels the lock as native ETH (ETH_ID) while depositing junk ERC-20.
    await c.lock.connect(c.other).createErc20Lock(
      lockId, c.recipient.address, 0, ETH_ID, ethers.ZeroHash, c.dest.address, DAY7,
      await junk.getAddress(), 10n ** 18n, SCALE
    );
    const rec = await c.lock.lockRecord(lockId);
    const p = pkg(lockId, rec, ETH_ID, c.recipient.address);
    // Reader derives keccak256(abi.encode("Base", token)); not in tokenAssetIndex.
    const proven = await c.reader.extractAssetId(p.lockEventProof);
    expect(proven).to.equal(await c.verifier.tokenAddressKey("Base", await junk.getAddress()));
    expect(proven).to.not.equal(ETH_ID);
    await expect(c.verifier.recordFeeAndRac(p)).to.be.revertedWith("VF-XCH-011: asset mismatch");
  });

  it("worthless ERC-20 locked labelled as a registered token row is refused (VF-XCH-011)", async function () {
    const c = await deployBasePath();
    const junk = await (await ethers.getContractFactory("TestFixtureERC20")).deploy(0);
    await junk.mint(c.other.address, 10n ** 24n);
    await junk.connect(c.other).approve(await c.lock.getAddress(), 10n ** 24n);
    const lockId = ethers.hexlify(ethers.randomBytes(32));
    await c.lock.connect(c.other).createErc20Lock(
      lockId, c.recipient.address, 0, USDC_ID, ethers.ZeroHash, c.dest.address, DAY7,
      await junk.getAddress(), 10n ** 6n, SCALE
    );
    const rec = await c.lock.lockRecord(lockId);
    const p = pkg(lockId, rec, USDC_ID, c.recipient.address);
    await expect(c.verifier.recordFeeAndRac(p)).to.be.revertedWith("VF-XCH-011: asset mismatch");
  });

  it("BaseCommitmentVaultLock refuses VCLM as a lock input (VF-TOK-007)", async function () {
    const c = await deployBasePath();
    // Mint VCLM to other via the verifier path is heavy; use deal-style by having
    // the token already initialized — transfer from deployer is not available
    // without mint. Use TestFixture for the ERC-20 case above; for protocol
    // tokens call createErc20Lock with the VCLM address directly (balance check
    // happens after the protocol-token require).
    const lockId = ethers.hexlify(ethers.randomBytes(32));
    await expect(
      c.lock.connect(c.other).createErc20Lock(
        lockId, c.recipient.address, 0, ETH_ID, ethers.ZeroHash, c.dest.address, DAY7,
        await c.vclm.getAddress(), 10n ** 18n, SCALE
      )
    ).to.be.revertedWith("VF-TOK-007: protocol token is not a lock input");
  });
});
