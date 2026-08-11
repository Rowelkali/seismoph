"use client";

import { cn } from "@/lib/utils";
import type { EarthquakeEvent } from "@/lib/types";
import { severityOf, SEVERITY_COLOR } from "@/lib/ui";
import { magnitudeToRadius } from "@/lib/geo";
import { haversineKm } from "@/lib/geo";

interface Props {
  earthquake: EarthquakeEvent;
  userLocation?: { name: string; latitude: number; longitude: number } | null;
  reducedMotion?: boolean;
  className?: string;
}

/**
 * Side-view cross-section showing the hypocenter beneath the surface for a
 * selected earthquake. This is the scientific, honest way to represent depth
 * on a 2D screen — a true 3D globe with terrain would be used in production
 * (CesiumJS / MapLibre 3D terrain), but this cross-section makes the
 * surface-vs-depth relationship unambiguous and accessible.
 *
 * The vertical axis is depth (km); the epicenter sits on the surface line and
 * the hypocenter is plotted at its true focal depth. If a user location is
 * provided, its surface offset (horizontal distance) and slant distance to the
 * hypocenter are drawn to scale.
 */
export function DepthCrossSection({ earthquake, userLocation, reducedMotion, className }: Props) {
  const W = 360;
  const H = 260;
  const surfaceY = 46;
  const baseY = H - 26;
  const cx = W / 2;

  // Depth scale: map [0, maxDepth] → [surfaceY, baseY]
  const maxDepth = Math.max(120, Math.ceil(earthquake.depthKm * 1.25 / 10) * 10);
  const depthToY = (d: number) => surfaceY + (d / maxDepth) * (baseY - surfaceY);

  const hypY = depthToY(earthquake.depthKm);
  const sev = severityOf(earthquake.magnitude);
  const color = SEVERITY_COLOR[sev];
  const r = magnitudeToRadius(earthquake.magnitude);

  // Optional user-location surface marker (horizontal offset by distance).
  let userX: number | null = null;
  let userDistKm: number | null = null;
  let slantKm: number | null = null;
  if (userLocation) {
    userDistKm = haversineKm(
      userLocation.latitude,
      userLocation.longitude,
      earthquake.latitude,
      earthquake.longitude,
    );
    slantKm = Math.sqrt(userDistKm ** 2 + earthquake.depthKm ** 2);
    // Horizontal scale: fit ±max(160 km, userDistKm*1.2) within [pad, W-pad].
    const halfRange = Math.max(160, userDistKm * 1.2);
    const pad = 28;
    const usable = W - pad * 2;
    userX = cx + (userDistKm / halfRange) * (usable / 2);
    userX = Math.max(pad, Math.min(W - pad, userX));
  }

  // Depth tick marks
  const ticks = Array.from({ length: Math.floor(maxDepth / 40) + 1 }, (_, i) => i * 40).filter(
    (t) => t <= maxDepth,
  );

  return (
    <div className={cn("relative", className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img"
        aria-label={`Cross-section: epicenter at surface, hypocenter at ${Math.round(earthquake.depthKm)} km depth`}>
        <defs>
          <linearGradient id="earth-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.32 0.02 240)" />
            <stop offset="100%" stopColor="oklch(0.18 0.02 250)" />
          </linearGradient>
          <radialGradient id="hyp-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={color} stopOpacity="0.9" />
            <stop offset="60%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* sky / atmosphere */}
        <rect x="0" y="0" width={W} height={surfaceY} fill="oklch(0.13 0.01 240)" />
        {/* earth */}
        <rect x="0" y={surfaceY} width={W} height={H - surfaceY} fill="url(#earth-grad)" />
        {/* surface line */}
        <line x1="0" y1={surfaceY} x2={W} y2={surfaceY} stroke="oklch(0.7 0.05 185)" strokeWidth="1.5" />
        <text x="6" y={surfaceY - 6} fill="oklch(0.6 0.04 185)" fontSize="9" fontFamily="monospace">SURFACE</text>

        {/* strata lines */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1="0" y1={depthToY(t)} x2={W} y2={depthToY(t)} stroke="oklch(1 0 0 / 6%)" strokeWidth="0.5" strokeDasharray="2 4" />
            <text x="6" y={depthToY(t) - 3} fill="oklch(0.55 0.02 240)" fontSize="9" fontFamily="monospace">{t} km</text>
          </g>
        ))}

        {/* user location surface marker + slant line */}
        {userX != null && userDistKm != null && slantKm != null && (
          <g>
            <line
              x1={userX} y1={surfaceY}
              x2={cx} y2={hypY}
              stroke="oklch(0.7 0.1 185)" strokeWidth="1" strokeDasharray="3 3"
              opacity="0.8"
            />
            <circle cx={userX} cy={surfaceY} r="4" fill="oklch(0.7 0.1 185)" stroke="oklch(0.9 0 0 / 60%)" strokeWidth="1" />
            <text x={userX} y={surfaceY - 8} fill="oklch(0.75 0.08 185)" fontSize="9" fontFamily="monospace" textAnchor="middle">
              {Math.round(userDistKm)} km
            </text>
            <text x={(userX + cx) / 2} y={(surfaceY + hypY) / 2 - 4} fill="oklch(0.7 0.08 185)" fontSize="9" fontFamily="monospace" textAnchor="middle">
              ↳ {Math.round(slantKm)} km
            </text>
          </g>
        )}

        {/* epicenter surface marker (downward triangle + pulse) */}
        <g>
          {!reducedMotion && (
            <circle cx={cx} cy={surfaceY} r="10" fill={color} opacity="0.4" className="animate-seismo-pulse" />
          )}
          <path d={`M ${cx - 7} ${surfaceY - 9} L ${cx + 7} ${surfaceY - 9} L ${cx} ${surfaceY + 2} Z`} fill={color} stroke="oklch(0 0 0 / 30%)" strokeWidth="0.75" />
          <text x={cx} y={surfaceY - 14} fill={color} fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="700">EPICENTER</text>
        </g>

        {/* vertical beam surface → hypocenter */}
        <line x1={cx} y1={surfaceY} x2={cx} y2={hypY} stroke={color} strokeWidth="1.2" strokeDasharray="4 3" opacity="0.7" />

        {/* hypocenter */}
        <g>
          <circle cx={cx} cy={hypY} r={r + 14} fill="url(#hyp-glow)" />
          {!reducedMotion && (
            <circle cx={cx} cy={hypY} r={r} fill="none" stroke={color} strokeWidth="1.5" className="animate-seismo-ring" opacity="0.6" />
          )}
          <circle cx={cx} cy={hypY} r={r} fill={color} stroke="oklch(0 0 0 / 40%)" strokeWidth="1" />
          <circle cx={cx} cy={hypY} r="2" fill="oklch(0.1 0 0)" />
          <text x={cx + r + 8} y={hypY + 3} fill={color} fontSize="10" fontFamily="monospace" fontWeight="700">
            HYPOCENTER
          </text>
          <text x={cx + r + 8} y={hypY + 15} fill="oklch(0.65 0.02 240)" fontSize="9" fontFamily="monospace">
            {Math.round(earthquake.depthKm)} km
          </text>
        </g>

        {/* magnitude badge top-right */}
        <g>
          <rect x={W - 78} y="8" width="70" height="24" rx="6" fill={color} fillOpacity="0.15" stroke={color} strokeOpacity="0.5" />
          <text x={W - 43} y="24" fill={color} fontSize="12" fontFamily="monospace" fontWeight="700" textAnchor="middle">
            M {earthquake.magnitude.toFixed(1)}
          </text>
        </g>
      </svg>
      <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
        Vertical cross-section. The hypocenter (focus) is plotted at its true focal depth beneath
        the surface epicenter. Distances are geodesic (haversine).
      </p>
    </div>
  );
}
