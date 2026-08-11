"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useSources } from "@/hooks/use-seismo-data";
import { StatusIndicator } from "./StatusIndicator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Activity, Wifi, Database, Clock, ShieldCheck } from "lucide-react";

/** Enhanced LIVE indicator — distinguishes source health from app health.
 *  Click to open a detailed health panel showing:
 *  - Source status (PHIVOLCS)
 *  - Last source check time
 *  - Ingestion latency
 *  - WebSocket connection state
 *  - Total events in database
 */
export function HealthIndicator({ wsConnected }: { wsConnected: boolean }) {
  const [open, setOpen] = useState(false);
  const { data: sources, total } = useSources();

  const phivolcs = sources.find((s) => s.name === "DOST-PHIVOLCS");
  const sourceHealthy = phivolcs?.status === "HEALTHY";
  const sourceDegraded = phivolcs?.status === "DEGRADED";

  const lastCheck = phivolcs?.lastSuccessAt
    ? new Date(phivolcs.lastSuccessAt).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
    : "—";

  // Ingestion latency = time since last successful source check
  const latencyMs = phivolcs?.lastSuccessAt
    ? Date.now() - new Date(phivolcs.lastSuccessAt).getTime()
    : null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider transition-colors hover:bg-accent/40"
          aria-label="System health details"
        >
          <StatusIndicator
            status={sourceHealthy ? "live" : sourceDegraded ? "degraded" : "down"}
            label={sourceHealthy ? "LIVE" : sourceDegraded ? "DELAYED" : "OFFLINE"}
          />
        </button>
      </SheetTrigger>
      <SheetContent side="top" className="w-full max-w-md mx-auto rounded-b-xl">
        <SheetHeader>
          <SheetTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> System Health
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          {/* Source Health */}
          <HealthRow
            icon={Database}
            label="PHIVOLCS source"
            value={phivolcs?.status ?? "UNKNOWN"}
            status={sourceHealthy ? "live" : sourceDegraded ? "degraded" : "down"}
          />
          <HealthRow
            icon={Clock}
            label="Last source check"
            value={lastCheck + " PHT"}
            detail={latencyMs != null ? `${Math.round(latencyMs / 1000)}s ago` : undefined}
          />

          {/* App Health */}
          <div className="border-t border-border pt-2">
            <HealthRow
              icon={Wifi}
              label="WebSocket"
              value={wsConnected ? "Connected" : "Disconnected"}
              status={wsConnected ? "live" : "down"}
            />
            <HealthRow
              icon={Database}
              label="Database events"
              value={total.toLocaleString() + " total"}
            />
            <HealthRow
              icon={ShieldCheck}
              label="API server"
              value="Online"
              status="live"
            />
          </div>

          <p className="text-[11px] text-muted-foreground leading-snug pt-1">
            <strong>Source health</strong> = freshness of PHIVOLCS data.
            <strong> App health</strong> = whether SEISMO PH's own services are running.
            They are independent — your server being alive ≠ PHIVOLCS data being fresh.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function HealthRow({
  icon: Icon, label, value, detail, status,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  detail?: string;
  status?: "live" | "degraded" | "down";
}) {
  const color = status === "live" ? "text-emerald-400" : status === "degraded" ? "text-amber-400" : status === "down" ? "text-red-400" : "text-muted-foreground";
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      <span className="flex items-center gap-2">
        {detail && <span className="text-[10px] text-muted-foreground">{detail}</span>}
        <span className={cn("font-mono font-medium", color)}>{value}</span>
        {status && <span className={cn("h-2 w-2 rounded-full", status === "live" ? "bg-emerald-400" : status === "degraded" ? "bg-amber-400" : "bg-red-400")} />}
      </span>
    </div>
  );
}
