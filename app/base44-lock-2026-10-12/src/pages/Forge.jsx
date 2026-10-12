import React, { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, Loader2, CheckCircle2, ExternalLink, ArrowRight } from "lucide-react";
import { useWallet } from "@/lib/walletContext";
import {
  CONTRACTS, ERC20_ABI, FORGE_ABI, FORGE, BASE_CHAIN, isAddressSet, getReadContract, getSignerContract,
} from "@/lib/protocolConfig";
import { formatUnits, shortAddress } from "@/lib/format";
import ConfigBanner from "@/components/ConfigBanner";

const DECIMALS = 18;

export default function ForgePage() {
  const { account, isBase, provider } = useWallet();
  const [vclmBal, setVclmBal] = useState(null);
  const [chonxBal, setChonxBal] = useState(null);
  const [synthBal, setSynthBal] = useState(null);
  const [synthSupply, setSynthSupply] = useState(null);
  const [vclmAllow, setVclmAllow] = useState(null);
  const [chonxAllow, setChonxAllow] = useState(null);
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(null); // "vclm" | "chonx"
  const [forging, setForging] = useState(false);
  const [error, setError] = useState(null);
  const [txHash, setTxHash] = useState(null);

  const ready = isAddressSet(CONTRACTS.forge) && isAddressSet(CONTRACTS.vclm) && isAddressSet(CONTRACTS.chonx) && isAddressSet(CONTRACTS.synth);

  const refresh = useCallback(async () => {
    if (!ready || !account) return;
    setLoading(true);
    setError(null);
    try {
      const vclm = getReadContract(CONTRACTS.vclm, ERC20_ABI, provider);
      const chonx = getReadContract(CONTRACTS.chonx, ERC20_ABI, provider);
      const synth = getReadContract(CONTRACTS.synth, ERC20_ABI, provider);
      const [v, c, s, supply, va, ca] = await Promise.all([
        vclm.balanceOf(account),
        chonx.balanceOf(account),
        synth.balanceOf(account),
        synth.totalSupply(),
        vclm.allowance(account, CONTRACTS.forge),
        chonx.allowance(account, CONTRACTS.forge),
      ]);
      setVclmBal(v);
      setChonxBal(c);
      setSynthBal(s);
      setSynthSupply(supply);
      setVclmAllow(va);
      setChonxAllow(ca);
    } catch (e) {
      setError(e?.shortMessage || e?.message || "Could not load balances");
    } finally {
      setLoading(false);
    }
  }, [ready, account, provider]);

  useEffect(() => { refresh(); }, [refresh]);

  const vclmNeed = ethers.parseUnits(String(FORGE.vclmRequired), DECIMALS);
  const chonxNeed = ethers.parseUnits(String(FORGE.chonxRequired), DECIMALS);
  const vclmOk = vclmAllow && vclmAllow >= vclmNeed;
  const chonxOk = chonxAllow && chonxAllow >= chonxNeed;
  const balOk = vclmBal && chonxBal && vclmBal >= vclmNeed && chonxBal >= chonxNeed;

  const minted = synthSupply ? Number(formatUnits(synthSupply, DECIMALS, 0)) : 0;
  const remaining = Math.max(0, FORGE.synthCap - minted);
  const capPct = Math.min(100, (minted / FORGE.synthCap) * 100);

  const canForge = ready && account && isBase && vclmOk && chonxOk && balOk && !forging;

  async function approve(token) {
    setError(null);
    setApproving(token);
    try {
      const addr = token === "vclm" ? CONTRACTS.vclm : CONTRACTS.chonx;
      const need = token === "vclm" ? vclmNeed : chonxNeed;
      const contract = await getSignerContract(addr, ERC20_ABI, provider);
      const tx = await contract.approve(CONTRACTS.forge, need);
      await tx.wait();
      await refresh();
    } catch (e) {
      setError(e?.shortMessage || e?.message || "Approval failed");
    } finally {
      setApproving(null);
    }
  }

  async function handleForge() {
    setError(null);
    setTxHash(null);
    setForging(true);
    try {
      const contract = await getSignerContract(CONTRACTS.forge, FORGE_ABI, provider);
      const tx = await contract.forge();
      await tx.wait();
      setTxHash(tx.hash);
      await refresh();
    } catch (e) {
      setError(e?.shortMessage || e?.reason || e?.message || "Forge failed");
    } finally {
      setForging(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">Forge</h1>
        <p className="text-muted-foreground text-sm max-w-2xl">
          Burn VCLM and CHONX to mint SYNTH. Each forge consumes 1,000 VCLM and 10,000 CHONX for 1 SYNTH.
        </p>
      </header>

      <ConfigBanner scope="forge" />

      {/* SYNTH supply */}
      <Card className="bg-card/60 backdrop-blur-sm border-border">
        <CardHeader>
          <CardTitle className="font-display text-lg">SYNTH supply</CardTitle>
          <CardDescription>Capped at {FORGE.synthCap.toLocaleString()} SYNTH.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-2xl font-semibold">{minted.toLocaleString()}</span>
            <span className="text-sm text-muted-foreground">
              {remaining.toLocaleString()} remaining
            </span>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${capPct}%` }} />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{capPct.toFixed(3)}% minted</span>
            <span>Cap {FORGE.synthCap.toLocaleString()}</span>
          </div>
        </CardContent>
      </Card>

      {/* Forge action */}
      <div className="grid lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3 bg-card/60 backdrop-blur-sm border-border">
          <CardHeader>
            <CardTitle className="font-display text-lg">Forge SYNTH</CardTitle>
            <CardDescription>Approve both tokens, then forge.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <BalanceBox label="VCLM balance" value={vclmBal != null ? formatUnits(vclmBal, DECIMALS, 2) : "—"} need={FORGE.vclmRequired} ok={vclmBal && vclmBal >= vclmNeed} />
              <BalanceBox label="CHONX balance" value={chonxBal != null ? formatUnits(chonxBal, DECIMALS, 2) : "—"} need={FORGE.chonxRequired} ok={chonxBal && chonxBal >= chonxNeed} />
            </div>

            <div className="flex items-center justify-center gap-3 py-2 text-sm">
              <span className="font-mono text-emerald-300">1,000 VCLM</span>
              <span className="text-muted-foreground">+</span>
              <span className="font-mono text-violet-300">10,000 CHONX</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono font-semibold">1 SYNTH</span>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {txHash && (
              <a href={`${BASE_CHAIN.blockExplorerUrls[0]}/tx/${txHash}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-emerald-300 hover:text-emerald-200">
                <CheckCircle2 className="h-4 w-4" /> Forged — view transaction <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}

            <div className="grid sm:grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => approve("vclm")} disabled={!ready || !account || !isBase || vclmOk || approving !== null} className="w-full">
                {approving === "vclm" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {vclmOk ? "VCLM approved" : approving === "vclm" ? "Approving…" : "Approve VCLM"}
              </Button>
              <Button variant="outline" onClick={() => approve("chonx")} disabled={!ready || !account || !isBase || chonxOk || approving !== null} className="w-full">
                {approving === "chonx" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {chonxOk ? "CHONX approved" : approving === "chonx" ? "Approving…" : "Approve CHONX"}
              </Button>
            </div>

            <Button onClick={handleForge} disabled={!canForge} size="lg" className="w-full">
              {forging ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />}
              {forging ? "Forging…" : "Forge 1 SYNTH"}
            </Button>

            {!account && <p className="text-xs text-center text-muted-foreground">Connect MetaMask to forge.</p>}
            {account && !isBase && <p className="text-xs text-center text-amber-300">Switch to Base to forge.</p>}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 bg-card/60 backdrop-blur-sm border-border h-fit">
          <CardHeader>
            <CardTitle className="font-display text-lg">Your holdings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Holding label="VCLM" value={vclmBal != null ? formatUnits(vclmBal, DECIMALS, 2) : "—"} />
            <Holding label="CHONX" value={chonxBal != null ? formatUnits(chonxBal, DECIMALS, 2) : "—"} />
            <Holding label="SYNTH" value={synthBal != null ? formatUnits(synthBal, DECIMALS, 2) : "—"} />
            {account && (
              <div className="border-t border-border pt-3 text-xs text-muted-foreground font-mono">
                {shortAddress(account)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function BalanceBox({ label, value, need, ok }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/30 px-4 py-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono text-lg mt-1">{value}</div>
      <div className={`text-xs mt-1 ${ok ? "text-emerald-300" : "text-muted-foreground"}`}>
        {ok ? `≥ ${need.toLocaleString()} required` : `need ${need.toLocaleString()}`}
      </div>
    </div>
  );
}

function Holding({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-mono text-sm">{value}</span>
    </div>
  );
}