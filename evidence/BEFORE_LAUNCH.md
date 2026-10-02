# Before launch
Items that must be finished before a launch. A missing wallet address is not an item on this list. A wrong registry address is.
Do not mark an item done by guessing, padding, or skipping.
## Registry addresses — rows 978 and 989
The price feed is not evidence that these contract addresses are valid. Prices are keyed by pricing_identifier (aptos, hedera-hashgraph). An Ethereum address is 0x plus 40 hex digits. Both stored values have 39. deploy-five leaves both unregistered and must not left-pad them.
Row 978, APT, Ethereum, stored 0x14f8b8ba1e427dc1deb44f42e59cba84e6a1c67, pricing id aptos.
Row 989, HBAR, Ethereum, stored 0x14ab470682Bc045336B1df6262d538Cb6c35eA2, pricing id hedera-hashgraph.
Hedera published the wrapped HBAR contract as 0x14ab470682Bc045336B1df6262d538cB6c35eA2A. The registry copy is missing the final A. Padding a zero onto the left would be a different address. The missing Aptos digit has not been established here. Do not guess it.
Before launch, correct both identifiers in the governing registry on purpose, then register those rows from the corrected bytes. Until that correction, these two rows stay unregistered.
