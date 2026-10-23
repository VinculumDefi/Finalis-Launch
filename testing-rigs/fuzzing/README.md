# Rig 3: fuzzing (Foundry) and stateful fuzzing (Echidna)

Base: origin/main b0e38a9, branch rigs/foundry. Report only, no contract or app code changed.

## Tools
- forge 1.8.4, forge-std v1.9.7, solc 0.8.19 (viaIR, optimizer 200, evm paris, same as Hardhat)
- Echidna 2.3.3, slither 0.11.6, crytic-compile 0.4.2

## How to run
    cd testing-rigs/fuzzing && ./setup.sh && forge test -vv
    cd testing-rigs/echidna && SOLC_VERSION=0.8.19 echidna EchidnaVF.sol --contract EchidnaVF --config echidna.yaml

foundry.toml remaps `vf/` to `../../base-contracts/contracts/`, so the fuzzers test the same
sources the Hardhat suite compiles. Fuzz runs: 10,000 per test. Seed: 0x5646525a5a3230323631303233.

## Result (results/forge_test_10k_runs.log)
41 tests, 35 pass, 6 fail.
- Minting (7), Locking (9), Fee math (5), Access control (11): all pass at 10,000 runs.
- FuzzFindings: 3 property tests fail on purpose, each pins a finding (FZ-01, FZ-01b, FZ-02).
  The SHAPE test passes, which is the point it demonstrates (FZ-05).
- FuzzReaders: 3 fail on panics (FZ-06 Panic 0x32 in the EVM header / RLP parser, FZ-07 Panic 0x41
  in the UTXO tx parser). Random bytes never produced an unexpected success.

## Echidna (../echidna/results/echidna_run.log)
Seed 20261023, 20,000 calls, sequence length 60, one worker.
- echidna_one_rac_per_lock: FALSIFIED. Shrunk to openLock, recordRac(seed A), recordRac(seed B)
  on the same lock (FZ-01, confirmed statefully).
- one_mint_per_lock, vclm/chonx/synth within cap, no_synth_before_activation, stake_solvent,
  lifetime_le_cap: passing.
- Coverage note: VCLM mints and stake positions were reached. The Stake epoch reward mint
  (Stake.sol:479) was not reached in 20,000 calls, so stake_solvent is weaker on the reward path.

## What fuzzing cannot catch
Fuzzing finds inputs that crash, overflow or break a stated invariant. It does NOT catch inputs
that are valid in shape but false in fact: a well-formed, self-consistent header, block or ledger
that was never part of the real chain. Every reader accepts those by design of its parser, and a
fuzzer that generates them is just confirming the parser works. Example kept here as
test_SHAPE_selfMadeBitcoinBlockPassesFinality: a self-made coinbase plus an 80-byte header with no
proof of work passes BitcoinLockReader.verifyFinality. Whether that is safe depends on what else
binds the header to the real chain (PoW, checkpoints, a light client, an operator attestation).
That question belongs to the adversarial / assumption-gap tier, not to this rig. See FZ-05 in
../findings/fuzz_mutation.json.

## Not committed (recreated locally)
These folders are third-party code or build output. They are listed in fuzzing/.gitignore and
echidna/.gitignore and are not on main.
- fuzzing/lib/forge-std (about 1.4 MB, third-party): `./setup.sh` clones forge-std at the pinned
  tag v1.9.7 into lib/forge-std if it is missing, and installs Foundry (foundryup) if `forge` is
  not on PATH.
- fuzzing/cache/ and fuzzing/out/: written by `forge build` or `forge test`.
- echidna/corpus/ and echidna/crytic-export/: written by the echidna command above. Rerun with
  the same seed (20261023) and config to recreate the corpus.
