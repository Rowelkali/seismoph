"use client";

import { cn } from "@/lib/utils";
import { useSeismo, type LayerState } from "@/lib/store";
import {
  Layers, MapPin, Mountain, Waves, Building2, Flame, Radio,
  LocateFixed, AlertTriangle, Grid3x3,
} from "lucide-react";

const LAYER_META: { key: keyof LayerState; label: string; icon: React.ElementType; desc?: string }[] = [
  { key: "earthquakes", label: "Earthquakes", icon: Radio, desc: "Real-time earthquake markers" },
  { key: "userLocation", label: "Your location", icon: LocateFixed, desc: "Show your current location on the map" },
  { key: "intensityRings", label: "Intensity rings", icon: Waves, desc: "Expanding rings for M4.5+ events" },
  { key: "faults", label: "Active faults", icon: Flame, desc: "Official DOST-PHIVOLCS fault traces" },
  { key: "cities", label: "Cities", icon: Building2, desc: "Major Philippine cities" },
  { key: "terrain", label: "Terrain", icon: Mountain, desc: "3D elevation (slow to load)" },
  { key: "heatmap", label: "Density heatmap", icon: MapPin, desc: "Historical earthquake density — NOT a prediction" },
  { key: "hazards", label: "Hazard layers", icon: AlertTriangle, desc: "Official PHIVOLCS ground shaking, liquefaction, landslide, tsunami" },
];

export function LayerControl({ className }: { className?: string }) {
  const layers = useSeismo((s) => s.layers);
  const toggleLayer = useSeismo((s) => s.toggleLayer);
  return (
    <div className={cn("glass-strong rounded-lg p-2", className)}>
      <div className="flex items-center gap-1.5 px-1 pb-1.5 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
        <Layers className="h-3.5 w-3.5" /> Map layers
      </div>
      <div className="grid gap-0.5">
        {LAYER_META.map(({ key, label, icon: Icon, desc }) => {
          const on = layers[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleLayer(key)}
              aria-pressed={on}
              title={desc}
              className={cn(
                "flex items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors",
                on ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-accent/40",
              )}
            >
              <Icon className={cn("h-3.5 w-3.5 shrink-0", on && "text-primary")} />
              <span className="flex-1">{label}</span>
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-colors",
                  on ? "bg-primary" : "bg-muted-foreground/40",
                )}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
      {layers.heatmap && (
        <p className="mt-1.5 px-1 text-[9px] text-muted-foreground italic leading-snug">
          Historical earthquake density. Not a prediction of future earthquakes.
        </p>
      )}
    </div>
  );
}
