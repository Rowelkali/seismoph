"use client";

import { cn } from "@/lib/utils";
import { useSeismo, type LayerState } from "@/lib/store";
import { Layers, MapPin, Mountain, Waves, Building2, Flame, Grid3x3, Radio } from "lucide-react";

const LAYER_META: { key: keyof LayerState; label: string; icon: React.ElementType }[] = [
  { key: "earthquakes", label: "Earthquakes", icon: Radio },
  { key: "intensityRings", label: "Intensity rings", icon: Waves },
  { key: "faults", label: "Active faults", icon: Flame },
  { key: "cities", label: "Cities", icon: Building2 },
  { key: "provinces", label: "Provinces", icon: Grid3x3 },
  { key: "terrain", label: "Terrain", icon: Mountain },
  { key: "heatmap", label: "Heatmap", icon: MapPin },
];

export function LayerControl({ className }: { className?: string }) {
  const layers = useSeismo((s) => s.layers);
  const toggleLayer = useSeismo((s) => s.toggleLayer);
  return (
    <div className={cn("glass-strong rounded-lg p-2", className)}>
      <div className="flex items-center gap-1.5 px-1 pb-1.5 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
        <Layers className="h-3.5 w-3.5" /> Layers
      </div>
      <div className="grid gap-0.5">
        {LAYER_META.map(({ key, label, icon: Icon }) => {
          const on = layers[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleLayer(key)}
              aria-pressed={on}
              className={cn(
                "flex items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors",
                on ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-accent/40",
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1">{label}</span>
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  on ? "bg-primary" : "bg-muted-foreground/40",
                )}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
