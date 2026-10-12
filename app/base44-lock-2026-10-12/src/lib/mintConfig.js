// Source: VinculumDefi/Finalis-Launch cf7e577, base-contracts/contracts.
import { ethers } from "ethers";
export const PROOF_TUPLE = "tuple(string sourceEnvironmentId, bytes32 commitmentVaultLockId, string handshakeIdentity, uint8 handshakeAllowanceCount, bytes32 canonicalAssetId, uint8 assetPrecision, uint8 assetCustodyClass, uint256 grossAmountSmallestUnits, uint256 actualFeeAmountSmallestUnits, uint256 principalAmountSmallestUnits, bytes32 feeAssetId, string devFundDestination, bytes32 feeTransferEvidence, uint256 valuationTimestamp, uint256 maturityTimestamp, uint256 durationSecs, uint8 selectedOutputToken, address baseRecipient, string releaseDestination, bytes chonxActivationReceipt, bytes32 racIdentity, bytes priceRecord, bytes sourceFinalityProof, bytes lockEventProof)";
export const VERIFIER_ABI = [
  `function recordFeeAndRac(${PROOF_TUPLE} pkg)`,
  `function verifyAndMint(${PROOF_TUPLE} pkg, uint256 daysSinceLaunch) returns (bool)`,
  "function configurationFinalized() view returns (bool)",
  "function chainVerifiers(string) view returns (address)",
  "function assetPrecisionTable(bytes32) view returns (bytes32 canonicalAssetId, string symbol, uint8 decimals, uint8 custodyClass, uint8 custodyPath)",
  "function scheduledPrices(bytes32) view returns (uint256 priceUsd18, bool usable)",
  "function vclmToken() view returns (address)",
  "function chonxToken() view returns (address)",
  "function protocolLaunchTimestamp() view returns (uint256)",
  "event VerificationSucceeded(bytes32 indexed lockIdHash, string sourceEnvironmentId, address indexed recipient, uint8 outputToken, uint256 amount)",
];
export const LOCK_RECORD_ABI = [
  "function environmentId() view returns (string)",
  "function devFund() view returns (address)",
  "function lockRecord(bytes32) view returns (tuple(bool exists, bool released, address creator, address releaseDestination, address asset, address baseRecipient, uint8 outputToken, uint256 gross, uint256 fee, uint256 principal, uint256 duration, uint256 multiplierBps, uint256 createdAt, uint256 maturity, bytes32 assetIdentity, bytes32 valuationReference, bytes bindingPayload))",
  "event FeeRouted(bytes32 indexed lockId, address indexed devFund, address asset, uint256 fee)",
];
export const mintInterface = new ethers.Interface(VERIFIER_ABI);
export const lockRecordInterface = new ethers.Interface(LOCK_RECORD_ABI);