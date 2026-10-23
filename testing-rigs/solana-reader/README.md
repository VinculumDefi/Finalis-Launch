# Solana lock reader, simple bar (test rig, 2026-10-23)

Branch `test/solana-sampling-2026-10-23` only. Nothing here is registered,
deployed, broadcast or finalized, and no real keys are used. The live
Oct 22 Base set has no Solana reader, and this rig does not add one.

## Finality: what is authoritative, exactly

Solana cannot be proven trustlessly on Base. A PoH walk is about 4 million
SHA-256 steps per slot, a block does not commit to transaction success, and
the accounts lattice hash has no per-account proof
(`docs/SOLANA_READER_FINDINGS_2026-10-19.md`). So this reader does not
pretend to check finality on-chain, and it does not accept self-consistent
headers the way the AG-01..03 readers do.

The authority is the Solana RPC answer at commitment `finalized`:

- `getTransaction(signature, finalized)` and `getBlock(slot, finalized)`.
- A finalized block is one the node has rooted. A supermajority (at least
  2/3 of active stake) has voted on it under Tower BFT and it has reached
  maximum lockout (31+ confirmations on top).
- The cluster is fixed by `getGenesisHash`. Mainnet is `5eykt4Uv...w2N9d`.
  The local validator used here has its own genesis hash.

This is off-chain trust in the RPC nodes and in the attesters who run the
checker. A lying RPC, if every attester trusts it, or k compromised attester
keys, can mint against a lock that does not exist. Using several independent
RPCs (`checkLockQuorum`, all must agree) and several independent attesters
reduces this risk but does not remove it.

## Split: on-chain vs off-chain

| Check | Where |
|---|---|
| Cluster genesis hash equals the expected cluster | off-chain checker, and bound into the attested digest on-chain |
| Tx found at `finalized`, `meta.err` null, status `finalized` | off-chain only (RPC trust) |
| Tx slot equals package slot; finalized block at that slot has the package blockhash and contains the signature | off-chain only (RPC trust), slot and blockhash bound into the digest |
| Every ed25519 tx signature verifies over the message bytes | off-chain checker, computed locally, not RPC trust |
| Exactly one top-level instruction to the vault program, a commit, with the program PDAs | off-chain checker, from the signed bytes |
| Exactly one `LockCreated` from the vault program's own log frame, equal to the signed instruction (lock id, amount, duration, recipient, release destination, output token, USD value, depositor) | off-chain checker (logs are RPC trust, instruction bytes are signed) |
| Dev Fund lamport delta equals the fee, lock account holds the principal | off-chain only (meta is RPC trust) |
| Package fields equal the finalized lock: program id, depositor, asset (SOL or mint), amount, duration, recipient, lock id | off-chain checker |
| k-of-n attester signatures, distinct, ascending, in the configured set | on-chain (`SolanaAttestedLockReader`) |
| Digest binds Base chain id, the reader address, genesis hash, program id and the full lock record | on-chain |
| 5% fee, principal = gross - fee, 16 permitted durations, maturity = block time + duration, lock id = sha256(lock id string), recipient nonzero, output token 0 or 1 | on-chain |
| Native SOL asset id `keccak256(encodePacked("Solana","native-SOL"))`; SPL `keccak256(abi.encode("Solana", mint))` | on-chain |

## Files

- `solanaWire.cjs`: base58, legacy transaction encode and parse, ed25519, PDAs, Anchor discriminators, borsh layouts for the commit params and `LockCreated`.
- `checker.cjs`: the checker (`checkLock`, `checkLockQuorum`), plus HTTP, replay and recording RPC adapters.
- `attest.cjs`: builds the reader proof from checker facts and signs it with test wallets.
- `record_local_lock.cjs`: creates a real native SOL lock (2 SOL, 30 days) on a local `solana-test-validator` running the vault program, records the checker's RPC answers, a snapshot taken while the lock was only confirmed, and a plain transfer. Refuses mainnet. Keys are in memory only.
- `record_mainnet_fixture.cjs`: read-only. Records one real finalized mainnet SPL Token transaction (legacy) for the cluster and wrong-program cases. Also confirms the vault program id has no account on mainnet.
- `fixtures/local_lock.json`, `fixtures/mainnet_token_tx.json`: the recordings.
- `base-contracts/contracts/test/SolanaAttestedLockReader.sol`: the test-only reader.
- `base-contracts/test/solana_attested_reader.test.cjs`: the tests.

## Tests

`npx hardhat test test/solana_attested_reader.test.cjs` replays the fixtures:
15 passing, 1 pending (live mode). With a validator running and
`SOLANA_LIVE_RPC=http://127.0.0.1:8899`: 16 passing.

Accepted: the real local lock (checker), and the same lock with 2 of 3
attesters (reader). Rejected, each by a named check:

- forged signature: unknown signature (`SOL-NOT-FINALIZED`), altered signature bytes from a lying RPC (`SOL-SIG-INVALID`), altered signed amount (`SOL-SIG-INVALID`), outsider attester (`SAR: not an attester`), one attester or a repeated one.
- wrong program: other expected program, a plain system transfer, a real mainnet token tx (all `SOL-PROGRAM`); attestation over another program id.
- altered amount: package claim (`SOL-PKG-GROSSAMOUNT`), lying RPC rewriting the event (`SOL-EVENT-IX`), proof changed after attestation, attested wrong fee (`SAR: fee`).
- altered recipient: package claim (`SOL-PKG-BASERECIPIENT`), lying RPC rewriting the event (`SOL-EVENT-IX`), proof changed after attestation.
- wrong slot (`SOL-SLOT`) or blockhash (`SOL-BLOCKHASH`), and both changed after attestation.
- non-finalized: the finalized lookup recorded while the lock was only confirmed returned null (`SOL-NOT-FINALIZED`); status `confirmed` (`SOL-STATUS`); block missing at finalized (`SOL-BLOCK-NOT-FINALIZED`).
- other cluster: local lock against mainnet genesis, real mainnet tx against local genesis (both `SOL-CLUSTER`); attestation over the mainnet genesis; replay to a second reader.

## How the program was built (for reproduction, outside the repo)

The vault program in `src/solana-vault` does not compile on main: `state.rs`
line 185 has a stray closing brace after `impl Default for HandshakeAllowance`.
The build here used a copy in `/tmp` with that one line removed. The repo file
is not changed on this branch. Other build steps on the copy: drop
`rust-toolchain.toml`, add `rust-version = "1.75"` to the program crate, resolve
the lockfile with `CARGO_RESOLVER_INCOMPATIBLE_RUST_VERSIONS=fallback`, pin
`blake3` to 1.5.0, write lockfile version 3, then `cargo build-sbf`
(platform-tools v1.41, solana-cli 1.18.18). The validator loads the `.so` at
the declared program id with `--bpf-program`.

## Findings

- Spec conflict, latent: the Solana program charges 250 bps on Handshake locks (`HANDSHAKE_FEE_BPS`). Rev 12 says 5% for every duration. The checker and the reader require 5% and would reject a Solana Handshake lock.
- Incomplete testing, latent: the program on main does not compile (stray brace in `state.rs`).
- Unverified assumption, latent: the attester and RPC trust above. No on-chain finality exists for Solana.
- Spec conflict, latent: an SPL asset is a 32-byte mint, but the Verifier's token address index is keyed by a 20-byte address, so SPL rows cannot be resolved through it as is. Rev B has no Solana rows.
- Unverified assumption, latent: only the native SOL path was exercised end to end. The SPL path is decoded but not run on the validator.
- Documentation, latent: the program comments say `lock_id_hash` is keccak256; the code uses SHA-256. The checker and reader use SHA-256.
- The vault program id has no account on mainnet (checked read-only).
