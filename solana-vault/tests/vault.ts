// =============================================================================
// Integration tests for the Vinculum Finalis Solana Commitment Vault Lock.
//
// PROVENANCE: Revision 6 protocol constants and requirements.
// Runs via solana-bankrun (Clock.setClock warp) under `anchor test --skip-local-validator`.
// =============================================================================

import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  SystemProgram,
  Keypair,
  LAMPORTS_PER_SOL,
  Transaction,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
} from "spl-token-bankrun";
import { BankrunProvider, startAnchor } from "anchor-bankrun";
import { Clock, ProgramTestContext, BanksClient } from "solana-bankrun";
import { createHash } from "crypto";
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
function hashLockId(lockId: string): Buffer {
  return createHash("sha256").update(lockId).digest();
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
  let context: ProgramTestContext;
  let provider: BankrunProvider;
  let banksClient: BanksClient;
  let program: Program;
  let programId: PublicKey;
  let payer: Keypair;

  let devFund: Keypair;
  let releaseDest: Keypair;
  let configPda: PublicKey;
  let mint: PublicKey;
  let userTokenAccount: PublicKey;
  let devFundTokenAccount: PublicKey;

  async function fundAccount(to: PublicKey, lamports: number) {
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: to,
        lamports,
      }),
    );
    const [blockhash] = await banksClient.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.sign(payer);
    await banksClient.processTransaction(tx);
  }

  // ---------------------------------------------------------------------------
  // Setup: bankrun context, fund accounts, mint SPL token
  // ---------------------------------------------------------------------------
  before(async () => {
    context = await startAnchor(".", [], []);
    provider = new BankrunProvider(context);
    anchor.setProvider(provider);
    banksClient = context.banksClient;
    payer = context.payer;

    program = anchor.workspace.VfSolanaVault as Program;
    programId = program.programId;

    devFund = Keypair.generate();
    releaseDest = Keypair.generate();
    await fundAccount(devFund.publicKey, 10 * LAMPORTS_PER_SOL);
    await fundAccount(releaseDest.publicKey, 1 * LAMPORTS_PER_SOL);

    [configPda] = deriveConfigPda(programId);

    mint = await createMint(
      banksClient,
      payer,
      payer.publicKey,
      null,
      9,
    );

    userTokenAccount = await createAssociatedTokenAccount(
      banksClient,
      payer,
      mint,
      payer.publicKey,
    );

    devFundTokenAccount = await createAssociatedTokenAccount(
      banksClient,
      payer,
      mint,
      devFund.publicKey,
    );

    await mintTo(
      banksClient,
      payer,
      mint,
      userTokenAccount,
      payer,
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
        authority: payer.publicKey,
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
    const lockIdHash = hashLockId(lockId);
    const [lockPda] = deriveLockPda(programId, lockIdHash);

    const gross = new BN(1_000_000_000); // 1 SOL in lamports
    const fee = gross.muln(STANDARD_FEE_BPS).divn(10000); // 5%
    const principal = gross.sub(fee);

    await program.methods
      .commitVaultLockNative({
        lockId,
        lockIdHash: [...lockIdHash],
        grossAmount: gross,
        durationSecs: new BN(STANDARD_DURATION),
        baseRecipient: Buffer.alloc(20, 1), // nonzero test address
        releaseDestination: releaseDest.publicKey,
        outputToken: { vclm: {} },
        verifiedGrossUsdMicro: new BN(STANDARD_USD_MIN),
        chonxActivationReceipt: "not_applicable",
      })
      .accounts({
        signer: payer.publicKey,
        config: configPda,
        lockRecord: lockPda,
        handshakeAllowance: deriveHandshakePda(programId, payer.publicKey)[0],
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
    const lockIdHash = hashLockId(lockId);
    const [lockPda] = deriveLockPda(programId, lockIdHash);
    const [haPda] = deriveHandshakePda(programId, payer.publicKey);

    const gross = new BN(50_000_000); // 0.05 SOL
    const usd = new BN("1000000000000000000"); // $1.00 (within $0.95–$1.05)

    await program.methods
      .commitVaultLockNative({
        lockId,
        lockIdHash: [...lockIdHash],
        grossAmount: gross,
        durationSecs: new BN(HANDSHAKE_DURATION),
        baseRecipient: Buffer.alloc(20, 2),
        releaseDestination: releaseDest.publicKey,
        outputToken: { vclm: {} },
        verifiedGrossUsdMicro: usd,
        chonxActivationReceipt: "not_applicable",
      })
      .accounts({
        signer: payer.publicKey,
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
      const lockIdHash = hashLockId(lockId);
      const [lockPda] = deriveLockPda(programId, lockIdHash);

      await program.methods
        .commitVaultLockNative({
          lockId,
          lockIdHash: [...lockIdHash],
          grossAmount: new BN(50_000_000),
          durationSecs: new BN(HANDSHAKE_DURATION),
          baseRecipient: Buffer.alloc(20, 3),
          releaseDestination: releaseDest.publicKey,
          outputToken: { vclm: {} },
          verifiedGrossUsdMicro: new BN("1000000000000000000"),
          chonxActivationReceipt: "not_applicable",
        })
        .accounts({
          signer: payer.publicKey,
          config: configPda,
          lockRecord: lockPda,
          handshakeAllowance: deriveHandshakePda(programId, payer.publicKey)[0],
          devFund: devFund.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    }

    // 4th Handshake should fail
    const lockId = "test-handshake-004";
    const lockIdHash = hashLockId(lockId);
    const [lockPda] = deriveLockPda(programId, lockIdHash);

    await assert.rejects(
      program.methods
        .commitVaultLockNative({
          lockId,
          lockIdHash: [...lockIdHash],
          grossAmount: new BN(50_000_000),
          durationSecs: new BN(HANDSHAKE_DURATION),
          baseRecipient: Buffer.alloc(20, 4),
          releaseDestination: releaseDest.publicKey,
          outputToken: { vclm: {} },
          verifiedGrossUsdMicro: new BN("1000000000000000000"),
          chonxActivationReceipt: "not_applicable",
        })
        .accounts({
          signer: payer.publicKey,
          config: configPda,
          lockRecord: lockPda,
          handshakeAllowance: deriveHandshakePda(programId, payer.publicKey)[0],
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
    const lockIdHash = hashLockId(lockId);
    const [lockPda] = deriveLockPda(programId, lockIdHash);

    await assert.rejects(
      program.methods
        .releasePrincipalNative(lockId, [...lockIdHash])
        .accounts({
          caller: payer.publicKey,
          config: configPda,
          lockRecord: lockPda,
          releaseDestination: releaseDest.publicKey,
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
    const lockId = "test-standard-sol-001";
    const lockIdHash = hashLockId(lockId);
    const [lockPda] = deriveLockPda(programId, lockIdHash);

    const lock = await program.account.lockRecord.fetch(lockPda);
    const maturity = Number(lock.maturityTimeSecs);
    const principal = BigInt(lock.principalAmount.toString());

    const currentClock = await banksClient.getClock();
    if (Number(currentClock.unixTimestamp) < maturity) {
      // REAL bankrun clock warp past this lock's maturity — never early-return/skip.
      context.setClock(
        new Clock(
          currentClock.slot,
          currentClock.epochStartTimestamp,
          currentClock.epoch,
          currentClock.leaderScheduleEpoch,
          BigInt(maturity) + 1n,
        ),
      );
      const warped = await banksClient.getClock();
      if (Number(warped.unixTimestamp) < maturity) {
        throw new Error(
          `Clock warp failed: unixTimestamp=${warped.unixTimestamp} still < maturity=${maturity}`,
        );
      }
    }

    const destBefore = await banksClient.getBalance(releaseDest.publicKey);

    await program.methods
      .releasePrincipalNative(lockId, [...lockIdHash])
      .accounts({
        caller: payer.publicKey,
        config: configPda,
        lockRecord: lockPda,
        releaseDestination: releaseDest.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const updated = await program.account.lockRecord.fetch(lockPda);
    assert.equal(updated.released, true);

    const destAfter = await banksClient.getBalance(releaseDest.publicKey);
    assert.equal(
      destAfter - destBefore,
      principal,
      `principal must arrive at release destination: before=${destBefore} after=${destAfter} principal=${principal}`,
    );
  });

  // ---------------------------------------------------------------------------
  // T-07: Double release fails — VF-PRI-002
  // ---------------------------------------------------------------------------
  it("T-07: rejects double release (VF-PRI-002)", async () => {
    const lockId = "test-standard-sol-001";
    const lockIdHash = hashLockId(lockId);
    const [lockPda] = deriveLockPda(programId, lockIdHash);

    // Distinct caller + fresh blockhash so bankrun does not dedup the prior release tx.
    const otherCaller = Keypair.generate();
    await fundAccount(otherCaller.publicKey, 1 * LAMPORTS_PER_SOL);
    context.warpToSlot((await banksClient.getClock()).slot + 1n);

    await assert.rejects(
      program.methods
        .releasePrincipalNative(lockId, [...lockIdHash])
        .accounts({
          caller: otherCaller.publicKey,
          config: configPda,
          lockRecord: lockPda,
          releaseDestination: releaseDest.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([otherCaller])
        .rpc(),
      /AlreadyReleased/,
    );
  });

  // ---------------------------------------------------------------------------
  // T-08: Invalid duration rejected — VF-COM-002
  // ---------------------------------------------------------------------------
  it("T-08: rejects an invalid (non-permitted) duration (VF-COM-002)", async () => {
    const lockId = "test-invalid-duration";
    const lockIdHash = hashLockId(lockId);
    const [lockPda] = deriveLockPda(programId, lockIdHash);

    await assert.rejects(
      program.methods
        .commitVaultLockNative({
          lockId,
          lockIdHash: [...lockIdHash],
          grossAmount: new BN(1_000_000_000),
          durationSecs: new BN(5000), // NOT a permitted duration
          baseRecipient: Buffer.alloc(20, 5),
          releaseDestination: releaseDest.publicKey,
          outputToken: { vclm: {} },
          verifiedGrossUsdMicro: new BN(STANDARD_USD_MIN),
          chonxActivationReceipt: "not_applicable",
        })
        .accounts({
          signer: payer.publicKey,
          config: configPda,
          lockRecord: lockPda,
          handshakeAllowance: deriveHandshakePda(programId, payer.publicKey)[0],
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
    const lockIdHash = hashLockId(lockId);
    const [lockPda] = deriveLockPda(programId, lockIdHash);

    await assert.rejects(
      program.methods
        .commitVaultLockNative({
          lockId,
          lockIdHash: [...lockIdHash],
          grossAmount: new BN(50_000_000),
          durationSecs: new BN(HANDSHAKE_DURATION),
          baseRecipient: Buffer.alloc(20, 6),
          releaseDestination: releaseDest.publicKey,
          outputToken: { vclm: {} },
          verifiedGrossUsdMicro: new BN("5000000000000000000"), // $5.00 — outside range
          chonxActivationReceipt: "not_applicable",
        })
        .accounts({
          signer: payer.publicKey,
          config: configPda,
          lockRecord: lockPda,
          handshakeAllowance: deriveHandshakePda(programId, payer.publicKey)[0],
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
    const lockIdHash = hashLockId(lockId);
    const [lockPda] = deriveLockPda(programId, lockIdHash);
    const [vaultTokenAccount] = deriveVaultPda(programId, mint);

    const gross = new BN(100_000_000); // 0.1 tokens
    const fee = gross.muln(STANDARD_FEE_BPS).divn(10000);

    await program.methods
      .commitVaultLockSpl({
        lockId,
        lockIdHash: [...lockIdHash],
        grossAmount: gross,
        durationSecs: new BN(STANDARD_DURATION),
        baseRecipient: Buffer.alloc(20, 7),
        releaseDestination: releaseDest.publicKey,
        outputToken: { vclm: {} },
        verifiedGrossUsdMicro: new BN(STANDARD_USD_MIN),
        chonxActivationReceipt: "not_applicable",
      })
      .accounts({
        signer: payer.publicKey,
        config: configPda,
        lockRecord: lockPda,
        handshakeAllowance: deriveHandshakePda(programId, payer.publicKey)[0],
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
    const devFundAcct = await getAccount(banksClient, devFundTokenAccount);
    assert.ok(Number(devFundAcct.amount) >= Number(fee));
  });
});
