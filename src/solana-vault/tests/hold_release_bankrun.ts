/**
 * Hold + release tests (Revision 8). No skips.
 * Gross 1_000_000 lamports => fee 50_000, principal 950_000.
 */
import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { BankrunProvider, startAnchor } from "anchor-bankrun";
import { Clock } from "solana-bankrun";
import assert from "assert";
import crypto from "crypto";

const STANDARD_DURATION = 7 * 86400;
const STANDARD_FEE_BPS = 500;
const STANDARD_USD_MIN = "10000000000000000000";
const SEED_CONFIG = Buffer.from("vf_config");
const SEED_LOCK = Buffer.from("vf_lock");
const SEED_HANDSHAKE = Buffer.from("vf_handshake");

function hashLockId(lockId: string): Buffer {
  return crypto.createHash("sha256").update(lockId).digest();
}

describe("vf-solana-vault hold/release (bankrun)", () => {
  let context: Awaited<ReturnType<typeof startAnchor>>;
  let provider: BankrunProvider;
  let program: Program;
  let programId: PublicKey;
  let devFund: Keypair;
  let releaseDest: Keypair;
  let configPda: PublicKey;

  before(async () => {
    context = await startAnchor(".", [], []);
    provider = new BankrunProvider(context);
    anchor.setProvider(provider as any);
    program = anchor.workspace.VfSolanaVault as Program;
    programId = program.programId;
    devFund = Keypair.generate();
    releaseDest = Keypair.generate();
    // Fund accounts
    for (const kp of [devFund, releaseDest]) {
      const info = await context.banksClient.getAccount(provider.wallet.publicKey);
      // airdrop via setAccount
      context.setAccount(kp.publicKey, {
        lamports: BigInt(10 * LAMPORTS_PER_SOL),
        data: Buffer.alloc(0),
        owner: SystemProgram.programId,
        executable: false,
      });
    }
    [configPda] = PublicKey.findProgramAddressSync([SEED_CONFIG], programId);
    await program.methods
      .initialize(devFund.publicKey)
      .accounts({
        authority: provider.wallet.publicKey,
        config: configPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  });

  it("hold: release before maturity fails and funds stay", async () => {
    const lockId = "hold-release-001";
    const lockIdHash = hashLockId(lockId);
    const [lockPda] = PublicKey.findProgramAddressSync([SEED_LOCK, lockIdHash], programId);
    const [haPda] = PublicKey.findProgramAddressSync(
      [SEED_HANDSHAKE, provider.wallet.publicKey.toBuffer()],
      programId,
    );
    const gross = new BN(1_000_000);
    const fee = gross.muln(STANDARD_FEE_BPS).divn(10000);
    const principal = gross.sub(fee);
    assert.equal(fee.toNumber(), 50_000);
    assert.equal(principal.toNumber(), 950_000);

    const devBefore = await context.banksClient.getBalance(devFund.publicKey);

    await program.methods
      .commitVaultLockNative({
        lockId,
        lockIdHash: [...lockIdHash],
        grossAmount: gross,
        durationSecs: new BN(STANDARD_DURATION),
        baseRecipient: Buffer.alloc(20, 1),
        releaseDestination: releaseDest.publicKey,
        outputToken: { vclm: {} },
        verifiedGrossUsdMicro: new BN(STANDARD_USD_MIN),
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

    const lock = await program.account.lockRecord.fetch(lockPda);
    assert.equal(lock.feeAmount.toString(), "50000");
    assert.equal(lock.principalAmount.toString(), "950000");
    assert.equal(lock.released, false);

    const devAfter = await context.banksClient.getBalance(devFund.publicKey);
    assert.equal(devAfter - devBefore, 50_000n);

    const lockBal = await context.banksClient.getBalance(lockPda);
    assert.ok(lockBal >= 950_000n, "principal held in lock PDA");

    let earlyFailed = false;
    try {
      await program.methods
        .releasePrincipalNative(lockId, [...lockIdHash])
        .accounts({
          caller: provider.wallet.publicKey,
          config: configPda,
          lockRecord: lockPda,
          releaseDestination: releaseDest.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    } catch (e: any) {
      earlyFailed = /NotMatured|custom program error|Error/i.test(String(e) + (e.logs || []).join("\n"));
      if (!earlyFailed) throw e;
    }
    assert.ok(earlyFailed, "release before maturity must throw");

    const lock2 = await program.account.lockRecord.fetch(lockPda);
    assert.equal(lock2.released, false);
    const lockBal2 = await context.banksClient.getBalance(lockPda);
    assert.equal(lockBal2, lockBal, "funds stay after failed early release");
  });

  it("release: after maturity pays 950000 once; second release fails", async () => {
    const lockId = "hold-release-001";
    const lockIdHash = hashLockId(lockId);
    const [lockPda] = PublicKey.findProgramAddressSync([SEED_LOCK, lockIdHash], programId);
    const lock = await program.account.lockRecord.fetch(lockPda);

    const clock = await context.banksClient.getClock();
    context.setClock(
      new Clock(
        clock.slot,
        clock.epochStartTimestamp,
        clock.epoch,
        clock.leaderScheduleEpoch,
        BigInt(Number(lock.maturityTimeSecs) + 1),
      ),
    );

    const destBefore = await context.banksClient.getBalance(releaseDest.publicKey);

    await program.methods
      .releasePrincipalNative(lockId, [...lockIdHash])
      .accounts({
        caller: provider.wallet.publicKey,
        config: configPda,
        lockRecord: lockPda,
        releaseDestination: releaseDest.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const updated = await program.account.lockRecord.fetch(lockPda);
    assert.equal(updated.released, true);
    const destAfter = await context.banksClient.getBalance(releaseDest.publicKey);
    assert.equal(destAfter - destBefore, 950_000n, "bound destination receives 950000 once");

    let secondFailed = false;
    try {
      await program.methods
        .releasePrincipalNative(lockId, [...lockIdHash])
        .accounts({
          caller: provider.wallet.publicKey,
          config: configPda,
          lockRecord: lockPda,
          releaseDestination: releaseDest.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    } catch (e: any) {
      secondFailed = /AlreadyReleased|Error/i.test(String(e));
      if (!secondFailed) throw e;
    }
    assert.ok(secondFailed, "second release must throw");
  });
});
