// GET /api/earthquakes/sequences
// Earthquake sequence detection — groups potentially related earthquakes by
// temporal + spatial proximity. Returns "potential sequences" (NOT confirmed
// aftershock swarms — that designation requires official PHIVOLCS assessment).
//
// Algorithm:
//   1. Fetch recent earthquakes (last 7 days, M3+)
//   2. Sort by magnitude DESC (largest first)
//   3. For each "main" event (M4+), find nearby events within:
//      - 72 hours after the main event
//      - 100 km distance
//      - M2.5+
//   4. Group them as a "potential sequence"
//
// Labeled as "potential" — not scientific confirmation.

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { jsonOk, withErrors, clampInt } from "@/lib/api";
import { mapEarthquake } from "@/lib/mappers";
import { haversineKm } from "@/lib/geo";
import type { EarthquakeEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

interface PotentialSequence {
  mainEvent: EarthquakeEvent;
  aftershocks: EarthquakeEvent[];
  totalEvents: number;
  maxMagnitude: number;
  timeSpan: string;
  radiusKm: number;
}

export const GET = withErrors(async (req: NextRequest) => {
  const days = clampInt(req.nextUrl.searchParams.get("days"), 7, 1, 30);
  const minMag = Number(req.nextUrl.searchParams.get("minMagnitude") ?? 3);
  const mainMinMag = Number(req.nextUrl.searchParams.get("mainMinMagnitude") ?? 4);

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const events = await db.earthquake.findMany({
    where: {
      originTime: { gte: since },
      magnitude: { gte: minMag },
    },
    orderBy: { magnitude: "desc" },
    take: 200,
  });

  // Find main events (M4+) and group nearby events
  const sequences: PotentialSequence[] = [];
  const assigned = new Set<string>();

  for (const main of events) {
    if (main.magnitude < mainMinMag) continue;
    if (assigned.has(main.id)) continue;

    const mainTime = main.originTime.getTime();
    const aftershocks: typeof events = [];

    for (const e of events) {
      if (e.id === main.id || assigned.has(e.id)) continue;
      // Only events AFTER the main event (within 72h)
      const dt = e.originTime.getTime() - mainTime;
      if (dt < 0 || dt > 72 * 60 * 60 * 1000) continue;
      // Within 100 km
      const dist = haversineKm(main.latitude, main.longitude, e.latitude, e.longitude);
      if (dist > 100) continue;
      aftershocks.push(e);
      assigned.add(e.id);
    }

    if (aftershocks.length >= 1) {
      assigned.add(main.id);
      const mapped = aftershocks.map(mapEarthquake);
      const timeSpanMs = aftershocks.length > 0
        ? Math.max(...aftershocks.map(a => a.originTime.getTime())) - mainTime
        : 0;
      const timeSpanHours = Math.round(timeSpanMs / 3600000);

      sequences.push({
        mainEvent: mapEarthquake(main),
        aftershocks: mapped,
        totalEvents: aftershocks.length + 1,
        maxMagnitude: main.magnitude,
        timeSpan: timeSpanHours > 24 ? `${Math.round(timeSpanHours / 24)}d` : `${timeSpanHours}h`,
        radiusKm: aftershocks.length > 0
          ? Math.round(Math.max(...aftershocks.map(a => haversineKm(main.latitude, main.longitude, a.latitude, a.longitude))))
          : 0,
      });
    }
  }

  return jsonOk({
    data: sequences,
    label: "Potential earthquake sequences (NOT confirmed aftershock swarms — requires official PHIVOLCS assessment)",
    window: `${days} days`,
    totalSequences: sequences.length,
  });
});
