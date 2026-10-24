// Base-only launch: read-only post-deploy check of the Base lock
// (BaseCommitmentVaultLock). The Base lock is deployed inside the Base
// ceremony (base.html, 6th prompt) after VCLM, CHONX, the Verifier, the Forge
// and Stake, because its constructor takes their addresses (t262u). No lock is
// prepared or deployed on any other chain for this launch, so this script no
// longer builds non-Base creation transactions or writes
// deployment/lockDeploy.prepared.json.
//
// Post-deploy check, read only:
//   node scripts/prepareLockDeploy.cjs --check Base <lockAddress> [probeSender]
// reads the deployed code hash (immutables masked), the three protocol token
// addresses it refuses, environmentId, devFund, fee constants, and simulates
// createNativeLock with eth_call on all sixteen durations (and one non-row
// duration that must revert). Nothing is sent. The simulated sender defaults to
// the Dev Fund; it must hold at least 0.00000001 ETH, otherwise pass any funded
// public address as probeSender. Any environment other than Base is refused.
//
// It NEVER broadcasts and NEVER reads a key, mnemonic or private-key file.
// Passing --broadcast stops with a refusal.
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const { EVM_DEV_FUND } = require("../deployment/representativeBase.cjs");

const BASE = { env: "Base", chainId: 8453, symbol: "ETH", page: "scripts/deploy-pages/base.html (ceremony, 6th prompt)", rpc: "https://mainnet.base.org" };
const BASE_ARTIFACT = path.join(__dirname, "..", "artifacts", "contracts", "BaseCommitmentVaultLock.sol", "BaseCommitmentVaultLock.json");
const DURATIONS = [3600, 604800, 2592000, 5184000, 7776000, 15552000, 31536000, 63072000, 94608000, 126144000,
  157680000, 189216000, 220752000, 252288000, 283824000, 315360000];
const short = (a) => a.slice(0, 6) + "…" + a.slice(-4);

function artifact(file = BASE_ARTIFACT) {
  if (!fs.existsSync(file)) throw new Error(path.basename(file) + " artifact missing: run npx hardhat compile first");
  const a = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!a.bytecode || a.bytecode === "0x") throw new Error(path.basename(file) + " has no bytecode");
  return a;
}

function devFundFor(env) {
  if (env !== "Base") throw new Error("REFUSED: Base-only launch, no lock on " + env);
  return ethers.getAddress(EVM_DEV_FUND);
}

// Read-only post-deploy check. provider: an ethers provider for the chain.
async function check(provider, env, address, { devFund, probeFrom } = {}) {
  if (env !== "Base") throw new Error("REFUSED: Base-only launch, no lock on " + env + " is checked");
  devFund = devFund || devFundFor(env);
  const a = artifact();
  const iface = new ethers.Interface(a.abi);
  const results = [];
  const ok = (name, pass, detail) => results.push({ name, pass, detail });
  const code = await provider.getCode(address);
  ok("code present", code !== "0x", ((code.length - 2) / 2) + " bytes");
  const call = async (fn, args = [], extra = {}) => iface.decodeFunctionResult(fn, await provider.call({ to: address, data: iface.encodeFunctionData(fn, args), ...extra }));
  {
    // Base lock: code hash with the four immutables masked, then the three
    // protocol token addresses it refuses (VF-TOK-007).
    const { LOCK_RUNTIME_HASH, maskedCodeHash } = require("./applyCeremonyAddresses.cjs");
    const h = code === "0x" ? "none" : maskedCodeHash(code);
    ok("runtime code hash (immutables masked)", h === LOCK_RUNTIME_HASH, h);
    const sym = new ethers.Interface(["function symbol() view returns (string)"]);
    for (const [fn, want] of [["vclmToken", "VCLM"], ["chonxToken", "CHONX"], ["synthToken", "SYNTH"]]) {
      const t = ethers.getAddress((await call(fn))[0]);
      let got = "no code";
      if ((await provider.getCode(t)) !== "0x") {
        try { got = sym.decodeFunctionResult("symbol", await provider.call({ to: t, data: sym.encodeFunctionData("symbol") }))[0]; } catch { got = "no symbol()"; }
      }
      ok(`${fn} is ${want}`, got === want, short(t) + " " + got);
      ok(`isProtocolToken(${want}) = true`, (await call("isProtocolToken", [t]))[0] === true, short(t));
    }
  }
  ok("environmentId", (await call("environmentId"))[0] === env, env);
  ok("devFund", ethers.getAddress((await call("devFund"))[0]) === ethers.getAddress(devFund), short(devFund));
  ok("STANDARD_FEE_BPS = 500", (await call("STANDARD_FEE_BPS"))[0] === 500n, "500");
  ok("BPS_DENOMINATOR = 10000", (await call("BPS_DENOMINATOR"))[0] === 10000n, "10000");
  ok("HANDSHAKE_DURATION = 3600", (await call("HANDSHAKE_DURATION"))[0] === 3600n, "3600");
  // Simulate one lock per duration with eth_call (nothing is sent).
  const from = probeFrom || devFund;
  const gross = 10n ** 10n; // 0.00000001 of the native coin; the probe sender must hold this much
  for (const d of DURATIONS) {
    const usd = d === 3600 ? 15n * 10n ** 15n : 25n * 10n ** 18n;
    const id = ethers.keccak256(ethers.toUtf8Bytes("vf-post-deploy-probe-" + d));
    try {
      const [fee, principal] = await call("createNativeLock", [id, from, 0, ethers.ZeroHash, ethers.ZeroHash, from, d, usd], { from, value: gross });
      ok(`duration ${d}s: fee is exactly 5%`, fee === (gross * 500n) / 10000n && principal === gross - fee, `fee ${fee}, principal ${principal}`);
    } catch (e) {
      ok(`duration ${d}s: fee is exactly 5%`, false, "eth_call failed: " + (e.shortMessage || e.message));
    }
  }
  let reverted = false;
  try { await call("createNativeLock", [ethers.ZeroHash, from, 0, ethers.ZeroHash, ethers.ZeroHash, from, 3601, 25n * 10n ** 18n], { from, value: gross }); } catch { reverted = true; }
  ok("non-row duration (3601s) reverts", reverted, reverted ? "reverted" : "accepted");
  return { pass: results.every((r) => r.pass), results };
}

module.exports = { BASE, DURATIONS, check, devFundFor };

if (require.main === module) {
  const argv = process.argv.slice(2);
  (async () => {
    if (argv.includes("--broadcast")) {
      throw new Error("REFUSED: this script never broadcasts and never reads keys. The Base lock is deployed by scripts/deploy-pages/base.html inside the ceremony, signed by the founder.");
    }
    if (argv[0] === "--check") {
      const [, env, address, probeFrom] = argv;
      if (env !== "Base") throw new Error("REFUSED: Base-only launch, only --check Base <lockAddress> [probeSender] is supported");
      if (!ethers.isAddress(address) || (probeFrom && !ethers.isAddress(probeFrom))) throw new Error("usage: --check Base <lockAddress> [probeSender]");
      const provider = new ethers.JsonRpcProvider(BASE.rpc, BASE.chainId, { staticNetwork: true });
      const r = await check(provider, env, address, { probeFrom });
      for (const x of r.results) console.log((x.pass ? "PASS " : "FAIL ") + x.name + "  " + x.detail);
      console.log(r.pass ? "ALL CHECKS PASSED (read only, nothing sent)" : "CHECKS FAILED (read only, nothing sent)");
      process.exit(r.pass ? 0 : 1);
    }
    throw new Error("usage: node scripts/prepareLockDeploy.cjs --check Base <lockAddress> [probeSender] (Base-only launch; nothing is prepared for other chains)");
  })().catch((e) => { console.error(e.message); process.exit(1); });
}
