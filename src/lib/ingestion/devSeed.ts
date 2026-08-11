// SEISMO PH — Development seed source adapter.
//
// Produces clearly-labeled synthetic fixtures (source="DEV-SEED") so the full
// platform — map, analytics, search, alerts, AI explainer — works end-to-end in
// local development without live PHIVOLCS credentials.
//
// NEVER use this adapter in production. The UI shows a "DEVELOPMENT DATA" banner
// whenever the active source is DEV-SEED.

import type { EarthquakeSourceAdapter, FetchResult, RawEarthquake } from "./source";
import type { EarthquakeSource } from "@/lib/types";
import { generateEarthquakes, type GeneratedEarthquake } from "./seed-data";

const ATTRIBUTION =
  "Development fixture data (DEV-SEED). NOT real earthquake information. Synthetic events generated for local development of the SEISMO PH platform. Replace with DOST-PHIVOLCS data in production.";

/**
 * Dev seed source. Maintains a small in-memory "tail" of recent events so the
 * realtime simulator (websocket mini-service) can emit new ones over time.
 */
export class DevSeedAdapter implements EarthquakeSourceAdapter {
  readonly name = "DEV-SEED";
  readonly source: EarthquakeSource = "DEV-SEED";
  readonly attribution = ATTRIBUTION;

  private readonly initial: GeneratedEarthquake[];

  constructor(initial: GeneratedEarthquake[]) {
    this.initial = initial;
  }

  async fetch(): Promise<FetchResult> {
    const events: RawEarthquake[] = this.initial.map((g) => ({
      externalId: g.externalId,
      source: "DEV-SEED",
      originTime: g.originTime,
      latitude: g.latitude,
      longitude: g.longitude,
      depthKm: g.depthKm,
      magnitude: g.magnitude,
      magnitudeType: g.magnitudeType,
      locationDescription: g.locationDescription,
      eventType: g.eventType,
      status: g.status,
      intensities: [],
    }));
    return {
      source: "DEV-SEED",
      ok: true,
      events,
      serverLastUpdated: new Date(),
    };
  }
}
