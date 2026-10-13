import React, { useState } from "react";
import { ethers } from "ethers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Unlock, Loader2, Search, ExternalLink, CheckCircle2 } from "lucide-react";
import { useWallet } from "@/lib/walletContext";
import { CONTRACTS, BASE_CHAIN, isAddressSet } from "@/lib/protocolConfig";
import { shortAddress } from "@/lib/format";
import ConfigBanner from "@/components/ConfigBanner";

// Only release is used for the send. No getLock, no lockRecord.
const RELEASE_ABI = ["function release(bytes32 lockId) external"];

export default function ReleasePage() {
  const { account, isBase, provider } = useWallet();
  const [txInput, setTxInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [lock, setLock] = useState(null);
  const [released, setReleased] = useState(false);
  const [error, setError] = useState(null);
  const [releaseTxHash, setReleaseTxHash] = useState(null);

  const lockReady = isAddressSet(CONTRACTS.lock);

  // Lookup: read the lock creation transaction receipt, find the lock contract's
  // creation event log, and derive the lock ID (topics[1]) and release
  // destination (topics[3] as an address). No getLock, no lockRecord.
  async function loadLock() {
    setError(null);
    setLock(null);
    setReleaseTxHash(null);
    setReleased(false);
    if (!lockReady) { setError("Lock contract is not configured yet."); return; }
    const tx = txInput.trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(tx)) { setError("Enter a valid lock transaction hash (0x followed by 64 hex chars)."); return; }
    if (!provider) { setError("Connect your wallet to look up a lock."); return; }
    setLoading(true);
    try {
      const receipt = await provider.getTransactionReceipt(tx);
      if (!receipt) { setError("No transaction found for that hash on Base."); return; }
      if (receipt.to?.toLowerCase() !== CONTRACTS.lock.toLowerCase()) {
        setError("That transaction was not sent to the lock contract.");
        return;
      }
      const lockAddr = CONTRACTS.lock.toLowerCase();
      // The creation event carries the lock ID at topics[1] and the release
      // destination at topics[3] (indexed address). Other lock-contract logs
      // (e.g. FeeRouted) have fewer topics, so require four.
      const lockLog = receipt.logs.find(
        (log) => log.address.toLowerCase() === lockAddr && log.topics.length >= 4
      );
      if (!lockLog) { setError("No lock creation event found in that transaction."); return; }
      const lockId = lockLog.topics[1];
      const releaseDestination = ethers.getAddress("0x" + lockLog.topics[3].slice(26));
      setLock({ lockId, releaseDestination, txHash: tx });
    } catch (e) {
      setError(e?.shortMessage || e?.reason || e?.message || "Could not load lock");
    } finally {
      setLoading(false);
    }
  }

  const isDestination = lock ? account?.toLowerCase() === lock.releaseDestination?.toLowerCase() : false;
  // Release is allowed only when the connected wallet is the destination, the
  // network is Base, and the lock is not already released.
  const canRelease = lockReady && Boolean(account) && isBase && Boolean(lock) && !released && isDestination && !releasing;

  function releaseMessage() {
    if (!lock) return null;
    if (released) return "This lock has already been released.";
    if (!isDestination) return "Only the release destination can release this lock.";
    if (!account) return "Connect your wallet to release.";
    if (!isBase) return "Switch to the Base network to release.";
    return null;
  }

  // Send release(lockId) on the lock contract. No getLock, no lockRecord.
  async function handleRelease() {
    setError(null);
    setReleaseTxHash(null);
    setReleasing(true);
    try {
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACTS.lock, RELEASE_ABI, signer);
      if (String(contract.target).toLowerCase() !== CONTRACTS.lock.toLowerCase()) {
        throw new Error("Wrong release target. No transaction sent.");
      }
      const tx = await contract.release(lock.lockId);
      setReleaseTxHash(tx.hash);
      const receipt = await tx.wait();
      if (receipt.status !== 1) throw new Error("Release transaction failed.");
      setReleased(true);
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
          Look up a lock by its creation transaction hash and release the principal to its destination.
        </p>
      </header>

      <ConfigBanner scope="lock" />

      <Card className="bg-card/60 backdrop-blur-sm border-border">
        <CardHeader>
          <CardTitle className="font-display text-lg">Look up lock</CardTitle>
          <CardDescription>Enter the lock creation transaction hash.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="space-y-2 flex-1">
              <Label htmlFor="txhash">Lock transaction hash</Label>
              <Input
                id="txhash"
                placeholder="0x…"
                value={txInput}
                onChange={(e) => setTxInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadLock()}
                className="font-mono"
              />
            </div>
            <div className="sm:pt-7">
              <Button onClick={loadLock} disabled={loading || !lockReady} className="w-full sm:w-auto">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {loading ? "Loading…" : "Load"}
              </Button>
            </div>
          </div>
          {error && <p className="text-sm text-destructive mt-3 break-all">{error}</p>}
        </CardContent>
      </Card>

      {lock && (
        <Card className="bg-card/60 backdrop-blur-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="font-display text-lg">Lock</CardTitle>
              <CardDescription>From transaction {shortAddress(lock.txHash)}</CardDescription>
            </div>
            <div className="flex gap-2">
              {released ? (
                <Badge variant="secondary" className="bg-muted text-muted-foreground">Released</Badge>
              ) : (
                <Badge variant="outline" className="border-primary/40 text-primary">Active</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
              <Field label="Lock ID" value={lock.lockId} mono />
              <Field label="Release destination" value={shortAddress(lock.releaseDestination)} mono />
            </div>

            {releaseMessage() && (
              <p className="text-sm text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                {releaseMessage()}
              </p>
            )}
            {releaseTxHash && (
              <a
                href={`${BASE_CHAIN.blockExplorerUrls[0]}/tx/${releaseTxHash}`}
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
      <div className={mono ? "font-mono text-sm break-all" : "text-sm"}>{value}</div>
    </div>
  );
}