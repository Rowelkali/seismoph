"use client";

import { useSources } from "@/hooks/use-seismo-data";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusIndicator } from "@/components/seismo/StatusIndicator";
import { Info, Database, Map, AlertTriangle, Github, FileText, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function AboutPanel({ className }: { className?: string }) {
  const { data: sources, total } = useSources();

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Info className="h-5 w-5 text-primary" /> About SEISMO PH
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Real-time earthquake intelligence for the Philippines. Data sources, attribution & disclaimer.
        </p>
      </div>
      <ScrollArea className="flex-1 scroll-slim">
        <div className="space-y-4 p-4 max-w-3xl">
          <Card icon={Info} title="What this platform is">
            <p className="text-sm leading-relaxed">
              SEISMO PH is an information visualization service that presents Philippine earthquake
              activity on an interactive 3D map with real-time updates, a historical explorer, analytics,
              configurable alerts, and an educational AI explainer. It is designed to provide a
              substantially better user experience for exploring earthquake information.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              It does <strong>not</strong> replace PHIVOLCS, does not predict earthquakes, and does not
              generate emergency warnings.
            </p>
          </Card>

          <Card icon={Database} title="Source hierarchy — how data flows">
            <pre className="overflow-x-auto rounded-md border border-border bg-background/60 p-3 text-[10px] leading-tight font-mono text-muted-foreground">
{`  DOST-PHIVOLCS
       │
 Primary source
       │
       ▼
┌─────────────────┐
│  SEISMO PH      │
│  Data Ingestion │
└────────┬────────┘
         │
    PostgreSQL
         │
   WebSocket/SSE
         │
         ▼
    Your 3D Map


  USGS
   │
 Secondary source
   │
   ▼
Cross-reference /
backup monitoring`}
            </pre>
            <div className="mt-3 space-y-2">
              <div className="rounded-md border border-primary/30 bg-primary/5 p-2.5">
                <p className="text-xs font-semibold text-primary">① Primary: DOST-PHIVOLCS</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  The Philippine-authoritative source. When configured (set <code className="font-mono">PHIVOLCS_API_URL</code>),
                  PHIVOLCS events take precedence. If a USGS event matches a PHIVOLCS event (same time ±90s, distance ≤50km),
                  the PHIVOLCS record is authoritative; the USGS record is used only for cross-reference.
                </p>
              </div>
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2.5">
                <p className="text-xs font-semibold text-emerald-400">② Secondary: USGS</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Always active. Provides real, live, real-time global seismic data covering the Philippines
                  via the FDSN-WS public API. Serves as backup monitoring and cross-reference when PHIVOLCS
                  is not configured or is temporarily unavailable.
                </p>
              </div>
            </div>
            <ul className="mt-3 space-y-2">
              {sources.map((s) => (
                <li key={s.id} className="rounded-md border border-border bg-card/30 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm">{s.name}</span>
                    <StatusIndicator
                      status={
                        s.status === "HEALTHY" ? "live"
                        : s.status === "DEGRADED" ? "degraded"
                        : s.status === "DOWN" ? "down" : "unknown"
                      }
                      label={s.status}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground leading-snug">{s.attribution}</p>
                  {s.lastSuccessAt && (
                    <p className="mt-1 text-[10px] font-mono text-muted-foreground">
                      Last success: {new Date(s.lastSuccessAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })} PHT
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Total stored events: <span className="font-mono text-foreground">{total.toLocaleString()}</span>
            </p>
          </Card>

          <Card icon={Map} title="Map, terrain & official PHIVOLCS layers">
            <ul className="ml-4 list-disc space-y-1 text-sm">
              <li>Basemap: <strong>CARTO dark matter</strong> (© OpenStreetMap contributors, © CARTO).</li>
              <li>Terrain: <strong>AWS Terrain Tiles</strong> (terrarium encoding) — public DEM tiles.</li>
              <li><strong>Active faults & trenches: official DOST-PHIVOLCS data</strong> from the PHIVOLCS GIS ArcGIS REST server (<code className="font-mono text-[11px]">gisweb.phivolcs.dost.gov.ph/arcgis/rest/services/PHIVOLCSPublic</code>). Real, authoritative fault/trench geometry — not schematic.</li>
              <li>Available official PHIVOLCS hazard layers (ready to enable): Ground Shaking, Liquefaction, Earthquake-Induced Landslide, Tsunami.</li>
            </ul>
          </Card>

          <Card icon={Database} title="PHIVOLCS data-access research (honest findings)">
            <p className="text-sm leading-relaxed">
              We researched how PHIVOLCS exposes its earthquake data. Here&apos;s the honest status:
            </p>
            <ul className="ml-4 mt-2 list-disc space-y-1.5 text-sm">
              <li><strong>No public developer API with API-key registration exists.</strong> PHIVOLCS publishes earthquake bulletins via their website (<code className="font-mono text-[11px]">phivolcs.dost.gov.ph/earthquake-information</code>) and social media, not a documented REST API.</li>
              <li>A 2020 FOI request (foi.gov.ph, tracking #DOST-816649676701) asked DOST for &quot;an API for the latest earthquake update&quot; — no public API was provided.</li>
              <li><strong>Official PHIVOLCS GIS data IS publicly accessible</strong> via the ArcGIS REST server at <code className="font-mono text-[11px]">gisweb.phivolcs.dost.gov.ph</code> — used here for active faults, trenches, and hazard layers.</li>
              <li><strong>The legitimate production path for real-time PHIVOLCS earthquake bulletins</strong> is a formal data-access request to DOST-PHIVOLCS (<code className="font-mono text-[11px]">phivolcs@phivolcs.dost.gov.ph</code>, trunkline 8426-1468) or an FOI request at <code className="font-mono text-[11px]">foi.gov.ph</code>.</li>
              <li>Until that access is granted, <strong>USGS</strong> (which reports PH events within minutes via the global ANSS catalog) serves as the live real-time source, with cross-referencing against PHIVOLCS when configured.</li>
            </ul>
            <p className="mt-2 text-[11px] text-muted-foreground">
              We do not scrape the PHIVOLCS website — scraping would be legally and operationally fragile and is not a production-grade approach.
            </p>
          </Card>

          <Card icon={ShieldCheck} title="Engineering & security">
            <ul className="ml-4 list-disc space-y-1 text-sm">
              <li>TypeScript end-to-end with shared domain types & Zod-style validation.</li>
              <li>Idempotent ingestion pipeline (validate → dedup → persist) with provenance tracking.</li>
              <li>Graceful source-failure handling — the UI never pretends stale data is live.</li>
              <li>REST API with pagination, query validation, structured error envelope, rate limiting, and health checks.</li>
              <li>Realtime updates over WebSocket (socket.io) — no client-side polling of the source.</li>
              <li>Structured JSON logging; secrets via environment variables only; never logged.</li>
            </ul>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Production target: PostgreSQL + PostGIS, managed Redis, containerized workers, CI/CD. This
              sandbox runs SQLite (geodesic distance computed in-app via haversine).
            </p>
          </Card>

          <Card icon={AlertTriangle} title="Legal & safety disclaimer">
            <p className="text-sm leading-relaxed">
              SEISMO PH is an information visualization service and does <strong>not</strong> replace
              official government warnings, emergency instructions, or PHIVOLCS advisories. During an
              emergency, users must follow official instructions from DOST-PHIVOLCS, the NDRRMC, and local
              authorities. This platform is not an official government service.
            </p>
            <p className="mt-2 text-sm leading-relaxed">
              The platform cannot guarantee anyone&apos;s safety. Where no official warning is available
              for a location, the platform states exactly that — it never claims a user is &quot;safe&quot;.
            </p>
          </Card>

          <Card icon={FileText} title="API documentation">
            <p className="text-sm">A documented REST API is available at <code className="rounded bg-muted/40 px-1 py-0.5 font-mono text-xs">/api</code> with endpoints for earthquakes, locations, statistics, sources, alerts, health, and AI explanation.</p>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}

function Card({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card/30 p-3">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-primary" /> {title}
      </h3>
      {children}
    </section>
  );
}
