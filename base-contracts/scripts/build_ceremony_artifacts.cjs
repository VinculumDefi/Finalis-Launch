const fs = require("fs");
const path = require("path");
const https = require("https");
const crypto = require("crypto");
const root = path.join(__dirname, "..");
const art = path.join(root, "artifacts", "contracts");
const pages = path.join(root, "scripts", "deploy-pages");

// Hardcoded digest of deployment/assetRegistry.revB.json (Revision B).
// Computed over the whole file bytes. Must match resolveCeremonyRegistry().
const EXPECTED_REGISTRY_SHA256 = "1bdcb8346ab95abe5225adcffb9c5c3c7bb40c6cd5f1a851d3ed05bb2d77e2a9";
const EXPECTED_REGISTRY_ROWS = 487;

const { resolveCeremonyRegistry } = require("./deploy-pages/resolveAssetRegistry.cjs");

/**
 * Hash a registry file and refuse unless it is the canonical Revision B
 * (EXPECTED_REGISTRY_SHA256, EXPECTED_REGISTRY_ROWS). Used by the build and
 * by the suite (historical 962-row file and one-byte-modified copies).
 * Writes nothing.
 */
function assertRegistryGuard(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      "REGISTRY GUARD REFUSAL: file missing. expectedSha=" + EXPECTED_REGISTRY_SHA256 +
      " expectedRows=" + EXPECTED_REGISTRY_ROWS + " source=" + path.basename(filePath) +
      " actualSha=(missing) rowCount=(missing)"
    );
  }
  const raw = fs.readFileSync(filePath);
  const actualSha = crypto.createHash("sha256").update(raw).digest("hex");
  let rowCount = null;
  try {
    const j = JSON.parse(raw.toString("utf8"));
    rowCount = Array.isArray(j.entries) ? j.entries.length : null;
  } catch (e) {
    rowCount = null;
  }
  const filename = path.basename(filePath);
  if (actualSha !== EXPECTED_REGISTRY_SHA256 || rowCount !== EXPECTED_REGISTRY_ROWS) {
    throw new Error(
      "REGISTRY GUARD REFUSAL: expectedSha=" + EXPECTED_REGISTRY_SHA256 +
      " expectedRows=" + EXPECTED_REGISTRY_ROWS +
      " actualSha=" + actualSha +
      " rowCount=" + (rowCount == null ? "(unreadable)" : rowCount) +
      " source=" + filename
    );
  }
  return { actualSha, rowCount, filename, path: filePath };
}

/**
 * Call the resolver (never a hardcoded path or folder glob), then hash the
 * resolved file and compare to the constants. Throws and writes nothing on
 * mismatch or wrong row count.
 */
function assertCanonicalRegistry() {
  const resolved = resolveCeremonyRegistry();
  if (resolved.sha256 !== EXPECTED_REGISTRY_SHA256 || resolved.rowCount !== EXPECTED_REGISTRY_ROWS) {
    throw new Error(
      "REGISTRY GUARD REFUSAL: expectedSha=" + EXPECTED_REGISTRY_SHA256 +
      " expectedRows=" + EXPECTED_REGISTRY_ROWS +
      " actualSha=" + resolved.sha256 +
      " rowCount=" + resolved.rowCount +
      " source=" + resolved.filename
    );
  }
  // Belt and suspenders: re-hash the bytes from the resolved path.
  assertRegistryGuard(resolved.path);
  return resolved;
}

function loadBytecodeTargets() {
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
  return { out, ASSET_ROW_ALIASES, READY_EVM, READY_UTXO, devFundScript, stellarKey, xrplAccount, STELLAR_PUBLIC_NETWORK };
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

function writeAtomic(dest, contents) {
  const tmp = dest + ".tmp." + process.pid;
  fs.writeFileSync(tmp, contents);
  fs.renameSync(tmp, dest);
}

async function buildCeremonyArtifacts() {
  // Verify first. Write nothing on failure (no ceremony-data.json, no pages).
  const resolved = assertCanonicalRegistry();
  const entries = resolved.entries; // 487: written + Base ETH
  const row2 = resolved.baseEth;
  if (!row2 || row2.symbol !== "ETH" || row2.assetId !== "native-ETH" || row2.environmentId !== "Base") {
    throw new Error("REGISTRY GUARD REFUSAL: row 2 is not Base native ETH; source=" + resolved.filename);
  }

  const { out, ASSET_ROW_ALIASES, READY_EVM, READY_UTXO, devFundScript, stellarKey, xrplAccount, STELLAR_PUBLIC_NETWORK } = loadBytecodeTargets();
  const rep = require(path.join(root, "deployment", "representativeBase.cjs"));
  const base = rep.rows.find((r) => r.environment === "Base");
  if (!base || !base.devFund) { console.error("Base Dev Fund missing"); process.exit(1); }

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
    scheduledPricePoster: require("../deployment/liveConfig.json").scheduledPricePoster,
    oldLocks: ["0x968BFD5b580144b4398C10BB1E61bD8A6B1aC946", "0x4eDE54E1cb6E337923F8D63Fa0799AE778263b1a"],
    readers: {
      evm: READY_EVM.map(([env, contract]) => ({ env, contract })),
      utxo: READY_UTXO.map(([env, contract]) => ({ env, contract, devFundScript: "0x" + devFundScript(env, rep.rows.find((r) => r.environment === env).devFund).toString("hex") })),
      stellar: { env: "Stellar", contract: "StellarLockReader", networkPassphrase: STELLAR_PUBLIC_NETWORK,
        networkId: "0x" + require("crypto").createHash("sha256").update(STELLAR_PUBLIC_NETWORK).digest("hex"),
        devFundKey: stellarKey(rep.rows.find((r) => r.environment === "Stellar").devFund) },
      xrpl: { env: "XRP Ledger", contract: "XrplLockReader", devFundAccount: xrplAccount(rep.rows.find((r) => r.environment === "XRP Ledger").devFund) },
    },
    tokenAddresses: require("./buildTokenAddressIndex.cjs").buildTokenAddressIndex().entries
      .map((t) => ({ environmentId: t.environmentId, token: t.token, canonicalAssetId: t.canonicalAssetId })),
    assetRowAliases: ASSET_ROW_ALIASES,
    evmDevFunds: Object.fromEntries(rep.rows.filter((r) => /^0x[0-9a-fA-F]{40}$/.test(r.devFund)).map((r) => [r.environment, r.devFund])),
    row2: { canonicalAssetId: row2.canonicalAssetId, symbol: row2.symbol, decimals: row2.decimals, custodyClass: row2.custodyClass, custodyPath: row2.custodyPath },
    entries: entries.map((e) => ({ environmentId: e.environmentId, canonicalAssetId: e.canonicalAssetId, symbol: e.symbol, decimals: e.decimals, custodyClass: e.custodyClass, custodyPath: e.custodyPath, row: e.row })),
    registrySource: resolved.filename,
    registryPath: resolved.name,
    registryRows: resolved.rowCount,
    registrySha256: resolved.sha256,
    priceUsd18,
    priceSource
  };

  if (data.registryRows !== EXPECTED_REGISTRY_ROWS || data.entries.length !== EXPECTED_REGISTRY_ROWS) {
    throw new Error(
      "REGISTRY GUARD REFUSAL: packed entry count is not " + EXPECTED_REGISTRY_ROWS +
      "; registryRows=" + data.registryRows + " entries=" + data.entries.length +
      " source=" + resolved.filename
    );
  }

  // Atomic writes only after every check passed.
  writeAtomic(path.join(pages, "ceremony.json"), JSON.stringify(out));
  writeAtomic(path.join(pages, "ceremony-data.json"), JSON.stringify(data));
  if (!priceUsd18) {
    console.error("REFUSAL: scheduled ETH price miss. ceremony-data.json written with no price. The page will not send.");
    process.exit(0);
  }
  console.log("wrote ceremony data", data.entries.length, "entries, price source", priceSource,
    "registry", resolved.filename, "sha256", resolved.sha256);
}

module.exports = {
  EXPECTED_REGISTRY_SHA256,
  EXPECTED_REGISTRY_ROWS,
  assertRegistryGuard,
  assertCanonicalRegistry,
  buildCeremonyArtifacts,
};

if (require.main === module) {
  buildCeremonyArtifacts().catch((err) => {
    console.error(err && err.message ? err.message : err);
    process.exit(1);
  });
}
