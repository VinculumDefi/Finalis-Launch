// The corrected 5% lock deploy files: Base (scripts/deploy-pages/ceremony.json,
// used by base.html) and the six non-Base EVM pages. For each of the seven, the
// test deploys the EXACT lock bytecode and constructor inputs embedded in the
// file on the in-process Hardhat network, and opens a lock at every one of the
// sixteen durations, Handshake included: the fee taken and paid to the Dev Fund
// must be exactly 5% each time. It also checks the embedded bytecode equals the
// current build. Nothing is broadcast.
const { expect } = require("chai");
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

const PAGES = path.join(__dirname, "..", "scripts", "deploy-pages");
const DURATIONS = [3600, 604800, 2592000, 5184000, 7776000, 15552000, 31536000, 63072000, 94608000, 126144000,
  157680000, 189216000, 220752000, 252288000, 283824000, 315360000];
const NON_BASE = [["Ethereum", "ethereum"], ["Arbitrum", "arbitrum"], ["Optimism", "optimism"], ["Polygon", "polygon"],
  ["BNB Smart Chain", "bnb-smart-chain"], ["Avalanche", "avalanche"]];

function fromPage(file) {
  const h = fs.readFileSync(path.join(PAGES, file + ".html"), "utf8");
  const env = h.match(/^const ENV = (".*?");$/m), df = h.match(/^const DEV_FUND = (".*?");$/m), arts = h.match(/^const ARTS = (\{.*\});$/m);
  if (!env || !df || !arts) throw new Error(file + ": embedded ENV / DEV_FUND / ARTS not found");
  return { env: JSON.parse(env[1]), devFund: JSON.parse(df[1]), abi: JSON.parse(arts[1]).lock.abi, bytecode: JSON.parse(arts[1]).lock.bytecode };
}
function configs() {
  const c = JSON.parse(fs.readFileSync(path.join(PAGES, "ceremony.json"), "utf8"));
  const data = JSON.parse(fs.readFileSync(path.join(PAGES, "ceremony-data.json"), "utf8"));
  const baseDevFund = data.devFund;
  if (typeof baseDevFund !== "string") throw new Error("Base Dev Fund missing from ceremony-data.json");
  return [{ env: "Base", devFund: baseDevFund, abi: c.CommitmentVaultLock.abi, bytecode: c.CommitmentVaultLock.bytecode, file: "ceremony.json" },
    ...NON_BASE.map(([env, f]) => ({ ...fromPage(f), expectEnv: env, file: f + ".html" }))];
}

describe("Corrected 5% lock deploy files (Base + six EVM chains)", function () {
  const current = require("../artifacts/contracts/CommitmentVaultLock.sol/CommitmentVaultLock.json").bytecode;
  const all = configs();

  it("covers seven chain configurations, each embedding the current lock build", function () {
    expect(all.map((c) => c.env)).to.deep.equal(["Base", ...NON_BASE.map((x) => x[0])]);
    for (const c of all) {
      expect(c.bytecode, c.file).to.equal(current);
      if (c.expectEnv) expect(c.env).to.equal(c.expectEnv);
      expect(ethers.isAddress(c.devFund)).to.equal(true);
    }
  });

  for (const cfg of all) {
    it(`${cfg.env}: 5% fee on all sixteen durations, Handshake included`, async function () {
      const [, user] = await ethers.getSigners();
      const lock = await new ethers.ContractFactory(cfg.abi, cfg.bytecode, user).deploy(cfg.env, cfg.devFund);
      expect(await lock.environmentId()).to.equal(cfg.env);
      expect(await lock.devFund()).to.equal(ethers.getAddress(cfg.devFund));
      expect(await lock.STANDARD_FEE_BPS()).to.equal(500n);
      expect(await lock.HANDSHAKE_DURATION()).to.equal(3600n);
      const recipient = ethers.Wallet.createRandom().address;
      for (const d of DURATIONS) {
        const handshake = d === 3600;
        const gross = handshake ? 10n ** 12n : ethers.parseEther("1");
        const usd = handshake ? 15n * 10n ** 15n : 25n * 10n ** 18n; // Handshake within its $0.01-0.02 band
        const before = await ethers.provider.getBalance(cfg.devFund);
        const lockId = ethers.hexlify(ethers.randomBytes(32));
        const rc = await (await lock.createNativeLock(lockId, recipient, 1, ethers.ZeroHash, ethers.ZeroHash, recipient, d, usd, { value: gross })).wait();
        const ev = rc.logs.map((l) => { try { return lock.interface.parseLog(l); } catch { return null; } }).find((x) => x && x.name === "LockCreated");
        const fee = (gross * 500n) / 10000n;
        expect(ev.args.fee, `${cfg.env} ${d}s fee`).to.equal(fee);
        expect(ev.args.principal).to.equal(gross - fee);
        expect((await ethers.provider.getBalance(cfg.devFund)) - before, `${cfg.env} ${d}s dev fund`).to.equal(fee);
      }
    });
  }
});
