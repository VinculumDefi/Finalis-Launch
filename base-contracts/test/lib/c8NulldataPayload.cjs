// C.8 nulldata payload used by the Bitcoin lock tests.
// 117 bytes: lockId (32) | baseRecipient (20) | outputToken (1) | assetIdentity (32) | valuationReference (32)
// Bitcoin Script does not check these facts. Do not invent a second layout.

const { ethers } = require("ethers");

const PAYLOAD_LOCK_ID = ethers.id("vf-btc-lock-1");
const PAYLOAD_RECIPIENT = "0x1111111111111111111111111111111111111111";
const PAYLOAD_ASSET = ethers.id("bitcoin:BTC");
const PAYLOAD_VALUATION = ethers.id("valuation-ref-1");
const PAYLOAD_OUTPUT_TOKEN = 0;

function buildNulldataPayload({
  lockId = PAYLOAD_LOCK_ID,
  baseRecipient = PAYLOAD_RECIPIENT,
  outputToken = PAYLOAD_OUTPUT_TOKEN,
  assetIdentity = PAYLOAD_ASSET,
  valuationReference = PAYLOAD_VALUATION,
} = {}) {
  const recipient = ethers.getBytes(baseRecipient); // 20 bytes
  const token = Uint8Array.from([outputToken & 0xff]);
  return ethers.hexlify(ethers.concat([
    lockId, recipient, token, assetIdentity, valuationReference,
  ])).slice(2);
}

module.exports = {
  buildNulldataPayload,
  PAYLOAD_LOCK_ID,
  PAYLOAD_RECIPIENT,
  PAYLOAD_ASSET,
  PAYLOAD_VALUATION,
  PAYLOAD_OUTPUT_TOKEN,
};
