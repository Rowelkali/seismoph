"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useRecentEarthquakes } from "@/hooks/use-seismo-data";
import { useSeismo } from "@/lib/store";
import { MagnitudeBadge } from "./MagnitudeBadge";
import { Button } from "@/components/ui/button";
import { Play, Pause, SkipBack, SkipForward, Clock, X } from "lucide-react";
import { formatPHTTime, timeAgoPHT } from "@/lib/ui";
import type { EarthquakeEvent } from "@/lib/types";

const SPEEDS = [0.5, 1, 2, 5, 10];

/** Earthquake Replay — a timeline scrubber that animates recent earthquakes
 *  chronologically. Users can play/pause/skip and change speed (0.5x–10x).
 *  The selected earthquake at the current timeline position is highlighted
 *  on the map.
 */
export function ReplayBar({ className }: { className?: string }) {
  const { data: recent } = useRecentEarthquakes(50);
  const select = useSeismo((s) => s.selectEarthquake);
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [index, setIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reverse so oldest is first (chronological playback)
  const events = [...recent].reverse();

  const current = events[index];

  const step = useCallback(() => {
    setIndex((i) => {
      if (i >= events.length - 1) {
        setPlaying(false);
        return i;
      }
      return i + 1;
    });
  }, [events.length]);

  useEffect(() => {
    if (!playing || !current) return;
    // Speed: higher speed = shorter interval between events
    const interval = Math.max(200, 2000 / speed);
    timerRef.current = setTimeout(step, interval);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [playing, current, speed, step]);

  // Select the current earthquake on the map
  useEffect(() => {
    if (current && open) {
      select(current);
    }
  }, [current, open, select]);

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={cn("glass-strong h-9 gap-1.5 rounded-lg border-border px-3 text-xs", className)}
      >
        <Play className="h-3.5 w-3.5 text-primary" />
        Replay timeline
      </Button>
    );
  }

  if (events.length === 0) {
    return (
      <div className={cn("glass-strong rounded-lg p-3 text-sm text-muted-foreground", className)}>
        No earthquake data available for replay.
      </div>
    );
  }

  return (
    <div className={cn("glass-strong rounded-lg p-3 space-y-2", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
          <Clock className="h-3.5 w-3.5 text-primary" /> Earthquake replay
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setOpen(false); setPlaying(false); }}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Current event */}
      {current && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-card/40 p-2">
          <MagnitudeBadge magnitude={current.magnitude} magnitudeType={current.magnitudeType} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{current.locationDescription}</p>
            <p className="text-[10px] text-muted-foreground font-mono">
              {formatPHTTime(current.originTime)} PHT · {Math.round(current.depthKm)}km depth
            </p>
          </div>
        </div>
      )}

      {/* Timeline scrubber */}
      <div className="relative">
        <input
          type="range"
          min={0}
          max={events.length - 1}
          value={index}
          onChange={(e) => setIndex(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-muted"
          style={{
            background: `linear-gradient(to right, var(--primary) ${(index / (events.length - 1)) * 100}%, var(--muted) ${(index / (events.length - 1)) * 100}%)`,
          }}
          aria-label="Timeline scrubber"
        />
        <div className="mt-0.5 flex justify-between text-[9px] text-muted-foreground font-mono">
          <span>Event {index + 1} of {events.length}</span>
          <span>{timeAgoPHT(events[0]?.originTime)} → {timeAgoPHT(events[events.length - 1]?.originTime)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => setIndex(0)}
          disabled={index === 0}
          aria-label="Skip to start"
        >
          <SkipBack className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => setPlaying(!playing)}
          disabled={index >= events.length - 1}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => setIndex(events.length - 1)}
          disabled={index >= events.length - 1}
          aria-label="Skip to end"
        >
          <SkipForward className="h-3.5 w-3.5" />
        </Button>
        <div className="flex-1" />
        <div className="flex items-center gap-0.5">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-mono transition-colors",
                speed === s ? "bg-primary/20 text-primary font-bold" : "text-muted-foreground hover:bg-accent/40",
              )}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Animates {events.length} recent earthquakes chronologically. The current event is highlighted on the map.
      </p>
    </div>
  );
}
