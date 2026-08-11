"use client";

import { useState } from "react";
import { useSeismo } from "@/lib/store";
import { useLocationSearch, useNearest, apiGet } from "@/hooks/use-seismo-data";
import { LoadingState, ErrorState, EmptyState } from "@/components/seismo/States";
import { MagnitudeBadge } from "@/components/seismo/MagnitudeBadge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin, Search, Navigation, LocateFixed } from "lucide-react";
import { formatPHTShort } from "@/lib/ui";
import { bearingLabel } from "@/lib/geo";
import type { GeoLocation } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/** City/location intelligence: search + nearest earthquakes + distance. */
export function LocationsPanel({ className }: { className?: string }) {
  const [q, setQ] = useState("");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const { data: results, loading: searching } = useLocationSearch(q);
  const { data: nearest, location, loading: nearestLoading } = useNearest(pickedId);
  const setUserLocation = useSeismo((s) => s.setUserLocation);
  const select = useSeismo((s) => s.selectEarthquake);

  const pick = (loc: GeoLocation) => {
    setPickedId(loc.id);
    setUserLocation({ id: loc.id, name: loc.name, latitude: loc.latitude, longitude: loc.longitude });
    toast.success(`Tracking ${loc.name}`);
  };

  const useGeolocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported by this browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserLocation({ name: "My location", latitude, longitude });
        // Try to find nearest known location for labeling
        try {
          const r = await apiGet<{ data: GeoLocation[] }>(`/api/locations/search?q=&limit=1`);
          void r;
        } catch { /* ignore */ }
        toast.success("Using your current location (coarse)");
      },
      () => toast.error("Location permission denied. You can search a city instead."),
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 8000 },
    );
  };

  return (
    <div className={cn("flex flex-col min-h-0", className)}>
      <h2 className="flex items-center gap-1.5 px-1 pb-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground">
        <MapPin className="h-3.5 w-3.5 text-primary" /> Location intelligence
      </h2>

      <div className="glass rounded-lg p-2.5 space-y-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search city, municipality, province…"
            className="h-8 pl-7 text-xs"
            aria-label="Search Philippine locations"
          />
        </div>
        <Button size="sm" variant="outline" onClick={useGeolocation} className="h-7 w-full text-xs">
          <LocateFixed className="h-3.5 w-3.5" /> Use my current location
        </Button>
        <p className="text-[10px] text-muted-foreground">
          Location is used only to compute distances and trigger alerts. It is not stored server-side
          unless you create an alert subscription.
        </p>
      </div>

      {q.trim().length >= 2 && (
        <div className="mt-2 rounded-md border border-border bg-card/30">
          {searching ? (
            <LoadingState label="Searching…" className="p-3" />
          ) : results.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">No matches.</p>
          ) : (
            <ScrollArea className="max-h-48 scroll-slim">
              <ul className="divide-y divide-border">
                {results.map((loc) => (
                  <li key={loc.id}>
                    <button
                      onClick={() => pick(loc)}
                      className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-accent/40"
                    >
                      <span>
                        <span className="font-medium">{loc.name}</span>
                        <span className="ml-1 text-[10px] uppercase tracking-wider text-muted-foreground">{loc.type}</span>
                        {loc.province && <span className="ml-1 text-muted-foreground">· {loc.province}</span>}
                      </span>
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </div>
      )}

      <ScrollArea className="mt-2 flex-1 scroll-slim pr-2">
        {!pickedId ? (
          <EmptyState
            icon={<Navigation className="h-6 w-6" />}
            title="Pick a location"
            description="Search above to find the nearest earthquakes, distances and reported intensity for a Philippine city or municipality."
          />
        ) : nearestLoading ? (
          <LoadingState label="Finding nearest earthquakes…" />
        ) : nearest.length === 0 ? (
          <EmptyState title="No nearby earthquakes found" description="No recent earthquake activity within range of this location." />
        ) : (
          <div className="space-y-2">
            {location && (
              <div className="rounded-md border border-primary/30 bg-primary/5 p-2 text-xs">
                <div className="font-medium">{location.name}</div>
                <div className="text-[10px] text-muted-foreground">{location.type} · {location.latitude.toFixed(3)}°, {location.longitude.toFixed(3)}°</div>
              </div>
            )}
            {nearest.map((n) => (
              <div key={n.earthquake.id} className="rounded-md border border-border bg-card/40 p-2">
                <div className="flex items-center justify-between gap-2">
                  <MagnitudeBadge magnitude={n.earthquake.magnitude} magnitudeType={n.earthquake.magnitudeType} size="sm" />
                  <span className="font-mono text-sm text-foreground">{n.distanceKm} km</span>
                </div>
                <p className="mt-1 text-xs leading-snug line-clamp-2">{n.earthquake.locationDescription}</p>
                <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                  <span>{formatPHTShort(n.earthquake.originTime)}</span>
                  <span>{bearingLabel(n.bearingDeg)} {n.bearingDeg}°</span>
                </div>
                {n.hasIntensityForLocation ? (
                  <div className="mt-1 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-mono text-primary">
                    Reported intensity at this location: PEIS {n.reportedIntensity}
                  </div>
                ) : (
                  <p className="mt-1 text-[10px] italic text-muted-foreground">
                    No reported intensity available for this location.
                  </p>
                )}
                <Button size="sm" variant="ghost" className="mt-1 h-6 w-full text-[11px]" onClick={() => select(n.earthquake)}>
                  Inspect event
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
