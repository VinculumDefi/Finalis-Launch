/**
 * Writes one deploy page per network into scripts/deploy-pages/.
 *
 * Reads only repository sources:
 *   artifacts/ (npx hardhat compile --force, current contracts/)
 *   deployment/representativeBase.cjs   (environments, locks, Dev Funds)
 *   deployment/assetRegistry.resolved.json (scripts/deploy-pages/resolveAssetRegistry.cjs)
 *   ../utxo-locks/{finality,lock}.py    (confirmations, dust, binding rule)
 *   ../src/solana-vault                 (program id, config seed)
 *
 * Sends nothing, signs nothing, reads no key. The pages it writes stop before
 * finalize: no Verifier.finalize(), no token initialize().
 *
 * Usage: npx hardhat compile --force && node scripts/deploy-pages/buildDeployPages.cjs
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const bs58mod = require("bs58");
const { ed25519 } = require("@noble/curves/ed25519");
const { sha256 } = require("@noble/hashes/sha256");
const { EVM_DEV_FUND, rows } = require("../../deployment/representativeBase.cjs");

const BC = path.resolve(__dirname, "../..");
const ROOT = path.resolve(BC, "..");
const OUT_DIR = __dirname;
const bs58 = bs58mod.default || bs58mod;

const BASE_DEV_FUND = "0xFD21BF773A193CDcb9F793100CB13a8baAdc3e9a";
if (EVM_DEV_FUND !== BASE_DEV_FUND) throw new Error("representativeBase.cjs EVM Dev Fund differs from the Base Dev Fund");
if (rows.length !== 16) throw new Error(`expected 16 environments, found ${rows.length}`);
if (rows.some((r) => /cosmos|atom/i.test(r.environment))) throw new Error("Cosmos Hub is not part of this deployment");

// The six contracts already on Base are an old copy (scripts/ceremony.html).
// They are listed only so the Base page refuses them.
const OLD_BASE_COPY = [
  "0x6FdF43c396cefDa15630E628F160563563C84Af1",
  "0x8Be366686006d6340e1fa32d8aF3BCd8fca78248",
  "0xE727981580A9CbD6ff7b0d38c17a4876F5a56a8D",
  "0x4e4D2d233812F513f7BAca618C35AA93799F0Df1",
  "0x91D8Ee15FAB6c194a96f2d51742b2bEE6B0e7682",
  "0x177182975853B5A39850d242F411b657CDFf0ED8",
];

const SOURCE_COMMIT = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT }).toString().trim();

function artifact(rel, name) {
  const a = JSON.parse(fs.readFileSync(path.join(BC, "artifacts/contracts", rel, name + ".json"), "utf8"));
  if (!a.bytecode || a.bytecode === "0x") throw new Error(name + " has no bytecode");
  return { abi: a.abi, bytecode: a.bytecode };
}
const ARTS = {
  token: artifact("VinculumFinalisToken.sol", "VinculumFinalisToken"),
  lock: artifact("CommitmentVaultLock.sol", "CommitmentVaultLock"),
  verifier: artifact("VinculumFinalisVerifier.sol", "VinculumFinalisVerifier"),
  synth: artifact("VinculumFinalisSynth.sol", "VinculumFinalisSynth"),
  stake: artifact("VinculumFinalisStake.sol", "VinculumFinalisStake"),
};

const registry = JSON.parse(fs.readFileSync(path.join(BC, "deployment/assetRegistry.resolved.json"), "utf8"));

const utxo = JSON.parse(
  execFileSync("python3", ["-B", "-c",
    "import json,finality,lock;print(json.dumps({'conf':finality.PROTOCOL_CONFIRMATIONS,'dust':lock.P2PKH_DUST_MINIMUM,'raw':list(lock.RAW_BINDING_CHAINS),'fp':list(lock.FINGERPRINT_BINDING_CHAINS),'fee':lock.FEE_BPS}))"],
  { cwd: path.join(ROOT, "utxo-locks") }).toString()
);

const libRs = fs.readFileSync(path.join(ROOT, "src/solana-vault/programs/vf-solana-vault/src/lib.rs"), "utf8");
const SOLANA_PROGRAM_ID = /declare_id!\("([1-9A-HJ-NP-Za-km-z]+)"\)/.exec(libRs)[1];
const constantsRs = fs.readFileSync(path.join(ROOT, "src/solana-vault/programs/vf-solana-vault/src/constants.rs"), "utf8");
const SEED_CONFIG = /SEED_CONFIG: &\[u8\] = b"([^"]+)"/.exec(constantsRs)[1];
function findPda(seedStr, programId) {
  const pid = bs58.decode(programId);
  const P = ed25519.ExtendedPoint || ed25519.Point;
  for (let bump = 255; bump >= 0; bump--) {
    const h = sha256(Buffer.concat([Buffer.from(seedStr), Buffer.from([bump]), Buffer.from(pid), Buffer.from("ProgramDerivedAddress")]));
    try { P.fromHex(h); } catch (e) { return { address: bs58.encode(h), bump }; }
  }
  throw new Error("no PDA");
}
const SOLANA_CONFIG_PDA = findPda(SEED_CONFIG, SOLANA_PROGRAM_ID);
// Solana mainnet-beta genesis hash, read with getGenesisHash from api.mainnet-beta.solana.com.
const SOLANA_MAINNET_GENESIS = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";

const EVM_NETWORKS = {
  Base: { file: "base.html", name: "Base mainnet", id: 8453 },
  Ethereum: { file: "ethereum.html", name: "Ethereum mainnet", id: 1 },
  Polygon: { file: "polygon.html", name: "Polygon PoS mainnet", id: 137 },
  Optimism: { file: "optimism.html", name: "OP Mainnet (Optimism)", id: 10 },
  Arbitrum: { file: "arbitrum.html", name: "Arbitrum One", id: 42161 },
  "BNB Smart Chain": { file: "bnb-smart-chain.html", name: "BNB Smart Chain mainnet", id: 56 },
  Avalanche: { file: "avalanche.html", name: "Avalanche C-Chain mainnet", id: 43114 },
};
const UTXO_NETWORKS = {
  Bitcoin: { file: "bitcoin.html", key: "bitcoin", name: "Bitcoin mainnet" },
  "Bitcoin Cash": { file: "bitcoin-cash.html", key: "bitcoin-cash", name: "Bitcoin Cash mainnet" },
  Litecoin: { file: "litecoin.html", key: "litecoin", name: "Litecoin mainnet" },
  Dogecoin: { file: "dogecoin.html", key: "dogecoin", name: "Dogecoin mainnet" },
  DigiByte: { file: "digibyte.html", key: "digibyte", name: "DigiByte mainnet" },
  Zcash: { file: "zcash.html", key: "zcash", name: "Zcash mainnet (transparent)" },
};
const OTHER_NETWORKS = {
  Solana: { file: "solana.html", name: "Solana mainnet-beta" },
  Stellar: { file: "stellar.html", name: "Stellar public network" },
  "XRP Ledger": { file: "xrp-ledger.html", name: "XRP Ledger mainnet" },
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const J = (v) => JSON.stringify(v).replace(/</g, "\\u003c");
const rowFor = (env) => { const r = rows.find((x) => x.environment === env); if (!r) throw new Error("no row " + env); return r; };
const regFor = (env) => registry.entries.filter((e) => e.environmentId === env);

function registryTable(env) {
  const list = regFor(env);
  if (!list.length) return "<p>No Approved Asset Registry rows for " + esc(env) + ".</p>";
  const lines = list.map((e) => {
    const state = e.decimals == null ? "not written: " + e.unresolvedReason : e.sameKeyAsRow != null ? "same Verifier key as row " + e.sameKeyAsRow + "; not a second write" : "written on the Base page";
    return `<tr><td>${e.row}</td><td>${esc(e.symbol)}</td><td>${esc(e.assetId)}</td><td><code>${e.canonicalAssetId}</code></td><td>${e.decimals == null ? "-" : e.decimals}</td><td>S${e.custodyClass}</td><td>${e.custodyPath === 0 ? "native" : "token"}</td><td>${esc(state)}</td></tr>`;
  });
  return `<table border="1" cellpadding="3" cellspacing="0"><tr><th>row</th><th>symbol</th><th>assetId</th><th>canonicalAssetId</th><th>decimals</th><th>class</th><th>path</th><th>Base Verifier registry</th></tr>${lines.join("")}</table>`;
}

function header(title, network, env) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
</head>
<body>
<h1>${esc(title)}</h1>
<p>Network: <b>${esc(network)}</b>. Environment id: <b>${esc(env)}</b>. Built from Finalis-Launch source at commit <code>${SOURCE_COMMIT}</code> (origin/main). This page stops before finalize.</p>
`;
}

// ---------------------------------------------------------------- EVM shared
const EVM_COMMON_JS = `
const logEl = document.getElementById("log");
function log(line) {
  logEl.textContent += line + "\\n";
}
let halted = false;
if (window.ethereum && window.ethereum.on) {
  window.ethereum.on("chainChanged", (id) => {
    if (String(id).toLowerCase() !== CHAIN.hex) {
      halted = true;
      log("Wallet changed to chain " + parseInt(id, 16) + ". Stopped. Nothing more will be sent from this page. Reload to start again.");
    }
  });
}

async function requireChain() {
  const eth = window.ethereum;
  if (!eth) throw new Error("MetaMask is not installed.");
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN.hex }] });
  } catch (err) {
    throw new Error("MetaMask did not switch to " + CHAIN.name + " (chain id " + CHAIN.id + "): " + (err.message || String(err)) + ". Nothing was sent.");
  }
  const chainId = String(await eth.request({ method: "eth_chainId" })).toLowerCase();
  if (chainId !== CHAIN.hex) throw new Error("Wallet is on chain id " + parseInt(chainId, 16) + ", not " + CHAIN.name + " (" + CHAIN.id + "). Nothing was sent.");
  const accounts = await eth.request({ method: "eth_requestAccounts" });
  if (!accounts || !accounts[0]) throw new Error("MetaMask returned no account. Nothing was sent.");
  halted = false;
  return { eth, from: ethers.getAddress(accounts[0]) };
}

// Checked again right before every transaction.
async function assertChain(eth) {
  const chainId = String(await eth.request({ method: "eth_chainId" })).toLowerCase();
  if (halted || chainId !== CHAIN.hex) {
    halted = true;
    throw new Error("Wallet is on chain id " + parseInt(chainId, 16) + ", not " + CHAIN.name + " (" + CHAIN.id + "). Stopped before sending.");
  }
}

async function waitReceipt(eth, hash) {
  let receipt = null;
  while (!receipt) {
    receipt = await eth.request({ method: "eth_getTransactionReceipt", params: [hash] });
    if (!receipt) await new Promise((r) => setTimeout(r, 2000));
  }
  return receipt;
}

async function deploy(eth, from, label, abi, bytecode, args) {
  const factory = new ethers.ContractFactory(abi, bytecode);
  const unsigned = await factory.getDeployTransaction(...args);
  await assertChain(eth);
  log("Waiting for MetaMask: deploy " + label + " on " + CHAIN.name);
  const hash = await eth.request({
    method: "eth_sendTransaction",
    params: [{ from, data: unsigned.data, value: "0x0" }],
  });
  log(label + " tx " + hash);
  const receipt = await waitReceipt(eth, hash);
  if (receipt.status !== "0x1" || !receipt.contractAddress) {
    throw new Error(label + " was not deployed. Stopping.");
  }
  const address = ethers.getAddress(receipt.contractAddress);
  log(label + " " + address + " (" + CHAIN.name + ", chain id " + CHAIN.id + ")");
  return { address, receipt };
}

async function hasCode(eth, address) {
  const code = await eth.request({ method: "eth_getCode", params: [address, "latest"] });
  return !!code && code !== "0x";
}

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || "null"); } catch (e) { return null; }
}
function save(obj) {
  localStorage.setItem(STORE_KEY, JSON.stringify(obj));
}
`;

const CDN = `<script src="https://cdnjs.cloudflare.com/ajax/libs/ethers/6.13.5/ethers.umd.min.js"></script>`;

// ---------------------------------------------------------------- Base page
function basePage() {
  const net = EVM_NETWORKS.Base;
  const row = rowFor("Base");
  const evmDevFunds = rows.filter((r) => /^0x[0-9a-fA-F]{40}$/.test(r.devFund)).map((r) => ({ env: r.environment, devFund: r.devFund }));
  if (evmDevFunds.length !== 7) throw new Error("expected seven EVM Dev Fund rows");
  const nonEvmDevFunds = rows.filter((r) => !/^0x/.test(r.devFund)).map((r) => ({ env: r.environment, devFund: r.devFund }));
  const writes = registry.entries.filter((e) => e.decimals != null && e.sameKeyAsRow == null)
    .map((e) => [e.row, e.environmentId, e.assetId, e.canonicalAssetId, e.symbol, e.decimals, e.custodyClass, e.custodyPath]);
  const notWritten = registry.entries.filter((e) => e.decimals == null || e.sameKeyAsRow != null)
    .map((e) => ({ row: e.row, env: e.environmentId, symbol: e.symbol, why: e.decimals == null ? e.unresolvedReason : "same Verifier key as row " + e.sameKeyAsRow }));
  const minArts = ARTS;

  return header("Vinculum Protocol - Base deploy", net.name + " (chain id " + net.id + ")", "Base") + `
<p>Connects MetaMask to Base (chain id 8453) and refuses any other chain. Deploys the current VCLM, CHONX, CommitmentVaultLock (Base), VinculumFinalisVerifier, VinculumFinalisSynth (forge), and VinculumFinalisStake from this commit, then runs the deployment-ceremony writes on the new Verifier: price write permission to the price fetcher, Dev Fund for the seven EVM environments, and the full Approved Asset Registry. Each transaction opens its own MetaMask popup. Nothing is sent before you sign.</p>
<p>It does not use the six contracts already on Base (old copy). It refuses them if they are pasted or saved.</p>
<p>It stops before finalize. It never sends Verifier.finalize(), VCLM.initialize() or CHONX.initialize(). It writes no price: the Verifier accepts applyScheduledPriceRun only from the price fetcher and only after finalize.</p>
<p>
<label for="fetcher">Existing price fetcher address (becomes scheduledPricePoster). Required. It must not be the connected wallet. No address is filled in because the repository does not record one.</label><br>
<input id="fetcher" type="text" size="46" placeholder="0x..." autocomplete="off">
</p>
<p>
<label for="resumeVerifier">Optional: resume on a Verifier this page already deployed (otherwise the saved addresses in this browser are used)</label><br>
<input id="resumeVerifier" type="text" size="46" placeholder="0x..." autocomplete="off">
</p>
<button id="go" type="button">Connect, deploy, and configure (stops before finalize)</button>
<button id="show" type="button">Print addresses</button>
<button id="clear" type="button">Forget saved addresses</button>
<pre id="log"></pre>
<h2>Plan</h2>
<ol>
<li>VCLM: VinculumFinalisToken("Vinculum", "VCLM", 10,000,000,000e18). launchTimestamp = timestamp of the block holding this transaction.</li>
<li>CHONX: VinculumFinalisToken("Chonx", "CHONX", 100,000,000,000e18).</li>
<li>Base lock: CommitmentVaultLock("Base", ${BASE_DEV_FUND}).</li>
<li>Verifier: VinculumFinalisVerifier(VCLM, CHONX).</li>
<li>Forge: VinculumFinalisSynth(Verifier, VCLM, CHONX).</li>
<li>Stake: VinculumFinalisStake(VCLM, CHONX, Forge, Verifier, launchTimestamp).</li>
<li>Verifier.setScheduledPricePoster(price fetcher).</li>
<li>Verifier.configureDevFund for ${evmDevFunds.map((d) => esc(d.env)).join(", ")} = ${BASE_DEV_FUND} (deployment/representativeBase.cjs).</li>
<li>Verifier.registerAssetPrecision for ${writes.length} registry entries (${registry.counts.entries} rows from ${registry.registry.count}, Cosmos row dropped; ${notWritten.length} rows cannot be written, listed below).</li>
<li><b>Stop.</b> Not sent: Verifier.finalize(); VCLM.initialize(Verifier, Stake); CHONX.initialize(Verifier, 0x0000000000000000000000000000000000000000).</li>
</ol>
<p>Non-EVM Dev Fund destinations are not addresses, and configureDevFund(string, address) in the current Verifier cannot hold them. They are printed, not written: ${nonEvmDevFunds.map((d) => esc(d.env) + " " + esc(d.devFund)).join("; ")}.</p>
<p>Registry source: <code>${esc(registry.registry.url)}</code> sha256 <code>${registry.registry.sha256}</code>, resolved ${esc(registry.resolvedAt)} by scripts/deploy-pages/resolveAssetRegistry.cjs (deployment/assetRegistry.resolved.json).</p>
<h3>Registry rows that are not written</h3>
<ul>${notWritten.map((n) => `<li>row ${n.row} ${esc(n.env)} ${esc(n.symbol)}: ${esc(n.why)}</li>`).join("")}</ul>
${CDN}
<script>
const CHAIN = { id: ${net.id}, hex: "0x${net.id.toString(16)}", name: ${J(net.name)} };
const STORE_KEY = "vinculum-deploy-base-" + ${J(SOURCE_COMMIT)};
const DEV_FUND = ${J(BASE_DEV_FUND)};
const BASE_LOCK = ${J({ environmentId: row.environment, lock: row.lock })};
const EVM_DEV_FUNDS = ${J(evmDevFunds)};
const NON_EVM_DEV_FUNDS = ${J(nonEvmDevFunds)};
const OLD_BASE_COPY = ${J(OLD_BASE_COPY)};
const VCLM_HARD_CAP = 10000000000n * 10n ** 18n;
const CHONX_HARD_CAP = 100000000000n * 10n ** 18n;
// [row, environmentId, assetId, canonicalAssetId, symbol, decimals, custodyClass, custodyPath]
const REGISTRY = ${J(writes)};
const REGISTRY_NOT_WRITTEN = ${J(notWritten)};
const ARTS = ${J(minArts)};
${EVM_COMMON_JS}
const VERIFIER = new ethers.Interface(ARTS.verifier.abi);
const TOKEN = new ethers.Interface(ARTS.token.abi);

async function read(eth, iface, to, name, args = []) {
  const data = iface.encodeFunctionData(name, args);
  const out = await eth.request({ method: "eth_call", params: [{ to, data }, "latest"] });
  return iface.decodeFunctionResult(name, out);
}

async function send(eth, from, to, iface, label, name, args) {
  const data = iface.encodeFunctionData(name, args);
  const tx = { from, to, data, value: "0x0" };
  await assertChain(eth);
  try {
    await eth.request({ method: "eth_call", params: [tx, "latest"] });
  } catch (err) {
    throw new Error(label + " would revert (" + (err.message || String(err)) + "). Nothing was sent. Stopping.");
  }
  log("Waiting for MetaMask: " + label);
  const hash = await eth.request({ method: "eth_sendTransaction", params: [tx] });
  const receipt = await waitReceipt(eth, hash);
  if (receipt.status !== "0x1") throw new Error(label + " failed on-chain (tx " + hash + "). Stopping.");
  log(label + " confirmed, tx " + hash);
  return receipt;
}

function refuseOld(label, address) {
  if (OLD_BASE_COPY.map((a) => a.toLowerCase()).includes(String(address).toLowerCase())) {
    throw new Error(label + " " + address + " is one of the six old contracts already on Base. This page does not use them. Nothing was sent.");
  }
}

function printAddresses(d, fetcher) {
  log("");
  log("Network: " + CHAIN.name + ", chain id " + CHAIN.id);
  const names = ["VCLM", "CHONX", "Lock", "Verifier", "Forge", "Stake"];
  for (const n of names) log((n === "Lock" ? "Base lock (CommitmentVaultLock)" : n === "Forge" ? "Forge (VinculumFinalisSynth)" : n).padEnd(38) + (d && d[n] ? d[n] : "not deployed") + "  [" + CHAIN.name + "]");
  if (d && d.launchTimestamp) log("launchTimestamp".padEnd(38) + d.launchTimestamp);
  log("Base Dev Fund".padEnd(38) + DEV_FUND + "  [" + CHAIN.name + "]");
  for (const x of EVM_DEV_FUNDS) log(("Dev Fund " + x.env).padEnd(38) + x.devFund + "  [written to Verifier for " + x.env + "]");
  for (const x of NON_EVM_DEV_FUNDS) log(("Dev Fund " + x.env).padEnd(38) + x.devFund + "  [" + x.env + "; printed only]");
  log("Price fetcher (scheduledPricePoster)".padEnd(38) + (fetcher || "not set"));
  if (d && d.signer) log("Deployer".padEnd(38) + d.signer);
}

function readFetcher(from, d) {
  const raw = document.getElementById("fetcher").value.trim();
  if (!raw) throw new Error("Enter the existing price fetcher address. Nothing was sent.");
  if (!ethers.isAddress(raw)) throw new Error("Price fetcher " + raw + " is not an address. Nothing was sent.");
  const fetcher = ethers.getAddress(raw);
  if (fetcher === ethers.ZeroAddress) throw new Error("Price fetcher is the zero address. Nothing was sent.");
  if (fetcher === from) throw new Error("Price fetcher equals the connected wallet. The write permission goes to the price fetcher, not this wallet. Nothing was sent.");
  if (fetcher === ethers.getAddress(DEV_FUND)) throw new Error("Price fetcher equals the Dev Fund. Nothing was sent.");
  refuseOld("Price fetcher", fetcher);
  if (d) for (const k of ["VCLM", "CHONX", "Lock", "Verifier", "Forge", "Stake"]) {
    if (d[k] && ethers.getAddress(d[k]) === fetcher) throw new Error("Price fetcher equals the new " + k + " contract. Nothing was sent.");
  }
  return fetcher;
}

async function checkSaved(eth, from, d) {
  for (const k of ["VCLM", "CHONX", "Lock", "Verifier", "Forge", "Stake"]) {
    if (!d[k]) continue;
    refuseOld("Saved " + k, d[k]);
    if (!(await hasCode(eth, d[k]))) throw new Error("Saved " + k + " " + d[k] + " has no code on " + CHAIN.name + ". Use \\"Forget saved addresses\\" and start again. Nothing was sent.");
  }
  if (d.signer && ethers.getAddress(d.signer) !== from) throw new Error("Saved deployment belongs to " + d.signer + ", not " + from + ". Nothing was sent.");
}

async function resumeFromVerifier(eth, from, addr) {
  if (!ethers.isAddress(addr)) throw new Error("Resume Verifier " + addr + " is not an address. Nothing was sent.");
  const v = ethers.getAddress(addr);
  refuseOld("Resume Verifier", v);
  if (!(await hasCode(eth, v))) throw new Error("No contract at " + v + " on " + CHAIN.name + ". Nothing was sent.");
  const [vclm] = await read(eth, VERIFIER, v, "vclmToken");
  const [chonx] = await read(eth, VERIFIER, v, "chonxToken");
  log("Resume: Verifier " + v + " reports VCLM " + vclm + ", CHONX " + chonx + ". Lock, Forge and Stake are taken from saved state only.");
  const saved = loadSaved() || {};
  if (saved.Verifier && ethers.getAddress(saved.Verifier) !== v) throw new Error("Saved Verifier " + saved.Verifier + " differs from " + v + ". Forget saved addresses first. Nothing was sent.");
  return { ...saved, Verifier: v, VCLM: ethers.getAddress(vclm), CHONX: ethers.getAddress(chonx), signer: from };
}

async function deployMissing(eth, from, d) {
  if (!d.VCLM) {
    const r = await deploy(eth, from, "VCLM", ARTS.token.abi, ARTS.token.bytecode, ["Vinculum", "VCLM", VCLM_HARD_CAP]);
    const block = await eth.request({ method: "eth_getBlockByNumber", params: [r.receipt.blockNumber, false] });
    d.VCLM = r.address;
    d.launchTimestamp = BigInt(block.timestamp).toString();
    save(d);
    log("launchTimestamp " + d.launchTimestamp + " (VCLM block)");
  }
  if (!d.launchTimestamp) throw new Error("launchTimestamp is not saved for VCLM " + d.VCLM + ". Stake cannot be deployed without it. Stopping.");
  if (!d.CHONX) { d.CHONX = (await deploy(eth, from, "CHONX", ARTS.token.abi, ARTS.token.bytecode, ["Chonx", "CHONX", CHONX_HARD_CAP])).address; save(d); }
  if (!d.Lock) { d.Lock = (await deploy(eth, from, "CommitmentVaultLock (Base)", ARTS.lock.abi, ARTS.lock.bytecode, [BASE_LOCK.environmentId, DEV_FUND])).address; save(d); }
  if (!d.Verifier) { d.Verifier = (await deploy(eth, from, "VinculumFinalisVerifier", ARTS.verifier.abi, ARTS.verifier.bytecode, [d.VCLM, d.CHONX])).address; save(d); }
  if (!d.Forge) { d.Forge = (await deploy(eth, from, "VinculumFinalisSynth (forge)", ARTS.synth.abi, ARTS.synth.bytecode, [d.Verifier, d.VCLM, d.CHONX])).address; save(d); }
  if (!d.Stake) { d.Stake = (await deploy(eth, from, "VinculumFinalisStake", ARTS.stake.abi, ARTS.stake.bytecode, [d.VCLM, d.CHONX, d.Forge, d.Verifier, BigInt(d.launchTimestamp)])).address; save(d); }
}

async function configure(eth, from, d, fetcher) {
  const [finalized] = await read(eth, VERIFIER, d.Verifier, "configurationFinalized");
  const [deployer] = await read(eth, VERIFIER, d.Verifier, "deployer");
  if (finalized) throw new Error("Verifier " + d.Verifier + " is already finalized. Nothing was sent.");
  if (ethers.getAddress(deployer) !== from) throw new Error("Connected wallet is not the Verifier deployer " + deployer + ". Nothing was sent.");
  const [vclm] = await read(eth, VERIFIER, d.Verifier, "vclmToken");
  const [chonx] = await read(eth, VERIFIER, d.Verifier, "chonxToken");
  if (ethers.getAddress(vclm) !== ethers.getAddress(d.VCLM) || ethers.getAddress(chonx) !== ethers.getAddress(d.CHONX)) {
    throw new Error("Verifier tokens " + vclm + " / " + chonx + " do not match VCLM " + d.VCLM + " / CHONX " + d.CHONX + ". Nothing was sent.");
  }

  log("");
  log("Price write permission -> price fetcher " + fetcher);
  const [poster] = await read(eth, VERIFIER, d.Verifier, "scheduledPricePoster");
  if (ethers.getAddress(poster) === fetcher) log("scheduledPricePoster is already " + fetcher + ". Skipped.");
  else await send(eth, from, d.Verifier, VERIFIER, "setScheduledPricePoster " + fetcher, "setScheduledPricePoster", [fetcher]);

  log("");
  log("Dev Fund for the seven EVM environments");
  for (const x of EVM_DEV_FUNDS) {
    const [cur] = await read(eth, VERIFIER, d.Verifier, "devFundDestinations", [x.env]);
    if (ethers.getAddress(cur) === ethers.getAddress(x.devFund)) { log(x.env + " Dev Fund already " + x.devFund + ". Skipped."); continue; }
    await send(eth, from, d.Verifier, VERIFIER, "configureDevFund " + x.env + " " + x.devFund, "configureDevFund", [x.env, x.devFund]);
  }

  log("");
  log("Approved Asset Registry: " + REGISTRY.length + " entries to write (" + REGISTRY_NOT_WRITTEN.length + " rows cannot be written; listed on this page)");
  let written = 0, skipped = 0;
  for (const [row, env, assetId, canonicalAssetId, symbol, decimals, custodyClass, custodyPath] of REGISTRY) {
    if (halted) throw new Error("Stopped: chain changed.");
    const key = ethers.solidityPackedKeccak256(["string", "bytes32"], [env, canonicalAssetId]);
    const e = await read(eth, VERIFIER, d.Verifier, "assetPrecisionTable", [key]);
    if (e.canonicalAssetId === canonicalAssetId && e.symbol === symbol && Number(e.decimals) === decimals &&
        Number(e.custodyClass) === custodyClass && Number(e.custodyPath) === custodyPath) {
      skipped++;
      continue;
    }
    await send(eth, from, d.Verifier, VERIFIER,
      "registerAssetPrecision row " + row + " " + env + " " + assetId + " (" + (written + skipped + 1) + "/" + REGISTRY.length + ")",
      "registerAssetPrecision", [env, canonicalAssetId, symbol, decimals, custodyClass, custodyPath]);
    written++;
  }
  log("Registry: " + written + " written now, " + skipped + " already present, " + REGISTRY.length + " total.");
}

function printStop(d) {
  log("");
  log("Stopped before finalize. Not sent:");
  log("  Verifier(" + d.Verifier + ").finalize()");
  log("  VCLM(" + d.VCLM + ").initialize(" + d.Verifier + ", " + d.Stake + ")");
  log("  CHONX(" + d.CHONX + ").initialize(" + d.Verifier + ", 0x0000000000000000000000000000000000000000)");
  log("No price was written. The price fetcher writes scheduled runs (applyScheduledPriceRun) after finalize.");
}

document.getElementById("show").onclick = () => {
  printAddresses(loadSaved(), document.getElementById("fetcher").value.trim());
};
document.getElementById("clear").onclick = () => {
  localStorage.removeItem(STORE_KEY);
  log("Saved addresses forgotten in this browser. Nothing on-chain changed.");
};

const goBtn = document.getElementById("go");
goBtn.onclick = async () => {
  goBtn.disabled = true;
  try {
    const { eth, from } = await requireChain();
    log("signer " + from + " on " + CHAIN.name + " (chain id " + CHAIN.id + ")");
    let d = loadSaved() || { signer: from };
    const resume = document.getElementById("resumeVerifier").value.trim();
    if (resume) d = await resumeFromVerifier(eth, from, resume);
    await checkSaved(eth, from, d);
    const fetcher = readFetcher(from, d);
    d.signer = from;
    save(d);
    await deployMissing(eth, from, d);
    printAddresses(d, fetcher);
    await configure(eth, from, d, fetcher);
    printAddresses(d, fetcher);
    printStop(d);
  } catch (err) {
    log(err.message || String(err));
  } finally {
    goBtn.disabled = false;
  }
};
printAddresses(loadSaved(), "");
</script>
</body>
</html>
`;
}

// ---------------------------------------------------------------- EVM lock pages
function evmLockPage(env) {
  const net = EVM_NETWORKS[env];
  const row = rowFor(env);
  if (row.lock !== "CommitmentVaultLock") throw new Error(env + " lock is " + row.lock);
  return header("Vinculum Protocol - " + env + " lock deploy", net.name + " (chain id " + net.id + ")", env) + `
<p>Connects MetaMask to ${esc(net.name)} (chain id ${net.id}) and refuses any other chain. Deploys the lock ${esc(env)} uses, CommitmentVaultLock (contracts/CommitmentVaultLock.sol, deployment/representativeBase.cjs), with environment id "${esc(env)}" and the ${esc(env)} Dev Fund. One MetaMask popup. Nothing is sent before you sign.</p>
<p>CommitmentVaultLock has no finalize step. The page prints the address and stops. Base contracts are not deployed here.</p>
<ul>
<li>Lock: CommitmentVaultLock("${esc(env)}", ${esc(row.devFund)})</li>
<li>Dev Fund (${esc(env)}): <code>${esc(row.devFund)}</code></li>
<li>Handshake allowance: ${row.handshakeAllowance} (${esc(row.reason)})</li>
</ul>
<button id="go" type="button">Connect and deploy on ${esc(net.name)}</button>
<button id="clear" type="button">Forget saved address</button>
<pre id="log"></pre>
<h2>Approved Asset Registry rows for ${esc(env)}</h2>
<p>These are written to the Base Verifier by base.html, not on this network.</p>
${registryTable(env)}
${CDN}
<script>
const CHAIN = { id: ${net.id}, hex: "0x${net.id.toString(16)}", name: ${J(net.name)} };
const ENV = ${J(env)};
const DEV_FUND = ${J(row.devFund)};
const STORE_KEY = "vinculum-deploy-lock-" + ENV + "-" + ${J(SOURCE_COMMIT)};
const ARTS = ${J({ lock: ARTS.lock })};
${EVM_COMMON_JS}
function printAddresses(d) {
  log("");
  log("Network: " + CHAIN.name + ", chain id " + CHAIN.id);
  log("CommitmentVaultLock (" + ENV + ")  " + (d && d.Lock ? d.Lock : "not deployed") + "  [" + CHAIN.name + "]");
  log("Dev Fund (" + ENV + ")             " + DEV_FUND + "  [" + CHAIN.name + "]");
  if (d && d.signer) log("Deployer                     " + d.signer);
}

document.getElementById("clear").onclick = () => {
  localStorage.removeItem(STORE_KEY);
  log("Saved address forgotten in this browser. Nothing on-chain changed.");
};

const goBtn = document.getElementById("go");
goBtn.onclick = async () => {
  goBtn.disabled = true;
  try {
    const { eth, from } = await requireChain();
    log("signer " + from + " on " + CHAIN.name + " (chain id " + CHAIN.id + ")");
    const saved = loadSaved();
    if (saved && saved.Lock) {
      if (await hasCode(eth, saved.Lock)) {
        log("A lock from this page is already deployed in this browser's record. Not deploying a second one.");
        printAddresses(saved);
        log("");
        log("Stopped. CommitmentVaultLock has no finalize; nothing else is sent.");
        return;
      }
      throw new Error("Saved lock " + saved.Lock + " has no code on " + CHAIN.name + ". Use \\"Forget saved address\\" first. Nothing was sent.");
    }
    const r = await deploy(eth, from, "CommitmentVaultLock (" + ENV + ")", ARTS.lock.abi, ARTS.lock.bytecode, [ENV, DEV_FUND]);
    const d = { Lock: r.address, signer: from };
    save(d);
    printAddresses(d);
    log("");
    log("Stopped. CommitmentVaultLock has no finalize; nothing else is sent.");
  } catch (err) {
    log(err.message || String(err));
  } finally {
    goBtn.disabled = false;
  }
};
printAddresses(loadSaved());
</script>
</body>
</html>
`;
}

// ---------------------------------------------------------------- UTXO pages
function utxoPage(env) {
  const net = UTXO_NETWORKS[env];
  const row = rowFor(env);
  const k = net.key;
  const conf = utxo.conf[k], dust = utxo.dust[k];
  const binding = utxo.raw.includes(k) ? "raw 117-byte payload in OP_RETURN" : utxo.fp.includes(k) ? "SHA-256 of the 117-byte payload (32 bytes) in OP_RETURN" : null;
  if (conf == null || dust == null || !binding) throw new Error("utxo-locks has no rule for " + k);
  const lines = [
    "Network: " + net.name,
    "Environment id: " + env,
    "Lock: " + row.lock + " (utxo-locks/lock.py, utxo-locks/script.py)",
    "Dev Fund (" + env + "): " + row.devFund,
    "Handshake allowance: " + row.handshakeAllowance + " (" + row.reason + ")",
    "Confirmations required: " + conf + " (utxo-locks/finality.py)",
    "Fee: " + utxo.fee + " bps of gross to the Dev Fund; P2PKH dust minimum " + dust + " smallest units (utxo-locks/lock.py)",
    "Binding: " + binding,
    "Principal: P2SH(OP_CHECKLOCKTIMEVERIFY OP_DROP <release pubkey> OP_CHECKSIG)",
    "",
    "Deployment: nothing to deploy on " + net.name + ". There is no contract and no deploy transaction.",
    "Each lock is one transaction a user builds at lock time from their own coin, release key and maturity.",
    "No transaction is printed here because none exists until a user locks.",
    "",
    "Stopped before finalize.",
  ];
  return header("Vinculum Protocol - " + env + " deploy plan", net.name, env) + `
<p>${esc(env)} is not EVM. There is no wallet step on this page and no chain-id check to make. It prints the lock this environment uses, its destinations, and stops.</p>
<pre id="log">${esc(lines.join("\n"))}</pre>
<h2>Approved Asset Registry rows for ${esc(env)}</h2>
<p>Written to the Base Verifier by base.html, not on ${esc(net.name)}.</p>
${registryTable(env)}
</body>
</html>
`;
}

// ---------------------------------------------------------------- Solana
function solanaPage() {
  const env = "Solana";
  const net = OTHER_NETWORKS[env];
  const row = rowFor(env);
  const lines = [
    "Network: " + net.name + " (genesis hash " + SOLANA_MAINNET_GENESIS + ")",
    "Environment id: " + env,
    "Lock: " + row.lock + " (src/solana-vault/programs/vf-solana-vault)",
    "Program id (declare_id! in lib.rs): " + SOLANA_PROGRAM_ID,
    "Config PDA (seed \"" + SEED_CONFIG + "\"): " + SOLANA_CONFIG_PDA.address + " (bump " + SOLANA_CONFIG_PDA.bump + ")",
    "Dev Fund (" + env + "): " + row.devFund,
    "Handshake allowance: " + row.handshakeAllowance + " (" + row.reason + ")",
    "",
    "Plan:",
    "  1. anchor build in src/solana-vault (program vf_solana_vault).",
    "  2. Deploy the program to " + SOLANA_PROGRAM_ID + " on mainnet-beta. This needs the program keypair for that id; the page does not hold it and does not ask for it.",
    "  3. initialize(dev_fund_destination = " + row.devFund + ") creates the config PDA " + SOLANA_CONFIG_PDA.address + ".",
    "  4. Stop. The program upgrade authority is not burned here (that is the finalize step for this program).",
    "",
    "No transaction is printed: program deployment is a CLI upload with the program keypair, not a wallet popup.",
    "",
    "Stopped before finalize.",
  ];
  return header("Vinculum Protocol - Solana deploy plan", net.name, env) + `
<p>Solana is not EVM. This page prints the program, its addresses and destinations, and stops. The button only reads mainnet (no signature, no transaction) and refuses a cluster whose genesis hash is not mainnet-beta.</p>
<pre id="log">${esc(lines.join("\n"))}</pre>
<button id="check" type="button">Read program status on mainnet-beta (read-only)</button>
<h2>Approved Asset Registry rows for Solana</h2>
<p>Written to the Base Verifier by base.html, not on Solana.</p>
${registryTable(env)}
<script>
const RPC = "https://api.mainnet-beta.solana.com";
const GENESIS = ${J(SOLANA_MAINNET_GENESIS)};
const PROGRAM_ID = ${J(SOLANA_PROGRAM_ID)};
const CONFIG_PDA = ${J(SOLANA_CONFIG_PDA.address)};
const logEl = document.getElementById("log");
function log(line) { logEl.textContent += "\\n" + line; }
async function call(method, params) {
  const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = await res.json();
  if (j.error) throw new Error(method + ": " + j.error.message);
  return j.result;
}
document.getElementById("check").onclick = async () => {
  try {
    const g = await call("getGenesisHash", []);
    if (g !== GENESIS) { log("RPC genesis " + g + " is not mainnet-beta " + GENESIS + ". Refused."); return; }
    const p = await call("getAccountInfo", [PROGRAM_ID, { encoding: "base64" }]);
    const c = await call("getAccountInfo", [CONFIG_PDA, { encoding: "base64" }]);
    log("mainnet-beta slot " + p.context.slot + ": program " + PROGRAM_ID + (p.value ? " exists (executable " + p.value.executable + ")" : " not deployed") + "; config PDA " + CONFIG_PDA + (c.value ? " exists" : " absent"));
    log("Read only. Nothing was sent.");
  } catch (err) {
    log(err.message || String(err));
  }
};
</script>
</body>
</html>
`;
}

// ---------------------------------------------------------------- Stellar / XRPL
function stellarPage() {
  const env = "Stellar";
  const net = OTHER_NETWORKS[env];
  const row = rowFor(env);
  const lines = [
    "Network: " + net.name + " (passphrase \"Public Global Stellar Network ; September 2015\")",
    "Environment id: " + env,
    "Lock: " + row.lock + " (non-evm-locks/stellar/lock_and_test.mjs)",
    "Dev Fund (" + env + "): " + row.devFund,
    "Handshake allowance: " + row.handshakeAllowance + " (" + row.reason + ")",
    "",
    "Per lock, one transaction:",
    "  Payment of 5% of gross to the Dev Fund " + row.devFund,
    "  CreateClaimableBalance of the principal; sole claimant = the bound release destination;",
    "  predicate: not before absolute maturity; memo = SHA-256 of the 117-byte binding payload.",
    "",
    "Deployment: nothing to deploy on Stellar. There is no contract and no deploy transaction.",
    "No transaction is printed here because none exists until a user locks.",
    "",
    "Stopped before finalize.",
  ];
  return header("Vinculum Protocol - Stellar deploy plan", net.name, env) + `
<p>Stellar is not EVM. No wallet step. The page prints the lock, its destinations, and stops.</p>
<pre id="log">${esc(lines.join("\n"))}</pre>
<h2>Approved Asset Registry rows for Stellar</h2>
<p>Written to the Base Verifier by base.html, not on Stellar.</p>
${registryTable(env)}
</body>
</html>
`;
}

function xrplPage() {
  const env = "XRP Ledger";
  const net = OTHER_NETWORKS[env];
  const row = rowFor(env);
  const lines = [
    "Network: " + net.name,
    "Environment id: " + env,
    "Lock: " + row.lock + " (non-evm-locks/xrpl/lock_and_test.mjs)",
    "Dev Fund (" + env + "): " + row.devFund,
    "Handshake allowance: " + row.handshakeAllowance + " (" + row.reason + ")",
    "",
    "Per lock, two objects bound by SHA-256 of the 117-byte payload:",
    "  Payment of floor(gross * 500 / 10000) drops to the Dev Fund " + row.devFund,
    "  EscrowCreate of the principal to the release account; FinishAfter set; CancelAfter omitted.",
    "  The release account has Deposit Authorization so a non-destination EscrowFinish is rejected.",
    "",
    "Deployment: nothing to deploy on the XRP Ledger. There is no contract and no deploy transaction.",
    "No transaction is printed here because none exists until a user locks.",
    "",
    "Stopped before finalize.",
  ];
  return header("Vinculum Protocol - XRP Ledger deploy plan", net.name, env) + `
<p>The XRP Ledger is not EVM. No wallet step. The page prints the lock, its destinations, and stops.</p>
<pre id="log">${esc(lines.join("\n"))}</pre>
<h2>Approved Asset Registry rows for XRP Ledger</h2>
<p>Written to the Base Verifier by base.html, not on the XRP Ledger.</p>
${registryTable(env)}
</body>
</html>
`;
}

// ---------------------------------------------------------------- write
const pages = [];
pages.push(["Base", EVM_NETWORKS.Base.file, basePage()]);
for (const env of ["Ethereum", "Polygon", "Optimism", "Arbitrum", "BNB Smart Chain", "Avalanche"]) pages.push([env, EVM_NETWORKS[env].file, evmLockPage(env)]);
for (const env of Object.keys(UTXO_NETWORKS)) pages.push([env, UTXO_NETWORKS[env].file, utxoPage(env)]);
pages.push(["Solana", OTHER_NETWORKS.Solana.file, solanaPage()]);
pages.push(["Stellar", OTHER_NETWORKS.Stellar.file, stellarPage()]);
pages.push(["XRP Ledger", OTHER_NETWORKS["XRP Ledger"].file, xrplPage()]);

const order = rows.map((r) => r.environment);
pages.sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
if (pages.length !== 16 || new Set(pages.map((p) => p[0])).size !== 16) throw new Error("expected sixteen distinct pages");
for (const [env, file, html] of pages) {
  fs.writeFileSync(path.join(OUT_DIR, file), html);
  console.log(env.padEnd(16) + " scripts/deploy-pages/" + file + " (" + html.length + " bytes)");
}
