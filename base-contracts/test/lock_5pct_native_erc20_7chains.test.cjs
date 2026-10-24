// t236u: the 5% CommitmentVaultLock prepared for Base, Ethereum, Arbitrum,
// Optimism, Polygon, BNB Smart Chain and Avalanche C-Chain.
// For each of the seven environment ids, with the Dev Fund from
// deployment/representativeBase.cjs, and for each of the sixteen durations
// (the 1-hour Handshake included), in native coin and in an ERC-20:
//   - the Dev Fund receives exactly floor(5%) of the gross;
//   - exactly 95% (gross minus fee) stays locked in the contract;
//   - release before maturity reverts, release by anyone but the recorded
//     destination reverts, release after maturity pays exactly the principal
//     to the destination once.
// It also checks the contract exposes no fee setter or owner, and exercises the
// read-only post-deploy check in scripts/prepareLockDeploy.cjs (Base only, the
// Base-only launch t357u: every other environment is refused) and its refusal
// to broadcast. The six non-Base contracts are kept in source and tested here,
// but are not deployed. In-process Hardhat network only. Nothing is broadcast.
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { execFileSync } = require("child_process");
const path = require("path");
const { EVM_DEV_FUND } = require("../deployment/representativeBase.cjs");
const prep = require("../scripts/prepareLockDeploy.cjs");

const DURATIONS = prep.DURATIONS;
const ENVS = ["Base", "Ethereum", "Arbitrum", "Optimism", "Polygon", "BNB Smart Chain", "Avalanche"];
const CHAIN_IDS = { Base: 8453, Ethereum: 1, Arbitrum: 42161, Optimism: 10, Polygon: 137, "BNB Smart Chain": 56, Avalanche: 43114 };
const HS_USD = 15n * 10n ** 15n; // $0.015, inside the $0.01-0.02 Handshake band
const STD_USD = 25n * 10n ** 18n;
const fivePct = (g) => (g * 500n) / 10000n;

describe("5% lock, seven chains, native and ERC-20, all sixteen durations", function () {
  it("the duration table matches CommitmentDurations (sixteen rows, Handshake = 3600s)", async function () {
    const lock = await (await ethers.getContractFactory("CommitmentVaultLock")).deploy("Base", EVM_DEV_FUND);
    expect(DURATIONS.length).to.equal(16);
    expect(new Set(DURATIONS).size).to.equal(16);
    expect(DURATIONS[0]).to.equal(Number(await lock.HANDSHAKE_DURATION()));
    const [s] = await ethers.getSigners();
    for (const bad of [0, 3599, 3601, 86400, 315360001]) {
      await expect(lock.connect(s).createNativeLock(ethers.id("bad" + bad), s.address, 0, ethers.ZeroHash, ethers.ZeroHash, s.address, bad, STD_USD, { value: 10n ** 15n }))
        .to.be.revertedWith("CVL: duration");
    }
  });

  it("has no owner, no fee setter: the only state-changing functions are the two lock calls and release", async function () {
    const f = await ethers.getContractFactory("CommitmentVaultLock");
    const writes = f.interface.fragments.filter((x) => x.type === "function" && !["view", "pure"].includes(x.stateMutability)).map((x) => x.name).sort();
    expect(writes).to.deep.equal(["createErc20Lock", "createNativeLock", "release"]);
    const names = f.interface.fragments.filter((x) => x.type === "function").map((x) => x.name.toLowerCase());
    for (const n of names) expect(n).to.not.match(/owner|setfee|set_|admin|pause|upgrade/);
  });

  for (const env of ENVS) {
    describe(`${env} (chain ${CHAIN_IDS[env]})`, function () {
      let lock, token, user, dest, other, devFund;
      before(async function () {
        [, user, dest, other] = await ethers.getSigners();
        // Base-only launch: prepareLockDeploy gives a Dev Fund only for Base; the
        // source-level tests on the other six ids use the same EVM Dev Fund.
        devFund = env === "Base" ? prep.devFundFor(env) : ethers.getAddress(EVM_DEV_FUND);
        expect(devFund).to.equal(ethers.getAddress(EVM_DEV_FUND));
        lock = await (await ethers.getContractFactory("CommitmentVaultLock")).deploy(env, devFund);
        token = await (await ethers.getContractFactory("TestFixtureERC20")).deploy(0);
        await token.mint(user.address, 10n ** 30n);
        await token.connect(user).approve(await lock.getAddress(), ethers.MaxUint256);
        expect(await lock.environmentId()).to.equal(env);
        expect(await lock.devFund()).to.equal(devFund);
        expect(await lock.STANDARD_FEE_BPS()).to.equal(500n);
        expect(await lock.BPS_DENOMINATOR()).to.equal(10000n);
      });

      it("native: exactly 5% to the Dev Fund and 95% locked on all sixteen durations; release only to the destination after maturity", async function () {
        const addr = await lock.getAddress();
        const ids = [];
        for (const d of DURATIONS) {
          const hs = d === 3600;
          // Gross not divisible by 20, so the floor is exercised.
          const gross = (hs ? 10n ** 12n : ethers.parseEther("1.234567")) + 7n;
          const fee = fivePct(gross);
          const id = ethers.id(`${env}-native-${d}`);
          const dfBefore = await ethers.provider.getBalance(devFund);
          const cBefore = await ethers.provider.getBalance(addr);
          await lock.connect(user).createNativeLock(id, user.address, 0, ethers.ZeroHash, ethers.ZeroHash, dest.address, d, hs ? HS_USD : STD_USD, { value: gross });
          expect((await ethers.provider.getBalance(devFund)) - dfBefore, `fee ${d}`).to.equal(fee);
          expect((await ethers.provider.getBalance(addr)) - cBefore, `locked ${d}`).to.equal(gross - fee);
          const r = await lock.lockRecord(id);
          expect(r.fee).to.equal(fee);
          expect(r.principal).to.equal(gross - fee);
          expect(r.releaseDestination).to.equal(dest.address);
          expect(r.asset).to.equal(ethers.ZeroAddress);
          await expect(lock.connect(dest).release(id)).to.be.revertedWith("CVL: immature");
          ids.push([id, r.maturity, gross - fee]);
        }
        for (const [id, maturity, principal] of ids) {
          if (BigInt(await time.latest()) < maturity) await time.increaseTo(maturity);
          await expect(lock.connect(other).release(id)).to.be.revertedWith("CVL: destination");
          await expect(lock.connect(user).release(id)).to.be.revertedWith("CVL: destination");
          await expect(lock.connect(dest).release(id)).to.changeEtherBalances([dest, lock], [principal, -principal]);
          await expect(lock.connect(dest).release(id)).to.be.revertedWith("CVL: already released");
        }
        expect(await ethers.provider.getBalance(addr)).to.equal(0n);
      });

      it("ERC-20: exactly 5% to the Dev Fund and 95% locked on all sixteen durations; release only to the destination after maturity", async function () {
        const addr = await lock.getAddress();
        const tAddr = await token.getAddress();
        const ids = [];
        for (const d of DURATIONS) {
          const hs = d === 3600;
          const gross = (hs ? 10n ** 12n : ethers.parseUnits("987.654321", 18)) + 13n;
          const fee = fivePct(gross);
          const id = ethers.id(`${env}-erc20-${d}`);
          const dfBefore = await token.balanceOf(devFund);
          const cBefore = await token.balanceOf(addr);
          await lock.connect(user).createErc20Lock(id, user.address, 0, ethers.ZeroHash, ethers.ZeroHash, dest.address, d, tAddr, gross, hs ? HS_USD : STD_USD);
          expect((await token.balanceOf(devFund)) - dfBefore, `fee ${d}`).to.equal(fee);
          expect((await token.balanceOf(addr)) - cBefore, `locked ${d}`).to.equal(gross - fee);
          const r = await lock.lockRecord(id);
          expect(r.asset).to.equal(tAddr);
          expect(r.fee).to.equal(fee);
          await expect(lock.connect(dest).release(id)).to.be.revertedWith("CVL: immature");
          ids.push([id, r.maturity, gross - fee]);
        }
        for (const [id, maturity, principal] of ids) {
          if (BigInt(await time.latest()) < maturity) await time.increaseTo(maturity);
          await expect(lock.connect(other).release(id)).to.be.revertedWith("CVL: destination");
          const before = await token.balanceOf(dest.address);
          await lock.connect(dest).release(id);
          expect((await token.balanceOf(dest.address)) - before).to.equal(principal);
          await expect(lock.connect(dest).release(id)).to.be.revertedWith("CVL: already released");
        }
        expect(await token.balanceOf(addr)).to.equal(0n);
      });

      it("Handshake is 5% at both ends of its band, and refused outside the band (no other Handshake path)", async function () {
        for (const usd of [10n ** 16n, 2n * 10n ** 16n]) {
          const gross = 999_999n;
          const id = ethers.id(`${env}-hs-${usd}`);
          const before = await ethers.provider.getBalance(devFund);
          await lock.connect(user).createNativeLock(id, user.address, 0, ethers.ZeroHash, ethers.ZeroHash, dest.address, 3600, usd, { value: gross });
          expect((await ethers.provider.getBalance(devFund)) - before).to.equal(49_999n);
        }
        for (const usd of [10n ** 16n - 1n, 2n * 10n ** 16n + 1n]) {
          await expect(lock.connect(user).createNativeLock(ethers.id(`${env}-hsx-${usd}`), user.address, 0, ethers.ZeroHash, ethers.ZeroHash, dest.address, 3600, usd, { value: 10n ** 12n }))
            .to.be.revertedWith("CVL: handshake usd");
        }
      });
    });
  }

  describe("scripts/prepareLockDeploy.cjs (dry run, read-only check)", function () {
    // Base-only launch (t357u): nothing is prepared for the six non-Base chains;
    // the source contract is still tested above but is not deployed.
    it("refuses every environment other than Base (no non-Base lock is prepared or checked)", async function () {
      const [, probe] = await ethers.getSigners();
      expect(prep).to.not.have.property("prepare");
      const plain = await (await ethers.getContractFactory("CommitmentVaultLock")).deploy("Polygon", EVM_DEV_FUND);
      for (const env of ENVS.filter((e) => e !== "Base")) {
        await expect(prep.check(ethers.provider, env, await plain.getAddress(), { probeFrom: probe.address }), env).to.be.rejectedWith(/Base-only launch/);
        expect(() => prep.devFundFor(env), env).to.throw(/Base-only launch/);
      }
      const script = path.join(__dirname, "..", "scripts", "prepareLockDeploy.cjs");
      let refused = "";
      try { execFileSync(process.execPath, [script, "--check", "Polygon", await plain.getAddress()], { stdio: "pipe" }); } catch (e) { refused = String(e.stderr); }
      expect(refused).to.match(/REFUSED: Base-only launch/);
    });

    it("--check Base passes on a BaseCommitmentVaultLock bound to VCLM, CHONX and SYNTH, and fails on wrong token addresses", async function () {
      const [d, probe] = await ethers.getSigners();
      const T = await ethers.getContractFactory("VinculumFinalisToken");
      const vclm = await T.deploy("Vinculum Finalis VCLM", "VCLM", 10n ** 28n);
      const chonx = await T.deploy("Vinculum Finalis CHONX", "CHONX", 10n ** 29n);
      const v = await (await ethers.getContractFactory("VinculumFinalisVerifier")).deploy(await vclm.getAddress(), await chonx.getAddress());
      const forge = await (await ethers.getContractFactory("VinculumFinalisSynth")).deploy(await v.getAddress(), await vclm.getAddress(), await chonx.getAddress());
      const B = await ethers.getContractFactory("BaseCommitmentVaultLock");
      const good = await B.deploy("Base", EVM_DEV_FUND, await vclm.getAddress(), await chonx.getAddress(), await forge.getAddress());
      const r = await prep.check(ethers.provider, "Base", await good.getAddress(), { probeFrom: probe.address });
      expect(r.pass, JSON.stringify(r.results.filter((x) => !x.pass))).to.equal(true);
      expect(r.results.filter((x) => /duration \d+s: fee is exactly 5%/.test(x.name)).length).to.equal(16);
      const swapped = await B.deploy("Base", EVM_DEV_FUND, await chonx.getAddress(), await vclm.getAddress(), await forge.getAddress());
      expect((await prep.check(ethers.provider, "Base", await swapped.getAddress(), { probeFrom: probe.address })).pass).to.equal(false);
      const plain = await (await ethers.getContractFactory("CommitmentVaultLock")).deploy("Base", EVM_DEV_FUND);
      await expect(prep.check(ethers.provider, "Base", await plain.getAddress(), { probeFrom: probe.address })).to.be.rejected;
      void d;
    });

    it("refuses --broadcast and reads no key material", function () {
      const script = path.join(__dirname, "..", "scripts", "prepareLockDeploy.cjs");
      let refused = "";
      try { execFileSync(process.execPath, [script, "--broadcast", "--no-rpc"], { stdio: "pipe" }); } catch (e) { refused = String(e.stderr); }
      expect(refused).to.match(/REFUSED: this script never broadcasts/);
      const src = require("fs").readFileSync(script, "utf8");
      expect(src).to.not.match(/process\.env|PRIVATE_KEY|mnemonic\s*[:=(]|new\s+(ethers\.)?Wallet|sendTransaction|eth_sendRawTransaction|eth_sendTransaction/i);
    });
  });
});
