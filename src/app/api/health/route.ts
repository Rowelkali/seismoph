// GET /api/health — liveness (process is up)

import { jsonOk } from "@/lib/api";

export const dynamic = "force-dynamic";

export function GET() {
  return jsonOk({ status: "alive", service: "seismo-ph", time: new Date().toISOString() });
}
