// PROOF ONLY (operator t254u/t257u/t258u), in-process Hardhat chain, nothing broadcast.
// Extends test/vclm_row_488_chonx.test.cjs (b1cdfe8). The real Base ceremony flow
// (scripts/deploy-pages/baseCeremonyFlow.js) is driven UNCHANGED with the real
// ceremony.json and ceremony-data.json.
//
// Operator-settled rule (t257u): (1) lifetime VCLM reaches 10,000,000 -> CHONX opens;
// (2) as soon as CHONX is available, SYNTH forging can begin, no extra CHONX threshold;
// (3) one SYNTH = 1,000 VCLM + 10,000 CHONX.
//
// Path A: the ceremony as built (Base-only launch, t430u: the 129 Base rows of
// the 589-row Revision D, no protocol-token rows).
// Path B (t258u): three extra rows after the Base rows, before finalize:
//   488 VCLM (fixed $0.10), 489 CHONX (fixed $0.01), 490 SYNTH (fixed $200).
//   Rows use custodyClass 3 / custodyPath 1 (S3, token), decimals 18, the same as
//   the other Base ERC-20 rows and the b1cdfe8 VCLM row. The fixed values are
//   OPERATOR-FIXED values posted by the poster in run 2, not market prices.
//   These rows conflict with Rev 6 VF-TOK-007 (protocol tokens are prohibited
//   lock inputs) and, for SYNTH as an input, sit next to VF-TOK-006.
//
// Settled t260u: the Forge (VinculumFinalisSynth.sol lines 61, 117 and 142)
// implements Rev 6 VF-TOK-003: forging is refused until lifetime CHONX issuance
// reaches 100,000,000. Expected behaviour.
// t262u: rows 488-490 are not written (they do nothing on chain). Indexing a
// protocol token address is refused by the Verifier (VF-REG-008).
const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const art = require("../scripts/deploy-pages/ceremony.json");
const DATA = require("../scripts/deploy-pages/ceremony-data.json");
const { runBaseCeremony } = require("../scripts/deploy-pages/baseCeremonyFlow.js");

const SCALE = 10n ** 18n;
const DAY7 = 604800n;
const YEAR10 = 315360000n;
const ETH_ID = DATA.row2.canonicalAssetId;
const ETH_PRICE = BigInt(DATA.priceUsd18);
const idOf = (sym) => ethers.solidityPackedKeccak256(["string", "string"], ["Base", sym]);
const VCLM_ID = idOf("VCLM");
const CHONX_ID = idOf("CHONX");
const SYNTH_ID = idOf("SYNTH");
const FIXED = { VCLM: SCALE / 10n, CHONX: SCALE / 100n, SYNTH: 200n * SCALE }; // operator-fixed (t258u)
const ROW = (sym, id) => ({ environmentId: "Base", canonicalAssetId: id, symbol: sym, decimals: 18, custodyClass: 3, custodyPath: 1 });
const coder = ethers.AbiCoder.defaultAbiCoder();
const key = (env, id) => ethers.solidityPackedKeccak256(["string", "bytes32"], [env, id]);
const usdOf = (units, price) => (units * price) / SCALE;
const fmt = (x) => ethers.formatEther(x);

function harness(withProtocolRows) {
  const h = { logs: [], addr: {} };
  h.data = {
    ...DATA,
    get entries() {
      if (!withProtocolRows || !h.addr.VCLM) return DATA.entries;
      return [...DATA.entries, ROW("VCLM", VCLM_ID), ROW("CHONX", CHONX_ID), ROW("SYNTH", SYNTH_ID)];
    },
    get tokenAddresses() {
      if (!withProtocolRows || !h.addr.VCLM) return DATA.tokenAddresses;
      return [...DATA.tokenAddresses,
        { environmentId: "Base", token: h.addr.VCLM, canonicalAssetId: VCLM_ID },
        { environmentId: "Base", token: h.addr.CHONX, canonicalAssetId: CHONX_ID },
        { environmentId: "Base", token: h.addr.Forge, canonicalAssetId: SYNTH_ID }];
    },
  };
  h.setup = async () => {
    [h.signer, h.user, h.recipient, h.dest, h.other] = await ethers.getSigners();
    const log = (s) => {
      h.logs.push(...String(s).split("\n"));
      for (const n of ["VCLM", "CHONX", "Forge"]) {
        const m = new RegExp("^" + n + " (0x[0-9a-fA-F]{40})$", "m").exec(s);
        if (m) h.addr[n] = ethers.getAddress(m[1]);
      }
    };
    h.r = await runBaseCeremony({ ethers, signer: h.signer, art, data: h.data, log });
    await network.provider.send("hardhat_impersonateAccount", [DATA.scheduledPricePoster]);
    await network.provider.send("hardhat_setBalance", [DATA.scheduledPricePoster, "0x56BC75E2D63100000"]);
    h.poster = await ethers.getSigner(DATA.scheduledPricePoster);
    const sh = async (c) => { const a = await c.getAddress(); return a.slice(0, 6) + "..." + a.slice(-4); };
    console.log(`      addresses: VCLM ${await sh(h.r.vclm)} CHONX ${await sh(h.r.chonx)} Verifier ${await sh(h.r.verifier)} Forge/SYNTH ${await sh(h.r.forge)} Base lock ${await sh(h.r.lock)}`);
  };
  h.pkg = (lockId, rec, assetId, custodyClass, receipt = "0x") => ({
    sourceEnvironmentId: "Base", commitmentVaultLockId: lockId, handshakeAllowanceCount: 3,
    canonicalAssetId: assetId, assetPrecision: 18, assetCustodyClass: custodyClass,
    grossAmountSmallestUnits: rec.gross, actualFeeAmountSmallestUnits: rec.fee, principalAmountSmallestUnits: rec.principal,
    feeAssetId: assetId, devFundDestination: DATA.devFund, feeTransferEvidence: ethers.id("fee:" + lockId),
    valuationTimestamp: rec.createdAt, maturityTimestamp: rec.maturity, durationSecs: rec.duration,
    selectedOutputToken: rec.outputToken, baseRecipient: rec.baseRecipient, releaseDestination: h.dest.address,
    chonxActivationReceipt: receipt, racIdentity: ethers.id("rac:" + lockId), priceRecord: "0x", sourceFinalityProof: "0x",
    lockEventProof: coder.encode(["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
      [lockId, rec.gross, rec.fee, rec.principal, rec.duration, rec.createdAt, rec.maturity]),
  });
  h.ethLock = async (wei, duration, output = 0) => {
    const lockId = ethers.hexlify(ethers.randomBytes(32));
    await (await h.r.lock.connect(h.user).createNativeLock(lockId, h.recipient.address, output, ETH_ID, ethers.ZeroHash, h.dest.address, duration,
      usdOf(wei, ETH_PRICE), { value: wei })).wait();
    return { lockId, rec: await h.r.lock.lockRecord(lockId) };
  };
  h.tokenLock = async (token, assetId, price, holder, amount, duration, output) => {
    const lockId = ethers.hexlify(ethers.randomBytes(32));
    await (await token.connect(holder).approve(await h.r.lock.getAddress(), amount)).wait();
    await (await h.r.lock.connect(holder).createErc20Lock(lockId, h.recipient.address, output, assetId, ethers.ZeroHash, h.dest.address, duration,
      await token.getAddress(), amount, usdOf(amount, price))).wait();
    return { lockId, rec: await h.r.lock.lockRecord(lockId) };
  };
  // record fee + mint; returns minted amount of the output token
  h.settle = async (lockId, rec, assetId, custodyClass, receipt) => {
    const out = rec.outputToken === 0n ? h.r.vclm : h.r.chonx;
    const before = await out.balanceOf(h.recipient.address);
    const p = h.pkg(lockId, rec, assetId, custodyClass, receipt);
    await (await h.r.verifier.recordFeeAndRac(p)).wait();
    await (await h.r.verifier.verifyAndMint(p, 0)).wait();
    return (await out.balanceOf(h.recipient.address)) - before;
  };
  h.crossChonxActivation = async () => {
    const { lockId, rec } = await h.ethLock(45n * SCALE, YEAR10);
    const p = h.pkg(lockId, rec, ETH_ID, 2);
    await (await h.r.verifier.recordFeeAndRac(p)).wait();
    await expect(h.r.verifier.verifyAndMint(p, 0)).to.emit(h.r.verifier, "ChonxActivated");
  };
  // ordinary ETH locks requesting CHONX until lifetime CHONX >= 100,000,000 (Forge VF-TOK-003)
  h.crossSynthThreshold = async () => {
    const T = await h.r.forge.SYNTH_ACTIVATION_THRESHOLD();
    for (let i = 0; i < 5 && (await h.r.verifier.cumulativeChonxIssued()) < T; i++) {
      const { lockId, rec } = await h.ethLock(45n * SCALE, YEAR10, 1);
      await h.settle(lockId, rec, ETH_ID, 2, "0x01");
    }
    expect(await h.r.verifier.cumulativeChonxIssued()).to.be.gte(T);
  };
  return h;
}

// Shared forge checks: exact burn, approvals, short balances, count 2.
async function forgeChecks(h, label) {
  const { r, recipient } = h;
  const F = await r.forge.getAddress();
  const v0 = await r.vclm.totalSupply(), c0 = await r.chonx.totalSupply();
  const vb0 = await r.vclm.balanceOf(recipient.address), cb0 = await r.chonx.balanceOf(recipient.address);
  // no approvals -> refused by the VCLM token's burnFrom
  await expect(r.forge.connect(recipient).forge(1)).to.be.revertedWith("VFT: insufficient allowance");
  await (await r.vclm.connect(recipient).approve(F, 1000n * SCALE)).wait();
  await expect(r.forge.connect(recipient).forge(1)).to.be.revertedWith("VFT: insufficient allowance"); // CHONX not approved
  await (await r.chonx.connect(recipient).approve(F, 10_000n * SCALE)).wait();
  await expect(r.forge.connect(recipient).forge(1)).to.emit(r.forge, "SynthForged").withArgs(recipient.address, 1n, 1000n * SCALE, 10_000n * SCALE);
  expect(await r.forge.balanceOf(recipient.address)).to.equal(SCALE);
  expect(await r.forge.totalSupply()).to.equal(SCALE);
  expect(vb0 - (await r.vclm.balanceOf(recipient.address))).to.equal(1000n * SCALE);
  expect(cb0 - (await r.chonx.balanceOf(recipient.address))).to.equal(10_000n * SCALE);
  // burned, not transferred: total supply falls, nothing lands at the Forge or the Dev Fund
  expect(v0 - (await r.vclm.totalSupply())).to.equal(1000n * SCALE);
  expect(c0 - (await r.chonx.totalSupply())).to.equal(10_000n * SCALE);
  expect(await r.vclm.balanceOf(F)).to.equal(0n);
  expect(await r.chonx.balanceOf(F)).to.equal(0n);
  expect(await r.vclm.allowance(recipient.address, F)).to.equal(0n);
  expect(await r.chonx.allowance(recipient.address, F)).to.equal(0n);
  console.log(`      [${label}] forge(1): 1 SYNTH minted; 1,000 VCLM and 10,000 CHONX burned via burnFrom (total supply down by exactly that)`);

  // short balances: a fresh holder with 999.99 VCLM / 10,000 CHONX, then 1,000 VCLM / 9,999.99 CHONX
  const o = h.other;
  const short = 1000n * SCALE - SCALE / 100n, shortC = 10_000n * SCALE - SCALE / 100n;
  await (await r.vclm.connect(recipient).transfer(o.address, short)).wait();
  await (await r.chonx.connect(recipient).transfer(o.address, 10_000n * SCALE)).wait();
  await (await r.vclm.connect(o).approve(F, 10n ** 30n)).wait();
  await (await r.chonx.connect(o).approve(F, 10n ** 30n)).wait();
  await expect(r.forge.connect(o).forge(1)).to.be.revertedWith("VFT: insufficient balance");
  await (await r.vclm.connect(recipient).transfer(o.address, SCALE / 100n)).wait(); // now exactly 1,000 VCLM
  await (await r.chonx.connect(o).transfer(recipient.address, SCALE / 100n)).wait(); // now 9,999.99 CHONX
  await expect(r.forge.connect(o).forge(1)).to.be.revertedWith("VFT: insufficient balance");
  await (await r.chonx.connect(recipient).transfer(o.address, SCALE / 100n)).wait(); // exactly 10,000 CHONX
  await (await r.forge.connect(o).forge(1)).wait();
  expect(await r.forge.balanceOf(o.address)).to.equal(SCALE);
  expect(await r.vclm.balanceOf(o.address)).to.equal(0n);
  expect(await r.chonx.balanceOf(o.address)).to.equal(0n);
  expect(shortC).to.equal(10_000n * SCALE - SCALE / 100n);
  await expect(r.forge.connect(o).forge(0)).to.be.revertedWith("SYNTH: zero forge count");

  // forging 2 needs 2,000 VCLM + 20,000 CHONX
  await (await r.vclm.connect(recipient).transfer(o.address, 2000n * SCALE)).wait();
  await (await r.chonx.connect(recipient).transfer(o.address, 20_000n * SCALE - 1n)).wait();
  await expect(r.forge.connect(o).forge(2)).to.be.revertedWith("VFT: insufficient balance");
  await (await r.chonx.connect(recipient).transfer(o.address, 1n)).wait();
  await expect(r.forge.connect(o).forge(2)).to.emit(r.forge, "SynthForged").withArgs(o.address, 2n, 2000n * SCALE, 20_000n * SCALE);
  expect(await r.forge.balanceOf(o.address)).to.equal(3n * SCALE);
  expect(await r.vclm.balanceOf(o.address)).to.equal(0n);
  expect(await r.chonx.balanceOf(o.address)).to.equal(0n);
  console.log(`      [${label}] 999.99 VCLM or 9,999.99 CHONX refused (VFT: insufficient balance); forge(2) burned exactly 2,000 VCLM + 20,000 CHONX`);
}

describe("Path A (129 Base rows, ceremony as built): ETH -> VCLM -> CHONX -> SYNTH forge (proof, test chain)", function () {
  this.timeout(900000);
  const h = harness(false);
  before(async () => { await h.setup(); });

  it("A0: ceremony writes the 129 Base rows and 128 Base token addresses, no protocol-token row, and finalizes", async () => {
    expect(h.logs).to.include("registry 129/129");
    expect(h.logs).to.include("token addresses 128/128");
    expect((await h.r.verifier.assetPrecisionTable(key("Base", VCLM_ID))).canonicalAssetId).to.equal(ethers.ZeroHash);
    expect(await h.r.verifier.configurationFinalized()).to.equal(true);
    expect(await h.r.forge.verifier()).to.equal(await h.r.verifier.getAddress());
    expect(await h.r.forge.vclmToken()).to.equal(await h.r.vclm.getAddress());
    expect(await h.r.forge.chonxToken()).to.equal(await h.r.chonx.getAddress());
  });

  it("A1: an ETH lock mints VCLM", async () => {
    const { lockId, rec } = await h.ethLock(1n * SCALE, DAY7);
    const minted = await h.settle(lockId, rec, ETH_ID, 2);
    expect(minted).to.be.gt(0n);
    console.log("      [A] VCLM minted for 1 ETH, 7 days:", fmt(minted));
  });

  it("A2: an ETH lock requesting CHONX before activation records the fee but is refused at mint (VF-COM-025)", async () => {
    const { lockId, rec } = await h.ethLock(1n * SCALE, DAY7, 1);
    const p = h.pkg(lockId, rec, ETH_ID, 2, "0x01");
    await (await h.r.verifier.recordFeeAndRac(p)).wait();
    await expect(h.r.verifier.verifyAndMint(p, 0)).to.be.revertedWith("VF-COM-025: CHONX not activated");
    expect(await h.r.chonx.totalSupply()).to.equal(0n);
  });

  it("A3: forging before CHONX activation is refused (VF-TOK-003: SYNTH not activated)", async () => {
    const F = await h.r.forge.getAddress();
    await (await h.r.vclm.connect(h.recipient).approve(F, 1000n * SCALE)).wait();
    await (await h.r.chonx.connect(h.recipient).approve(F, 10_000n * SCALE)).wait();
    await expect(h.r.forge.connect(h.recipient).forge(1)).to.be.revertedWith("VF-TOK-003: SYNTH not activated");
    await (await h.r.vclm.connect(h.recipient).approve(F, 0)).wait();
    await (await h.r.chonx.connect(h.recipient).approve(F, 0)).wait();
  });

  it("A4: ordinary ETH locks cross 10,000,000 lifetime VCLM and activate CHONX", async () => {
    await h.crossChonxActivation();
    expect(await h.r.verifier.chonxActivated()).to.equal(true);
    console.log("      [A] lifetime VCLM after crossing:", fmt(await h.r.verifier.cumulativeVclmIssued()));
  });

  it("A5: after activation, an ordinary ETH lock requesting CHONX mints CHONX (no VCLM row needed)", async () => {
    const { lockId, rec } = await h.ethLock(1n * SCALE, DAY7, 1);
    const minted = await h.settle(lockId, rec, ETH_ID, 2, "0x01");
    expect(minted).to.be.gt(0n);
    console.log("      [A] CHONX minted for 1 ETH, 7 days:", fmt(minted));
  });

  it("A6 (Rev 6 VF-TOK-003, settled t260u): CHONX is available but the Forge refuses until lifetime CHONX reaches 100,000,000", async () => {
    expect(await h.r.forge.SYNTH_ACTIVATION_THRESHOLD()).to.equal(100_000_000n * SCALE);
    expect(await h.r.verifier.chonxActivated()).to.equal(true);
    expect(await h.r.verifier.cumulativeChonxIssued()).to.be.lt(100_000_000n * SCALE);
    const F = await h.r.forge.getAddress();
    await (await h.r.vclm.connect(h.recipient).approve(F, 1000n * SCALE)).wait();
    await (await h.r.chonx.connect(h.recipient).approve(F, 10_000n * SCALE)).wait();
    expect(await h.r.chonx.balanceOf(h.recipient.address)).to.be.gte(10_000n * SCALE);
    expect(await h.r.vclm.balanceOf(h.recipient.address)).to.be.gte(1000n * SCALE);
    await expect(h.r.forge.connect(h.recipient).forge(1)).to.be.revertedWith("VF-TOK-003: SYNTH not activated");
    expect(await h.r.forge.synthActivated()).to.equal(false);
    await (await h.r.vclm.connect(h.recipient).approve(F, 0)).wait();
    await (await h.r.chonx.connect(h.recipient).approve(F, 0)).wait();
    console.log("      [A] forge refused with CHONX active; lifetime CHONX:", fmt(await h.r.verifier.cumulativeChonxIssued()));
  });

  it("A7: ordinary ETH->CHONX locks push lifetime CHONX past 100,000,000; then forge burns exactly 1,000 VCLM + 10,000 CHONX per SYNTH", async () => {
    await h.crossSynthThreshold();
    console.log("      [A] lifetime CHONX after crossing:", fmt(await h.r.verifier.cumulativeChonxIssued()));
    await forgeChecks(h, "A");
    expect(await h.r.forge.synthActivated()).to.equal(true);
  });
});

describe("Rows 488-490 with their token addresses are refused by the ceremony (t262u, VF-TOK-007 / VF-REG-008, test chain)", function () {
  this.timeout(900000);
  it("the Verifier refuses to index VCLM, CHONX or SYNTH, so the ceremony stops before finalize", async () => {
    const h = harness(true);
    await expect(h.setup()).to.be.revertedWith("VF-REG-008: protocol token is not a lock input");
    expect(h.logs).to.include("registry 132/132"); // 129 Base rows plus the three
    // 128 Base token addresses plus the three: the last batch of 50 holds the
    // three and is refused whole, so the index never reaches 131/131.
    expect(h.logs).to.not.include("token addresses 131/131");
    expect(h.logs).to.not.include("Finalized.");
  });
});
