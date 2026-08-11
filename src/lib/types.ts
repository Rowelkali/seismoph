// SEISMO PH — shared domain types. Used across DB, API, WebSocket and frontend.
// Mirrors the Prisma schema but kept framework-agnostic.

export type EarthquakeSource = "DOST-PHIVOLCS" | "USGS" | "DEV-SEED";

export type EventType = "TECTONIC" | "VOLCANIC" | "INDUCED" | "UNKNOWN";

export type EventStatus = "REVIEWED" | "AUTOMATIC" | "PRELIMINARY";

export type LocationType =
  | "BARANGAY"
  | "MUNICIPALITY"
  | "CITY"
  | "PROVINCE"
  | "REGION";

export type PeisIntensity =
  | "I"
  | "II"
  | "III"
  | "IV"
  | "V"
  | "VI"
  | "VII"
  | "VIII"
  | "IX"
  | "X";

/** Canonical earthquake shape used by API, WS and UI. */
export interface EarthquakeEvent {
  id: string;
  externalId: string;
  source: EarthquakeSource;
  originTime: string; // ISO 8601 UTC
  latitude: number;
  longitude: number;
  depthKm: number;
  magnitude: number;
  magnitudeType: string;
  locationDescription: string;
  eventType: EventType;
  status: EventStatus;
  dataVersion: number;
  sequence: number; // monotonic event sequence for realtime recovery
  dataQuality: "HIGH" | "MEDIUM" | "LOW";
  createdAt: string;
  updatedAt: string;
  intensities?: IntensityReport[];
}

export interface IntensityReport {
  id: string;
  earthquakeId: string;
  locality: string;
  city?: string | null;
  municipality?: string | null;
  province?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  intensity: string; // PEIS roman numeral
  intensityScale: string;
  reportTime: string;
  source: string;
}

export interface GeoLocation {
  id: string;
  name: string;
  type: LocationType;
  region?: string | null;
  province?: string | null;
  municipality?: string | null;
  latitude: number;
  longitude: number;
  population?: number | null;
}

export interface AlertSubscription {
  id: string;
  label: string;
  locationName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  radiusKm: number;
  minMagnitude: number;
  channels: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DataSourceStatus {
  id: string;
  name: string;
  endpoint?: string | null;
  lastSuccessAt?: string | null;
  lastFailureAt?: string | null;
  status: "HEALTHY" | "DEGRADED" | "DOWN" | "UNKNOWN";
  version?: string | null;
  attribution: string;
  lastEventExternalId?: string | null;
}

/** Result of a nearest-earthquake query relative to a location. */
export interface NearestEarthquakeResult {
  earthquake: EarthquakeEvent;
  distanceKm: number;
  bearingDeg: number;
  hasIntensityForLocation: boolean;
  reportedIntensity?: string | null;
}

export interface StatisticsWindow {
  window: "today" | "7d" | "30d";
  total: number;
  m3plus: number;
  m4plus: number;
  m5plus: number;
  m6plus: number;
  largest?: { magnitude: number; id: string; locationDescription: string };
  deepest?: { depthKm: number; id: string; locationDescription: string };
  magnitudeBuckets: { label: string; count: number }[];
  depthBuckets: { label: string; count: number }[];
  byRegion: { label: string; count: number }[];
  overTime: { label: string; count: number; maxMag: number }[];
}

// ---- WebSocket event contract ----------------------------------------------

export type WsServerEvent =
  | { type: "earthquake.created"; data: EarthquakeEvent }
  | { type: "earthquake.updated"; data: EarthquakeEvent }
  | { type: "system.status"; data: { currentTime: string; sourceStatus: DataSourceStatus[]; totalEvents: number } }
  | { type: "data.source.status"; data: DataSourceStatus }
  | { type: "alert.triggered"; data: { earthquake: EarthquakeEvent; subscriptionId: string } };

export type WsClientEvent =
  | { type: "subscribe"; channels: string[] }
  | { type: "unsubscribe"; channels: string[] };
