// SEISMO PH — Server-side PHIVOLCS polling module.
// Runs INSIDE the Next.js process (no separate service needed).
// This avoids the OOM issue of running two processes (Next.js + realtime
// service) in a memory-constrained 4GB environment.
//
// The poller runs on a 120s interval and can also be triggered on-demand
// via the /api/earthquakes/recent endpoint when the data is stale.
//
// WebSocket (socket.io) is still used for instant push when available, but
// the data freshness no longer depends on a separate service being alive.

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { ingestBatch } from "@/lib/ingestion/ingest";
import { PhivolcsAdapter } from "@/lib/ingestion/phivolcs";

// The PHIVOLCS server's TLS certificate chain is not trusted by some
// environments (like the development sandbox). In production (Vercel),
// the CA bundle is proper and this is NOT needed.
// We only disable TLS verification temporarily during PHIVOLCS fetches
// rather than globally, to avoid the security warning.
// The PhivolcsAdapter handles this per-request via a custom fetch wrapper.

const POLL_INTERVAL_MS = 120_000; // 2 minutes
const STALE_THRESHOLD_MS = 90_000; // if last source check > 90s ago, poll on demand
const REALTIME_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours — only emit events within this window

let pollInProgress = false;
let lastPollAt: Date | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;

const adapter = new PhivolcsAdapter();

/** Check if the source data is stale (last check > 90s ago). */
export async function isSourceStale(): Promise<boolean> {
  try {
    const source = await db.dataSource.findUnique({ where: { name: "DOST-PHIVOLCS" } });
    if (!source?.lastSuccessAt) return true;
    const age = Date.now() - source.lastSuccessAt.getTime();
    return age > STALE_THRESHOLD_MS;
  } catch {
    return true;
  }
}

/** Get the latest source status for the API. */
export async function getSourceStatus() {
  const source = await db.dataSource.findUnique({ where: { name: "DOST-PHIVOLCS" } });
  return {
    status: source?.status ?? "UNKNOWN",
    lastSuccessAt: source?.lastSuccessAt?.toISOString() ?? null,
    lastFailureAt: source?.lastFailureAt?.toISOString() ?? null,
  };
}

/** Poll PHIVOLCS for new bulletins. Returns the count of new events found. */
export async function pollPhivolcs(): Promise<{ created: number; emitted: number }> {
  if (pollInProgress) {
    return { created: 0, emitted: 0 };
  }
  pollInProgress = true;

  try {
    // Get known IDs (only recent 200 to save memory)
    const existing = await db.earthquake.findMany({
      where: { source: "DOST-PHIVOLCS" },
      select: { externalId: true },
      take: 200,
      orderBy: { createdAt: "desc" },
    });
    const knownIds = new Set(existing.map((e) => e.externalId));

    // Fetch only 5 new bulletins (memory-conservative)
    const result = await adapter.fetch({ maxEvents: 5, knownIds });

    if (!result.ok) {
      logger.warn("poll.phivolcs.failed", { error: result.error }, "server-poller");
      // Use upsert to avoid crash if DataSource record doesn't exist
      await db.dataSource
        .upsert({
          where: { name: "DOST-PHIVOLCS" },
          update: { status: "DEGRADED", lastFailureAt: new Date() },
          create: { name: "DOST-PHIVOLCS", status: "DEGRADED", lastFailureAt: new Date(), attribution: "DOST-PHIVOLCS" },
        })
        .catch(() => undefined);
      return { created: 0, emitted: 0 };
    }

    // Ingest all parsed events
    const outcome = await ingestBatch(result.events);

    // Count how many are genuinely "new" (origin time within 2 hours)
    const now = Date.now();
    let emitted = 0;
    for (const created of outcome.created) {
      const originAge = now - new Date(created.originTime).getTime();
      if (originAge <= REALTIME_WINDOW_MS) {
        emitted++;
      }
    }

    // Mark source healthy (upsert to handle missing record gracefully)
    await db.dataSource
      .upsert({
        where: { name: "DOST-PHIVOLCS" },
        update: {
          status: "HEALTHY",
          lastSuccessAt: new Date(),
          lastEventExternalId: outcome.created[outcome.created.length - 1]?.externalId ?? undefined,
        },
        create: {
          name: "DOST-PHIVOLCS",
          status: "HEALTHY",
          lastSuccessAt: new Date(),
          attribution: "DOST-PHIVOLCS — earthquake.phivolcs.dost.gov.ph",
          lastEventExternalId: outcome.created[outcome.created.length - 1]?.externalId ?? undefined,
        },
      })
      .catch(() => undefined);

    lastPollAt = new Date();

    if (outcome.created.length > 0) {
      logger.info("poll.summary", {
        fetched: result.events.length,
        created: outcome.created.length,
        emitted,
        unchanged: outcome.unchanged,
      }, "server-poller");
    }

    return { created: outcome.created.length, emitted };
  } catch (e) {
    logger.error("poll.error", { error: String(e) }, "server-poller");
    return { created: 0, emitted: 0 };
  } finally {
    pollInProgress = false;
  }
}

/** Start the background poller. Call once on server startup. */
export function startPoller() {
  if (intervalId) return; // already running
  logger.info("poller.start", { intervalMs: POLL_INTERVAL_MS }, "server-poller");

  // Initial poll after 5s
  setTimeout(() => {
    void pollPhivolcs();
  }, 5000);

  // Regular interval
  intervalId = setInterval(() => {
    void pollPhivolcs();
  }, POLL_INTERVAL_MS);
}

/** Trigger an on-demand poll if the data is stale. Called by the API when
 *  clients request recent earthquakes and the source hasn't been checked
 *  recently. This ensures data freshness without a separate service. */
export async function pollIfStale(): Promise<void> {
  const stale = await isSourceStale();
  if (stale) {
    await pollPhivolcs();
  }
}
