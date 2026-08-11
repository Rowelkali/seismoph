// SEISMO PH — DOST-PHIVOLCS source adapter (researched & documented).
//
// RESEARCH FINDINGS (2026-08-11):
// =================================
//
// 1. NO public developer API with API-key registration exists.
//    PHIVOLCS publishes earthquake bulletins via their website and social media
//    (X/@phivolcs_dost, Facebook/PHIVOLCS), NOT through a documented REST API
//    with API-key registration. A 2020 FOI request (foi.gov.ph, tracking
//    #DOST-816649676701) asked DOST for "an API for the latest earthquake
//    update" — no public API was provided.
//
// 2. The authoritative publication channel is:
//      https://www.phivolcs.dost.gov.ph/earthquake-information
//      https://earthquake.phivolcs.dost.gov.ph/<YYYY_Earthquake_Information>/...
//    These are HUMAN-READABLE HTML bulletins (one .html per event), NOT a
//    machine-readable JSON/XML feed. Scraping them would be legally and
//    operationally fragile (format changes, rate limits, ToS).
//
// 3. WHAT IS legitimately & publicly accessible from PHIVOLCS:
//    The PHIVOLCS GIS web portal hosts an ArcGIS REST server at
//      https://gisweb.phivolcs.dost.gov.ph/arcgis/rest/services
//    with public MapServer services under /PHIVOLCSPublic/:
//      - ActiveFault        (active fault traces — polylines)
//      - Trenches           (Philippine Trench, Manila Trench, etc.)
//      - GroundShaking      (ground shaking hazard)
//      - Liquefaction       (liquefaction hazard)
//      - EarthquakeInducedLandslide
//      - Tsunami            (tsunami hazard)
//      - VolcanoLocation, Lava, Pyroclastic, BaseSurge, Seiches, VolcanoLahar
//    These expose geometry + attribution via the ArcGIS MapServer protocol
//    (export/identify). They are the OFFICIAL PHIVOLCS hazard/fault datasets
//    and are the correct source for the platform's fault & hazard layers.
//    NOTE: the MapServers do NOT support direct `query` (Query capability is
//    disabled); geometry is retrieved via the export/identify operations.
//
// 4. The honest, legitimate production path for real-time PHIVOLCS earthquake
//    bulletins is a formal data-access request to DOST-PHIVOLCS:
//      - Email: phivolcs@phivolcs.dost.gov.ph  (trunkline: 8426-1468)
//      - Or an FOI request via https://www.foi.gov.ph
//    Request: machine-readable earthquake bulletin access for SEISMO PH, with
//    attribution + rate-limit terms. Until granted, USGS remains the live
//    real-time source (USGS reports PH events within minutes via the global
//    ANSS catalog).
//
// ARCHITECTURE:
//   DOST-PHIVOLCS (primary, authoritative)  ←── when configured via PHIVOLCS_API_URL
//        │ official Philippine data
//        ▼
//   ┌──────────────────┐
//   │ SEISMO PH        │
//   │ Data Adapter     │
//   └────────┬─────────┘
//            │
//   PostgreSQL/PostGIS
//            │
//   ┌────────┴─────────┐
//   │                  │
//   WebSocket       Alerts
//   │                  │
//   ▼                  ▼
//   3D MAP          Users' phones
//
//   USGS (secondary, live backup + cross-reference) feeds the same pipeline
//   until PHIVOLCS is configured.

import type { EarthquakeSourceAdapter, FetchResult } from "./source";
import type { EarthquakeSource } from "@/lib/types";
import { logger } from "@/lib/logger";

const ATTRIBUTION =
  "DOST-PHIVOLCS — Department of Science and Technology, Philippine Institute of Volcanology and Seismology. The Philippine-authoritative source. Earthquake bulletins published at phivolcs.dost.gov.ph; machine-readable API access pending formal data request to DOST-PHIVOLCS (phivolcs@phivolcs.dost.gov.ph) or an FOI request at foi.gov.ph.";

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
      logger.warn("phivolcs.fetch.skipped", {
        reason: "not_configured",
        note: "No public PHIVOLCS API exists. File a formal data-access request to DOST-PHIVOLCS (phivolcs@phivolcs.dost.gov.ph) or foi.gov.ph.",
      }, "earthquake-ingestion");
      return {
        source: "DOST-PHIVOLCS",
        ok: false,
        error: "PHIVOLCS earthquake API not configured. No public developer API exists; formal data-access request required. See adapter source for the documented path.",
        events: [],
      };
    }

    // --- Real fetch path (executes only when an authorized endpoint is provided) ---
    try {
      const resp = await fetch(this.endpoint!, {
        headers: {
          Accept: "application/json, application/geo+json",
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
      const data = (await resp.json()) as unknown;
      const events = parsePhivolcsPayload(data);
      logger.info("phivolcs.fetch.ok", { count: events.length }, "earthquake-ingestion");
      return { source: "DOST-PHIVOLCS", ok: true, events, serverLastUpdated: new Date() };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("phivolcs.fetch.failed", { error: message }, "earthquake-ingestion");
      return { source: "DOST-PHIVOLCS", ok: false, error: message, events: [] };
    }
  }
}

/** Parse a PHIVOLCS-style payload into RawEarthquake[]. Field mapping depends
 *  on the confirmed production endpoint; the structure below mirrors the
 *  common ArcGIS REST feature-set shape. Adjust once the authorized endpoint
 *  is confirmed. */
function parsePhivolcsPayload(data: unknown): import("./source").RawEarthquake[] {
  const out: import("./source").RawEarthquake[] = [];
  const features = (data as { features?: unknown[] })?.features ?? [];
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
