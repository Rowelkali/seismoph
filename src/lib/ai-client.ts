// SEISMO PH — Unified AI client.
// Uses Google Gemini API (works on Vercel) with z-ai-web-dev-sdk fallback
// (for local sandbox where Google API may be location-restricted).

const GEMINI_API_KEY = process.env.GOOGLE_AI_API_KEY;

// Try multiple model names — Google frequently renames/deprecates models.
const GEMINI_MODELS = [
  "gemini-2.0-flash-001",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-pro",
];

/** Generate text using Google Gemini API (REST, no SDK needed). */
async function generateWithGemini(systemPrompt: string, userPrompt: string): Promise<string> {
  let lastError = "";

  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) {
        const err = await res.text();
        lastError = `${model}: ${res.status}`;
        if (res.status === 404) continue; // try next model
        if (res.status === 400 && err.includes("location")) {
          throw new Error(`Gemini location-restricted: ${err.slice(0, 100)}`);
        }
        throw new Error(`Gemini ${lastError}: ${err.slice(0, 150)}`);
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) { lastError = `${model}: empty`; continue; }
      return text.trim();
    } catch (e: unknown) {
      lastError = String(e).slice(0, 150);
      if (String(e).includes("location")) throw e; // don't try more models
      continue;
    }
  }

  throw new Error(`All Gemini models failed: ${lastError}`);
}

/** Generate text using z-ai-web-dev-sdk (local sandbox fallback). */
async function generateWithZai(systemPrompt: string, userPrompt: string): Promise<string> {
  const ZAI = (await import("z-ai-web-dev-sdk")).default;
  const zai = await ZAI.create();
  const completion = await zai.chat.completions.create({
    messages: [
      { role: "assistant", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    thinking: { type: "disabled" },
  });
  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error("z-ai returned empty response");
  return text.trim();
}

/**
 * Generate text using the best available AI provider.
 * Tries Google Gemini first (for Vercel production), falls back to
 * z-ai-web-dev-sdk (for local sandbox where Gemini may be location-restricted).
 */
export async function generateText(systemPrompt: string, userPrompt: string): Promise<string> {
  if (GEMINI_API_KEY) {
    try {
      return await generateWithGemini(systemPrompt, userPrompt);
    } catch (e) {
      console.error("[ai] Gemini failed, trying z-ai:", String(e).slice(0, 120));
    }
  }
  return await generateWithZai(systemPrompt, userPrompt);
}
