// GET /api/earthquakes — paginated, filtered list of earthquakes.
//
// Query params:
//   page, pageSize           pagination (default 1 / 50, max 200)
//   minMagnitude, maxMagnitude
//   minDepth, maxDepth
//   from, to                 ISO date range (origin time)
//   region                   province substring (case-insensitive) — matches
//                            locationDescription OR intensity province
//   eventType                TECTONIC | VOLCANIC | INDUCED | UNKNOWN
//   status                   REVIEWED | AUTOMATIC | PRELIMINARY
//   sort                     newest | oldest | largest | deepest  (default newest)
//   includeIntensities       "1" to include intensity reports (default off for perf)

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  clampFloat,
  HttpError,
  jsonOk,
  parseDate,
  parsePagination,
  paginationMeta,
  withErrors,
} from "@/lib/api";
import { mapEarthquake } from "@/lib/mappers";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export const GET = withErrors(async (req) => {
  const { page, pageSize, skip, take } = parsePagination(req);
  const p = req.nextUrl.searchParams;

  const minMag = p.has("minMagnitude") ? clampFloat(p.get("minMagnitude"), 0, -2, 12) : undefined;
  const maxMag = p.has("maxMagnitude") ? clampFloat(p.get("maxMagnitude"), 12, -2, 12) : undefined;
  const minDepth = p.has("minDepth") ? clampFloat(p.get("minDepth"), 0, 0, 800) : undefined;
  const maxDepth = p.has("maxDepth") ? clampFloat(p.get("maxDepth"), 800, 0, 800) : undefined;
  const from = parseDate(p.get("from"));
  const to = parseDate(p.get("to"));
  const region = p.get("region")?.trim() || undefined;
  const eventType = p.get("eventType") || undefined;
  const status = p.get("status") || undefined;
  const includeIntensities = p.get("includeIntensities") === "1";
  const sort = p.get("sort") ?? "newest";

  const where: Prisma.EarthquakeWhereInput = {};
  if (minMag !== undefined || maxMag !== undefined) {
    where.magnitude = {};
    if (minMag !== undefined) where.magnitude.gte = minMag;
    if (maxMag !== undefined) where.magnitude.lte = maxMag;
  }
  if (minDepth !== undefined || maxDepth !== undefined) {
    where.depthKm = {};
    if (minDepth !== undefined) where.depthKm.gte = minDepth;
    if (maxDepth !== undefined) where.depthKm.lte = maxDepth;
  }
  if (from || to) {
    where.originTime = {};
    if (from) where.originTime.gte = from;
    if (to) where.originTime.lte = to;
  }
  if (eventType) where.eventType = eventType;
  if (status) where.status = status;
  if (region) {
    where.OR = [
      { locationDescription: { contains: region } },
      { intensities: { some: { province: { contains: region } } } },
      { intensities: { some: { locality: { contains: region } } } },
    ];
  }

  const orderBy: Prisma.EarthquakeOrderByWithRelationInput =
    sort === "oldest"
      ? { originTime: "asc" }
      : sort === "largest"
        ? { magnitude: "desc" }
        : sort === "deepest"
          ? { depthKm: "desc" }
          : { originTime: "desc" };

  const [total, rows] = await Promise.all([
    db.earthquake.count({ where }),
    db.earthquake.findMany({
      where,
      orderBy,
      skip,
      take,
      include: includeIntensities ? { intensities: { orderBy: { intensity: "desc" } } } : undefined,
    }),
  ]);

  return jsonOk({
    data: rows.map((r) => mapEarthquake(r)),
    pagination: paginationMeta(page, pageSize, total),
  });
});
