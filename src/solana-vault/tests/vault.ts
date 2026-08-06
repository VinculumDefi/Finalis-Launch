// =============================================================================
// Integration tests for the Vinculum Finalis Solana Commitment Vault Lock.
//
// PROVENANCE: Revision 6 protocol constants and requirements.
//
// These tests run via `anchor test` (requires Solana CLI, Anchor CLI, and
// a local validator). They have NOT been executed in the Base44 environment
// (no Rust toolchain or Solana CLI available). They serve as the verification
// specification — each test maps to protocol requirement IDs.
// =============================================================================

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  SystemProgram,
  Keypair,
  LAMPORTS_PER_SOL,
  Connection,
} from "@solana/web3.js";
import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import assert from "assert";

// Revision 6 constants (mirrored from on-chain constants.rs)
const HANDSHAKE_DURATION = 3600;
const STANDARD_DURATION = 7 * 86400; // 7 days
const HANDSHAKE_FEE_BPS = 250;
const STANDARD_FEE_BPS = 500;
const HANDSHAKE_USD_MIN = "950000000000000000"; // $0.95 (18dp)
const HANDSHAKE_USD_MAX = "1050000000000000000"; // $1.05 (18dp)
const STANDARD_USD_MIN = "10000000000000000000"; // $10.00 (18dp)
const HANDSHAKE_ALLOWANCE = 3;

const SEED_CONFIG = Buffer.from("vf_config");
const SEED_LOCK = Buffer.from("vf_lock");
const SEED_HANDSHAKE = Buffer.from("vf_handshake");
const SEED_VAULT = Buffer.from("vf_vault");

// SHA-256 (matching on-chain hash::hashv)
async function hashLockId(lockId: string): Promise<Buffer> {
  const data = new TextEncoder().encode(lockId);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Buffer.from(hash);
}

function deriveLockPda(programId: PublicKey, lockIdHash: Buffer): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([SEED_LOCK, lockIdHash], programId);
}

function deriveHandshakePda(programId: PublicKey, sourceAccount: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([SEED_HANDSHAKE, sourceAccount.toBuffer()], programId);
}

function deriveConfigPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([SEED_CONFIG], programId);
}

function deriveVaultPda(programId: PublicKey, mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([SEED_VAULT, mint.toBuffer()], programId);
}

describe("vf-solana-vault", () => {
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.VfSolanaVault as Program;
  const programId = program.programId;

  let devFund: Keypair;
  let configPda: PublicKey;
  let mint: PublicKey;
  let userTokenAccount: PublicKey;
  let devFundTokenAccount: PublicKey;

  // ---------------------------------------------------------------------------
  // Setup: airdrop, mint SPL token, create token accounts
  // ---------------------------------------------------------------------------
  before(async () => {
    devFund = Keypair.generate();
    const sig = await provider.connection.requestAirdrop(devFund.publicKey, 100 * LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig);

    [configPda] = deriveConfigPda(programId);

    // Create an SPL mint for SPL tests
    mint = await createMint(
      provider.connection,
      provider.wallet as any,
      provider.wallet.publicKey,
      null,
      9,
    );

    userTokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      provider.wallet as any,
      mint,
      provider.wallet.publicKey,
    );

    devFundTokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      provider.wallet as any,
      mint,
      devFund.publicKey,
    );

    // Mint tokens to user
    await mintTo(
      provider.connection,
      provider.wallet as any,
      mint,
      userTokenAccount,
      provider.wallet.publicKey,
      1_000_000_000_000, // 1000 tokens
    );
  });

  // ---------------------------------------------------------------------------
  // T-01: Initialize — VF-DEP-001/002
  // ---------------------------------------------------------------------------
  it("T-01: initializes the config with a dev fund destination (VF-DEP-001)", async () => {
    await program.methods
      .initialize(devFund.publicKey)
      .accounts({
        authority: provider.wallet.publicKey,
        config: configPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const config = await program.account.config.fetch(configPda);
    assert.equal(config.devFundDestination.toBase58(), devFund.publicKey.toBase58());
    assert.equal(config.sourceEnvironment, "Solana");
  });

  // ---------------------------------------------------------------------------
  // T-02: Standard native SOL lock — VF-COM-001/009/010/011/012/013
  // ---------------------------------------------------------------------------
  it("T-02: creates a standard native SOL lock (VF-COM-009/011)", async () => {
    const lockId = "test-standard-sol-001";
    const lockIdHash = await hashLockId(lockId);
    const [lockPda] = deriveLockPda(programId, lockIdHash);

    const gross = new BN(1_000_000_000); // 1 SOL in lamports
    const fee = gross.muln(STANDARD_FEE_BPS).divn(10000); // 5%
    const principal = gross.sub(fee);

    await program.methods
      .commitVaultLockNative({
        lockId,
        lockIdHash: [...lockIdHash],
        grossAmount: gross,
        durationSecs: STANDARD_DURATION,
        baseRecipient: Buffer.alloc(20, 1), // nonzero test address
        releaseDestination: provider.wallet.publicKey,
        outputToken: { vclm: {} },
        verifiedGrossUsdMicro: new BN(STANDARD_USD_MIN),
        chonxActivationReceipt: "not_applicable",
      })
      .accounts({
        signer: provider.wallet.publicKey,
        config: configPda,
        lockRecord: lockPda,
        handshakeAllowance: deriveHandshakePda(programId, provider.wallet.publicKey)[0],
        devFund: devFund.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const lock = await program.account.lockRecord.fetch(lockPda);
    assert.equal(lock.lockId, lockId);
    assert.equal(lock.sourceEnvironment, "Solana");
    assert.equal(lock.grossAmount.toString(), gross.toString());
    assert.equal(lock.feeAmount.toString(), fee.toString());
    assert.equal(lock.principalAmount.toString(), principal.toString());
    assert.equal(lock.released, false);
    assert.ok(lock.lockType.native !== undefined);
  });

  // ---------------------------------------------------------------------------
  // T-03: Handshake native SOL lock — VF-COM-003/004/006
  // ---------------------------------------------------------------------------
  it("T-03: creates a qualifying Handshake lock (VF-COM-003/006)", async () => {
    const lockId = "test-handshake-001";
    const lockIdHash = await hashLockId(lockId);
    const [lockPda] = deriveLockPda(programId, lockIdHash);
    const [haPda] = deriveHandshakePda(programId, provider.wallet.publicKey);

    const gross = new BN(50_000_000); // 0.05 SOL
    const usd = new BN("1000000000000000000"); // $1.00 (within $0.95–$1.05)

    await program.methods
      .commitVaultLockNative({
        lockId,
        lockIdHash: [...lockIdHash],
        grossAmount: gross,
        durationSecs: HANDSHAKE_DURATION,
        baseRecipient: Buffer.alloc(20, 2),
        releaseDestination: provider.wallet.publicKey,
        outputToken: { vclm: {} },
        verifiedGrossUsdMicro: usd,
        chonxActivationReceipt: "not_applicable",
      })
      .accounts({
        signer: provider.wallet.publicKey,
        config: configPda,
        lockRecord: lockPda,
        handshakeAllowance: haPda,
        devFund: devFund.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const ha = await program.account.handshakeAllowance.fetch(haPda);
    assert.equal(ha.used, 1);
    assert.equal(ha.remaining, HANDSHAKE_ALLOWANCE - 1);
  });

  // ---------------------------------------------------------------------------
  // T-04: Handshake allowance exhaustion — VF-COM-007
  // ---------------------------------------------------------------------------
  it("T-04: exhausts the three-use Handshake allowance (VF-COM-007)", async () => {
    // 2nd and 3rd Handshakes succeed; 4th fails
    for (let i = 2; i <= 3; i++) {
      const lockId = `test-handshake-${i.toString().padStart(3, "0")}`;
      const lockIdHash = await hashLockId(lockId);
      const [lockPda] = deriveLockPda(programId, lockIdHash);

      await program.methods
        .commitVaultLockNative({
          lockId,
          lockIdHash: [...lockIdHash],
          grossAmount: new BN(50_000_000),
          durationSecs: HANDSHAKE_DURATION,
          baseRecipient: Buffer.alloc(20, 3),
          releaseDestination: provider.wallet.publicKey,
          outputToken: { vclm: {} },
          verifiedGrossUsdMicro: new BN("1000000000000000000"),
          chonxActivationReceipt: "not_applicable",
        })
        .accounts({
          signer: provider.wallet.publicKey,
          config: configPda,
          lockRecord: lockPda,
          handshakeAllowance: deriveHandshakePda(programId, provider.wallet.publicKey)[0],
          devFund: devFund.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    }

    // 4th Handshake should fail
    const lockId = "test-handshake-004";
    const lockIdHash = await hashLockId(lockId);
    const [lockPda] = deriveLockPda(programId, lockIdHash);

    await assert.rejects(
      program.methods
        .commitVaultLockNative({
          lockId,
          lockIdHash: [...lockIdHash],
          grossAmount: new BN(50_000_000),
          durationSecs: HANDSHAKE_DURATION,
          baseRecipient: Buffer.alloc(20, 4),
          releaseDestination: provider.wallet.publicKey,
          outputToken: { vclm: {} },
          verifiedGrossUsdMicro: new BN("1000000000000000000"),
          chonxActivationReceipt: "not_applicable",
        })
        .accounts({
          signer: provider.wallet.publicKey,
          config: configPda,
          lockRecord: lockPda,
          handshakeAllowance: deriveHandshakePda(programId, provider.wallet.publicKey)[0],
          devFund: devFund.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc(),
      /HandshakeAllowanceExhausted/,
    );
  });

  // ---------------------------------------------------------------------------
  // T-05: Release before maturity fails — VF-PRI-001/005
  // ---------------------------------------------------------------------------
  it("T-05: rejects release before maturity (VF-PRI-001)", async () => {
    const lockId = "test-standard-sol-001";
    const lockIdHash = await hashLockId(lockId);
    const [lockPda] = deriveLockPda(programId, lockIdHash);

    await assert.rejects(
      program.methods
        .releasePrincipalNative(lockId, [...lockIdHash])
        .accounts({
          caller: provider.wallet.publicKey,
          config: configPda,
          lockRecord: lockPda,
          releaseDestination: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc(),
      /NotMatured/,
    );
  });

  // ---------------------------------------------------------------------------
  // T-06: Release after maturity succeeds — VF-PRI-002/003
  // ---------------------------------------------------------------------------
  it("T-06: releases principal after maturity (VF-PRI-002/003)", async () => {
    // Warp clock past maturity (requires `solana-test-validator` with --warp-slot)
    // NOTE: This test requires the validator clock to be advanced.
    // In a real test environment, use `connection.requestAirdrop` + `sleep` or
    // configure the validator with `--warp-slot` / `--clone` to fast-forward time.
    const lockId = "test-standard-sol-001";
    const lockIdHash = await hashLockId(lockId);
    const [lockPda] = deriveLockPda(programId, lockIdHash);

    // Skip this test if the clock can't be advanced (localnet limitation)
    const lock = await program.account.lockRecord.fetch(lockPda);
    const clock = await provider.connection.getSlot();
    const blockTime = (await provider.connection.getBlockTime(clock)) || 0;

    if (blockTime < Number(lock.maturityTimeSecs)) {
      console.log("  [SKIP] Clock not yet at maturity — warp the validator to run this test");
      return;
    }

    await program.methods
      .releasePrincipalNative(lockId, [...lockIdHash])
      .accounts({
        caller: provider.wallet.publicKey,
        config: configPda,
        lockRecord: lockPda,
        releaseDestination: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const updated = await program.account.lockRecord.fetch(lockPda);
    assert.equal(updated.released, true);
  });

  // ---------------------------------------------------------------------------
  // T-07: Double release fails — VF-PRI-002
  // ---------------------------------------------------------------------------
  it("T-07: rejects double release (VF-PRI-002)", async () => {
    const lockId = "test-standard-sol-001";
    const lockIdHash = await hashLockId(lockId);
    const [lockPda] = deriveLockPda(programId, lockIdHash);

    await assert.rejects(
      program.methods
        .releasePrincipalNative(lockId, [...lockIdHash])
        .accounts({
          caller: provider.wallet.publicKey,
          config: configPda,
          lockRecord: lockPda,
          releaseDestination: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc(),
      /AlreadyReleased/,
    );
  });

  // ---------------------------------------------------------------------------
  // T-08: Invalid duration rejected — VF-COM-002
  // ---------------------------------------------------------------------------
  it("T-08: rejects an invalid (non-permitted) duration (VF-COM-002)", async () => {
    const lockId = "test-invalid-duration";
    const lockIdHash = await hashLockId(lockId);
    const [lockPda] = deriveLockPda(programId, lockIdHash);

    await assert.rejects(
      program.methods
        .commitVaultLockNative({
          lockId,
          lockIdHash: [...lockIdHash],
          grossAmount: new BN(1_000_000_000),
          durationSecs: 5000, // NOT a permitted duration
          baseRecipient: Buffer.alloc(20, 5),
          releaseDestination: provider.wallet.publicKey,
          outputToken: { vclm: {} },
          verifiedGrossUsdMicro: new BN(STANDARD_USD_MIN),
          chonxActivationReceipt: "not_applicable",
        })
        .accounts({
          signer: provider.wallet.publicKey,
          config: configPda,
          lockRecord: lockPda,
          handshakeAllowance: deriveHandshakePda(programId, provider.wallet.publicKey)[0],
          devFund: devFund.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc(),
      /DurationNotPermitted/,
    );
  });

  // ---------------------------------------------------------------------------
  // T-09: Handshake value out of range — VF-COM-003
  // ---------------------------------------------------------------------------
  it("T-09: rejects a Handshake with USD value outside $0.95–$1.05 (VF-COM-003)", async () => {
    const lockId = "test-handshake-bad-value";
    const lockIdHash = await hashLockId(lockId);
    const [lockPda] = deriveLockPda(programId, lockIdHash);

    await assert.rejects(
      program.methods
        .commitVaultLockNative({
          lockId,
          lockIdHash: [...lockIdHash],
          grossAmount: new BN(50_000_000),
          durationSecs: HANDSHAKE_DURATION,
          baseRecipient: Buffer.alloc(20, 6),
          releaseDestination: provider.wallet.publicKey,
          outputToken: { vclm: {} },
          verifiedGrossUsdMicro: new BN("5000000000000000000"), // $5.00 — outside range
          chonxActivationReceipt: "not_applicable",
        })
        .accounts({
          signer: provider.wallet.publicKey,
          config: configPda,
          lockRecord: lockPda,
          handshakeAllowance: deriveHandshakePda(programId, provider.wallet.publicKey)[0],
          devFund: devFund.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc(),
      /HandshakeValueOutOfRange/,
    );
  });

  // ---------------------------------------------------------------------------
  // T-10: SPL token lock — VF-COM-011 (SPL path)
  // ---------------------------------------------------------------------------
  it("T-10: creates an SPL token lock (VF-COM-011 SPL path)", async () => {
    const lockId = "test-spl-lock-001";
    const lockIdHash = await hashLockId(lockId);
    const [lockPda] = deriveLockPda(programId, lockIdHash);
    const [vaultTokenAccount] = deriveVaultPda(programId, mint);

    const gross = new BN(100_000_000); // 0.1 tokens
    const fee = gross.muln(STANDARD_FEE_BPS).divn(10000);

    await program.methods
      .commitVaultLockSpl({
        lockId,
        lockIdHash: [...lockIdHash],
        grossAmount: gross,
        durationSecs: STANDARD_DURATION,
        baseRecipient: Buffer.alloc(20, 7),
        releaseDestination: provider.wallet.publicKey,
        outputToken: { vclm: {} },
        verifiedGrossUsdMicro: new BN(STANDARD_USD_MIN),
        chonxActivationReceipt: "not_applicable",
      })
      .accounts({
        signer: provider.wallet.publicKey,
        config: configPda,
        lockRecord: lockPda,
        handshakeAllowance: deriveHandshakePda(programId, provider.wallet.publicKey)[0],
        sourceTokenAccount: userTokenAccount,
        vaultTokenAccount,
        devFundTokenAccount: devFundTokenAccount,
        mint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const lock = await program.account.lockRecord.fetch(lockPda);
    assert.equal(lock.grossAmount.toString(), gross.toString());
    assert.equal(lock.feeAmount.toString(), fee.toString());
    assert.ok(lock.lockType.spl !== undefined);

    // Verify fee was transferred to dev fund
    const devFundAcct = await getAccount(provider.connection, devFundTokenAccount);
    assert.ok(Number(devFundAcct.amount) >= Number(fee));
  });
});