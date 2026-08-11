// GET /api/sources — data source health & attribution.

import { db } from "@/lib/db";
import { jsonOk, withErrors } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = withErrors(async () => {
  const rows = await db.dataSource.findMany({ orderBy: { name: "asc" } });
  const total = await db.earthquake.count();
  return jsonOk({
    data: rows.map((r) => ({
      id: r.id,
      name: r.name,
      endpoint: r.endpoint,
      lastSuccessAt: r.lastSuccessAt?.toISOString() ?? null,
      lastFailureAt: r.lastFailureAt?.toISOString() ?? null,
      status: r.status,
      version: r.version,
      attribution: r.attribution,
      lastEventExternalId: r.lastEventExternalId,
    })),
    totalEvents: total,
    asOf: new Date().toISOString(),
  });
});
