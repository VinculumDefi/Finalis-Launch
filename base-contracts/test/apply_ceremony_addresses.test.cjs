// applyCeremonyAddresses.cjs: from the Base ceremony page output to the app's
// one address file. Runs the real ceremony flow (baseCeremonyFlow.js, the code
// base.html runs) on the in-process test chain, rebuilds the exact text
// base.html shows, and feeds it to the script. Nothing is broadcast and the
// committed app file is not written.
// Base-only launch (t357u): one reader (Base), one 5% lock (Base); --locks is retired.
const { expect } = require("chai");
const { ethers } = require("hardhat");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");
const art = require("../scripts/deploy-pages/ceremony.json");
const data = require("../scripts/deploy-pages/ceremony-data.json");
const { runBaseCeremony } = require("../scripts/deploy-pages/baseCeremonyFlow.js");
const A = require("../scripts/applyCeremonyAddresses.cjs");
const SCRIPT = path.join(__dirname, "..", "scripts", "applyCeremonyAddresses.cjs");

describe("applyCeremonyAddresses (Base-only): ceremony page output to app config", function () {
  this.timeout(600000);
  let r, logText, rec, stray;

  before(async () => {
    const [signer, other] = await ethers.getSigners();
    stray = other.address;
    const lines = ["Inputs checked. Base ETH price 2403.06 USD (test). Ceremony can be signed."];
    r = await runBaseCeremony({ ethers, signer, art, data, log: (s) => lines.push(...String(s).split("\n")) });
    // The result box exactly as base.html builds it.
    lines.push("Finalized.");
    for (const k of ["lock", "vclm", "chonx", "verifier", "forge", "stake"]) lines.push(k + " " + await r[k].getAddress());
    for (const [env, c] of Object.entries(r.readers)) lines.push("reader " + env + " " + await c.getAddress());
    logText = lines.join("\n");
    rec = A.buildRecord({ logText });
  });

  it("reads every Base contract, the one Base reader and the Base 5% lock from the page text", async () => {
    for (const k of ["lock", "vclm", "chonx", "verifier", "forge", "stake"]) expect(rec.base[k]).to.equal(await r[k].getAddress());
    expect(A.READER_ENVS).to.deep.equal(["Base"]);
    expect(Object.keys(rec.readers)).to.deep.equal(["Base"]);
    expect(rec.readers.Base).to.equal(await r.readers.Base.getAddress());
    expect(rec.locks).to.deep.equal({ Base: await r.lock.getAddress() });
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
    const bad = { ...rec, _testChain: true, base: { ...rec.base, lock: await r.vclm.getAddress() }, locks: { Base: await r.vclm.getAddress() } };
    expect((await A.verifyOnChain(ethers.provider, bad).catch((e) => [String(e)])).join("\n")).to.match(/Base reader\.vault|lock|revert/i);
    const bad2 = { ...rec, _testChain: true, readers: { Base: stray } };
    expect((await A.verifyOnChain(ethers.provider, bad2).catch((e) => [String(e)])).join("\n")).to.match(/chainVerifiers\(Base\)|revert|could not decode/i);
  });

  it("writes an app file the app can import, with retired 2.5% locks marked", async () => {
    const tmp = path.join(os.tmpdir(), "vfDeployedAddresses." + process.pid + ".mjs");
    fs.writeFileSync(tmp, A.renderAppFile(rec));
    const m = await import(pathToFileURL(tmp).href);
    expect(m.CEREMONY.finalized).to.equal(true);
    expect(m.CEREMONY.next_price_run).to.equal(2);
    expect(BigInt(m.CEREMONY.launch_timestamp)).to.equal(await r.verifier.protocolLaunchTimestamp());
    expect(m.BASE_CONTRACTS.verifier).to.equal(rec.base.verifier);
    expect(Object.keys(m.LOCKS_5PCT)).to.deep.equal(["Base"]);
    expect(m.LOCKS_5PCT.Base).to.equal(rec.base.lock);
    expect(Object.keys(m.READERS)).to.deep.equal(["Base"]);
    expect(m.RETIRED_LOCKS.map((x) => x.address)).to.deep.equal(data.oldLocks);
    for (const x of m.RETIRED_LOCKS) { expect(x.new_locks).to.equal(false); expect(x.release_allowed).to.equal(true); }
    fs.unlinkSync(tmp);
    const v = A.base44Values(rec);
    expect(v.VERIFIER.short).to.match(/^0x[0-9a-fA-F]{4}…[0-9a-fA-F]{4}$/);
    expect(Object.keys(v.LOCKS)).to.deep.equal(["Base"]);
  });

  it("the committed app file is the generated template (pending) or a finalized record", () => {
    const committed = fs.readFileSync(A.APP_FILE, "utf8");
    if (committed.includes("status: 'AWAITING_DEPLOYMENT'")) expect(committed).to.equal(A.renderAppFile(null));
    else expect(committed).to.match(/status: 'FINALIZED'/);
  });

  it("refuses: no Finalized line, a Stopped line, a missing Base reader, any non-Base reader", () => {
    expect(() => A.buildRecord({ logText: logText.replace(/^Finalized\.$/gm, "") })).to.throw(/Finalized/);
    expect(() => A.buildRecord({ logText: logText + "\nStopped: user rejected" })).to.throw(/Stopped/);
    expect(() => A.buildRecord({ logText: logText.split("\n").filter((l) => !l.startsWith("reader Base")).join("\n") })).to.throw(/reader Base/);
    for (const env of ["Ethereum", "Bitcoin", "Solana"]) expect(() => A.buildRecord({ logText: logText + "\nreader " + env + " " + stray }), env).to.throw(/unexpected reader/);
  });

  it("refuses: an old 2.5% lock, an old verifier, the poster, the Dev Fund, zero, a bad checksum", () => {
    const lock = rec.base.lock;
    for (const bad of [data.oldLocks[0], data.oldLocks[1], "0xb0670826b79e29cc6a1c216Eb396D383a54af47D", "0x4e4D2d233812F513f7BAca618C35AA93799F0Df1", data.scheduledPricePoster, data.devFund, ethers.ZeroAddress]) {
      expect(() => A.buildRecord({ logText: logText.split(lock).join(bad) }), bad).to.throw(/Nothing was written/);
    }
    const i = lock.slice(2).search(/[a-fA-F]/) + 2;
    const flipped = lock.slice(0, i) + (lock[i] === lock[i].toLowerCase() ? lock[i].toUpperCase() : lock[i].toLowerCase()) + lock.slice(i + 1);
    expect(() => A.buildRecord({ logText: logText.split(lock).join(flipped) })).to.throw(/checksum/);
  });

  it("command line: a dry run prints short addresses and writes nothing; --locks is retired", () => {
    const { execFileSync } = require("child_process");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "apply-"));
    fs.writeFileSync(path.join(dir, "log.txt"), logText);
    const before = fs.readFileSync(A.APP_FILE, "utf8");
    const out = execFileSync(process.execPath, [SCRIPT, "--log", path.join(dir, "log.txt"), "--out", path.join(dir, "b44.json")]).toString();
    expect(out).to.match(/Dry run: nothing written/);
    expect(out).to.match(/Readers: 1 \(Base\)/);
    expect(out).to.not.match(/0x[0-9a-fA-F]{40}/);
    expect(fs.readFileSync(A.APP_FILE, "utf8")).to.equal(before);
    expect(JSON.parse(fs.readFileSync(path.join(dir, "b44.json"), "utf8")).VERIFIER.full).to.equal(rec.base.verifier);
    const err = (args) => { try { execFileSync(process.execPath, [SCRIPT, ...args], { stdio: "pipe" }); return ""; } catch (e) { return String(e.stderr); } };
    // --write without --rpc is refused, so nothing unchecked reaches the app.
    expect(err(["--log", path.join(dir, "log.txt"), "--write"])).to.match(/--write needs --rpc/);
    fs.writeFileSync(path.join(dir, "locks.json"), "{}");
    expect(err(["--log", path.join(dir, "log.txt"), "--locks", path.join(dir, "locks.json")])).to.match(/--locks is retired/);
    expect(fs.readFileSync(A.APP_FILE, "utf8")).to.equal(before);
    fs.rmSync(dir, { recursive: true });
  });

  it("refuses: two different addresses for one contract, or a Base contract reused", async () => {
    expect(() => A.buildRecord({ logText: logText + "\nVerifier " + stray })).to.throw(/two different addresses/);
    const v = await r.verifier.getAddress();
    expect(() => A.buildRecord({ logText: logText.split(rec.readers.Base).join(v) })).to.throw(/share the address/);
  });
});
