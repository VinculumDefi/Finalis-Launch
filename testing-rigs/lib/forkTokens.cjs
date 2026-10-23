// Funds a real token balance on a LOCAL fork by finding the balance mapping
// slot (Solidity or Vyper layout) and writing it with hardhat_setStorageAt.
// Local fork state only.
const { ethers, network } = require("./common.cjs");
const ERC20 = [
  "function balanceOf(address) view returns (uint256)", "function approve(address,uint256)",
  "function allowance(address,address) view returns (uint256)", "function transfer(address,uint256)",
  "function decimals() view returns (uint8)", "function totalSupply() view returns (uint256)",
];
async function findBalanceSlot(token, probe, maxSlot = 120) {
  const c = new ethers.Contract(token, ERC20, ethers.provider);
  const mark = 0x1234567n * 10n ** 9n;
  for (let i = 0; i < maxSlot; i++) {
    for (const key of [
      ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [probe, i])),
      ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["uint256", "address"], [i, probe])),
    ]) {
      const prev = await ethers.provider.getStorage(token, key);
      await network.provider.send("hardhat_setStorageAt", [token, key, ethers.toBeHex(mark, 32)]);
      let bal = 0n;
      try { bal = await c.balanceOf(probe); } catch {}
      await network.provider.send("hardhat_setStorageAt", [token, key, prev]);
      if (bal !== 0n && bal !== BigInt(prev)) return { slot: i, keyOf: (who) => keyFor(key === ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [probe, i])), i, who), raw: bal === mark };
    }
  }
  return null;
}
function keyFor(solidity, i, who) {
  const c = ethers.AbiCoder.defaultAbiCoder();
  return ethers.keccak256(solidity ? c.encode(["address", "uint256"], [who, i]) : c.encode(["uint256", "address"], [i, who]));
}
// Sets the raw storage word. For tokens whose balanceOf is not raw storage
// (AMPL gons, stETH shares) the caller uses another route.
async function setBalance(token, who, amount) {
  const s = await findBalanceSlot(token, who);
  if (!s) throw new Error("balance slot not found for " + token.slice(0, 6));
  await network.provider.send("hardhat_setStorageAt", [token, s.keyOf(who), ethers.toBeHex(amount, 32)]);
  return s;
}
// Moves real tokens from an existing holder (impersonated, local fork only).
async function fromHolder(token, holder, to, amount) {
  await network.provider.send("hardhat_impersonateAccount", [holder]);
  await network.provider.send("hardhat_setBalance", [holder, "0x56BC75E2D63100000"]);
  const s = await ethers.getSigner(holder);
  const c = new ethers.Contract(token, ERC20, s);
  await (await c.transfer(to, amount)).wait();
  await network.provider.send("hardhat_stopImpersonatingAccount", [holder]);
}
module.exports = { ERC20, findBalanceSlot, setBalance, fromHolder };
