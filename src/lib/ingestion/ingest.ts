// SEISMO PH — Idempotent ingestion core.
//
// Pipeline:  validate → dedup (by externalId) → persist (upsert) → classify
//            (created vs updated vs unchanged via rawSourceHash) → return.
//
// Guarantees:
//   - Receiving the same earthquake N times produces exactly one DB row.
//   - Malformed rows are rejected individually without aborting the batch.
//   - Source rows are never silently overwritten; dataVersion increments on
//     meaningful change and rawSourceHash is preserved for audit.

import { db } from "@/lib/db";
import { hashPayload, validateEarthquake, ValidationError } from "@/lib/geo";
import { logger } from "@/lib/logger";
import type { EarthquakeEvent, IntensityReport } from "@/lib/types";
import type { RawEarthquake, RawIntensity } from "./source";

export interface IngestOutcome {
  source: string;
  created: EarthquakeEvent[];
  updated: EarthquakeEvent[];
  unchanged: number;
  rejected: { externalId: string; reason: string }[];
}

function toDomain(row: {
  id: string;
  externalId: string;
  source: string;
  originTime: Date;
  latitude: number;
  longitude: number;
  depthKm: number;
  magnitude: number;
  magnitudeType: string;
  locationDescription: string;
  eventType: string;
  status: string;
  dataVersion: number;
  createdAt: Date;
  updatedAt: Date;
  intensities?: unknown[];
}): EarthquakeEvent {
  return {
    id: row.id,
    externalId: row.externalId,
    source: row.source as EarthquakeEvent["source"],
    originTime: row.originTime.toISOString(),
    latitude: row.latitude,
    longitude: row.longitude,
    depthKm: row.depthKm,
    magnitude: row.magnitude,
    magnitudeType: row.magnitudeType,
    locationDescription: row.locationDescription,
    eventType: row.eventType as EarthquakeEvent["eventType"],
    status: row.status as EarthquakeEvent["status"],
    dataVersion: row.dataVersion,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    intensities: (row.intensities as IntensityReport[] | undefined)?.map((i) => ({
      ...i,
      reportTime: (i as unknown as { reportTime: Date }).reportTime instanceof Date
        ? (i as unknown as { reportTime: Date }).reportTime.toISOString()
        : (i as unknown as { reportTime: string }).reportTime,
    })),
  };
}

/**
 * Ingest a batch of raw earthquakes idempotently.
 */
export async function ingestBatch(raw: RawEarthquake[]): Promise<IngestOutcome> {
  const created: EarthquakeEvent[] = [];
  const updated: EarthquakeEvent[] = [];
  const rejected: { externalId: string; reason: string }[] = [];
  let unchanged = 0;

  // Phase 1 — validate + dedup-within-batch by externalId.
  const seen = new Set<string>();
  const valid: RawEarthquake[] = [];
  for (const r of raw) {
    if (seen.has(r.externalId)) {
      rejected.push({ externalId: r.externalId, reason: "duplicate within batch" });
      continue;
    }
    seen.add(r.externalId);
    try {
      validateEarthquake({
        externalId: r.externalId,
        source: r.source,
        originTime: r.originTime,
        latitude: r.latitude,
        longitude: r.longitude,
        depthKm: r.depthKm,
        magnitude: r.magnitude,
        magnitudeType: r.magnitudeType,
        locationDescription: r.locationDescription,
        eventType: r.eventType,
        status: r.status,
      });
      valid.push(r);
    } catch (e) {
      const reason = e instanceof ValidationError ? e.message : String(e);
      rejected.push({ externalId: r.externalId, reason });
    }
  }

  // Phase 2 — upsert.
  for (const r of valid) {
    const payloadHash = hashPayload({
      lat: r.latitude,
      lon: r.longitude,
      depth: r.depthKm,
      mag: r.magnitude,
      t: r.originTime.getTime(),
    });

    const existing = await db.earthquake.findUnique({
      where: { externalId: r.externalId },
    });

    if (!existing) {
      const row = await db.earthquake.create({
        data: {
          externalId: r.externalId,
          source: r.source,
          originTime: r.originTime,
          latitude: r.latitude,
          longitude: r.longitude,
          depthKm: r.depthKm,
          magnitude: r.magnitude,
          magnitudeType: r.magnitudeType,
          locationDescription: r.locationDescription,
          eventType: r.eventType,
          status: r.status,
          rawSourceHash: payloadHash,
          dataVersion: 1,
        },
      });
      await upsertIntensities(row.id, r.intensities ?? []);
      created.push(toDomain(row));
    } else if (existing.rawSourceHash !== payloadHash) {
      const row = await db.earthquake.update({
        where: { id: existing.id },
        data: {
          latitude: r.latitude,
          longitude: r.longitude,
          depthKm: r.depthKm,
          magnitude: r.magnitude,
          magnitudeType: r.magnitudeType,
          locationDescription: r.locationDescription,
          status: r.status,
          rawSourceHash: payloadHash,
          dataVersion: { increment: 1 },
        },
      });
      await upsertIntensities(row.id, r.intensities ?? []);
      updated.push(toDomain(row));
    } else {
      unchanged += 1;
    }
  }

  logger.info("ingest.batch.complete", {
    source: valid[0]?.source ?? "unknown",
    created: created.length,
    updated: updated.length,
    unchanged,
    rejected: rejected.length,
  }, "earthquake-ingestion");

  return { source: valid[0]?.source ?? "unknown", created, updated, unchanged, rejected };
}

async function upsertIntensities(earthquakeId: string, raw: RawIntensity[]): Promise<void> {
  if (raw.length === 0) return;
  // Replace-all strategy for an event's intensities on update (simple + correct
  // for the dev source). Production PHIVOLCS path would merge by composite key.
  await db.intensityReport.deleteMany({ where: { earthquakeId } });
  for (const i of raw) {
    await db.intensityReport.create({
      data: {
        earthquakeId,
        locality: i.locality,
        city: i.city ?? null,
        municipality: i.municipality ?? null,
        province: i.province ?? null,
        latitude: i.latitude ?? null,
        longitude: i.longitude ?? null,
        intensity: i.intensity,
        source: i.source ?? "DOST-PHIVOLCS",
      },
    });
  }
}
