// SEISMO PH — Text normalization utilities.
// Fixes corrupted degree symbols (�) from PHIVOLCS Windows-1252 encoding,
// normalizes location names, and formats coordinates cleanly.

/** Replace corrupted replacement characters (�) with proper degree symbols (°).
 *  Also fixes other common encoding artifacts from PHIVOLCS HTML bulletins. */
export function normalizeText(text: string): string {
  if (!text) return text;
  return text
    // Replace Unicode replacement character with degree symbol
    .replace(/\uFFFD/g, "°")
    // Fix double-encoded degree symbols
    .replace(/Â°/g, "°")
    // Normalize leading zeros in coordinates: "05.74°N" → "5.74°N"
    .replace(/(\b0)(\d+\.\d+°[NSEW])/g, "$2")
    // Clean up multiple spaces
    .replace(/\s+/g, " ")
    .trim();
}

/** Format coordinates cleanly: lat=7.2, lon=125.45 → "7.20° N, 125.45° E" */
export function formatCoordinates(lat: number, lon: number): string {
  const latDir = lat >= 0 ? "N" : "S";
  const lonDir = lon >= 0 ? "E" : "W";
  const latStr = Math.abs(lat).toFixed(2);
  const lonStr = Math.abs(lon).toFixed(2);
  return `${latStr}° ${latDir}, ${lonStr}° ${lonDir}`;
}

/** Format a single coordinate value with direction. */
export function formatLat(lat: number): string {
  return `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? "N" : "S"}`;
}
export function formatLon(lon: number): string {
  return `${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? "E" : "W"}`;
}

/** Normalize PHIVOLCS location descriptions.
 *  Example: "026 km S 70° W of City Of Panabo (Davao Del Norte)"
 *       → "26 km S 70° W of Panabo City, Davao del Norte" */
export function normalizeLocation(desc: string): string {
  if (!desc) return desc;
  let result = normalizeText(desc);
  // Remove leading zeros from distance: "026 km" → "26 km"
  result = result.replace(/\b0+(\d+ km)/g, "$1");
  // "City Of X" → "X City" (PHIVOLCS uses "City Of Panabo", we want "Panabo City")
  result = result.replace(/\bCity Of ([A-Za-z]+)/g, "$1 City");
  // "Municipality Of X" → "X"
  result = result.replace(/\bMunicipality Of ([A-Za-z\s]+?)\s*\(/g, "$1 (");
  // Clean up province in parentheses: "(Davao Del Norte)" → ", Davao del Norte"
  result = result.replace(/\s*\(([A-Za-z\s]+)\)\s*$/, ", $1");
  // Fix "Del" → "del" in province names
  result = result.replace(/\bDel\b/g, "del");
  // Fix "Sur" → "sur" and "Norte" → "norte" in province names (after comma)
  result = result.replace(/,\s*([A-Za-z]+)\s+(Del|Sur|Norte|Occidental|Oriental)\b/g, (match, p1, p2) => {
    return `, ${p1} ${p2.toLowerCase()}`;
  });
  return result;
}

/** Generate a clean, display-ready location string from earthquake data. */
export function getDisplayLocation(eq: {
  locationDescription: string;
  latitude: number;
  longitude: number;
}): string {
  return normalizeLocation(eq.locationDescription);
}

/** Get clean coordinates string. */
export function getDisplayCoordinates(eq: {
  latitude: number;
  longitude: number;
}): string {
  return formatCoordinates(eq.latitude, eq.longitude);
}
