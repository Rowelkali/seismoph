"use client";

import { useEffect, useRef, useMemo } from "react";
import { Map as MLMap, Marker, LngLat, LngLatBoundsLike, MapMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { EarthquakeEvent } from "@/lib/types";
import { PH_CITIES } from "@/lib/ingestion/seed-data";
import { FAULTS } from "./faults";
import { PHIVOLCS_LAYERS, phivolcsRasterSource } from "@/lib/phivolcs-layers";
import { severityOf, SEVERITY_COLOR } from "@/lib/ui";
import { PH_CENTER, PH_BOUNDS } from "@/lib/geo";

interface Props {
  earthquakes: EarthquakeEvent[];
  selectedId?: string | null;
  latestId?: string | null;
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
  basemap?: BasemapId;
  flyTo?: { lon: number; lat: number; zoom?: number } | null;
  command?: { action: "reset" | "zoomIn" | "zoomOut"; nonce: number } | null;
  className?: string;
}

// ---- Basemap styles ----
// Users can switch between these via the basemap selector in the map controls.
export type BasemapId = "dark" | "light" | "satellite" | "topo";

interface BasemapDef {
  id: BasemapId;
  label: string;
  description: string;
  style: {
    version: number;
    sources: Record<string, unknown>;
    layers: Record<string, unknown>[];
  };
}

const BASEMAPS: Record<BasemapId, BasemapDef> = {
  dark: {
    id: "dark",
    label: "Dark",
    description: "CARTO dark matter — scientific dark theme",
    style: {
      version: 8,
      sources: {
        "carto-dark": {
          type: "raster",
          tiles: [
            "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
            "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
            "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
            "https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
          ],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors © CARTO',
          maxzoom: 20,
        },
      },
      layers: [
        { id: "background", type: "background", paint: { "background-color": "#0c0f14" } },
        { id: "basemap-tiles", type: "raster", source: "carto-dark", paint: { "raster-opacity": 0.92 } },
      ],
    },
  },
  light: {
    id: "light",
    label: "Light",
    description: "CARTO positron — clean light theme",
    style: {
      version: 8,
      sources: {
        "carto-light": {
          type: "raster",
          tiles: [
            "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
            "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
            "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
            "https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
          ],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors © CARTO',
          maxzoom: 20,
        },
      },
      layers: [
        { id: "background", type: "background", paint: { "background-color": "#f5f5f5" } },
        { id: "basemap-tiles", type: "raster", source: "carto-light", paint: { "raster-opacity": 0.95 } },
      ],
    },
  },
  satellite: {
    id: "satellite",
    label: "Satellite",
    description: "Esri World Imagery — aerial/satellite view",
    style: {
      version: 8,
      sources: {
        "esri-satellite": {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          ],
          tileSize: 256,
          attribution: '© Esri, Maxar, Earthstar Geographics',
          maxzoom: 19,
        },
      },
      layers: [
        { id: "background", type: "background", paint: { "background-color": "#000000" } },
        { id: "basemap-tiles", type: "raster", source: "esri-satellite", paint: { "raster-opacity": 1.0 } },
      ],
    },
  },
  topo: {
    id: "topo",
    label: "Topographic",
    description: "OpenTopoMap — terrain & contours",
    style: {
      version: 8,
      sources: {
        "opentopomap": {
          type: "raster",
          tiles: [
            "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
            "https://b.tile.opentopomap.org/{z}/{x}/{y}.png",
            "https://c.tile.opentopomap.org/{z}/{x}/{y}.png",
          ],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors, SRTM | OpenTopoMap (CC-BY-SA)',
          maxzoom: 17,
        },
      },
      layers: [
        { id: "background", type: "background", paint: { "background-color": "#e8e4d8" } },
        { id: "basemap-tiles", type: "raster", source: "opentopomap", paint: { "raster-opacity": 1.0 } },
      ],
    },
  },
};

const SEV_HEX: Record<string, string> = {
  minor: "#7c8a99",
  light: "#5eead4",
  moderate: "#f5c451",
  strong: "#f59331",
  major: "#e6492d",
  great: "#b8271a",
};

// Full Philippine archipelago bounds — wide enough to include Palawan (west),
// Batanes (north), and Tawi-Tawi (south). Used for fitBounds() so the entire
// country is always visible when zooming out / resetting the view.
const PH_FIT_BOUNDS: LngLatBoundsLike = [115.5, 4.0, 127.5, 21.7];
const MAX_MARKERS = 150;

export function EarthquakeMap({
  earthquakes,
  selectedId,
  latestId,
  onSelect,
  layers,
  reducedMotion,
  dataSaver,
  basemap = "dark",
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

  // Resolve the active basemap style object.
  const activeBasemap = BASEMAPS[basemap] ?? BASEMAPS.dark;

  // ---- one-time map init ----
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new MLMap({
      container: containerRef.current,
      style: activeBasemap.style as MLMap["style"],
      center: [PH_CENTER.lon, PH_CENTER.lat],
      zoom: 4.8,
      pitch: 0,
      bearing: 0,
      // NO maxBounds — it prevents zoom-out past the bounds edge, which traps
      // the user at a zoom level where they can't see the full Philippines.
      // Instead we use minZoom/maxZoom for free zooming with sensible limits.
      minZoom: 3,        // zoom out to see all of SE Asia + Philippines
      maxZoom: 15,       // zoom in limit (performance + detail)
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

      // --- OFFICIAL PHIVOLCS hazard layers (real data from gisweb.phivolcs.dost.gov.ph) ---
      // ActiveFault + Trenches are loaded as raster overlays using the ArcGIS
      // MapServer export endpoint. These are the authoritative PHIVOLCS fault
      // and trench traces — not schematic. Hidden by default; toggled via the
      // faults layer switch (which now controls BOTH the schematic SVG overlay
      // AND these official raster layers).
      try {
        const phivolcsBounds: [number, number, number, number] = [PH_BOUNDS.minLon, PH_BOUNDS.minLat, PH_BOUNDS.maxLon, PH_BOUNDS.maxLat];
        for (const layer of PHIVOLCS_LAYERS.slice(0, 2)) {
          // Only add active-faults + trenches as map layers (the rest are
          // hazard overlays that could be added similarly).
          const tileUrl = phivolcsRasterSource(layer, phivolcsBounds);
          map.addSource(`phivolcs-${layer.id}`, {
            type: "image",
            url: tileUrl,
            coordinates: [
              [PH_BOUNDS.minLon, PH_BOUNDS.maxLat], // top-left
              [PH_BOUNDS.maxLon, PH_BOUNDS.maxLat], // top-right
              [PH_BOUNDS.maxLon, PH_BOUNDS.minLat], // bottom-right
              [PH_BOUNDS.minLon, PH_BOUNDS.minLat], // bottom-left
            ],
          });
          map.addLayer({
            id: `phivolcs-${layer.id}-layer`,
            type: "raster",
            source: `phivolcs-${layer.id}`,
            paint: { "raster-opacity": layer.id === "active-faults" ? 0.85 : 0.7 },
            layout: { visibility: layers.faults ? "visible" : "none" },
          });
        }
      } catch {
        /* PHIVOLCS layers optional — degrade to schematic SVG overlay */
      }

      // Note: Schematic faults are also rendered as HTML SVG overlays below as
      // a fallback/supplement. GeoJSON sources require the WebGL worker which
      // can be unreliable in some browser environments, keeping styleLoaded=false
      // forever. HTML overlays have no such dependency.

      // Initial fit — show the FULL Philippine archipelago on load.
      map.fitBounds(PH_FIT_BOUNDS, { padding: 40, pitch: 0 });
    });

    return () => {
      // Clean up all markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ---- switch basemap style when `basemap` prop changes ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const target = BASEMAPS[basemap] ?? BASEMAPS.dark;
    try {
      map.setStyle(target.style as MLMap["style"]);
    } catch {
      /* style switch can fail if map is mid-load; ignore */
    }
  }, [basemap]);

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
        const isSelected = eq.id === selectedId;
        const isLatest = eq.id === latestId;
        const existing = markersRef.current.get(eq.id);
        if (existing) {
          // Update position + style in case data changed
          existing.setLngLat([eq.longitude, eq.latitude]);
          const el = existing.getElement();
          updateMarkerStyle(el, eq, color, isSelected, reducedMotion, isLatest);
        } else {
          const el = createMarkerElement(eq, color, isSelected, reducedMotion, isLatest);
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
  }, [earthquakes, layers.earthquakes, selectedId, latestId, reducedMotion]);

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

  // ---- faults as HTML SVG overlay ----
  // Uses an SVG element positioned over the map. Polylines are projected from
  // lng/lat to screen pixels and updated on map move/zoom. This avoids the
  // GeoJSON worker dependency that was keeping styleLoaded=false.
  const faultsOverlayRef = useRef<SVGSVGElement | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!map || !container) return;

    // Only create/update the overlay when the map is ready.
    const setup = () => {
      // Create SVG overlay if not yet created
      if (!faultsOverlayRef.current) {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;";
        container.appendChild(svg);
        faultsOverlayRef.current = svg;
      }
      const svg = faultsOverlayRef.current;
      if (!svg) return;

      const update = () => {
        svg.innerHTML = "";
        svg.style.display = layers.faults ? "" : "none";
        if (!layers.faults) return;
        try {
          const w = container.clientWidth;
          const h = container.clientHeight;
          svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
          for (const fault of FAULTS) {
            const pts: string[] = [];
            for (const [lon, lat] of fault.coordinates) {
              const proj = map.project(new LngLat(lon, lat));
              if (Number.isFinite(proj.x) && Number.isFinite(proj.y)) {
                pts.push(`${proj.x.toFixed(1)},${proj.y.toFixed(1)}`);
              }
            }
            if (pts.length < 2) continue;
            const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
            line.setAttribute("points", pts.join(" "));
            line.setAttribute("fill", "none");
            line.setAttribute("stroke", fault.type === "TRENCH" ? "#e07b5a" : "#f5a623");
            line.setAttribute("stroke-width", "1.5");
            line.setAttribute("stroke-opacity", "0.6");
            line.setAttribute("stroke-dasharray", "4 3");
            line.setAttribute("stroke-linecap", "round");
            line.setAttribute("stroke-linejoin", "round");
            svg.appendChild(line);
          }
        } catch {
          /* map not ready yet */
        }
      };

      update();
      map.on("move", update);
      map.on("zoom", update);
      // Store cleanup on the svg element
      (svg as unknown as { _cleanup?: () => void })._cleanup = () => {
        map.off("move", update);
        map.off("zoom", update);
      };
    };

    // Run setup — if map not loaded yet, wait for it
    if (map.loaded() || map.isStyleLoaded()) {
      setup();
    } else {
      map.once("load", setup);
    }

    return () => {
      const svg = faultsOverlayRef.current;
      if (svg) {
        const cleanup = (svg as unknown as { _cleanup?: () => void })._cleanup;
        if (cleanup) cleanup();
        svg.remove();
        faultsOverlayRef.current = null;
      }
    };
  }, [layers.faults]);

  // ---- toggle official PHIVOLCS raster layers (active-faults + trenches) ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      for (const layer of PHIVOLCS_LAYERS.slice(0, 2)) {
        const layerId = `phivolcs-${layer.id}-layer`;
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, "visibility", layers.faults ? "visible" : "none");
        }
      }
    };
    apply();
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
      // Reset = fit the FULL Philippine archipelago (zoom out to see all islands)
      map.fitBounds(PH_FIT_BOUNDS, { padding: 40, pitch: 0, bearing: 0, duration: reducedMotion ? 0 : 900 });
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
  isLatest?: boolean,
): HTMLElement {
  const el = document.createElement("div");
  el.className = "seismo-eq-marker" + (isLatest ? " seismo-eq-latest" : "");
  el.style.cssText = `
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    width: ${markerRadius(eq.magnitude) * 2}px; height: ${markerRadius(eq.magnitude) * 2}px;
  `;
  updateMarkerStyle(el, eq, color, isSelected, reducedMotion, isLatest);
  return el;
}

function updateMarkerStyle(
  el: HTMLElement,
  eq: EarthquakeEvent,
  color: string,
  isSelected: boolean,
  reducedMotion?: boolean,
  isLatest?: boolean,
) {
  const r = markerRadius(eq.magnitude);
  // The latest earthquake gets a larger marker + pulsing ring + "LATEST" label
  // so it stands out from all other markers on the map.
  const effectiveR = isLatest ? r + 4 : r;
  el.style.width = `${effectiveR * 2}px`;
  el.style.height = `${effectiveR * 2}px`;
  const showRing = (eq.magnitude >= 4.5 || isLatest) && !reducedMotion;
  const ringSize = isLatest ? effectiveR * 4 : effectiveR * 3;
  const showPulse = isLatest || (!reducedMotion && eq.magnitude >= 4);
  const showLabel = eq.magnitude >= 5 || isLatest;

  el.innerHTML = `
    ${showRing ? `<div style="position:absolute;width:${ringSize}px;height:${ringSize}px;border-radius:50%;border:${isLatest ? "2px" : "1.5px"} solid ${isLatest ? "#ffffff" : color};opacity:${isLatest ? 0.7 : 0.4};${reducedMotion ? "" : "animation:seismo-ring 2.8s ease-out infinite;"}"></div>` : ""}
    ${showPulse ? `<div style="position:absolute;width:${effectiveR * 2}px;height:${effectiveR * 2}px;border-radius:50%;background:${color};opacity:${isLatest ? 0.4 : 0.3};animation:seismo-pulse ${isLatest ? "1.8s" : "2.4s"} cubic-bezier(0.2,0.6,0.3,1) infinite;"></div>` : ""}
    <div style="
      position: relative; width: ${effectiveR * 2}px; height: ${effectiveR * 2}px; border-radius: 50%;
      background: ${color}; opacity: ${isLatest ? 1.0 : 0.9};
      border: ${isSelected ? "2px solid #ffffff" : isLatest ? "2.5px solid #ffffff" : "1.2px solid rgba(0,0,0,0.4)"};
      box-shadow: ${isSelected || isLatest ? `0 0 16px ${color}, 0 0 6px #ffffff, 0 0 2px #ffffff` : `0 0 6px ${color}55`};
    "></div>
    ${showLabel ? `<div style="position:absolute;bottom:${isLatest ? -20 : -14}px;left:50%;transform:translateX(-50%);font-size:${isLatest ? 10 : 9}px;font-family:monospace;color:${isLatest ? "#ffffff" : color};background:${isLatest ? color : "transparent"};padding:${isLatest ? "1px 4px" : "0"};border-radius:3px;text-shadow:0 0 3px #0c0f14,0 0 3px #0c0f14;white-space:nowrap;font-weight:700;">${isLatest ? "LATEST M" + eq.magnitude.toFixed(1) : "M" + eq.magnitude.toFixed(1)}</div>` : ""}
  `;
  el.title = `${isLatest ? "★ LATEST · " : ""}M${eq.magnitude.toFixed(1)} ${eq.magnitudeType} · ${eq.depthKm.toFixed(0)}km · ${eq.locationDescription}`;
}
