// t272u: the deploy files must be the compiled source. Fails if any contract in
// scripts/deploy-pages/ceremony.json (bytecode or ABI) differs from the artifact
// produced by the compile this test run uses, so a stale Stake, Verifier, lock
// or reader can never be signed. Base-only launch (t357u): ceremony.json holds
// only the seven Base entries; the non-Base locks and readers stay in the source
// tree (still compiled) but are not in the deploy package.
// Nothing is broadcast.
const { expect } = require("chai");
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const { ethers } = hre;

const PAGES = path.join(__dirname, "..", "scripts", "deploy-pages");
// ceremony.json key -> compiled contract name (TokenVCLM and TokenCHONX share one contract).
const ALIAS = { TokenVCLM: "VinculumFinalisToken", TokenCHONX: "VinculumFinalisToken" };

describe("t272u ceremony.json equals the fresh compile (all contracts)", function () {
  const cer = JSON.parse(fs.readFileSync(path.join(PAGES, "ceremony.json"), "utf8"));
  const keys = Object.keys(cer);

  it("ceremony.json has exactly the 7 Base entries over 6 distinct contracts", () => {
    expect(keys).to.deep.equal(["VinculumFinalisVerifier", "TokenVCLM", "TokenCHONX", "BaseCommitmentVaultLock", "BaseLockRecordVerifier", "VinculumFinalisSynth", "VinculumFinalisStake"]);
    expect(new Set(keys.map((k) => ALIAS[k] || k)).size).to.equal(6);
  });

  for (const k of keys) {
    it(`${k}: bytecode hash and ABI equal the compiled artifact`, async () => {
      const a = await hre.artifacts.readArtifact(ALIAS[k] || k);
      expect(ethers.keccak256(cer[k].bytecode), `${k} bytecode hash`).to.equal(ethers.keccak256(a.bytecode));
      expect(JSON.stringify(cer[k].abi), `${k} ABI`).to.equal(JSON.stringify(a.abi));
    });
  }

  it("no non-Base deploy file is left; the non-Base locks and readers are kept in source and still compile", async () => {
    expect(fs.readdirSync(PAGES).filter((f) => f.endsWith(".html"))).to.deep.equal(["base.html"]);
    expect(fs.existsSync(path.join(__dirname, "..", "deployment", "lockDeploy.prepared.json"))).to.equal(false);
    for (const k of ["CommitmentVaultLock", "SimpleEthereumLockReader", "PolygonLockReader", "BitcoinLockReader", "StellarLockReader", "XrplLockReader"]) {
      expect(cer, k).to.not.have.property(k);
      expect((await hre.artifacts.readArtifact(k)).bytecode.length, k).to.be.gt(2);
    }
  });
});
