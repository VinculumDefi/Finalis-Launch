const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

// Revision 8 EVM environments. One CommitmentVaultLock deployment each.
// The Dev Fund address below is a fresh test-fixture address, not a mainnet
// Dev Fund and not a hardcoded production constant.
const ENVIRONMENTS = [
  "Base",
  "Ethereum",
  "Polygon",
  "Optimism",
  "Arbitrum",
  "BNB Smart Chain",
  "Avalanche",
];

const HOUR = 60n * 60n;
const DAY = 24n * HOUR;
const SEVEN_DAYS = 7n * DAY;
const MAX_STANDARD = 3650n * DAY; // exact ten-year row, 315_360_000 seconds
const EIGHT_DAYS = 8n * DAY; // inside the old range, not a table row
const USD = 10n ** 18n;
const HANDSHAKE_USD = USD; // $1.00, inside $0.95–$1.05
const STANDARD_USD = 10n * USD;
const GROSS = 10_000n; // divisible by 10_000 so floor(gross * bps / 10_000) is exact
const STANDARD_FEE = 500n; // 5.00% of 10_000
const STANDARD_PRINCIPAL = 9_500n;
const HANDSHAKE_FEE = 250n; // 2.50% of 10_000
const HANDSHAKE_PRINCIPAL = 9_750n;

function freshDevFund() {
  // Test fixture only. Generated in-process. Not a production Dev Fund address.
  return ethers.Wallet.createRandom().address;
}

async function deployVault(environmentId) {
  const devFund = freshDevFund();
  const Vault = await ethers.getContractFactory("CommitmentVaultLock");
  const vault = await Vault.deploy(environmentId, devFund);
  await vault.waitForDeployment();
  const Caller = await ethers.getContractFactory("TestReleaseCaller");
  const destination = await Caller.deploy();
  await destination.waitForDeployment();
  return { vault, devFund, destination };
}

function bindingArgs(releaseDestination, duration, verifiedGrossUsd) {
  return {
    lockId: ethers.hexlify(ethers.randomBytes(32)),
    baseRecipient: ethers.Wallet.createRandom().address, // test fixture recipient
    outputToken: 1,
    assetIdentity: ethers.id("test-fixture-asset"),
    valuationReference: ethers.id("test-fixture-valuation"),
    releaseDestination,
    duration,
    verifiedGrossUsd: verifiedGrossUsd ?? (duration === HOUR ? HANDSHAKE_USD : STANDARD_USD),
  };
}

function expectedPayload(args) {
  return ethers.concat([
    args.lockId,
    args.baseRecipient,
    ethers.toBeHex(args.outputToken, 1),
    args.assetIdentity,
    args.valuationReference,
  ]);
}

async function createNative(vault, signer, args, value) {
  const tx = await vault.connect(signer).createNativeLock(
    args.lockId,
    args.baseRecipient,
    args.outputToken,
    args.assetIdentity,
    args.valuationReference,
    args.releaseDestination,
    args.duration,
    args.verifiedGrossUsd,
    { value }
  );
  const receipt = await tx.wait();
  const block = await ethers.provider.getBlock(receipt.blockNumber);
  return { receipt, timestamp: BigInt(block.timestamp) };
}

describe("CommitmentVaultLock (Revision 8, seven EVM environments)", function () {
  for (const environmentId of ENVIRONMENTS) {
    describe(environmentId, function () {
      let vault;
      let devFund;
      let destination;
      let creator;
      let stranger;

      beforeEach(async function () {
        [creator, stranger] = await ethers.getSigners();
        ({ vault, devFund, destination } = await deployVault(environmentId));
      });

      it("labels the deployment with the environment and a supplied dev fund", async function () {
        expect(await vault.environmentId()).to.equal(environmentId);
        expect(await vault.devFund()).to.equal(devFund);
        expect(devFund).to.not.equal(ethers.ZeroAddress);
      });

      it("holds: release before maturity reverts and principal stays in the contract", async function () {
        const args = bindingArgs(await destination.getAddress(), SEVEN_DAYS);
        const opened = await createNative(vault, creator, args, GROSS);
        const record = await vault.lockRecord(args.lockId);

        expect(record.exists).to.equal(true);
        expect(record.principal).to.equal(STANDARD_PRINCIPAL);
        expect(record.maturity).to.equal(opened.timestamp + SEVEN_DAYS);
        expect(record.bindingPayload).to.equal(expectedPayload(args));
        expect(ethers.getBytes(record.bindingPayload).length).to.equal(117);
        expect(await ethers.provider.getBalance(await vault.getAddress())).to.equal(STANDARD_PRINCIPAL);

        // setNextBlockTimestamp, not increaseTo: increaseTo mines a block, and the
        // following tx would then be mined one second later, at maturity.
        await time.setNextBlockTimestamp(record.maturity - 1n);
        await expect(destination.release(await vault.getAddress(), args.lockId)).to.be.revertedWith(
          "CVL: immature"
        );
        expect(await ethers.provider.getBalance(await vault.getAddress())).to.equal(STANDARD_PRINCIPAL);
        expect(await ethers.provider.getBalance(await destination.getAddress())).to.equal(0n);
        expect((await vault.lockRecord(args.lockId)).released).to.equal(false);
      });

      it("releases principal once to the bound destination at maturity, and a second or wrong caller reverts", async function () {
        const args = bindingArgs(await destination.getAddress(), SEVEN_DAYS);
        await createNative(vault, creator, args, GROSS);
        const record = await vault.lockRecord(args.lockId);

        await time.increaseTo(record.maturity);

        await expect(vault.connect(stranger).release(args.lockId)).to.be.revertedWith("CVL: destination");
        await expect(vault.connect(creator).release(args.lockId)).to.be.revertedWith("CVL: destination");
        expect(await ethers.provider.getBalance(await vault.getAddress())).to.equal(STANDARD_PRINCIPAL);
        expect(await ethers.provider.getBalance(await destination.getAddress())).to.equal(0n);

        await destination.release(await vault.getAddress(), args.lockId);

        expect(await ethers.provider.getBalance(await destination.getAddress())).to.equal(STANDARD_PRINCIPAL);
        expect(await ethers.provider.getBalance(await vault.getAddress())).to.equal(0n);
        expect((await vault.lockRecord(args.lockId)).released).to.equal(true);

        await expect(destination.release(await vault.getAddress(), args.lockId)).to.be.revertedWith(
          "CVL: already released"
        );
        expect(await ethers.provider.getBalance(await destination.getAddress())).to.equal(STANDARD_PRINCIPAL);
      });

      it("routes a 5% fee on a 7-day lock to the dev fund and keeps 95% as principal", async function () {
        const args = bindingArgs(await destination.getAddress(), SEVEN_DAYS);
        expect(await ethers.provider.getBalance(devFund)).to.equal(0n);

        await createNative(vault, creator, args, GROSS);

        const record = await vault.lockRecord(args.lockId);
        expect(record.gross).to.equal(GROSS);
        expect(record.fee).to.equal(STANDARD_FEE);
        expect(record.principal).to.equal(STANDARD_PRINCIPAL);
        expect(record.fee + record.principal).to.equal(GROSS);
        expect(await ethers.provider.getBalance(devFund)).to.equal(STANDARD_FEE);
        expect(await ethers.provider.getBalance(await vault.getAddress())).to.equal(STANDARD_PRINCIPAL);
      });

      it("holds, releases, and fees an ERC-20 from the received balance", async function () {
        const Token = await ethers.getContractFactory("TestFixtureERC20");
        const token = await Token.deploy(0);
        await token.waitForDeployment();
        await token.mint(creator.address, GROSS);
        await token.connect(creator).approve(await vault.getAddress(), GROSS);

        const args = bindingArgs(await destination.getAddress(), SEVEN_DAYS);
        await vault.connect(creator).createErc20Lock(
          args.lockId,
          args.baseRecipient,
          args.outputToken,
          args.assetIdentity,
          args.valuationReference,
          args.releaseDestination,
          args.duration,
          await token.getAddress(),
          GROSS,
          args.verifiedGrossUsd
        );

        expect(await token.balanceOf(devFund)).to.equal(STANDARD_FEE);
        expect(await token.balanceOf(await vault.getAddress())).to.equal(STANDARD_PRINCIPAL);
        const record = await vault.lockRecord(args.lockId);
        expect(record.gross).to.equal(GROSS);
        expect(record.asset).to.equal(await token.getAddress());
        expect(ethers.getBytes(record.bindingPayload).length).to.equal(117);

        // setNextBlockTimestamp, not increaseTo: increaseTo mines a block, and the
        // following tx would then be mined one second later, at maturity.
        await time.setNextBlockTimestamp(record.maturity - 1n);
        await expect(destination.release(await vault.getAddress(), args.lockId)).to.be.revertedWith(
          "CVL: immature"
        );
        expect(await token.balanceOf(await vault.getAddress())).to.equal(STANDARD_PRINCIPAL);
        expect(await token.balanceOf(await destination.getAddress())).to.equal(0n);

        await time.setNextBlockTimestamp(record.maturity);
        await expect(vault.connect(stranger).release(args.lockId)).to.be.revertedWith("CVL: destination");
        await destination.release(await vault.getAddress(), args.lockId);
        expect(await token.balanceOf(await destination.getAddress())).to.equal(STANDARD_PRINCIPAL);
        expect(await token.balanceOf(await vault.getAddress())).to.equal(0n);
        await expect(destination.release(await vault.getAddress(), args.lockId)).to.be.revertedWith(
          "CVL: already released"
        );
      });

      if (environmentId === "Base") {
        it("requireLockRecord reverts for an unknown id and succeeds after create", async function () {
          const unknown = ethers.id("never-created");
          expect((await vault.lockRecord(unknown)).exists).to.equal(false);
          await expect(vault.requireLockRecord(unknown)).to.be.revertedWith(
            "VF-XCH-024: Base lock record absent"
          );

          const args = bindingArgs(await destination.getAddress(), SEVEN_DAYS);
          await createNative(vault, creator, args, GROSS);
          await expect(vault.requireLockRecord(args.lockId)).to.not.be.reverted;
          expect((await vault.lockRecord(args.lockId)).exists).to.equal(true);
        });

        it("does not return finalized for an empty hash or height 0", async function () {
          expect(await vault.foreignHeaderFinalityNotDecided(ethers.ZeroHash, 0)).to.equal(false);
          expect(await vault.foreignHeaderFinalityNotDecided(ethers.ZeroHash, 1)).to.equal(false);
          expect(await vault.foreignHeaderFinalityNotDecided(ethers.id("header"), 0)).to.equal(false);
          expect(await vault.foreignHeaderFinalityNotDecided(ethers.id("header"), 12)).to.equal(false);
        });

        it("charges 2.50% on a one-hour lock and rejects durations that are not exact rows", async function () {
          const hour = bindingArgs(await destination.getAddress(), HOUR);
          await createNative(vault, creator, hour, GROSS);
          const record = await vault.lockRecord(hour.lockId);
          expect(record.fee).to.equal(HANDSHAKE_FEE);
          expect(record.principal).to.equal(HANDSHAKE_PRINCIPAL);

          const tooShort = bindingArgs(await destination.getAddress(), SEVEN_DAYS - 1n);
          await expect(createNative(vault, creator, tooShort, GROSS)).to.be.revertedWith("CVL: duration");

          const twoHours = bindingArgs(await destination.getAddress(), 2n * HOUR);
          await expect(createNative(vault, creator, twoHours, GROSS)).to.be.revertedWith("CVL: duration");

          const tooLong = bindingArgs(await destination.getAddress(), MAX_STANDARD + 1n);
          await expect(createNative(vault, creator, tooLong, GROSS)).to.be.revertedWith("CVL: duration");

          const interpolated = bindingArgs(await destination.getAddress(), EIGHT_DAYS);
          await expect(createNative(vault, creator, interpolated, GROSS)).to.be.revertedWith("CVL: duration");

          const maxed = bindingArgs(await destination.getAddress(), MAX_STANDARD);
          await createNative(vault, creator, maxed, GROSS);
          expect((await vault.lockRecord(maxed.lockId)).fee).to.equal(STANDARD_FEE);
          expect((await vault.lockRecord(maxed.lockId)).multiplierBps).to.equal(80000n);
          expect((await vault.lockRecord(hour.lockId)).multiplierBps).to.equal(10000n);
          expect(await ethers.provider.getBalance(await vault.getAddress())).to.equal(
            HANDSHAKE_PRINCIPAL + STANDARD_PRINCIPAL
          );
        });

        it("rejects a zero fee or zero principal before the lock exists", async function () {
          // floor(19 * 500 / 10_000) = 0, so a 7-day lock of 19 wei is a zero fee.
          const tiny = bindingArgs(await destination.getAddress(), SEVEN_DAYS);
          await expect(createNative(vault, creator, tiny, 19n)).to.be.revertedWith(
            "CVL: zero fee or principal"
          );
          expect((await vault.lockRecord(tiny.lockId)).exists).to.equal(false);
          expect(await ethers.provider.getBalance(await vault.getAddress())).to.equal(0n);
        });

        it("uses the ERC-20 balance delta when the token withholds units", async function () {
          const Token = await ethers.getContractFactory("TestFixtureERC20");
          const token = await Token.deploy(100); // 1% withheld by the token. Test fixture only.
          await token.waitForDeployment();
          await token.mint(creator.address, GROSS);
          await token.connect(creator).approve(await vault.getAddress(), GROSS);

          const args = bindingArgs(await destination.getAddress(), SEVEN_DAYS);
          await vault.connect(creator).createErc20Lock(
            args.lockId,
            args.baseRecipient,
            args.outputToken,
            args.assetIdentity,
            args.valuationReference,
            args.releaseDestination,
            args.duration,
            await token.getAddress(),
            GROSS,
            args.verifiedGrossUsd
          );

          const received = 9_900n; // 10_000 - 1%
          const fee = (received * 500n) / 10_000n;
          const principal = received - fee;
          const record = await vault.lockRecord(args.lockId);
          expect(record.gross).to.equal(received);
          expect(record.fee).to.equal(fee);
          expect(record.principal).to.equal(principal);
          expect(await token.balanceOf(devFund)).to.equal(fee);
          expect(await token.balanceOf(await vault.getAddress())).to.equal(principal);
        });

        it("derives three Handshakes because this contract counts per identity, and rejects the fourth", async function () {
          expect(await vault.countsPerIdentity()).to.equal(true);
          expect(await vault.handshakeAllowance()).to.equal(3n);
          const Probe = await ethers.getContractFactory("HandshakeCapabilityProbe");
          const probe = await Probe.deploy();
          await probe.waitForDeployment();
          expect(await probe.allowance(true)).to.equal(3n);
          expect(await probe.allowance(false)).to.equal(1n);
          expect(await vault.handshakeAllowance()).to.equal(await probe.allowance(await vault.countsPerIdentity()));

          for (let i = 0; i < 3; i++) {
            const args = bindingArgs(await destination.getAddress(), HOUR);
            await createNative(vault, creator, args, GROSS);
          }
          expect(await vault.handshakeUses(creator.address)).to.equal(3);
          const fourth = bindingArgs(await destination.getAddress(), HOUR);
          await expect(createNative(vault, creator, fourth, GROSS)).to.be.revertedWith(
            "CVL: handshake allowance"
          );
          expect((await vault.lockRecord(fourth.lockId)).exists).to.equal(false);

          // A 7-day lock does not consume the handshake allowance, and another
          // account still has its own three.
          const standard = bindingArgs(await destination.getAddress(), SEVEN_DAYS);
          await createNative(vault, creator, standard, GROSS);
          const otherHour = bindingArgs(await destination.getAddress(), HOUR);
          await createNative(vault, stranger, otherHour, GROSS);
          expect(await vault.handshakeUses(stranger.address)).to.equal(1);
        });
      }
    });
  }

  it("rejects a zero Dev Fund deployment input", async function () {
    const Vault = await ethers.getContractFactory("CommitmentVaultLock");
    await expect(Vault.deploy("Base", ethers.ZeroAddress)).to.be.revertedWith("CVL: dev fund");
  });
});
