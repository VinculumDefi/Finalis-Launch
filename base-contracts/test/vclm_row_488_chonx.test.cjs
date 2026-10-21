// PROOF ONLY (operator t253u/t254u, revised t262u), in-process Hardhat chain,
// nothing broadcast. Rev 6 VF-TOK-007 / VF-REG-008: VCLM is a prohibited
// Commitment Vault Lock input, so VCLM is NOT registry row 488 (t262u: rows
// 488-490 are not written; they do nothing on chain).
//
// The real Base ceremony flow (scripts/deploy-pages/baseCeremonyFlow.js) is
// driven as committed with the real ceremony.json and ceremony-data.json.
//   1. Feeding VCLM in as row 488 with its token address: the Verifier refuses
//      the index write (VF-REG-008) and the ceremony stops before finalize.
//   2. The 487-row ceremony: the Base lock refuses a VCLM lock before any
//      token moves (VF-TOK-007); CHONX still opens after 10,000,000 VCLM from
//      ordinary locks and an ordinary lock then mints CHONX.
const { expect } = require("chai");
const { ethers } = require("hardhat");
const art = require("../scripts/deploy-pages/ceremony.json");
const DATA = require("../scripts/deploy-pages/ceremony-data.json");
const { runBaseCeremony, EVM_ENVS } = require("../scripts/deploy-pages/baseCeremonyFlow.js");

const SCALE = 10n ** 18n;
const DAY7 = 604800n;
const YEAR10 = 315360000n;
const ETH_ID = DATA.row2.canonicalAssetId;
const VCLM_ID = ethers.solidityPackedKeccak256(["string", "string"], ["Base", "VCLM"]);
const VCLM_ROW_488 = { environmentId: "Base", canonicalAssetId: VCLM_ID, symbol: "VCLM", decimals: 18, custodyClass: 3, custodyPath: 1 };
const ETH_PRICE = BigInt(DATA.priceUsd18);
const coder = ethers.AbiCoder.defaultAbiCoder();

async function newLocksFor(signer) {
  const L = new ethers.ContractFactory(art.CommitmentVaultLock.abi, art.CommitmentVaultLock.bytecode, signer);
  const out = {};
  for (const env of EVM_ENVS) out[env] = await (await L.deploy(env, DATA.evmDevFunds[env])).getAddress();
  return out;
}

describe("VCLM is not a lock input: row 488 refused, Base lock refuses VCLM (t262u, test chain)", function () {
  this.timeout(600000);

  it("1: VCLM as row 488 with its token address is refused at the token index (VF-REG-008); no finalize", async () => {
    const [signer] = await ethers.getSigners();
    let vclm = null;
    const logs = [];
    const data = {
      ...DATA,
      get entries() { return vclm ? [...DATA.entries, VCLM_ROW_488] : DATA.entries; },
      get tokenAddresses() { return vclm ? [...DATA.tokenAddresses, { environmentId: "Base", token: vclm, canonicalAssetId: VCLM_ID }] : DATA.tokenAddresses; },
    };
    const log = (s) => {
      logs.push(...String(s).split("\n"));
      const m = /^VCLM (0x[0-9a-fA-F]{40})$/m.exec(s);
      if (m) vclm = ethers.getAddress(m[1]);
    };
    await expect(runBaseCeremony({ ethers, signer, art, data, newLocks: await newLocksFor(signer), log }))
      .to.be.revertedWith("VF-REG-008: protocol token is not a lock input");
    expect(logs).to.include("registry 488/488");
    expect(logs).to.not.include("Finalized.");
  });

  describe("2: the 487-row ceremony", function () {
    let r, signer, user, recipient, dest;
    before(async () => {
      [signer, user, recipient, dest] = await ethers.getSigners();
      r = await runBaseCeremony({ ethers, signer, art, data: DATA, newLocks: await newLocksFor(signer) });
    });
    const pkg = (lockId, rec, receipt = "0x") => ({
      sourceEnvironmentId: "Base", commitmentVaultLockId: lockId, handshakeAllowanceCount: 3,
      canonicalAssetId: ETH_ID, assetPrecision: 18, assetCustodyClass: 2,
      grossAmountSmallestUnits: rec.gross, actualFeeAmountSmallestUnits: rec.fee, principalAmountSmallestUnits: rec.principal,
      feeAssetId: ETH_ID, devFundDestination: DATA.devFund, feeTransferEvidence: ethers.id("fee:" + lockId),
      valuationTimestamp: rec.createdAt, maturityTimestamp: rec.maturity, durationSecs: rec.duration,
      selectedOutputToken: rec.outputToken, baseRecipient: rec.baseRecipient, releaseDestination: dest.address,
      chonxActivationReceipt: receipt, racIdentity: ethers.id("rac:" + lockId), priceRecord: "0x", sourceFinalityProof: "0x",
      lockEventProof: coder.encode(["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
        [lockId, rec.gross, rec.fee, rec.principal, rec.duration, rec.createdAt, rec.maturity]),
    });
    async function ethLockMint(wei, duration, output, receipt) {
      const lockId = ethers.hexlify(ethers.randomBytes(32));
      await (await r.lock.connect(user).createNativeLock(lockId, recipient.address, output, ETH_ID, ethers.ZeroHash, dest.address, duration,
        (wei * ETH_PRICE) / SCALE, { value: wei })).wait();
      const p = pkg(lockId, await r.lock.lockRecord(lockId), receipt);
      await (await r.verifier.recordFeeAndRac(p)).wait();
      return p;
    }

    it("registry 487 rows, VCLM has no row and no index entry", async () => {
      expect((await r.verifier.assetPrecisionTable(ethers.solidityPackedKeccak256(["string", "bytes32"], ["Base", VCLM_ID]))).canonicalAssetId).to.equal(ethers.ZeroHash);
      expect(await r.verifier.tokenAssetIndex(await r.verifier.tokenAddressKey("Base", await r.vclm.getAddress()))).to.equal(ethers.ZeroHash);
    });

    it("an ETH lock mints VCLM; a VCLM lock is refused by the Base lock with nothing moved", async () => {
      await (await r.verifier.verifyAndMint(await ethLockMint(1n * SCALE, DAY7, 0), 0)).wait();
      const amount = 1000n * SCALE;
      const L = await r.lock.getAddress();
      await (await r.vclm.connect(recipient).approve(L, amount)).wait();
      const b0 = await r.vclm.balanceOf(recipient.address);
      await expect(r.lock.connect(recipient).createErc20Lock(ethers.id("vclm-lock"), recipient.address, 1, VCLM_ID, ethers.ZeroHash, dest.address, DAY7,
        await r.vclm.getAddress(), amount, amount / 10n)).to.be.revertedWith("VF-TOK-007: protocol token is not a lock input");
      expect(await r.vclm.balanceOf(recipient.address)).to.equal(b0);
      expect(await r.vclm.balanceOf(L)).to.equal(0n);
      expect(await r.vclm.balanceOf(DATA.devFund)).to.equal(0n);
    });

    it("CHONX opens after 10,000,000 VCLM from an ordinary lock, then an ordinary ETH lock mints CHONX", async () => {
      await expect(r.verifier.verifyAndMint(await ethLockMint(45n * SCALE, YEAR10, 0), 0)).to.emit(r.verifier, "ChonxActivated");
      await (await r.verifier.verifyAndMint(await ethLockMint(1n * SCALE, DAY7, 1, "0x01"), 0)).wait();
      expect(await r.chonx.balanceOf(recipient.address)).to.be.gt(0n);
    });
  });
});
