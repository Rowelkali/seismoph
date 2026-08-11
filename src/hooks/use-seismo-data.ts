"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { io, Socket } from "socket.io-client";
import type {
  EarthquakeEvent,
  GeoLocation,
  NearestEarthquakeResult,
  StatisticsWindow,
  DataSourceStatus,
} from "@/lib/types";

/** Fetch helper with typed JSON + error handling. */
export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    let code = "HTTP_ERROR";
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error?.code) code = body.error.code;
      if (body?.error?.message) message = body.error.message;
    } catch {
      /* ignore */
    }
    const err = new Error(message) as Error & { code: string; status: number };
    err.code = code;
    err.status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = new Error(`Request failed (${res.status})`) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

interface ListResponse<T> {
  data: T[];
  pagination?: { page: number; pageSize: number; total: number; totalPages: number };
}
interface SingleResponse<T> {
  data: T;
}

/** Recent earthquakes (live view + map default). Auto-refetches every 30s
 *  AND when the WebSocket receives a new earthquake event (via invalidation). */
export function useRecentEarthquakes(limit = 100, includeIntensities = false) {
  const query = useQuery({
    queryKey: ["earthquakes", "recent", limit, includeIntensities],
    queryFn: async () => {
      const r = await apiGet<SingleResponse<EarthquakeEvent[]> & { asOf: string }>(
        `/api/earthquakes/recent?limit=${limit}${includeIntensities ? "&includeIntensities=1" : ""}`,
      );
      return r;
    },
    refetchInterval: 30_000, // auto-refetch every 30s as a safety net
  });
  const queryClient = useQueryClient();
  const reload = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["earthquakes", "recent"] });
  }, [queryClient]);
  return {
    data: query.data?.data ?? [],
    asOf: query.data?.asOf ?? null,
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    reload,
  };
}

/** Filtered earthquakes (history explorer). */
export function useEarthquakes(params: Record<string, string | number | undefined>) {
  const key = JSON.stringify(params);
  const query = useQuery({
    queryKey: ["earthquakes", "list", key],
    queryFn: async () => {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== "" && v !== null) qs.set(k, String(v));
      }
      const r = await apiGet<ListResponse<EarthquakeEvent>>(`/api/earthquakes?${qs}`);
      return r;
    },
  });
  const queryClient = useQueryClient();
  const reload = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["earthquakes", "list"] });
  }, [queryClient]);
  return {
    data: query.data?.data ?? [],
    total: query.data?.pagination?.total ?? 0,
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    reload,
  };
}

/** Single earthquake by id (with intensities). */
export function useEarthquake(id: string | null | undefined) {
  const query = useQuery({
    queryKey: ["earthquake", id],
    queryFn: async () => {
      if (!id) return null;
      const r = await apiGet<SingleResponse<EarthquakeEvent>>(`/api/earthquakes/${id}`);
      return r.data;
    },
    enabled: Boolean(id),
  });
  return {
    data: query.data ?? null,
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
  };
}

/** Location search. */
export function useLocationSearch(query: string, delay = 250) {
  const [debounced, setDebounced] = useState(query);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), delay);
    return () => clearTimeout(t);
  }, [query, delay]);
  const q = useQuery({
    queryKey: ["locations", "search", debounced],
    queryFn: async () => {
      if (debounced.trim().length < 2) return [];
      const r = await apiGet<ListResponse<GeoLocation>>(
        `/api/locations/search?q=${encodeURIComponent(debounced)}&limit=12`,
      );
      return r.data;
    },
  });
  return { data: q.data ?? [], loading: q.isLoading && debounced.trim().length >= 2 };
}

/** Nearest earthquakes to a location. */
export function useNearest(locationId: string | null) {
  const q = useQuery({
    queryKey: ["locations", "nearest", locationId],
    queryFn: async () => {
      if (!locationId) return null;
      const r = await apiGet<{ location: GeoLocation; data: NearestEarthquakeResult[] }>(
        `/api/locations/${locationId}/nearest?limit=8`,
      );
      return r;
    },
    enabled: Boolean(locationId),
  });
  return {
    data: q.data?.data ?? [],
    location: q.data?.location ?? null,
    loading: q.isLoading,
  };
}

/** Statistics for the analytics dashboard. */
export function useStatistics(window: "today" | "7d" | "30d" = "7d") {
  const q = useQuery({
    queryKey: ["statistics", window],
    queryFn: async () => {
      const r = await apiGet<{ data: StatisticsWindow; asOf: string }>(`/api/statistics?window=${window}`);
      return r.data;
    },
  });
  return {
    data: q.data ?? null,
    loading: q.isLoading,
    error: q.error instanceof Error ? q.error.message : null,
  };
}

/** Data source health. Auto-refetches every 15s for freshness tracking. */
export function useSources() {
  const q = useQuery({
    queryKey: ["sources"],
    queryFn: async () => {
      const r = await apiGet<{ data: DataSourceStatus[]; totalEvents: number }>("/api/sources");
      return r;
    },
    refetchInterval: 15_000, // auto-refetch every 15s for LIVE/DELAYED/UNAVAILABLE status
  });
  return { data: q.data?.data ?? [], total: q.data?.totalEvents ?? 0 };
}

/** Realtime WebSocket connection. Calls back on new earthquakes + status. */
export function useRealtime(opts: {
  onCreated?: (eq: EarthquakeEvent) => void;
  onStatus?: (s: { currentTime: string; sourceStatus: DataSourceStatus[]; totalEvents: number }) => void;
  onAlert?: (a: { earthquake: EarthquakeEvent; subscriptionId: string }) => void;
}) {
  const [connected, setConnected] = useState(false);
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });
  useEffect(() => {
    const socket: Socket = io("/?XTransformPort=3003", {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1500,
      timeout: 10_000,
    });

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onCreated = (eq: EarthquakeEvent) => optsRef.current.onCreated?.(eq);
    const onAlert = (a: { earthquake: EarthquakeEvent; subscriptionId: string }) => optsRef.current.onAlert?.(a);
    const onStatus = (s: { currentTime: string; sourceStatus: DataSourceStatus[]; totalEvents: number }) =>
      optsRef.current.onStatus?.(s);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("earthquake.created", onCreated);
    socket.on("alert.triggered", onAlert);
    socket.on("system.status", onStatus);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("earthquake.created", onCreated);
      socket.off("alert.triggered", onAlert);
      socket.off("system.status", onStatus);
      socket.disconnect();
    };
  }, []);

  return { connected };
}
