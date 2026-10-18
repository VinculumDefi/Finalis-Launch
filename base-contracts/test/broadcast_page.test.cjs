// scripts/broadcast.html embeds current main: every contract equals the current
// build, and the embedded Stake carries the corrected four-duration TRS table
// (30/60/90/120 days = 1.00/1.40/1.75/2.10x), checked against the JS source
// of truth (src/lib/vfRevision6Authority.js STAKE_DURATIONS).
const { expect } = require("chai");
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const html = fs.readFileSync(path.join(__dirname, "..", "scripts", "broadcast.html"), "utf8");
const ARTS = JSON.parse(html.match(/^const ARTS = (\{.*\});$/m)[1]);
const A = (rel) => require("../artifacts/contracts/" + rel).bytecode;

describe("broadcast.html rebuilt from current main", function () {
  it("embeds the current build of all five contracts", () => {
    expect(ARTS.token.bytecode).to.equal(A("VinculumFinalisToken.sol/VinculumFinalisToken.json"));
    expect(ARTS.lock.bytecode).to.equal(A("CommitmentVaultLock.sol/CommitmentVaultLock.json"));
    expect(ARTS.verifier.bytecode).to.equal(A("VinculumFinalisVerifier.sol/VinculumFinalisVerifier.json"));
    expect(ARTS.synth.bytecode).to.equal(A("VinculumFinalisSynth.sol/VinculumFinalisSynth.json"));
    expect(ARTS.stake.bytecode).to.equal(A("VinculumFinalisStake.sol/VinculumFinalisStake.json"));
  });

  it("the embedded Stake has exactly the four TRS rows from the source, 120 days = 2.10x", async () => {
    const src = await import(pathToFileURL(path.join(__dirname, "..", "..", "src", "lib", "vfRevision6Authority.js")).href);
    const rows = src.STAKE_DURATIONS.map((d) => [Number(d.secs), Number(d.multiplier_bps)]);
    const DAY = 86400;
    expect(rows).to.deep.equal([[30 * DAY, 10000], [60 * DAY, 14000], [90 * DAY, 17500], [120 * DAY, 21000]]);
    const [s] = await ethers.getSigners();
    const stake = await new ethers.ContractFactory(ARTS.stake.abi, ARTS.stake.bytecode, s)
      .deploy(s.address, s.address, s.address, s.address, 1);
    for (const [secs, bps] of rows) expect(await stake.stakeMultiplierBps(secs)).to.equal(BigInt(bps));
    expect(await stake.STAKE_120D_BPS()).to.equal(21000n);
    for (const bad of [7 * DAY, 180 * DAY, 365 * DAY, 120 * DAY + 1]) await expect(stake.stakeMultiplierBps(bad)).to.be.reverted;
  });
});
