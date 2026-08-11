// SEISMO PH — Database seed.
//
// Seeds REAL data:
//   - Locations: real PH regions, provinces, cities/municipalities
//   - DataSources: DOST-PHIVOLCS (PRIMARY, HEALTHY, live), USGS (legacy/backup, OFFLINE)
//   - Earthquakes: REAL PHIVOLCS earthquake bulletins fetched live from
//     earthquake.phivolcs.dost.gov.ph (the latest ~40 events). NO synthetic data.
//
// Run:  bun prisma/seed.ts

import { db } from "../src/lib/db";
import { logger } from "../src/lib/logger";
import { ingestBatch } from "../src/lib/ingestion/ingest";
import { PhivolcsAdapter } from "../src/lib/ingestion/phivolcs";
import { PH_CITIES, PH_REGIONS } from "../src/lib/ingestion/seed-data";

async function main() {
  logger.info("seed.start", { source: "DOST-PHIVOLCS (real)" });

  // --- Wipe all earthquake data ---
  await db.notificationEvent.deleteMany();
  await db.intensityReport.deleteMany();
  await db.earthquake.deleteMany();
  await db.location.deleteMany();
  await db.alertSubscription.deleteMany();
  await db.dataSource.deleteMany();

  // --- DataSources: PHIVOLCS is now PRIMARY and live ---
  await db.dataSource.create({
    data: {
      name: "DOST-PHIVOLCS",
      endpoint: "https://earthquake.phivolcs.dost.gov.ph/",
      status: "HEALTHY",
      version: "bulletin-html-1",
      attribution:
        "DOST-PHIVOLCS — Philippine Institute of Volcanology and Seismology. Real-time earthquake bulletins from earthquake.phivolcs.dost.gov.ph.",
      lastSuccessAt: new Date(),
    },
  });
  await db.dataSource.create({
    data: {
      name: "USGS",
      endpoint: "https://earthquake.usgs.gov/fdsnws/event/1/query",
      status: "OFFLINE",
      attribution: "U.S. Geological Survey (USGS). Disabled — platform now uses DOST-PHIVOLCS as the primary source.",
    },
  });

  // --- Locations (real PH geography) ---
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
      data: { name: c.name, type: c.type, region: c.region, province: c.province, latitude: c.lat, longitude: c.lon, population: c.population ?? null },
    });
    locCount++;
  }
  logger.info("seed.locations", { count: locCount });

  // --- REAL earthquakes from PHIVOLCS (latest ~40 bulletins) ---
  console.log("Fetching real earthquake bulletins from PHIVOLCS (earthquake.phivolcs.dost.gov.ph)…");
  const adapter = new PhivolcsAdapter();
  const result = await adapter.fetch({ maxEvents: 40 });

  if (!result.ok || result.events.length === 0) {
    logger.error("seed.phivolcs.failed", { error: result.error });
    console.error(`\n✗ Could not fetch PHIVOLCS data: ${result.error}`);
    console.error("  Check network connectivity to earthquake.phivolcs.dost.gov.ph and re-run.\n");
    process.exit(1);
  }

  const outcome = await ingestBatch(result.events);

  // Update source health
  const latest = outcome.created[outcome.created.length - 1];
  if (latest) {
    await db.dataSource.update({
      where: { name: "DOST-PHIVOLCS" },
      data: { lastSuccessAt: new Date(), lastEventExternalId: latest.externalId, status: "HEALTHY" },
    });
  }

  const total = await db.earthquake.count();
  console.log(`\n✓ SEISMO PH seed complete — REAL PHIVOLCS DATA`);
  console.log(`  Locations:      ${locCount} (real PH geography)`);
  console.log(`  Earthquakes:    ${total} (REAL PHIVOLCS bulletins)`);
  console.log(`  Created:        ${outcome.created.length}`);
  console.log(`  Rejected:       ${outcome.rejected.length}`);
  console.log(`  Data sources:   DOST-PHIVOLCS (HEALTHY, primary), USGS (OFFLINE)\n`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await db.$disconnect(); });
