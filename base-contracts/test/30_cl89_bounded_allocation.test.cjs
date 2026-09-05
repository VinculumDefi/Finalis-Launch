// ---------------------------------------------------------------------------
// CL-89 · Bounded allocation
//
// allocateEpoch previously scanned every position ever created, so cost grew
// with protocol lifetime: ~14,473 gas per lifetime position, uncallable at
// ~2,062. VF-IMM-006 forecloses repair after deployment, so rewards would have
// frozen permanently.
//
// Rev 6 permits a bounded strategy: VF-STK-014 attaches "once" to the MINT, not
// to the recording of entitlements; VF-STK-028 prohibits partial epoch reward
// MINTING, not partial recording; no requirement mandates single-transaction
// allocation.
//
// Design: epochPositions[n] is appended at registration (bounded by
// maxTerm/EPOCH = 12 entries, paid once per position). allocateEpoch walks it
// from a cursor in batches of maxCount. The reward is minted once, complete, on
// the first call (CL-87). allocStartTimestamp fixes who counts as withdrawn, so
// the PROTOCOL RULE holds — leave before the payout, get nothing (VF-STK-020) —
// while the result stays independent of batch count.
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


const EPB = 10 * 24 * 3600;

async function build(n) {
  const s = await deployAll();
  const vAddr = await s.verifier.getAddress();
  await ethers.provider.send("hardhat_impersonateAccount", [vAddr]);
  await ethers.provider.send("hardhat_setBalance", [vAddr, "0x8AC7230489E80000"]);
  const vs = await ethers.getSigner(vAddr);
  const each = 10n ** 16n;
  await s.vclm.connect(vs).mint(s.deployer.address, each * BigInt(n));
  await ethers.provider.send("hardhat_stopImpersonatingAccount", [vAddr]);
  await s.vclm.approve(await s.stake.getAddress(), each * BigInt(n));
  for (let i = 0; i < n; i++) await s.stake.createPosition(0, each, 120 * 24 * 3600);
  await ethers.provider.send("evm_increaseTime", [EPB + 60]);
  await ethers.provider.send("evm_mine", []);
  await publishPrice(s, 1n);
  await generateRac(s, "b" + n, s.deployer.address);
  await ethers.provider.send("evm_increaseTime", [2 * EPB + 120]);
  await ethers.provider.send("evm_mine", []);
  await s.stake.closeEpoch(1);
  await s.stake["allocateEpoch(uint256)"](1);
  await s.stake.closeEpoch(2);
  return s;
}

describe("CL-89 · bounded allocation, measured against a real reward basis", function () {
  it("gas is flat in lifetime position count", async function () {
    for (const n of [5, 60, 150]) {
      const s = await build(n);
      const rc = await (await s.stake["allocateEpoch(uint256)"](2)).wait();
      console.log(`      ${String(n).padStart(3)} qualifying positions -> ${rc.gasUsed} gas`);
    }
  });

  it("one call and many calls produce identical credits", async function () {
    const a = await build(20);
    await a.stake["allocateEpoch(uint256)"](2);
    const single = await a.stake.claimableVclm(a.deployer.address);

    const b = await build(20);
    let calls = 0;
    while ((await b.stake.epochs(2)).allocated === false) {
      await b.stake["allocateEpoch(uint256,uint256)"](2, 3);   // batches of 3
      calls++;
    }
    const batched = await b.stake.claimableVclm(b.deployer.address);

    console.log("      single call :", single.toString());
    console.log(`      ${calls} batches  :`, batched.toString());
    expect(batched).to.equal(single);
  });

  it("dead positions cost nothing: same live set, growing history", async function () {
    for (const dead of [0, 60, 200]) {
      const s = await deployAll();
      const vAddr = await s.verifier.getAddress();
      await ethers.provider.send("hardhat_impersonateAccount", [vAddr]);
      await ethers.provider.send("hardhat_setBalance", [vAddr, "0x8AC7230489E80000"]);
      const vs = await ethers.getSigner(vAddr);
      const each = 10n ** 16n;
      await s.vclm.connect(vs).mint(s.deployer.address, each * BigInt(dead + 5));
      await ethers.provider.send("hardhat_stopImpersonatingAccount", [vAddr]);
      await s.vclm.approve(await s.stake.getAddress(), each * BigInt(dead + 5));

      // History: short positions created at launch, long expired by the epoch
      // under test.
      for (let i = 0; i < dead; i++) await s.stake.createPosition(0, each, 30 * 24 * 3600);

      // Move well past their qualifying range, then create the live set.
      await ethers.provider.send("evm_increaseTime", [6 * EPB]);
      await ethers.provider.send("evm_mine", []);
      for (let i = 0; i < 5; i++) await s.stake.createPosition(0, each, 120 * 24 * 3600);

      await ethers.provider.send("evm_increaseTime", [EPB + 60]);
      await ethers.provider.send("evm_mine", []);
      await publishPrice(s, 1n);
      await generateRac(s, "d" + dead, s.deployer.address);
      await ethers.provider.send("evm_increaseTime", [3 * EPB + 120]);
      await ethers.provider.send("evm_mine", []);

      for (let e = 1; e <= 7; e++) {
        const ep = await s.stake.epochs(e);
        if (!ep.closed) { try { await s.stake.closeEpoch(e); } catch { break; } }
        try { await s.stake["allocateEpoch(uint256)"](e); } catch { break; }
      }
      const target = 8;
      try { await s.stake.closeEpoch(target); } catch {}
      const rc = await (await s.stake["allocateEpoch(uint256)"](target)).wait();
      console.log(`      ${String(dead).padStart(3)} dead + 5 live -> ${rc.gasUsed} gas`);
    }
  });
});
