const fs = require("fs");
const path = require("path");
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
const dest = path.join(root, "scripts", "deploy-pages", "ceremony.json");
fs.writeFileSync(dest, JSON.stringify(out));
console.log("wrote", dest);
