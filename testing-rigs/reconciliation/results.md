# Rig 10: deployment artifact and ceremony reconciliation

Run 2026-10-23 EDT, branch rigs/hardhat, main b0e38a9. Read only against live; nothing signed or sent.

## Verdicts
| Target | Verdict | Checks |
|---|---|---|
| Dry-run (local Base fork block 52985059, `npm run ceremony:dryrun` step 15) | reconciliation PASS | 349 PASS, 0 MISMATCH, 0 INCOMPLETE |
| Live Base set of Oct 22 (`reconciliation/live.sh`) | reconciliation PASS | 350 PASS, 0 MISMATCH, 0 INCOMPLETE |

Dry-run stdout: `ceremony would succeed` then `reconciliation PASS`.

## What was checked (live; dry-run is the same minus the address-document check)
- inputs (1): every live address (lock 0xa1bE..3558, VCLM 0xC8c7..9983, CHONX 0x2150..0291, Verifier 0xfA8A..6328, Forge 0xf1cA..5D27, Stake 0x8481..Df55, 15 readers, non-Base lock 0x115b..626E) is in deployment/BASE44_LIVE_CONFIG_2026-10-22.md on main.
- bytecode (27): full runtime of all 21 Base contracts equals the artifact deployed locally with the intended constructor args (immutables derived, not masked). Non-Base lock on Ethereum, Arbitrum, Optimism, Polygon, BNB Smart Chain, Avalanche: masked runtime hash, label, Dev Fund 0xFD21..3e9a, 5% fee.
- creation (42): each creation tx input equals ceremony.json bytecode plus the intended args, sent by operator 0xE76F..55E4.
- references (114): token names, caps, minters (VCLM: Verifier + Stake, CHONX: Verifier), finalized flags; Verifier tokens, poster 0x6001..0DB4, finalized, deployer cleared to zero by finalize (Verifier 578), launch set; Dev Fund destinations; Forge, Stake, Lock wiring; old locks absent; each reader's lock / script / key / account and environment word.
- readers and minters (31): exactly 15 registrations, each environment once, from the ceremony receipts and from a full log scan to head; Solana, Tron, Cardano, Cosmos Hub, Ethereum Classic and case variants unset; each token initialized exactly once.
- lock (28): 500 bps fee; all 16 durations accepted with exactly 5%; bad durations refused; Handshake 3600 s, $0.01 and $0.02 accepted, one wei outside refused; standard minimum $0.01.
- registry (25): 487 rows (id, symbol, decimals, custody class, custody path), 475 token-address index entries, 3 aliases, rows per environment resolve to the intended reader, and every indexed token address has code on its own chain (7 EVM chains).
- ceremony txs (11): decoded operator calls equal ceremony-data: 487 rows, 475 tokens, 3 aliases, 7 Dev Funds, 15 registrations, poster operator then live poster, one price run (Base ETH 2392.22 USD), finalize last, no unexpected calls, all status 1, nonces 678 to 749 contiguous (blocks 52967009 to 52967311).
- closed (71): after finalize every configuration function reverts for the operator and a stranger (VF-DEP-003, VF-DEP-006, VFT not minter, VF-ORC-007); the only open configuration-like path is applyScheduledPriceRun from the live poster (run 2 would apply). Readers have no write functions. User paths are open by design (see HH-015).

## Note
Operator nonces 676 and 677 (block 52925907 and 52925912) sent a price run and finalize to the retired Oct 21 Verifier 0x3bce..9381 (HH-016). No live contract references the retired set.

## Answer: did we actually deploy the system we tested?
Yes. The live Base set is byte-for-byte the compiled artifacts that the Hardhat suite, the fork rigs and the dry-run exercised, wired exactly as ceremony-data says, configured by exactly the intended 72 transactions, and closed. That also means every confirmed finding in findings/hardhat.json (HH-001, HH-003, HH-004, HH-005, HH-006, HH-008, HH-009, HH-010) is in the deployed system, and HH-002 and HH-007 are latent in it.

Tool limits: public RPCs throttle eth_getLogs (mainnet.base.org rate limit, tenderly 1000-block cap); the scan used 1000-block chunks via base.gateway.tenderly.co and completed.
