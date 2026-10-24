// Base ceremony flow (Base only). base.html runs it in the browser (MetaMask
// signer); the Hardhat tests and the dry-run run the SAME code on a local chain
// or a local fork. Nothing here holds a key. Order (all before finalize, which
// is final):
//   VCLM -> CHONX -> Verifier -> Forge (SYNTH) -> Stake(VCLM, CHONX, Forge, Verifier)
//   -> Base lock = BaseCommitmentVaultLock("Base", Dev Fund, VCLM, CHONX, Forge)
//      (refuses the three protocol tokens as inputs, VF-TOK-007; t262u)
//   -> VCLM.initialize(Verifier, Stake)  (Stake on from the start)
//   -> CHONX.initialize(Verifier, 0)
//   -> ONE reader deployed and registered: BaseLockRecordVerifier bound to the
//      new Base lock. No other environment gets a reader (Base-only launch).
//   -> registry: the Base rows of Revision B only (26 Base rows + Base ETH as
//      row 2 = 27), the Base token address index (26 addresses), no aliases
//   -> Dev Fund for Base only -> poster = this wallet, price run 1, read usable
//   -> poster handed to the live poster -> finalize.
(function (root) {
  const BATCH = 50;
  const BASE_ONLY_ENVS = ["Base"];

  function checkInputs(ethers, data, me) {
    if (!data.devFund || !data.row2 || !Array.isArray(data.entries) || !data.priceUsd18) throw new Error("ceremony data incomplete. Nothing was sent.");
    if (BigInt(data.priceUsd18) <= 0n) throw new Error("scheduled ETH price is not positive. Nothing was sent.");
    if (data.entries.length === 0 || data.entries.some((e) => e.environmentId !== "Base"))
      throw new Error("ceremony data holds a non-Base registry row (Base-only launch). Nothing was sent.");
    if (!Array.isArray(data.tokenAddresses) || data.tokenAddresses.some((t) => t.environmentId !== "Base"))
      throw new Error("ceremony data holds a non-Base token address (Base-only launch). Nothing was sent.");
    if (Array.isArray(data.assetRowAliases) && data.assetRowAliases.length !== 0)
      throw new Error("ceremony data holds asset row aliases (none on Base). Nothing was sent.");
    if (!data.readers || !data.readers.base || data.readers.base.env !== "Base" || data.readers.base.contract !== "BaseLockRecordVerifier"
        || Object.keys(data.readers).length !== 1)
      throw new Error("reader wiring is not the Base reader only. Nothing was sent.");
    const devEnvs = Object.keys(data.evmDevFunds || {});
    if (devEnvs.length !== 1 || devEnvs[0] !== "Base" || ethers.getAddress(data.evmDevFunds.Base) !== ethers.getAddress(data.devFund))
      throw new Error("Dev Fund wiring is not Base only. Nothing was sent.");
    if (!data.scheduledPricePoster || !ethers.isAddress(data.scheduledPricePoster)) throw new Error("live price poster missing from ceremony-data.json. Nothing was sent.");
    const livePoster = ethers.getAddress(data.scheduledPricePoster);
    const old = (data.oldLocks || []).map((a) => a.toLowerCase());
    if (livePoster === ethers.ZeroAddress) throw new Error("live price poster is zero. Nothing was sent.");
    if (livePoster === ethers.getAddress(me)) throw new Error("live price poster equals the connected wallet. Nothing was sent.");
    if (livePoster === ethers.getAddress(data.devFund)) throw new Error("live price poster equals the Dev Fund. Nothing was sent.");
    if (old.includes(livePoster.toLowerCase())) throw new Error("live price poster is an old contract. Nothing was sent.");
    return { livePoster };
  }

  async function runBaseCeremony({ ethers, signer, art, data, log = () => {} }) {
    const me = await signer.getAddress();
    const { livePoster } = checkInputs(ethers, data, me);
    const priceUsd18 = BigInt(data.priceUsd18);
    const dep = async (name, args) => {
      const c = await new ethers.ContractFactory(art[name].abi, art[name].bytecode, signer).deploy(...args);
      await c.waitForDeployment();
      return c;
    };
    const at = (c) => c.getAddress();
    const old = (data.oldLocks || []).map((a) => a.toLowerCase());

    const vclm = await dep("TokenVCLM", ["Vinculum Finalis VCLM", "VCLM", 10000000000n * 10n ** 18n]);
    const chonx = await dep("TokenCHONX", ["Vinculum Finalis CHONX", "CHONX", 100000000000n * 10n ** 18n]);
    const verifier = await dep("VinculumFinalisVerifier", [await at(vclm), await at(chonx)]);
    if (old.includes((await at(verifier)).toLowerCase())) throw new Error("verifier address is an old contract");
    if ((await verifier.BASE_NATIVE_ETH_ASSET_ID()).toLowerCase() !== data.row2.canonicalAssetId.toLowerCase()) throw new Error("Verifier BASE_NATIVE_ETH_ASSET_ID differs from registry row 2");
    const forge = await dep("VinculumFinalisSynth", [await at(verifier), await at(vclm), await at(chonx)]);
    const stake = await dep("VinculumFinalisStake", [await at(vclm), await at(chonx), await at(forge), await at(verifier)]);
    log("VCLM " + await at(vclm) + "\nCHONX " + await at(chonx) + "\nVerifier " + await at(verifier) + "\nForge " + await at(forge) + "\nStake " + await at(stake));
    const lock = await dep("BaseCommitmentVaultLock", ["Base", data.devFund, await at(vclm), await at(chonx), await at(forge)]);
    if ((await lock.STANDARD_FEE_BPS()) !== 500n) throw new Error("lock fee is not 5%");
    for (const t of [vclm, chonx, forge]) if (!(await lock.isProtocolToken(await at(t)))) throw new Error("Base lock does not refuse a protocol token");
    log("Base lock " + await at(lock));
    await (await vclm.initialize(await at(verifier), await at(stake))).wait(); // Stake on from the start
    await (await chonx.initialize(await at(verifier), ethers.ZeroAddress)).wait();

    // Reader: Base only. No other environment is registered (Base-only launch).
    const readers = {};
    readers.Base = await dep("BaseLockRecordVerifier", [await at(lock)]);
    if (Object.keys(readers).length !== 1) throw new Error("reader set is not the Base reader only");
    await (await verifier.registerChainVerifier("Base", await at(readers.Base))).wait();
    if ((await verifier.chainVerifiers("Base")) !== await at(readers.Base)) throw new Error("Base reader read-back failed");
    log("reader Base " + await at(readers.Base));

    const items = data.entries.map((e) => ({ environmentId: e.environmentId, canonicalAssetId: e.canonicalAssetId, symbol: e.symbol, decimals: e.decimals, custodyClass: e.custodyClass, custodyPath: e.custodyPath }));
    // ceremony-data.entries is the Base subset of Revision B (26 + Base ETH = 27).
    // Append row 2 only when an older data file omitted it.
    const hasBaseEth = items.some((e) => e.environmentId === "Base" && String(e.canonicalAssetId).toLowerCase() === String(data.row2.canonicalAssetId).toLowerCase());
    if (!hasBaseEth) {
      items.push({ environmentId: "Base", canonicalAssetId: data.row2.canonicalAssetId, symbol: data.row2.symbol, decimals: data.row2.decimals, custodyClass: data.row2.custodyClass, custodyPath: data.row2.custodyPath });
    }
    for (let i = 0; i < items.length; i += BATCH) {
      await (await verifier.registerAssetPrecisionBatch(items.slice(i, i + BATCH))).wait();
      log("registry " + Math.min(i + BATCH, items.length) + "/" + items.length);
    }
    const key = ethers.solidityPackedKeccak256(["string", "bytes32"], ["Base", data.row2.canonicalAssetId]);
    if ((await verifier.assetPrecisionTable(key)).canonicalAssetId === ethers.ZeroHash) throw new Error("Base ETH row read failed");

    // Base token address index. No asset row aliases on Base.
    if (!Array.isArray(data.tokenAddresses)) throw new Error("token address index missing. Not finalizing.");
    for (let i = 0; i < data.tokenAddresses.length; i += BATCH) {
      await (await verifier.registerTokenAddressBatch(data.tokenAddresses.slice(i, i + BATCH))).wait();
      log("token addresses " + Math.min(i + BATCH, data.tokenAddresses.length) + "/" + data.tokenAddresses.length);
    }

    await (await verifier.configureDevFund("Base", data.devFund)).wait();
    await (await verifier.setScheduledPricePoster(me)).wait();
    await (await verifier.applyScheduledPriceRun(1, [{ environmentId: "Base", canonicalAssetId: data.row2.canonicalAssetId, priceUsd18, success: true }])).wait();
    const sp = await verifier.scheduledPrices(key);
    if (!sp.usable || sp.priceUsd18 !== priceUsd18) throw new Error("price read is not usable. Not finalizing.");

    // Hand the poster to the live poster. Its runs must use run number 2 or higher.
    if ((await at(lock)) === livePoster) throw new Error("live price poster equals a new lock. Not finalizing.");
    await (await verifier.setScheduledPricePoster(livePoster)).wait();
    if (ethers.getAddress(await verifier.scheduledPricePoster()) !== livePoster) throw new Error("price poster read-back failed. Not finalizing.");

    await (await verifier.finalize()).wait();
    if (!(await verifier.configurationFinalized())) throw new Error("finalize read failed");
    const launch = await verifier.protocolLaunchTimestamp();
    if (launch === 0n || (await stake.launchTimestamp()) !== launch) throw new Error("launch time read failed");
    log("Finalized.");
    return { lock, vclm, chonx, verifier, forge, stake, readers, launch };
  }

  const api = { runBaseCeremony, checkInputs, BASE_ONLY_ENVS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BaseCeremonyFlow = api;
})(typeof window !== "undefined" ? window : globalThis);
