"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useRecentEarthquakes } from "@/hooks/use-seismo-data";
import { useSeismo } from "@/lib/store";
import { MagnitudeBadge } from "./MagnitudeBadge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, X, Shield, MapPin } from "lucide-react";
import { formatPHT } from "@/lib/ui";
import type { EarthquakeEvent } from "@/lib/types";

/** Emergency Mode — when a significant earthquake (M6+) is detected in the
 *  latest events, the UI enters a focused emergency state with safety info.
 *  This is NOT an official warning — it's a visual priority mode that surfaces
 *  the event + safety guidance. Official warnings come only from PHIVOLCS.
 */
export function EmergencyMode() {
  const { data: recent } = useRecentEarthquakes(10);
  const setView = useSeismo((s) => s.setView);
  const select = useSeismo((s) => s.selectEarthquake);
  const [dismissed, setDismissed] = useState(false);

  // Check the most recent events for M6+ within the last 2 hours.
  // Computed inline (not in an effect) — this is derived state, not a side effect.
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  const significantEvent = dismissed ? null : recent.find(
    (eq) => eq.magnitude >= 6.0 && new Date(eq.originTime).getTime() > twoHoursAgo,
  ) ?? null;

  if (!significantEvent) return null;

  return (
    <div
      role="alert"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 backdrop-blur-sm p-4 pt-16"
    >
      <div className="glass-strong w-full max-w-lg rounded-xl border-2 border-red-500/60 glow-danger overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-red-500/30 bg-red-500/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-400 animate-seismo-blink" />
            <span className="font-mono text-sm font-bold uppercase tracking-wider text-red-400">
              Significant Earthquake
            </span>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDismissed(true)} aria-label="Dismiss">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <MagnitudeBadge magnitude={significantEvent.magnitude} magnitudeType={significantEvent.magnitudeType} size="lg" />
              <p className="mt-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Magnitude</p>
            </div>
            <div className="text-center">
              <p className="font-mono text-2xl text-foreground">{Math.round(significantEvent.depthKm)} km</p>
              <p className="mt-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Depth</p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card/40 p-3 text-sm">
            <p className="flex items-start gap-1.5">
              <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              <span>{significantEvent.locationDescription}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground font-mono">
              {formatPHT(significantEvent.originTime)} PHT · {significantEvent.latitude.toFixed(3)}°, {significantEvent.longitude.toFixed(3)}°
            </p>
          </div>

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
            <p className="flex items-center gap-1.5 font-semibold text-amber-400">
              <Shield className="h-3.5 w-3.5" /> Safety guidance
            </p>
            <ul className="mt-1.5 space-y-0.5 text-muted-foreground">
              <li>• Drop, Cover, and Hold On if you feel shaking.</li>
              <li>• Stay away from windows, heavy furniture, and exterior walls.</li>
              <li>• If near the coast, move to higher ground immediately.</li>
              <li>• Follow instructions from DOST-PHIVOLCS and local authorities.</li>
            </ul>
          </div>

          <p className="text-[10px] text-muted-foreground italic">
            This is NOT an official warning. Official information comes from DOST-PHIVOLCS.
            This notification is a visual priority mode for significant events.
          </p>

          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={() => { select(significantEvent); setDismissed(true); }}
            >
              View event details
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => { setView("safety"); setDismissed(true); }}
            >
              Safety information
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
