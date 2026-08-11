"use client";

import { AlertTriangle } from "lucide-react";
import { useSeismo } from "@/lib/store";
import { cn } from "@/lib/utils";

/** Prominent banner shown whenever the active data source is DEV-SEED.
 *  Communicates clearly that displayed earthquakes are NOT real. */
export function DevDataBanner({ className }: { className?: string }) {
  const show = useSeismo((s) => s.settings.showDevBanner);
  const dismiss = useSeismo((s) => s.toggleSetting);
  if (!show) return null;
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200",
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden="true" />
      <p className="flex-1 leading-snug">
        <strong className="font-semibold">DEVELOPMENT DATA.</strong> Earthquakes shown are
        clearly-labeled synthetic fixtures (source: DEV-SEED), not real PHIVOLCS bulletins. The
        production system ingests authoritative DOST-PHIVOLCS data via the documented adapter.
      </p>
      <button
        onClick={() => dismiss("showDevBanner")}
        className="shrink-0 rounded px-1.5 py-0.5 text-amber-300/80 hover:bg-amber-500/20 hover:text-amber-200"
        aria-label="Dismiss development data banner"
      >
        ✕
      </button>
    </div>
  );
}
