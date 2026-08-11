"use client";

import { cn } from "@/lib/utils";
import { MagnitudeBadge, DepthTag } from "./MagnitudeBadge";
import { timeAgoPHT } from "@/lib/ui";
import type { EarthquakeEvent } from "@/lib/types";
import { MapPin } from "lucide-react";

interface Props {
  eq: EarthquakeEvent;
  selected?: boolean;
  compact?: boolean;
  onClick?: () => void;
  className?: string;
}

/** Compact earthquake list row. Clickable to select on the map. */
export function EventCard({ eq, selected, compact, onClick, className }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "group w-full text-left rounded-lg border px-3 py-2.5 transition-colors",
        "hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected ? "border-primary/60 bg-primary/10 glow-amber" : "border-border bg-card/40",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <MagnitudeBadge magnitude={eq.magnitude} magnitudeType={eq.magnitudeType} size={compact ? "sm" : "md"} />
        <DepthTag depthKm={eq.depthKm} className="text-muted-foreground" />
      </div>
      <p className="mt-1.5 text-sm leading-snug line-clamp-2">
        <MapPin className="inline h-3 w-3 mr-1 -mt-0.5 text-muted-foreground" aria-hidden="true" />
        {eq.locationDescription}
      </p>
      <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
        <span>{timeAgoPHT(eq.originTime)}</span>
        <span className="uppercase tracking-wider">{eq.status}</span>
      </div>
      {eq.source === "DEV-SEED" && (
        <span className="mt-1 inline-block rounded bg-amber-500/15 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-400">
          Dev fixture
        </span>
      )}
    </button>
  );
}
