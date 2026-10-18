// UTXO lock readers (Bitcoin, Bitcoin Cash, Litecoin, Dogecoin, DigiByte,
// Zcash). Fixtures: test/fixtures/utxo_local_locks.json, built by
// utxo-locks/reader_fixtures.py. Each lock transaction is built and signed by
// utxo-locks/lock.py and placed in a LOCAL, unmined block with a BIP 34
// coinbase. Accept cases prove the lock; reject cases tamper with it.
const { expect } = require("chai");
const { ethers } = require("hardhat");
const FX = require("./fixtures/utxo_local_locks.json");

const coder = ethers.AbiCoder.defaultAbiCoder();
const PROOF = "tuple(bytes header, bytes coinbaseTx, bytes32[] coinbaseBranch, bytes lockTx, bytes32[] lockBranch, uint256 lockIndex, bytes redeemScript, bytes payload, uint256 durationSecs)";
const CONTRACT = { Bitcoin: "BitcoinLockReader", "Bitcoin Cash": "BitcoinCashLockReader", Litecoin: "LitecoinLockReader",
  Dogecoin: "DogecoinLockReader", DigiByte: "DigiByteLockReader", Zcash: "ZcashLockReader" };

const proof = (c, o = {}) => {
  const p = { ...c, ...o };
  return coder.encode([PROOF], [[p.header, p.coinbaseTx, p.coinbaseBranch, p.lockTx, p.lockBranch, p.lockIndex, p.redeemScript, p.payload, p.durationSecs]]);
};
const claim = (hash, height) => coder.encode(["bytes32", "uint256"], [hash, height]);
function flip(hex, at) {
  const b = ethers.getBytes(hex);
  b[at] ^= 0x01;
  return ethers.hexlify(b);
}

for (const [env, cfg] of Object.entries(FX.chains)) {
  describe(`${CONTRACT[env]} (${env}, local utxo-locks lock)`, function () {
    const S = cfg.standard;
    const H = cfg.handshake;
    let reader;

    before(async function () {
      reader = await (await ethers.getContractFactory(CONTRACT[env])).deploy(S.devFundScript);
    });

    it("is configured for this environment", async function () {
      expect(await reader.environmentId()).to.equal(env);
      expect(await reader.blockSpacing()).to.equal(BigInt(cfg.spacing));
      expect(await reader.devFundScript()).to.equal(S.devFundScript);
    });

    it("accepts a real 7-day lock: facts come from the transaction and payload; fee is 5%", async function () {
      const f = await reader.extractFacts(proof(S));
      expect(f[0]).to.equal(S.lockId);
      expect(f[1]).to.equal(BigInt(S.fee + S.principal));
      expect(f[2]).to.equal(BigInt(S.fee));
      expect(f[3]).to.equal(BigInt(S.principal));
      expect(f[2] * 10000n).to.equal(f[1] * 500n);
      expect(f[4]).to.equal(604800n);
      expect(f[5]).to.equal(BigInt(S.time));
      expect(f[6]).to.equal(BigInt(S.time + 604800));
      expect(f[7].toLowerCase()).to.equal(S.baseRecipient);
      expect(f[8]).to.equal(BigInt(S.outputToken));
      const [ok, hash, height] = await reader.verifyFinality(proof(S), claim(S.blockHash, S.height));
      expect(ok).to.equal(true);
      expect(hash).to.equal(S.blockHash);
      expect(height).to.equal(BigInt(S.height));
    });

    it("accepts a real Handshake (1-hour) lock at 5%", async function () {
      const r = await (await ethers.getContractFactory(CONTRACT[env])).deploy(H.devFundScript);
      const f = await r.extractFacts(proof(H));
      expect(f[4]).to.equal(3600n);
      expect(f[2] * 10000n).to.equal(f[1] * 500n);
      expect(f[0]).to.equal(H.lockId);
    });

    it("rejects fabricated or edited transaction bytes", async function () {
      await expect(reader.extractFacts(proof(S, { lockTx: ethers.hexlify(ethers.randomBytes(S.lockTx.length / 2 - 1)) }))).to.be.reverted;
      await expect(reader.extractFacts(proof(S, { lockTx: flip(S.lockTx, S.lockTx.length / 2 - 30) }))).to.be.revertedWith("VF-XCH-011: lock not in block");
      await expect(reader.extractFacts(proof(S, { lockBranch: S.lockBranch.map((b, i) => (i === 0 ? flip(b, 3) : b)) })))
        .to.be.revertedWith("VF-XCH-011: lock not in block");
      await expect(reader.extractFacts(proof(S, { lockIndex: 1 }))).to.be.revertedWith("VF-XCH-011: lock not in block");
    });

    it("rejects a tampered payload (lock ID, recipient or output token) and a swapped redeem script", async function () {
      const pl = ethers.getBytes(S.payload);
      for (const at of [0, 40, 52]) {
        const bad = Uint8Array.from(pl);
        bad[at] ^= 0x01;
        await expect(reader.extractFacts(proof(S, { payload: ethers.hexlify(bad) }))).to.be.revertedWith("VF-XCH-011: binding output");
      }
      await expect(reader.extractFacts(proof(S, { redeemScript: S.otherRedeemScript }))).to.be.revertedWith("VF-XCH-011: principal output");
    });

    it("rejects a duration that does not match the CLTV maturity, and a non-permitted duration", async function () {
      await expect(reader.extractFacts(proof(S, { durationSecs: 2592000 }))).to.be.revertedWith("VF-XCH-011: maturity does not match duration");
      await expect(reader.extractFacts(proof(S, { durationSecs: 3600 }))).to.be.revertedWith("VF-XCH-011: maturity does not match duration");
      await expect(reader.extractFacts(proof(S, { durationSecs: 604801 }))).to.be.revertedWith("VF-XCH-011: duration not permitted");
    });

    it("rejects a lock that pays a different Dev Fund", async function () {
      const other = await (await ethers.getContractFactory(CONTRACT[env])).deploy("0x76a914" + "11".repeat(20) + "88ac");
      await expect(other.extractFacts(proof(S))).to.be.revertedWith("VF-XCH-011: dev fund output");
      // The neighbouring real lock in the same block pays its own (different) Dev Fund.
      await expect(reader.extractFacts(proof(S, { lockTx: S.otherLockTx, lockBranch: S.otherBranch, lockIndex: 1, redeemScript: S.otherRedeemScript, payload: S.otherPayload })))
        .to.be.revertedWith("VF-XCH-011: dev fund output");
    });

    it("rejects a wrong block hash or height, an edited header, and a forged coinbase", async function () {
      await expect(reader.verifyFinality(proof(S), claim(ethers.keccak256("0x01"), S.height))).to.be.revertedWith("VF-XCH-006: block hash mismatch");
      await expect(reader.verifyFinality(proof(S), claim(S.blockHash, S.height + 1))).to.be.revertedWith("VF-XCH-006: block height mismatch");
      await expect(reader.verifyFinality(proof(S, { header: flip(S.header, 10) }), claim(S.blockHash, S.height))).to.be.revertedWith("VF-XCH-006: block hash mismatch");
      await expect(reader.extractFacts(proof(S, { header: flip(S.header, 40) }))).to.be.reverted;
      await expect(reader.extractFacts(proof(S, { coinbaseTx: flip(S.coinbaseTx, 44) }))).to.be.reverted;
      await expect(reader.extractFacts(proof(S, { coinbaseTx: S.lockTx, coinbaseBranch: S.lockBranch }))).to.be.revertedWith("VF-XCH-011: coinbase");
    });
  });
}

describe("DogecoinLockReader: lock.py dust split", function () {
  it("refuses a lock whose fee output is the dust minimum instead of 5% of gross", async function () {
    const D = FX.chains.Dogecoin.dustSplit;
    expect(D.fee * 10000).to.not.equal((D.fee + D.principal) * 500);
    const r = await (await ethers.getContractFactory("DogecoinLockReader")).deploy(D.devFundScript);
    await expect(r.extractFacts(proof(D))).to.be.revertedWith("VF-XCH-011: fee is not 5%");
  });
});

describe("UTXO readers: wrong chain", function () {
  it("a lock from one UTXO chain is refused by another chain's reader", async function () {
    const B = FX.chains.Bitcoin.standard, L = FX.chains.Litecoin.standard, Z = FX.chains.Zcash.standard;
    const btcForLtc = await (await ethers.getContractFactory("BitcoinLockReader")).deploy(L.devFundScript);
    await expect(btcForLtc.extractFacts(proof(L))).to.be.revertedWith("VF-XCH-011: binding output"); // SHA-256 binding vs raw
    const zecForBtc = await (await ethers.getContractFactory("ZcashLockReader")).deploy(B.devFundScript);
    await expect(zecForBtc.extractFacts(proof(B))).to.be.revertedWith("VF-XCH-011: Zcash header");
    const btcForZec = await (await ethers.getContractFactory("BitcoinLockReader")).deploy(Z.devFundScript);
    await expect(btcForZec.extractFacts(proof(Z))).to.be.revertedWith("VF-XCH-011: header length");
    const dogeForLtc = await (await ethers.getContractFactory("DogecoinLockReader")).deploy(L.devFundScript);
    await expect(dogeForLtc.extractFacts(proof(L))).to.be.revertedWith("VF-XCH-011: maturity does not match duration");
  });
});

describe("Solana, Stellar and XRP Ledger readers fail closed (blocked)", function () {
  for (const [name, env] of [["SolanaLockReader", "Solana"], ["StellarLockReader", "Stellar"], ["XrplLockReader", "XRP Ledger"]]) {
    it(`${name} refuses every proof`, async function () {
      const r = await (await ethers.getContractFactory(name)).deploy();
      expect(await r.ENVIRONMENT_ID()).to.equal(env);
      const fake = coder.encode(["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "uint8"],
        [ethers.id("x"), 1000, 50, 950, 604800, 1, 604801, "0x000000000000000000000000000000000000dEaD", 1]);
      await expect(r.extractFacts(fake)).to.be.revertedWith(`VF-XCH-011: ${env} reader blocked`);
      await expect(r.verifyFinality(fake, claim(ethers.id("b"), 1))).to.be.revertedWith(`VF-XCH-006: ${env} reader blocked`);
    });
  }
});
