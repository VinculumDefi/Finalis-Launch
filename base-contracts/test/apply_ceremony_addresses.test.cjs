// applyCeremonyAddresses.cjs: from the Base ceremony page output to the app's
// one address file. Runs the real ceremony flow (baseCeremonyFlow.js, the code
// base.html runs) on the in-process test chain, rebuilds the exact text
// base.html shows, and feeds it to the script. Nothing is broadcast and the
// committed app file is not written.
const { expect } = require("chai");
const { ethers } = require("hardhat");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");
const art = require("../scripts/deploy-pages/ceremony.json");
const data = require("../scripts/deploy-pages/ceremony-data.json");
const { runBaseCeremony, EVM_ENVS } = require("../scripts/deploy-pages/baseCeremonyFlow.js");
const A = require("../scripts/applyCeremonyAddresses.cjs");

describe("applyCeremonyAddresses: ceremony page output to app config", function () {
  this.timeout(600000);
  let r, newLocks, logText, rec;

  before(async () => {
    const [signer] = await ethers.getSigners();
    const L = new ethers.ContractFactory(art.CommitmentVaultLock.abi, art.CommitmentVaultLock.bytecode, signer);
    newLocks = {};
    for (const env of EVM_ENVS) newLocks[env] = await (await L.deploy(env, data.evmDevFunds[env])).getAddress();
    const lines = ["Inputs checked. Base ETH price 2403.06 USD (test). Ceremony can be signed."];
    r = await runBaseCeremony({ ethers, signer, art, data, newLocks, log: (s) => lines.push(...String(s).split("\n")) });
    // The result box exactly as base.html builds it.
    lines.push("Finalized.");
    for (const k of ["lock", "vclm", "chonx", "verifier", "forge", "stake"]) lines.push(k + " " + await r[k].getAddress());
    for (const [env, c] of Object.entries(r.readers)) lines.push("reader " + env + " " + await c.getAddress());
    logText = lines.join("\n");
    rec = A.buildRecord({ logText, locksJson: newLocks });
  });

  it("reads every Base contract, the 15 readers and the seven 5% locks from the page text", async () => {
    for (const k of ["lock", "vclm", "chonx", "verifier", "forge", "stake"]) expect(rec.base[k]).to.equal(await r[k].getAddress());
    expect(Object.keys(rec.readers)).to.have.length(15);
    expect(rec.readers).to.not.have.property("Solana");
    for (const [env, c] of Object.entries(r.readers)) expect(rec.readers[env]).to.equal(await c.getAddress());
    expect(Object.keys(rec.locks)).to.deep.equal(["Base", ...EVM_ENVS]);
    expect(rec.locks.Base).to.equal(await r.lock.getAddress());
    for (const env of EVM_ENVS) expect(rec.locks[env]).to.equal(newLocks[env]);
    expect(rec.scheduledPricePoster).to.equal(ethers.getAddress(data.scheduledPricePoster));
  });

  it("read-only on-chain checks pass against the finalized test-chain ceremony", async () => {
    const withLaunch = { ...rec, _testChain: true };
    const problems = await A.verifyOnChain(ethers.provider, withLaunch);
    expect(problems).to.deep.equal([]);
    expect(BigInt(withLaunch.launchTimestamp)).to.equal(await r.verifier.protocolLaunchTimestamp());
    rec.launchTimestamp = withLaunch.launchTimestamp;
  });

  it("on-chain checks catch a reader or lock that does not match", async () => {
    const bad = { ...rec, _testChain: true, locks: { ...rec.locks, Ethereum: newLocks.Arbitrum } };
    const problems = await A.verifyOnChain(ethers.provider, bad);
    expect(problems.join("\n")).to.match(/Ethereum reader\.lock/);
    const bad2 = { ...rec, _testChain: true, readers: { ...rec.readers, Stellar: rec.readers.Bitcoin } };
    expect((await A.verifyOnChain(ethers.provider, bad2)).join("\n")).to.match(/chainVerifiers\(Stellar\)/);
  });

  it("writes an app file the app can import, with retired 2.5% locks marked", async () => {
    const tmp = path.join(os.tmpdir(), "vfDeployedAddresses." + process.pid + ".mjs");
    fs.writeFileSync(tmp, A.renderAppFile(rec));
    const m = await import(pathToFileURL(tmp).href);
    expect(m.CEREMONY.finalized).to.equal(true);
    expect(m.CEREMONY.next_price_run).to.equal(2);
    expect(BigInt(m.CEREMONY.launch_timestamp)).to.equal(await r.verifier.protocolLaunchTimestamp());
    expect(m.BASE_CONTRACTS.verifier).to.equal(rec.base.verifier);
    expect(m.LOCKS_5PCT["BNB Smart Chain"]).to.equal(newLocks["BNB Smart Chain"]);
    expect(Object.keys(m.READERS)).to.have.length(15);
    expect(m.RETIRED_LOCKS.map((x) => x.address)).to.deep.equal(data.oldLocks);
    for (const x of m.RETIRED_LOCKS) { expect(x.new_locks).to.equal(false); expect(x.release_allowed).to.equal(true); }
    fs.unlinkSync(tmp);
    const v = A.base44Values(rec);
    expect(v.VERIFIER.short).to.match(/^0x[0-9a-fA-F]{4}…[0-9a-fA-F]{4}$/);
    expect(Object.keys(v.LOCKS)).to.have.length(7);
  });

  it("the committed app file is the generated template (pending) or a finalized record", () => {
    const committed = fs.readFileSync(A.APP_FILE, "utf8");
    if (committed.includes("status: 'AWAITING_DEPLOYMENT'")) expect(committed).to.equal(A.renderAppFile(null));
    else expect(committed).to.match(/status: 'FINALIZED'/);
  });

  it("refuses: no Finalized line, a Stopped line, a missing reader, an extra reader", () => {
    expect(() => A.buildRecord({ logText: logText.replace(/^Finalized\.$/gm, ""), locksJson: newLocks })).to.throw(/Finalized/);
    expect(() => A.buildRecord({ logText: logText + "\nStopped: user rejected", locksJson: newLocks })).to.throw(/Stopped/);
    expect(() => A.buildRecord({ logText: logText.split("\n").filter((l) => !l.startsWith("reader Zcash")).join("\n"), locksJson: newLocks })).to.throw(/reader Zcash/);
    expect(() => A.buildRecord({ logText: logText + "\nreader Solana " + newLocks.Ethereum, locksJson: newLocks })).to.throw(/unexpected reader/);
  });

  it("refuses: an old 2.5% lock, an old verifier, the poster, the Dev Fund, zero, a bad checksum", () => {
    for (const bad of [data.oldLocks[0], data.oldLocks[1], "0xb0670826b79e29cc6a1c216Eb396D383a54af47D", "0x4e4D2d233812F513f7BAca618C35AA93799F0Df1", data.scheduledPricePoster, data.devFund, ethers.ZeroAddress]) {
      expect(() => A.buildRecord({ logText, locksJson: { ...newLocks, Polygon: bad } }), bad).to.throw(/Nothing was written/);
    }
    const addr = newLocks.Optimism;
    const i = addr.slice(2).search(/[a-fA-F]/) + 2;
    const flipped = addr.slice(0, i) + (addr[i] === addr[i].toLowerCase() ? addr[i].toUpperCase() : addr[i].toLowerCase()) + addr.slice(i + 1);
    expect(() => A.buildRecord({ logText, locksJson: { ...newLocks, Optimism: flipped } })).to.throw(/checksum/);
    const { Avalanche, ...five } = newLocks;
    expect(() => A.buildRecord({ logText, locksJson: five })).to.throw(/Avalanche/);
    expect(() => A.buildRecord({ logText, locksJson: { ...newLocks, Solana: newLocks.Ethereum } })).to.throw(/unknown chain/);
  });

  it("command line: a dry run prints short addresses and writes nothing", () => {
    const { execFileSync } = require("child_process");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "apply-"));
    fs.writeFileSync(path.join(dir, "log.txt"), logText);
    fs.writeFileSync(path.join(dir, "locks.json"), JSON.stringify(newLocks));
    const before = fs.readFileSync(A.APP_FILE, "utf8");
    const out = execFileSync(process.execPath, [path.join(__dirname, "..", "scripts", "applyCeremonyAddresses.cjs"), "--log", path.join(dir, "log.txt"), "--locks", path.join(dir, "locks.json"), "--out", path.join(dir, "b44.json")]).toString();
    expect(out).to.match(/Dry run: nothing written/);
    expect(out).to.match(/Readers: 15/);
    expect(out).to.not.match(/0x[0-9a-fA-F]{40}/);
    expect(fs.readFileSync(A.APP_FILE, "utf8")).to.equal(before);
    expect(JSON.parse(fs.readFileSync(path.join(dir, "b44.json"), "utf8")).VERIFIER.full).to.equal(rec.base.verifier);
    // --write without --rpc is refused, so nothing unchecked reaches the app.
    let err = "";
    try { execFileSync(process.execPath, [path.join(__dirname, "..", "scripts", "applyCeremonyAddresses.cjs"), "--log", path.join(dir, "log.txt"), "--locks", path.join(dir, "locks.json"), "--write"], { stdio: "pipe" }); }
    catch (e) { err = String(e.stderr); }
    expect(err).to.match(/--write needs --rpc/);
    expect(fs.readFileSync(A.APP_FILE, "utf8")).to.equal(before);
    fs.rmSync(dir, { recursive: true });
  });

  it("refuses: two different addresses for one contract, or a Base contract reused", async () => {
    const v = await r.verifier.getAddress();
    expect(() => A.buildRecord({ logText: logText + "\nVerifier " + newLocks.Ethereum, locksJson: newLocks })).to.throw(/two different addresses/);
    expect(() => A.buildRecord({ logText, locksJson: { ...newLocks, Arbitrum: v } })).to.throw(/equals verifier/);
    // The same new lock address on two non-Base chains is allowed (same deployer and nonce).
    expect(() => A.buildRecord({ logText, locksJson: { ...newLocks, Arbitrum: newLocks.Ethereum } })).to.not.throw();
  });
});
