// SEISMO PH — shared UI helpers: severity colors, formatting, PHT time.

import type { EarthquakeEvent } from "@/lib/types";
import { magnitudeSeverity } from "@/lib/geo";

export type Severity = ReturnType<typeof magnitudeSeverity>;

export const SEVERITY_COLOR: Record<Severity, string> = {
  minor: "var(--sev-minor)",
  light: "var(--sev-light)",
  moderate: "var(--sev-moderate)",
  strong: "var(--sev-strong)",
  major: "var(--sev-major)",
  great: "var(--sev-great)",
};

export const SEVERITY_CLASS: Record<Severity, string> = {
  minor: "sev-minor",
  light: "sev-light",
  moderate: "sev-moderate",
  strong: "sev-strong",
  major: "sev-major",
  great: "sev-great",
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  minor: "Minor",
  light: "Light",
  moderate: "Moderate",
  strong: "Strong",
  major: "Major",
  great: "Great",
};

export function severityOf(m: number): Severity {
  return magnitudeSeverity(m);
}

/** Format an ISO time as Philippine Standard Time (UTC+8). */
export function formatPHT(iso: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    ...opts,
  }).format(d);
}

export function formatPHTShort(iso: string | Date): string {
  return formatPHT(iso, { year: undefined, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: undefined });
}

export function formatPHTTime(iso: string | Date): string {
  return formatPHT(iso, { year: undefined, month: undefined, day: undefined, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function timeAgoPHT(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const diff = Date.now() - d.getTime();
  const s = Math.round(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days}d ago`;
  return formatPHTShort(d);
}

/** Magnitude label e.g. "M 5.8". */
export function magLabel(eq: { magnitude: number; magnitudeType: string }): string {
  return `M ${eq.magnitude.toFixed(1)}`;
}

/** Depth label e.g. "32 km". */
export function depthLabel(km: number): string {
  return `${Math.round(km)} km`;
}

export function isDev(eq: EarthquakeEvent): boolean {
  return eq.source === "DEV-SEED";
}

/** PEIS intensity → descriptive label (PHIVOLCS PEIS). */
export function peisDescription(roman: string): string {
  const map: Record<string, string> = {
    I: "Scarcely perceptible",
    II: "Slightly felt",
    III: "Weak",
    IV: "Moderately strong",
    V: "Strong",
    VI: "Very strong",
    VII: "Destructive",
    VIII: "Very destructive",
    IX: "Devastating",
    X: "Completely devastating",
  };
  return map[roman?.toUpperCase()] ?? "—";
}
