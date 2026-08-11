// SEISMO PH — API helpers: consistent JSON responses, pagination, query parsing,
// error envelope, and a lightweight in-memory rate limiter.
//
// Error envelope (never leaks stack traces in production):
//   { error: { code: "EARTHQUAKE_NOT_FOUND", message: "...", details?: {...} } }

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(error: ApiError, status: number) {
  return NextResponse.json({ error }, { status });
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** Wrap a route handler with structured error handling + logging. */
export function withErrors(
  fn: (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>,
) {
  return async (
    req: NextRequest,
    ctx: { params: Promise<Record<string, string>> },
  ): Promise<Response> => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) {
        return jsonError(
          { code: e.code, message: e.message, details: e.details },
          e.status,
        );
      }
      // Unknown — log internally, return generic 500.
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[api] unhandled error", msg);
      return jsonError(
        { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
        500,
      );
    }
  };
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function parsePagination(req: NextRequest): { page: number; pageSize: number; skip: number; take: number } {
  const url = req.nextUrl;
  const page = clampInt(url.searchParams.get("page"), 1, 1, 1_000_000);
  const pageSize = clampInt(url.searchParams.get("pageSize"), 50, 1, 200);
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function paginationMeta(page: number, pageSize: number, total: number): Pagination {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export function clampInt(v: string | null, def: number, min: number, max: number): number {
  if (v == null || v === "") return def;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
}

export function clampFloat(v: string | null, def: number, min: number, max: number): number {
  if (v == null || v === "") return def;
  const n = Number.parseFloat(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
}

export function parseDate(v: string | null): Date | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

// --- Per-IP token-bucket rate limiter (in-memory; swap for Redis in prod) ---
const buckets = new Map<string, { tokens: number; last: number }>();
const RATE_WINDOW_MS = 60_000;

/** Returns true if allowed, false if rate-limited. */
export function rateLimit(key: string, capacity: number, refillPerSec: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b) {
    buckets.set(key, { tokens: capacity - 1, last: now });
    return true;
  }
  const elapsed = (now - b.last) / 1000;
  b.tokens = Math.min(capacity, b.tokens + elapsed * refillPerSec);
  b.last = now;
  if (b.tokens < 1) return false;
  b.tokens -= 1;
  return true;
}

export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
