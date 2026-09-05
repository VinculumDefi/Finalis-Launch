// ---------------------------------------------------------------------------
// PROTOCOL RULE · Leave before the payout, get nothing — INTENTIONAL
//
// A participant who withdraws before an epoch's rewards have been ALLOCATED
// forfeits that epoch's reward. This is the protocol's rule. It is not a defect
// and must not be "fixed".
//
// SPECIFICATION BASIS — VF-STK-020: "Withdrawal of matured staked tokens does
// not erase accumulated claimable VCLM." The specification protects ACCUMULATED
// claimable VCLM — rewards already credited by a completed allocation. It
// extends no protection to an entitlement that has not yet been allocated.
// Withdrawing before the payout therefore forfeits it. VF-STK-013 makes an
// entitlement "fixed and allocatable" after the scheduled end of N+1; allocatable
// is not the same as accumulated.
//
// Mechanism: closeEpoch freezes ep.totalWeight including the position
// (VF-STK-026). withdrawPosition cancels weight only from the first epoch not
// yet closed. allocateEpoch skips withdrawn positions, so the share is credited
// to nobody and joins the stranded remainder (VF-STK-027, CL-87). Denominator
// unchanged, numerator forfeited — deliberate.
//
// WHY THIS FILE EXISTS. A reviewer read a misleading comment in
// withdrawPosition, escalated intended behaviour to a specification violation,
// was corrected, then re-opened the same question a second time and briefly
// changed the contract to pay the withdrawer. Both errors came from arguing
// about intent instead of citing VF-STK-020. This file and that citation close
// the question permanently.
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


const EP29 = 10 * 24 * 3600;

describe("PROTOCOL RULE · leave before the payout, get nothing", function () {
  async function seed(s) {
    const vAddr = await s.verifier.getAddress();
    await ethers.provider.send("hardhat_impersonateAccount", [vAddr]);
    await ethers.provider.send("hardhat_setBalance", [vAddr, "0x8AC7230489E80000"]);
    const vs = await ethers.getSigner(vAddr);
    const amt = 10n ** 16n;
    for (const h of [s.alice, s.bob]) await s.vclm.connect(vs).mint(h.address, amt);
    await ethers.provider.send("hardhat_stopImpersonatingAccount", [vAddr]);
    const ids = [];
    for (const h of [s.alice, s.bob]) {
      await s.vclm.connect(h).approve(await s.stake.getAddress(), amt);
      const tx = await s.stake.connect(h).createPosition(0, amt, 30 * 24 * 3600);
      const rc = await tx.wait();
      ids.push(ids.length);
    }
    return ids;
  }

  it("withdrawing before allocation forfeits that epoch (VF-STK-020)", async function () {
    const s = await deployAll();
    await seed(s);
    await ethers.provider.send("evm_increaseTime", [EP29 + 60]);
    await ethers.provider.send("evm_mine", []);
    await publishPrice(s, 1n);
    await generateRac(s, "forfeit", s.deployer.address);
    // Past the scheduled end of epoch 3 (so epoch 2 is closable) and past the
    // position's 30-day maturity (so withdrawal is permitted at all).
    await ethers.provider.send("evm_increaseTime", [2 * EP29 + 3600]);
    await ethers.provider.send("evm_mine", []);

    await s.stake.closeEpoch(1); await s.stake.allocateEpoch(1);
    await s.stake.closeEpoch(2);          // epoch 2 closed, weight frozen

    // Alice withdraws in the gap between close and allocation.
    await s.stake.connect(s.alice).withdrawPosition(0);
    await s.stake.allocateEpoch(2);

    const alice = await s.stake.claimableVclm(s.alice.address);
    const bob   = await s.stake.claimableVclm(s.bob.address);
    console.log("      alice (withdrew before payout):", alice.toString());
    console.log("      bob   (stayed):                ", bob.toString());

    expect(alice, "VF-STK-020 protects only ACCUMULATED VCLM — alice forfeits").to.equal(0n);
    expect(bob, "bob stayed and is paid").to.be.greaterThan(0n);
  });

  it("VF-STK-020: withdrawal never erases VCLM already credited", async function () {
    const s = await deployAll();
    await seed(s);
    await ethers.provider.send("evm_increaseTime", [EP29 + 60]);
    await ethers.provider.send("evm_mine", []);
    await publishPrice(s, 1n);
    await generateRac(s, "keep", s.deployer.address);
    await ethers.provider.send("evm_increaseTime", [2 * EP29 + 3600]);
    await ethers.provider.send("evm_mine", []);

    await s.stake.closeEpoch(1); await s.stake.allocateEpoch(1);
    await s.stake.closeEpoch(2); await s.stake.allocateEpoch(2);   // credited first

    const before = await s.stake.claimableVclm(s.alice.address);
    await s.stake.connect(s.alice).withdrawPosition(0);
    const after = await s.stake.claimableVclm(s.alice.address);

    console.log("      credited before withdrawal:", before.toString());
    console.log("      credited after  withdrawal:", after.toString());
    expect(before).to.be.greaterThan(0n);
    expect(after, "VF-STK-020: already-credited VCLM survives withdrawal").to.equal(before);
  });
});
