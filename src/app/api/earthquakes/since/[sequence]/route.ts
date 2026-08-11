// GET /api/earthquakes/since/[sequence]
// Event recovery endpoint — returns all earthquakes with sequence > the given
// value. Used by clients on WebSocket reconnect to fetch missed events.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mapEarthquake } from "@/lib/mappers";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ sequence: string }> },
) {
  try {
    const { sequence } = await ctx.params;
    const sinceSeq = parseInt(sequence, 10);
    if (!Number.isFinite(sinceSeq) || sinceSeq < 0) {
      return NextResponse.json(
        { error: { code: "INVALID_SEQUENCE", message: "sequence must be a non-negative integer." } },
        { status: 400 },
      );
    }

    const rows = await db.earthquake.findMany({
      where: { sequence: { gt: sinceSeq } },
      orderBy: { sequence: "asc" },
      take: 200,
    });

    const maxSeq = await db.earthquake.aggregate({ _max: { sequence: true } });

    return NextResponse.json({
      data: rows.map(mapEarthquake),
      sinceSequence: sinceSeq,
      latestSequence: maxSeq._max.sequence ?? sinceSeq,
      missedCount: rows.length,
      hasMore: rows.length === 200,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: msg } },
      { status: 500 },
    );
  }
}
