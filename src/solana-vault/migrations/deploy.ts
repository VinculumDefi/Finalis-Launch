// =============================================================================
// Deployment script for the Vinculum Finalis Solana Commitment Vault Lock.
//
// This script is run via `anchor deploy` after `anchor build`.
// The Dev Fund destination is a DEFERRED EXTERNAL INPUT (VF-DEP-001) —
// it must be supplied by the deployer and is fixed permanently after initialization.
// =============================================================================

import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.VfSolanaVault;

  // --- VF-DEP-001: Dev Fund destination ---
  // This MUST be a real Solana address controlled by the protocol treasury.
  // It is set once and cannot be changed (config PDA is init-only).
  //
  // REPLACE WITH THE REAL DEV FUND ADDRESS BEFORE DEPLOYING:
  const DEV_FUND_ADDRESS = process.env.VF_DEV_FUND_ADDRESS;

  if (!DEV_FUND_ADDRESS) {
    console.error("ERROR: Set VF_DEV_FUND_ADDRESS environment variable before deploying.");
    console.error("This is a permanent, immutable deployment gate (VF-DEP-001/002).");
    process.exit(1);
  }

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vf_config")],
    program.programId,
  );

  console.log("Program ID:", program.programId.toBase58());
  console.log("Config PDA:", configPda.toBase58());
  console.log("Dev Fund destination:", DEV_FUND_ADDRESS);

  // Verify the config doesn't already exist
  const configInfo = await provider.connection.getAccountInfo(configPda);
  if (configInfo) {
    console.error("ERROR: Config already initialized. VF-DEP-002: config is immutable.");
    process.exit(1);
  }

  console.log("\nInitializing program...");
  const tx = await program.methods
    .initialize(new anchor.web3.PublicKey(DEV_FUND_ADDRESS))
    .accounts({
      authority: provider.wallet.publicKey,
      config: configPda,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();

  console.log("Initialize transaction:", tx);
  console.log("\n✓ Program initialized. Dev Fund destination is permanently bound.");
  console.log("✓ VF-DEP-002: Config is immutable — cannot be re-initialized.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});