// SEISMO PH — Realtime event service (socket.io) on port 3003.
//
// REAL-TIME, LIVE data — DOST-PHIVOLCS ONLY:
//   - Polls the official PHIVOLCS earthquake bulletin website
//     (earthquake.phivolcs.dost.gov.ph) every 60 seconds for new bulletins.
//   - Parses the structured HTML bulletins (Magnitude-Data, Depth-Data,
//     Location-Data, DateTime-Data, Origin-Data, Intensity-Data markers).
//   - Persists genuinely new events through the idempotent ingestion pipeline.
//   - Broadcasts `earthquake.created` to all connected WebSocket clients.
//   - Evaluates alert subscriptions against each new event.
//
// USGS has been REMOVED. DOST-PHIVOLCS is now the sole data source, providing
// real, authoritative Philippine earthquake information from the Philippine
// Seismic Network.

import { createServer } from "http";
import { Server } from "socket.io";
import { config as loadEnv } from "dotenv";

loadEnv({ path: "/home/z/my-project/.env" });

import { db } from "../../src/lib/db";
import { logger } from "../../src/lib/logger";
import { ingestBatch } from "../../src/lib/ingestion/ingest";
import { PhivolcsAdapter } from "../../src/lib/ingestion/phivolcs";
import { haversineKm } from "../../src/lib/geo";
import { mapEarthquake } from "../../src/lib/mappers";
import type { WsServerEvent, EarthquakeEvent } from "../../src/lib/types";

const PORT = 3003;
const POLL_INTERVAL_MS = Number(process.env.RT_POLL_INTERVAL_MS ?? 60_000); // 60s
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

const phivolcsAdapter = new PhivolcsAdapter();

async function pollPhivolcs() {
  try {
    // Get the set of externalIds already in the DB so we only fetch NEW bulletins.
    // Fetch ALL existing externalIds (not just 500) to avoid re-ingesting old ones.
    const existing = await db.earthquake.findMany({
      where: { source: "DOST-PHIVOLCS" },
      select: { externalId: true },
    });
    const knownIds = new Set(existing.map((e) => e.externalId));

    const result = await phivolcsAdapter.fetch({ maxEvents: 15, knownIds });

    if (!result.ok) {
      logger.warn("rt.poll.phivolcs.failed", { error: result.error }, "realtime-service");
      await db.dataSource
        .update({ where: { name: "DOST-PHIVOLCS" }, data: { status: "DEGRADED", lastFailureAt: new Date() } })
        .catch(() => undefined);
      return;
    }

    // Ingest ALL parsed events (including old ones — for catalog completeness).
    const outcome = await ingestBatch(result.events);

    // ONLY emit `earthquake.created` for events with origin_time within the
    // last 2 hours. Older events are historical bulletins that PHIVOLCS
    // published late — they should NOT trigger realtime notifications.
    const REALTIME_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours
    const now = Date.now();
    let emittedCount = 0;
    let suppressedCount = 0;

    for (const created of outcome.created) {
      const originAge = now - new Date(created.originTime).getTime();
      if (originAge <= REALTIME_WINDOW_MS) {
        await emitCreated(created);
        emittedCount++;
      } else {
        suppressedCount++;
      }
    }
    for (const updated of outcome.updated) {
      io.emit("earthquake.updated", mapEarthquake(updated));
    }

    // Mark source healthy
    await db.dataSource
      .update({
        where: { name: "DOST-PHIVOLCS" },
        data: {
          status: "HEALTHY",
          lastSuccessAt: new Date(),
          lastEventExternalId: outcome.created[outcome.created.length - 1]?.externalId ?? undefined,
        },
      })
      .catch(() => undefined);

    if (outcome.created.length > 0 || outcome.updated.length > 0) {
      logger.info("rt.poll.summary", {
        fetched: result.events.length,
        created: outcome.created.length,
        emitted: emittedCount,
        suppressed: suppressedCount,
        updated: outcome.updated.length,
        unchanged: outcome.unchanged,
      }, "realtime-service");
    }
  } catch (e) {
    logger.error("rt.poll.error", { error: String(e) }, "realtime-service");
  }
}

async function emitCreated(event: EarthquakeEvent) {
  const payload: WsServerEvent = { type: "earthquake.created", data: event };
  io.emit("earthquake.created", payload.data);
  io.emit("message", payload);
  logger.info("rt.emit.earthquake.created", {
    externalId: event.externalId,
    source: event.source,
    magnitude: event.magnitude,
    depthKm: event.depthKm,
    location: event.locationDescription,
    originTime: event.originTime,
  }, "realtime-service");
  await evaluateAlerts(event);
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
      const existing = await db.notificationEvent.findFirst({
        where: { earthquakeId: event.id, subscriptionId: s.id },
        select: { id: true },
      });
      if (existing) continue;
      await db.notificationEvent.create({
        data: { earthquakeId: event.id, subscriptionId: s.id, notificationType: "IN_APP", deliveryStatus: "DELIVERED" },
      });
      io.emit("alert.triggered", { earthquake: event, subscriptionId: s.id });
      logger.info("rt.alert.triggered", { subscriptionId: s.id, earthquakeId: event.id, magnitude: event.magnitude }, "realtime-service");
    }
  } catch (e) {
    logger.error("rt.alerts.failed", { error: String(e) }, "realtime-service");
  }
}

async function broadcastStatus() {
  try {
    const sources = await db.dataSource.findMany();
    const total = await db.earthquake.count();
    io.emit("system.status", {
      currentTime: new Date().toISOString(),
      sourceStatus: sources.map((s) => ({
        id: s.id, name: s.name, status: s.status,
        lastSuccessAt: s.lastSuccessAt?.toISOString() ?? null, attribution: s.attribution,
      })),
      totalEvents: total,
    });
  } catch (e) {
    logger.error("rt.status.failed", { error: String(e) }, "realtime-service");
  }
}

io.on("connection", (socket) => {
  logger.info("rt.client.connected", { id: socket.id }, "realtime-service");
  socket.emit("hello", { service: "seismo-ph-realtime", time: new Date().toISOString(), source: "DOST-PHIVOLCS (live)" });
  socket.on("subscribe", (data: { channels?: string[] }) => {
    logger.info("rt.client.subscribe", { id: socket.id, channels: data?.channels }, "realtime-service");
  });
  socket.on("disconnect", (reason) => {
    logger.info("rt.client.disconnected", { id: socket.id, reason }, "realtime-service");
  });
});

httpServer.listen(PORT, () => {
  logger.info("rt.listen", { port: PORT, source: "DOST-PHIVOLCS (live)", pollIntervalMs: POLL_INTERVAL_MS }, "realtime-service");
  console.log(`\n✓ SEISMO PH realtime service on port ${PORT}`);
  console.log(`  WebSocket:  io("/?XTransformPort=${PORT}")`);
  console.log(`  Source:      DOST-PHIVOLCS (REAL, live — earthquake.phivolcs.dost.gov.ph)`);
  console.log(`  Poll:        every ${POLL_INTERVAL_MS / 1000}s for new bulletins\n`);

  setTimeout(pollPhivolcs, 2000);
  setInterval(pollPhivolcs, POLL_INTERVAL_MS);
  setInterval(broadcastStatus, STATUS_INTERVAL_MS);
  setTimeout(broadcastStatus, 1500);
});

process.on("SIGTERM", () => { httpServer.close(() => process.exit(0)); });
process.on("SIGINT", () => { httpServer.close(() => process.exit(0)); });
