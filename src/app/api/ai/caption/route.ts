// POST /api/ai/caption — AI-generated social media caption for an earthquake.
//
// Grounded strictly in DB values. The LLM is instructed to:
//   - generate a shareable caption in one of 5 styles
//   - NEVER predict earthquakes, aftershocks, future events
//   - NEVER invent intensity, casualties, damage, or tsunami information
//   - NEVER exaggerate magnitude or claim official warnings exist
//   - ONLY use verified earthquake data from the database
//
// The mandatory official-source disclaimer is appended server-side so the
// user cannot strip it.

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { clientIp, HttpError, jsonError, jsonOk, rateLimit, withErrors } from "@/lib/api";
import { mapEarthquake } from "@/lib/mappers";
import { generateText } from "@/lib/ai-client";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type CaptionStyle = "informative" | "short" | "taglish" | "formal" | "community";

const STYLE_GUIDE: Record<CaptionStyle, string> = {
  informative:
    "Write a clear, factual caption (3–5 sentences) suitable for a news organization's social post. Lead with magnitude + location, then key facts (depth, time, type). Plain English.",
  short:
    "Write a punchy single-sentence caption (max ~20 words). One line only. No hashtags beyond #SeismoPH.",
  taglish:
    "Write the caption in conversational Taglish (mix of Tagalog and English) common on Philippine social media. 2–3 sentences. Approachable but factual.",
  formal:
    "Write a formal, official-sounding bulletin caption (3–4 sentences). Use 'The Philippine Institute of Volcanology and Seismology (PHIVOLCS)' style register but DO NOT impersonate PHIVOLCS — attribute the data to PHIVOLCS, not yourself.",
  community:
    "Write a community-alert caption (2–3 sentences) aimed at residents near the epicenter. Factual + calm. Include 'Drop, Cover, and Hold On' as a preparedness reminder. Never claim an ongoing emergency.",
};

const SYSTEM_PROMPT = `You are SEISMO PH, a tool that drafts social-media captions for Philippine earthquakes.

ABSOLUTE RULES — never break these:
1. NEVER predict earthquakes, aftershocks, or any future seismic activity. Earthquakes cannot be reliably predicted.
2. NEVER invent intensity reports, casualties, injuries, damage assessments, tsunami warnings, evacuation orders, or any information not present in the supplied data. If a field is missing, OMIT it — do not say "no reports" if it isn't in the data.
3. NEVER exaggerate magnitude or severity. Use the exact value provided.
4. NEVER claim or imply that an official warning, advisory, or alert has been issued unless the data explicitly contains one. (It does not.)
5. NEVER impersonate DOST-PHIVOLCS. You are SEISMO PH, an educational platform that RE-PUBLISHES PHIVOLCS data.
6. ONLY use the verified earthquake data provided in the user message. Do not introduce any other facts about the event.
7. Do not use emojis excessively. At most one emoji if the style warrants it (e.g. community). No alarm/siren emojis.
8. Magnitude = energy at the source (one value). Intensity = shaking felt at a location (varies). Never confuse them.
9. End the caption with exactly this line (you may add line breaks before it but DO NOT modify it):
   Source: DOST-PHIVOLCS. Please refer to official government channels for verified warnings and advisories.
10. Do not include hashtags other than optional #SeismoPH at the very end of the caption body (before the source line).
11. Output ONLY the caption text. No preamble, no JSON, no markdown fences.`;

export const POST = withErrors(async (req: NextRequest) => {
  // Rate limit: 10 req/min per IP.
  if (!rateLimit(`ai:caption:${clientIp(req)}`, 10, 10 / 60)) {
    return jsonError({ code: "RATE_LIMITED", message: "Too many requests. Slow down." }, 429);
  }

  const body = (await req.json().catch(() => null)) as {
    earthquakeId?: string;
    style?: string;
  } | null;

  if (!body?.earthquakeId) {
    throw new HttpError(400, "MISSING_EARTHQUAKE_ID", "earthquakeId is required.");
  }
  const style: CaptionStyle = (["informative", "short", "taglish", "formal", "community"].includes(body.style ?? "")
    ? (body.style as CaptionStyle)
    : "informative");

  const eq = await db.earthquake.findUnique({
    where: { id: body.earthquakeId },
    include: { intensities: { orderBy: { intensity: "desc" }, take: 8 } },
  });
  if (!eq) {
    throw new HttpError(404, "EARTHQUAKE_NOT_FOUND", "Earthquake not found.");
  }

  // Build the factual summary the LLM is allowed to use.
  const facts: string[] = [
    `Magnitude: ${eq.magnitude} ${eq.magnitudeType}`,
    `Focal depth: ${eq.depthKm} km`,
    `Epicenter (lat, lon): ${eq.latitude}, ${eq.longitude}`,
    `Location description: ${eq.locationDescription}`,
    `Origin time (UTC, ISO 8601): ${eq.originTime.toISOString()}`,
    `Event type: ${eq.eventType}`,
    `Status: ${eq.status}`,
    `Data source: ${eq.source === "DEV-SEED" ? "Development fixture data (NOT real)" : eq.source === "USGS" ? "U.S. Geological Survey (USGS) — real, live data" : "DOST-PHIVOLCS"}`,
  ];

  if (eq.intensities.length > 0) {
    facts.push(
      "Reported intensities (PEIS — use verbatim, do not infer others): " +
        eq.intensities
          .map((i) => `${i.locality}${i.province ? ` (${i.province})` : ""} — Intensity ${i.intensity}`)
          .join("; "),
    );
  }
  // IMPORTANT: we do NOT add a "no intensities" line — the LLM must simply omit
  // any intensity mention when none exist in the data.

  const userPrompt = `Verified earthquake data from the SEISMO PH database (use ONLY these values):
${facts.map((f) => `- ${f}`).join("\n")}

Caption style: ${style}
Style guide: ${STYLE_GUIDE[style]}

Write the caption now. Follow every rule in your system instructions. Remember: output ONLY the caption text (the mandatory source line is the final line).`;

  // Use the unified AI client with retry + timeout + request ID
  try {
    const result = await generateText(SYSTEM_PROMPT, userPrompt);
    let caption = result.text;

    // Hard-append the mandatory source line
    const disclaimer =
      "Source: DOST-PHIVOLCS. Please refer to official government channels for verified warnings and advisories.";
    caption = caption
      .split(/\n/)
      .filter((l) => !/Source:\s*DOST-PHIVOLCS/i.test(l))
      .join("\n")
      .trim();
    caption = `${caption}\n\n${disclaimer}`;

    return jsonOk({
      data: {
        caption,
        disclaimer,
        style,
        earthquake: mapEarthquake(eq),
        grounded: true,
        requestId: result.requestId,
      },
    });
  } catch (e) {
    const requestId = e instanceof Error && "requestId" in e ? (e as { requestId: string }).requestId : "unknown";
    return jsonError(
      { code: "AI_UNAVAILABLE", message: "AI caption service temporarily unavailable. Please try again.", details: { requestId } },
      503,
    );
  }
});
