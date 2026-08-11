// SEISMO PH — Centralized earthquake alert configuration.
//
// All alert severity thresholds, volumes, and sound patterns are defined here
// so they can be tuned in one place rather than scattered across the codebase.

export type AlertSeverity = "informational" | "minor" | "moderate" | "strong" | "major" | "great";

export interface AlertConfig {
  /** Magnitude threshold (inclusive) for this severity level. */
  minMagnitude: number;
  /** Display label. */
  label: string;
  /** Master volume (0.0–1.0). Safe maximum is 1.0 — never exceeds browser limits. */
  volume: number;
  /** Sound pattern type. */
  pattern: "silent" | "beep" | "double-beep" | "triple-beep" | "siren" | "emergency";
  /** Number of beep cycles / siren alternations. */
  cycles: number;
  /** Duration of each cycle in seconds. */
  cycleDuration: number;
  /** Base frequency in Hz. */
  frequency: number;
  /** Secondary frequency (for alternating tones). */
  secondaryFrequency: number;
}

// Severity → config mapping. Tuned to be noticeable without being aggressive.
// Volumes are capped at safe software levels (max 1.0).
export const EARTHQUAKE_ALERT_CONFIG: Record<AlertSeverity, AlertConfig> = {
  informational: {
    minMagnitude: 0,
    label: "Informational",
    volume: 0.05,         // very subtle — barely audible
    pattern: "silent",     // no sound for M < 3.0 (optional, very quiet)
    cycles: 0,
    cycleDuration: 0,
    frequency: 600,
    secondaryFrequency: 500,
  },
  minor: {
    minMagnitude: 3.0,
    label: "Minor",
    volume: 0.15,         // low volume
    pattern: "beep",       // single short beep
    cycles: 1,
    cycleDuration: 0.3,
    frequency: 740,
    secondaryFrequency: 620,
  },
  moderate: {
    minMagnitude: 4.0,
    label: "Moderate",
    volume: 0.30,         // medium volume
    pattern: "double-beep", // beep — beep
    cycles: 2,
    cycleDuration: 0.32,
    frequency: 820,
    secondaryFrequency: 680,
  },
  strong: {
    minMagnitude: 5.0,
    label: "Strong",
    volume: 0.50,         // high volume
    pattern: "triple-beep", // BEEP — BEEP — BEEP
    cycles: 3,
    cycleDuration: 0.34,
    frequency: 880,
    secondaryFrequency: 700,
  },
  major: {
    minMagnitude: 6.0,
    label: "Major",
    volume: 0.75,         // very high volume
    pattern: "siren",      // alternating two-tone siren
    cycles: 6,
    cycleDuration: 0.36,
    frequency: 970,
    secondaryFrequency: 670,
  },
  great: {
    minMagnitude: 7.0,
    label: "Great",
    volume: 1.00,         // maximum safe software volume
    pattern: "emergency",  // full emergency siren
    cycles: 8,
    cycleDuration: 0.38,
    frequency: 970,
    secondaryFrequency: 580,
  },
};

/** Determine the alert severity for a given magnitude. */
export function getAlertSeverity(magnitude: number): AlertSeverity {
  if (magnitude >= 7.0) return "great";
  if (magnitude >= 6.0) return "major";
  if (magnitude >= 5.0) return "strong";
  if (magnitude >= 4.0) return "moderate";
  if (magnitude >= 3.0) return "minor";
  return "informational";
}

/** Get the alert config for a given magnitude. */
export function getAlertConfig(magnitude: number): AlertConfig {
  return EARTHQUAKE_ALERT_CONFIG[getAlertSeverity(magnitude)];
}

/** Minimum magnitude to trigger an audible alert (below this = silent). */
export const MIN_AUDIBLE_MAGNITUDE = 3.0;
