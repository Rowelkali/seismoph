// SEISMO PH — Database seed.
//
// Seeds:
//   - Locations (real PH regions, provinces, cities/municipalities)
//   - DataSources (DEV-SEED marked HEALTHY; DOST-PHIVOLCS marked UNKNOWN until configured)
//   - Development earthquake fixtures (source="DEV-SEED"):
//       * ~220 events in the last 30 days (drives Live/Analytics/Map)
//       * ~80 historical events 2000-2024 (drives History explorer)
//   - Synthetic intensity reports for M5+ events near cities
//
// Idempotent: safe to re-run. Wipes earthquakes/intensities/locations before
// re-seeding (dev-only convenience).
//
// Run:  bun prisma/seed.ts

import { db } from "../src/lib/db";
import { logger } from "../src/lib/logger";
import { ingestBatch } from "../src/lib/ingestion/ingest";
import { DevSeedAdapter } from "../src/lib/ingestion/devSeed";
import { generateEarthquakes, PH_CITIES, PH_REGIONS } from "../src/lib/ingestion/seed-data";
import { haversineKm } from "../src/lib/geo";

async function main() {
  logger.info("seed.start", {});

  // --- Wipe (dev-only) -----------------------------------------------------
  await db.notificationEvent.deleteMany();
  await db.intensityReport.deleteMany();
  await db.earthquake.deleteMany();
  await db.location.deleteMany();
  await db.alertSubscription.deleteMany();
  await db.dataSource.deleteMany();

  // --- DataSources ---------------------------------------------------------
  await db.dataSource.create({
    data: {
      name: "DEV-SEED",
      endpoint: "local://dev-seed",
      status: "HEALTHY",
      version: "1.0.0-dev",
      attribution:
        "Development fixture data (DEV-SEED). NOT real earthquake information. Synthetic events generated for local development of SEISMO PH.",
      lastSuccessAt: new Date(),
    },
  });
  await db.dataSource.create({
    data: {
      name: "DOST-PHIVOLCS",
      status: "UNKNOWN",
      attribution:
        "DOST-PHIVOLCS — Department of Science and Technology, Philippine Institute of Volcanology and Seismology. Data © PHIVOLCS/DOST. Used under their public information terms.",
    },
  });

  // --- Locations (regions + provinces + cities) ----------------------------
  let locCount = 0;
  for (const region of PH_REGIONS) {
    // Region record (centroid approximated from member cities; fallback PH center)
    const regionCities = PH_CITIES.filter((c) => c.region === region.code);
    const lat =
      regionCities.length > 0
        ? regionCities.reduce((s, c) => s + c.lat, 0) / regionCities.length
        : 12.8797;
    const lon =
      regionCities.length > 0
        ? regionCities.reduce((s, c) => s + c.lon, 0) / regionCities.length
        : 121.774;
    await db.location.create({
      data: {
        name: region.name,
        type: "REGION",
        region: region.code,
        latitude: lat,
        longitude: lon,
      },
    });
    locCount++;
    for (const province of region.provinces) {
      const provCities = PH_CITIES.filter((c) => c.province === province);
      const plat =
        provCities.length > 0
          ? provCities.reduce((s, c) => s + c.lat, 0) / provCities.length
          : lat;
      const plon =
        provCities.length > 0
          ? provCities.reduce((s, c) => s + c.lon, 0) / provCities.length
          : lon;
      await db.location.create({
        data: {
          name: province,
          type: "PROVINCE",
          region: region.code,
          province,
          latitude: plat,
          longitude: plon,
        },
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

  // --- Earthquakes ---------------------------------------------------------
  const now = new Date();
  const recentFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const recent = generateEarthquakes(220, recentFrom, now, 0xc0ffee);
  const histFrom = new Date("2000-01-01T00:00:00Z");
  const histTo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const historical = generateEarthquakes(80, histFrom, histTo, 0xfeedface);

  const adapter = new DevSeedAdapter([...historical, ...recent]);
  const result = await adapter.fetch();
  const outcome = await ingestBatch(result.events);

  // --- Intensity reports for M5+ events (synthetic, clearly from DEV-SEED) -
  const m5plus = await db.earthquake.findMany({ where: { magnitude: { gte: 5 } } });
  let intensityCount = 0;
  for (const eq of m5plus) {
    // Assign PEIS intensities to nearby cities using a simple attenuation model.
    // THIS IS A SYNTHETIC, CLEARLY-LABELED ESTIMATE for development only —
    // production intensity always comes from PHIVOLCS reports.
    const candidates = PH_CITIES.map((c) => ({
      c,
      dist: haversineKm(eq.latitude, eq.longitude, c.lat, c.lon),
    }))
      .filter((x) => x.dist <= 250)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 8);

    for (const { c, dist } of candidates) {
      // Crude MMI-ish attenuation (synthetic): I ≈ 1.5*M - 2.0*log10(dist) - 0.5
      const mmi = Math.max(1, Math.min(9, 1.5 * eq.magnitude - 2.0 * Math.log10(Math.max(1, dist)) - 0.5));
      const peis = mmiToPeis(mmi);
      if (peis === "I") continue;
      await db.intensityReport.create({
        data: {
          earthquakeId: eq.id,
          locality: c.name,
          city: c.name,
          municipality: c.type === "MUNICIPALITY" ? c.name : null,
          province: c.province,
          latitude: c.lat,
          longitude: c.lon,
          intensity: peis,
          source: "DEV-SEED",
        },
      });
      intensityCount++;
    }
  }
  logger.info("seed.intensities", { count: intensityCount });

  const total = await db.earthquake.count();
  logger.info("seed.complete", {
    earthquakes: total,
    created: outcome.created.length,
    locations: locCount,
    intensities: intensityCount,
  });
  console.log(`\n✓ SEISMO PH seed complete`);
  console.log(`  Locations:      ${locCount}`);
  console.log(`  Earthquakes:    ${total} (recent 30d + historical)`);
  console.log(`  Intensities:    ${intensityCount} (synthetic, DEV-SEED)`);
  console.log(`  Data sources:   DEV-SEED (HEALTHY), DOST-PHIVOLCS (UNKNOWN)\n`);
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

function mmiToPeis(mmi: number): string {
  // PEIS roughly maps to MMI. See PHIVOLCS PEIS documentation.
  if (mmi < 1.5) return "I";
  if (mmi < 2.5) return "II";
  if (mmi < 3.5) return "III";
  if (mmi < 4.5) return "IV";
  if (mmi < 5.0) return "V";
  if (mmi < 5.8) return "VI";
  if (mmi < 6.5) return "VII";
  if (mmi < 7.3) return "VIII";
  if (mmi < 8.0) return "IX";
  return "X";
}
