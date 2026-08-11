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

---
Task ID: REAL-DATA
Agent: Z.ai Code (main)
Task: Replace all synthetic DEV-SEED fixtures with real, live earthquake data.

Work Log:
- Built real UsgsAdapter (src/lib/ingestion/usgs.ts) querying the USGS FDSN-WS public API (https://earthquake.usgs.gov/fdsnws/event/1/query) for the Philippine bounding box. Real GeoJSON parsing, namespaced externalIds (usgs-<id>), MMI→PEIS intensity conversion where USGS provides instrumental/DYFI intensity (labeled USGS-MMI, never claimed as PHIVOLCS PEIS).
- Updated seed script to delete ALL prior DEV-SEED fixtures and ingest 536 REAL USGS earthquakes (last 90 days, M2.5+, PH region). Ran successfully — zero synthetic events remain.
- Rewrote realtime service (mini-services/realtime-service/index.ts) to poll USGS every 60s for genuinely new/updated Philippine events. Removed all synthetic generation logic. Broadcasts real earthquake.created / earthquake.updated events. Alert subscription evaluation with dedup.
- Purged all DEV-SEED earthquakes (536 + 2 leftover from old generator) and removed DEV-SEED from DataSource table. DB now contains only real USGS data.
- Updated UI: DevDataBanner now only renders when a DEV-SEED source is actively HEALTHY (it is not — hidden). TopBar shows "USGS: HEALTHY" as primary source indicator. Footer attribution → "Earthquake data: USGS (live, real-time)". About panel documents USGS as live source + PHIVOLCS adapter as documented production seam. DetailPanel shows "USGS · Live" badge for USGS events. AI explainer system prompt references USGS as the real source.

Stage Summary:
- Database: 536 real USGS earthquakes, 0 synthetic. Sources: USGS=HEALTHY, DOST-PHIVOLCS=UNKNOWN (adapter ready, awaiting confirmed endpoint).
- Realtime: polls USGS FDSN-WS every 60s for real new events; broadcasts via WebSocket. No synthetic generation.
- Verified in Agent Browser: page shows real earthquakes (e.g. "M4.6 MB 103km — 13 km ESE of San Miguel, Philippines, REVIEWED"), no DEVELOPMENT DATA banner, USGS:HEALTHY in topbar, footer says "USGS (live, real-time)", detail panel shows real data with depth cross-section. Lint clean, zero console errors.
- The PHIVOLCS adapter remains as the documented production integration point (set PHIVOLCS_API_URL to activate); USGS is the live working source providing real, authoritative, real-time Philippine earthquake data.

---
Task ID: REALTIME-UX
Agent: Z.ai Code (main)
Task: Make the platform feel live (realtime pop-ups + sound), hide detail panel when nothing selected, add PHIVOLCS-style alert siren.

Work Log:
- Built useAlertSound hook (src/hooks/use-alert-sound.ts): Web Audio API two-tone alternating siren (970Hz↔670Hz, 6 cycles). No audio file bundled — synthesized on demand. Respects soundEnabled setting. Unlocks AudioContext on first user gesture (browser policy). Three intensities: major (M6+), minor (M4-5.9), test.
- Added soundEnabled to AppSettings store (default true). Added sound toggle button in TopBar (Volume2/VolumeX icon). Added "Alert sound" setting row with Test button in Settings sheet.
- Added live-replay system to store: popped[] (events visible on map via animation), lastPopped (for pulse animation), pushPopped/setPopped. 
- Rewrote page.tsx: (1) Detail panel now ONLY renders when an earthquake is selected — no more persistent placeholder covering the map. Map gets full width when nothing is selected. Bottom stream expands to full width too. (2) Auto-replays the 12 most recent real earthquakes on first load — they pop onto the map one-by-one (700ms interval) with alert sound for M4.5+ events. (3) "Replay recent" button (top-right) re-triggers the animation anytime. (4) Realtime onCreated now pushes to popped (animates on map) + triggers sound for M4.0+ + toast notification. (5) Alert subscriptions trigger major siren.
- Updated realtime service: poll interval 60s→30s, min magnitude 2.5→2.0, lookback 5min→10min. Captures more frequent real events.
- Restarted dev server (had crashed) and realtime service.

Stage Summary:
- Three user complaints addressed: (1) platform now feels live — recent real earthquakes animate onto the map on load + "Replay recent" button + 30s USGS polling for genuine new events; (2) detail panel only appears when you click an earthquake (map is no longer covered); (3) emergency siren plays on new significant earthquakes (M4.0+) with toggle + test button.
- Verified in Agent Browser: page renders, detail panel hidden initially, opens on click, closes on close button. Replay button works. Sound test button works (no console errors). USGS:HEALTHY shown. Lint clean.
- Real PH earthquakes are genuinely rare (~1-3/day M2.5+), so the replay animation + 30s polling + sound on new events is the honest way to make it feel live while waiting for real new quakes.

---
Task ID: SOURCE-HIERARCHY + MAP-FIX
Agent: Z.ai Code (main)
Task: Implement PHIVOLCS-primary / USGS-secondary source hierarchy + fix earthquakes not showing on map.

Work Log:
- ROOT CAUSE of map bug: MapLibre v6's WebGL worker wasn't processing GeoJSON source data (isSourceLoaded returned false, queryRenderedFeatures returned 0). The terrain DEM source was also keeping styleLoaded=false. Even after removing terrain, the GeoJSON worker silently failed to process data.
- MAP FIX: Rewrote EarthquakeMap to use HTML markers (MapLibre Marker API with custom DOM elements) instead of GeoJSON circle layers. HTML markers don't require the WebGL worker — they're DOM elements positioned on the map. 100 earthquake markers now render reliably with magnitude-colored dots, pulse animations for M4+, expanding rings for M4.5+, magnitude labels for M5+, and white selection highlight. City markers (55) also use HTML markers. Faults still use a GeoJSON line layer (simpler, static data). Terrain is off by default and dynamically added/removed on toggle.
- SOURCE HIERARCHY: Rewrote realtime service polling to implement the architecture:
  1. PRIMARY: DOST-PHIVOLCS — polled first. When configured (PHIVOLCS_API_URL set), events take precedence. Currently not configured → adapter reports "not_configured" gracefully.
  2. SECONDARY: USGS — always polled as backup + cross-reference. Provides live real-time data.
  Cross-reference: isSameEvent() matches events by time (±90s) and distance (≤50km). When a USGS event matches a PHIVOLCS event, the PHIVOLCS record is authoritative; the USGS duplicate is filtered out (not emitted as a separate created event).
- Updated About panel with the architecture diagram (ASCII art showing the flow: DOST-PHIVOLCS → Primary → SEISMO PH → PostgreSQL → WebSocket → 3D Map, with USGS as Secondary → Cross-reference/backup). Shows both sources with live status indicators.
- Startup banner shows: "Primary: DOST-PHIVOLCS (adapter ready, not configured)" and "Secondary: USGS FDSN-WS (REAL, live, backup + cross-reference)".

Stage Summary:
- Earthquakes now render on the map (100 HTML markers, verified in browser — click→detail panel works).
- Source hierarchy implemented: PHIVOLCS primary (adapter ready, awaiting configuration), USGS secondary (live, active, cross-referencing).
- Lint clean, both services running, no console errors.
- DB: 536 real USGS earthquakes, 0 PHIVOLCS (adapter not configured). Sources: USGS=HEALTHY, DOST-PHIVOLCS=UNKNOWN.
- To activate PHIVOLCS as primary: set PHIVOLCS_API_URL (and PHIVOLCS_API_KEY if required) with a confirmed authorized endpoint. The adapter will automatically take precedence over USGS for matching events.

---
Task ID: PHIVOLCS-RESEARCH
Agent: Z.ai Code (main)
Task: Research how PHIVOLCS actually exposes its data; restructure to PHIVOLCS-primary architecture per user's directive.

Work Log:
- Used web-search skill to research PHIVOLCS's actual data exposure. Findings:
  1. NO public developer API with API-key registration exists. PHIVOLCS publishes bulletins via website + social media (X, Facebook).
  2. A 2020 FOI request (foi.gov.ph #DOST-816649676701) asked DOST for "an API for the latest earthquake update" — no public API was provided.
  3. DISCOVERED: PHIVOLCS operates a public ArcGIS REST server at gisweb.phivolcs.dost.gov.ph/arcgis/rest/services with a /PHIVOLCSPublic/ folder containing official MapServer services: ActiveFault, Trenches, GroundShaking, Liquefaction, EarthquakeInducedLandslide, Tsunami, VolcanoLocation, Lava, Pyroclastic, BaseSurge, Seiches, VolcanoLahar.
  4. These are MapServer (not FeatureServer) — the `query` operation is disabled, but the `export` operation works and returns real PNG images of the official geometry. Verified: ActiveFault export returned a 9.8KB PNG, Trenches returned 29.7KB PNG.
  5. The legitimate production path for real-time PHIVOLCS earthquake bulletins is a formal data-access request to DOST-PHIVOLCS (phivolcs@phivolcs.dost.gov.ph) or an FOI request at foi.gov.ph.
- Rewrote src/lib/ingestion/phivolcs.ts with full documented research findings: the adapter remains the production seam (set PHIVOLCS_API_URL when an authorized endpoint is granted), and the source code itself documents the honest data-access path.
- Created src/lib/phivolcs-layers.ts — integration with the official PHIVOLCS ArcGIS MapServer services. Defines 6 official layers (ActiveFault, Trenches, GroundShaking, Liquefaction, EarthquakeInducedLandslide, Tsunami) with export-endpoint URL generation.
- Wired the official ActiveFault + Trenches raster layers into the map (EarthquakeMap.tsx) as MapLibre image sources, replacing the schematic SVG fault overlay with REAL official PHIVOLCS geometry. Verified in browser: both raster sources load (activeFaults: true, trenches: true), both visible by default.
- Updated About panel with two new sections:
  * "Map, terrain & official PHIVOLCS layers" — documents that active faults/trenches are now real official DOST-PHIVOLCS data.
  * "PHIVOLCS data-access research (honest findings)" — documents the research: no public API, FOI request, official GIS access, formal data-request path, and why USGS is the interim live source.
- Architecture is now exactly as the user specified:
    DOST-PHIVOLCS (primary, authoritative) → SEISMO PH adapter → PostgreSQL → WebSocket → 3D Map + Alerts
    USGS (secondary, live backup + cross-reference) feeds the same pipeline until PHIVOLCS is configured.

Stage Summary:
- Official DOST-PHIVOLCS fault and trench geometry is now live on the map (real data from gisweb.phivolcs.dost.gov.ph, not schematic).
- PHIVOLCS adapter fully documented with the honest research: no public API, formal data-request path, FOI precedent.
- About page transparently documents all findings + the legitimate production path.
- Lint clean, map loads (styleLoaded: true, loaded: true), both PHIVOLCS raster layers visible, zero errors.
- The platform no longer pretends PHIVOLCS integration works — it honestly states the status and provides the real path to activate it (formal data-access request), while using USGS legitimately as the interim live source.
