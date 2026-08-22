const { expect } = require("chai");
const { ethers } = require("hardhat");
const ZERO = "0x0000000000000000000000000000000000000000";
const ENV = "MockChain";
const ASSET = ethers.keccak256(ethers.toUtf8Bytes("MockChain:MOCK"));
const DEVFUND = "devfund.mocksource.addr";

async function signBatch(v, s, runId, ids, prices, ts) {
  const net = await ethers.provider.getNetwork();
  const d = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256","address","uint64","bytes32","bytes32","uint64"],
    [net.chainId, await v.getAddress(), runId,
     ethers.solidityPackedKeccak256(["bytes32[]"],[ids]),
     ethers.solidityPackedKeccak256(["uint256[]"],[prices]), ts]));
  return await s.signMessage(ethers.getBytes(d));
}

describe("CL-41 PROOF OF EXPLOIT · unvalidated assetPrecision in recordFeeAndRac", function () {
  it("a caller can inflate the epoch reward basis by understating decimals", async function () {
    const sg = await ethers.getSigners();
    const [deployer] = sg; const pub = sg[9];
    const T = await ethers.getContractFactory("VinculumFinalisToken");
    const vclm = await T.deploy("V","V",10n**30n);
    const chonx = await T.deploy("C","C",10n**30n);
    const launchTs = (await ethers.provider.getBlock("latest")).timestamp;
    const V = await ethers.getContractFactory("VinculumFinalisVerifier");
    const __cap = await (await ethers.getContractFactory("VinculumFinalisCap")).deploy(10_000_000_000n * 10n ** 18n, 100_000_000_000n * 10n ** 18n);
    const v = await V.deploy(await vclm.getAddress(), await chonx.getAddress(), pub.address, launchTs, await __cap.getAddress());
    const M = await ethers.getContractFactory("MockChainVerifier");
    const mock = await M.deploy();
    await v.registerAssetPrecision(ENV, ASSET, "MOCK", 18, 1, 0);   // TRUE decimals = 18
    await v.registerChainVerifier(ENV, await mock.getAddress());
    await v.registerHandshakeAllowance(ENV, 3);
    await v.configureDevFund(ENV, DEVFUND);
    await v.finalize();
    const ts = (await ethers.provider.getBlock("latest")).timestamp;
    await v.submitPriceBatch(1n,[ASSET],[1_000_000n],ts, await signBatch(v,pub,1n,[ASSET],[1_000_000n],ts));

    function pkg(precision, tag) {
      const gross = 20n * 10n**18n;               // 20 tokens = $20, a standard lock
      const duration = 30n * 86400n;
      const fee = (gross * 500n)/10000n;
      const principal = gross - fee;
      const lockId = ethers.keccak256(ethers.toUtf8Bytes(tag));
      const proof = ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32","uint256","uint256","uint256","uint256","uint256","uint256"],
        [lockId, gross, fee, principal, duration, ts, ts + Number(duration)]);
      return { sourceEnvironmentId: ENV, commitmentVaultLockId: lockId,
        handshakeIdentity: "MockChain:"+tag, handshakeAllowanceCount: 1,
        canonicalAssetId: ASSET, assetPrecision: precision, assetCustodyClass: 1,
        grossAmountSmallestUnits: gross, actualFeeAmountSmallestUnits: fee,
        principalAmountSmallestUnits: principal, feeAssetId: ASSET,
        devFundDestination: DEVFUND,
        feeTransferEvidence: ethers.keccak256(ethers.toUtf8Bytes("f"+tag)),
        valuationTimestamp: ts, maturityTimestamp: ts + Number(duration),
        durationSecs: duration, selectedOutputToken: 0, baseRecipient: deployer.address,
        releaseDestination: "src", chonxActivationReceipt: "0x",
        racIdentity: lockId, sourceFinalityProof: "0x", lockEventProof: proof };
    }

    // Honest: declares the true precision of 18.
    await v.recordFeeAndRac(pkg(18, "honest"));
    const honest = await v.epochRewardBasis(1);

    // Attack: declares 12 instead of 18. Same tokens, same price, same everything.
    await v.recordFeeAndRac(pkg(12, "attack"));
    const total = await v.epochRewardBasis(1);
    const attack = total - honest;

    console.log(`        honest credit: ${honest}`);
    console.log(`        attack credit: ${attack}`);
    console.log(`        inflation:     ${attack / (honest === 0n ? 1n : honest)}x`);

    // If precision were validated, the attack credit would equal the honest one.
    expect(attack).to.equal(honest, "attacker obtained a larger credit than an honest caller");
  });
});

// CL-41 — INERTNESS. Proving one exploit stopped is weaker than proving the
// field cannot matter. Every declared precision must yield the identical credit.
describe("CL-41 · pkg.assetPrecision is economically inert", function () {
  it("credit is identical across 0, 6, 12, 18 and 255 declared precision", async function () {
    const sg = await ethers.getSigners();
    const [deployer] = sg; const pub = sg[9];
    const T = await ethers.getContractFactory("VinculumFinalisToken");
    const vclm = await T.deploy("V","V",10n**30n);
    const chonx = await T.deploy("C","C",10n**30n);
    const launchTs = (await ethers.provider.getBlock("latest")).timestamp;
    const V = await ethers.getContractFactory("VinculumFinalisVerifier");
    const __cap = await (await ethers.getContractFactory("VinculumFinalisCap")).deploy(10_000_000_000n * 10n ** 18n, 100_000_000_000n * 10n ** 18n);
    const v = await V.deploy(await vclm.getAddress(), await chonx.getAddress(), pub.address, launchTs, await __cap.getAddress());
    const M = await ethers.getContractFactory("MockChainVerifier");
    const mock = await M.deploy();
    await v.registerAssetPrecision(ENV, ASSET, "MOCK", 18, 1, 0);
    await v.registerChainVerifier(ENV, await mock.getAddress());
    await v.registerHandshakeAllowance(ENV, 3);
    await v.configureDevFund(ENV, DEVFUND);
    await v.finalize();
    const ts = (await ethers.provider.getBlock("latest")).timestamp;
    await v.submitPriceBatch(1n,[ASSET],[1_000_000n],ts, await signBatch(v,pub,1n,[ASSET],[1_000_000n],ts));

    function mk(precision, tag) {
      const gross = 20n * 10n**18n, duration = 30n*86400n;
      const fee = (gross*500n)/10000n, principal = gross - fee;
      const lockId = ethers.keccak256(ethers.toUtf8Bytes(tag));
      const proof = ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32","uint256","uint256","uint256","uint256","uint256","uint256"],
        [lockId, gross, fee, principal, duration, ts, ts+Number(duration)]);
      return { sourceEnvironmentId: ENV, commitmentVaultLockId: lockId,
        handshakeIdentity: "MockChain:"+tag, handshakeAllowanceCount: 1,
        canonicalAssetId: ASSET, assetPrecision: precision, assetCustodyClass: 1,
        grossAmountSmallestUnits: gross, actualFeeAmountSmallestUnits: fee,
        principalAmountSmallestUnits: principal, feeAssetId: ASSET,
        devFundDestination: DEVFUND,
        feeTransferEvidence: ethers.keccak256(ethers.toUtf8Bytes("f"+tag)),
        valuationTimestamp: ts, maturityTimestamp: ts+Number(duration),
        durationSecs: duration, selectedOutputToken: 0, baseRecipient: deployer.address,
        releaseDestination: "src", chonxActivationReceipt: "0x",
        racIdentity: lockId, sourceFinalityProof: "0x", lockEventProof: proof };
    }

    const credits = [];
    let prev = 0n;
    for (const p of [0, 6, 12, 18, 255]) {
      await v.recordFeeAndRac(mk(p, "inert" + p));
      const total = await v.epochRewardBasis(1);
      credits.push(total - prev);
      prev = total;
    }
    console.log(`        credits by declared precision [0,6,12,18,255]: ${credits.join(", ")}`);
    for (const c of credits) expect(c).to.equal(credits[0]);
    expect(credits[0]).to.be.greaterThan(0n);
  });
});

// CL-41 regression guard — structural. The divisor must never come from the
// caller-supplied package field again.
describe("CL-41 · precision divisor comes from the registry", function () {
  it("no USD derivation divides by pkg.assetPrecision", function () {
    const fs = require("fs");
    const src = fs.readFileSync(__dirname + "/../contracts/VinculumFinalisVerifier.sol", "utf8");
    const code = src.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    expect(code).to.not.include("10 ** uint256(pkg.assetPrecision)");
    expect(code).to.include("_registeredPrecision(pkg)");
  });
});
