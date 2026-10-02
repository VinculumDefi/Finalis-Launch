// =============================================================================
// Avalanche C-Chain — lock on EvmVault; mint refused (no accepted C-Chain header)
//
// Architecture C.2: source vault is the shared VinculumFinalisEvmVault
// (createLock atomic; ERC-20 transferFrom). Base verification path requires an
// authenticated proof against an accepted Avalanche C-Chain header — DESIGN DEFINED —
// DEPLOYABILITY EVIDENCE REQUIRED. Until that header-auth mechanism exists on
// Base, EvmChainVerifier fails closed (VerifierNotImplemented).
//
// This suite proves the source lock seam and the refuse-closed mint path only.
// It does not implement C-Chain header authentication, does not accept a caller
// finality claim or a registry row.
// =============================================================================

const { expect } = require("chai");
const { ethers } = require("hardhat");

const ENV = "avalanche";
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
  const relayer = signers[5];
  const devFund = signers[8];
  const boundDestination = signers[4];

  const Token = await ethers.getContractFactory("VinculumFinalisToken");
  const vclm  = await Token.deploy("Vinculum", "VCLM", 10_000_000_000n * 10n**18n);
  const chonx = await Token.deploy("Chonx", "CHONX", 100_000_000_000n * 10n**18n);
  const synth = await Token.deploy("Synth", "SYNTH", 10_000_000n * 10n**18n);

  const launchTs = (await ethers.provider.getBlock("latest")).timestamp;
  const __cap = await (await ethers.getContractFactory("VinculumFinalisCap"))
    .deploy(10_000_000_000n * 10n ** 18n, 100_000_000_000n * 10n ** 18n);
  const V = await ethers.getContractFactory("VinculumFinalisVerifier");
  const verifier = await V.deploy(
    await vclm.getAddress(), await chonx.getAddress(), publisher.address, launchTs,
    await __cap.getAddress()
  );

  const Stake = await ethers.getContractFactory("VinculumFinalisStake");
  const stake = await Stake.deploy(
    await vclm.getAddress(), await chonx.getAddress(),
    await synth.getAddress(), await verifier.getAddress(), launchTs,
    await __cap.getAddress()
  );
  await __cap.initialize(await verifier.getAddress(), await stake.getAddress());

  await vclm.initialize(await verifier.getAddress(), await stake.getAddress());
  await chonx.initialize(await verifier.getAddress(), ZERO);
  await synth.initialize(await verifier.getAddress(), ZERO);

  const Mock = await ethers.getContractFactory("MockERC20");
  const token = await Mock.deploy("MockUSD", "MUSD", 18, 10n**30n);
  const AID = assetId("MUSD");

  // C.2 source vault — same VinculumFinalisEvmVault mechanism as Ethereum.
  const Vault = await ethers.getContractFactory("VinculumFinalisEvmVault");
  const vault = await Vault.deploy(ENV, devFund.address);
  await vault.registerAsset(await token.getAddress(), AID);
  await vault.finalizeConfiguration();

  // Fail-closed Base-side stub: no accepted Avalanche C-Chain header authenticated on Base.
  // Finality vocabulary "Snowman" / minConfirmations 1 retained as domain facts only.
  const Evm = await ethers.getContractFactory("EvmChainVerifier");
  const avalancheVerifier = await Evm.deploy(ENV, "Snowman", 1, 0);

  await verifier.registerAssetPrecision(ENV, AID, "MUSD", 18, 1, 1);
  await verifier.registerChainVerifier(ENV, await avalancheVerifier.getAddress());
  await verifier.registerHandshakeAllowance(ENV, 3);
  await verifier.configureDevFund(ENV, devFund.address.toLowerCase());
  await verifier.finalize();

  const ts = (await ethers.provider.getBlock("latest")).timestamp;
  const sig = await signBatch(verifier, publisher, 1n, [AID], [1_000_000n], ts);
  await verifier.submitPriceBatch(1n, [AID], [1_000_000n], ts, sig);

  await token.transfer(user.address, 10n**24n);
  await token.connect(user).approve(await vault.getAddress(), 10n**24n);

  return {
    deployer, user, relayer, devFund, publisher, boundDestination,
    verifier, vault, avalancheVerifier, token, vclm, AID,
  };
}

async function packageFromLock(s, vaultLockId, record, tag) {
  
  // Placeholder proofs: EvmChainVerifier reverts before decoding them.
  // A production path would supply a C-Chain receipt proof vs an accepted C-Chain header.
  const commitmentVaultLockId = ethers.solidityPackedKeccak256(
    ["string", "address", "bytes32"],
    [ENV, await s.vault.getAddress(), vaultLockId]
  );
  return {
    sourceEnvironmentId: ENV,
    commitmentVaultLockId,
    handshakeIdentity: `${ENV}:${s.user.address.toLowerCase()}`,
    handshakeAllowanceCount: record.handshakeAllowanceCount,
    canonicalAssetId: s.AID,
    assetPrecision: 18,
    assetCustodyClass: 1,
    grossAmountSmallestUnits: record.grossAmount,
    actualFeeAmountSmallestUnits: record.feeAmount,
    principalAmountSmallestUnits: record.principalAmount,
    feeAssetId: s.AID,
    devFundDestination: s.devFund.address.toLowerCase(),
    feeTransferEvidence: ethers.keccak256(ethers.toUtf8Bytes(`fee-${tag}`)),
    valuationTimestamp: Number(record.creationTime),
    maturityTimestamp: Number(record.maturityTime),
    durationSecs: record.durationSecs,
    selectedOutputToken: 0,
    baseRecipient: record.baseRecipient,
    releaseDestination: s.boundDestination.address.toLowerCase(),
    chonxActivationReceipt: "0x",
    racIdentity: ethers.keccak256(ethers.toUtf8Bytes(`rac-${tag}`)),
    sourceFinalityProof: "0x",
    lockEventProof: "0x",
  };
}

describe("Avalanche C-Chain — EvmVault lock; mint refused (no accepted C-Chain header)", function () {

  it("locks 100 tokens (5% dev fund / 95% principal) and refuses mint without accepted C-Chain header auth", async function () {
    const s = await deployStack();
    const gross = 100n * 10n**18n;
    const expectedFee = 5n * 10n**18n;       // STANDARD_FEE_BPS = 500
    const expectedPrincipal = 95n * 10n**18n;

    const vaultLockId = ethers.keccak256(ethers.toUtf8Bytes("avalanche-c-chain-lock-1"));
    const devBefore = await s.token.balanceOf(s.devFund.address);

    await s.vault.connect(s.user).createLock({
      lockId: vaultLockId,
      asset: await s.token.getAddress(),
      grossAmount: gross,
      durationSecs: 30n * DAY,
      baseRecipient: s.user.address,
      releaseDestination: s.boundDestination.address,
      outputToken: 0,
      chonxActivationReceipt: ethers.ZeroHash,
    });

    const record = await s.vault.getLock(vaultLockId);
    expect(record.feeAmount).to.equal(expectedFee);
    expect(record.principalAmount).to.equal(expectedPrincipal);
    expect(await s.token.balanceOf(s.devFund.address) - devBefore).to.equal(expectedFee);
    expect(await s.token.balanceOf(record.lockContract)).to.equal(expectedPrincipal);
    expect(await s.token.balanceOf(await s.vault.getAddress())).to.equal(0n);

    // Direct seam: no accepted C-Chain header authenticated → VerifierNotImplemented.
    await expect(s.avalancheVerifier.verifyFinality("0x", "0x"))
      .to.be.revertedWithCustomError(s.avalancheVerifier, "VerifierNotImplemented");
    await expect(s.avalancheVerifier.extractFacts("0x"))
      .to.be.revertedWithCustomError(s.avalancheVerifier, "VerifierNotImplemented");

    // Issuance path must refuse: EvmChainVerifier fails closed before any mint.
    const pkg = await packageFromLock(s, vaultLockId, record, "avalanche-c-chain-1");

    const before = await s.vclm.balanceOf(s.user.address);
    const basisBefore = await s.verifier.epochRewardBasis(1);

    await expect(s.verifier.connect(s.relayer).recordFeeAndRac(pkg)).to.be.reverted;
    expect(await s.verifier.epochRewardBasis(1),
      "refused Avalanche package must credit no RAC").to.equal(basisBefore);

    await expect(s.verifier.connect(s.relayer).verifyAndMint(pkg)).to.be.reverted;

    const minted = await s.vclm.balanceOf(s.user.address) - before;
    console.log(`\n    Avalanche C-Chain: locked 100; fee ${ethers.formatUnits(expectedFee, 18)}; ` +
      `principal ${ethers.formatUnits(expectedPrincipal, 18)}; minted ${ethers.formatUnits(minted, 18)} VCLM (must be 0)\n`);
    expect(minted).to.equal(0n);

    // Principal remains isolated in the lock; nothing was released by a mint path.
    expect(await s.token.balanceOf(record.lockContract)).to.equal(expectedPrincipal);
  });
});
