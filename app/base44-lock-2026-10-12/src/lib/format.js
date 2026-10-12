import { ethers } from "ethers";

export function shortAddress(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function formatEth(wei, maxFrac = 6) {
  if (wei == null) return "0";
  const s = ethers.formatEther(wei);
  return trimNumber(s, maxFrac);
}

export function formatUnits(wei, decimals = 18, maxFrac = 4) {
  if (wei == null) return "0";
  const s = ethers.formatUnits(wei, decimals);
  return trimNumber(s, maxFrac);
}

export function trimNumber(s, maxFrac) {
  if (!s.includes(".")) return s;
  const [i, f] = s.split(".");
  const frac = f.slice(0, maxFrac).replace(/0+$/, "");
  return frac ? `${i}.${frac}` : i;
}

export function formatUsd(value, maxFrac = 2) {
  if (value == null || Number.isNaN(value)) return "$0.00";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: maxFrac,
  });
}

export function formatNumber(value, maxFrac = 4) {
  if (value == null) return "0";
  return Number(value).toLocaleString("en-US", {
    maximumFractionDigits: maxFrac,
  });
}

export function formatTimestamp(sec) {
  if (sec == null || Number.isNaN(sec)) return "—";
  return new Date(sec * 1000).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function timeUntil(sec, nowSec) {
  if (sec == null) return "—";
  const diff = sec - nowSec;
  if (diff <= 0) return "Mature";
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}