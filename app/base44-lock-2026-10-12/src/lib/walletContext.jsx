import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { BASE_CHAIN } from "@/lib/protocolConfig";

const WalletContext = createContext(null);

function pickMetaMask() {
  if (!window.ethereum) return null;
  if (Array.isArray(window.ethereum.providers)) {
    return window.ethereum.providers.find((p) => p.isMetaMask) || window.ethereum;
  }
  return window.ethereum;
}

export function WalletProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [provider, setProvider] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  const isBase = chainId === BASE_CHAIN.chainId;

  const attachListeners = useCallback((mm) => {
    if (!mm || !mm.on) return;
    mm.removeAllListeners?.("accountsChanged");
    mm.removeAllListeners?.("chainChanged");
    mm.on("accountsChanged", (accs) => {
      setAccount(accs && accs.length ? accs[0] : null);
    });
    mm.on("chainChanged", (c) => setChainId(c));
  }, []);

  const connect = useCallback(async () => {
    const mm = pickMetaMask();
    if (!mm) {
      setError("MetaMask was not detected. Install MetaMask to continue.");
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const accounts = await mm.request({ method: "eth_requestAccounts" });
      const chain = await mm.request({ method: "eth_chainId" });
      setAccount(accounts[0]);
      setChainId(chain);
      setProvider(new ethers.BrowserProvider(mm));
      attachListeners(mm);
    } catch (e) {
      setError(e?.shortMessage || e?.message || "Connection rejected");
    } finally {
      setConnecting(false);
    }
  }, [attachListeners]);

  const switchToBase = useCallback(async () => {
    const mm = pickMetaMask();
    if (!mm) return;
    try {
      await mm.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: BASE_CHAIN.chainId }],
      });
    } catch (e) {
      if (e?.code === 4902 || e?.code === -32603) {
        try {
          await mm.request({
            method: "wallet_addEthereumChain",
            params: [BASE_CHAIN],
          });
        } catch (addErr) {
          setError(addErr?.shortMessage || addErr?.message || "Could not add Base");
        }
      } else {
        setError(e?.shortMessage || e?.message || "Could not switch network");
      }
    }
  }, []);

  const switchAccount = useCallback(async () => {
    const mm = pickMetaMask();
    if (!mm) {
      setError("MetaMask was not detected. Install MetaMask to continue.");
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      // wallet_requestPermissions with eth_accounts forces MetaMask's account picker.
      const permissions = await mm.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      });
      const accsPermission = Array.isArray(permissions)
        ? permissions.find((p) => p.parentCapability === "eth_accounts")
        : null;
      const selected = accsPermission?.caveats?.find((c) => c.type === "restrictReturnedAccounts")?.value?.[0];
      if (selected) {
        setAccount(selected);
      } else {
        const accs = await mm.request({ method: "eth_accounts" });
        if (accs && accs.length) setAccount(accs[0]);
      }
      const chain = await mm.request({ method: "eth_chainId" });
      setChainId(chain);
      setProvider(new ethers.BrowserProvider(mm));
      attachListeners(mm);
    } catch (e) {
      setError(e?.shortMessage || e?.message || "Account switch rejected");
    } finally {
      setConnecting(false);
    }
  }, [attachListeners]);

  const disconnect = useCallback(() => {
    setAccount(null);
    setProvider(null);
    setChainId(null);
  }, []);

  // Silent reconnect on mount
  useEffect(() => {
    const mm = pickMetaMask();
    if (!mm) return;
    mm.request({ method: "eth_accounts" })
      .then((accs) => {
        if (accs && accs.length) {
          setAccount(accs[0]);
          mm.request({ method: "eth_chainId" }).then(setChainId).catch(() => {});
          setProvider(new ethers.BrowserProvider(mm));
          attachListeners(mm);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <WalletContext.Provider
      value={{
        account,
        chainId,
        provider,
        isBase,
        connecting,
        error,
        connect,
        disconnect,
        switchToBase,
        switchAccount,
        hasMetaMask: Boolean(pickMetaMask()),
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}