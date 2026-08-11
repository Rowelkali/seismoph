// SEISMO PH — DOST-PHIVOLCS source adapter.
//
// PRODUCTION INTEGRATION POINT.
//
// PHIVOLCS publishes earthquake bulletins via:
//   - The PHIVOLCS website (https://phivolcs.dost.gov.ph) — human-readable pages
//   - A GIS REST service for recent/monitoring earthquakes (the "latest
//     earthquake" feature service used on their Earthquake Intensity Maps).
//
// This adapter is intentionally written as a clean, documented interface so the
// real integration is a configuration change (credentials + endpoint), not a
// rewrite. In this sandbox no live PHIVOLCS credentials or confirmed public
// production endpoint are available, so the adapter operates in a
// "not-configured" state and reports ok:false gracefully — exactly the
// degraded-path the rest of the platform is designed to handle.
//
// To enable live ingestion in production, set:
//   PHIVOLCS_API_URL   — confirmed, authorized REST/JSON endpoint
//   PHIVOLCS_API_KEY   — if required by the chosen endpoint
// and verify the endpoint's Terms of Use permit programmatic access and the
// attribution/redistribution rights required by your deployment. Do NOT scrape
// the public website if its robots/terms prohibit it.
//
// All fetched events are tagged source="DOST-PHIVOLCS" and surfaced with the
// attribution shown below. The UI never relabels them as application data.

import type { EarthquakeSourceAdapter, FetchResult } from "./source";
import type { EarthquakeSource } from "@/lib/types";
import { logger } from "@/lib/logger";

const ATTRIBUTION =
  "DOST-PHIVOLCS — Department of Science and Technology, Philippine Institute of Volcanology and Seismology. Data © PHIVOLCS/DOST. Used under their public information terms.";

export class PhivolcsAdapter implements EarthquakeSourceAdapter {
  readonly name = "DOST-PHIVOLCS";
  readonly source: EarthquakeSource = "DOST-PHIVOLCS";
  readonly attribution = ATTRIBUTION;

  private readonly endpoint: string | undefined;
  private readonly apiKey: string | undefined;

  constructor() {
    this.endpoint = process.env.PHIVOLCS_API_URL;
    this.apiKey = process.env.PHIVOLCS_API_KEY;
  }

  get configured(): boolean {
    return Boolean(this.endpoint);
  }

  async fetch(): Promise<FetchResult> {
    if (!this.configured) {
      // Graceful "source not configured" path. This is NOT an error — it is the
      // expected state in any environment without confirmed credentials.
      logger.warn("phivolcs.fetch.skipped", {
        reason: "not_configured",
        endpoint: this.endpoint ?? null,
      }, "earthquake-ingestion");
      return {
        source: "DOST-PHIVOLCS",
        ok: false,
        error: "PHIVOLCS endpoint not configured. Set PHIVOLCS_API_URL (and PHIVOLCS_API_KEY if required) with a confirmed, authorized endpoint.",
        events: [],
      };
    }

    try {
      // --- Real fetch path (executes only when configured) -----------------
      // Kept framework-agnostic. In production implement:
      //   1. GET the endpoint with appropriate headers / auth.
      //   2. Validate HTTP status; treat 429/5xx as source-degraded.
      //   3. Parse the documented JSON/GeoJSON shape into RawEarthquake[].
      //   4. Tag every record source="DOST-PHIVOLCS".
      //   5. Respect rate limits and the endpoint's caching directives.
      // The validation/normalization/dedup happens downstream in ingest.ts,
      // so this function only needs to produce RawEarthquake[].
      const resp = await fetch(this.endpoint!, {
        headers: {
          Accept: "application/json, application/geo+json",
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        // Don't let a slow source hang the pipeline.
        signal: AbortSignal.timeout(15000),
      });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
      }
      const data = (await resp.json()) as unknown;
      const events = parsePhivolcsPayload(data);
      logger.info("phivolcs.fetch.ok", {
        count: events.length,
        endpoint: this.endpoint,
      }, "earthquake-ingestion");
      return {
        source: "DOST-PHIVOLCS",
        ok: true,
        events,
        serverLastUpdated: new Date(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("phivolcs.fetch.failed", { error: message }, "earthquake-ingestion");
      return {
        source: "DOST-PHIVOLCS",
        ok: false,
        error: message,
        events: [],
      };
    }
  }
}

/**
 * Parse a PHIVOLCS-style payload into RawEarthquake[]. The exact field mapping
 * depends on the confirmed production endpoint; the structure below mirrors the
 * common ArcGIS REST feature-set shape used by PHIVOLCS monitoring services.
 * Adjust the field names once the authorized endpoint is confirmed.
 */
function parsePhivolcsPayload(data: unknown): import("./source").RawEarthquake[] {
  // Expected (example) shape:
  // { features: [ { attributes: { OBJECTID, Latitude, Longitude, Depth, Magnitude, DateTime, Location, ... } } ] }
  const out: import("./source").RawEarthquake[] = [];
  const features =
    (data as { features?: unknown[] })?.features ?? [];
  for (const f of features) {
    const attrs = (f as { attributes?: Record<string, unknown> })?.attributes;
    if (!attrs) continue;
    const lat = Number(attrs.Latitude ?? attrs.latitude);
    const lon = Number(attrs.Longitude ?? attrs.longitude);
    const depth = Number(attrs.Depth ?? attrs.depth);
    const mag = Number(attrs.Magnitude ?? attrs.magnitude);
    const ts = attrs.DateTime ?? attrs.originTime ?? attrs.datetime;
    const originTime = ts instanceof Date ? ts : new Date(String(ts));
    const location = String(attrs.Location ?? attrs.location ?? "Philippines");
    const externalId = String(attrs.OBJECTID ?? attrs.event_id ?? attrs.id ?? `${lat},${lon},${originTime.getTime()}`);
    if ([lat, lon, depth, mag].some((n) => !Number.isFinite(n))) continue;
    out.push({
      externalId,
      source: "DOST-PHIVOLCS",
      originTime,
      latitude: lat,
      longitude: lon,
      depthKm: depth,
      magnitude: mag,
      magnitudeType: String(attrs.MagnitudeType ?? "Mw"),
      locationDescription: location,
      eventType: "TECTONIC",
      status: mag >= 5 ? "REVIEWED" : "AUTOMATIC",
      intensities: [],
    });
  }
  return out;
}
