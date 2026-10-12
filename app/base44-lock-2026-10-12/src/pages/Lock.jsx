import React, { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lock, ArrowRight, Loader2, CheckCircle2, ExternalLink, RefreshCw } from "lucide-react";
import { useWallet } from "@/lib/walletContext";
import { shortAddress } from "@/lib/format";
import {
  ASSETS, DURATIONS, CONTRACTS, LOCK_ABI, ERC20_ABI, BASE_CHAIN,
  isAddressSet, isAssetConfigured, getSignerContract,
} from "@/lib/protocolConfig";
import { formatUsd } from "@/lib/format";
import ConfigBanner from "@/components/ConfigBanner";
import LockSummary from "@/components/lock/LockSummary";
import MintTransactions from "@/components/lock/MintTransactions";
import useScheduledPrice from "@/components/lock/useScheduledPrice";
import { readMintContext, scheduledGrossUsd, mintFromLock } from "@/lib/lockMint";

export default function LockPage() {
  const { account, isBase, provider, connect, switchAccount, connecting } = useWallet();
  const [assetId, setAssetId] = useState("eth");
  const [durationKey, setDurationKey] = useState("0");
  const [amount, setAmount] = useState("");
  const [mintTransactions, setMintTransactions] = useState({});
  const [minted, setMinted] = useState(null);
  const [releaseDest, setReleaseDest] = useState("");
  const [balances, setBalances] = useState({});
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(null);
  const [txHash, setTxHash] = useState(null);
  const [createdLockId, setCreatedLockId] = useState(null);
  const [error, setError] = useState(null);
  const [senderDiagnostic, setSenderDiagnostic] = useState(null);

  const asset = ASSETS.find((a) => a.id === assetId);
  const duration = DURATIONS[Number(durationKey)];
  const scheduled = useScheduledPrice(provider, isBase, asset);

  useEffect(() => {
    if (account && !releaseDest) setReleaseDest(account);
  }, [account]);

  useEffect(() => {
    const a = ASSETS.find((x) => x.id === assetId);
    if (a) setAmount(a.defaultAmount);
  }, [assetId]);

  // Load balances for all configured assets
  useEffect(() => {
    if (!account || !provider) return;
    let active = true;
    setBalancesLoading(true);
    (async () => {
      const result = {};
      for (const a of ASSETS) {
        if (!isAssetConfigured(a)) { result[a.id] = 0n; continue; }
        try {
          if (a.kind === "native") {
            result[a.id] = await provider.getBalance(account);
          } else {
            const token = new ethers.Contract(a.address, ERC20_ABI, provider);
            result[a.id] = await token.balanceOf(account);
          }
        } catch {
          result[a.id] = 0n;
        }
      }
      if (active) {
        setBalances(result);
        setBalancesLoading(false);
      }
    })();
    return () => { active = false; };
  }, [account, provider]);

  const availableAssets = useMemo(() => {
    return ASSETS.filter((a) => {
      if (!isAssetConfigured(a)) return false;
      if (!account) return true;
      const bal = balances[a.id];
      return bal != null && bal > 0n;
    });
  }, [account, balances]);

  useEffect(() => {
    if (availableAssets.length > 0 && !availableAssets.find((a) => a.id === assetId)) {
      setAssetId(availableAssets[0].id);
    }
  }, [availableAssets]);

  const amountNum = parseFloat(amount);
  let amountWei = 0n;
  try { if (/^\d*\.?\d+$/.test(amount)) amountWei = ethers.parseUnits(amount, asset.decimals); } catch { /* Invalid amount stays non-submittable. */ }
  const amountValid = amountWei > 0n;
  const destValid = ethers.isAddress(releaseDest) && releaseDest !== ethers.ZeroAddress;
  const grossUsdWei = scheduled.context ? scheduledGrossUsd(amountWei, asset.decimals, scheduled.context.price) : 0n;
  const grossUsdNum = Number(ethers.formatUnits(grossUsdWei, 18));
  const grossUsdValid = grossUsdWei > 0n;
  const grossUsdInRange = duration.kind === "handshake"
    ? grossUsdWei >= ethers.parseUnits("0.95", 18) && grossUsdWei <= ethers.parseUnits("1.05", 18)
    : grossUsdWei >= ethers.parseUnits("10", 18);
  const balance = balances[assetId];
  const balanceSufficient = balance != null && amountWei > 0n && balance >= amountWei;
  const lockReady = isAddressSet(CONTRACTS.lock);
  const canSubmit = lockReady && account && isBase && amountValid && destValid && grossUsdInRange && balanceSufficient && scheduled.context && !scheduled.loading && !submitting;

  function formatBalance(bal, a) {
    if (bal == null) return "—";
    return ethers.formatUnits(bal, a.decimals);
  }

  function validationMessage() {
    if (!lockReady) return "Lock contract is not configured yet.";
    if (!account) return "Connect your MetaMask wallet to continue.";
    if (!isBase) return "Switch to the Base network to lock.";
    if (availableAssets.length === 0) return "No lockable assets found in your wallet.";
    if (!amountValid) return "Enter a valid amount.";
    if (!destValid) return "Enter a valid release destination address.";
    if (scheduled.loading) return "Checking the verifier and scheduled price…";
    if (scheduled.error) return scheduled.error;
    if (!grossUsdValid) return "A usable scheduled price is required.";
    if (!grossUsdInRange) {
      if (duration.kind === "handshake") {
        return `Handshake requires Verified Gross USD between $0.95 and $1.05. Current: ${formatUsd(grossUsdNum)}.`;
      }
      return `This duration requires at least $10.00 at the scheduled price. Current: ${formatUsd(grossUsdNum)}.`;
    }
    if (!balanceSufficient) {
      return `Insufficient ${asset.symbol} balance. Required: ${amount} ${asset.symbol}, available: ${formatBalance(balance, asset)} ${asset.symbol}.`;
    }
    return null;
  }

  const msg = validationMessage();

  const fracDigits = asset?.kind === "native" ? 6 : asset?.decimals || 6;
  const feeAmount = amountValid ? (amountNum * duration.feeRate).toFixed(fracDigits) : "0";
  const principalAmount = amountValid ? (amountNum - amountNum * duration.feeRate).toFixed(fracDigits) : "0";

  async function handleLock() {
    setError(null);
    setSenderDiagnostic(null);
    setTxHash(null);
    setCreatedLockId(null);
    setMintTransactions({});
    setMinted(null);
    setSubmitting(true);
    setStep(null);
    let confirmedLock = false;
    try {
      if (!account || !provider) return;
      // Refresh mint readiness and scheduled valuation before locking.
      const context = await readMintContext(provider, asset);
      const valuation = scheduledGrossUsd(amountWei, asset.decimals, context.price);
      const inRange = duration.kind === "handshake"
        ? valuation >= ethers.parseUnits("0.95", 18) && valuation <= ethers.parseUnits("1.05", 18)
        : valuation >= ethers.parseUnits("10", 18);
      if (!inRange) throw new Error("The scheduled valuation is outside this duration's permitted range. No funds were locked.");
      const signer = new ethers.JsonRpcSigner(provider, account);
      const contract = new ethers.Contract("0x968BFD5b580144b4398C10BB1E61bD8A6B1aC946", LOCK_ABI, signer);
      const lockId = ethers.hexlify(ethers.randomBytes(32));
      const valuationReference = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [context.price]));
      if (asset.kind !== "native") {
        const token = await getSignerContract(asset.address, ERC20_ABI, provider);
        if (await token.allowance(account, CONTRACTS.lock) < amountWei) {
          setStep("approving");
          await (await token.approve(CONTRACTS.lock, amountWei)).wait();
        }
      }
      setStep("locking");
      const args = [lockId, account, 0, asset.assetIdentity, valuationReference, releaseDest, duration.seconds];
      // This is the object used by createNativeLock immediately below.
      console.info(`contract.target=${contract.target}`);
      setSenderDiagnostic({ target: String(contract.target) });
      if (String(contract.target).toLowerCase() !== "0x968bfd5b580144b4398c10bb1e61bd8a6b1ac946") throw new Error("Wrong lock target. No transaction sent.");
      const tx = asset.kind === "native"
        ? await contract.createNativeLock(...args, valuation, { value: amountWei })
        : await contract.createErc20Lock(...args, asset.address, amountWei, valuation);
      if (tx.to?.toLowerCase() !== String(contract.target).toLowerCase()) throw new Error(`Unexpected lock destination; mint will not proceed. tx.to=${tx.to ?? "(none)"} expected=${contract.target}`);
      const receipt = await tx.wait();
      if (receipt.status !== 1 || receipt.to?.toLowerCase() !== String(contract.target).toLowerCase()) throw new Error("Lock was not confirmed on the reader-bound vault.");
      confirmedLock = true;
      setTxHash(receipt.hash);
      setCreatedLockId(lockId);
      await mintFromLock({ provider, account, lockId, receipt,
        onStep: setStep,
        onTransaction: (label, hash) => setMintTransactions(previous => ({ ...previous, [label]: hash })),
        onMinted: setMinted,
      });
      setAmount(asset.defaultAmount);
    } catch (e) {
      const reason = e?.shortMessage || e?.reason || e?.message || "Transaction failed";
      setError(confirmedLock ? `Lock-to-mint failed: mint not confirmed. Your funds remain locked. ${reason}` : reason);
    } finally {
      setSubmitting(false);
      setStep(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">Lock</h1>
        <p className="text-muted-foreground text-sm max-w-2xl">
          Time-lock assets on Base. Choose an asset, duration, and release destination.
          The fee is deducted from the principal at lock creation.
        </p>
      </header>

      <ConfigBanner scope="lock" />

      <div className="grid lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3 bg-card/60 backdrop-blur-sm border-border">
          <CardHeader>
            <CardTitle className="font-display text-lg">Create lock</CardTitle>
            <CardDescription>
              {availableAssets.length === 0 && account
                ? "No lockable assets found in your wallet."
                : "Sixteen durations, from the 1-hour Handshake to the 10-year vault."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/40 px-3 py-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Connected wallet</p>
                <p className="font-mono text-sm truncate">
                  {account ? shortAddress(account) : "Not connected"}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={switchAccount}
                disabled={!account || connecting}
                className="shrink-0"
              >
                {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Switch wallet
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Asset</Label>
              <Select value={assetId} onValueChange={setAssetId}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availableAssets.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.label}
                      <span className="ml-auto text-muted-foreground text-xs pl-2">
                        {balancesLoading ? "…" : formatBalance(balances[a.id], a)} {a.symbol}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Duration</Label>
              <Select value={durationKey} onValueChange={setDurationKey}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DURATIONS.map((d, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {d.label}
                      <span className="ml-auto text-muted-foreground text-xs pl-2">
                        {d.kind === "handshake" ? "2.50%" : "5.00%"}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Amount ({asset?.symbol})</Label>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {balance != null && (
                <p className="text-xs text-muted-foreground">
                  Balance: {formatBalance(balance, asset)} {asset.symbol}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Scheduled gross USD value</Label>
              <Input readOnly value={scheduled.loading ? "Checking…" : scheduled.context ? formatUsd(grossUsdNum) : "Unavailable"} />
              <p className="text-xs text-muted-foreground">
                Derived from the verifier's scheduled price, never a typed valuation.
                {duration.kind === "handshake" ? " Handshake range: $0.95 – $1.05." : " Standard minimum: $10.00."}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Release destination</Label>
              <Input
                placeholder="0x…"
                value={releaseDest}
                onChange={(e) => setReleaseDest(e.target.value)}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Only this address can release the principal after maturity.
              </p>
            </div>

            {msg && (
              <p className="text-sm text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                {msg}
              </p>
            )}
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 break-all">
                {error}
              </p>
            )}
            {txHash && (
              <div className="space-y-2">
                <a
                  href={`${BASE_CHAIN.blockExplorerUrls[0]}/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  {minted && <CheckCircle2 className="h-4 w-4 text-primary" />}
                  {minted ? "Lock and mint completed — view lock transaction" : "Lock transaction — mint not confirmed"}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                {createdLockId && (
                  <p className="text-xs text-muted-foreground font-mono break-all">
                    Lock ID: {createdLockId}
                  </p>
                )}
              </div>
            )}

            <MintTransactions transactions={mintTransactions} minted={minted} />
            {senderDiagnostic && <div role="status" className="space-y-1 text-xs font-mono text-muted-foreground break-all">
              <p>contract.target={senderDiagnostic.target}</p>
            </div>}
            <Button onClick={handleLock} disabled={!canSubmit} className="w-full" size="lg">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              {submitting
                ? ({ approving: "Approving…", recording: "Recording fee and RAC…", minting: "Minting VCLM…", locking: "Confirming lock…" }[step] || "Checking…")
                : "Confirm lock"}
              {!submitting && <ArrowRight className="h-4 w-4" />}
            </Button>
          </CardContent>
        </Card>

        <LockSummary
          asset={asset}
          duration={duration}
          amount={amountValid ? amount : "0"}
          grossUsd={grossUsdNum}
          feeAmount={feeAmount}
          principalAmount={principalAmount}
        />
      </div>
    </div>
  );
}