// SEISMO PH — global client state (Zustand).

import { create } from "zustand";
import type { EarthquakeEvent } from "@/lib/types";

export type AppView =
  | "live"
  | "earthquakes"
  | "history"
  | "analytics"
  | "locations"
  | "alerts"
  | "safety"
  | "about";

export interface LayerState {
  earthquakes: boolean;
  cities: boolean;
  provinces: boolean;
  faults: boolean;
  terrain: boolean;
  heatmap: boolean;
  intensityRings: boolean;
  userLocation: boolean;
  hazards: boolean;
}

export interface UserLocation {
  id?: string;
  name: string;
  latitude: number;
  longitude: number;
  accuracy?: number; // meters, from Geolocation API
}

export interface HistoryFilters {
  from: string; // ISO date
  to: string;
  minMagnitude: number;
  maxMagnitude: number;
  minDepth: number;
  maxDepth: number;
  region: string;
  eventType: string;
}

export interface AppSettings {
  dataSaver: boolean;
  reducedMotion: boolean;
  showDevBanner: boolean;
  soundEnabled: boolean;
  basemap: "dark" | "light" | "satellite" | "topo";
  highlightLatest: boolean;
  units: "metric";
}

interface SeismoState {
  // navigation
  view: AppView;
  setView: (v: AppView) => void;

  // selection
  selectedEarthquake: EarthquakeEvent | null;
  selectEarthquake: (e: EarthquakeEvent | null) => void;

  userLocation: UserLocation | null;
  setUserLocation: (l: UserLocation | null) => void;

  // map layers
  layers: LayerState;
  toggleLayer: (k: keyof LayerState) => void;
  setLayers: (l: Partial<LayerState>) => void;

  // settings
  settings: AppSettings;
  toggleSetting: (k: keyof AppSettings) => void;
  setSetting: <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => void;

  // realtime
  wsConnected: boolean;
  setWsConnected: (b: boolean) => void;
  stream: EarthquakeEvent[]; // recent realtime events (capped)
  pushStreamEvent: (e: EarthquakeEvent) => void;

  // "popped" set: earthquakes currently visible on the map (for the live
  // replay animation, events are added here one-by-one with a pulse).
  popped: EarthquakeEvent[];
  pushPopped: (e: EarthquakeEvent) => void;
  setPopped: (e: EarthquakeEvent[]) => void;
  /** A freshly-popped event to animate (cleared after animation). */
  lastPopped: EarthquakeEvent | null;
  setLastPopped: (e: EarthquakeEvent | null) => void;

  // history filters
  filters: HistoryFilters;
  setFilters: (f: Partial<HistoryFilters>) => void;

  // mobile drawer for selected earthquake
  detailOpenMobile: boolean;
  setDetailOpenMobile: (b: boolean) => void;
}

const today = new Date();
const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000);

const defaultFilters: HistoryFilters = {
  from: thirtyDaysAgo.toISOString().slice(0, 10),
  to: today.toISOString().slice(0, 10),
  minMagnitude: 3,
  maxMagnitude: 10,
  minDepth: 0,
  maxDepth: 800,
  region: "",
  eventType: "",
};

const prefersReduced =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export const useSeismo = create<SeismoState>((set) => ({
  view: "live",
  setView: (v) => set({ view: v }),

  selectedEarthquake: null,
  selectEarthquake: (e) =>
    set({ selectedEarthquake: e, detailOpenMobile: Boolean(e) }),

  userLocation: null,
  setUserLocation: (l) => set({ userLocation: l }),

  layers: {
    earthquakes: true,
    cities: true,
    provinces: false,
    faults: true,
    terrain: false,
    heatmap: false,
    intensityRings: true,
    userLocation: true,
    hazards: false,
  },
  toggleLayer: (k) =>
    set((s) => ({ layers: { ...s.layers, [k]: !s.layers[k] } })),
  setLayers: (l) => set((s) => ({ layers: { ...s.layers, ...l } })),

  settings: {
    dataSaver: false,
    reducedMotion: Boolean(prefersReduced),
    showDevBanner: true,
    soundEnabled: true,
    basemap: "dark",
    highlightLatest: true,
    units: "metric",
  },
  toggleSetting: (k) =>
    set((s) => ({ settings: { ...s.settings, [k]: !s.settings[k] } })),
  setSetting: (k, v) =>
    set((s) => ({ settings: { ...s.settings, [k]: v } })),

  wsConnected: false,
  setWsConnected: (b) => set({ wsConnected: b }),
  stream: [],
  pushStreamEvent: (e) =>
    set((s) => ({
      stream: [e, ...s.stream].slice(0, 60),
    })),

  popped: [],
  pushPopped: (e) =>
    set((s) => ({
      popped: s.popped.some((x) => x.id === e.id) ? s.popped : [...s.popped, e],
      lastPopped: e,
    })),
  setPopped: (e) => set({ popped: e, lastPopped: null }),
  lastPopped: null,
  setLastPopped: (e) => set({ lastPopped: e }),

  filters: defaultFilters,
  setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f } })),

  detailOpenMobile: false,
  setDetailOpenMobile: (b) => set({ detailOpenMobile: b }),
}));
