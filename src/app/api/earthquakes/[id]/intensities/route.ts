// GET /api/earthquakes/[id]/intensities — intensity reports for an earthquake.

import { db } from "@/lib/db";
import { HttpError, jsonOk, withErrors } from "@/lib/api";
import { mapIntensity } from "@/lib/mappers";

export const dynamic = "force-dynamic";

export const GET = withErrors(async (_req, ctx) => {
  const { id } = await ctx.params;
  const exists = await db.earthquake.findUnique({ where: { id }, select: { id: true } });
  if (!exists) {
    throw new HttpError(404, "EARTHQUAKE_NOT_FOUND", "The requested earthquake could not be found.");
  }
  const rows = await db.intensityReport.findMany({
    where: { earthquakeId: id },
    orderBy: { intensity: "desc" },
  });
  return jsonOk({ data: rows.map(mapIntensity) });
});
