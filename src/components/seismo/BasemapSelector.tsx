"use client";

import { cn } from "@/lib/utils";
import { useSeismo } from "@/lib/store";
import type { BasemapId } from "@/components/map/EarthquakeMap";
import { Map as MapIcon, Moon, Sun, Mountain, Satellite, Globe } from "lucide-react";

const OPTIONS: { id: BasemapId; label: string; icon: React.ElementType; description: string }[] = [
  { id: "dark", label: "Dark", icon: Moon, description: "CARTO dark matter" },
  { id: "light", label: "Light", icon: Sun, description: "CARTO positron" },
  { id: "satellite", label: "Satellite", icon: Satellite, description: "Esri World Imagery" },
  { id: "topo", label: "Topo", icon: Mountain, description: "OpenTopoMap terrain" },
  { id: "globe3d", label: "3D Globe", icon: Globe, description: "3D interactive globe with underground hypocenter visualization" },
];

/** Compact basemap style selector — appears as a small row of buttons. */
export function BasemapSelector({ className }: { className?: string }) {
  const basemap = useSeismo((s) => s.settings.basemap);
  const setBasemap = useSeismo((s) => s.setSetting);

  return (
    <div className={cn("glass-strong rounded-lg p-2", className)}>
      <div className="flex items-center gap-1.5 px-1 pb-1.5 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
        <MapIcon className="h-3.5 w-3.5" /> Map style
      </div>
      <div className="grid grid-cols-2 gap-1">
        {OPTIONS.map(({ id, label, icon: Icon, description }) => {
          const active = basemap === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setBasemap("basemap", id)}
              title={description}
              aria-pressed={active}
              className={cn(
                "flex items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs transition-colors",
                active
                  ? "bg-primary/15 text-foreground border border-primary/40"
                  : "text-muted-foreground hover:bg-accent/40 border border-transparent",
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1">{label}</span>
              {active && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
