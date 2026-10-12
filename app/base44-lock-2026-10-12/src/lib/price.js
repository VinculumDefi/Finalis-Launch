// Fetches the spot ETH/USD price from CoinGecko's public endpoint.
// Used to compute the "Verified Gross USD Value" of a native lock.
// In production this would be replaced by an on-chain price feed.

export async function fetchEthPriceUsd() {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
    { headers: { accept: "application/json" } }
  );
  if (!res.ok) throw new Error("Price feed unavailable");
  const data = await res.json();
  const usd = data?.ethereum?.usd;
  if (typeof usd !== "number") throw new Error("Unexpected price response");
  return usd;
}