// t298u: the non-Base CommitmentVaultLock refuses VCLM, CHONX and SYNTH as lock
// inputs (Revision 6 VF-TOK-007 / VF-REG-008), the same rule as
// BaseCommitmentVaultLock. On non-Base chains these tokens can only exist later
// as Axelar ITS copies whose addresses are unknown at lock deploy time, so the
// lock refuses by the Base tokens' name and symbol. The refusal comes before
// transferFrom, fee routing and any state change. Local Hardhat only.
const { expect } = require("chai");
const { ethers } = require("hardhat");

const DAY30 = 2592000;
const HOUR = 3600;
const USD = 10n ** 18n;
const REFUSE = "VF-TOK-007: protocol token is not a lock input";
const ENVS = ["Ethereum", "Arbitrum", "Optimism", "Polygon", "BNB Smart Chain", "Avalanche"];
const PROTOCOL = [
  ["VCLM", "Vinculum Finalis VCLM"],
  ["CHONX", "Vinculum Finalis CHONX"],
  ["SYNTH", "Vinculum Finalis SYNTH"],
];
const b32 = (s) => ethers.encodeBytes32String(s);

describe("t298u non-Base lock refuses VCLM, CHONX and SYNTH (VF-TOK-007 / VF-REG-008)", function () {
  this.timeout(120000);
  let user, devFund, recipient, dest, lock;

  beforeEach(async () => {
    [, user, devFund, recipient, dest] = await ethers.getSigners();
    lock = await (await ethers.getContractFactory("CommitmentVaultLock")).deploy("Ethereum", devFund.address);
  });

  async function funded(factory, args) {
    const t = await (await ethers.getContractFactory(factory)).deploy(...args);
    await t.mint(user.address, 1000n * USD);
    await t.connect(user).approve(await lock.getAddress(), 1000n * USD);
    return t;
  }

  function create(token, lockId, duration = DAY30, usd = USD, amount = 100n * USD) {
    return lock
      .connect(user)
      .createErc20Lock(lockId, recipient.address, 0, ethers.ZeroHash, ethers.ZeroHash, dest.address, duration, token, amount, usd, { gasLimit: 2_000_000 });
  }

  async function expectRefusedUnchanged(token, duration, usd) {
    const tokenAddr = await token.getAddress();
    const lockAddr = await lock.getAddress();
    const lockId = ethers.id("refused-" + tokenAddr + "-" + duration);
    const before = {
      user: await token.balanceOf(user.address),
      allowance: await token.allowance(user.address, lockAddr),
      devFund: await token.balanceOf(devFund.address),
      lock: await token.balanceOf(lockAddr),
      supply: await token.totalSupply(),
    };
    const fromBlock = (await ethers.provider.getBlockNumber()) + 1;
    await expect(create(tokenAddr, lockId, duration, usd)).to.be.revertedWith(REFUSE);
    expect(await token.balanceOf(user.address)).to.equal(before.user);
    expect(await token.allowance(user.address, lockAddr)).to.equal(before.allowance);
    expect(await token.balanceOf(devFund.address)).to.equal(before.devFund);
    expect(await token.balanceOf(lockAddr)).to.equal(before.lock);
    expect(await token.totalSupply()).to.equal(before.supply);
    const logs = await ethers.provider.getLogs({ fromBlock, toBlock: "latest" });
    expect(logs, "no events from any contract").to.have.length(0);
    const rec = await lock.lockRecord(lockId);
    expect(rec.exists, "no lock record").to.equal(false);
    await expect(lock.requireLockRecord(lockId)).to.be.revertedWith("VF-XCH-024: Base lock record absent");
  }

  for (const [symbol, name] of PROTOCOL) {
    it(`${symbol} copy (ITS-style, same name and symbol): refused; balances, allowance, Dev Fund, events and lock record unchanged`, async () => {
      const t = await funded("ProtocolCopyFixtureERC20", [name, symbol]);
      expect(await lock.isProtocolToken(await t.getAddress())).to.equal(true);
      await expectRefusedUnchanged(t, DAY30, USD);
      // The 1-hour Handshake is refused the same way.
      await expectRefusedUnchanged(t, HOUR, USD / 100n);
    });

    it(`${symbol}: refused by symbol alone and by name alone, and in bytes32 form`, async () => {
      const bySymbol = await funded("ProtocolCopyFixtureERC20", ["Some Other Name", symbol]);
      const byName = await funded("ProtocolCopyFixtureERC20", [name, "XYZ"]);
      const b32sym = await funded("Bytes32MetadataFixtureERC20", [b32("Other"), b32(symbol)]);
      const b32name = await funded("Bytes32MetadataFixtureERC20", [b32(name), b32("XYZ")]);
      for (const t of [bySymbol, byName, b32sym, b32name]) await expectRefusedUnchanged(t, DAY30, USD);
    });
  }

  it("the real Base token contracts are recognised: VinculumFinalisToken VCLM / CHONX and VinculumFinalisSynth", async () => {
    const Token = await ethers.getContractFactory("VinculumFinalisToken");
    const vclm = await Token.deploy("Vinculum Finalis VCLM", "VCLM", 10n ** 28n);
    const chonx = await Token.deploy("Vinculum Finalis CHONX", "CHONX", 10n ** 29n);
    expect(await lock.isProtocolToken(await vclm.getAddress())).to.equal(true);
    expect(await lock.isProtocolToken(await chonx.getAddress())).to.equal(true);
    const synth = await (await ethers.getContractFactory("VinculumFinalisSynth")).deploy(user.address, await vclm.getAddress(), await chonx.getAddress());
    expect(await synth.symbol()).to.equal("SYNTH");
    expect(await lock.isProtocolToken(await synth.getAddress())).to.equal(true);
  });

  it("the refusal is the first check: it fires even with a bad duration, zero USD and an amount above the allowance", async () => {
    const t = await funded("ProtocolCopyFixtureERC20", ["Vinculum Finalis VCLM", "VCLM"]);
    await expect(
      lock.connect(user).createErc20Lock(ethers.id("first"), recipient.address, 0, ethers.ZeroHash, ethers.ZeroHash, dest.address, 12345, await t.getAddress(), 10n ** 30n, 0)
    ).to.be.revertedWith(REFUSE);
  });

  it("the same refusal holds on all six non-Base lock deployments", async () => {
    const t = await funded("ProtocolCopyFixtureERC20", ["Vinculum Finalis SYNTH", "SYNTH"]);
    const F = await ethers.getContractFactory("CommitmentVaultLock");
    for (const env of ENVS) {
      const l = await F.deploy(env, devFund.address);
      expect(await l.environmentId()).to.equal(env);
      expect(await l.isProtocolToken(await t.getAddress()), env).to.equal(true);
    }
  });

  it("a normal ERC-20 still locks: 5% to the Dev Fund, principal held, record and events present", async () => {
    const t = await funded("TestFixtureERC20", [0]);
    const tokenAddr = await t.getAddress();
    expect(await lock.isProtocolToken(tokenAddr)).to.equal(false);
    const lockId = ethers.id("normal-erc20");
    const gross = 100n * USD;
    const fee = (gross * 500n) / 10000n;
    await expect(create(tokenAddr, lockId))
      .to.emit(lock, "LockCreated")
      .and.to.emit(lock, "FeeRouted")
      .withArgs(lockId, devFund.address, tokenAddr, fee);
    expect(await t.balanceOf(devFund.address)).to.equal(fee);
    expect(await t.balanceOf(await lock.getAddress())).to.equal(gross - fee);
    expect(await t.balanceOf(user.address)).to.equal(1000n * USD - gross);
    const rec = await lock.lockRecord(lockId);
    expect(rec.exists).to.equal(true);
    expect(rec.asset).to.equal(tokenAddr);
    expect(rec.fee).to.equal(fee);
    expect(rec.principal).to.equal(gross - fee);
  });

  it("normal tokens whose name()/symbol() revert or return other bytes32 values still lock", async () => {
    for (const [factory, args] of [
      ["RevertingMetadataFixtureERC20", []],
      ["Bytes32MetadataFixtureERC20", [b32("Maker"), b32("MKR")]],
      ["ProtocolCopyFixtureERC20", ["USD Coin", "USDC"]],
    ]) {
      const t = await funded(factory, args);
      expect(await lock.isProtocolToken(await t.getAddress()), factory).to.equal(false);
      const lockId = ethers.id("normal-" + factory + args.join());
      await create(await t.getAddress(), lockId);
      expect((await lock.lockRecord(lockId)).exists, factory).to.equal(true);
      expect(await t.balanceOf(devFund.address), factory).to.equal(5n * USD);
    }
  });

  it("native locks are unaffected", async () => {
    const lockId = ethers.id("native");
    await lock.connect(user).createNativeLock(lockId, recipient.address, 0, ethers.ZeroHash, ethers.ZeroHash, dest.address, DAY30, USD, { value: 10n ** 15n });
    expect((await lock.lockRecord(lockId)).exists).to.equal(true);
  });
});
