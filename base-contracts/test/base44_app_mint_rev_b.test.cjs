// The saved live Base44 app (app/base44-lock-2026-10-13) against the Revision B
// contracts, on the in-process test chain. Proves what Base44 section 6 must
// change and that the change is enough:
//   - unchanged, the app's mint ABI does not exist on the new Verifier, so the
//     app stops before sending ("Verifier ABI mismatch");
//   - with the one ABI change (handshakeIdentity removed from the proof tuple)
//     and the new addresses, the app's own checks pass and its own package
//     records the fee and mints VCLM to the lock's Base recipient.
// Nothing is broadcast. The app files are read, not changed.
const { expect } = require("chai");
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const art = require("../scripts/deploy-pages/ceremony.json");
const data = require("../scripts/deploy-pages/ceremony-data.json");
const { runBaseCeremony } = require("../scripts/deploy-pages/baseCeremonyFlow.js");

const APP = path.join(__dirname, "..", "..", "app", "base44-lock-2026-10-13", "src", "lib");
const mintCfg = fs.readFileSync(path.join(APP, "mintConfig.js"), "utf8");
const lockMintSrc = fs.readFileSync(path.join(APP, "lockMint.js"), "utf8");
const OLD_TUPLE = mintCfg.match(/export const PROOF_TUPLE = "([^"]+)";/)[1];
const NEW_TUPLE = OLD_TUPLE.replace("string handshakeIdentity, ", "");
const abiLines = (tuple) => [...mintCfg.matchAll(/^\s+[`"](function [^`"]+|event [^`"]+)[`"],?$/gm)].map((m) => m[1].replace("${PROOF_TUPLE}", tuple));
const VERIFIER_ABI = (tuple) => abiLines(tuple).filter((l) => /recordFeeAndRac|verifyAndMint|configurationFinalized|chainVerifiers|assetPrecisionTable|scheduledPrices|vclmToken|chonxToken|protocolLaunchTimestamp|VerificationSucceeded/.test(l));
const LOCK_RECORD_ABI = abiLines(OLD_TUPLE).filter((l) => /environmentId|devFund\(\)|lockRecord|FeeRouted/.test(l));
const APP_SELECTORS = [...lockMintSrc.matchAll(/\["(recordFeeAndRac|verifyAndMint)", "(0x[0-9a-f]{8})"\]/g)].map((m) => [m[1], m[2]]);

describe("Base44 app mint path against the Revision B contracts (section 6)", function () {
  this.timeout(600000);
  let r, user, recipient;

  before(async () => {
    const [signer, u, rcp] = await ethers.getSigners();
    user = u; recipient = rcp;
    r = await runBaseCeremony({ ethers, signer, art, data });
  });

  it("reads the app's ABI: one proof tuple field differs (handshakeIdentity)", () => {
    expect(OLD_TUPLE).to.include("string handshakeIdentity, ");
    expect(NEW_TUPLE).to.not.include("handshakeIdentity");
    expect(APP_SELECTORS.map((x) => x[0])).to.deep.equal(["recordFeeAndRac", "verifyAndMint"]);
    expect(VERIFIER_ABI(NEW_TUPLE)).to.have.length(10);
    expect(LOCK_RECORD_ABI).to.have.length(4);
  });

  it("unchanged app: its two mint selectors are not on the new Verifier, so it stops before sending", async () => {
    const code = await ethers.provider.getCode(await r.verifier.getAddress());
    const i = new ethers.Interface(VERIFIER_ABI(OLD_TUPLE));
    for (const [name, sel] of APP_SELECTORS) {
      expect(i.getFunction(name).selector).to.equal(sel);
      expect(code.includes("63" + sel.slice(2))).to.equal(false);
    }
  });

  it("updated app: new selectors exist on the new Verifier and every other app ABI line matches", async () => {
    const code = await ethers.provider.getCode(await r.verifier.getAddress());
    const app = new ethers.Interface(VERIFIER_ABI(NEW_TUPLE));
    const real = new ethers.Interface(art.VinculumFinalisVerifier.abi);
    for (const f of app.fragments) {
      if (f.type === "event") { expect(real.getEvent(f.name).topicHash, f.name).to.equal(app.getEvent(f.name).topicHash); continue; }
      expect(real.getFunction(f.name).selector, f.name).to.equal(f.selector);
    }
    for (const name of ["recordFeeAndRac", "verifyAndMint"]) expect(code.includes("63" + app.getFunction(name).selector.slice(2)), name).to.equal(true);
    const lockI = new ethers.Interface(art.BaseCommitmentVaultLock.abi);
    const appLock = new ethers.Interface(LOCK_RECORD_ABI);
    for (const f of appLock.fragments) {
      if (f.type === "event") expect(lockI.getEvent(f.name).topicHash).to.equal(appLock.getEvent(f.name).topicHash);
      else expect(lockI.getFunction(f.name).selector).to.equal(f.selector);
    }
  });

  it("updated app: its readMintContext checks pass and its own package mints VCLM to the Base recipient", async () => {
    const p = ethers.provider;
    const C = { lock: await r.lock.getAddress(), verifier: await r.verifier.getAddress(), vclm: await r.vclm.getAddress(), chonx: await r.chonx.getAddress(), baseReader: await r.readers.Base.getAddress() };
    const verifierRO = new ethers.Contract(C.verifier, VERIFIER_ABI(NEW_TUPLE), p);
    const lockRO = new ethers.Contract(C.lock, LOCK_RECORD_ABI, p);
    // readMintContext, as the app does it.
    expect(await lockRO.environmentId()).to.equal("Base");
    expect(await verifierRO.configurationFinalized()).to.equal(true);
    expect((await verifierRO.chainVerifiers("Base")).toLowerCase()).to.equal(C.baseReader.toLowerCase());
    const chain = new ethers.Contract(C.baseReader, ["function ENVIRONMENT_ID() view returns(string)", "function vault() view returns(address)"], p);
    expect(await chain.ENVIRONMENT_ID()).to.equal("Base");
    expect((await chain.vault()).toLowerCase()).to.equal(C.lock.toLowerCase());
    expect((await verifierRO.vclmToken()).toLowerCase()).to.equal(C.vclm.toLowerCase());
    expect((await verifierRO.chonxToken()).toLowerCase()).to.equal(C.chonx.toLowerCase());
    expect(await verifierRO.protocolLaunchTimestamp()).to.not.equal(0n);
    const ethId = data.row2.canonicalAssetId;
    const key = ethers.solidityPackedKeccak256(["string", "bytes32"], ["Base", ethId]);
    const entry = await verifierRO.assetPrecisionTable(key);
    expect(entry.canonicalAssetId).to.equal(ethId);
    expect(Number(entry.decimals)).to.equal(18);
    const price = await verifierRO.scheduledPrices(key);
    expect(price.usable).to.equal(true);

    // A Handshake at about $0.015 at the run 1 price, on the new 5% Base lock.
    const gross = (15n * 10n ** 15n * 10n ** 18n) / price.priceUsd18 / 1000n * 1000n; // wei
    const usd = (gross * price.priceUsd18) / 10n ** 18n;                               // app's scheduledGrossUsd
    const lockId = ethers.hexlify(ethers.randomBytes(32));
    const lockW = new ethers.Contract(C.lock, art.BaseCommitmentVaultLock.abi, user);
    const receipt = await (await lockW.createNativeLock(lockId, recipient.address, 0, ethId, ethers.ZeroHash, user.address, 3600, usd, { value: gross })).wait();
    const record = await lockRO.lockRecord(lockId, { blockTag: receipt.blockNumber });
    expect(record.fee).to.equal((gross * 500n) / 10000n); // 5% on the Handshake
    const lockRecordInterface = new ethers.Interface(LOCK_RECORD_ABI);
    const feeLog = receipt.logs.find((l) => l.address.toLowerCase() === C.lock.toLowerCase() && l.topics[0] === lockRecordInterface.getEvent("FeeRouted").topicHash && l.topics[1] === lockId);
    expect(feeLog, "FeeRouted").to.not.equal(undefined);
    const devFund = await lockRO.devFund();
    const encode = ethers.AbiCoder.defaultAbiCoder();
    // The app's package, field for field, without handshakeIdentity.
    const pkg = {
      sourceEnvironmentId: "Base", commitmentVaultLockId: lockId,
      handshakeAllowanceCount: 3,
      canonicalAssetId: record.assetIdentity, assetPrecision: 18, assetCustodyClass: 2,
      grossAmountSmallestUnits: record.gross, actualFeeAmountSmallestUnits: record.fee, principalAmountSmallestUnits: record.principal, feeAssetId: record.assetIdentity,
      devFundDestination: devFund, feeTransferEvidence: receipt.hash,
      valuationTimestamp: record.createdAt, maturityTimestamp: record.maturity, durationSecs: record.duration,
      selectedOutputToken: record.outputToken, baseRecipient: record.baseRecipient, releaseDestination: record.releaseDestination, chonxActivationReceipt: "0x",
      racIdentity: ethers.solidityPackedKeccak256(["string", "bytes32", "bytes32", "uint256", "bytes32", "uint256"], ["Base", lockId, receipt.hash, feeLog.index, record.assetIdentity, record.fee]),
      priceRecord: "0x",
      sourceFinalityProof: encode.encode(["bytes32", "uint256", "uint8", "uint256", "bool", "bool"], [receipt.blockHash, receipt.blockNumber, 6, 0, false, false]),
      lockEventProof: encode.encode(["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"], [lockId, record.gross, record.fee, record.principal, record.duration, record.createdAt, record.maturity]),
    };
    const verifier = new ethers.Contract(C.verifier, VERIFIER_ABI(NEW_TUPLE), user);
    expect((await (await verifier.recordFeeAndRac(pkg)).wait()).status).to.equal(1);
    const mintReceipt = await (await verifier.verifyAndMint(pkg, 0)).wait();
    const mintI = new ethers.Interface(VERIFIER_ABI(NEW_TUPLE));
    const lockIdHash = ethers.solidityPackedKeccak256(["string", "bytes32"], ["Base", lockId]);
    const ok = mintReceipt.logs.find((l) => l.address.toLowerCase() === C.verifier.toLowerCase() && l.topics[0] === mintI.getEvent("VerificationSucceeded").topicHash && l.topics[1] === lockIdHash);
    expect(ok, "VerificationSucceeded").to.not.equal(undefined);
    const ev = mintI.parseLog(ok);
    expect(ev.args.recipient).to.equal(recipient.address);
    expect(ev.args.amount > 0n).to.equal(true);
    const t = new ethers.Interface(["event Transfer(address indexed from, address indexed to, uint256 value)"]);
    const got = mintReceipt.logs.filter((l) => l.address.toLowerCase() === C.vclm.toLowerCase() && l.topics[0] === t.getEvent("Transfer").topicHash)
      .map((l) => t.parseLog(l).args).filter((x) => x.from === ethers.ZeroAddress && x.to === recipient.address).reduce((a, x) => a + x.value, 0n);
    expect(got).to.equal(ev.args.amount);
    expect(await r.vclm.balanceOf(recipient.address)).to.equal(got);
  });
});
