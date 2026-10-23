// Builds the SolanaAttestedLockReader proof from checker facts and signs it
// with TEST attester wallets. TEST ONLY.
"use strict";
const path = require("path");
const { ethers } = require(path.join(__dirname, "../../base-contracts/node_modules/ethers"));
const W = require("./solanaWire.cjs");

const LOCK_TUPLE = "tuple(bytes txSignature,uint64 slot,bytes32 blockhash,uint64 blockTime,string lockIdString,bytes32 depositor,bytes32 assetMint,uint256 grossAmount,uint256 feeAmount,uint256 principalAmount,uint256 durationSecs,uint256 maturityTimestamp,address baseRecipient,bytes32 releaseDestination,uint8 outputToken,uint256 verifiedGrossUsd18)";
const hex32 = (b58s) => "0x" + W.unb58(b58s).toString("hex");

function lockStruct(f) {
  return {
    txSignature: "0x" + W.unb58(f.signature).toString("hex"), slot: BigInt(f.slot), blockhash: hex32(f.blockhash),
    blockTime: BigInt(f.blockTime), lockIdString: f.lockId, depositor: hex32(f.depositor),
    assetMint: f.asset === "SOL" ? ethers.ZeroHash : hex32(f.asset), grossAmount: BigInt(f.grossAmount),
    feeAmount: BigInt(f.feeAmount), principalAmount: BigInt(f.principalAmount), durationSecs: BigInt(f.durationSecs),
    maturityTimestamp: BigInt(f.maturity), baseRecipient: ethers.getAddress(f.baseRecipient),
    releaseDestination: hex32(f.releaseDestination), outputToken: Number(f.outputToken), verifiedGrossUsd18: BigInt(f.verifiedGrossUsd18),
  };
}
const encodeLock = (s) => ethers.AbiCoder.defaultAbiCoder().encode([LOCK_TUPLE], [s]);

function digest(chainId, reader, genesisHashB58, programIdB58, proof) {
  const typehash = ethers.id("VinculumSolanaLockAttestation(uint256 baseChainId,address reader,bytes32 genesisHash,bytes32 programId,bytes32 lockHash)");
  return ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "uint256", "address", "bytes32", "bytes32", "bytes32"],
    [typehash, chainId, reader, hex32(genesisHashB58), hex32(programIdB58), ethers.keccak256(proof)]));
}
// Signatures sorted by signer address, ascending, as the reader requires.
async function attest(wallets, inner) {
  const signed = await Promise.all(wallets.map(async (w) => ({ a: w.address.toLowerCase(), s: await w.signMessage(ethers.getBytes(inner)) })));
  signed.sort((x, y) => (x.a < y.a ? -1 : 1));
  return ethers.AbiCoder.defaultAbiCoder().encode(["bytes[]"], [signed.map((x) => x.s)]);
}

module.exports = { LOCK_TUPLE, lockStruct, encodeLock, digest, attest, hex32 };
