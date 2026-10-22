/**
 * On-screen registry gate for ceremony / deploy pages.
 * Shows source filename, row count, and SHA-256. Disables Connect when rows != 487.
 */
const EXPECTED_REGISTRY_ROWS = 487;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function registryGateHtml({ filename, rowCount, sha256 }) {
  const n = Number(rowCount);
  const wrong = n !== EXPECTED_REGISTRY_ROWS;
  const warnDisplay = wrong ? "block" : "none";
  return `<div id="registry-gate">
<p>Registry source: <code id="registry-filename">${esc(filename)}</code>. Rows: <b id="registry-rows">${n}</b>. SHA-256: <code id="registry-sha256">${esc(sha256)}</code>.</p>
<p id="registry-wrong" style="color:red;display:${warnDisplay}">WRONG REGISTRY: expected ${EXPECTED_REGISTRY_ROWS} rows, found ${n}</p>
</div>
<script>
window.__REGISTRY_ROW_COUNT = ${n};
window.__REGISTRY_EXPECTED_ROWS = ${EXPECTED_REGISTRY_ROWS};
</script>`;
}

function connectGateInitScript(buttonId = "go") {
  return `
(function applyRegistryConnectGate() {
  var btn = document.getElementById(${JSON.stringify(buttonId)});
  var warn = document.getElementById("registry-wrong");
  if (!btn) return;
  if (window.__REGISTRY_ROW_COUNT !== window.__REGISTRY_EXPECTED_ROWS) {
    btn.disabled = true;
    if (warn) warn.style.display = "block";
    btn.onclick = function (e) { if (e && e.preventDefault) e.preventDefault(); return false; };
  }
})();
`;
}

function renderConnectGatePage({ filename, rowCount, sha256, buttonId = "go", buttonLabel = "Connect wallet" }) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>registry gate test</title></head>
<body>
${registryGateHtml({ filename, rowCount, sha256 })}
<button id="${esc(buttonId)}" type="button">${esc(buttonLabel)}</button>
<script>${connectGateInitScript(buttonId)}</script>
</body></html>`;
}

module.exports = {
  EXPECTED_REGISTRY_ROWS,
  esc,
  registryGateHtml,
  connectGateInitScript,
  renderConnectGatePage,
};
