"use client";

import { useSeismo } from "@/lib/store";
import { useEarthquakes } from "@/hooks/use-seismo-data";
import { EventCard } from "@/components/seismo/EventCard";
import { LoadingState, ErrorState, EmptyState } from "@/components/seismo/States";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { History, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

/** Historical earthquake explorer with filters. */
export function HistoryPanel({ className }: { className?: string }) {
  const filters = useSeismo((s) => s.filters);
  const setFilters = useSeismo((s) => s.setFilters);
  const selected = useSeismo((s) => s.selectedEarthquake);
  const select = useSeismo((s) => s.selectEarthquake);

  const params = {
    from: new Date(filters.from).toISOString(),
    to: new Date(`${filters.to}T23:59:59`).toISOString(),
    minMagnitude: filters.minMagnitude,
    maxMagnitude: filters.maxMagnitude,
    minDepth: filters.minDepth,
    maxDepth: filters.maxDepth,
    region: filters.region || undefined,
    eventType: filters.eventType || undefined,
    sort: "newest" as const,
    pageSize: 100,
  };
  const { data, total, loading, error, reload } = useEarthquakes(params);

  return (
    <div className={cn("flex flex-col min-h-0", className)}>
      <h2 className="flex items-center gap-1.5 px-1 pb-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground">
        <History className="h-3.5 w-3.5 text-primary" /> History explorer
      </h2>

      <div className="glass rounded-lg p-2.5 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">From</Label>
            <Input type="date" value={filters.from} onChange={(e) => setFilters({ from: e.target.value })} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">To</Label>
            <Input type="date" value={filters.to} onChange={(e) => setFilters({ to: e.target.value })} className="h-8 text-xs" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Min magnitude</Label>
            <Input type="number" step="0.1" min="0" max="10" value={filters.minMagnitude} onChange={(e) => setFilters({ minMagnitude: Number(e.target.value) })} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Max magnitude</Label>
            <Input type="number" step="0.1" min="0" max="10" value={filters.maxMagnitude} onChange={(e) => setFilters({ maxMagnitude: Number(e.target.value) })} className="h-8 text-xs" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Region / place</Label>
            <Input placeholder="e.g. Mindanao" value={filters.region} onChange={(e) => setFilters({ region: e.target.value })} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Event type</Label>
            <Select value={filters.eventType || "ALL"} onValueChange={(v) => setFilters({ eventType: v === "ALL" ? "" : v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All types</SelectItem>
                <SelectItem value="TECTONIC">Tectonic</SelectItem>
                <SelectItem value="VOLCANIC">Volcanic</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center justify-between pt-0.5">
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Filter className="h-3 w-3" /> {total.toLocaleString()} events match</span>
          <Button size="sm" variant="outline" onClick={reload} className="h-7 text-xs">Apply</Button>
        </div>
      </div>

      <ScrollArea className="mt-2 flex-1 scroll-slim pr-2">
        {loading && data.length === 0 ? (
          <LoadingState label="Filtering earthquakes…" />
        ) : error ? (
          <ErrorState description={error} onRetry={reload} />
        ) : data.length === 0 ? (
          <EmptyState icon={<History className="h-6 w-6" />} title="No earthquakes match these filters" description="Try widening the date range or lowering the magnitude threshold." />
        ) : (
          <div className="space-y-1.5">
            {data.map((eq) => (
              <EventCard key={eq.id} eq={eq} selected={selected?.id === eq.id} onClick={() => select(eq)} />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
