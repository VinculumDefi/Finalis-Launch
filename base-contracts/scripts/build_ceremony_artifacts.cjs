const fs = require("fs");
const path = require("path");
const https = require("https");
const root = path.join(__dirname, "..");
const art = path.join(root, "artifacts", "contracts");
const targets = {
  VinculumFinalisVerifier: "VinculumFinalisVerifier.sol/VinculumFinalisVerifier.json",
  TokenVCLM: "VinculumFinalisToken.sol/VinculumFinalisToken.json",
  TokenCHONX: "VinculumFinalisToken.sol/VinculumFinalisToken.json",
  BaseLockRecordVerifier: "chain-verifiers/BaseLockRecordVerifier.sol/BaseLockRecordVerifier.json"
};
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
const registry = JSON.parse(fs.readFileSync(path.join(root, "deployment", "assetRegistry.resolved.json"), "utf8"));
const entries = registry.entries.filter((e) => !e.unresolvedReason && e.sameKeyAsRow == null);
const row2 = registry.entries.find((e) => e.row === 2);
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
    existingLock: "0x968BFD5b580144b4398C10BB1E61bD8A6B1aC946",
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
