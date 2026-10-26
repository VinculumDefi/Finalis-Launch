// Founder override (operator decision t430u item 5, 2026-10-26; narrowed by
// operator decision t431u, 2026-10-26).
//
// TigerOG is kept in the Base registry by founder override. No screening,
// eligibility, liquidity, hold or listing restriction may remove or hide it.
// The override names one exact Base contract.
//
// LionOG (row 999) and FrogOG (row 1000) were removed from the Base registry
// by operator decision t431u ("eliminate Frog OG and Lion OG ... We'll keep
// Tiger OG"). They are not founder-override rows and are not registered.
//
// This is not a community-token price-source override (Master Specification
// Revision 18 VF-ORC-006). It does not change how a price is found: these rows
// go through the same scheduled cascade as every other row (CoinGecko by id,
// then DexScreener by the row's own Base contract). No price is invented. If
// the cascade returns no price, the row has no usable valuation for that run
// (VF-ORC-005), like any other row.
const FOUNDER_OVERRIDE = Object.freeze([
  Object.freeze({ row: 138, symbol: "TigerOG", environmentId: "Base", address: "0xCF7Fc0De71238c9EC45EC2Fd24FDc8521345dbB5" }),
]);
const FOUNDER_OVERRIDE_NAME = "founder override (t430u item 5, TigerOG only under t431u)";
// Removed by operator decision t431u (2026-10-26). Kept here only so builds and
// tests can check that these exact contracts stay out of the Base registry.
const REMOVED_T431U = Object.freeze([
  Object.freeze({ row: 999, symbol: "LionOG", environmentId: "Base", address: "0x6731F2d7ADF86cfba30d15c4D10113Ce98f3492A" }),
  Object.freeze({ row: 1000, symbol: "FrogOG", environmentId: "Base", address: "0x0E3b564bdD09348840811C7e1106BbD0e98b5b4f" }),
]);

// Exact identity: Base and the exact contract. A matching ticker is not enough.
function isFounderOverride(environmentId, address) {
  if (environmentId !== "Base" || typeof address !== "string") return false;
  const a = address.toLowerCase();
  return FOUNDER_OVERRIDE.some((f) => f.address.toLowerCase() === a);
}

module.exports = { FOUNDER_OVERRIDE, FOUNDER_OVERRIDE_NAME, REMOVED_T431U, isFounderOverride };
