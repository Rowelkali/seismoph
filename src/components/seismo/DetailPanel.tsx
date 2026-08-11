"use client";

import { cn } from "@/lib/utils";
import { MagnitudeBadge, DepthTag } from "./MagnitudeBadge";
import { DepthCrossSection } from "./DepthCrossSection";
import { IntensityScale } from "./IntensityScale";
import { AiExplainer } from "./AiExplainer";
import { ShareCard } from "./ShareCard";
import { AiCaption } from "./AiCaption";
import { StatusIndicator } from "./StatusIndicator";
import { formatPHT, formatPHTTime, peisDescription, magLabel } from "@/lib/ui";
import { haversineKm, bearingDeg, bearingLabel, depthClass } from "@/lib/geo";
import type { EarthquakeEvent, IntensityReport } from "@/lib/types";
import { useSeismo } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  X, MapPin, Clock, Layers3, Crosshair, Share2, Copy, Radio,
  Activity, Navigation, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  earthquake: EarthquakeEvent | null;
  loading?: boolean;
  onClose?: () => void;
  className?: string;
}

export function DetailPanel({ earthquake, loading, onClose, className }: Props) {
  const userLocation = useSeismo((s) => s.userLocation);
  const setView = useSeismo((s) => s.setView);
  const selectEarthquake = useSeismo((s) => s.selectEarthquake);
  const reducedMotion = useSeismo((s) => s.settings.reducedMotion);

  if (loading) {
    return (
      <div className={cn("glass-strong rounded-lg p-4 text-sm text-muted-foreground", className)}>
        Loading earthquake…
      </div>
    );
  }
  if (!earthquake) {
    return (
      <div className={cn("glass-strong rounded-lg p-4", className)}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Crosshair className="h-4 w-4" />
          Select an earthquake on the map or from the list to inspect its details.
        </div>
      </div>
    );
  }

  const eq = earthquake;
  const dc = depthClass(eq.depthKm);
  const intensities = eq.intensities ?? [];

  let distKm: number | null = null;
  let bearDeg: number | null = null;
  if (userLocation) {
    distKm = haversineKm(userLocation.latitude, userLocation.longitude, eq.latitude, eq.longitude);
    bearDeg = bearingDeg(userLocation.latitude, userLocation.longitude, eq.latitude, eq.longitude);
  }

  const copyCoords = () => {
    navigator.clipboard?.writeText(`${eq.latitude.toFixed(4)}, ${eq.longitude.toFixed(4)}`);
    toast.success("Coordinates copied");
  };
  const share = async () => {
    const url = `${window.location.origin}/?eq=${eq.id}`;
    try {
      if (navigator.share) await navigator.share({ title: magLabel(eq), text: eq.locationDescription, url });
      else { await navigator.clipboard?.writeText(url); toast.success("Link copied"); }
    } catch { /* user cancelled */ }
  };
  const viewOnMap = () => setView("live");

  return (
    <div className={cn("glass-strong rounded-lg flex flex-col overflow-hidden", className)}>
      {/* header */}
      <div className="flex items-start gap-3 border-b border-border p-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <MagnitudeBadge magnitude={eq.magnitude} magnitudeType={eq.magnitudeType} size="lg" />
            <DepthTag depthKm={eq.depthKm} className="text-muted-foreground border border-border" />
          </div>
          <h2 className="mt-2 text-sm font-semibold leading-snug line-clamp-2">
            {eq.locationDescription}
          </h2>
          <div className="mt-1 flex items-center gap-2">
            {eq.source === "DEV-SEED" ? (
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                Development fixture
              </span>
            ) : eq.source === "DOST-PHIVOLCS" ? (
              <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                DOST-PHIVOLCS · Live
              </span>
            ) : (
              <span className="rounded bg-muted/40 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {eq.source}
              </span>
            )}
            <StatusIndicator status="live" label={eq.status} />
            {eq.dataQuality && (
              <span className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                eq.dataQuality === "HIGH" ? "bg-emerald-500/15 text-emerald-400"
                : eq.dataQuality === "MEDIUM" ? "bg-amber-500/15 text-amber-400"
                : "bg-red-500/15 text-red-400",
              )} title="Data integrity score based on field completeness + plausibility">
                {eq.dataQuality} quality
              </span>
            )}
          </div>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose} aria-label="Close detail panel">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1 scroll-slim">
        <div className="space-y-4 p-3">
          {/* key facts */}
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            <Fact icon={Clock} label="Origin time (PHT)" value={formatPHT(eq.originTime)} mono />
            <Fact icon={Radio} label="Magnitude" value={`${eq.magnitude.toFixed(1)} ${eq.magnitudeType}`} mono />
            <Fact icon={MapPin} label="Epicenter" value={`${eq.latitude.toFixed(4)}°, ${eq.longitude.toFixed(4)}°`} mono />
            <Fact icon={Layers3} label="Focal depth" value={`${Math.round(eq.depthKm)} km (${dc})`} mono />
            <Fact icon={Activity} label="Event type" value={eq.eventType} />
            <Fact icon={Navigation} label="Status" value={eq.status} />
          </dl>

          {/* distance from user location */}
          {userLocation && distKm != null && bearDeg != null && (
            <div className="rounded-md border border-border bg-card/40 p-2.5 text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Navigation className="h-3.5 w-3.5" /> Distance from {userLocation.name}
              </div>
              <p className="mt-1 font-mono text-lg text-foreground">
                {Math.round(distKm)} km <span className="text-xs text-muted-foreground">({bearingLabel(bearDeg)} {Math.round(bearDeg)}°)</span>
              </p>
              <p className="text-[10px] text-muted-foreground">Application-derived geodesic distance (haversine). Not reported by PHIVOLCS.</p>
            </div>
          )}

          {/* depth cross-section */}
          <div>
            <SectionTitle icon={Layers3}>Depth cross-section</SectionTitle>
            <DepthCrossSection earthquake={eq} userLocation={userLocation} reducedMotion={reducedMotion} />
          </div>

          {/* reported intensities */}
          <div>
            <SectionTitle icon={Activity}>Reported intensity {intensities.length > 0 && `(${intensities.length})`}</SectionTitle>
            {intensities.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                No reported intensity available for this event in the database.
              </p>
            ) : (
              <>
                <ul className="space-y-1">
                  {intensities.slice(0, 8).map((i: IntensityReport) => (
                    <li key={i.id} className="flex items-center justify-between rounded border border-border bg-card/30 px-2 py-1 text-xs">
                      <span className="truncate">{i.locality}{i.province ? ` · ${i.province}` : ""}</span>
                      <span className="ml-2 shrink-0 font-mono font-semibold">PEIS {i.intensity}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Magnitude = size at the source. Intensity = shaking felt at a location. They are different.
                </p>
              </>
            )}
            <IntensityScale className="mt-2" active={intensities[0]?.intensity} />
          </div>

          {/* educational note: magnitude vs intensity */}
          <div className="rounded-md border border-border bg-muted/30 p-2.5 text-[11px] leading-snug text-muted-foreground">
            <AlertCircle className="mb-1 h-3.5 w-3.5 text-primary" />
            <strong className="text-foreground">Magnitude</strong> measures the energy released at the
            earthquake&apos;s source — a single value per event. <strong className="text-foreground">Intensity</strong>
            measures how strongly shaking was felt at a specific place and varies by location.
          </div>

          {/* AI explainer */}
          <AiExplainer earthquake={eq} userLocation={userLocation} />

          {/* Share Card + AI Caption — social-media-ready exports */}
          <ShareCard earthquake={eq} />
          <AiCaption earthquake={eq} />
        </div>
      </ScrollArea>

      {/* footer actions */}
      <div className="grid grid-cols-2 gap-1.5 border-t border-border p-2">
        <Button size="sm" variant="outline" onClick={viewOnMap}><MapPin className="h-3.5 w-3.5" /> View on map</Button>
        <Button size="sm" variant="outline" onClick={copyCoords}><Copy className="h-3.5 w-3.5" /> Copy coords</Button>
        <Button size="sm" variant="outline" onClick={share}><Share2 className="h-3.5 w-3.5" /> Share</Button>
        <Button size="sm" variant="ghost" onClick={() => { selectEarthquake(null); onClose?.(); }}>Close</Button>
      </div>
    </div>
  );
}

function Fact({ icon: Icon, label, value, mono }: { icon: React.ElementType; label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </dt>
      <dd className={mono ? "mt-0.5 font-mono text-foreground" : "mt-0.5 text-foreground"}>{value}</dd>
    </div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
      <Icon className="h-3.5 w-3.5" /> {children}
    </h3>
  );
}
