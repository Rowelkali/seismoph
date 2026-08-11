// SEISMO PH — geospatial & validation utilities.
// Production target uses PostGIS ST_DWithin / ST_Distance; in this SQLite
// sandbox we compute geodesic distances with the haversine formula (ellipsoidal
// approximation, <0.5% error — acceptable for earthquake-to-city distances).

import { createHash } from "crypto";

export const PH_BOUNDS = {
  minLat: 4.5,
  maxLat: 21.5,
  minLon: 116.0,
  maxLon: 127.0,
} as const;

export const PH_CENTER = { lat: 12.8797, lon: 121.774 } as const;

const EARTH_RADIUS_KM = 6371.0088;
const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Geodesic distance between two lat/lon points in kilometers (haversine). */
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/** Initial bearing from point 1 to point 2, in degrees [0,360). */
export function bearingDeg(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Convert a bearing in degrees to a 16-point compass label. */
export function bearingLabel(deg: number): string {
  const dirs = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
  ];
  return dirs[Math.round(deg / 22.5) % 16];
}

/** True when a coordinate lies inside the Philippine bounding box. */
export function isWithinPhilippines(lat: number, lon: number): boolean {
  return (
    lat >= PH_BOUNDS.minLat &&
    lat <= PH_BOUNDS.maxLat &&
    lon >= PH_BOUNDS.minLon &&
    lon <= PH_BOUNDS.maxLon
  );
}

export interface ValidatedEarthquakeInput {
  externalId: string;
  source: string;
  originTime: Date;
  latitude: number;
  longitude: number;
  depthKm: number;
  magnitude: number;
  magnitudeType?: string;
  locationDescription: string;
  eventType?: string;
  status?: string;
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Validate raw earthquake fields before persistence. Throws ValidationError
 * with a stable code on any malformed/implausible value. Rejects coordinates
 * outside the Philippine bounding box (with a small buffer) — the upstream
 * source is responsible for PH-only events.
 */
export function validateEarthquake(input: ValidatedEarthquakeInput): void {
  const errs: string[] = [];
  if (!input.externalId || input.externalId.length > 200) {
    errs.push("externalId missing or too long");
  }
  if (!input.source) errs.push("source missing");
  if (!(input.originTime instanceof Date) || Number.isNaN(input.originTime.getTime())) {
    errs.push("originTime invalid");
  } else {
    const now = Date.now();
    const t = input.originTime.getTime();
    // Allow events up to 50 years back, and up to 1 hour in the future
    // (clock skew tolerance).
    if (t > now + 60 * 60 * 1000) errs.push("originTime in the future");
    if (t < now - 50 * 365 * 24 * 60 * 60 * 1000) errs.push("originTime too far in past");
  }
  if (
    !Number.isFinite(input.latitude) ||
    input.latitude < -90 ||
    input.latitude > 90
  ) {
    errs.push("latitude out of range");
  }
  if (
    !Number.isFinite(input.longitude) ||
    input.longitude < -180 ||
    input.longitude > 180
  ) {
    errs.push("longitude out of range");
  }
  // Slight buffer around PH bounds for near-border events.
  const BUF = 1.5;
  if (
    input.latitude < PH_BOUNDS.minLat - BUF ||
    input.latitude > PH_BOUNDS.maxLat + BUF ||
    input.longitude < PH_BOUNDS.minLon - BUF ||
    input.longitude > PH_BOUNDS.maxLon + BUF
  ) {
    errs.push("coordinates outside Philippine region");
  }
  if (!Number.isFinite(input.depthKm) || input.depthKm < 0 || input.depthKm > 800) {
    errs.push("depthKm out of range (0..800)");
  }
  if (!Number.isFinite(input.magnitude) || input.magnitude < -2 || input.magnitude > 12) {
    errs.push("magnitude out of range");
  }
  if (!input.locationDescription || input.locationDescription.length > 500) {
    errs.push("locationDescription missing or too long");
  }
  if (errs.length > 0) {
    throw new ValidationError(errs.join("; "), "EARTHQUAKE_INVALID");
  }
}

/** Deterministic SHA-256 hash of the normalized payload — for dedup & change detection. */
export function hashPayload(obj: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(obj))
    .digest("hex");
}

/** Severity bucket for color coding (never rely on color alone — UI also shows labels). */
export function magnitudeSeverity(m: number): "minor" | "light" | "moderate" | "strong" | "major" | "great" {
  if (m < 3) return "minor";
  if (m < 4) return "light";
  if (m < 5) return "moderate";
  if (m < 6) return "strong";
  if (m < 7) return "major";
  return "great";
}

/** Depth classification used by the UI for icon/label (not a hazard judgement). */
export function depthClass(km: number): "shallow" | "intermediate" | "deep" {
  if (km < 70) return "shallow";
  if (km < 300) return "intermediate";
  return "deep";
}

/** PEIS intensity → numeric rank for sorting/comparison. */
export function peisRank(roman: string): number {
  const map: Record<string, number> = {
    I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10,
  };
  return map[roman.toUpperCase()] ?? 0;
}

/** Map a magnitude to a representative marker radius in pixels (clamped). */
export function magnitudeToRadius(m: number): number {
  return Math.max(5, Math.min(34, 4 + m * 3.2));
}
