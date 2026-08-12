"use client";

import { cn } from "@/lib/utils";
import { MagnitudeBadge } from "./MagnitudeBadge";
import { normalizeLocation } from "@/lib/text-utils";
import { timeAgoPHT } from "@/lib/ui";
import { useSeismo } from "@/lib/store";
import type { EarthquakeEvent } from "@/lib/types";
import { Radio, Activity } from "lucide-react";

interface Props {
  events: EarthquakeEvent[];
  onPick?: (eq: EarthquakeEvent) => void;
  className?: string;
  connected?: boolean;
}

/** Bottom realtime event stream / ticker. Shows the freshest events. */
export function EventStream({ events, onPick, className, connected }: Props) {
  return (
    <div className={cn("glass-strong rounded-lg px-2 py-1.5", className)}>
      <div className="flex items-center gap-2">
        <div className="flex shrink-0 items-center gap-1.5 border-r border-border pr-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          <Activity className={cn("h-3.5 w-3.5", connected ? "text-emerald-400" : "text-muted-foreground")} />
          {connected ? "Live stream" : "Stream paused"}
        </div>
        <div className="flex-1 overflow-x-auto scroll-slim">
          {events.length === 0 ? (
            <p className="py-1 text-xs text-muted-foreground">Waiting for new earthquake events…</p>
          ) : (
            <div className="flex items-center gap-1.5 py-0.5">
              {events.slice(0, 24).map((eq) => (
                <button
                  key={eq.id}
                  onClick={() => onPick?.(eq)}
                  className="group flex shrink-0 items-center gap-1.5 rounded border border-border bg-card/40 px-1.5 py-1 transition-colors hover:border-primary/60 hover:bg-primary/10"
                  title={`${eq.magnitude.toFixed(1)} · ${normalizeLocation(eq.locationDescription)} · ${timeAgoPHT(eq.originTime)}`}
                >
                  <Radio className="h-3 w-3 text-primary" />
                  <MagnitudeBadge magnitude={eq.magnitude} magnitudeType={eq.magnitudeType} size="sm" showLabel={false} />
                  <span className="max-w-[120px] truncate text-[11px] text-muted-foreground group-hover:text-foreground">
                    {normalizeLocation(eq.locationDescription)}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">{timeAgoPHT(eq.originTime)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
