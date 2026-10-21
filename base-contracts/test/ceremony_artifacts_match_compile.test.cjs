// t272u: the deploy files must be the compiled source. Fails if any contract in
// scripts/deploy-pages/ceremony.json (bytecode or ABI) differs from the artifact
// produced by the compile this test run uses, so a stale Stake, Verifier, lock
// or reader can never be signed. Also checks the six non-Base EVM lock pages
// and lockDeploy.prepared.json against the compiled CommitmentVaultLock.
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

  it("ceremony.json has 22 entries over 21 distinct contracts", () => {
    expect(keys.length).to.equal(22);
    expect(new Set(keys.map((k) => ALIAS[k] || k)).size).to.equal(21);
  });

  for (const k of keys) {
    it(`${k}: bytecode hash and ABI equal the compiled artifact`, async () => {
      const a = await hre.artifacts.readArtifact(ALIAS[k] || k);
      expect(ethers.keccak256(cer[k].bytecode), `${k} bytecode hash`).to.equal(ethers.keccak256(a.bytecode));
      expect(JSON.stringify(cer[k].abi), `${k} ABI`).to.equal(JSON.stringify(a.abi));
    });
  }

  it("lockDeploy.prepared.json creationCodeHash and the six EVM lock pages carry the compiled CommitmentVaultLock", async () => {
    const a = await hre.artifacts.readArtifact("CommitmentVaultLock");
    const prep = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployment", "lockDeploy.prepared.json"), "utf8"));
    expect(prep.creationCodeHash).to.equal(ethers.keccak256(a.bytecode));
    for (const page of ["ethereum", "polygon", "optimism", "arbitrum", "bnb-smart-chain", "avalanche"]) {
      const html = fs.readFileSync(path.join(PAGES, page + ".html"), "utf8");
      const m = html.match(/const ARTS = (\{.*?\});\n/s);
      expect(m, page).to.not.equal(null);
      const arts = JSON.parse(m[1]);
      expect(ethers.keccak256(arts.lock.bytecode), page).to.equal(ethers.keccak256(a.bytecode));
    }
  });
});
