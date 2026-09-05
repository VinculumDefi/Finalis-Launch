// CL-76 · Forged Package Test
//
// PURPOSE
// Demonstrates that a caller with no lock on any source chain can mint by
// supplying a self-consistent fabricated ProofPackage to the PRODUCTION
// UtxoChainVerifier.
//
// This test deliberately does NOT use MockChainVerifier. The existing suite
// (04_endtoend) registers a mock and supplies sourceFinalityProof: "0x".
// The production verifier is never exercised there. This test registers the
// real contract for a Bitcoin environment.
//
// EXPECTED RESULT TODAY:   PASSES (tokens minted from nothing)  <-- the finding
// EXPECTED AFTER FAIL-CLOSED FIX: reverts with VerifierNotImplemented
//
// Do not delete after remediation. Flip the assertion and keep it as a
// permanent regression test.

const { expect } = require("chai");
const { ethers } = require("hardhat");

const ZERO = "0x0000000000000000000000000000000000000000";

// A Bitcoin-family environment handled by the real UtxoChainVerifier.
const ENV = "bitcoin";
const ASSET = ethers.keccak256(ethers.toUtf8Bytes("bitcoin:BTC"));
const DECIMALS = 8;                        // satoshis
const PRICE_MICRO = 60_000_000_000n;       // $60,000.00 per BTC, in micro-USD
const HANDSHAKE_SECS = 3600n;
const DEVFUND = "bc1qdevfund.example.addr";

// Mirrors signBatch in 04_endtoend.test.cjs exactly.
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

// Same ceremony as deployConfigured(), but registers the REAL verifier.
async function deployWithRealUtxoVerifier(allowance = 3) {
  const signers = await ethers.getSigners();
  const [deployer] = signers;
  const publisher = signers[9];
  const attacker = signers[5];              // no role, no privileges

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

  // *** THE ONLY MEANINGFUL DIFFERENCE FROM 04_endtoend ***
  // The production UTXO verifier, deployed honestly by the deployer.
  const HC = await ethers.getContractFactory("Sha256dHeaderChain");
  const gen = ethers.sha256(ethers.sha256(ethers.getBytes("0x01000000" + "00".repeat(32) + "3ba3edfd7a7b12b27ac72c3e67768f617fc81bc3888a51323a9fb8aa4b1e5e4a" + "29ab5f49ffff001d1dac2b7c")));
  const hc = await HC.deploy(gen, 0, 0x1d00ffff, 0x495fab29);
  const Utxo = await ethers.getContractFactory("UtxoChainVerifier");
  const utxo = await Utxo.deploy(ENV, 6, await hc.getAddress());

  // Honest deployment ceremony.
  await verifier.registerAssetPrecision(ENV, ASSET, "BTC", DECIMALS, 1, 0);
  await verifier.registerChainVerifier(ENV, await utxo.getAddress());
  await verifier.registerHandshakeAllowance(ENV, allowance);
  await verifier.configureDevFund(ENV, DEVFUND);
  await verifier.finalize();

  // Legitimate, oracle-signed price. The attacker does not forge this.
  const ts = (await ethers.provider.getBlock("latest")).timestamp;
  const sig = await signBatch(verifier, publisher, 1n, [ASSET], [PRICE_MICRO], ts);
  await verifier.submitPriceBatch(1n, [ASSET], [PRICE_MICRO], ts, sig);

  return { deployer, publisher, attacker, vclm, chonx, verifier, stake, utxo, launchTs };
}

// Builds a package describing a lock that does not exist on Bitcoin or anywhere.
// Every field is chosen by the caller. Both proofs are encoded from the same
// invented numbers, so the VF-XCH-011 cross-check compares the forgery to itself.
function buildForgedPackage(o) {
  const gross = o.gross ?? 1667n; // ~$1.00 at $60k/BTC — VF-COM-003 band
  const duration = o.duration ?? HANDSHAKE_SECS;
  const bps = duration === HANDSHAKE_SECS ? 250n : 500n;
  const fee = (gross * bps) / 10000n;
  const principal = gross - fee;
  const lockId = o.lockId ?? ethers.keccak256(ethers.toUtf8Bytes("forged-lock-cl76"));
  const valuationTs = o.valuationTs;

  // Fabricated lock event. No Bitcoin transaction corresponds to this.
  const lockEventProof = ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
    [lockId, gross, fee, principal, duration, valuationTs, valuationTs + Number(duration)]
  );

  // Fabricated finality assertion, in the shape UtxoChainVerifier.verifyFinality
  // decodes: (bytes32 blockHash, uint256 blockHeight, uint256 confirmations).
  // The block hash is invented. The height is invented. The confirmation count
  // is simply asserted to be sufficient.
  const sourceFinalityProof = ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "uint256", "uint256"],
    [
      ethers.keccak256(ethers.toUtf8Bytes("this-block-does-not-exist")),
      900000n,
      o.confirmations ?? 6n,
    ]
  );

  return {
    sourceEnvironmentId: ENV,
    commitmentVaultLockId: lockId,
    handshakeIdentity: o.identity ?? "bitcoin:attacker",
    handshakeAllowanceCount: o.claimedAllowance ?? 99,
    canonicalAssetId: ASSET,
    assetPrecision: DECIMALS,
    assetCustodyClass: 1,
    grossAmountSmallestUnits: gross,
    actualFeeAmountSmallestUnits: fee,
    principalAmountSmallestUnits: principal,
    feeAssetId: ASSET,
    devFundDestination: o.devFund ?? DEVFUND,
    feeTransferEvidence: ethers.keccak256(ethers.toUtf8Bytes("no-such-fee-tx")),
    valuationTimestamp: valuationTs,
    maturityTimestamp: valuationTs + Number(duration),
    durationSecs: duration,
    selectedOutputToken: 0,
    baseRecipient: o.recipient,
    releaseDestination: "bc1qattacker.example.addr",
    chonxActivationReceipt: "0x",
    racIdentity: o.racIdentity ?? lockId,
    sourceFinalityProof,
    lockEventProof,
  };
}

describe("CL-76 · REGRESSION — forged packages are rejected by the production UtxoChainVerifier", function () {

  it("refuses to mint for an unprivileged caller with no lock on any chain", async function () {
    const s = await deployWithRealUtxoVerifier(3);
    const ts = (await ethers.provider.getBlock("latest")).timestamp;

    const pkg = buildForgedPackage({
      valuationTs: ts,
      recipient: s.attacker.address,
    });

    const before = await s.vclm.balanceOf(s.attacker.address);

    // Called by an address that holds no role and performed no lock.
    // CL-86: the forged package is now refused by recordFeeAndRac, before any
    // Reward-Accounting Credit is written. Asserted on the mechanism, not on
    // the bare fact of a revert (register v17).
    const basisBefore = await s.verifier.epochRewardBasis(1);
    await expect(s.verifier.connect(s.attacker).recordFeeAndRac(pkg)).to.be.reverted;
    expect(await s.verifier.epochRewardBasis(1),
      "a forged package must credit nothing").to.equal(basisBefore);
    await expect(s.verifier.connect(s.attacker).verifyAndMint(pkg)).to.be.reverted;

    const after = await s.vclm.balanceOf(s.attacker.address);
    const minted = after - before;

    console.log(`\n    CL-76 regression: minted ${ethers.formatUnits(minted, 18)} VCLM from a forged package`);
    console.log(`    Caller: ${s.attacker.address} (no deployer role, no lock)\n`);

    // TODAY: this assertion holds, which is the vulnerability.
    // AFTER FAIL-CLOSED FIX: the calls above revert and this line is unreachable.
    expect(minted).to.equal(0n);
  });

  it("the production verifier refuses an invented block", async function () {
    const s = await deployWithRealUtxoVerifier(3);

    const finalityProof = ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "uint256", "uint256"],
      [ethers.keccak256(ethers.toUtf8Bytes("invented")), 900000n, 6n]
    );

    // lockEventProof is unused by verifyFinality but must decode.
    const lockEventProof = ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
      [ethers.ZeroHash, 0n, 0n, 0n, 0n, 0n, 0n]
    );

    

    // The verifier made no request to Bitcoin. It cannot. It returned true.
    await expect(s.utxo.verifyFinality(lockEventProof, finalityProof)).to.be.reverted;
  });

  it("a second forged handshake is refused just as the first was", async function () {
    const s = await deployWithRealUtxoVerifier(3);
    const ts = (await ethers.provider.getBlock("latest")).timestamp;

    const pkg = buildForgedPackage({
      valuationTs: ts,
      recipient: s.attacker.address,
      lockId: ethers.keccak256(ethers.toUtf8Bytes("forged-lock-cl76-large")),
    });

    // CL-86: the forged package is now refused by recordFeeAndRac, before any
    // Reward-Accounting Credit is written. Asserted on the mechanism, not on
    // the bare fact of a revert (register v17).
    const basisBefore = await s.verifier.epochRewardBasis(1);
    await expect(s.verifier.connect(s.attacker).recordFeeAndRac(pkg)).to.be.reverted;
    expect(await s.verifier.epochRewardBasis(1),
      "a forged package must credit nothing").to.equal(basisBefore);
    await expect(s.verifier.connect(s.attacker).verifyAndMint(pkg)).to.be.reverted;

    const minted = await s.vclm.balanceOf(s.attacker.address);
    console.log(`\n    CL-76 regression, repeat: minted ${ethers.formatUnits(minted, 18)} VCLM from a second phantom lock\n`);
    expect(minted).to.equal(0n);
  });
});
