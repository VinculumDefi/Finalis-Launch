// =============================================================================
// BaseSameChainVerifier — behavioral test suite
//
// The central claim: this verifier returns facts read from vault storage, not
// facts asserted by the caller. The test that matters is therefore the forged
// one — the same shape of package that mints against UtxoChainVerifier
// (10_cl76_forged_package.test.cjs) must fail here.
//
// Weighted negative per Verifier Completion Standard 5.2.
// =============================================================================

const { expect } = require("chai");
const { ethers } = require("hardhat");

const ENV = "base";
const ZERO = "0x0000000000000000000000000000000000000000";
const DAY = 86400n;
const HOUR = 3600n;

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

// Encodes the shared 7-tuple lock event proof.
function encodeLockProof(o) {
  return ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
    [o.lockId, o.gross, o.fee, o.principal, o.duration, o.creation, o.maturity]
  );
}

// Any finality proof at all — this verifier must ignore it.
function encodeFinalityProof() {
  return ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "uint256", "uint8", "uint256", "bool", "bool"],
    [ethers.keccak256(ethers.toUtf8Bytes("nonsense")), 999999n, 0, 0n, false, false]
  );
}

async function deployAll() {
  const signers = await ethers.getSigners();
  const [deployer] = signers;
  const publisher = signers[9];
  const user = signers[3];
  const attacker = signers[5];
  const devFund = signers[8];

  const Token = await ethers.getContractFactory("VinculumFinalisToken");
  const vclm = await Token.deploy("Vinculum", "VCLM", 10_000_000_000n * 10n**18n);
  const chonx = await Token.deploy("Chonx", "CHONX", 100_000_000_000n * 10n**18n);

  const launchTs = (await ethers.provider.getBlock("latest")).timestamp;
  const V = await ethers.getContractFactory("VinculumFinalisVerifier");
  const verifier = await V.deploy(
    await vclm.getAddress(), await chonx.getAddress(), publisher.address, launchTs
  );

  const Mock = await ethers.getContractFactory("MockERC20");
  const token = await Mock.deploy("MockUSD", "MUSD", 18, 10n**30n);

  const AID = assetId("MUSD");
  await verifier.registerAssetPrecision(ENV, AID, "MUSD", 18, 1, 1);
  await verifier.finalize();

  const ts = (await ethers.provider.getBlock("latest")).timestamp;
  const sig = await signBatch(verifier, publisher, 1n, [AID], [1_000_000n], ts);
  await verifier.submitPriceBatch(1n, [AID], [1_000_000n], ts, sig);

  const Vault = await ethers.getContractFactory("VinculumFinalisBaseVault");
  const vault = await Vault.deploy(await verifier.getAddress(), devFund.address);
  await vault.registerAsset(await token.getAddress(), AID);
  await vault.finalizeConfiguration();

  const BV = await ethers.getContractFactory("BaseSameChainVerifier");
  const baseVerifier = await BV.deploy(await vault.getAddress());

  await token.transfer(user.address, 10n**24n);
  await token.connect(user).approve(await vault.getAddress(), 10n**24n);

  return { deployer, user, attacker, devFund, verifier, vault, baseVerifier, token, AID };
}

async function createLock(s, tag, duration = 30n * DAY, gross = 100n * 10n**18n) {
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
  return { lockId, record: await s.vault.getLock(lockId) };
}

describe("BaseSameChainVerifier — rejects forged evidence", function () {

  it("reverts on a lock that does not exist, however well-formed the proof", async function () {
    const s = await deployAll();

    // The identical package shape that mints against UtxoChainVerifier.
    const proof = encodeLockProof({
      lockId: ethers.keccak256(ethers.toUtf8Bytes("phantom-lock")),
      gross: 10_000n * 10n**18n, fee: 500n * 10n**18n,
      principal: 9_500n * 10n**18n, duration: 30n * DAY,
      creation: 1n, maturity: 2n,
    });

    await expect(
      s.baseVerifier.verifyFinality(proof, encodeFinalityProof())
    ).to.be.revertedWithCustomError(s.baseVerifier, "LockNotFound");

    await expect(
      s.baseVerifier.extractFacts(proof)
    ).to.be.revertedWithCustomError(s.baseVerifier, "LockNotFound");
  });

  it("ignores the caller's claimed amounts and returns vault storage instead", async function () {
    const s = await deployAll();
    const { lockId, record } = await createLock(s, "real-lock");

    // A real lock id, but every other field inflated by the caller.
    const lyingProof = encodeLockProof({
      lockId,
      gross: 999_999n * 10n**18n,
      fee: 1n,
      principal: 999_998n * 10n**18n,
      duration: 3650n * DAY,
      creation: 1n,
      maturity: 2n,
    });

    const f = await s.baseVerifier.extractFacts(lyingProof);
    expect(f.lockId).to.equal(lockId);
    expect(f.grossAmount).to.equal(record.grossAmount);
    expect(f.feeAmount).to.equal(record.feeAmount);
    expect(f.principalAmount).to.equal(record.principalAmount);
    expect(f.durationSecs).to.equal(record.durationSecs);
    expect(f.creationTimestamp).to.equal(record.creationTime);
    expect(f.maturityTimestamp).to.equal(record.maturityTime);

    // None of the caller's inflated numbers survived.
    expect(f.grossAmount).to.not.equal(999_999n * 10n**18n);
  });

  it("ignores the finality proof entirely", async function () {
    const s = await deployAll();
    const { lockId, record } = await createLock(s, "ignore-finality");
    const proof = encodeLockProof({
      lockId, gross: record.grossAmount, fee: record.feeAmount,
      principal: record.principalAmount, duration: record.durationSecs,
      creation: record.creationTime, maturity: record.maturityTime,
    });

    // Deliberately hostile finality proofs: unfinalized status, zero
    // confirmations, empty bytes. All must produce the same result.
    const [okA, , ] = await s.baseVerifier.verifyFinality(proof, encodeFinalityProof());
    const [okB, , ] = await s.baseVerifier.verifyFinality(proof, "0x");
    expect(okA).to.equal(true);
    expect(okB).to.equal(true);
  });

  it("derives the block hash and height rather than echoing the caller's", async function () {
    const s = await deployAll();
    const { lockId, record } = await createLock(s, "derived-block");
    const proof = encodeLockProof({
      lockId, gross: record.grossAmount, fee: record.feeAmount,
      principal: record.principalAmount, duration: record.durationSecs,
      creation: record.creationTime, maturity: record.maturityTime,
    });

    const [, hash, height] = await s.baseVerifier.verifyFinality(proof, encodeFinalityProof());
    const current = await ethers.provider.getBlockNumber();

    // The caller's proof claimed height 999999.
    expect(height).to.not.equal(999999n);
    expect(height).to.be.lessThanOrEqual(BigInt(current));
    expect(hash).to.not.equal(ethers.keccak256(ethers.toUtf8Bytes("nonsense")));
  });
});

describe("BaseSameChainVerifier — accepts genuine locks", function () {

  it("verifies a real lock and reports it finalized", async function () {
    const s = await deployAll();
    const { lockId, record } = await createLock(s, "genuine");
    const proof = encodeLockProof({
      lockId, gross: record.grossAmount, fee: record.feeAmount,
      principal: record.principalAmount, duration: record.durationSecs,
      creation: record.creationTime, maturity: record.maturityTime,
    });

    const [finalized] = await s.baseVerifier.verifyFinality(proof, encodeFinalityProof());
    expect(finalized).to.equal(true);
    expect(await s.baseVerifier.lockIsVerifiable(lockId)).to.equal(true);
  });

  it("reports an unknown lock as unverifiable without reverting", async function () {
    const s = await deployAll();
    const unknown = ethers.keccak256(ethers.toUtf8Bytes("never-created"));
    expect(await s.baseVerifier.lockIsVerifiable(unknown)).to.equal(false);
  });
});

describe("BaseSameChainVerifier — released locks", function () {

  // OPERATOR REVIEW: this behavior is an implementation judgement, not a
  // transcribed requirement. See BaseSameChainVerifier.verifyFinality.
  it("refuses a lock whose principal has already been released", async function () {
    const s = await deployAll();
    const { lockId, record } = await createLock(s, "released", HOUR, 10n**18n);

    await ethers.provider.send("evm_increaseTime", [Number(HOUR)]);
    await ethers.provider.send("evm_mine", []);

    const lock = await ethers.getContractAt("CommitmentLock", record.lockContract);
    await lock.release();

    const proof = encodeLockProof({
      lockId, gross: record.grossAmount, fee: record.feeAmount,
      principal: record.principalAmount, duration: record.durationSecs,
      creation: record.creationTime, maturity: record.maturityTime,
    });

    await expect(
      s.baseVerifier.verifyFinality(proof, encodeFinalityProof())
    ).to.be.revertedWithCustomError(s.baseVerifier, "PrincipalAlreadyReleased");

    expect(await s.baseVerifier.lockIsVerifiable(lockId)).to.equal(false);
  });
});

describe("BaseSameChainVerifier — construction", function () {

  it("refuses a zero vault address", async function () {
    const BV = await ethers.getContractFactory("BaseSameChainVerifier");
    await expect(BV.deploy(ZERO)).to.be.revertedWithCustomError(BV, "ZeroAddress");
  });

  it("binds the vault immutably at construction", async function () {
    const s = await deployAll();
    expect(await s.baseVerifier.vault()).to.equal(await s.vault.getAddress());
    // No setter exists.
    expect(s.baseVerifier.interface.fragments.filter(
      f => f.type === "function" && /set|update|change/i.test(f.name)
    ).length).to.equal(0);
  });
});
