// GET /api — API metadata / index.

import { jsonOk } from "@/lib/api";

export const dynamic = "force-dynamic";

export function GET() {
  return jsonOk({
    name: "SEISMO PH API",
    version: "1.0.0",
    description: "Real-time earthquake intelligence for the Philippines",
    endpoints: [
      "GET /api/health",
      "GET /api/health/live",
      "GET /api/health/ready",
      "GET /api/earthquakes?page&pageSize&minMagnitude&maxMagnitude&minDepth&maxDepth&from&to&region&eventType&status&sort&includeIntensities",
      "GET /api/earthquakes/recent?limit",
      "GET /api/earthquakes/[id]",
      "GET /api/earthquakes/[id]/intensities",
      "GET /api/locations/search?q&type&limit",
      "GET /api/locations/[id]/nearest?limit&from&minMagnitude",
      "GET /api/statistics?window=today|7d|30d",
      "GET /api/sources",
      "GET /api/alerts",
      "POST /api/alerts",
      "DELETE /api/alerts/[id]",
      "PATCH /api/alerts/[id]",
      "POST /api/ai/explain",
    ],
    realtime: "WebSocket via /?XTransformPort=3003 (socket.io)",
    attribution: "Earthquake data: DOST-PHIVOLCS (production). Development fixtures labeled DEV-SEED.",
    disclaimer:
      "This platform is an information visualization service and does not replace official government warnings or PHIVOLCS advisories.",
  });
}
