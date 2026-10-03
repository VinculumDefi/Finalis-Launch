//! Hold and release against the built vf_solana_vault BPF program.
//! Gross 1_000_000 => fee 50_000, principal 950_000. No skips.
use sha2::{Digest, Sha256};
use solana_program_test::*;
use solana_sdk::{
    clock::Clock,
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    signature::{Keypair, Signer},
    system_program,
    transaction::Transaction,
};
use std::path::PathBuf;

const PROGRAM_ID: &str = "E96mDgb9EjCKyxhrUPtDtAQ7Kp2bpkQW7foJDYxnVv1s";
const GROSS: u128 = 1_000_000;
const FEE: u128 = 50_000;
const PRINCIPAL: u128 = 950_000;
const DURATION: u64 = 7 * 24 * 60 * 60;
const USD: u128 = 10_000_000_000_000_000_000; // $10.00 * 10^18

fn disc(bytes: &[u8]) -> [u8; 8] {
    bytes.try_into().unwrap()
}

fn pda(seeds: &[&[u8]], program: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(seeds, program).0
}

fn push_str(buf: &mut Vec<u8>, s: &str) {
    buf.extend_from_slice(&(s.len() as u32).to_le_bytes());
    buf.extend_from_slice(s.as_bytes());
}

fn push_u128(buf: &mut Vec<u8>, v: u128) {
    buf.extend_from_slice(&v.to_le_bytes());
}

fn push_u64(buf: &mut Vec<u8>, v: u64) {
    buf.extend_from_slice(&v.to_le_bytes());
}

#[tokio::main]
async fn main() {
    let program_id: Pubkey = PROGRAM_ID.parse().unwrap();
    let so = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../target/deploy/vf_solana_vault.so");
    assert!(so.exists(), "missing {}", so.display());

    let deploy = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../target/deploy");
    std::env::set_var("BPF_OUT_DIR", &deploy);
    std::env::set_var("SBF_OUT_DIR", &deploy);
    let mut pt = ProgramTest::default();
    pt.add_program("vf_solana_vault", program_id, None);
    // ProgramTest searches upward for target/deploy. Also prefer explicit path via env.
    let mut context = pt.start_with_context().await;

    let payer = context.payer.insecure_clone();
    let dev_fund = Keypair::new();
    let release = Keypair::new();
    // Ensure destination accounts exist so lamport credits land.
    for kp in [&dev_fund, &release] {
        let ix = system_instruction_create(&payer, kp, 1_000_000);
        send(&mut context, &[ix], &[kp]).await;
    }

    let config = pda(&[b"vf_config"], &program_id);
    let init = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new(config, false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data: {
            let mut d = disc(&[175, 175, 109, 31, 13, 152, 155, 237]).to_vec();
            d.extend_from_slice(&dev_fund.pubkey().to_bytes());
            d
        },
    };
    send(&mut context, &[init], &[]).await;
    println!("PASS: initialize");

    let lock_id = "hold-release-001";
    let lock_hash: [u8; 32] = Sha256::digest(lock_id.as_bytes()).into();
    let lock_pda = pda(&[b"vf_lock", &lock_hash], &program_id);
    let handshake = pda(&[b"vf_handshake", payer.pubkey().as_ref()], &program_id);

    let dev_before = context.banks_client.get_balance(dev_fund.pubkey()).await.unwrap();
    let lock_before = context.banks_client.get_balance(lock_pda).await.unwrap();

    let mut data = disc(&[61, 10, 178, 228, 100, 202, 76, 207]).to_vec();
    push_str(&mut data, lock_id);
    data.extend_from_slice(&lock_hash);
    push_u128(&mut data, GROSS);
    push_u64(&mut data, DURATION);
    data.extend_from_slice(&[1u8; 20]);
    data.extend_from_slice(&release.pubkey().to_bytes());
    data.push(0u8); // OutputToken::Vclm
    push_u128(&mut data, USD);
    push_str(&mut data, "not_applicable");

    let commit = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new_readonly(config, false),
            AccountMeta::new(lock_pda, false),
            AccountMeta::new(handshake, false),
            AccountMeta::new(dev_fund.pubkey(), false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data,
    };
    send(&mut context, &[commit], &[]).await;

    let dev_after = context.banks_client.get_balance(dev_fund.pubkey()).await.unwrap();
    let lock_after = context.banks_client.get_balance(lock_pda).await.unwrap();
    assert_eq!(dev_after - dev_before, FEE as u64, "dev fund received 5%");
    assert!(lock_after >= lock_before + PRINCIPAL as u64, "lock holds principal");
    println!("PASS: lock fee 50000 principal held");

    let release_ix = |dest: Pubkey| Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new_readonly(config, false),
            AccountMeta::new(lock_pda, false),
            AccountMeta::new(dest, false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data: {
            let mut d = disc(&[37, 56, 43, 227, 99, 79, 77, 177]).to_vec();
            push_str(&mut d, lock_id);
            d.extend_from_slice(&lock_hash);
            d
        },
    };

    let early = send_result(&mut context, &[release_ix(release.pubkey())], &[]).await;
    assert!(early.is_err(), "release before maturity must fail, got {early:?}");
    let lock_still = context.banks_client.get_balance(lock_pda).await.unwrap();
    assert_eq!(lock_still, lock_after, "funds stay after early release");
    println!("PASS: early release failed and funds stayed");

    let mut clock: Clock = context.banks_client.get_sysvar().await.unwrap();
    // maturity = creation + duration; jump well past maturity.
    clock.unix_timestamp = clock.unix_timestamp.saturating_add(DURATION as i64 + 86_400);
    context.set_sysvar(&clock);
    // Advance a slot so the new clock is observed by the next transaction.
    let slot = context.banks_client.get_root_slot().await.unwrap();
    context.warp_to_slot(slot + 2).expect("warp");

    let dest_before = context.banks_client.get_balance(release.pubkey()).await.unwrap();
    send(&mut context, &[release_ix(release.pubkey())], &[]).await;
    let dest_after = context.banks_client.get_balance(release.pubkey()).await.unwrap();
    assert_eq!(dest_after - dest_before, PRINCIPAL as u64, "released 950000 once");
    println!("PASS: release 950000 to bound destination");

    // New blockhash/slot so the second attempt is a distinct transaction.
    let slot = context.banks_client.get_root_slot().await.unwrap();
    context.warp_to_slot(slot + 1).expect("warp2");
    let second = send_result(&mut context, &[release_ix(release.pubkey())], &[]).await;
    assert!(second.is_err(), "second release must fail, got {second:?}");
    let dest_final = context.banks_client.get_balance(release.pubkey()).await.unwrap();
    assert_eq!(dest_final, dest_after, "second release did not move funds");
    println!("PASS: second release failed");
    println!("SOLANA_HOLD_RELEASE_OK");
}

fn system_instruction_create(payer: &Keypair, dest: &Keypair, lamports: u64) -> Instruction {
    solana_sdk::system_instruction::create_account(
        &payer.pubkey(),
        &dest.pubkey(),
        lamports,
        0,
        &system_program::id(),
    )
}

async fn send(ctx: &mut ProgramTestContext, ixs: &[Instruction], extra: &[&Keypair]) {
    send_result(ctx, ixs, extra).await.expect("transaction failed");
}

async fn send_result(
    ctx: &mut ProgramTestContext,
    ixs: &[Instruction],
    extra: &[&Keypair],
) -> Result<(), BanksClientError> {
    let bh = ctx.banks_client.get_latest_blockhash().await.unwrap();
    let mut tx = Transaction::new_with_payer(ixs, Some(&ctx.payer.pubkey()));
    let mut signers: Vec<&Keypair> = vec![&ctx.payer];
    signers.extend(extra.iter().copied());
    tx.sign(&signers, bh);
    ctx.banks_client.process_transaction(tx).await
}
