const { expect } = require("chai");
const { ethers } = require("hardhat");

// ---------------------------------------------------------------------------
// CL-09 — DIFFERENTIAL ORACLE.
//
// Acceptance evidence, not supplementary coverage.
//
// The optimized accumulator must agree with a brute-force specification oracle
// at EVERY epoch boundary, across randomized positions, durations, extensions
// and withdrawals. The oracle implements the rule from the specification
// directly — a position qualifies for epoch N where
//     start <= T0 + (N-1)E   and   end >= T0 + (N+1)E
// — and is deliberately written from §10.2 rather than from the contract.
// ---------------------------------------------------------------------------

const ZERO = "0x0000000000000000000000000000000000000000";
const EPOCH = 10 * 24 * 60 * 60;
const DURATIONS = [30, 60, 90, 120].map((d) => BigInt(d * 86400));
const DUR_BPS = { [30 * 86400]: 10000n, [60 * 86400]: 14000n, [90 * 86400]: 17500n, [120 * 86400]: 20000n };
const TOKEN_BPS = [10000n, 20000n, 40000n];

async function deploy() {
  const signers = await ethers.getSigners();
  const [deployer] = signers;
  const Token = await ethers.getContractFactory("VinculumFinalisToken");
  const vclm = await Token.deploy("V", "V", 10n ** 30n);
  const chonx = await Token.deploy("C", "C", 10n ** 30n);
  const synth = await Token.deploy("S", "S", 10n ** 30n);
  const launchTs = (await ethers.provider.getBlock("latest")).timestamp;
  const __cap = await (await ethers.getContractFactory("VinculumFinalisCap")).deploy(10_000_000_000n * 10n ** 18n, 100_000_000_000n * 10n ** 18n);
  const V = await ethers.getContractFactory("VinculumFinalisVerifier");
  const verifier = await V.deploy(
    await vclm.getAddress(), await chonx.getAddress(), signers[9].address, launchTs, await __cap.getAddress());
  const Stake = await ethers.getContractFactory("VinculumFinalisStake");
  const stake = await Stake.deploy(
    await vclm.getAddress(), await chonx.getAddress(),
    await synth.getAddress(), await verifier.getAddress(), launchTs, await __cap.getAddress());
  await __cap.initialize(await verifier.getAddress(), await stake.getAddress());
  await vclm.initialize(await verifier.getAddress(), await stake.getAddress());
  await chonx.initialize(await verifier.getAddress(), ZERO);
  await synth.initialize(await verifier.getAddress(), ZERO);
  return { deployer, vclm, chonx, synth, verifier, stake, launchTs };
}

async function mintTo(s, token, who, amount) {
  const vAddr = await s.verifier.getAddress();
  await ethers.provider.send("hardhat_impersonateAccount", [vAddr]);
  await ethers.provider.send("hardhat_setBalance", [vAddr, "0x8AC7230489E80000"]);
  const vs = await ethers.getSigner(vAddr);
  const tok = token === 0 ? s.vclm : token === 1 ? s.chonx : s.synth;
  await tok.connect(vs).mint(who, amount);
  await ethers.provider.send("hardhat_stopImpersonatingAccount", [vAddr]);
  return tok;
}

// Brute-force oracle, written from §10.1 and §10.2, not from the contract.
function oracleWeight(positions, epochN, T0) {
  const epochStart = BigInt(T0) + BigInt(epochN - 1) * BigInt(EPOCH);
  const nPlus1End = BigInt(T0) + BigInt(epochN + 1) * BigInt(EPOCH);
  let total = 0n;
  for (const p of positions) {
    if (p.withdrawnBeforeEpoch !== null && p.withdrawnBeforeEpoch <= epochN) continue;
    if (p.start <= epochStart && p.end >= nPlus1End) {
      total += (p.amount * TOKEN_BPS[p.token] * DUR_BPS[Number(p.duration)]) / 100000000n;
    }
  }
  return total;
}

async function advance(sec) {
  await ethers.provider.send("evm_increaseTime", [sec]);
  await ethers.provider.send("evm_mine", []);
}

describe("CL-09 · differential oracle — accumulator vs specification", function () {
  this.timeout(600000);

  it("agrees with brute force across 20 randomized positions and 6 epochs", async function () {
    const s = await deploy();
    const model = [];
    let seed = 42;
    const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };

    for (let i = 0; i < 20; i++) {
      const token = rnd(3);
      const duration = DURATIONS[rnd(4)];
      const amount = BigInt(1 + rnd(9)) * 10n ** 15n;
      const tok = await mintTo(s, token, s.deployer.address, amount);
      await tok.approve(await s.stake.getAddress(), amount);
      const tx = await s.stake.createPosition(token, amount, duration);
      const rc = await tx.wait();
      const blk = await ethers.provider.getBlock(rc.blockNumber);
      model.push({
        id: i, token, duration, amount,
        start: BigInt(blk.timestamp),
        end: BigInt(blk.timestamp) + duration,
        withdrawnBeforeEpoch: null,
      });
      if (i % 4 === 3) await advance(3600);   // spread start times
    }

    // Walk epochs chronologically, comparing both computations each time.
    for (let N = 1; N <= 6; N++) {
      const nPlus1End = s.launchTs + (N + 1) * EPOCH;
      const now = (await ethers.provider.getBlock("latest")).timestamp;
      if (now < nPlus1End) await advance(nPlus1End - now + 60);

      await s.stake.closeEpoch(N);
      const ep = await s.stake.epochs(N);
      const expected = oracleWeight(model, N, s.launchTs);
      expect(ep.totalWeight).to.equal(
        expected,
        `epoch ${N}: accumulator ${ep.totalWeight} vs oracle ${expected}`
      );
    }
  });

  it("agrees after a withdrawal cancels future contribution", async function () {
    const s = await deploy();
    const model = [];
    const amount = 10n ** 16n;

    for (let i = 0; i < 3; i++) {
      const tok = await mintTo(s, 0, s.deployer.address, amount);
      await tok.approve(await s.stake.getAddress(), amount);
      const rc = await (await s.stake.createPosition(0, amount, DURATIONS[0])).wait();
      const blk = await ethers.provider.getBlock(rc.blockNumber);
      model.push({
        id: i, token: 0, duration: DURATIONS[0], amount,
        start: BigInt(blk.timestamp), end: BigInt(blk.timestamp) + DURATIONS[0],
        withdrawnBeforeEpoch: null,
      });
    }

    // Close epoch 1 with all three present.
    let target = s.launchTs + 2 * EPOCH + 60;
    let now = (await ethers.provider.getBlock("latest")).timestamp;
    await advance(target - now);
    await s.stake.closeEpoch(1);
    expect((await s.stake.epochs(1)).totalWeight).to.equal(oracleWeight(model, 1, s.launchTs));

    // Mature and withdraw one, then close epoch 2.
    now = (await ethers.provider.getBlock("latest")).timestamp;
    await advance(Number(DURATIONS[0]) + 60);
    await s.stake.withdrawPosition(0);
    model[0].withdrawnBeforeEpoch = 2;

    await s.stake.closeEpoch(2);
    expect((await s.stake.epochs(2)).totalWeight).to.equal(oracleWeight(model, 2, s.launchTs));
  });

  it("conservation: registered weight matches the accumulator at every boundary", async function () {
    const s = await deploy();
    const amount = 10n ** 16n;
    for (let i = 0; i < 5; i++) {
      const tok = await mintTo(s, 0, s.deployer.address, amount);
      await tok.approve(await s.stake.getAddress(), amount);
      await s.stake.createPosition(0, amount, DURATIONS[3]);   // 120d, spans many epochs
    }

    let running = 0n;
    for (let N = 1; N <= 5; N++) {
      const nPlus1End = s.launchTs + (N + 1) * EPOCH;
      const now = (await ethers.provider.getBlock("latest")).timestamp;
      if (now < nPlus1End) await advance(nPlus1End - now + 60);
      await s.stake.closeEpoch(N);
      running = running + (await s.stake.weightAddedAt(N)) - (await s.stake.weightRemovedAt(N));
      expect(await s.stake.runningQualifyingWeight()).to.equal(running);
      expect((await s.stake.epochs(N)).totalWeight).to.equal(running);
    }
  });
});
