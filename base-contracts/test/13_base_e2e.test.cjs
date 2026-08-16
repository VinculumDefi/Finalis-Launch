// =============================================================================
// CANONICAL PRODUCTION-VERIFIER COMPLETION EVIDENCE — BASE
//
// This suite is the evidence cited under Verifier Completion Standard 5 for
// the Base environment. It exercises the production BaseSameChainVerifier
// against genuine locks created by VinculumFinalisBaseVault, through to real
// issuance by VinculumFinalisVerifier. No mock stands at any seam.
//
// 04_endtoend.test.cjs uses MockChainVerifier and is explicitly NOT
// completion evidence. Recorded under CL-77.
// =============================================================================

// =============================================================================
// Base environment — end-to-end integration (Section O elements 9, 10)
//
// The first test in this project where a genuine lock, the production verifier,
// and real issuance connect. 04_endtoend registers MockChainVerifier and
// supplies an empty finality proof; nothing there exercises a real lock.
//
// Here: VinculumFinalisBaseVault creates a lock, BaseSameChainVerifier reads it
// from vault storage, and VinculumFinalisVerifier mints against it.
//
// Section O element 9  — replay identifier keccak256(env, lockId)
// Section O element 10 — failure/resubmission: a failed attempt consumes nothing
// =============================================================================

const { expect } = require("chai");
const { ethers } = require("hardhat");

const ENV = "base";
const ZERO = "0x0000000000000000000000000000000000000000";
const DAY = 86400n;

function assetId(symbol) {
  return ethers.keccak256(ethers.toUtf8Bytes(`${ENV}:${symbol}`));
}

async function signBatch(verifier, signer, runId, ids, prices, fetchTs) {
  const net = await ethers.provider.getNetwork();
  const digest = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "address", "uint64", "bytes32", "bytes32", "uint64"],
      [net.chainId, await verifier.getAddress(), runId,
       ethers.solidityPackedKeccak256(["bytes32[]"], [ids]),
       ethers.solidityPackedKeccak256(["uint256[]"], [prices]), fetchTs]
    )
  );
  return await signer.signMessage(ethers.getBytes(digest));
}

async function deployStack() {
  const signers = await ethers.getSigners();
  const [deployer] = signers;
  const publisher = signers[9];
  const user = signers[3];
  const relayer = signers[5];      // permissionless caller, no privileges
  const devFund = signers[8];

  const Token = await ethers.getContractFactory("VinculumFinalisToken");
  const vclm  = await Token.deploy("Vinculum", "VCLM", 10_000_000_000n * 10n**18n);
  const chonx = await Token.deploy("Chonx", "CHONX", 100_000_000_000n * 10n**18n);
  const synth = await Token.deploy("Synth", "SYNTH", 10_000_000n * 10n**18n);

  const launchTs = (await ethers.provider.getBlock("latest")).timestamp;
  const V = await ethers.getContractFactory("VinculumFinalisVerifier");
  const verifier = await V.deploy(
    await vclm.getAddress(), await chonx.getAddress(), publisher.address, launchTs
  );

  const Stake = await ethers.getContractFactory("VinculumFinalisStake");
  const stake = await Stake.deploy(
    await vclm.getAddress(), await chonx.getAddress(),
    await synth.getAddress(), await verifier.getAddress(), launchTs
  );

  await vclm.initialize(await verifier.getAddress(), await stake.getAddress());
  await chonx.initialize(await verifier.getAddress(), ZERO);
  await synth.initialize(await verifier.getAddress(), ZERO);

  const Mock = await ethers.getContractFactory("MockERC20");
  const token = await Mock.deploy("MockUSD", "MUSD", 18, 10n**30n);
  const AID = assetId("MUSD");

  // The vault must exist before the verifier that reads it, and the chain
  // verifier must be registered before the issuance contract is finalized.
  const Vault = await ethers.getContractFactory("VinculumFinalisBaseVault");
  const vault = await Vault.deploy(await verifier.getAddress(), devFund.address);

  const BV = await ethers.getContractFactory("BaseSameChainVerifier");
  const baseVerifier = await BV.deploy(await vault.getAddress());

  await verifier.registerAssetPrecision(ENV, AID, "MUSD", 18, 1, 1);
  await verifier.registerChainVerifier(ENV, await baseVerifier.getAddress());
  await verifier.registerHandshakeAllowance(ENV, 3);
  await verifier.configureDevFund(ENV, devFund.address.toLowerCase());
  await verifier.finalize();

  await vault.registerAsset(await token.getAddress(), AID);
  await vault.finalizeConfiguration();

  const ts = (await ethers.provider.getBlock("latest")).timestamp;
  const sig = await signBatch(verifier, publisher, 1n, [AID], [1_000_000n], ts);
  await verifier.submitPriceBatch(1n, [AID], [1_000_000n], ts, sig);

  await token.transfer(user.address, 10n**24n);
  await token.connect(user).approve(await vault.getAddress(), 10n**24n);

  return { deployer, user, relayer, devFund, publisher,
           verifier, vault, baseVerifier, token, vclm, AID };
}

// Creates a genuine lock and returns the package describing it, built entirely
// from vault state rather than invented numbers.
async function realLockAndPackage(s, tag, gross = 100n * 10n**18n, duration = 30n * DAY) {
  const lockId = ethers.keccak256(ethers.toUtf8Bytes(tag));
  await s.vault.connect(s.user).commitVaultLock({
    lockId,
    asset: await s.token.getAddress(),
    grossAmount: gross,
    durationSecs: duration,
    baseRecipient: s.user.address,
    releaseDestination: s.user.address,
    outputToken: 0,
    chonxActivationReceipt: ethers.ZeroHash,
  });

  const r = await s.vault.getLock(lockId);

  const lockEventProof = ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
    [r.lockId, r.grossAmount, r.feeAmount, r.principalAmount,
     r.durationSecs, r.creationTime, r.maturityTime]
  );

  const pkg = {
    sourceEnvironmentId: ENV,
    commitmentVaultLockId: r.lockId,
    handshakeIdentity: `${ENV}:${s.user.address.toLowerCase()}`,
    handshakeAllowanceCount: r.handshakeAllowanceCount,
    canonicalAssetId: s.AID,
    assetPrecision: 18,
    assetCustodyClass: 1,
    grossAmountSmallestUnits: r.grossAmount,
    actualFeeAmountSmallestUnits: r.feeAmount,
    principalAmountSmallestUnits: r.principalAmount,
    feeAssetId: s.AID,
    devFundDestination: s.devFund.address.toLowerCase(),
    feeTransferEvidence: ethers.keccak256(ethers.toUtf8Bytes(`fee-${tag}`)),
    valuationTimestamp: Number(r.creationTime),
    maturityTimestamp: Number(r.maturityTime),
    durationSecs: r.durationSecs,
    selectedOutputToken: 0,
    baseRecipient: r.baseRecipient,
    releaseDestination: s.user.address.toLowerCase(),
    chonxActivationReceipt: "0x",
    racIdentity: ethers.keccak256(ethers.toUtf8Bytes(`rac-${tag}`)),
    sourceFinalityProof: "0x",          // ignored by the same-chain verifier
    lockEventProof,
  };

  return { lockId, record: r, pkg };
}

describe("Base end-to-end — genuine lock through the production verifier", function () {

  it("mints against a real Base lock, called by an unprivileged relayer", async function () {
    const s = await deployStack();
    const { pkg } = await realLockAndPackage(s, "e2e-1");

    const before = await s.vclm.balanceOf(s.user.address);

    // Permissionless transport: the caller holds no role (VF-SEC-005).
    await s.verifier.connect(s.relayer).recordFeeAndRac(pkg);
    await s.verifier.connect(s.relayer).verifyAndMint(pkg);

    const minted = await s.vclm.balanceOf(s.user.address) - before;
    console.log(`\n    Base e2e: minted ${ethers.formatUnits(minted, 18)} VCLM against a real lock\n`);
    expect(minted).to.be.greaterThan(0n);
  });

  it("element 9 — the same lock cannot mint twice", async function () {
    const s = await deployStack();
    const { lockId, pkg } = await realLockAndPackage(s, "e2e-replay");

    await s.verifier.connect(s.relayer).recordFeeAndRac(pkg);
    await s.verifier.connect(s.relayer).verifyAndMint(pkg);

    expect(await s.verifier.isLockConsumed(ENV, lockId)).to.equal(true);

    // A second attempt with a fresh RAC identity still fails on the replay key.
    const second = { ...pkg, racIdentity: ethers.keccak256(ethers.toUtf8Bytes("rac-2")) };
    await expect(s.verifier.connect(s.relayer).verifyAndMint(second))
      .to.be.revertedWith("VF-XCH-013: replay");
  });

  it("element 10 — a failed attempt consumes nothing and the lock stays mintable", async function () {
    const s = await deployStack();
    const { lockId, pkg } = await realLockAndPackage(s, "e2e-fail");

    // Fails at the VF-XCH-011 cross-check: the package claims more than the
    // vault recorded, and the verifier returns the vault's figures.
    const lying = { ...pkg, grossAmountSmallestUnits: pkg.grossAmountSmallestUnits * 2n };
    await expect(s.verifier.connect(s.relayer).verifyAndMint(lying)).to.be.reverted;

    // Nothing consumed.
    expect(await s.verifier.isLockConsumed(ENV, lockId)).to.equal(false);

    // The honest package still works afterwards.
    await s.verifier.connect(s.relayer).recordFeeAndRac(pkg);
    await s.verifier.connect(s.relayer).verifyAndMint(pkg);
    expect(await s.verifier.isLockConsumed(ENV, lockId)).to.equal(true);
  });

  it("a package naming a lock that was never created cannot mint", async function () {
    const s = await deployStack();
    const { pkg } = await realLockAndPackage(s, "e2e-real");

    // Same shape, different lock id — no such lock exists in the vault.
    const phantomId = ethers.keccak256(ethers.toUtf8Bytes("never-locked"));
    const phantomProof = ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
      [phantomId, pkg.grossAmountSmallestUnits, pkg.actualFeeAmountSmallestUnits,
       pkg.principalAmountSmallestUnits, pkg.durationSecs,
       pkg.valuationTimestamp, pkg.maturityTimestamp]
    );
    const phantom = {
      ...pkg,
      commitmentVaultLockId: phantomId,
      lockEventProof: phantomProof,
      racIdentity: ethers.keccak256(ethers.toUtf8Bytes("rac-phantom")),
    };

    await expect(s.verifier.connect(s.relayer).verifyAndMint(phantom)).to.be.reverted;
  });

  it("element 8 — records the gas cost of same-chain verification", async function () {
    const s = await deployStack();
    const { pkg } = await realLockAndPackage(s, "e2e-gas");

    await s.verifier.connect(s.relayer).recordFeeAndRac(pkg);
    const tx = await s.verifier.connect(s.relayer).verifyAndMint(pkg);
    const receipt = await tx.wait();

    console.log(`\n    Base verifyAndMint gas: ${receipt.gasUsed.toString()}\n`);
    // Section O requires gas feasibility to be established, not merely assumed.
    expect(receipt.gasUsed).to.be.lessThan(2_000_000n);
  });
});
