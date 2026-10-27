// TEST-CHAIN ONLY ceremony for the new main verifier. Runs on the in-process
// Hardhat network (chain id 31337) and refuses any other chain. It holds no
// key, reads no key file and sends nothing to a live network.
//
// Steps (stops before finalize; the test checks the gates with a static call):
//   1. VCLM, CHONX (VinculumFinalisToken), VinculumFinalisVerifier(VCLM, CHONX),
//      VinculumFinalisSynth (Forge), VinculumFinalisStake (on from the start:
//      it is the VCLM stake minter at initialization).
//   2. Test locks (local stand-ins for the new 5% locks): CommitmentVaultLock
//      for Base and the six EVM environments.
//   3. The 13 ready readers: BaseLockRecordVerifier, SimpleEthereumLockReader,
//      ArbitrumLockReader, OptimismLockReader, PolygonLockReader,
//      BnbSmartChainLockReader, AvalancheLockReader, and the six UTXO readers
//      (Dev Fund scriptPubKey decoded from deployment/representativeBase.cjs).
//      Stellar (StellarLockReader) and XRP Ledger (XrplLockReader) are also
//      registered, wired to the recorded Stellar and XRP Ledger Dev Funds
//      (decoded and checksum-checked here). That makes 15 readers.
//      Solana is NOT registered (blocked reader).
//   4. Price poster = a freshly generated wallet (test only); Dev Fund for the
//      seven EVM environments.
//   5. Registry: exactly the Revision B rows (deployment/assetRegistry.revB.json,
//      scripts/registryFile.cjs): 486 rows under their own environment plus the
//      Base native-ETH row ("Base", row 2 canonical id) = 487. Batches of at
//      most 50. The prior revision (assetRegistry.resolved.json) is not read.
//   6. The poster posts a TEST Base ETH price (run 1). Test value only.
const path = require("path");
const fs = require("fs");
const bs58mod = require("bs58");
const bs58 = bs58mod.default || bs58mod;
const { loadRegistry } = require("./registryFile.cjs");

const READY_EVM = [
  ["Ethereum", "SimpleEthereumLockReader"],
  ["Arbitrum", "ArbitrumLockReader"],
  ["Optimism", "OptimismLockReader"],
  ["Polygon", "PolygonLockReader"],
  ["BNB Smart Chain", "BnbSmartChainLockReader"],
  ["Avalanche", "AvalancheLockReader"],
];
const READY_UTXO = [
  ["Bitcoin", "BitcoinLockReader"],
  ["Bitcoin Cash", "BitcoinCashLockReader"],
  ["Litecoin", "LitecoinLockReader"],
  ["Dogecoin", "DogecoinLockReader"],
  ["DigiByte", "DigiByteLockReader"],
  ["Zcash", "ZcashLockReader"],
];
const READY_LEDGER = ["Stellar", "XRP Ledger"];
const BLOCKED = ["Solana"];
const STELLAR_PUBLIC_NETWORK = "Public Global Stellar Network ; September 2015";
const TEST_ETH_PRICE_USD18 = 2500n * 10n ** 18n; // TEST VALUE, test chain only
const BATCH = 50;

// ---- address -> scriptPubKey (Dev Fund outputs on UTXO chains)
const B32 = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
function bech32Decode(addr) {
  const a = addr.toLowerCase();
  const sep = a.lastIndexOf("1");
  const hrp = a.slice(0, sep);
  const data = [...a.slice(sep + 1)].map((c) => {
    const v = B32.indexOf(c);
    if (v < 0) throw new Error("bech32 char");
    return v;
  });
  const G = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of [...[...hrp].map((c) => c.charCodeAt(0) >> 5), 0, ...[...hrp].map((c) => c.charCodeAt(0) & 31), ...data]) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((top >> i) & 1) chk ^= G[i];
  }
  if (chk !== 1) throw new Error("bech32 checksum (v0 only)");
  const words = data.slice(0, -6);
  const version = words[0];
  let acc = 0, bits = 0;
  const prog = [];
  for (const w of words.slice(1)) {
    acc = (acc << 5) | w;
    bits += 5;
    while (bits >= 8) { bits -= 8; prog.push((acc >> bits) & 0xff); }
  }
  if (version !== 0 || (prog.length !== 20 && prog.length !== 32)) throw new Error("only segwit v0");
  return Buffer.concat([Buffer.from([0x00, prog.length]), Buffer.from(prog)]);
}
function cashaddrDecode(addr) {
  const body = addr.includes(":") ? addr.split(":")[1] : addr;
  const data = [...body].map((c) => B32.indexOf(c));
  const words = data.slice(0, -8);
  let acc = 0, bits = 0;
  const out = [];
  for (const w of words) {
    acc = (acc << 5) | w;
    bits += 5;
    while (bits >= 8) { bits -= 8; out.push((acc >> bits) & 0xff); }
  }
  const ver = out[0];
  const hash = Buffer.from(out.slice(1, 21));
  if (ver !== 0x00) throw new Error("cashaddr: only P2PKH");
  return Buffer.concat([Buffer.from("76a914", "hex"), hash, Buffer.from("88ac", "hex")]);
}
function base58P2pkh(addr, prefixLen) {
  const raw = Buffer.from(bs58.decode(addr));
  return Buffer.concat([Buffer.from("76a914", "hex"), raw.slice(prefixLen, prefixLen + 20), Buffer.from("88ac", "hex")]);
}
function devFundScript(env, addr) {
  if (["Bitcoin", "Litecoin", "DigiByte"].includes(env)) return bech32Decode(addr);
  if (env === "Bitcoin Cash") return cashaddrDecode(addr);
  if (env === "Dogecoin") return base58P2pkh(addr, 1);
  if (env === "Zcash") return base58P2pkh(addr, 2);
  throw new Error("no script rule for " + env);
}

// Stellar account strkey (G...) -> 32-byte ed25519 key. base32, version byte
// 6<<3, CRC16-XModem checksum.
function stellarKey(addr) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, val = 0; const out = [];
  for (const ch of addr) { const i = A.indexOf(ch); if (i < 0) throw new Error("bad strkey"); val = (val << 5) | i; bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 0xff); bits -= 8; } }
  const b = Buffer.from(out);
  if (b.length !== 35 || b[0] !== 6 << 3) throw new Error("not a Stellar account strkey");
  let crc = 0;
  for (const x of b.slice(0, 33)) { crc ^= x << 8; for (let k = 0; k < 8; k++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff; }
  if (b.readUInt16LE(33) !== crc) throw new Error("Stellar strkey checksum");
  return "0x" + b.slice(1, 33).toString("hex");
}
// XRP Ledger classic address (r...) -> 20-byte AccountID. base58 (XRPL
// alphabet), type 0x00, double-SHA256 checksum.
function xrplAccount(addr) {
  const A = "rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz";
  let n = 0n; for (const ch of addr) { const i = A.indexOf(ch); if (i < 0) throw new Error("bad XRPL address"); n = n * 58n + BigInt(i); }
  let hex = n.toString(16); if (hex.length % 2) hex = "0" + hex;
  let b = Buffer.from(hex, "hex"); for (const ch of addr) { if (ch !== "r") break; b = Buffer.concat([Buffer.from([0]), b]); }
  if (b.length !== 25 || b[0] !== 0) throw new Error("not an XRPL account address");
  const sha = (x) => require("crypto").createHash("sha256").update(x).digest();
  if (!sha(sha(b.slice(0, 21))).slice(0, 4).equals(b.slice(21))) throw new Error("XRPL address checksum");
  return "0x" + b.slice(1, 21).toString("hex");
}

// Native coins whose reader reports a row of another environment (no rows added):
//  - Polygon native POL -> the existing POL row (environment Ethereum, symbol POL);
//  - Arbitrum and Optimism native ETH -> the existing ETH row (environment
//    Ethereum, registry row 2); their readers report that row's id and the
//    registry has no Arbitrum or Optimism ETH row.
const _k = (a, b) => require("ethers").solidityPackedKeccak256(["string", "string"], [a, b]);
const ASSET_ROW_ALIASES = [
  { environmentId: "Polygon", canonicalAssetId: _k("Ethereum", "POL"), rowEnvironmentId: "Ethereum" },
  { environmentId: "Arbitrum", canonicalAssetId: _k("Ethereum", "native-ETH"), rowEnvironmentId: "Ethereum" },
  { environmentId: "Optimism", canonicalAssetId: _k("Ethereum", "native-ETH"), rowEnvironmentId: "Ethereum" },
];

// Revision B (deployment/assetRegistry.revB.json, scripts/registryFile.cjs):
// written = the 486 entries under their own environment, baseEth = row 2 under
// Base, all = 487 registered lines. Rows are not changed or added.
function registryRows() {
  const { written, baseEth } = loadRegistry();
  const row2 = written.find((e) => e.row === 2 && e.environmentId === "Ethereum");
  if (!row2 || row2.symbol !== "ETH") throw new Error("row 2 is not native ETH");
  if (baseEth.canonicalAssetId !== row2.canonicalAssetId || baseEth.decimals !== 18) throw new Error("Base ETH is not row 2");
  if (written.some((e) => e.environmentId === "Base" && e.canonicalAssetId === row2.canonicalAssetId)) throw new Error("Base ETH already present");
  return { written, baseEth, all: [...written, baseEth] };
}

async function runCeremony(hre) {
  const { ethers } = hre;
  const net = await ethers.provider.getNetwork();
  if (net.chainId !== 31337n || hre.network.name !== "hardhat") throw new Error("REFUSED: test-chain ceremony runs only on the in-process Hardhat network");
  const [deployer] = await ethers.getSigners();
  const { EVM_DEV_FUND, rows: envRows } = require("../deployment/representativeBase.cjs");
  const devFundOf = Object.fromEntries(envRows.map((r) => [r.environment, r.devFund]));
  const F = (n) => ethers.getContractFactory(n);
  const at = async (c) => c.getAddress();

  const T = await F("VinculumFinalisToken");
  const vclm = await T.deploy("Vinculum", "VCLM", 10_000_000_000n * 10n ** 18n);
  const chonx = await T.deploy("Chonx", "CHONX", 100_000_000_000n * 10n ** 18n);
  const verifier = await (await F("VinculumFinalisVerifier")).deploy(await at(vclm), await at(chonx));
  const forge = await (await F("VinculumFinalisSynth")).deploy(await at(verifier), await at(vclm), await at(chonx));
  const stake = await (await F("VinculumFinalisStake")).deploy(await at(vclm), await at(chonx), await at(forge), await at(verifier));

  const CVL = await F("CommitmentVaultLock");
  const locks = {};
  // Base: BaseCommitmentVaultLock refuses VCLM, CHONX and SYNTH (VF-TOK-007).
  locks.Base = await (await F("BaseCommitmentVaultLock")).deploy("Base", EVM_DEV_FUND, await at(vclm), await at(chonx), await at(forge));
  for (const env of READY_EVM.map((x) => x[0])) locks[env] = await CVL.deploy(env, EVM_DEV_FUND);

  const readers = {};
  readers.Base = await (await F("BaseLockRecordVerifier")).deploy(await at(locks.Base));
  for (const [env, name] of READY_EVM) readers[env] = await (await F(name)).deploy(await at(locks[env]));
  const devFundScripts = {};
  for (const [env, name] of READY_UTXO) {
    devFundScripts[env] = "0x" + devFundScript(env, devFundOf[env]).toString("hex");
    readers[env] = await (await F(name)).deploy(devFundScripts[env]);
  }
  const ledgerDevFunds = { Stellar: stellarKey(devFundOf.Stellar), "XRP Ledger": xrplAccount(devFundOf["XRP Ledger"]) };
  readers.Stellar = await (await F("StellarLockReader")).deploy(
    ethers.sha256(ethers.toUtf8Bytes(STELLAR_PUBLIC_NETWORK)), ledgerDevFunds.Stellar);
  readers["XRP Ledger"] = await (await F("XrplLockReader")).deploy(ledgerDevFunds["XRP Ledger"]);
  for (const [env, r] of Object.entries(readers)) await (await verifier.registerChainVerifier(env, await at(r))).wait();

  const poster = ethers.Wallet.createRandom().connect(ethers.provider); // TEST ONLY, generated here, never saved
  await (await deployer.sendTransaction({ to: poster.address, value: ethers.parseEther("1") })).wait();
  await (await verifier.setScheduledPricePoster(poster.address)).wait();
  for (const r of envRows) if (/^0x[0-9a-fA-F]{40}$/.test(r.devFund)) await (await verifier.configureDevFund(r.environment, r.devFund)).wait();

  const { written, baseEth, all } = registryRows();
  let registryGas = 0n;
  for (let i = 0; i < all.length; i += BATCH) {
    const batch = all.slice(i, i + BATCH).map((e) => [e.environmentId, e.canonicalAssetId, e.symbol, e.decimals, e.custodyClass, e.custodyPath]);
    registryGas += (await (await verifier.registerAssetPrecisionBatch(batch)).wait()).gasUsed;
  }

  // Token address index (env + address -> row) and the Polygon native POL alias
  // to the existing POL row (environment Ethereum). No rows added.
  const { entries: tokenAddresses } = require("./buildTokenAddressIndex.cjs").buildTokenAddressIndex();
  for (let i = 0; i < tokenAddresses.length; i += BATCH) {
    await (await verifier.registerTokenAddressBatch(tokenAddresses.slice(i, i + BATCH)
      .map((t) => ({ environmentId: t.environmentId, token: t.token, canonicalAssetId: t.canonicalAssetId })))).wait();
  }
  for (const a of ASSET_ROW_ALIASES) await (await verifier.registerAssetRowAlias(a.environmentId, a.canonicalAssetId, a.rowEnvironmentId)).wait();

  await (await verifier.connect(poster).applyScheduledPriceRun(1n, [
    { environmentId: "Base", canonicalAssetId: baseEth.canonicalAssetId, priceUsd30: TEST_ETH_PRICE_USD18 * 10n ** 12n, success: true },
  ])).wait();

  return { deployer, poster, vclm, chonx, verifier, forge, stake, locks, readers, devFundScripts, ledgerDevFunds, tokenAddresses, written, baseEth, all, registryGas };
}

module.exports = { ASSET_ROW_ALIASES, runCeremony, registryRows, devFundScript, stellarKey, xrplAccount, READY_EVM, READY_UTXO, READY_LEDGER, BLOCKED, STELLAR_PUBLIC_NETWORK, TEST_ETH_PRICE_USD18 };

if (require.main === module) {
  const hre = require("hardhat");
  runCeremony(hre).then(async (c) => {
    await c.verifier.finalize.staticCall();
    console.log("test-chain ceremony done:", c.all.length, "registry rows,", Object.keys(c.readers).length, "readers; finalize() static call passes. Not finalized.");
  }).catch((e) => { console.error(e.message); process.exit(1); });
}
