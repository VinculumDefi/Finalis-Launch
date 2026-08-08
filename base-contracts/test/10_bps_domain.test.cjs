const { expect } = require("chai");
const { ethers } = require("hardhat");

// ---------------------------------------------------------------------------
// Implementation-domain narrowing audit — basis-point fields and discriminators
// in the staking contract.
//
// The concern is not the width of the destination. It is whether any
// intermediate expression can exceed its operands' type before widening.
// A uint256 destination does not rescue uint16 * uint16.
// ---------------------------------------------------------------------------

const ZERO = "0x0000000000000000000000000000000000000000";
const D120 = 120n * 86400n;
const D30 = 30n * 86400n;

async function deploy() {
  const sg = await ethers.getSigners();
  const [deployer] = sg;
  const T = await ethers.getContractFactory("VinculumFinalisToken");
  const vclm = await T.deploy("V", "V", 10n ** 30n);
  const chonx = await T.deploy("C", "C", 10n ** 30n);
  const synth = await T.deploy("S", "S", 10n ** 30n);
  const launchTs = (await ethers.provider.getBlock("latest")).timestamp;
  const V = await ethers.getContractFactory("VinculumFinalisVerifier");
  const v = await V.deploy(await vclm.getAddress(), await chonx.getAddress(), sg[9].address, launchTs);
  const S = await ethers.getContractFactory("VinculumFinalisStake");
  const stake = await S.deploy(
    await vclm.getAddress(), await chonx.getAddress(),
    await synth.getAddress(), await v.getAddress(), launchTs);
  await vclm.initialize(await v.getAddress(), await stake.getAddress());
  await chonx.initialize(await v.getAddress(), ZERO);
  await synth.initialize(await v.getAddress(), ZERO);
  return { deployer, vclm, chonx, synth, v, stake };
}

async function mint(s, token, to, amount) {
  const va = await s.v.getAddress();
  await ethers.provider.send("hardhat_impersonateAccount", [va]);
  await ethers.provider.send("hardhat_setBalance", [va, "0x8AC7230489E80000"]);
  const vs = await ethers.getSigner(va);
  const tok = token === 0 ? s.vclm : token === 1 ? s.chonx : s.synth;
  await tok.connect(vs).mint(to, amount);
  await ethers.provider.send("hardhat_stopImpersonatingAccount", [va]);
  return tok;
}

describe("CL-45 · staking token discriminator is closed", function () {
  it("VF-STK-002: every value outside {0,1,2} is rejected", async function () {
    const s = await deploy();
    for (const bad of [3, 4, 127, 255]) {
      await expect(
        s.stake.createPosition(bad, 10n ** 16n, D30)
      ).to.be.revertedWith("VF-STK-002: invalid token");
    }
  });

  it("all three valid tokens can be staked", async function () {
    const s = await deploy();
    for (const t of [0, 1, 2]) {
      const amt = 10n ** 16n;
      const tok = await mint(s, t, s.deployer.address, amt);
      await tok.approve(await s.stake.getAddress(), amt);
      await s.stake.createPosition(t, amt, D30);
    }
    expect(await s.stake.nextPositionId()).to.equal(3n);
  });
});

describe("CL-46 · maximum multiplier product does not overflow", function () {
  it("SYNTH at 120 days — the largest product — computes exactly 8x", async function () {
    const s = await deploy();
    const amt = 10n ** 18n;
    const tok = await mint(s, 2, s.deployer.address, amt);   // SYNTH = 4.0x
    await tok.approve(await s.stake.getAddress(), amt);
    await s.stake.createPosition(2, amt, D120);              // 120d = 2.0x
    // 40000 bps * 20000 bps = 800,000,000 — far beyond uint16.
    expect(await s.stake.getPositionWeight(0)).to.equal(amt * 8n);
  });

  it("a very large stake at maximum multipliers does not revert", async function () {
    const s = await deploy();
    const amt = 10_000_000_000n * 10n ** 18n;   // the full VCLM hard cap
    const tok = await mint(s, 2, s.deployer.address, amt);
    await tok.approve(await s.stake.getAddress(), amt);
    await s.stake.createPosition(2, amt, D120);
    expect(await s.stake.getPositionWeight(0)).to.equal(amt * 8n);
  });

  // WHY THIS TEST EXISTS:
  // Arithmetic safety here depends on the uint256 `pos.amount` participating
  // BEFORE the two uint16 BPS operands multiply each other. Reordering can
  // introduce a checked-arithmetic overflow without changing the apparent
  // mathematical expression — 40000 * 20000 = 800,000,000 exceeds uint16, so
  // `tokenBps * durBps * amount` reverts where `amount * tokenBps * durBps`
  // succeeds. The two forms are algebraically identical and operationally
  // different. Do not "simplify" this expression.
  it("the weight expression keeps the uint256 operand leftmost", async function () {
    // Structural. `amount * tokenBps * durationBps` is safe only because
    // `amount` is uint256 and promotes the expression. Reordered to
    // `tokenBps * durationBps * amount`, 40000 * 20000 exceeds uint16 and
    // reverts under checked arithmetic. This guards the ordering.
    const fs = require("fs");
    const src = fs.readFileSync(__dirname + "/../contracts/VinculumFinalisStake.sol", "utf8");
    const expr = src.slice(src.indexOf("function _getWeight"), src.indexOf("function _getTokenMultiplier"));
    const code = expr.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    expect(code).to.include("pos.amount * _getTokenMultiplier");
  });
});

describe("CL-47 · duration discriminator admits only the specified terms", function () {
  it("§10.1: an unlisted duration is rejected", async function () {
    const s = await deploy();
    const amt = 10n ** 16n;
    const tok = await mint(s, 0, s.deployer.address, amt);
    await tok.approve(await s.stake.getAddress(), amt);
    for (const bad of [0n, 1n, 29n * 86400n, 45n * 86400n, 121n * 86400n, 3650n * 86400n]) {
      await expect(
        s.stake.createPosition(0, amt, bad)
      ).to.be.revertedWith("VF-STK-003: duration not permitted");
    }
  });
});
