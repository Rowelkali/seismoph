// GET /api/earthquakes/[id] — single earthquake by internal id, with intensities.

import { db } from "@/lib/db";
import { HttpError, jsonOk, withErrors } from "@/lib/api";
import { mapEarthquake } from "@/lib/mappers";

export const dynamic = "force-dynamic";

export const GET = withErrors(async (_req, ctx) => {
  const { id } = await ctx.params;
  const row = await db.earthquake.findUnique({
    where: { id },
    include: { intensities: { orderBy: { intensity: "desc" } } },
  });
  if (!row) {
    throw new HttpError(404, "EARTHQUAKE_NOT_FOUND", "The requested earthquake could not be found.");
  }
  return jsonOk({ data: mapEarthquake(row) });
});
