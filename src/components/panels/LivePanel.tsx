"use client";

import { useSeismo } from "@/lib/store";
import { useRecentEarthquakes } from "@/hooks/use-seismo-data";
import { EventCard } from "@/components/seismo/EventCard";
import { LoadingState, ErrorState, EmptyState } from "@/components/seismo/States";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Radio, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  title?: string;
  limit?: number;
}

/** Recent-earthquakes list shown in the left sidebar for the Live view. */
export function LivePanel({ className, title = "Recent earthquakes", limit = 60 }: Props) {
  const { data, loading, error, reload, asOf } = useRecentEarthquakes(limit);
  const selected = useSeismo((s) => s.selectedEarthquake);
  const select = useSeismo((s) => s.selectEarthquake);
  const setView = useSeismo((s) => s.setView);

  return (
    <div className={cn("flex flex-col min-h-0", className)}>
      <div className="flex items-center justify-between px-1 pb-1.5">
        <h2 className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground">
          <Radio className="h-3.5 w-3.5 text-primary" /> {title}
        </h2>
        <button onClick={reload} className="rounded p-1 text-muted-foreground hover:bg-accent/40 hover:text-foreground" aria-label="Refresh">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </button>
      </div>
      {asOf && (
        <p className="px-1 pb-1.5 text-[10px] text-muted-foreground">
          Last updated {new Date(asOf).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila" })} PHT
        </p>
      )}
      <ScrollArea className="flex-1 scroll-slim pr-2">
        {loading && data.length === 0 ? (
          <LoadingState label="Loading recent earthquakes…" />
        ) : error ? (
          <ErrorState description={error} onRetry={reload} />
        ) : data.length === 0 ? (
          <EmptyState icon={<Radio className="h-6 w-6" />} title="No earthquake data available" description="Data source may be temporarily unavailable." />
        ) : (
          <div className="space-y-1.5">
            {data.map((eq) => (
              <EventCard
                key={eq.id}
                eq={eq}
                selected={selected?.id === eq.id}
                onClick={() => { select(eq); setView("live"); }}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
