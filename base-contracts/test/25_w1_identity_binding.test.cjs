// =============================================================================
// W1-01 / W1-02 — IDENTITY BINDING REGRESSION SUITE (Base)
//
// These tests are written to FAIL against the current tree. That is the point.
// They encode the behaviour the protocol requires, not the behaviour it has.
//
// The gap under test: VinculumFinalisVerifier.verifyAndMint cross-checks the
// ProofPackage against IChainVerifier.extractFacts, which returns seven numeric
// values — lockId, gross, fee, principal, duration, creation, maturity. None of
// the identity fields is among them. So baseRecipient, selectedOutputToken and
// canonicalAssetId are accepted from the caller and never compared to the lock
// record that vault storage already holds.
//
// Each test asserts a revert carrying VF-XCH-011, the requirement that the
// cross-check exists to satisfy. Today every one of them mints instead.
//
// Expected state on the unfixed tree:   4 failing
// Expected state after the interface change: 4 passing
//
// Companion: REDTEAM_WAVE1_BASE.md, findings W1-01 and W1-02.
// =============================================================================

const { expect } = require("chai");
const { ethers } = require("hardhat");

const ENV = "base";
const ZERO = "0x0000000000000000000000000000000000000000";
const DAY = 86400n;

// Custody classes, per VinculumFinalisVerifier._computeIssuance:
//   1 => S1 (1.5x)   2 => S2 (1.3x)   anything else => S3 (1.0x)
const S1 = 1;
const S3 = 3;

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

// Asserts that a call reverts AND that the reason mentions the given pattern.
// A bare `.to.be.reverted` is not good enough here: the output-token case
// already reverts today for an unrelated reason (CHONX not activated), and a
// test that accepted any revert would report a hole as closed.
async function expectRevertMatching(promise, pattern) {
  let threw = false;
  let message = "";
  try {
    await promise;
  } catch (e) {
    threw = true;
    message = e.shortMessage || e.message || String(e);
  }
  expect(threw, "call did not revert — the package was accepted").to.equal(true);
  expect(message, `reverted, but not for the expected reason: ${message}`)
    .to.match(pattern);
}

// -----------------------------------------------------------------------------
// Fixture. Mirrors 13_base_e2e.test.cjs, with two extra registry entries that
// exist only to be substituted in:
//
//   MUSD  — the asset actually locked.  $1.00, class S3 (1.0x)
//   MS1   — same price, class S1 (1.5x). Tests classification substitution.
//   MRICH — same class, $1,000.00.       Tests valuation substitution.
//
// Neither MS1 nor MRICH is ever locked. They are legitimate registry entries,
// which is precisely what makes them usable by an attacker.
// -----------------------------------------------------------------------------
async function deployStack() {
  const signers = await ethers.getSigners();
  const [deployer] = signers;
  const publisher = signers[9];
  const user = signers[3];       // the honest locker
  const attacker = signers[6];   // no role, no lock, gas only
  const devFund = signers[8];

  const Token = await ethers.getContractFactory("VinculumFinalisToken");
  const vclm  = await Token.deploy("Vinculum", "VCLM", 10_000_000_000n * 10n ** 18n);
  const chonx = await Token.deploy("Chonx", "CHONX", 100_000_000_000n * 10n ** 18n);
  const synth = await Token.deploy("Synth", "SYNTH", 10_000_000n * 10n ** 18n);

  const launchTs = (await ethers.provider.getBlock("latest")).timestamp;
  const cap = await (await ethers.getContractFactory("VinculumFinalisCap"))
    .deploy(10_000_000_000n * 10n ** 18n, 100_000_000_000n * 10n ** 18n);

  const V = await ethers.getContractFactory("VinculumFinalisVerifier");
  const verifier = await V.deploy(
    await vclm.getAddress(), await chonx.getAddress(),
    publisher.address, launchTs, await cap.getAddress()
  );

  const Stake = await ethers.getContractFactory("VinculumFinalisStake");
  const stake = await Stake.deploy(
    await vclm.getAddress(), await chonx.getAddress(), await synth.getAddress(),
    await verifier.getAddress(), launchTs, await cap.getAddress()
  );
  await cap.initialize(await verifier.getAddress(), await stake.getAddress());

  await vclm.initialize(await verifier.getAddress(), await stake.getAddress());
  await chonx.initialize(await verifier.getAddress(), ZERO);
  await synth.initialize(await verifier.getAddress(), ZERO);

  const Mock = await ethers.getContractFactory("MockERC20");
  const token = await Mock.deploy("MockUSD", "MUSD", 18, 10n ** 30n);

  const AID_REAL = assetId("MUSD");
  const AID_S1   = assetId("MS1");
  const AID_RICH = assetId("MRICH");

  const Vault = await ethers.getContractFactory("VinculumFinalisBaseVault");
  const vault = await Vault.deploy(await verifier.getAddress(), devFund.address);

  const BV = await ethers.getContractFactory("BaseSameChainVerifier");
  const baseVerifier = await BV.deploy(await vault.getAddress());

  // All three are legitimately registered. Same decimals throughout, so the
  // entry.decimals == pkg.assetPrecision check cannot distinguish them.
  await verifier.registerAssetPrecision(ENV, AID_REAL, "MUSD",  18, S3, 1);
  await verifier.registerAssetPrecision(ENV, AID_S1,   "MS1",   18, S1, 1);
  await verifier.registerAssetPrecision(ENV, AID_RICH, "MRICH", 18, S3, 1);

  await verifier.registerChainVerifier(ENV, await baseVerifier.getAddress());
  await verifier.registerHandshakeAllowance(ENV, 3);
  await verifier.configureDevFund(ENV, devFund.address.toLowerCase());
  await verifier.finalize();

  // Only MUSD is lockable. The other two exist purely as registry entries.
  await vault.registerAsset(await token.getAddress(), AID_REAL);
  await vault.finalizeConfiguration();

  const ts = (await ethers.provider.getBlock("latest")).timestamp;
  const ids    = [AID_REAL, AID_S1, AID_RICH];
  const prices = [1_000_000n, 1_000_000n, 1_000_000_000n]; // $1, $1, $1000
  const sig = await signBatch(verifier, publisher, 1n, ids, prices, ts);
  await verifier.submitPriceBatch(1n, ids, prices, ts, sig);

  await token.transfer(user.address, 10n ** 24n);
  await token.connect(user).approve(await vault.getAddress(), 10n ** 24n);

  return { deployer, user, attacker, devFund, publisher,
           verifier, vault, baseVerifier, token, vclm, cap,
           AID_REAL, AID_S1, AID_RICH };
}

// Creates a genuine lock owned by the honest user and returns the honest
// package built from vault storage — the same construction protocol.js uses.
async function realLockAndPackage(s, tag, gross = 100n * 10n ** 18n, duration = 30n * DAY) {
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
    canonicalAssetId: s.AID_REAL,
    assetPrecision: 18,
    assetCustodyClass: S3,
    grossAmountSmallestUnits: r.grossAmount,
    actualFeeAmountSmallestUnits: r.feeAmount,
    principalAmountSmallestUnits: r.principalAmount,
    feeAssetId: s.AID_REAL,
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
    sourceFinalityProof: "0x",
    lockEventProof,
  };

  return { lockId, record: r, pkg };
}

describe("W1 · identity fields must be bound to the lock record", function () {

  // ---------------------------------------------------------------------------
  // W1-01
  // ---------------------------------------------------------------------------

  it("W1-01a · a package naming a different baseRecipient must not mint", async function () {
    const s = await deployStack();
    const { pkg } = await realLockAndPackage(s, "w1-recipient");

    // The attacker changes one field. Everything else is read from vault
    // storage, so every cross-checked value still matches.
    const stolen = { ...pkg, baseRecipient: s.attacker.address };

    await s.verifier.connect(s.attacker).recordFeeAndRac(stolen);
    await expectRevertMatching(
      s.verifier.connect(s.attacker).verifyAndMint(stolen),
      /VF-XCH-011|VF-ARC-006|recipient/i
    );
  });

  it("W1-01b · demonstration — who actually receives the issuance", async function () {
    const s = await deployStack();
    const { lockId, pkg } = await realLockAndPackage(s, "w1-recipient-demo");

    const stolen = { ...pkg, baseRecipient: s.attacker.address };
    await s.verifier.connect(s.attacker).recordFeeAndRac(stolen);

    let reverted = false;
    try {
      await s.verifier.connect(s.attacker).verifyAndMint(stolen);
    } catch { reverted = true; }

    const toUser     = await s.vclm.balanceOf(s.user.address);
    const toAttacker = await s.vclm.balanceOf(s.attacker.address);
    const consumed   = await s.verifier.isLockConsumed(ENV, lockId);

    console.log(`\n    reverted: ${reverted}`);
    console.log(`    locker received:   ${ethers.formatUnits(toUser, 18)} VCLM`);
    console.log(`    attacker received: ${ethers.formatUnits(toAttacker, 18)} VCLM`);
    console.log(`    lock consumed:     ${consumed}\n`);

    expect(toAttacker, "attacker received the locker's issuance").to.equal(0n);
  });

  it("W1-01c · a package naming a different selectedOutputToken must not mint", async function () {
    const s = await deployStack();
    const { pkg } = await realLockAndPackage(s, "w1-output");

    // The lock records outputToken 0 (VCLM). The package claims 1 (CHONX).
    // Today this reverts on VF-COM-025 because CHONX is not activated — an
    // unrelated guard. The binding itself is never checked, so the pattern
    // below is deliberately narrow.
    const swapped = { ...pkg, selectedOutputToken: 1 };

    await s.verifier.connect(s.attacker).recordFeeAndRac(swapped);
    await expectRevertMatching(
      s.verifier.connect(s.attacker).verifyAndMint(swapped),
      /VF-XCH-011|VF-COM-020|output token mismatch/i
    );
  });

  // ---------------------------------------------------------------------------
  // W1-02
  // ---------------------------------------------------------------------------

  it("W1-02a · a package naming a different canonicalAssetId must not mint", async function () {
    const s = await deployStack();
    const { pkg } = await realLockAndPackage(s, "w1-asset");

    // MUSD was locked. The package claims MRICH — a legitimately registered
    // asset priced 1,000x higher. The gross unit count is honest and passes
    // the cross-check; only its valuation is wrong.
    const substituted = {
      ...pkg,
      canonicalAssetId: s.AID_RICH,
      feeAssetId: s.AID_RICH,
    };

    await s.verifier.connect(s.attacker).recordFeeAndRac(substituted);
    await expectRevertMatching(
      s.verifier.connect(s.attacker).verifyAndMint(substituted),
      /VF-XCH-011|VF-REG-001|asset mismatch/i
    );
  });

  it("W1-02b · demonstration — issuance inflation by valuation substitution", async function () {
    const s = await deployStack();

    // Honest baseline.
    const honest = await realLockAndPackage(s, "w1-inflate-honest");
    await s.verifier.connect(s.attacker).recordFeeAndRac(honest.pkg);
    await s.verifier.connect(s.attacker).verifyAndMint(honest.pkg);
    const baseline = await s.vclm.balanceOf(s.user.address);

    // Same lock size, substituted asset identity.
    const rigged = await realLockAndPackage(s, "w1-inflate-rigged");
    const substituted = {
      ...rigged.pkg,
      canonicalAssetId: s.AID_RICH,
      feeAssetId: s.AID_RICH,
    };

    let reverted = false;
    try {
      await s.verifier.connect(s.attacker).recordFeeAndRac(substituted);
      await s.verifier.connect(s.attacker).verifyAndMint(substituted);
    } catch { reverted = true; }

    const after = await s.vclm.balanceOf(s.user.address);
    const inflated = after - baseline;

    console.log(`\n    reverted: ${reverted}`);
    console.log(`    honest mint:     ${ethers.formatUnits(baseline, 18)} VCLM`);
    console.log(`    substituted:     ${ethers.formatUnits(inflated, 18)} VCLM`);
    if (baseline > 0n && inflated > 0n) {
      console.log(`    inflation ratio: ${(inflated * 100n / baseline)}%\n`);
    } else {
      console.log("");
    }

    expect(inflated, "substituted package minted against the wrong price")
      .to.equal(0n);
  });

  it("W1-02c · substituting to a higher custody class must not mint", async function () {
    const s = await deployStack();
    const { pkg } = await realLockAndPackage(s, "w1-class");

    // MS1 carries the same price but class S1 (1.5x) rather than S3 (1.0x).
    // Note the attack runs through canonicalAssetId, not through the package's
    // assetCustodyClass field: _computeIssuance reads entry.custodyClass from
    // the registry entry for whatever asset id the package names.
    const upgraded = {
      ...pkg,
      canonicalAssetId: s.AID_S1,
      feeAssetId: s.AID_S1,
    };

    await s.verifier.connect(s.attacker).recordFeeAndRac(upgraded);
    await expectRevertMatching(
      s.verifier.connect(s.attacker).verifyAndMint(upgraded),
      /VF-XCH-011|VF-REG-001|asset mismatch/i
    );
  });

  // ---------------------------------------------------------------------------
  // Control. If this one ever fails, the fix has broken the honest path and
  // the four above are passing for the wrong reason.
  // ---------------------------------------------------------------------------

  it("control · the honest package still mints to the locker", async function () {
    const s = await deployStack();
    const { pkg } = await realLockAndPackage(s, "w1-control");

    await s.verifier.connect(s.attacker).recordFeeAndRac(pkg);
    await s.verifier.connect(s.attacker).verifyAndMint(pkg);

    const minted = await s.vclm.balanceOf(s.user.address);
    expect(minted).to.be.greaterThan(0n);
    expect(await s.vclm.balanceOf(s.attacker.address)).to.equal(0n);
  });
});
