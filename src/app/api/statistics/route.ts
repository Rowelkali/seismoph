// GET /api/statistics?window=today|7d|30d
// Aggregated earthquake statistics for the analytics dashboard.

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { jsonOk, withErrors, HttpError } from "@/lib/api";
import type { StatisticsWindow } from "@/lib/types";

export const dynamic = "force-dynamic";

const PH_REGION_KEYWORDS: { label: string; match: RegExp }[] = [
  { label: "Luzon", match: /(luzon|manila|baguio|legazpi|naga|batangas|tagaytay|ilocos|pangasinan|pampanga|tarlac|zambales|bicol|sorsogon)/i },
  { label: "Visayas", match: /(visayas|cebu|iloilo|bacolod|negros|bohol|tacloban|leyte|samr|samr|samar|boracay|dumaguete|tagbilaran)/i },
  { label: "Mindanao", match: /(mindanao|davao|cagayan|cagayan de oro|zamboanga|cotabato|general santos|iligan|surigao|butuan|marawi|kidapawan|mati|bukidnon)/i },
  { label: "Offshore / Trench", match: /(trench|offshore)/i },
];

function windowBounds(window: string): { from: Date; to: Date; buckets: number } {
  const to = new Date();
  if (window === "today") {
    const from = new Date(to);
    from.setHours(0, 0, 0, 0);
    return { from, to, buckets: 24 };
  }
  if (window === "7d") return { from: new Date(to.getTime() - 7 * 86400000), to, buckets: 7 };
  return { from: new Date(to.getTime() - 30 * 86400000), to, buckets: 30 };
}

export const GET = withErrors(async (req: NextRequest) => {
  const windowParam = req.nextUrl.searchParams.get("window") ?? "7d";
  if (!["today", "7d", "30d"].includes(windowParam)) {
    throw new HttpError(400, "INVALID_WINDOW", "window must be today | 7d | 30d");
  }
  const { from, to, buckets } = windowBounds(windowParam);

  const rows = await db.earthquake.findMany({
    where: { originTime: { gte: from, lte: to } },
    orderBy: { originTime: "asc" },
  });

  const total = rows.length;
  const m3plus = rows.filter((r) => r.magnitude >= 3).length;
  const m4plus = rows.filter((r) => r.magnitude >= 4).length;
  const m5plus = rows.filter((r) => r.magnitude >= 5).length;
  const m6plus = rows.filter((r) => r.magnitude >= 6).length;

  const largest = rows.reduce<StatisticsWindow["largest"] | undefined>((acc, r) => {
    if (!acc || r.magnitude > acc.magnitude) {
      return { magnitude: r.magnitude, id: r.id, locationDescription: r.locationDescription };
    }
    return acc;
  }, undefined);
  const deepest = rows.reduce<StatisticsWindow["deepest"] | undefined>((acc, r) => {
    if (!acc || r.depthKm > acc.depthKm) {
      return { depthKm: r.depthKm, id: r.id, locationDescription: r.locationDescription };
    }
    return acc;
  }, undefined);

  // Magnitude buckets
  const magBuckets = [
    { label: "3.0–3.9", lo: 3, hi: 4, count: 0 },
    { label: "4.0–4.9", lo: 4, hi: 5, count: 0 },
    { label: "5.0–5.9", lo: 5, hi: 6, count: 0 },
    { label: "6.0–6.9", lo: 6, hi: 7, count: 0 },
    { label: "7.0+", lo: 7, hi: 99, count: 0 },
  ];
  for (const r of rows) {
    const b = magBuckets.find((b) => r.magnitude >= b.lo && r.magnitude < b.hi);
    if (b) b.count++;
  }

  // Depth buckets
  const depthBuckets = [
    { label: "0–35 km (shallow)", count: 0 },
    { label: "35–70 km", count: 0 },
    { label: "70–150 km", count: 0 },
    { label: "150+ km (deep)", count: 0 },
  ];
  for (const r of rows) {
    if (r.depthKm < 35) depthBuckets[0].count++;
    else if (r.depthKm < 70) depthBuckets[1].count++;
    else if (r.depthKm < 150) depthBuckets[2].count++;
    else depthBuckets[3].count++;
  }

  // By region (keyword heuristic on locationDescription)
  const byRegionMap = new Map<string, number>();
  for (const r of rows) {
    let matched = false;
    for (const z of PH_REGION_KEYWORDS) {
      if (z.match.test(r.locationDescription)) {
        byRegionMap.set(z.label, (byRegionMap.get(z.label) ?? 0) + 1);
        matched = true;
        break;
      }
    }
    if (!matched) byRegionMap.set("Other", (byRegionMap.get("Other") ?? 0) + 1);
  }

  // Over-time buckets
  const span = to.getTime() - from.getTime();
  const bucketMs = span / buckets;
  const overTime: { label: string; count: number; maxMag: number }[] = [];
  for (let i = 0; i < buckets; i++) {
    const bFrom = from.getTime() + i * bucketMs;
    const bTo = bFrom + bucketMs;
    const inBucket = rows.filter((r) => {
      const t = r.originTime.getTime();
      return t >= bFrom && t < bTo;
    });
    const count = inBucket.length;
    const maxMag = count > 0 ? Math.max(...inBucket.map((r) => r.magnitude)) : 0;
    const label =
      windowParam === "today"
        ? new Date(bFrom).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Manila" })
        : new Date(bFrom).toLocaleDateString("en-PH", { month: "short", day: "numeric", timeZone: "Asia/Manila" });
    overTime.push({ label, count, maxMag });
  }

  const body: StatisticsWindow = {
    window: windowParam as StatisticsWindow["window"],
    total,
    m3plus,
    m4plus,
    m5plus,
    m6plus,
    largest,
    deepest,
    magnitudeBuckets: magBuckets.map(({ label, count }) => ({ label, count })),
    depthBuckets,
    byRegion: Array.from(byRegionMap.entries()).map(([label, count]) => ({ label, count })),
    overTime,
  };

  return jsonOk({ data: body, asOf: new Date().toISOString() });
});
