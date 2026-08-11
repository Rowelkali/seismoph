// DELETE /api/alerts/[id] — delete an alert subscription
// PATCH  /api/alerts/[id] — toggle enabled / update fields

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { HttpError, jsonOk, withErrors } from "@/lib/api";

export const dynamic = "force-dynamic";

export const DELETE = withErrors(async (_req, ctx) => {
  const { id } = await ctx.params;
  try {
    await db.alertSubscription.delete({ where: { id } });
  } catch {
    throw new HttpError(404, "ALERT_NOT_FOUND", "Alert subscription not found.");
  }
  return jsonOk({ data: { id, deleted: true } });
});

export const PATCH = withErrors(async (req: NextRequest, ctx) => {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as {
    enabled?: boolean;
    radiusKm?: number;
    minMagnitude?: number;
  } | null;
  if (!body) {
    throw new HttpError(400, "INVALID_BODY", "Request body must be JSON.");
  }
  const row = await db.alertSubscription.update({
    where: { id },
    data: {
      ...(typeof body.enabled === "boolean" ? { enabled: body.enabled } : {}),
      ...(typeof body.radiusKm === "number" ? { radiusKm: body.radiusKm } : {}),
      ...(typeof body.minMagnitude === "number" ? { minMagnitude: body.minMagnitude } : {}),
    },
  });
  return jsonOk({
    data: {
      id: row.id,
      enabled: row.enabled,
      radiusKm: row.radiusKm,
      minMagnitude: row.minMagnitude,
    },
  });
});
