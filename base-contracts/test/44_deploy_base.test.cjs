// =============================================================================
// deployBase — Base vault lock via scripts/deploy-base.cjs
//
// Runs deployBase (VCLM/CHONX/SYNTH/cap/stake/verifier/Base vault/
// BaseSameChainVerifier). Locks one Base asset the script registered from
// five-env-onchain-decimals.json (CBETH row 25, S3). Asserts 5% to Dev Fund,
// 95% to bound destination, early release reverts, mint matches custody class
// (1150 VCLM = $100 × 10 × 1.0 S3 × 1.15 × 30d). Does not register pretend
// MUSD. Does not deploy Ethereum/Polygon/Arbitrum/Optimism.
// =============================================================================

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { setCode, setStorageAt } = require("@nomicfoundation/hardhat-network-helpers");
const {
  deployBase,
  assertDeployEnv,
  ENV_ID,
} = require("../scripts/deploy-base.cjs");

const ZERO = "0x0000000000000000000000000000000000000000";
const DAY = 86400n;
const DURATION = 30n * DAY;
const PRICE_MICRO_USD = 1_000_000n;
const EXPECTED_MINT_S3 = 1150n * 10n ** 18n;

/** Prefer CBETH row 25 (first Base registry row); fall back to first vault-registered. */
function pickLockAsset(registeredAssets) {
  const cbeth = registeredAssets.find(
    (a) => a.vaultRegistered && a.symbol === "CBETH" && a.registryRow === 25
  );
  if (cbeth) return cbeth;
  const any = registeredAssets.find((a) => a.vaultRegistered);
  if (!any) throw new Error("deployBase registered no vault assets to lock");
  return any;
}

function expectedMintForCustody(custodyClass) {
  // $100 × 10 emission × class mult × 1.15 (30d). S1=1.5 → 1725; S2=1.3 → 1495; S3=1.0 → 1150.
  if (custodyClass === 1) return 1725n * 10n ** 18n;
  if (custodyClass === 2) return 1495n * 10n ** 18n;
  if (custodyClass === 3) return EXPECTED_MINT_S3;
  throw new Error(`unexpected custody class ${custodyClass}`);
}

/** BaseSameChainVerifier — vault-read proof (mirrors 13 / 41). */
function encodeBaseVaultProof(record) {
  return ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
    [
      record.lockId,
      record.grossAmount,
      record.feeAmount,
      record.principalAmount,
      record.durationSecs,
      record.creationTime,
      record.maturityTime,
    ]
  );
}

async function signBatch(verifier, signer, runId, ids, prices, fetchTs) {
  const net = await ethers.provider.getNetwork();
  const digest = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "address", "uint64", "bytes32", "bytes32", "uint64"],
      [
        net.chainId,
        await verifier.getAddress(),
        runId,
        ethers.solidityPackedKeccak256(["bytes32[]"], [ids]),
        ethers.solidityPackedKeccak256(["uint256[]"], [prices]),
        fetchTs,
      ]
    )
  );
  return await signer.signMessage(ethers.getBytes(digest));
}

/**
 * Ensure MockERC20 runtime code at the registry address (address unchanged).
 * Funds `user` via storage. MockERC20 layout: decimals @ 2, balanceOf @ 5.
 */
async function ensureTokenCodeAndFund(tokenAddr, symbol, decimals, name, user, amount) {
  const existing = await ethers.provider.getCode(tokenAddr);
  const Mock = await ethers.getContractFactory("MockERC20");
  const seed = await Mock.deploy(name, symbol, decimals, amount);
  await seed.waitForDeployment();

  if (existing === "0x") {
    const code = await ethers.provider.getCode(await seed.getAddress());
    await setCode(tokenAddr, code);
  }

  await setStorageAt(tokenAddr, 2, ethers.toBeHex(decimals, 32));
  const balSlot = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256"],
      [user.address, 5]
    )
  );
  await setStorageAt(tokenAddr, balSlot, ethers.toBeHex(amount, 32));

  return await ethers.getContractAt("MockERC20", tokenAddr);
}

describe("44_deploy_base — Base asset via deployBase", function () {
  it("runs deployBase, locks one registered Base asset, 5% fee / 95% release, early release reverts, mint matches custody class", async function () {
    this.timeout(600000);

    expect(() => assertDeployEnv({})).to.throw(/refusing to deploy/);
    expect(() =>
      assertDeployEnv({
        PRICE_PUBLISHER: ZERO,
        BASE_DEV_FUND: "0x1111111111111111111111111111111111111111",
        LAUNCH_TIMESTAMP: "1",
      })
    ).to.throw(/zero\/invalid/);

    const signers = await ethers.getSigners();
    const publisher = signers[9];
    const user = signers[3];
    const relayer = signers[5];
    const baseDevFund = signers[1];
    const boundDestination = signers[4];

    const launchTs = (await ethers.provider.getBlock("latest")).timestamp;
    const env = {
      PRICE_PUBLISHER: publisher.address,
      BASE_DEV_FUND: baseDevFund.address,
      LAUNCH_TIMESTAMP: String(launchTs),
    };

    const out = await deployBase(ethers, env);

    expect(out.environmentId).to.equal(ENV_ID);
    expect(out.registeredAssets.length).to.be.greaterThan(0);
    // No pretend MUSD.
    expect(out.registeredAssets.some((a) => a.symbol === "MUSD")).to.equal(false);

    const asset = pickLockAsset(out.registeredAssets);
    const unit = 10n ** BigInt(asset.decimals);
    const gross = 100n * unit;
    const expectedFee = 5n * unit;
    const expectedPrincipal = 95n * unit;
    const expectedMint = expectedMintForCustody(asset.custodyClass);
    const fund = 1000n * unit;

    const verifier = await ethers.getContractAt(
      "VinculumFinalisVerifier",
      out.verifier
    );
    const vault = await ethers.getContractAt(
      "VinculumFinalisBaseVault",
      out.vault
    );
    const baseVerifier = await ethers.getContractAt(
      "BaseSameChainVerifier",
      out.chainVerifier
    );
    const vclm = await ethers.getContractAt("VinculumFinalisToken", out.vclm);

    expect(await baseVerifier.vault()).to.equal(out.vault);
    expect(await vault.approvedAsset(asset.address)).to.equal(asset.aid);

    const precKey = ethers.solidityPackedKeccak256(
      ["string", "bytes32"],
      [ENV_ID, asset.aid]
    );
    const prec = await verifier.assetPrecisionTable(precKey);
    expect(prec.decimals).to.equal(asset.decimals);
    expect(prec.custodyClass).to.equal(asset.custodyClass);

    await verifier.finalize();

    const token = await ensureTokenCodeAndFund(
      asset.address,
      asset.symbol,
      asset.decimals,
      asset.symbol,
      user,
      fund
    );

    const ts = (await ethers.provider.getBlock("latest")).timestamp;
    const sig = await signBatch(
      verifier,
      publisher,
      1n,
      [asset.aid],
      [PRICE_MICRO_USD],
      ts
    );
    await verifier.submitPriceBatch(1n, [asset.aid], [PRICE_MICRO_USD], ts, sig);

    await token.connect(user).approve(out.vault, fund);

    const vaultLockId = ethers.keccak256(
      ethers.toUtf8Bytes("deploy-base-lock-one-registered")
    );
    const devBefore = await token.balanceOf(baseDevFund.address);

    await vault.connect(user).commitVaultLock({
      lockId: vaultLockId,
      asset: asset.address,
      grossAmount: gross,
      durationSecs: DURATION,
      baseRecipient: user.address,
      releaseDestination: boundDestination.address,
      outputToken: 0,
      chonxActivationReceipt: ethers.ZeroHash,
    });

    const record = await vault.getLock(vaultLockId);
    expect(record.principalAmount).to.equal(expectedPrincipal);
    expect(record.feeAmount).to.equal(expectedFee);
    expect(await token.balanceOf(baseDevFund.address) - devBefore).to.equal(
      expectedFee
    );
    expect(await token.balanceOf(record.lockContract)).to.equal(
      expectedPrincipal
    );

    const lockEventProof = encodeBaseVaultProof(record);
    const [finalized] = await baseVerifier.verifyFinality(lockEventProof, "0x");
    expect(finalized).to.equal(true);

    const pkg = {
      sourceEnvironmentId: ENV_ID,
      commitmentVaultLockId: record.lockId,
      handshakeIdentity: `${ENV_ID}:${user.address.toLowerCase()}`,
      handshakeAllowanceCount: record.handshakeAllowanceCount,
      canonicalAssetId: asset.aid,
      assetPrecision: asset.decimals,
      assetCustodyClass: asset.custodyClass,
      grossAmountSmallestUnits: record.grossAmount,
      actualFeeAmountSmallestUnits: record.feeAmount,
      principalAmountSmallestUnits: record.principalAmount,
      feeAssetId: asset.aid,
      devFundDestination: baseDevFund.address.toLowerCase(),
      feeTransferEvidence: ethers.keccak256(
        ethers.toUtf8Bytes("fee-deploy-base")
      ),
      valuationTimestamp: Number(record.creationTime),
      maturityTimestamp: Number(record.maturityTime),
      durationSecs: record.durationSecs,
      selectedOutputToken: 0,
      baseRecipient: record.baseRecipient,
      releaseDestination: boundDestination.address.toLowerCase(),
      chonxActivationReceipt: "0x",
      racIdentity: ethers.keccak256(ethers.toUtf8Bytes("rac-deploy-base")),
      sourceFinalityProof: "0x",
      lockEventProof,
    };

    const before = await vclm.balanceOf(user.address);
    await verifier.connect(relayer).recordFeeAndRac(pkg);
    await verifier.connect(relayer).verifyAndMint(pkg);
    const minted = (await vclm.balanceOf(user.address)) - before;
    console.log(
      `\n    deployBase ${asset.symbol} row${asset.registryRow} S${asset.custodyClass}: minted ${ethers.formatUnits(minted, 18)} VCLM\n`
    );
    expect(minted).to.equal(expectedMint);

    const lock = await ethers.getContractAt(
      "CommitmentLock",
      record.lockContract
    );
    await expect(lock.release()).to.be.revertedWithCustomError(
      lock,
      "NotMature"
    );

    await ethers.provider.send("evm_increaseTime", [Number(DURATION)]);
    await ethers.provider.send("evm_mine", []);

    const destBefore = await token.balanceOf(boundDestination.address);
    await lock.connect(relayer).release();
    expect(await token.balanceOf(record.lockContract)).to.equal(0n);
    expect(
      (await token.balanceOf(boundDestination.address)) - destBefore
    ).to.equal(expectedPrincipal);
  });
});
