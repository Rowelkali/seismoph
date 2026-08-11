// SEISMO PH — USGS (FDSNWS) real earthquake source adapter.
//
// This is the LIVE, REAL data source used by the running platform.
//
// The U.S. Geological Survey Earthquake Hazards Program publishes a free,
// public, no-key REST API (FDSN-WS) returning real global earthquake data in
// GeoJSON, including events within the Philippine region. USGS is one of the
// world's authoritative seismic agencies and contributes to the global ANSS
// composite catalog. Philippine earthquakes are reported by USGS typically
// within minutes of occurrence.
//
// We use this as the real-time working source because:
//   - It is genuinely real (not synthetic)
//   - It has a documented public API with no credentials/scraping
//   - Its terms permit programmatic use with attribution
//
// PHIVOLCS remains the Philippine-authoritative source; the PhivolcsAdapter
// is kept as the documented production seam for when a confirmed authorized
// PHIVOLCS endpoint is available. Where both report the same event, the
// PHIVOLCS record takes precedence (handled by externalId namespacing).
//
// Attribution: "U.S. Geological Survey, Earthquake Hazards Program.
// https://earthquake.usgs.gov — data returned in real time via the FDSN-WS API."

import type { EarthquakeSourceAdapter, FetchResult, RawEarthquake, RawIntensity } from "./source";
import type { EarthquakeSource } from "@/lib/types";
import { logger } from "@/lib/logger";
import { PH_BOUNDS } from "@/lib/geo";

const ATTRIBUTION =
  "U.S. Geological Survey (USGS), Earthquake Hazards Program — https://earthquake.usgs.gov. Real-time data retrieved via the FDSN-WS public API. USGS is an authoritative global seismic agency; Philippine events are reported within minutes of occurrence.";

const USGS_QUERY_URL = "https://earthquake.usgs.gov/fdsnws/event/1/query";

interface UsgsFeature {
  id: string;
  properties: {
    mag: number | null;
    magType: string | null;
    place: string | null;
    time: number; // epoch ms
    updated: number;
    tz: number | null;
    url: string | null;
    detail: string | null;
    felt: number | null;
    cdi: number | null; // Community Decimal Intensity (MMI) — DYFI
    mmi: number | null; // Modified Mercalli Intensity (instrumental)
    alert: string | null;
    status: string; // "automatic" | "reviewed" | "deleted"
    tsunami: number;
    sig: number | null;
    net: string;
    code: string;
    ids: string;
    sources: string;
    types: string;
    type: string; // "earthquake" | "quarry blast" | etc.
  };
  geometry: { type: "Point"; coordinates: [number, number, number] } | null;
}

interface UsgsResponse {
  type: "FeatureCollection";
  metadata: {
    generated: number;
    url: string;
    title: string;
    status: number;
    api: string;
    count: number;
  };
  features: UsgsFeature[];
  bbox?: [number, number, number, number, number, number];
}

/** MMI (USGS) → PEIS (PHIVOLCS) approximate conversion. Labeled as derived, never claimed official. */
function mmiToPeis(mmi: number): string | null {
  if (!Number.isFinite(mmi) || mmi < 1.5) return null;
  if (mmi < 2.5) return "I";
  if (mmi < 3.5) return "II";
  if (mmi < 4.1) return "III";
  if (mmi < 4.5) return "IV";
  if (mmi < 5.0) return "V";
  if (mmi < 5.8) return "VI";
  if (mmi < 6.5) return "VII";
  if (mmi < 7.3) return "VIII";
  if (mmi < 8.0) return "IX";
  return "X";
}

export class UsgsAdapter implements EarthquakeSourceAdapter {
  readonly name = "USGS";
  readonly source: EarthquakeSource = "USGS";
  readonly attribution = ATTRIBUTION;

  /**
   * Fetch real earthquakes for the Philippine bounding box.
   * @param since Optional ISO date — if provided, only fetch events updated
   *              since this time (used by the realtime poller). If omitted,
   *              fetches a default recent window (last 90 days).
   */
  constructor(private opts?: { since?: Date; days?: number; minMagnitude?: number }) {}

  async fetch(): Promise<FetchResult> {
    const days = this.opts?.days ?? 90;
    const minMag = this.opts?.minMagnitude ?? 2.5;
    const now = new Date();
    const since =
      this.opts?.since ?? new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const params = new URLSearchParams({
      format: "geojson",
      starttime: since.toISOString().slice(0, 10),
      endtime: now.toISOString().slice(0, 10),
      minlatitude: String(PH_BOUNDS.minLat),
      maxlatitude: String(PH_BOUNDS.maxLat),
      minlongitude: String(PH_BOUNDS.minLon),
      maxlongitude: String(PH_BOUNDS.maxLon),
      minmagnitude: String(minMag),
      orderby: "time-asc",
    });

    const url = `${USGS_QUERY_URL}?${params}`;

    try {
      const resp = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(20000),
      });
      if (!resp.ok) {
        throw new Error(`USGS HTTP ${resp.status} ${resp.statusText}`);
      }
      const data = (await resp.json()) as UsgsResponse;
      const events = this.parse(data);
      logger.info(
        "usgs.fetch.ok",
        { count: events.length, since: since.toISOString(), usgsCount: data.metadata.count },
        "earthquake-ingestion",
      );
      return {
        source: "USGS",
        ok: true,
        events,
        serverLastUpdated: new Date(data.metadata.generated),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("usgs.fetch.failed", { error: message, url }, "earthquake-ingestion");
      return {
        source: "USGS",
        ok: false,
        error: message,
        events: [],
      };
    }
  }

  private parse(data: UsgsResponse): RawEarthquake[] {
    const out: RawEarthquake[] = [];
    for (const f of data.features) {
      // Skip deleted events.
      if (f.properties.status === "deleted") continue;
      // Only real earthquakes (not quarry blasts / explosions).
      if (f.properties.type && f.properties.type !== "earthquake") continue;
      if (!f.geometry) continue;
      const [lon, lat, depthKm] = f.geometry.coordinates;
      const mag = f.properties.mag;
      if (mag == null || !Number.isFinite(mag)) continue;

      const externalId = `usgs-${f.id}`; // namespaced so USGS + PHIVOLCS never collide
      const originTime = new Date(f.properties.time);

      // Intensity: prefer instrumental MMI; fall back to DYFI cdi. Convert to
      // PEIS-equivalent and clearly label as derived (source = USGS), never
      // claimed as a PHIVOLCS PEIS report.
      const intensities: RawIntensity[] = [];
      const mmi = f.properties.mmi ?? f.properties.cdi;
      if (mmi != null && Number.isFinite(mmi) && mmi >= 2) {
        const peis = mmiToPeis(mmi);
        if (peis) {
          intensities.push({
            locality: f.properties.place ?? "Philippines",
            intensity: peis,
            source: "USGS-MMI",
          });
        }
      }

      out.push({
        externalId,
        source: "USGS",
        originTime,
        latitude: Math.round(lat * 10000) / 10000,
        longitude: Math.round(lon * 10000) / 10000,
        depthKm: Math.round(depthKm * 10) / 10,
        magnitude: Math.round(mag * 100) / 100,
        magnitudeType: (f.properties.magType || "Mw").toUpperCase(),
        locationDescription: f.properties.place || `${lat.toFixed(3)}, ${lon.toFixed(3)}`,
        eventType: f.properties.type === "earthquake" ? "TECTONIC" : "UNKNOWN",
        status: f.properties.status === "reviewed" ? "REVIEWED" : f.properties.status === "automatic" ? "AUTOMATIC" : "PRELIMINARY",
        intensities,
      });
    }
    return out;
  }
}
