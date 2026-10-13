import React from "react";
import { ExternalLink } from "lucide-react";
import { BASE_CHAIN } from "@/lib/protocolConfig";
export default function MintTransactions({ transactions, minted }) {
  return <div className="space-y-2">
    {Object.entries(transactions).map(([label, hash]) => hash && <a key={label} href={`${BASE_CHAIN.blockExplorerUrls[0]}/tx/${hash}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-primary break-all">{label} — {hash}<ExternalLink className="h-3.5 w-3.5 shrink-0" /></a>)}
    {minted && <p className="text-sm text-primary">Minted {minted.amount} VCLM.{minted.balance !== null ? ` Wallet balance: ${minted.balance} VCLM.` : " Wallet balance unavailable."}</p>}
  </div>;
}