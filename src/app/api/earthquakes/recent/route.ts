// GET /api/earthquakes/recent — most recent N earthquakes (default 20, max 100).

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { clampInt, jsonOk, withErrors } from "@/lib/api";
import { mapEarthquake } from "@/lib/mappers";

export const dynamic = "force-dynamic";

export const GET = withErrors(async (req) => {
  const limit = clampInt(req.nextUrl.searchParams.get("limit"), 20, 1, 100);
  const includeIntensities = req.nextUrl.searchParams.get("includeIntensities") === "1";
  const rows = await db.earthquake.findMany({
    orderBy: { originTime: "desc" },
    take: limit,
    include: includeIntensities ? { intensities: true } : undefined,
  });
  return jsonOk({
    data: rows.map(mapEarthquake),
    asOf: new Date().toISOString(),
  });
});
