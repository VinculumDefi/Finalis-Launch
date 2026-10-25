# Vinculum Base-only Ceremony: Signer Summary

**Source:** VinculumDefi/Finalis-Launch, main at commit `d7b04e1`. **Network:** Base only.

## Package

- Archive: `artifacts/vinculum-base-ceremony-package-revC-d7b04e1.zip`, SHA-256 `28a96e2c8632c0c346c2f7b824416feef859ef714b2956ba6e326434f4271d8d`.
- Contents: ceremony data (`ceremony-data.json`), ceremony contracts file (`ceremony.json`), ceremony page (`base.html`) and flow (`baseCeremonyFlow.js`), ceremony manifest and the files it pins, registry Revision C, the checklist, runbook, deployment order and deploy-pages README, plus a README and `SHA256SUMS.txt`.
- Spec: Master Specification Revision 18, SHA-256 `487735227ea32aa6914d180d5aa8fd0ef5028e56a5ab4c328a63168072ca44bc`.
- Registry: Revision C, SHA-256 `5c3311eb4f7b59c34e7ccc8a6bd9e817b4f0bb02bdeff65c5cfed98f79cca581`.
- Manifest: SHA-256 `9f84a11f1905fdc450b3d5fc6d482b238b739d3ef91ff22f571cff3ec4b75689`.

## Rows: 27 Base rows

Class breakdown: **1 S1, 1 S2, 25 S3.** Base USDC is the only stablecoin. Base USDT is not in this package.

| Row | Symbol | Type | Class | Ratio |
|---|---|---|---|---|
| 2 | ETH | Native | S2 | 1.3x |
| 25 | CBETH | ERC-20 | S3 | 1.0x |
| 34 | AERO | ERC-20 | S3 | 1.0x |
| 45 | cbBTC | ERC-20 | S3 | 1.0x |
| 73 | VIRTUAL | ERC-20 | S3 | 1.0x |
| 75 | BRETT | ERC-20 | S3 | 1.0x |
| 99 | DEGEN | ERC-20 | S3 | 1.0x |
| 144 | TOSHI | ERC-20 | S3 | 1.0x |
| 194 | HIGHER | ERC-20 | S3 | 1.0x |
| 234 | PENDLE_B | ERC-20 | S3 | 1.0x |
| 247 | MOCHI | ERC-20 | S3 | 1.0x |
| 265 | AIXBT | ERC-20 | S3 | 1.0x |
| 266 | CLANKER | ERC-20 | S3 | 1.0x |
| 304 | TYBG | ERC-20 | S3 | 1.0x |
| 322 | BUILD | ERC-20 | S3 | 1.0x |
| 332 | PONKE | ERC-20 | S3 | 1.0x |
| 384 | ANON | ERC-20 | S3 | 1.0x |
| 390 | BASED | ERC-20 | S3 | 1.0x |
| 400 | LUNA_AI | ERC-20 | S3 | 1.0x |
| 401 | SKI | ERC-20 | S3 | 1.0x |
| 402 | MIGGLES | ERC-20 | S3 | 1.0x |
| 424 | KEYCAT | ERC-20 | S3 | 1.0x |
| 454 | USDC_BASE | ERC-20 (stablecoin) | S1 | 1.5x |
| 493 | KTA | ERC-20 | S3 | 1.0x |
| 506 | SOSO | ERC-20 | S3 | 1.0x |
| 508 | TIBBIR | ERC-20 | S3 | 1.0x |
| 513 | VVV | ERC-20 | S3 | 1.0x |

## Key rules

- S1 mints at 1.5x, S2 at 1.3x, S3 at 1.0x.
- Handshake: 5% uniform fee, value range $0.01 to $0.02, 1-hour duration, no allowance limit.
- The ETH price is retained from the build. No refresh is needed before signing.
- Dry-run (local Base fork, simulated, nothing broadcast): reconciliation PASS; a 1000 USDC 7-day lock mints 15,000 VCLM.

## Signing

The founder signs, broadcasts and finalizes. This package contains no keys.
