import React, { useState } from "react";
import { ethers } from "ethers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Unlock, Loader2, Search, ExternalLink, CheckCircle2 } from "lucide-react";
import { useWallet } from "@/lib/walletContext";
import { CONTRACTS, LOCK_ABI, BASE_CHAIN, isAddressSet, getReadContract } from "@/lib/protocolConfig";
import { formatEth, formatTimestamp, timeUntil, shortAddress } from "@/lib/format";
import ConfigBanner from "@/components/ConfigBanner";

export default function ReleasePage() {
  const { account, isBase, provider } = useWallet();
  const [lockId, setLockId] = useState("");
  const [loading, setLoading] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [lock, setLock] = useState(null);
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const [error, setError] = useState(null);
  const [txHash, setTxHash] = useState(null);

  const lockReady = isAddressSet(CONTRACTS.lock);

  async function loadLock() {
    setError(null);
    setLock(null);
    setTxHash(null);
    if (!lockReady) { setError("Lock contract is not configured yet."); return; }
    const id = lockId.trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(id)) { setError("Enter a valid lock ID (0x followed by 64 hex chars)."); return; }
    setLoading(true);
    try {
      const contract = getReadContract(CONTRACTS.lock, LOCK_ABI, provider);
      const l = await contract.getLock(id);
      setLock({
        owner: l[0],
        releaseDestination: l[1],
        principal: l[2],
        fee: l[3],
        startTime: Number(l[4]),
        duration: Number(l[5]),
        released: l[6],
      });
      setNow(Math.floor(Date.now() / 1000));
    } catch (e) {
      setError(e?.shortMessage || e?.reason || e?.message || "Could not load lock");
    } finally {
      setLoading(false);
    }
  }

  const maturity = lock ? lock.startTime + lock.duration : null;
  const mature = lock ? now >= maturity : false;
  const isDestination = lock ? account?.toLowerCase() === lock.releaseDestination?.toLowerCase() : false;
  const canRelease = lockReady && account && isBase && lock && !lock.released && mature && isDestination && !releasing;

  function releaseMessage() {
    if (!lock) return null;
    if (lock.released) return "This lock has already been released.";
    if (!mature) return `Not yet mature — matures ${formatTimestamp(maturity)}.`;
    if (!isDestination) return "Only the release destination can release this lock.";
    if (!account) return "Connect your wallet to release.";
    if (!isBase) return "Switch to the Base network to release.";
    return null;
  }

  async function handleRelease() {
    setError(null);
    setTxHash(null);
    try {
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACTS.lock, LOCK_ABI, signer);
      const tx = await contract.release(lockId.trim());
      setReleasing(true);
      await tx.wait();
      setTxHash(tx.hash);
      await loadLock();
    } catch (e) {
      setError(e?.shortMessage || e?.reason || e?.message || "Release failed");
    } finally {
      setReleasing(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">Release</h1>
        <p className="text-muted-foreground text-sm max-w-2xl">
          Look up a lock by ID and release the principal to its destination once mature.
        </p>
      </header>

      <ConfigBanner scope="lock" />

      <Card className="bg-card/60 backdrop-blur-sm border-border">
        <CardHeader>
          <CardTitle className="font-display text-lg">Look up lock</CardTitle>
          <CardDescription>Enter the lock ID returned at creation.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="space-y-2 flex-1">
              <Label htmlFor="lockid">Lock ID</Label>
              <Input
                id="lockid"
                placeholder="0x…"
                value={lockId}
                onChange={(e) => setLockId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadLock()}
              />
            </div>
            <div className="sm:pt-7">
              <Button onClick={loadLock} disabled={loading || !lockReady} className="w-full sm:w-auto">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {loading ? "Loading…" : "Load"}
              </Button>
            </div>
          </div>
          {error && <p className="text-sm text-destructive mt-3">{error}</p>}
        </CardContent>
      </Card>

      {lock && (
        <Card className="bg-card/60 backdrop-blur-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="font-display text-lg font-mono text-sm break-all">Lock {lockId.trim().slice(0, 10)}…</CardTitle>
              <CardDescription>Created {formatTimestamp(lock.startTime)}</CardDescription>
            </div>
            <div className="flex gap-2">
              {lock.released ? (
                <Badge variant="secondary" className="bg-muted text-muted-foreground">Released</Badge>
              ) : mature ? (
                <Badge className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Mature</Badge>
              ) : (
                <Badge variant="outline" className="border-amber-500/40 text-amber-300">Locked</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
              <Field label="Principal" value={`${formatEth(lock.principal)} ETH`} mono />
              <Field label="Fee" value={`${formatEth(lock.fee)} ETH`} mono />
              <Field label="Duration" value={durationLabel(lock.duration)} />
              <Field label="Maturity" value={formatTimestamp(maturity)} />
              <Field label="Time remaining" value={timeUntil(maturity, now)} />
              <Field label="Release destination" value={shortAddress(lock.releaseDestination)} mono />
            </div>

            {releaseMessage() && (
              <p className="text-sm text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                {releaseMessage()}
              </p>
            )}
            {txHash && (
              <a
                href={`${BASE_CHAIN.blockExplorerUrls[0]}/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-sm text-emerald-300 hover:text-emerald-200"
              >
                <CheckCircle2 className="h-4 w-4" />
                Released — view transaction
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}

            <Button onClick={handleRelease} disabled={!canRelease} size="lg" className="w-full sm:w-auto">
              {releasing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlock className="h-4 w-4" />}
              {releasing ? "Releasing…" : "Release principal"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value, mono }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className={mono ? "font-mono text-sm" : "text-sm"}>{value}</div>
    </div>
  );
}

function durationLabel(seconds) {
  const days = Math.round(seconds / 86400);
  if (days === 0) return "1 hour";
  return `${days.toLocaleString()} days`;
}