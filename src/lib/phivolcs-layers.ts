// SEISMO PH — Official PHIVOLCS ArcGIS layers.
//
// RESEARCHED & VERIFIED (2026-08-11):
// PHIVOLCS operates a public ArcGIS REST server at:
//   https://gisweb.phivolcs.dost.gov.ph/arcgis/rest/services
//
// The /PHIVOLCSPublic/ folder exposes these OFFICIAL, PUBLIC MapServer
// services (no API key required):
//   - ActiveFault              — active fault traces (polylines)
//   - Trenches                 — Philippine Trench, Manila Trench, etc.
//   - GroundShaking            — ground shaking hazard
//   - Liquefaction             — liquefaction hazard
//   - EarthquakeInducedLandslide
//   - Tsunami                  — tsunami hazard
//   - VolcanoLocation, Lava, Pyroclastic, BaseSurge, Seiches, VolcanoLahar
//
// These are the authoritative PHIVOLCS hazard/fault datasets. We use the
// ActiveFault and Trenches services to render REAL official fault geometry on
// the map (replacing the schematic fault traces used previously).
//
// NOTE: These are MapServer services (not FeatureServer), so the `query`
// operation is disabled. Geometry is retrieved via the `export` operation
// (rendered as an image overlay) — which is exactly how the PHIVOLCS website
// itself displays them. We use MapLibre's raster source to overlay these.
//
// Attribution: "DOST-PHIVOLCS GIS (gisweb.phivolcs.dost.gov.ph)"

export interface PhivolcsLayerDef {
  id: string;
  name: string;
  /** Full ArcGIS MapServer URL (no trailing slash). */
  serviceUrl: string;
  layerId: number;
  attribution: string;
  description: string;
}

const PHIVOLCS_GIS_BASE = "https://gisweb.phivolcs.dost.gov.ph/arcgis/rest/services/PHIVOLCSPublic";
const ATTRIBUTION = "DOST-PHIVOLCS GIS — gisweb.phivolcs.dost.gov.ph";

/** Export endpoint for an ArcGIS MapServer layer — returns a dynamic map image
 *  for a bounding box + size. Used as a raster tile source in MapLibre. */
export function phivolcsExportUrl(layer: PhivolcsLayerDef): string {
  return `${layer.serviceUrl}/MapServer/export`;
}

/** WMS-style dynamic layer for MapLibre raster source. */
export function phivolcsRasterSource(layer: PhivolcsLayerDef, bounds: [number, number, number, number]) {
  const [minx, miny, maxx, maxy] = bounds;
  // ArcGIS export endpoint with bbox + size. We request a 1024x1024 image
  // covering the PH bounds; MapLibre stretches it to fit.
  const url =
    `${layer.serviceUrl}/MapServer/export` +
    `?bbox=${minx},${miny},${maxx},${maxy}` +
    `&bboxSR=4326` +
    `&layers=show:${layer.layerId}` +
    `&size=1024,1024` +
    `&format=png32` +
    `&transparent=true` +
    `&f=image`;
  return url;
}

export const PHIVOLCS_LAYERS: PhivolcsLayerDef[] = [
  {
    id: "active-faults",
    name: "Active Faults (official PHIVOLCS)",
    serviceUrl: `${PHIVOLCS_GIS_BASE}/ActiveFault`,
    layerId: 0,
    attribution: ATTRIBUTION,
    description: "Official DOST-PHIVOLCS active fault traces (e.g. Philippine Fault Zone, Valley Fault System). Source: gisweb.phivolcs.dost.gov.ph",
  },
  {
    id: "trenches",
    name: "Philippine Trenches (official PHIVOLCS)",
    serviceUrl: `${PHIVOLCS_GIS_BASE}/Trenches`,
    layerId: 0,
    attribution: ATTRIBUTION,
    description: "Official DOST-PHIVOLCS submarine trench traces (Philippine Trench, Manila Trench, etc.). Source: gisweb.phivolcs.dost.gov.ph",
  },
  {
    id: "ground-shaking",
    name: "Ground Shaking Hazard (official PHIVOLCS)",
    serviceUrl: `${PHIVOLCS_GIS_BASE}/GroundShaking`,
    layerId: 0,
    attribution: ATTRIBUTION,
    description: "Official DOST-PHIVOLCS ground shaking hazard map. Hazard information, not a prediction.",
  },
  {
    id: "liquefaction",
    name: "Liquefaction Hazard (official PHIVOLCS)",
    serviceUrl: `${PHIVOLCS_GIS_BASE}/Liquefaction`,
    layerId: 0,
    attribution: ATTRIBUTION,
    description: "Official DOST-PHIVOLCS liquefaction susceptibility map. Hazard information, not a prediction.",
  },
  {
    id: "eq-landslide",
    name: "Earthquake-Induced Landslide Hazard (official PHIVOLCS)",
    serviceUrl: `${PHIVOLCS_GIS_BASE}/EarthquakeInducedLandslide`,
    layerId: 0,
    attribution: ATTRIBUTION,
    description: "Official DOST-PHIVOLCS earthquake-induced landslide susceptibility. Hazard information, not a prediction.",
  },
  {
    id: "tsunami",
    name: "Tsunami Hazard (official PHIVOLCS)",
    serviceUrl: `${PHIVOLCS_GIS_BASE}/Tsunami`,
    layerId: 0,
    attribution: ATTRIBUTION,
    description: "Official DOST-PHIVOLCS tsunami hazard map. Hazard information, not a prediction.",
  },
];

/** Test that a PHIVOLCS ArcGIS service is reachable (used in health checks). */
export async function pingPhivolcsLayer(layer: PhivolcsLayerDef): Promise<boolean> {
  try {
    const url = `${layer.serviceUrl}/MapServer?f=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return false;
    const data = (await res.json()) as { layers?: unknown[] };
    return Array.isArray(data.layers) && data.layers.length > 0;
  } catch {
    return false;
  }
}
