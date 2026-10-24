// The corrected 5% lock deploy file for the Base-only launch (t357u): the Base
// lock in scripts/deploy-pages/ceremony.json, used by base.html. The test deploys
// the EXACT BaseCommitmentVaultLock bytecode embedded in that file on the
// in-process Hardhat network, with the Base environment and the Base Dev Fund
// from ceremony-data.json, and opens a lock at every one of the sixteen
// durations, Handshake included: the fee taken and paid to the Dev Fund must be
// exactly 5% each time. It also checks the embedded bytecode equals the current
// build, and that no non-Base lock is in the package. Nothing is broadcast.
const { expect } = require("chai");
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

const PAGES = path.join(__dirname, "..", "scripts", "deploy-pages");
const DURATIONS = [3600, 604800, 2592000, 5184000, 7776000, 15552000, 31536000, 63072000, 94608000, 126144000,
  157680000, 189216000, 220752000, 252288000, 283824000, 315360000];

describe("Corrected 5% lock deploy file (Base-only: BaseCommitmentVaultLock)", function () {
  const cer = JSON.parse(fs.readFileSync(path.join(PAGES, "ceremony.json"), "utf8"));
  const data = JSON.parse(fs.readFileSync(path.join(PAGES, "ceremony-data.json"), "utf8"));
  const current = require("../artifacts/contracts/BaseCommitmentVaultLock.sol/BaseCommitmentVaultLock.json").bytecode;

  it("ceremony.json embeds the current BaseCommitmentVaultLock build and no other lock", function () {
    expect(cer.BaseCommitmentVaultLock.bytecode).to.equal(current);
    expect(cer).to.not.have.property("CommitmentVaultLock");
    expect(fs.readdirSync(PAGES).filter((f) => f.endsWith(".html"))).to.deep.equal(["base.html"]);
    expect(ethers.isAddress(data.devFund)).to.equal(true);
  });

  it("Base: 5% fee on all sixteen durations, Handshake included", async function () {
    const [, user] = await ethers.getSigners();
    const t = () => ethers.Wallet.createRandom().address; // stand-in VCLM, CHONX and SYNTH addresses
    const lock = await new ethers.ContractFactory(cer.BaseCommitmentVaultLock.abi, cer.BaseCommitmentVaultLock.bytecode, user)
      .deploy("Base", data.devFund, t(), t(), t());
    expect(await lock.environmentId()).to.equal("Base");
    expect(await lock.devFund()).to.equal(ethers.getAddress(data.devFund));
    expect(await lock.STANDARD_FEE_BPS()).to.equal(500n);
    expect(await lock.BPS_DENOMINATOR()).to.equal(10000n);
    expect(await lock.HANDSHAKE_DURATION()).to.equal(3600n);
    const recipient = ethers.Wallet.createRandom().address;
    for (const d of DURATIONS) {
      const handshake = d === 3600;
      const gross = handshake ? 10n ** 12n : ethers.parseEther("1");
      const usd = handshake ? 15n * 10n ** 15n : 25n * 10n ** 18n; // Handshake within its $0.01-0.02 band
      const before = await ethers.provider.getBalance(data.devFund);
      const lockId = ethers.hexlify(ethers.randomBytes(32));
      const rc = await (await lock.createNativeLock(lockId, recipient, 1, ethers.ZeroHash, ethers.ZeroHash, recipient, d, usd, { value: gross })).wait();
      const ev = rc.logs.map((l) => { try { return lock.interface.parseLog(l); } catch { return null; } }).find((x) => x && x.name === "LockCreated");
      const fee = (gross * 500n) / 10000n;
      expect(ev.args.fee, `Base ${d}s fee`).to.equal(fee);
      expect(ev.args.principal).to.equal(gross - fee);
      expect((await ethers.provider.getBalance(data.devFund)) - before, `Base ${d}s dev fund`).to.equal(fee);
    }
  });
});
