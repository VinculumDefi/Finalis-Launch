// ---------------------------------------------------------------------------
// CL-86 · Verification precedes the Reward-Accounting Credit
//
// CL-76, accounting path. recordFeeAndRac wrote epochRewardBasis with no chain
// verifier consulted, so a package describing a lock that did not exist
// credited the reward basis permanently. verifyAndMint refused to mint, but the
// credit had already been written in an earlier transaction and nothing
// revisited it.
//
// Rev 6 section 9: a Reward-Accounting Credit is created by a *successfully
// verified* Commitment Vault fee. VF-FEE-007 requires the proof to establish
// the fee and its transfer; VF-FEE-008 requires fee-routing and principal-lock
// evidence to refer to the same completed lock. Section 10.3 and VF-STK-013
// process rewards one epoch behind with eligibility fixed by scheduled
// timestamps, so rejecting an unverifiable submission costs a retry and
// nothing else.
//
// These four properties are what CL-86 must keep true.
// ---------------------------------------------------------------------------

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
  const __cap = await (await ethers.getContractFactory("VinculumFinalisCap")).deploy(10_000_000_000n * 10n ** 18n, 100_000_000_000n * 10n ** 18n);
  const V = await ethers.getContractFactory("VinculumFinalisVerifier");
  const verifier = await V.deploy(
    await vclm.getAddress(), await chonx.getAddress(), publisher.address, launchTs, await __cap.getAddress()
  );

  const Stake = await ethers.getContractFactory("VinculumFinalisStake");
  const stake = await Stake.deploy(
    await vclm.getAddress(), await chonx.getAddress(),
    await synth.getAddress(), await verifier.getAddress(), launchTs, await __cap.getAddress()
  );
  await __cap.initialize(await verifier.getAddress(), await stake.getAddress());

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


describe("CL-86 verification · required properties", function () {
  it("1 · a forged package creates no Reward-Accounting Credit", async function () {
    const s = await deployStack();
    const { pkg: real } = await realLockAndPackage(s, "honest");
    const phantom = ethers.keccak256(ethers.toUtf8Bytes("never-created"));
    const g = 100n * 10n ** 18n, f = (g * 500n) / 10000n;
    const pkg = { ...real, commitmentVaultLockId: phantom,
      grossAmountSmallestUnits: g, actualFeeAmountSmallestUnits: f,
      principalAmountSmallestUnits: g - f,
      racIdentity: ethers.keccak256(ethers.toUtf8Bytes("rac-phantom")),
      lockEventProof: ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32","uint256","uint256","uint256","uint256","uint256","uint256"],
        [phantom, g, f, g - f, real.durationSecs, real.valuationTimestamp, real.maturityTimestamp]) };
    const before = await s.verifier.epochRewardBasis(1);
    await expect(s.verifier.connect(s.relayer).recordFeeAndRac(pkg)).to.be.reverted;
    expect(await s.verifier.epochRewardBasis(1)).to.equal(before);
    console.log("      CL-76 reproduction: basis unchanged at", before.toString());
  });

  it("2 · a verified lock creates exactly one credit, and a duplicate is refused", async function () {
    const s = await deployStack();
    const { pkg } = await realLockAndPackage(s, "dup");
    const before = await s.verifier.epochRewardBasis(1);
    await s.verifier.connect(s.relayer).recordFeeAndRac(pkg);
    const after = await s.verifier.epochRewardBasis(1);
    await expect(s.verifier.connect(s.relayer).recordFeeAndRac(pkg)).to.be.reverted;
    expect(await s.verifier.epochRewardBasis(1)).to.equal(after);
    expect(after).to.be.greaterThan(before);
    console.log("      one credit written:", (after - before).toString(), "· duplicate refused");
  });

  it("3 · a legitimate verified lock still mints in full", async function () {
    const s = await deployStack();
    const { pkg } = await realLockAndPackage(s, "legit");
    await s.verifier.connect(s.relayer).recordFeeAndRac(pkg);
    await s.verifier.connect(s.relayer).verifyAndMint(pkg);
    const bal = await s.vclm.balanceOf(pkg.baseRecipient);
    expect(bal).to.be.greaterThan(0n);
    console.log("      minted to locker:", ethers.formatUnits(bal, 18), "VCLM");
  });

  it("4 · retry after finality succeeds, losing nothing", async function () {
    const s = await deployStack();
    const { pkg } = await realLockAndPackage(s, "retry");
    const bad = { ...pkg, valuationTimestamp: Number(pkg.valuationTimestamp) - 1 };
    await expect(s.verifier.connect(s.relayer).recordFeeAndRac(bad)).to.be.reverted;
    await s.verifier.connect(s.relayer).recordFeeAndRac(pkg);   // corrected resubmission
    await s.verifier.connect(s.relayer).verifyAndMint(pkg);
    expect(await s.vclm.balanceOf(pkg.baseRecipient)).to.be.greaterThan(0n);
    console.log("      rejected then resubmitted: full issuance received");
  });
});
