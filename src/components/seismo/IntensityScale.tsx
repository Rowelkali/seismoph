"use client";

import { cn } from "@/lib/utils";
import { peisDescription } from "@/lib/ui";

const PEIS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

const PEIS_COLOR: Record<string, string> = {
  I: "oklch(0.7 0.02 240)",
  II: "oklch(0.72 0.1 185)",
  III: "oklch(0.76 0.12 160)",
  IV: "oklch(0.8 0.14 130)",
  V: "oklch(0.82 0.15 90)",
  VI: "oklch(0.78 0.17 65)",
  VII: "oklch(0.74 0.19 45)",
  VIII: "oklch(0.68 0.21 30)",
  IX: "oklch(0.6 0.23 20)",
  X: "oklch(0.5 0.24 15)",
};

/** Horizontal PEIS intensity scale legend (used in detail panel & safety page). */
export function IntensityScale({ active, className }: { active?: string; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex h-7 overflow-hidden rounded-md">
        {PEIS.map((p) => {
          const isActive = active && active.toUpperCase() === p;
          return (
            <div
              key={p}
              className="flex flex-1 items-center justify-center text-[10px] font-mono font-bold"
              style={{
                background: PEIS_COLOR[p],
                color: "oklch(0.12 0 0)",
                outline: isActive ? "2px solid oklch(0.96 0 0)" : "none",
                outlineOffset: isActive ? "-2px" : undefined,
                zIndex: isActive ? 1 : 0,
              }}
              title={`PEIS ${p} — ${peisDescription(p)}`}
            >
              {p}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
        <span>Scarcely perceptible</span>
        <span>Completely devastating</span>
      </div>
    </div>
  );
}
