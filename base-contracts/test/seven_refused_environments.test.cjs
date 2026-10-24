// The seven environments with no on-chain finality anchor the Base Verifier
// can check: Avalanche, Solana, Litecoin, Dogecoin, DigiByte, XRP Ledger and
// Stellar. Each reader must refuse finality outright, for any input, so no
// issuance can be based on them (Revision 14 VF-XCH-006: no Base issuance
// until the source lock meets its deterministic finality condition; VF-XCH-008:
// that condition may not be shortened or waived; VF-XCH-017: no fixed signer
// set or discretionary party may stand in for chain-native finality).
// Local Hardhat chain only. Constructor arguments are SYNTHETIC placeholders.
const { expect } = require("chai");
const { ethers } = require("hardhat");

const DISABLED = (env) => `VF-XCH-006: ${env} settled-history anchor not enforced on-chain; environment disabled`;
const SCRIPT = "0x76a914" + "11".repeat(20) + "88ac"; // SYNTHETIC P2PKH script
const PLACEHOLDER_ADDR = "0x00000000000000000000000000000000000000a1"; // SYNTHETIC

const SEVEN = [
  {
    env: "Avalanche", reason: "Snowman acceptance is local; no signed finality certificate; P-Chain validator set cannot be authenticated on Base",
    deploy: (F) => F("AvalancheLockReader").then((f) => f.deploy(PLACEHOLDER_ADDR)), msg: DISABLED("Avalanche"),
  },
  {
    env: "Solana", reason: "Proof-of-History check is far beyond block gas; no commitment over per-transaction results; ed25519 stake-weighted votes",
    deploy: (F) => F("SolanaLockReader").then((f) => f.deploy()), msg: "VF-XCH-006: Solana reader blocked",
  },
  {
    env: "Litecoin", reason: "scrypt proof-of-work cannot be checked within one Base transaction",
    deploy: (F) => F("LitecoinLockReader").then((f) => f.deploy(SCRIPT)), msg: DISABLED("Litecoin"),
  },
  {
    env: "Dogecoin", reason: "scrypt proof-of-work plus AuxPoW cannot be checked within one Base transaction",
    deploy: (F) => F("DogecoinLockReader").then((f) => f.deploy(SCRIPT)), msg: DISABLED("Dogecoin"),
  },
  {
    env: "DigiByte", reason: "five proof-of-work algorithms including scrypt and Odocrypt; not checkable on Base",
    deploy: (F) => F("DigiByteLockReader").then((f) => f.deploy(SCRIPT)), msg: DISABLED("DigiByte"),
  },
  {
    env: "XRP Ledger", reason: "UNL validation and manifest checks not built; no on-chain anchor this pass",
    deploy: (F) => F("XrplLockReader").then((f) => f.deploy("0x" + "22".repeat(20))), msg: DISABLED("XRP Ledger"),
  },
  {
    env: "Stellar", reason: "no canonical quorum set; a deploy-time quorum is a fixed signer set (VF-XCH-017); no ed25519 precompile",
    deploy: (F) => F("StellarLockReader").then((f) => f.deploy(ethers.sha256(ethers.toUtf8Bytes("Public Global Stellar Network ; September 2015")), "0x" + "33".repeat(32))),
    msg: DISABLED("Stellar"),
  },
];

describe("The seven refused environments (Revision 14 VF-XCH-006, VF-XCH-008, VF-XCH-017)", function () {
  const F = (n) => ethers.getContractFactory(n);
  const inputs = [
    ["0x", "0x"],
    [ethers.hexlify(ethers.randomBytes(256)), "0x"],
    [ethers.hexlify(ethers.randomBytes(512)), ethers.hexlify(ethers.randomBytes(96))],
  ];
  for (const s of SEVEN) {
    it(`${s.env} is refused for every proof: ${s.reason}`, async () => {
      const r = await s.deploy(F);
      for (const [lockEventProof, finalityProof] of inputs) {
        await expect(r.verifyFinality(lockEventProof, finalityProof)).to.be.revertedWith(s.msg);
      }
    });
  }

  it("the refusal list is exactly the seven", () => {
    expect(SEVEN.map((s) => s.env)).to.deep.equal(["Avalanche", "Solana", "Litecoin", "Dogecoin", "DigiByte", "XRP Ledger", "Stellar"]);
  });
});
