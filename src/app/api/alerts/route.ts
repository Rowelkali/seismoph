// GET  /api/alerts       — list alert subscriptions
// POST /api/alerts       — create an alert subscription (anonymous, no account)

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { clampFloat, HttpError, jsonOk, withErrors } from "@/lib/api";
import type { AlertSubscription } from "@/lib/types";

export const dynamic = "force-dynamic";

function mapAlert(a: {
  id: string;
  label: string;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  radiusKm: number;
  minMagnitude: number;
  channels: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}): AlertSubscription {
  return {
    id: a.id,
    label: a.label,
    locationName: a.locationName,
    latitude: a.latitude,
    longitude: a.longitude,
    radiusKm: a.radiusKm,
    minMagnitude: a.minMagnitude,
    channels: a.channels.split(",").filter(Boolean),
    enabled: a.enabled,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

export const GET = withErrors(async () => {
  const rows = await db.alertSubscription.findMany({
    orderBy: { createdAt: "desc" },
  });
  return jsonOk({ data: rows.map(mapAlert) });
});

export const POST = withErrors(async (req: NextRequest) => {
  const body = (await req.json().catch(() => null)) as {
    label?: string;
    locationName?: string;
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    minMagnitude?: number;
    channels?: string[];
    enabled?: boolean;
  } | null;

  if (!body) {
    throw new HttpError(400, "INVALID_BODY", "Request body must be JSON.");
  }
  const label = (body.label ?? "").trim();
  if (label.length < 2 || label.length > 80) {
    throw new HttpError(400, "INVALID_LABEL", "label must be 2–80 characters.");
  }
  const radiusKm = clampFloat(String(body.radiusKm ?? 50), 50, 10, 1000);
  const minMagnitude = clampFloat(String(body.minMagnitude ?? 4), 4, 1, 10);
  const channels = Array.isArray(body.channels) && body.channels.length
    ? body.channels
    : ["BROWSER", "IN_APP"];

  const row = await db.alertSubscription.create({
    data: {
      label,
      locationName: body.locationName ?? null,
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
      radiusKm,
      minMagnitude,
      channels: channels.join(","),
      enabled: body.enabled ?? true,
    },
  });
  return jsonOk({ data: mapAlert(row) }, 201);
});
