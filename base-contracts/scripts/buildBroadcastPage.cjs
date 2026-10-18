// Rebuilds the embedded contracts (const ARTS = {...}) in scripts/broadcast.html
// from the current compiled artifacts, so the page deploys exactly current main
// (incl. the corrected four-duration TRS stake table, 120 days = 2.10x).
// Writes the file only; sends nothing. Run after `npx hardhat compile`.
const fs = require("fs");
const path = require("path");
const ART = path.join(__dirname, "..", "artifacts", "contracts");
const PAGE = path.join(__dirname, "broadcast.html");
const pick = (rel) => { const j = require(path.join(ART, rel)); return { abi: j.abi, bytecode: j.bytecode }; };
const ARTS = {
  token: pick("VinculumFinalisToken.sol/VinculumFinalisToken.json"),
  lock: pick("CommitmentVaultLock.sol/CommitmentVaultLock.json"),
  verifier: pick("VinculumFinalisVerifier.sol/VinculumFinalisVerifier.json"),
  synth: pick("VinculumFinalisSynth.sol/VinculumFinalisSynth.json"),
  stake: pick("VinculumFinalisStake.sol/VinculumFinalisStake.json"),
};
const html = fs.readFileSync(PAGE, "utf8");
const re = /^const ARTS = \{.*\};$/m;
if (!re.test(html)) throw new Error("ARTS line not found in broadcast.html");
fs.writeFileSync(PAGE, html.replace(re, () => "const ARTS = " + JSON.stringify(ARTS) + ";"));
console.log("broadcast.html rebuilt from current artifacts");
