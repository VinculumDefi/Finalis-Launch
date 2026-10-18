// Base ceremony flow. base.html runs it in the browser (MetaMask signer); the
// Hardhat test runs the SAME code on the in-process test chain. Nothing here
// holds a key. Order (all before finalize, which is final):
//   lock -> VCLM -> CHONX -> Verifier -> Forge -> Stake
//   -> VCLM.initialize(Verifier, Stake)  (Stake on from the start)
//   -> CHONX.initialize(Verifier, 0)
//   -> 15 readers deployed and registered: Base, 6 EVM (bound to the NEW
//      non-Base 5% locks typed into the page), 6 UTXO, Stellar, XRP Ledger.
//      Solana is not registered.
//   -> registry (batches of 50, 961 rows + Base ETH) -> Dev Fund for the 7 EVM
//      chains -> poster = this wallet, price run 1, read usable
//   -> poster handed to the live poster -> finalize.
(function (root) {
  const BATCH = 50;
  const EVM_ENVS = ["Ethereum", "Arbitrum", "Optimism", "Polygon", "BNB Smart Chain", "Avalanche"];

  function checkInputs(ethers, data, newLocks, me) {
    if (!data.devFund || !data.row2 || !Array.isArray(data.entries) || !data.priceUsd18) throw new Error("ceremony data incomplete. Nothing was sent.");
    if (BigInt(data.priceUsd18) <= 0n) throw new Error("scheduled ETH price is not positive. Nothing was sent.");
    if (!data.readers || data.readers.evm.length !== 6 || data.readers.utxo.length !== 6 || !data.readers.stellar || !data.readers.xrpl)
      throw new Error("reader wiring incomplete. Nothing was sent.");
    if (!data.scheduledPricePoster || !ethers.isAddress(data.scheduledPricePoster)) throw new Error("live price poster missing from ceremony-data.json. Nothing was sent.");
    const livePoster = ethers.getAddress(data.scheduledPricePoster);
    const old = (data.oldLocks || []).map((a) => a.toLowerCase());
    if (livePoster === ethers.ZeroAddress) throw new Error("live price poster is zero. Nothing was sent.");
    if (livePoster === ethers.getAddress(me)) throw new Error("live price poster equals the connected wallet. Nothing was sent.");
    if (livePoster === ethers.getAddress(data.devFund)) throw new Error("live price poster equals the Dev Fund. Nothing was sent.");
    if (old.includes(livePoster.toLowerCase())) throw new Error("live price poster is an old contract. Nothing was sent.");
    const locks = {};
    for (const env of EVM_ENVS) {
      const a = newLocks && newLocks[env];
      if (!a || !ethers.isAddress(a)) throw new Error("new " + env + " lock address missing or invalid. Nothing was sent.");
      const g = ethers.getAddress(a);
      if (g === ethers.ZeroAddress) throw new Error("new " + env + " lock is zero. Nothing was sent.");
      if (old.includes(g.toLowerCase())) throw new Error("new " + env + " lock is an old 2.5% lock. Nothing was sent.");
      if (g === livePoster || g === ethers.getAddress(data.devFund) || g === ethers.getAddress(me)) throw new Error("new " + env + " lock clashes with the poster, Dev Fund or wallet. Nothing was sent.");
      // Same deployer + same nonce on two chains can legitimately give the same
      // address, so duplicates are allowed across chains; only shape is checked.
      locks[env] = g;
    }
    return { livePoster, locks };
  }

  async function runBaseCeremony({ ethers, signer, art, data, newLocks, log = () => {} }) {
    const me = await signer.getAddress();
    const { livePoster, locks } = checkInputs(ethers, data, newLocks, me);
    const priceUsd18 = BigInt(data.priceUsd18);
    const dep = async (name, args) => {
      const c = await new ethers.ContractFactory(art[name].abi, art[name].bytecode, signer).deploy(...args);
      await c.waitForDeployment();
      return c;
    };
    const at = (c) => c.getAddress();
    const old = (data.oldLocks || []).map((a) => a.toLowerCase());

    const lock = await dep("CommitmentVaultLock", ["Base", data.devFund]);
    if ((await lock.STANDARD_FEE_BPS()) !== 500n) throw new Error("lock fee is not 5%");
    log("Base lock " + await at(lock));
    const vclm = await dep("TokenVCLM", ["Vinculum Finalis VCLM", "VCLM", 10000000000n * 10n ** 18n]);
    const rc = await vclm.deploymentTransaction().wait();
    const launch = BigInt((await signer.provider.getBlock(rc.blockNumber)).timestamp);
    const chonx = await dep("TokenCHONX", ["Vinculum Finalis CHONX", "CHONX", 100000000000n * 10n ** 18n]);
    const verifier = await dep("VinculumFinalisVerifier", [await at(vclm), await at(chonx)]);
    if (old.includes((await at(verifier)).toLowerCase())) throw new Error("verifier address is an old contract");
    if ((await verifier.BASE_NATIVE_ETH_ASSET_ID()).toLowerCase() !== data.row2.canonicalAssetId.toLowerCase()) throw new Error("Verifier BASE_NATIVE_ETH_ASSET_ID differs from registry row 2");
    const forge = await dep("VinculumFinalisSynth", [await at(verifier), await at(vclm), await at(chonx)]);
    const stake = await dep("VinculumFinalisStake", [await at(vclm), await at(chonx), await at(forge), await at(verifier), launch]);
    log("VCLM " + await at(vclm) + "\nCHONX " + await at(chonx) + "\nVerifier " + await at(verifier) + "\nForge " + await at(forge) + "\nStake " + await at(stake));
    await (await vclm.initialize(await at(verifier), await at(stake))).wait(); // Stake on from the start
    await (await chonx.initialize(await at(verifier), ethers.ZeroAddress)).wait();

    // Readers: Base + 14 others, with live Dev Fund wiring.
    const readers = {};
    readers.Base = await dep("BaseLockRecordVerifier", [await at(lock)]);
    for (const r of data.readers.evm) readers[r.env] = await dep(r.contract, [locks[r.env]]);
    for (const r of data.readers.utxo) readers[r.env] = await dep(r.contract, [r.devFundScript]);
    readers[data.readers.stellar.env] = await dep(data.readers.stellar.contract, [data.readers.stellar.networkId, data.readers.stellar.devFundKey]);
    readers[data.readers.xrpl.env] = await dep(data.readers.xrpl.contract, [data.readers.xrpl.devFundAccount]);
    if (Object.keys(readers).length !== 15 || readers.Solana) throw new Error("reader set is not the 15 expected");
    for (const [env, r] of Object.entries(readers)) {
      await (await verifier.registerChainVerifier(env, await at(r))).wait();
      if ((await verifier.chainVerifiers(env)) !== await at(r)) throw new Error(env + " reader read-back failed");
      log("reader " + env + " " + await at(r));
    }

    const items = data.entries.map((e) => ({ environmentId: e.environmentId, canonicalAssetId: e.canonicalAssetId, symbol: e.symbol, decimals: e.decimals, custodyClass: e.custodyClass, custodyPath: e.custodyPath }));
    items.push({ environmentId: "Base", canonicalAssetId: data.row2.canonicalAssetId, symbol: data.row2.symbol, decimals: data.row2.decimals, custodyClass: data.row2.custodyClass, custodyPath: data.row2.custodyPath });
    for (let i = 0; i < items.length; i += BATCH) {
      await (await verifier.registerAssetPrecisionBatch(items.slice(i, i + BATCH))).wait();
      log("registry " + Math.min(i + BATCH, items.length) + "/" + items.length);
    }
    const key = ethers.solidityPackedKeccak256(["string", "bytes32"], ["Base", data.row2.canonicalAssetId]);
    if ((await verifier.assetPrecisionTable(key)).canonicalAssetId === ethers.ZeroHash) throw new Error("Base ETH row read failed");

    for (const [env, a] of Object.entries(data.evmDevFunds)) await (await verifier.configureDevFund(env, a)).wait();
    await (await verifier.setScheduledPricePoster(me)).wait();
    await (await verifier.applyScheduledPriceRun(1, [{ environmentId: "Base", canonicalAssetId: data.row2.canonicalAssetId, priceUsd18, success: true }])).wait();
    const sp = await verifier.scheduledPrices(key);
    if (!sp.usable || sp.priceUsd18 !== priceUsd18) throw new Error("price read is not usable. Not finalizing.");

    // Hand the poster to the live poster. Its runs must use run number 2 or higher.
    if ([await at(lock), ...Object.values(locks)].includes(livePoster)) throw new Error("live price poster equals a new lock. Not finalizing.");
    await (await verifier.setScheduledPricePoster(livePoster)).wait();
    if (ethers.getAddress(await verifier.scheduledPricePoster()) !== livePoster) throw new Error("price poster read-back failed. Not finalizing.");

    await (await verifier.finalize()).wait();
    if (!(await verifier.configurationFinalized())) throw new Error("finalize read failed");
    log("Finalized.");
    return { lock, vclm, chonx, verifier, forge, stake, readers, launch };
  }

  const api = { runBaseCeremony, checkInputs, EVM_ENVS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BaseCeremonyFlow = api;
})(typeof window !== "undefined" ? window : globalThis);
