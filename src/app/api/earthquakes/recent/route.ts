// GET /api/earthquakes/recent — most recent N earthquakes (default 20, max 100).
// Also triggers a PHIVOLCS poll if the source data is stale (>90s since last
// check). This ensures data freshness WITHOUT a separate realtime service —
// the frontend's 30s auto-refetch naturally keeps the data current.

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { clampInt, jsonOk, withErrors } from "@/lib/api";
import { mapEarthquake } from "@/lib/mappers";
import { pollIfStale, startPoller } from "@/lib/server-poller";

export const dynamic = "force-dynamic";

// Start the background poller on first API call (module-level singleton).
let pollerStarted = false;
function ensurePoller() {
  if (!pollerStarted) {
    pollerStarted = true;
    startPoller();
  }
}

export const GET = withErrors(async (req) => {
  ensurePoller();

  const limit = clampInt(req.nextUrl.searchParams.get("limit"), 20, 1, 100);
  const includeIntensities = req.nextUrl.searchParams.get("includeIntensities") === "1";

  // Trigger an on-demand poll if the data is stale. This runs BEFORE returning
  // the data, so the client always gets fresh results. The poll is fast (~3s)
  // and only runs when the source hasn't been checked in the last 90s.
  await pollIfStale();

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
