# Solana lock reader: what was tried and what is missing (2026-10-19)

Measured on local validators (Agave 4.3.0, the version mainnet reports; and
Solana 1.18.18), plus read-only mainnet RPC lookups of feature accounts.
No reader was built because no route produced a sound proof. `SolanaLockReader`
stays unregistered and fails closed.

## Data path, transaction -> block hash (Agave 4.3.0, local)

- A slot is a chain of entries. Entry hash = SHA-256 applied `num_hashes`
  times to the previous entry hash; an entry with transactions mixes in the
  Merkle root of the transactions' **signatures** (leaf SHA-256(0x00||sig),
  node SHA-256(0x01||l||r)). The last entry hash is the slot's blockhash.
- Recomputed from the ledger: slot 306 (a successful transfer) and slot 418
  (a failed transfer): Previous Blockhash -> 66 entries -> Blockhash, all 66
  entry hashes match, both slots.
- The transaction is tied to the entry only through its signatures, so the
  lock instruction bytes are tied to the block only through an ed25519
  signature check (Base has no ed25519 precompile).
- Local sizes: 1 hash per entry, 66 hashes per slot; the lock-style entry sat
  56 and 36 hashes before the end of the slot.
- Mainnet: 64 ticks x 62,500 hashes (feature update_hashes_per_tick6, active
  since slot 257,904,000) = 4,000,000 hashes per slot.
- Gas, measured on the test chain: about 246 gas per SHA-256 step at best
  (assembly loop over the precompile): 10,000 steps = 2,481,970 gas. A full
  mainnet slot is about 984M gas, about 492M on average. That is many
  transactions of several million gas each per lock.

## Shorter data that was checked

- `num_hashes` and the previous entry hash: no shortcut. Each step is
  SHA-256 of the previous output; nothing lets you skip steps.
- Bank hash, Agave 3.0 and later (4.3.0 confirmed from source and logs):
  sha256(sha256(parent bank hash || signature count u64 LE || last blockhash)
  || accounts lattice hash (4,096 bytes)). It reaches the blockhash in one
  hash, but nothing in it reaches a transaction or one account.
- Accounts lattice hash: a sum of per-account values. There is no per-account
  proof: any claimed account state can be "balanced" by a made-up remainder.
  Checking the whole slot's change instead would need every changed account's
  old and new data (thousands per mainnet slot) and blake3 in Solidity.
- Accounts delta hash (a Merkle tree, fanout 16, over the accounts written in
  the slot): this would have given a short proof of the vault account's state,
  with no PoH walk at all. Confirmed on 1.18.18: all 58 local slots match
  bank hash = sha256(parent || accounts_delta || signature count || last
  blockhash). Versions: used by 1.18, 2.0, 2.1 and 2.2; 2.3 only until the
  feature remove_accounts_delta_hash; gone from 3.0. On mainnet it was replaced
  by the lattice hash (accounts_lt_hash, slot 347,328,000) and removed
  (remove_accounts_delta_hash, slot 348,624,000). Not usable now.
- Block ID (chained Merkle shreds): votes carry block_id (seen in local
  TowerSync votes). A chain of shred Merkle roots could tie a transaction's
  bytes to it far more cheaply than the PoH walk. It still shows only that the
  bytes were in the block.
- Alpenglow (SIMD-0326): the feature exists in 4.3.0 but is not activated on
  mainnet (its feature account has no data).

## The missing piece

Solana's block data records that a transaction was included, never whether it
succeeded. Demonstrated locally: a transfer that failed on purpose (slot 418,
InstructionError, fee charged) sits in the block exactly like a successful one
and passes the same entry-chain check. Since slot 348,624,000 nothing in
Solana's hashes commits to one account's state either, so the vault account
cannot be shown to hold the lock. A reader that accepted an included lock
transaction would accept a lock that failed, so that anyone could mint against
a lock that never held funds for the price of a transaction fee.

Smallest change that would allow it: Solana itself committing, in the block
hash or bank hash, to per-transaction results or to the accounts changed in
the slot (as the accounts delta hash did before slot 348,624,000). Nothing in
the lock program or the proof package can supply that.
