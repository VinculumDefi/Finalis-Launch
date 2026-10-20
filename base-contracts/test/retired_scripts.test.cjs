// The old broadcast scripts and pages are retired (t251u; ceremony.html t249u).
// Each is a stub that sends nothing and points to the runbook, and nothing on
// the deployment path uses them. The Stake TRS check that used the contracts
// embedded in broadcast.html now uses the compiled Stake directly.
const { expect } = require("chai");
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { pathToFileURL } = require("url");

const ROOT = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const RUNBOOK = "deployment/DEPLOYMENT_DAY_RUNBOOK.md";

const RETIRED_SCRIPTS = [
  "scripts/broadcastBaseTest.cjs",
  "scripts/broadcastRepresentativeBase.cjs",
  "scripts/broadcastMintPath.cjs",
  "scripts/buildBroadcastPage.cjs",
];
const RETIRED_PAGES = ["scripts/broadcast.html", "scripts/ceremony.html"];
const RETIRED_NAMES = [...RETIRED_SCRIPTS, ...RETIRED_PAGES].map((f) => path.basename(f));

describe("retired broadcast scripts and pages", function () {
  it("each retired script loads no wallet or chain code, prints the notice and exits with an error", () => {
    for (const rel of RETIRED_SCRIPTS) {
      const src = read(rel);
      expect(src.startsWith("// RETIRED (t251u). Do not use. This script sends nothing."), rel).to.equal(true);
      expect(src, rel).to.include(RUNBOOK);
      for (const bad of ["require(", "import ", "ethers", "hardhat\")", "sendTransaction", "getSigners", "deploy(", "eth_", "fetch(", "writeFile"]) {
        expect(src.includes(bad), `${rel} contains ${bad}`).to.equal(false);
      }
      const r = spawnSync(process.execPath, [path.join(ROOT, rel)], { encoding: "utf8", timeout: 20000 });
      expect(r.status, rel).to.equal(1);
      expect(r.stdout, rel).to.equal("");
      expect(r.stderr, rel).to.include(`RETIRED: ${rel} is retired and sends nothing.`);
      expect(r.stderr, rel).to.include(RUNBOOK);
    }
  });

  it("each retired page has no script and no wallet code, and points to the runbook", () => {
    for (const rel of RETIRED_PAGES) {
      const html = read(rel);
      expect(html, rel).to.include("<h1>Retired. Do not use.</h1>");
      expect(html, rel).to.include(RUNBOOK);
      expect(html, rel).to.include("sends nothing and has no wallet code");
      for (const bad of ["<script", "ethereum", "ethers", "eth_", "bytecode", "onclick", "<button"]) {
        expect(html.toLowerCase().includes(bad.toLowerCase()), `${rel} contains ${bad}`).to.equal(false);
      }
    }
  });

  it("nothing on the deployment path or in another test uses them", () => {
    const files = [
      ...fs.readdirSync(path.join(ROOT, "scripts", "deploy-pages")).map((f) => path.join("scripts", "deploy-pages", f)),
      ...fs.readdirSync(path.join(ROOT, "scripts")).filter((f) => /\.(cjs|js)$/.test(f)).map((f) => path.join("scripts", f)),
      ...fs.readdirSync(path.join(ROOT, "test")).map((f) => path.join("test", f)),
      "hardhat.config.js", "package.json",
    ].filter((f) => fs.existsSync(path.join(ROOT, f)) && fs.statSync(path.join(ROOT, f)).isFile());
    const hits = [];
    for (const f of files) {
      if (RETIRED_SCRIPTS.includes(f) || path.basename(f) === "README.md" || f === path.join("test", "retired_scripts.test.cjs")) continue;
      // comments may name them as history; code may not
      const code = fs.readFileSync(path.join(ROOT, f), "utf8").split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
      for (const name of RETIRED_NAMES) if (code.includes(name)) hits.push(`${f}: ${name}`);
    }
    expect(hits).to.deep.equal([]);
  });

  it("the compiled Stake has exactly the four TRS rows from the app source, 120 days = 2.10x", async () => {
    const src = await import(pathToFileURL(path.join(ROOT, "..", "src", "lib", "vfRevision6Authority.js")).href);
    const rows = src.STAKE_DURATIONS.map((d) => [Number(d.secs), Number(d.multiplier_bps)]);
    const DAY = 86400;
    expect(rows).to.deep.equal([[30 * DAY, 10000], [60 * DAY, 14000], [90 * DAY, 17500], [120 * DAY, 21000]]);
    const [s] = await ethers.getSigners();
    const stake = await (await ethers.getContractFactory("VinculumFinalisStake")).deploy(s.address, s.address, s.address, s.address, 1);
    for (const [secs, bps] of rows) expect(await stake.stakeMultiplierBps(secs)).to.equal(BigInt(bps));
    expect(await stake.STAKE_120D_BPS()).to.equal(21000n);
    for (const bad of [7 * DAY, 180 * DAY, 365 * DAY, 120 * DAY + 1]) await expect(stake.stakeMultiplierBps(bad)).to.be.reverted;
  });
});
