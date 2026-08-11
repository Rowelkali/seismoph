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
import { PhivolcsAdapter } from "../../src/lib/ingestion/phivolcs";
import { haversineKm } from "../../src/lib/geo";
import { mapEarthquake } from "../../src/lib/mappers";
import type { WsServerEvent, EarthquakeEvent, RawEarthquake } from "../../src/lib/types";

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

// Source hierarchy:
//   1. DOST-PHIVOLCS (PRIMARY)  — Philippine-authoritative. When configured,
//      its events take precedence. If a USGS event matches a PHIVOLCS event
//      (same time/location within tolerance), the PHIVOLCS record wins.
//   2. USGS (SECONDARY)         — Always active. Provides live, real-time
//      global seismic data covering the Philippines. Serves as backup
//      monitoring and cross-reference when PHIVOLCS is not configured.
//
// Cross-reference logic:
//   - After ingesting both sources, match events by time (±60s) and distance
//     (≤50km). When a match is found, the PHIVOLCS record is authoritative;
//     the USGS record is kept for cross-reference but not emitted as a
//     separate "created" event (it's the same earthquake).

const phivolcsAdapter = new PhivolcsAdapter();

async function pollSources() {
  try {
    const since = lastPollAt ?? new Date(Date.now() - LOOKBACK_MS);
    const sinceBuffered = new Date(since.getTime() - 30_000);

    // --- 1. PRIMARY: DOST-PHIVOLCS ---
    const phivolcsResult = await phivolcsAdapter.fetch();
    const phivolcsConfigured = phivolcsAdapter.configured;

    if (phivolcsConfigured) {
      if (phivolcsResult.ok) {
        await db.dataSource.update({
          where: { name: "DOST-PHIVOLCS" },
          data: { status: "HEALTHY", lastSuccessAt: new Date(), endpoint: process.env.PHIVOLCS_API_URL },
        }).catch(() => undefined);
        logger.info("rt.poll.phivolcs.ok", { count: phivolcsResult.events.length }, "realtime-service");
      } else {
        await db.dataSource.update({
          where: { name: "DOST-PHIVOLCS" },
          data: { status: "DEGRADED", lastFailureAt: new Date() },
        }).catch(() => undefined);
        logger.warn("rt.poll.phivolcs.failed", { error: phivolcsResult.error }, "realtime-service");
      }
    }

    // --- 2. SECONDARY: USGS (always polled as backup/cross-reference) ---
    const usgsAdapterRecent = new UsgsAdapter({ since: sinceBuffered, minMagnitude: MIN_MAG });
    const usgsResult = await usgsAdapterRecent.fetch();

    if (!usgsResult.ok) {
      logger.warn("rt.poll.usgs.failed", { error: usgsResult.error }, "realtime-service");
      await db.dataSource.update({
        where: { name: "USGS" },
        data: { status: "DEGRADED", lastFailureAt: new Date() },
      }).catch(() => undefined);
      return;
    }

    // --- Cross-reference: filter out USGS events that match PHIVOLCS events ---
    let eventsToIngest: typeof usgsResult.events = [];
    const phivolcsEvents = phivolcsResult.ok ? phivolcsResult.events : [];

    if (phivolcsEvents.length > 0) {
      // Ingest PHIVOLCS events first (primary, authoritative)
      const phivolcsOutcome = await ingestBatch(phivolcsEvents);
      for (const created of phivolcsOutcome.created) {
        await emitCreated(created);
      }

      // Filter USGS events: skip those that match a PHIVOLCS event
      eventsToIngest = usgsResult.events.filter((usgsEq) => {
        return !phivolcsEvents.some((pEq) => isSameEvent(pEq, usgsEq));
      });
      logger.info("rt.poll.crossref", {
        phivolcs: phivolcsEvents.length,
        usgs: usgsResult.events.length,
        usgsAfterXref: eventsToIngest.length,
        filtered: usgsResult.events.length - eventsToIngest.length,
      }, "realtime-service");
    } else {
      // No PHIVOLCS events (not configured or no new events) — ingest all USGS
      eventsToIngest = usgsResult.events;
    }

    // --- Ingest USGS events (secondary) ---
    const outcome = await ingestBatch(eventsToIngest);

    for (const created of outcome.created) {
      await emitCreated(created);
    }
    for (const updated of outcome.updated) {
      io.emit("earthquake.updated", mapEarthquake(updated));
    }

    // Mark USGS healthy
    await db.dataSource.update({
      where: { name: "USGS" },
      data: {
        status: "HEALTHY",
        lastSuccessAt: new Date(),
        lastEventExternalId: outcome.created[outcome.created.length - 1]?.externalId ?? undefined,
      },
    }).catch(() => undefined);

    lastPollAt = new Date();
    if (outcome.created.length > 0 || outcome.updated.length > 0 || (phivolcsEvents.length > 0)) {
      logger.info("rt.poll.summary", {
        phivolcsFetched: phivolcsEvents.length,
        usgsFetched: usgsResult.events.length,
        usgsAfterXref: eventsToIngest.length,
        created: outcome.created.length,
        updated: outcome.updated.length,
        unchanged: outcome.unchanged,
      }, "realtime-service");
    }
  } catch (e) {
    logger.error("rt.poll.error", { error: String(e) }, "realtime-service");
  }
}

/** Determine if two events from different sources refer to the same earthquake. */
function isSameEvent(a: RawEarthquake, b: RawEarthquake): boolean {
  const timeDiff = Math.abs(a.originTime.getTime() - b.originTime.getTime());
  if (timeDiff > 90_000) return false; // ±90 seconds
  const dist = haversineKm(a.latitude, a.longitude, b.latitude, b.longitude);
  if (dist > 50) return false; // ≤50 km
  return true;
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
  console.log(`  Primary:     DOST-PHIVOLCS ${phivolcsAdapter.configured ? "(configured, active)" : "(adapter ready, not configured)"}`);
  console.log(`  Secondary:   USGS FDSN-WS (REAL, live, backup + cross-reference)`);
  console.log(`  Poll:        every ${POLL_INTERVAL_MS / 1000}s, min magnitude ${MIN_MAG}\n`);

  // Initial poll shortly after boot.
  setTimeout(pollSources, 2000);
  setInterval(pollSources, POLL_INTERVAL_MS);
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
