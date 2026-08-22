// =============================================================================
// Issuance pipeline integration — NOT VERIFIER COMPLETION EVIDENCE
//
// PURPOSE
//   Tests that the issuance system behaves correctly GIVEN valid facts: fee
//   routing, RAC recording, epoch accounting, supply caps, handshake
//   allowance, precision handling.
//
// THIS SUITE USES MockChainVerifier DELIBERATELY.
//   The issuance pipeline should be testable without a working verifier.
//   Coupling every issuance test to a vault and a verifier would make
//   failures harder to localise and would test two subsystems at once.
//
// IT IS NOT COMPLETION EVIDENCE FOR ANY VERIFIER.
//   Verifier Completion Standard 4.4 prohibits mock substitution in
//   completion evidence. Nothing in this file may be cited as evidence that
//   a production verifier authenticates anything. It cannot: the verifier
//   here is a mock and the finality proof supplied is empty bytes.
//
//   Production-verifier evidence lives in:
//     12_base_verifier.test.cjs   BaseSameChainVerifier
//     13_base_e2e.test.cjs        genuine lock through to issuance
//     15_utxo_verifier.test.cjs   UtxoChainVerifier
//     18_ethereum_verifier.test.cjs / 19_opstack / 20_polygon / 21_arbitrum
//
// Recorded under CL-77.
// =============================================================================

const { expect } = require("chai");
const { ethers } = require("hardhat");

const ZERO = "0x0000000000000000000000000000000000000000";
const ENV = "MockChain";
const ASSET = ethers.keccak256(ethers.toUtf8Bytes("MockChain:MOCK"));
const DECIMALS = 18;
const PRICE_MICRO = 1_000_000n;          // $1.00 per whole unit
const HANDSHAKE_SECS = 3600n;
const DEVFUND = "devfund.mocksource.addr";

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

// Full system with a mock source chain, configured and finalized.
async function deployConfigured(allowance = 3) {
  const signers = await ethers.getSigners();
  const [deployer] = signers;
  const publisher = signers[9];

  const Token = await ethers.getContractFactory("VinculumFinalisToken");
  const vclm = await Token.deploy("Vinculum", "VCLM", 10_000_000_000n * 10n ** 18n);
  const chonx = await Token.deploy("Chonx", "CHONX", 100_000_000_000n * 10n ** 18n);
  const synthTok = await Token.deploy("Synth", "SYNTH", 10_000_000n * 10n ** 18n);

  const launchTs = (await ethers.provider.getBlock("latest")).timestamp;
  const __cap = await (await ethers.getContractFactory("VinculumFinalisCap")).deploy(10_000_000_000n * 10n ** 18n, 100_000_000_000n * 10n ** 18n);
  const V = await ethers.getContractFactory("VinculumFinalisVerifier");
  const verifier = await V.deploy(
    await vclm.getAddress(), await chonx.getAddress(), publisher.address, launchTs, await __cap.getAddress()
  );

  const Stake = await ethers.getContractFactory("VinculumFinalisStake");
  const stake = await Stake.deploy(
    await vclm.getAddress(), await chonx.getAddress(),
    await synthTok.getAddress(), await verifier.getAddress(), launchTs, await __cap.getAddress()
  );
  await __cap.initialize(await verifier.getAddress(), await stake.getAddress());

  await vclm.initialize(await verifier.getAddress(), await stake.getAddress());
  await chonx.initialize(await verifier.getAddress(), ZERO);
  await synthTok.initialize(await verifier.getAddress(), ZERO);

  const Mock = await ethers.getContractFactory("MockChainVerifier");
  const mock = await Mock.deploy();

  // Deployment ceremony
  await verifier.registerAssetPrecision(ENV, ASSET, "MOCK", DECIMALS, 1, 0);
  await verifier.registerChainVerifier(ENV, await mock.getAddress());
  await verifier.registerHandshakeAllowance(ENV, allowance);
  await verifier.configureDevFund(ENV, DEVFUND);
  await verifier.finalize();

  // Publish a price
  const ts = (await ethers.provider.getBlock("latest")).timestamp;
  const sig = await signBatch(verifier, publisher, 1n, [ASSET], [PRICE_MICRO], ts);
  await verifier.submitPriceBatch(1n, [ASSET], [PRICE_MICRO], ts, sig);

  return { deployer, publisher, vclm, chonx, verifier, stake, mock, launchTs };
}

// Builds a package whose facts match the encoded proof exactly.
function buildPackage(o) {
  const gross = o.gross ?? 10n ** 18n;              // 1 whole unit = $1.00
  const duration = o.duration ?? HANDSHAKE_SECS;
  const bps = duration === HANDSHAKE_SECS ? 250n : 500n;
  const fee = (gross * bps) / 10000n;
  const principal = gross - fee;
  const lockId = o.lockId ?? ethers.keccak256(ethers.toUtf8Bytes("lock-1"));
  const valuationTs = o.valuationTs;

  const proof = ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
    [lockId, gross, fee, principal, duration, valuationTs, valuationTs + Number(duration)]
  );

  return {
    sourceEnvironmentId: ENV,
    commitmentVaultLockId: lockId,
    handshakeIdentity: o.identity ?? "MockChain:alice",
    handshakeAllowanceCount: o.claimedAllowance ?? 99,   // deliberately absurd
    canonicalAssetId: ASSET,
    assetPrecision: DECIMALS,
    assetCustodyClass: 1,
    grossAmountSmallestUnits: gross,
    actualFeeAmountSmallestUnits: fee,
    principalAmountSmallestUnits: principal,
    feeAssetId: ASSET,
    devFundDestination: o.devFund ?? DEVFUND,
    feeTransferEvidence: ethers.keccak256(ethers.toUtf8Bytes("feetx")),
    valuationTimestamp: valuationTs,
    maturityTimestamp: valuationTs + Number(duration),
    durationSecs: duration,
    selectedOutputToken: 0,
    baseRecipient: o.recipient,
    releaseDestination: "mock1source",
    chonxActivationReceipt: "0x",
    racIdentity: o.racIdentity ?? lockId,
    sourceFinalityProof: "0x",
    lockEventProof: proof,
  };
}

describe("End-to-end · full verification pipeline via MockChainVerifier", function () {
  it("a valid handshake mints VCLM", async function () {
    const s = await deployConfigured(3);
    const ts = (await ethers.provider.getBlock("latest")).timestamp;
    const pkg = buildPackage({ valuationTs: ts, recipient: s.deployer.address });
    await s.verifier.recordFeeAndRac(pkg);
    await s.verifier.verifyAndMint(pkg);
    expect(await s.vclm.balanceOf(s.deployer.address)).to.be.greaterThan(0n);
  });

  it("CL-01: issuance is impossible without a published price", async function () {
    const s = await deployConfigured(3);
    const ts = (await ethers.provider.getBlock("latest")).timestamp;
    const other = ethers.keccak256(ethers.toUtf8Bytes("MockChain:UNPRICED"));
    const pkg = buildPackage({ valuationTs: ts, recipient: s.deployer.address });
    pkg.canonicalAssetId = other;
    await expect(s.verifier.recordFeeAndRac(pkg))
      .to.be.revertedWith("VF-ORC-005: no usable valuation for asset");
  });

  it("CL-37: issuance fails closed once the price is stale", async function () {
    const s = await deployConfigured(3);
    await ethers.provider.send("evm_increaseTime", [48 * 3600 + 60]);
    await ethers.provider.send("evm_mine", []);
    const ts = (await ethers.provider.getBlock("latest")).timestamp;
    const pkg = buildPackage({ valuationTs: ts, recipient: s.deployer.address });
    await expect(s.verifier.recordFeeAndRac(pkg))
      .to.be.revertedWith("CL-37: price record stale");
  });

  it("VF-XCH-011: a package contradicting the source facts is rejected", async function () {
    const s = await deployConfigured(3);
    const ts = (await ethers.provider.getBlock("latest")).timestamp;
    const pkg = buildPackage({ valuationTs: ts, recipient: s.deployer.address });
    await s.verifier.recordFeeAndRac(pkg);
    pkg.grossAmountSmallestUnits = pkg.grossAmountSmallestUnits + 1n; // lie about amount
    await expect(s.verifier.verifyAndMint(pkg)).to.be.reverted;
  });

  it("VF-XCH-006: an unfinalized source event is rejected", async function () {
    const s = await deployConfigured(3);
    await s.mock.setFinality(false);
    const ts = (await ethers.provider.getBlock("latest")).timestamp;
    const pkg = buildPackage({ valuationTs: ts, recipient: s.deployer.address });
    await s.verifier.recordFeeAndRac(pkg);
    await expect(s.verifier.verifyAndMint(pkg)).to.be.reverted;
  });
});

describe("CL-11 · handshake allowance consumption, end to end", function () {
  async function doHandshake(s, n, identity) {
    const ts = (await ethers.provider.getBlock("latest")).timestamp;
    const pkg = buildPackage({
      valuationTs: ts,
      recipient: s.deployer.address,
      identity,
      lockId: ethers.keccak256(ethers.toUtf8Bytes("lock-" + identity + "-" + n)),
    });
    await s.verifier.recordFeeAndRac(pkg);
    return s.verifier.verifyAndMint(pkg);
  }

  it("VF-COM-007: a three-use mechanism permits exactly three, rejects the fourth", async function () {
    const s = await deployConfigured(3);
    await doHandshake(s, 1, "alice");
    await doHandshake(s, 2, "alice");
    await doHandshake(s, 3, "alice");
    await expect(doHandshake(s, 4, "alice"))
      .to.be.revertedWith("VF-COM-007: handshake allowance exhausted");
  });

  it("VF-COM-007: a one-use mechanism permits exactly one, rejects the second", async function () {
    const s = await deployConfigured(1);
    await doHandshake(s, 1, "bob");
    await expect(doHandshake(s, 2, "bob"))
      .to.be.revertedWith("VF-COM-007: handshake allowance exhausted");
  });

  it("allowance is per identity, not global", async function () {
    const s = await deployConfigured(1);
    await doHandshake(s, 1, "carol");
    await doHandshake(s, 1, "dave");   // different identity, still allowed
    await expect(doHandshake(s, 2, "carol"))
      .to.be.revertedWith("VF-COM-007: handshake allowance exhausted");
  });

  it("CL-11: the caller's asserted allowance count is ignored entirely", async function () {
    const s = await deployConfigured(1);
    const ts = (await ethers.provider.getBlock("latest")).timestamp;
    // Claim an allowance of 99 — the registry says 1.
    const pkg1 = buildPackage({
      valuationTs: ts, recipient: s.deployer.address,
      identity: "mallory", claimedAllowance: 99,
      lockId: ethers.keccak256(ethers.toUtf8Bytes("m1")),
    });
    await s.verifier.recordFeeAndRac(pkg1);
    await s.verifier.verifyAndMint(pkg1);

    const pkg2 = buildPackage({
      valuationTs: ts, recipient: s.deployer.address,
      identity: "mallory", claimedAllowance: 99,
      lockId: ethers.keccak256(ethers.toUtf8Bytes("m2")),
    });
    await s.verifier.recordFeeAndRac(pkg2);
    await expect(s.verifier.verifyAndMint(pkg2))
      .to.be.revertedWith("VF-COM-007: handshake allowance exhausted");
  });

  it("VF-COM-008: a rejected attempt consumes no allowance", async function () {
    const s = await deployConfigured(3);
    await doHandshake(s, 1, "erin");
    // An attempt that fails late (unfinalized source) must not consume.
    await s.mock.setFinality(false);
    const ts = (await ethers.provider.getBlock("latest")).timestamp;
    const bad = buildPackage({
      valuationTs: ts, recipient: s.deployer.address, identity: "erin",
      lockId: ethers.keccak256(ethers.toUtf8Bytes("erin-bad")),
    });
    await s.verifier.recordFeeAndRac(bad);
    await expect(s.verifier.verifyAndMint(bad)).to.be.reverted;
    // Two successes must still remain.
    await s.mock.setFinality(true);
    await doHandshake(s, 2, "erin");
    await doHandshake(s, 3, "erin");
    await expect(doHandshake(s, 4, "erin"))
      .to.be.revertedWith("VF-COM-007: handshake allowance exhausted");
  });
});

// ---------------------------------------------------------------------------
// CL-12 — Dev Fund enforcement (was a commented-out require).
// Revision 7 scope: destination matching (VF-FEE-006). Cryptographic proof of
// the source-chain transfer (VF-FEE-007) is deliberately deferred to CL-27.
// ---------------------------------------------------------------------------
describe("CL-12 · Dev Fund destination enforcement", function () {
  it("VF-FEE-006: a substituted destination is rejected", async function () {
    const s = await deployConfigured(3);
    const ts = (await ethers.provider.getBlock("latest")).timestamp;
    const pkg = buildPackage({
      valuationTs: ts,
      recipient: s.deployer.address,
      devFund: "attacker.own.address",
    });
    await s.verifier.recordFeeAndRac(pkg);
    await expect(s.verifier.verifyAndMint(pkg))
      .to.be.revertedWith("VF-FEE-006: dev fund destination substituted");
  });

  it("the registered destination is accepted", async function () {
    const s = await deployConfigured(3);
    const ts = (await ethers.provider.getBlock("latest")).timestamp;
    const pkg = buildPackage({ valuationTs: ts, recipient: s.deployer.address });
    await s.verifier.recordFeeAndRac(pkg);
    await s.verifier.verifyAndMint(pkg);
    expect(await s.vclm.balanceOf(s.deployer.address)).to.be.greaterThan(0n);
  });

  it("an empty destination is rejected even if the registry were empty", async function () {
    const s = await deployConfigured(3);
    const ts = (await ethers.provider.getBlock("latest")).timestamp;
    const pkg = buildPackage({ valuationTs: ts, recipient: s.deployer.address, devFund: "" });
    await s.verifier.recordFeeAndRac(pkg);
    await expect(s.verifier.verifyAndMint(pkg))
      .to.be.revertedWith("VF-FEE-006: dev fund destination substituted");
  });

  it("VF-FEE-008: missing fee transfer evidence is rejected", async function () {
    const s = await deployConfigured(3);
    const ts = (await ethers.provider.getBlock("latest")).timestamp;
    const pkg = buildPackage({ valuationTs: ts, recipient: s.deployer.address });
    pkg.feeTransferEvidence = ethers.ZeroHash;
    await s.verifier.recordFeeAndRac(pkg);
    await expect(s.verifier.verifyAndMint(pkg))
      .to.be.revertedWith("VF-FEE-008: missing fee transfer evidence");
  });

  it("VF-FEE-009: an unconfigured environment cannot issue", async function () {
    // A verifier finalized without configureDevFund for this environment.
    const signers = await ethers.getSigners();
    const [deployer] = signers;
    const publisher = signers[9];
    const Token = await ethers.getContractFactory("VinculumFinalisToken");
    const vclm = await Token.deploy("V", "V", 10n ** 30n);
    const chonx = await Token.deploy("C", "C", 10n ** 30n);
    const launchTs = (await ethers.provider.getBlock("latest")).timestamp;
    const __cap = await (await ethers.getContractFactory("VinculumFinalisCap")).deploy(10_000_000_000n * 10n ** 18n, 100_000_000_000n * 10n ** 18n);
    const V = await ethers.getContractFactory("VinculumFinalisVerifier");
    const v = await V.deploy(
      await vclm.getAddress(), await chonx.getAddress(), publisher.address, launchTs, await __cap.getAddress()
    );
    const Mock = await ethers.getContractFactory("MockChainVerifier");
    const mock = await Mock.deploy();
    await v.registerAssetPrecision(ENV, ASSET, "MOCK", DECIMALS, 1, 0);
    await v.registerChainVerifier(ENV, await mock.getAddress());
    await v.registerHandshakeAllowance(ENV, 3);
    // configureDevFund deliberately omitted
    await v.finalize();

    const ts = (await ethers.provider.getBlock("latest")).timestamp;
    const sig = await signBatch(v, publisher, 1n, [ASSET], [PRICE_MICRO], ts);
    await v.submitPriceBatch(1n, [ASSET], [PRICE_MICRO], ts, sig);

    const pkg = buildPackage({ valuationTs: ts, recipient: deployer.address });
    await v.recordFeeAndRac(pkg);
    await expect(v.verifyAndMint(pkg))
      .to.be.revertedWith("VF-FEE-009: dev fund not configured");
  });

  it("VF-FEE-009: an empty destination cannot be registered at all", async function () {
    const signers = await ethers.getSigners();
    const Token = await ethers.getContractFactory("VinculumFinalisToken");
    const V = await ethers.getContractFactory("VinculumFinalisVerifier");
    const a = await Token.deploy("A", "A", 10n ** 30n);
    const b = await Token.deploy("B", "B", 10n ** 30n);
    const ts = (await ethers.provider.getBlock("latest")).timestamp;
    const __cap = await (await ethers.getContractFactory("VinculumFinalisCap")).deploy(10_000_000_000n * 10n ** 18n, 100_000_000_000n * 10n ** 18n);
    const v = await V.deploy(await a.getAddress(), await b.getAddress(), signers[9].address, ts, await __cap.getAddress());
    await expect(v.configureDevFund(ENV, ""))
      .to.be.revertedWith("VF-FEE-009: empty dev fund destination");
  });
});
