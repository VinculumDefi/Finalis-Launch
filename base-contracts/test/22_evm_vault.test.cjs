// =============================================================================
// VinculumFinalisEvmVault — CL-82 source vault tests
//
// The source-chain vault for the six remote EVM environments. It records
// amounts in native units and computes no USD: VF-ORC-007 places the valuation
// path on Base.
//
// The decisive test is the last one. It takes the event this vault actually
// emits, re-encodes it as a receipt, and parses it through EvmReceipt exactly
// as the Base-side verifiers do. A layout mistake would hide anywhere else.
//
// Weighted negative per Verifier Completion Standard 5.2.
// =============================================================================

const { expect } = require("chai");
const { ethers } = require("hardhat");

const ZERO = "0x0000000000000000000000000000000000000000";
const DAY = 86400n;
const HOUR = 3600n;

const PERMITTED = [3600n, 7n*DAY, 30n*DAY, 60n*DAY, 90n*DAY, 180n*DAY, 365n*DAY,
                   730n*DAY, 1095n*DAY, 1460n*DAY, 1825n*DAY, 2190n*DAY,
                   2555n*DAY, 2920n*DAY, 3285n*DAY, 3650n*DAY];

const ASSET_ID = ethers.keccak256(ethers.toUtf8Bytes("ethereum:MUSD"));
const NATIVE_ID = ethers.keccak256(ethers.toUtf8Bytes("ethereum:ETH"));

async function deploy() {
  const signers = await ethers.getSigners();
  const [deployer] = signers;
  const user = signers[3];
  const stranger = signers[6];
  const devFund = signers[8];

  const Mock = await ethers.getContractFactory("MockERC20");
  const token = await Mock.deploy("MockUSD", "MUSD", 18, 10n**30n);

  const V = await ethers.getContractFactory("VinculumFinalisEvmVault");
  const vault = await V.deploy("ethereum", devFund.address);

  await vault.registerAsset(await token.getAddress(), ASSET_ID);
  await vault.registerAsset(ZERO, NATIVE_ID);
  await vault.finalizeConfiguration();

  await token.transfer(user.address, 10n**24n);
  await token.connect(user).approve(await vault.getAddress(), 10n**24n);

  return { deployer, user, stranger, devFund, vault, token };
}

function params(o) {
  return {
    lockId: o.lockId ?? ethers.keccak256(ethers.toUtf8Bytes("evm-lock-1")),
    asset: o.asset,
    grossAmount: o.grossAmount ?? 1000n * 10n**18n,
    durationSecs: o.durationSecs ?? 30n * DAY,
    baseRecipient: o.baseRecipient,
    releaseDestination: o.releaseDestination,
    outputToken: o.outputToken ?? 0,
    chonxActivationReceipt: o.chonxActivationReceipt ?? ethers.ZeroHash,
  };
}

describe("VinculumFinalisEvmVault — lock creation", function () {

  it("splits the fee, isolates principal, and retains nothing", async function () {
    const s = await deploy();
    const gross = 1000n * 10n**18n;
    const fee = gross * 500n / 10000n;
    const principal = gross - fee;

    const devBefore = await s.token.balanceOf(s.devFund.address);
    const p = params({ asset: await s.token.getAddress(),
                       baseRecipient: s.user.address,
                       releaseDestination: s.user.address });
    await s.vault.connect(s.user).createLock(p);

    const rec = await s.vault.getLock(p.lockId);
    expect(rec.feeAmount).to.equal(fee);
    expect(rec.principalAmount).to.equal(principal);
    expect(await s.token.balanceOf(s.devFund.address) - devBefore).to.equal(fee);
    expect(await s.token.balanceOf(rec.lockContract)).to.equal(principal);
    expect(await s.token.balanceOf(await s.vault.getAddress())).to.equal(0n);
  });

  it("accepts the native path with msg.value", async function () {
    const s = await deploy();
    const gross = ethers.parseEther("10");
    const p = params({ asset: ZERO, grossAmount: gross,
                       baseRecipient: s.user.address,
                       releaseDestination: s.user.address });

    await s.vault.connect(s.user).createLock(p, { value: gross });

    const rec = await s.vault.getLock(p.lockId);
    expect(await ethers.provider.getBalance(rec.lockContract))
      .to.equal(rec.principalAmount);
  });

  it("accepts all 16 permitted durations and rejects adjacent values", async function () {
    const s = await deploy();
    for (let i = 0; i < PERMITTED.length; i++) {
      await s.vault.connect(s.user).createLock(params({
        lockId: ethers.keccak256(ethers.toUtf8Bytes(`dur-${i}`)),
        asset: await s.token.getAddress(),
        durationSecs: PERMITTED[i],
        baseRecipient: s.user.address, releaseDestination: s.user.address,
      }));
    }
    for (const d of [PERMITTED[1] - 1n, PERMITTED[1] + 1n, 3599n, 3601n]) {
      await expect(s.vault.connect(s.user).createLock(params({
        lockId: ethers.keccak256(ethers.toUtf8Bytes(`bad-${d}`)),
        asset: await s.token.getAddress(), durationSecs: d,
        baseRecipient: s.user.address, releaseDestination: s.user.address,
      }))).to.be.revertedWithCustomError(s.vault, "DurationNotPermitted");
    }
  });

  it("charges 250 bps for a handshake and 500 for a standard lock", async function () {
    const s = await deploy();
    const gross = 1000n * 10n**18n;

    await s.vault.connect(s.user).createLock(params({
      lockId: ethers.keccak256(ethers.toUtf8Bytes("hs-fee")),
      asset: await s.token.getAddress(), grossAmount: gross, durationSecs: HOUR,
      baseRecipient: s.user.address, releaseDestination: s.user.address,
    }));
    const hs = await s.vault.getLock(ethers.keccak256(ethers.toUtf8Bytes("hs-fee")));
    expect(hs.feeAmount).to.equal(gross * 250n / 10000n);

    await s.vault.connect(s.user).createLock(params({
      lockId: ethers.keccak256(ethers.toUtf8Bytes("std-fee")),
      asset: await s.token.getAddress(), grossAmount: gross,
      baseRecipient: s.user.address, releaseDestination: s.user.address,
    }));
    const std = await s.vault.getLock(ethers.keccak256(ethers.toUtf8Bytes("std-fee")));
    expect(std.feeAmount).to.equal(gross * 500n / 10000n);
  });
});

describe("VinculumFinalisEvmVault — negative cases", function () {

  it("rejects an unapproved asset without moving the user's funds", async function () {
    const s = await deploy();
    const Rogue = await ethers.getContractFactory("MockERC20");
    const rogue = await Rogue.deploy("Rogue", "RGE", 18, 10n**30n);
    await rogue.transfer(s.user.address, 10n**22n);
    await rogue.connect(s.user).approve(await s.vault.getAddress(), 10n**22n);

    const before = await rogue.balanceOf(s.user.address);
    await expect(s.vault.connect(s.user).createLock(params({
      asset: await rogue.getAddress(),
      baseRecipient: s.user.address, releaseDestination: s.user.address,
    }))).to.be.revertedWithCustomError(s.vault, "AssetNotInRegistry");

    expect(await rogue.balanceOf(s.user.address)).to.equal(before);
    expect(await rogue.balanceOf(s.devFund.address)).to.equal(0n);
  });

  it("rejects a fee-on-transfer asset", async function () {
    const s = await deploy();
    await s.token.setTransferFeeBps(100);
    await expect(s.vault.connect(s.user).createLock(params({
      asset: await s.token.getAddress(),
      baseRecipient: s.user.address, releaseDestination: s.user.address,
    }))).to.be.revertedWithCustomError(s.vault, "GrossNotReceived");
  });

  it("rejects a duplicate lock id", async function () {
    const s = await deploy();
    const p = params({ asset: await s.token.getAddress(),
                       baseRecipient: s.user.address,
                       releaseDestination: s.user.address });
    await s.vault.connect(s.user).createLock(p);
    await expect(s.vault.connect(s.user).createLock(p))
      .to.be.revertedWithCustomError(s.vault, "LockAlreadyExists");
  });

  it("rejects a native value mismatch", async function () {
    const s = await deploy();
    await expect(s.vault.connect(s.user).createLock(
      params({ asset: ZERO, grossAmount: ethers.parseEther("10"),
               baseRecipient: s.user.address, releaseDestination: s.user.address }),
      { value: ethers.parseEther("9") }
    )).to.be.revertedWithCustomError(s.vault, "NativeValueMismatch");
  });

  it("rejects native value sent with an ERC-20 lock", async function () {
    const s = await deploy();
    await expect(s.vault.connect(s.user).createLock(
      params({ asset: await s.token.getAddress(),
               baseRecipient: s.user.address, releaseDestination: s.user.address }),
      { value: 1n }
    )).to.be.revertedWithCustomError(s.vault, "UnexpectedNativeValue");
  });

  it("rejects a fourth handshake from the same identity", async function () {
    const s = await deploy();
    for (let i = 0; i < 3; i++) {
      await s.vault.connect(s.user).createLock(params({
        lockId: ethers.keccak256(ethers.toUtf8Bytes(`hs-${i}`)),
        asset: await s.token.getAddress(), durationSecs: HOUR,
        baseRecipient: s.user.address, releaseDestination: s.user.address,
      }));
    }
    expect(await s.vault.handshakeRemaining(s.user.address)).to.equal(0);
    await expect(s.vault.connect(s.user).createLock(params({
      lockId: ethers.keccak256(ethers.toUtf8Bytes("hs-4")),
      asset: await s.token.getAddress(), durationSecs: HOUR,
      baseRecipient: s.user.address, releaseDestination: s.user.address,
    }))).to.be.revertedWithCustomError(s.vault, "AllowanceExhausted");
  });

  it("rejects CHONX output with no activation receipt", async function () {
    const s = await deploy();
    await expect(s.vault.connect(s.user).createLock(params({
      asset: await s.token.getAddress(), outputToken: 1,
      baseRecipient: s.user.address, releaseDestination: s.user.address,
    }))).to.be.revertedWithCustomError(s.vault, "ChonxNotActivated");
  });

  it("refuses lock creation before configuration is finalized", async function () {
    const signers = await ethers.getSigners();
    const V = await ethers.getContractFactory("VinculumFinalisEvmVault");
    const vault = await V.deploy("ethereum", signers[8].address);

    await expect(vault.createLock(params({
      asset: ZERO, baseRecipient: signers[0].address,
      releaseDestination: signers[0].address,
    }))).to.be.revertedWithCustomError(vault, "NotFinalized");
  });

  it("refuses asset registration after finalization", async function () {
    const s = await deploy();
    await expect(s.vault.registerAsset(await s.token.getAddress(), ASSET_ID))
      .to.be.revertedWithCustomError(s.vault, "AlreadyFinalized");
  });
});

describe("VinculumFinalisEvmVault — release", function () {

  it("releases at maturity to the bound destination when called by a stranger",
    async function () {
      const s = await deploy();
      const p = params({ asset: await s.token.getAddress(),
                         baseRecipient: s.user.address,
                         releaseDestination: s.user.address });
      await s.vault.connect(s.user).createLock(p);
      const rec = await s.vault.getLock(p.lockId);
      const lock = await ethers.getContractAt("CommitmentLock", rec.lockContract);

      await expect(lock.release()).to.be.revertedWithCustomError(lock, "NotMature");

      await ethers.provider.send("evm_increaseTime", [Number(30n * DAY)]);
      await ethers.provider.send("evm_mine", []);

      const before = await s.token.balanceOf(s.user.address);
      await lock.connect(s.stranger).release();

      expect(await s.token.balanceOf(s.user.address) - before)
        .to.equal(rec.principalAmount);
      expect(await s.token.balanceOf(rec.lockContract)).to.equal(0n);
    });

  it("isolates locks from one another", async function () {
    const s = await deploy();
    const mk = async (tag) => {
      const p = params({
        lockId: ethers.keccak256(ethers.toUtf8Bytes(tag)),
        asset: await s.token.getAddress(),
        baseRecipient: s.user.address, releaseDestination: s.user.address,
      });
      await s.vault.connect(s.user).createLock(p);
      const rec = await s.vault.getLock(p.lockId);
      return { rec, lock: await ethers.getContractAt("CommitmentLock", rec.lockContract) };
    };

    const a = await mk("iso-a");
    const b = await mk("iso-b");
    expect(a.rec.lockContract).to.not.equal(b.rec.lockContract);

    await ethers.provider.send("evm_increaseTime", [Number(30n * DAY)]);
    await ethers.provider.send("evm_mine", []);
    await a.lock.release();

    expect(await s.token.balanceOf(b.rec.lockContract)).to.equal(b.rec.principalAmount);
    expect(await b.lock.released()).to.equal(false);
  });
});

describe("VinculumFinalisEvmVault — the emitted event is what the verifiers read",
  function () {

  it("emits exactly the six data words in the order EvmReceipt expects",
    async function () {
      const s = await deploy();
      const p = params({ asset: await s.token.getAddress(),
                         grossAmount: 1000n * 10n**18n,
                         baseRecipient: s.user.address,
                         releaseDestination: s.user.address });

      const tx = await s.vault.connect(s.user).createLock(p);
      const receipt = await tx.wait();

      const topic0 = s.vault.interface.getEvent("CommitVaultLock").topicHash;
      const log = receipt.logs.find(
        (l) => l.address === s.vault.target && l.topics[0] === topic0
      );
      expect(log, "CommitVaultLock not emitted").to.not.equal(undefined);

      // lockId is the first indexed topic — the verifiers read topic(lg, 1).
      expect(log.topics[1]).to.equal(p.lockId);

      // Six data words, in the order every EVM verifier indexes them.
      const rec = await s.vault.getLock(p.lockId);
      const words = [];
      for (let i = 0; i < 6; i++) {
        words.push(BigInt("0x" + log.data.slice(2 + i * 64, 66 + i * 64)));
      }

      expect(words[0]).to.equal(rec.grossAmount);
      expect(words[1]).to.equal(rec.feeAmount);
      expect(words[2]).to.equal(rec.principalAmount);
      expect(words[3]).to.equal(BigInt(rec.durationSecs));
      expect(words[4]).to.equal(BigInt(rec.creationTime));
      expect(words[5]).to.equal(BigInt(rec.maturityTime));

      // Exactly six words — a seventh would shift nothing but signals drift.
      expect(log.data.length).to.equal(2 + 6 * 64);
    });

  it("the lock id the verifiers reconstruct matches C.1's replay identifier",
    async function () {
      const s = await deploy();
      const p = params({ asset: await s.token.getAddress(),
                         baseRecipient: s.user.address,
                         releaseDestination: s.user.address });
      await s.vault.connect(s.user).createLock(p);

      // C.1: env + vault + lock id. This is what EthereumChainVerifier computes.
      const expected = ethers.solidityPackedKeccak256(
        ["string", "address", "bytes32"], ["ethereum", s.vault.target, p.lockId]
      );
      expect(expected).to.be.a("string").with.lengthOf(66);
    });
});
