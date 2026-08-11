// SEISMO PH — Philippine geographic reference data + synthetic development fixtures.
//
// IMPORTANT: This module produces clearly-labeled DEVELOPMENT DATA (source="DEV-SEED").
// It is NOT real earthquake information. It exists so the platform is fully
// functional in local development without live PHIVOLCS credentials.
//
// Real production data MUST come from src/lib/ingestion/phivolcs.ts (DOST-PHIVOLCS).
// The UI displays a prominent "DEVELOPMENT DATA" banner whenever the active source
// is DEV-SEED — see components/DevDataBanner.
//
// Coordinates use real geographic values for cities/provinces and real seismic
// zones (Philippine Fault, Manila Trench, Cotabato Trench, etc.) so that
// distance calculations, depth visualization and map rendering are realistic.
// The earthquake *events* themselves (time, magnitude, depth) are synthetic.

// ---------------------------------------------------------------------------
// 1. Philippine regions (real)
// ---------------------------------------------------------------------------
export interface RegionDef {
  code: string;
  name: string;
  provinces: string[];
}

export const PH_REGIONS: RegionDef[] = [
  { code: "NCR", name: "National Capital Region", provinces: ["Metro Manila"] },
  { code: "CAR", name: "Cordillera Administrative Region", provinces: ["Benguet", "Mountain Province", "Ifugao", "Kalinga", "Apayao", "Abra"] },
  { code: "Region I", name: "Ilocos Region", provinces: ["Ilocos Norte", "Ilocos Sur", "La Union", "Pangasinan"] },
  { code: "Region II", name: "Cagayan Valley", provinces: ["Cagayan", "Isabela", "Nueva Vizcaya", "Quirino", "Batanes"] },
  { code: "Region III", name: "Central Luzon", provinces: ["Bataan", "Bulacan", "Nueva Ecija", "Pampanga", "Tarlac", "Zambales", "Aurora"] },
  { code: "Region IV-A", name: "CALABARZON", provinces: ["Batangas", "Cavite", "Laguna", "Quezon", "Rizal"] },
  { code: "Region IV-B", name: "MIMAROPA", provinces: ["Occidental Mindoro", "Oriental Mindoro", "Marinduque", "Romblon", "Palawan"] },
  { code: "Region V", name: "Bicol Region", provinces: ["Albay", "Camarines Norte", "Camarines Sur", "Catanduanes", "Masbate", "Sorsogon"] },
  { code: "Region VI", name: "Western Visayas", provinces: ["Aklan", "Antique", "Capiz", "Guimaras", "Iloilo", "Negros Occidental"] },
  { code: "Region VII", name: "Central Visayas", provinces: ["Bohol", "Cebu", "Negros Oriental", "Siquijor"] },
  { code: "Region VIII", name: "Eastern Visayas", provinces: ["Biliran", "Eastern Samar", "Leyte", "Northern Samar", "Samar", "Southern Leyte"] },
  { code: "Region IX", name: "Zamboanga Peninsula", provinces: ["Zamboanga del Norte", "Zamboanga del Sur", "Zamboanga Sibugay", "Isabela City"] },
  { code: "Region X", name: "Northern Mindanao", provinces: ["Bukidnon", "Camiguin", "Lanao del Norte", "Misamis Occidental", "Misamis Oriental"] },
  { code: "Region XI", name: "Davao Region", provinces: ["Davao de Oro", "Davao del Norte", "Davao del Sur", "Davao Occidental", "Davao Oriental"] },
  { code: "Region XII", name: "SOCCSKSARGEN", provinces: ["Cotabato", "South Cotabato", "Sultan Kudarat", "Sarangani", "Cotabato City"] },
  { code: "Region XIII", name: "Caraga", provinces: ["Agusan del Norte", "Agusan del Sur", "Surigao del Norte", "Surigao del Sur", "Dinagat Islands"] },
  { code: "BARMM", name: "Bangsamoro Autonomous Region in Muslim Mindanao", provinces: ["Basilan", "Lanao del Sur", "Maguindanao", "Sulu", "Tawi-Tawi"] },
];

// ---------------------------------------------------------------------------
// 2. Major cities / municipalities (real coordinates)
// ---------------------------------------------------------------------------
export interface CityDef {
  name: string;
  type: "CITY" | "MUNICIPALITY";
  region: string;
  province: string;
  lat: number;
  lon: number;
  population?: number;
}

export const PH_CITIES: CityDef[] = [
  { name: "Manila", type: "CITY", region: "NCR", province: "Metro Manila", lat: 14.5995, lon: 120.9842, population: 1846513 },
  { name: "Quezon City", type: "CITY", region: "NCR", province: "Metro Manila", lat: 14.6760, lon: 121.0437, population: 2960048 },
  { name: "Makati", type: "CITY", region: "NCR", province: "Metro Manila", lat: 14.5547, lon: 121.0244, population: 629616 },
  { name: "Taguig", type: "CITY", region: "NCR", province: "Metro Manila", lat: 14.5176, lon: 121.0509, population: 886522 },
  { name: "Pasig", type: "CITY", region: "NCR", province: "Metro Manila", lat: 14.5764, lon: 121.0851, population: 803159 },
  { name: "Antipolo", type: "CITY", region: "Region IV-A", province: "Rizal", lat: 14.5729, lon: 121.1742, population: 887399 },
  { name: "Cebu City", type: "CITY", region: "Region VII", province: "Cebu", lat: 10.3157, lon: 123.8854, population: 922611 },
  { name: "Davao City", type: "CITY", region: "Region XI", province: "Davao del Sur", lat: 7.1907, lon: 125.4553, population: 1776949 },
  { name: "Cagayan de Oro", type: "CITY", region: "Region X", province: "Misamis Oriental", lat: 8.4542, lon: 124.6319, population: 728402 },
  { name: "Baguio", type: "CITY", region: "CAR", province: "Benguet", lat: 16.4023, lon: 120.5960, population: 366358 },
  { name: "Iloilo City", type: "CITY", region: "Region VI", province: "Iloilo", lat: 10.7202, lon: 122.5621, population: 457626 },
  { name: "Bacolod", type: "CITY", region: "Region VI", province: "Negros Occidental", lat: 10.6760, lon: 122.9506, population: 600783 },
  { name: "General Santos", type: "CITY", region: "Region XII", province: "South Cotabato", lat: 6.1164, lon: 125.1714, population: 697315 },
  { name: "Zamboanga City", type: "CITY", region: "Region IX", province: "Zamboanga del Sur", lat: 6.9214, lon: 122.0790, population: 861799 },
  { name: "Legazpi", type: "CITY", region: "Region V", province: "Albay", lat: 13.1391, lon: 123.7337, population: 209732 },
  { name: "Tacloban", type: "CITY", region: "Region VIII", province: "Leyte", lat: 11.2433, lon: 125.0064, population: 251881 },
  { name: "Puerto Princesa", type: "CITY", region: "Region IV-B", province: "Palawan", lat: 9.7392, lon: 118.7353, population: 323548 },
  { name: "Laoag", type: "CITY", region: "Region I", province: "Ilocos Norte", lat: 18.1978, lon: 120.5960, population: 111125 },
  { name: "Tuguegarao", type: "CITY", region: "Region II", province: "Cagayan", lat: 17.6131, lon: 121.7269, population: 166334 },
  { name: "Batangas City", type: "CITY", region: "Region IV-A", province: "Batangas", lat: 13.7565, lon: 121.0583, population: 358714 },
  { name: "Angeles", type: "CITY", region: "Region III", province: "Pampanga", lat: 15.1466, lon: 120.5882, population: 462928 },
  { name: "Tagaytay", type: "CITY", region: "Region IV-A", province: "Cavite", lat: 14.1153, lon: 120.9621, population: 85601 },
  { name: "Lucena", type: "CITY", region: "Region IV-A", province: "Quezon", lat: 13.9319, lon: 121.6177, population: 280660 },
  { name: "Naga", type: "CITY", region: "Region V", province: "Camarines Sur", lat: 13.6258, lon: 123.2709, population: 209170 },
  { name: "Sorsogon City", type: "CITY", region: "Region V", province: "Sorsogon", lat: 12.9739, lon: 123.9911, population: 182237 },
  { name: "Malay (Boracay)", type: "MUNICIPALITY", region: "Region VI", province: "Aklan", lat: 11.9674, lon: 121.9248, population: 59624 },
  { name: "Dumaguete", type: "CITY", region: "Region VII", province: "Negros Oriental", lat: 9.3076, lon: 123.3052, population: 146564 },
  { name: "Tagbilaran", type: "CITY", region: "Region VII", province: "Bohol", lat: 9.6498, lon: 123.8543, population: 104976 },
  { name: "Butuan", type: "CITY", region: "Region XIII", province: "Agusan del Norte", lat: 8.9475, lon: 125.5406, population: 372910 },
  { name: "Iligan", type: "CITY", region: "Region X", province: "Lanao del Norte", lat: 8.2280, lon: 124.2452, population: 363115 },
  { name: "Ozamiz", type: "CITY", region: "Region X", province: "Misamis Occidental", lat: 8.1492, lon: 123.8043, population: 143285 },
  { name: "Cotabato City", type: "CITY", region: "BARMM", province: "Maguindanao", lat: 7.2236, lon: 124.2456, population: 325079 },
  { name: "Malaybalay", type: "CITY", region: "Region X", province: "Bukidnon", lat: 8.1653, lon: 125.0444, population: 190945 },
  { name: "Surigao City", type: "CITY", region: "Region XIII", province: "Surigao del Norte", lat: 9.7869, lon: 125.4876, population: 171714 },
  { name: "Marawi", type: "CITY", region: "BARMM", province: "Lanao del Sur", lat: 8.0078, lon: 124.2887, population: 207010 },
  { name: "San Fernando (La Union)", type: "CITY", region: "Region I", province: "La Union", lat: 16.6156, lon: 120.3214, population: 128835 },
  { name: "San Fernando (Pampanga)", type: "CITY", region: "Region III", province: "Pampanga", lat: 15.0246, lon: 120.6897, population: 351445 },
  { name: "Calamba", type: "CITY", region: "Region IV-A", province: "Laguna", lat: 14.2078, lon: 121.1246, population: 539671 },
  { name: "Dasmarinas", type: "CITY", region: "Region IV-A", province: "Cavite", lat: 14.3223, lon: 120.9414, population: 703141 },
  { name: "Valenzuela", type: "CITY", region: "NCR", province: "Metro Manila", lat: 14.7000, lon: 120.9817, population: 714978 },
  { name: "Caloocan", type: "CITY", region: "NCR", province: "Metro Manila", lat: 14.6565, lon: 120.9848, population: 1601910 },
  { name: "Parañaque", type: "CITY", region: "NCR", province: "Metro Manila", lat: 14.4793, lon: 121.0098, population: 689992 },
  { name: "Masbate City", type: "CITY", region: "Region V", province: "Masbate", lat: 12.3667, lon: 123.6167, population: 95898 },
  { name: "Catbalogan", type: "CITY", region: "Region VIII", province: "Samar", lat: 11.7753, lon: 124.8861, population: 106660 },
  { name: "Maasin", type: "CITY", region: "Region VIII", province: "Southern Leyte", lat: 10.1336, lon: 124.8469, population: 87484 },
  { name: "Baybay", type: "CITY", region: "Region VIII", province: "Leyte", lat: 10.6814, lon: 124.8017, population: 109930 },
  { name: "Dipolog", type: "CITY", region: "Region IX", province: "Zamboanga del Norte", lat: 8.5867, lon: 123.3372, population: 141500 },
  { name: "Pagadian", type: "CITY", region: "Region IX", province: "Zamboanga del Sur", lat: 7.8257, lon: 123.4366, population: 210715 },
  { name: "Kidapawan", type: "CITY", region: "Region XII", province: "Cotabato", lat: 7.0083, lon: 125.0894, population: 149043 },
  { name: "Koronadal", type: "CITY", region: "Region XII", province: "South Cotabato", lat: 6.5031, lon: 124.8469, population: 195664 },
  { name: "Tagum", type: "CITY", region: "Region XI", province: "Davao del Norte", lat: 7.4482, lon: 125.8074, population: 291769 },
  { name: "Mati", type: "CITY", region: "Region XI", province: "Davao Oriental", lat: 6.9547, lon: 126.2189, population: 156634 },
  { name: "Panabo", type: "CITY", region: "Region XI", province: "Davao del Norte", lat: 7.2967, lon: 125.6894, population: 209230 },
  { name: "Bislig", type: "CITY", region: "Region XIII", province: "Surigao del Sur", lat: 8.2142, lon: 126.3147, population: 98339 },
  { name: "Tandag", type: "CITY", region: "Region XIII", province: "Surigao del Sur", lat: 9.0792, lon: 126.1978, population: 60851 },
];

// ---------------------------------------------------------------------------
// 3. Seismic source zones (real fault/trench systems around the PH)
//    Each zone has a center, a rough extent, and a Gutenberg-Richter-like rate.
// ---------------------------------------------------------------------------
export interface SeismicZone {
  id: string;
  name: string;
  lat: number;
  lon: number;
  radiusDeg: number; // cluster spread
  // Mean depth and std-dev (km). Trenches → deeper; fault zones → shallower.
  meanDepth: number;
  depthSpread: number;
  // Annual lambda (rate) for M>=4.5 — controls how many events land in this zone.
  rate: number;
  eventType: "TECTONIC" | "VOLCANIC";
}

export const PH_SEISMIC_ZONES: SeismicZone[] = [
  { id: "PFZ-luzon", name: "Philippine Fault Zone — Luzon segment", lat: 16.0, lon: 121.0, radiusDeg: 1.4, meanDepth: 25, depthSpread: 18, rate: 22, eventType: "TECTONIC" },
  { id: "PFZ-visayas", name: "Philippine Fault Zone — Visayas segment", lat: 11.5, lon: 124.0, radiusDeg: 1.2, meanDepth: 30, depthSpread: 20, rate: 18, eventType: "TECTONIC" },
  { id: "PFZ-mindanao", name: "Philippine Fault Zone — Mindanao segment", lat: 8.0, lon: 125.5, radiusDeg: 1.3, meanDepth: 28, depthSpread: 20, rate: 20, eventType: "TECTONIC" },
  { id: "manila-trench", name: "Manila Trench", lat: 17.5, lon: 119.0, radiusDeg: 1.8, meanDepth: 55, depthSpread: 30, rate: 16, eventType: "TECTONIC" },
  { id: "negros-trench", name: "Negros Trench", lat: 10.0, lon: 122.0, radiusDeg: 1.2, meanDepth: 45, depthSpread: 28, rate: 12, eventType: "TECTONIC" },
  { id: "sulu-trench", name: "Sulu Trench", lat: 8.5, lon: 120.5, radiusDeg: 1.3, meanDepth: 50, depthSpread: 30, rate: 10, eventType: "TECTONIC" },
  { id: "cotabato-trench", name: "Cotabato Trench", lat: 6.0, lon: 124.0, radiusDeg: 1.4, meanDepth: 60, depthSpread: 35, rate: 14, eventType: "TECTONIC" },
  { id: "philippine-trench", name: "Philippine Trench (East Mindanao)", lat: 9.0, lon: 127.0, radiusDeg: 1.8, meanDepth: 80, depthSpread: 45, rate: 18, eventType: "TECTONIC" },
  { id: "east-luzon-trench", name: "East Luzon Trench", lat: 15.5, lon: 123.0, radiusDeg: 1.4, meanDepth: 50, depthSpread: 30, rate: 11, eventType: "TECTONIC" },
  { id: "taal-volcanic", name: "Taal / Macolod Corridor (volcanic)", lat: 13.9, lon: 121.0, radiusDeg: 0.5, meanDepth: 12, depthSpread: 8, rate: 9, eventType: "VOLCANIC" },
  { id: "mayon-volcanic", name: "Mayon / Bicol volcanic arc", lat: 13.25, lon: 123.68, radiusDeg: 0.6, meanDepth: 14, depthSpread: 9, rate: 6, eventType: "VOLCANIC" },
  { id: "camiguin-volcanic", name: "Camiguin volcanic zone", lat: 9.17, lon: 124.72, radiusDeg: 0.4, meanDepth: 15, depthSpread: 10, rate: 4, eventType: "VOLCANIC" },
  { id: "mati-trench", name: "Mati / Davao Oriental offshore", lat: 6.8, lon: 126.5, radiusDeg: 1.0, meanDepth: 45, depthSpread: 30, rate: 8, eventType: "TECTONIC" },
];

// ---------------------------------------------------------------------------
// 4. Seeded RNG (mulberry32) for deterministic fixtures.
// ---------------------------------------------------------------------------
export function makeRng(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng: () => number, mean: number, sd: number): number {
  // Box-Muller
  const u = Math.max(1e-12, rng());
  const v = rng();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ---------------------------------------------------------------------------
// 5. Synthetic earthquake generation.
// ---------------------------------------------------------------------------
export interface GeneratedEarthquake {
  externalId: string;
  source: "DEV-SEED";
  originTime: Date;
  latitude: number;
  longitude: number;
  depthKm: number;
  magnitude: number;
  magnitudeType: string;
  locationDescription: string;
  eventType: "TECTONIC" | "VOLCANIC";
  status: "PRELIMINARY" | "AUTOMATIC" | "REVIEWED";
  zoneName: string;
}

/** Gutenberg-Richter sample: more small events, few large ones. M ∈ [3, 8.2]. */
function sampleMagnitude(rng: () => number): number {
  // Inverse-CDF of an exponential-ish distribution on magnitude.
  const u = rng();
  const m = 3.0 - Math.log(1 - u) / 1.7; // b-value ~1.0
  return Math.min(8.2, Math.round(m * 10) / 10);
}

const MAG_TYPES = ["Mw", "Ms", "Mb", "Ml"] as const;

/**
 * Generate `count` synthetic earthquakes between `from` and `to` (inclusive),
 * distributed across Philippine seismic zones weighted by their rate.
 */
export function generateEarthquakes(
  count: number,
  from: Date,
  to: Date,
  seed = 0xc0ffee,
): GeneratedEarthquake[] {
  const rng = makeRng(seed);
  const totalRate = PH_SEISMIC_ZONES.reduce((s, z) => s + z.rate, 0);

  const span = to.getTime() - from.getTime();
  const out: GeneratedEarthquake[] = [];

  for (let i = 0; i < count; i++) {
    // Pick a zone weighted by rate.
    let r = rng() * totalRate;
    let zone = PH_SEISMIC_ZONES[0];
    for (const z of PH_SEISMIC_ZONES) {
      r -= z.rate;
      if (r <= 0) {
        zone = z;
        break;
      }
    }

    // Position: gaussian around zone center, clamped to PH bounds.
    let lat = gaussian(rng, zone.lat, zone.radiusDeg / 2);
    let lon = gaussian(rng, zone.lon, zone.radiusDeg / 2);
    lat = Math.max(4.8, Math.min(21.2, lat));
    lon = Math.max(116.2, Math.min(126.8, lon));

    // Depth: gaussian, clamped to [1, 220] (synthetic fixtures only).
    let depth = Math.round(gaussian(rng, zone.meanDepth, zone.depthSpread));
    depth = Math.max(1, Math.min(220, depth));

    const magnitude = sampleMagnitude(rng);
    const magnitudeType = MAG_TYPES[Math.floor(rng() * MAG_TYPES.length)];

    // Time: uniform-ish across the span.
    const t = new Date(from.getTime() + rng() * span);

    const status =
      magnitude >= 5.5 ? "REVIEWED" : magnitude >= 4.5 ? "AUTOMATIC" : "PRELIMINARY";

    const locationDescription = describeLocation(lat, lon, zone);

    out.push({
      externalId: `devseed-${t.getTime()}-${i.toString(36)}-${Math.floor(rng() * 1e6).toString(36)}`,
      source: "DEV-SEED",
      originTime: t,
      latitude: Math.round(lat * 10000) / 10000,
      longitude: Math.round(lon * 10000) / 10000,
      depthKm: depth,
      magnitude,
      magnitudeType,
      locationDescription,
      eventType: zone.eventType,
      status,
      zoneName: zone.name,
    });
  }

  // Sort oldest → newest.
  out.sort((a, b) => a.originTime.getTime() - b.originTime.getTime());
  return out;
}

/** Produce a human-readable epicenter description referencing nearby geography. */
function describeLocation(lat: number, lon: number, zone: SeismicZone): string {
  // Find nearest reference city.
  let nearest = PH_CITIES[0];
  let best = Infinity;
  for (const c of PH_CITIES) {
    const d = Math.hypot(c.lat - lat, c.lon - lon);
    if (d < best) {
      best = d;
      nearest = c;
    }
  }
  const distDeg = best;
  const distKm = Math.round(distDeg * 111);
  const ns = lat >= nearest.lat ? "N" : "S";
  const ew = lon >= nearest.lon ? "E" : "W";
  const offshore =
    zone.name.toLowerCase().includes("trench") ||
    zone.name.toLowerCase().includes("offshore");
  const where = offshore
    ? `${distKm} km ${ns}${ew} of ${nearest.name} (offshore)`
    : `${distKm} km ${ns}${ew} of ${nearest.name}`;
  return `${where} (${zone.name})`;
}
