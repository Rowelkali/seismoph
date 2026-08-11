// SEISMO PH — Realtime event service (socket.io) on port 3003.
//
// REAL-TIME, LIVE data:
//   - Polls the USGS FDSN-WS API every 60 seconds for new/updated Philippine
//     region earthquakes (events updated in the last ~5 minutes).
//   - Persists genuinely new events through the idempotent ingestion pipeline.
//   - Broadcasts `earthquake.created` / `earthquake.updated` to all connected
//     WebSocket clients.
//   - Broadcasts `system.status` (source health + total events) every 30s.
//   - Evaluates alert subscriptions against each new event and emits
//     `alert.triggered` to matching subscribers.
//
// This service contains NO synthetic data generation. Every event emitted is a
// real earthquake reported by USGS.

import { createServer } from "http";
import { Server } from "socket.io";
import { config as loadEnv } from "dotenv";

loadEnv({ path: "/home/z/my-project/.env" });

import { db } from "../../src/lib/db";
import { logger } from "../../src/lib/logger";
import { ingestBatch } from "../../src/lib/ingestion/ingest";
import { UsgsAdapter } from "../../src/lib/ingestion/usgs";
import { haversineKm } from "../../src/lib/geo";
import { mapEarthquake } from "../../src/lib/mappers";
import type { WsServerEvent, EarthquakeEvent } from "../../src/lib/types";

const PORT = 3003;
const POLL_INTERVAL_MS = Number(process.env.RT_POLL_INTERVAL_MS ?? 30_000); // 30s
const STATUS_INTERVAL_MS = 30_000;
const LOOKBACK_MS = 10 * 60 * 1000; // fetch events updated in last 10 min
const MIN_MAG = 2.0; // capture more frequent real micro/macro events

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

let lastPollAt: Date | null = null;

async function pollUsgs() {
  try {
    const since = lastPollAt ?? new Date(Date.now() - LOOKBACK_MS);
    // Use a slightly earlier start to avoid boundary misses.
    const sinceBuffered = new Date(since.getTime() - 30_000);
    const adapter = new UsgsAdapter({ since: sinceBuffered, minMagnitude: MIN_MAG });
    const result = await adapter.fetch();

    if (!result.ok) {
      logger.warn("rt.poll.usgs.failed", { error: result.error }, "realtime-service");
      await db.dataSource
        .update({
          where: { name: "USGS" },
          data: { status: "DEGRADED", lastFailureAt: new Date() },
        })
        .catch(() => undefined);
      return;
    }

    const outcome = await ingestBatch(result.events);

    // Emit created events
    for (const created of outcome.created) {
      const event: EarthquakeEvent = created;
      const payload: WsServerEvent = { type: "earthquake.created", data: event };
      io.emit("earthquake.created", payload.data);
      io.emit("message", payload);
      logger.info("rt.emit.earthquake.created", {
        externalId: event.externalId,
        magnitude: event.magnitude,
        depthKm: event.depthKm,
        location: event.locationDescription,
        originTime: event.originTime,
      }, "realtime-service");
      await evaluateAlerts(event);
    }

    // Emit updated events (e.g. automatic → reviewed, magnitude revision)
    for (const updated of outcome.updated) {
      io.emit("earthquake.updated", mapEarthquake(updated));
    }

    // Mark source healthy
    await db.dataSource
      .update({
        where: { name: "USGS" },
        data: {
          status: "HEALTHY",
          lastSuccessAt: new Date(),
          lastEventExternalId: outcome.created[outcome.created.length - 1]?.externalId ?? undefined,
        },
      })
      .catch(() => undefined);

    lastPollAt = new Date();
    if (outcome.created.length > 0 || outcome.updated.length > 0) {
      logger.info("rt.poll.summary", {
        fetched: result.events.length,
        created: outcome.created.length,
        updated: outcome.updated.length,
        unchanged: outcome.unchanged,
      }, "realtime-service");
    }
  } catch (e) {
    logger.error("rt.poll.error", { error: String(e) }, "realtime-service");
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
      // Dedup: don't notify twice for the same (subscription, earthquake) pair.
      const existing = await db.notificationEvent.findFirst({
        where: { earthquakeId: event.id, subscriptionId: s.id },
        select: { id: true },
      });
      if (existing) continue;

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
  socket.emit("hello", { service: "seismo-ph-realtime", time: new Date().toISOString(), source: "USGS (live)" });

  socket.on("subscribe", (data: { channels?: string[] }) => {
    logger.info("rt.client.subscribe", { id: socket.id, channels: data?.channels }, "realtime-service");
  });

  socket.on("disconnect", (reason) => {
    logger.info("rt.client.disconnected", { id: socket.id, reason }, "realtime-service");
  });
});

httpServer.listen(PORT, () => {
  logger.info("rt.listen", { port: PORT, source: "USGS (live)", pollIntervalMs: POLL_INTERVAL_MS, minMag: MIN_MAG }, "realtime-service");
  console.log(`\n✓ SEISMO PH realtime service on port ${PORT}`);
  console.log(`  WebSocket:  io("/?XTransformPort=${PORT}")`);
  console.log(`  Source:      USGS FDSN-WS (REAL, live)`);
  console.log(`  Poll:        every ${POLL_INTERVAL_MS / 1000}s, min magnitude ${MIN_MAG}\n`);

  // Initial poll shortly after boot.
  setTimeout(pollUsgs, 2000);
  setInterval(pollUsgs, POLL_INTERVAL_MS);
  setInterval(broadcastStatus, STATUS_INTERVAL_MS);
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
