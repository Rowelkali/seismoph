// SEISMO PH — Realtime event service (socket.io) on port 3003.
//
// Responsibilities:
//   - Accept WebSocket connections from the Next.js frontend (via Caddy
//     XTransformPort=3003; the client connects to io("/?XTransformPort=3003")).
//   - Periodically generate a NEW clearly-labeled DEV-SEED earthquake, persist
//     it idempotently through the shared ingestion pipeline, and broadcast
//     `earthquake.created` to all connected clients.
//   - Broadcast `system.status` (source health + total events) every 30s.
//   - Evaluate alert subscriptions against each new event and emit
//     `alert.triggered` to subscribers whose location+radius+magnitude match.
//
// This service intentionally re-uses the parent project's Prisma client,
// shared types, ingestion pipeline and seed-data generator (resolved via the
// parent node_modules). In production this would be a standalone worker
// consuming from a Redis/stream backed by the PHIVOLCS ingestion job.

import { createServer } from "http";
import { Server } from "socket.io";
import { config as loadEnv } from "dotenv";

loadEnv({ path: "/home/z/my-project/.env" });

// Resolve shared modules from the parent project.
import { db } from "../../src/lib/db";
import { logger } from "../../src/lib/logger";
import { ingestBatch } from "../../src/lib/ingestion/ingest";
import { generateEarthquakes } from "../../src/lib/ingestion/seed-data";
import { haversineKm } from "../../src/lib/geo";
import { mapEarthquake } from "../../src/lib/mappers";
import type { WsServerEvent, EarthquakeEvent } from "../../src/lib/types";

const PORT = 3003;
const EMIT_INTERVAL_MS = Number(process.env.RT_EMIT_INTERVAL_MS ?? 22_000);
const STATUS_INTERVAL_MS = 30_000;

const httpServer = createServer((req, res) => {
  if (req.url === "/__health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "alive", service: "seismo-ph-realtime", time: new Date().toISOString() }));
    return;
  }
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ service: "seismo-ph-realtime", ws: "/?XTransformPort=3003" }));
});

const io = new Server(httpServer, {
  path: "/",
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60_000,
  pingInterval: 25_000,
});

let emittedCount = 0;

async function emitNewEarthquake() {
  try {
    // Generate ONE new DEV-SEED event with origin time ~ now.
    const now = new Date();
    const from = new Date(now.getTime() - 5_000);
    const [gen] = generateEarthquakes(1, from, now, (Date.now() & 0xffff) ^ emittedCount);
    if (!gen) return;

    const outcome = await ingestBatch([
      {
        externalId: gen.externalId,
        source: "DEV-SEED",
        originTime: gen.originTime,
        latitude: gen.latitude,
        longitude: gen.longitude,
        depthKm: gen.depthKm,
        magnitude: gen.magnitude,
        magnitudeType: gen.magnitudeType,
        locationDescription: gen.locationDescription,
        eventType: gen.eventType,
        status: gen.status,
        intensities: [],
      },
    ]);

    const created = outcome.created[0];
    if (!created) {
      // Already existed (idempotent) — nothing new to emit.
      return;
    }

    emittedCount++;
    const event: EarthquakeEvent = created;

    const payload: WsServerEvent = { type: "earthquake.created", data: event };
    io.emit("earthquake.created", payload.data);
    io.emit("message", payload); // generic envelope for simple clients
    logger.info("rt.emit.earthquake.created", {
      externalId: event.externalId,
      magnitude: event.magnitude,
      depthKm: event.depthKm,
      location: event.locationDescription,
    }, "realtime-service");

    // --- Evaluate alert subscriptions ---
    await evaluateAlerts(event);
  } catch (e) {
    logger.error("rt.emit.failed", { error: String(e) }, "realtime-service");
  }
}

async function evaluateAlerts(event: EarthquakeEvent) {
  try {
    const subs = await db.alertSubscription.findMany({ where: { enabled: true } });
    for (const s of subs) {
      if (event.magnitude < s.minMagnitude) continue;
      if (s.latitude != null && s.longitude != null) {
        const d = haversineKm(s.latitude, s.longitude, event.latitude, event.longitude);
        if (d > s.radiusKm) continue;
      }
      // Match! Record + emit.
      await db.notificationEvent.create({
        data: {
          earthquakeId: event.id,
          subscriptionId: s.id,
          notificationType: "IN_APP",
          deliveryStatus: "DELIVERED",
        },
      });
      io.emit("alert.triggered", { earthquake: event, subscriptionId: s.id });
      logger.info("rt.alert.triggered", {
        subscriptionId: s.id,
        earthquakeId: event.id,
        magnitude: event.magnitude,
      }, "realtime-service");
    }
  } catch (e) {
    logger.error("rt.alerts.failed", { error: String(e) }, "realtime-service");
  }
}

async function broadcastStatus() {
  try {
    const sources = await db.dataSource.findMany();
    const total = await db.earthquake.count();
    const payload = {
      type: "system.status" as const,
      data: {
        currentTime: new Date().toISOString(),
        sourceStatus: sources.map((s) => ({
          id: s.id,
          name: s.name,
          status: s.status,
          lastSuccessAt: s.lastSuccessAt?.toISOString() ?? null,
          attribution: s.attribution,
        })),
        totalEvents: total,
      },
    };
    io.emit("system.status", payload.data);
  } catch (e) {
    logger.error("rt.status.failed", { error: String(e) }, "realtime-service");
  }
}

io.on("connection", (socket) => {
  logger.info("rt.client.connected", { id: socket.id }, "realtime-service");
  socket.emit("hello", { service: "seismo-ph-realtime", time: new Date().toISOString() });

  socket.on("subscribe", (data: { channels?: string[] }) => {
    // All connected clients receive earthquake.created & system.status by default.
    // This is a no-op placeholder for future channel-based filtering.
    logger.info("rt.client.subscribe", { id: socket.id, channels: data?.channels }, "realtime-service");
  });

  socket.on("disconnect", (reason) => {
    logger.info("rt.client.disconnected", { id: socket.id, reason }, "realtime-service");
  });
});

httpServer.listen(PORT, () => {
  logger.info("rt.listen", { port: PORT }, "realtime-service");
  console.log(`\n✓ SEISMO PH realtime service on port ${PORT}`);
  console.log(`  WebSocket:  io("/?XTransformPort=${PORT}")`);
  console.log(`  Emit interval: ${EMIT_INTERVAL_MS}ms (DEV-SEED fixtures)\n`);

  // Mark DEV-SEED healthy on boot.
  db.dataSource
    .update({
      where: { name: "DEV-SEED" },
      data: { status: "HEALTHY", lastSuccessAt: new Date() },
    })
    .catch(() => undefined);

  setInterval(emitNewEarthquake, EMIT_INTERVAL_MS);
  setInterval(broadcastStatus, STATUS_INTERVAL_MS);
  // Initial status shortly after boot.
  setTimeout(broadcastStatus, 1500);
});

process.on("SIGTERM", () => {
  logger.info("rt.shutdown", { signal: "SIGTERM" }, "realtime-service");
  httpServer.close(() => process.exit(0));
});
process.on("SIGINT", () => {
  logger.info("rt.shutdown", { signal: "SIGINT" }, "realtime-service");
  httpServer.close(() => process.exit(0));
});
