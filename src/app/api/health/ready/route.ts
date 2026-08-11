// GET /api/health/ready — readiness (DB reachable + sources)

import { db } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.earthquake.count();
    const sources = await db.dataSource.findMany();
    return jsonOk({
      status: "ready",
      service: "seismo-ph",
      time: new Date().toISOString(),
      checks: {
        database: "ok",
        sources: sources.map((s) => ({ name: s.name, status: s.status })),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonError(
      { code: "NOT_READY", message: "Readiness check failed.", details: { db: msg } },
      503,
    );
  }
}
