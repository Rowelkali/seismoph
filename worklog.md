# SEISMO PH — Build Worklog

---
Task ID: ALL
Agent: Z.ai Code (main)
Task: Build SEISMO PH — production-ready Philippine earthquake intelligence platform (Next.js 16, single `/` route, SQLite/Prisma, MapLibre 3D map, realtime WebSocket, AI explainer).

Work Log:
- Designed Prisma schema (Earthquake, IntensityReport, Location, AlertSubscription, NotificationEvent, DataSource) with proper indexes; pushed to SQLite.
- Built shared domain types (`src/lib/types.ts`), geodesic/validation utilities (`src/lib/geo.ts` — haversine, bearing, PEIS, magnitude severity, validation), structured JSON logger (`src/lib/logger.ts`), API helpers (`src/lib/api.ts` — error envelope, pagination, rate limiter).
- Philippine reference data + synthetic fixtures (`src/lib/ingestion/seed-data.ts`): 17 regions, 55 cities, 13 real seismic zones (Philippine Fault, Manila/Negros/Sulu/Cotabato/Philippine Trenches, Taal/Mayon volcanic arcs), seeded RNG + Gutenberg-Richter magnitude sampler. All fixtures tagged source="DEV-SEED".
- Ingestion pipeline: adapter interface (`source.ts`), documented PHIVOLCS adapter with graceful not-configured handling (`phivolcs.ts`), dev seed adapter (`devSeed.ts`), idempotent ingest core (`ingest.ts` — validate→dedup→upsert→dataVersion).
- Seed script (`prisma/seed.ts`): 300 earthquakes (220 recent-30d + 80 historical 2000–2024), 156 locations, 124 intensity reports. Ran successfully.
- REST API (15 routes): /api, /api/health(+live+ready), /api/earthquakes (filtered/paginated), /recent, /[id], /[id]/intensities, /api/locations/search, /api/locations/[id]/nearest (geodesic distance+bearing), /api/statistics (today/7d/30d + buckets), /api/sources, /api/alerts (CRUD), /api/ai/explain (LLM). All return 200; consistent error envelope; rate limited.
- Realtime mini-service (`mini-services/realtime-service/`, port 3003, socket.io): emits a new DEV-SEED earthquake every ~22s through the idempotent ingest pipeline, broadcasts `earthquake.created` + `system.status`, evaluates alert subscriptions → `alert.triggered`. Verified emitting.
- Frontend: scientific dark theme (amber/teal palette, NO indigo/blue), glass panels, custom scrollbar, pulse/ring/blink animations w/ reduced-motion guard. Design system: MagnitudeBadge, DepthTag, StatusIndicator, EventCard, DevDataBanner, IntensityScale, LayerControl, SeismoLogo, States (Empty/Error/Loading), DepthCrossSection (SVG hypocenter beneath surface + optional user-location slant distance).
- MapLibre 3D map (`EarthquakeMap.tsx`): inline CARTO dark raster style (no token), AWS terrarium DEM terrain (real 3D), earthquake circle layers colored by magnitude severity + magnitude labels + selected highlight + intensity rings + heatmap, schematic active-fault/trench polylines, city dots+labels, click→select, camera command props (reset/zoom/terrain).
- Zustand store (view, selection, layers, settings, realtime stream, history filters). React Query for server state (clean React 19 lint).
- Layout (`page.tsx`): TopBar (logo, LIVE status, PHIVOLCS source status, search, settings sheet), DevDataBanner, persistent 3D map canvas with floating glass panels (left nav+context, right detail, layer control, camera controls, bottom realtime stream), overlay sheets for Analytics/Safety/About, mobile bottom nav + detail bottom sheet, sticky attribution footer.
- Views: Live (recent list), Earthquakes, History (date/mag/depth/region/type filters), Analytics (stat cards + 4 recharts), Locations (search + nearest + distance + intensity), Alerts (create/list/toggle/delete), Safety (Drop/Cover/Hold On + preparedness + official sources), About (data sources + engineering + disclaimer).
- AI Explainer (z-ai-web-dev-sdk LLM): grounded in DB earthquake values, system prompt forbids prediction/warnings/invention, labels output "AI-generated explanation", supports optional user question + location distance. Verified returns grounded explanation + disclaimer.
- PWA manifest + icon. Dark-by-default. next-themes-ready.

Stage Summary:
- Dev server runs on :3000 (no fatal errors); realtime service on :3003 (emitting every ~22s).
- Agent Browser self-verification (via Caddy :81 so XTransformPort WS forwarding works): page renders desktop+mobile with zero console errors; 3D map loads with attribution; dev-data banner present; live list populated; click→detail panel (depth cross-section SVG + intensities + AI explainer + actions); AI explainer returns grounded text + disclaimer; Analytics charts render; Safety ("Drop, Cover, and Hold On"), About (data sources + disclaimer), Locations search ("davao"→Davao City) all functional; WebSocket realtime delivers fresh events to the live stream (verified 2 events <40s); all REST endpoints 200; sticky footer confirmed (bottom=winH); lint clean.
- Honest scope notes: sandbox uses SQLite (geodesic distance computed in-app via haversine, not PostGIS); earthquake events are clearly-labeled DEV-SEED fixtures (production uses the documented DOST-PHIVOLCS adapter — set PHIVOLCS_API_URL); fault traces are schematic (production uses licensed PHIVOLCS fault datasets); the platform never claims to predict earthquakes or guarantee safety, and always attributes DOST-PHIVOLCS as the authoritative source.
