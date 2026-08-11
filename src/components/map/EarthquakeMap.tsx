"use client";

import { useEffect, useRef, useMemo } from "react";
import { Map as MLMap, Marker, LngLatBoundsLike, MapMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { EarthquakeEvent } from "@/lib/types";
import { PH_CITIES } from "@/lib/ingestion/seed-data";
import { FAULTS } from "./faults";
import { severityOf, SEVERITY_COLOR } from "@/lib/ui";
import { PH_CENTER } from "@/lib/geo";

interface Props {
  earthquakes: EarthquakeEvent[];
  selectedId?: string | null;
  onSelect?: (eq: EarthquakeEvent) => void;
  layers: {
    earthquakes: boolean;
    cities: boolean;
    provinces: boolean;
    faults: boolean;
    terrain: boolean;
    heatmap: boolean;
    intensityRings: boolean;
  };
  reducedMotion?: boolean;
  dataSaver?: boolean;
  flyTo?: { lon: number; lat: number; zoom?: number } | null;
  command?: { action: "reset" | "zoomIn" | "zoomOut"; nonce: number } | null;
  className?: string;
}

const SEV_HEX: Record<string, string> = {
  minor: "#7c8a99",
  light: "#5eead4",
  moderate: "#f5c451",
  strong: "#f59331",
  major: "#e6492d",
  great: "#b8271a",
};

// Inline dark raster style (no token, reliable). CARTO dark basemap.
const DARK_STYLE = {
  version: 8,
  sources: {
    "carto-dark": {
      type: "raster" as const,
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
      maxzoom: 20,
    },
  },
  layers: [
    { id: "background", type: "background" as const, paint: { "background-color": "#0c0f14" } },
    { id: "carto-dark-tiles", type: "raster" as const, source: "carto-dark", paint: { "raster-opacity": 0.92 } },
  ],
};

const PH_BOUNDS: LngLatBoundsLike = [117.5, 4.5, 127.5, 21.0];
const MAX_MARKERS = 150;

export function EarthquakeMap({
  earthquakes,
  selectedId,
  onSelect,
  layers,
  reducedMotion,
  dataSaver,
  flyTo,
  command,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  });

  const byId = useMemo(() => {
    const m = new Map<string, EarthquakeEvent>();
    for (const e of earthquakes) m.set(e.id, e);
    return m;
  }, [earthquakes]);

  const byIdRef = useRef(byId);
  useEffect(() => {
    byIdRef.current = byId;
  }, [byId]);

  // ---- one-time map init ----
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new MLMap({
      container: containerRef.current,
      style: DARK_STYLE,
      center: [PH_CENTER.lon, PH_CENTER.lat],
      zoom: 5.2,
      pitch: 0,
      bearing: 0,
      maxBounds: [[110, 0], [135, 26]],
      attributionControl: { compact: true },
      cooperativeGestures: false,
      antialias: !dataSaver,
    });
    mapRef.current = map;
    if (typeof window !== "undefined") {
      (window as unknown as { __seismoMap?: MLMap }).__seismoMap = map;
    }

    map.on("load", () => {
      // --- terrain (only when explicitly enabled) ---
      if (layers.terrain) {
        try {
          map.addSource("terrain-dem", {
            type: "raster-dem",
            tiles: ["https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png"],
            tileSize: 256,
            maxzoom: 13,
            encoding: "terrarium",
            attribution: "Terrain: AWS Terrain Tiles (terrarium)",
          });
          map.setTerrain({ source: "terrain-dem", exaggeration: 1.5 });
          map.easeTo({ pitch: 45, duration: 600 });
        } catch {
          /* terrain optional */
        }
      }

      // --- faults as a GeoJSON line layer (simple, static data) ---
      map.addSource("faults", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: FAULTS.map((f) => ({
            type: "Feature",
            geometry: { type: "LineString", coordinates: f.coordinates },
            properties: { name: f.name, kind: f.type },
          })),
        },
      });
      map.addLayer({
        id: "faults-line",
        type: "line",
        source: "faults",
        layout: { visibility: layers.faults ? "visible" : "none", "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["match", ["get", "kind"], "TRENCH", "#e07b5a", "#f5a623"],
          "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.8, 8, 1.6, 12, 3],
          "line-opacity": 0.7,
          "line-dasharray": [2, 1.5],
        },
      });

      // --- cities as HTML markers (reliable, no worker dependency) ---
      // City markers are created in a separate effect below.

      // Initial fit
      map.fitBounds(PH_BOUNDS, { padding: 28, pitch: 0 });
    });

    return () => {
      // Clean up all markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ---- create / update earthquake HTML markers ----
  // Uses MapLibre Marker (DOM elements) instead of GeoJSON circle layers.
  // DOM markers don't require the WebGL worker to process GeoJSON data,
  // so they render reliably in all browser environments.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const updateMarkers = () => {
      if (!layers.earthquakes) {
        // Hide all markers
        markersRef.current.forEach((m) => m.getElement().style.setProperty("display", "none"));
        return;
      }

      const visible = earthquakes.slice(0, MAX_MARKERS);
      const visibleIds = new Set(visible.map((e) => e.id));

      // Remove markers no longer in the visible set
      for (const [id, marker] of markersRef.current) {
        if (!visibleIds.has(id)) {
          marker.remove();
          markersRef.current.delete(id);
        } else {
          marker.getElement().style.setProperty("display", "");
        }
      }

      // Add / update markers
      for (const eq of visible) {
        const sev = severityOf(eq.magnitude);
        const color = SEVERITY_COLOR[sev];
        const existing = markersRef.current.get(eq.id);
        if (existing) {
          // Update position + color in case data changed
          existing.setLngLat([eq.longitude, eq.latitude]);
          const el = existing.getElement();
          updateMarkerStyle(el, eq, color, eq.id === selectedId, reducedMotion);
        } else {
          const el = createMarkerElement(eq, color, eq.id === selectedId, reducedMotion);
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            onSelectRef.current?.(eq);
          });
          const marker = new Marker({ element: el, anchor: "center" })
            .setLngLat([eq.longitude, eq.latitude])
            .addTo(map);
          markersRef.current.set(eq.id, marker);
        }
      }
    };

    // Run immediately (the map exists at this point) + on move for culling
    updateMarkers();
  }, [earthquakes, layers.earthquakes, selectedId, reducedMotion]);

  // ---- city markers ----
  const cityMarkersRef = useRef<Marker[]>([]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      if (layers.cities) {
        // Create city markers if not yet created
        if (cityMarkersRef.current.length === 0) {
          for (const c of PH_CITIES) {
            const el = document.createElement("div");
            el.className = "seismo-city-marker";
            el.style.cssText = `
              display: flex; flex-direction: column; align-items: center;
              pointer-events: none; transform: translateY(-4px);
            `;
            const dot = document.createElement("div");
            const size = c.population && c.population > 1000000 ? 8 : c.population && c.population > 300000 ? 6 : 4;
            dot.style.cssText = `
              width: ${size}px; height: ${size}px; border-radius: 50%;
              background: #5eead4; opacity: 0.7;
              border: 1px solid #0c0f14;
            `;
            const label = document.createElement("div");
            label.textContent = c.name;
            label.style.cssText = `
              font-size: 10px; color: #9fb0c0; margin-top: 2px;
              text-shadow: 0 0 3px #0c0f14, 0 0 3px #0c0f14;
              white-space: nowrap; font-family: var(--font-geist-sans, sans-serif);
            `;
            el.appendChild(dot);
            el.appendChild(label);
            const marker = new Marker({ element: el, anchor: "bottom" })
              .setLngLat([c.lon, c.lat])
              .addTo(map);
            cityMarkersRef.current.push(marker);
          }
        }
        cityMarkersRef.current.forEach((m) => m.getElement().style.setProperty("display", ""));
      } else {
        cityMarkersRef.current.forEach((m) => m.getElement().style.setProperty("display", "none"));
      }
    };
    apply();
  }, [layers.cities]);

  // ---- faults visibility ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer("faults-line")) return;
    map.setLayoutProperty("faults-line", "visibility", layers.faults ? "visible" : "none");
  }, [layers.faults]);

  // ---- terrain toggle ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (layers.terrain && !map.getSource("terrain-dem")) {
      try {
        map.addSource("terrain-dem", {
          type: "raster-dem",
          tiles: ["https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png"],
          tileSize: 256,
          maxzoom: 13,
          encoding: "terrarium",
          attribution: "Terrain: AWS Terrain Tiles (terrarium)",
        });
        map.setTerrain({ source: "terrain-dem", exaggeration: 1.5 });
        map.easeTo({ pitch: 45, duration: 600 });
      } catch {
        /* terrain optional */
      }
    } else if (!layers.terrain && map.getSource("terrain-dem")) {
      map.setTerrain(null);
      map.easeTo({ pitch: 0, duration: 600 });
      setTimeout(() => {
        try {
          if (map.getSource("terrain-dem") && !map.getTerrain()) {
            map.removeSource("terrain-dem");
          }
        } catch {
          /* ignore */
        }
      }, 700);
    }
  }, [layers.terrain]);

  // ---- flyTo ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTo) return;
    map.flyTo({
      center: [flyTo.lon, flyTo.lat],
      zoom: flyTo.zoom ?? 8,
      pitch: layers.terrain ? 55 : 30,
      bearing: 0,
      duration: reducedMotion ? 0 : 1400,
      essential: true,
    });
  }, [flyTo, layers.terrain, reducedMotion]);

  // ---- imperative command ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !command) return;
    if (command.action === "reset") {
      map.fitBounds(PH_BOUNDS, { padding: 28, pitch: 0, bearing: 0, duration: reducedMotion ? 0 : 900 });
    } else if (command.action === "zoomIn") {
      map.zoomIn({ duration: 250 });
    } else if (command.action === "zoomOut") {
      map.zoomOut({ duration: 250 });
    }
  }, [command, reducedMotion]);

  return (
    <div ref={containerRef} className={className} aria-label="Interactive 3D earthquake map of the Philippines" role="application" />
  );
}

// ---- marker element factory ----

function markerRadius(mag: number): number {
  return Math.max(5, Math.min(24, 4 + mag * 2.5));
}

function createMarkerElement(
  eq: EarthquakeEvent,
  color: string,
  isSelected: boolean,
  reducedMotion?: boolean,
): HTMLElement {
  const el = document.createElement("div");
  el.className = "seismo-eq-marker";
  el.style.cssText = `
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    width: ${markerRadius(eq.magnitude) * 2}px; height: ${markerRadius(eq.magnitude) * 2}px;
  `;
  updateMarkerStyle(el, eq, color, isSelected, reducedMotion);
  return el;
}

function updateMarkerStyle(
  el: HTMLElement,
  eq: EarthquakeEvent,
  color: string,
  isSelected: boolean,
  reducedMotion?: boolean,
) {
  const r = markerRadius(eq.magnitude);
  el.style.width = `${r * 2}px`;
  el.style.height = `${r * 2}px`;
  const showRing = eq.magnitude >= 4.5 && !reducedMotion;
  const ringSize = r * 3;
  el.innerHTML = `
    ${showRing ? `<div style="position:absolute;width:${ringSize}px;height:${ringSize}px;border-radius:50%;border:1.5px solid ${color};opacity:0.4;${reducedMotion ? "" : "animation:seismo-ring 2.8s ease-out infinite;"}"></div>` : ""}
    ${!reducedMotion && eq.magnitude >= 4 ? `<div style="position:absolute;width:${r * 2}px;height:${r * 2}px;border-radius:50%;background:${color};opacity:0.3;animation:seismo-pulse 2.4s cubic-bezier(0.2,0.6,0.3,1) infinite;"></div>` : ""}
    <div style="
      position: relative; width: ${r * 2}px; height: ${r * 2}px; border-radius: 50%;
      background: ${color}; opacity: 0.9;
      border: ${isSelected ? "2px solid #ffffff" : "1.2px solid rgba(0,0,0,0.4)"};
      box-shadow: ${isSelected ? `0 0 12px ${color}, 0 0 4px #ffffff` : `0 0 6px ${color}55`};
    "></div>
    ${eq.magnitude >= 5 ? `<div style="position:absolute;bottom:-14px;font-size:9px;font-family:monospace;color:${color};text-shadow:0 0 3px #0c0f14,0 0 3px #0c0f14;white-space:nowrap;font-weight:700;">M${eq.magnitude.toFixed(1)}</div>` : ""}
  `;
  el.title = `M${eq.magnitude.toFixed(1)} ${eq.magnitudeType} · ${eq.depthKm.toFixed(0)}km · ${eq.locationDescription}`;
}
