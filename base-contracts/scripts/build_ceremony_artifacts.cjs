const fs = require("fs");
const path = require("path");
const https = require("https");
const root = path.join(__dirname, "..");
const art = path.join(root, "artifacts", "contracts");
const targets = {
  VinculumFinalisVerifier: "VinculumFinalisVerifier.sol/VinculumFinalisVerifier.json",
  TokenVCLM: "VinculumFinalisToken.sol/VinculumFinalisToken.json",
  TokenCHONX: "VinculumFinalisToken.sol/VinculumFinalisToken.json",
  CommitmentVaultLock: "CommitmentVaultLock.sol/CommitmentVaultLock.json",
  BaseCommitmentVaultLock: "BaseCommitmentVaultLock.sol/BaseCommitmentVaultLock.json",
  BaseLockRecordVerifier: "chain-verifiers/BaseLockRecordVerifier.sol/BaseLockRecordVerifier.json",
  VinculumFinalisSynth: "VinculumFinalisSynth.sol/VinculumFinalisSynth.json",
  VinculumFinalisStake: "VinculumFinalisStake.sol/VinculumFinalisStake.json",
};
// The 14 other readers, registered on the Base Verifier before finalize.
const { ASSET_ROW_ALIASES, READY_EVM, READY_UTXO, devFundScript, stellarKey, xrplAccount, STELLAR_PUBLIC_NETWORK } = require("./testChainCeremony.cjs");
for (const [, name] of [...READY_EVM, ...READY_UTXO]) targets[name] = "chain-verifiers/" + name + ".sol/" + name + ".json";
targets.StellarLockReader = "chain-verifiers/StellarLockReader.sol/StellarLockReader.json";
targets.XrplLockReader = "chain-verifiers/XrplLockReader.sol/XrplLockReader.json";
const out = {};
for (const [name, rel] of Object.entries(targets)) {
  const p = path.join(art, rel);
  if (!fs.existsSync(p)) { console.error("MISSING", p); process.exit(1); }
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  out[name] = { abi: j.abi, bytecode: j.bytecode };
}
const pages = path.join(root, "scripts", "deploy-pages");
fs.writeFileSync(path.join(pages, "ceremony.json"), JSON.stringify(out));
const rep = require(path.join(root, "deployment", "representativeBase.cjs"));
const base = rep.rows.find((r) => r.environment === "Base");
if (!base || !base.devFund) { console.error("Base Dev Fund missing"); process.exit(1); }
// Registry: Revision B (deployment/assetRegistry.revB.json, scripts/registryFile.cjs).
// entries = the 486 rows under their own environment; the page appends Base ETH
// (row2 under Base), so 487 lines are registered.
const { written: entries } = require("./registryFile.cjs").loadRegistry();
const row2 = entries.find((e) => e.row === 2 && e.environmentId === "Ethereum");
if (!row2 || row2.symbol !== "ETH" || row2.pricingIdentifier !== "ethereum") {
  console.error("row 2 is not native ETH"); process.exit(1);
}
function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "user-agent": "vinculum-price-fetcher", accept: "application/json" } }, (res) => {
      let body = "";
      res.on("data", (c) => body += c);
      res.on("end", () => resolve({ status: res.statusCode, body }));
    }).on("error", reject);
  });
}
(async () => {
  let priceUsd18 = null;
  let priceSource = null;
  try {
    const resp = await get("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
    if (resp.status === 200) {
      const usd = JSON.parse(resp.body).ethereum && JSON.parse(resp.body).ethereum.usd;
      if (typeof usd === "number" && usd >= 0.95) {
        priceUsd18 = BigInt(Math.round(usd * 1e8)) * 10n ** 10n + "";
        priceSource = "cascade-tier-1";
      }
    }
  } catch (e) {
    priceSource = "miss";
  }
  const data = {
    devFund: base.devFund,
    // Live price poster from deployment/liveConfig.json (address only).
    scheduledPricePoster: require("../deployment/liveConfig.json").scheduledPricePoster,
    // Old 2.5%-Handshake locks: the page REFUSES these as new lock addresses.
    oldLocks: ["0x968BFD5b580144b4398C10BB1E61bD8A6B1aC946", "0x4eDE54E1cb6E337923F8D63Fa0799AE778263b1a"],
    // Live reader wiring for the 14 non-Base readers. The new non-Base lock
    // addresses are typed into the page (they exist only after step 1).
    readers: {
      evm: READY_EVM.map(([env, contract]) => ({ env, contract })),
      utxo: READY_UTXO.map(([env, contract]) => ({ env, contract, devFundScript: "0x" + devFundScript(env, rep.rows.find((r) => r.environment === env).devFund).toString("hex") })),
      stellar: { env: "Stellar", contract: "StellarLockReader", networkPassphrase: STELLAR_PUBLIC_NETWORK,
        networkId: "0x" + require("crypto").createHash("sha256").update(STELLAR_PUBLIC_NETWORK).digest("hex"),
        devFundKey: stellarKey(rep.rows.find((r) => r.environment === "Stellar").devFund) },
      xrpl: { env: "XRP Ledger", contract: "XrplLockReader", devFundAccount: xrplAccount(rep.rows.find((r) => r.environment === "XRP Ledger").devFund) },
    },
    // (environment, token address) -> registry row, from the rows' own addresses.
    tokenAddresses: require("./buildTokenAddressIndex.cjs").buildTokenAddressIndex().entries
      .map((t) => ({ environmentId: t.environmentId, token: t.token, canonicalAssetId: t.canonicalAssetId })),
    assetRowAliases: ASSET_ROW_ALIASES,
    evmDevFunds: Object.fromEntries(rep.rows.filter((r) => /^0x[0-9a-fA-F]{40}$/.test(r.devFund)).map((r) => [r.environment, r.devFund])),
    row2: { canonicalAssetId: row2.canonicalAssetId, symbol: row2.symbol, decimals: row2.decimals, custodyClass: row2.custodyClass, custodyPath: row2.custodyPath },
    entries: entries.map((e) => ({ environmentId: e.environmentId, canonicalAssetId: e.canonicalAssetId, symbol: e.symbol, decimals: e.decimals, custodyClass: e.custodyClass, custodyPath: e.custodyPath })),
    priceUsd18,
    priceSource
  };
  fs.writeFileSync(path.join(pages, "ceremony-data.json"), JSON.stringify(data));
  if (!priceUsd18) {
    console.error("REFUSAL: scheduled ETH price miss. ceremony-data.json written with no price. The page will not send.");
    process.exit(0);
  }
  console.log("wrote ceremony data", data.entries.length, "entries, price source", priceSource);
})();
