// GET /api/locations/[id]/nearest — nearest earthquakes to a location,
// with geodesic distance + bearing, and reported intensity at that location.

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { clampInt, HttpError, jsonOk, withErrors, parseDate } from "@/lib/api";
import { bearingDeg, bearingLabel, haversineKm } from "@/lib/geo";
import { mapEarthquake } from "@/lib/mappers";
import type { NearestEarthquakeResult } from "@/lib/types";

export const dynamic = "force-dynamic";

export const GET = withErrors(async (req: NextRequest, ctx) => {
  const { id } = await ctx.params;
  const loc = await db.location.findUnique({ where: { id } });
  if (!loc) {
    throw new HttpError(404, "LOCATION_NOT_FOUND", "The requested location could not be found.");
  }
  const limit = clampInt(req.nextUrl.searchParams.get("limit"), 5, 1, 50);
  const from = parseDate(req.nextUrl.searchParams.get("from"));
  const minMag = req.nextUrl.searchParams.get("minMagnitude")
    ? Number(req.nextUrl.searchParams.get("minMagnitude"))
    : undefined;

  // Load candidate earthquakes (recent + filtered), compute distance in app.
  // Production with PostGIS would use ST_DWithin + ORDER BY ST_Distance.
  const where: { originTime?: { gte?: Date }; magnitude?: number } = {};
  if (from) where.originTime = { gte: from };
  if (minMag !== undefined && Number.isFinite(minMag)) where.magnitude = minMag;

  const rows = await db.earthquake.findMany({
    where,
    orderBy: { originTime: "desc" },
    take: 2000, // bound the scan; recent activity window
    include: { intensities: true },
  });

  const scored = rows
    .map((r) => ({
      row: r,
      dist: haversineKm(loc.latitude, loc.longitude, r.latitude, r.longitude),
      bearing: bearingDeg(loc.latitude, loc.longitude, r.latitude, r.longitude),
    }))
    .filter((x) => x.dist <= 1000) // within 1000 km of the location
    .sort((a, b) => a.dist - b.dist)
    .slice(0, limit);

  const results: NearestEarthquakeResult[] = scored.map(({ row, dist, bearing }) => {
    const locIntensity = row.intensities.find(
      (i) =>
        i.locality?.toLowerCase() === loc.name.toLowerCase() ||
        i.city?.toLowerCase() === loc.name.toLowerCase(),
    );
    return {
      earthquake: mapEarthquake(row),
      distanceKm: Math.round(dist * 10) / 10,
      bearingDeg: Math.round(bearing),
      hasIntensityForLocation: Boolean(locIntensity),
      reportedIntensity: locIntensity?.intensity ?? null,
    };
  });

  return jsonOk({
    location: {
      id: loc.id,
      name: loc.name,
      type: loc.type,
      latitude: loc.latitude,
      longitude: loc.longitude,
    },
    bearingLabel: (deg: number) => bearingLabel(deg),
    data: results,
  });
});
