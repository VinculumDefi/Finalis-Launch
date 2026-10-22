// Base ceremony flow. base.html runs it in the browser (MetaMask signer); the
// Hardhat test runs the SAME code on the in-process test chain. Nothing here
// holds a key. Order (all before finalize, which is final):
//   VCLM -> CHONX -> Verifier -> Forge (SYNTH) -> Stake(VCLM, CHONX, Forge, Verifier)
//   -> Base lock = BaseCommitmentVaultLock("Base", Dev Fund, VCLM, CHONX, Forge)
//      (refuses the three protocol tokens as inputs, VF-TOK-007; t262u)
//   -> VCLM.initialize(Verifier, Stake)  (Stake on from the start)
//   -> CHONX.initialize(Verifier, 0)
//   -> 15 readers deployed and registered: Base, 6 EVM (bound to the NEW
//      non-Base 5% locks typed into the page), 6 UTXO, Stellar, XRP Ledger.
//      Solana is not registered.
//   -> registry (batches of 50, Revision B: 486 rows + Base ETH = 487) -> token
//      address index (475 addresses) and the Polygon native POL alias -> Dev Fund for the 7 EVM
//      chains -> poster = this wallet, price run 1, read usable
//   -> poster handed to the live poster -> finalize.
(function (root) {
  const BATCH = 50;
  const EVM_ENVS = ["Ethereum", "Arbitrum", "Optimism", "Polygon", "BNB Smart Chain", "Avalanche"];


  // Main CommitmentVaultLock runtime (immutables masked). Used to refuse the
  // retired f9e4d8c 2.5% HANDSHAKE_FEE_BPS=250 locks at 0x5AB4… on the six
  // non-Base chains, and any other bytecode that is not main.
  const CVL_RUNTIME_HASH = "0x70d73acf928a2f37ddebf165ca68e448eaa4ca76b73941d71f8b3569eeee1a79";
  const CVL_IMMUTABLE_RANGES = [[2450, 32], [4116, 32], [4963, 32]];
  const HANDSHAKE_FEE_BPS_SELECTOR = "0xee8a0fb0";
  const EVM_RPC = {
    Ethereum: { url: "https://ethereum-rpc.publicnode.com", chainId: 1 },
    Arbitrum: { url: "https://arbitrum-one-rpc.publicnode.com", chainId: 42161 },
    Optimism: { url: "https://optimism-rpc.publicnode.com", chainId: 10 },
    Polygon: { url: "https://polygon-bor-rpc.publicnode.com", chainId: 137 },
    "BNB Smart Chain": { url: "https://bsc-rpc.publicnode.com", chainId: 56 },
    Avalanche: { url: "https://avalanche-c-chain-rpc.publicnode.com", chainId: 43114 },
  };

  function maskedCodeHash(ethers, codeHex) {
    const raw = (codeHex || "0x").replace(/^0x/, "");
    if (!raw || raw === "0") return ethers.ZeroHash;
    const code = new Uint8Array(raw.match(/.{1,2}/g).map((b) => parseInt(b, 16)));
    for (const [start, len] of CVL_IMMUTABLE_RANGES) {
      if (start + len <= code.length) code.fill(0, start, start + len);
    }
    return ethers.keccak256(code);
  }

  function decodeSlot0String(word) {
    const hex = (word || "0x").replace(/^0x/, "").padStart(64, "0");
    const bytes = [];
    for (let i = 0; i < 64; i += 2) bytes.push(parseInt(hex.slice(i, i + 2), 16));
    const lenFlag = bytes[31];
    if (lenFlag % 2 !== 0) return null;
    const len = lenFlag / 2;
    if (len > 31) return null;
    return String.fromCharCode.apply(null, bytes.slice(0, len));
  }

  function refuseLock(env, reason) {
    const err = new Error("REFUSED non-Base lock on " + env + ": " + reason + ". Connect wallet / Run ceremony stays disabled.");
    err.env = env;
    err.reason = reason;
    err.refusedLock = true;
    return err;
  }

  async function verifyNonBaseLock(ethers, provider, env, address, opts) {
    const expectedHash = (opts && opts.expectedRuntimeHash) || CVL_RUNTIME_HASH;
    const expectedDev = ethers.getAddress(opts.expectedDevFund);
    let g;
    try { g = ethers.getAddress(address); } catch {
      throw refuseLock(env, "address is not a valid checksummed address");
    }
    if (g === ethers.ZeroAddress) throw refuseLock(env, "address is zero");
    const old = ((opts && opts.oldLocks) || []).map((a) => a.toLowerCase());
    if (old.includes(g.toLowerCase())) {
      throw refuseLock(env, g + " is a retired 2.5% Handshake lock");
    }

    const code = await provider.getCode(g);
    if (!code || code === "0x") throw refuseLock(env, "eth_getCode returned empty (no contract)");

    try {
      const feeProbe = await provider.call({ to: g, data: HANDSHAKE_FEE_BPS_SELECTOR });
      if (feeProbe && feeProbe !== "0x" && feeProbe.length >= 66) {
        const v = BigInt(feeProbe);
        if (v === 250n) throw refuseLock(env, "bytecode exposes HANDSHAKE_FEE_BPS()=250 (old 2.5% lock)");
        throw refuseLock(env, "bytecode exposes HANDSHAKE_FEE_BPS() (not main CommitmentVaultLock)");
      }
    } catch (e) {
      if (e && e.refusedLock) throw e;
    }

    const actualHash = maskedCodeHash(ethers, code);
    if (actualHash.toLowerCase() !== expectedHash.toLowerCase()) {
      throw refuseLock(
        env,
        "eth_getCode masked runtime hash " + actualHash + " != main CommitmentVaultLock " + expectedHash
      );
    }

    const slot0 = await provider.getStorage(g, 0);
    const label = decodeSlot0String(slot0);
    if (label !== env) {
      throw refuseLock(env, "slot 0 environmentId is " + JSON.stringify(label) + ", expected " + JSON.stringify(env));
    }

    const c = new ethers.Contract(g, [
      "function devFund() view returns (address)",
      "function STANDARD_FEE_BPS() view returns (uint256)",
    ], provider);
    const df = ethers.getAddress(await c.devFund());
    if (df !== expectedDev) {
      throw refuseLock(env, "devFund() is " + df + ", expected " + expectedDev);
    }
    const fee = await c.STANDARD_FEE_BPS();
    if (fee !== 500n) {
      throw refuseLock(env, "STANDARD_FEE_BPS() is " + fee + ", expected 500 (5%)");
    }
    return { env, address: g, runtimeHash: actualHash, environmentId: label, devFund: df };
  }

  /**
   * providersByEnv[env] = ethers Provider for that chain.
   * Tests pass the same Hardhat provider for every env. The ceremony page
   * passes publicProviders(ethers).
   */
  async function verifyAllNonBaseLocks(ethers, providersByEnv, newLocks, data) {
    const expectedHash = (data.nonBaseLock && data.nonBaseLock.expectedRuntimeHash) || CVL_RUNTIME_HASH;
    const results = [];
    for (const env of EVM_ENVS) {
      const provider = providersByEnv[env];
      if (!provider) throw refuseLock(env, "no provider for eth_getCode");
      const expectedDev = (data.evmDevFunds && data.evmDevFunds[env]) || data.devFund;
      results.push(await verifyNonBaseLock(ethers, provider, env, newLocks[env], {
        expectedDevFund: expectedDev,
        expectedRuntimeHash: expectedHash,
        oldLocks: data.oldLocks || [],
      }));
    }
    return results;
  }

  function publicProviders(ethers) {
    const out = {};
    for (const env of EVM_ENVS) {
      const cfg = EVM_RPC[env];
      out[env] = new ethers.JsonRpcProvider(cfg.url, cfg.chainId, { staticNetwork: true });
    }
    return out;
  }

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

  async function runBaseCeremony({ ethers, signer, art, data, newLocks, log = () => {}, providersByEnv = null }) {
    const me = await signer.getAddress();
    const { livePoster, locks } = checkInputs(ethers, data, newLocks, me);
    // Refuse retired / wrong-bytecode / wrong-label / wrong-Dev-Fund locks on the six chains.
    const providers = providersByEnv || Object.fromEntries(EVM_ENVS.map((e) => [e, signer.provider]));
    await verifyAllNonBaseLocks(ethers, providers, locks, data);
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

    // Token address index and asset row aliases (Polygon native POL -> POL row).
    if (!Array.isArray(data.tokenAddresses) || !Array.isArray(data.assetRowAliases)) throw new Error("token address index missing. Not finalizing.");
    for (let i = 0; i < data.tokenAddresses.length; i += BATCH) {
      await (await verifier.registerTokenAddressBatch(data.tokenAddresses.slice(i, i + BATCH))).wait();
      log("token addresses " + Math.min(i + BATCH, data.tokenAddresses.length) + "/" + data.tokenAddresses.length);
    }
    for (const a of data.assetRowAliases) await (await verifier.registerAssetRowAlias(a.environmentId, a.canonicalAssetId, a.rowEnvironmentId)).wait();

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
    const launch = await verifier.protocolLaunchTimestamp();
    if (launch === 0n || (await stake.launchTimestamp()) !== launch) throw new Error("launch time read failed");
    log("Finalized.");
    return { lock, vclm, chonx, verifier, forge, stake, readers, launch };
  }

  const api = { runBaseCeremony, checkInputs, verifyNonBaseLock, verifyAllNonBaseLocks, publicProviders, maskedCodeHash, decodeSlot0String, CVL_RUNTIME_HASH, CVL_IMMUTABLE_RANGES, HANDSHAKE_FEE_BPS_SELECTOR, EVM_ENVS, EVM_RPC };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BaseCeremonyFlow = api;
})(typeof window !== "undefined" ? window : globalThis);
