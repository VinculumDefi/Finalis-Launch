import { ethers } from "ethers";
import { CONTRACTS, ERC20_ABI } from "@/lib/protocolConfig";
import { VERIFIER_ABI, LOCK_RECORD_ABI, mintInterface, lockRecordInterface } from "@/lib/mintConfig";

export async function readMintContext(provider, asset) {
  const network = await provider.getNetwork();
  if (network.chainId !== 8453n) throw new Error("Switch to Base before locking.");
  const verifier = new ethers.Contract(CONTRACTS.verifier, VERIFIER_ABI, provider);
  const code = await provider.getCode(CONTRACTS.verifier);
  for (const [name, selector] of [["recordFeeAndRac", "0x489c7d2f"], ["verifyAndMint", "0x24816c7f"]]) {
    if (mintInterface.getFunction(name).selector !== selector || !code.includes(`63${selector.slice(2)}`)) throw new Error(`Verifier ABI mismatch: ${name} is unavailable. No transaction was sent.`);
  }
  const lock = new ethers.Contract(CONTRACTS.lock, LOCK_RECORD_ABI, provider);
  if (await lock.environmentId() !== "Base") throw new Error("Lock contract is not configured for Base.");
  if (!await verifier.configurationFinalized()) throw new Error("Verifier configuration is not finalized.");
  const chainAddress = await verifier.chainVerifiers("Base");
  if (chainAddress.toLowerCase() !== CONTRACTS.baseReader.toLowerCase()) throw new Error("The verifier must use the configured Base lock reader. No funds will be locked.");
  const chain = new ethers.Contract(CONTRACTS.baseReader, ["function ENVIRONMENT_ID() view returns(string)", "function vault() view returns(address)"], provider);
  if (await chain.ENVIRONMENT_ID() !== "Base" || (await chain.vault()).toLowerCase() !== CONTRACTS.lock.toLowerCase()) throw new Error("The Base reader must read the existing Base lock. No funds will be locked.");
  const [vclm, chonx, launchTimestamp] = await Promise.all([verifier.vclmToken(), verifier.chonxToken(), verifier.protocolLaunchTimestamp()]);
  if (vclm.toLowerCase() !== CONTRACTS.vclm.toLowerCase() || chonx.toLowerCase() !== CONTRACTS.chonx.toLowerCase()) throw new Error("Verifier token addresses do not match the new protocol tokens. No funds will be locked.");
  if (launchTimestamp === 0n) throw new Error("Verifier launch timestamp is unavailable. No funds will be locked.");
  const key = ethers.solidityPackedKeccak256(["string", "bytes32"], ["Base", asset.assetIdentity]);
  const entry = await verifier.assetPrecisionTable(key);
  if (entry.canonicalAssetId !== asset.assetIdentity || Number(entry.decimals) !== asset.decimals) throw new Error("Mint unavailable: asset registry or precision mismatch. No funds will be locked.");
  const price = await verifier.scheduledPrices(key);
  if (!price.usable || price.priceUsd18 === 0n) throw new Error("No usable scheduled price. No funds will be locked.");
  return { entry, price: price.priceUsd18, launchTimestamp };
}

export function scheduledGrossUsd(amount, decimals, price) {
  return ((amount * 10n ** 18n) / (10n ** BigInt(decimals)) * price) / 10n ** 18n;
}

export async function mintFromLock({ provider, account, lockId, receipt, onStep, onTransaction, onMinted }) {
  if (receipt.status !== 1 || receipt.to?.toLowerCase() !== "0x968bfd5b580144b4398c10bb1e61bd8a6b1ac946") throw new Error("Lock was not confirmed on the reader-bound vault. Mint was not sent.");
  const lock = new ethers.Contract("0x968BFD5b580144b4398C10BB1E61bD8A6B1aC946", LOCK_RECORD_ABI, provider);
  const record = await lock.lockRecord(lockId, { blockTag: receipt.blockNumber });
  if (!record.exists || record.released || record.outputToken !== 0n || record.baseRecipient === ethers.ZeroAddress) throw new Error("Confirmed lock record is not eligible for VCLM minting.");
  const feeLog = receipt.logs.find(log => log.address.toLowerCase() === String(lock.target).toLowerCase() && log.topics[0] === lockRecordInterface.getEvent("FeeRouted").topicHash && log.topics[1] === lockId);
  if (!feeLog) throw new Error("The lock receipt has no matching fee-routing evidence.");
  const feeEvent = lockRecordInterface.parseLog(feeLog);
  const devFund = await lock.devFund();
  if (feeEvent.args.devFund !== devFund || feeEvent.args.fee !== record.fee) throw new Error("Fee-routing evidence does not match the stored lock.");
  const encode = ethers.AbiCoder.defaultAbiCoder();
  const pkg = {
    sourceEnvironmentId: "Base", commitmentVaultLockId: lockId,
    handshakeIdentity: `(Base, ${record.creator})`, handshakeAllowanceCount: 3,
    canonicalAssetId: record.assetIdentity, assetPrecision: 18, assetCustodyClass: 2,
    grossAmountSmallestUnits: record.gross, actualFeeAmountSmallestUnits: record.fee, principalAmountSmallestUnits: record.principal, feeAssetId: record.assetIdentity,
    devFundDestination: devFund, feeTransferEvidence: receipt.hash,
    valuationTimestamp: record.createdAt, maturityTimestamp: record.maturity, durationSecs: record.duration,
    selectedOutputToken: record.outputToken, baseRecipient: record.baseRecipient, releaseDestination: record.releaseDestination, chonxActivationReceipt: "0x",
    racIdentity: ethers.solidityPackedKeccak256(["string", "bytes32", "bytes32", "uint256", "bytes32", "uint256"], ["Base", lockId, receipt.hash, feeLog.index, record.assetIdentity, record.fee]),
    // Optional priceRecord omitted: the verifier binds its scheduled price itself.
    priceRecord: "0x",
    sourceFinalityProof: encode.encode(["bytes32", "uint256", "uint8", "uint256", "bool", "bool"], [receipt.blockHash, receipt.blockNumber, 6, 0, false, false]),
    lockEventProof: encode.encode(["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"], [lockId, record.gross, record.fee, record.principal, record.duration, record.createdAt, record.maturity]),
  };
  const signer = await provider.getSigner();
  if ((await signer.getAddress()).toLowerCase() !== account.toLowerCase()) throw new Error("Wallet changed after locking. No mint transaction was sent.");
  const verifier = new ethers.Contract("0xb0670826b79e29cc6a1c216Eb396D383a54af47D", VERIFIER_ABI, signer);
  onStep("recording");
  const feeTx = await verifier.recordFeeAndRac(pkg);
  onTransaction("Fee and RAC", feeTx.hash);
  const feeReceipt = await feeTx.wait();
  if (feeReceipt.status !== 1) throw new Error("Fee and RAC recording failed; mint was not sent.");
  onStep("minting");
  // The proof package is built once from the confirmed lock record. recordFeeAndRac and
  // verifyAndMint must receive the exact same object. If verifyAndMint reverts with
  // VF-FEE-011 (fee/RAC mismatch), retry with the same stored package — do not rebuild it,
  // and do not create another lock.
  const attemptMint = async () => {
    const mintTx = await verifier.verifyAndMint(pkg, 0);
    onTransaction("Mint", mintTx.hash);
    return mintTx.wait();
  };
  const isFeeMismatch = (e) => {
    const text = [e?.shortMessage, e?.reason, e?.message, e?.data?.message, JSON.stringify(e?.data || {})].join(" ");
    return /VF-FEE-011/i.test(text);
  };
  let mintReceipt;
  try {
    mintReceipt = await attemptMint();
  } catch (e) {
    if (!isFeeMismatch(e)) throw e;
    mintReceipt = await attemptMint();
  }
  if (mintReceipt.status !== 1) throw new Error("Mint transaction failed.");
  const lockIdHash = ethers.solidityPackedKeccak256(["string", "bytes32"], ["Base", lockId]);
  const successLog = mintReceipt.logs.find(log => log.address.toLowerCase() === String(verifier.target).toLowerCase() && log.topics[0] === mintInterface.getEvent("VerificationSucceeded").topicHash && log.topics[1] === lockIdHash);
  if (!successLog) throw new Error("No mint confirmation event was found for this lock.");
  const success = mintInterface.parseLog(successLog);
  if (success.args.recipient.toLowerCase() !== record.baseRecipient.toLowerCase() || success.args.sourceEnvironmentId !== "Base" || success.args.outputToken !== record.outputToken || success.args.amount <= 0n) throw new Error("Mint confirmation does not match the stored recipient and token.");
  const transfers = new ethers.Interface(["event Transfer(address indexed from, address indexed to, uint256 value)"]);
  const received = mintReceipt.logs
    .filter(log => log.address.toLowerCase() === "0x655273f8f5d74f7d5b5c4e1b947ae4ed763df305" && log.topics[0] === transfers.getEvent("Transfer").topicHash)
    .map(log => transfers.parseLog(log).args)
    .filter(transfer => transfer.from === ethers.ZeroAddress && transfer.to.toLowerCase() === record.baseRecipient.toLowerCase())
    .reduce((total, transfer) => total + transfer.value, 0n);
  if (received !== success.args.amount) throw new Error("VCLM arrival at the stored baseRecipient was not confirmed. Mint success cannot be reported.");
  const amount = ethers.formatUnits(received, 18);
  onMinted({ amount, recipient: record.baseRecipient, balance: null });
  // Delivery is confirmed by the VCLM mint Transfer, not by an existing wallet balance.
  try {
    const token = new ethers.Contract("0x655273f8f5d74f7D5b5C4E1B947AE4ed763Df305", ERC20_ABI, provider);
    onMinted({ amount, recipient: record.baseRecipient, balance: ethers.formatUnits(await token.balanceOf(record.baseRecipient), 18) });
  } catch { onMinted({ amount, recipient: record.baseRecipient, balance: null }); }
}