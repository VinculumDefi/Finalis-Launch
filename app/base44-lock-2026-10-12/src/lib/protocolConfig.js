import { ethers } from "ethers";

// ---------------------------------------------------------------------------
// Base mainnet parameters
// ---------------------------------------------------------------------------
export const BASE_CHAIN = {
  chainId: "0x2105", // 8453
  chainIdDecimal: 8453,
  chainName: "Base",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: ["https://mainnet.base.org"],
  blockExplorerUrls: ["https://basescan.org"],
};

// ---------------------------------------------------------------------------
// Contract addresses — PLACEHOLDERS.
// Fill these in after deploy. No addresses are invented here.
// ---------------------------------------------------------------------------
export const CONTRACTS = {
  lock: "0x968BFD5b580144b4398C10BB1E61bD8A6B1aC946",      // CommitmentVaultLock (createNativeLock / release / getLock)
  vclm: "0x655273f8f5d74f7D5b5C4E1B947AE4ed763Df305",      // VCLM ERC-20
  chonx: "0x5C5587db545d7c2982e5001Df6e2b32c47dfea79",     // CHONX ERC-20
  synth: "0x7A2c77879F2D1f4526682Fa5109b99a75dA288f8",     // VinculumFinalisSynth ERC-20
  forge: "0x7A2c77879F2D1f4526682Fa5109b99a75dA288f8",     // Forge lives on the Synth contract (burns VCLM + CHONX, mints SYNTH)
  verifier: "0xb0670826b79e29cc6a1c216Eb396D383a54af47D", // VinculumFinalisVerifier
  baseReader: "0x1cBbb8C2B535dCe626f218aB06a3D181e82c679F", // BaseLockRecordVerifier
  stake: "0xfa16a1cdA94DD772498144814c9e4d0d7C81a6eF",    // VinculumFinalisStake
};

// Unix seconds of protocol launch. Set after deploy to drive emission decay.
export const LAUNCH_TIMESTAMP = null;

export function isAddressSet(addr) {
  return typeof addr === "string" && /^0x[a-fA-F0-9]{40}$/.test(addr);
}

export function contractsConfigured() {
  return Object.values(CONTRACTS).every(isAddressSet);
}

// ---------------------------------------------------------------------------
// Lockable assets
// ---------------------------------------------------------------------------
export const ASSETS = [
  {
    id: "eth",
    label: "Ethereum ETH",
    symbol: "ETH",
    kind: "native",
    decimals: 18,
    assetIdentity: "0xde7085290190e1f2f7f2f83d26fa72e411f9d765ddd608a77e8a7c388113943b",
    defaultAmount: "0.000388",
  },
  {
    id: "usdc",
    label: "Ethereum USDC",
    symbol: "USDC",
    kind: "erc20",
    address: "",
    decimals: 6,
    assetIdentity: "",
    defaultAmount: "1",
  },
  {
    id: "usdt",
    label: "Ethereum USDT",
    symbol: "USDT",
    kind: "erc20",
    address: "",
    decimals: 6,
    assetIdentity: "",
    defaultAmount: "1",
  },
];

export function isAssetConfigured(asset) {
  if (!asset) return false;
  if (!ethers.isHexString(asset.assetIdentity, 32)) return false;
  if (asset.kind === "erc20" && !isAddressSet(asset.address)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// ABIs (minimal, only what the UI uses)
// ---------------------------------------------------------------------------
export const LOCK_ABI = [
  "function createNativeLock(bytes32 lockId, address baseRecipient, uint8 outputToken, bytes32 assetIdentity, bytes32 valuationReference, address releaseDestination, uint256 duration, uint256 verifiedGrossUsd) external payable returns (uint256 fee, uint256 principal)",
  "function createErc20Lock(bytes32 lockId, address baseRecipient, uint8 outputToken, bytes32 assetIdentity, bytes32 valuationReference, address releaseDestination, uint256 duration, address token, uint256 amount, uint256 verifiedGrossUsd) external returns (uint256 fee, uint256 principal)",
  "function release(bytes32 lockId) external",
  "function getLock(bytes32 lockId) view returns (address owner, address releaseDestination, uint256 principal, uint256 fee, uint256 startTime, uint256 duration, bool released)",
  "function nextLockId() view returns (uint256)",
];

export const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

export const FORGE_ABI = [
  "function forge() returns (uint256 synthMinted)",
  "function synthCap() view returns (uint256)",
];

// ---------------------------------------------------------------------------
// Lock durations (sixteen)
// ---------------------------------------------------------------------------
export const DAY = 86400;
export const HOUR = 3600;

const standard = (label, seconds) => ({
  label,
  seconds,
  feeRate: 0.05,
  minUsd: 10,
  maxUsd: null,
  kind: "standard",
});

export const DURATIONS = [
  { label: "1 hour", seconds: HOUR, feeRate: 0.025, minUsd: 0.95, maxUsd: 1.05, kind: "handshake" },
  standard("7 days", 7 * DAY),
  standard("30 days", 30 * DAY),
  standard("60 days", 60 * DAY),
  standard("90 days", 90 * DAY),
  standard("180 days", 180 * DAY),
  standard("1 year", 365 * DAY),
  standard("2 years", 730 * DAY),
  standard("3 years", 1095 * DAY),
  standard("4 years", 1460 * DAY),
  standard("5 years", 1825 * DAY),
  standard("6 years", 2190 * DAY),
  standard("7 years", 2555 * DAY),
  standard("8 years", 2920 * DAY),
  standard("9 years", 3285 * DAY),
  standard("10 years", 3650 * DAY),
];

// ---------------------------------------------------------------------------
// Issuance / emission
// ---------------------------------------------------------------------------
export const EMISSION = {
  vclm: { name: "VCLM", start: 10, floor: 1 },
  chonx: { name: "CHONX", start: 100, floor: 10 },
  decay: 0.01667, // -1.667% every 30 days
  periodSeconds: 30 * DAY,
};

export function periodsElapsed(nowSec, launchSec) {
  if (!launchSec) return 0;
  return Math.max(0, Math.floor((nowSec - launchSec) / EMISSION.periodSeconds));
}

export function emissionRate(token, nowSec, launchSec = LAUNCH_TIMESTAMP) {
  const n = periodsElapsed(nowSec, launchSec);
  const raw = token.start * Math.pow(1 - EMISSION.decay, n);
  return Math.max(token.floor, raw);
}

export const ASSET_MULTIPLIERS = [
  { asset: "Ethereum USDC", multiplier: 1.5, venue: "Ethereum" },
  { asset: "Ethereum USDT", multiplier: 1.5, venue: "Ethereum" },
  { asset: "Native ETH", multiplier: 1.3, venue: "Base" },
  { asset: "Native BTC", multiplier: 1.3, venue: "Base" },
  { asset: "Ethereum AAVE", multiplier: 1.3, venue: "Ethereum" },
  { asset: "Ethereum LINK", multiplier: 1.3, venue: "Ethereum" },
  { asset: "Ethereum UNI", multiplier: 1.3, venue: "Ethereum" },
];

// ---------------------------------------------------------------------------
// Forge
// ---------------------------------------------------------------------------
export const FORGE = {
  vclmRequired: 1000,
  chonxRequired: 10000,
  synthPerForge: 1,
  synthCap: 10_000_000,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export async function getSignerContract(address, abi, provider) {
  const signer = await provider.getSigner();
  return new ethers.Contract(address, abi, signer);
}

export function getReadContract(address, abi, provider) {
  return new ethers.Contract(address, abi, provider);
}