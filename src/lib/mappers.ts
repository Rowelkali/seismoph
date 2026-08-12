// SEISMO PH — DB row → domain mappers.

import type { Earthquake, IntensityReport } from "@prisma/client";
import type { EarthquakeEvent, IntensityReport as IntensityReportDTO } from "@/lib/types";
import { normalizeLocation } from "@/lib/text-utils";

export function mapIntensity(i: IntensityReport): IntensityReportDTO {
  return {
    id: i.id,
    earthquakeId: i.earthquakeId,
    locality: i.locality,
    city: i.city,
    municipality: i.municipality,
    province: i.province,
    latitude: i.latitude,
    longitude: i.longitude,
    intensity: i.intensity,
    intensityScale: i.intensityScale,
    reportTime: i.reportTime.toISOString(),
    source: i.source,
  };
}

export function mapEarthquake(
  e: Earthquake & { intensities?: IntensityReport[] },
): EarthquakeEvent {
  return {
    id: e.id,
    externalId: e.externalId,
    source: e.source as EarthquakeEvent["source"],
    originTime: e.originTime.toISOString(),
    latitude: e.latitude,
    longitude: e.longitude,
    depthKm: e.depthKm,
    magnitude: e.magnitude,
    magnitudeType: e.magnitudeType,
    locationDescription: normalizeLocation(e.locationDescription),
    eventType: e.eventType as EarthquakeEvent["eventType"],
    status: e.status as EarthquakeEvent["status"],
    dataVersion: e.dataVersion,
    sequence: e.sequence,
    dataQuality: e.dataQuality as EarthquakeEvent["dataQuality"],
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    intensities: e.intensities?.map(mapIntensity),
  };
}
