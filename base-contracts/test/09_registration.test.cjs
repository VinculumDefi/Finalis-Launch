const { expect } = require("chai");
const { ethers } = require("hardhat");

// ---------------------------------------------------------------------------
// Implementation-domain narrowing audit — registration boundary.
//
// These are NOT attacker-controlled: custodyClass and decimals come from the
// immutable registry, populated during the deployment ceremony. The risk is
// different in kind — immutable configuration poisoning. A value accepted at
// registration that the arithmetic cannot honour is permanent under VF-IMM-006.
// ---------------------------------------------------------------------------

const ENV = "MockChain";
const ASSET = ethers.keccak256(ethers.toUtf8Bytes("MockChain:MOCK"));

async function freshVerifier() {
  const sg = await ethers.getSigners();
  const T = await ethers.getContractFactory("VinculumFinalisToken");
  const a = await T.deploy("A", "A", 10n ** 30n);
  const b = await T.deploy("B", "B", 10n ** 30n);
  const ts = (await ethers.provider.getBlock("latest")).timestamp;
  const V = await ethers.getContractFactory("VinculumFinalisVerifier");
  const __cap = await (await ethers.getContractFactory("VinculumFinalisCap")).deploy(10_000_000_000n * 10n ** 18n, 100_000_000_000n * 10n ** 18n);
  return await V.deploy(await a.getAddress(), await b.getAddress(), sg[9].address, ts, await __cap.getAddress());
}

describe("CL-42 · custody class must not silently default", function () {
  it("VF-SEC-003: an unrecognized custody class is rejected at registration", async function () {
    const v = await freshVerifier();
    for (const bad of [0, 4, 5, 255]) {
      await expect(
        v.registerAssetPrecision(ENV, ASSET, "MOCK", 18, bad, 0)
      ).to.be.revertedWith("VF-SEC-003: custody class must be 1, 2 or 3");
    }
  });

  it("the three valid classes are accepted", async function () {
    const v = await freshVerifier();
    for (const ok of [1, 2, 3]) {
      const id = ethers.keccak256(ethers.toUtf8Bytes("asset-" + ok));
      await v.registerAssetPrecision(ENV, id, "MOCK", 18, ok, 0);
      const key = ethers.solidityPackedKeccak256(["string", "bytes32"], [ENV, id]);
      const entry = await v.assetPrecisionTable(key);
      expect(entry.custodyClass).to.equal(ok);
    }
  });

  it("custody path is bounded to native or token", async function () {
    const v = await freshVerifier();
    await expect(
      v.registerAssetPrecision(ENV, ASSET, "MOCK", 18, 1, 2)
    ).to.be.revertedWith("VF-SEC-003: custody path must be 0 or 1");
  });
});

describe("CL-43 · asset precision must be within the executable domain", function () {
  it("a precision beyond safe arithmetic is rejected at registration", async function () {
    const v = await freshVerifier();
    // 10 ** 78 exceeds uint256. Such an asset could never be valued, and the
    // registry is immutable after finalization.
    for (const bad of [19, 78, 100, 255]) {
      await expect(
        v.registerAssetPrecision(ENV, ASSET, "MOCK", bad, 1, 0)
      ).to.be.revertedWith("VF-REG: precision exceeds 18");
    }
  });

  it("precisions across the real range are accepted", async function () {
    const v = await freshVerifier();
    for (const ok of [0, 6, 8, 9, 18]) {
      const id = ethers.keccak256(ethers.toUtf8Bytes("p-" + ok));
      await v.registerAssetPrecision(ENV, id, "MOCK", ok, 1, 0);
      const key = ethers.solidityPackedKeccak256(["string", "bytes32"], [ENV, id]);
      expect((await v.assetPrecisionTable(key)).decimals).to.equal(ok);
    }
  });
});

// ---------------------------------------------------------------------------
// CL-44 · output token discriminator — the CL-42 shape, but it selects which
// asset is minted rather than a multiplier.
// ---------------------------------------------------------------------------
describe("CL-44 · output token discriminator is closed", function () {
  const ENV2 = "MockChain";
  const A2 = ethers.keccak256(ethers.toUtf8Bytes("MockChain:MOCK"));
  const DF = "devfund.mocksource.addr";

  async function sign(v, s, runId, ids, prices, ts) {
    const net = await ethers.provider.getNetwork();
    const d = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256","address","uint64","bytes32","bytes32","uint64"],
      [net.chainId, await v.getAddress(), runId,
       ethers.solidityPackedKeccak256(["bytes32[]"],[ids]),
       ethers.solidityPackedKeccak256(["uint256[]"],[prices]), ts]));
    return await s.signMessage(ethers.getBytes(d));
  }

  async function configured() {
    const sg = await ethers.getSigners();
    const [deployer] = sg; const pub = sg[9];
    const T = await ethers.getContractFactory("VinculumFinalisToken");
    const vclm = await T.deploy("V","V",10n**30n);
    const chonx = await T.deploy("C","C",10n**30n);
    const launchTs = (await ethers.provider.getBlock("latest")).timestamp;
    const V = await ethers.getContractFactory("VinculumFinalisVerifier");
    const __cap = await (await ethers.getContractFactory("VinculumFinalisCap")).deploy(10_000_000_000n * 10n ** 18n, 100_000_000_000n * 10n ** 18n);
    const v = await V.deploy(await vclm.getAddress(), await chonx.getAddress(), pub.address, launchTs, await __cap.getAddress());
    await __cap.initialize(await v.getAddress(), await vclm.getAddress());
    await vclm.initialize(await v.getAddress(), "0x0000000000000000000000000000000000000000");
    await chonx.initialize(await v.getAddress(), "0x0000000000000000000000000000000000000000");
    const M = await ethers.getContractFactory("MockChainVerifier");
    const mock = await M.deploy();
    await v.registerAssetPrecision(ENV2, A2, "MOCK", 18, 1, 0);
    await v.registerChainVerifier(ENV2, await mock.getAddress());
    await v.registerHandshakeAllowance(ENV2, 3);
    await v.configureDevFund(ENV2, DF);
    await v.finalize();
    const ts = (await ethers.provider.getBlock("latest")).timestamp;
    await v.submitPriceBatch(1n,[A2],[1_000_000n],ts, await sign(v,pub,1n,[A2],[1_000_000n],ts));
    return { v, vclm, chonx, deployer, ts };
  }

  function mk(ts, deployer, outputToken, tag) {
    const gross = 20n*10n**18n, duration = 30n*86400n;
    const fee = (gross*500n)/10000n, principal = gross - fee;
    const lockId = ethers.keccak256(ethers.toUtf8Bytes(tag));
    // CL-85. Identity fields added; they match the package returned below.
    const proof = ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32","uint256","uint256","uint256","uint256","uint256","uint256",
       "bytes32","address","address","uint8"],
      [lockId, gross, fee, principal, duration, ts, ts+Number(duration),
       A2, deployer.address, ethers.ZeroAddress, outputToken]);
    return { sourceEnvironmentId: ENV2, commitmentVaultLockId: lockId,
      handshakeIdentity: "MockChain:"+tag, handshakeAllowanceCount: 1,
      canonicalAssetId: A2, assetPrecision: 18, assetCustodyClass: 1,
      grossAmountSmallestUnits: gross, actualFeeAmountSmallestUnits: fee,
      principalAmountSmallestUnits: principal, feeAssetId: A2,
      devFundDestination: DF,
      feeTransferEvidence: ethers.keccak256(ethers.toUtf8Bytes("f"+tag)),
      valuationTimestamp: ts, maturityTimestamp: ts+Number(duration),
      durationSecs: duration, selectedOutputToken: outputToken,
      baseRecipient: deployer.address, releaseDestination: "src",
      chonxActivationReceipt: "0x", racIdentity: lockId,
      sourceFinalityProof: "0x", lockEventProof: proof };
  }

  it("VF-COM-020: every value outside {0,1} is rejected before any minting", async function () {
    const s = await configured();
    for (const bad of [2, 3, 127, 255]) {
      const pkg = mk(s.ts, s.deployer, bad, "bad" + bad);
      await s.v.recordFeeAndRac(pkg);
      await expect(s.v.verifyAndMint(pkg))
        .to.be.revertedWith("VF-COM-020: invalid output token");
    }
    // No token of either kind was minted by any rejected attempt.
    expect(await s.vclm.totalSupply()).to.equal(0n);
    expect(await s.chonx.totalSupply()).to.equal(0n);
  });

  it("VCLM (0) mints VCLM and not CHONX", async function () {
    const s = await configured();
    const pkg = mk(s.ts, s.deployer, 0, "vclm");
    await s.v.recordFeeAndRac(pkg);
    await s.v.verifyAndMint(pkg);
    expect(await s.vclm.totalSupply()).to.be.greaterThan(0n);
    expect(await s.chonx.totalSupply()).to.equal(0n);
  });

  it("rejection precedes emission-rate selection, so no invalid rate is ever used", async function () {
    // Structural: the guard must appear before _computeIssuance is called.
    const fs = require("fs");
    const src = fs.readFileSync(__dirname + "/../contracts/VinculumFinalisVerifier.sol", "utf8");
    const guard = src.indexOf("VF-COM-020: invalid output token");
    const use = src.indexOf("_computeIssuance(", src.indexOf("function verifyAndMint"));
    expect(guard).to.be.greaterThan(0);
    expect(use).to.be.greaterThan(guard);
  });
});
