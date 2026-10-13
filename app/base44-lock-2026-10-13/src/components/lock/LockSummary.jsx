import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatUsd } from "@/lib/format";

export default function LockSummary({ asset, duration, amount, grossUsd, feeAmount, principalAmount }) {
  if (!asset) return null;
  return (
    <Card className="lg:col-span-2 bg-card/60 backdrop-blur-sm border-border h-fit">
      <CardHeader>
        <CardTitle className="font-display text-lg">Summary</CardTitle>
        <CardDescription>
          {asset.label} · {duration.kind === "handshake" ? "1-hour Handshake" : duration.label}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Row label="Asset" value={asset.label} />
        <Row label="Duration" value={duration.label} />
        <Row label="Fee rate" value={`${(duration.feeRate * 100).toFixed(2)}%`} />
        <Row label="Amount" value={`${amount} ${asset.symbol}`} />
        <Row label="Verified gross USD" value={formatUsd(grossUsd)} />
        <div className="border-t border-border pt-4 space-y-4">
          <Row label="Fee" value={`${feeAmount} ${asset.symbol}`} />
          <Row label="Net (locked principal)" value={`${principalAmount} ${asset.symbol}`} strong />
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value, strong }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-right ${strong ? "text-foreground font-semibold font-mono" : "font-mono text-sm"}`}>
        {value}
      </span>
    </div>
  );
}