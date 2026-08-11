// SEISMO PH — Earthquake data source adapter contract.
//
// Every external earthquake source implements this interface. This keeps the
// ingestion pipeline decoupled from the specifics of PHIVOLCS (or any future
// source) and makes the platform testable without live credentials.

import type { EarthquakeSource } from "@/lib/types";

export interface RawEarthquake {
  externalId: string;
  source: EarthquakeSource;
  originTime: Date;
  latitude: number;
  longitude: number;
  depthKm: number;
  magnitude: number;
  magnitudeType: string;
  locationDescription: string;
  eventType: "TECTONIC" | "VOLCANIC" | "INDUCED" | "UNKNOWN";
  status: "REVIEWED" | "AUTOMATIC" | "PRELIMINARY";
  /** Raw intensities attached to the event, if any. */
  intensities?: RawIntensity[];
}

export interface RawIntensity {
  locality: string;
  city?: string;
  municipality?: string;
  province?: string;
  latitude?: number;
  longitude?: number;
  intensity: string; // PEIS roman numeral
  source?: string;
}

export interface FetchResult {
  source: EarthquakeSource;
  /** Events received in this fetch (already deduplicated within the batch). */
  events: RawEarthquake[];
  /** Whether the fetch itself succeeded (network + parse). */
  ok: boolean;
  /** Human-readable error when ok === false. */
  error?: string;
  /** Server-reported "last updated" time, if available. */
  serverLastUpdated?: Date;
}

export interface EarthquakeSourceAdapter {
  readonly name: string;
  readonly source: EarthquakeSource;
  readonly attribution: string;
  /**
   * Fetch the latest events from the upstream source.
   * Implementations MUST be resilient: never throw — return ok:false with an
   * error message instead, so the pipeline can mark the source degraded.
   */
  fetch(): Promise<FetchResult>;
}
