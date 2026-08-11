"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useSeismo } from "@/lib/store";
import { useRecentEarthquakes, useRealtime, useEarthquake } from "@/hooks/use-seismo-data";
import { TopBar } from "@/components/seismo/TopBar";
import { DevDataBanner } from "@/components/seismo/DevDataBanner";
import { LeftNav, MobileNav } from "@/components/seismo/LeftNav";
import { LayerControl } from "@/components/seismo/LayerControl";
import { EventStream } from "@/components/seismo/EventStream";
import { DetailPanel } from "@/components/seismo/DetailPanel";
import { LivePanel } from "@/components/panels/LivePanel";
import { HistoryPanel } from "@/components/panels/HistoryPanel";
import { LocationsPanel } from "@/components/panels/LocationsPanel";
import { AlertsPanel } from "@/components/panels/AlertsPanel";
import { AnalyticsPanel } from "@/components/panels/AnalyticsPanel";
import { SafetyPanel } from "@/components/panels/SafetyPanel";
import { AboutPanel } from "@/components/panels/AboutPanel";
import type { EarthquakeEvent } from "@/lib/types";
import {
  Crosshair, Plus, Minus, Mountain, Compass, X, Layers as LayersIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const EarthquakeMap = dynamic(
  () => import("@/components/map/EarthquakeMap").then((m) => m.EarthquakeMap),
  { ssr: false, loading: () => <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">Loading 3D map…</div> },
);

const MAP_VIEWS = new Set(["live", "earthquakes", "history", "locations", "alerts"]);
const OVERLAY_VIEWS = new Set(["analytics", "safety", "about"]);

export default function Home() {
  const view = useSeismo((s) => s.view);
  const setView = useSeismo((s) => s.setView);
  const layers = useSeismo((s) => s.layers);
  const toggleLayer = useSeismo((s) => s.toggleLayer);
  const selected = useSeismo((s) => s.selectedEarthquake);
  const select = useSeismo((s) => s.selectEarthquake);
  const settings = useSeismo((s) => s.settings);
  const stream = useSeismo((s) => s.stream);
  const pushStreamEvent = useSeismo((s) => s.pushStreamEvent);
  const setWsConnected = useSeismo((s) => s.setWsConnected);

  const { data: recent, asOf, reload } = useRecentEarthquakes(120);
  const { data: selectedFull, loading: selLoading } = useEarthquake(selected?.id ?? null);

  const [command, setCommand] = useState<{ action: "reset" | "zoomIn" | "zoomOut"; nonce: number } | null>(null);
  const [layerOpen, setLayerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Merge realtime stream events into the map dataset (most recent first, dedup).
  const mapEarthquakes = useMemo(() => {
    const seen = new Set<string>();
    const merged: EarthquakeEvent[] = [];
    for (const e of stream) {
      if (!seen.has(e.id)) { seen.add(e.id); merged.push(e); }
    }
    for (const e of recent) {
      if (!seen.has(e.id)) { seen.add(e.id); merged.push(e); }
    }
    return merged;
  }, [recent, stream]);

  // WebSocket realtime.
  const { connected } = useRealtime({
    onCreated: (eq) => {
      pushStreamEvent(eq);
      // Auto-select significant new events briefly? No — just toast.
      if (eq.magnitude >= 5) {
        toast.success(`New M${eq.magnitude.toFixed(1)} earthquake`, { description: eq.locationDescription });
      }
    },
    onAlert: (a) => {
      toast.warning(`Alert triggered: M${a.earthquake.magnitude.toFixed(1)}`, {
        description: a.earthquake.locationDescription,
        action: { label: "View", onClick: () => select(a.earthquake) },
      });
    },
  });
  useEffect(() => { setWsConnected(connected); }, [connected, setWsConnected]);

  const flyTo = useMemo(() => {
    if (!selected) return null;
    return { lon: selected.longitude, lat: selected.latitude, zoom: 7.5 };
  }, [selected]);

  const trigger = useCallback((action: "reset" | "zoomIn" | "zoomOut") => {
    setCommand({ action, nonce: Date.now() });
  }, []);

  const isMap = MAP_VIEWS.has(view);
  const isOverlay = OVERLAY_VIEWS.has(view);

  // reduced-motion class on root for CSS hook
  const rootClass = cn("flex h-[100dvh] flex-col overflow-hidden", settings.reducedMotion && "seismo-reduced-motion");

  return (
    <div className={rootClass}>
      <TopBar wsConnected={connected} onOpenSearch={() => { setView("locations"); }} />

      {/* Search overlay trigger when locations view requested from topbar */}
      {searchOpen && <div />}

      {!isOverlay && <DevDataBanner />}

      <main className="relative flex min-h-0 flex-1">
        {/* Map (always mounted to preserve state; hidden under overlays) */}
        <div className={cn("absolute inset-0", isOverlay && "hidden")}>
          <EarthquakeMap
            earthquakes={mapEarthquakes}
            selectedId={selected?.id}
            onSelect={(eq) => select(eq)}
            layers={layers}
            reducedMotion={settings.reducedMotion}
            dataSaver={settings.dataSaver}
            flyTo={flyTo}
            command={command}
            className="absolute inset-0 h-full w-full"
          />
        </div>

        {/* Left floating panel (desktop) */}
        {isMap && (
          <aside className="pointer-events-none absolute left-3 top-3 bottom-3 z-20 hidden w-80 flex-col gap-2 md:flex">
            <div className="glass-strong pointer-events-auto rounded-lg p-2">
              <LeftNav />
            </div>
            <div className="glass-strong pointer-events-auto flex min-h-0 flex-1 flex-col rounded-lg p-2">
              {view === "live" && <LivePanel className="flex-1" />}
              {view === "earthquakes" && <LivePanel className="flex-1" title="All earthquakes" limit={120} />}
              {view === "history" && <HistoryPanel className="flex-1" />}
              {view === "locations" && <LocationsPanel className="flex-1" />}
              {view === "alerts" && <AlertsPanel className="flex-1" />}
            </div>
          </aside>
        )}

        {/* Layer control (top-right) */}
        {isMap && (
          <div className="absolute right-3 top-3 z-20 flex flex-col items-end gap-2">
            <Button
              variant="outline"
              size="icon"
              className="glass-strong h-9 w-9 rounded-lg border-border md:hidden"
              onClick={() => setLayerOpen((o) => !o)}
              aria-label="Toggle layers"
            >
              <LayersIcon className="h-4 w-4" />
            </Button>
            <div className={cn("hidden md:block", layerOpen && "block")}>
              <LayerControl className="w-52" />
            </div>
          </div>
        )}

        {/* Camera controls (right-center vertical) */}
        {isMap && (
          <div className="absolute right-3 top-1/2 z-20 hidden -translate-y-1/2 flex-col gap-1.5 md:flex">
            <CamBtn label="Zoom in" onClick={() => trigger("zoomIn")}><Plus className="h-4 w-4" /></CamBtn>
            <CamBtn label="Zoom out" onClick={() => trigger("zoomOut")}><Minus className="h-4 w-4" /></CamBtn>
            <CamBtn label="Reset view" onClick={() => trigger("reset")}><Compass className="h-4 w-4" /></CamBtn>
            <CamBtn label="Toggle terrain" active={layers.terrain} onClick={() => toggleLayer("terrain")}><Mountain className="h-4 w-4" /></CamBtn>
          </div>
        )}

        {/* Right detail panel (desktop) */}
        {isMap && (
          <aside className="absolute right-3 top-3 bottom-3 z-20 hidden w-96 md:block" style={{ right: "calc(3rem + 1.5rem)" }}>
            <DetailPanel
              earthquake={selectedFull ?? selected}
              loading={selLoading}
              onClose={() => select(null)}
              className="h-full"
            />
          </aside>
        )}

        {/* Bottom event stream */}
        {isMap && (
          <div className="absolute bottom-3 left-3 right-3 z-20 md:left-[21rem] md:right-[26rem]">
            <EventStream events={stream.length > 0 ? stream : mapEarthquakes.slice(0, 12)} onPick={(eq) => select(eq)} connected={connected} />
          </div>
        )}

        {/* Mobile detail bottom sheet */}
        {isMap && selected && (
          <div className="absolute inset-x-0 bottom-0 z-30 md:hidden">
            <div className="glass-strong max-h-[70vh] overflow-y-auto scroll-slim rounded-t-xl border-t border-border">
              <div className="flex justify-center pt-1.5">
                <span className="h-1 w-10 rounded-full bg-muted-foreground/40" />
              </div>
              <DetailPanel earthquake={selectedFull ?? selected} loading={selLoading} onClose={() => select(null)} />
            </div>
          </div>
        )}

        {/* Mobile bottom nav */}
        {isMap && (
          <div className="absolute inset-x-0 bottom-0 z-10 md:hidden">
            <MobileNav />
          </div>
        )}

        {/* Overlay sheets (analytics / safety / about) */}
        {isOverlay && (
          <div className="absolute inset-0 z-30 flex flex-col bg-background/95 backdrop-blur">
            <div className="flex items-center justify-between border-b border-border px-3">
              <Button variant="ghost" size="sm" onClick={() => setView("live")} className="h-9">
                <X className="h-4 w-4" /> Close
              </Button>
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">SEISMO PH</span>
            </div>
            <div className="min-h-0 flex-1">
              {view === "analytics" && <AnalyticsPanel className="h-full" />}
              {view === "safety" && <SafetyPanel className="h-full" />}
              {view === "about" && <AboutPanel className="h-full" />}
            </div>
          </div>
        )}
      </main>

      {/* Sticky attribution footer */}
      <footer className="mt-auto flex h-7 shrink-0 items-center justify-between gap-2 border-t border-border bg-background/95 px-3 text-[10px] text-muted-foreground">
        <span className="truncate">
          Earthquake data: <strong className="text-foreground">USGS</strong> (live, real-time) · PHIVOLCS adapter ready for production.
          Basemap © OpenStreetMap, © CARTO · Terrain: AWS.
        </span>
        <span className="hidden shrink-0 items-center gap-2 sm:flex">
          <span>Not an official government service.</span>
          <button onClick={() => setView("about")} className="underline-offset-2 hover:underline">About</button>
          <button onClick={() => setView("safety")} className="underline-offset-2 hover:underline">Safety</button>
        </span>
      </footer>
    </div>
  );
}

function CamBtn({ children, onClick, label, active }: { children: React.ReactNode; onClick: () => void; label: string; active?: boolean }) {
  return (
    <Button
      variant="outline"
      size="icon"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "glass-strong h-9 w-9 rounded-lg border-border",
        active && "border-primary/60 text-primary",
      )}
    >
      {children}
    </Button>
  );
}
