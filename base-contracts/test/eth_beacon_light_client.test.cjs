// EthereumBeaconLightClient against REAL Ethereum mainnet light-client data
// (test/fixtures/eth_lc_mainnet.json): a bootstrap at slot 15441920 (period
// 1885), the period-1885 LightClientUpdate carrying the period-1886 sync
// committee, and a later finality update signed by that committee (508/512).
// Every signature here is a real mainnet sync-committee BLS signature.
const { expect } = require("chai");
const { ethers } = require("hardhat");
const L = require("./lib/beaconLc.cjs");
const { encodeBlockHeader } = require("./lib/ethProof.cjs");
const F = require("./fixtures/eth_lc_mainnet.json");

function scRoot(sc) { return L.committeeRoot(sc.pubkeys, sc.aggregate_pubkey); }
function updateArg(u) {
  const next = u.next_sync_committee;
  return {
    attested: L.hdrTuple(u.attested_header.beacon),
    finalized: L.hdrTuple(u.finalized_header.beacon),
    finalityBranch: u.finality_branch,
    nextCommittee: next ? scRoot(next) : ethers.ZeroHash,
    nextCommitteeBranch: next ? u.next_sync_committee_branch : [],
    syncBits: u.sync_aggregate.sync_committee_bits,
    signature: L.g2Bytes(L.g2FromCompressed(u.sync_aggregate.sync_committee_signature)),
    signatureSlot: u.signature_slot,
  };
}
const flipHex = (h) => { const b = ethers.getBytes(h); b[5] ^= 1; return ethers.hexlify(b); };
const EV_T = ["tuple(bytes,bytes,uint256,bytes[],uint256,bytes[],bytes[],bytes[])"];
const FT = "tuple(tuple(uint64,uint64,bytes32,bytes32,bytes32) finalized, tuple(uint64,uint64,bytes32,bytes32,bytes32) lockBeacon, bytes32[] blockRootsBranch, bytes32[] payloadBranch)";
const coder = ethers.AbiCoder.defaultAbiCoder();

describe("EthereumBeaconLightClient (real mainnet sync-committee signatures)", function () {
  const boot = F.bootstrap;
  const sc1885 = boot.current_sync_committee;
  const sc1886 = F.update_period_1885.next_sync_committee;
  let xy1885, xy1886;

  async function deploy(forkVersion = F.fork_version) {
    return (await ethers.getContractFactory("EthereumBeaconLightClient")).deploy(
      L.hdrTuple(boot.header.beacon), F.bootstrap_root, scRoot(sc1885), boot.current_sync_committee_branch,
      F.genesis_validators_root, forkVersion
    );
  }

  before(function () {
    xy1885 = L.committeeXY(sc1885.pubkeys);
    xy1886 = L.committeeXY(sc1886.pubkeys);
  });

  it("BLS library matches @noble/curves hash_to_curve and on-curve checks", async function () {
    const h = await (await ethers.getContractFactory("Bls12381Harness")).deploy();
    for (const m of [ethers.ZeroHash, ethers.keccak256("0x01"), F.bootstrap_root]) {
      const want = L.g2Bytes(L.bls.G2.hashToCurve(ethers.getBytes(m), { DST: L.DST }));
      expect(await h.hashToG2(m)).to.equal(want);
    }
    const x = ethers.dataSlice(xy1885, 0, 48), y = ethers.dataSlice(xy1885, 48, 96);
    expect(await h.onCurveG1(x, y)).to.equal(true);
    expect(await h.onCurveG1(x, flipHex(y))).to.equal(false);
  });

  it("rejects a checkpoint whose committee or root is not proven", async function () {
    const F2 = await ethers.getContractFactory("EthereumBeaconLightClient");
    await expect(F2.deploy(L.hdrTuple(boot.header.beacon), F.bootstrap_root, scRoot(sc1886),
      boot.current_sync_committee_branch, F.genesis_validators_root, F.fork_version)).to.be.revertedWith("LC: checkpoint committee");
    await expect(F2.deploy(L.hdrTuple(boot.header.beacon), ethers.ZeroHash, scRoot(sc1885),
      boot.current_sync_committee_branch, F.genesis_validators_root, F.fork_version)).to.be.revertedWith("LC: checkpoint root");
  });

  it("accepts the real updates, rotates the committee, and finalizes a real execution block", async function () {
    const lc = await deploy();
    const u1 = updateArg(F.update_period_1885);
    const g1 = await lc.submitUpdate.estimateGas(u1, xy1885, sc1885.aggregate_pubkey);
    await (await lc.submitUpdate(u1, xy1885, sc1885.aggregate_pubkey)).wait();
    expect(await lc.nextCommitteeRoot()).to.equal(scRoot(sc1886));

    const fu = F.finality_update;
    const u2 = updateArg(fu);
    const g2 = await lc.submitUpdate.estimateGas(u2, xy1886, sc1886.aggregate_pubkey);
    await (await lc.submitUpdate(u2, xy1886, sc1886.aggregate_pubkey)).wait();
    const finRoot = L.beaconRoot(L.toHdr(fu.finalized_header.beacon));
    expect(await lc.isFinalized(finRoot)).to.equal(true);
    expect(await lc.finalizedSlot()).to.equal(BigInt(fu.finalized_header.beacon.slot));
    expect(await lc.currentCommitteeRoot()).to.equal(scRoot(sc1886));
    console.log(`      gas: update with rotation ${g1}, finality update ${g2}`);

    await expect(lc.submitUpdate(u2, xy1886, sc1886.aggregate_pubkey)).to.be.revertedWith("LC: not newer than checkpoint");

    // Real mainnet execution block, bound to the real finalized beacon body.
    const reader = await (await ethers.getContractFactory("EthereumLockReader")).deploy(ethers.Wallet.createRandom().address, await lc.getAddress());
    const blk = F.finalized_execution_block;
    const headerRlp = encodeBlockHeader(blk);
    expect(ethers.keccak256(headerRlp)).to.equal(blk.hash);
    const ev = coder.encode(EV_T, [[headerRlp, "0x", 0, [], 0, [], [], []]]);
    const branch = L.blockHashBranch(fu.finalized_header.execution, fu.finalized_header.execution_branch);
    const fin = L.hdrTuple(fu.finalized_header.beacon);
    const proof = coder.encode([FT], [[fin, fin, [], branch]]);
    const [ok, hash, height] = await reader.verifyFinality(ev, proof);
    expect(ok).to.equal(true);
    expect(hash).to.equal(blk.hash);
    expect(height).to.equal(BigInt(blk.number));
    console.log(`      gas: verifyFinality ${await reader.verifyFinality.estimateGas(ev, proof)}`);
    const ev2 = coder.encode(EV_T, [[encodeBlockHeader({ ...blk, gasUsed: "0x1" }), "0x", 0, [], 0, [], [], []]]);
    await expect(reader.verifyFinality(ev2, proof)).to.be.revertedWith("VF-XCH-006: Ethereum payload not in beacon body");
    // The attested (signed, not finalized) header is not accepted as final.
    const att = L.hdrTuple(fu.attested_header.beacon);
    await expect(reader.verifyFinality(ev, coder.encode([FT], [[att, att, [], branch]])))
      .to.be.revertedWith("VF-XCH-006: Ethereum beacon header not finalized");
  });

  describe("negatives on real data", function () {
    let lc;
    beforeEach(async function () { lc = await deploy(); });
    const u1 = () => updateArg(F.update_period_1885);

    it("unsigned header (zero signature)", async function () {
      await expect(lc.submitUpdate({ ...u1(), signature: "0x" + "00".repeat(256) }, xy1885, sc1885.aggregate_pubkey)).to.be.revertedWith("LC: signature");
    });
    it("wrong signature (another real update's signature)", async function () {
      const other = updateArg(F.finality_update).signature;
      await expect(lc.submitUpdate({ ...u1(), signature: other }, xy1885, sc1885.aggregate_pubkey)).to.be.revertedWith("LC: signature");
    });
    it("under 2/3 participation", async function () {
      const bits = ethers.getBytes(u1().syncBits);
      for (let i = 0; i < 22; i++) bits[i] = 0;
      await expect(lc.submitUpdate({ ...u1(), syncBits: ethers.hexlify(bits) }, xy1885, sc1885.aggregate_pubkey)).to.be.revertedWith("LC: participation below 2/3");
    });
    it("wrong committee", async function () {
      await expect(lc.submitUpdate(u1(), xy1886, sc1886.aggregate_pubkey)).to.be.revertedWith("LC: wrong sync committee");
      await expect(lc.submitUpdate(updateArg(F.finality_update), xy1886, sc1886.aggregate_pubkey)).to.be.revertedWith("LC: signature period");
    });
    it("wrong fork domain", async function () {
      const lc5 = await deploy("0x05000000");
      await expect(lc5.submitUpdate(u1(), xy1885, sc1885.aggregate_pubkey)).to.be.revertedWith("LC: signature");
    });
    it("bad finality branch and bad next-committee branch", async function () {
      const u = u1();
      u.finalityBranch = u.finalityBranch.map((b, i) => (i === 2 ? flipHex(b) : b));
      await expect(lc.submitUpdate(u, xy1885, sc1885.aggregate_pubkey)).to.be.revertedWith("LC: finality branch");
      const v = u1();
      v.nextCommitteeBranch = v.nextCommitteeBranch.map((b, i) => (i === 1 ? flipHex(b) : b));
      await expect(lc.submitUpdate(v, xy1885, sc1885.aggregate_pubkey)).to.be.revertedWith("LC: next committee branch");
    });
  });
});
