// Prepare (do not broadcast) the 5% CommitmentVaultLock deployment on the seven
// EVM chains: Base, Ethereum, Arbitrum, Optimism, Polygon, BNB Smart Chain,
// Avalanche C-Chain.
//
// What it does (dry run, the only mode):
//   - builds the exact creation transaction data for each chain:
//     CommitmentVaultLock bytecode + abi.encode(environmentId, Dev Fund)
//     (Dev Fund from deployment/representativeBase.cjs);
//   - records the creation bytecode hash, the init code hash, the constructor
//     arguments, and the expected runtime code hash. The runtime hash differs
//     per chain because devFund is immutable, so it is taken by deploying the
//     same init code on the in-process Hardhat chain (local only);
//   - reads eth_chainId, eth_estimateGas (creation, no sender) and eth_gasPrice
//     from one public RPC per chain. Read only.
//   - writes deployment/lockDeploy.prepared.json.
//
// It NEVER broadcasts and NEVER reads a key, mnemonic or private-key file.
// Passing --broadcast stops with a refusal. Deploy through the MetaMask pages
// in scripts/deploy-pages/ (six chains) and base.html (Base, inside the ceremony).
//
// Post-deploy check, read only:
//   node scripts/prepareLockDeploy.cjs --check <Environment> <lockAddress> [probeSender]
// reads the deployed code hash, environmentId, devFund, fee constants, and
// simulates createNativeLock with eth_call on all sixteen durations (and one
// non-row duration that must revert). Nothing is sent. The simulated sender
// defaults to the Dev Fund; it must hold at least 0.00000001 of the native coin,
// otherwise pass any funded public address as probeSender.
//
// Usage: npx hardhat compile && node scripts/prepareLockDeploy.cjs [--no-rpc]
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const { EVM_DEV_FUND, rows } = require("../deployment/representativeBase.cjs");

const OUT = path.join(__dirname, "..", "deployment", "lockDeploy.prepared.json");
const ARTIFACT = path.join(__dirname, "..", "artifacts", "contracts", "CommitmentVaultLock.sol", "CommitmentVaultLock.json");

// Order is the deployment order: the six non-Base locks first, Base last
// (Base is deployed by base.html as step 1 of the Base ceremony).
const CHAINS = [
  { env: "Ethereum", chainId: 1, symbol: "ETH", page: "scripts/deploy-pages/ethereum.html", rpc: "https://ethereum-rpc.publicnode.com" },
  { env: "Arbitrum", chainId: 42161, symbol: "ETH", page: "scripts/deploy-pages/arbitrum.html", rpc: "https://arb1.arbitrum.io/rpc" },
  { env: "Optimism", chainId: 10, symbol: "ETH", page: "scripts/deploy-pages/optimism.html", rpc: "https://mainnet.optimism.io" },
  { env: "Polygon", chainId: 137, symbol: "POL", page: "scripts/deploy-pages/polygon.html", rpc: "https://polygon-bor-rpc.publicnode.com" },
  { env: "BNB Smart Chain", chainId: 56, symbol: "BNB", page: "scripts/deploy-pages/bnb-smart-chain.html", rpc: "https://bsc-dataseed.bnbchain.org" },
  { env: "Avalanche", chainId: 43114, symbol: "AVAX", page: "scripts/deploy-pages/avalanche.html", rpc: "https://api.avax.network/ext/bc/C/rpc" },
  { env: "Base", chainId: 8453, symbol: "ETH", page: "scripts/deploy-pages/base.html (ceremony step 1)", rpc: "https://mainnet.base.org" },
];
const DURATIONS = [3600, 604800, 2592000, 5184000, 7776000, 15552000, 31536000, 63072000, 94608000, 126144000,
  157680000, 189216000, 220752000, 252288000, 283824000, 315360000];
const short = (a) => a.slice(0, 6) + "…" + a.slice(-4);

function artifact() {
  if (!fs.existsSync(ARTIFACT)) throw new Error("CommitmentVaultLock artifact missing: run npx hardhat compile first");
  const a = JSON.parse(fs.readFileSync(ARTIFACT, "utf8"));
  if (!a.bytecode || a.bytecode === "0x") throw new Error("CommitmentVaultLock has no bytecode");
  return a;
}

function devFundFor(env) {
  const row = rows.find((r) => r.environment === env);
  if (!row || row.lock !== "CommitmentVaultLock") throw new Error(env + ": no CommitmentVaultLock row in representativeBase.cjs");
  if (!ethers.isAddress(row.devFund) || row.devFund === ethers.ZeroAddress) throw new Error(env + ": bad Dev Fund");
  return ethers.getAddress(row.devFund);
}

function initCode(a, env, devFund) {
  const args = ethers.AbiCoder.defaultAbiCoder().encode(["string", "address"], [env, devFund]);
  return { args, data: ethers.concat([a.bytecode, args]) };
}

// Expected runtime code per chain: deploy the same init code on the in-process
// Hardhat chain and read the code back. Local only.
async function expectedRuntime(a, env, devFund) {
  const hre = require("hardhat");
  if (hre.network.name !== "hardhat") throw new Error("REFUSED: runtime hash is taken only on the in-process Hardhat chain");
  const [signer] = await hre.ethers.getSigners();
  const c = await new hre.ethers.ContractFactory(a.abi, a.bytecode, signer).deploy(env, devFund);
  await c.waitForDeployment();
  const code = await hre.ethers.provider.getCode(await c.getAddress());
  return { runtimeCodeHash: ethers.keccak256(code), runtimeCodeBytes: (code.length - 2) / 2 };
}

async function rpc(url, method, params) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = await r.json();
  if (j.error) throw new Error(method + ": " + (j.error.message || JSON.stringify(j.error)));
  return j.result;
}

async function readChain(c, data) {
  const out = { rpc: c.rpc };
  try {
    const id = parseInt(await rpc(c.rpc, "eth_chainId", []), 16);
    if (id !== c.chainId) throw new Error(`RPC reports chain id ${id}, expected ${c.chainId}`);
    out.chainIdChecked = id;
    out.gasEstimate = parseInt(await rpc(c.rpc, "eth_estimateGas", [{ data }]), 16);
    out.gasPriceWei = BigInt(await rpc(c.rpc, "eth_gasPrice", [])).toString();
    out.estimatedCostNative = ethers.formatEther(BigInt(out.gasEstimate) * BigInt(out.gasPriceWei));
    out.readAt = new Date().toISOString();
  } catch (e) {
    out.error = e.message;
  }
  return out;
}

async function prepare({ withRpc = true } = {}) {
  const a = artifact();
  const creationCodeHash = ethers.keccak256(a.bytecode);
  const chains = [];
  for (const c of CHAINS) {
    const devFund = devFundFor(c.env);
    const { args, data } = initCode(a, c.env, devFund);
    const rt = await expectedRuntime(a, c.env, devFund);
    const entry = {
      environmentId: c.env, chainId: c.chainId, nativeSymbol: c.symbol, deployWith: c.page,
      constructorArgs: { environmentId: c.env, devFund }, constructorArgsEncoded: args,
      creationCodeHash, initCodeHash: ethers.keccak256(data), initCodeBytes: (data.length - 2) / 2, ...rt,
    };
    if (withRpc) entry.publicRpcRead = await readChain(c, data);
    chains.push(entry);
  }
  return {
    _note: "PREPARED, NOT BROADCAST. CommitmentVaultLock (contracts/CommitmentVaultLock.sol), 5% on all sixteen durations including the 1-hour Handshake. Built with solc 0.8.19, optimizer 200 runs, viaIR. Gas figures are eth_estimateGas reads from public RPCs at readAt; they move with chain state.",
    contract: "contracts/CommitmentVaultLock.sol:CommitmentVaultLock",
    compiler: { solc: "0.8.19", optimizerRuns: 200, viaIR: true },
    devFundSource: "deployment/representativeBase.cjs (EVM_DEV_FUND)",
    creationCodeHash,
    chains,
  };
}

// Read-only post-deploy check. provider: an ethers provider for the chain.
async function check(provider, env, address, { expectedRuntimeHash, devFund = devFundFor(env), probeFrom } = {}) {
  const a = artifact();
  const iface = new ethers.Interface(a.abi);
  const results = [];
  const ok = (name, pass, detail) => results.push({ name, pass, detail });
  const code = await provider.getCode(address);
  ok("code present", code !== "0x", ((code.length - 2) / 2) + " bytes");
  if (expectedRuntimeHash) ok("runtime code hash", ethers.keccak256(code) === expectedRuntimeHash, ethers.keccak256(code));
  const call = async (fn, args = [], extra = {}) => iface.decodeFunctionResult(fn, await provider.call({ to: address, data: iface.encodeFunctionData(fn, args), ...extra }));
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

module.exports = { CHAINS, DURATIONS, prepare, check, devFundFor, initCode };

if (require.main === module) {
  const argv = process.argv.slice(2);
  (async () => {
    if (argv.includes("--broadcast")) {
      throw new Error("REFUSED: this script never broadcasts and never reads keys. Deploy with the MetaMask pages in scripts/deploy-pages/ after operator approval.");
    }
    if (argv[0] === "--check") {
      const [, env, address, probeFrom] = argv;
      const c = CHAINS.find((x) => x.env === env);
      if (!c || !ethers.isAddress(address) || (probeFrom && !ethers.isAddress(probeFrom))) throw new Error("usage: --check <Environment> <lockAddress> [probeSender]");
      const prepared = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : null;
      const exp = prepared && prepared.chains.find((x) => x.environmentId === env);
      const provider = new ethers.JsonRpcProvider(c.rpc, c.chainId, { staticNetwork: true });
      const r = await check(provider, env, address, { expectedRuntimeHash: exp && exp.runtimeCodeHash, probeFrom });
      for (const x of r.results) console.log((x.pass ? "PASS " : "FAIL ") + x.name + "  " + x.detail);
      console.log(r.pass ? "ALL CHECKS PASSED (read only, nothing sent)" : "CHECKS FAILED (read only, nothing sent)");
      process.exit(r.pass ? 0 : 1);
    }
    const p = await prepare({ withRpc: !argv.includes("--no-rpc") });
    fs.writeFileSync(OUT, JSON.stringify(p, null, 2) + "\n");
    console.log("DRY RUN. Nothing broadcast. Wrote " + path.relative(process.cwd(), OUT));
    console.log("creation code hash " + p.creationCodeHash);
    for (const c of p.chains) {
      const r = c.publicRpcRead || {};
      console.log(`${c.environmentId} (${c.chainId}): Dev Fund ${short(c.constructorArgs.devFund)}, runtime ${c.runtimeCodeHash.slice(0, 12)}…, ` +
        (r.error ? "RPC read failed: " + r.error : r.gasEstimate ? `gas ${r.gasEstimate}, ~${Number(r.estimatedCostNative).toPrecision(3)} ${c.nativeSymbol} at ${Number(r.gasPriceWei) / 1e9} gwei` : "no RPC read"));
    }
    process.exit(0);
  })().catch((e) => { console.error(e.message); process.exit(1); });
}
