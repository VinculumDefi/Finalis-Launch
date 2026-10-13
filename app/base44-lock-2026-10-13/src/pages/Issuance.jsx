import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Coins, TrendingDown, Clock } from "lucide-react";
import {
  EMISSION, ASSET_MULTIPLIERS, emissionRate, periodsElapsed, LAUNCH_TIMESTAMP,
} from "@/lib/protocolConfig";
import { formatNumber } from "@/lib/format";
import ConfigBanner from "@/components/ConfigBanner";

export default function IssuancePage() {
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  const launch = LAUNCH_TIMESTAMP;
  const elapsed = periodsElapsed(now, launch);
  const nextDecay = launch ? launch + (elapsed + 1) * EMISSION.periodSeconds : null;
  const countdown = nextDecay ? nextDecay - now : null;

  const vclmRate = useMemo(() => emissionRate(EMISSION.vclm, now, launch), [now, launch]);
  const chonxRate = useMemo(() => emissionRate(EMISSION.chonx, now, launch), [now, launch]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">Issuance</h1>
        <p className="text-muted-foreground text-sm max-w-2xl">
          Live emission rates for VCLM and CHONX, and the asset multipliers that scale issuance.
        </p>
      </header>

      <ConfigBanner scope="issuance" />

      {/* Emission cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        <EmissionCard
          token={EMISSION.vclm}
          rate={vclmRate}
          accent="emerald"
        />
        <EmissionCard
          token={EMISSION.chonx}
          rate={chonxRate}
          accent="violet"
        />
      </div>

      {/* Decay status */}
      <Card className="bg-card/60 backdrop-blur-sm border-border">
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
            Decay schedule
          </CardTitle>
          <CardDescription>
            Rates decay {((EMISSION.decay) * 100).toFixed(3)}% every 30 days toward the floor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-6">
            <Stat label="Periods elapsed" value={launch ? formatNumber(elapsed) : "—"} />
            <Stat label="Next decay" value={countdown != null ? formatCountdown(countdown) : "—"} icon={Clock} />
            <Stat label="Launch timestamp" value={launch ? new Date(launch * 1000).toLocaleDateString("en-US") : "Not set"} />
          </div>
          {!launch && (
            <p className="text-xs text-muted-foreground mt-4">
              Launch timestamp not configured — rates shown at their initial (at-launch) values.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Asset multipliers */}
      <Card className="bg-card/60 backdrop-blur-sm border-border">
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Coins className="h-4 w-4 text-muted-foreground" />
            Asset multipliers
          </CardTitle>
          <CardDescription>
            Applied to the gross USD value of a lock to determine issuance. Everything else defaults to 1.0×.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="px-2 py-2 font-medium">Asset</th>
                  <th className="px-2 py-2 font-medium">Venue</th>
                  <th className="px-2 py-2 font-medium text-right">Multiplier</th>
                </tr>
              </thead>
              <tbody>
                {ASSET_MULTIPLIERS.map((a) => (
                  <tr key={a.asset} className="border-b border-border/60 last:border-0">
                    <td className="px-2 py-3">{a.asset}</td>
                    <td className="px-2 py-3 text-muted-foreground">{a.venue}</td>
                    <td className="px-2 py-3 text-right">
                      <span className={`font-mono ${a.multiplier === 1.5 ? "text-emerald-300" : a.multiplier === 1.3 ? "text-violet-300" : "text-muted-foreground"}`}>
                        {a.multiplier.toFixed(1)}×
                      </span>
                    </td>
                  </tr>
                ))}
                <tr className="text-muted-foreground">
                  <td className="px-2 py-3 italic">All other assets</td>
                  <td className="px-2 py-3">—</td>
                  <td className="px-2 py-3 text-right font-mono">1.0×</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EmissionCard({ token, rate, accent }) {
  const accentMap = {
    emerald: "from-emerald-500/15 to-transparent text-emerald-300 border-emerald-500/30",
    violet: "from-violet-500/15 to-transparent text-violet-300 border-violet-500/30",
  };
  const progress = ((token.start - rate) / (token.start - token.floor)) * 100;
  return (
    <Card className={`bg-gradient-to-b ${accentMap[accent]} bg-card/60 backdrop-blur-sm border`}>
      <CardHeader className="pb-3">
        <CardDescription className="font-mono text-xs uppercase tracking-widest">{token.name} emission</CardDescription>
        <CardTitle className="font-display text-3xl font-semibold tracking-tight pt-1">
          {formatNumber(rate, 4)} <span className="text-base font-normal text-muted-foreground">/ USD</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Start {token.start}</span>
          <span>Floor {token.floor}</span>
        </div>
        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
          <div
            className={`h-full rounded-full ${accent === "emerald" ? "bg-emerald-400" : "bg-violet-400"}`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Current rate per $1 of verified gross USD value.
        </p>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, icon: Icon }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      <div className="font-mono text-sm">{value}</div>
    </div>
  );
}

function formatCountdown(sec) {
  if (sec <= 0) return "Now";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${sec % 60}s`;
}