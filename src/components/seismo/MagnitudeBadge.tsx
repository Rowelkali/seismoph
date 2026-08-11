"use client";

import { cn } from "@/lib/utils";
import { severityOf, SEVERITY_CLASS, SEVERITY_LABEL, SEVERITY_COLOR } from "@/lib/ui";
import { depthClass } from "@/lib/geo";

interface Props {
  magnitude: number;
  magnitudeType?: string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

/** Colored magnitude pill. Color encodes severity but is ALWAYS paired with
 *  a numeric label + accessible alt text (never color alone). */
export function MagnitudeBadge({ magnitude, magnitudeType = "Mw", size = "md", showLabel = true, className }: Props) {
  const sev = severityOf(magnitude);
  const sizes = {
    sm: "h-6 min-w-[3rem] text-xs px-2",
    md: "h-8 min-w-[4rem] text-sm px-2.5",
    lg: "h-11 min-w-[5.5rem] text-base px-3",
  } as const;
  return (
    <span
      role="img"
      aria-label={`Magnitude ${magnitude.toFixed(1)} ${magnitudeType}, ${SEVERITY_LABEL[sev]}`}
      className={cn(
        "inline-flex items-center justify-center rounded-md font-mono font-semibold tabular-nums border",
        SEVERITY_CLASS[sev],
        "border-current/20",
        sizes[size],
        className,
      )}
      style={{ color: SEVERITY_COLOR[sev], background: `color-mix(in oklch, ${SEVERITY_COLOR[sev]} 14%, transparent)` }}
    >
      <span className="opacity-70 mr-0.5 text-[0.7em]">{magnitudeType}</span>
      {magnitude.toFixed(1)}
      {showLabel && (
        <span className="sr-only">, {SEVERITY_LABEL[sev]}</span>
      )}
    </span>
  );
}

export function DepthTag({ depthKm, className }: { depthKm: number; className?: string }) {
  const dc = depthClass(depthKm);
  const label = dc === "shallow" ? "Shallow" : dc === "intermediate" ? "Intermediate" : "Deep";
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium tabular-nums", className)}
      title={`Focal depth ${Math.round(depthKm)} km — ${label}`}
    >
      <span aria-hidden="true">▼</span>
      {Math.round(depthKm)} km
    </span>
  );
}
