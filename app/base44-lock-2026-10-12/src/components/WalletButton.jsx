import React from "react";
import { Button } from "@/components/ui/button";
import { Wallet, AlertTriangle, LogOut, ChevronDown } from "lucide-react";
import { useWallet } from "@/lib/walletContext";
import { shortAddress } from "@/lib/format";

export default function WalletButton() {
  const { account, isBase, connect, disconnect, switchToBase, connecting, hasMetaMask } = useWallet();

  if (!account) {
    return (
      <Button onClick={connect} disabled={connecting || !hasMetaMask} className="w-full md:w-auto">
        <Wallet className="h-4 w-4" />
        {connecting ? "Connecting…" : hasMetaMask ? "Connect MetaMask" : "MetaMask not found"}
      </Button>
    );
  }

  if (!isBase) {
    return (
      <Button
        onClick={switchToBase}
        variant="destructive"
        className="w-full md:w-auto"
      >
        <AlertTriangle className="h-4 w-4" />
        Wrong network — switch to Base
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2 w-full md:w-auto">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm flex-1 md:flex-none">
        <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400/60" />
        <span className="font-mono text-foreground/90">{shortAddress(account)}</span>
        <span className="text-muted-foreground text-xs">Base</span>
      </div>
      <Button onClick={disconnect} variant="outline" size="icon" title="Disconnect">
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}