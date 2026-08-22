const { expect } = require("chai");
const { ethers } = require("hardhat");

// ---------------------------------------------------------------------------
// CL-06 / CL-07 — full staking lifecycle through the production path.
//
// Before CL-06, rewardBasis was never assigned, so allocateEpoch always took
// the zero-eligible branch and no staker could ever be paid. Every staking
// finding therefore sat at evidence level U. These tests execute the pipeline
// end to end: stake -> generate RAC credit -> closeEpoch -> allocateEpoch ->
// claim.
// ---------------------------------------------------------------------------

const ZERO = "0x0000000000000000000000000000000000000000";
const ENV = "MockChain";
const ASSET = ethers.keccak256(ethers.toUtf8Bytes("MockChain:MOCK"));
const DECIMALS = 18;
const PRICE_MICRO = 1_000_000n;
const DEVFUND = "devfund.mocksource.addr";
const EPOCH = 10 * 24 * 60 * 60;
const D120 = 120n * 86400n;

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

async function deployAll() {
  const signers = await ethers.getSigners();
  const [deployer, alice, bob] = signers;
  const publisher = signers[9];

  const Token = await ethers.getContractFactory("VinculumFinalisToken");
  const vclm = await Token.deploy("Vinculum", "VCLM", 10_000_000_000n * 10n ** 18n);
  const chonx = await Token.deploy("Chonx", "CHONX", 100_000_000_000n * 10n ** 18n);
  const synthTok = await Token.deploy("Synth", "SYNTH", 10_000_000n * 10n ** 18n);

  const launchTs = (await ethers.provider.getBlock("latest")).timestamp;
  const __cap = await (await ethers.getContractFactory("VinculumFinalisCap")).deploy(10_000_000_000n * 10n ** 18n, 100_000_000_000n * 10n ** 18n);
  const V = await ethers.getContractFactory("VinculumFinalisVerifier");
  const verifier = await V.deploy(
    await vclm.getAddress(), await chonx.getAddress(), publisher.address, launchTs, await __cap.getAddress());

  const Stake = await ethers.getContractFactory("VinculumFinalisStake");
  const stake = await Stake.deploy(
    await vclm.getAddress(), await chonx.getAddress(),
    await synthTok.getAddress(), await verifier.getAddress(), launchTs, await __cap.getAddress());
  await __cap.initialize(await verifier.getAddress(), await stake.getAddress());

  await vclm.initialize(await verifier.getAddress(), await stake.getAddress());
  await chonx.initialize(await verifier.getAddress(), ZERO);
  await synthTok.initialize(await verifier.getAddress(), ZERO);

  const Mock = await ethers.getContractFactory("MockChainVerifier");
  const mock = await Mock.deploy();
  await verifier.registerAssetPrecision(ENV, ASSET, "MOCK", DECIMALS, 1, 0);
  await verifier.registerChainVerifier(ENV, await mock.getAddress());
  await verifier.registerHandshakeAllowance(ENV, 3);
  await verifier.configureDevFund(ENV, DEVFUND);
  await verifier.finalize();

  return { deployer, alice, bob, publisher, vclm, chonx, synthTok, verifier, stake, mock, launchTs };
}

async function publishPrice(s, runId) {
  const ts = (await ethers.provider.getBlock("latest")).timestamp;
  const sig = await signBatch(s.verifier, s.publisher, runId, [ASSET], [PRICE_MICRO], ts);
  await s.verifier.submitPriceBatch(runId, [ASSET], [PRICE_MICRO], ts, sig);
}

// Generates a RAC credit by running a real lock through the verifier.
async function generateRac(s, tag, recipient) {
  const ts = (await ethers.provider.getBlock("latest")).timestamp;
  const gross = 10n ** 18n;
  const duration = 3600n;
  const fee = (gross * 250n) / 10000n;
  const principal = gross - fee;
  const lockId = ethers.keccak256(ethers.toUtf8Bytes("lock-" + tag));
  const proof = ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
    [lockId, gross, fee, principal, duration, ts, ts + Number(duration)]);
  const pkg = {
    sourceEnvironmentId: ENV, commitmentVaultLockId: lockId,
    handshakeIdentity: "MockChain:" + tag, handshakeAllowanceCount: 1,
    canonicalAssetId: ASSET, assetPrecision: DECIMALS, assetCustodyClass: 1,
    grossAmountSmallestUnits: gross, actualFeeAmountSmallestUnits: fee,
    principalAmountSmallestUnits: principal, feeAssetId: ASSET,
    devFundDestination: DEVFUND,
    feeTransferEvidence: ethers.keccak256(ethers.toUtf8Bytes("fee-" + tag)),
    valuationTimestamp: ts, maturityTimestamp: ts + Number(duration),
    durationSecs: duration, selectedOutputToken: 0, baseRecipient: recipient,
    releaseDestination: "mock1source", chonxActivationReceipt: "0x",
    racIdentity: lockId, sourceFinalityProof: "0x", lockEventProof: proof,
  };
  await s.verifier.recordFeeAndRac(pkg);
  await s.verifier.verifyAndMint(pkg);
  return pkg;
}

async function stakeFor(s, who, amount, token = 0) {
  // Tokens reach a staker only by being minted through the verifier.
  await generateRac(s, "fund-" + who.address.slice(2, 8), who.address);
  const tok = token === 0 ? s.vclm : s.chonx;
  await tok.connect(who).approve(await s.stake.getAddress(), amount);
  await s.stake.connect(who).createPosition(token, amount, D120);
}

async function advance(sec) {
  await ethers.provider.send("evm_increaseTime", [sec]);
  await ethers.provider.send("evm_mine", []);
}

describe("CL-06 · epoch reward basis is populated from RAC credits", function () {
  it("the verifier accumulates a running per-epoch reward basis", async function () {
    const s = await deployAll();
    await publishPrice(s, 1n);
    expect(await s.verifier.epochRewardBasis(1)).to.equal(0n);
    await generateRac(s, "a", s.alice.address);
    expect(await s.verifier.epochRewardBasis(1)).to.be.greaterThan(0n);
  });

  it("credits accumulate additively within one epoch", async function () {
    const s = await deployAll();
    await publishPrice(s, 1n);
    await generateRac(s, "a", s.alice.address);
    const afterOne = await s.verifier.epochRewardBasis(1);
    await generateRac(s, "b", s.alice.address);
    const afterTwo = await s.verifier.epochRewardBasis(1);
    expect(afterTwo).to.equal(afterOne * 2n);
  });

  it("closeEpoch reads the basis instead of leaving it zero", async function () {
    const s = await deployAll();
    await publishPrice(s, 1n);
    await stakeFor(s, s.alice, 10n ** 17n);
    await generateRac(s, "c", s.alice.address);
    const basis = await s.verifier.epochRewardBasis(1);

    await advance(EPOCH * 2 + 60);
    await s.stake.closeEpoch(1);
    const ep = await s.stake.epochs(1);
    expect(ep.rewardBasis).to.equal(basis);
    expect(ep.rewardBasis).to.be.greaterThan(0n);
  });

  it("an epoch with no credits has a zero basis and pays nothing", async function () {
    const s = await deployAll();
    await publishPrice(s, 1n);
    // Funding the staker creates a credit in epoch 1; epoch 2 gets none.
    await stakeFor(s, s.alice, 10n ** 17n);
    await advance(EPOCH * 3 + 60);
    await s.stake.closeEpoch(1);
    await s.stake.closeEpoch(2);
    await s.stake.allocateEpoch(2);
    const ep = await s.stake.epochs(2);
    expect(ep.rewardBasis).to.equal(0n);
    expect(ep.mintedVclm).to.equal(0n);
  });
});

describe("CL-07 · the Stake contract actually mints epoch rewards", function () {
  it("a staker is paid through closeEpoch, allocateEpoch and claim", async function () {
    const s = await deployAll();
    await publishPrice(s, 1n);
    // VF-STK-012: a position must exist at the START of an epoch to qualify.
    // Stake during epoch 1, so the position qualifies from epoch 2 onward.
    await stakeFor(s, s.alice, 10n ** 17n);
    await advance(EPOCH);                       // now inside epoch 2
    await publishPrice(s, 2n);                  // CL-37: prior price is now stale
    await generateRac(s, "pay", s.alice.address);   // credit lands in epoch 2

    await advance(EPOCH * 2 + 60);
    await s.stake.closeEpoch(1);
    await s.stake.closeEpoch(2);                // VF-STK-010 chronological
    await s.stake.allocateEpoch(2);

    const ep = await s.stake.epochs(2);
    expect(ep.mintedVclm).to.be.greaterThan(0n);

    const claimable = await s.stake.claimableVclm(s.alice.address);
    expect(claimable).to.be.greaterThan(0n);

    const before = await s.vclm.balanceOf(s.alice.address);
    await s.stake.connect(s.alice).claimVclm();
    const after = await s.vclm.balanceOf(s.alice.address);
    expect(after - before).to.equal(claimable);
  });

  it("VF-STK-004: the reward is newly minted VCLM, raising total supply", async function () {
    const s = await deployAll();
    await publishPrice(s, 1n);
    await stakeFor(s, s.alice, 10n ** 17n);
    await advance(EPOCH);
    await publishPrice(s, 2n);                  // CL-37: prior price is now stale
    await generateRac(s, "supply", s.alice.address);

    await advance(EPOCH * 2 + 60);
    await s.stake.closeEpoch(1);
    const supplyBefore = await s.vclm.totalSupply();
    await s.stake.closeEpoch(2);
    await s.stake.allocateEpoch(2);
    const supplyAfter = await s.vclm.totalSupply();
    expect(supplyAfter).to.be.greaterThan(supplyBefore);
  });

  it("VF-STK-015: an epoch with no stakers allocates nothing", async function () {
    const s = await deployAll();
    await publishPrice(s, 1n);
    await generateRac(s, "nostakers", s.alice.address);
    await advance(EPOCH * 2 + 60);
    await s.stake.closeEpoch(1);
    await s.stake.allocateEpoch(1);
    const ep = await s.stake.epochs(1);
    expect(ep.totalWeight).to.equal(0n);
    expect(ep.mintedVclm).to.equal(0n);
  });
});
