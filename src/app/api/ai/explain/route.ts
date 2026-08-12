// POST /api/ai/explain — AI-generated explanation of an earthquake.
//
// Grounded strictly in database values for the requested earthquake. The LLM is
// instructed to:
//   - explain magnitude / depth / intensity / distance concepts
//   - NEVER predict earthquakes, aftershocks, or future events
//   - NEVER issue official warnings or override PHIVOLCS information
//   - NEVER invent missing measurements
//   - clearly label output as "AI-generated explanation"
//
// The response is wrapped and tagged so the UI can render the disclaimer.

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { clientIp, HttpError, jsonError, jsonOk, rateLimit, withErrors } from "@/lib/api";
import { haversineKm, bearingDeg, bearingLabel } from "@/lib/geo";
import { mapEarthquake } from "@/lib/mappers";
import { generateText } from "@/lib/ai-client";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SYSTEM_PROMPT = `You are SEISMO PH, an educational explainer for Philippine earthquake information.

ABSOLUTE RULES — never break these:
1. NEVER predict earthquakes, aftershocks, or any future seismic activity. Earthquakes cannot be reliably predicted.
2. NEVER issue warnings, advisories, or safety declarations. Official warnings come only from DOST-PHIVOLCS and local authorities.
3. NEVER override or contradict official PHIVOLCS information.
4. NEVER invent measurements. If a value is missing or marked "unknown/unavailable", say so explicitly.
5. Clearly distinguish: official earthquake data (from DOST-PHIVOLCS) vs application-derived values (distances, statistics) vs your educational explanation.
6. Keep explanations concise (max ~180 words), factual, and calm. Do not sensationalize magnitude.
7. Magnitude = size/energy at the source (one value per event). Intensity = shaking felt at a specific location (varies by place). Never confuse them.
8. Always end with the line: "— AI-generated explanation. Verify with DOST-PHIVOLCS for official information."

You are given verified earthquake data from the platform's database. Base your explanation ONLY on those values.`;

export const POST = withErrors(async (req: NextRequest) => {
  // Rate limit: 10 req/min per IP.
  if (!rateLimit(`ai:${clientIp(req)}`, 10, 10 / 60)) {
    return jsonError({ code: "RATE_LIMITED", message: "Too many requests. Slow down." }, 429);
  }

  const body = (await req.json().catch(() => null)) as {
    earthquakeId?: string;
    question?: string;
    userLocation?: { name?: string; latitude?: number; longitude?: number };
  } | null;

  if (!body?.earthquakeId) {
    throw new HttpError(400, "MISSING_EARTHQUAKE_ID", "earthquakeId is required.");
  }

  const eq = await db.earthquake.findUnique({
    where: { id: body.earthquakeId },
    include: { intensities: { orderBy: { intensity: "desc" }, take: 8 } },
  });
  if (!eq) {
    throw new HttpError(404, "EARTHQUAKE_NOT_FOUND", "Earthquake not found.");
  }

  const facts: string[] = [
    `Official magnitude: ${eq.magnitude} ${eq.magnitudeType}`,
    `Focal depth: ${eq.depthKm} km`,
    `Epicenter (lat, lon): ${eq.latitude}, ${eq.longitude}`,
    `Location description: ${eq.locationDescription}`,
    `Origin time (UTC): ${eq.originTime.toISOString()}`,
    `Event type: ${eq.eventType}`,
    `Status: ${eq.status}`,
    `Data source: ${eq.source === "DEV-SEED" ? "Development fixture data (NOT real)" : eq.source === "USGS" ? "U.S. Geological Survey (USGS) — real, live data" : "DOST-PHIVOLCS"}`,
  ];

  if (eq.intensities.length > 0) {
    facts.push(
      "Reported intensities (PEIS): " +
        eq.intensities
          .map((i) => `${i.locality} — Intensity ${i.intensity}`)
          .join("; "),
    );
  } else {
    facts.push("Reported intensities: none available in the database.");
  }

  let distanceNote = "";
  if (
    body.userLocation &&
    typeof body.userLocation.latitude === "number" &&
    typeof body.userLocation.longitude === "number"
  ) {
    const dist = haversineKm(
      body.userLocation.latitude,
      body.userLocation.longitude,
      eq.latitude,
      eq.longitude,
    );
    const bear = bearingDeg(
      body.userLocation.latitude,
      body.userLocation.longitude,
      eq.latitude,
      eq.longitude,
    );
    distanceNote = `Application-derived distance from ${body.userLocation.name ?? "selected location"}: ${Math.round(dist)} km, bearing ${Math.round(bear)}° (${bearingLabel(bear)}). This is computed by the application, not reported by PHIVOLCS.`;
  }

  const userQuestion =
    body.question?.trim() ||
    "Explain what this earthquake's magnitude and depth mean, and how intensity differs from magnitude.";

  const userPrompt = `Verified earthquake data from the SEISMO PH database:
${facts.map((f) => `- ${f}`).join("\n")}

${distanceNote}

User question: ${userQuestion}

Explain using ONLY the data above. Follow all rules in your system instructions.`;

  // Use the unified AI client (Google Gemini on Vercel, z-ai fallback locally)
  const explanation = await generateText(SYSTEM_PROMPT, userPrompt);

  return jsonOk({
    data: {
      explanation,
      disclaimer:
        "AI-generated explanation. Not an official forecast or warning. Verify with DOST-PHIVOLCS for authoritative information.",
      earthquake: mapEarthquake(eq),
      grounded: true,
    },
  });
});
