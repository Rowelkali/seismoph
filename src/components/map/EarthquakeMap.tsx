"use client";

import { useEffect, useRef, useMemo } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MLMap, MapMouseEvent, LngLatBoundsLike, GeoJSONFeature } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { EarthquakeEvent } from "@/lib/types";
import { PH_CITIES } from "@/lib/ingestion/seed-data";
import { FAULTS } from "./faults";
import { severityOf } from "@/lib/ui";
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
  /** Imperative command: change `nonce` to trigger `action`. */
  command?: { action: "reset" | "zoomIn" | "zoomOut"; nonce: number } | null;
  className?: string;
}

// Inline dark raster style (no token, reliable). CARTO dark basemap + OSM.
const DARK_STYLE: maplibregl.StyleSpecification = {
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
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
      maxzoom: 20,
    },
  },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#0c0f14" } },
    { id: "carto-dark-tiles", type: "raster", source: "carto-dark", paint: { "raster-opacity": 0.92 } },
  ],
};

const PH_BOUNDS: LngLatBoundsLike = [117.5, 4.5, 127.5, 21.0];

// Severity → hex for MapLibre expressions.
const SEV_HEX: Record<string, string> = {
  minor: "#7c8a99",
  light: "#5eead4",
  moderate: "#f5c451",
  strong: "#f59331",
  major: "#e6492d",
  great: "#b8271a",
};

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
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  });

  // Index for O(1) lookup on click.
  const byId = useMemo(() => {
    const m = new Map<string, EarthquakeEvent>();
    for (const e of earthquakes) m.set(e.id, e);
    return m;
  }, [earthquakes]);

  // keep byId in a ref for the click handler (which is bound once at load)
  const byIdRef = useRef(byId);
  useEffect(() => {
    byIdRef.current = byId;
  }, [byId]);

  // ---- one-time map init ----
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: DARK_STYLE,
      center: [PH_CENTER.lon, PH_CENTER.lat],
      zoom: 5.2,
      pitch: layers.terrain ? 45 : 0,
      bearing: 0,
      maxBounds: [[110, 0], [135, 26]],
      attributionControl: { compact: true },
      cooperativeGestures: false,
      antialias: !dataSaver,
    });
    mapRef.current = map;

    map.on("load", () => {
      // --- terrain (free AWS terrarium DEM) ---
      try {
        map.addSource("terrain-dem", {
          type: "raster-dem",
          tiles: ["https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png"],
          tileSize: 256,
          maxzoom: 13,
          encoding: "terrarium",
          attribution: "Terrain: AWS Terrain Tiles (terrarium)",
        });
        if (layers.terrain) {
          map.setTerrain({ source: "terrain-dem", exaggeration: 1.5 });
        }
      } catch {
        /* terrain optional — degrade silently */
      }

      // --- faults source ---
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
          "line-opacity": 0.75,
          "line-dasharray": [2, 1.5],
        },
      });
      map.addLayer({
        id: "faults-glow",
        type: "line",
        source: "faults",
        layout: { visibility: layers.faults ? "visible" : "none" },
        paint: {
          "line-color": ["match", ["get", "kind"], "TRENCH", "#e07b5a", "#f5a623"],
          "line-width": 6,
          "line-opacity": 0.08,
          "line-blur": 4,
        },
      });

      // --- cities source ---
      map.addSource("cities", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: PH_CITIES.map((c) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [c.lon, c.lat] },
            properties: { name: c.name, type: c.type, pop: c.population ?? 0 },
          })),
        },
      });
      map.addLayer({
        id: "cities-dot",
        type: "circle",
        source: "cities",
        layout: { visibility: layers.cities ? "visible" : "none" },
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "pop"], 0, 2, 500000, 3.5, 2000000, 5],
          "circle-color": "#5eead4",
          "circle-opacity": 0.85,
          "circle-stroke-color": "#0c0f14",
          "circle-stroke-width": 1,
        },
      });
      map.addLayer({
        id: "cities-label",
        type: "symbol",
        source: "cities",
        layout: {
          visibility: layers.cities ? "visible" : "none",
          "text-field": ["get", "name"],
          "text-size": 10,
          "text-offset": [0, 0.6],
          "text-anchor": "top",
          "text-font": ["Noto Sans Regular"],
        },
        paint: {
          "text-color": "#9fb0c0",
          "text-halo-color": "#0c0f14",
          "text-halo-width": 1.5,
        },
        minzoom: 6,
      });

      // --- earthquakes source (updated reactively) ---
      map.addSource("earthquakes", { type: "geojson", data: { type: "FeatureCollection", features: [] } });

      // heatmap (off by default)
      map.addLayer({
        id: "eq-heatmap",
        type: "heatmap",
        source: "earthquakes",
        layout: { visibility: layers.heatmap ? "visible" : "none" },
        paint: {
          "heatmap-weight": ["interpolate", ["linear"], ["get", "magnitude"], 3, 0, 5, 0.6, 6.5, 1],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 8, 2.5],
          "heatmap-color": [
            "interpolate", ["linear"], ["heatmap-density"],
            0, "rgba(0,0,0,0)", 0.3, "#1d4f5a", 0.6, "#f5c451", 0.85, "#e6492d", 1, "#b8271a",
          ],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 4, 8, 10, 40],
          "heatmap-opacity": 0.55,
        },
      });

      // intensity rings (faint halo for M>=4.5 recent)
      map.addLayer({
        id: "eq-ring",
        type: "circle",
        source: "earthquakes",
        layout: { visibility: layers.intensityRings ? "visible" : "none" },
        filter: [">=", ["get", "magnitude"], 4.5],
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "magnitude"], 4.5, 16, 6, 30, 8, 60],
          "circle-color": ["match", ["get", "severity"], "moderate", SEV_HEX.moderate, "strong", SEV_HEX.strong, "major", SEV_HEX.major, "great", SEV_HEX.great, SEV_HEX.moderate],
          "circle-opacity": 0.0,
          "circle-stroke-color": ["match", ["get", "severity"], "moderate", SEV_HEX.moderate, "strong", SEV_HEX.strong, "major", SEV_HEX.major, "great", SEV_HEX.great, SEV_HEX.moderate],
          "circle-stroke-width": 1,
          "circle-stroke-opacity": 0.35,
          "circle-blur": 0.8,
        },
      });

      // main marker fill
      map.addLayer({
        id: "eq-fill",
        type: "circle",
        source: "earthquakes",
        layout: { visibility: layers.earthquakes ? "visible" : "none" },
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "magnitude"], 3, 5, 5, 9, 6.5, 14, 8, 22],
          "circle-color": [
            "match", ["get", "severity"],
            "minor", SEV_HEX.minor,
            "light", SEV_HEX.light,
            "moderate", SEV_HEX.moderate,
            "strong", SEV_HEX.strong,
            "major", SEV_HEX.major,
            "great", SEV_HEX.great,
            SEV_HEX.moderate,
          ],
          "circle-opacity": 0.9,
          "circle-stroke-color": "#0c0f14",
          "circle-stroke-width": 1.2,
        },
      });

      // selected highlight
      map.addLayer({
        id: "eq-selected",
        type: "circle",
        source: "earthquakes",
        filter: ["==", ["get", "id"], selectedId ?? "__none__"],
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "magnitude"], 3, 11, 5, 16, 6.5, 22, 8, 30],
          "circle-color": "#ffffff",
          "circle-opacity": 0.0,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
          "circle-stroke-opacity": 0.95,
        },
      });

      // magnitude label for M>=5
      map.addLayer({
        id: "eq-label",
        type: "symbol",
        source: "earthquakes",
        filter: [">=", ["get", "magnitude"], 5],
        layout: {
          "text-field": ["concat", "M", ["to-string", ["get", "magnitude"]]],
          "text-size": 10,
          "text-offset": [0, -1.4],
          "text-anchor": "bottom",
          "text-font": ["Noto Sans Regular"],
        },
        paint: {
          "text-color": "#f5f7fa",
          "text-halo-color": "#0c0f14",
          "text-halo-width": 1.5,
        },
      });

      // click → select
      map.on("click", "eq-fill", (e: MapMouseEvent & { features?: GeoJSONFeature[] }) => {
        const f = e.features?.[0];
        if (!f) return;
        const id = String((f.properties as { id?: string }).id ?? "");
        const eq = byIdRef.current.get(id);
        if (eq) onSelectRef.current?.(eq);
      });

      // cursor
      map.on("mouseenter", "eq-fill", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "eq-fill", () => (map.getCanvas().style.cursor = ""));

      // initial fit
      map.fitBounds(PH_BOUNDS, { padding: 28, pitch: layers.terrain ? 45 : 0 });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // keep byId in a ref for the click handler (which is bound once)
  // (declared above near byId)

  // ---- update earthquake data ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const update = () => {
      const src = map.getSource("earthquakes") as maplibregl.GeoJSONSource | undefined;
      if (!src) return;
      const features = earthquakes.map((e) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [e.longitude, e.latitude] },
        properties: {
          id: e.id,
          magnitude: e.magnitude,
          depth: e.depthKm,
          severity: severityOf(e.magnitude),
          location: e.locationDescription,
          source: e.source,
        },
      }));
      src.setData({ type: "FeatureCollection", features });
    };
    if (map.loaded()) update();
    else map.once("idle", update);
  }, [earthquakes]);

  // ---- update selected filter ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource("earthquakes")) return;
    const apply = () => {
      map.setFilter("eq-selected", ["==", ["get", "id"], selectedId ?? "__none__"]);
    };
    if (map.loaded()) apply();
    else map.once("idle", apply);
  }, [selectedId]);

  // ---- layer visibility ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource("earthquakes")) return;
    const setVis = (id: string, v: boolean) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", v ? "visible" : "none");
    };
    const apply = () => {
      setVis("eq-fill", layers.earthquakes);
      setVis("eq-label", layers.earthquakes);
      setVis("eq-ring", layers.intensityRings && layers.earthquakes);
      setVis("eq-heatmap", layers.heatmap);
      setVis("faults-line", layers.faults);
      setVis("faults-glow", layers.faults);
      setVis("cities-dot", layers.cities);
      setVis("cities-label", layers.cities);
      // terrain
      if (map.getSource("terrain-dem")) {
        if (layers.terrain) {
          map.setTerrain({ source: "terrain-dem", exaggeration: 1.5 });
          map.easeTo({ pitch: 45, duration: 600 });
        } else {
          map.setTerrain(null);
          map.easeTo({ pitch: 0, duration: 600 });
        }
      }
    };
    if (map.loaded()) apply();
    else map.once("idle", apply);
  }, [layers]);

  // ---- flyTo ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTo) return;
    if (!map.loaded()) return;
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
    if (!map.loaded()) return;
    if (command.action === "reset") {
      map.fitBounds(PH_BOUNDS, { padding: 28, pitch: layers.terrain ? 45 : 0, bearing: 0, duration: reducedMotion ? 0 : 900 });
    } else if (command.action === "zoomIn") {
      map.zoomIn({ duration: 250 });
    } else if (command.action === "zoomOut") {
      map.zoomOut({ duration: 250 });
    }
  }, [command, layers.terrain, reducedMotion]);

  return <div ref={containerRef} className={className} aria-label="Interactive 3D earthquake map of the Philippines" role="application" />;
}
