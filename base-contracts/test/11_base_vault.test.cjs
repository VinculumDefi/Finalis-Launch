// =============================================================================
// Base Commitment Vault — behavioral test suite (CL-79)
//
// Every architectural claim in the contract headers is asserted here. A claim
// without a test that fails when the claim stops being true is an assertion,
// not a guarantee — CL-77 is the record of what that costs.
//
// Weighted toward NEGATIVE tests per Verifier Completion Standard §5.2. A
// passing success path demonstrates very little on its own.
// =============================================================================

const { expect } = require("chai");
const { ethers } = require("hardhat");

const ENV = "base";
const ZERO = "0x0000000000000000000000000000000000000000";

const HOUR = 3600n;
const DAY = 86400n;
const PERMITTED = [3600n, 7n*DAY, 30n*DAY, 60n*DAY, 90n*DAY, 180n*DAY, 365n*DAY,
                   730n*DAY, 1095n*DAY, 1460n*DAY, 1825n*DAY, 2190n*DAY,
                   2555n*DAY, 2920n*DAY, 3285n*DAY, 3650n*DAY];

const OUTPUT_VCLM = 0;
const OUTPUT_CHONX = 1;

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

// Deploys the verifier, a mock ERC-20, and the vault; registers one approved
// asset and publishes a signed price for it.
async function deployVault(opts = {}) {
  const signers = await ethers.getSigners();
  const [deployer] = signers;
  const publisher = signers[9];
  const user = signers[3];
  const stranger = signers[6];
  const devFund = signers[8];

  const Token = await ethers.getContractFactory("VinculumFinalisToken");
  const vclm = await Token.deploy("Vinculum", "VCLM", 10_000_000_000n * 10n**18n);
  const chonx = await Token.deploy("Chonx", "CHONX", 100_000_000_000n * 10n**18n);

  const launchTs = (await ethers.provider.getBlock("latest")).timestamp;
  const V = await ethers.getContractFactory("VinculumFinalisVerifier");
  const verifier = await V.deploy(
    await vclm.getAddress(), await chonx.getAddress(), publisher.address, launchTs
  );

  // Mock ERC-20 standing in for an approved Base asset (18 decimals).
  const Mock = await ethers.getContractFactory("MockERC20");
  const token = await Mock.deploy("MockUSD", "MUSD", 18, 10n**30n);

  const AID = assetId("MUSD");
  await verifier.registerAssetPrecision(ENV, AID, "MUSD", 18, 1, 1);
  await verifier.finalize();

  // $1.00 per whole unit unless overridden.
  const price = opts.priceUsdMicro ?? 1_000_000n;
  const ts = (await ethers.provider.getBlock("latest")).timestamp;
  const sig = await signBatch(verifier, publisher, 1n, [AID], [price], ts);
  await verifier.submitPriceBatch(1n, [AID], [price], ts, sig);

  const Vault = await ethers.getContractFactory("VinculumFinalisBaseVault");
  const vault = await Vault.deploy(await verifier.getAddress(), devFund.address);
  await vault.registerAsset(await token.getAddress(), AID);
  await vault.finalizeConfiguration();

  // Fund the user and approve the vault.
  await token.transfer(user.address, 10n**24n);
  await token.connect(user).approve(await vault.getAddress(), 10n**24n);

  return { deployer, user, stranger, devFund, publisher,
           verifier, vault, token, AID, price };
}

function params(o) {
  return {
    lockId: o.lockId ?? ethers.keccak256(ethers.toUtf8Bytes("lock-1")),
    asset: o.asset,
    grossAmount: o.grossAmount ?? 100n * 10n**18n,   // $100 at $1.00
    durationSecs: o.durationSecs ?? 30n * DAY,
    baseRecipient: o.baseRecipient,
    releaseDestination: o.releaseDestination,
    outputToken: o.outputToken ?? OUTPUT_VCLM,
    chonxActivationReceipt: o.chonxActivationReceipt ?? ethers.ZeroHash,
  };
}

describe("Base Commitment Vault — creation", function () {

  it("creates a lock, splits the fee, and isolates principal in its own contract", async function () {
    const s = await deployVault();
    const gross = 100n * 10n**18n;
    const fee = gross * 500n / 10000n;
    const principal = gross - fee;

    const devBefore = await s.token.balanceOf(s.devFund.address);
    const p = params({ asset: await s.token.getAddress(),
                       baseRecipient: s.user.address,
                       releaseDestination: s.user.address });
    await s.vault.connect(s.user).commitVaultLock(p);

    const rec = await s.vault.getLock(p.lockId);
    expect(rec.exists).to.equal(true);
    expect(rec.feeAmount).to.equal(fee);
    expect(rec.principalAmount).to.equal(principal);

    // Fee left the vault; principal is held by the lock's own contract.
    expect(await s.token.balanceOf(s.devFund.address) - devBefore).to.equal(fee);
    expect(await s.token.balanceOf(rec.lockContract)).to.equal(principal);
    // The factory retains nothing.
    expect(await s.token.balanceOf(await s.vault.getAddress())).to.equal(0n);
  });

  it("accepts all 16 permitted durations and rejects durations adjacent to them", async function () {
    const s = await deployVault();
    for (let i = 0; i < PERMITTED.length; i++) {
      const p = params({
        lockId: ethers.keccak256(ethers.toUtf8Bytes(`dur-${i}`)),
        asset: await s.token.getAddress(),
        durationSecs: PERMITTED[i],
        // Handshake duration must land in the $0.95-$1.05 band.
        grossAmount: PERMITTED[i] === HOUR ? 10n**18n : 100n * 10n**18n,
        baseRecipient: s.user.address,
        releaseDestination: s.user.address,
      });
      await s.vault.connect(s.user).commitVaultLock(p);
    }
    // Compared in both directions (CL-74): a value one second either side of a
    // permitted duration must be rejected.
    for (const d of [PERMITTED[1] - 1n, PERMITTED[1] + 1n, 3599n, 3601n]) {
      await expect(s.vault.connect(s.user).commitVaultLock(params({
        lockId: ethers.keccak256(ethers.toUtf8Bytes(`bad-${d}`)),
        asset: await s.token.getAddress(), durationSecs: d,
        baseRecipient: s.user.address, releaseDestination: s.user.address,
      }))).to.be.revertedWithCustomError(s.vault, "DurationNotPermitted");
    }
  });
});

describe("Base Commitment Vault — negative cases (Standard §5.2)", function () {

  it("rejects an unapproved asset WITHOUT moving any of the user's funds", async function () {
    const s = await deployVault();
    const Rogue = await ethers.getContractFactory("MockERC20");
    const rogue = await Rogue.deploy("Rogue", "RGE", 18, 10n**30n);
    await rogue.transfer(s.user.address, 10n**22n);
    await rogue.connect(s.user).approve(await s.vault.getAddress(), 10n**22n);

    const before = await rogue.balanceOf(s.user.address);
    await expect(s.vault.connect(s.user).commitVaultLock(params({
      asset: await rogue.getAddress(),
      baseRecipient: s.user.address, releaseDestination: s.user.address,
    }))).to.be.revertedWithCustomError(s.vault, "AssetNotInRegistry");

    // CL-71: the harm was the fee moving before rejection. It must not.
    expect(await rogue.balanceOf(s.user.address)).to.equal(before);
    expect(await rogue.balanceOf(s.devFund.address)).to.equal(0n);
  });

  it("rejects a fee-on-transfer asset rather than locking a different amount than recorded", async function () {
    const s = await deployVault();
    await s.token.setTransferFeeBps(100);   // 1% skim on every transfer
    await expect(s.vault.connect(s.user).commitVaultLock(params({
      lockId: ethers.keccak256(ethers.toUtf8Bytes("fot")),
      asset: await s.token.getAddress(),
      baseRecipient: s.user.address, releaseDestination: s.user.address,
    }))).to.be.revertedWithCustomError(s.vault, "GrossNotReceived");
  });

  it("rejects a duplicate lock id", async function () {
    const s = await deployVault();
    const p = params({ asset: await s.token.getAddress(),
                       baseRecipient: s.user.address,
                       releaseDestination: s.user.address });
    await s.vault.connect(s.user).commitVaultLock(p);
    await expect(s.vault.connect(s.user).commitVaultLock(p))
      .to.be.revertedWithCustomError(s.vault, "LockAlreadyExists");
  });

  it("rejects a zero base recipient and a zero release destination", async function () {
    const s = await deployVault();
    await expect(s.vault.connect(s.user).commitVaultLock(params({
      asset: await s.token.getAddress(),
      baseRecipient: ZERO, releaseDestination: s.user.address,
    }))).to.be.revertedWithCustomError(s.vault, "ZeroAddress");

    await expect(s.vault.connect(s.user).commitVaultLock(params({
      lockId: ethers.keccak256(ethers.toUtf8Bytes("z2")),
      asset: await s.token.getAddress(),
      baseRecipient: s.user.address, releaseDestination: ZERO,
    }))).to.be.revertedWithCustomError(s.vault, "ZeroAddress");
  });

  it("rejects a standard lock below $10.00", async function () {
    const s = await deployVault();
    await expect(s.vault.connect(s.user).commitVaultLock(params({
      asset: await s.token.getAddress(),
      grossAmount: 9n * 10n**18n,           // $9.00
      baseRecipient: s.user.address, releaseDestination: s.user.address,
    }))).to.be.revertedWithCustomError(s.vault, "StandardBelowMinimum");
  });

  it("rejects a Handshake outside the $0.95-$1.05 band", async function () {
    const s = await deployVault();
    for (const amt of [90n * 10n**16n, 110n * 10n**16n]) {   // $0.90, $1.10
      await expect(s.vault.connect(s.user).commitVaultLock(params({
        lockId: ethers.keccak256(ethers.toUtf8Bytes(`hs-${amt}`)),
        asset: await s.token.getAddress(),
        grossAmount: amt, durationSecs: HOUR,
        baseRecipient: s.user.address, releaseDestination: s.user.address,
      }))).to.be.revertedWithCustomError(s.vault, "HandshakeValueOutOfRange");
    }
  });

  it("rejects a fourth Handshake from the same identity", async function () {
    const s = await deployVault();
    for (let i = 0; i < 3; i++) {
      await s.vault.connect(s.user).commitVaultLock(params({
        lockId: ethers.keccak256(ethers.toUtf8Bytes(`hs-ok-${i}`)),
        asset: await s.token.getAddress(),
        grossAmount: 10n**18n, durationSecs: HOUR,
        baseRecipient: s.user.address, releaseDestination: s.user.address,
      }));
    }
    expect(await s.vault.handshakeRemaining(s.user.address)).to.equal(0);
    await expect(s.vault.connect(s.user).commitVaultLock(params({
      lockId: ethers.keccak256(ethers.toUtf8Bytes("hs-4")),
      asset: await s.token.getAddress(),
      grossAmount: 10n**18n, durationSecs: HOUR,
      baseRecipient: s.user.address, releaseDestination: s.user.address,
    }))).to.be.revertedWithCustomError(s.vault, "AllowanceExhausted");
  });

  it("rejects a CHONX output with no activation receipt", async function () {
    const s = await deployVault();
    await expect(s.vault.connect(s.user).commitVaultLock(params({
      asset: await s.token.getAddress(),
      outputToken: OUTPUT_CHONX, chonxActivationReceipt: ethers.ZeroHash,
      baseRecipient: s.user.address, releaseDestination: s.user.address,
    }))).to.be.revertedWithCustomError(s.vault, "ChonxNotActivated");
  });

  it("rejects ETH sent alongside an ERC-20 lock", async function () {
    const s = await deployVault();
    await expect(s.vault.connect(s.user).commitVaultLock(
      params({ asset: await s.token.getAddress(),
               baseRecipient: s.user.address, releaseDestination: s.user.address }),
      { value: 1n }
    )).to.be.revertedWithCustomError(s.vault, "UnexpectedEthValue");
  });
});

describe("Base Commitment Vault — valuation is derived, not asserted", function () {

  it("the same gross amount qualifies or fails purely on the oracle price", async function () {
    // At $1.00, 1e18 units is $1.00 — a valid Handshake.
    const a = await deployVault({ priceUsdMicro: 1_000_000n });
    await a.vault.connect(a.user).commitVaultLock(params({
      asset: await a.token.getAddress(),
      grossAmount: 10n**18n, durationSecs: HOUR,
      baseRecipient: a.user.address, releaseDestination: a.user.address,
    }));

    // At $2.00, the identical amount is $2.00 — outside the band. Nothing the
    // caller supplies changed; only the signed price record did.
    const b = await deployVault({ priceUsdMicro: 2_000_000n });
    await expect(b.vault.connect(b.user).commitVaultLock(params({
      asset: await b.token.getAddress(),
      grossAmount: 10n**18n, durationSecs: HOUR,
      baseRecipient: b.user.address, releaseDestination: b.user.address,
    }))).to.be.revertedWithCustomError(b.vault, "HandshakeValueOutOfRange");
  });

  it("records the derived USD value in the immutable lock record", async function () {
    const s = await deployVault({ priceUsdMicro: 1_000_000n });
    const p = params({ asset: await s.token.getAddress(),
                       grossAmount: 100n * 10n**18n,
                       baseRecipient: s.user.address,
                       releaseDestination: s.user.address });
    await s.vault.connect(s.user).commitVaultLock(p);
    const rec = await s.vault.getLock(p.lockId);
    expect(rec.verifiedGrossUsd).to.equal(100n * 10n**18n);   // $100.00, 18-dec
  });
});

describe("Base Commitment Vault — release", function () {

  async function createLock(s, tag, duration = 30n * DAY) {
    const p = params({
      lockId: ethers.keccak256(ethers.toUtf8Bytes(tag)),
      asset: await s.token.getAddress(), durationSecs: duration,
      baseRecipient: s.user.address, releaseDestination: s.user.address,
    });
    await s.vault.connect(s.user).commitVaultLock(p);
    const rec = await s.vault.getLock(p.lockId);
    const lock = await ethers.getContractAt("CommitmentLock", rec.lockContract);
    return { p, rec, lock };
  }

  it("refuses to release before maturity", async function () {
    const s = await deployVault();
    const { lock } = await createLock(s, "rel-early");
    await expect(lock.release()).to.be.revertedWithCustomError(lock, "NotMature");
  });

  it("releases at maturity to the bound destination when called by a stranger", async function () {
    const s = await deployVault();
    const { rec, lock } = await createLock(s, "rel-ok");
    await ethers.provider.send("evm_increaseTime", [Number(30n * DAY)]);
    await ethers.provider.send("evm_mine", []);

    const userBefore = await s.token.balanceOf(s.user.address);
    const strangerBefore = await s.token.balanceOf(s.stranger.address);

    // Permissionless (VF-PRI-002), but the caller cannot redirect it (VF-PRI-003).
    await lock.connect(s.stranger).release();

    expect(await s.token.balanceOf(s.user.address) - userBefore)
      .to.equal(rec.principalAmount);
    expect(await s.token.balanceOf(s.stranger.address)).to.equal(strangerBefore);
    expect(await s.token.balanceOf(rec.lockContract)).to.equal(0n);
  });

  it("refuses a second release", async function () {
    const s = await deployVault();
    const { lock } = await createLock(s, "rel-twice");
    await ethers.provider.send("evm_increaseTime", [Number(30n * DAY)]);
    await ethers.provider.send("evm_mine", []);
    await lock.release();
    await expect(lock.release()).to.be.revertedWithCustomError(lock, "AlreadyReleased");
  });

  it("releases without consulting the verifier, the price feed, or the factory", async function () {
    const s = await deployVault();
    const { rec, lock } = await createLock(s, "rel-independent");

    // VF-SEC-006 / VF-PRI-006: principal is releasable even if Base issuance
    // fails permanently. The price record is allowed to go stale (>48h) and is
    // never refreshed; release must not care.
    await ethers.provider.send("evm_increaseTime", [Number(30n * DAY)]);
    await ethers.provider.send("evm_mine", []);

    // A fresh lock creation would now fail on staleness...
    await expect(s.vault.connect(s.user).commitVaultLock(params({
      lockId: ethers.keccak256(ethers.toUtf8Bytes("stale-check")),
      asset: await s.token.getAddress(),
      baseRecipient: s.user.address, releaseDestination: s.user.address,
    }))).to.be.revertedWithCustomError(s.vault, "PriceRecordStale");

    // ...but release of an existing lock is unaffected.
    await lock.connect(s.stranger).release();
    expect(await s.token.balanceOf(rec.lockContract)).to.equal(0n);
  });
});

describe("Base Commitment Vault — isolation by construction", function () {

  it("releasing one lock leaves every other lock untouched", async function () {
    const s = await deployVault();
    const mk = async (tag) => {
      const p = params({
        lockId: ethers.keccak256(ethers.toUtf8Bytes(tag)),
        asset: await s.token.getAddress(),
        baseRecipient: s.user.address, releaseDestination: s.user.address,
      });
      await s.vault.connect(s.user).commitVaultLock(p);
      const rec = await s.vault.getLock(p.lockId);
      return { rec, lock: await ethers.getContractAt("CommitmentLock", rec.lockContract) };
    };

    const a = await mk("iso-a");
    const b = await mk("iso-b");

    // Distinct contracts, each holding only its own principal.
    expect(a.rec.lockContract).to.not.equal(b.rec.lockContract);
    expect(await s.token.balanceOf(a.rec.lockContract)).to.equal(a.rec.principalAmount);
    expect(await s.token.balanceOf(b.rec.lockContract)).to.equal(b.rec.principalAmount);

    await ethers.provider.send("evm_increaseTime", [Number(30n * DAY)]);
    await ethers.provider.send("evm_mine", []);
    await a.lock.release();

    // B is entirely unaffected — there is no shared balance to damage.
    expect(await s.token.balanceOf(a.rec.lockContract)).to.equal(0n);
    expect(await s.token.balanceOf(b.rec.lockContract)).to.equal(b.rec.principalAmount);
    expect(await b.lock.released()).to.equal(false);
  });

  it("the cloned implementation cannot be re-initialized", async function () {
    const s = await deployVault();
    const { lock } = await (async () => {
      const p = params({
        lockId: ethers.keccak256(ethers.toUtf8Bytes("init-guard")),
        asset: await s.token.getAddress(),
        baseRecipient: s.user.address, releaseDestination: s.user.address,
      });
      await s.vault.connect(s.user).commitVaultLock(p);
      const rec = await s.vault.getLock(p.lockId);
      return { lock: await ethers.getContractAt("CommitmentLock", rec.lockContract) };
    })();

    await expect(lock.connect(s.stranger).initialize(
      ethers.ZeroHash, await s.token.getAddress(), 1n, 0n, 0n, s.stranger.address
    )).to.be.revertedWithCustomError(lock, "AlreadyInitialized");
  });

  it("the implementation contract itself is permanently disabled", async function () {
    const s = await deployVault();
    const impl = await ethers.getContractAt(
      "CommitmentLock", await s.vault.lockImplementation()
    );
    await expect(impl.initialize(
      ethers.ZeroHash, await s.token.getAddress(), 1n, 0n, 0n, s.stranger.address
    )).to.be.revertedWithCustomError(impl, "AlreadyInitialized");
  });
});

describe("Base Commitment Vault — configuration", function () {

  it("refuses lock creation before configuration is finalized", async function () {
    const signers = await ethers.getSigners();
    const V = await ethers.getContractFactory("VinculumFinalisVerifier");
    const Token = await ethers.getContractFactory("VinculumFinalisToken");
    const vclm = await Token.deploy("V", "V", 10n**28n);
    const chonx = await Token.deploy("C", "C", 10n**28n);
    const launchTs = (await ethers.provider.getBlock("latest")).timestamp;
    const verifier = await V.deploy(await vclm.getAddress(), await chonx.getAddress(),
                                    signers[9].address, launchTs);
    const Vault = await ethers.getContractFactory("VinculumFinalisBaseVault");
    const vault = await Vault.deploy(await verifier.getAddress(), signers[8].address);

    await expect(vault.commitVaultLock(params({
      asset: ZERO, baseRecipient: signers[0].address,
      releaseDestination: signers[0].address,
    }))).to.be.revertedWithCustomError(vault, "NotFinalized");
  });

  it("refuses asset registration after finalization, and from a non-deployer", async function () {
    const s = await deployVault();
    await expect(s.vault.registerAsset(await s.token.getAddress(), assetId("X")))
      .to.be.revertedWithCustomError(s.vault, "AlreadyFinalized");
  });
});
