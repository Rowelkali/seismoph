"use client";

import { useState } from "react";
import { useStatistics } from "@/hooks/use-seismo-data";
import { LoadingState, ErrorState } from "@/components/seismo/States";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Cell,
} from "recharts";
import { BarChart3, TrendingUp, Activity, ArrowDown, ArrowUp, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";
import { SEVERITY_COLOR, severityOf } from "@/lib/ui";
import type { Severity } from "@/lib/ui";

const WINDOWS = [
  { key: "today" as const, label: "Today" },
  { key: "7d" as const, label: "Last 7 days" },
  { key: "30d" as const, label: "Last 30 days" },
];

export function AnalyticsPanel({ className }: { className?: string }) {
  const [win, setWin] = useState<"today" | "7d" | "30d">("7d");
  const { data, loading, error } = useStatistics(win);

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <BarChart3 className="h-5 w-5 text-primary" /> Analytics dashboard
        </h2>
        <div className="flex gap-1">
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              onClick={() => setWin(w.key)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs transition-colors",
                win === w.key ? "bg-primary/15 text-foreground border border-primary/40" : "text-muted-foreground hover:bg-accent/40 border border-transparent",
              )}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-slim p-4 space-y-4">
        {loading ? (
          <LoadingState label="Aggregating statistics…" />
        ) : error || !data ? (
          <ErrorState description={error ?? "No data"} />
        ) : (
          <>
            {/* stat cards */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard icon={Activity} label="Total events" value={data.total} accent="var(--sev-light)" />
              <StatCard icon={ArrowUp} label="M3+" value={data.m3plus} accent="var(--sev-moderate)" />
              <StatCard icon={ArrowUp} label="M5+" value={data.m5plus} accent="var(--sev-strong)" />
              <StatCard icon={Gauge} label="Largest" value={data.largest ? `M${data.largest.magnitude.toFixed(1)}` : "—"} accent="var(--sev-major)" />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="Magnitude distribution" icon={BarChart3}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.magnitudeBuckets} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" />
                    <XAxis dataKey="label" tick={{ fill: "oklch(0.7 0 0)", fontSize: 10 }} stroke="oklch(1 0 0 / 10%)" />
                    <YAxis tick={{ fill: "oklch(0.7 0 0)", fontSize: 10 }} stroke="oklch(1 0 0 / 10%)" allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "oklch(0.2 0 0)", border: "1px solid oklch(1 0 0 / 12%)", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {data.magnitudeBuckets.map((b, i) => {
                        const mid = parseFloat(b.label) || (i + 3);
                        const sev: Severity = severityOf(mid);
                        return <Cell key={i} fill={SEVERITY_COLOR[sev]} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Depth distribution" icon={ArrowDown}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.depthBuckets} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" />
                    <XAxis type="number" tick={{ fill: "oklch(0.7 0 0)", fontSize: 10 }} stroke="oklch(1 0 0 / 10%)" allowDecimals={false} />
                    <YAxis type="category" dataKey="label" tick={{ fill: "oklch(0.7 0 0)", fontSize: 9 }} stroke="oklch(1 0 0 / 10%)" width={110} />
                    <Tooltip contentStyle={{ background: "oklch(0.2 0 0)", border: "1px solid oklch(1 0 0 / 12%)", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} fill="var(--sev-light)" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title={`Earthquakes over time (${win})`} icon={TrendingUp}>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={data.overTime} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" />
                    <XAxis dataKey="label" tick={{ fill: "oklch(0.7 0 0)", fontSize: 9 }} stroke="oklch(1 0 0 / 10%)" interval="preserveStartEnd" minTickGap={16} />
                    <YAxis tick={{ fill: "oklch(0.7 0 0)", fontSize: 10 }} stroke="oklch(1 0 0 / 10%)" allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "oklch(0.2 0 0)", border: "1px solid oklch(1 0 0 / 12%)", borderRadius: 8, fontSize: 12 }} />
                    <Line type="monotone" dataKey="count" stroke="var(--sev-moderate)" strokeWidth={2} dot={{ r: 2, fill: "var(--sev-moderate)" }} />
                    <Line type="monotone" dataKey="maxMag" stroke="var(--sev-major)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="By region (heuristic)" icon={Activity}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.byRegion} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" />
                    <XAxis dataKey="label" tick={{ fill: "oklch(0.7 0 0)", fontSize: 10 }} stroke="oklch(1 0 0 / 10%)" />
                    <YAxis tick={{ fill: "oklch(0.7 0 0)", fontSize: 10 }} stroke="oklch(1 0 0 / 10%)" allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "oklch(0.2 0 0)", border: "1px solid oklch(1 0 0 / 12%)", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="var(--sev-light)" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            {data.largest && data.deepest && (
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-lg border border-border bg-card/40 p-3">
                  <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Largest event</p>
                  <p className="mt-1 font-mono text-2xl sev-strong" style={{ color: SEVERITY_COLOR.strong }}>M {data.largest.magnitude.toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground">{data.largest.locationDescription}</p>
                </div>
                <div className="rounded-lg border border-border bg-card/40 p-3">
                  <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Deepest event</p>
                  <p className="mt-1 font-mono text-2xl sev-light" style={{ color: SEVERITY_COLOR.light }}>{Math.round(data.deepest.depthKm)} km</p>
                  <p className="text-xs text-muted-foreground">{data.deepest.locationDescription}</p>
                </div>
              </div>
            )}

            <p className="text-[11px] text-muted-foreground">
              Statistics are computed from stored events in the selected window. Region grouping is a
              keyword heuristic for visualization and is not an official regional breakdown. Magnitude
              and depth data are source-attributed (DOST-PHIVOLCS in production; DEV-SEED fixtures in
              development).
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: string | number; accent: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" style={{ color: accent }} /> {label}
      </div>
      <p className="mt-1 font-mono text-2xl tabular-nums" style={{ color: accent }}>{value}</p>
    </div>
  );
}

function ChartCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card/30 p-3">
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" /> {title}
      </h3>
      {children}
    </div>
  );
}
