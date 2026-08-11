// GET /api/locations/search?q=<query>&type=...&limit=...
// Searches Philippine regions, provinces, cities, municipalities by name.

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { clampInt, HttpError, jsonOk, withErrors } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = withErrors(async (req: NextRequest) => {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const type = req.nextUrl.searchParams.get("type") || undefined;
  const limit = clampInt(req.nextUrl.searchParams.get("limit"), 20, 1, 100);
  if (q.length < 2) {
    throw new HttpError(400, "QUERY_TOO_SHORT", "Query must be at least 2 characters.");
  }
  const where: { name?: { contains: string }; type?: string } = { name: { contains: q } };
  if (type) where.type = type;
  const rows = await db.location.findMany({
    where,
    take: limit,
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
  return jsonOk({ data: rows });
});
