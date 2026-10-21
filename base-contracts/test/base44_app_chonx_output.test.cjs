// t270u: Base44 section 7 (CHONX output) proved against the real Revision B
// contracts on the in-process test chain, through the real ceremony flow.
//   - The read-only views section 7 uses exist with the stated selectors.
//   - Before activation a CHONX-output mint is refused (VF-COM-025).
//   - After activation, the app's own proof package (the section 6 tuple,
//     built exactly like lockMint.js) with selectedOutputToken 1 and the
//     section 7 receipt abi.encode(uint256 chonxActivationBlock, uint256
//     lockBlockNumber) mints CHONX to the lock's Base recipient; the same
//     package with an empty receipt is refused (VF-COM-025: missing
//     activation receipt).
// Nothing is broadcast. The app files are read, not changed.
const { expect } = require("chai");
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const art = require("../scripts/deploy-pages/ceremony.json");
const data = require("../scripts/deploy-pages/ceremony-data.json");
const { runBaseCeremony, EVM_ENVS } = require("../scripts/deploy-pages/baseCeremonyFlow.js");

const APP = path.join(__dirname, "..", "..", "app", "base44-lock-2026-10-13", "src", "lib");
const mintCfg = fs.readFileSync(path.join(APP, "mintConfig.js"), "utf8");
const TUPLE = mintCfg.match(/export const PROOF_TUPLE = "([^"]+)";/)[1].replace("string handshakeIdentity, ", "");
// Section 6 d) + section 7 ABI lines, as the app will have them.
const APP_VERIFIER_ABI = [
  `function recordFeeAndRac(${TUPLE} pkg)`,
  `function verifyAndMint(${TUPLE} pkg, uint256 daysSinceLaunch) returns (bool)`,
  "function chonxActivated() view returns (bool)",
  "function chonxActivationBlock() view returns (uint256)",
  "function lifetimeVclmIssued() view returns (uint256)",
  "function CHONX_ACTIVATION_THRESHOLD() view returns (uint256)",
  "function syncChonxActivation()",
  "event VerificationSucceeded(bytes32 indexed lockIdHash, string sourceEnvironmentId, address indexed recipient, uint8 outputToken, uint256 amount)",
];
const LOCK_RECORD_ABI = [
  "function devFund() view returns (address)",
  "function lockRecord(bytes32) view returns (tuple(bool exists, bool released, address creator, address releaseDestination, address asset, address baseRecipient, uint8 outputToken, uint256 gross, uint256 fee, uint256 principal, uint256 duration, uint256 multiplierBps, uint256 createdAt, uint256 maturity, bytes32 assetIdentity, bytes32 valuationReference, bytes bindingPayload))",
  "event FeeRouted(bytes32 indexed lockId, address indexed devFund, address asset, uint256 fee)",
];
const SCALE = 10n ** 18n;
const YEAR10 = 315360000n;
const DAY30 = 2592000n;
const coder = ethers.AbiCoder.defaultAbiCoder();

describe("Base44 section 7: CHONX output from the app's own package (test chain)", function () {
  this.timeout(600000);
  let r, user, recipient, C, verifier, lockRO, ethId, price;

  before(async () => {
    const [signer, u, rcp] = await ethers.getSigners();
    user = u; recipient = rcp;
    const L = new ethers.ContractFactory(art.CommitmentVaultLock.abi, art.CommitmentVaultLock.bytecode, signer);
    const newLocks = {};
    for (const env of EVM_ENVS) newLocks[env] = await (await L.deploy(env, data.evmDevFunds[env])).getAddress();
    r = await runBaseCeremony({ ethers, signer, art, data, newLocks });
    C = { lock: await r.lock.getAddress(), verifier: await r.verifier.getAddress(), chonx: await r.chonx.getAddress() };
    verifier = new ethers.Contract(C.verifier, APP_VERIFIER_ABI, user);
    lockRO = new ethers.Contract(C.lock, LOCK_RECORD_ABI, ethers.provider);
    ethId = data.row2.canonicalAssetId;
    price = BigInt(data.priceUsd18);
  });

  // createNativeLock as the app does it, then the app's package (lockMint.js, section 6 tuple).
  async function appLock(wei, duration, output) {
    const lockId = ethers.hexlify(ethers.randomBytes(32));
    const lockW = new ethers.Contract(C.lock, art.BaseCommitmentVaultLock.abi, user);
    const usd = (wei * price) / SCALE;
    const receipt = await (await lockW.createNativeLock(lockId, recipient.address, output, ethId, ethers.ZeroHash, user.address, duration, usd, { value: wei })).wait();
    const record = await lockRO.lockRecord(lockId, { blockTag: receipt.blockNumber });
    const i = new ethers.Interface(LOCK_RECORD_ABI);
    const feeLog = receipt.logs.find((l) => l.address.toLowerCase() === C.lock.toLowerCase() && l.topics[0] === i.getEvent("FeeRouted").topicHash && l.topics[1] === lockId);
    const devFund = await lockRO.devFund();
    const pkg = (chonxActivationReceipt) => ({
      sourceEnvironmentId: "Base", commitmentVaultLockId: lockId, handshakeAllowanceCount: 3,
      canonicalAssetId: record.assetIdentity, assetPrecision: 18, assetCustodyClass: 2,
      grossAmountSmallestUnits: record.gross, actualFeeAmountSmallestUnits: record.fee, principalAmountSmallestUnits: record.principal, feeAssetId: record.assetIdentity,
      devFundDestination: devFund, feeTransferEvidence: receipt.hash,
      valuationTimestamp: record.createdAt, maturityTimestamp: record.maturity, durationSecs: record.duration,
      selectedOutputToken: record.outputToken, baseRecipient: record.baseRecipient, releaseDestination: record.releaseDestination, chonxActivationReceipt,
      racIdentity: ethers.solidityPackedKeccak256(["string", "bytes32", "bytes32", "uint256", "bytes32", "uint256"], ["Base", lockId, receipt.hash, feeLog.index, record.assetIdentity, record.fee]),
      priceRecord: "0x",
      sourceFinalityProof: coder.encode(["bytes32", "uint256", "uint8", "uint256", "bool", "bool"], [receipt.blockHash, receipt.blockNumber, 6, 0, false, false]),
      lockEventProof: coder.encode(["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"], [lockId, record.gross, record.fee, record.principal, record.duration, record.createdAt, record.maturity]),
    });
    return { lockId, receipt, record, pkg };
  }

  it("section 7 ABI lines exist on the new Verifier with the stated selectors", () => {
    const app = new ethers.Interface(APP_VERIFIER_ABI);
    const real = new ethers.Interface(art.VinculumFinalisVerifier.abi);
    const want = { recordFeeAndRac: "0xf0f64b60", verifyAndMint: "0x8c24712a", chonxActivated: "0x8dae0c3c", chonxActivationBlock: "0x702f8530", lifetimeVclmIssued: "0x7a197938", CHONX_ACTIVATION_THRESHOLD: "0xffeae027", syncChonxActivation: "0x609b7566" };
    for (const f of app.fragments) {
      if (f.type === "event") { expect(real.getEvent(f.name).topicHash).to.equal(app.getEvent(f.name).topicHash); continue; }
      expect(real.getFunction(f.name).selector, f.name).to.equal(f.selector);
      if (want[f.name]) expect(f.selector, f.name).to.equal(want[f.name]);
    }
    console.log(`      CHONX_ACTIVATION_THRESHOLD() ${app.getFunction("CHONX_ACTIVATION_THRESHOLD").selector}, chonxActivationBlock() ${app.getFunction("chonxActivationBlock").selector}`);
  });

  it("before activation: the views read closed and a CHONX-output mint is refused (VF-COM-025)", async () => {
    expect(await verifier.chonxActivated()).to.equal(false);
    expect(await verifier.CHONX_ACTIVATION_THRESHOLD()).to.equal(10_000_000n * SCALE);
    expect(await verifier.lifetimeVclmIssued()).to.be.lt(10_000_000n * SCALE);
    const c = await appLock(1n * SCALE / 100n, DAY30, 1);
    const p = c.pkg(coder.encode(["uint256", "uint256"], [0n, BigInt(c.receipt.blockNumber)]));
    await (await verifier.recordFeeAndRac(p)).wait();
    await expect(verifier.verifyAndMint(p, 0)).to.be.revertedWith("VF-COM-025: CHONX not activated");
  });

  it("a VCLM lock crosses 10,000,000; chonxActivated and chonxActivationBlock are set", async () => {
    const v = await appLock(45n * SCALE, YEAR10, 0);
    const p = v.pkg("0x");
    await (await verifier.recordFeeAndRac(p)).wait();
    await expect(verifier.verifyAndMint(p, 0)).to.emit(r.verifier, "ChonxActivated");
    expect(await verifier.chonxActivated()).to.equal(true);
    expect(await verifier.lifetimeVclmIssued()).to.be.gte(10_000_000n * SCALE);
    expect(await verifier.chonxActivationBlock()).to.be.gt(0n);
  });

  it("after activation: empty receipt refused; the section 7 receipt mints CHONX to the Base recipient", async () => {
    const actBlock = await verifier.chonxActivationBlock();
    // Empty receipt (the current app's "0x") on a CHONX lock: refused.
    const e = await appLock(1n * SCALE / 100n, DAY30, 1);
    const pe = e.pkg("0x");
    await (await verifier.recordFeeAndRac(pe)).wait();
    await expect(verifier.verifyAndMint(pe, 0)).to.be.revertedWith("VF-COM-025: missing activation receipt");
    // Section 7 receipt.
    const c = await appLock(1n * SCALE / 100n, DAY30, 1);
    expect(BigInt(c.receipt.blockNumber)).to.be.gt(actBlock);
    expect(c.record.outputToken).to.equal(1n);
    const receiptBytes = coder.encode(["uint256", "uint256"], [actBlock, BigInt(c.receipt.blockNumber)]);
    expect(ethers.dataLength(receiptBytes)).to.equal(64);
    const p = c.pkg(receiptBytes);
    await (await verifier.recordFeeAndRac(p)).wait();
    const mintReceipt = await (await verifier.verifyAndMint(p, 0)).wait();
    const mintI = new ethers.Interface(APP_VERIFIER_ABI);
    const lockIdHash = ethers.solidityPackedKeccak256(["string", "bytes32"], ["Base", c.lockId]);
    const ok = mintReceipt.logs.find((l) => l.address.toLowerCase() === C.verifier.toLowerCase() && l.topics[0] === mintI.getEvent("VerificationSucceeded").topicHash && l.topics[1] === lockIdHash);
    const ev = mintI.parseLog(ok);
    expect(ev.args.outputToken).to.equal(1n);
    expect(ev.args.recipient).to.equal(recipient.address);
    const t = new ethers.Interface(["event Transfer(address indexed from, address indexed to, uint256 value)"]);
    const got = mintReceipt.logs.filter((l) => l.address.toLowerCase() === C.chonx.toLowerCase() && l.topics[0] === t.getEvent("Transfer").topicHash)
      .map((l) => t.parseLog(l).args).filter((x) => x.from === ethers.ZeroAddress && x.to === recipient.address).reduce((a, x) => a + x.value, 0n);
    expect(got).to.equal(ev.args.amount);
    expect(got).to.be.gt(0n);
    console.log(`      CHONX lock at block ${c.receipt.blockNumber} (activation block ${actBlock}) minted ${ethers.formatEther(got)} CHONX; receipt ${receiptBytes.slice(0, 18)}…`);
  });
});
