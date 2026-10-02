# Before launch
Items that must be finished before a launch. A missing wallet address is not an item on this list. A wrong registry address is.
Do not mark an item done by guessing, padding, or skipping.
## Registry addresses — rows 978 and 989
The price feed is not evidence that these contract addresses are valid. Prices are keyed by pricing_identifier (aptos, hedera-hashgraph). An Ethereum address is 0x plus 40 hex digits. Both stored values have 39. deploy-five leaves both unregistered and must not left-pad them.
Row 978, APT, Ethereum, stored 0x14f8b8ba1e427dc1deb44f42e59cba84e6a1c67, pricing id aptos.
Row 989, HBAR, Ethereum, stored 0x14ab470682Bc045336B1df6262d538Cb6c35eA2, pricing id hedera-hashgraph.
Hedera published the wrapped HBAR contract as 0x14ab470682Bc045336B1df6262d538cB6c35eA2A. The registry copy is missing the final A. Padding a zero onto the left would be a different address. The missing Aptos digit has not been established here. Do not guess it.
Before launch, correct both identifiers in the governing registry on purpose, then register those rows from the corrected bytes. Until that correction, these two rows stay unregistered.

Architecture C.11 alone names the five Stellar memo bindings (lock id, Base recipient, output token, asset identity, and valuation reference) but specifies no concrete byte layout or encoding that fits Stellar's ≤28-byte text or ≤32-byte hash memo limit; a Stellar lock cannot be built until that layout is specified, and no layout was invented here.

Architecture C.10 does not establish a mainnet-available atomic batch and does not specify a single transaction that pays the 5% fee, locks the 95% principal, and removes early cancellation; an XRPL lock cannot be built until that construction is specified, and none was invented here.

The Cosmos Hub feasibility report verdict is “CONDITIONALLY FEASIBLE — NOT FEASIBLE NOW”; because it is not feasible now, a Cosmos Hub lock was not built.

Cosmos Hub code upload is permissionless; a no-admin contract is still not a safe lock because governance can migrate it and migration can send the contract's funds, as in wasmd v0.60.7 x/wasm/keeper/authz_policy.go lines 66–67 and TestMigrateWithDispatchedMessage; a Cosmos Hub lock was not built.

Architecture C.13 does not specify how a Litecoin lock binds the Base recipient, and it does not establish the Litecoin header check needed for SPV verification; a Litecoin lock cannot be built until the Base-recipient binding and Litecoin header-check mechanism are specified, and no binding, header check, light client, confirmation count, or other Litecoin mechanism was invented here.

Architecture C.14 does not specify how a Dogecoin lock binds the Base recipient or establish the Dogecoin header check needed for SPV verification; a Dogecoin lock cannot be built until the Base-recipient binding and Dogecoin header-check mechanism are specified, and no binding, header check, light client, confirmation count, or other Dogecoin mechanism was invented here.

Architecture C.15 does not specify how a DigiByte lock binds the Base recipient or establish the DigiByte header check needed for SPV verification; a DigiByte lock cannot be built until the Base-recipient binding and DigiByte header-check mechanism are specified, and no binding, header check, light client, confirmation count, or other DigiByte mechanism was invented here.
Architecture C.16 does not specify how a transparent Zcash lock binds the Base recipient or establish the Zcash header check needed for SPV verification; a Zcash lock cannot be built until the Base-recipient binding and Zcash header-check mechanism are specified. The confirmation count of 10 was left as written, and no binding, header check, light client, or other Zcash mechanism was invented here.

The Bitcoin principal release was checked for amount and locktime only; no signature was checked.

The Bitcoin Cash test still registers headers through `testRegisterHeader`, and no confirmation count was chosen.

A BNB mint stays refused because no validator-vote encoding is specified, and none was invented.
