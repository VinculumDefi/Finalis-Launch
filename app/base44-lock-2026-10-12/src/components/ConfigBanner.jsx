import React from "react";
import { AlertTriangle } from "lucide-react";
import { contractsConfigured, CONTRACTS, LAUNCH_TIMESTAMP } from "@/lib/protocolConfig";

export default function ConfigBanner({ scope = "all" }) {
  const missing = [];
  if (scope === "lock" || scope === "all") if (!CONTRACTS.lock) missing.push("Lock contract");
  if (scope === "forge" || scope === "all") {
    if (!CONTRACTS.forge) missing.push("Forge contract");
    if (!CONTRACTS.vclm) missing.push("VCLM token");
    if (!CONTRACTS.chonx) missing.push("CHONX token");
    if (!CONTRACTS.synth) missing.push("SYNTH token");
  }
  if (scope === "issuance" && !LAUNCH_TIMESTAMP) missing.push("Launch timestamp");

  if (!missing.length && (scope !== "issuance" || LAUNCH_TIMESTAMP)) {
    if (scope !== "issuance" && !contractsConfigured() && scope === "all") {
      // fallthrough handled below
    } else {
      return null;
    }
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200/90">
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-400" />
      <div>
        <p className="font-medium text-amber-100">Awaiting deploy configuration</p>
        <p className="text-amber-200/70 mt-0.5">
          {missing.length
            ? `${missing.join(", ")} not configured. `
            : ""}
          Fill the placeholder addresses in <code className="font-mono text-amber-100">src/lib/protocolConfig.js</code> after deploying the protocol.
        </p>
      </div>
    </div>
  );
}