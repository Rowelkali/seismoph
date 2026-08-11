// SEISMO PH — structured JSON logger. Never logs secrets/tokens/passwords.
// Writes to stdout in a single-line JSON object for production log aggregation.

type Level = "debug" | "info" | "warn" | "error";

const LEVEL_RANK: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const minLevel: Level =
  (process.env.LOG_LEVEL as Level | undefined) ?? "info";

const REDACT_KEYS = new Set([
  "password",
  "token",
  "authorization",
  "secret",
  "apikey",
  "api_key",
  "cookie",
]);

function redact(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(redact);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    out[k] = REDACT_KEYS.has(k.toLowerCase()) ? "[REDACTED]" : redact(v);
  }
  return out;
}

export function log(
  level: Level,
  event: string,
  fields: Record<string, unknown> = {},
  service = "seismo-ph",
): void {
  if (LEVEL_RANK[level] < LEVEL_RANK[minLevel]) return;
  const entry = {
    level,
    service,
    event,
    timestamp: new Date().toISOString(),
    ...redact(fields),
  };
  const line = JSON.stringify(entry);
  if (level === "error") process.stderr.write(line + "\n");
  else process.stdout.write(line + "\n");
}

export const logger = {
  debug: (event: string, fields?: Record<string, unknown>, service?: string) =>
    log("debug", event, fields, service),
  info: (event: string, fields?: Record<string, unknown>, service?: string) =>
    log("info", event, fields, service),
  warn: (event: string, fields?: Record<string, unknown>, service?: string) =>
    log("warn", event, fields, service),
  error: (event: string, fields?: Record<string, unknown>, service?: string) =>
    log("error", event, fields, service),
};
