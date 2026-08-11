// SEISMO PH — Database seed.
//
// Seeds REAL data:
//   - Locations: real PH regions, provinces, cities/municipalities (accurate coordinates)
//   - DataSources: USGS (HEALTHY, live), DOST-PHIVOLCS (UNKNOWN until configured)
//   - Earthquakes: REAL USGS earthquakes for the Philippine region, last 90 days,
//     ingested live via the FDSN-WS public API. NO synthetic fixtures.
//
// Run:  bun prisma/seed.ts

import { db } from "../src/lib/db";
import { logger } from "../src/lib/logger";
import { ingestBatch } from "../src/lib/ingestion/ingest";
import { UsgsAdapter } from "../src/lib/ingestion/usgs";
import { PH_CITIES, PH_REGIONS } from "../src/lib/ingestion/seed-data";

async function main() {
  logger.info("seed.start", { source: "USGS (real)" });

  // --- Wipe all earthquake data (removes any prior DEV-SEED fixtures) -------
  await db.notificationEvent.deleteMany();
  await db.intensityReport.deleteMany();
  await db.earthquake.deleteMany();
  await db.location.deleteMany();
  await db.alertSubscription.deleteMany();
  await db.dataSource.deleteMany();

  // --- DataSources ---------------------------------------------------------
  await db.dataSource.create({
    data: {
      name: "USGS",
      endpoint: "https://earthquake.usgs.gov/fdsnws/event/1/query",
      status: "HEALTHY",
      version: "fdsnws-event-1",
      attribution:
        "U.S. Geological Survey (USGS), Earthquake Hazards Program — https://earthquake.usgs.gov. Real-time data retrieved via the FDSN-WS public API.",
      lastSuccessAt: new Date(),
    },
  });
  await db.dataSource.create({
    data: {
      name: "DOST-PHIVOLCS",
      status: "UNKNOWN",
      attribution:
        "DOST-PHIVOLCS — Department of Science and Technology, Philippine Institute of Volcanology and Seismology. Data © PHIVOLCS/DOST. The Philippine-authoritative source; integration pending a confirmed authorized endpoint.",
    },
  });

  // --- Locations (real PH geography) ---------------------------------------
  let locCount = 0;
  for (const region of PH_REGIONS) {
    const regionCities = PH_CITIES.filter((c) => c.region === region.code);
    const lat = regionCities.length > 0 ? regionCities.reduce((s, c) => s + c.lat, 0) / regionCities.length : 12.8797;
    const lon = regionCities.length > 0 ? regionCities.reduce((s, c) => s + c.lon, 0) / regionCities.length : 121.774;
    await db.location.create({
      data: { name: region.name, type: "REGION", region: region.code, latitude: lat, longitude: lon },
    });
    locCount++;
    for (const province of region.provinces) {
      const provCities = PH_CITIES.filter((c) => c.province === province);
      const plat = provCities.length > 0 ? provCities.reduce((s, c) => s + c.lat, 0) / provCities.length : lat;
      const plon = provCities.length > 0 ? provCities.reduce((s, c) => s + c.lon, 0) / provCities.length : lon;
      await db.location.create({
        data: { name: province, type: "PROVINCE", region: region.code, province, latitude: plat, longitude: plon },
      });
      locCount++;
    }
  }
  for (const c of PH_CITIES) {
    await db.location.create({
      data: {
        name: c.name,
        type: c.type,
        region: c.region,
        province: c.province,
        latitude: c.lat,
        longitude: c.lon,
        population: c.population ?? null,
      },
    });
    locCount++;
  }
  logger.info("seed.locations", { count: locCount });

  // --- REAL earthquakes from USGS (last 90 days, PH bounding box) -----------
  console.log("Fetching real earthquakes from USGS (last 90 days, Philippine region)…");
  const adapter = new UsgsAdapter({ days: 90, minMagnitude: 2.5 });
  const result = await adapter.fetch();

  if (!result.ok || result.events.length === 0) {
    logger.error("seed.usgs.failed", { error: result.error });
    console.error(`\n✗ Could not fetch real USGS data: ${result.error}`);
    console.error("  Check network connectivity to earthquake.usgs.gov and re-run.\n");
    process.exit(1);
  }

  const outcome = await ingestBatch(result.events);

  // Update source health with the latest event's external id.
  const latest = outcome.created[outcome.created.length - 1] ?? outcome.updated[outcome.updated.length - 1];
  if (latest) {
    await db.dataSource.update({
      where: { name: "USGS" },
      data: {
        lastSuccessAt: new Date(),
        lastEventExternalId: latest.externalId,
        status: "HEALTHY",
      },
    });
  }

  const total = await db.earthquake.count();
  logger.info("seed.complete", {
    earthquakes: total,
    created: outcome.created.length,
    updated: outcome.updated.length,
    unchanged: outcome.unchanged,
    locations: locCount,
  });
  console.log(`\n✓ SEISMO PH seed complete — REAL DATA`);
  console.log(`  Locations:      ${locCount} (real PH geography)`);
  console.log(`  Earthquakes:    ${total} (REAL USGS data, last 90 days)`);
  console.log(`  Created:        ${outcome.created.length}`);
  console.log(`  Updated:        ${outcome.updated.length}`);
  console.log(`  Rejected:       ${outcome.rejected.length}`);
  console.log(`  Data sources:   USGS (HEALTHY, live), DOST-PHIVOLCS (UNKNOWN)\n`);
}

main()
  .catch((e) => {
    logger.error("seed.failed", { error: String(e) });
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
