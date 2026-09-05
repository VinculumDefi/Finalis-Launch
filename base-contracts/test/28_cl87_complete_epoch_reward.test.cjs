// ---------------------------------------------------------------------------
// CL-87 · The complete Epoch Reward is minted; the remainder is stranded
//
// CL-16. allocateEpoch minted `distributed` — the rounded-down sum of position
// entitlements — rather than the complete Epoch Reward. The economic outcome
// was identical, since nobody receives the dust either way, but VF-STK-014
// requires the complete reward to be minted once, and VF-STK-027 describes a
// remainder that "remains inaccessible in the immutable Treasury Reward Stake
// contract", which presupposes it was minted and stayed there.
//
// Resolved as a protocol decision by the owner, 2026-09-03:
//
//   The protocol SHALL mint the complete Epoch Reward VCLM exactly once to the
//   immutable Treasury Reward Stake contract, as required by VF-STK-014.
//   Individual position entitlements SHALL be calculated by rounding down.
//   Any undistributable remainder SHALL remain permanently in the contract,
//   inaccessible, never reassigned, redirected, carried forward, or
//   distributed by any special mechanism.
//
// The dust is unreachable by construction, not by policy: claimableVclm totals
// `distributed`, and no code path reads the contract's residual balance.
//
// Against the pre-CL-87 contract this test reports mintedVclm equal to the sum
// of shares and dust of zero, and fails.
// ---------------------------------------------------------------------------

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
  // CL-85. Identity fields added; they match the package built below.
  const proof = ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256",
     "bytes32", "address", "address", "uint8"],
    [lockId, gross, fee, principal, duration, ts, ts + Number(duration),
     ASSET, recipient, ethers.ZeroAddress, 0]);
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


const D120X = 120 * 24 * 60 * 60;
const EP = 10 * 24 * 3600;

describe("CL-87 · the complete Epoch Reward is minted; the remainder is stranded", function () {
  it("mints totalReward, not the rounded-down sum, and leaves dust unreachable", async function () {
    const s = await deployAll();

    // Three positions at different durations. Shares round down, so the sum of
    // entitlements is strictly less than the complete reward.
    const vAddr = await s.verifier.getAddress();
    await ethers.provider.send("hardhat_impersonateAccount", [vAddr]);
    await ethers.provider.send("hardhat_setBalance", [vAddr, "0x8AC7230489E80000"]);
    const vs = await ethers.getSigner(vAddr);
    const each = 10n ** 16n + 7n;                 // deliberately awkward
    const holders = [s.deployer, s.alice, s.bob];
    for (const h of holders) await s.vclm.connect(vs).mint(h.address, each);
    await ethers.provider.send("hardhat_stopImpersonatingAccount", [vAddr]);
    // Unequal durations give unequal weights (1.4x / 1.75x / 2.0x), so the
    // reward does not divide exactly and every share rounds down.
    const durs = [60, 90, 120].map(d => d * 24 * 60 * 60);
    for (let i = 0; i < holders.length; i++) {
      await s.vclm.connect(holders[i]).approve(await s.stake.getAddress(), each);
      await s.stake.connect(holders[i]).createPosition(0, each, durs[i]);
    }

    await ethers.provider.send("evm_increaseTime", [EP + 60]);
    await ethers.provider.send("evm_mine", []);
    await publishPrice(s, 1n);
    await generateRac(s, "cl87", s.deployer.address);
    await ethers.provider.send("evm_increaseTime", [2 * EP + 120]);
    await ethers.provider.send("evm_mine", []);

    await s.stake.closeEpoch(1); await s.stake.allocateEpoch(1);
    await s.stake.closeEpoch(2); await s.stake.allocateEpoch(2);

    const ep = await s.stake.epochs(2);
    const claimed = (await s.stake.claimableVclm(s.deployer.address))
                  + (await s.stake.claimableVclm(s.alice.address))
                  + (await s.stake.claimableVclm(s.bob.address));
    const held = await s.vclm.balanceOf(await s.stake.getAddress());
    const dust = ep.mintedVclm - claimed;

    console.log("      minted (complete) :", ep.mintedVclm.toString());
    console.log("      sum of shares     :", claimed.toString());
    console.log("      stranded dust     :", dust.toString());
    console.log("      contract balance  :", held.toString());

    // VF-STK-014: the complete reward was minted, not the rounded sum.
    expect(ep.mintedVclm).to.be.greaterThan(claimed);
    // VF-STK-027: the remainder is present in the contract and unclaimable.
    expect(held).to.be.greaterThanOrEqual(ep.mintedVclm);
    expect(dust).to.be.greaterThan(0n);
  });
});
