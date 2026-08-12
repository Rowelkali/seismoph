"use client";

// SEISMO PH — Share Card generator.
// Renders a purpose-designed social-media-ready earthquake information card
// to an HTML5 <canvas> at one of four formats (Square / Portrait / Story /
// Landscape) and exposes a Download / Web Share action.
//
// Everything drawn comes from the verified EarthquakeEvent payload — never
// fabricated. The Philippines outline is a stylized hardcoded polygon; the
// epicenter marker is plotted at the earthquake's ACTUAL [lon, lat] projected
// into the map area using PH_BOUNDS.

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { normalizeLocation, formatCoordinates } from "@/lib/text-utils";
import {
  Loader2, Image as ImageIcon, Download, Share2, AlertTriangle, X, MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { formatPHT, peisDescription } from "@/lib/ui";
import { magnitudeSeverity, PH_BOUNDS } from "@/lib/geo";
import type { EarthquakeEvent } from "@/lib/types";

interface ShareCardProps {
  earthquake: EarthquakeEvent;
  className?: string;
}

type CardFormat = "square" | "portrait" | "story" | "landscape";

const FORMATS: { id: CardFormat; label: string; w: number; h: number }[] = [
  { id: "square", label: "Square", w: 1080, h: 1080 },
  { id: "portrait", label: "Portrait", w: 1080, h: 1350 },
  { id: "story", label: "Story", w: 1080, h: 1920 },
  { id: "landscape", label: "Landscape", w: 1920, h: 1080 },
];

type Severity = ReturnType<typeof magnitudeSeverity>;

// Canvas cannot reliably read CSS custom properties; mirror the oklch severity
// ramp from globals.css with hex equivalents so the card matches the app theme.
const SEVERITY_HEX: Record<Severity, string> = {
  minor: "#94a3b8",     // slate
  light: "#5fb3a8",     // teal
  moderate: "#e8b04e",  // amber
  strong: "#e8823a",    // orange
  major: "#d04830",     // red
  great: "#b02a1a",     // deep red
};

const SEVERITY_LABEL: Record<Severity, string> = {
  minor: "Minor", light: "Light", moderate: "Moderate",
  strong: "Strong", major: "Major", great: "Great",
};

// Stylized Philippine archipelago — rough polygon outlines of the main island
// groups in [lon, lat] pairs. Not survey-accurate; designed only as a
// recognizable backdrop so the epicenter marker is meaningfully placed.
const PH_ISLANDS: [number, number][][] = [
  // Luzon (main northern island + surrounding islets silhouette)
  [
    [120.3, 18.6], [121.2, 18.7], [122.4, 18.5], [122.7, 17.6],
    [122.6, 16.6], [122.9, 15.7], [123.2, 14.6], [123.4, 13.6],
    [124.0, 12.9], [123.7, 12.2], [122.9, 11.6], [122.0, 11.2],
    [121.4, 11.0], [120.9, 11.5], [120.6, 12.3], [120.4, 13.4],
    [120.0, 14.5], [119.6, 15.5], [119.5, 16.6], [119.8, 17.6],
    [120.0, 18.2],
  ],
  // Mindoro
  [
    [120.2, 13.5], [121.0, 13.4], [121.3, 12.8], [121.0, 12.1],
    [120.4, 12.1], [120.0, 12.7], [120.2, 13.5],
  ],
  // Panay
  [
    [121.7, 11.8], [122.7, 11.7], [122.5, 11.0], [121.9, 10.7],
    [121.4, 10.9], [121.5, 11.5], [121.7, 11.8],
  ],
  // Negros
  [
    [122.3, 11.0], [123.0, 10.9], [123.1, 10.0], [122.6, 9.4],
    [122.2, 9.7], [122.1, 10.5], [122.3, 11.0],
  ],
  // Cebu
  [
    [123.3, 11.0], [123.9, 10.9], [124.0, 10.2], [123.5, 9.8],
    [123.2, 10.2], [123.2, 10.7], [123.3, 11.0],
  ],
  // Bohol
  [
    [123.6, 10.0], [124.3, 9.9], [124.5, 9.5], [124.0, 9.2],
    [123.6, 9.4], [123.5, 9.8], [123.6, 10.0],
  ],
  // Samar + Leyte silhouette
  [
    [124.4, 12.8], [125.4, 12.7], [125.7, 11.7], [125.4, 10.8],
    [125.1, 10.2], [124.5, 10.0], [123.7, 10.2], [123.5, 10.7],
    [123.7, 11.4], [124.0, 12.0], [124.4, 12.8],
  ],
  // Mindanao (main southern island)
  [
    [123.4, 8.8], [124.4, 9.0], [125.5, 9.2], [126.5, 8.7],
    [126.8, 7.6], [126.5, 6.4], [125.6, 5.6], [124.6, 5.9],
    [123.7, 6.6], [122.8, 7.0], [122.1, 7.4], [122.2, 8.2],
    [123.0, 8.6], [123.4, 8.8],
  ],
  // Palawan (long thin western island)
  [
    [119.1, 9.5], [119.6, 10.1], [120.1, 10.7], [120.4, 11.3],
    [120.5, 11.8], [120.2, 12.2], [119.6, 12.0], [119.0, 11.0],
    [118.6, 10.0], [118.7, 9.4], [119.1, 9.5],
  ],
];

/** Project [lon, lat] to a pixel within the map rectangle on the canvas. */
function projectToMap(
  lon: number, lat: number,
  mapX: number, mapY: number, mapW: number, mapH: number,
): { x: number; y: number } {
  const x = mapX + ((lon - PH_BOUNDS.minLon) / (PH_BOUNDS.maxLon - PH_BOUNDS.minLon)) * mapW;
  const y = mapY + ((PH_BOUNDS.maxLat - lat) / (PH_BOUNDS.maxLat - PH_BOUNDS.minLat)) * mapH;
  return { x, y };
}

function roundedRect(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 3,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
      if (lines.length >= maxLines - 1) break;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) lines.length = maxLines;
  // truncate last line if needed
  if (lines.length === maxLines) {
    let last = lines[maxLines - 1];
    while (ctx.measureText(`${last}…`).width > maxWidth && last.length > 0) {
      last = last.slice(0, -1);
    }
    lines[maxLines - 1] = `${last}…`;
  }
  ctx.textBaseline = "top";
  lines.forEach((line, i) => ctx.fillText(line, x, y + i * lineHeight));
  return lines;
}

/** Load a static map image from CARTO's static map API for the earthquake location.
 *  Returns an HTMLImageElement or null if loading fails. */
async function loadStaticMap(eq: EarthquakeEvent, mapW: number, mapH: number): Promise<HTMLImageElement | null> {
  try {
    // Calculate appropriate zoom based on magnitude (bigger = wider context)
    const zoom = eq.magnitude >= 6 ? 6 : eq.magnitude >= 4 ? 7 : 8;
    // Use CARTO static maps API (free, no key needed for dark theme)
    const url = `https://staticmap.openstreetmap.de/staticmap.php?center=${eq.latitude},${eq.longitude}&zoom=${zoom}&size=${mapW}x${mapH}&maptype=mapnik`;
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
      // Timeout after 8s
      setTimeout(() => resolve(null), 8000);
    });
  } catch {
    return null;
  }
}

/**
 * Draw the share card onto the supplied canvas using only `eq` values.
 * Layout adapts to the canvas dimensions; all sections scale proportionally.
 * Now async — loads a real static map image.
 */
async function drawShareCard(
  canvas: HTMLCanvasElement, eq: EarthquakeEvent, format: CardFormat,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  const W = canvas.width;
  const H = canvas.height;
  const sev = magnitudeSeverity(eq.magnitude);
  const sevColor = SEVERITY_HEX[sev];
  const isLandscape = format === "landscape";

  // ----- 1. Background gradient (deep charcoal, faint warm tint) -----
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0a0e14");
  bg.addColorStop(0.5, "#0e131a");
  bg.addColorStop(1, "#0a0e14");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Subtle grid pattern (scientific feel)
  ctx.strokeStyle = "rgba(255,255,255,0.025)";
  ctx.lineWidth = 1;
  const grid = 60;
  for (let x = 0; x <= W; x += grid) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y <= H; y += grid) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Inner padding
  const PAD = Math.round(W * 0.06);

  // ----- 2. Header (branding + tagline) -----
  const headerY = PAD;
  // SEISMO PH logo mark — small triangle / mountain glyph
  const logoSize = Math.round(W * 0.038);
  const logoX = PAD;
  const logoCY = headerY + logoSize / 2;
  ctx.save();
  ctx.fillStyle = sevColor;
  ctx.beginPath();
  ctx.moveTo(logoX, logoCY + logoSize * 0.45);
  ctx.lineTo(logoX + logoSize * 0.5, logoCY - logoSize * 0.45);
  ctx.lineTo(logoX + logoSize, logoCY + logoSize * 0.45);
  ctx.closePath();
  ctx.fill();
  // inner notch (seismograph pulse silhouette)
  ctx.strokeStyle = "#0a0e14";
  ctx.lineWidth = Math.max(2, logoSize * 0.12);
  ctx.beginPath();
  ctx.moveTo(logoX + logoSize * 0.25, logoCY + logoSize * 0.2);
  ctx.lineTo(logoX + logoSize * 0.42, logoCY - logoSize * 0.1);
  ctx.lineTo(logoX + logoSize * 0.55, logoCY + logoSize * 0.15);
  ctx.lineTo(logoX + logoSize * 0.75, logoCY - logoSize * 0.25);
  ctx.stroke();
  ctx.restore();

  // Brand wordmark
  ctx.textBaseline = "alphabetic";
  const brandSize = Math.round(W * 0.034);
  ctx.fillStyle = "#f5f7fa";
  ctx.font = `700 ${brandSize}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = "left";
  const brandX = logoX + logoSize + Math.round(W * 0.018);
  ctx.fillText("SEISMO PH", brandX, headerY + brandSize * 0.95);

  // Tagline
  const tagSize = Math.round(W * 0.018);
  ctx.fillStyle = "rgba(245,247,250,0.55)";
  ctx.font = `400 ${tagSize}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText("Real-Time Earthquake Intelligence", brandX, headerY + brandSize * 1.5);

  // Severity status pill (right side)
  const pillText = `${SEVERITY_LABEL[sev].toUpperCase()} · M ${eq.magnitude.toFixed(1)}`;
  ctx.font = `700 ${Math.round(W * 0.018)}px ui-sans-serif, system-ui, sans-serif`;
  const pillW = ctx.measureText(pillText).width + Math.round(W * 0.04);
  const pillH = Math.round(W * 0.04);
  const pillX = W - PAD - pillW;
  const pillY = headerY;
  roundedRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
  ctx.fillStyle = `${sevColor}22`;
  ctx.fill();
  ctx.strokeStyle = sevColor;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = sevColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(pillText, pillX + pillW / 2, pillY + pillH / 2);

  // Accent rule
  ctx.fillStyle = sevColor;
  ctx.fillRect(PAD, headerY + Math.round(W * 0.075), W - PAD * 2, 3);

  // ----- 3. Main magnitude block + detected label -----
  const contentTop = headerY + Math.round(W * 0.11);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  // "EARTHQUAKE DETECTED" label
  const detSize = Math.round(W * 0.024);
  ctx.font = `700 ${detSize}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillStyle = sevColor;
  // letter-spaced manually
  const detText = "EARTHQUAKE DETECTED";
  let dx = PAD;
  for (const ch of detText) {
    ctx.fillText(ch, dx, contentTop + detSize);
    dx += ctx.measureText(ch).width + Math.round(W * 0.006);
  }

  // Huge magnitude "M 5.8"
  const mag = eq.magnitude.toFixed(1);
  const magM = "M";
  const magNumSize = Math.round(W * 0.18);
  const magMSize = Math.round(W * 0.07);
  ctx.font = `800 ${magNumSize}px ui-sans-serif, system-ui, sans-serif`;
  const numW = ctx.measureText(mag).width;
  ctx.font = `700 ${magMSize}px ui-sans-serif, system-ui, sans-serif`;
  const mW = ctx.measureText(magM).width;
  const gap = Math.round(W * 0.012);
  const magBlockY = contentTop + detSize + Math.round(W * 0.04);
  const magBlockH = magNumSize;

  // severity glow behind magnitude
  const glow = ctx.createRadialGradient(
    PAD + mW + gap + numW / 2, magBlockY + magNumSize * 0.7, 0,
    PAD + mW + gap + numW / 2, magBlockY + magNumSize * 0.7, magNumSize * 0.9,
  );
  glow.addColorStop(0, `${sevColor}33`);
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(PAD - W * 0.05, magBlockY - W * 0.05, numW + mW + gap + W * 0.1, magBlockH + W * 0.1);

  // draw "M"
  ctx.fillStyle = "rgba(245,247,250,0.6)";
  ctx.font = `700 ${magMSize}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText(magM, PAD, magBlockY + magNumSize * 0.95);

  // draw magnitude number
  ctx.fillStyle = sevColor;
  ctx.font = `800 ${magNumSize}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText(mag, PAD + mW + gap, magBlockY + magNumSize * 0.95);

  // Magnitude type + status caption beside magnitude
  const capSize = Math.round(W * 0.02);
  ctx.font = `600 ${capSize}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillStyle = "rgba(245,247,250,0.7)";
  const capX = PAD + mW + gap + numW + Math.round(W * 0.025);
  const cap1Y = magBlockY + magNumSize * 0.45;
  ctx.fillText(`${eq.magnitudeType} magnitude`, capX, cap1Y);
  ctx.font = `500 ${Math.round(W * 0.016)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillStyle = "rgba(245,247,250,0.45)";
  ctx.fillText(`${eq.status} · ${eq.dataQuality} quality`, capX, cap1Y + capSize * 1.6);
  ctx.fillText(`${eq.eventType.charAt(0)}${eq.eventType.slice(1).toLowerCase()} event`, capX, cap1Y + capSize * 2.9);

  // ----- 4. Location description -----
  const locY = magBlockY + magBlockH + Math.round(W * 0.05);
  ctx.fillStyle = "#f5f7fa";
  ctx.font = `600 ${Math.round(W * 0.034)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const locLines = wrapText(
    ctx, normalizeLocation(eq.locationDescription), PAD, locY, W - PAD * 2, Math.round(W * 0.044), 2,
  );
  const locBlockH = locLines.length * Math.round(W * 0.044);

  // ----- 5. Data grid (depth, origin, coords, type, intensity) -----
  const gridTop = locY + locBlockH + Math.round(W * 0.04);
  const cols = 2;
  const gapPx = Math.round(W * 0.02);
  const cellW = (W - PAD * 2 - gapPx) / cols;
  const cellH = Math.round(W * 0.075);

  type Fact = { label: string; value: string };
  const facts: Fact[] = [
    { label: "FOCAL DEPTH", value: `${Math.round(eq.depthKm)} km` },
    { label: "ORIGIN TIME (PHT)", value: formatPHT(eq.originTime) },
    { label: "COORDINATES", value: formatCoordinates(eq.latitude, eq.longitude) },
    { label: "EVENT TYPE", value: eq.eventType },
  ];

  // Reported intensity — use the highest reported PEIS if available.
  const intensities = eq.intensities ?? [];
  if (intensities.length > 0) {
    const top = [...intensities].sort((a, b) => {
      const rank = (r: string) => "I,II,III,IV,V,VI,VII,VIII,IX,X".split(",").indexOf(r.toUpperCase());
      return rank(b.intensity) - rank(a.intensity);
    })[0];
    facts.push({ label: "REPORTED INTENSITY", value: `PEIS ${top.intensity} · ${top.locality}` });
  }

  facts.forEach((f, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = PAD + col * (cellW + gapPx);
    const y = gridTop + row * (cellH + gapPx);
    roundedRect(ctx, x, y, cellW, cellH, 12);
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // label
    ctx.fillStyle = "rgba(245,247,250,0.5)";
    ctx.font = `600 ${Math.round(W * 0.015)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textBaseline = "top";
    ctx.fillText(f.label, x + 16, y + 12);
    // value
    ctx.fillStyle = "#f5f7fa";
    ctx.font = `600 ${Math.round(W * 0.022)}px ui-monospace, "SF Mono", Menlo, monospace`;
    // truncate value if too long
    let val = f.value;
    const maxValW = cellW - 32;
    while (ctx.measureText(val).width > maxValW && val.length > 1) {
      val = val.slice(0, -1);
    }
    if (val !== f.value) val = `${val.slice(0, -1)}…`;
    ctx.fillText(val, x + 16, y + 36);
  });

  const gridRows = Math.ceil(facts.length / cols);
  const gridBottom = gridTop + gridRows * (cellH + gapPx);

  // ----- 6. Map (Philippines + epicenter) -----
  // For landscape the map is placed to the right; for tall formats below.
  let mapX: number, mapY: number, mapW: number, mapH: number;
  if (isLandscape) {
    // Map on right, half width
    const mapRightW = Math.round(W * 0.42);
    mapW = mapRightW - PAD;
    mapH = Math.round(H * 0.55);
    mapX = W - PAD - mapW;
    mapY = gridTop;
  } else {
    mapW = W - PAD * 2;
    // Available height between gridBottom and footer
    mapH = Math.min(Math.round(W * 0.55), H - gridBottom - Math.round(W * 0.16));
    mapX = PAD;
    mapY = gridBottom + Math.round(W * 0.025);
  }
  // Clamp
  if (mapH < Math.round(W * 0.3)) mapH = Math.round(W * 0.3);

  // Try to load a real static map image for the earthquake location
  const staticMap = await loadStaticMap(eq, mapW, mapH);

  // Map background panel
  roundedRect(ctx, mapX, mapY, mapW, mapH, 16);
  // If we got a real map image, draw it clipped to the rounded rect
  if (staticMap) {
    ctx.save();
    ctx.clip(); // clip to the rounded rect path
    // Draw the map image, covering the full map area
    ctx.drawImage(staticMap, mapX, mapY, mapW, mapH);
    // Add a dark overlay for the scientific theme
    ctx.fillStyle = "rgba(12, 15, 20, 0.35)";
    ctx.fillRect(mapX, mapY, mapW, mapH);
    ctx.restore();
  } else {
    // Fallback: draw the stylized polygon map if static map fails
    const mapBg = ctx.createLinearGradient(mapX, mapY, mapX + mapW, mapY + mapH);
    mapBg.addColorStop(0, "rgba(95,179,168,0.06)");
    mapBg.addColorStop(1, "rgba(255,255,255,0.02)");
    ctx.fillStyle = mapBg;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Map title
  ctx.fillStyle = "rgba(245,247,250,0.55)";
  ctx.font = `600 ${Math.round(W * 0.014)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText("EPICENTER LOCATION · PHILIPPINE ISLANDS", mapX + 16, mapY + 12);
  ctx.textAlign = "right";
  ctx.fillText(formatCoordinates(eq.latitude, eq.longitude), mapX + mapW - 16, mapY + 12);
  ctx.textAlign = "left";

  // Inner plot region
  const plotPad = Math.round(W * 0.025);
  const plotX = mapX + plotPad;
  const plotY = mapY + Math.round(W * 0.04);
  const plotW = mapW - plotPad * 2;
  const plotH = mapH - plotPad - Math.round(W * 0.04);

  // Subtle lat/lon grid lines + ocean background
  // Ocean gradient (deep blue-teal, very subtle)
  const oceanGrad = ctx.createLinearGradient(plotX, plotY, plotX, plotY + plotH);
  oceanGrad.addColorStop(0, "rgba(12,15,20,0.5)");
  oceanGrad.addColorStop(0.5, "rgba(20,40,50,0.3)");
  oceanGrad.addColorStop(1, "rgba(12,15,20,0.5)");
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(plotX, plotY, plotW, plotH);

  ctx.strokeStyle = "rgba(94,234,212,0.06)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const gx = plotX + (plotW / 4) * i;
    ctx.beginPath(); ctx.moveTo(gx, plotY); ctx.lineTo(gx, plotY + plotH); ctx.stroke();
    const gy = plotY + (plotH / 4) * i;
    ctx.beginPath(); ctx.moveTo(plotX, gy); ctx.lineTo(plotX + plotW, gy); ctx.stroke();
  }

  // Draw Philippine islands with enhanced styling
  ctx.save();
  // Islands get a subtle land gradient fill + brighter outline
  const landGrad = ctx.createLinearGradient(plotX, plotY, plotX, plotY + plotH);
  landGrad.addColorStop(0, "rgba(94,234,212,0.15)");
  landGrad.addColorStop(1, "rgba(245,247,250,0.12)");
  ctx.fillStyle = landGrad;
  ctx.strokeStyle = "rgba(94,234,212,0.5)";
  ctx.lineWidth = 1.8;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const island of PH_ISLANDS) {
    ctx.beginPath();
    island.forEach(([lon, lat], i) => {
      const p = projectToMap(lon, lat, plotX, plotY, plotW, plotH);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // Add a subtle glow under the islands
  ctx.shadowColor = "rgba(94,234,212,0.3)";
  ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();

  // Draw epicenter marker at actual coordinates
  const ep = projectToMap(eq.longitude, eq.latitude, plotX, plotY, plotW, plotH);
  // outer pulsing rings
  ctx.save();
  for (let i = 3; i >= 1; i--) {
    ctx.beginPath();
    ctx.arc(ep.x, ep.y, 14 + i * 12, 0, Math.PI * 2);
    ctx.fillStyle = `${sevColor}${i === 1 ? "44" : i === 2 ? "22" : "11"}`;
    ctx.fill();
  }
  // crosshair
  ctx.strokeStyle = sevColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ep.x - 30, ep.y); ctx.lineTo(ep.x - 10, ep.y);
  ctx.moveTo(ep.x + 10, ep.y); ctx.lineTo(ep.x + 30, ep.y);
  ctx.moveTo(ep.x, ep.y - 30); ctx.lineTo(ep.x, ep.y - 10);
  ctx.moveTo(ep.x, ep.y + 10); ctx.lineTo(ep.x, ep.y + 30);
  ctx.stroke();
  // center dot
  ctx.beginPath();
  ctx.arc(ep.x, ep.y, 8, 0, Math.PI * 2);
  ctx.fillStyle = sevColor;
  ctx.fill();
  ctx.strokeStyle = "#0a0e14";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();

  // Epicenter label
  ctx.fillStyle = sevColor;
  ctx.font = `700 ${Math.round(W * 0.014)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textBaseline = "middle";
  const lblText = "EPICENTER";
  let lblX = ep.x + 22;
  let lblY = ep.y - 22;
  // keep inside plot
  if (lblX + ctx.measureText(lblText).width > plotX + plotW) lblX = ep.x - 22 - ctx.measureText(lblText).width;
  if (lblY < plotY + 4) lblY = ep.y + 22;
  ctx.fillText(lblText, lblX, lblY);

  // ----- 7. Footer (source + attribution) -----
  const footerY = H - PAD;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  // Top accent line
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(PAD, footerY - Math.round(W * 0.06), W - PAD * 2, 1);

  // Source line
  ctx.fillStyle = "rgba(245,247,250,0.7)";
  ctx.font = `600 ${Math.round(W * 0.017)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText("DATA SOURCE", PAD, footerY - Math.round(W * 0.04));
  ctx.fillStyle = "#f5f7fa";
  ctx.font = `700 ${Math.round(W * 0.02)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText("DOST-PHIVOLCS", PAD, footerY - Math.round(W * 0.018));

  // Right-side attribution
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(245,247,250,0.5)";
  ctx.font = `500 ${Math.round(W * 0.014)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText("Generated by SEISMO PH · seismo.ph", W - PAD, footerY - Math.round(W * 0.04));
  ctx.fillStyle = "rgba(245,247,250,0.35)";
  ctx.font = `400 ${Math.round(W * 0.012)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText(
    "Refer to official government channels for verified warnings and advisories.",
    W - PAD, footerY - Math.round(W * 0.018),
  );
  ctx.textAlign = "left";
}

/** Format-aware filename for the generated PNG. */
function fileName(eq: EarthquakeEvent, format: CardFormat): string {
  const slug = (eq.locationDescription || "earthquake")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const m = eq.magnitude.toFixed(1);
  return `seismo-ph-m${m}-${format}-${slug}.png`;
}

export function ShareCard({ earthquake, className }: ShareCardProps) {
  const [format, setFormat] = useState<CardFormat>("square");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const generate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    // Revoke previous URL to avoid memory leak.
    if (blobUrl) { URL.revokeObjectURL(blobUrl); setBlobUrl(null); }
    try {
      // Yield to the event loop so the loading state can render before the
      // (synchronous, somewhat heavy) canvas drawing blocks the main thread.
      await new Promise((r) => setTimeout(r, 50));
      const spec = FORMATS.find((f) => f.id === format)!;
      const canvas = document.createElement("canvas");
      canvas.width = spec.w;
      canvas.height = spec.h;
      await drawShareCard(canvas, earthquake, format);
      canvasRef.current = canvas;
      // Preview (downscaled via CSS) + downloadable blob URL.
      const preview = canvas.toDataURL("image/png");
      setPreviewUrl(preview);
      const blob: Blob = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b!), "image/png"),
      );
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);
      toast.success("Share card generated");
    } catch (e) {
      console.error("[ShareCard] generation failed", e);
      setError("Unable to generate the share card. Please try again.");
      toast.error("Unable to generate the share card.");
    } finally {
      setGenerating(false);
    }
  }, [earthquake, format, blobUrl]);

  const download = useCallback(() => {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName(earthquake, format);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("Download started");
  }, [blobUrl, earthquake, format]);

  const share = useCallback(async () => {
    if (!blobUrl) return;
    try {
      const res = await fetch(blobUrl);
      const blob = await res.blob();
      const file = new File([blob], fileName(earthquake, format), { type: "image/png" });
      if (
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function" &&
        navigator.canShare?.({ files: [file] })
      ) {
        await navigator.share({
          title: `SEISMO PH — M ${earthquake.magnitude.toFixed(1)} ${earthquake.locationDescription}`,
          text: `Earthquake detected: M ${earthquake.magnitude.toFixed(1)} — ${earthquake.locationDescription}. Source: DOST-PHIVOLCS.`,
          files: [file],
        });
        toast.success("Shared");
      } else {
        download();
      }
    } catch (e) {
      // user-cancelled share is a non-error
      if (e instanceof Error && e.name === "AbortError") return;
      // Fall back to download
      download();
    }
  }, [blobUrl, earthquake, format, download]);

  return (
    <div className={cn("rounded-lg border border-border bg-card/40 p-3", className)}>
      <div className="flex items-center gap-2 text-sm font-medium">
        <ImageIcon className="h-4 w-4 text-primary" />
        Share Card
        <span className="ml-auto rounded bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
          PNG export
        </span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
        Generate a social-media-ready earthquake info card with the epicenter plotted on a
        stylized Philippine map. Only verified data from the database is included.
      </p>

      {/* Format selector */}
      <div className="mt-3">
        <div className="mb-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Format
        </div>
        <div className="grid grid-cols-4 gap-1">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFormat(f.id)}
              className={cn(
                "rounded-md border px-1.5 py-1.5 text-[10px] font-semibold transition",
                format === f.id
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-border bg-background/40 text-muted-foreground hover:bg-background/70 hover:text-foreground",
              )}
              aria-pressed={format === f.id}
            >
              <div>{f.label}</div>
              <div className="mt-0.5 font-mono text-[9px] opacity-70">
                {f.w}×{f.h}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 flex gap-2">
        <Button size="sm" onClick={generate} disabled={generating} className="h-8 flex-1">
          {generating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ImageIcon className="h-3.5 w-3.5" />
          )}
          {generating ? "Generating earthquake card…" : previewUrl ? "Regenerate" : "Generate Share Card"}
        </Button>
        {previewUrl && !generating && (
          <Button size="sm" variant="outline" onClick={download} className="h-8">
            <Download className="h-3.5 w-3.5" /> PNG
          </Button>
        )}
        {previewUrl && !generating && (
          <Button size="sm" variant="outline" onClick={share} className="h-8">
            <Share2 className="h-3.5 w-3.5" /> Share
          </Button>
        )}
      </div>

      {error && (
        <div className="mt-2 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {previewUrl && !generating && (
        <div className="mt-3">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            <MapPin className="h-3 w-3" /> Preview
            <span className="ml-auto opacity-70">{FORMATS.find((f) => f.id === format)!.label}</span>
          </div>
          <div className="relative max-h-96 overflow-y-auto rounded-md border border-border bg-background/60 p-2 scroll-slim">
            {/* Using a plain <img> because the source is a runtime-generated PNG
                data URL; next/image would offer no caching or optimization here. */}
            <img
              src={previewUrl}
              alt={`Share card preview — M ${earthquake.magnitude.toFixed(1)} ${earthquake.locationDescription}`}
              className="block h-auto w-full rounded"
            />
          </div>
        </div>
      )}
    </div>
  );
}
